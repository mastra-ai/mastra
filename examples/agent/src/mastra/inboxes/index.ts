import { Inbox } from '@mastra/core/inbox';

/**
 * Support inbox for handling customer support requests.
 * Tasks can be added programmatically or via API.
 */
export const supportInbox = new Inbox({
  id: 'support-inbox',
  name: 'Support Inbox',
  description: 'Handles customer support requests',

  onComplete: async (task, result) => {
    console.log(`\n✅ [${new Date().toLocaleTimeString()}] Task completed: "${task.title || task.id}"`);
    console.log(`   Result: ${JSON.stringify(result).substring(0, 200)}`);
    console.log('-'.repeat(60));
  },

  onError: async (task, error) => {
    console.log(`\n❌ [${new Date().toLocaleTimeString()}] Task failed: "${task.title || task.id}"`);
    console.log(`   Error: ${error.message}`);
    console.log('-'.repeat(60));
  },
});

/**
 * Analysis inbox for document and data analysis tasks.
 */
export const analysisInbox = new Inbox({
  id: 'analysis-inbox',
  name: 'Analysis Inbox',
  description: 'Handles analysis tasks',

  onComplete: async (task, result) => {
    console.log(`\n✅ [${new Date().toLocaleTimeString()}] Analysis completed: "${task.title || task.id}"`);
    console.log(`   Result: ${JSON.stringify(result).substring(0, 200)}`);
    console.log('-'.repeat(60));
  },

  onError: async (task, error) => {
    console.log(`\n❌ [${new Date().toLocaleTimeString()}] Analysis failed: "${task.title || task.id}"`);
    console.log(`   Error: ${error.message}`);
    console.log('-'.repeat(60));
  },
});
