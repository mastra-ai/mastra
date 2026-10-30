---
'@mastra/code-sdk': patch
'mastracode': patch
---

Mastra Code file edit and write tools no longer fail when a file was read or changed outside the `view` tool (for example with `cat`, `sed -i` or a formatter). The prompts no longer tell the model it must `view` a file before editing it.
