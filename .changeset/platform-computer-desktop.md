---
'@mastra/platform-workspace': minor
---

Added an opt-in desktop computer to `PlatformSandbox` (E2B only). Pass `computer: true` and agents using the workspace get screenshot, mouse and keyboard tools that drive a Linux desktop inside the sandbox. Pre-install the desktop with `withDesktop(Template())`, and open `sandbox.computer.streamUrl()` with the port 6080 auth cookie to watch or take over in noVNC. Set `defaultOptions: { toolCallConcurrency: 1 }` on the agent so a step's clicks and keystrokes reach the desktop in order.

```ts
const sandbox = new PlatformSandbox({ computer: true });
const agent = new Agent({ /* ... */ defaultOptions: { toolCallConcurrency: 1 } });
```
