---
'@mastra/playground': patch
---

Add default scorer selection to the dataset create and edit forms. The "Run experiment" dialog now pre-fills its scorers from the selected dataset's defaults (explicit scorers passed on rerun still take precedence), and re-applies them when switching dataset.
