import { mastra } from './mastra/index';
import { TaskPriority } from '@mastra/core/inbox';

/**
 * Inbox Demo - Demonstrates how to use the Agent Inbox feature
 *
 * This example shows:
 * 1. Adding tasks to an inbox
 * 2. Running an agent to process inbox tasks
 * 3. Monitoring task progress
 * 4. Human-in-the-loop with suspend/resume
 */

async function main() {
  console.log('🚀 Agent Inbox Demo\n');
  console.log('='.repeat(60));

  // Initialize storage (creates tables if needed)
  await mastra.init();

  // Get the support inbox
  const supportInbox = mastra.getInbox('supportInbox');
  const supportAgent = mastra.getAgent('supportAgent');

  console.log('\n📥 Adding tasks to the support inbox...\n');

  // Add some support tasks
  const tasks = [
    {
      type: 'support-request',
      title: 'Billing Question',
      payload: {
        customerEmail: 'customer1@example.com',
        message: 'I was charged twice for my subscription last month. Can you help me get a refund?',
      },
      priority: TaskPriority.HIGH,
    },
    {
      type: 'support-request',
      title: 'Feature Request',
      payload: {
        customerEmail: 'customer2@example.com',
        message: 'It would be great if the app could send me weekly summary reports via email.',
      },
      priority: TaskPriority.NORMAL,
    },
    {
      type: 'support-request',
      title: 'Bug Report',
      payload: {
        customerEmail: 'customer3@example.com',
        message: 'The export to PDF feature is broken. I get an error every time I try to use it.',
      },
      priority: TaskPriority.HIGH,
    },
  ];

  for (const taskInput of tasks) {
    const task = await supportInbox.add(taskInput);
    console.log(`  ✅ Added task: "${task.title}" (priority: ${task.priority})`);
  }

  // Get inbox stats
  const stats = await supportInbox.stats();
  console.log('\n📊 Inbox Stats:', stats);

  console.log('\n🤖 Starting agent to process tasks...\n');
  console.log('-'.repeat(60));

  // Create an abort controller to stop the agent after processing
  const controller = new AbortController();
  let processedCount = 0;

  // Run the agent with inbox
  const runPromise = supportAgent.run({
    inbox: supportInbox,
    pollInterval: 1000,
    maxConcurrent: 1,

    onTaskStart: task => {
      console.log(`\n🔄 Processing: "${task.title}"`);
      console.log(`   Customer: ${(task.payload as any).customerEmail}`);
      console.log(`   Message: ${(task.payload as any).message.substring(0, 50)}...`);
    },

    onTaskComplete: (task, result) => {
      console.log(`\n✅ Completed: "${task.title}"`);
      console.log(`   Result: ${JSON.stringify(result).substring(0, 100)}...`);
      processedCount++;

      // Stop after processing all tasks
      if (processedCount >= tasks.length) {
        console.log('\n📭 All tasks processed. Stopping agent...');
        controller.abort();
      }
    },

    onTaskError: (task, error) => {
      console.log(`\n❌ Failed: "${task.title}"`);
      console.log(`   Error: ${error.message}`);
    },

    onEmpty: () => {
      console.log('📭 No pending tasks...');
    },

    signal: controller.signal,
  });

  // Wait for the run to complete (or be aborted)
  try {
    await runPromise;
  } catch (error: any) {
    if (error.name !== 'AbortError') {
      throw error;
    }
  }

  // Final stats
  const finalStats = await supportInbox.stats();
  console.log('\n' + '='.repeat(60));
  console.log('📊 Final Inbox Stats:', finalStats);
  console.log('\n🎉 Demo complete!');
}

// Run the demo
main().catch(error => {
  console.error('❌ Demo failed:', error);
  process.exit(1);
});
