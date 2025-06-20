# Handling Errors

Learn how to handle errors gracefully in your workflows to make them more robust and user-friendly.

## Understanding Workflow Errors

Errors in workflows can happen at different levels:
- **Input validation**: Invalid data provided to the workflow
- **Step execution**: Error in a step's business logic
- **Schema validation**: Output doesn't match expected schema

## Testing Error Scenarios

Add this error test to your workflow file:

```typescript
async function testWorkflowErrors() {
  console.log("🧪 Testing error scenarios...\n");
  
  const workflow = mastra.getWorkflow("contentWorkflow");
  
  // Test 1: Invalid input
  try {
    const run1 = workflow.createRun();
    await run1.start({
      inputData: {
        content: "", // Empty content should fail
        type: "article"
      }
    });
  } catch (error) {
    console.log("✅ Caught input validation error:", error.message);
  }
  
  // Test 2: Content too short
  try {
    const run2 = workflow.createRun();
    await run2.start({
      inputData: {
        content: "Too short", // Only 2 words
        type: "article"
      }
    });
  } catch (error) {
    console.log("✅ Caught business logic error:", error.message);
  }
}

testWorkflowErrors();
```

## Error Information

When a workflow fails, you get:
- **Error message**: Descriptive explanation of what went wrong
- **Step information**: Which step failed (if applicable)
- **Input data**: The data that caused the failure

## Best Practices for Error Handling

1. **Validate early**: Check inputs at the start of each step
2. **Clear messages**: Provide helpful error messages
3. **Graceful degradation**: Handle errors without crashing
4. **Logging**: Log errors for debugging

## Making Steps More Robust

Update your validation step with better error handling:

```typescript
// Better error handling in execute function
execute: async ({ inputData }) => {
  try {
    const { content, type } = inputData;
    
    if (!content || content.trim().length === 0) {
      throw new Error("Content cannot be empty or only whitespace");
    }
    
    const wordCount = content.trim().split(/\s+/).length;
    
    if (wordCount < 5) {
      throw new Error(`Content too short: ${wordCount} words (minimum 5 required)`);
    }
    
    return {
      content: content.trim(),
      type,
      wordCount,
      isValid: true
    };
  } catch (error) {
    console.error(`Validation step failed: ${error.message}`);
    throw error; // Re-throw to stop workflow
  }
}
```

Proper error handling makes your workflows more reliable and easier to debug! Next, you'll learn about adding a third step.