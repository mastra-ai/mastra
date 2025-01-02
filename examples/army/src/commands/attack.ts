import { Command } from 'commander';

import { mastra } from '../mastra';

export const attackCommand = new Command('attack');
attackCommand
  .description('Launch an attack on a target')
  .argument('<target>', 'Target to attack')
  .action(async (target: string) => {
    try {
      const attackWorkflow = mastra.getWorkflow('attack');
      if (!attackWorkflow) {
        console.error('Attack workflow not found. Make sure it is properly set up.');
        process.exit(1);
      }
      const result = await attackWorkflow.execute({
        triggerData: { target },
      });

      if (result.results.attack?.status === 'suspended') {
        console.log('⏸️  Attack workflow suspended. Use the resume command with run ID:', result.runId);
      } else if (result.results.attack?.status === 'success') {
        console.log('✅ Attack completed successfully!');
      } else {
        console.log('❌ Attack failed:', result.results);
      }
    } catch (error) {
      console.error('Failed to execute attack workflow:', error);
    }
  });
