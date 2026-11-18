---
'@mastra/platform-workspace': minor
---

Experimental, behind `MASTRA_EXPERIMENTAL_COMPUTER=true`: `PlatformSandbox` can give an agent a Linux desktop. Build the template with `Template().desktop()` and pass `computer: true` to get screenshots, mouse and keyboard, the accessibility tree (read, act, set text) and a noVNC viewer link from `sandbox.computer.streamUrl()`. The Factory sandbox gains a matching `desktop` setting. Needs the new `@mastra/core` accessibility part and a Mastra Platform that supports the `desktop` template op. With the flag unset nothing changes, and `Template().desktop()` throws naming the flag.
