---
'@mastra/core': minor
'@mastra/memory': patch
---

Added support for routing embedding models through the Mastra Gateway with `mastra/provider/model` IDs.

Updated observational memory processing so agents using Mastra Gateway actor models still run the locally configured observer and reflector models instead of implicitly deferring to Gateway-managed memory behavior.
