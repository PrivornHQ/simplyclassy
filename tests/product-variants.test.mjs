import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { test } from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = new URL("../", import.meta.url);
async function loadModule(path, dependencies = {}, cwd = process.cwd()) {
  const source = await readFile(new URL(path, root), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const module = { exports: {} };
  new Function("require", "module", "exports", "process", "crypto", outputText)(
    (id) => (id in dependencies ? dependencies[id] : require(id)),
    module,
    module.exports,
    { ...process, cwd: () => cwd },
    webcrypto,
  );
  return module.exports;
}

const products = await loadModule("src/data/products.ts");
const orderData = await loadModule("src/data/orders.ts");
const variants = await loadModule("src/lib/product-variants.ts", { "@/data/products": products });
const cart = await loadModule("src/lib/order-cart.ts", { "@/data/products": products });
const photo = await readFile(new URL("public/catalog/placeholder-watch.jpg", root));
const imageFile = (name = "watch.jpg") => new File([photo], name, { type: "image/jpeg" });
const legacy = {
  id: "legacy-watch",
  name: "Classic Watch",
  category: "watches",
  price: 250,
  image: "/catalog/placeholder-watch.jpeg",
  alt: "Classic Watch",
  badge: null,
  available: true,
  createdAt: "2026-10-14T10:00:00Z",
  description: "Original watch",
};

function memoryKV(initial = []) {
  const values = new Map([["products.json", JSON.stringify(initial)]]);
  const metadata = new Map();
  return {
    values,
    failPut: null,
    failGet: null,
    async get(key) {
      if (key === this.failGet) throw new Error("Storage read failed");
      return values.get(key) ?? null;
    },
    async getWithMetadata(key) {
      const value = values.get(key);
      return {
        value: value instanceof Uint8Array ? value.slice().buffer : null,
        metadata: metadata.get(key) ?? null,
      };
    },
    async put(key, value, options) {
      if (key === this.failPut) throw new Error("Storage write failed");
      values.set(key, typeof value === "string" ? value : new Uint8Array(value));
      metadata.set(key, options?.metadata);
    },
    async delete(key) {
      values.delete(key);
      metadata.delete(key);
    },
    async list({ prefix }) {
      return {
        keys: [...values.keys()].filter((key) => key.startsWith(prefix)).map((name) => ({ name })),
        list_complete: true,
      };
    },
  };
}

const serverFns = {
  createServerFn: () => ({
    handler: (handler) => () => handler({ data: undefined }),
    validator: (validator) => ({
      handler:
        (handler) =>
        async ({ data }) =>
          handler({
            data: typeof validator === "function" ? validator(data) : validator.parse(data),
          }),
    }),
  }),
};

async function context(kv = memoryKV(), cwd) {
  let authorized = true;
  const request = {
    getRequest: () => ({ runtime: { cloudflare: { env: { simplyclassy_catalog: kv } } } }),
  };
  const store = await loadModule(
    "src/server/catalog-store.server.ts",
    {
      "@/data/products": products,
      "@/lib/product-variants": variants,
      "@tanstack/start-server-core": request,
    },
    cwd,
  );
  const catalog = await loadModule(
    "src/lib/catalog.functions.ts",
    {
      "@/data/products": products,
      "@/lib/product-variants": variants,
      "@/server/catalog-store.server": store,
      "@tanstack/react-start": serverFns,
      "@/server/admin-auth.server": {
        requireAdminSession: async () => {
          if (!authorized) throw new Error("Unauthorized");
        },
      },
    },
    cwd,
  );
  const orders = await loadModule(
    "src/server/order-store.server.ts",
    {
      "@/data/products": products,
      "@/data/orders": orderData,
      "@/server/catalog-store.server": store,
      "@tanstack/start-server-core": request,
    },
    cwd,
  );
  return {
    store,
    catalog,
    orders,
    authorize: (value) => {
      authorized = value;
    },
  };
}

function form(id, manifest, main = false) {
  const data = new FormData();
  if (id) data.set("id", id);
  data.set("name", "Classic Watch");
  data.set("category", "watches");
  data.set("price", "250");
  data.set("description", "A classic watch.");
  data.set("available", "true");
  data.set("badge", "");
  if (main) data.set("image", imageFile());
  if (manifest) data.set("colors", JSON.stringify(manifest));
  return data;
}

function colorForm(id, main = !id) {
  const data = form(
    id,
    {
      colors: [
        {
          id: "black",
          name: "Black",
          swatch: "#000000",
          images: [
            { uploadKey: "color-image-black-front" },
            { uploadKey: "color-image-black-back" },
          ],
        },
        {
          id: "gold",
          name: "Gold",
          swatch: "#c7a145",
          images: [{ uploadKey: "color-image-gold-front" }],
        },
      ],
      defaultColorId: "gold",
    },
    main,
  );
  for (const key of ["black-front", "black-back", "gold-front"])
    data.set(`color-image-${key}`, imageFile(`${key}.jpg`));
  return data;
}

test("creating a product persists its main image, multiple color images and default", async () => {
  const kv = memoryKV([legacy]);
  const { catalog, store } = await context(kv);
  const created = await catalog.saveAdminProduct({ data: colorForm() });
  assert.equal(created.colors.length, 2);
  assert.equal(created.defaultColorId, "gold");
  assert.equal(created.colors[0].images.length, 2);
  assert.notEqual(created.image, created.colors[0].images[0]);
  assert.notEqual(created.colors[0].images[0], created.colors[1].images[0]);
  const main = await store.readProductImage(store.managedImageKeyFromUrl(created.image));
  assert.equal(main.contentType, "image/jpeg");
  assert.deepEqual(Buffer.from(main.data), photo);
  const fresh = await context(kv);
  const saved = (await fresh.store.listStoredProducts()).find(
    (product) => product.id === created.id,
  );
  assert.deepEqual(saved, created);
  assert.deepEqual(
    (await fresh.catalog.listPublicProducts()).find((product) => product.id === created.id).colors,
    created.colors,
  );
  assert.deepEqual(
    (await fresh.store.listStoredProducts()).find((product) => product.id === legacy.id),
    legacy,
  );
});

test("edits remove colors and individual images, replace images and change the default", async () => {
  const kv = memoryKV();
  const { catalog } = await context(kv);
  const created = await catalog.saveAdminProduct({ data: colorForm() });
  const oldBlack = created.colors[0];
  const edit = form(created.id, {
    colors: [
      {
        id: oldBlack.id,
        name: "Midnight Black",
        swatch: "#101010",
        images: [{ uploadKey: "color-image-black-replacement" }],
      },
    ],
    defaultColorId: "black",
  });
  edit.set("color-image-black-replacement", imageFile());
  edit.set("name", "Updated Watch");
  edit.set("price", "275.50");
  const updated = await catalog.saveAdminProduct({ data: edit });
  const fresh = await context(kv);
  const [saved] = await fresh.store.listStoredProducts();
  assert.equal(saved.name, "Updated Watch");
  assert.equal(saved.price, 275.5);
  assert.equal(saved.createdAt, created.createdAt);
  assert.equal(saved.image, created.image);
  assert.equal(saved.defaultColorId, "black");
  assert.equal(saved.colors.length, 1);
  assert.equal(saved.colors[0].images.length, 1);
  assert.notEqual(saved.colors[0].images[0], oldBlack.images[0]);
  assert.deepEqual(saved, updated);
  const noColors = await catalog.saveAdminProduct({ data: form(created.id, { colors: [] }) });
  assert.equal(noColors.colors, undefined);
  assert.equal(noColors.defaultColorId, undefined);
  assert.equal((await (await context(kv)).store.listStoredProducts())[0].colors, undefined);
});

test("legacy edits preserve optional colors when the color manifest is omitted", async () => {
  const kv = memoryKV([legacy]);
  const { catalog } = await context(kv);
  const existing = await catalog.saveAdminProduct({ data: colorForm(legacy.id) });
  const updated = await catalog.saveAdminProduct({ data: form(legacy.id) });
  assert.deepEqual(updated.colors, existing.colors);
  assert.equal(updated.image, legacy.image);
  assert.equal(updated.defaultColorId, existing.defaultColorId);
});

test("deleting the last product remains empty after reload and cannot be resurrected by an edit", async () => {
  const kv = memoryKV([legacy]);
  const { catalog } = await context(kv);
  await catalog.deleteAdminProduct({ data: { id: legacy.id } });
  const fresh = await context(kv);
  assert.deepEqual(await fresh.store.listStoredProducts(), []);
  assert.deepEqual(await fresh.catalog.listPublicProducts(), []);
  await assert.rejects(catalog.saveAdminProduct({ data: form(legacy.id) }), /no longer exists/);
  assert.equal(kv.values.get("products.json"), "[]");
});

test("the catalogue seeds only a missing store and never overwrites corrupt or unreadable data", async () => {
  const kv = memoryKV();
  kv.values.delete("products.json");
  assert.equal(
    (await (await context(kv)).store.listStoredProducts()).length,
    products.seedProducts.length,
  );
  kv.values.set("products.json", "invalid json");
  await assert.rejects((await context(kv)).store.listStoredProducts(), /could not be read/);
  assert.equal(kv.values.get("products.json"), "invalid json");
  kv.failGet = "products.json";
  await assert.rejects((await context(kv)).store.listStoredProducts(), /Storage read failed/);
});

test("failed metadata writes roll back new uploads and leave existing records and images intact", async () => {
  const kv = memoryKV();
  const { catalog } = await context(kv);
  const existing = await catalog.saveAdminProduct({ data: colorForm() });
  const before = new Map(kv.values);
  kv.failPut = "products.json";
  await assert.rejects(
    catalog.saveAdminProduct({ data: colorForm(existing.id, true) }),
    /Storage write failed/,
  );
  assert.deepEqual(kv.values, before);
  assert.deepEqual((await (await context(kv)).store.listStoredProducts())[0], existing);
});

test("admin authentication protects creation, edits and deletion", async () => {
  const kv = memoryKV([legacy]);
  const ctx = await context(kv);
  ctx.authorize(false);
  await assert.rejects(ctx.catalog.saveAdminProduct({ data: colorForm() }), /Unauthorized/);
  await assert.rejects(
    ctx.catalog.saveAdminProduct({ data: colorForm(legacy.id) }),
    /Unauthorized/,
  );
  await assert.rejects(ctx.catalog.deleteAdminProduct({ data: { id: legacy.id } }), /Unauthorized/);
  assert.deepEqual(await ctx.catalog.listPublicProducts(), [legacy]);
});

test("color validation rejects duplicate names, invalid defaults, empty galleries and invalid swatches", async () => {
  const { catalog } = await context(memoryKV([legacy]));
  const cases = [
    { colors: [{ id: "black", name: "Black", images: [] }], defaultColorId: "black" },
    {
      colors: [
        { id: "black", name: "Black", swatch: "red", images: [{ uploadKey: "color-image-one" }] },
      ],
      defaultColorId: "black",
    },
    {
      colors: [{ id: "black", name: "Black", images: [{ uploadKey: "color-image-one" }] }],
      defaultColorId: "missing",
    },
    {
      colors: [
        { id: "one", name: "Black", images: [{ uploadKey: "color-image-one" }] },
        { id: "two", name: " black ", images: [{ uploadKey: "color-image-two" }] },
      ],
      defaultColorId: "one",
    },
  ];
  for (const manifest of cases)
    await assert.rejects(catalog.saveAdminProduct({ data: form(legacy.id, manifest) }));
  assert.equal(
    variants.productColorsSchema.safeParse(
      Array.from({ length: 25 }, (_, index) => ({
        id: `${index}`,
        name: `${index}`,
        images: ["/image.jpg"],
      })),
    ).success,
    false,
  );
  assert.equal(
    variants.productColorsSchema.safeParse([
      { id: "black", name: "Black", images: Array(9).fill("/image.jpg") },
    ]).success,
    false,
  );
});

test("images must belong to their product and color, and uploads must be valid", async () => {
  const { catalog } = await context();
  const existing = await catalog.saveAdminProduct({ data: colorForm() });
  const hijack = form(existing.id, {
    colors: [{ id: "black", name: "Black", images: [{ url: existing.colors[1].images[0] }] }],
    defaultColorId: "black",
  });
  await assert.rejects(
    catalog.saveAdminProduct({ data: hijack }),
    /belong to this product and color/,
  );
  const missing = colorForm(existing.id);
  missing.delete("color-image-black-front");
  await assert.rejects(catalog.saveAdminProduct({ data: missing }), /Upload the images/);
  const badType = form(existing.id);
  badType.set("image", new File(["script"], "script.svg", { type: "image/svg+xml" }));
  await assert.rejects(catalog.saveAdminProduct({ data: badType }), /JPG, PNG/);
  const tooLarge = form(existing.id);
  tooLarge.set(
    "image",
    new File([new Uint8Array(products.MAX_PRODUCT_IMAGE_BYTES + 1)], "large.jpg", {
      type: "image/jpeg",
    }),
  );
  await assert.rejects(catalog.saveAdminProduct({ data: tooLarge }), /under 4MB/);
});

test("simultaneous product creations preserve both products", async () => {
  const { catalog, store } = await context();
  const [first, second] = await Promise.all([
    catalog.saveAdminProduct({ data: form(undefined, { colors: [] }, true) }),
    catalog.saveAdminProduct({ data: form(undefined, { colors: [] }, true) }),
  ]);
  assert.notEqual(first.id, second.id);
  assert.equal((await store.listStoredProducts()).length, 2);
});

test("cart lines retain separate colors across serialization, and legacy carts still work", () => {
  const product = {
    ...legacy,
    defaultColorId: "gold",
    colors: [
      { id: "black", name: "Black", images: ["/black.jpg"] },
      { id: "gold", name: "Gold", images: ["/gold.jpg"] },
    ],
  };
  let items = cart.addProductToCart([], product, "black");
  items = cart.addProductToCart(items, product, "gold");
  items = cart.addProductToCart(items, product, "black");
  assert.equal(items.length, 2);
  assert.equal(items[0].quantity, 2);
  assert.equal(items[1].quantity, 1);
  assert.equal(items[0].image, "/black.jpg");
  assert.equal(items[1].colorName, "Gold");
  assert.deepEqual(cart.parseStoredCartItems(JSON.parse(JSON.stringify(items))), items);
  assert.equal(cart.addProductToCart([], product)[0].colorId, "gold");
  assert.equal(cart.addProductToCart([], legacy)[0].colorId, undefined);
  assert.equal(cart.parseStoredCartItems(cart.addProductToCart([], legacy)).length, 1);
  assert.throws(() => cart.addProductToCart([], product, "deleted"), /available color/);
  assert.equal(cart.parseStoredCartItems([{ ...items[0], colorName: undefined }]).length, 0);
  assert.deepEqual(products.getProductGallery(product, "gold"), ["/gold.jpg"]);
  assert.deepEqual(products.getProductGallery(legacy), [legacy.image]);
});

test("checkout persists distinct colors, rejects removed colors, and preserves historical snapshots and images", async () => {
  const kv = memoryKV();
  const { catalog, orders, store } = await context(kv);
  const product = await catalog.saveAdminProduct({ data: colorForm() });
  const order = await orders.createStoredOrder({
    name: "Test Customer",
    location: "Accra",
    cart: [
      { productId: product.id, colorId: "gold", quantity: 1 },
      { productId: product.id, colorId: "black", quantity: 2 },
      { productId: product.id, colorId: "gold", quantity: 2 },
    ],
  });
  assert.equal(order.items.length, 2);
  assert.equal(order.overallTotal, 1250);
  assert.equal(order.items[0].colorName, "Gold");
  assert.equal(order.items[0].quantity, 3);
  assert.equal(order.items[0].productImage, product.colors[1].images[0]);
  const edit = form(product.id, {
    colors: [
      { id: "black", name: "Black", images: product.colors[0].images.map((url) => ({ url })) },
    ],
    defaultColorId: "black",
  });
  await catalog.saveAdminProduct({ data: edit });
  await assert.rejects(
    orders.createStoredOrder({
      name: "Test Customer",
      location: "Accra",
      cart: [{ productId: product.id, colorId: "gold", quantity: 1 }],
    }),
    /colors are no longer available/,
  );
  await assert.rejects(
    orders.createStoredOrder({
      name: "Test Customer",
      location: "Accra",
      cart: [{ productId: product.id, quantity: 1 }],
    }),
    /colors are no longer available/,
  );
  await catalog.deleteAdminProduct({ data: { id: product.id } });
  const fresh = await context(kv);
  assert.deepEqual(await fresh.orders.readStoredOrder(order.id), order);
  assert.ok(
    await store.readProductImage(store.managedImageKeyFromUrl(order.items[0].productImage)),
  );
  assert.deepEqual(await fresh.store.listStoredProducts(), []);
  const message = new URL(
    products.orderWhatsAppLink({
      orderNumber: order.orderNumber,
      name: order.name,
      location: order.location,
      orderUrl: "https://example.test/order/1",
      itemCount: 5,
      total: order.overallTotal,
      items: order.items,
    }),
  ).searchParams.get("text");
  assert.match(message, /3 x Classic Watch \(Gold\)/);
  assert.match(message, /2 x Classic Watch \(Black\)/);
});

test("local product storage persists colors, images and an empty catalogue across fresh sessions", async () => {
  const directory = await mkdtemp(join(tmpdir(), "simplyclassy-variants-test-"));
  try {
    const { catalog } = await context(null, directory);
    const created = await catalog.saveAdminProduct({ data: colorForm() });
    const fresh = await context(null, directory);
    const saved = (await fresh.store.listStoredProducts()).find((value) => value.id === created.id);
    assert.deepEqual(saved, created);
    assert.ok(
      await fresh.store.readProductImage(
        fresh.store.managedImageKeyFromUrl(saved.colors[0].images[0]),
      ),
    );
    const all = await fresh.store.listStoredProducts();
    for (const product of all) await fresh.catalog.deleteAdminProduct({ data: { id: product.id } });
    assert.deepEqual(await (await context(null, directory)).store.listStoredProducts(), []);
  } finally {
    assert.equal(resolve(dirname(directory)), resolve(tmpdir()));
    assert.ok(basename(directory).startsWith("simplyclassy-variants-test-"));
    await rm(directory, { recursive: true, force: true });
  }
});
