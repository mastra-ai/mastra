# Understanding Parallel Execution

Learn how to run multiple workflow steps simultaneously to improve performance when steps don't depend on each other.

## When to Use Parallel Execution

Use parallel execution when you have steps that:
- **Don't depend on each other**: Can run independently
- **Take time**: Network requests, AI calls, or heavy computations
- **Process the same input**: Multiple analyses of the same data

## Example Scenario

Imagine you want to analyze content in three different ways:
1. SEO analysis
2. Readability analysis  
3. Sentiment analysis

These can all run at the same time since they don't depend on each other!

## Creating Parallel Steps

First, let's create three simple analysis steps:

```typescript
// SEO Analysis Step
const seoAnalysisStep = createStep({
  id: "seo-analysis",
  description: "Analyzes content for SEO",
  inputSchema: z.object({
    content: z.string(),
    type: z.string()
  }),
  outputSchema: z.object({
    seoScore: z.number(),
    keywords: z.array(z.string())
  }),
  execute: async ({ inputData }) => {
    console.log("🔍 Running SEO analysis...");
    
    // Simulate analysis time
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const words = inputData.content.toLowerCase().split(/\s+/);
    const keywords = words.filter(word => word.length > 4).slice(0, 3);
    
    return {
      seoScore: Math.floor(Math.random() * 40) + 60, // 60-100
      keywords
    };
  }
});
```

## Performance Benefits

Running steps in parallel:
- **Faster execution**: Steps run simultaneously instead of waiting
- **Better resource utilization**: Uses multiple CPU cores
- **Improved user experience**: Shorter wait times

Next, you'll create the other parallel steps and see how to combine them!