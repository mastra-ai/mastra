---
'@mastra/core': patch
'@mastra/memory': patch
---

Updated observational memory processing so agents using Mastra Gateway actor models still run the locally configured observer and reflector models instead of implicitly deferring to Gateway-managed memory behavior. Internal thread/resource context is no longer forwarded as Gateway request headers, preventing platform-managed Gateway memory from being activated by local agent memory context.
