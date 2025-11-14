// @ts-nocheck
import { Workflow } from '@mastra/core/workflows';

const workflow = new Workflow({
  name: 'my-workflow',
  // config
});

// Should transform - called on Workflow instance
await workflow.createRun({ input: { data: 'test' } });

// Multiple calls
const run = await workflow.createRun({ input: { value: 123 } });

// Should NOT transform - called on other object
const otherObj = {
  createRunAsync: () => Promise.resolve()
};
await otherObj.createRunAsync();

// Should NOT transform - not a Workflow instance
class MyClass {
  async createRunAsync() {
    return 'result';
  }
}
const myInstance = new MyClass();
await myInstance.createRunAsync();