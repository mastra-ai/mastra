---
'@mastra/core': patch
---

Fixed durable and evented agents running tools with empty arguments when the model returned malformed JSON. Unparseable tool calls now return an error to the model without executing the tool or requesting approval, while valid empty arguments and replayed calls keep working.
