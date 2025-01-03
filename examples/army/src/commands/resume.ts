import { Command } from 'commander';

import { mastra } from '../mastra';

export const resumeCommand = new Command('resume');
resumeCommand
  .description('Resume a suspended workflow')
  .argument('<runId>', 'Run ID of the suspended workflow')
  .action(async (runId: string) => {
    try {
      const attackWorkflow = mastra.getWorkflow('attack');
      if (!attackWorkflow) {
        console.error('Attack workflow not found. Make sure it is properly set up.');
        process.exit(1);
      }

      const result = await attackWorkflow.execute({
        loadSnapshot: { runId },
      });

      if (result.results.attack?.status === 'success') {
        console.log('✅ Attack completed successfully!');
      } else if (result.results.checkPermission?.status === 'suspended') {
        console.log('⏸️  Attack workflow still suspended. Try again later with run ID:', result.runId);
      } else {
        console.log('❌ Attack failed:', result.results);
      }
    } catch (error) {
      console.error('Failed to resume attack workflow:', error);
    }
  });
