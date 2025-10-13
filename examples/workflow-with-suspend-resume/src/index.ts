import { mastra } from './mastra';

async function main() {
  console.log('🚀 Starting workflow with suspend/resume example...\n');

  const myWorkflow = mastra.getWorkflow('myWorkflow');
  const run = await myWorkflow.createRun();

  try {
    // Start the workflow - it will suspend at stepTwo
    console.log('📝 Starting workflow with inputValue: 30');
    const result = await run.start({
      inputData: {
        inputValue: 30,
      },
    });

    console.log('📊 Workflow result:', JSON.stringify(result, null, 2));

    // Check if the workflow is suspended
    if (result.status === 'suspended') {
      console.log('\n⏸️  Workflow is suspended! Suspended steps:', result.suspended);

      // Resume the workflow with additional data
      console.log('▶️  Resuming workflow with extraNumber: 5');
      const resumedResult = await run.resume({
        step: result.suspended[0], // Resume the first suspended step
        resumeData: {
          extraNumber: 5,
        },
      });

      console.log('✅ Resumed workflow result:', JSON.stringify(resumedResult, null, 2));
    } else {
      console.log('✅ Workflow completed without suspension');
    }
  } catch (e) {
    console.error('❌ Error:', e);
  }
}

main();
