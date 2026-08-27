---
'@mastra/memory': patch
---

Split the curator's node-edit tool in two so the schema carries the rule

`knowledge_update_node` could change a node's name, its kind, or both, and that rule was enforced after the fact inside the tool body: the model was never told about it, and found out by being thrown at after spending a tool call.

It is now two tools — `knowledge_rename_node` and `knowledge_set_node_kind` — each taking one required field. An edit that changes nothing is no longer discouraged, it is unrepresentable, and that matters: such a call still bumps the node's version, writes a node-updated activity, and fails the optimistic-concurrency check of any writer holding the previous version.

The obvious single-tool shapes cannot say this on the wire. Google rejects `required` inside a branch that is not an `OBJECT`, so a root-level `anyOf: [{ required: ['name'] }, { required: ['kind'] }]` fails the request before the model runs. Nesting that union under a typed object does not help either: the Google compat layer drops every sibling key of an `anyOf`, so the branches arrive with no properties and the fields are hidden from the model entirely. One required field per tool is the shape that survives. Two tests hold that: an offline one pushing both schemas through the compat layer, and a recorded one whose fixture was captured from Gemini itself, since a schema the provider refuses is well-formed JSON Schema and no offline assertion can see the provider's rejection.

The tool is internal to the Subconscious curator and is not part of the package's public API, so nothing user-facing changes. Renaming a node and re-categorising it now takes two calls and two version bumps rather than one atomic edit. The tool schema snapshot test also now snapshots resolved JSON Schema rather than the opaque wrapper, which was passing without ever seeing a schema.
