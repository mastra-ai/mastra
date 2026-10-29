# Chaining Steps Together

Now you'll learn how to chain your steps together to create a complete workflow.

## Creating the Workflow

Add this workflow definition to your file:

```typescript
import { createWorkflow } from '@mastra/core/workflows'

export const contentWorkflow = createWorkflow({
  id: 'content-processing-workflow',
  description: 'Validates and enhances content',
  inputSchema: z.object({
    content: z.string(),
    type: z.enum(['article', 'blog', 'social']).default('article'),
  }),
  outputSchema: z.object({
    content: z.string(),
    type: z.string(),
    wordCount: z.number(),
    metadata: z.object({
      readingTime: z.number(),
      difficulty: z.enum(['easy', 'medium', 'hard']),
      processedAt: z.string(),
    }),
  }),
})
  .then(validateContentStep)
  .then(enhanceContentStep)
  .commit()
```

## Understanding the Workflow

- **Input Schema**: Defines what data the workflow expects
- **Output Schema**: Defines what the workflow will return
- **Steps**: Chained using `.then()` in the order they should execute
- **Commit**: Finalizes the workflow definition

## How Data Flows

1. Workflow receives input matching the input schema
2. First step processes input and outputs validated data
3. Second step receives the first step's output as its input
4. Workflow returns the final step's output

## Schema Validation

The workflow automatically validates:

- Input data matches the workflow's input schema
- Each step's output matches the next step's input schema

For a linear workflow, the final `.then()` step must return the workflow's declared output shape. The engine doesn't validate the final output against `outputSchema`. Branching changes the result shape: `.branch()` runs every branch whose condition is true and returns an object keyed by step ID, such as `{ 'quick-processing': result }` or, when several conditions match, `{ 'quick-processing': resultA, 'thorough-processing': resultB }`. That keyed object isn't a flat workflow output, and it isn't validated against `outputSchema`, so add a `.then()` step after `.branch()` to reshape the branch results before the workflow ends.

Your workflow is now ready to run! Next, you'll test the complete workflow.
