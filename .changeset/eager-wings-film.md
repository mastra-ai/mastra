---
'@mastra/core': patch
---

Allow resuming nested workflow step with chained id

Example, you have a workflow like this

```
export const supportWorkflow = mainWorkflow.then(nestedWorkflow).commit();
```

And a step in `nestedWorkflow` is supsended, you can now also resume it any of these ways:

```
run.resume({
  step: "nestedWorkflow.suspendedStep", //chained nested workflow step id and suspended step id
  //other resume params
 })
```

OR 
```
run.resume({
  step: "nestedWorkflow", // just the nested workflow step/step id
  //other resume params
 })
```