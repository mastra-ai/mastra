---
'@mastra/core': minor
'@mastra/docker': minor
'@mastra/vercel': minor
'@mastra/e2b': minor
'@mastra/daytona': minor
'@mastra/cloudflare-sandbox': minor
---

Added an optional per-file `mode` to `WorkspaceSandbox.writeFiles` inputs so callers can set POSIX permissions (`0o001`–`0o777`) when provisioning files. The Docker sandbox applies the requested mode to each uploaded file, falling back to `0644` when omitted. Sandboxes that cannot honor an explicit mode (Vercel, E2B, Daytona, Cloudflare) reject the request with `SandboxUnsupportedFeatureError` instead of silently ignoring it. Closes #23580.

```ts
await sandbox.writeFiles([
  { path: 'scripts/setup.sh', content: '#!/bin/sh\necho ready\n', mode: 0o755 },
  { path: 'config/private.json', content: JSON.stringify({ token }), mode: 0o600 },
  { path: 'README.md', content: 'Sandbox instructions' }, // defaults to 0644
]);
```

`@mastra/core` now exports `validateSandboxFileMode`, `assertModesUnsupported`, and `SandboxUnsupportedFeatureError` for sandbox providers; the built-in providers' `@mastra/core` peer dependency floor is raised to `1.67.0` accordingly.
