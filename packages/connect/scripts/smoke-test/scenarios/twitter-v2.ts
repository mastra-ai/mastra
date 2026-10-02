import type { Scenario, ScenarioStep } from '../scenario.js';
import { makeStep, errorMessage, requireTools, runReadBatch } from '../scenario.js';

/**
 * Deep Twitter/X scenario: lists lifecycle plus read-only tweet/user calls.
 * The scenario intentionally does NOT create or delete tweets, likes, follows,
 * or bookmarks — those cause side effects on the real public timeline.
 */
export const twitterScenario: Scenario = {
  integrationId: 'twitter-v2',
  summary: 'list CRUD + read-only tweet/user calls (no public posts)',
  async run({ tools, runId, call, log }) {
    const steps: ScenarioStep[] = [];
    const missing = requireTools(tools, ['twitter_v2_create_list', 'twitter_v2_get_list', 'twitter_v2_delete_list']);
    if (missing) {
      steps.push({ name: 'preflight', status: 'skip', detail: missing });
      return steps;
    }

    steps.push(
      ...(await runReadBatch(
        call,
        [
          ['twitter_v2_get_user', {}],
          ['twitter_v2_list_tweets', { maxResults: 5 }],
          ['twitter_v2_list_mentions', { maxResults: 5 }],
          ['twitter_v2_list_lists', { maxResults: 5 }],
          ['twitter_v2_list_liked_tweets', { maxResults: 5 }],
          ['twitter_v2_list_following', { maxResults: 5 }],
          ['twitter_v2_list_spaces', {}],
          ['twitter_v2_search_tweets', { query: 'mastra', maxResults: 5 }],
          ['twitter_v2_list_users', { usernames: ['twitter'] }],
        ],
        tools,
      )),
    );

    let listId: string | undefined;
    try {
      const list = await call<{ id: string }>('twitter_v2_create_list', {
        name: `${runId} smoke list`,
        description: 'Automated @mastra/connect smoke test. Safe to delete.',
        private: true,
      });
      listId = list.id;
      steps.push(makeStep('create list', 'twitter_v2_create_list', 'pass', listId));
    } catch (error) {
      steps.push(makeStep('create list', 'twitter_v2_create_list', 'fail', errorMessage(error)));
      return steps;
    }

    try {
      await call('twitter_v2_get_list', { listId });
      steps.push(makeStep('read list', 'twitter_v2_get_list', 'pass'));
    } catch (error) {
      steps.push(makeStep('read list', 'twitter_v2_get_list', 'fail', errorMessage(error)));
    }

    if (tools['twitter_v2_update_list']) {
      try {
        await call('twitter_v2_update_list', {
          listId,
          name: `${runId} smoke list (renamed)`,
        });
        steps.push(makeStep('update list', 'twitter_v2_update_list', 'pass'));
      } catch (error) {
        steps.push(makeStep('update list', 'twitter_v2_update_list', 'fail', errorMessage(error)));
      }
    }

    try {
      await call('twitter_v2_delete_list', { listId });
      steps.push(makeStep('delete list', 'twitter_v2_delete_list', 'pass'));
    } catch (error) {
      log.error(`Failed to delete smoke list ${listId}`, errorMessage(error));
      steps.push(makeStep('delete list', 'twitter_v2_delete_list', 'fail', errorMessage(error)));
    }

    return steps;
  },
};
