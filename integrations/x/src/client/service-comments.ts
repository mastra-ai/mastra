export const comments = {
  "listBatchComplianceJobs": {
    "comment": "List Compliance Jobs",
    "doc": "List Compliance Jobs\n  Returns recent Compliance Jobs for a given job type and optional job status"
  },
  "createBatchComplianceJob": {
    "comment": "Create compliance job",
    "doc": "Create compliance job\n  Creates a compliance for the given job type"
  },
  "getBatchComplianceJob": {
    "comment": "Get Compliance Job",
    "doc": "Get Compliance Job\n  Returns a single Compliance Job by ID"
  },
  "dmConversationIdCreate": {
    "comment": "Create a new DM Conversation",
    "doc": "Create a new DM Conversation\n  Creates a new DM Conversation."
  },
  "getDmConversationsWithParticipantIdDmEvents": {
    "comment": "Get DM Events for a DM Conversation",
    "doc": "Get DM Events for a DM Conversation\n  Returns DM Events for a DM Conversation"
  },
  "dmConversationWithUserEventIdCreate": {
    "comment": "Send a new message to a user",
    "doc": "Send a new message to a user\n  Creates a new message for a DM Conversation with a participant user by ID"
  },
  "dmConversationByIdEventIdCreate": {
    "comment": "Send a new message to a DM Conversation",
    "doc": "Send a new message to a DM Conversation\n  Creates a new message for a DM Conversation specified by DM Conversation ID"
  },
  "getDmConversationsIdDmEvents": {
    "comment": "Get DM Events for a DM Conversation",
    "doc": "Get DM Events for a DM Conversation\n  Returns DM Events for a DM Conversation"
  },
  "getDmEvents": {
    "comment": "Get recent DM Events",
    "doc": "Get recent DM Events\n  Returns recent DM Events across DM conversations"
  },
  "listIdCreate": {
    "comment": "Create List",
    "doc": "Create List\n  Creates a new List."
  },
  "listIdDelete": {
    "comment": "Delete List",
    "doc": "Delete List\n  Delete a List that you own."
  },
  "listIdGet": {
    "comment": "List lookup by List ID.",
    "doc": "List lookup by List ID.\n  Returns a List."
  },
  "listIdUpdate": {
    "comment": "Update List.",
    "doc": "Update List.\n  Update a List that you own."
  },
  "listGetFollowers": {
    "comment": "Returns User objects that follow a List by the provided List ID",
    "doc": "Returns User objects that follow a List by the provided List ID\n  Returns a list of Users that follow a List by the provided List ID"
  },
  "listGetMembers": {
    "comment": "Returns User objects that are members of a List by the provided List ID.",
    "doc": "Returns User objects that are members of a List by the provided List ID.\n  Returns a list of Users that are members of a List by the provided List ID."
  },
  "listAddMember": {
    "comment": "Add a List member",
    "doc": "Add a List member\n  Causes a User to become a member of a List."
  },
  "listRemoveMember": {
    "comment": "Remove a List member",
    "doc": "Remove a List member\n  Causes a User to be removed from the members of a List."
  },
  "listsIdTweets": {
    "comment": "List Tweets timeline by List ID.",
    "doc": "List Tweets timeline by List ID.\n  Returns a list of Tweets associated with the provided List ID."
  },
  "getOpenApiSpec": {
    "comment": "Returns the OpenAPI Specification document.",
    "doc": "Returns the OpenAPI Specification document.\n  Full OpenAPI Specification in JSON format. (See https://github.com/OAI/OpenAPI-Specification/blob/master/README.md)"
  },
  "findSpacesByIds": {
    "comment": "Space lookup up Space IDs",
    "doc": "Space lookup up Space IDs\n  Returns a variety of information about the Spaces specified by the requested IDs"
  },
  "findSpacesByCreatorIds": {
    "comment": "Space lookup by their creators",
    "doc": "Space lookup by their creators\n  Returns a variety of information about the Spaces created by the provided User IDs"
  },
  "searchSpaces": {
    "comment": "Search for Spaces",
    "doc": "Search for Spaces\n  Returns Spaces that match the provided query."
  },
  "findSpaceById": {
    "comment": "Space lookup by Space ID",
    "doc": "Space lookup by Space ID\n  Returns a variety of information about the Space specified by the requested ID"
  },
  "spaceBuyers": {
    "comment": "Retrieve the list of Users who purchased a ticket to the given space",
    "doc": "Retrieve the list of Users who purchased a ticket to the given space\n  Retrieves the list of Users who purchased a ticket to the given space"
  },
  "spaceTweets": {
    "comment": "Retrieve Tweets from a Space.",
    "doc": "Retrieve Tweets from a Space.\n  Retrieves Tweets shared in the specified Space."
  },
  "findTweetsById": {
    "comment": "Tweet lookup by Tweet IDs",
    "doc": "Tweet lookup by Tweet IDs\n  Returns a variety of information about the Tweet specified by the requested ID."
  },
  "createTweet": {
    "comment": "Creation of a Tweet",
    "doc": "Creation of a Tweet\n  Causes the User to create a Tweet under the authorized account."
  },
  "getTweetsComplianceStream": {
    "comment": "Tweets Compliance stream",
    "doc": "Tweets Compliance stream\n  Streams 100% of compliance data for Tweets"
  },
  "tweetCountsFullArchiveSearch": {
    "comment": "Full archive search counts",
    "doc": "Full archive search counts\n  Returns Tweet Counts that match a search query."
  },
  "tweetCountsRecentSearch": {
    "comment": "Recent search counts",
    "doc": "Recent search counts\n  Returns Tweet Counts from the last 7 days that match a search query."
  },
  "getTweetsFirehoseStream": {
    "comment": "Firehose stream",
    "doc": "Firehose stream\n  Streams 100% of public Tweets."
  },
  "getTweetsLabelStream": {
    "comment": "Tweets Label stream",
    "doc": "Tweets Label stream\n  Streams 100% of labeling events applied to Tweets"
  },
  "sampleStream": {
    "comment": "Sample stream",
    "doc": "Sample stream\n  Streams a deterministic 1% of public Tweets."
  },
  "getTweetsSample10Stream": {
    "comment": "Sample 10% stream",
    "doc": "Sample 10% stream\n  Streams a deterministic 10% of public Tweets."
  },
  "tweetsFullarchiveSearch": {
    "comment": "Full-archive search",
    "doc": "Full-archive search\n  Returns Tweets that match a search query."
  },
  "tweetsRecentSearch": {
    "comment": "Recent search",
    "doc": "Recent search\n  Returns Tweets from the last 7 days that match a search query."
  },
  "searchStream": {
    "comment": "Filtered stream",
    "doc": "Filtered stream\n  Streams Tweets matching the stream's active rule set."
  },
  "getRules": {
    "comment": "Rules lookup",
    "doc": "Rules lookup\n  Returns rules from a User's active rule set. Users can fetch all of their rules or a subset, specified by the provided rule ids."
  },
  "addOrDeleteRules": {
    "comment": "Add/Delete rules",
    "doc": "Add/Delete rules\n  Add or delete rules from a User's active rule set. Users can provide unique, optionally tagged rules to add. Users can delete their entire rule set or a subset specified by rule ids or values."
  },
  "deleteTweetById": {
    "comment": "Tweet delete by Tweet ID",
    "doc": "Tweet delete by Tweet ID\n  Delete specified Tweet (in the path) by ID."
  },
  "findTweetById": {
    "comment": "Tweet lookup by Tweet ID",
    "doc": "Tweet lookup by Tweet ID\n  Returns a variety of information about the Tweet specified by the requested ID."
  },
  "tweetsIdLikingUsers": {
    "comment": "Returns User objects that have liked the provided Tweet ID",
    "doc": "Returns User objects that have liked the provided Tweet ID\n  Returns a list of Users that have liked the provided Tweet ID"
  },
  "findTweetsThatQuoteAtweet": {
    "comment": "Retrieve Tweets that quote a Tweet.",
    "doc": "Retrieve Tweets that quote a Tweet.\n  Returns a variety of information about each Tweet that quotes the Tweet specified by the requested ID."
  },
  "tweetsIdRetweetingUsers": {
    "comment": "Returns User objects that have retweeted the provided Tweet ID",
    "doc": "Returns User objects that have retweeted the provided Tweet ID\n  Returns a list of Users that have retweeted the provided Tweet ID"
  },
  "hideReplyById": {
    "comment": "Hide replies",
    "doc": "Hide replies\n  Hides or unhides a reply to an owned conversation."
  },
  "findUsersById": {
    "comment": "User lookup by IDs",
    "doc": "User lookup by IDs\n  This endpoint returns information about Users. Specify Users by their ID."
  },
  "findUsersByUsername": {
    "comment": "User lookup by usernames",
    "doc": "User lookup by usernames\n  This endpoint returns information about Users. Specify Users by their username."
  },
  "findUserByUsername": {
    "comment": "User lookup by username",
    "doc": "User lookup by username\n  This endpoint returns information about a User. Specify User by username."
  },
  "getUsersComplianceStream": {
    "comment": "Users Compliance stream",
    "doc": "Users Compliance stream\n  Streams 100% of compliance data for Users"
  },
  "findMyUser": {
    "comment": "User lookup me",
    "doc": "User lookup me\n  This endpoint returns information about the requesting User."
  },
  "findUserById": {
    "comment": "User lookup by ID",
    "doc": "User lookup by ID\n  This endpoint returns information about a User. Specify User by ID."
  },
  "usersIdBlocking": {
    "comment": "Returns User objects that are blocked by provided User ID",
    "doc": "Returns User objects that are blocked by provided User ID\n  Returns a list of Users that are blocked by the provided User ID"
  },
  "usersIdBlock": {
    "comment": "Block User by User ID",
    "doc": "Block User by User ID\n  Causes the User (in the path) to block the target User. The User (in the path) must match the User context authorizing the request"
  },
  "getUsersIdBookmarks": {
    "comment": "Bookmarks by User",
    "doc": "Bookmarks by User\n  Returns Tweet objects that have been bookmarked by the requesting User"
  },
  "postUsersIdBookmarks": {
    "comment": "Add Tweet to Bookmarks",
    "doc": "Add Tweet to Bookmarks\n  Adds a Tweet (ID in the body) to the requesting User's (in the path) bookmarks"
  },
  "usersIdBookmarksDelete": {
    "comment": "Remove a bookmarked Tweet",
    "doc": "Remove a bookmarked Tweet\n  Removes a Tweet from the requesting User's bookmarked Tweets."
  },
  "userFollowedLists": {
    "comment": "Get User's Followed Lists",
    "doc": "Get User's Followed Lists\n  Returns a User's followed Lists."
  },
  "listUserFollow": {
    "comment": "Follow a List",
    "doc": "Follow a List\n  Causes a User to follow a List."
  },
  "listUserUnfollow": {
    "comment": "Unfollow a List",
    "doc": "Unfollow a List\n  Causes a User to unfollow a List."
  },
  "usersIdFollowers": {
    "comment": "Followers by User ID",
    "doc": "Followers by User ID\n  Returns a list of Users who are followers of the specified User ID."
  },
  "usersIdFollowing": {
    "comment": "Following by User ID",
    "doc": "Following by User ID\n  Returns a list of Users that are being followed by the provided User ID"
  },
  "usersIdFollow": {
    "comment": "Follow User",
    "doc": "Follow User\n  Causes the User(in the path) to follow, or “request to follow” for protected Users, the target User. The User(in the path) must match the User context authorizing the request"
  },
  "usersIdLikedTweets": {
    "comment": "Returns Tweet objects liked by the provided User ID",
    "doc": "Returns Tweet objects liked by the provided User ID\n  Returns a list of Tweets liked by the provided User ID"
  },
  "usersIdLike": {
    "comment": "Causes the User (in the path) to like the specified Tweet",
    "doc": "Causes the User (in the path) to like the specified Tweet\n  Causes the User (in the path) to like the specified Tweet. The User in the path must match the User context authorizing the request."
  },
  "usersIdUnlike": {
    "comment": "Causes the User (in the path) to unlike the specified Tweet",
    "doc": "Causes the User (in the path) to unlike the specified Tweet\n  Causes the User (in the path) to unlike the specified Tweet. The User must match the User context authorizing the request"
  },
  "getUserListMemberships": {
    "comment": "Get a User's List Memberships",
    "doc": "Get a User's List Memberships\n  Get a User's List Memberships."
  },
  "usersIdMentions": {
    "comment": "User mention timeline by User ID",
    "doc": "User mention timeline by User ID\n  Returns Tweet objects that mention username associated to the provided User ID"
  },
  "usersIdMuting": {
    "comment": "Returns User objects that are muted by the provided User ID",
    "doc": "Returns User objects that are muted by the provided User ID\n  Returns a list of Users that are muted by the provided User ID"
  },
  "usersIdMute": {
    "comment": "Mute User by User ID.",
    "doc": "Mute User by User ID.\n  Causes the User (in the path) to mute the target User. The User (in the path) must match the User context authorizing the request."
  },
  "listUserOwnedLists": {
    "comment": "Get a User's Owned Lists.",
    "doc": "Get a User's Owned Lists.\n  Get a User's Owned Lists."
  },
  "listUserPinnedLists": {
    "comment": "Get a User's Pinned Lists",
    "doc": "Get a User's Pinned Lists\n  Get a User's Pinned Lists."
  },
  "listUserPin": {
    "comment": "Pin a List",
    "doc": "Pin a List\n  Causes a User to pin a List."
  },
  "listUserUnpin": {
    "comment": "Unpin a List",
    "doc": "Unpin a List\n  Causes a User to remove a pinned List."
  },
  "usersIdRetweets": {
    "comment": "Causes the User (in the path) to retweet the specified Tweet.",
    "doc": "Causes the User (in the path) to retweet the specified Tweet.\n  Causes the User (in the path) to retweet the specified Tweet. The User in the path must match the User context authorizing the request."
  },
  "usersIdUnretweets": {
    "comment": "Causes the User (in the path) to unretweet the specified Tweet",
    "doc": "Causes the User (in the path) to unretweet the specified Tweet\n  Causes the User (in the path) to unretweet the specified Tweet. The User must match the User context authorizing the request"
  },
  "usersIdTimeline": {
    "comment": "User home timeline by User ID",
    "doc": "User home timeline by User ID\n  Returns Tweet objects that appears in the provided User ID's home timeline"
  },
  "usersIdTweets": {
    "comment": "User Tweets timeline by User ID",
    "doc": "User Tweets timeline by User ID\n  Returns a list of Tweets authored by the provided User ID"
  },
  "usersIdUnblock": {
    "comment": "Unblock User by User ID",
    "doc": "Unblock User by User ID\n  Causes the source User to unblock the target User. The source User must match the User context authorizing the request"
  },
  "usersIdUnfollow": {
    "comment": "Unfollow User",
    "doc": "Unfollow User\n  Causes the source User to unfollow the target User. The source User must match the User context authorizing the request"
  },
  "usersIdUnmute": {
    "comment": "Unmute User by User ID",
    "doc": "Unmute User by User ID\n  Causes the source User to unmute the target User. The source User must match the User context authorizing the request"
  }
}