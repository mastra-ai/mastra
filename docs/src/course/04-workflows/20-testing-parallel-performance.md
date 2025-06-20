# Testing Parallel Performance

Let's test your parallel workflow and compare its performance to sequential execution.

## Testing Parallel Execution

Add this test to your workflow file:

```typescript
async function testParallelPerformance() {
  console.log("⚡ Testing parallel workflow performance...\n");
  
  const startTime = Date.now();
  
  const run = parallelAnalysisWorkflow.createRun();
  
  const result = await run.start({
    inputData: {
      content: "Artificial intelligence and machine learning are revolutionizing industries by automating complex processes, analyzing massive datasets, and providing insights that help businesses make better decisions.",
      type: "article"
    }
  });
  
  const endTime = Date.now();
  const executionTime = endTime - startTime;
  
  console.log("✅ Parallel workflow completed!");
  console.log(`⏱️ Total execution time: ${executionTime}ms\n`);
  
  console.log("📊 Results:");
  console.log("SEO Score:", result.result.results.seo.seoScore);
  console.log("Keywords:", result.result.results.seo.keywords.join(", "));
  console.log("Readability:", result.result.results.readability.readabilityScore, `(${result.result.results.readability.gradeLevel})`);
  console.log("Sentiment:", result.result.results.sentiment.sentiment, `(${Math.round(result.result.results.sentiment.confidence * 100)}% confidence)`);
}

testParallelPerformance();
```

## Comparing with Sequential Execution

Add this sequential version for comparison:

```typescript
async function testSequentialPerformance() {
  console.log("🐌 Testing sequential execution for comparison...\n");
  
  const startTime = Date.now();
  
  const testData = {
    content: "Artificial intelligence and machine learning are revolutionizing industries by automating complex processes, analyzing massive datasets, and providing insights that help businesses make better decisions.",
    type: "article"
  };
  
  // Run steps one by one
  const seoResult = await seoAnalysisStep.execute({ inputData: testData });
  const readabilityResult = await readabilityStep.execute({ inputData: testData });
  const sentimentResult = await sentimentStep.execute({ inputData: testData });
  
  const endTime = Date.now();
  const executionTime = endTime - startTime;
  
  console.log("✅ Sequential execution completed!");
  console.log(`⏱️ Total execution time: ${executionTime}ms\n`);
}

// testSequentialPerformance();
```

## Expected Performance

- **Sequential**: ~2200ms (800 + 600 + 700 + overhead)
- **Parallel**: ~900ms (longest step + overhead)

That's about **2.4x faster** with parallel execution!

## When to Use Parallel Execution

Use parallel execution when:
- Steps don't depend on each other's outputs
- Steps involve I/O operations (API calls, database queries)
- You want to maximize performance
- Steps process the same input data

Register your parallel workflow with Mastra to use it in the playground! Next, you'll learn about conditional branching.