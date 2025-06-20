# Streaming Workflow Results

Learn how to stream workflow execution events in real-time, providing users with live updates as workflows progress.

## What is Workflow Streaming?

Streaming allows you to:
- **Show progress**: Users see steps completing in real-time
- **Provide feedback**: Display intermediate results as they're available
- **Improve UX**: Users know something is happening during long workflows
- **Debug easier**: See exactly where workflows succeed or fail

## Basic Streaming Example

Here's how to stream your workflow execution:

```typescript
async function streamWorkflowExecution() {
  console.log("📡 Streaming workflow execution...\n");
  
  try {
    const workflow = mastra.getWorkflow("aiContentWorkflow");
    const run = workflow.createRun();
    
    // Stream the workflow execution
    const result = await run.stream({
      inputData: {
        content: "Renewable energy technologies like solar panels and wind turbines are becoming more efficient and cost-effective, making them viable alternatives to fossil fuels for both residential and commercial applications.",
        type: "article"
      }
    });
    
    console.log("📺 Streaming events:");
    
    // Process each streaming event
    for await (const chunk of result.stream) {
      switch (chunk.type) {
        case 'step-start':
          console.log(`🚀 Starting step: ${chunk.data.stepId}`);
          break;
        case 'step-complete':
          console.log(`✅ Completed step: ${chunk.data.stepId}`);
          break;
        case 'step-error':
          console.log(`❌ Error in step: ${chunk.data.stepId}`);
          break;
        case 'workflow-complete':
          console.log(`🎉 Workflow completed successfully!`);
          break;
      }
    }
    
    console.log("\n📋 Final result:", result.result);
    
  } catch (error) {
    console.error("❌ Streaming failed:", error.message);
  }
}

streamWorkflowExecution();
```

## Stream Event Types

Common streaming events include:
- **`step-start`**: A step is beginning execution
- **`step-complete`**: A step finished successfully
- **`step-error`**: A step encountered an error
- **`workflow-complete`**: The entire workflow finished
- **`workflow-error`**: The workflow failed

## Processing Stream Data

Each event contains:
- **`type`**: The event type
- **`data`**: Event-specific information (step ID, results, errors)
- **`timestamp`**: When the event occurred

## Real-World Use Case

Streaming is perfect for:
- **Progress bars**: Show completion percentage
- **Status updates**: "Processing...", "Analyzing...", "Generating..."
- **Live dashboards**: Real-time workflow monitoring
- **User notifications**: Alert users when long processes complete

Next, you'll learn about monitoring workflow events for debugging and observability!