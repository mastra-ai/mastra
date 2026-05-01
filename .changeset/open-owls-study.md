---
'@mastra/core': patch
'@mastra/memory': patch
---

Fixed an issue where Observational Memory could not resolve models routed through user-defined custom gateways. The internal Observer and Reflector agents now inherit the parent Mastra instance, so a model id like `cloudflare/google/gemini-2.5-flash-lite` resolves through your registered `CloudflareGateway` instead of failing with `Could not find config for provider cloudflare`.

**Before**

```ts
const memory = new Memory({
  storage,
  options: {
    observationalMemory: {
      model: 'cloudflare/google/gemini-2.5-flash-lite',
    },
  },
});

new Mastra({
  agents: { coworkerAgent },
  memory: { coworker: memory },
  gateways: { cloudflare: new CloudflareGateway() },
});
// Error: Could not find config for provider cloudflare with model id cloudflare/google/gemini-2.5-flash-lite
```

**After**

The same configuration now works — the OM observer/reflector see the registered `cloudflare` gateway and resolve the model through it. Closes #13841.
