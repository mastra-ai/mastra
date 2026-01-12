---
'@mastra/playground-ui': patch
---

Fix trace-span-usage component to handle object values in token usage data. Usage objects can contain nested `inputDetails` and `outputDetails` properties which are objects, not numbers. The component now properly type-checks values and renders object properties as nested key-value pairs.
