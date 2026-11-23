---
'@mastra/deployer-cloudflare': minor
---

Cloudflare Worker builds are now minified by default, and source maps are uploaded with each deploy. In our tests, a Mastra Worker's upload size dropped from about 21 MB to about 10.5 MB and its memory use from about 75 MiB to about 52 MiB, which leaves more of the Worker memory limit for your agents. Function and class names are kept, and Cloudflare logs map stack traces from uncaught errors back to your source.

To turn either setting off, pass it to the deployer:

```typescript
new CloudflareDeployer({
  name: 'my-worker',
  minify: false,
  upload_source_maps: false,
});
```
