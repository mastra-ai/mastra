---
'@mastra/schema-compat': patch
---

Fix inverted date constraint descriptions in the Zod v4 schema handler. `z.date().min()` and `z.date().max()` were described with their bounds swapped (a lower bound was labelled "older than" and an upper bound "newer than"), so the schema sent to the model stated the opposite and impossible constraint. The handler now matches Zod semantics and the existing v3 handler. Closes #18581.
