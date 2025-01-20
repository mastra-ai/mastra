import { mastra } from './mastra';

async function main() {
  console.log('Starting workflow');
  const workflow = mastra.getWorkflow('whitePaperWorkflow');

  try {
    await workflow.execute({
      triggerData: {
        token: process.env.SLACK_TOKEN!,
        channelName: 'kindergarten',
        limit: 10,
      },
    });
  } catch (error) {
    console.error('Error:', error);
  }
}

main().catch(console.error);
