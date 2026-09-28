---
"@mastra/mcp": patch
---

Validate MCP tool input schemas before creating tools and skip malformed tools instead of handing them to providers, whose strict function-calling APIs reject the whole request for one bad schema. Misplaced string-array `required` lists nested inside `properties` are repaired; structurally invalid schemas (non-object properties, non-string `required` entries, malformed `items`/combinators) cause the tool to be skipped with a warning naming the server and tool, on both live discovery and cached hydration. Valid properties named `required` and existing top-level requirements are preserved without mutating server-supplied or cached schemas. Because the tool catalogue is server-controlled, validation work is bounded: the structural check skips objects it has already visited, so a self-referencing or heavily-shared schema cannot stall discovery, and the structural check is not run at all once the existing complexity check has already rejected a schema.
