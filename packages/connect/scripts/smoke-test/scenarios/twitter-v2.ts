import type { Scenario, ScenarioStep } from '../scenario.js';
import { makeStep, errorMessage, requireTools, runReadBatch, probeTool } from '../scenario.js';

/**
 * Deep Twitter/X scenario: lists + full tweet CRUD on a self-posted smoke
 * tweet that is deleted on the same run. Like, bookmark, and liked-tweet
 * operations are performed against that same tweet so the only side effect
 * on the public timeline is a tweet that lives for roughly one second.
 *
 * follow / unfollow / get_mention / get_space are probed with synthetic ids
 * since real targets would be destructive or require fixtures the smoke
 * harness cannot bootstrap.
 */
export const twitterScenario: Scenario = {
  integrationId: 'twitter-v2',
  summary: 'tweet + like + bookmark + list lifecycle (self-cleanup)',
  async run({ tools, runId, call, log }) {
    const steps: ScenarioStep[] = [];
    const missing = requireTools(tools, ['twitter_v2_create_list', 'twitter_v2_get_list', 'twitter_v2_delete_list']);
    if (missing) {
      steps.push({ name: 'preflight', status: 'skip', detail: missing });
      return steps;
    }

    // Read-only surface.
    let userId: string | undefined;
    if (tools['twitter_v2_get_user']) {
      try {
        const user = await call<{ id?: string; data?: { id?: string } }>('twitter_v2_get_user', {});
        userId = user.id ?? user.data?.id;
        steps.push(makeStep('get user', 'twitter_v2_get_user', 'pass', userId));
      } catch (error) {
        steps.push(makeStep('get user', 'twitter_v2_get_user', 'fail', errorMessage(error)));
      }
    }

    steps.push(
      ...(await runReadBatch(
        call,
        [
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

    // Tweet lifecycle: create → read → like → bookmark → unbookmark → unlike → delete.
    let tweetId: string | undefined;
    if (tools['twitter_v2_create_tweet']) {
      try {
        const tweet = await call<{ id?: string; data?: { id?: string } }>('twitter_v2_create_tweet', {
          text: `mastra connect smoke ${runId} (auto-deleted)`,
        });
        tweetId = tweet.id ?? tweet.data?.id;
        steps.push(makeStep('create tweet', 'twitter_v2_create_tweet', tweetId ? 'pass' : 'fail', tweetId));
      } catch (error) {
        steps.push(makeStep('create tweet', 'twitter_v2_create_tweet', 'fail', errorMessage(error)));
      }
    }

    if (tweetId && tools['twitter_v2_get_tweet']) {
      try {
        await call('twitter_v2_get_tweet', { id: tweetId });
        steps.push(makeStep('get tweet', 'twitter_v2_get_tweet', 'pass'));
      } catch (error) {
        steps.push(makeStep('get tweet', 'twitter_v2_get_tweet', 'fail', errorMessage(error)));
      }
    }

    if (tweetId && tools['twitter_v2_like_tweet']) {
      try {
        await call('twitter_v2_like_tweet', { tweetId });
        steps.push(makeStep('like tweet', 'twitter_v2_like_tweet', 'pass'));
      } catch (error) {
        steps.push(makeStep('like tweet', 'twitter_v2_like_tweet', 'fail', errorMessage(error)));
      }
    }

    if (tweetId && userId && tools['twitter_v2_create_liked_tweet']) {
      // create_liked_tweet is the explicit POST /users/:id/likes variant.
      try {
        await call('twitter_v2_create_liked_tweet', { userId, tweet_id: tweetId });
        steps.push(makeStep('create liked tweet', 'twitter_v2_create_liked_tweet', 'pass'));
      } catch (error) {
        steps.push(makeStep('create liked tweet', 'twitter_v2_create_liked_tweet', 'fail', errorMessage(error)));
      }
    }

    if (tweetId && tools['twitter_v2_get_liked_tweet']) {
      try {
        await call('twitter_v2_get_liked_tweet', { tweet_id: tweetId });
        steps.push(makeStep('get liked tweet', 'twitter_v2_get_liked_tweet', 'pass'));
      } catch (error) {
        steps.push(makeStep('get liked tweet', 'twitter_v2_get_liked_tweet', 'fail', errorMessage(error)));
      }
    }

    if (tweetId && userId && tools['twitter_v2_bookmark_tweet']) {
      try {
        await call('twitter_v2_bookmark_tweet', { userId, tweetId });
        steps.push(makeStep('bookmark tweet', 'twitter_v2_bookmark_tweet', 'pass'));
      } catch (error) {
        steps.push(makeStep('bookmark tweet', 'twitter_v2_bookmark_tweet', 'fail', errorMessage(error)));
      }
    }

    if (tweetId && tools['twitter_v2_remove_bookmark']) {
      try {
        await call('twitter_v2_remove_bookmark', { tweet_id: tweetId });
        steps.push(makeStep('remove bookmark', 'twitter_v2_remove_bookmark', 'pass'));
      } catch (error) {
        steps.push(makeStep('remove bookmark', 'twitter_v2_remove_bookmark', 'fail', errorMessage(error)));
      }
    }

    if (tweetId && tools['twitter_v2_delete_liked_tweet']) {
      try {
        await call('twitter_v2_delete_liked_tweet', { tweet_id: tweetId });
        steps.push(makeStep('delete liked tweet', 'twitter_v2_delete_liked_tweet', 'pass'));
      } catch (error) {
        steps.push(makeStep('delete liked tweet', 'twitter_v2_delete_liked_tweet', 'fail', errorMessage(error)));
      }
    }

    if (tweetId && tools['twitter_v2_unlike_tweet']) {
      try {
        await call('twitter_v2_unlike_tweet', { tweet_id: tweetId });
        steps.push(makeStep('unlike tweet', 'twitter_v2_unlike_tweet', 'pass'));
      } catch (error) {
        steps.push(makeStep('unlike tweet', 'twitter_v2_unlike_tweet', 'fail', errorMessage(error)));
      }
    }

    if (tweetId && tools['twitter_v2_delete_tweet']) {
      try {
        await call('twitter_v2_delete_tweet', { id: tweetId });
        steps.push(makeStep('delete tweet', 'twitter_v2_delete_tweet', 'pass'));
      } catch (error) {
        log.error(`Failed to delete smoke tweet ${tweetId}`, errorMessage(error));
        steps.push(makeStep('delete tweet', 'twitter_v2_delete_tweet', 'fail', errorMessage(error)));
      }
    }

    // Follow / unfollow are destructive on real accounts; probe with a
    // synthetic user id and accept the resulting error as proof the tool
    // routes to /users/:id/following correctly.
    const syntheticTarget = `0${runId.replace(/[^0-9]/g, '')}00000000`.slice(0, 19);
    steps.push(
      await probeTool(call, tools, 'follow user', 'twitter_v2_follow_user', { target_user_id: syntheticTarget }),
    );
    steps.push(
      await probeTool(call, tools, 'unfollow user', 'twitter_v2_unfollow_user', { target_user_id: syntheticTarget }),
    );
    steps.push(await probeTool(call, tools, 'get mention', 'twitter_v2_get_mention', { id: syntheticTarget }));
    steps.push(await probeTool(call, tools, 'get space', 'twitter_v2_get_space', { space_id: '1zqKVXPQhvZJB' }));

    // List lifecycle.
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
