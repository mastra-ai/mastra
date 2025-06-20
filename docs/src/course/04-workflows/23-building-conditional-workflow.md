# Building Conditional Workflow

Now you'll create a workflow that uses conditional branching to route content through different processing paths.

## Creating the Conditional Workflow

Add this workflow to your file:

```typescript
export const conditionalWorkflow = createWorkflow({
  id: "conditional-workflow",
  description: "Content processing with conditional branching",
  inputSchema: z.object({
    content: z.string(),
    type: z.enum(["article", "blog", "social"]).default("article")
  }),
  outputSchema: z.object({
    processedContent: z.string(),
    processingType: z.string(),
    recommendations: z.array(z.string())
  })
})
  .then(assessContentStep)
  .branch([
    // Branch 1: Short and simple content
    [
      async ({ inputData }) => 
        inputData.category === "short" && inputData.complexity === "simple",
      quickProcessingStep
    ],
    // Branch 2: Long or complex content
    [
      async ({ inputData }) => 
        inputData.category === "long" || inputData.complexity === "complex",
      detailedProcessingStep
    ],
    // Branch 3: Everything else gets standard processing
    [
      async ({ inputData }) => 
        inputData.category === "medium" && inputData.complexity === "moderate",
      createStep({
        id: "standard-processing",
        description: "Standard processing for medium content",
        inputSchema: z.object({
          content: z.string(),
          type: z.string(),
          wordCount: z.number(),
          complexity: z.enum(["simple", "moderate", "complex"]),
          category: z.enum(["short", "medium", "long"])
        }),
        outputSchema: z.object({
          processedContent: z.string(),
          processingType: z.string(),
          recommendations: z.array(z.string())
        }),
        execute: async ({ inputData }) => {
          console.log("📝 Standard processing for medium content...");
          
          return {
            processedContent: inputData.content,
            processingType: "standard",
            recommendations: ["Good length and complexity", "Minor improvements possible"]
          };
        }
      })
    ]
  ])
  .commit();
```

## Understanding the Conditions

1. **Short + Simple**: Quick processing with minimal recommendations
2. **Long OR Complex**: Detailed processing with comprehensive analysis
3. **Medium + Moderate**: Standard processing with balanced approach

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