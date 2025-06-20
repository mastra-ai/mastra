# Creating AI-Enhanced Workflow

Now you'll create a new workflow that includes AI analysis alongside your existing content processing steps.

## Creating the Enhanced Workflow

Add this new workflow to your file:

```typescript
export const aiContentWorkflow = createWorkflow({
  id: "ai-content-workflow",
  description: "AI-enhanced content processing with analysis",
  inputSchema: z.object({
    content: z.string(),
    type: z.enum(["article", "blog", "social"]).default("article")
  }),
  outputSchema: z.object({
    content: z.string(),
    type: z.string(),
    wordCount: z.number(),
    metadata: z.object({
      readingTime: z.number(),
      difficulty: z.enum(["easy", "medium", "hard"]),
      processedAt: z.string()
    }),
    summary: z.string(),
    aiAnalysis: z.object({
      score: z.number(),
      feedback: z.string()
    })
  })
})
  .then(validateContentStep)
  .then(enhanceContentStep)
  .then(generateSummaryStep)
  .then(aiAnalysisStep)
  .commit();
```

## Testing the AI-Enhanced Workflow

```typescript
async function testAIWorkflow() {
  console.log("🚀 Testing AI-enhanced workflow...\n");
  
  const run = aiContentWorkflow.createRun();
  
  const result = await run.start({
    inputData: {
      content: "Machine learning algorithms are transforming industries by automating complex decision-making processes, analyzing vast datasets, and providing insights that were previously impossible to obtain through traditional methods.",
      type: "article"
    }
  });
  
  console.log("✅ AI Workflow completed!");
  console.log("📊 Stats:", {
    words: result.result.wordCount,
    readingTime: result.result.metadata.readingTime,
    difficulty: result.result.metadata.difficulty
  });
  console.log("📝 Summary:", result.result.summary);
  console.log("🤖 AI Score:", result.result.aiAnalysis.score + "/10");
  console.log("💬 AI Feedback:", result.result.aiAnalysis.feedback);
}

testAIWorkflow();
```

## Registering the New Workflow

Update your Mastra configuration to include both workflows:

```typescript
// In src/mastra/index.ts
import { contentWorkflow, aiContentWorkflow } from "./workflows/content-workflow";

export const mastra = new Mastra({
  workflows: {
    contentWorkflow,
    aiContentWorkflow // Add the AI-enhanced version
  },
  // ... rest of configuration
});
```

## The Complete AI Pipeline

Your AI-enhanced workflow now:
1. **Validates** content and counts words
2. **Enhances** with metadata 
3. **Summarizes** the content
4. **Analyzes** with AI for quality scoring and feedback

This creates a comprehensive, AI-powered content processing system! Next, you'll learn about parallel execution.