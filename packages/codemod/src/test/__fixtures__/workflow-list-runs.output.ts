// @ts-nocheck
import { Workflow } from '@mastra/core/workflows';

const workflow = new Workflow({
  name: 'my-workflow',
});

// Should transform - called on Workflow instance
const runs = await workflow.listWorkflowRuns({ fromDate, toDate });

// Multiple calls
const runs2 = await workflow.listWorkflowRuns({ fromDate: new Date() });

// Should NOT transform - called on other object
const otherObj = {
  getWorkflowRuns: () => []
};
const other = otherObj.getWorkflowRuns();

// Should NOT transform - not a Workflow instance
class MyClass {
  getWorkflowRuns() {
    return [];
  }
}
const myInstance = new MyClass();
myInstance.getWorkflowRuns();