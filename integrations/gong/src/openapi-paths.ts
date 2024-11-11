// @ts-nocheck
export type TPaths = {
  '/oauth2/applications/@me': {
    get: {
      operationId: 'get_my_oauth2_application';
      responses: {
        '200': {
          description: '200 response for get_my_oauth2_application';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PrivateApplicationResponse';
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
  };
  '/users/@me/connections': {
    get: {
      operationId: 'list_my_connections';
      responses: {
        '200': {
          description: '200 response for list_my_connections';
          content: {
            'application/json': {
              schema: {
                type: ['array', 'null'];
                items: {
                  $ref: '#/components/schemas/ConnectedAccountResponse';
                };
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
        {
          OAuth2: ['connections'];
        },
      ];
    };
  };
  '/users/@me/channels': {
    post: {
      operationId: 'create_dm';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/CreatePrivateChannelRequest';
            };
          };
        };
        required: true;
      };
      responses: {
        '200': {
          description: '200 response for create_dm';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    $ref: '#/components/schemas/PrivateChannelResponse';
                  },
                  {
                    $ref: '#/components/schemas/PrivateGroupChannelResponse';
                  },
                ];
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
  };
  '/users/@me/guilds': {
    get: {
      operationId: 'list_my_guilds';
      parameters: [
        {
          name: 'before';
          in: 'query';
          schema: {
            $ref: '#/components/schemas/SnowflakeType';
          };
        },
        {
          name: 'after';
          in: 'query';
          schema: {
            $ref: '#/components/schemas/SnowflakeType';
          };
        },
        {
          name: 'limit';
          in: 'query';
          schema: {
            type: 'integer';
            minimum: 1;
            maximum: 200;
          };
        },
        {
          name: 'with_counts';
          in: 'query';
          schema: {
            type: 'boolean';
          };
        },
      ];
      responses: {
        '200': {
          description: '200 response for list_my_guilds';
          content: {
            'application/json': {
              schema: {
                type: ['array', 'null'];
                items: {
                  $ref: '#/components/schemas/MyGuildResponse';
                };
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
        {
          OAuth2: ['guilds'];
        },
      ];
    };
  };
  '/applications/@me': {
    get: {
      operationId: 'get_my_application';
      responses: {
        '200': {
          description: '200 response for get_my_application';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PrivateApplicationResponse';
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
    patch: {
      operationId: 'update_my_application';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/ApplicationFormPartial';
            };
          };
        };
        required: true;
      };
      responses: {
        '200': {
          description: '200 response for update_my_application';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PrivateApplicationResponse';
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
  };
  '/gateway/bot': {
    get: {
      operationId: 'get_bot_gateway';
      responses: {
        '200': {
          description: '200 response for get_bot_gateway';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/GatewayBotResponse';
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
  };
  '/oauth2/@me': {
    get: {
      operationId: 'get_my_oauth2_authorization';
      responses: {
        '200': {
          description: '200 response for get_my_oauth2_authorization';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/OAuth2GetAuthorizationResponse';
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
        {
          OAuth2: [
            'activities.read',
            'activities.write',
            'applications.builds.read',
            'applications.builds.upload',
            'applications.commands',
            'applications.commands.permissions.update',
            'applications.commands.update',
            'applications.entitlements',
            'applications.store.update',
            'bot',
            'connections',
            'dm_channels.read',
            'email',
            'gdm.join',
            'guilds',
            'guilds.join',
            'guilds.members.read',
            'identify',
            'messages.read',
            'relationships.read',
            'role_connections.write',
            'rpc',
            'rpc.activities.write',
            'rpc.notifications.read',
            'rpc.screenshare.read',
            'rpc.screenshare.write',
            'rpc.video.read',
            'rpc.video.write',
            'rpc.voice.read',
            'rpc.voice.write',
            'voice',
            'webhook.incoming',
          ];
        },
      ];
    };
  };
  '/voice/regions': {
    get: {
      operationId: 'list_voice_regions';
      responses: {
        '200': {
          description: '200 response for list_voice_regions';
          content: {
            'application/json': {
              schema: {
                type: ['array', 'null'];
                items: {
                  $ref: '#/components/schemas/VoiceRegionResponse';
                };
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
  };
  '/users/@me': {
    get: {
      operationId: 'get_my_user';
      responses: {
        '200': {
          description: '200 response for get_my_user';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/UserPIIResponse';
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
        {
          OAuth2: ['identify'];
        },
      ];
    };
    patch: {
      operationId: 'update_my_user';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/BotAccountPatchRequest';
            };
          };
        };
        required: true;
      };
      responses: {
        '200': {
          description: '200 response for update_my_user';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/UserPIIResponse';
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
  };
  '/stage-instances': {
    post: {
      operationId: 'create_stage_instance';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                topic: {
                  type: 'string';
                  minLength: 1;
                  maxLength: 120;
                };
                channel_id: {
                  $ref: '#/components/schemas/SnowflakeType';
                };
                privacy_level: {
                  oneOf: [
                    {
                      type: 'null';
                    },
                    {
                      $ref: '#/components/schemas/StageInstancesPrivacyLevels';
                    },
                  ];
                };
                guild_scheduled_event_id: {
                  oneOf: [
                    {
                      type: 'null';
                    },
                    {
                      $ref: '#/components/schemas/SnowflakeType';
                    },
                  ];
                };
                send_start_notification: {
                  type: ['boolean', 'null'];
                };
              };
              required: ['topic', 'channel_id'];
            };
          };
        };
        required: true;
      };
      responses: {
        '200': {
          description: '200 response for create_stage_instance';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/StageInstanceResponse';
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
  };
  '/sticker-packs': {
    get: {
      operationId: 'list_sticker_packs';
      responses: {
        '200': {
          description: '200 response for list_sticker_packs';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/StickerPackCollectionResponse';
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {},
        {
          BotToken: [];
        },
      ];
    };
  };
  '/gateway': {
    get: {
      operationId: 'get_gateway';
      responses: {
        '200': {
          description: '200 response for get_gateway';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/GatewayResponse';
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {},
        {
          BotToken: [];
        },
      ];
    };
  };
  '/guilds': {
    post: {
      operationId: 'create_guild';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/GuildCreateRequest';
            };
          };
        };
        required: true;
      };
      responses: {
        '201': {
          description: '201 response for create_guild';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/GuildResponse';
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
  };
  '/channels/{channel_id}/users/@me/threads/archived/private': {
    parameters: [
      {
        name: 'channel_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
    ];
    get: {
      operationId: 'list_my_private_archived_threads';
      parameters: [
        {
          name: 'before';
          in: 'query';
          schema: {
            $ref: '#/components/schemas/SnowflakeType';
          };
        },
        {
          name: 'limit';
          in: 'query';
          schema: {
            type: 'integer';
            minimum: 2;
            maximum: 100;
          };
        },
      ];
      responses: {
        '200': {
          description: '200 response for list_my_private_archived_threads';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ThreadsResponse';
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
  };
  '/applications/{application_id}/guilds/{guild_id}/commands/permissions': {
    parameters: [
      {
        name: 'application_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
      {
        name: 'guild_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
    ];
    get: {
      operationId: 'list_guild_application_command_permissions';
      responses: {
        '200': {
          description: '200 response for list_guild_application_command_permissions';
          content: {
            'application/json': {
              schema: {
                type: 'array';
                items: {
                  $ref: '#/components/schemas/CommandPermissionsResponse';
                };
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
        {
          OAuth2: ['applications.commands.permissions.update'];
        },
      ];
    };
  };
  '/applications/{application_id}/guilds/{guild_id}/commands/{command_id}/permissions': {
    parameters: [
      {
        name: 'application_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
      {
        name: 'guild_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
      {
        name: 'command_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
    ];
    get: {
      operationId: 'get_guild_application_command_permissions';
      responses: {
        '200': {
          description: '200 response for get_guild_application_command_permissions';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CommandPermissionsResponse';
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
        {
          OAuth2: ['applications.commands.permissions.update'];
        },
      ];
    };
    put: {
      operationId: 'set_guild_application_command_permissions';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                permissions: {
                  type: ['array', 'null'];
                  items: {
                    $ref: '#/components/schemas/ApplicationCommandPermission';
                  };
                  maxItems: 100;
                };
              };
            };
          };
        };
        required: true;
      };
      responses: {
        '200': {
          description: '200 response for set_guild_application_command_permissions';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CommandPermissionsResponse';
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
        {
          OAuth2: ['applications.commands.permissions.update'];
        },
      ];
    };
  };
  '/channels/{channel_id}/messages/{message_id}/reactions/{emoji_name}/@me': {
    parameters: [
      {
        name: 'channel_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
      {
        name: 'message_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
      {
        name: 'emoji_name';
        in: 'path';
        schema: {
          type: 'string';
          maxLength: 152133;
        };
        required: true;
      },
    ];
    put: {
      operationId: 'add_my_message_reaction';
      responses: {
        '204': {
          description: '204 response for add_my_message_reaction';
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
    delete: {
      operationId: 'delete_my_message_reaction';
      responses: {
        '204': {
          description: '204 response for delete_my_message_reaction';
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
  };
  '/channels/{channel_id}/threads/archived/private': {
    parameters: [
      {
        name: 'channel_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
    ];
    get: {
      operationId: 'list_private_archived_threads';
      parameters: [
        {
          name: 'before';
          in: 'query';
          schema: {
            type: 'string';
            format: 'date-time';
          };
        },
        {
          name: 'limit';
          in: 'query';
          schema: {
            type: 'integer';
            minimum: 2;
            maximum: 100;
          };
        },
      ];
      responses: {
        '200': {
          description: '200 response for list_private_archived_threads';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ThreadsResponse';
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
  };
  '/channels/{channel_id}/threads/archived/public': {
    parameters: [
      {
        name: 'channel_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
    ];
    get: {
      operationId: 'list_public_archived_threads';
      parameters: [
        {
          name: 'before';
          in: 'query';
          schema: {
            type: 'string';
            format: 'date-time';
          };
        },
        {
          name: 'limit';
          in: 'query';
          schema: {
            type: 'integer';
            minimum: 2;
            maximum: 100;
          };
        },
      ];
      responses: {
        '200': {
          description: '200 response for list_public_archived_threads';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ThreadsResponse';
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
  };
  '/users/@me/applications/{application_id}/role-connection': {
    parameters: [
      {
        name: 'application_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
    ];
    get: {
      operationId: 'get_application_user_role_connection';
      responses: {
        '200': {
          description: '200 response for get_application_user_role_connection';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ApplicationUserRoleConnectionResponse';
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          OAuth2: ['role_connections.write'];
        },
      ];
    };
    put: {
      operationId: 'update_application_user_role_connection';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                platform_name: {
                  type: ['string', 'null'];
                  maxLength: 50;
                };
                platform_username: {
                  type: ['string', 'null'];
                  maxLength: 100;
                };
                metadata: {
                  type: ['object', 'null'];
                  additionalProperties: {
                    type: 'string';
                    minLength: 1;
                    maxLength: 100;
                  };
                  maxProperties: 5;
                };
              };
            };
          };
        };
        required: true;
      };
      responses: {
        '200': {
          description: '200 response for update_application_user_role_connection';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ApplicationUserRoleConnectionResponse';
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          OAuth2: ['role_connections.write'];
        },
      ];
    };
  };
  '/users/@me/guilds/{guild_id}/member': {
    parameters: [
      {
        name: 'guild_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
    ];
    get: {
      operationId: 'get_my_guild_member';
      responses: {
        '200': {
          description: '200 response for get_my_guild_member';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PrivateGuildMemberResponse';
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          OAuth2: ['guilds.members.read'];
        },
      ];
    };
  };
  '/applications/{application_id}/role-connections/metadata': {
    parameters: [
      {
        name: 'application_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
    ];
    get: {
      operationId: 'get_application_role_connections_metadata';
      responses: {
        '200': {
          description: '200 response for get_application_role_connections_metadata';
          content: {
            'application/json': {
              schema: {
                type: ['array', 'null'];
                items: {
                  $ref: '#/components/schemas/ApplicationRoleConnectionsMetadataItemResponse';
                };
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
    put: {
      operationId: 'update_application_role_connections_metadata';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: ['array', 'null'];
              items: {
                $ref: '#/components/schemas/ApplicationRoleConnectionsMetadataItemRequest';
              };
              maxItems: 5;
            };
          };
        };
        required: true;
      };
      responses: {
        '200': {
          description: '200 response for update_application_role_connections_metadata';
          content: {
            'application/json': {
              schema: {
                type: ['array', 'null'];
                items: {
                  $ref: '#/components/schemas/ApplicationRoleConnectionsMetadataItemResponse';
                };
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
  };
  '/applications/{application_id}/guilds/{guild_id}/commands/{command_id}': {
    parameters: [
      {
        name: 'application_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
      {
        name: 'guild_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
      {
        name: 'command_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
    ];
    get: {
      operationId: 'get_guild_application_command';
      responses: {
        '200': {
          description: '200 response for get_guild_application_command';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ApplicationCommandResponse';
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
        {
          OAuth2: ['applications.commands.update'];
        },
      ];
    };
    delete: {
      operationId: 'delete_guild_application_command';
      responses: {
        '204': {
          description: '204 response for delete_guild_application_command';
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
        {
          OAuth2: ['applications.commands.update'];
        },
      ];
    };
    patch: {
      operationId: 'update_guild_application_command';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/ApplicationCommandPatchRequestPartial';
            };
          };
        };
        required: true;
      };
      responses: {
        '200': {
          description: '200 response for update_guild_application_command';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ApplicationCommandResponse';
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
        {
          OAuth2: ['applications.commands.update'];
        },
      ];
    };
  };
  '/applications/{application_id}/guilds/{guild_id}/commands': {
    parameters: [
      {
        name: 'application_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
      {
        name: 'guild_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
    ];
    get: {
      operationId: 'list_guild_application_commands';
      parameters: [
        {
          name: 'with_localizations';
          in: 'query';
          schema: {
            type: 'boolean';
          };
        },
      ];
      responses: {
        '200': {
          description: '200 response for list_guild_application_commands';
          content: {
            'application/json': {
              schema: {
                type: ['array', 'null'];
                items: {
                  $ref: '#/components/schemas/ApplicationCommandResponse';
                };
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
        {
          OAuth2: ['applications.commands.update'];
        },
      ];
    };
    put: {
      operationId: 'bulk_set_guild_application_commands';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: ['array', 'null'];
              items: {
                $ref: '#/components/schemas/ApplicationCommandUpdateRequest';
              };
              maxItems: 110;
            };
          };
        };
        required: true;
      };
      responses: {
        '200': {
          description: '200 response for bulk_set_guild_application_commands';
          content: {
            'application/json': {
              schema: {
                type: ['array', 'null'];
                items: {
                  $ref: '#/components/schemas/ApplicationCommandResponse';
                };
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
        {
          OAuth2: ['applications.commands.update'];
        },
      ];
    };
    post: {
      operationId: 'create_guild_application_command';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/ApplicationCommandCreateRequest';
            };
          };
        };
        required: true;
      };
      responses: {
        '200': {
          description: '200 response for create_guild_application_command';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ApplicationCommandResponse';
              };
            };
          };
        };
        '201': {
          description: '201 response for create_guild_application_command';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ApplicationCommandResponse';
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
        {
          OAuth2: ['applications.commands.update'];
        },
      ];
    };
  };
  '/channels/{channel_id}/thread-members/@me': {
    parameters: [
      {
        name: 'channel_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
    ];
    put: {
      operationId: 'join_thread';
      responses: {
        '204': {
          description: '204 response for join_thread';
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
    delete: {
      operationId: 'leave_thread';
      responses: {
        '204': {
          description: '204 response for leave_thread';
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
  };
  '/channels/{channel_id}/messages/bulk-delete': {
    parameters: [
      {
        name: 'channel_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
    ];
    post: {
      operationId: 'bulk_delete_messages';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                messages: {
                  type: 'array';
                  items: {
                    $ref: '#/components/schemas/SnowflakeType';
                  };
                  minItems: 2;
                  maxItems: 100;
                  uniqueItems: true;
                };
              };
              required: ['messages'];
            };
          };
        };
        required: true;
      };
      responses: {
        '204': {
          description: '204 response for bulk_delete_messages';
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
  };
  '/channels/{channel_id}/messages/{message_id}/reactions/{emoji_name}/{user_id}': {
    parameters: [
      {
        name: 'channel_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
      {
        name: 'message_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
      {
        name: 'emoji_name';
        in: 'path';
        schema: {
          type: 'string';
          maxLength: 152133;
        };
        required: true;
      },
      {
        name: 'user_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
    ];
    delete: {
      operationId: 'delete_user_message_reaction';
      responses: {
        '204': {
          description: '204 response for delete_user_message_reaction';
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
  };
  '/channels/{channel_id}/messages/{message_id}/reactions/{emoji_name}': {
    parameters: [
      {
        name: 'channel_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
      {
        name: 'message_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
      {
        name: 'emoji_name';
        in: 'path';
        schema: {
          type: 'string';
          maxLength: 152133;
        };
        required: true;
      },
    ];
    get: {
      operationId: 'list_message_reactions_by_emoji';
      parameters: [
        {
          name: 'after';
          in: 'query';
          schema: {
            $ref: '#/components/schemas/SnowflakeType';
          };
        },
        {
          name: 'limit';
          in: 'query';
          schema: {
            type: 'integer';
            minimum: 1;
            maximum: 100;
          };
        },
      ];
      responses: {
        '200': {
          description: '200 response for list_message_reactions_by_emoji';
          content: {
            'application/json': {
              schema: {
                type: 'array';
                items: {
                  $ref: '#/components/schemas/UserResponse';
                };
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
    delete: {
      operationId: 'delete_all_message_reactions_by_emoji';
      responses: {
        '204': {
          description: '204 response for delete_all_message_reactions_by_emoji';
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
  };
  '/channels/{channel_id}/messages/{message_id}/reactions': {
    parameters: [
      {
        name: 'channel_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
      {
        name: 'message_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
    ];
    delete: {
      operationId: 'delete_all_message_reactions';
      responses: {
        '204': {
          description: '204 response for delete_all_message_reactions';
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
  };
  '/channels/{channel_id}/messages/{message_id}/crosspost': {
    parameters: [
      {
        name: 'channel_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
      {
        name: 'message_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
    ];
    post: {
      operationId: 'crosspost_message';
      responses: {
        '200': {
          description: '200 response for crosspost_message';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/MessageResponse';
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
  };
  '/channels/{channel_id}/messages/{message_id}/threads': {
    parameters: [
      {
        name: 'channel_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
      {
        name: 'message_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
    ];
    post: {
      operationId: 'create_thread_from_message';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/CreateTextThreadWithMessageRequest';
            };
          };
        };
        required: true;
      };
      responses: {
        '201': {
          description: '201 response for create_thread_from_message';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ThreadResponse';
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
  };
  '/webhooks/{webhook_id}/{webhook_token}/messages/@original': {
    parameters: [
      {
        name: 'webhook_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
      {
        name: 'webhook_token';
        in: 'path';
        schema: {
          type: 'string';
          maxLength: 152133;
        };
        required: true;
      },
    ];
    get: {
      operationId: 'get_original_webhook_message';
      parameters: [
        {
          name: 'thread_id';
          in: 'query';
          schema: {
            $ref: '#/components/schemas/SnowflakeType';
          };
        },
      ];
      responses: {
        '200': {
          description: '200 response for get_original_webhook_message';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/MessageResponse';
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {},
        {
          BotToken: [];
        },
      ];
    };
    delete: {
      operationId: 'delete_original_webhook_message';
      parameters: [
        {
          name: 'thread_id';
          in: 'query';
          schema: {
            $ref: '#/components/schemas/SnowflakeType';
          };
        },
      ];
      responses: {
        '204': {
          description: '204 response for delete_original_webhook_message';
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {},
        {
          BotToken: [];
        },
      ];
    };
    patch: {
      operationId: 'update_original_webhook_message';
      parameters: [
        {
          name: 'thread_id';
          in: 'query';
          schema: {
            $ref: '#/components/schemas/SnowflakeType';
          };
        },
      ];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/IncomingWebhookUpdateRequestPartial';
            };
          };
          'application/x-www-form-urlencoded': {
            schema: {
              $ref: '#/components/schemas/IncomingWebhookUpdateRequestPartial';
            };
          };
          'multipart/form-data': {
            schema: {
              allOf: [
                {
                  $ref: '#/components/schemas/IncomingWebhookUpdateRequestPartial';
                },
                {
                  type: 'object';
                  properties: {
                    'files[0]': {
                      type: 'string';
                      contentEncoding: 'binary';
                    };
                    'files[1]': {
                      type: 'string';
                      contentEncoding: 'binary';
                    };
                    'files[2]': {
                      type: 'string';
                      contentEncoding: 'binary';
                    };
                    'files[3]': {
                      type: 'string';
                      contentEncoding: 'binary';
                    };
                    'files[4]': {
                      type: 'string';
                      contentEncoding: 'binary';
                    };
                    'files[5]': {
                      type: 'string';
                      contentEncoding: 'binary';
                    };
                    'files[6]': {
                      type: 'string';
                      contentEncoding: 'binary';
                    };
                    'files[7]': {
                      type: 'string';
                      contentEncoding: 'binary';
                    };
                    'files[8]': {
                      type: 'string';
                      contentEncoding: 'binary';
                    };
                    'files[9]': {
                      type: 'string';
                      contentEncoding: 'binary';
                    };
                  };
                },
              ];
            };
          };
        };
        required: true;
      };
      responses: {
        '200': {
          description: '200 response for update_original_webhook_message';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/MessageResponse';
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {},
        {
          BotToken: [];
        },
      ];
    };
  };
  '/guilds/{guild_id}/scheduled-events/{guild_scheduled_event_id}/users': {
    parameters: [
      {
        name: 'guild_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
      {
        name: 'guild_scheduled_event_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
    ];
    get: {
      operationId: 'list_guild_scheduled_event_users';
      parameters: [
        {
          name: 'with_member';
          in: 'query';
          schema: {
            type: 'boolean';
          };
        },
        {
          name: 'limit';
          in: 'query';
          schema: {
            type: 'integer';
            minimum: 1;
            maximum: 100;
          };
        },
        {
          name: 'before';
          in: 'query';
          schema: {
            $ref: '#/components/schemas/SnowflakeType';
          };
        },
        {
          name: 'after';
          in: 'query';
          schema: {
            $ref: '#/components/schemas/SnowflakeType';
          };
        },
      ];
      responses: {
        '200': {
          description: '200 response for list_guild_scheduled_event_users';
          content: {
            'application/json': {
              schema: {
                type: ['array', 'null'];
                items: {
                  $ref: '#/components/schemas/ScheduledEventUserResponse';
                };
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
  };
  '/guilds/{guild_id}/auto-moderation/rules/{rule_id}': {
    parameters: [
      {
        name: 'guild_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
      {
        name: 'rule_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
    ];
    get: {
      operationId: 'get_auto_moderation_rule';
      responses: {
        '200': {
          description: '200 response for get_auto_moderation_rule';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    $ref: '#/components/schemas/DefaultKeywordRuleResponse';
                  },
                  {
                    $ref: '#/components/schemas/KeywordRuleResponse';
                  },
                  {
                    $ref: '#/components/schemas/MLSpamRuleResponse';
                  },
                  {
                    $ref: '#/components/schemas/MentionSpamRuleResponse';
                  },
                  {
                    $ref: '#/components/schemas/SpamLinkRuleResponse';
                  },
                ];
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
    delete: {
      operationId: 'delete_auto_moderation_rule';
      responses: {
        '204': {
          description: '204 response for delete_auto_moderation_rule';
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
    patch: {
      operationId: 'update_auto_moderation_rule';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              anyOf: [
                {
                  $ref: '#/components/schemas/DefaultKeywordListUpsertRequestPartial';
                },
                {
                  $ref: '#/components/schemas/KeywordUpsertRequestPartial';
                },
                {
                  $ref: '#/components/schemas/MLSpamUpsertRequestPartial';
                },
                {
                  $ref: '#/components/schemas/MentionSpamUpsertRequestPartial';
                },
              ];
              'x-discord-union': 'oneOf';
            };
          };
        };
        required: true;
      };
      responses: {
        '200': {
          description: '200 response for update_auto_moderation_rule';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    $ref: '#/components/schemas/DefaultKeywordRuleResponse';
                  },
                  {
                    $ref: '#/components/schemas/KeywordRuleResponse';
                  },
                  {
                    $ref: '#/components/schemas/MLSpamRuleResponse';
                  },
                  {
                    $ref: '#/components/schemas/MentionSpamRuleResponse';
                  },
                  {
                    $ref: '#/components/schemas/SpamLinkRuleResponse';
                  },
                ];
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
  };
  '/guilds/{guild_id}/auto-moderation/rules': {
    parameters: [
      {
        name: 'guild_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
    ];
    get: {
      operationId: 'list_auto_moderation_rules';
      responses: {
        '200': {
          description: '200 response for list_auto_moderation_rules';
          content: {
            'application/json': {
              schema: {
                type: ['array', 'null'];
                items: {
                  oneOf: [
                    {
                      $ref: '#/components/schemas/DefaultKeywordRuleResponse';
                    },
                    {
                      $ref: '#/components/schemas/KeywordRuleResponse';
                    },
                    {
                      $ref: '#/components/schemas/MLSpamRuleResponse';
                    },
                    {
                      $ref: '#/components/schemas/MentionSpamRuleResponse';
                    },
                    {
                      $ref: '#/components/schemas/SpamLinkRuleResponse';
                    },
                    {
                      type: 'null';
                    },
                  ];
                };
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
    post: {
      operationId: 'create_auto_moderation_rule';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              oneOf: [
                {
                  $ref: '#/components/schemas/DefaultKeywordListUpsertRequest';
                },
                {
                  $ref: '#/components/schemas/KeywordUpsertRequest';
                },
                {
                  $ref: '#/components/schemas/MLSpamUpsertRequest';
                },
                {
                  $ref: '#/components/schemas/MentionSpamUpsertRequest';
                },
              ];
            };
          };
        };
        required: true;
      };
      responses: {
        '200': {
          description: '200 response for create_auto_moderation_rule';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    $ref: '#/components/schemas/DefaultKeywordRuleResponse';
                  },
                  {
                    $ref: '#/components/schemas/KeywordRuleResponse';
                  },
                  {
                    $ref: '#/components/schemas/MLSpamRuleResponse';
                  },
                  {
                    $ref: '#/components/schemas/MentionSpamRuleResponse';
                  },
                  {
                    $ref: '#/components/schemas/SpamLinkRuleResponse';
                  },
                ];
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
  };
  '/guilds/{guild_id}/voice-states/@me': {
    parameters: [
      {
        name: 'guild_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
    ];
    patch: {
      operationId: 'update_self_voice_state';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                request_to_speak_timestamp: {
                  type: ['string', 'null'];
                  format: 'date-time';
                };
                suppress: {
                  type: ['boolean', 'null'];
                };
                channel_id: {
                  oneOf: [
                    {
                      type: 'null';
                    },
                    {
                      $ref: '#/components/schemas/SnowflakeType';
                    },
                  ];
                };
              };
            };
          };
        };
        required: true;
      };
      responses: {
        '204': {
          description: '204 response for update_self_voice_state';
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
  };
  '/guilds/{guild_id}/members/search': {
    parameters: [
      {
        name: 'guild_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
    ];
    get: {
      operationId: 'search_guild_members';
      parameters: [
        {
          name: 'limit';
          in: 'query';
          schema: {
            type: 'integer';
            minimum: 1;
            maximum: 1000;
          };
          required: true;
        },
        {
          name: 'query';
          in: 'query';
          schema: {
            type: 'string';
            minLength: 1;
            maxLength: 100;
          };
          required: true;
        },
      ];
      responses: {
        '200': {
          description: '200 response for search_guild_members';
          content: {
            'application/json': {
              schema: {
                type: 'array';
                items: {
                  $ref: '#/components/schemas/GuildMemberResponse';
                };
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
  };
  '/guilds/{guild_id}/threads/active': {
    parameters: [
      {
        name: 'guild_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
    ];
    get: {
      operationId: 'get_active_guild_threads';
      responses: {
        '200': {
          description: '200 response for get_active_guild_threads';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ThreadsResponse';
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
  };
  '/guilds/{guild_id}/members/@me': {
    parameters: [
      {
        name: 'guild_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
    ];
    patch: {
      operationId: 'update_my_guild_member';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                nick: {
                  type: ['string', 'null'];
                  maxLength: 32;
                };
              };
            };
          };
        };
        required: true;
      };
      responses: {
        '200': {
          description: '200 response for update_my_guild_member';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PrivateGuildMemberResponse';
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
  };
  '/guilds/{guild_id}/members/{user_id}/roles/{role_id}': {
    parameters: [
      {
        name: 'guild_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
      {
        name: 'user_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
      {
        name: 'role_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
    ];
    put: {
      operationId: 'add_guild_member_role';
      responses: {
        '204': {
          description: '204 response for add_guild_member_role';
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
    delete: {
      operationId: 'delete_guild_member_role';
      responses: {
        '204': {
          description: '204 response for delete_guild_member_role';
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
  };
  '/users/@me/guilds/{guild_id}': {
    parameters: [
      {
        name: 'guild_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
    ];
    delete: {
      operationId: 'leave_guild';
      responses: {
        '204': {
          description: '204 response for leave_guild';
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
  };
  '/applications/{application_id}/commands/{command_id}': {
    parameters: [
      {
        name: 'application_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
      {
        name: 'command_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
    ];
    get: {
      operationId: 'get_application_command';
      responses: {
        '200': {
          description: '200 response for get_application_command';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ApplicationCommandResponse';
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
        {
          OAuth2: ['applications.commands.update'];
        },
      ];
    };
    delete: {
      operationId: 'delete_application_command';
      responses: {
        '204': {
          description: '204 response for delete_application_command';
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
        {
          OAuth2: ['applications.commands.update'];
        },
      ];
    };
    patch: {
      operationId: 'update_application_command';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/ApplicationCommandPatchRequestPartial';
            };
          };
        };
        required: true;
      };
      responses: {
        '200': {
          description: '200 response for update_application_command';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ApplicationCommandResponse';
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
        {
          OAuth2: ['applications.commands.update'];
        },
      ];
    };
  };
  '/applications/{application_id}/commands': {
    parameters: [
      {
        name: 'application_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
    ];
    get: {
      operationId: 'list_application_commands';
      parameters: [
        {
          name: 'with_localizations';
          in: 'query';
          schema: {
            type: 'boolean';
          };
        },
      ];
      responses: {
        '200': {
          description: '200 response for list_application_commands';
          content: {
            'application/json': {
              schema: {
                type: ['array', 'null'];
                items: {
                  $ref: '#/components/schemas/ApplicationCommandResponse';
                };
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
        {
          OAuth2: ['applications.commands.update'];
        },
      ];
    };
    put: {
      operationId: 'bulk_set_application_commands';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: ['array', 'null'];
              items: {
                $ref: '#/components/schemas/ApplicationCommandUpdateRequest';
              };
              maxItems: 110;
            };
          };
        };
        required: true;
      };
      responses: {
        '200': {
          description: '200 response for bulk_set_application_commands';
          content: {
            'application/json': {
              schema: {
                type: ['array', 'null'];
                items: {
                  $ref: '#/components/schemas/ApplicationCommandResponse';
                };
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
        {
          OAuth2: ['applications.commands.update'];
        },
      ];
    };
    post: {
      operationId: 'create_application_command';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/ApplicationCommandCreateRequest';
            };
          };
        };
        required: true;
      };
      responses: {
        '200': {
          description: '200 response for create_application_command';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ApplicationCommandResponse';
              };
            };
          };
        };
        '201': {
          description: '201 response for create_application_command';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ApplicationCommandResponse';
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
        {
          OAuth2: ['applications.commands.update'];
        },
      ];
    };
  };
  '/interactions/{interaction_id}/{interaction_token}/callback': {
    parameters: [
      {
        name: 'interaction_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
      {
        name: 'interaction_token';
        in: 'path';
        schema: {
          type: 'string';
          maxLength: 152133;
        };
        required: true;
      },
    ];
    post: {
      operationId: 'create_interaction_response';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              anyOf: [
                {
                  $ref: '#/components/schemas/ApplicationCommandAutocompleteCallbackRequest';
                },
                {
                  $ref: '#/components/schemas/CreateMessageInteractionCallbackRequest';
                },
                {
                  $ref: '#/components/schemas/ModalInteractionCallbackRequest';
                },
                {
                  $ref: '#/components/schemas/PongInteractionCallbackRequest';
                },
                {
                  $ref: '#/components/schemas/UpdateMessageInteractionCallbackRequest';
                },
              ];
              'x-discord-union': 'oneOf';
            };
          };
          'application/x-www-form-urlencoded': {
            schema: {
              anyOf: [
                {
                  $ref: '#/components/schemas/ApplicationCommandAutocompleteCallbackRequest';
                },
                {
                  $ref: '#/components/schemas/CreateMessageInteractionCallbackRequest';
                },
                {
                  $ref: '#/components/schemas/ModalInteractionCallbackRequest';
                },
                {
                  $ref: '#/components/schemas/PongInteractionCallbackRequest';
                },
                {
                  $ref: '#/components/schemas/UpdateMessageInteractionCallbackRequest';
                },
              ];
              'x-discord-union': 'oneOf';
            };
          };
          'multipart/form-data': {
            schema: {
              anyOf: [
                {
                  $ref: '#/components/schemas/ApplicationCommandAutocompleteCallbackRequest';
                },
                {
                  $ref: '#/components/schemas/CreateMessageInteractionCallbackRequest';
                },
                {
                  $ref: '#/components/schemas/ModalInteractionCallbackRequest';
                },
                {
                  $ref: '#/components/schemas/PongInteractionCallbackRequest';
                },
                {
                  $ref: '#/components/schemas/UpdateMessageInteractionCallbackRequest';
                },
              ];
              'x-discord-union': 'oneOf';
            };
          };
        };
        required: true;
      };
      responses: {
        '204': {
          description: '204 response for create_interaction_response';
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {},
        {
          BotToken: [];
        },
      ];
    };
  };
  '/channels/{channel_id}/thread-members/{user_id}': {
    parameters: [
      {
        name: 'channel_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
      {
        name: 'user_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
    ];
    get: {
      operationId: 'get_thread_member';
      parameters: [
        {
          name: 'with_member';
          in: 'query';
          schema: {
            type: 'boolean';
          };
        },
      ];
      responses: {
        '200': {
          description: '200 response for get_thread_member';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ThreadMemberResponse';
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
    put: {
      operationId: 'add_thread_member';
      responses: {
        '204': {
          description: '204 response for add_thread_member';
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
    delete: {
      operationId: 'delete_thread_member';
      responses: {
        '204': {
          description: '204 response for delete_thread_member';
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
  };
  '/channels/{channel_id}/thread-members': {
    parameters: [
      {
        name: 'channel_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
    ];
    get: {
      operationId: 'list_thread_members';
      parameters: [
        {
          name: 'with_member';
          in: 'query';
          schema: {
            type: 'boolean';
          };
        },
        {
          name: 'limit';
          in: 'query';
          schema: {
            type: 'integer';
            minimum: 1;
            maximum: 100;
          };
        },
        {
          name: 'after';
          in: 'query';
          schema: {
            $ref: '#/components/schemas/SnowflakeType';
          };
        },
      ];
      responses: {
        '200': {
          description: '200 response for list_thread_members';
          content: {
            'application/json': {
              schema: {
                type: 'array';
                items: {
                  $ref: '#/components/schemas/ThreadMemberResponse';
                };
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
  };
  '/channels/{channel_id}/permissions/{overwrite_id}': {
    parameters: [
      {
        name: 'channel_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
      {
        name: 'overwrite_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
    ];
    put: {
      operationId: 'set_channel_permission_overwrite';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                type: {
                  oneOf: [
                    {
                      type: 'null';
                    },
                    {
                      $ref: '#/components/schemas/ChannelPermissionOverwrites';
                    },
                  ];
                };
                allow: {
                  type: ['integer', 'null'];
                };
                deny: {
                  type: ['integer', 'null'];
                };
              };
            };
          };
        };
        required: true;
      };
      responses: {
        '204': {
          description: '204 response for set_channel_permission_overwrite';
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
    delete: {
      operationId: 'delete_channel_permission_overwrite';
      responses: {
        '204': {
          description: '204 response for delete_channel_permission_overwrite';
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
  };
  '/channels/{channel_id}/recipients/{user_id}': {
    parameters: [
      {
        name: 'channel_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
      {
        name: 'user_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
    ];
    put: {
      operationId: 'add_group_dm_user';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                access_token: {
                  type: ['string', 'null'];
                  maxLength: 152133;
                };
                nick: {
                  type: ['string', 'null'];
                  maxLength: 152133;
                };
              };
            };
          };
        };
        required: true;
      };
      responses: {
        '201': {
          description: '201 response for add_group_dm_user';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    $ref: '#/components/schemas/PrivateChannelResponse';
                  },
                  {
                    $ref: '#/components/schemas/PrivateGroupChannelResponse';
                  },
                ];
              };
            };
          };
        };
        '204': {
          description: '204 response for add_group_dm_user';
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
    delete: {
      operationId: 'delete_group_dm_user';
      responses: {
        '204': {
          description: '204 response for delete_group_dm_user';
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
  };
  '/channels/{channel_id}/followers': {
    parameters: [
      {
        name: 'channel_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
    ];
    post: {
      operationId: 'follow_channel';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                webhook_channel_id: {
                  $ref: '#/components/schemas/SnowflakeType';
                };
              };
              required: ['webhook_channel_id'];
            };
          };
        };
        required: true;
      };
      responses: {
        '200': {
          description: '200 response for follow_channel';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ChannelFollowerResponse';
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
  };
  '/channels/{channel_id}/messages/{message_id}': {
    parameters: [
      {
        name: 'channel_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
      {
        name: 'message_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
    ];
    get: {
      operationId: 'get_message';
      responses: {
        '200': {
          description: '200 response for get_message';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/MessageResponse';
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
    delete: {
      operationId: 'delete_message';
      responses: {
        '204': {
          description: '204 response for delete_message';
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
    patch: {
      operationId: 'update_message';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/MessageEditRequestPartial';
            };
          };
          'application/x-www-form-urlencoded': {
            schema: {
              $ref: '#/components/schemas/MessageEditRequestPartial';
            };
          };
          'multipart/form-data': {
            schema: {
              allOf: [
                {
                  $ref: '#/components/schemas/MessageEditRequestPartial';
                },
                {
                  type: 'object';
                  properties: {
                    'files[0]': {
                      type: 'string';
                      contentEncoding: 'binary';
                    };
                    'files[1]': {
                      type: 'string';
                      contentEncoding: 'binary';
                    };
                    'files[2]': {
                      type: 'string';
                      contentEncoding: 'binary';
                    };
                    'files[3]': {
                      type: 'string';
                      contentEncoding: 'binary';
                    };
                    'files[4]': {
                      type: 'string';
                      contentEncoding: 'binary';
                    };
                    'files[5]': {
                      type: 'string';
                      contentEncoding: 'binary';
                    };
                    'files[6]': {
                      type: 'string';
                      contentEncoding: 'binary';
                    };
                    'files[7]': {
                      type: 'string';
                      contentEncoding: 'binary';
                    };
                    'files[8]': {
                      type: 'string';
                      contentEncoding: 'binary';
                    };
                    'files[9]': {
                      type: 'string';
                      contentEncoding: 'binary';
                    };
                  };
                },
              ];
            };
          };
        };
        required: true;
      };
      responses: {
        '200': {
          description: '200 response for update_message';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/MessageResponse';
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
  };
  '/channels/{channel_id}/messages': {
    parameters: [
      {
        name: 'channel_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
    ];
    get: {
      operationId: 'list_messages';
      parameters: [
        {
          name: 'around';
          in: 'query';
          schema: {
            $ref: '#/components/schemas/SnowflakeType';
          };
        },
        {
          name: 'before';
          in: 'query';
          schema: {
            $ref: '#/components/schemas/SnowflakeType';
          };
        },
        {
          name: 'after';
          in: 'query';
          schema: {
            $ref: '#/components/schemas/SnowflakeType';
          };
        },
        {
          name: 'limit';
          in: 'query';
          schema: {
            type: 'integer';
            minimum: 1;
            maximum: 100;
          };
        },
      ];
      responses: {
        '200': {
          description: '200 response for list_messages';
          content: {
            'application/json': {
              schema: {
                type: ['array', 'null'];
                items: {
                  $ref: '#/components/schemas/MessageResponse';
                };
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
    post: {
      operationId: 'create_message';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/MessageCreateRequest';
            };
          };
          'application/x-www-form-urlencoded': {
            schema: {
              $ref: '#/components/schemas/MessageCreateRequest';
            };
          };
          'multipart/form-data': {
            schema: {
              allOf: [
                {
                  $ref: '#/components/schemas/MessageCreateRequest';
                },
                {
                  type: 'object';
                  properties: {
                    'files[0]': {
                      type: 'string';
                      contentEncoding: 'binary';
                    };
                    'files[1]': {
                      type: 'string';
                      contentEncoding: 'binary';
                    };
                    'files[2]': {
                      type: 'string';
                      contentEncoding: 'binary';
                    };
                    'files[3]': {
                      type: 'string';
                      contentEncoding: 'binary';
                    };
                    'files[4]': {
                      type: 'string';
                      contentEncoding: 'binary';
                    };
                    'files[5]': {
                      type: 'string';
                      contentEncoding: 'binary';
                    };
                    'files[6]': {
                      type: 'string';
                      contentEncoding: 'binary';
                    };
                    'files[7]': {
                      type: 'string';
                      contentEncoding: 'binary';
                    };
                    'files[8]': {
                      type: 'string';
                      contentEncoding: 'binary';
                    };
                    'files[9]': {
                      type: 'string';
                      contentEncoding: 'binary';
                    };
                  };
                },
              ];
            };
          };
        };
        required: true;
      };
      responses: {
        '200': {
          description: '200 response for create_message';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/MessageResponse';
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
  };
  '/channels/{channel_id}/webhooks': {
    parameters: [
      {
        name: 'channel_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
    ];
    get: {
      operationId: 'list_channel_webhooks';
      responses: {
        '200': {
          description: '200 response for list_channel_webhooks';
          content: {
            'application/json': {
              schema: {
                type: ['array', 'null'];
                items: {
                  oneOf: [
                    {
                      $ref: '#/components/schemas/ApplicationIncomingWebhookResponse';
                    },
                    {
                      $ref: '#/components/schemas/ChannelFollowerWebhookResponse';
                    },
                    {
                      $ref: '#/components/schemas/GuildIncomingWebhookResponse';
                    },
                  ];
                };
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
    post: {
      operationId: 'create_webhook';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                name: {
                  type: 'string';
                  minLength: 1;
                  maxLength: 80;
                };
                avatar: {
                  type: ['string', 'null'];
                  contentEncoding: 'base64';
                };
              };
              required: ['name'];
            };
          };
        };
        required: true;
      };
      responses: {
        '200': {
          description: '200 response for create_webhook';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/GuildIncomingWebhookResponse';
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
  };
  '/channels/{channel_id}/invites': {
    parameters: [
      {
        name: 'channel_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
    ];
    get: {
      operationId: 'list_channel_invites';
      responses: {
        '200': {
          description: '200 response for list_channel_invites';
          content: {
            'application/json': {
              schema: {
                type: ['array', 'null'];
                items: {
                  anyOf: [
                    {
                      $ref: '#/components/schemas/FriendInviteResponse';
                    },
                    {
                      $ref: '#/components/schemas/GroupDMInviteResponse';
                    },
                    {
                      $ref: '#/components/schemas/GuildInviteResponse';
                    },
                  ];
                  'x-discord-union': 'oneOf';
                };
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
    post: {
      operationId: 'create_channel_invite';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              anyOf: [
                {
                  $ref: '#/components/schemas/CreateGroupDMInviteRequest';
                },
                {
                  $ref: '#/components/schemas/CreateGuildInviteRequest';
                },
              ];
              'x-discord-union': 'oneOf';
            };
          };
        };
        required: true;
      };
      responses: {
        '200': {
          description: '200 response for create_channel_invite';
          content: {
            'application/json': {
              schema: {
                anyOf: [
                  {
                    $ref: '#/components/schemas/FriendInviteResponse';
                  },
                  {
                    $ref: '#/components/schemas/GroupDMInviteResponse';
                  },
                  {
                    $ref: '#/components/schemas/GuildInviteResponse';
                  },
                ];
                'x-discord-union': 'oneOf';
              };
            };
          };
        };
        '204': {
          description: '204 response for create_channel_invite';
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
  };
  '/channels/{channel_id}/threads': {
    parameters: [
      {
        name: 'channel_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
    ];
    post: {
      operationId: 'create_thread';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              anyOf: [
                {
                  $ref: '#/components/schemas/CreateForumThreadRequest';
                },
                {
                  $ref: '#/components/schemas/CreateTextThreadWithoutMessageRequest';
                },
              ];
              'x-discord-union': 'oneOf';
            };
          };
          'application/x-www-form-urlencoded': {
            schema: {
              anyOf: [
                {
                  $ref: '#/components/schemas/CreateForumThreadRequest';
                },
                {
                  $ref: '#/components/schemas/CreateTextThreadWithoutMessageRequest';
                },
              ];
              'x-discord-union': 'oneOf';
            };
          };
          'multipart/form-data': {
            schema: {
              anyOf: [
                {
                  $ref: '#/components/schemas/CreateForumThreadRequest';
                },
                {
                  $ref: '#/components/schemas/CreateTextThreadWithoutMessageRequest';
                },
              ];
              'x-discord-union': 'oneOf';
            };
          };
        };
        required: true;
      };
      responses: {
        '201': {
          description: '201 response for create_thread';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CreatedThreadResponse';
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
  };
  '/channels/{channel_id}/typing': {
    parameters: [
      {
        name: 'channel_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
    ];
    post: {
      operationId: 'trigger_typing_indicator';
      responses: {
        '200': {
          description: '200 response for trigger_typing_indicator';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/TypingIndicatorResponse';
              };
            };
          };
        };
        '204': {
          description: '204 response for trigger_typing_indicator';
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
  };
  '/channels/{channel_id}/pins/{message_id}': {
    parameters: [
      {
        name: 'channel_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
      {
        name: 'message_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
    ];
    put: {
      operationId: 'pin_message';
      responses: {
        '204': {
          description: '204 response for pin_message';
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
    delete: {
      operationId: 'unpin_message';
      responses: {
        '204': {
          description: '204 response for unpin_message';
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
  };
  '/channels/{channel_id}/pins': {
    parameters: [
      {
        name: 'channel_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
    ];
    get: {
      operationId: 'list_pinned_messages';
      responses: {
        '200': {
          description: '200 response for list_pinned_messages';
          content: {
            'application/json': {
              schema: {
                type: ['array', 'null'];
                items: {
                  $ref: '#/components/schemas/MessageResponse';
                };
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
  };
  '/webhooks/{webhook_id}/{webhook_token}/messages/{message_id}': {
    parameters: [
      {
        name: 'webhook_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
      {
        name: 'webhook_token';
        in: 'path';
        schema: {
          type: 'string';
          maxLength: 152133;
        };
        required: true;
      },
      {
        name: 'message_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
    ];
    get: {
      operationId: 'get_webhook_message';
      parameters: [
        {
          name: 'thread_id';
          in: 'query';
          schema: {
            $ref: '#/components/schemas/SnowflakeType';
          };
        },
      ];
      responses: {
        '200': {
          description: '200 response for get_webhook_message';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/MessageResponse';
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {},
        {
          BotToken: [];
        },
      ];
    };
    delete: {
      operationId: 'delete_webhook_message';
      parameters: [
        {
          name: 'thread_id';
          in: 'query';
          schema: {
            $ref: '#/components/schemas/SnowflakeType';
          };
        },
      ];
      responses: {
        '204': {
          description: '204 response for delete_webhook_message';
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {},
        {
          BotToken: [];
        },
      ];
    };
    patch: {
      operationId: 'update_webhook_message';
      parameters: [
        {
          name: 'thread_id';
          in: 'query';
          schema: {
            $ref: '#/components/schemas/SnowflakeType';
          };
        },
      ];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/IncomingWebhookUpdateRequestPartial';
            };
          };
          'application/x-www-form-urlencoded': {
            schema: {
              $ref: '#/components/schemas/IncomingWebhookUpdateRequestPartial';
            };
          };
          'multipart/form-data': {
            schema: {
              allOf: [
                {
                  $ref: '#/components/schemas/IncomingWebhookUpdateRequestPartial';
                },
                {
                  type: 'object';
                  properties: {
                    'files[0]': {
                      type: 'string';
                      contentEncoding: 'binary';
                    };
                    'files[1]': {
                      type: 'string';
                      contentEncoding: 'binary';
                    };
                    'files[2]': {
                      type: 'string';
                      contentEncoding: 'binary';
                    };
                    'files[3]': {
                      type: 'string';
                      contentEncoding: 'binary';
                    };
                    'files[4]': {
                      type: 'string';
                      contentEncoding: 'binary';
                    };
                    'files[5]': {
                      type: 'string';
                      contentEncoding: 'binary';
                    };
                    'files[6]': {
                      type: 'string';
                      contentEncoding: 'binary';
                    };
                    'files[7]': {
                      type: 'string';
                      contentEncoding: 'binary';
                    };
                    'files[8]': {
                      type: 'string';
                      contentEncoding: 'binary';
                    };
                    'files[9]': {
                      type: 'string';
                      contentEncoding: 'binary';
                    };
                  };
                },
              ];
            };
          };
        };
        required: true;
      };
      responses: {
        '200': {
          description: '200 response for update_webhook_message';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/MessageResponse';
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {},
        {
          BotToken: [];
        },
      ];
    };
  };
  '/webhooks/{webhook_id}/{webhook_token}/github': {
    parameters: [
      {
        name: 'webhook_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
      {
        name: 'webhook_token';
        in: 'path';
        schema: {
          type: 'string';
          maxLength: 152133;
        };
        required: true;
      },
    ];
    post: {
      operationId: 'execute_github_compatible_webhook';
      parameters: [
        {
          name: 'wait';
          in: 'query';
          schema: {
            type: 'boolean';
          };
        },
        {
          name: 'thread_id';
          in: 'query';
          schema: {
            $ref: '#/components/schemas/SnowflakeType';
          };
        },
      ];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/GithubWebhook';
            };
          };
        };
        required: true;
      };
      responses: {
        '204': {
          description: '204 response for execute_github_compatible_webhook';
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {},
        {
          BotToken: [];
        },
      ];
    };
  };
  '/webhooks/{webhook_id}/{webhook_token}/slack': {
    parameters: [
      {
        name: 'webhook_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
      {
        name: 'webhook_token';
        in: 'path';
        schema: {
          type: 'string';
          maxLength: 152133;
        };
        required: true;
      },
    ];
    post: {
      operationId: 'execute_slack_compatible_webhook';
      parameters: [
        {
          name: 'wait';
          in: 'query';
          schema: {
            type: 'boolean';
          };
        },
        {
          name: 'thread_id';
          in: 'query';
          schema: {
            $ref: '#/components/schemas/SnowflakeType';
          };
        },
      ];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/SlackWebhook';
            };
          };
          'application/x-www-form-urlencoded': {
            schema: {
              $ref: '#/components/schemas/SlackWebhook';
            };
          };
          'multipart/form-data': {
            schema: {
              $ref: '#/components/schemas/SlackWebhook';
            };
          };
        };
        required: true;
      };
      responses: {
        '200': {
          description: '200 response for execute_slack_compatible_webhook';
          content: {
            'application/json': {
              schema: {
                type: ['string', 'null'];
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {},
        {
          BotToken: [];
        },
      ];
    };
  };
  '/guilds/templates/{code}': {
    parameters: [
      {
        name: 'code';
        in: 'path';
        schema: {
          type: 'string';
          maxLength: 152133;
        };
        required: true;
      },
    ];
    get: {
      operationId: 'get_guild_template';
      responses: {
        '200': {
          description: '200 response for get_guild_template';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/GuildTemplateResponse';
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {},
        {
          BotToken: [];
        },
      ];
    };
    post: {
      operationId: 'create_guild_from_template';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                name: {
                  type: 'string';
                  minLength: 2;
                  maxLength: 100;
                };
                icon: {
                  type: ['string', 'null'];
                  contentEncoding: 'base64';
                };
              };
              required: ['name'];
            };
          };
        };
        required: true;
      };
      responses: {
        '201': {
          description: '201 response for create_guild_from_template';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/GuildResponse';
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
  };
  '/guilds/{guild_id}/new-member-welcome': {
    parameters: [
      {
        name: 'guild_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
    ];
    get: {
      operationId: 'get_guild_new_member_welcome';
      responses: {
        '200': {
          description: '200 response for get_guild_new_member_welcome';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/GuildHomeSettingsResponse';
              };
            };
          };
        };
        '204': {
          description: '204 response for get_guild_new_member_welcome';
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
  };
  '/guilds/{guild_id}/scheduled-events/{guild_scheduled_event_id}': {
    parameters: [
      {
        name: 'guild_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
      {
        name: 'guild_scheduled_event_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
    ];
    get: {
      operationId: 'get_guild_scheduled_event';
      parameters: [
        {
          name: 'with_user_count';
          in: 'query';
          schema: {
            type: 'boolean';
          };
        },
      ];
      responses: {
        '200': {
          description: '200 response for get_guild_scheduled_event';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    $ref: '#/components/schemas/ExternalScheduledEventResponse';
                  },
                  {
                    $ref: '#/components/schemas/StageScheduledEventResponse';
                  },
                  {
                    $ref: '#/components/schemas/VoiceScheduledEventResponse';
                  },
                ];
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
    delete: {
      operationId: 'delete_guild_scheduled_event';
      responses: {
        '204': {
          description: '204 response for delete_guild_scheduled_event';
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
    patch: {
      operationId: 'update_guild_scheduled_event';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              anyOf: [
                {
                  $ref: '#/components/schemas/ExternalScheduledEventPatchRequestPartial';
                },
                {
                  $ref: '#/components/schemas/StageScheduledEventPatchRequestPartial';
                },
                {
                  $ref: '#/components/schemas/VoiceScheduledEventPatchRequestPartial';
                },
              ];
              'x-discord-union': 'oneOf';
            };
          };
        };
        required: true;
      };
      responses: {
        '200': {
          description: '200 response for update_guild_scheduled_event';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    $ref: '#/components/schemas/ExternalScheduledEventResponse';
                  },
                  {
                    $ref: '#/components/schemas/StageScheduledEventResponse';
                  },
                  {
                    $ref: '#/components/schemas/VoiceScheduledEventResponse';
                  },
                ];
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
  };
  '/guilds/{guild_id}/scheduled-events': {
    parameters: [
      {
        name: 'guild_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
    ];
    get: {
      operationId: 'list_guild_scheduled_events';
      parameters: [
        {
          name: 'with_user_count';
          in: 'query';
          schema: {
            type: 'boolean';
          };
        },
      ];
      responses: {
        '200': {
          description: '200 response for list_guild_scheduled_events';
          content: {
            'application/json': {
              schema: {
                type: ['array', 'null'];
                items: {
                  oneOf: [
                    {
                      $ref: '#/components/schemas/ExternalScheduledEventResponse';
                    },
                    {
                      $ref: '#/components/schemas/StageScheduledEventResponse';
                    },
                    {
                      $ref: '#/components/schemas/VoiceScheduledEventResponse';
                    },
                  ];
                };
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
    post: {
      operationId: 'create_guild_scheduled_event';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              oneOf: [
                {
                  $ref: '#/components/schemas/ExternalScheduledEventCreateRequest';
                },
                {
                  $ref: '#/components/schemas/StageScheduledEventCreateRequest';
                },
                {
                  $ref: '#/components/schemas/VoiceScheduledEventCreateRequest';
                },
              ];
            };
          };
        };
        required: true;
      };
      responses: {
        '200': {
          description: '200 response for create_guild_scheduled_event';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    $ref: '#/components/schemas/ExternalScheduledEventResponse';
                  },
                  {
                    $ref: '#/components/schemas/StageScheduledEventResponse';
                  },
                  {
                    $ref: '#/components/schemas/VoiceScheduledEventResponse';
                  },
                ];
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
  };
  '/guilds/{guild_id}/welcome-screen': {
    parameters: [
      {
        name: 'guild_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
    ];
    get: {
      operationId: 'get_guild_welcome_screen';
      responses: {
        '200': {
          description: '200 response for get_guild_welcome_screen';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/GuildWelcomeScreenResponse';
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
    patch: {
      operationId: 'update_guild_welcome_screen';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/WelcomeScreenPatchRequestPartial';
            };
          };
        };
        required: true;
      };
      responses: {
        '200': {
          description: '200 response for update_guild_welcome_screen';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/GuildWelcomeScreenResponse';
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
  };
  '/guilds/{guild_id}/voice-states/{user_id}': {
    parameters: [
      {
        name: 'guild_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
      {
        name: 'user_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
    ];
    patch: {
      operationId: 'update_voice_state';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                suppress: {
                  type: ['boolean', 'null'];
                };
                channel_id: {
                  oneOf: [
                    {
                      type: 'null';
                    },
                    {
                      $ref: '#/components/schemas/SnowflakeType';
                    },
                  ];
                };
              };
            };
          };
        };
        required: true;
      };
      responses: {
        '204': {
          description: '204 response for update_voice_state';
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
  };
  '/guilds/{guild_id}/integrations/{integration_id}': {
    parameters: [
      {
        name: 'guild_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
      {
        name: 'integration_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
    ];
    delete: {
      operationId: 'delete_guild_integration';
      responses: {
        '204': {
          description: '204 response for delete_guild_integration';
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
  };
  '/guilds/{guild_id}/integrations': {
    parameters: [
      {
        name: 'guild_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
    ];
    get: {
      operationId: 'list_guild_integrations';
      responses: {
        '200': {
          description: '200 response for list_guild_integrations';
          content: {
            'application/json': {
              schema: {
                type: ['array', 'null'];
                items: {
                  oneOf: [
                    {
                      $ref: '#/components/schemas/DiscordIntegrationResponse';
                    },
                    {
                      $ref: '#/components/schemas/ExternalConnectionIntegrationResponse';
                    },
                    {
                      $ref: '#/components/schemas/GuildSubscriptionIntegrationResponse';
                    },
                  ];
                };
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
  };
  '/guilds/{guild_id}/widget.json': {
    parameters: [
      {
        name: 'guild_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
    ];
    get: {
      operationId: 'get_guild_widget';
      responses: {
        '200': {
          description: '200 response for get_guild_widget';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/WidgetResponse';
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {},
        {
          BotToken: [];
        },
      ];
    };
  };
  '/guilds/{guild_id}/onboarding': {
    parameters: [
      {
        name: 'guild_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
    ];
    get: {
      operationId: 'get_guilds_onboarding';
      responses: {
        '200': {
          description: '200 response for get_guilds_onboarding';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/UserGuildOnboardingResponse';
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
    put: {
      operationId: 'put_guilds_onboarding';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/UpdateGuildOnboardingRequest';
            };
          };
        };
        required: true;
      };
      responses: {
        '200': {
          description: '200 response for put_guilds_onboarding';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/GuildOnboardingResponse';
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
  };
  '/guilds/{guild_id}/vanity-url': {
    parameters: [
      {
        name: 'guild_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
    ];
    get: {
      operationId: 'get_guild_vanity_url';
      responses: {
        '200': {
          description: '200 response for get_guild_vanity_url';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/VanityURLResponse';
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
  };
  '/guilds/{guild_id}/audit-logs': {
    parameters: [
      {
        name: 'guild_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
    ];
    get: {
      operationId: 'list_guild_audit_log_entries';
      parameters: [
        {
          name: 'user_id';
          in: 'query';
          schema: {
            $ref: '#/components/schemas/SnowflakeType';
          };
        },
        {
          name: 'action_type';
          in: 'query';
          schema: {
            type: 'integer';
          };
        },
        {
          name: 'before';
          in: 'query';
          schema: {
            $ref: '#/components/schemas/SnowflakeType';
          };
        },
        {
          name: 'after';
          in: 'query';
          schema: {
            $ref: '#/components/schemas/SnowflakeType';
          };
        },
        {
          name: 'limit';
          in: 'query';
          schema: {
            type: 'integer';
            minimum: 1;
            maximum: 100;
          };
        },
      ];
      responses: {
        '200': {
          description: '200 response for list_guild_audit_log_entries';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/GuildAuditLogResponse';
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
  };
  '/guilds/{guild_id}/widget.png': {
    parameters: [
      {
        name: 'guild_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
    ];
    get: {
      operationId: 'get_guild_widget_png';
      parameters: [
        {
          name: 'style';
          in: 'query';
          schema: {
            $ref: '#/components/schemas/WidgetImageStyles';
          };
        },
      ];
      responses: {
        '200': {
          description: '200 response for get_guild_widget_png';
          content: {
            'image/png': {
              schema: {
                type: 'string';
                contentEncoding: 'binary';
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {},
        {
          BotToken: [];
        },
      ];
    };
  };
  '/guilds/{guild_id}/templates/{code}': {
    parameters: [
      {
        name: 'guild_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
      {
        name: 'code';
        in: 'path';
        schema: {
          type: 'string';
          maxLength: 152133;
        };
        required: true;
      },
    ];
    put: {
      operationId: 'sync_guild_template';
      responses: {
        '200': {
          description: '200 response for sync_guild_template';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/GuildTemplateResponse';
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
    delete: {
      operationId: 'delete_guild_template';
      responses: {
        '200': {
          description: '200 response for delete_guild_template';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/GuildTemplateResponse';
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
    patch: {
      operationId: 'update_guild_template';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                name: {
                  type: 'string';
                  minLength: 1;
                  maxLength: 100;
                };
                description: {
                  type: ['string', 'null'];
                  maxLength: 120;
                };
              };
            };
          };
        };
        required: true;
      };
      responses: {
        '200': {
          description: '200 response for update_guild_template';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/GuildTemplateResponse';
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
  };
  '/guilds/{guild_id}/templates': {
    parameters: [
      {
        name: 'guild_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
    ];
    get: {
      operationId: 'list_guild_templates';
      responses: {
        '200': {
          description: '200 response for list_guild_templates';
          content: {
            'application/json': {
              schema: {
                type: ['array', 'null'];
                items: {
                  $ref: '#/components/schemas/GuildTemplateResponse';
                };
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
    post: {
      operationId: 'create_guild_template';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                name: {
                  type: 'string';
                  minLength: 1;
                  maxLength: 100;
                };
                description: {
                  type: ['string', 'null'];
                  maxLength: 120;
                };
              };
              required: ['name'];
            };
          };
        };
        required: true;
      };
      responses: {
        '200': {
          description: '200 response for create_guild_template';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/GuildTemplateResponse';
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
  };
  '/guilds/{guild_id}/stickers/{sticker_id}': {
    parameters: [
      {
        name: 'guild_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
      {
        name: 'sticker_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
    ];
    get: {
      operationId: 'get_guild_sticker';
      responses: {
        '200': {
          description: '200 response for get_guild_sticker';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/GuildStickerResponse';
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
    delete: {
      operationId: 'delete_guild_sticker';
      responses: {
        '204': {
          description: '204 response for delete_guild_sticker';
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
    patch: {
      operationId: 'update_guild_sticker';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                name: {
                  type: 'string';
                  minLength: 2;
                  maxLength: 30;
                };
                tags: {
                  type: 'string';
                  minLength: 1;
                  maxLength: 200;
                };
                description: {
                  type: ['string', 'null'];
                  maxLength: 100;
                };
              };
            };
          };
        };
        required: true;
      };
      responses: {
        '200': {
          description: '200 response for update_guild_sticker';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/GuildStickerResponse';
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
  };
  '/guilds/{guild_id}/stickers': {
    parameters: [
      {
        name: 'guild_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
    ];
    get: {
      operationId: 'list_guild_stickers';
      responses: {
        '200': {
          description: '200 response for list_guild_stickers';
          content: {
            'application/json': {
              schema: {
                type: 'array';
                items: {
                  $ref: '#/components/schemas/GuildStickerResponse';
                };
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
    post: {
      operationId: 'create_guild_sticker';
      requestBody: {
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object';
              properties: {
                name: {
                  type: 'string';
                  minLength: 2;
                  maxLength: 30;
                };
                tags: {
                  type: 'string';
                  minLength: 1;
                  maxLength: 200;
                };
                description: {
                  type: ['string', 'null'];
                  maxLength: 100;
                };
                file: {
                  type: 'string';
                  contentEncoding: 'binary';
                };
              };
              required: ['name', 'tags', 'file'];
            };
          };
        };
        required: true;
      };
      responses: {
        '201': {
          description: '201 response for create_guild_sticker';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/GuildStickerResponse';
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
  };
  '/guilds/{guild_id}/webhooks': {
    parameters: [
      {
        name: 'guild_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
    ];
    get: {
      operationId: 'get_guild_webhooks';
      responses: {
        '200': {
          description: '200 response for get_guild_webhooks';
          content: {
            'application/json': {
              schema: {
                type: ['array', 'null'];
                items: {
                  oneOf: [
                    {
                      $ref: '#/components/schemas/ApplicationIncomingWebhookResponse';
                    },
                    {
                      $ref: '#/components/schemas/ChannelFollowerWebhookResponse';
                    },
                    {
                      $ref: '#/components/schemas/GuildIncomingWebhookResponse';
                    },
                  ];
                };
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
  };
  '/guilds/{guild_id}/channels': {
    parameters: [
      {
        name: 'guild_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
    ];
    get: {
      operationId: 'list_guild_channels';
      responses: {
        '200': {
          description: '200 response for list_guild_channels';
          content: {
            'application/json': {
              schema: {
                type: ['array', 'null'];
                items: {
                  oneOf: [
                    {
                      $ref: '#/components/schemas/GuildChannelResponse';
                    },
                    {
                      $ref: '#/components/schemas/PrivateChannelResponse';
                    },
                    {
                      $ref: '#/components/schemas/PrivateGroupChannelResponse';
                    },
                    {
                      $ref: '#/components/schemas/ThreadResponse';
                    },
                  ];
                };
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
    post: {
      operationId: 'create_guild_channel';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/CreateGuildChannelRequest';
            };
          };
        };
        required: true;
      };
      responses: {
        '201': {
          description: '201 response for create_guild_channel';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/GuildChannelResponse';
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
    patch: {
      operationId: 'bulk_update_guild_channels';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'array';
              items: {
                type: 'object';
                properties: {
                  id: {
                    $ref: '#/components/schemas/SnowflakeType';
                  };
                  position: {
                    type: ['integer', 'null'];
                    minimum: 0;
                    format: 'int32';
                  };
                  parent_id: {
                    oneOf: [
                      {
                        type: 'null';
                      },
                      {
                        $ref: '#/components/schemas/SnowflakeType';
                      },
                    ];
                  };
                  lock_permissions: {
                    type: ['boolean', 'null'];
                  };
                };
              };
            };
          };
        };
        required: true;
      };
      responses: {
        '204': {
          description: '204 response for bulk_update_guild_channels';
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
  };
  '/guilds/{guild_id}/members/{user_id}': {
    parameters: [
      {
        name: 'guild_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
      {
        name: 'user_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
    ];
    get: {
      operationId: 'get_guild_member';
      responses: {
        '200': {
          description: '200 response for get_guild_member';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/GuildMemberResponse';
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
    put: {
      operationId: 'add_guild_member';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                nick: {
                  type: ['string', 'null'];
                  maxLength: 32;
                };
                roles: {
                  type: ['array', 'null'];
                  items: {
                    oneOf: [
                      {
                        type: 'null';
                      },
                      {
                        $ref: '#/components/schemas/SnowflakeType';
                      },
                    ];
                  };
                  maxItems: 1521;
                  uniqueItems: true;
                };
                mute: {
                  type: ['boolean', 'null'];
                };
                deaf: {
                  type: ['boolean', 'null'];
                };
                access_token: {
                  type: 'string';
                  maxLength: 152133;
                };
                flags: {
                  type: ['integer', 'null'];
                };
              };
              required: ['access_token'];
            };
          };
        };
        required: true;
      };
      responses: {
        '201': {
          description: '201 response for add_guild_member';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/GuildMemberResponse';
              };
            };
          };
        };
        '204': {
          description: '204 response for add_guild_member';
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
    delete: {
      operationId: 'delete_guild_member';
      responses: {
        '204': {
          description: '204 response for delete_guild_member';
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
    patch: {
      operationId: 'update_guild_member';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                nick: {
                  type: ['string', 'null'];
                  maxLength: 32;
                };
                roles: {
                  type: ['array', 'null'];
                  items: {
                    oneOf: [
                      {
                        type: 'null';
                      },
                      {
                        $ref: '#/components/schemas/SnowflakeType';
                      },
                    ];
                  };
                  maxItems: 1521;
                  uniqueItems: true;
                };
                mute: {
                  type: ['boolean', 'null'];
                };
                deaf: {
                  type: ['boolean', 'null'];
                };
                channel_id: {
                  oneOf: [
                    {
                      type: 'null';
                    },
                    {
                      $ref: '#/components/schemas/SnowflakeType';
                    },
                  ];
                };
                communication_disabled_until: {
                  type: ['string', 'null'];
                  format: 'date-time';
                };
                flags: {
                  type: ['integer', 'null'];
                };
              };
            };
          };
        };
        required: true;
      };
      responses: {
        '200': {
          description: '200 response for update_guild_member';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/GuildMemberResponse';
              };
            };
          };
        };
        '204': {
          description: '204 response for update_guild_member';
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
  };
  '/guilds/{guild_id}/members': {
    parameters: [
      {
        name: 'guild_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
    ];
    get: {
      operationId: 'list_guild_members';
      parameters: [
        {
          name: 'limit';
          in: 'query';
          schema: {
            type: 'integer';
            minimum: 1;
            maximum: 1000;
          };
        },
        {
          name: 'after';
          in: 'query';
          schema: {
            type: 'integer';
            minimum: 0;
          };
        },
      ];
      responses: {
        '200': {
          description: '200 response for list_guild_members';
          content: {
            'application/json': {
              schema: {
                type: 'array';
                items: {
                  $ref: '#/components/schemas/GuildMemberResponse';
                };
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
  };
  '/guilds/{guild_id}/preview': {
    parameters: [
      {
        name: 'guild_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
    ];
    get: {
      operationId: 'get_guild_preview';
      responses: {
        '200': {
          description: '200 response for get_guild_preview';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/GuildPreviewResponse';
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
  };
  '/guilds/{guild_id}/invites': {
    parameters: [
      {
        name: 'guild_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
    ];
    get: {
      operationId: 'list_guild_invites';
      responses: {
        '200': {
          description: '200 response for list_guild_invites';
          content: {
            'application/json': {
              schema: {
                type: ['array', 'null'];
                items: {
                  anyOf: [
                    {
                      $ref: '#/components/schemas/FriendInviteResponse';
                    },
                    {
                      $ref: '#/components/schemas/GroupDMInviteResponse';
                    },
                    {
                      $ref: '#/components/schemas/GuildInviteResponse';
                    },
                  ];
                  'x-discord-union': 'oneOf';
                };
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
  };
  '/guilds/{guild_id}/regions': {
    parameters: [
      {
        name: 'guild_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
    ];
    get: {
      operationId: 'list_guild_voice_regions';
      responses: {
        '200': {
          description: '200 response for list_guild_voice_regions';
          content: {
            'application/json': {
              schema: {
                type: ['array', 'null'];
                items: {
                  $ref: '#/components/schemas/VoiceRegionResponse';
                };
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
  };
  '/guilds/{guild_id}/emojis/{emoji_id}': {
    parameters: [
      {
        name: 'guild_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
      {
        name: 'emoji_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
    ];
    get: {
      operationId: 'get_guild_emoji';
      responses: {
        '200': {
          description: '200 response for get_guild_emoji';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/EmojiResponse';
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
    delete: {
      operationId: 'delete_guild_emoji';
      responses: {
        '204': {
          description: '204 response for delete_guild_emoji';
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
    patch: {
      operationId: 'update_guild_emoji';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                name: {
                  type: 'string';
                  minLength: 2;
                  maxLength: 32;
                };
                roles: {
                  type: ['array', 'null'];
                  items: {
                    oneOf: [
                      {
                        type: 'null';
                      },
                      {
                        $ref: '#/components/schemas/SnowflakeType';
                      },
                    ];
                  };
                  maxItems: 1521;
                  uniqueItems: true;
                };
              };
            };
          };
        };
        required: true;
      };
      responses: {
        '200': {
          description: '200 response for update_guild_emoji';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/EmojiResponse';
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
  };
  '/guilds/{guild_id}/emojis': {
    parameters: [
      {
        name: 'guild_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
    ];
    get: {
      operationId: 'list_guild_emojis';
      responses: {
        '200': {
          description: '200 response for list_guild_emojis';
          content: {
            'application/json': {
              schema: {
                type: ['array', 'null'];
                items: {
                  $ref: '#/components/schemas/EmojiResponse';
                };
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
    post: {
      operationId: 'create_guild_emoji';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                name: {
                  type: 'string';
                  minLength: 2;
                  maxLength: 32;
                };
                image: {
                  type: 'string';
                  contentEncoding: 'base64';
                };
                roles: {
                  type: ['array', 'null'];
                  items: {
                    oneOf: [
                      {
                        type: 'null';
                      },
                      {
                        $ref: '#/components/schemas/SnowflakeType';
                      },
                    ];
                  };
                  maxItems: 1521;
                  uniqueItems: true;
                };
              };
              required: ['name', 'image'];
            };
          };
        };
        required: true;
      };
      responses: {
        '201': {
          description: '201 response for create_guild_emoji';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/EmojiResponse';
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
  };
  '/guilds/{guild_id}/widget': {
    parameters: [
      {
        name: 'guild_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
    ];
    get: {
      operationId: 'get_guild_widget_settings';
      responses: {
        '200': {
          description: '200 response for get_guild_widget_settings';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/WidgetSettingsResponse';
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
    patch: {
      operationId: 'update_guild_widget_settings';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                channel_id: {
                  oneOf: [
                    {
                      type: 'null';
                    },
                    {
                      $ref: '#/components/schemas/SnowflakeType';
                    },
                  ];
                };
                enabled: {
                  type: ['boolean', 'null'];
                };
              };
            };
          };
        };
        required: true;
      };
      responses: {
        '200': {
          description: '200 response for update_guild_widget_settings';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/WidgetSettingsResponse';
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
  };
  '/guilds/{guild_id}/roles/{role_id}': {
    parameters: [
      {
        name: 'guild_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
      {
        name: 'role_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
    ];
    delete: {
      operationId: 'delete_guild_role';
      responses: {
        '204': {
          description: '204 response for delete_guild_role';
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
    patch: {
      operationId: 'update_guild_role';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                name: {
                  type: ['string', 'null'];
                  maxLength: 100;
                };
                permissions: {
                  type: ['integer', 'null'];
                };
                color: {
                  type: ['integer', 'null'];
                  minimum: 0;
                  maximum: 16777215;
                };
                hoist: {
                  type: ['boolean', 'null'];
                };
                mentionable: {
                  type: ['boolean', 'null'];
                };
                icon: {
                  type: ['string', 'null'];
                  contentEncoding: 'base64';
                };
                unicode_emoji: {
                  type: ['string', 'null'];
                  maxLength: 100;
                };
              };
            };
          };
        };
        required: true;
      };
      responses: {
        '200': {
          description: '200 response for update_guild_role';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/GuildRoleResponse';
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
  };
  '/guilds/{guild_id}/roles': {
    parameters: [
      {
        name: 'guild_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
    ];
    get: {
      operationId: 'list_guild_roles';
      responses: {
        '200': {
          description: '200 response for list_guild_roles';
          content: {
            'application/json': {
              schema: {
                type: 'array';
                items: {
                  $ref: '#/components/schemas/GuildRoleResponse';
                };
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
    post: {
      operationId: 'create_guild_role';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                name: {
                  type: ['string', 'null'];
                  maxLength: 100;
                };
                permissions: {
                  type: ['integer', 'null'];
                };
                color: {
                  type: ['integer', 'null'];
                  minimum: 0;
                  maximum: 16777215;
                };
                hoist: {
                  type: ['boolean', 'null'];
                };
                mentionable: {
                  type: ['boolean', 'null'];
                };
                icon: {
                  type: ['string', 'null'];
                  contentEncoding: 'base64';
                };
                unicode_emoji: {
                  type: ['string', 'null'];
                  maxLength: 100;
                };
              };
            };
          };
        };
        required: true;
      };
      responses: {
        '200': {
          description: '200 response for create_guild_role';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/GuildRoleResponse';
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
    patch: {
      operationId: 'bulk_update_guild_roles';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'array';
              items: {
                type: 'object';
                properties: {
                  id: {
                    oneOf: [
                      {
                        type: 'null';
                      },
                      {
                        $ref: '#/components/schemas/SnowflakeType';
                      },
                    ];
                  };
                  position: {
                    type: ['integer', 'null'];
                    format: 'int32';
                  };
                };
              };
            };
          };
        };
        required: true;
      };
      responses: {
        '200': {
          description: '200 response for bulk_update_guild_roles';
          content: {
            'application/json': {
              schema: {
                type: 'array';
                items: {
                  $ref: '#/components/schemas/GuildRoleResponse';
                };
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
  };
  '/guilds/{guild_id}/prune': {
    parameters: [
      {
        name: 'guild_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
    ];
    get: {
      operationId: 'preview_prune_guild';
      parameters: [
        {
          name: 'days';
          in: 'query';
          schema: {
            type: 'integer';
            minimum: 1;
            maximum: 30;
          };
        },
        {
          name: 'include_roles';
          in: 'query';
          schema: {
            oneOf: [
              {
                type: 'string';
              },
              {
                type: 'array';
                items: {
                  oneOf: [
                    {
                      type: 'null';
                    },
                    {
                      $ref: '#/components/schemas/SnowflakeType';
                    },
                  ];
                };
                maxItems: 100;
                uniqueItems: true;
              },
            ];
          };
        },
      ];
      responses: {
        '200': {
          description: '200 response for preview_prune_guild';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/GuildPruneResponse';
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
    post: {
      operationId: 'prune_guild';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                days: {
                  type: ['integer', 'null'];
                  minimum: 1;
                  maximum: 30;
                };
                compute_prune_count: {
                  type: ['boolean', 'null'];
                };
                include_roles: {
                  oneOf: [
                    {
                      type: 'string';
                    },
                    {
                      type: 'array';
                      items: {
                        oneOf: [
                          {
                            type: 'null';
                          },
                          {
                            $ref: '#/components/schemas/SnowflakeType';
                          },
                        ];
                      };
                      maxItems: 100;
                      uniqueItems: true;
                    },
                    {
                      type: 'null';
                    },
                  ];
                };
              };
            };
          };
        };
        required: true;
      };
      responses: {
        '200': {
          description: '200 response for prune_guild';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/GuildPruneResponse';
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
  };
  '/guilds/{guild_id}/bans/{user_id}': {
    parameters: [
      {
        name: 'guild_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
      {
        name: 'user_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
    ];
    get: {
      operationId: 'get_guild_ban';
      responses: {
        '200': {
          description: '200 response for get_guild_ban';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/GuildBanResponse';
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
    put: {
      operationId: 'ban_user_from_guild';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                delete_message_seconds: {
                  type: ['integer', 'null'];
                  minimum: 0;
                  maximum: 604800;
                };
                delete_message_days: {
                  type: ['integer', 'null'];
                  minimum: 0;
                  maximum: 7;
                };
              };
            };
          };
        };
        required: true;
      };
      responses: {
        '204': {
          description: '204 response for ban_user_from_guild';
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
    delete: {
      operationId: 'unban_user_from_guild';
      responses: {
        '204': {
          description: '204 response for unban_user_from_guild';
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
  };
  '/guilds/{guild_id}/bans': {
    parameters: [
      {
        name: 'guild_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
    ];
    get: {
      operationId: 'list_guild_bans';
      parameters: [
        {
          name: 'limit';
          in: 'query';
          schema: {
            type: 'integer';
            minimum: 1;
            maximum: 1000;
          };
        },
        {
          name: 'before';
          in: 'query';
          schema: {
            $ref: '#/components/schemas/SnowflakeType';
          };
        },
        {
          name: 'after';
          in: 'query';
          schema: {
            $ref: '#/components/schemas/SnowflakeType';
          };
        },
      ];
      responses: {
        '200': {
          description: '200 response for list_guild_bans';
          content: {
            'application/json': {
              schema: {
                type: ['array', 'null'];
                items: {
                  $ref: '#/components/schemas/GuildBanResponse';
                };
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
  };
  '/guilds/{guild_id}/mfa': {
    parameters: [
      {
        name: 'guild_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
    ];
    post: {
      operationId: 'set_guild_mfa_level';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                level: {
                  $ref: '#/components/schemas/GuildMFALevel';
                };
              };
              required: ['level'];
            };
          };
        };
        required: true;
      };
      responses: {
        '200': {
          description: '200 response for set_guild_mfa_level';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/GuildMFALevelResponse';
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
  };
  '/stage-instances/{channel_id}': {
    parameters: [
      {
        name: 'channel_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
    ];
    get: {
      operationId: 'get_stage_instance';
      responses: {
        '200': {
          description: '200 response for get_stage_instance';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/StageInstanceResponse';
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
    delete: {
      operationId: 'delete_stage_instance';
      responses: {
        '204': {
          description: '204 response for delete_stage_instance';
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
    patch: {
      operationId: 'update_stage_instance';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                topic: {
                  type: 'string';
                  minLength: 1;
                  maxLength: 120;
                };
                privacy_level: {
                  $ref: '#/components/schemas/StageInstancesPrivacyLevels';
                };
              };
            };
          };
        };
        required: true;
      };
      responses: {
        '200': {
          description: '200 response for update_stage_instance';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/StageInstanceResponse';
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
  };
  '/applications/{application_id}': {
    parameters: [
      {
        name: 'application_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
    ];
    get: {
      operationId: 'get_application';
      responses: {
        '200': {
          description: '200 response for get_application';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PrivateApplicationResponse';
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
    patch: {
      operationId: 'update_application';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/ApplicationFormPartial';
            };
          };
        };
        required: true;
      };
      responses: {
        '200': {
          description: '200 response for update_application';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PrivateApplicationResponse';
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
  };
  '/webhooks/{webhook_id}/{webhook_token}': {
    parameters: [
      {
        name: 'webhook_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
      {
        name: 'webhook_token';
        in: 'path';
        schema: {
          type: 'string';
          maxLength: 152133;
        };
        required: true;
      },
    ];
    get: {
      operationId: 'get_webhook_by_token';
      responses: {
        '200': {
          description: '200 response for get_webhook_by_token';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    $ref: '#/components/schemas/ApplicationIncomingWebhookResponse';
                  },
                  {
                    $ref: '#/components/schemas/ChannelFollowerWebhookResponse';
                  },
                  {
                    $ref: '#/components/schemas/GuildIncomingWebhookResponse';
                  },
                ];
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {},
        {
          BotToken: [];
        },
      ];
    };
    post: {
      operationId: 'execute_webhook';
      parameters: [
        {
          name: 'wait';
          in: 'query';
          schema: {
            type: 'boolean';
          };
        },
        {
          name: 'thread_id';
          in: 'query';
          schema: {
            $ref: '#/components/schemas/SnowflakeType';
          };
        },
      ];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              anyOf: [
                {
                  $ref: '#/components/schemas/IncomingWebhookRequestPartial';
                },
                {
                  $ref: '#/components/schemas/IncomingWebhookUpdateRequestPartial';
                },
              ];
              'x-discord-union': 'oneOf';
            };
          };
          'application/x-www-form-urlencoded': {
            schema: {
              anyOf: [
                {
                  $ref: '#/components/schemas/IncomingWebhookRequestPartial';
                },
                {
                  $ref: '#/components/schemas/IncomingWebhookUpdateRequestPartial';
                },
              ];
              'x-discord-union': 'oneOf';
            };
          };
          'multipart/form-data': {
            schema: {
              anyOf: [
                {
                  $ref: '#/components/schemas/IncomingWebhookRequestPartial';
                },
                {
                  $ref: '#/components/schemas/IncomingWebhookUpdateRequestPartial';
                },
              ];
              'x-discord-union': 'oneOf';
            };
          };
        };
        required: true;
      };
      responses: {
        '200': {
          description: '200 response for execute_webhook';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/MessageResponse';
              };
            };
          };
        };
        '204': {
          description: '204 response for execute_webhook';
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {},
        {
          BotToken: [];
        },
      ];
    };
    delete: {
      operationId: 'delete_webhook_by_token';
      responses: {
        '204': {
          description: '204 response for delete_webhook_by_token';
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {},
        {
          BotToken: [];
        },
      ];
    };
    patch: {
      operationId: 'update_webhook_by_token';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                name: {
                  type: 'string';
                  minLength: 1;
                  maxLength: 80;
                };
                avatar: {
                  type: ['string', 'null'];
                  contentEncoding: 'base64';
                };
              };
            };
          };
        };
        required: true;
      };
      responses: {
        '200': {
          description: '200 response for update_webhook_by_token';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    $ref: '#/components/schemas/ApplicationIncomingWebhookResponse';
                  },
                  {
                    $ref: '#/components/schemas/ChannelFollowerWebhookResponse';
                  },
                  {
                    $ref: '#/components/schemas/GuildIncomingWebhookResponse';
                  },
                ];
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {},
        {
          BotToken: [];
        },
      ];
    };
  };
  '/stickers/{sticker_id}': {
    parameters: [
      {
        name: 'sticker_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
    ];
    get: {
      operationId: 'get_sticker';
      responses: {
        '200': {
          description: '200 response for get_sticker';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    $ref: '#/components/schemas/GuildStickerResponse';
                  },
                  {
                    $ref: '#/components/schemas/StandardStickerResponse';
                  },
                ];
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
  };
  '/webhooks/{webhook_id}': {
    parameters: [
      {
        name: 'webhook_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
    ];
    get: {
      operationId: 'get_webhook';
      responses: {
        '200': {
          description: '200 response for get_webhook';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    $ref: '#/components/schemas/ApplicationIncomingWebhookResponse';
                  },
                  {
                    $ref: '#/components/schemas/ChannelFollowerWebhookResponse';
                  },
                  {
                    $ref: '#/components/schemas/GuildIncomingWebhookResponse';
                  },
                ];
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
    delete: {
      operationId: 'delete_webhook';
      responses: {
        '204': {
          description: '204 response for delete_webhook';
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
    patch: {
      operationId: 'update_webhook';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                name: {
                  type: 'string';
                  minLength: 1;
                  maxLength: 80;
                };
                avatar: {
                  type: ['string', 'null'];
                  contentEncoding: 'base64';
                };
                channel_id: {
                  oneOf: [
                    {
                      type: 'null';
                    },
                    {
                      $ref: '#/components/schemas/SnowflakeType';
                    },
                  ];
                };
              };
            };
          };
        };
        required: true;
      };
      responses: {
        '200': {
          description: '200 response for update_webhook';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    $ref: '#/components/schemas/ApplicationIncomingWebhookResponse';
                  },
                  {
                    $ref: '#/components/schemas/ChannelFollowerWebhookResponse';
                  },
                  {
                    $ref: '#/components/schemas/GuildIncomingWebhookResponse';
                  },
                ];
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
  };
  '/channels/{channel_id}': {
    parameters: [
      {
        name: 'channel_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
    ];
    get: {
      operationId: 'get_channel';
      responses: {
        '200': {
          description: '200 response for get_channel';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    $ref: '#/components/schemas/GuildChannelResponse';
                  },
                  {
                    $ref: '#/components/schemas/PrivateChannelResponse';
                  },
                  {
                    $ref: '#/components/schemas/PrivateGroupChannelResponse';
                  },
                  {
                    $ref: '#/components/schemas/ThreadResponse';
                  },
                ];
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
    delete: {
      operationId: 'delete_channel';
      responses: {
        '200': {
          description: '200 response for delete_channel';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    $ref: '#/components/schemas/GuildChannelResponse';
                  },
                  {
                    $ref: '#/components/schemas/PrivateChannelResponse';
                  },
                  {
                    $ref: '#/components/schemas/PrivateGroupChannelResponse';
                  },
                  {
                    $ref: '#/components/schemas/ThreadResponse';
                  },
                ];
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
    patch: {
      operationId: 'update_channel';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              anyOf: [
                {
                  $ref: '#/components/schemas/PrivateChannelRequestPartial';
                },
                {
                  $ref: '#/components/schemas/UpdateGuildChannelRequestPartial';
                },
                {
                  $ref: '#/components/schemas/UpdateThreadRequestPartial';
                },
              ];
              'x-discord-union': 'oneOf';
            };
          };
        };
        required: true;
      };
      responses: {
        '200': {
          description: '200 response for update_channel';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    $ref: '#/components/schemas/GuildChannelResponse';
                  },
                  {
                    $ref: '#/components/schemas/PrivateChannelResponse';
                  },
                  {
                    $ref: '#/components/schemas/PrivateGroupChannelResponse';
                  },
                  {
                    $ref: '#/components/schemas/ThreadResponse';
                  },
                ];
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
  };
  '/invites/{code}': {
    parameters: [
      {
        name: 'code';
        in: 'path';
        schema: {
          type: 'string';
          maxLength: 152133;
        };
        required: true;
      },
    ];
    get: {
      operationId: 'invite_resolve';
      parameters: [
        {
          name: 'with_counts';
          in: 'query';
          schema: {
            type: 'boolean';
          };
        },
        {
          name: 'guild_scheduled_event_id';
          in: 'query';
          schema: {
            $ref: '#/components/schemas/SnowflakeType';
          };
        },
      ];
      responses: {
        '200': {
          description: '200 response for invite_resolve';
          content: {
            'application/json': {
              schema: {
                anyOf: [
                  {
                    $ref: '#/components/schemas/FriendInviteResponse';
                  },
                  {
                    $ref: '#/components/schemas/GroupDMInviteResponse';
                  },
                  {
                    $ref: '#/components/schemas/GuildInviteResponse';
                  },
                ];
                'x-discord-union': 'oneOf';
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {},
        {
          BotToken: [];
        },
      ];
    };
    delete: {
      operationId: 'invite_revoke';
      responses: {
        '200': {
          description: '200 response for invite_revoke';
          content: {
            'application/json': {
              schema: {
                anyOf: [
                  {
                    $ref: '#/components/schemas/FriendInviteResponse';
                  },
                  {
                    $ref: '#/components/schemas/GroupDMInviteResponse';
                  },
                  {
                    $ref: '#/components/schemas/GuildInviteResponse';
                  },
                ];
                'x-discord-union': 'oneOf';
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
  };
  '/guilds/{guild_id}': {
    parameters: [
      {
        name: 'guild_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
    ];
    get: {
      operationId: 'get_guild';
      parameters: [
        {
          name: 'with_counts';
          in: 'query';
          schema: {
            type: 'boolean';
          };
        },
      ];
      responses: {
        '200': {
          description: '200 response for get_guild';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/GuildWithCountsResponse';
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
    delete: {
      operationId: 'delete_guild';
      responses: {
        '204': {
          description: '204 response for delete_guild';
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
    patch: {
      operationId: 'update_guild';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/GuildPatchRequestPartial';
            };
          };
        };
        required: true;
      };
      responses: {
        '200': {
          description: '200 response for update_guild';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/GuildResponse';
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
  };
  '/users/{user_id}': {
    parameters: [
      {
        name: 'user_id';
        in: 'path';
        schema: {
          $ref: '#/components/schemas/SnowflakeType';
        };
        required: true;
      },
    ];
    get: {
      operationId: 'get_user';
      responses: {
        '200': {
          description: '200 response for get_user';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/UserResponse';
              };
            };
          };
        };
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse';
        };
      };
      security: [
        {
          BotToken: [];
        },
      ];
    };
  };
};
export const paths = {
  '/oauth2/applications/@me': {
    get: {
      operationId: 'get_my_oauth2_application',
      responses: {
        '200': {
          description: '200 response for get_my_oauth2_application',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PrivateApplicationResponse',
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
  },
  '/users/@me/connections': {
    get: {
      operationId: 'list_my_connections',
      responses: {
        '200': {
          description: '200 response for list_my_connections',
          content: {
            'application/json': {
              schema: {
                type: ['array', 'null'],
                items: {
                  $ref: '#/components/schemas/ConnectedAccountResponse',
                },
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
        {
          OAuth2: ['connections'],
        },
      ],
    },
  },
  '/users/@me/channels': {
    post: {
      operationId: 'create_dm',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/CreatePrivateChannelRequest',
            },
          },
        },
        required: true,
      },
      responses: {
        '200': {
          description: '200 response for create_dm',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    $ref: '#/components/schemas/PrivateChannelResponse',
                  },
                  {
                    $ref: '#/components/schemas/PrivateGroupChannelResponse',
                  },
                ],
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
  },
  '/users/@me/guilds': {
    get: {
      operationId: 'list_my_guilds',
      parameters: [
        {
          name: 'before',
          in: 'query',
          schema: {
            $ref: '#/components/schemas/SnowflakeType',
          },
        },
        {
          name: 'after',
          in: 'query',
          schema: {
            $ref: '#/components/schemas/SnowflakeType',
          },
        },
        {
          name: 'limit',
          in: 'query',
          schema: {
            type: 'integer',
            minimum: 1,
            maximum: 200,
          },
        },
        {
          name: 'with_counts',
          in: 'query',
          schema: {
            type: 'boolean',
          },
        },
      ],
      responses: {
        '200': {
          description: '200 response for list_my_guilds',
          content: {
            'application/json': {
              schema: {
                type: ['array', 'null'],
                items: {
                  $ref: '#/components/schemas/MyGuildResponse',
                },
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
        {
          OAuth2: ['guilds'],
        },
      ],
    },
  },
  '/applications/@me': {
    get: {
      operationId: 'get_my_application',
      responses: {
        '200': {
          description: '200 response for get_my_application',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PrivateApplicationResponse',
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
    patch: {
      operationId: 'update_my_application',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/ApplicationFormPartial',
            },
          },
        },
        required: true,
      },
      responses: {
        '200': {
          description: '200 response for update_my_application',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PrivateApplicationResponse',
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
  },
  '/gateway/bot': {
    get: {
      operationId: 'get_bot_gateway',
      responses: {
        '200': {
          description: '200 response for get_bot_gateway',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/GatewayBotResponse',
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
  },
  '/oauth2/@me': {
    get: {
      operationId: 'get_my_oauth2_authorization',
      responses: {
        '200': {
          description: '200 response for get_my_oauth2_authorization',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/OAuth2GetAuthorizationResponse',
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
        {
          OAuth2: [
            'activities.read',
            'activities.write',
            'applications.builds.read',
            'applications.builds.upload',
            'applications.commands',
            'applications.commands.permissions.update',
            'applications.commands.update',
            'applications.entitlements',
            'applications.store.update',
            'bot',
            'connections',
            'dm_channels.read',
            'email',
            'gdm.join',
            'guilds',
            'guilds.join',
            'guilds.members.read',
            'identify',
            'messages.read',
            'relationships.read',
            'role_connections.write',
            'rpc',
            'rpc.activities.write',
            'rpc.notifications.read',
            'rpc.screenshare.read',
            'rpc.screenshare.write',
            'rpc.video.read',
            'rpc.video.write',
            'rpc.voice.read',
            'rpc.voice.write',
            'voice',
            'webhook.incoming',
          ],
        },
      ],
    },
  },
  '/voice/regions': {
    get: {
      operationId: 'list_voice_regions',
      responses: {
        '200': {
          description: '200 response for list_voice_regions',
          content: {
            'application/json': {
              schema: {
                type: ['array', 'null'],
                items: {
                  $ref: '#/components/schemas/VoiceRegionResponse',
                },
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
  },
  '/users/@me': {
    get: {
      operationId: 'get_my_user',
      responses: {
        '200': {
          description: '200 response for get_my_user',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/UserPIIResponse',
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
        {
          OAuth2: ['identify'],
        },
      ],
    },
    patch: {
      operationId: 'update_my_user',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/BotAccountPatchRequest',
            },
          },
        },
        required: true,
      },
      responses: {
        '200': {
          description: '200 response for update_my_user',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/UserPIIResponse',
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
  },
  '/stage-instances': {
    post: {
      operationId: 'create_stage_instance',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                topic: {
                  type: 'string',
                  minLength: 1,
                  maxLength: 120,
                },
                channel_id: {
                  $ref: '#/components/schemas/SnowflakeType',
                },
                privacy_level: {
                  oneOf: [
                    {
                      type: 'null',
                    },
                    {
                      $ref: '#/components/schemas/StageInstancesPrivacyLevels',
                    },
                  ],
                },
                guild_scheduled_event_id: {
                  oneOf: [
                    {
                      type: 'null',
                    },
                    {
                      $ref: '#/components/schemas/SnowflakeType',
                    },
                  ],
                },
                send_start_notification: {
                  type: ['boolean', 'null'],
                },
              },
              required: ['topic', 'channel_id'],
            },
          },
        },
        required: true,
      },
      responses: {
        '200': {
          description: '200 response for create_stage_instance',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/StageInstanceResponse',
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
  },
  '/sticker-packs': {
    get: {
      operationId: 'list_sticker_packs',
      responses: {
        '200': {
          description: '200 response for list_sticker_packs',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/StickerPackCollectionResponse',
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {},
        {
          BotToken: [],
        },
      ],
    },
  },
  '/gateway': {
    get: {
      operationId: 'get_gateway',
      responses: {
        '200': {
          description: '200 response for get_gateway',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/GatewayResponse',
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {},
        {
          BotToken: [],
        },
      ],
    },
  },
  '/guilds': {
    post: {
      operationId: 'create_guild',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/GuildCreateRequest',
            },
          },
        },
        required: true,
      },
      responses: {
        '201': {
          description: '201 response for create_guild',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/GuildResponse',
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
  },
  '/channels/{channel_id}/users/@me/threads/archived/private': {
    parameters: [
      {
        name: 'channel_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
    ],
    get: {
      operationId: 'list_my_private_archived_threads',
      parameters: [
        {
          name: 'before',
          in: 'query',
          schema: {
            $ref: '#/components/schemas/SnowflakeType',
          },
        },
        {
          name: 'limit',
          in: 'query',
          schema: {
            type: 'integer',
            minimum: 2,
            maximum: 100,
          },
        },
      ],
      responses: {
        '200': {
          description: '200 response for list_my_private_archived_threads',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ThreadsResponse',
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
  },
  '/applications/{application_id}/guilds/{guild_id}/commands/permissions': {
    parameters: [
      {
        name: 'application_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
      {
        name: 'guild_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
    ],
    get: {
      operationId: 'list_guild_application_command_permissions',
      responses: {
        '200': {
          description: '200 response for list_guild_application_command_permissions',
          content: {
            'application/json': {
              schema: {
                type: 'array',
                items: {
                  $ref: '#/components/schemas/CommandPermissionsResponse',
                },
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
        {
          OAuth2: ['applications.commands.permissions.update'],
        },
      ],
    },
  },
  '/applications/{application_id}/guilds/{guild_id}/commands/{command_id}/permissions': {
    parameters: [
      {
        name: 'application_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
      {
        name: 'guild_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
      {
        name: 'command_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
    ],
    get: {
      operationId: 'get_guild_application_command_permissions',
      responses: {
        '200': {
          description: '200 response for get_guild_application_command_permissions',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CommandPermissionsResponse',
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
        {
          OAuth2: ['applications.commands.permissions.update'],
        },
      ],
    },
    put: {
      operationId: 'set_guild_application_command_permissions',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                permissions: {
                  type: ['array', 'null'],
                  items: {
                    $ref: '#/components/schemas/ApplicationCommandPermission',
                  },
                  maxItems: 100,
                },
              },
            },
          },
        },
        required: true,
      },
      responses: {
        '200': {
          description: '200 response for set_guild_application_command_permissions',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CommandPermissionsResponse',
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
        {
          OAuth2: ['applications.commands.permissions.update'],
        },
      ],
    },
  },
  '/channels/{channel_id}/messages/{message_id}/reactions/{emoji_name}/@me': {
    parameters: [
      {
        name: 'channel_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
      {
        name: 'message_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
      {
        name: 'emoji_name',
        in: 'path',
        schema: {
          type: 'string',
          maxLength: 152133,
        },
        required: true,
      },
    ],
    put: {
      operationId: 'add_my_message_reaction',
      responses: {
        '204': {
          description: '204 response for add_my_message_reaction',
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
    delete: {
      operationId: 'delete_my_message_reaction',
      responses: {
        '204': {
          description: '204 response for delete_my_message_reaction',
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
  },
  '/channels/{channel_id}/threads/archived/private': {
    parameters: [
      {
        name: 'channel_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
    ],
    get: {
      operationId: 'list_private_archived_threads',
      parameters: [
        {
          name: 'before',
          in: 'query',
          schema: {
            type: 'string',
            format: 'date-time',
          },
        },
        {
          name: 'limit',
          in: 'query',
          schema: {
            type: 'integer',
            minimum: 2,
            maximum: 100,
          },
        },
      ],
      responses: {
        '200': {
          description: '200 response for list_private_archived_threads',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ThreadsResponse',
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
  },
  '/channels/{channel_id}/threads/archived/public': {
    parameters: [
      {
        name: 'channel_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
    ],
    get: {
      operationId: 'list_public_archived_threads',
      parameters: [
        {
          name: 'before',
          in: 'query',
          schema: {
            type: 'string',
            format: 'date-time',
          },
        },
        {
          name: 'limit',
          in: 'query',
          schema: {
            type: 'integer',
            minimum: 2,
            maximum: 100,
          },
        },
      ],
      responses: {
        '200': {
          description: '200 response for list_public_archived_threads',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ThreadsResponse',
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
  },
  '/users/@me/applications/{application_id}/role-connection': {
    parameters: [
      {
        name: 'application_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
    ],
    get: {
      operationId: 'get_application_user_role_connection',
      responses: {
        '200': {
          description: '200 response for get_application_user_role_connection',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ApplicationUserRoleConnectionResponse',
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          OAuth2: ['role_connections.write'],
        },
      ],
    },
    put: {
      operationId: 'update_application_user_role_connection',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                platform_name: {
                  type: ['string', 'null'],
                  maxLength: 50,
                },
                platform_username: {
                  type: ['string', 'null'],
                  maxLength: 100,
                },
                metadata: {
                  type: ['object', 'null'],
                  additionalProperties: {
                    type: 'string',
                    minLength: 1,
                    maxLength: 100,
                  },
                  maxProperties: 5,
                },
              },
            },
          },
        },
        required: true,
      },
      responses: {
        '200': {
          description: '200 response for update_application_user_role_connection',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ApplicationUserRoleConnectionResponse',
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          OAuth2: ['role_connections.write'],
        },
      ],
    },
  },
  '/users/@me/guilds/{guild_id}/member': {
    parameters: [
      {
        name: 'guild_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
    ],
    get: {
      operationId: 'get_my_guild_member',
      responses: {
        '200': {
          description: '200 response for get_my_guild_member',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PrivateGuildMemberResponse',
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          OAuth2: ['guilds.members.read'],
        },
      ],
    },
  },
  '/applications/{application_id}/role-connections/metadata': {
    parameters: [
      {
        name: 'application_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
    ],
    get: {
      operationId: 'get_application_role_connections_metadata',
      responses: {
        '200': {
          description: '200 response for get_application_role_connections_metadata',
          content: {
            'application/json': {
              schema: {
                type: ['array', 'null'],
                items: {
                  $ref: '#/components/schemas/ApplicationRoleConnectionsMetadataItemResponse',
                },
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
    put: {
      operationId: 'update_application_role_connections_metadata',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: ['array', 'null'],
              items: {
                $ref: '#/components/schemas/ApplicationRoleConnectionsMetadataItemRequest',
              },
              maxItems: 5,
            },
          },
        },
        required: true,
      },
      responses: {
        '200': {
          description: '200 response for update_application_role_connections_metadata',
          content: {
            'application/json': {
              schema: {
                type: ['array', 'null'],
                items: {
                  $ref: '#/components/schemas/ApplicationRoleConnectionsMetadataItemResponse',
                },
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
  },
  '/applications/{application_id}/guilds/{guild_id}/commands/{command_id}': {
    parameters: [
      {
        name: 'application_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
      {
        name: 'guild_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
      {
        name: 'command_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
    ],
    get: {
      operationId: 'get_guild_application_command',
      responses: {
        '200': {
          description: '200 response for get_guild_application_command',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ApplicationCommandResponse',
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
        {
          OAuth2: ['applications.commands.update'],
        },
      ],
    },
    delete: {
      operationId: 'delete_guild_application_command',
      responses: {
        '204': {
          description: '204 response for delete_guild_application_command',
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
        {
          OAuth2: ['applications.commands.update'],
        },
      ],
    },
    patch: {
      operationId: 'update_guild_application_command',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/ApplicationCommandPatchRequestPartial',
            },
          },
        },
        required: true,
      },
      responses: {
        '200': {
          description: '200 response for update_guild_application_command',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ApplicationCommandResponse',
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
        {
          OAuth2: ['applications.commands.update'],
        },
      ],
    },
  },
  '/applications/{application_id}/guilds/{guild_id}/commands': {
    parameters: [
      {
        name: 'application_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
      {
        name: 'guild_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
    ],
    get: {
      operationId: 'list_guild_application_commands',
      parameters: [
        {
          name: 'with_localizations',
          in: 'query',
          schema: {
            type: 'boolean',
          },
        },
      ],
      responses: {
        '200': {
          description: '200 response for list_guild_application_commands',
          content: {
            'application/json': {
              schema: {
                type: ['array', 'null'],
                items: {
                  $ref: '#/components/schemas/ApplicationCommandResponse',
                },
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
        {
          OAuth2: ['applications.commands.update'],
        },
      ],
    },
    put: {
      operationId: 'bulk_set_guild_application_commands',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: ['array', 'null'],
              items: {
                $ref: '#/components/schemas/ApplicationCommandUpdateRequest',
              },
              maxItems: 110,
            },
          },
        },
        required: true,
      },
      responses: {
        '200': {
          description: '200 response for bulk_set_guild_application_commands',
          content: {
            'application/json': {
              schema: {
                type: ['array', 'null'],
                items: {
                  $ref: '#/components/schemas/ApplicationCommandResponse',
                },
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
        {
          OAuth2: ['applications.commands.update'],
        },
      ],
    },
    post: {
      operationId: 'create_guild_application_command',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/ApplicationCommandCreateRequest',
            },
          },
        },
        required: true,
      },
      responses: {
        '200': {
          description: '200 response for create_guild_application_command',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ApplicationCommandResponse',
              },
            },
          },
        },
        '201': {
          description: '201 response for create_guild_application_command',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ApplicationCommandResponse',
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
        {
          OAuth2: ['applications.commands.update'],
        },
      ],
    },
  },
  '/channels/{channel_id}/thread-members/@me': {
    parameters: [
      {
        name: 'channel_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
    ],
    put: {
      operationId: 'join_thread',
      responses: {
        '204': {
          description: '204 response for join_thread',
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
    delete: {
      operationId: 'leave_thread',
      responses: {
        '204': {
          description: '204 response for leave_thread',
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
  },
  '/channels/{channel_id}/messages/bulk-delete': {
    parameters: [
      {
        name: 'channel_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
    ],
    post: {
      operationId: 'bulk_delete_messages',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                messages: {
                  type: 'array',
                  items: {
                    $ref: '#/components/schemas/SnowflakeType',
                  },
                  minItems: 2,
                  maxItems: 100,
                  uniqueItems: true,
                },
              },
              required: ['messages'],
            },
          },
        },
        required: true,
      },
      responses: {
        '204': {
          description: '204 response for bulk_delete_messages',
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
  },
  '/channels/{channel_id}/messages/{message_id}/reactions/{emoji_name}/{user_id}': {
    parameters: [
      {
        name: 'channel_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
      {
        name: 'message_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
      {
        name: 'emoji_name',
        in: 'path',
        schema: {
          type: 'string',
          maxLength: 152133,
        },
        required: true,
      },
      {
        name: 'user_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
    ],
    delete: {
      operationId: 'delete_user_message_reaction',
      responses: {
        '204': {
          description: '204 response for delete_user_message_reaction',
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
  },
  '/channels/{channel_id}/messages/{message_id}/reactions/{emoji_name}': {
    parameters: [
      {
        name: 'channel_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
      {
        name: 'message_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
      {
        name: 'emoji_name',
        in: 'path',
        schema: {
          type: 'string',
          maxLength: 152133,
        },
        required: true,
      },
    ],
    get: {
      operationId: 'list_message_reactions_by_emoji',
      parameters: [
        {
          name: 'after',
          in: 'query',
          schema: {
            $ref: '#/components/schemas/SnowflakeType',
          },
        },
        {
          name: 'limit',
          in: 'query',
          schema: {
            type: 'integer',
            minimum: 1,
            maximum: 100,
          },
        },
      ],
      responses: {
        '200': {
          description: '200 response for list_message_reactions_by_emoji',
          content: {
            'application/json': {
              schema: {
                type: 'array',
                items: {
                  $ref: '#/components/schemas/UserResponse',
                },
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
    delete: {
      operationId: 'delete_all_message_reactions_by_emoji',
      responses: {
        '204': {
          description: '204 response for delete_all_message_reactions_by_emoji',
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
  },
  '/channels/{channel_id}/messages/{message_id}/reactions': {
    parameters: [
      {
        name: 'channel_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
      {
        name: 'message_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
    ],
    delete: {
      operationId: 'delete_all_message_reactions',
      responses: {
        '204': {
          description: '204 response for delete_all_message_reactions',
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
  },
  '/channels/{channel_id}/messages/{message_id}/crosspost': {
    parameters: [
      {
        name: 'channel_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
      {
        name: 'message_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
    ],
    post: {
      operationId: 'crosspost_message',
      responses: {
        '200': {
          description: '200 response for crosspost_message',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/MessageResponse',
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
  },
  '/channels/{channel_id}/messages/{message_id}/threads': {
    parameters: [
      {
        name: 'channel_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
      {
        name: 'message_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
    ],
    post: {
      operationId: 'create_thread_from_message',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/CreateTextThreadWithMessageRequest',
            },
          },
        },
        required: true,
      },
      responses: {
        '201': {
          description: '201 response for create_thread_from_message',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ThreadResponse',
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
  },
  '/webhooks/{webhook_id}/{webhook_token}/messages/@original': {
    parameters: [
      {
        name: 'webhook_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
      {
        name: 'webhook_token',
        in: 'path',
        schema: {
          type: 'string',
          maxLength: 152133,
        },
        required: true,
      },
    ],
    get: {
      operationId: 'get_original_webhook_message',
      parameters: [
        {
          name: 'thread_id',
          in: 'query',
          schema: {
            $ref: '#/components/schemas/SnowflakeType',
          },
        },
      ],
      responses: {
        '200': {
          description: '200 response for get_original_webhook_message',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/MessageResponse',
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {},
        {
          BotToken: [],
        },
      ],
    },
    delete: {
      operationId: 'delete_original_webhook_message',
      parameters: [
        {
          name: 'thread_id',
          in: 'query',
          schema: {
            $ref: '#/components/schemas/SnowflakeType',
          },
        },
      ],
      responses: {
        '204': {
          description: '204 response for delete_original_webhook_message',
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {},
        {
          BotToken: [],
        },
      ],
    },
    patch: {
      operationId: 'update_original_webhook_message',
      parameters: [
        {
          name: 'thread_id',
          in: 'query',
          schema: {
            $ref: '#/components/schemas/SnowflakeType',
          },
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/IncomingWebhookUpdateRequestPartial',
            },
          },
          'application/x-www-form-urlencoded': {
            schema: {
              $ref: '#/components/schemas/IncomingWebhookUpdateRequestPartial',
            },
          },
          'multipart/form-data': {
            schema: {
              allOf: [
                {
                  $ref: '#/components/schemas/IncomingWebhookUpdateRequestPartial',
                },
                {
                  type: 'object',
                  properties: {
                    'files[0]': {
                      type: 'string',
                      contentEncoding: 'binary',
                    },
                    'files[1]': {
                      type: 'string',
                      contentEncoding: 'binary',
                    },
                    'files[2]': {
                      type: 'string',
                      contentEncoding: 'binary',
                    },
                    'files[3]': {
                      type: 'string',
                      contentEncoding: 'binary',
                    },
                    'files[4]': {
                      type: 'string',
                      contentEncoding: 'binary',
                    },
                    'files[5]': {
                      type: 'string',
                      contentEncoding: 'binary',
                    },
                    'files[6]': {
                      type: 'string',
                      contentEncoding: 'binary',
                    },
                    'files[7]': {
                      type: 'string',
                      contentEncoding: 'binary',
                    },
                    'files[8]': {
                      type: 'string',
                      contentEncoding: 'binary',
                    },
                    'files[9]': {
                      type: 'string',
                      contentEncoding: 'binary',
                    },
                  },
                },
              ],
            },
          },
        },
        required: true,
      },
      responses: {
        '200': {
          description: '200 response for update_original_webhook_message',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/MessageResponse',
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {},
        {
          BotToken: [],
        },
      ],
    },
  },
  '/guilds/{guild_id}/scheduled-events/{guild_scheduled_event_id}/users': {
    parameters: [
      {
        name: 'guild_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
      {
        name: 'guild_scheduled_event_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
    ],
    get: {
      operationId: 'list_guild_scheduled_event_users',
      parameters: [
        {
          name: 'with_member',
          in: 'query',
          schema: {
            type: 'boolean',
          },
        },
        {
          name: 'limit',
          in: 'query',
          schema: {
            type: 'integer',
            minimum: 1,
            maximum: 100,
          },
        },
        {
          name: 'before',
          in: 'query',
          schema: {
            $ref: '#/components/schemas/SnowflakeType',
          },
        },
        {
          name: 'after',
          in: 'query',
          schema: {
            $ref: '#/components/schemas/SnowflakeType',
          },
        },
      ],
      responses: {
        '200': {
          description: '200 response for list_guild_scheduled_event_users',
          content: {
            'application/json': {
              schema: {
                type: ['array', 'null'],
                items: {
                  $ref: '#/components/schemas/ScheduledEventUserResponse',
                },
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
  },
  '/guilds/{guild_id}/auto-moderation/rules/{rule_id}': {
    parameters: [
      {
        name: 'guild_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
      {
        name: 'rule_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
    ],
    get: {
      operationId: 'get_auto_moderation_rule',
      responses: {
        '200': {
          description: '200 response for get_auto_moderation_rule',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    $ref: '#/components/schemas/DefaultKeywordRuleResponse',
                  },
                  {
                    $ref: '#/components/schemas/KeywordRuleResponse',
                  },
                  {
                    $ref: '#/components/schemas/MLSpamRuleResponse',
                  },
                  {
                    $ref: '#/components/schemas/MentionSpamRuleResponse',
                  },
                  {
                    $ref: '#/components/schemas/SpamLinkRuleResponse',
                  },
                ],
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
    delete: {
      operationId: 'delete_auto_moderation_rule',
      responses: {
        '204': {
          description: '204 response for delete_auto_moderation_rule',
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
    patch: {
      operationId: 'update_auto_moderation_rule',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              anyOf: [
                {
                  $ref: '#/components/schemas/DefaultKeywordListUpsertRequestPartial',
                },
                {
                  $ref: '#/components/schemas/KeywordUpsertRequestPartial',
                },
                {
                  $ref: '#/components/schemas/MLSpamUpsertRequestPartial',
                },
                {
                  $ref: '#/components/schemas/MentionSpamUpsertRequestPartial',
                },
              ],
              'x-discord-union': 'oneOf',
            },
          },
        },
        required: true,
      },
      responses: {
        '200': {
          description: '200 response for update_auto_moderation_rule',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    $ref: '#/components/schemas/DefaultKeywordRuleResponse',
                  },
                  {
                    $ref: '#/components/schemas/KeywordRuleResponse',
                  },
                  {
                    $ref: '#/components/schemas/MLSpamRuleResponse',
                  },
                  {
                    $ref: '#/components/schemas/MentionSpamRuleResponse',
                  },
                  {
                    $ref: '#/components/schemas/SpamLinkRuleResponse',
                  },
                ],
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
  },
  '/guilds/{guild_id}/auto-moderation/rules': {
    parameters: [
      {
        name: 'guild_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
    ],
    get: {
      operationId: 'list_auto_moderation_rules',
      responses: {
        '200': {
          description: '200 response for list_auto_moderation_rules',
          content: {
            'application/json': {
              schema: {
                type: ['array', 'null'],
                items: {
                  oneOf: [
                    {
                      $ref: '#/components/schemas/DefaultKeywordRuleResponse',
                    },
                    {
                      $ref: '#/components/schemas/KeywordRuleResponse',
                    },
                    {
                      $ref: '#/components/schemas/MLSpamRuleResponse',
                    },
                    {
                      $ref: '#/components/schemas/MentionSpamRuleResponse',
                    },
                    {
                      $ref: '#/components/schemas/SpamLinkRuleResponse',
                    },
                    {
                      type: 'null',
                    },
                  ],
                },
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
    post: {
      operationId: 'create_auto_moderation_rule',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              oneOf: [
                {
                  $ref: '#/components/schemas/DefaultKeywordListUpsertRequest',
                },
                {
                  $ref: '#/components/schemas/KeywordUpsertRequest',
                },
                {
                  $ref: '#/components/schemas/MLSpamUpsertRequest',
                },
                {
                  $ref: '#/components/schemas/MentionSpamUpsertRequest',
                },
              ],
            },
          },
        },
        required: true,
      },
      responses: {
        '200': {
          description: '200 response for create_auto_moderation_rule',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    $ref: '#/components/schemas/DefaultKeywordRuleResponse',
                  },
                  {
                    $ref: '#/components/schemas/KeywordRuleResponse',
                  },
                  {
                    $ref: '#/components/schemas/MLSpamRuleResponse',
                  },
                  {
                    $ref: '#/components/schemas/MentionSpamRuleResponse',
                  },
                  {
                    $ref: '#/components/schemas/SpamLinkRuleResponse',
                  },
                ],
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
  },
  '/guilds/{guild_id}/voice-states/@me': {
    parameters: [
      {
        name: 'guild_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
    ],
    patch: {
      operationId: 'update_self_voice_state',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                request_to_speak_timestamp: {
                  type: ['string', 'null'],
                  format: 'date-time',
                },
                suppress: {
                  type: ['boolean', 'null'],
                },
                channel_id: {
                  oneOf: [
                    {
                      type: 'null',
                    },
                    {
                      $ref: '#/components/schemas/SnowflakeType',
                    },
                  ],
                },
              },
            },
          },
        },
        required: true,
      },
      responses: {
        '204': {
          description: '204 response for update_self_voice_state',
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
  },
  '/guilds/{guild_id}/members/search': {
    parameters: [
      {
        name: 'guild_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
    ],
    get: {
      operationId: 'search_guild_members',
      parameters: [
        {
          name: 'limit',
          in: 'query',
          schema: {
            type: 'integer',
            minimum: 1,
            maximum: 1000,
          },
          required: true,
        },
        {
          name: 'query',
          in: 'query',
          schema: {
            type: 'string',
            minLength: 1,
            maxLength: 100,
          },
          required: true,
        },
      ],
      responses: {
        '200': {
          description: '200 response for search_guild_members',
          content: {
            'application/json': {
              schema: {
                type: 'array',
                items: {
                  $ref: '#/components/schemas/GuildMemberResponse',
                },
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
  },
  '/guilds/{guild_id}/threads/active': {
    parameters: [
      {
        name: 'guild_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
    ],
    get: {
      operationId: 'get_active_guild_threads',
      responses: {
        '200': {
          description: '200 response for get_active_guild_threads',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ThreadsResponse',
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
  },
  '/guilds/{guild_id}/members/@me': {
    parameters: [
      {
        name: 'guild_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
    ],
    patch: {
      operationId: 'update_my_guild_member',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                nick: {
                  type: ['string', 'null'],
                  maxLength: 32,
                },
              },
            },
          },
        },
        required: true,
      },
      responses: {
        '200': {
          description: '200 response for update_my_guild_member',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PrivateGuildMemberResponse',
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
  },
  '/guilds/{guild_id}/members/{user_id}/roles/{role_id}': {
    parameters: [
      {
        name: 'guild_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
      {
        name: 'user_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
      {
        name: 'role_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
    ],
    put: {
      operationId: 'add_guild_member_role',
      responses: {
        '204': {
          description: '204 response for add_guild_member_role',
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
    delete: {
      operationId: 'delete_guild_member_role',
      responses: {
        '204': {
          description: '204 response for delete_guild_member_role',
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
  },
  '/users/@me/guilds/{guild_id}': {
    parameters: [
      {
        name: 'guild_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
    ],
    delete: {
      operationId: 'leave_guild',
      responses: {
        '204': {
          description: '204 response for leave_guild',
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
  },
  '/applications/{application_id}/commands/{command_id}': {
    parameters: [
      {
        name: 'application_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
      {
        name: 'command_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
    ],
    get: {
      operationId: 'get_application_command',
      responses: {
        '200': {
          description: '200 response for get_application_command',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ApplicationCommandResponse',
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
        {
          OAuth2: ['applications.commands.update'],
        },
      ],
    },
    delete: {
      operationId: 'delete_application_command',
      responses: {
        '204': {
          description: '204 response for delete_application_command',
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
        {
          OAuth2: ['applications.commands.update'],
        },
      ],
    },
    patch: {
      operationId: 'update_application_command',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/ApplicationCommandPatchRequestPartial',
            },
          },
        },
        required: true,
      },
      responses: {
        '200': {
          description: '200 response for update_application_command',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ApplicationCommandResponse',
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
        {
          OAuth2: ['applications.commands.update'],
        },
      ],
    },
  },
  '/applications/{application_id}/commands': {
    parameters: [
      {
        name: 'application_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
    ],
    get: {
      operationId: 'list_application_commands',
      parameters: [
        {
          name: 'with_localizations',
          in: 'query',
          schema: {
            type: 'boolean',
          },
        },
      ],
      responses: {
        '200': {
          description: '200 response for list_application_commands',
          content: {
            'application/json': {
              schema: {
                type: ['array', 'null'],
                items: {
                  $ref: '#/components/schemas/ApplicationCommandResponse',
                },
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
        {
          OAuth2: ['applications.commands.update'],
        },
      ],
    },
    put: {
      operationId: 'bulk_set_application_commands',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: ['array', 'null'],
              items: {
                $ref: '#/components/schemas/ApplicationCommandUpdateRequest',
              },
              maxItems: 110,
            },
          },
        },
        required: true,
      },
      responses: {
        '200': {
          description: '200 response for bulk_set_application_commands',
          content: {
            'application/json': {
              schema: {
                type: ['array', 'null'],
                items: {
                  $ref: '#/components/schemas/ApplicationCommandResponse',
                },
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
        {
          OAuth2: ['applications.commands.update'],
        },
      ],
    },
    post: {
      operationId: 'create_application_command',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/ApplicationCommandCreateRequest',
            },
          },
        },
        required: true,
      },
      responses: {
        '200': {
          description: '200 response for create_application_command',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ApplicationCommandResponse',
              },
            },
          },
        },
        '201': {
          description: '201 response for create_application_command',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ApplicationCommandResponse',
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
        {
          OAuth2: ['applications.commands.update'],
        },
      ],
    },
  },
  '/interactions/{interaction_id}/{interaction_token}/callback': {
    parameters: [
      {
        name: 'interaction_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
      {
        name: 'interaction_token',
        in: 'path',
        schema: {
          type: 'string',
          maxLength: 152133,
        },
        required: true,
      },
    ],
    post: {
      operationId: 'create_interaction_response',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              anyOf: [
                {
                  $ref: '#/components/schemas/ApplicationCommandAutocompleteCallbackRequest',
                },
                {
                  $ref: '#/components/schemas/CreateMessageInteractionCallbackRequest',
                },
                {
                  $ref: '#/components/schemas/ModalInteractionCallbackRequest',
                },
                {
                  $ref: '#/components/schemas/PongInteractionCallbackRequest',
                },
                {
                  $ref: '#/components/schemas/UpdateMessageInteractionCallbackRequest',
                },
              ],
              'x-discord-union': 'oneOf',
            },
          },
          'application/x-www-form-urlencoded': {
            schema: {
              anyOf: [
                {
                  $ref: '#/components/schemas/ApplicationCommandAutocompleteCallbackRequest',
                },
                {
                  $ref: '#/components/schemas/CreateMessageInteractionCallbackRequest',
                },
                {
                  $ref: '#/components/schemas/ModalInteractionCallbackRequest',
                },
                {
                  $ref: '#/components/schemas/PongInteractionCallbackRequest',
                },
                {
                  $ref: '#/components/schemas/UpdateMessageInteractionCallbackRequest',
                },
              ],
              'x-discord-union': 'oneOf',
            },
          },
          'multipart/form-data': {
            schema: {
              anyOf: [
                {
                  $ref: '#/components/schemas/ApplicationCommandAutocompleteCallbackRequest',
                },
                {
                  $ref: '#/components/schemas/CreateMessageInteractionCallbackRequest',
                },
                {
                  $ref: '#/components/schemas/ModalInteractionCallbackRequest',
                },
                {
                  $ref: '#/components/schemas/PongInteractionCallbackRequest',
                },
                {
                  $ref: '#/components/schemas/UpdateMessageInteractionCallbackRequest',
                },
              ],
              'x-discord-union': 'oneOf',
            },
          },
        },
        required: true,
      },
      responses: {
        '204': {
          description: '204 response for create_interaction_response',
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {},
        {
          BotToken: [],
        },
      ],
    },
  },
  '/channels/{channel_id}/thread-members/{user_id}': {
    parameters: [
      {
        name: 'channel_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
      {
        name: 'user_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
    ],
    get: {
      operationId: 'get_thread_member',
      parameters: [
        {
          name: 'with_member',
          in: 'query',
          schema: {
            type: 'boolean',
          },
        },
      ],
      responses: {
        '200': {
          description: '200 response for get_thread_member',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ThreadMemberResponse',
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
    put: {
      operationId: 'add_thread_member',
      responses: {
        '204': {
          description: '204 response for add_thread_member',
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
    delete: {
      operationId: 'delete_thread_member',
      responses: {
        '204': {
          description: '204 response for delete_thread_member',
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
  },
  '/channels/{channel_id}/thread-members': {
    parameters: [
      {
        name: 'channel_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
    ],
    get: {
      operationId: 'list_thread_members',
      parameters: [
        {
          name: 'with_member',
          in: 'query',
          schema: {
            type: 'boolean',
          },
        },
        {
          name: 'limit',
          in: 'query',
          schema: {
            type: 'integer',
            minimum: 1,
            maximum: 100,
          },
        },
        {
          name: 'after',
          in: 'query',
          schema: {
            $ref: '#/components/schemas/SnowflakeType',
          },
        },
      ],
      responses: {
        '200': {
          description: '200 response for list_thread_members',
          content: {
            'application/json': {
              schema: {
                type: 'array',
                items: {
                  $ref: '#/components/schemas/ThreadMemberResponse',
                },
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
  },
  '/channels/{channel_id}/permissions/{overwrite_id}': {
    parameters: [
      {
        name: 'channel_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
      {
        name: 'overwrite_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
    ],
    put: {
      operationId: 'set_channel_permission_overwrite',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                type: {
                  oneOf: [
                    {
                      type: 'null',
                    },
                    {
                      $ref: '#/components/schemas/ChannelPermissionOverwrites',
                    },
                  ],
                },
                allow: {
                  type: ['integer', 'null'],
                },
                deny: {
                  type: ['integer', 'null'],
                },
              },
            },
          },
        },
        required: true,
      },
      responses: {
        '204': {
          description: '204 response for set_channel_permission_overwrite',
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
    delete: {
      operationId: 'delete_channel_permission_overwrite',
      responses: {
        '204': {
          description: '204 response for delete_channel_permission_overwrite',
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
  },
  '/channels/{channel_id}/recipients/{user_id}': {
    parameters: [
      {
        name: 'channel_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
      {
        name: 'user_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
    ],
    put: {
      operationId: 'add_group_dm_user',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                access_token: {
                  type: ['string', 'null'],
                  maxLength: 152133,
                },
                nick: {
                  type: ['string', 'null'],
                  maxLength: 152133,
                },
              },
            },
          },
        },
        required: true,
      },
      responses: {
        '201': {
          description: '201 response for add_group_dm_user',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    $ref: '#/components/schemas/PrivateChannelResponse',
                  },
                  {
                    $ref: '#/components/schemas/PrivateGroupChannelResponse',
                  },
                ],
              },
            },
          },
        },
        '204': {
          description: '204 response for add_group_dm_user',
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
    delete: {
      operationId: 'delete_group_dm_user',
      responses: {
        '204': {
          description: '204 response for delete_group_dm_user',
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
  },
  '/channels/{channel_id}/followers': {
    parameters: [
      {
        name: 'channel_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
    ],
    post: {
      operationId: 'follow_channel',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                webhook_channel_id: {
                  $ref: '#/components/schemas/SnowflakeType',
                },
              },
              required: ['webhook_channel_id'],
            },
          },
        },
        required: true,
      },
      responses: {
        '200': {
          description: '200 response for follow_channel',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ChannelFollowerResponse',
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
  },
  '/channels/{channel_id}/messages/{message_id}': {
    parameters: [
      {
        name: 'channel_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
      {
        name: 'message_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
    ],
    get: {
      operationId: 'get_message',
      responses: {
        '200': {
          description: '200 response for get_message',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/MessageResponse',
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
    delete: {
      operationId: 'delete_message',
      responses: {
        '204': {
          description: '204 response for delete_message',
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
    patch: {
      operationId: 'update_message',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/MessageEditRequestPartial',
            },
          },
          'application/x-www-form-urlencoded': {
            schema: {
              $ref: '#/components/schemas/MessageEditRequestPartial',
            },
          },
          'multipart/form-data': {
            schema: {
              allOf: [
                {
                  $ref: '#/components/schemas/MessageEditRequestPartial',
                },
                {
                  type: 'object',
                  properties: {
                    'files[0]': {
                      type: 'string',
                      contentEncoding: 'binary',
                    },
                    'files[1]': {
                      type: 'string',
                      contentEncoding: 'binary',
                    },
                    'files[2]': {
                      type: 'string',
                      contentEncoding: 'binary',
                    },
                    'files[3]': {
                      type: 'string',
                      contentEncoding: 'binary',
                    },
                    'files[4]': {
                      type: 'string',
                      contentEncoding: 'binary',
                    },
                    'files[5]': {
                      type: 'string',
                      contentEncoding: 'binary',
                    },
                    'files[6]': {
                      type: 'string',
                      contentEncoding: 'binary',
                    },
                    'files[7]': {
                      type: 'string',
                      contentEncoding: 'binary',
                    },
                    'files[8]': {
                      type: 'string',
                      contentEncoding: 'binary',
                    },
                    'files[9]': {
                      type: 'string',
                      contentEncoding: 'binary',
                    },
                  },
                },
              ],
            },
          },
        },
        required: true,
      },
      responses: {
        '200': {
          description: '200 response for update_message',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/MessageResponse',
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
  },
  '/channels/{channel_id}/messages': {
    parameters: [
      {
        name: 'channel_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
    ],
    get: {
      operationId: 'list_messages',
      parameters: [
        {
          name: 'around',
          in: 'query',
          schema: {
            $ref: '#/components/schemas/SnowflakeType',
          },
        },
        {
          name: 'before',
          in: 'query',
          schema: {
            $ref: '#/components/schemas/SnowflakeType',
          },
        },
        {
          name: 'after',
          in: 'query',
          schema: {
            $ref: '#/components/schemas/SnowflakeType',
          },
        },
        {
          name: 'limit',
          in: 'query',
          schema: {
            type: 'integer',
            minimum: 1,
            maximum: 100,
          },
        },
      ],
      responses: {
        '200': {
          description: '200 response for list_messages',
          content: {
            'application/json': {
              schema: {
                type: ['array', 'null'],
                items: {
                  $ref: '#/components/schemas/MessageResponse',
                },
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
    post: {
      operationId: 'create_message',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/MessageCreateRequest',
            },
          },
          'application/x-www-form-urlencoded': {
            schema: {
              $ref: '#/components/schemas/MessageCreateRequest',
            },
          },
          'multipart/form-data': {
            schema: {
              allOf: [
                {
                  $ref: '#/components/schemas/MessageCreateRequest',
                },
                {
                  type: 'object',
                  properties: {
                    'files[0]': {
                      type: 'string',
                      contentEncoding: 'binary',
                    },
                    'files[1]': {
                      type: 'string',
                      contentEncoding: 'binary',
                    },
                    'files[2]': {
                      type: 'string',
                      contentEncoding: 'binary',
                    },
                    'files[3]': {
                      type: 'string',
                      contentEncoding: 'binary',
                    },
                    'files[4]': {
                      type: 'string',
                      contentEncoding: 'binary',
                    },
                    'files[5]': {
                      type: 'string',
                      contentEncoding: 'binary',
                    },
                    'files[6]': {
                      type: 'string',
                      contentEncoding: 'binary',
                    },
                    'files[7]': {
                      type: 'string',
                      contentEncoding: 'binary',
                    },
                    'files[8]': {
                      type: 'string',
                      contentEncoding: 'binary',
                    },
                    'files[9]': {
                      type: 'string',
                      contentEncoding: 'binary',
                    },
                  },
                },
              ],
            },
          },
        },
        required: true,
      },
      responses: {
        '200': {
          description: '200 response for create_message',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/MessageResponse',
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
  },
  '/channels/{channel_id}/webhooks': {
    parameters: [
      {
        name: 'channel_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
    ],
    get: {
      operationId: 'list_channel_webhooks',
      responses: {
        '200': {
          description: '200 response for list_channel_webhooks',
          content: {
            'application/json': {
              schema: {
                type: ['array', 'null'],
                items: {
                  oneOf: [
                    {
                      $ref: '#/components/schemas/ApplicationIncomingWebhookResponse',
                    },
                    {
                      $ref: '#/components/schemas/ChannelFollowerWebhookResponse',
                    },
                    {
                      $ref: '#/components/schemas/GuildIncomingWebhookResponse',
                    },
                  ],
                },
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
    post: {
      operationId: 'create_webhook',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  minLength: 1,
                  maxLength: 80,
                },
                avatar: {
                  type: ['string', 'null'],
                  contentEncoding: 'base64',
                },
              },
              required: ['name'],
            },
          },
        },
        required: true,
      },
      responses: {
        '200': {
          description: '200 response for create_webhook',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/GuildIncomingWebhookResponse',
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
  },
  '/channels/{channel_id}/invites': {
    parameters: [
      {
        name: 'channel_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
    ],
    get: {
      operationId: 'list_channel_invites',
      responses: {
        '200': {
          description: '200 response for list_channel_invites',
          content: {
            'application/json': {
              schema: {
                type: ['array', 'null'],
                items: {
                  anyOf: [
                    {
                      $ref: '#/components/schemas/FriendInviteResponse',
                    },
                    {
                      $ref: '#/components/schemas/GroupDMInviteResponse',
                    },
                    {
                      $ref: '#/components/schemas/GuildInviteResponse',
                    },
                  ],
                  'x-discord-union': 'oneOf',
                },
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
    post: {
      operationId: 'create_channel_invite',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              anyOf: [
                {
                  $ref: '#/components/schemas/CreateGroupDMInviteRequest',
                },
                {
                  $ref: '#/components/schemas/CreateGuildInviteRequest',
                },
              ],
              'x-discord-union': 'oneOf',
            },
          },
        },
        required: true,
      },
      responses: {
        '200': {
          description: '200 response for create_channel_invite',
          content: {
            'application/json': {
              schema: {
                anyOf: [
                  {
                    $ref: '#/components/schemas/FriendInviteResponse',
                  },
                  {
                    $ref: '#/components/schemas/GroupDMInviteResponse',
                  },
                  {
                    $ref: '#/components/schemas/GuildInviteResponse',
                  },
                ],
                'x-discord-union': 'oneOf',
              },
            },
          },
        },
        '204': {
          description: '204 response for create_channel_invite',
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
  },
  '/channels/{channel_id}/threads': {
    parameters: [
      {
        name: 'channel_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
    ],
    post: {
      operationId: 'create_thread',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              anyOf: [
                {
                  $ref: '#/components/schemas/CreateForumThreadRequest',
                },
                {
                  $ref: '#/components/schemas/CreateTextThreadWithoutMessageRequest',
                },
              ],
              'x-discord-union': 'oneOf',
            },
          },
          'application/x-www-form-urlencoded': {
            schema: {
              anyOf: [
                {
                  $ref: '#/components/schemas/CreateForumThreadRequest',
                },
                {
                  $ref: '#/components/schemas/CreateTextThreadWithoutMessageRequest',
                },
              ],
              'x-discord-union': 'oneOf',
            },
          },
          'multipart/form-data': {
            schema: {
              anyOf: [
                {
                  $ref: '#/components/schemas/CreateForumThreadRequest',
                },
                {
                  $ref: '#/components/schemas/CreateTextThreadWithoutMessageRequest',
                },
              ],
              'x-discord-union': 'oneOf',
            },
          },
        },
        required: true,
      },
      responses: {
        '201': {
          description: '201 response for create_thread',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CreatedThreadResponse',
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
  },
  '/channels/{channel_id}/typing': {
    parameters: [
      {
        name: 'channel_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
    ],
    post: {
      operationId: 'trigger_typing_indicator',
      responses: {
        '200': {
          description: '200 response for trigger_typing_indicator',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/TypingIndicatorResponse',
              },
            },
          },
        },
        '204': {
          description: '204 response for trigger_typing_indicator',
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
  },
  '/channels/{channel_id}/pins/{message_id}': {
    parameters: [
      {
        name: 'channel_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
      {
        name: 'message_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
    ],
    put: {
      operationId: 'pin_message',
      responses: {
        '204': {
          description: '204 response for pin_message',
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
    delete: {
      operationId: 'unpin_message',
      responses: {
        '204': {
          description: '204 response for unpin_message',
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
  },
  '/channels/{channel_id}/pins': {
    parameters: [
      {
        name: 'channel_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
    ],
    get: {
      operationId: 'list_pinned_messages',
      responses: {
        '200': {
          description: '200 response for list_pinned_messages',
          content: {
            'application/json': {
              schema: {
                type: ['array', 'null'],
                items: {
                  $ref: '#/components/schemas/MessageResponse',
                },
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
  },
  '/webhooks/{webhook_id}/{webhook_token}/messages/{message_id}': {
    parameters: [
      {
        name: 'webhook_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
      {
        name: 'webhook_token',
        in: 'path',
        schema: {
          type: 'string',
          maxLength: 152133,
        },
        required: true,
      },
      {
        name: 'message_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
    ],
    get: {
      operationId: 'get_webhook_message',
      parameters: [
        {
          name: 'thread_id',
          in: 'query',
          schema: {
            $ref: '#/components/schemas/SnowflakeType',
          },
        },
      ],
      responses: {
        '200': {
          description: '200 response for get_webhook_message',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/MessageResponse',
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {},
        {
          BotToken: [],
        },
      ],
    },
    delete: {
      operationId: 'delete_webhook_message',
      parameters: [
        {
          name: 'thread_id',
          in: 'query',
          schema: {
            $ref: '#/components/schemas/SnowflakeType',
          },
        },
      ],
      responses: {
        '204': {
          description: '204 response for delete_webhook_message',
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {},
        {
          BotToken: [],
        },
      ],
    },
    patch: {
      operationId: 'update_webhook_message',
      parameters: [
        {
          name: 'thread_id',
          in: 'query',
          schema: {
            $ref: '#/components/schemas/SnowflakeType',
          },
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/IncomingWebhookUpdateRequestPartial',
            },
          },
          'application/x-www-form-urlencoded': {
            schema: {
              $ref: '#/components/schemas/IncomingWebhookUpdateRequestPartial',
            },
          },
          'multipart/form-data': {
            schema: {
              allOf: [
                {
                  $ref: '#/components/schemas/IncomingWebhookUpdateRequestPartial',
                },
                {
                  type: 'object',
                  properties: {
                    'files[0]': {
                      type: 'string',
                      contentEncoding: 'binary',
                    },
                    'files[1]': {
                      type: 'string',
                      contentEncoding: 'binary',
                    },
                    'files[2]': {
                      type: 'string',
                      contentEncoding: 'binary',
                    },
                    'files[3]': {
                      type: 'string',
                      contentEncoding: 'binary',
                    },
                    'files[4]': {
                      type: 'string',
                      contentEncoding: 'binary',
                    },
                    'files[5]': {
                      type: 'string',
                      contentEncoding: 'binary',
                    },
                    'files[6]': {
                      type: 'string',
                      contentEncoding: 'binary',
                    },
                    'files[7]': {
                      type: 'string',
                      contentEncoding: 'binary',
                    },
                    'files[8]': {
                      type: 'string',
                      contentEncoding: 'binary',
                    },
                    'files[9]': {
                      type: 'string',
                      contentEncoding: 'binary',
                    },
                  },
                },
              ],
            },
          },
        },
        required: true,
      },
      responses: {
        '200': {
          description: '200 response for update_webhook_message',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/MessageResponse',
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {},
        {
          BotToken: [],
        },
      ],
    },
  },
  '/webhooks/{webhook_id}/{webhook_token}/github': {
    parameters: [
      {
        name: 'webhook_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
      {
        name: 'webhook_token',
        in: 'path',
        schema: {
          type: 'string',
          maxLength: 152133,
        },
        required: true,
      },
    ],
    post: {
      operationId: 'execute_github_compatible_webhook',
      parameters: [
        {
          name: 'wait',
          in: 'query',
          schema: {
            type: 'boolean',
          },
        },
        {
          name: 'thread_id',
          in: 'query',
          schema: {
            $ref: '#/components/schemas/SnowflakeType',
          },
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/GithubWebhook',
            },
          },
        },
        required: true,
      },
      responses: {
        '204': {
          description: '204 response for execute_github_compatible_webhook',
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {},
        {
          BotToken: [],
        },
      ],
    },
  },
  '/webhooks/{webhook_id}/{webhook_token}/slack': {
    parameters: [
      {
        name: 'webhook_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
      {
        name: 'webhook_token',
        in: 'path',
        schema: {
          type: 'string',
          maxLength: 152133,
        },
        required: true,
      },
    ],
    post: {
      operationId: 'execute_slack_compatible_webhook',
      parameters: [
        {
          name: 'wait',
          in: 'query',
          schema: {
            type: 'boolean',
          },
        },
        {
          name: 'thread_id',
          in: 'query',
          schema: {
            $ref: '#/components/schemas/SnowflakeType',
          },
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/SlackWebhook',
            },
          },
          'application/x-www-form-urlencoded': {
            schema: {
              $ref: '#/components/schemas/SlackWebhook',
            },
          },
          'multipart/form-data': {
            schema: {
              $ref: '#/components/schemas/SlackWebhook',
            },
          },
        },
        required: true,
      },
      responses: {
        '200': {
          description: '200 response for execute_slack_compatible_webhook',
          content: {
            'application/json': {
              schema: {
                type: ['string', 'null'],
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {},
        {
          BotToken: [],
        },
      ],
    },
  },
  '/guilds/templates/{code}': {
    parameters: [
      {
        name: 'code',
        in: 'path',
        schema: {
          type: 'string',
          maxLength: 152133,
        },
        required: true,
      },
    ],
    get: {
      operationId: 'get_guild_template',
      responses: {
        '200': {
          description: '200 response for get_guild_template',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/GuildTemplateResponse',
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {},
        {
          BotToken: [],
        },
      ],
    },
    post: {
      operationId: 'create_guild_from_template',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  minLength: 2,
                  maxLength: 100,
                },
                icon: {
                  type: ['string', 'null'],
                  contentEncoding: 'base64',
                },
              },
              required: ['name'],
            },
          },
        },
        required: true,
      },
      responses: {
        '201': {
          description: '201 response for create_guild_from_template',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/GuildResponse',
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
  },
  '/guilds/{guild_id}/new-member-welcome': {
    parameters: [
      {
        name: 'guild_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
    ],
    get: {
      operationId: 'get_guild_new_member_welcome',
      responses: {
        '200': {
          description: '200 response for get_guild_new_member_welcome',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/GuildHomeSettingsResponse',
              },
            },
          },
        },
        '204': {
          description: '204 response for get_guild_new_member_welcome',
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
  },
  '/guilds/{guild_id}/scheduled-events/{guild_scheduled_event_id}': {
    parameters: [
      {
        name: 'guild_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
      {
        name: 'guild_scheduled_event_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
    ],
    get: {
      operationId: 'get_guild_scheduled_event',
      parameters: [
        {
          name: 'with_user_count',
          in: 'query',
          schema: {
            type: 'boolean',
          },
        },
      ],
      responses: {
        '200': {
          description: '200 response for get_guild_scheduled_event',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    $ref: '#/components/schemas/ExternalScheduledEventResponse',
                  },
                  {
                    $ref: '#/components/schemas/StageScheduledEventResponse',
                  },
                  {
                    $ref: '#/components/schemas/VoiceScheduledEventResponse',
                  },
                ],
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
    delete: {
      operationId: 'delete_guild_scheduled_event',
      responses: {
        '204': {
          description: '204 response for delete_guild_scheduled_event',
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
    patch: {
      operationId: 'update_guild_scheduled_event',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              anyOf: [
                {
                  $ref: '#/components/schemas/ExternalScheduledEventPatchRequestPartial',
                },
                {
                  $ref: '#/components/schemas/StageScheduledEventPatchRequestPartial',
                },
                {
                  $ref: '#/components/schemas/VoiceScheduledEventPatchRequestPartial',
                },
              ],
              'x-discord-union': 'oneOf',
            },
          },
        },
        required: true,
      },
      responses: {
        '200': {
          description: '200 response for update_guild_scheduled_event',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    $ref: '#/components/schemas/ExternalScheduledEventResponse',
                  },
                  {
                    $ref: '#/components/schemas/StageScheduledEventResponse',
                  },
                  {
                    $ref: '#/components/schemas/VoiceScheduledEventResponse',
                  },
                ],
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
  },
  '/guilds/{guild_id}/scheduled-events': {
    parameters: [
      {
        name: 'guild_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
    ],
    get: {
      operationId: 'list_guild_scheduled_events',
      parameters: [
        {
          name: 'with_user_count',
          in: 'query',
          schema: {
            type: 'boolean',
          },
        },
      ],
      responses: {
        '200': {
          description: '200 response for list_guild_scheduled_events',
          content: {
            'application/json': {
              schema: {
                type: ['array', 'null'],
                items: {
                  oneOf: [
                    {
                      $ref: '#/components/schemas/ExternalScheduledEventResponse',
                    },
                    {
                      $ref: '#/components/schemas/StageScheduledEventResponse',
                    },
                    {
                      $ref: '#/components/schemas/VoiceScheduledEventResponse',
                    },
                  ],
                },
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
    post: {
      operationId: 'create_guild_scheduled_event',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              oneOf: [
                {
                  $ref: '#/components/schemas/ExternalScheduledEventCreateRequest',
                },
                {
                  $ref: '#/components/schemas/StageScheduledEventCreateRequest',
                },
                {
                  $ref: '#/components/schemas/VoiceScheduledEventCreateRequest',
                },
              ],
            },
          },
        },
        required: true,
      },
      responses: {
        '200': {
          description: '200 response for create_guild_scheduled_event',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    $ref: '#/components/schemas/ExternalScheduledEventResponse',
                  },
                  {
                    $ref: '#/components/schemas/StageScheduledEventResponse',
                  },
                  {
                    $ref: '#/components/schemas/VoiceScheduledEventResponse',
                  },
                ],
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
  },
  '/guilds/{guild_id}/welcome-screen': {
    parameters: [
      {
        name: 'guild_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
    ],
    get: {
      operationId: 'get_guild_welcome_screen',
      responses: {
        '200': {
          description: '200 response for get_guild_welcome_screen',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/GuildWelcomeScreenResponse',
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
    patch: {
      operationId: 'update_guild_welcome_screen',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/WelcomeScreenPatchRequestPartial',
            },
          },
        },
        required: true,
      },
      responses: {
        '200': {
          description: '200 response for update_guild_welcome_screen',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/GuildWelcomeScreenResponse',
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
  },
  '/guilds/{guild_id}/voice-states/{user_id}': {
    parameters: [
      {
        name: 'guild_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
      {
        name: 'user_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
    ],
    patch: {
      operationId: 'update_voice_state',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                suppress: {
                  type: ['boolean', 'null'],
                },
                channel_id: {
                  oneOf: [
                    {
                      type: 'null',
                    },
                    {
                      $ref: '#/components/schemas/SnowflakeType',
                    },
                  ],
                },
              },
            },
          },
        },
        required: true,
      },
      responses: {
        '204': {
          description: '204 response for update_voice_state',
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
  },
  '/guilds/{guild_id}/integrations/{integration_id}': {
    parameters: [
      {
        name: 'guild_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
      {
        name: 'integration_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
    ],
    delete: {
      operationId: 'delete_guild_integration',
      responses: {
        '204': {
          description: '204 response for delete_guild_integration',
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
  },
  '/guilds/{guild_id}/integrations': {
    parameters: [
      {
        name: 'guild_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
    ],
    get: {
      operationId: 'list_guild_integrations',
      responses: {
        '200': {
          description: '200 response for list_guild_integrations',
          content: {
            'application/json': {
              schema: {
                type: ['array', 'null'],
                items: {
                  oneOf: [
                    {
                      $ref: '#/components/schemas/DiscordIntegrationResponse',
                    },
                    {
                      $ref: '#/components/schemas/ExternalConnectionIntegrationResponse',
                    },
                    {
                      $ref: '#/components/schemas/GuildSubscriptionIntegrationResponse',
                    },
                  ],
                },
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
  },
  '/guilds/{guild_id}/widget.json': {
    parameters: [
      {
        name: 'guild_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
    ],
    get: {
      operationId: 'get_guild_widget',
      responses: {
        '200': {
          description: '200 response for get_guild_widget',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/WidgetResponse',
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {},
        {
          BotToken: [],
        },
      ],
    },
  },
  '/guilds/{guild_id}/onboarding': {
    parameters: [
      {
        name: 'guild_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
    ],
    get: {
      operationId: 'get_guilds_onboarding',
      responses: {
        '200': {
          description: '200 response for get_guilds_onboarding',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/UserGuildOnboardingResponse',
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
    put: {
      operationId: 'put_guilds_onboarding',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/UpdateGuildOnboardingRequest',
            },
          },
        },
        required: true,
      },
      responses: {
        '200': {
          description: '200 response for put_guilds_onboarding',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/GuildOnboardingResponse',
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
  },
  '/guilds/{guild_id}/vanity-url': {
    parameters: [
      {
        name: 'guild_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
    ],
    get: {
      operationId: 'get_guild_vanity_url',
      responses: {
        '200': {
          description: '200 response for get_guild_vanity_url',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/VanityURLResponse',
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
  },
  '/guilds/{guild_id}/audit-logs': {
    parameters: [
      {
        name: 'guild_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
    ],
    get: {
      operationId: 'list_guild_audit_log_entries',
      parameters: [
        {
          name: 'user_id',
          in: 'query',
          schema: {
            $ref: '#/components/schemas/SnowflakeType',
          },
        },
        {
          name: 'action_type',
          in: 'query',
          schema: {
            type: 'integer',
          },
        },
        {
          name: 'before',
          in: 'query',
          schema: {
            $ref: '#/components/schemas/SnowflakeType',
          },
        },
        {
          name: 'after',
          in: 'query',
          schema: {
            $ref: '#/components/schemas/SnowflakeType',
          },
        },
        {
          name: 'limit',
          in: 'query',
          schema: {
            type: 'integer',
            minimum: 1,
            maximum: 100,
          },
        },
      ],
      responses: {
        '200': {
          description: '200 response for list_guild_audit_log_entries',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/GuildAuditLogResponse',
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
  },
  '/guilds/{guild_id}/widget.png': {
    parameters: [
      {
        name: 'guild_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
    ],
    get: {
      operationId: 'get_guild_widget_png',
      parameters: [
        {
          name: 'style',
          in: 'query',
          schema: {
            $ref: '#/components/schemas/WidgetImageStyles',
          },
        },
      ],
      responses: {
        '200': {
          description: '200 response for get_guild_widget_png',
          content: {
            'image/png': {
              schema: {
                type: 'string',
                contentEncoding: 'binary',
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {},
        {
          BotToken: [],
        },
      ],
    },
  },
  '/guilds/{guild_id}/templates/{code}': {
    parameters: [
      {
        name: 'guild_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
      {
        name: 'code',
        in: 'path',
        schema: {
          type: 'string',
          maxLength: 152133,
        },
        required: true,
      },
    ],
    put: {
      operationId: 'sync_guild_template',
      responses: {
        '200': {
          description: '200 response for sync_guild_template',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/GuildTemplateResponse',
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
    delete: {
      operationId: 'delete_guild_template',
      responses: {
        '200': {
          description: '200 response for delete_guild_template',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/GuildTemplateResponse',
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
    patch: {
      operationId: 'update_guild_template',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  minLength: 1,
                  maxLength: 100,
                },
                description: {
                  type: ['string', 'null'],
                  maxLength: 120,
                },
              },
            },
          },
        },
        required: true,
      },
      responses: {
        '200': {
          description: '200 response for update_guild_template',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/GuildTemplateResponse',
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
  },
  '/guilds/{guild_id}/templates': {
    parameters: [
      {
        name: 'guild_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
    ],
    get: {
      operationId: 'list_guild_templates',
      responses: {
        '200': {
          description: '200 response for list_guild_templates',
          content: {
            'application/json': {
              schema: {
                type: ['array', 'null'],
                items: {
                  $ref: '#/components/schemas/GuildTemplateResponse',
                },
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
    post: {
      operationId: 'create_guild_template',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  minLength: 1,
                  maxLength: 100,
                },
                description: {
                  type: ['string', 'null'],
                  maxLength: 120,
                },
              },
              required: ['name'],
            },
          },
        },
        required: true,
      },
      responses: {
        '200': {
          description: '200 response for create_guild_template',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/GuildTemplateResponse',
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
  },
  '/guilds/{guild_id}/stickers/{sticker_id}': {
    parameters: [
      {
        name: 'guild_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
      {
        name: 'sticker_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
    ],
    get: {
      operationId: 'get_guild_sticker',
      responses: {
        '200': {
          description: '200 response for get_guild_sticker',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/GuildStickerResponse',
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
    delete: {
      operationId: 'delete_guild_sticker',
      responses: {
        '204': {
          description: '204 response for delete_guild_sticker',
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
    patch: {
      operationId: 'update_guild_sticker',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  minLength: 2,
                  maxLength: 30,
                },
                tags: {
                  type: 'string',
                  minLength: 1,
                  maxLength: 200,
                },
                description: {
                  type: ['string', 'null'],
                  maxLength: 100,
                },
              },
            },
          },
        },
        required: true,
      },
      responses: {
        '200': {
          description: '200 response for update_guild_sticker',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/GuildStickerResponse',
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
  },
  '/guilds/{guild_id}/stickers': {
    parameters: [
      {
        name: 'guild_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
    ],
    get: {
      operationId: 'list_guild_stickers',
      responses: {
        '200': {
          description: '200 response for list_guild_stickers',
          content: {
            'application/json': {
              schema: {
                type: 'array',
                items: {
                  $ref: '#/components/schemas/GuildStickerResponse',
                },
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
    post: {
      operationId: 'create_guild_sticker',
      requestBody: {
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  minLength: 2,
                  maxLength: 30,
                },
                tags: {
                  type: 'string',
                  minLength: 1,
                  maxLength: 200,
                },
                description: {
                  type: ['string', 'null'],
                  maxLength: 100,
                },
                file: {
                  type: 'string',
                  contentEncoding: 'binary',
                },
              },
              required: ['name', 'tags', 'file'],
            },
          },
        },
        required: true,
      },
      responses: {
        '201': {
          description: '201 response for create_guild_sticker',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/GuildStickerResponse',
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
  },
  '/guilds/{guild_id}/webhooks': {
    parameters: [
      {
        name: 'guild_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
    ],
    get: {
      operationId: 'get_guild_webhooks',
      responses: {
        '200': {
          description: '200 response for get_guild_webhooks',
          content: {
            'application/json': {
              schema: {
                type: ['array', 'null'],
                items: {
                  oneOf: [
                    {
                      $ref: '#/components/schemas/ApplicationIncomingWebhookResponse',
                    },
                    {
                      $ref: '#/components/schemas/ChannelFollowerWebhookResponse',
                    },
                    {
                      $ref: '#/components/schemas/GuildIncomingWebhookResponse',
                    },
                  ],
                },
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
  },
  '/guilds/{guild_id}/channels': {
    parameters: [
      {
        name: 'guild_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
    ],
    get: {
      operationId: 'list_guild_channels',
      responses: {
        '200': {
          description: '200 response for list_guild_channels',
          content: {
            'application/json': {
              schema: {
                type: ['array', 'null'],
                items: {
                  oneOf: [
                    {
                      $ref: '#/components/schemas/GuildChannelResponse',
                    },
                    {
                      $ref: '#/components/schemas/PrivateChannelResponse',
                    },
                    {
                      $ref: '#/components/schemas/PrivateGroupChannelResponse',
                    },
                    {
                      $ref: '#/components/schemas/ThreadResponse',
                    },
                  ],
                },
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
    post: {
      operationId: 'create_guild_channel',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/CreateGuildChannelRequest',
            },
          },
        },
        required: true,
      },
      responses: {
        '201': {
          description: '201 response for create_guild_channel',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/GuildChannelResponse',
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
    patch: {
      operationId: 'bulk_update_guild_channels',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: {
                    $ref: '#/components/schemas/SnowflakeType',
                  },
                  position: {
                    type: ['integer', 'null'],
                    minimum: 0,
                    format: 'int32',
                  },
                  parent_id: {
                    oneOf: [
                      {
                        type: 'null',
                      },
                      {
                        $ref: '#/components/schemas/SnowflakeType',
                      },
                    ],
                  },
                  lock_permissions: {
                    type: ['boolean', 'null'],
                  },
                },
              },
            },
          },
        },
        required: true,
      },
      responses: {
        '204': {
          description: '204 response for bulk_update_guild_channels',
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
  },
  '/guilds/{guild_id}/members/{user_id}': {
    parameters: [
      {
        name: 'guild_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
      {
        name: 'user_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
    ],
    get: {
      operationId: 'get_guild_member',
      responses: {
        '200': {
          description: '200 response for get_guild_member',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/GuildMemberResponse',
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
    put: {
      operationId: 'add_guild_member',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                nick: {
                  type: ['string', 'null'],
                  maxLength: 32,
                },
                roles: {
                  type: ['array', 'null'],
                  items: {
                    oneOf: [
                      {
                        type: 'null',
                      },
                      {
                        $ref: '#/components/schemas/SnowflakeType',
                      },
                    ],
                  },
                  maxItems: 1521,
                  uniqueItems: true,
                },
                mute: {
                  type: ['boolean', 'null'],
                },
                deaf: {
                  type: ['boolean', 'null'],
                },
                access_token: {
                  type: 'string',
                  maxLength: 152133,
                },
                flags: {
                  type: ['integer', 'null'],
                },
              },
              required: ['access_token'],
            },
          },
        },
        required: true,
      },
      responses: {
        '201': {
          description: '201 response for add_guild_member',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/GuildMemberResponse',
              },
            },
          },
        },
        '204': {
          description: '204 response for add_guild_member',
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
    delete: {
      operationId: 'delete_guild_member',
      responses: {
        '204': {
          description: '204 response for delete_guild_member',
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
    patch: {
      operationId: 'update_guild_member',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                nick: {
                  type: ['string', 'null'],
                  maxLength: 32,
                },
                roles: {
                  type: ['array', 'null'],
                  items: {
                    oneOf: [
                      {
                        type: 'null',
                      },
                      {
                        $ref: '#/components/schemas/SnowflakeType',
                      },
                    ],
                  },
                  maxItems: 1521,
                  uniqueItems: true,
                },
                mute: {
                  type: ['boolean', 'null'],
                },
                deaf: {
                  type: ['boolean', 'null'],
                },
                channel_id: {
                  oneOf: [
                    {
                      type: 'null',
                    },
                    {
                      $ref: '#/components/schemas/SnowflakeType',
                    },
                  ],
                },
                communication_disabled_until: {
                  type: ['string', 'null'],
                  format: 'date-time',
                },
                flags: {
                  type: ['integer', 'null'],
                },
              },
            },
          },
        },
        required: true,
      },
      responses: {
        '200': {
          description: '200 response for update_guild_member',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/GuildMemberResponse',
              },
            },
          },
        },
        '204': {
          description: '204 response for update_guild_member',
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
  },
  '/guilds/{guild_id}/members': {
    parameters: [
      {
        name: 'guild_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
    ],
    get: {
      operationId: 'list_guild_members',
      parameters: [
        {
          name: 'limit',
          in: 'query',
          schema: {
            type: 'integer',
            minimum: 1,
            maximum: 1000,
          },
        },
        {
          name: 'after',
          in: 'query',
          schema: {
            type: 'integer',
            minimum: 0,
          },
        },
      ],
      responses: {
        '200': {
          description: '200 response for list_guild_members',
          content: {
            'application/json': {
              schema: {
                type: 'array',
                items: {
                  $ref: '#/components/schemas/GuildMemberResponse',
                },
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
  },
  '/guilds/{guild_id}/preview': {
    parameters: [
      {
        name: 'guild_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
    ],
    get: {
      operationId: 'get_guild_preview',
      responses: {
        '200': {
          description: '200 response for get_guild_preview',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/GuildPreviewResponse',
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
  },
  '/guilds/{guild_id}/invites': {
    parameters: [
      {
        name: 'guild_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
    ],
    get: {
      operationId: 'list_guild_invites',
      responses: {
        '200': {
          description: '200 response for list_guild_invites',
          content: {
            'application/json': {
              schema: {
                type: ['array', 'null'],
                items: {
                  anyOf: [
                    {
                      $ref: '#/components/schemas/FriendInviteResponse',
                    },
                    {
                      $ref: '#/components/schemas/GroupDMInviteResponse',
                    },
                    {
                      $ref: '#/components/schemas/GuildInviteResponse',
                    },
                  ],
                  'x-discord-union': 'oneOf',
                },
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
  },
  '/guilds/{guild_id}/regions': {
    parameters: [
      {
        name: 'guild_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
    ],
    get: {
      operationId: 'list_guild_voice_regions',
      responses: {
        '200': {
          description: '200 response for list_guild_voice_regions',
          content: {
            'application/json': {
              schema: {
                type: ['array', 'null'],
                items: {
                  $ref: '#/components/schemas/VoiceRegionResponse',
                },
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
  },
  '/guilds/{guild_id}/emojis/{emoji_id}': {
    parameters: [
      {
        name: 'guild_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
      {
        name: 'emoji_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
    ],
    get: {
      operationId: 'get_guild_emoji',
      responses: {
        '200': {
          description: '200 response for get_guild_emoji',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/EmojiResponse',
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
    delete: {
      operationId: 'delete_guild_emoji',
      responses: {
        '204': {
          description: '204 response for delete_guild_emoji',
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
    patch: {
      operationId: 'update_guild_emoji',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  minLength: 2,
                  maxLength: 32,
                },
                roles: {
                  type: ['array', 'null'],
                  items: {
                    oneOf: [
                      {
                        type: 'null',
                      },
                      {
                        $ref: '#/components/schemas/SnowflakeType',
                      },
                    ],
                  },
                  maxItems: 1521,
                  uniqueItems: true,
                },
              },
            },
          },
        },
        required: true,
      },
      responses: {
        '200': {
          description: '200 response for update_guild_emoji',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/EmojiResponse',
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
  },
  '/guilds/{guild_id}/emojis': {
    parameters: [
      {
        name: 'guild_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
    ],
    get: {
      operationId: 'list_guild_emojis',
      responses: {
        '200': {
          description: '200 response for list_guild_emojis',
          content: {
            'application/json': {
              schema: {
                type: ['array', 'null'],
                items: {
                  $ref: '#/components/schemas/EmojiResponse',
                },
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
    post: {
      operationId: 'create_guild_emoji',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  minLength: 2,
                  maxLength: 32,
                },
                image: {
                  type: 'string',
                  contentEncoding: 'base64',
                },
                roles: {
                  type: ['array', 'null'],
                  items: {
                    oneOf: [
                      {
                        type: 'null',
                      },
                      {
                        $ref: '#/components/schemas/SnowflakeType',
                      },
                    ],
                  },
                  maxItems: 1521,
                  uniqueItems: true,
                },
              },
              required: ['name', 'image'],
            },
          },
        },
        required: true,
      },
      responses: {
        '201': {
          description: '201 response for create_guild_emoji',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/EmojiResponse',
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
  },
  '/guilds/{guild_id}/widget': {
    parameters: [
      {
        name: 'guild_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
    ],
    get: {
      operationId: 'get_guild_widget_settings',
      responses: {
        '200': {
          description: '200 response for get_guild_widget_settings',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/WidgetSettingsResponse',
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
    patch: {
      operationId: 'update_guild_widget_settings',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                channel_id: {
                  oneOf: [
                    {
                      type: 'null',
                    },
                    {
                      $ref: '#/components/schemas/SnowflakeType',
                    },
                  ],
                },
                enabled: {
                  type: ['boolean', 'null'],
                },
              },
            },
          },
        },
        required: true,
      },
      responses: {
        '200': {
          description: '200 response for update_guild_widget_settings',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/WidgetSettingsResponse',
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
  },
  '/guilds/{guild_id}/roles/{role_id}': {
    parameters: [
      {
        name: 'guild_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
      {
        name: 'role_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
    ],
    delete: {
      operationId: 'delete_guild_role',
      responses: {
        '204': {
          description: '204 response for delete_guild_role',
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
    patch: {
      operationId: 'update_guild_role',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                name: {
                  type: ['string', 'null'],
                  maxLength: 100,
                },
                permissions: {
                  type: ['integer', 'null'],
                },
                color: {
                  type: ['integer', 'null'],
                  minimum: 0,
                  maximum: 16777215,
                },
                hoist: {
                  type: ['boolean', 'null'],
                },
                mentionable: {
                  type: ['boolean', 'null'],
                },
                icon: {
                  type: ['string', 'null'],
                  contentEncoding: 'base64',
                },
                unicode_emoji: {
                  type: ['string', 'null'],
                  maxLength: 100,
                },
              },
            },
          },
        },
        required: true,
      },
      responses: {
        '200': {
          description: '200 response for update_guild_role',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/GuildRoleResponse',
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
  },
  '/guilds/{guild_id}/roles': {
    parameters: [
      {
        name: 'guild_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
    ],
    get: {
      operationId: 'list_guild_roles',
      responses: {
        '200': {
          description: '200 response for list_guild_roles',
          content: {
            'application/json': {
              schema: {
                type: 'array',
                items: {
                  $ref: '#/components/schemas/GuildRoleResponse',
                },
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
    post: {
      operationId: 'create_guild_role',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                name: {
                  type: ['string', 'null'],
                  maxLength: 100,
                },
                permissions: {
                  type: ['integer', 'null'],
                },
                color: {
                  type: ['integer', 'null'],
                  minimum: 0,
                  maximum: 16777215,
                },
                hoist: {
                  type: ['boolean', 'null'],
                },
                mentionable: {
                  type: ['boolean', 'null'],
                },
                icon: {
                  type: ['string', 'null'],
                  contentEncoding: 'base64',
                },
                unicode_emoji: {
                  type: ['string', 'null'],
                  maxLength: 100,
                },
              },
            },
          },
        },
        required: true,
      },
      responses: {
        '200': {
          description: '200 response for create_guild_role',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/GuildRoleResponse',
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
    patch: {
      operationId: 'bulk_update_guild_roles',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: {
                    oneOf: [
                      {
                        type: 'null',
                      },
                      {
                        $ref: '#/components/schemas/SnowflakeType',
                      },
                    ],
                  },
                  position: {
                    type: ['integer', 'null'],
                    format: 'int32',
                  },
                },
              },
            },
          },
        },
        required: true,
      },
      responses: {
        '200': {
          description: '200 response for bulk_update_guild_roles',
          content: {
            'application/json': {
              schema: {
                type: 'array',
                items: {
                  $ref: '#/components/schemas/GuildRoleResponse',
                },
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
  },
  '/guilds/{guild_id}/prune': {
    parameters: [
      {
        name: 'guild_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
    ],
    get: {
      operationId: 'preview_prune_guild',
      parameters: [
        {
          name: 'days',
          in: 'query',
          schema: {
            type: 'integer',
            minimum: 1,
            maximum: 30,
          },
        },
        {
          name: 'include_roles',
          in: 'query',
          schema: {
            oneOf: [
              {
                type: 'string',
              },
              {
                type: 'array',
                items: {
                  oneOf: [
                    {
                      type: 'null',
                    },
                    {
                      $ref: '#/components/schemas/SnowflakeType',
                    },
                  ],
                },
                maxItems: 100,
                uniqueItems: true,
              },
            ],
          },
        },
      ],
      responses: {
        '200': {
          description: '200 response for preview_prune_guild',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/GuildPruneResponse',
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
    post: {
      operationId: 'prune_guild',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                days: {
                  type: ['integer', 'null'],
                  minimum: 1,
                  maximum: 30,
                },
                compute_prune_count: {
                  type: ['boolean', 'null'],
                },
                include_roles: {
                  oneOf: [
                    {
                      type: 'string',
                    },
                    {
                      type: 'array',
                      items: {
                        oneOf: [
                          {
                            type: 'null',
                          },
                          {
                            $ref: '#/components/schemas/SnowflakeType',
                          },
                        ],
                      },
                      maxItems: 100,
                      uniqueItems: true,
                    },
                    {
                      type: 'null',
                    },
                  ],
                },
              },
            },
          },
        },
        required: true,
      },
      responses: {
        '200': {
          description: '200 response for prune_guild',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/GuildPruneResponse',
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
  },
  '/guilds/{guild_id}/bans/{user_id}': {
    parameters: [
      {
        name: 'guild_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
      {
        name: 'user_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
    ],
    get: {
      operationId: 'get_guild_ban',
      responses: {
        '200': {
          description: '200 response for get_guild_ban',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/GuildBanResponse',
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
    put: {
      operationId: 'ban_user_from_guild',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                delete_message_seconds: {
                  type: ['integer', 'null'],
                  minimum: 0,
                  maximum: 604800,
                },
                delete_message_days: {
                  type: ['integer', 'null'],
                  minimum: 0,
                  maximum: 7,
                },
              },
            },
          },
        },
        required: true,
      },
      responses: {
        '204': {
          description: '204 response for ban_user_from_guild',
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
    delete: {
      operationId: 'unban_user_from_guild',
      responses: {
        '204': {
          description: '204 response for unban_user_from_guild',
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
  },
  '/guilds/{guild_id}/bans': {
    parameters: [
      {
        name: 'guild_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
    ],
    get: {
      operationId: 'list_guild_bans',
      parameters: [
        {
          name: 'limit',
          in: 'query',
          schema: {
            type: 'integer',
            minimum: 1,
            maximum: 1000,
          },
        },
        {
          name: 'before',
          in: 'query',
          schema: {
            $ref: '#/components/schemas/SnowflakeType',
          },
        },
        {
          name: 'after',
          in: 'query',
          schema: {
            $ref: '#/components/schemas/SnowflakeType',
          },
        },
      ],
      responses: {
        '200': {
          description: '200 response for list_guild_bans',
          content: {
            'application/json': {
              schema: {
                type: ['array', 'null'],
                items: {
                  $ref: '#/components/schemas/GuildBanResponse',
                },
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
  },
  '/guilds/{guild_id}/mfa': {
    parameters: [
      {
        name: 'guild_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
    ],
    post: {
      operationId: 'set_guild_mfa_level',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                level: {
                  $ref: '#/components/schemas/GuildMFALevel',
                },
              },
              required: ['level'],
            },
          },
        },
        required: true,
      },
      responses: {
        '200': {
          description: '200 response for set_guild_mfa_level',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/GuildMFALevelResponse',
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
  },
  '/stage-instances/{channel_id}': {
    parameters: [
      {
        name: 'channel_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
    ],
    get: {
      operationId: 'get_stage_instance',
      responses: {
        '200': {
          description: '200 response for get_stage_instance',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/StageInstanceResponse',
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
    delete: {
      operationId: 'delete_stage_instance',
      responses: {
        '204': {
          description: '204 response for delete_stage_instance',
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
    patch: {
      operationId: 'update_stage_instance',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                topic: {
                  type: 'string',
                  minLength: 1,
                  maxLength: 120,
                },
                privacy_level: {
                  $ref: '#/components/schemas/StageInstancesPrivacyLevels',
                },
              },
            },
          },
        },
        required: true,
      },
      responses: {
        '200': {
          description: '200 response for update_stage_instance',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/StageInstanceResponse',
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
  },
  '/applications/{application_id}': {
    parameters: [
      {
        name: 'application_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
    ],
    get: {
      operationId: 'get_application',
      responses: {
        '200': {
          description: '200 response for get_application',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PrivateApplicationResponse',
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
    patch: {
      operationId: 'update_application',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/ApplicationFormPartial',
            },
          },
        },
        required: true,
      },
      responses: {
        '200': {
          description: '200 response for update_application',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PrivateApplicationResponse',
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
  },
  '/webhooks/{webhook_id}/{webhook_token}': {
    parameters: [
      {
        name: 'webhook_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
      {
        name: 'webhook_token',
        in: 'path',
        schema: {
          type: 'string',
          maxLength: 152133,
        },
        required: true,
      },
    ],
    get: {
      operationId: 'get_webhook_by_token',
      responses: {
        '200': {
          description: '200 response for get_webhook_by_token',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    $ref: '#/components/schemas/ApplicationIncomingWebhookResponse',
                  },
                  {
                    $ref: '#/components/schemas/ChannelFollowerWebhookResponse',
                  },
                  {
                    $ref: '#/components/schemas/GuildIncomingWebhookResponse',
                  },
                ],
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {},
        {
          BotToken: [],
        },
      ],
    },
    post: {
      operationId: 'execute_webhook',
      parameters: [
        {
          name: 'wait',
          in: 'query',
          schema: {
            type: 'boolean',
          },
        },
        {
          name: 'thread_id',
          in: 'query',
          schema: {
            $ref: '#/components/schemas/SnowflakeType',
          },
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              anyOf: [
                {
                  $ref: '#/components/schemas/IncomingWebhookRequestPartial',
                },
                {
                  $ref: '#/components/schemas/IncomingWebhookUpdateRequestPartial',
                },
              ],
              'x-discord-union': 'oneOf',
            },
          },
          'application/x-www-form-urlencoded': {
            schema: {
              anyOf: [
                {
                  $ref: '#/components/schemas/IncomingWebhookRequestPartial',
                },
                {
                  $ref: '#/components/schemas/IncomingWebhookUpdateRequestPartial',
                },
              ],
              'x-discord-union': 'oneOf',
            },
          },
          'multipart/form-data': {
            schema: {
              anyOf: [
                {
                  $ref: '#/components/schemas/IncomingWebhookRequestPartial',
                },
                {
                  $ref: '#/components/schemas/IncomingWebhookUpdateRequestPartial',
                },
              ],
              'x-discord-union': 'oneOf',
            },
          },
        },
        required: true,
      },
      responses: {
        '200': {
          description: '200 response for execute_webhook',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/MessageResponse',
              },
            },
          },
        },
        '204': {
          description: '204 response for execute_webhook',
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {},
        {
          BotToken: [],
        },
      ],
    },
    delete: {
      operationId: 'delete_webhook_by_token',
      responses: {
        '204': {
          description: '204 response for delete_webhook_by_token',
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {},
        {
          BotToken: [],
        },
      ],
    },
    patch: {
      operationId: 'update_webhook_by_token',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  minLength: 1,
                  maxLength: 80,
                },
                avatar: {
                  type: ['string', 'null'],
                  contentEncoding: 'base64',
                },
              },
            },
          },
        },
        required: true,
      },
      responses: {
        '200': {
          description: '200 response for update_webhook_by_token',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    $ref: '#/components/schemas/ApplicationIncomingWebhookResponse',
                  },
                  {
                    $ref: '#/components/schemas/ChannelFollowerWebhookResponse',
                  },
                  {
                    $ref: '#/components/schemas/GuildIncomingWebhookResponse',
                  },
                ],
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {},
        {
          BotToken: [],
        },
      ],
    },
  },
  '/stickers/{sticker_id}': {
    parameters: [
      {
        name: 'sticker_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
    ],
    get: {
      operationId: 'get_sticker',
      responses: {
        '200': {
          description: '200 response for get_sticker',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    $ref: '#/components/schemas/GuildStickerResponse',
                  },
                  {
                    $ref: '#/components/schemas/StandardStickerResponse',
                  },
                ],
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
  },
  '/webhooks/{webhook_id}': {
    parameters: [
      {
        name: 'webhook_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
    ],
    get: {
      operationId: 'get_webhook',
      responses: {
        '200': {
          description: '200 response for get_webhook',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    $ref: '#/components/schemas/ApplicationIncomingWebhookResponse',
                  },
                  {
                    $ref: '#/components/schemas/ChannelFollowerWebhookResponse',
                  },
                  {
                    $ref: '#/components/schemas/GuildIncomingWebhookResponse',
                  },
                ],
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
    delete: {
      operationId: 'delete_webhook',
      responses: {
        '204': {
          description: '204 response for delete_webhook',
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
    patch: {
      operationId: 'update_webhook',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  minLength: 1,
                  maxLength: 80,
                },
                avatar: {
                  type: ['string', 'null'],
                  contentEncoding: 'base64',
                },
                channel_id: {
                  oneOf: [
                    {
                      type: 'null',
                    },
                    {
                      $ref: '#/components/schemas/SnowflakeType',
                    },
                  ],
                },
              },
            },
          },
        },
        required: true,
      },
      responses: {
        '200': {
          description: '200 response for update_webhook',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    $ref: '#/components/schemas/ApplicationIncomingWebhookResponse',
                  },
                  {
                    $ref: '#/components/schemas/ChannelFollowerWebhookResponse',
                  },
                  {
                    $ref: '#/components/schemas/GuildIncomingWebhookResponse',
                  },
                ],
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
  },
  '/channels/{channel_id}': {
    parameters: [
      {
        name: 'channel_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
    ],
    get: {
      operationId: 'get_channel',
      responses: {
        '200': {
          description: '200 response for get_channel',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    $ref: '#/components/schemas/GuildChannelResponse',
                  },
                  {
                    $ref: '#/components/schemas/PrivateChannelResponse',
                  },
                  {
                    $ref: '#/components/schemas/PrivateGroupChannelResponse',
                  },
                  {
                    $ref: '#/components/schemas/ThreadResponse',
                  },
                ],
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
    delete: {
      operationId: 'delete_channel',
      responses: {
        '200': {
          description: '200 response for delete_channel',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    $ref: '#/components/schemas/GuildChannelResponse',
                  },
                  {
                    $ref: '#/components/schemas/PrivateChannelResponse',
                  },
                  {
                    $ref: '#/components/schemas/PrivateGroupChannelResponse',
                  },
                  {
                    $ref: '#/components/schemas/ThreadResponse',
                  },
                ],
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
    patch: {
      operationId: 'update_channel',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              anyOf: [
                {
                  $ref: '#/components/schemas/PrivateChannelRequestPartial',
                },
                {
                  $ref: '#/components/schemas/UpdateGuildChannelRequestPartial',
                },
                {
                  $ref: '#/components/schemas/UpdateThreadRequestPartial',
                },
              ],
              'x-discord-union': 'oneOf',
            },
          },
        },
        required: true,
      },
      responses: {
        '200': {
          description: '200 response for update_channel',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    $ref: '#/components/schemas/GuildChannelResponse',
                  },
                  {
                    $ref: '#/components/schemas/PrivateChannelResponse',
                  },
                  {
                    $ref: '#/components/schemas/PrivateGroupChannelResponse',
                  },
                  {
                    $ref: '#/components/schemas/ThreadResponse',
                  },
                ],
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
  },
  '/invites/{code}': {
    parameters: [
      {
        name: 'code',
        in: 'path',
        schema: {
          type: 'string',
          maxLength: 152133,
        },
        required: true,
      },
    ],
    get: {
      operationId: 'invite_resolve',
      parameters: [
        {
          name: 'with_counts',
          in: 'query',
          schema: {
            type: 'boolean',
          },
        },
        {
          name: 'guild_scheduled_event_id',
          in: 'query',
          schema: {
            $ref: '#/components/schemas/SnowflakeType',
          },
        },
      ],
      responses: {
        '200': {
          description: '200 response for invite_resolve',
          content: {
            'application/json': {
              schema: {
                anyOf: [
                  {
                    $ref: '#/components/schemas/FriendInviteResponse',
                  },
                  {
                    $ref: '#/components/schemas/GroupDMInviteResponse',
                  },
                  {
                    $ref: '#/components/schemas/GuildInviteResponse',
                  },
                ],
                'x-discord-union': 'oneOf',
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {},
        {
          BotToken: [],
        },
      ],
    },
    delete: {
      operationId: 'invite_revoke',
      responses: {
        '200': {
          description: '200 response for invite_revoke',
          content: {
            'application/json': {
              schema: {
                anyOf: [
                  {
                    $ref: '#/components/schemas/FriendInviteResponse',
                  },
                  {
                    $ref: '#/components/schemas/GroupDMInviteResponse',
                  },
                  {
                    $ref: '#/components/schemas/GuildInviteResponse',
                  },
                ],
                'x-discord-union': 'oneOf',
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
  },
  '/guilds/{guild_id}': {
    parameters: [
      {
        name: 'guild_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
    ],
    get: {
      operationId: 'get_guild',
      parameters: [
        {
          name: 'with_counts',
          in: 'query',
          schema: {
            type: 'boolean',
          },
        },
      ],
      responses: {
        '200': {
          description: '200 response for get_guild',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/GuildWithCountsResponse',
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
    delete: {
      operationId: 'delete_guild',
      responses: {
        '204': {
          description: '204 response for delete_guild',
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
    patch: {
      operationId: 'update_guild',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/GuildPatchRequestPartial',
            },
          },
        },
        required: true,
      },
      responses: {
        '200': {
          description: '200 response for update_guild',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/GuildResponse',
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
  },
  '/users/{user_id}': {
    parameters: [
      {
        name: 'user_id',
        in: 'path',
        schema: {
          $ref: '#/components/schemas/SnowflakeType',
        },
        required: true,
      },
    ],
    get: {
      operationId: 'get_user',
      responses: {
        '200': {
          description: '200 response for get_user',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/UserResponse',
              },
            },
          },
        },
        '4XX': {
          $ref: '#/components/responses/ClientErrorResponse',
        },
      },
      security: [
        {
          BotToken: [],
        },
      ],
    },
  },
} as TPaths;
