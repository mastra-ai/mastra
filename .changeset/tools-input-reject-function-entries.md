---
'@mastra/core': patch
---

Tightened `AgentConfig.tools` typing so each entry must be an actual tool object. Previously a plain function such as `tools: { myTool: () => realTool }` passed type checking and then threw `TOOL_INVALID_FORMAT` at runtime, because the provider-defined tool member of the union is all-optional with an index signature. Provider-defined tools now require an `id` when used as a tools-map entry, mirroring the existing runtime check. Setting `tools` itself to a resolver function is still supported.
