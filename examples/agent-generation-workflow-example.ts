import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core';
import { createAgentGenerationWorkflow } from '@mastra/core/agent/generation-workflow';
import { RuntimeContext } from '@mastra/core/runtime-context';

// Example: Using the new workflow-based agent generation

async function demonstrateWorkflowGeneration() {
  // Create an agent
  const agent = new Agent({
    name: 'ExampleAgent',
    instructions: 'You are a helpful assistant that explains concepts clearly.',
    model: openai('gpt-4o-mini'),
  });

  console.log('=== Traditional Agent Generate ===');
  // Traditional approach (before refactoring)
  const traditionalResult = await agent.generate('Explain what a Mastra workflow is.');
  console.log('Traditional result:', traditionalResult.text);

  console.log('\n=== Workflow-based Agent Generate ===');
  // New workflow-based approach (after refactoring)
  const generationWorkflow = createAgentGenerationWorkflow(agent);
  
  // Create a workflow run
  const run = generationWorkflow.createRun();
  
  // Execute the workflow with before/after lifecycle
  const workflowResult = await run.start({
    inputData: {
      messages: 'Explain what a Mastra workflow is and how it helps with before/after processing.',
      generateOptions: {
        temperature: 0.7,
        runtimeContext: new RuntimeContext(),
      },
    },
    runtimeContext: new RuntimeContext(),
  });

  console.log('Workflow result:', workflowResult.finalResult.text);

  // The workflow approach provides the same result but with:
  // 1. Clear separation of before/after logic in distinct steps
  // 2. Better observability and debugging capabilities  
  // 3. Ability to suspend/resume execution
  // 4. Structured step-by-step execution
  // 5. Better error handling and retries per step
  
  console.log('\n=== Workflow Benefits ===');
  console.log('✅ Before step: Setup context, memory, and tools');
  console.log('✅ Generation step: Execute LLM with prepared context');
  console.log('✅ After step: Handle memory persistence and scoring');
  console.log('✅ Each step is independently observable and debuggable');
  console.log('✅ Workflow can be paused, resumed, or retried at any step');
}

// Export for use in other examples
export { demonstrateWorkflowGeneration };

// Run if called directly
if (require.main === module) {
  demonstrateWorkflowGeneration()
    .then(() => console.log('\n✨ Workflow generation example completed!'))
    .catch(console.error);
}