import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const profile = await mkdtemp(join(tmpdir(), "simplyclassy-browser-test-"));
const screenshots = join(tmpdir(), "simplyclassy-variant-screenshots");
const server = createServer();
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;
await new Promise((resolve) => server.close(resolve));
const browser = spawn(
  process.env.VARIANT_BROWSER ??
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--disable-background-networking",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    "about:blank",
  ],
  { windowsHide: true, stdio: "ignore" },
);
let socket;
let session;
let messageId = 0;
const pending = new Map();
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function until(check, description) {
  for (let attempt = 0; attempt < 300; attempt++) {
    if (await check()) return;
    await delay(200);
  }
  throw new Error(`Timed out: ${description}`);
}

function send(method, params = {}, scoped = true) {
  const id = ++messageId;
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Timed out: ${method}`));
    }, 15000);
    pending.set(id, {
      resolve: (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      reject: (error) => {
        clearTimeout(timeout);
        reject(error);
      },
    });
    socket.send(
      JSON.stringify({ id, method, params, ...(scoped && session ? { sessionId: session } : {}) }),
    );
  });
}

async function evaluate(expression) {
  const result = await send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails)
    throw new Error(
      result.exceptionDetails.text + " " + result.exceptionDetails.exception?.description,
    );
  return result.result.value;
}

const button = (text) =>
  `Array.from((Array.from(document.querySelectorAll('[role="dialog"][data-state="open"]')).at(-1) ?? document).querySelectorAll('button')).find(button => button.textContent.trim() === ${JSON.stringify(text)})`;
async function click(expression) {
  assert.equal(
    await evaluate(
      `(() => { const element = ${expression}; if (!element) return false; element.click(); return true; })()`,
    ),
    true,
    expression,
  );
  await delay(100);
}

async function type(selector, text) {
  await evaluate(
    `(() => { const input = document.querySelector(${JSON.stringify(selector)}); input.focus(); input.select(); })()`,
  );
  await send("Input.insertText", { text });
}

async function upload(selector, count = 1) {
  const { root: document } = await send("DOM.getDocument");
  const { nodeId } = await send("DOM.querySelector", { nodeId: document.nodeId, selector });
  assert.ok(nodeId, selector);
  await send("DOM.setFileInputFiles", {
    nodeId,
    files: Array.from({ length: count }, (_, index) =>
      join(
        root,
        "public",
        "catalog",
        index % 2 ? "placeholder-watch.jpeg" : "placeholder-watch.jpg",
      ),
    ),
  });
  await until(
    () => evaluate("!document.querySelector('button[type=submit]')?.disabled"),
    "image optimization",
  );
}

async function screenshot(name) {
  await delay(600);
  await mkdir(screenshots, { recursive: true });
  const { data } = await send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
  });
  await writeFile(join(screenshots, `${name}.png`), Buffer.from(data, "base64"));
}

try {
  let endpoint;
  await until(async () => {
    try {
      endpoint = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
      return true;
    } catch {
      return false;
    }
  }, "browser startup");
  socket = new WebSocket(endpoint.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (!pending.has(message.id)) return;
    const request = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) request.reject(new Error(message.error.message));
    else request.resolve(message.result);
  });
  const { targetId } = await send("Target.createTarget", { url: "about:blank" }, false);
  ({ sessionId: session } = await send(
    "Target.attachToTarget",
    { targetId, flatten: true },
    false,
  ));
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1280,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await send("Page.navigate", { url: "http://127.0.0.1:5174/tests/browser/variants.html" });
  await until(
    () => evaluate("Boolean(document.querySelector('button[aria-label=\"View Classic Watch\"]'))"),
    "customer fixture",
  );
  await click("document.querySelector('button[aria-label=\"View Classic Watch\"]')");
  await until(
    () => evaluate("Boolean(document.querySelector('[role=dialog] img'))"),
    "product dialog",
  );
  assert.equal(
    await evaluate("document.querySelector('[role=dialog] img').src.includes('gold-front')"),
    true,
  );
  assert.equal(await evaluate(`${button("Gold")}.getAttribute('aria-pressed')`), "true");
  await click(button("Black"));
  assert.equal(
    await evaluate("document.querySelector('[role=dialog] img').src.includes('black-front')"),
    true,
  );
  await click("document.querySelector('button[aria-label=\"Next image\"]')");
  assert.equal(
    await evaluate("document.querySelector('[role=dialog] img').src.includes('black-back')"),
    true,
  );
  await until(
    () =>
      evaluate(
        "Array.from(document.querySelectorAll('[role=dialog] img')).every(image => image.complete && image.naturalWidth > 0)",
      ),
    "gallery images",
  );
  await screenshot("gallery-desktop");
  await send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"), true);
  assert.equal(
    await evaluate(
      "(() => { const box = document.querySelector('[role=dialog]').getBoundingClientRect(); return box.left >= 0 && box.right <= innerWidth && box.top >= 0 && box.bottom <= innerHeight; })()",
    ),
    true,
  );
  await screenshot("gallery-mobile");
  await click(button("Gold"));
  await click(button("Add to Order"));
  assert.equal(
    await evaluate("JSON.parse(localStorage.getItem('simplyclassy-order-cart'))[0].colorId"),
    "gold",
  );
  await send("Page.reload");
  await until(
    () =>
      evaluate(
        "document.querySelector('button[aria-label^=\"Open order summary\"]')?.textContent.includes('(1)')",
      ),
    "cart reload",
  );
  await click("document.querySelector('button[aria-label=\"View Classic Watch\"]')");
  await click(button("Black"));
  await click(button("Add to Order"));
  assert.equal(
    await evaluate("JSON.parse(localStorage.getItem('simplyclassy-order-cart')).length"),
    2,
  );
  await click("document.querySelector('button[aria-label^=\"Open order summary\"]')");
  await delay(600);
  assert.equal(
    await evaluate(
      "(() => { const box = document.querySelector('[role=dialog][data-state=open]').getBoundingClientRect(); return box.left >= 0 && box.right <= innerWidth; })()",
    ),
    true,
  );
  await screenshot("cart-mobile");
  await click(button("Order on WhatsApp"));
  await evaluate("window.open = url => { window.variantWhatsApp = url; return { opener: null }; }");
  await type('input[name="name"]', "Test Customer");
  await type('input[name="location"]', "Accra");
  await click("document.querySelector('button[type=submit]')");
  await until(() => evaluate("Boolean(window.variantCheckout)"), "checkout");
  assert.deepEqual(await evaluate("window.variantCheckout.cart.map(item => item.colorId).sort()"), [
    "black",
    "gold",
  ]);
  assert.equal(
    await evaluate(
      "decodeURIComponent(window.variantWhatsApp).includes('(Gold)') && decodeURIComponent(window.variantWhatsApp).includes('(Black)')",
    ),
    true,
  );
  console.log(
    "Customer desktop/mobile checks passed: gallery switching, loaded images, cart reload, separate variants and checkout/WhatsApp colors.",
  );
  await click("document.querySelector('button[aria-label=\"View Perfume\"]')");
  assert.equal(
    await evaluate("Boolean(document.querySelector('[role=dialog][data-state=open] fieldset'))"),
    false,
  );
  await click(button("Add to Order"));
  assert.equal(
    await evaluate(
      "JSON.parse(localStorage.getItem('simplyclassy-order-cart'))[0].colorId === undefined",
    ),
    true,
  );

  await send("Page.navigate", { url: "http://127.0.0.1:5174/tests/browser/variants.html?admin" });
  await until(() => evaluate("Boolean(document.querySelector('#product-name'))"), "admin fixture");
  await type("#product-name", "Classic Watch");
  await type("#product-price", "250");
  await upload("#product-image");
  await click(button("Add color"));
  await type('input[id^="color-name-"]', "Black");
  await click("document.querySelector('fieldset input[type=checkbox]')");
  assert.equal(await evaluate("document.querySelector('input[type=color]').value"), "#000000");
  await upload('input[id^="color-images-"]', 2);
  await click(button("Add color"));
  const colorIds = await evaluate(
    "Array.from(document.querySelectorAll('input[id^=\"color-name-\"]')).map(input => input.id)",
  );
  await type(`#${colorIds[1]}`, "Gold");
  await upload(`#${colorIds[1].replace("color-name-", "color-images-")}`);
  await click("document.querySelectorAll('input[name=\"default-product-color\"]')[1]");
  await until(
    () =>
      evaluate(
        "Array.from(document.querySelectorAll('img')).every(image => image.complete && image.naturalWidth > 0)",
      ),
    "upload previews",
  );
  assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"), true);
  await evaluate("document.querySelector('#available-colors-title').scrollIntoView()");
  await screenshot("admin-colors-mobile");
  await upload('input[aria-label="Replacement for Black image 1"]');
  await click("document.querySelector('button[aria-label=\"Remove Black image 2\"]')");
  await evaluate(
    "(() => { const input = document.querySelector('input[id^=\"color-images-\"]'); const files = new DataTransfer(); files.items.add(new File(['invalid'], 'invalid.txt', { type: 'text/plain' })); input.files = files.files; input.dispatchEvent(new Event('change', { bubbles: true })); })()",
  );
  await until(
    () =>
      evaluate(
        "document.querySelector('fieldset [role=alert]')?.textContent.includes('image file')",
      ),
    "contextual upload error",
  );
  await upload(`#${colorIds[0].replace("color-name-", "color-images-")}`);
  await click("document.querySelector('button[aria-label=\"Remove Black image 2\"]')");
  await click("document.querySelector('button[type=submit]')");
  await until(() => evaluate("Boolean(window.variantForm)"), "product save");
  assert.deepEqual(await evaluate("window.variantForm.colors"), [
    { name: "Black", images: 1 },
    { name: "Gold", images: 1 },
  ]);
  assert.equal(await evaluate("window.variantForm.mainImage"), true);
  assert.equal(
    await evaluate("window.variantForm.defaultColorId"),
    colorIds[1].replace("color-name-", ""),
  );
  await click("document.querySelector('button[aria-label=\"Remove Gold\"]')");
  await click("document.querySelector('button[type=submit]')");
  await until(() => evaluate("window.variantForm.colors.length === 1"), "removed color save");
  assert.equal(
    await evaluate("window.variantForm.defaultColorId"),
    colorIds[0].replace("color-name-", ""),
  );
  console.log(
    `Admin mobile checks passed: main upload, color uploads/previews, swatch/default choice, image replacement/removal, color removal and save. Screenshots: ${screenshots}`,
  );
} finally {
  if (socket?.readyState === WebSocket.OPEN) {
    await send("Browser.close", {}, false).catch(() => undefined);
    socket.close();
  }
  if (browser.exitCode === null) browser.kill();
  await delay(1000);
  assert.equal(resolve(dirname(profile)), resolve(tmpdir()));
  assert.ok(basename(profile).startsWith("simplyclassy-browser-test-"));
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
