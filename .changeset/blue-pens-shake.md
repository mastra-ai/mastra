---
'@mastra/factory': patch
---

Cleaned up the agent transcript in the Factory web UI. Tool calls, tool groups and skill activations now share one row shape: a leading glyph for the kind of call, the label, the live command, and a disclosure chevron that only shows on hover. A collapsed group keeps its `5 steps` label and stands for what it holds with one glyph per kind of call, instead of a generic `Find files · Read · Run` list.

A skill now looks the same whether you activated it or the agent called the `skill` tool itself: both render the instructions as markdown rather than a raw arguments-and-output dump, and a skill call no longer disappears inside a group of steps.

Also fixed two artefacts: a message carrying only internal step markers drew an empty chat bubble, and invisible parts split runs of tool calls into unrelated groups.
