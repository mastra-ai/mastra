---
'@mastra/playground-ui': patch
---

Redesigned the agent instruction blocks editor with a Notion-like document feel. Blocks no longer show line numbers or block numbers, have tighter spacing, and display a subtle hover highlight. Reference blocks now show a sync-block header with a popover for block details, "Open original", "De-reference block", and "Used by" agents. Inline blocks can be converted to saved prompt blocks via a new "Save as prompt block" action in the hover toolbar. The prompt block edit sidebar now shows a "Used by" section listing which agents reference the block. Added a `lineNumbers` prop to `CodeEditor` to optionally hide line numbers.
