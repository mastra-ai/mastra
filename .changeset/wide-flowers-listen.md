---
'@mastra/react': patch
---

Fixed step framing markers leaking into the chat UI. The MessageFactory now renders step-start parts as nothing by default instead of routing them to your fallback renderer, so internal step boundaries no longer show up as stray output. You can still opt in to rendering a step divider by supplying a StepStart renderer.
