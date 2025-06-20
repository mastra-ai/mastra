# Creating Conditional Steps

Let's create different processing steps for different types of content based on length and complexity.

## Assessment Step

First, create a step that analyzes content to determine which path to take:

```typescript
const assessContentStep = createStep({
  id: "assess-content",
  description: "Assesses content to determine processing path",
  inputSchema: z.object({
    content: z.string(),
    type: z.string()
  }),
  outputSchema: z.object({
    content: z.string(),
    type: z.string(),
    wordCount: z.number(),
    complexity: z.enum(["simple", "moderate", "complex"]),
    category: z.enum(["short", "medium", "long"])
  }),
  execute: async ({ inputData }) => {
    const { content, type } = inputData;
    const words = content.trim().split(/\s+/);
    const wordCount = words.length;
    
    // Determine category by length
    let category: "short" | "medium" | "long" = "short";
    if (wordCount >= 50) category = "medium";
    if (wordCount >= 200) category = "long";
    
    // Determine complexity by average word length
    const avgWordLength = words.reduce((sum, word) => sum + word.length, 0) / wordCount;
    let complexity: "simple" | "moderate" | "complex" = "simple";
    if (avgWordLength > 5) complexity = "moderate";
    if (avgWordLength > 7) complexity = "complex";
    
    console.log(`📋 Assessment: ${category} content, ${complexity} complexity`);
    
    return {
      content,
      type,
      wordCount,
      complexity,
      category
    };
  }
});
```

## Quick Processing Step

For short, simple content:

```typescript
const quickProcessingStep = createStep({
  id: "quick-processing",
  description: "Quick processing for short content",
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
    console.log("⚡ Quick processing for short content...");
    
    return {
      processedContent: inputData.content,
      processingType: "quick",
      recommendations: ["Content is concise", "Consider expanding for more detail"]
    };
  }
});
```

## Detailed Processing Step

For long or complex content:

```typescript
const detailedProcessingStep = createStep({
  id: "detailed-processing",
  description: "Detailed processing for complex content",
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
    console.log("🔍 Detailed processing for complex content...");
    
    // Simulate more complex processing
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return {
      processedContent: inputData.content,
      processingType: "detailed",
      recommendations: [
        "Break down complex sentences",
        "Add more paragraph breaks",
        "Consider simpler vocabulary",
        "Include more examples"
      ]
    };
  }
});
```

These steps will be used in different branches based on the content assessment. Next, you'll create the conditional workflow!