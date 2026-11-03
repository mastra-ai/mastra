---
'@mastra/agent-browser': minor
---

Added `blockPrivateNetwork` to `AgentBrowser`, which keeps the browser off the machine it runs on and off private networks. Use it when agents browse from a server that holds secrets or sits next to internal services.

```ts
const browser = new AgentBrowser({ blockPrivateNetwork: true });

// Let specific private hosts through
const devBrowser = new AgentBrowser({ blockPrivateNetwork: { allow: ['localhost:3000'] } });
```

The browser refuses `file:` URLs, `localhost`, and private and link-local addresses (including cloud metadata at `169.254.169.254`). The block also covers redirects, `fetch()`, service workers, WebSockets, and hostnames whose DNS points at a private address. When an agent tries to open a blocked URL, `browser_goto` says why.
