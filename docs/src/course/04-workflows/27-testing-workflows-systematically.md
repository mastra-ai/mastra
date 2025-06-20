# Testing Workflows Systematically

Learn how to create comprehensive tests for your workflows to ensure they work correctly and handle edge cases.

## Setting Up Workflow Tests

Create a test file for your workflows:

```typescript
// src/tests/workflow.test.ts
import { describe, expect, test } from "vitest";
import { contentWorkflow, conditionalWorkflow } from "../mastra/workflows/content-workflow";

describe("Content Workflow", () => {
  test("should process valid content successfully", async () => {
    const run = contentWorkflow.createRun();
    
    const result = await run.start({
      inputData: {
        content: "This is a test article with enough words to pass validation requirements.",
        type: "article"
      }
    });
    
    expect(result.success).toBe(true);
    expect(result.result.wordCount).toBe(12);
    expect(result.result.metadata.difficulty).toBe("easy");
    expect(result.result.summary).toContain("This is a test article");
  });
  
  test("should reject content that is too short", async () => {
    const run = contentWorkflow.createRun();
    
    await expect(run.start({
      inputData: {
        content: "Too short",
        type: "article"
      }
    })).rejects.toThrow("Content too short");
  });
  
  test("should handle different content types", async () => {
    const types = ["article", "blog", "social"];
    
    for (const type of types) {
      const run = contentWorkflow.createRun();
      const result = await run.start({
        inputData: {
          content: "This is valid content with enough words for testing purposes.",
          type
        }
      });
      
      expect(result.success).toBe(true);
      expect(result.result.type).toBe(type);
    }
  });
});
```

## Testing Individual Steps

Test steps in isolation for better debugging:

```typescript
describe("Individual Steps", () => {
  test("validation step should count words correctly", async () => {
    const result = await validateContentStep.execute({
      inputData: {
        content: "One two three four five six seven eight",
        type: "article"
      }
    });
    
    expect(result.wordCount).toBe(8);
    expect(result.isValid).toBe(true);
  });
  
  test("enhancement step should calculate reading time", async () => {
    const input = {
      content: "Test content",
      type: "article",
      wordCount: 200,
      isValid: true
    };
    
    const result = await enhanceContentStep.execute({
      inputData: input
    });
    
    expect(result.metadata.readingTime).toBe(1); // 200 words / 200 wpm = 1 minute
  });
});
```

## Testing Conditional Logic

Verify that branches work correctly:

```typescript
describe("Conditional Workflow", () => {
  test("should use quick processing for short content", async () => {
    const run = conditionalWorkflow.createRun();
    
    const result = await run.start({
      inputData: {
        content: "Short simple text here.",
        type: "social"
      }
    });
    
    expect(result.result.processingType).toBe("quick");
  });
  
  test("should use detailed processing for complex content", async () => {
    const run = conditionalWorkflow.createRun();
    
    const result = await run.start({
      inputData: {
        content: "Extraordinarily sophisticated computational paradigms necessitate comprehensive analytical methodologies for effective implementation.",
        type: "article"
      }
    });
    
    expect(result.result.processingType).toBe("detailed");
  });
});
```

## Running Tests

Add test scripts to your package.json:

```json
{
  "scripts": {
    "test": "vitest",
    "test:watch": "vitest --watch"
  }
}
```

Run tests:
```bash
pnpm test
```

## Test Best Practices

1. **Test happy paths**: Verify workflows work with valid inputs
2. **Test error cases**: Ensure proper error handling
3. **Test edge cases**: Boundary conditions and unusual inputs  
4. **Test individual steps**: Isolate step logic for precise testing
5. **Test data flow**: Verify schemas and data transformations
6. **Use descriptive names**: Make test purposes clear

Systematic testing ensures your workflows are reliable and maintainable! Next, you'll learn about deployment and production considerations.