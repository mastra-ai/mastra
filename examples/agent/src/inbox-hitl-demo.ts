import { mastra } from './mastra/index';
import { TaskPriority, TaskStatus } from '@mastra/core/inbox';

/**
 * Inbox Human-in-the-Loop Demo
 *
 * This example demonstrates:
 * 1. Creating a task that requires human approval
 * 2. Agent suspending a task when it needs input
 * 3. Human providing input to resume the task
 * 4. Agent completing the task with the provided input
 */

async function main() {
  console.log('🚀 Agent Inbox - Human-in-the-Loop Demo\n');
  console.log('='.repeat(60));

  // Initialize storage
  await mastra.init();

  // Get the analysis inbox
  const analysisInbox = mastra.getInbox('analysisInbox');

  console.log('\n📥 Adding an analysis task that requires approval...\n');

  // Add a task that will require human approval
  const task = await analysisInbox.add({
    type: 'document-analysis',
    title: 'Analyze Q4 Financial Report',
    payload: {
      documentUrl: 'https://example.com/reports/q4-2024.pdf',
      analysisType: 'financial-summary',
      requiresApproval: true,
    },
    priority: TaskPriority.HIGH,
    metadata: {
      requestedBy: 'finance@company.com',
      department: 'Finance',
    },
  });

  console.log(`  ✅ Created task: ${task.id}`);
  console.log(`     Title: ${task.title}`);
  console.log(`     Status: ${task.status}`);

  // Simulate agent claiming and processing the task
  console.log('\n🤖 Agent claiming the task...\n');

  const inboxStorage = await mastra.storage?.getStore('inbox');
  if (!inboxStorage) {
    throw new Error('Inbox storage not available');
  }

  // Claim the task
  const claimedTask = await inboxStorage.claimTask({
    inboxId: analysisInbox.id,
    agentId: 'analysis-agent',
  });

  if (!claimedTask) {
    console.log('No tasks to claim');
    return;
  }

  console.log(`  ✅ Task claimed by analysis-agent`);
  console.log(`     Status: ${claimedTask.status}`);

  // Start the task
  const startedTask = await inboxStorage.startTask(claimedTask.id);
  console.log(`  ✅ Task started`);
  console.log(`     Status: ${startedTask.status}`);

  // Simulate the agent processing and finding it needs approval
  console.log('\n🔍 Agent analyzing document...');
  console.log('   Agent found sensitive financial data.');
  console.log('   Suspending task for human approval...\n');

  // Suspend the task with a payload explaining what approval is needed
  const suspendedTask = await inboxStorage.suspendTask(claimedTask.id, {
    reason: 'approval_required',
    payload: {
      question: 'The analysis contains sensitive financial projections. Should I include detailed revenue forecasts?',
      options: ['yes_include_forecasts', 'no_summary_only', 'redact_sensitive'],
      analysisPreview: {
        totalRevenue: '$4.2M',
        growth: '12%',
        sensitiveDataFound: ['revenue projections', 'customer contracts', 'acquisition targets'],
      },
    },
  });

  console.log(`  ⏸️  Task suspended`);
  console.log(`     Status: ${suspendedTask.status}`);
  console.log(`     Reason: ${(suspendedTask.suspendPayload as any)?.question}`);

  // List waiting tasks
  const waitingTasks = await inboxStorage.listWaitingTasks(analysisInbox.id);
  console.log(`\n📋 Tasks waiting for input: ${waitingTasks.length}`);
  for (const wt of waitingTasks) {
    console.log(`   - ${wt.title} (${wt.id})`);
  }

  // Simulate human providing input
  console.log('\n👤 Human reviewing suspended task...');
  console.log('   Human decision: "Include summary only, redact sensitive data"\n');

  // Resume the task with the human's input
  const resumedTask = await inboxStorage.resumeTask(claimedTask.id, {
    payload: {
      decision: 'no_summary_only',
      additionalInstructions: 'Please redact all specific revenue numbers and customer names.',
      approvedBy: 'cfo@company.com',
      approvedAt: new Date().toISOString(),
    },
  });

  console.log(`  ▶️  Task resumed`);
  console.log(`     Status: ${resumedTask.status}`);
  console.log(`     Resume payload: ${JSON.stringify(resumedTask.resumePayload)}`);

  // Simulate agent completing the task
  console.log('\n🤖 Agent completing analysis with approved settings...');

  const completedTask = await inboxStorage.completeTask(claimedTask.id, {
    summary: 'Q4 Financial Report Analysis (Redacted)',
    highlights: [
      'Revenue growth exceeded targets',
      'Operating margins improved by 2 percentage points',
      'Customer retention rate at 94%',
    ],
    sensitiveDataRedacted: true,
    approvalChain: ['cfo@company.com'],
  });

  console.log(`\n  ✅ Task completed`);
  console.log(`     Status: ${completedTask.status}`);
  console.log(`     Result: ${JSON.stringify(completedTask.result, null, 2)}`);

  // Final stats
  const stats = await analysisInbox.stats();
  console.log('\n' + '='.repeat(60));
  console.log('📊 Final Inbox Stats:', stats);
  console.log('\n🎉 Human-in-the-Loop demo complete!');
}

// Run the demo
main().catch(error => {
  console.error('❌ Demo failed:', error);
  process.exit(1);
});
