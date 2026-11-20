# Building Conditional Workflow

Now you'll create a workflow that uses conditional branching to route content through two different processing paths.

## Creating the Conditional Workflow

Both branch steps return the same flat result. A `.branch()` step keys each branch result by the ID of the step that ran, so add a final step that unwraps whichever branch produced output before the workflow returns:

```typescript
// Both branch steps return the same shape. `.branch()` keys each result by the
// ID of the step that ran, so this step flattens the keyed result back down.
const processingResultSchema = z.object({
  processedContent: z.string(),
  processingType: z.string(),
  recommendations: z.array(z.string()),
})

const combineResultsStep = createStep({
  id: 'combine-results',
  description: 'Returns the result of whichever branch ran',
  inputSchema: z.object({
    'quick-processing': processingResultSchema.optional(),
    'general-processing': processingResultSchema.optional(),
  }),
  outputSchema: processingResultSchema,
  execute: async ({ inputData }) => {
    const result = inputData['quick-processing'] ?? inputData['general-processing']

    if (!result) {
      throw new Error('No branch produced a result')
    }

    return result
  },
})

export const conditionalWorkflow = createWorkflow({
  id: 'conditional-workflow',
  description: 'Content processing with conditional branching',
  inputSchema: z.object({
    content: z.string(),
    type: z.enum(['article', 'blog', 'social']).default('article'),
  }),
  outputSchema: processingResultSchema,
})
  .then(assessContentStep)
  .branch([
    // Branch 1: Short and simple content
    [async ({ inputData }) => inputData.category === 'short' && inputData.complexity === 'simple', quickProcessingStep],
    // Branch 2: Everything else
    [
      async ({ inputData }) => !(inputData.category === 'short' && inputData.complexity === 'simple'),
      generalProcessingStep,
    ],
  ])
  .then(combineResultsStep)
  .commit()
```

The `combineResultsStep` receives whichever branch ran (`{ 'quick-processing': result }` or `{ 'general-processing': result }`) and returns the inner object, which matches the workflow's flat `outputSchema`. Workflows don't validate branch output against the workflow's `outputSchema` on their own, so keep this step whenever you need the branch result in a flat shape.

## Understanding the Conditions

1. **Short + Simple**: Quick processing with minimal recommendations
2. **Everything Else**: General processing with more suggestions

## Multiple Conditions

You can combine conditions using logical operators:

- **`&&`**: AND - both conditions must be true
- **`||`**: OR - either condition can be true
- **`!`**: NOT - condition must be false

## Condition Evaluation

- Conditions are checked in order
- Multiple conditions can be true (steps run in parallel)
- If no conditions match, the branch is skipped

Next, you'll test this conditional workflow with different types of content!
