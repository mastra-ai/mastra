---
'@mastra/core': patch
---

Update agent workflow and sub-agent tool transformations to accept more input arguments.

These tools now accept the following

```ts
workflowTool.execute({ inputData, initialState }, context)

agentTool.execute({ prompt, threadId, resourceId, instructions, maxSteps }, context)
```

Workflow tools now also properly return errors when the workflow run fails

```ts
const workflowResult = await workflowTool.execute({ inputData, initialState }, context)

console.log(workflowResult.error) // error msg if error
console.log(workflowResult.result) // result of the workflow if success
```

Workflows passed to agents do not properly handle suspend/resume`, they only handle success or error.
