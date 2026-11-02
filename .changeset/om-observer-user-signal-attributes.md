---
'@mastra/memory': patch
---

Observational Memory now tells the Observer who sent each user signal. In a thread shared by several people, messages sent with `agent.sendMessage({ contents, attributes: { name: 'Alice' } }, ...)` are labeled `User (name="Alice")` when observed, so observations can say who said what instead of attributing everything to "User". Messages without attributes keep the plain `User` label.
