export const comments = {
  "getGeographiesByGeoIdMediaRecent": {
    "comment": "@deprecated",
    "doc": "@deprecated\n  Get recent media from a custom geo-id.\n  Get recent media from a geography subscription that you created.\n \n  Note: You can only access Geographies that were explicitly created by your OAuth client. Check the\n  Geography Subscriptions section of the [real-time updates page](https://instagram.com/developer/realtime/).\n  When you create a subscription to some geography that you define, you will be returned a unique `geo-id` that\n  can be used in this query. To backfill photos from the location covered by this geography, use the\n  [media search endpoint](https://instagram.com/developer/endpoints/media/).\n \n  Warning: [Deprecated](http://instagram.com/developer/changelog/) for Apps created on or after Nov 17, 2015"
  },
  "getLocationsSearch": {
    "comment": "Search for a location by geographic coordinate.",
    "doc": "Search for a location by geographic coordinate.\n  Search for a location by geographic coordinate."
  },
  "getLocationsByLocationId": {
    "comment": "Get information about a location.",
    "doc": "Get information about a location.\n  Get information about a location."
  },
  "getLocationsByLocationIdMediaRecent": {
    "comment": "Get a list of recent media objects from a given location.",
    "doc": "Get a list of recent media objects from a given location.\n  Get a list of recent media objects from a given location."
  },
  "getMediaPopular": {
    "comment": "@deprecated",
    "doc": "@deprecated\n  Get a list of currently popular media.\n  Get a list of what media is most popular at the moment. Can return mix of `image` and `video` types.\n \n  Warning: [Deprecated](http://instagram.com/developer/changelog/) for Apps created on or after Nov 17, 2015"
  },
  "getMediaSearch": {
    "comment": "Search for media in a given area.",
    "doc": "Search for media in a given area.\n  Search for media in a given area. The default time span is set to 5 days. The time span must not exceed 7 days.\n  Defaults time stamps cover the last 5 days. Can return mix of `image` and `video` types."
  },
  "getMediaShortcodeByShortcode": {
    "comment": "Get information about a media object.",
    "doc": "Get information about a media object.\n  This endpoint returns the same response as `GET /media/{media-id}`.\n \n  A media object's shortcode can be found in its shortlink URL. An example shortlink is\n  `http://instagram.com/p/D/`, its corresponding shortcode is `D`."
  },
  "getMediaByMediaId": {
    "comment": "Get information about a media object.",
    "doc": "Get information about a media object.\n  Get information about a media object. The returned type key will allow you to differentiate between image and\n  video media.\n \n  Note: if you authenticate with an OAuth Token, you will receive the user_has_liked key which quickly tells\n  you whether the current user has liked this media item."
  },
  "getMediaByMediaIdComments": {
    "comment": "Get a list of recent comments on a media object.",
    "doc": "Get a list of recent comments on a media object.\n  Get a list of recent comments on a media object."
  },
  "postMediaByMediaIdComments": {
    "comment": "Create a comment on a media object.",
    "doc": "Create a comment on a media object.\n  Create a comment on a media object with the following rules:\n \n   The total length of the comment cannot exceed 300 characters.\n   The comment cannot contain more than 4 hashtags.\n   The comment cannot contain more than 1 URL.\n   The comment cannot consist of all capital letters."
  },
  "deleteMediaByMediaIdCommentsByCommentId": {
    "comment": "Remove a comment.",
    "doc": "Remove a comment.\n  Remove a comment either on the authenticated user's media object or authored by the authenticated user."
  },
  "deleteMediaByMediaIdLikes": {
    "comment": "Remove a like on this media by the current user.",
    "doc": "Remove a like on this media by the current user.\n  Remove a like on this media by the currently authenticated user."
  },
  "getMediaByMediaIdLikes": {
    "comment": "Get a list of users who have liked this media.",
    "doc": "Get a list of users who have liked this media.\n  Get a list of users who have liked this media."
  },
  "postMediaByMediaIdLikes": {
    "comment": "Set a like on this media by the current user.",
    "doc": "Set a like on this media by the current user.\n  Set a like on this media by the currently authenticated user."
  },
  "getTagsSearch": {
    "comment": "Search for tags by name.",
    "doc": "Search for tags by name.\n  Search for tags by name."
  },
  "getTagsByTagName": {
    "comment": "Get information about a tag object.",
    "doc": "Get information about a tag object.\n  Get information about a tag object."
  },
  "getTagsByTagNameMediaRecent": {
    "comment": "Get a list of recently tagged media.",
    "doc": "Get a list of recently tagged media.\n  Get a list of recently tagged media. Use the `max_tag_id` and `min_tag_id` parameters in the pagination\n  response to paginate through these objects."
  },
  "getUsersSearch": {
    "comment": "Search for a user by name.",
    "doc": "Search for a user by name.\n  Search for a user by name."
  },
  "getUsersSelfFeed": {
    "comment": "@deprecated",
    "doc": "@deprecated\n  See the authenticated user's feed.\n  See the authenticated user's feed.\n \n  Warning: [Deprecated](http://instagram.com/developer/changelog/) for Apps created on or after Nov 17, 2015"
  },
  "getUsersSelfMediaLiked": {
    "comment": "See the list of media liked by the authenticated user.",
    "doc": "See the list of media liked by the authenticated user.\n  See the list of media liked by the authenticated user. Private media is returned as long as the authenticated\n  user has permission to view that media. Liked media lists are only available for the currently authenticated\n  user."
  },
  "getUsersSelfRequestedBy": {
    "comment": "List the users who have requested this user's permission to follow.",
    "doc": "List the users who have requested this user's permission to follow.\n  List the users who have requested this user's permission to follow."
  },
  "getUsersByUserId": {
    "comment": "Get basic information about a user.",
    "doc": "Get basic information about a user.\n  Get basic information about a user. To get information about the owner of the access token, you can use\n  self instead of the `user-id`.\n \n  Security scope `public_content` is required to read information about other users."
  },
  "getUsersByUserIdFollowedBy": {
    "comment": "Get the list of users this user is followed by.",
    "doc": "Get the list of users this user is followed by.\n  Get the list of users this user is followed by. To get users followed by the owner of the access token, you\n  can use self instead of the `user-id`."
  },
  "getUsersByUserIdFollows": {
    "comment": "Get the list of users this user follows.",
    "doc": "Get the list of users this user follows.\n  Get the list of users this user follows. To get follows of the owner of the access token, you can use self\n  instead of the `user-id`."
  },
  "getUsersByUserIdMediaRecent": {
    "comment": "Get the most recent media published by a user.",
    "doc": "Get the most recent media published by a user.\n  Get the most recent media published by a user. To get the most recent media published by the owner of the\n  access token, you can use self instead of the `user-id`.\n \n  Security scope `public_content` is required to read information about other users."
  },
  "getUsersByUserIdRelationship": {
    "comment": "Get information about a relationship to another user.",
    "doc": "Get information about a relationship to another user.\n  Get information about a relationship to another user."
  },
  "postUsersByUserIdRelationship": {
    "comment": "Modify the relationship between the current user and the target user.",
    "doc": "Modify the relationship between the current user and the target user.\n  Modify the relationship between the current user and the target user."
  }
}