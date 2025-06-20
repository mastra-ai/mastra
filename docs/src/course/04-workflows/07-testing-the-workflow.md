# Testing the Workflow

Let's test your complete workflow to see all the steps working together.

## Adding a Workflow Test

Add this test function to your file:

```typescript
async function testWorkflow() {
  console.log("🚀 Testing complete workflow...\n");
  
  try {
    // Create a workflow run
    const run = contentWorkflow.createRun();
    
    // Test with sample content
    const result = await run.start({
      inputData: {
        content: "Artificial intelligence is transforming how we work and live. From healthcare to transportation, AI systems are becoming increasingly sophisticated and capable of handling complex tasks.",
        type: "article"
      }
    });
    
    console.log("✅ Workflow completed!");
    console.log("📊 Result:", JSON.stringify(result.result, null, 2));
    
  } catch (error) {
    console.error("❌ Workflow failed:", error.message);
  }
}

// Run the test
testWorkflow();
```

## Running the Complete Test

Execute your workflow:

```bash
npx tsx src/mastra/workflows/content-workflow.ts
```

You should see output like:
```
🚀 Testing complete workflow...

✅ Workflow completed!
📊 Result: {
  "content": "Artificial intelligence is transforming...",
  "type": "article",
  "wordCount": 28,
  "metadata": {
    "readingTime": 1,
    "difficulty": "easy",
    "processedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

## What Just Happened

1. The workflow received your input data
2. The validation step checked the content and counted words
3. The enhancement step added metadata like reading time and difficulty
4. The workflow returned the final processed result

Congratulations! You've created and tested your first complete workflow. Next, you'll register it with Mastra.