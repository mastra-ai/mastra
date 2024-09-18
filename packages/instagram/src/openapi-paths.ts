// @ts-nocheck
export type TPaths = {
  '/geographies/{geo-id}/media/recent': {
    get: {
      deprecated: true;
      description: 'Get recent media from a geography subscription that you created.\n\n**Note:** You can only access Geographies that were explicitly created by your OAuth client. Check the\nGeography Subscriptions section of the [real-time updates page](https://instagram.com/developer/realtime/).\nWhen you create a subscription to some geography that you define, you will be returned a unique `geo-id` that\ncan be used in this query. To backfill photos from the location covered by this geography, use the\n[media search endpoint](https://instagram.com/developer/endpoints/media/).\n\n**Warning:** [Deprecated](http://instagram.com/developer/changelog/) for Apps created **on or after** Nov 17, 2015\n';
      parameters: [
        {
          description: 'The geography ID.';
          in: 'path';
          name: 'geo-id';
          required: true;
          type: 'string';
        },
        {
          description: 'Max number of media to return.';
          format: 'int32';
          in: 'query';
          name: 'count';
          required: false;
          type: 'integer';
        },
        {
          description: 'Return media before this `min_id`.';
          in: 'query';
          name: 'min_id';
          required: false;
          type: 'string';
        },
      ];
      responses: {
        '200': {
          description: 'List of recent media entries from a geography subscription.';
          schema: {
            $ref: '#/definitions/MediaListResponse';
          };
        };
      };
      security: [
        {
          api_key: [];
        },
        {
          instagram_auth: ['basic'];
        },
      ];
      summary: 'Get recent media from a custom geo-id.';
      tags: ['geographies'];
    };
  };
  '/locations/search': {
    get: {
      description: 'Search for a location by geographic coordinate.';
      parameters: [
        {
          description: 'Default is 1000m (distance=1000), max distance is 5000.';
          format: 'int32';
          in: 'query';
          name: 'distance';
          required: false;
          type: 'integer';
        },
        {
          description: 'Returns a location mapped off of a Facebook places id. If used, a Foursquare id and `lat`, `lng` are not required.';
          in: 'query';
          name: 'facebook_places_id';
          required: false;
          type: 'string';
        },
        {
          description: 'Returns a location mapped off of a foursquare v1 api location id. If used, you are not required to use\n`lat` and `lng`. Note that this method is deprecated; you should use the new foursquare IDs with V2 of their API.\n';
          in: 'query';
          name: 'foursquare_id';
          required: false;
          type: 'string';
        },
        {
          description: 'Latitude of the center search coordinate. If used, `lng` is required.';
          format: 'double';
          in: 'query';
          name: 'lat';
          required: false;
          type: 'number';
        },
        {
          description: 'Longitude of the center search coordinate. If used, `lat` is required.';
          format: 'double';
          in: 'query';
          name: 'lng';
          required: false;
          type: 'number';
        },
        {
          description: 'Returns a location mapped off of a foursquare v2 api location id. If used, you are not required to use\n`lat` and `lng`.\n';
          in: 'query';
          name: 'foursquare_v2_id';
          required: false;
          type: 'string';
        },
      ];
      responses: {
        '200': {
          description: 'List of found locations.';
          schema: {
            $ref: '#/definitions/LocationSearchResponse';
          };
        };
      };
      security: [
        {
          api_key: [];
        },
        {
          instagram_auth: ['public_content'];
        },
      ];
      summary: 'Search for a location by geographic coordinate.';
      tags: ['locations'];
    };
  };
  '/locations/{location-id}': {
    get: {
      description: 'Get information about a location.';
      parameters: [
        {
          description: 'The location ID.';
          in: 'path';
          name: 'location-id';
          required: true;
          type: 'string';
        },
      ];
      responses: {
        '200': {
          description: 'Location information response.';
          schema: {
            $ref: '#/definitions/LocationInfoResponse';
          };
        };
      };
      security: [
        {
          api_key: [];
        },
        {
          instagram_auth: ['public_content'];
        },
      ];
      summary: 'Get information about a location.';
      tags: ['locations'];
    };
  };
  '/locations/{location-id}/media/recent': {
    get: {
      description: 'Get a list of recent media objects from a given location.';
      parameters: [
        {
          description: 'The location ID.';
          in: 'path';
          name: 'location-id';
          required: true;
          type: 'string';
        },
        {
          description: 'Return media after this UNIX timestamp.';
          format: 'int64';
          in: 'query';
          name: 'min_timestamp';
          required: false;
          type: 'integer';
        },
        {
          description: 'Return media before this UNIX timestamp.';
          format: 'int64';
          in: 'query';
          name: 'max_timestamp';
          required: false;
          type: 'integer';
        },
        {
          description: 'Return media before this `min_id`.';
          in: 'query';
          name: 'min_id';
          required: false;
          type: 'string';
        },
        {
          description: 'Return media after this `max_id`.';
          in: 'query';
          name: 'max_id';
          required: false;
          type: 'string';
        },
      ];
      responses: {
        '200': {
          description: 'List of media entries from this location.';
          schema: {
            $ref: '#/definitions/MediaListResponse';
          };
        };
      };
      security: [
        {
          api_key: [];
        },
        {
          instagram_auth: ['public_content'];
        },
      ];
      summary: 'Get a list of recent media objects from a given location.';
      tags: ['locations'];
    };
  };
  '/media/popular': {
    get: {
      deprecated: true;
      description: 'Get a list of what media is most popular at the moment. Can return mix of `image` and `video` types.\n\n**Warning:** [Deprecated](http://instagram.com/developer/changelog/) for Apps created **on or after** Nov 17, 2015\n';
      responses: {
        '200': {
          description: 'Found media resources (without likes information).';
          schema: {
            $ref: '#/definitions/MediaSearchResponse';
          };
        };
      };
      security: [
        {
          api_key: [];
        },
        {
          instagram_auth: ['basic'];
        },
      ];
      summary: 'Get a list of currently popular media.';
      tags: ['media'];
    };
  };
  '/media/search': {
    get: {
      description: 'Search for media in a given area. The default time span is set to 5 days. The time span must not exceed 7 days.\nDefaults time stamps cover the last 5 days. Can return mix of `image` and `video` types.\n';
      parameters: [
        {
          description: 'Latitude of the center search coordinate. If used, `lng` is required.';
          format: 'double';
          in: 'query';
          name: 'lat';
          required: true;
          type: 'number';
        },
        {
          description: 'Longitude of the center search coordinate. If used, `lat` is required.';
          format: 'double';
          in: 'query';
          name: 'lng';
          required: true;
          type: 'number';
        },
        {
          description: 'A unix timestamp. All media returned will be taken later than this timestamp.';
          format: 'int64';
          in: 'query';
          name: 'min_timestamp';
          required: false;
          type: 'integer';
        },
        {
          description: 'A unix timestamp. All media returned will be taken earlier than this timestamp.';
          format: 'int64';
          in: 'query';
          name: 'max_timestamp';
          required: false;
          type: 'integer';
        },
        {
          description: 'Default is 1km (distance=1000), max distance is 5km.';
          format: 'int32';
          in: 'query';
          name: 'distance';
          required: false;
          type: 'integer';
        },
      ];
      responses: {
        '200': {
          description: 'Found media resources (without likes information) in a given area.';
          schema: {
            $ref: '#/definitions/MediaSearchResponse';
          };
        };
      };
      security: [
        {
          api_key: [];
        },
        {
          instagram_auth: ['public_content'];
        },
      ];
      summary: 'Search for media in a given area.';
      tags: ['media'];
    };
  };
  '/media/shortcode/{shortcode}': {
    get: {
      description: "This endpoint returns the same response as `GET /media/{media-id}`.\n\nA media object's shortcode can be found in its shortlink URL. An example shortlink is\n`http://instagram.com/p/D/`, its corresponding shortcode is `D`.\n";
      parameters: [
        {
          description: 'The short code of the media resource.';
          in: 'path';
          name: 'shortcode';
          required: true;
          type: 'string';
        },
      ];
      responses: {
        '200': {
          description: 'Media resource information.';
          schema: {
            $ref: '#/definitions/MediaEntryResponse';
          };
        };
      };
      security: [
        {
          api_key: [];
        },
        {
          instagram_auth: ['basic', 'public_content'];
        },
      ];
      summary: 'Get information about a media object.';
      tags: ['media'];
    };
  };
  '/media/{media-id}': {
    get: {
      description: 'Get information about a media object. The returned type key will allow you to differentiate between image and\nvideo media.\n\n**Note:** if you authenticate with an OAuth Token, you will receive the user_has_liked key which quickly tells\nyou whether the current user has liked this media item.\n';
      parameters: [
        {
          description: 'The ID of the media resource.';
          in: 'path';
          name: 'media-id';
          required: true;
          type: 'string';
        },
      ];
      responses: {
        '200': {
          description: 'Media resource information.';
          schema: {
            $ref: '#/definitions/MediaEntryResponse';
          };
        };
      };
      security: [
        {
          api_key: [];
        },
        {
          instagram_auth: ['basic', 'public_content'];
        },
      ];
      summary: 'Get information about a media object.';
      tags: ['media'];
    };
  };
  '/media/{media-id}/comments': {
    get: {
      description: 'Get a list of recent comments on a media object.';
      parameters: [
        {
          description: 'The ID of the media resource.';
          in: 'path';
          name: 'media-id';
          required: true;
          type: 'string';
        },
      ];
      responses: {
        '200': {
          description: 'List of comments of the media resource.';
          schema: {
            $ref: '#/definitions/CommentsResponse';
          };
        };
      };
      security: [
        {
          api_key: [];
        },
        {
          instagram_auth: ['basic', 'public_content'];
        },
      ];
      summary: 'Get a list of recent comments on a media object.';
      tags: ['comments'];
    };
    post: {
      description: 'Create a comment on a media object with the following rules:\n\n  * The total length of the comment cannot exceed 300 characters.\n  * The comment cannot contain more than 4 hashtags.\n  * The comment cannot contain more than 1 URL.\n  * The comment cannot consist of all capital letters.\n';
      parameters: [
        {
          description: 'The ID of the media resource.';
          in: 'path';
          name: 'media-id';
          required: true;
          type: 'string';
        },
        {
          description: 'Text to post as a comment on the media object as specified in `media-id`.';
          in: 'query';
          name: 'text';
          required: true;
          type: 'string';
        },
      ];
      responses: {
        '200': {
          description: 'Result of posting a comment.';
          schema: {
            $ref: '#/definitions/StatusResponse';
          };
        };
      };
      security: [
        {
          api_key: [];
        },
        {
          instagram_auth: ['comments'];
        },
      ];
      summary: 'Create a comment on a media object.';
      tags: ['comments'];
    };
  };
  '/media/{media-id}/comments/{comment-id}': {
    delete: {
      description: "Remove a comment either on the authenticated user's media object or authored by the authenticated user.\n";
      parameters: [
        {
          description: 'The ID of the media resource.';
          in: 'path';
          name: 'media-id';
          required: true;
          type: 'string';
        },
        {
          description: 'The ID of the comment entry.';
          in: 'path';
          name: 'comment-id';
          required: true;
          type: 'string';
        },
      ];
      responses: {
        '200': {
          description: 'Result of deleting a comment.';
          schema: {
            $ref: '#/definitions/StatusResponse';
          };
        };
      };
      security: [
        {
          api_key: [];
        },
        {
          instagram_auth: ['comments'];
        },
      ];
      summary: 'Remove a comment.';
      tags: ['comments'];
    };
  };
  '/media/{media-id}/likes': {
    delete: {
      description: 'Remove a like on this media by the currently authenticated user.';
      parameters: [
        {
          description: 'The ID of the media resource.';
          in: 'path';
          name: 'media-id';
          required: true;
          type: 'string';
        },
      ];
      responses: {
        '200': {
          description: 'Result of removing a like.';
          schema: {
            $ref: '#/definitions/StatusResponse';
          };
        };
      };
      security: [
        {
          api_key: [];
        },
        {
          instagram_auth: ['likes'];
        },
      ];
      summary: 'Remove a like on this media by the current user.';
      tags: ['likes'];
    };
    get: {
      description: 'Get a list of users who have liked this media.';
      parameters: [
        {
          description: 'The ID of the media resource.';
          in: 'path';
          name: 'media-id';
          required: true;
          type: 'string';
        },
      ];
      responses: {
        '200': {
          description: 'List of users who liked the media resource.';
          schema: {
            $ref: '#/definitions/UsersInfoResponse';
          };
        };
      };
      security: [
        {
          api_key: [];
        },
        {
          instagram_auth: ['basic', 'public_content'];
        },
      ];
      summary: 'Get a list of users who have liked this media.';
      tags: ['likes'];
    };
    post: {
      description: 'Set a like on this media by the currently authenticated user.';
      parameters: [
        {
          description: 'The ID of the media resource.';
          in: 'path';
          name: 'media-id';
          required: true;
          type: 'string';
        },
      ];
      responses: {
        '200': {
          description: 'Result of setting a like.';
          schema: {
            $ref: '#/definitions/StatusResponse';
          };
        };
      };
      security: [
        {
          api_key: [];
        },
        {
          instagram_auth: ['likes'];
        },
      ];
      summary: 'Set a like on this media by the current user.';
      tags: ['likes'];
    };
  };
  '/tags/search': {
    get: {
      description: 'Search for tags by name.';
      parameters: [
        {
          description: 'A valid tag name without a leading \\#. (eg. snowy, nofilter)';
          in: 'query';
          name: 'q';
          required: true;
          type: 'string';
        },
      ];
      responses: {
        '200': {
          description: 'List of found tags and their statistics.';
          schema: {
            $ref: '#/definitions/TagSearchResponse';
          };
        };
      };
      security: [
        {
          api_key: [];
        },
        {
          instagram_auth: ['public_content'];
        },
      ];
      summary: 'Search for tags by name.';
      tags: ['tags'];
    };
  };
  '/tags/{tag-name}': {
    get: {
      description: 'Get information about a tag object.';
      parameters: [
        {
          description: 'The tag name.';
          in: 'path';
          name: 'tag-name';
          required: true;
          type: 'string';
        },
      ];
      responses: {
        '200': {
          description: 'Tag information response.';
          schema: {
            $ref: '#/definitions/TagInfoResponse';
          };
        };
      };
      security: [
        {
          api_key: [];
        },
        {
          instagram_auth: ['public_content'];
        },
      ];
      summary: 'Get information about a tag object.';
      tags: ['tags'];
    };
  };
  '/tags/{tag-name}/media/recent': {
    get: {
      description: 'Get a list of recently tagged media. Use the `max_tag_id` and `min_tag_id` parameters in the pagination\nresponse to paginate through these objects.\n';
      parameters: [
        {
          description: 'The tag name.';
          in: 'path';
          name: 'tag-name';
          required: true;
          type: 'string';
        },
        {
          description: 'Count of tagged media to return.';
          in: 'query';
          name: 'count';
          required: false;
          type: 'integer';
        },
        {
          description: 'Return media before this `min_tag_id`.';
          in: 'query';
          name: 'min_tag_id';
          required: false;
          type: 'string';
        },
        {
          description: 'Return media after this `max_tag_id`.';
          in: 'query';
          name: 'max_tag_id';
          required: false;
          type: 'string';
        },
      ];
      responses: {
        '200': {
          description: 'List of media entries with this tag.';
          schema: {
            $ref: '#/definitions/TagMediaListResponse';
          };
        };
      };
      security: [
        {
          api_key: [];
        },
        {
          instagram_auth: ['public_content'];
        },
      ];
      summary: 'Get a list of recently tagged media.';
      tags: ['tags'];
    };
  };
  '/users/search': {
    get: {
      description: 'Search for a user by name.';
      parameters: [
        {
          description: 'A query string.';
          in: 'query';
          name: 'q';
          required: true;
          type: 'string';
        },
        {
          description: 'Number of users to return.';
          in: 'query';
          name: 'count';
          required: false;
          type: 'integer';
        },
      ];
      responses: {
        '200': {
          description: 'List of found users.';
          schema: {
            $ref: '#/definitions/UsersInfoResponse';
          };
        };
      };
      security: [
        {
          api_key: [];
        },
        {
          instagram_auth: ['basic'];
        },
      ];
      summary: 'Search for a user by name.';
      tags: ['users'];
    };
  };
  '/users/self/feed': {
    get: {
      deprecated: true;
      description: "See the authenticated user's feed.\n\n**Warning:** [Deprecated](http://instagram.com/developer/changelog/) for Apps created **on or after** Nov 17, 2015\n";
      parameters: [
        {
          description: 'Count of media to return.';
          in: 'query';
          name: 'count';
          required: false;
          type: 'integer';
        },
        {
          description: 'Return media later than this `min_id`.';
          in: 'query';
          name: 'min_id';
          required: false;
          type: 'string';
        },
        {
          description: 'Return media earlier than this `max_id`.';
          in: 'query';
          name: 'max_id';
          required: false;
          type: 'string';
        },
      ];
      responses: {
        '200': {
          description: 'Users feed entries.';
          schema: {
            $ref: '#/definitions/MediaListResponse';
          };
        };
      };
      security: [
        {
          api_key: [];
        },
        {
          instagram_auth: ['basic'];
        },
      ];
      summary: "See the authenticated user's feed.";
      tags: ['users'];
    };
  };
  '/users/self/media/liked': {
    get: {
      description: 'See the list of media liked by the authenticated user. Private media is returned as long as the authenticated\nuser has permission to view that media. Liked media lists are only available for the currently authenticated\nuser.\n';
      parameters: [
        {
          description: 'Count of media to return.';
          in: 'query';
          name: 'count';
          required: false;
          type: 'integer';
        },
        {
          description: 'Return media liked before this id.';
          in: 'query';
          name: 'max_like_id';
          required: false;
          type: 'string';
        },
      ];
      responses: {
        '200': {
          description: 'Users media entries.';
          schema: {
            $ref: '#/definitions/MediaListResponse';
          };
        };
      };
      security: [
        {
          api_key: [];
        },
        {
          instagram_auth: ['basic'];
        },
      ];
      summary: 'See the list of media liked by the authenticated user.';
      tags: ['users'];
    };
  };
  '/users/self/requested-by': {
    get: {
      description: "List the users who have requested this user's permission to follow.";
      responses: {
        '200': {
          description: "List of users who have requested this user's permission to follow.";
          schema: {
            $ref: '#/definitions/UsersInfoResponse';
          };
        };
      };
      security: [
        {
          api_key: [];
        },
        {
          instagram_auth: ['follower_list'];
        },
      ];
      summary: "List the users who have requested this user's permission to follow.";
      tags: ['relationships'];
    };
  };
  '/users/{user-id}': {
    get: {
      description: 'Get basic information about a user. To get information about the owner of the access token, you can use\n**self** instead of the `user-id`.\n\nSecurity scope `public_content` is required to read information about other users.\n';
      parameters: [
        {
          description: 'The ID of a user to get information about, or **self** to retrieve information about authenticated user.';
          in: 'path';
          name: 'user-id';
          required: true;
          type: 'string';
        },
      ];
      responses: {
        '200': {
          description: 'User basic information.';
          schema: {
            $ref: '#/definitions/UserResponse';
          };
        };
        '404': {
          description: 'Not Found, user with such ID does not exist.';
        };
      };
      security: [
        {
          api_key: [];
        },
        {
          instagram_auth: ['basic', 'public_content'];
        },
      ];
      summary: 'Get basic information about a user.';
      tags: ['users'];
    };
  };
  '/users/{user-id}/followed-by': {
    get: {
      description: 'Get the list of users this user is followed by. To get users followed by the owner of the access token, you\ncan use **self** instead of the `user-id`.\n';
      parameters: [
        {
          description: 'The ID of a user, or **self** to retrieve information about authenticated user.';
          in: 'path';
          name: 'user-id';
          required: true;
          type: 'string';
        },
      ];
      responses: {
        '200': {
          description: 'List of users this user is followed by.';
          schema: {
            $ref: '#/definitions/UsersPagingResponse';
          };
        };
      };
      security: [
        {
          api_key: [];
        },
        {
          instagram_auth: ['follower_list'];
        },
      ];
      summary: 'Get the list of users this user is followed by.';
      tags: ['relationships'];
    };
  };
  '/users/{user-id}/follows': {
    get: {
      description: 'Get the list of users this user follows. To get follows of the owner of the access token, you can use **self**\ninstead of the `user-id`.\n';
      parameters: [
        {
          description: 'The ID of a user, or **self** to retrieve information about authenticated user.';
          in: 'path';
          name: 'user-id';
          required: true;
          type: 'string';
        },
      ];
      responses: {
        '200': {
          description: 'List of users this user follows.';
          schema: {
            $ref: '#/definitions/UsersPagingResponse';
          };
        };
      };
      security: [
        {
          api_key: [];
        },
        {
          instagram_auth: ['follower_list'];
        },
      ];
      summary: 'Get the list of users this user follows.';
      tags: ['relationships'];
    };
  };
  '/users/{user-id}/media/recent': {
    get: {
      description: 'Get the most recent media published by a user. To get the most recent media published by the owner of the\naccess token, you can use **self** instead of the `user-id`.\n\nSecurity scope `public_content` is required to read information about other users.\n';
      parameters: [
        {
          description: 'The ID of a user to get recent media of, or **self** to retrieve media of authenticated user.';
          in: 'path';
          name: 'user-id';
          required: true;
          type: 'string';
        },
        {
          description: 'Count of media to return.';
          in: 'query';
          name: 'count';
          required: false;
          type: 'integer';
        },
        {
          description: 'Return media before this UNIX timestamp.';
          format: 'int64';
          in: 'query';
          name: 'max_timestamp';
          required: false;
          type: 'integer';
        },
        {
          description: 'Return media after this UNIX timestamp.';
          format: 'int64';
          in: 'query';
          name: 'min_timestamp';
          required: false;
          type: 'integer';
        },
        {
          description: 'Return media later than this `min_id`.';
          in: 'query';
          name: 'min_id';
          required: false;
          type: 'string';
        },
        {
          description: 'Return media earlier than this `max_id`.';
          in: 'query';
          name: 'max_id';
          required: false;
          type: 'string';
        },
      ];
      responses: {
        '200': {
          description: 'Users media entries.';
          schema: {
            $ref: '#/definitions/MediaListResponse';
          };
        };
      };
      security: [
        {
          api_key: [];
        },
        {
          instagram_auth: ['basic', 'public_content'];
        },
      ];
      summary: 'Get the most recent media published by a user.';
      tags: ['users'];
    };
  };
  '/users/{user-id}/relationship': {
    get: {
      description: 'Get information about a relationship to another user.';
      parameters: [
        {
          description: 'The ID of a user to get information about.';
          in: 'path';
          name: 'user-id';
          required: true;
          type: 'string';
        },
      ];
      responses: {
        '200': {
          description: 'Relationship information.';
          schema: {
            $ref: '#/definitions/RelationshipResponse';
          };
        };
      };
      security: [
        {
          api_key: [];
        },
        {
          instagram_auth: ['follower_list'];
        },
      ];
      summary: 'Get information about a relationship to another user.';
      tags: ['relationships'];
    };
    post: {
      description: 'Modify the relationship between the current user and the target user.';
      parameters: [
        {
          description: 'The ID of the target user.';
          in: 'path';
          name: 'user-id';
          required: true;
          type: 'string';
        },
        {
          description: 'Type of action to apply for relationship with the user.';
          enum: ['follow', 'unfollow', 'block', 'unblock', 'approve', 'ignore'];
          in: 'query';
          name: 'action';
          required: true;
          type: 'string';
        },
      ];
      responses: {
        '200': {
          description: 'Relationship information.';
          schema: {
            $ref: '#/definitions/RelationshipPostResponse';
          };
        };
      };
      security: [
        {
          api_key: [];
        },
        {
          instagram_auth: ['relationships'];
        },
      ];
      summary: 'Modify the relationship between the current user and the target user.';
      tags: ['relationships'];
    };
  };
};
export const paths = {
  '/geographies/{geo-id}/media/recent': {
    get: {
      deprecated: true,
      description:
        'Get recent media from a geography subscription that you created.\n\n**Note:** You can only access Geographies that were explicitly created by your OAuth client. Check the\nGeography Subscriptions section of the [real-time updates page](https://instagram.com/developer/realtime/).\nWhen you create a subscription to some geography that you define, you will be returned a unique `geo-id` that\ncan be used in this query. To backfill photos from the location covered by this geography, use the\n[media search endpoint](https://instagram.com/developer/endpoints/media/).\n\n**Warning:** [Deprecated](http://instagram.com/developer/changelog/) for Apps created **on or after** Nov 17, 2015\n',
      parameters: [
        {
          description: 'The geography ID.',
          in: 'path',
          name: 'geo-id',
          required: true,
          type: 'string',
        },
        {
          description: 'Max number of media to return.',
          format: 'int32',
          in: 'query',
          name: 'count',
          required: false,
          type: 'integer',
        },
        {
          description: 'Return media before this `min_id`.',
          in: 'query',
          name: 'min_id',
          required: false,
          type: 'string',
        },
      ],
      responses: {
        '200': {
          description: 'List of recent media entries from a geography subscription.',
          schema: {
            $ref: '#/definitions/MediaListResponse',
          },
        },
      },
      security: [
        {
          api_key: [],
        },
        {
          instagram_auth: ['basic'],
        },
      ],
      summary: 'Get recent media from a custom geo-id.',
      tags: ['geographies'],
    },
  },
  '/locations/search': {
    get: {
      description: 'Search for a location by geographic coordinate.',
      parameters: [
        {
          description: 'Default is 1000m (distance=1000), max distance is 5000.',
          format: 'int32',
          in: 'query',
          name: 'distance',
          required: false,
          type: 'integer',
        },
        {
          description:
            'Returns a location mapped off of a Facebook places id. If used, a Foursquare id and `lat`, `lng` are not required.',
          in: 'query',
          name: 'facebook_places_id',
          required: false,
          type: 'string',
        },
        {
          description:
            'Returns a location mapped off of a foursquare v1 api location id. If used, you are not required to use\n`lat` and `lng`. Note that this method is deprecated; you should use the new foursquare IDs with V2 of their API.\n',
          in: 'query',
          name: 'foursquare_id',
          required: false,
          type: 'string',
        },
        {
          description: 'Latitude of the center search coordinate. If used, `lng` is required.',
          format: 'double',
          in: 'query',
          name: 'lat',
          required: false,
          type: 'number',
        },
        {
          description: 'Longitude of the center search coordinate. If used, `lat` is required.',
          format: 'double',
          in: 'query',
          name: 'lng',
          required: false,
          type: 'number',
        },
        {
          description:
            'Returns a location mapped off of a foursquare v2 api location id. If used, you are not required to use\n`lat` and `lng`.\n',
          in: 'query',
          name: 'foursquare_v2_id',
          required: false,
          type: 'string',
        },
      ],
      responses: {
        '200': {
          description: 'List of found locations.',
          schema: {
            $ref: '#/definitions/LocationSearchResponse',
          },
        },
      },
      security: [
        {
          api_key: [],
        },
        {
          instagram_auth: ['public_content'],
        },
      ],
      summary: 'Search for a location by geographic coordinate.',
      tags: ['locations'],
    },
  },
  '/locations/{location-id}': {
    get: {
      description: 'Get information about a location.',
      parameters: [
        {
          description: 'The location ID.',
          in: 'path',
          name: 'location-id',
          required: true,
          type: 'string',
        },
      ],
      responses: {
        '200': {
          description: 'Location information response.',
          schema: {
            $ref: '#/definitions/LocationInfoResponse',
          },
        },
      },
      security: [
        {
          api_key: [],
        },
        {
          instagram_auth: ['public_content'],
        },
      ],
      summary: 'Get information about a location.',
      tags: ['locations'],
    },
  },
  '/locations/{location-id}/media/recent': {
    get: {
      description: 'Get a list of recent media objects from a given location.',
      parameters: [
        {
          description: 'The location ID.',
          in: 'path',
          name: 'location-id',
          required: true,
          type: 'string',
        },
        {
          description: 'Return media after this UNIX timestamp.',
          format: 'int64',
          in: 'query',
          name: 'min_timestamp',
          required: false,
          type: 'integer',
        },
        {
          description: 'Return media before this UNIX timestamp.',
          format: 'int64',
          in: 'query',
          name: 'max_timestamp',
          required: false,
          type: 'integer',
        },
        {
          description: 'Return media before this `min_id`.',
          in: 'query',
          name: 'min_id',
          required: false,
          type: 'string',
        },
        {
          description: 'Return media after this `max_id`.',
          in: 'query',
          name: 'max_id',
          required: false,
          type: 'string',
        },
      ],
      responses: {
        '200': {
          description: 'List of media entries from this location.',
          schema: {
            $ref: '#/definitions/MediaListResponse',
          },
        },
      },
      security: [
        {
          api_key: [],
        },
        {
          instagram_auth: ['public_content'],
        },
      ],
      summary: 'Get a list of recent media objects from a given location.',
      tags: ['locations'],
    },
  },
  '/media/popular': {
    get: {
      deprecated: true,
      description:
        'Get a list of what media is most popular at the moment. Can return mix of `image` and `video` types.\n\n**Warning:** [Deprecated](http://instagram.com/developer/changelog/) for Apps created **on or after** Nov 17, 2015\n',
      responses: {
        '200': {
          description: 'Found media resources (without likes information).',
          schema: {
            $ref: '#/definitions/MediaSearchResponse',
          },
        },
      },
      security: [
        {
          api_key: [],
        },
        {
          instagram_auth: ['basic'],
        },
      ],
      summary: 'Get a list of currently popular media.',
      tags: ['media'],
    },
  },
  '/media/search': {
    get: {
      description:
        'Search for media in a given area. The default time span is set to 5 days. The time span must not exceed 7 days.\nDefaults time stamps cover the last 5 days. Can return mix of `image` and `video` types.\n',
      parameters: [
        {
          description: 'Latitude of the center search coordinate. If used, `lng` is required.',
          format: 'double',
          in: 'query',
          name: 'lat',
          required: true,
          type: 'number',
        },
        {
          description: 'Longitude of the center search coordinate. If used, `lat` is required.',
          format: 'double',
          in: 'query',
          name: 'lng',
          required: true,
          type: 'number',
        },
        {
          description: 'A unix timestamp. All media returned will be taken later than this timestamp.',
          format: 'int64',
          in: 'query',
          name: 'min_timestamp',
          required: false,
          type: 'integer',
        },
        {
          description: 'A unix timestamp. All media returned will be taken earlier than this timestamp.',
          format: 'int64',
          in: 'query',
          name: 'max_timestamp',
          required: false,
          type: 'integer',
        },
        {
          description: 'Default is 1km (distance=1000), max distance is 5km.',
          format: 'int32',
          in: 'query',
          name: 'distance',
          required: false,
          type: 'integer',
        },
      ],
      responses: {
        '200': {
          description: 'Found media resources (without likes information) in a given area.',
          schema: {
            $ref: '#/definitions/MediaSearchResponse',
          },
        },
      },
      security: [
        {
          api_key: [],
        },
        {
          instagram_auth: ['public_content'],
        },
      ],
      summary: 'Search for media in a given area.',
      tags: ['media'],
    },
  },
  '/media/shortcode/{shortcode}': {
    get: {
      description:
        "This endpoint returns the same response as `GET /media/{media-id}`.\n\nA media object's shortcode can be found in its shortlink URL. An example shortlink is\n`http://instagram.com/p/D/`, its corresponding shortcode is `D`.\n",
      parameters: [
        {
          description: 'The short code of the media resource.',
          in: 'path',
          name: 'shortcode',
          required: true,
          type: 'string',
        },
      ],
      responses: {
        '200': {
          description: 'Media resource information.',
          schema: {
            $ref: '#/definitions/MediaEntryResponse',
          },
        },
      },
      security: [
        {
          api_key: [],
        },
        {
          instagram_auth: ['basic', 'public_content'],
        },
      ],
      summary: 'Get information about a media object.',
      tags: ['media'],
    },
  },
  '/media/{media-id}': {
    get: {
      description:
        'Get information about a media object. The returned type key will allow you to differentiate between image and\nvideo media.\n\n**Note:** if you authenticate with an OAuth Token, you will receive the user_has_liked key which quickly tells\nyou whether the current user has liked this media item.\n',
      parameters: [
        {
          description: 'The ID of the media resource.',
          in: 'path',
          name: 'media-id',
          required: true,
          type: 'string',
        },
      ],
      responses: {
        '200': {
          description: 'Media resource information.',
          schema: {
            $ref: '#/definitions/MediaEntryResponse',
          },
        },
      },
      security: [
        {
          api_key: [],
        },
        {
          instagram_auth: ['basic', 'public_content'],
        },
      ],
      summary: 'Get information about a media object.',
      tags: ['media'],
    },
  },
  '/media/{media-id}/comments': {
    get: {
      description: 'Get a list of recent comments on a media object.',
      parameters: [
        {
          description: 'The ID of the media resource.',
          in: 'path',
          name: 'media-id',
          required: true,
          type: 'string',
        },
      ],
      responses: {
        '200': {
          description: 'List of comments of the media resource.',
          schema: {
            $ref: '#/definitions/CommentsResponse',
          },
        },
      },
      security: [
        {
          api_key: [],
        },
        {
          instagram_auth: ['basic', 'public_content'],
        },
      ],
      summary: 'Get a list of recent comments on a media object.',
      tags: ['comments'],
    },
    post: {
      description:
        'Create a comment on a media object with the following rules:\n\n  * The total length of the comment cannot exceed 300 characters.\n  * The comment cannot contain more than 4 hashtags.\n  * The comment cannot contain more than 1 URL.\n  * The comment cannot consist of all capital letters.\n',
      parameters: [
        {
          description: 'The ID of the media resource.',
          in: 'path',
          name: 'media-id',
          required: true,
          type: 'string',
        },
        {
          description: 'Text to post as a comment on the media object as specified in `media-id`.',
          in: 'query',
          name: 'text',
          required: true,
          type: 'string',
        },
      ],
      responses: {
        '200': {
          description: 'Result of posting a comment.',
          schema: {
            $ref: '#/definitions/StatusResponse',
          },
        },
      },
      security: [
        {
          api_key: [],
        },
        {
          instagram_auth: ['comments'],
        },
      ],
      summary: 'Create a comment on a media object.',
      tags: ['comments'],
    },
  },
  '/media/{media-id}/comments/{comment-id}': {
    delete: {
      description:
        "Remove a comment either on the authenticated user's media object or authored by the authenticated user.\n",
      parameters: [
        {
          description: 'The ID of the media resource.',
          in: 'path',
          name: 'media-id',
          required: true,
          type: 'string',
        },
        {
          description: 'The ID of the comment entry.',
          in: 'path',
          name: 'comment-id',
          required: true,
          type: 'string',
        },
      ],
      responses: {
        '200': {
          description: 'Result of deleting a comment.',
          schema: {
            $ref: '#/definitions/StatusResponse',
          },
        },
      },
      security: [
        {
          api_key: [],
        },
        {
          instagram_auth: ['comments'],
        },
      ],
      summary: 'Remove a comment.',
      tags: ['comments'],
    },
  },
  '/media/{media-id}/likes': {
    delete: {
      description: 'Remove a like on this media by the currently authenticated user.',
      parameters: [
        {
          description: 'The ID of the media resource.',
          in: 'path',
          name: 'media-id',
          required: true,
          type: 'string',
        },
      ],
      responses: {
        '200': {
          description: 'Result of removing a like.',
          schema: {
            $ref: '#/definitions/StatusResponse',
          },
        },
      },
      security: [
        {
          api_key: [],
        },
        {
          instagram_auth: ['likes'],
        },
      ],
      summary: 'Remove a like on this media by the current user.',
      tags: ['likes'],
    },
    get: {
      description: 'Get a list of users who have liked this media.',
      parameters: [
        {
          description: 'The ID of the media resource.',
          in: 'path',
          name: 'media-id',
          required: true,
          type: 'string',
        },
      ],
      responses: {
        '200': {
          description: 'List of users who liked the media resource.',
          schema: {
            $ref: '#/definitions/UsersInfoResponse',
          },
        },
      },
      security: [
        {
          api_key: [],
        },
        {
          instagram_auth: ['basic', 'public_content'],
        },
      ],
      summary: 'Get a list of users who have liked this media.',
      tags: ['likes'],
    },
    post: {
      description: 'Set a like on this media by the currently authenticated user.',
      parameters: [
        {
          description: 'The ID of the media resource.',
          in: 'path',
          name: 'media-id',
          required: true,
          type: 'string',
        },
      ],
      responses: {
        '200': {
          description: 'Result of setting a like.',
          schema: {
            $ref: '#/definitions/StatusResponse',
          },
        },
      },
      security: [
        {
          api_key: [],
        },
        {
          instagram_auth: ['likes'],
        },
      ],
      summary: 'Set a like on this media by the current user.',
      tags: ['likes'],
    },
  },
  '/tags/search': {
    get: {
      description: 'Search for tags by name.',
      parameters: [
        {
          description: 'A valid tag name without a leading \\#. (eg. snowy, nofilter)',
          in: 'query',
          name: 'q',
          required: true,
          type: 'string',
        },
      ],
      responses: {
        '200': {
          description: 'List of found tags and their statistics.',
          schema: {
            $ref: '#/definitions/TagSearchResponse',
          },
        },
      },
      security: [
        {
          api_key: [],
        },
        {
          instagram_auth: ['public_content'],
        },
      ],
      summary: 'Search for tags by name.',
      tags: ['tags'],
    },
  },
  '/tags/{tag-name}': {
    get: {
      description: 'Get information about a tag object.',
      parameters: [
        {
          description: 'The tag name.',
          in: 'path',
          name: 'tag-name',
          required: true,
          type: 'string',
        },
      ],
      responses: {
        '200': {
          description: 'Tag information response.',
          schema: {
            $ref: '#/definitions/TagInfoResponse',
          },
        },
      },
      security: [
        {
          api_key: [],
        },
        {
          instagram_auth: ['public_content'],
        },
      ],
      summary: 'Get information about a tag object.',
      tags: ['tags'],
    },
  },
  '/tags/{tag-name}/media/recent': {
    get: {
      description:
        'Get a list of recently tagged media. Use the `max_tag_id` and `min_tag_id` parameters in the pagination\nresponse to paginate through these objects.\n',
      parameters: [
        {
          description: 'The tag name.',
          in: 'path',
          name: 'tag-name',
          required: true,
          type: 'string',
        },
        {
          description: 'Count of tagged media to return.',
          in: 'query',
          name: 'count',
          required: false,
          type: 'integer',
        },
        {
          description: 'Return media before this `min_tag_id`.',
          in: 'query',
          name: 'min_tag_id',
          required: false,
          type: 'string',
        },
        {
          description: 'Return media after this `max_tag_id`.',
          in: 'query',
          name: 'max_tag_id',
          required: false,
          type: 'string',
        },
      ],
      responses: {
        '200': {
          description: 'List of media entries with this tag.',
          schema: {
            $ref: '#/definitions/TagMediaListResponse',
          },
        },
      },
      security: [
        {
          api_key: [],
        },
        {
          instagram_auth: ['public_content'],
        },
      ],
      summary: 'Get a list of recently tagged media.',
      tags: ['tags'],
    },
  },
  '/users/search': {
    get: {
      description: 'Search for a user by name.',
      parameters: [
        {
          description: 'A query string.',
          in: 'query',
          name: 'q',
          required: true,
          type: 'string',
        },
        {
          description: 'Number of users to return.',
          in: 'query',
          name: 'count',
          required: false,
          type: 'integer',
        },
      ],
      responses: {
        '200': {
          description: 'List of found users.',
          schema: {
            $ref: '#/definitions/UsersInfoResponse',
          },
        },
      },
      security: [
        {
          api_key: [],
        },
        {
          instagram_auth: ['basic'],
        },
      ],
      summary: 'Search for a user by name.',
      tags: ['users'],
    },
  },
  '/users/self/feed': {
    get: {
      deprecated: true,
      description:
        "See the authenticated user's feed.\n\n**Warning:** [Deprecated](http://instagram.com/developer/changelog/) for Apps created **on or after** Nov 17, 2015\n",
      parameters: [
        {
          description: 'Count of media to return.',
          in: 'query',
          name: 'count',
          required: false,
          type: 'integer',
        },
        {
          description: 'Return media later than this `min_id`.',
          in: 'query',
          name: 'min_id',
          required: false,
          type: 'string',
        },
        {
          description: 'Return media earlier than this `max_id`.',
          in: 'query',
          name: 'max_id',
          required: false,
          type: 'string',
        },
      ],
      responses: {
        '200': {
          description: 'Users feed entries.',
          schema: {
            $ref: '#/definitions/MediaListResponse',
          },
        },
      },
      security: [
        {
          api_key: [],
        },
        {
          instagram_auth: ['basic'],
        },
      ],
      summary: "See the authenticated user's feed.",
      tags: ['users'],
    },
  },
  '/users/self/media/liked': {
    get: {
      description:
        'See the list of media liked by the authenticated user. Private media is returned as long as the authenticated\nuser has permission to view that media. Liked media lists are only available for the currently authenticated\nuser.\n',
      parameters: [
        {
          description: 'Count of media to return.',
          in: 'query',
          name: 'count',
          required: false,
          type: 'integer',
        },
        {
          description: 'Return media liked before this id.',
          in: 'query',
          name: 'max_like_id',
          required: false,
          type: 'string',
        },
      ],
      responses: {
        '200': {
          description: 'Users media entries.',
          schema: {
            $ref: '#/definitions/MediaListResponse',
          },
        },
      },
      security: [
        {
          api_key: [],
        },
        {
          instagram_auth: ['basic'],
        },
      ],
      summary: 'See the list of media liked by the authenticated user.',
      tags: ['users'],
    },
  },
  '/users/self/requested-by': {
    get: {
      description: "List the users who have requested this user's permission to follow.",
      responses: {
        '200': {
          description: "List of users who have requested this user's permission to follow.",
          schema: {
            $ref: '#/definitions/UsersInfoResponse',
          },
        },
      },
      security: [
        {
          api_key: [],
        },
        {
          instagram_auth: ['follower_list'],
        },
      ],
      summary: "List the users who have requested this user's permission to follow.",
      tags: ['relationships'],
    },
  },
  '/users/{user-id}': {
    get: {
      description:
        'Get basic information about a user. To get information about the owner of the access token, you can use\n**self** instead of the `user-id`.\n\nSecurity scope `public_content` is required to read information about other users.\n',
      parameters: [
        {
          description:
            'The ID of a user to get information about, or **self** to retrieve information about authenticated user.',
          in: 'path',
          name: 'user-id',
          required: true,
          type: 'string',
        },
      ],
      responses: {
        '200': {
          description: 'User basic information.',
          schema: {
            $ref: '#/definitions/UserResponse',
          },
        },
        '404': {
          description: 'Not Found, user with such ID does not exist.',
        },
      },
      security: [
        {
          api_key: [],
        },
        {
          instagram_auth: ['basic', 'public_content'],
        },
      ],
      summary: 'Get basic information about a user.',
      tags: ['users'],
    },
  },
  '/users/{user-id}/followed-by': {
    get: {
      description:
        'Get the list of users this user is followed by. To get users followed by the owner of the access token, you\ncan use **self** instead of the `user-id`.\n',
      parameters: [
        {
          description: 'The ID of a user, or **self** to retrieve information about authenticated user.',
          in: 'path',
          name: 'user-id',
          required: true,
          type: 'string',
        },
      ],
      responses: {
        '200': {
          description: 'List of users this user is followed by.',
          schema: {
            $ref: '#/definitions/UsersPagingResponse',
          },
        },
      },
      security: [
        {
          api_key: [],
        },
        {
          instagram_auth: ['follower_list'],
        },
      ],
      summary: 'Get the list of users this user is followed by.',
      tags: ['relationships'],
    },
  },
  '/users/{user-id}/follows': {
    get: {
      description:
        'Get the list of users this user follows. To get follows of the owner of the access token, you can use **self**\ninstead of the `user-id`.\n',
      parameters: [
        {
          description: 'The ID of a user, or **self** to retrieve information about authenticated user.',
          in: 'path',
          name: 'user-id',
          required: true,
          type: 'string',
        },
      ],
      responses: {
        '200': {
          description: 'List of users this user follows.',
          schema: {
            $ref: '#/definitions/UsersPagingResponse',
          },
        },
      },
      security: [
        {
          api_key: [],
        },
        {
          instagram_auth: ['follower_list'],
        },
      ],
      summary: 'Get the list of users this user follows.',
      tags: ['relationships'],
    },
  },
  '/users/{user-id}/media/recent': {
    get: {
      description:
        'Get the most recent media published by a user. To get the most recent media published by the owner of the\naccess token, you can use **self** instead of the `user-id`.\n\nSecurity scope `public_content` is required to read information about other users.\n',
      parameters: [
        {
          description: 'The ID of a user to get recent media of, or **self** to retrieve media of authenticated user.',
          in: 'path',
          name: 'user-id',
          required: true,
          type: 'string',
        },
        {
          description: 'Count of media to return.',
          in: 'query',
          name: 'count',
          required: false,
          type: 'integer',
        },
        {
          description: 'Return media before this UNIX timestamp.',
          format: 'int64',
          in: 'query',
          name: 'max_timestamp',
          required: false,
          type: 'integer',
        },
        {
          description: 'Return media after this UNIX timestamp.',
          format: 'int64',
          in: 'query',
          name: 'min_timestamp',
          required: false,
          type: 'integer',
        },
        {
          description: 'Return media later than this `min_id`.',
          in: 'query',
          name: 'min_id',
          required: false,
          type: 'string',
        },
        {
          description: 'Return media earlier than this `max_id`.',
          in: 'query',
          name: 'max_id',
          required: false,
          type: 'string',
        },
      ],
      responses: {
        '200': {
          description: 'Users media entries.',
          schema: {
            $ref: '#/definitions/MediaListResponse',
          },
        },
      },
      security: [
        {
          api_key: [],
        },
        {
          instagram_auth: ['basic', 'public_content'],
        },
      ],
      summary: 'Get the most recent media published by a user.',
      tags: ['users'],
    },
  },
  '/users/{user-id}/relationship': {
    get: {
      description: 'Get information about a relationship to another user.',
      parameters: [
        {
          description: 'The ID of a user to get information about.',
          in: 'path',
          name: 'user-id',
          required: true,
          type: 'string',
        },
      ],
      responses: {
        '200': {
          description: 'Relationship information.',
          schema: {
            $ref: '#/definitions/RelationshipResponse',
          },
        },
      },
      security: [
        {
          api_key: [],
        },
        {
          instagram_auth: ['follower_list'],
        },
      ],
      summary: 'Get information about a relationship to another user.',
      tags: ['relationships'],
    },
    post: {
      description: 'Modify the relationship between the current user and the target user.',
      parameters: [
        {
          description: 'The ID of the target user.',
          in: 'path',
          name: 'user-id',
          required: true,
          type: 'string',
        },
        {
          description: 'Type of action to apply for relationship with the user.',
          enum: ['follow', 'unfollow', 'block', 'unblock', 'approve', 'ignore'],
          in: 'query',
          name: 'action',
          required: true,
          type: 'string',
        },
      ],
      responses: {
        '200': {
          description: 'Relationship information.',
          schema: {
            $ref: '#/definitions/RelationshipPostResponse',
          },
        },
      },
      security: [
        {
          api_key: [],
        },
        {
          instagram_auth: ['relationships'],
        },
      ],
      summary: 'Modify the relationship between the current user and the target user.',
      tags: ['relationships'],
    },
  },
} as TPaths;
