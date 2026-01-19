import { mastra } from './mastra/index';

/**
 * Inbox Worker - Runs an agent that processes tasks from an inbox
 *
 * Usage:
 * 1. Start this worker: pnpm inbox-worker
 * 2. Start mastra dev:  pnpm mastra:dev
 * 3. Open Studio and add tasks to the inbox
 * 4. Watch the worker process them!
 */

async function main() {
  console.log('🚀 Starting Inbox Worker\n');
  console.log('='.repeat(60));

  // Initialize storage (creates tables if needed)
  await mastra.init();

  // Get the support inbox and agent
  const supportInbox = mastra.getInbox('supportInbox');
  const supportAgent = mastra.getAgent('supportAgent');

  console.log(`\n📥 Inbox: ${supportInbox.id}`);
  console.log(`🤖 Agent: ${supportAgent.id}`);
  console.log('\n⏳ Waiting for tasks... (Add tasks via Studio at http://localhost:4111)\n');
  console.log('-'.repeat(60));

  // Run the agent with the inbox
  await supportAgent.run({
    inbox: supportInbox,
    pollInterval: 2000, // Check every 2 seconds

    onTaskStart: task => {
      console.log(`\n🔄 [${new Date().toLocaleTimeString()}] Processing: "${task.title || task.type}"`);
      console.log(`   ID: ${task.id}`);
      console.log(`   Type: ${task.type}`);
      console.log(`   Priority: ${task.priority}`);
      if (task.payload) {
        console.log(`   Payload: ${JSON.stringify(task.payload).substring(0, 100)}...`);
      }
    },

    onTaskComplete: (task, result) => {
      console.log(`\n✅ [${new Date().toLocaleTimeString()}] Completed: "${task.title || task.type}"`);
      console.log(`   Result: ${JSON.stringify(result).substring(0, 200)}...`);
      console.log('-'.repeat(60));
    },

    onTaskError: (task, error) => {
      console.log(`\n❌ [${new Date().toLocaleTimeString()}] Failed: "${task.title || task.type}"`);
      console.log(`   Error: ${error.message}`);
      console.log('-'.repeat(60));
    },

    onEmpty: () => {
      // Silent - don't spam the console when idle
    },
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
