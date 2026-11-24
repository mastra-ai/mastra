---
'@mastra/deployer-cloudflare': minor
---

Cloudflare Worker builds are now minified by default. This roughly halves the Worker's upload size and cuts its memory use by about 30%, which leaves more of the Worker memory limit for your agents. Function and class names are kept, and with the source maps Wrangler 4.150 and later upload by default, Cloudflare logs map stack traces from uncaught errors back to the files in `.mastra/output`. To map them back to your own `src/` files, also set `bundler: { sourcemap: true }` on `new Mastra()`.

To turn minification off, pass it to the deployer:

```typescript
new CloudflareDeployer({
  name: 'my-worker',
  minify: false,
});
```
