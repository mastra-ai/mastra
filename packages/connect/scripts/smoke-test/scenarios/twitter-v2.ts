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

    // The X API v2 toolset has no "me" endpoint, so the authenticated user's
    // id must be provided explicitly for user-scoped operations. Public reads
    // fall back to a well-known account looked up via list_users.
    const authUserId = process.env.MASTRA_SMOKE_TWITTER_USER_ID;

    let lookupUserId: string | undefined;
    if (tools['twitter_v2_list_users']) {
      try {
        const res = await call<{ users?: Array<{ id?: string }>; data?: Array<{ id?: string }> }>(
          'twitter_v2_list_users',
          { usernames: ['XDevelopers'] },
        );
        lookupUserId = res.users?.[0]?.id ?? res.data?.[0]?.id;
        steps.push(makeStep('list users', 'twitter_v2_list_users', 'pass', lookupUserId));
      } catch (error) {
        steps.push(makeStep('list users', 'twitter_v2_list_users', 'fail', errorMessage(error)));
      }
    }

    const userId = authUserId ?? lookupUserId;
    if (userId && tools['twitter_v2_get_user']) {
      try {
        await call('twitter_v2_get_user', { id: userId });
        steps.push(makeStep('get user', 'twitter_v2_get_user', 'pass', userId));
      } catch (error) {
        steps.push(makeStep('get user', 'twitter_v2_get_user', 'fail', errorMessage(error)));
      }
    }

    if (userId) {
      steps.push(
        ...(await runReadBatch(
          call,
          [
            ['twitter_v2_list_tweets', { user_id: userId, max_results: 5 }],
            ['twitter_v2_list_mentions', { user_id: userId, max_results: 5 }],
            ['twitter_v2_list_lists', { userId, maxResults: 5 }],
            ['twitter_v2_list_liked_tweets', { userId, maxResults: 5 }],
            ['twitter_v2_list_following', { user_id: userId, max_results: 5 }],
          ],
          tools,
        )),
      );
    }
    steps.push(
      ...(await runReadBatch(
        call,
        [
          ['twitter_v2_list_spaces', { query: 'mastra' }],
          ['twitter_v2_search_tweets', { query: 'mastra', max_results: 10 }],
        ],
        tools,
      )),
    );

    // Tweet lifecycle: create → read → like → bookmark → unbookmark → unlike
    // → delete. Publishing to the connected account's PUBLIC timeline is
    // opt-in: set MASTRA_SMOKE_TWITTER_ALLOW_POST=1 to run the real
    // lifecycle (the tweet is deleted at the end of the run). Without the
    // opt-in, create_tweet is probed with an over-limit payload X rejects,
    // and every tweet-scoped step is probed against a synthetic id.
    const allowPost = process.env.MASTRA_SMOKE_TWITTER_ALLOW_POST === '1';
    let tweetId: string | undefined;
    if (allowPost && tools['twitter_v2_create_tweet']) {
      try {
        const tweet = await call<{ id?: string; data?: { id?: string } }>('twitter_v2_create_tweet', {
          text: `mastra connect smoke ${runId} (auto-deleted)`,
        });
        tweetId = tweet.id ?? tweet.data?.id;
        steps.push(makeStep('create tweet', 'twitter_v2_create_tweet', tweetId ? 'pass' : 'fail', tweetId));
      } catch (error) {
        steps.push(makeStep('create tweet', 'twitter_v2_create_tweet', 'fail', errorMessage(error)));
      }
    } else if (tools['twitter_v2_create_tweet']) {
      steps.push(
        await probeTool(call, tools, 'create tweet (probe)', 'twitter_v2_create_tweet', {
          // > 280 characters — X rejects the payload, nothing is published.
          text: `mastra connect smoke ${runId} `.repeat(20),
        }),
      );
    }

    // Synthetic id used when no real tweet exists (no opt-in or create failed).
    const lifecycleTweetId = tweetId ?? `1${runId.replace(/[^0-9]/g, '')}000000000`.slice(0, 19);

    if (tweetId && tools['twitter_v2_get_tweet']) {
      try {
        await call('twitter_v2_get_tweet', { id: tweetId });
        steps.push(makeStep('get tweet', 'twitter_v2_get_tweet', 'pass'));
      } catch (error) {
        steps.push(makeStep('get tweet', 'twitter_v2_get_tweet', 'fail', errorMessage(error)));
      }
    } else {
      steps.push(await probeTool(call, tools, 'get tweet (probe)', 'twitter_v2_get_tweet', { id: lifecycleTweetId }));
    }

    if (tweetId && tools['twitter_v2_like_tweet']) {
      try {
        await call('twitter_v2_like_tweet', { tweetId });
        steps.push(makeStep('like tweet', 'twitter_v2_like_tweet', 'pass'));
      } catch (error) {
        steps.push(makeStep('like tweet', 'twitter_v2_like_tweet', 'fail', errorMessage(error)));
      }
    } else {
      steps.push(
        await probeTool(call, tools, 'like tweet (probe)', 'twitter_v2_like_tweet', { tweetId: lifecycleTweetId }),
      );
    }

    // create_liked_tweet is the explicit POST /users/:id/likes variant; the
    // user id must match the authenticated user, so it runs for real only
    // when MASTRA_SMOKE_TWITTER_USER_ID is set and is probed otherwise.
    if (tweetId && authUserId && tools['twitter_v2_create_liked_tweet']) {
      try {
        await call('twitter_v2_create_liked_tweet', { userId: authUserId, tweetId });
        steps.push(makeStep('create liked tweet', 'twitter_v2_create_liked_tweet', 'pass'));
      } catch (error) {
        steps.push(makeStep('create liked tweet', 'twitter_v2_create_liked_tweet', 'fail', errorMessage(error)));
      }
    } else {
      steps.push(
        await probeTool(call, tools, 'create liked tweet (probe)', 'twitter_v2_create_liked_tweet', {
          userId: '0',
          tweetId: lifecycleTweetId,
        }),
      );
    }

    if (tweetId && tools['twitter_v2_get_liked_tweet']) {
      try {
        await call('twitter_v2_get_liked_tweet', { tweet_id: tweetId });
        steps.push(makeStep('get liked tweet', 'twitter_v2_get_liked_tweet', 'pass'));
      } catch (error) {
        steps.push(makeStep('get liked tweet', 'twitter_v2_get_liked_tweet', 'fail', errorMessage(error)));
      }
    } else {
      steps.push(
        await probeTool(call, tools, 'get liked tweet (probe)', 'twitter_v2_get_liked_tweet', {
          tweet_id: lifecycleTweetId,
        }),
      );
    }

    if (tweetId && authUserId && tools['twitter_v2_bookmark_tweet']) {
      try {
        await call('twitter_v2_bookmark_tweet', { userId: authUserId, tweetId });
        steps.push(makeStep('bookmark tweet', 'twitter_v2_bookmark_tweet', 'pass'));
      } catch (error) {
        steps.push(makeStep('bookmark tweet', 'twitter_v2_bookmark_tweet', 'fail', errorMessage(error)));
      }
    } else {
      steps.push(
        await probeTool(call, tools, 'bookmark tweet (probe)', 'twitter_v2_bookmark_tweet', {
          userId: '0',
          tweetId: lifecycleTweetId,
        }),
      );
    }

    if (tweetId && tools['twitter_v2_remove_bookmark']) {
      try {
        await call('twitter_v2_remove_bookmark', { tweet_id: tweetId });
        steps.push(makeStep('remove bookmark', 'twitter_v2_remove_bookmark', 'pass'));
      } catch (error) {
        steps.push(makeStep('remove bookmark', 'twitter_v2_remove_bookmark', 'fail', errorMessage(error)));
      }
    } else {
      steps.push(
        await probeTool(call, tools, 'remove bookmark (probe)', 'twitter_v2_remove_bookmark', {
          tweet_id: lifecycleTweetId,
        }),
      );
    }

    if (tweetId && tools['twitter_v2_delete_liked_tweet']) {
      try {
        await call('twitter_v2_delete_liked_tweet', { tweet_id: tweetId });
        steps.push(makeStep('delete liked tweet', 'twitter_v2_delete_liked_tweet', 'pass'));
      } catch (error) {
        steps.push(makeStep('delete liked tweet', 'twitter_v2_delete_liked_tweet', 'fail', errorMessage(error)));
      }
    } else {
      steps.push(
        await probeTool(call, tools, 'delete liked tweet (probe)', 'twitter_v2_delete_liked_tweet', {
          tweet_id: lifecycleTweetId,
        }),
      );
    }

    if (tweetId && tools['twitter_v2_unlike_tweet']) {
      try {
        await call('twitter_v2_unlike_tweet', { tweet_id: tweetId });
        steps.push(makeStep('unlike tweet', 'twitter_v2_unlike_tweet', 'pass'));
      } catch (error) {
        steps.push(makeStep('unlike tweet', 'twitter_v2_unlike_tweet', 'fail', errorMessage(error)));
      }
    } else {
      steps.push(
        await probeTool(call, tools, 'unlike tweet (probe)', 'twitter_v2_unlike_tweet', {
          tweet_id: lifecycleTweetId,
        }),
      );
    }

    if (tweetId && tools['twitter_v2_delete_tweet']) {
      try {
        await call('twitter_v2_delete_tweet', { id: tweetId });
        steps.push(makeStep('delete tweet', 'twitter_v2_delete_tweet', 'pass'));
      } catch (error) {
        log.error(`Failed to delete smoke tweet ${tweetId}`, errorMessage(error));
        steps.push(makeStep('delete tweet', 'twitter_v2_delete_tweet', 'fail', errorMessage(error)));
      }
    } else {
      steps.push(
        await probeTool(call, tools, 'delete tweet (probe)', 'twitter_v2_delete_tweet', { id: lifecycleTweetId }),
      );
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
      await call('twitter_v2_get_list', { id: listId });
      steps.push(makeStep('read list', 'twitter_v2_get_list', 'pass'));
    } catch (error) {
      steps.push(makeStep('read list', 'twitter_v2_get_list', 'fail', errorMessage(error)));
    }

    if (tools['twitter_v2_update_list']) {
      try {
        await call('twitter_v2_update_list', {
          id: listId,
          name: `${runId} smoke list (renamed)`,
        });
        steps.push(makeStep('update list', 'twitter_v2_update_list', 'pass'));
      } catch (error) {
        steps.push(makeStep('update list', 'twitter_v2_update_list', 'fail', errorMessage(error)));
      }
    }

    try {
      await call('twitter_v2_delete_list', { id: listId });
      steps.push(makeStep('delete list', 'twitter_v2_delete_list', 'pass'));
    } catch (error) {
      log.error(`Failed to delete smoke list ${listId}`, errorMessage(error));
      steps.push(makeStep('delete list', 'twitter_v2_delete_list', 'fail', errorMessage(error)));
    }

    return steps;
  },
};
