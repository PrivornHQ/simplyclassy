# Product Variant Browser Checks

Start the isolated fixture server:

```powershell
node node_modules/vite/bin/vite.js --config tests/browser/vite.config.ts --host 127.0.0.1 --port 5174 --strictPort
```

Run the checks in another terminal:

```powershell
node tests/browser/verify.mjs
```

The checks use actual components with mocked checkout and product saving. They create an isolated headless Edge profile and save screenshots in the temporary directory. Set `VARIANT_BROWSER` to another Chromium browser executable if needed.

The server/storage checks run separately:

```powershell
node tests/product-variants.test.mjs
node tests/order-deletion.test.mjs
```
