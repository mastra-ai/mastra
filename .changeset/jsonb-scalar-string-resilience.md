---
'@mastra/pg': patch
---

Fixed the @mastra/pg listing endpoints for agents, MCP clients, MCP servers, prompt blocks, scorer definitions, skills, and workspaces so that a single row with a malformed `jsonb` value (a scalar string instead of an object) no longer returns HTTP 500 and hides every other record in the Mastra Editor. The pg driver auto-deserialises `jsonb` scalars to bare JS strings, which previously crashed each domain's row parser; now those rows are tolerated — the listing succeeds and the malformed field is returned as the deserialised scalar.

`AgentsPG.createVersion` additionally rejects a string `model` with a typed `INVALID_MODEL` error to stop the bad shape from being written. Pass an object instead, e.g. `{ slug: "anthropic/claude-haiku-4.5" }`.

Fixes #16224.
