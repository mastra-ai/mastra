import { externalAdapter } from './base.js';

/**
 * Chat threads a card was opened from. The integration id names the chat
 * adapter (`slack`, …), so it is the provider; threads have no key or state.
 */
export const slackWorkItemAdapter = externalAdapter('slack', {
  providerFromSource: true,
  providerMetadataKeys: [],
  kind: () => 'thread',
  key: () => null,
  state: () => null,
});
