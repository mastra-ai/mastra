# Testing Conditional Logic

Let's test your conditional workflow with different types of content to see how it routes to different processing paths.

## Testing Different Content Types

Add this comprehensive test to your workflow file:

```typescript
async function testConditionalWorkflow() {
  console.log("🔀 Testing conditional workflow with different content types...\n");
  
  const testCases = [
    {
      name: "Short Simple Content",
      content: "AI is changing the world quickly.",
      type: "social"
    },
    {
      name: "Medium Moderate Content", 
      content: "Artificial intelligence technologies are rapidly advancing across multiple industries. Machine learning algorithms are becoming more sophisticated and capable of handling complex tasks that previously required human intervention. This technological evolution is creating new opportunities while also presenting unique challenges.",
      type: "blog"
    },
    {
      name: "Long Complex Content",
      content: "The phenomenological manifestation of contemporary technological paradigms necessitates comprehensive epistemological reconsideration of traditional methodological frameworks. Interdisciplinary synthesis of computational architectures with anthropocentric design principles facilitates unprecedented optimization of human-machine collaborative ecosystems. These multidimensional transformations fundamentally reconceptualize organizational infrastructures and operational methodologies across diverse institutional contexts, requiring sophisticated analytical frameworks for effective implementation and evaluation of emerging technological solutions.",
      type: "article"
    }
  ];
  
  for (const testCase of testCases) {
    console.log(`\n📝 Testing: ${testCase.name}`);
    console.log(`Content preview: "${testCase.content.substring(0, 50)}..."`);
    
    try {
      const run = conditionalWorkflow.createRun();
      const result = await run.start({
        inputData: {
          content: testCase.content,
          type: testCase.type
        }
      });
      
      console.log(`✅ Processing type: ${result.result.processingType}`);
      console.log(`📋 Recommendations: ${result.result.recommendations.length} items`);
      
    } catch (error) {
      console.error(`❌ Failed: ${error.message}`);
    }
  }
}

testConditionalWorkflow();
```

## Expected Results

- **Short Simple**: Should trigger `quickProcessingStep` → "quick" processing
- **Medium Moderate**: Should trigger `standardProcessingStep` → "standard" processing  
- **Long Complex**: Should trigger `detailedProcessingStep` → "detailed" processing

## Understanding the Flow

1. **Assessment step** analyzes content and determines category/complexity
2. **Branch conditions** are evaluated against the assessment results
3. **Matching step** executes based on which condition(s) are true
4. **Results** show which processing path was taken

## Debugging Conditions

If a condition isn't working as expected:
- Check the assessment step output
- Verify condition logic matches your expectations
- Test individual conditions in isolation
- Add console.log statements to track condition evaluation

## Branch Benefits

Conditional workflows provide:
- **Intelligent routing**: Right processing for right content
- **Performance optimization**: Skip heavy processing for simple content
- **Customized experience**: Different handling for different scenarios
- **Scalable logic**: Easy to add new conditions and processing paths

Next, you'll learn about streaming workflow results for better user experience!