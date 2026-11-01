---
'@mastra/core': patch
---

Fixed tools whose input schema transforms values (for example, a string decoded into a `URL`) failing with errors like `url: Expected string` when an agent called them. Tool inputs from the model are now validated and decoded exactly once, so the tool receives the transformed value.
