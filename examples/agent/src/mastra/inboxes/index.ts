import { Inbox } from '@mastra/core/inbox';

/**
 * Support inbox for handling customer support requests.
 * Tasks can be added programmatically or via API.
 */
export const supportInbox = new Inbox({
  id: 'support-inbox',
  name: 'Support Inbox',
  description: 'Handles customer support requests',
});

/**
 * Analysis inbox for document and data analysis tasks.
 */
export const analysisInbox = new Inbox({
  id: 'analysis-inbox',
  name: 'Analysis Inbox',
  description: 'Handles analysis tasks',
});
