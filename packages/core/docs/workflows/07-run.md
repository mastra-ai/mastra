> Documentation for the Run class in Mastra, which represents a workflow execution instance.

# Run Class

The `Run` class represents a workflow execution instance, providing methods to start, resume, stream, and monitor workflow execution.

## Usage example

```typescript
const run = await workflow.createRun();

const result = await run.start({
  inputData: { value: 'initial data' },
});

if (result.status === 'suspended') {
  const resumedResult = await run.resume({
    resumeData: { value: 'resume data' },
  });
}
```

## Run Methods

## Run Status

A workflow run's `status` indicates its current execution state. The possible values are:

## Related

- [Run.start()](./run-methods/start)
- [Run.resume()](./run-methods/resume)
- [Run.cancel()](./run-methods/cancel)
- [Run.restart()](./run-methods/restart)
- [Run.timeTravel()](./run-methods/timeTravel)
- [Run.stream()](/docs/v1/streaming/workflow-streaming)
- [Run.timeTravelStream()](../streaming/workflows/timeTravelStream)
