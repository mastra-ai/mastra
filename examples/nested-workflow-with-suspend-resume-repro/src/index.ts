import { mastra } from './mastra';

async function main() {
  console.log('🚀 Starting workflow to reproduce nested workflow bug...\n');

  const myWorkflow = mastra.getWorkflow('buggyWorkflow');
  const run = await myWorkflow.createRunAsync();

  try {
    // Start the workflow - it will suspend at the first nested workflow
    console.log('📝 Starting workflow with suspect: "initial-suspect"');
    const result = await run.start({
      inputData: {
        suspect: 'initial-suspect',
      },
    });

    console.log('📊 First workflow result:', JSON.stringify(result, null, 2));

    // Check if the workflow is suspended
    if (result.status === 'suspended') {
      console.log('\n⏸️  Workflow is suspended! Suspended steps:', result.suspended);

      // Resume the first suspended step
      console.log('▶️  Resuming first suspended step with suspect: "first-suspect"');
      const firstResumeResult = await run.resume({
        step: result.suspended[0], // Resume the first suspended step
        resumeData: {
          suspect: 'first-suspect',
        },
      });

      console.log('📊 First resume result:', JSON.stringify(firstResumeResult, null, 2));

      // Check if there's another suspension (this is where the bug should occur)
      if (firstResumeResult.status === 'suspended') {
        console.log('\n⏸️  Workflow is suspended again! Suspended steps:', firstResumeResult.suspended);

        // This should trigger the bug: "This workflow run was not suspended"
        console.log('▶️  Resuming second suspended step with suspect: "second-suspect"');
        const secondResumeResult = await run.resume({
          step: firstResumeResult.suspended[0],
          resumeData: {
            suspect: 'second-suspect',
          },
        });

        console.log('✅ Final workflow result:', JSON.stringify(secondResumeResult, null, 2));
      } else {
        console.log('✅ Workflow completed after first resume');
      }
    } else {
      console.log('✅ Workflow completed without suspension');
    }
  } catch (e) {
    console.error('❌ Error (this might be the bug!):', e.message);
    console.error('Full error:', e);
  }
}

main();
