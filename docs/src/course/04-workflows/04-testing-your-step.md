# Testing Your Step

Before building a complete workflow, let's test your step to make sure it works correctly.

## Adding Test Code

Add this test function to your workflow file:

```typescript
// Test the validation step
async function testValidationStep() {
  try {
    const result = await validateContentStep.execute({
      inputData: {
        content: "This is a sample article with enough words to pass validation.",
        type: "article"
      }
    });
    
    console.log("✅ Step result:", result);
  } catch (error) {
    console.error("❌ Step failed:", error.message);
  }
}

// Run the test
testValidationStep();
```

## Running the Test

Execute your test:

```bash
npx tsx src/mastra/workflows/content-workflow.ts
```

You should see:
```
✅ Step result: {
  content: "This is a sample article with enough words to pass validation.",
  type: "article",
  wordCount: 11,
  isValid: true
}
```

## Testing Error Handling

Add this test for invalid content:

```typescript
async function testInvalidContent() {
  try {
    await validateContentStep.execute({
      inputData: {
        content: "Too short",
        type: "article"
      }
    });
  } catch (error) {
    console.log("✅ Expected error:", error.message);
  }
}

testInvalidContent();
```

This should show: `✅ Expected error: Content too short: 2 words`

Great! Your step is working correctly. Next, you'll create a second step to chain with this one.