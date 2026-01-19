import { mastra } from './mastra/index';

/**
 * Inbox Worker - Runs an agent that processes tasks from an inbox
 *
 * Usage:
 * 1. Start mastra dev:  pnpm mastra:dev
 * 2. Start this worker: pnpm inbox-worker
 * 3. Open Studio and add tasks to the inbox
 * 4. Watch the worker process them!
 */

async function main() {
  console.log('🚀 Starting Inbox Worker\n');
  console.log('='.repeat(60));

  // Get the support agent
  const supportAgent = mastra.getAgent('supportAgent');

  console.log(`\n🤖 Agent: ${supportAgent.id}`);
  console.log('\n⏳ Waiting for tasks... (Add tasks via Studio at http://localhost:4111)\n');
  console.log('-'.repeat(60));

  // Run the agent with the inbox - it will poll and process tasks
  await supportAgent.handle({
    inbox: 'supportInbox',
    pollInterval: 2000,
  });
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down worker...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n👋 Shutting down worker...');
  process.exit(0);
});

// Run the worker
main().catch(error => {
  console.error('❌ Worker failed:', error);
  process.exit(1);
});
