---
'@mastra/e2b': minor
---

Add an E2B sandbox `network` option that is forwarded to `Sandbox.create`.

This lets Mastra users configure E2B network controls and per-host request transforms, including `network.rules` header injection for brokered credentials, through `E2BSandbox` without wrapping or monkey-patching the E2B SDK.

E2B docs: https://e2b.dev/docs/network/internet-access#per-host-request-transforms
