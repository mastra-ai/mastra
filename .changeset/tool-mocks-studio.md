---
'@mastra/playground': patch
'@mastra/playground-ui': patch
---

Add Studio UI for item-level tool mocks. Dataset items can author tool mocks (and view them) in the item editor, new items and "create dataset from items" carry tool mocks, and traces can derive tool mocks onto a new or existing dataset item (with editable preview and `agent-*` auto-`ignore` matching). Experiment results surface a tool mock report (served / unconsumed / live calls and mismatch details).
