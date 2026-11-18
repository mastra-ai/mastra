---
'@mastra/platform-workspace': minor
---

Experimental, behind `MASTRA_EXPERIMENTAL_COMPUTER=true`: `PlatformSandbox` can give an agent a Linux desktop. Build the template with `Template().desktop()` and pass `computer: true` to get screenshots, mouse and keyboard, the accessibility tree (read, act, set text) and a noVNC viewer link from `sandbox.computer.streamUrl()`. The Factory sandbox gains a matching `desktop` setting. Needs a Mastra Platform that supports the `desktop` template op, and `@mastra/core` 1.86.0 or later: with an older core the first computer call fails naming that version. Nothing loads unless the flag is set: the computer code is never imported, the `@mastra/core` peer range is unchanged, and `Template().desktop()` throws naming the flag.
