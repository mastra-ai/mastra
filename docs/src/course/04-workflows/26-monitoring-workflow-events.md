# Monitoring Workflow Events

Learn how to monitor and debug workflows by watching all events that occur during execution.

## Setting Up Event Monitoring

Use the `watch()` method to monitor all workflow events:

```typescript
async function watchWorkflowExecution() {
  console.log("👀 Watching workflow execution events...\n");
  
  try {
    const workflow = mastra.getWorkflow("conditionalWorkflow");
    const run = workflow.createRun();
    
    // Set up event monitoring before starting
    run.watch((event) => {
      const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
      
      switch (event.type) {
        case 'step-start':
          console.log(`[${timestamp}] 📍 Starting: ${event.stepId}`);
          break;
        case 'step-complete':
          console.log(`[${timestamp}] ✨ Completed: ${event.stepId}`);
          break;
        case 'step-error':
          console.log(`[${timestamp}] ⚠️ Error in: ${event.stepId} - ${event.error}`);
          break;
        case 'workflow-complete':
          console.log(`[${timestamp}] 🏁 Workflow finished successfully`);
          break;
        case 'workflow-error':
          console.log(`[${timestamp}] 💥 Workflow failed: ${event.error}`);
          break;
        default:
          console.log(`[${timestamp}] 📦 Event: ${event.type}`);
      }
    });
    
    // Now start the workflow
    const result = await run.start({
      inputData: {
        content: "Machine learning algorithms analyze vast datasets to identify patterns and make predictions with remarkable accuracy.",
        type: "article"
      }
    });
    
    console.log("\n📊 Final result:", result.result.processingType);
    
  } catch (error) {
    console.error("❌ Monitoring failed:", error.message);
  }
}

watchWorkflowExecution();
```

## Event Information

Each event provides:
- **`type`**: What kind of event occurred
- **`stepId`**: Which step the event relates to (if applicable)
- **`timestamp`**: When the event happened
- **`data`**: Additional event-specific information
- **`error`**: Error details (for error events)

## Advanced Monitoring

Create a more sophisticated monitor:

```typescript
function createWorkflowMonitor() {
  const events = [];
  const stepTimes = new Map();
  
  return {
    watch: (run) => {
      run.watch((event) => {
        events.push({
          ...event,
          timestamp: Date.now()
        });
        
        if (event.type === 'step-start') {
          stepTimes.set(event.stepId, Date.now());
        }
        
        if (event.type === 'step-complete') {
          const startTime = stepTimes.get(event.stepId);
          if (startTime) {
            const duration = Date.now() - startTime;
            console.log(`⏱️ Step "${event.stepId}" took ${duration}ms`);
          }
        }
      });
    },
    
    getStats: () => ({
      totalEvents: events.length,
      stepCount: stepTimes.size,
      events: events
    })
  };
}

// Usage
const monitor = createWorkflowMonitor();
monitor.watch(run);
// ... after workflow completes
console.log("📈 Stats:", monitor.getStats());
```

## Debugging Use Cases

Monitoring helps with:
- **Performance analysis**: See which steps take the longest
- **Error debugging**: Identify exactly where failures occur
- **Flow verification**: Confirm workflows execute as expected
- **Production monitoring**: Track workflow health in live systems

Next, you'll learn about testing workflows systematically to ensure they work correctly!