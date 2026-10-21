---
'@mastra/playground-ui': minor
---

Added public components and hooks for end-user connection flows.

**Connect hooks**

The `@mastra/playground-ui/domains/connect` entry point now exports hooks for loading the connect surface, listing providers and connections, creating and disconnecting connections, polling status, and driving an authorization flow with `usePendingConnect()`.

```tsx
const { connect, cancel, pending, settled } = usePendingConnect()

<Button onClick={() => connect(provider)}>Connect</Button>
{pending ? <Button onClick={cancel}>Cancel</Button> : null}
{settled?.status === 'failed' ? <p>{settled.message}</p> : null}
```

`usePendingConnect()` accepts the provider and optional form values, uses provider-direct headless authorization when supported, falls back to hosted authorization when required, and exposes pending and settled state for custom UIs.

**Connect primitives**

Added `ProviderLogo` plus headless authorization helpers for detecting supported flows, deriving form fields, splitting credentials from flow parameters, and starting authorization.

**Connect prompt card**

Added the exported `ConnectPromptTool` card for structured `request_connection` output. It renders inset provider rows with consistent logos, clear connected states, Connect actions, and read-only historical states.
