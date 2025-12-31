---
"@mastra/deployer-cloudflare": minor
---

**Added support for serving static assets with Cloudflare Workers.** You can now configure assets (such as SPA builds) directly via CloudflareDeployer, and the configuration will be forwarded to wrangler.json.

**Usage example:**

```typescript
const deployer = new CloudflareDeployer({
    assets: {
        directory: './dist',
        binding: 'ASSETS',
        html_handling: 'auto-trailing-slash',
        not_found_handling: 'single-page-application',
    },
});
```
**What you can configure:**
- `directory`: Path to your assets directory
- `binding` (optional): Variable binding name
- `run_worker_first` (optional): Control execution order
- `html_handling` (optional): Trailing slash handling
- `not_found_handling` (optional): 404 and SPA behavior

See [#11463](https://github.com/mastra-ai/mastra/issues/11463) for more context.