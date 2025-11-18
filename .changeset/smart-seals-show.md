---
'@mastra/inngest': patch
'@mastra/core': patch
---

Validate schemas by default in workflow. Previously, if you want schemas in the workflow to be validated, you'd have to add `validateInputs` option, now, this will be done by default but can be disabled.

For workflows whose schemas and step schemas you don't want validated, do this

```diff
createWorkflow({
+  options: {
+    validateInputs: false
+  }
})
```
