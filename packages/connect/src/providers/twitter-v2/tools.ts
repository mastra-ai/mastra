// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createPlatformProxy } from '../../runtime/platform-proxy.js';
import type { ProviderToolsOptions } from '../../toolset.js';
import { applyAllowTools } from '../../toolset.js';
import { bookmarkTweetTool } from './tools/bookmark-tweet.js';
import { createLikedTweetTool } from './tools/create-liked-tweet.js';
import { createListTool } from './tools/create-list.js';
import { createTweetTool } from './tools/create-tweet.js';
import { deleteLikedTweetTool } from './tools/delete-liked-tweet.js';
import { deleteListTool } from './tools/delete-list.js';
import { deleteTweetTool } from './tools/delete-tweet.js';
import { followUserTool } from './tools/follow-user.js';
import { getLikedTweetTool } from './tools/get-liked-tweet.js';
import { getListTool } from './tools/get-list.js';
import { getMentionTool } from './tools/get-mention.js';
import { getSpaceTool } from './tools/get-space.js';
import { getTweetTool } from './tools/get-tweet.js';
import { getUserTool } from './tools/get-user.js';
import { likeTweetTool } from './tools/like-tweet.js';
import { listFollowingTool } from './tools/list-following.js';
import { listLikedTweetsTool } from './tools/list-liked-tweets.js';
import { listListsTool } from './tools/list-lists.js';
import { listMentionsTool } from './tools/list-mentions.js';
import { listSpacesTool } from './tools/list-spaces.js';
import { listTweetsTool } from './tools/list-tweets.js';
import { listUsersTool } from './tools/list-users.js';
import { removeBookmarkTool } from './tools/remove-bookmark.js';
import { searchTweetsTool } from './tools/search-tweets.js';
import { unfollowUserTool } from './tools/unfollow-user.js';
import { unlikeTweetTool } from './tools/unlike-tweet.js';
import { updateListTool } from './tools/update-list.js';

export function createTwitterV2Tools(options?: ProviderToolsOptions) {
  const platformProxy = createPlatformProxy({ connectionId: options?.connectionId, client: options?.client });
  const tools = {
    twitter_v2_bookmark_tweet: bookmarkTweetTool(platformProxy),
    twitter_v2_create_liked_tweet: createLikedTweetTool(platformProxy),
    twitter_v2_create_list: createListTool(platformProxy),
    twitter_v2_create_tweet: createTweetTool(platformProxy),
    twitter_v2_delete_liked_tweet: deleteLikedTweetTool(platformProxy),
    twitter_v2_delete_list: deleteListTool(platformProxy),
    twitter_v2_delete_tweet: deleteTweetTool(platformProxy),
    twitter_v2_follow_user: followUserTool(platformProxy),
    twitter_v2_get_liked_tweet: getLikedTweetTool(platformProxy),
    twitter_v2_get_list: getListTool(platformProxy),
    twitter_v2_get_mention: getMentionTool(platformProxy),
    twitter_v2_get_space: getSpaceTool(platformProxy),
    twitter_v2_get_tweet: getTweetTool(platformProxy),
    twitter_v2_get_user: getUserTool(platformProxy),
    twitter_v2_like_tweet: likeTweetTool(platformProxy),
    twitter_v2_list_following: listFollowingTool(platformProxy),
    twitter_v2_list_liked_tweets: listLikedTweetsTool(platformProxy),
    twitter_v2_list_lists: listListsTool(platformProxy),
    twitter_v2_list_mentions: listMentionsTool(platformProxy),
    twitter_v2_list_spaces: listSpacesTool(platformProxy),
    twitter_v2_list_tweets: listTweetsTool(platformProxy),
    twitter_v2_list_users: listUsersTool(platformProxy),
    twitter_v2_remove_bookmark: removeBookmarkTool(platformProxy),
    twitter_v2_search_tweets: searchTweetsTool(platformProxy),
    twitter_v2_unfollow_user: unfollowUserTool(platformProxy),
    twitter_v2_unlike_tweet: unlikeTweetTool(platformProxy),
    twitter_v2_update_list: updateListTool(platformProxy),
  };
  return applyAllowTools(tools, options?.allowTools);
}
