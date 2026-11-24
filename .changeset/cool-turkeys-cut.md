---
'@mastra/deployer-cloudflare': minor
---

Cloudflare Worker builds are now minified by default. In our tests, a Mastra Worker's upload size dropped from about 21 MB to about 10.5 MB and its memory use from about 75 MiB to about 52 MiB, which leaves more of the Worker memory limit for your agents. Function and class names are kept, and with the source maps Wrangler uploads by default, Cloudflare logs map stack traces from uncaught errors back to the files in `.mastra/output`. To map them back to your own `src/` files, also set `bundler: { sourcemap: true }` on `new Mastra()`.

To turn minification off, pass it to the deployer:

```typescript
new CloudflareDeployer({
  name: 'my-worker',
  minify: false,
});
```
