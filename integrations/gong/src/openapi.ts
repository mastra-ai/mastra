// @ts-nocheck
export type openapi = {
  openapi: '3.1.0';
  externalDocs: {
    url: 'https://discord.com/developers/docs';
    description: 'Discord Developer Documentation';
  };
  servers: [
    {
      url: 'https://discord.com/api/v10';
    },
  ];
  paths: {
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
  components: {
    schemas: {
      AccountResponse: {
        type: 'object';
        properties: {
          id: {
            type: 'string';
          };
          name: {
            type: ['string', 'null'];
          };
        };
        required: ['id'];
      };
      ActionRow: {
        type: 'object';
        properties: {
          type: {
            type: 'integer';
            enum: [1];
            allOf: [
              {
                $ref: '#/components/schemas/MessageComponentTypes';
              },
            ];
            format: 'int32';
          };
          components: {
            type: 'array';
            items: {
              oneOf: [
                {
                  $ref: '#/components/schemas/Button';
                },
                {
                  $ref: '#/components/schemas/ChannelSelect';
                },
                {
                  $ref: '#/components/schemas/InputText';
                },
                {
                  $ref: '#/components/schemas/MentionableSelect';
                },
                {
                  $ref: '#/components/schemas/RoleSelect';
                },
                {
                  $ref: '#/components/schemas/StringSelect';
                },
                {
                  $ref: '#/components/schemas/UserSelect';
                },
              ];
            };
            minItems: 1;
            maxItems: 5;
          };
        };
        required: ['type', 'components'];
      };
      AfkTimeouts: {
        type: 'integer';
        oneOf: [
          {
            title: 'ONE_MINUTE';
            const: 60;
          },
          {
            title: 'FIVE_MINUTES';
            const: 300;
          },
          {
            title: 'FIFTEEN_MINUTES';
            const: 900;
          },
          {
            title: 'THIRTY_MINUTES';
            const: 1800;
          },
          {
            title: 'ONE_HOUR';
            const: 3600;
          },
        ];
        format: 'int32';
      };
      AllowedMentionTypes: {
        type: 'string';
        oneOf: [
          {
            title: 'USERS';
            description: 'Controls role mentions';
            const: 'users';
          },
          {
            title: 'ROLES';
            description: 'Controls user mentions';
            const: 'roles';
          },
          {
            title: 'EVERYONE';
            description: 'Controls @everyone and @here mentions';
            const: 'everyone';
          },
        ];
      };
      ApplicationCommandAttachmentOption: {
        type: 'object';
        properties: {
          type: {
            type: 'integer';
            enum: [11];
            allOf: [
              {
                $ref: '#/components/schemas/ApplicationCommandOptionType';
              },
            ];
            format: 'int32';
          };
          name: {
            type: 'string';
            minLength: 1;
            maxLength: 32;
          };
          name_localizations: {
            type: ['object', 'null'];
            additionalProperties: {
              type: 'string';
              minLength: 1;
              maxLength: 32;
            };
            maxProperties: 34;
          };
          description: {
            type: 'string';
            minLength: 1;
            maxLength: 100;
          };
          description_localizations: {
            type: ['object', 'null'];
            additionalProperties: {
              type: 'string';
              minLength: 1;
              maxLength: 100;
            };
            maxProperties: 34;
          };
          required: {
            type: ['boolean', 'null'];
          };
        };
        required: ['type', 'name', 'description'];
      };
      ApplicationCommandAttachmentOptionResponse: {
        type: 'object';
        properties: {
          type: {
            type: 'integer';
            enum: [11];
            allOf: [
              {
                $ref: '#/components/schemas/ApplicationCommandOptionType';
              },
            ];
            format: 'int32';
          };
          name: {
            type: 'string';
          };
          name_localized: {
            type: ['string', 'null'];
          };
          name_localizations: {
            type: ['object', 'null'];
            additionalProperties: {
              type: 'string';
            };
          };
          description: {
            type: 'string';
          };
          description_localized: {
            type: ['string', 'null'];
          };
          description_localizations: {
            type: ['object', 'null'];
            additionalProperties: {
              type: 'string';
            };
          };
          required: {
            type: ['boolean', 'null'];
          };
        };
        required: ['type', 'name', 'description'];
      };
      ApplicationCommandAutocompleteCallbackRequest: {
        type: 'object';
        properties: {
          type: {
            type: 'integer';
            enum: [8];
            allOf: [
              {
                $ref: '#/components/schemas/InteractionCallbackTypes';
              },
            ];
            format: 'int32';
          };
          data: {
            anyOf: [
              {
                $ref: '#/components/schemas/InteractionApplicationCommandAutocompleteCallbackIntegerData';
              },
              {
                $ref: '#/components/schemas/InteractionApplicationCommandAutocompleteCallbackNumberData';
              },
              {
                $ref: '#/components/schemas/InteractionApplicationCommandAutocompleteCallbackStringData';
              },
            ];
            'x-discord-union': 'oneOf';
          };
        };
        required: ['type', 'data'];
      };
      ApplicationCommandBooleanOption: {
        type: 'object';
        properties: {
          type: {
            type: 'integer';
            enum: [5];
            allOf: [
              {
                $ref: '#/components/schemas/ApplicationCommandOptionType';
              },
            ];
            format: 'int32';
          };
          name: {
            type: 'string';
            minLength: 1;
            maxLength: 32;
          };
          name_localizations: {
            type: ['object', 'null'];
            additionalProperties: {
              type: 'string';
              minLength: 1;
              maxLength: 32;
            };
            maxProperties: 34;
          };
          description: {
            type: 'string';
            minLength: 1;
            maxLength: 100;
          };
          description_localizations: {
            type: ['object', 'null'];
            additionalProperties: {
              type: 'string';
              minLength: 1;
              maxLength: 100;
            };
            maxProperties: 34;
          };
          required: {
            type: ['boolean', 'null'];
          };
        };
        required: ['type', 'name', 'description'];
      };
      ApplicationCommandBooleanOptionResponse: {
        type: 'object';
        properties: {
          type: {
            type: 'integer';
            enum: [5];
            allOf: [
              {
                $ref: '#/components/schemas/ApplicationCommandOptionType';
              },
            ];
            format: 'int32';
          };
          name: {
            type: 'string';
          };
          name_localized: {
            type: ['string', 'null'];
          };
          name_localizations: {
            type: ['object', 'null'];
            additionalProperties: {
              type: 'string';
            };
          };
          description: {
            type: 'string';
          };
          description_localized: {
            type: ['string', 'null'];
          };
          description_localizations: {
            type: ['object', 'null'];
            additionalProperties: {
              type: 'string';
            };
          };
          required: {
            type: ['boolean', 'null'];
          };
        };
        required: ['type', 'name', 'description'];
      };
      ApplicationCommandChannelOption: {
        type: 'object';
        properties: {
          type: {
            type: 'integer';
            enum: [7];
            allOf: [
              {
                $ref: '#/components/schemas/ApplicationCommandOptionType';
              },
            ];
            format: 'int32';
          };
          name: {
            type: 'string';
            minLength: 1;
            maxLength: 32;
          };
          name_localizations: {
            type: ['object', 'null'];
            additionalProperties: {
              type: 'string';
              minLength: 1;
              maxLength: 32;
            };
            maxProperties: 34;
          };
          description: {
            type: 'string';
            minLength: 1;
            maxLength: 100;
          };
          description_localizations: {
            type: ['object', 'null'];
            additionalProperties: {
              type: 'string';
              minLength: 1;
              maxLength: 100;
            };
            maxProperties: 34;
          };
          required: {
            type: ['boolean', 'null'];
          };
          channel_types: {
            type: ['array', 'null'];
            items: {
              $ref: '#/components/schemas/ChannelTypes';
            };
            uniqueItems: true;
          };
        };
        required: ['type', 'name', 'description'];
      };
      ApplicationCommandChannelOptionResponse: {
        type: 'object';
        properties: {
          type: {
            type: 'integer';
            enum: [7];
            allOf: [
              {
                $ref: '#/components/schemas/ApplicationCommandOptionType';
              },
            ];
            format: 'int32';
          };
          name: {
            type: 'string';
          };
          name_localized: {
            type: ['string', 'null'];
          };
          name_localizations: {
            type: ['object', 'null'];
            additionalProperties: {
              type: 'string';
            };
          };
          description: {
            type: 'string';
          };
          description_localized: {
            type: ['string', 'null'];
          };
          description_localizations: {
            type: ['object', 'null'];
            additionalProperties: {
              type: 'string';
            };
          };
          required: {
            type: ['boolean', 'null'];
          };
          channel_types: {
            type: ['array', 'null'];
            items: {
              $ref: '#/components/schemas/ChannelTypes';
            };
            uniqueItems: true;
          };
        };
        required: ['type', 'name', 'description'];
      };
      ApplicationCommandCreateRequest: {
        type: 'object';
        properties: {
          name: {
            type: 'string';
            minLength: 1;
            maxLength: 32;
          };
          name_localizations: {
            type: ['object', 'null'];
            additionalProperties: {
              type: 'string';
              minLength: 1;
              maxLength: 32;
            };
            maxProperties: 34;
          };
          description: {
            type: ['string', 'null'];
            maxLength: 100;
          };
          description_localizations: {
            type: ['object', 'null'];
            additionalProperties: {
              type: 'string';
              minLength: 1;
              maxLength: 100;
            };
            maxProperties: 34;
          };
          options: {
            type: ['array', 'null'];
            items: {
              oneOf: [
                {
                  $ref: '#/components/schemas/ApplicationCommandAttachmentOption';
                },
                {
                  $ref: '#/components/schemas/ApplicationCommandBooleanOption';
                },
                {
                  $ref: '#/components/schemas/ApplicationCommandChannelOption';
                },
                {
                  $ref: '#/components/schemas/ApplicationCommandIntegerOption';
                },
                {
                  $ref: '#/components/schemas/ApplicationCommandMentionableOption';
                },
                {
                  $ref: '#/components/schemas/ApplicationCommandNumberOption';
                },
                {
                  $ref: '#/components/schemas/ApplicationCommandRoleOption';
                },
                {
                  $ref: '#/components/schemas/ApplicationCommandStringOption';
                },
                {
                  $ref: '#/components/schemas/ApplicationCommandSubcommandGroupOption';
                },
                {
                  $ref: '#/components/schemas/ApplicationCommandSubcommandOption';
                },
                {
                  $ref: '#/components/schemas/ApplicationCommandUserOption';
                },
              ];
            };
            maxItems: 25;
          };
          default_member_permissions: {
            type: ['integer', 'null'];
            minimum: 0;
            maximum: 562949953421311;
          };
          dm_permission: {
            type: ['boolean', 'null'];
          };
          type: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/ApplicationCommandType';
              },
            ];
          };
        };
        required: ['name'];
      };
      ApplicationCommandIntegerOption: {
        type: 'object';
        properties: {
          type: {
            type: 'integer';
            enum: [4];
            allOf: [
              {
                $ref: '#/components/schemas/ApplicationCommandOptionType';
              },
            ];
            format: 'int32';
          };
          name: {
            type: 'string';
            minLength: 1;
            maxLength: 32;
          };
          name_localizations: {
            type: ['object', 'null'];
            additionalProperties: {
              type: 'string';
              minLength: 1;
              maxLength: 32;
            };
            maxProperties: 34;
          };
          description: {
            type: 'string';
            minLength: 1;
            maxLength: 100;
          };
          description_localizations: {
            type: ['object', 'null'];
            additionalProperties: {
              type: 'string';
              minLength: 1;
              maxLength: 100;
            };
            maxProperties: 34;
          };
          required: {
            type: ['boolean', 'null'];
          };
          autocomplete: {
            type: ['boolean', 'null'];
          };
          choices: {
            type: ['array', 'null'];
            items: {
              $ref: '#/components/schemas/ApplicationCommandOptionIntegerChoice';
            };
            maxItems: 25;
          };
          min_value: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/Int53Type';
              },
            ];
          };
          max_value: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/Int53Type';
              },
            ];
          };
        };
        required: ['type', 'name', 'description'];
      };
      ApplicationCommandIntegerOptionResponse: {
        type: 'object';
        properties: {
          type: {
            type: 'integer';
            enum: [4];
            allOf: [
              {
                $ref: '#/components/schemas/ApplicationCommandOptionType';
              },
            ];
            format: 'int32';
          };
          name: {
            type: 'string';
          };
          name_localized: {
            type: ['string', 'null'];
          };
          name_localizations: {
            type: ['object', 'null'];
            additionalProperties: {
              type: 'string';
            };
          };
          description: {
            type: 'string';
          };
          description_localized: {
            type: ['string', 'null'];
          };
          description_localizations: {
            type: ['object', 'null'];
            additionalProperties: {
              type: 'string';
            };
          };
          required: {
            type: ['boolean', 'null'];
          };
          autocomplete: {
            type: ['boolean', 'null'];
          };
          choices: {
            type: ['array', 'null'];
            items: {
              $ref: '#/components/schemas/ApplicationCommandOptionIntegerChoiceResponse';
            };
          };
          min_value: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/Int53Type';
              },
            ];
          };
          max_value: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/Int53Type';
              },
            ];
          };
        };
        required: ['type', 'name', 'description'];
      };
      ApplicationCommandMentionableOption: {
        type: 'object';
        properties: {
          type: {
            type: 'integer';
            enum: [9];
            allOf: [
              {
                $ref: '#/components/schemas/ApplicationCommandOptionType';
              },
            ];
            format: 'int32';
          };
          name: {
            type: 'string';
            minLength: 1;
            maxLength: 32;
          };
          name_localizations: {
            type: ['object', 'null'];
            additionalProperties: {
              type: 'string';
              minLength: 1;
              maxLength: 32;
            };
            maxProperties: 34;
          };
          description: {
            type: 'string';
            minLength: 1;
            maxLength: 100;
          };
          description_localizations: {
            type: ['object', 'null'];
            additionalProperties: {
              type: 'string';
              minLength: 1;
              maxLength: 100;
            };
            maxProperties: 34;
          };
          required: {
            type: ['boolean', 'null'];
          };
        };
        required: ['type', 'name', 'description'];
      };
      ApplicationCommandMentionableOptionResponse: {
        type: 'object';
        properties: {
          type: {
            type: 'integer';
            enum: [9];
            allOf: [
              {
                $ref: '#/components/schemas/ApplicationCommandOptionType';
              },
            ];
            format: 'int32';
          };
          name: {
            type: 'string';
          };
          name_localized: {
            type: ['string', 'null'];
          };
          name_localizations: {
            type: ['object', 'null'];
            additionalProperties: {
              type: 'string';
            };
          };
          description: {
            type: 'string';
          };
          description_localized: {
            type: ['string', 'null'];
          };
          description_localizations: {
            type: ['object', 'null'];
            additionalProperties: {
              type: 'string';
            };
          };
          required: {
            type: ['boolean', 'null'];
          };
        };
        required: ['type', 'name', 'description'];
      };
      ApplicationCommandNumberOption: {
        type: 'object';
        properties: {
          type: {
            type: 'integer';
            enum: [10];
            allOf: [
              {
                $ref: '#/components/schemas/ApplicationCommandOptionType';
              },
            ];
            format: 'int32';
          };
          name: {
            type: 'string';
            minLength: 1;
            maxLength: 32;
          };
          name_localizations: {
            type: ['object', 'null'];
            additionalProperties: {
              type: 'string';
              minLength: 1;
              maxLength: 32;
            };
            maxProperties: 34;
          };
          description: {
            type: 'string';
            minLength: 1;
            maxLength: 100;
          };
          description_localizations: {
            type: ['object', 'null'];
            additionalProperties: {
              type: 'string';
              minLength: 1;
              maxLength: 100;
            };
            maxProperties: 34;
          };
          required: {
            type: ['boolean', 'null'];
          };
          autocomplete: {
            type: ['boolean', 'null'];
          };
          choices: {
            type: ['array', 'null'];
            items: {
              $ref: '#/components/schemas/ApplicationCommandOptionNumberChoice';
            };
            maxItems: 25;
          };
          min_value: {
            type: ['number', 'null'];
            format: 'double';
          };
          max_value: {
            type: ['number', 'null'];
            format: 'double';
          };
        };
        required: ['type', 'name', 'description'];
      };
      ApplicationCommandNumberOptionResponse: {
        type: 'object';
        properties: {
          type: {
            type: 'integer';
            enum: [10];
            allOf: [
              {
                $ref: '#/components/schemas/ApplicationCommandOptionType';
              },
            ];
            format: 'int32';
          };
          name: {
            type: 'string';
          };
          name_localized: {
            type: ['string', 'null'];
          };
          name_localizations: {
            type: ['object', 'null'];
            additionalProperties: {
              type: 'string';
            };
          };
          description: {
            type: 'string';
          };
          description_localized: {
            type: ['string', 'null'];
          };
          description_localizations: {
            type: ['object', 'null'];
            additionalProperties: {
              type: 'string';
            };
          };
          required: {
            type: ['boolean', 'null'];
          };
          autocomplete: {
            type: ['boolean', 'null'];
          };
          choices: {
            type: ['array', 'null'];
            items: {
              $ref: '#/components/schemas/ApplicationCommandOptionNumberChoiceResponse';
            };
          };
          min_value: {
            type: ['number', 'null'];
            format: 'double';
          };
          max_value: {
            type: ['number', 'null'];
            format: 'double';
          };
        };
        required: ['type', 'name', 'description'];
      };
      ApplicationCommandOptionIntegerChoice: {
        type: 'object';
        properties: {
          name: {
            type: 'string';
            minLength: 1;
            maxLength: 100;
          };
          name_localizations: {
            type: ['object', 'null'];
            additionalProperties: {
              type: 'string';
              minLength: 1;
              maxLength: 100;
            };
            maxProperties: 34;
          };
          value: {
            $ref: '#/components/schemas/Int53Type';
          };
        };
        required: ['name', 'value'];
      };
      ApplicationCommandOptionIntegerChoiceResponse: {
        type: 'object';
        properties: {
          name: {
            type: 'string';
          };
          name_localized: {
            type: ['string', 'null'];
          };
          name_localizations: {
            type: ['object', 'null'];
            additionalProperties: {
              type: 'string';
            };
          };
          value: {
            $ref: '#/components/schemas/Int53Type';
          };
        };
        required: ['name', 'value'];
      };
      ApplicationCommandOptionNumberChoice: {
        type: 'object';
        properties: {
          name: {
            type: 'string';
            minLength: 1;
            maxLength: 100;
          };
          name_localizations: {
            type: ['object', 'null'];
            additionalProperties: {
              type: 'string';
              minLength: 1;
              maxLength: 100;
            };
            maxProperties: 34;
          };
          value: {
            type: 'number';
            format: 'double';
          };
        };
        required: ['name', 'value'];
      };
      ApplicationCommandOptionNumberChoiceResponse: {
        type: 'object';
        properties: {
          name: {
            type: 'string';
          };
          name_localized: {
            type: ['string', 'null'];
          };
          name_localizations: {
            type: ['object', 'null'];
            additionalProperties: {
              type: 'string';
            };
          };
          value: {
            type: 'number';
            format: 'double';
          };
        };
        required: ['name', 'value'];
      };
      ApplicationCommandOptionStringChoice: {
        type: 'object';
        properties: {
          name: {
            type: 'string';
            minLength: 1;
            maxLength: 100;
          };
          name_localizations: {
            type: ['object', 'null'];
            additionalProperties: {
              type: 'string';
              minLength: 1;
              maxLength: 100;
            };
            maxProperties: 34;
          };
          value: {
            type: 'string';
            maxLength: 6000;
          };
        };
        required: ['name', 'value'];
      };
      ApplicationCommandOptionStringChoiceResponse: {
        type: 'object';
        properties: {
          name: {
            type: 'string';
          };
          name_localized: {
            type: ['string', 'null'];
          };
          name_localizations: {
            type: ['object', 'null'];
            additionalProperties: {
              type: 'string';
            };
          };
          value: {
            type: 'string';
          };
        };
        required: ['name', 'value'];
      };
      ApplicationCommandOptionType: {
        type: 'integer';
        oneOf: [
          {
            title: 'SUB_COMMAND';
            description: 'A sub-action within a command or group';
            const: 1;
          },
          {
            title: 'SUB_COMMAND_GROUP';
            description: 'A group of subcommands';
            const: 2;
          },
          {
            title: 'STRING';
            description: 'A string option';
            const: 3;
          },
          {
            title: 'INTEGER';
            description: 'An integer option. Any integer between -2^53 and 2^53 is a valid value';
            const: 4;
          },
          {
            title: 'BOOLEAN';
            description: 'A boolean option';
            const: 5;
          },
          {
            title: 'USER';
            description: 'A snowflake option that represents a User';
            const: 6;
          },
          {
            title: 'CHANNEL';
            description: 'A snowflake option that represents a Channel. Includes all channel types and categories';
            const: 7;
          },
          {
            title: 'ROLE';
            description: 'A snowflake option that represents a Role';
            const: 8;
          },
          {
            title: 'MENTIONABLE';
            description: 'A snowflake option that represents anything you can mention';
            const: 9;
          },
          {
            title: 'NUMBER';
            description: 'A number option. Any double between -2^53 and 2^53 is a valid value';
            const: 10;
          },
          {
            title: 'ATTACHMENT';
            description: 'An attachment option';
            const: 11;
          },
        ];
        format: 'int32';
      };
      ApplicationCommandPatchRequestPartial: {
        type: 'object';
        properties: {
          name: {
            type: 'string';
            minLength: 1;
            maxLength: 32;
          };
          name_localizations: {
            type: ['object', 'null'];
            additionalProperties: {
              type: 'string';
              minLength: 1;
              maxLength: 32;
            };
            maxProperties: 34;
          };
          description: {
            type: ['string', 'null'];
            maxLength: 100;
          };
          description_localizations: {
            type: ['object', 'null'];
            additionalProperties: {
              type: 'string';
              minLength: 1;
              maxLength: 100;
            };
            maxProperties: 34;
          };
          options: {
            type: ['array', 'null'];
            items: {
              oneOf: [
                {
                  $ref: '#/components/schemas/ApplicationCommandAttachmentOption';
                },
                {
                  $ref: '#/components/schemas/ApplicationCommandBooleanOption';
                },
                {
                  $ref: '#/components/schemas/ApplicationCommandChannelOption';
                },
                {
                  $ref: '#/components/schemas/ApplicationCommandIntegerOption';
                },
                {
                  $ref: '#/components/schemas/ApplicationCommandMentionableOption';
                },
                {
                  $ref: '#/components/schemas/ApplicationCommandNumberOption';
                },
                {
                  $ref: '#/components/schemas/ApplicationCommandRoleOption';
                },
                {
                  $ref: '#/components/schemas/ApplicationCommandStringOption';
                },
                {
                  $ref: '#/components/schemas/ApplicationCommandSubcommandGroupOption';
                },
                {
                  $ref: '#/components/schemas/ApplicationCommandSubcommandOption';
                },
                {
                  $ref: '#/components/schemas/ApplicationCommandUserOption';
                },
              ];
            };
            maxItems: 25;
          };
          default_member_permissions: {
            type: ['integer', 'null'];
            minimum: 0;
            maximum: 562949953421311;
          };
          dm_permission: {
            type: ['boolean', 'null'];
          };
        };
      };
      ApplicationCommandPermission: {
        type: 'object';
        properties: {
          id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          type: {
            $ref: '#/components/schemas/ApplicationCommandPermissionType';
          };
          permission: {
            type: 'boolean';
          };
        };
        required: ['id', 'type', 'permission'];
      };
      ApplicationCommandPermissionType: {
        type: 'integer';
        oneOf: [
          {
            title: 'ROLE';
            description: 'This permission is for a role.';
            const: 1;
          },
          {
            title: 'USER';
            description: 'This permission is for a user.';
            const: 2;
          },
          {
            title: 'CHANNEL';
            description: 'This permission is for a channel.';
            const: 3;
          },
        ];
        format: 'int32';
      };
      ApplicationCommandResponse: {
        type: 'object';
        properties: {
          id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          application_id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          version: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          default_member_permissions: {
            type: ['string', 'null'];
          };
          type: {
            $ref: '#/components/schemas/ApplicationCommandType';
          };
          name: {
            type: 'string';
          };
          name_localized: {
            type: ['string', 'null'];
          };
          name_localizations: {
            type: ['object', 'null'];
            additionalProperties: {
              type: 'string';
            };
          };
          description: {
            type: 'string';
          };
          description_localized: {
            type: ['string', 'null'];
          };
          description_localizations: {
            type: ['object', 'null'];
            additionalProperties: {
              type: 'string';
            };
          };
          guild_id: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/SnowflakeType';
              },
            ];
          };
          dm_permission: {
            type: ['boolean', 'null'];
          };
          options: {
            type: ['array', 'null'];
            items: {
              oneOf: [
                {
                  $ref: '#/components/schemas/ApplicationCommandAttachmentOptionResponse';
                },
                {
                  $ref: '#/components/schemas/ApplicationCommandBooleanOptionResponse';
                },
                {
                  $ref: '#/components/schemas/ApplicationCommandChannelOptionResponse';
                },
                {
                  $ref: '#/components/schemas/ApplicationCommandIntegerOptionResponse';
                },
                {
                  $ref: '#/components/schemas/ApplicationCommandMentionableOptionResponse';
                },
                {
                  $ref: '#/components/schemas/ApplicationCommandNumberOptionResponse';
                },
                {
                  $ref: '#/components/schemas/ApplicationCommandRoleOptionResponse';
                },
                {
                  $ref: '#/components/schemas/ApplicationCommandStringOptionResponse';
                },
                {
                  $ref: '#/components/schemas/ApplicationCommandSubcommandGroupOptionResponse';
                },
                {
                  $ref: '#/components/schemas/ApplicationCommandSubcommandOptionResponse';
                },
                {
                  $ref: '#/components/schemas/ApplicationCommandUserOptionResponse';
                },
              ];
            };
          };
          nsfw: {
            type: ['boolean', 'null'];
          };
        };
        required: ['id', 'application_id', 'version', 'type', 'name', 'description'];
      };
      ApplicationCommandRoleOption: {
        type: 'object';
        properties: {
          type: {
            type: 'integer';
            enum: [8];
            allOf: [
              {
                $ref: '#/components/schemas/ApplicationCommandOptionType';
              },
            ];
            format: 'int32';
          };
          name: {
            type: 'string';
            minLength: 1;
            maxLength: 32;
          };
          name_localizations: {
            type: ['object', 'null'];
            additionalProperties: {
              type: 'string';
              minLength: 1;
              maxLength: 32;
            };
            maxProperties: 34;
          };
          description: {
            type: 'string';
            minLength: 1;
            maxLength: 100;
          };
          description_localizations: {
            type: ['object', 'null'];
            additionalProperties: {
              type: 'string';
              minLength: 1;
              maxLength: 100;
            };
            maxProperties: 34;
          };
          required: {
            type: ['boolean', 'null'];
          };
        };
        required: ['type', 'name', 'description'];
      };
      ApplicationCommandRoleOptionResponse: {
        type: 'object';
        properties: {
          type: {
            type: 'integer';
            enum: [8];
            allOf: [
              {
                $ref: '#/components/schemas/ApplicationCommandOptionType';
              },
            ];
            format: 'int32';
          };
          name: {
            type: 'string';
          };
          name_localized: {
            type: ['string', 'null'];
          };
          name_localizations: {
            type: ['object', 'null'];
            additionalProperties: {
              type: 'string';
            };
          };
          description: {
            type: 'string';
          };
          description_localized: {
            type: ['string', 'null'];
          };
          description_localizations: {
            type: ['object', 'null'];
            additionalProperties: {
              type: 'string';
            };
          };
          required: {
            type: ['boolean', 'null'];
          };
        };
        required: ['type', 'name', 'description'];
      };
      ApplicationCommandStringOption: {
        type: 'object';
        properties: {
          type: {
            type: 'integer';
            enum: [3];
            allOf: [
              {
                $ref: '#/components/schemas/ApplicationCommandOptionType';
              },
            ];
            format: 'int32';
          };
          name: {
            type: 'string';
            minLength: 1;
            maxLength: 32;
          };
          name_localizations: {
            type: ['object', 'null'];
            additionalProperties: {
              type: 'string';
              minLength: 1;
              maxLength: 32;
            };
            maxProperties: 34;
          };
          description: {
            type: 'string';
            minLength: 1;
            maxLength: 100;
          };
          description_localizations: {
            type: ['object', 'null'];
            additionalProperties: {
              type: 'string';
              minLength: 1;
              maxLength: 100;
            };
            maxProperties: 34;
          };
          required: {
            type: ['boolean', 'null'];
          };
          autocomplete: {
            type: ['boolean', 'null'];
          };
          min_length: {
            type: ['integer', 'null'];
            minimum: 0;
            maximum: 6000;
          };
          max_length: {
            type: ['integer', 'null'];
            minimum: 1;
            maximum: 6000;
          };
          choices: {
            type: ['array', 'null'];
            items: {
              $ref: '#/components/schemas/ApplicationCommandOptionStringChoice';
            };
            maxItems: 25;
          };
        };
        required: ['type', 'name', 'description'];
      };
      ApplicationCommandStringOptionResponse: {
        type: 'object';
        properties: {
          type: {
            type: 'integer';
            enum: [3];
            allOf: [
              {
                $ref: '#/components/schemas/ApplicationCommandOptionType';
              },
            ];
            format: 'int32';
          };
          name: {
            type: 'string';
          };
          name_localized: {
            type: ['string', 'null'];
          };
          name_localizations: {
            type: ['object', 'null'];
            additionalProperties: {
              type: 'string';
            };
          };
          description: {
            type: 'string';
          };
          description_localized: {
            type: ['string', 'null'];
          };
          description_localizations: {
            type: ['object', 'null'];
            additionalProperties: {
              type: 'string';
            };
          };
          required: {
            type: ['boolean', 'null'];
          };
          autocomplete: {
            type: ['boolean', 'null'];
          };
          choices: {
            type: ['array', 'null'];
            items: {
              $ref: '#/components/schemas/ApplicationCommandOptionStringChoiceResponse';
            };
          };
          min_length: {
            type: ['integer', 'null'];
            format: 'int32';
          };
          max_length: {
            type: ['integer', 'null'];
            format: 'int32';
          };
        };
        required: ['type', 'name', 'description'];
      };
      ApplicationCommandSubcommandGroupOption: {
        type: 'object';
        properties: {
          type: {
            type: 'integer';
            enum: [2];
            allOf: [
              {
                $ref: '#/components/schemas/ApplicationCommandOptionType';
              },
            ];
            format: 'int32';
          };
          name: {
            type: 'string';
            minLength: 1;
            maxLength: 32;
          };
          name_localizations: {
            type: ['object', 'null'];
            additionalProperties: {
              type: 'string';
              minLength: 1;
              maxLength: 32;
            };
            maxProperties: 34;
          };
          description: {
            type: 'string';
            minLength: 1;
            maxLength: 100;
          };
          description_localizations: {
            type: ['object', 'null'];
            additionalProperties: {
              type: 'string';
              minLength: 1;
              maxLength: 100;
            };
            maxProperties: 34;
          };
          required: {
            type: ['boolean', 'null'];
          };
          options: {
            type: ['array', 'null'];
            items: {
              $ref: '#/components/schemas/ApplicationCommandSubcommandOption';
            };
            maxItems: 25;
          };
        };
        required: ['type', 'name', 'description'];
      };
      ApplicationCommandSubcommandGroupOptionResponse: {
        type: 'object';
        properties: {
          type: {
            type: 'integer';
            enum: [2];
            allOf: [
              {
                $ref: '#/components/schemas/ApplicationCommandOptionType';
              },
            ];
            format: 'int32';
          };
          name: {
            type: 'string';
          };
          name_localized: {
            type: ['string', 'null'];
          };
          name_localizations: {
            type: ['object', 'null'];
            additionalProperties: {
              type: 'string';
            };
          };
          description: {
            type: 'string';
          };
          description_localized: {
            type: ['string', 'null'];
          };
          description_localizations: {
            type: ['object', 'null'];
            additionalProperties: {
              type: 'string';
            };
          };
          required: {
            type: ['boolean', 'null'];
          };
          options: {
            type: ['array', 'null'];
            items: {
              $ref: '#/components/schemas/ApplicationCommandSubcommandOptionResponse';
            };
          };
        };
        required: ['type', 'name', 'description'];
      };
      ApplicationCommandSubcommandOption: {
        type: 'object';
        properties: {
          type: {
            type: 'integer';
            enum: [1];
            allOf: [
              {
                $ref: '#/components/schemas/ApplicationCommandOptionType';
              },
            ];
            format: 'int32';
          };
          name: {
            type: 'string';
            minLength: 1;
            maxLength: 32;
          };
          name_localizations: {
            type: ['object', 'null'];
            additionalProperties: {
              type: 'string';
              minLength: 1;
              maxLength: 32;
            };
            maxProperties: 34;
          };
          description: {
            type: 'string';
            minLength: 1;
            maxLength: 100;
          };
          description_localizations: {
            type: ['object', 'null'];
            additionalProperties: {
              type: 'string';
              minLength: 1;
              maxLength: 100;
            };
            maxProperties: 34;
          };
          required: {
            type: ['boolean', 'null'];
          };
          options: {
            type: ['array', 'null'];
            items: {
              oneOf: [
                {
                  $ref: '#/components/schemas/ApplicationCommandAttachmentOption';
                },
                {
                  $ref: '#/components/schemas/ApplicationCommandBooleanOption';
                },
                {
                  $ref: '#/components/schemas/ApplicationCommandChannelOption';
                },
                {
                  $ref: '#/components/schemas/ApplicationCommandIntegerOption';
                },
                {
                  $ref: '#/components/schemas/ApplicationCommandMentionableOption';
                },
                {
                  $ref: '#/components/schemas/ApplicationCommandNumberOption';
                },
                {
                  $ref: '#/components/schemas/ApplicationCommandRoleOption';
                },
                {
                  $ref: '#/components/schemas/ApplicationCommandStringOption';
                },
                {
                  $ref: '#/components/schemas/ApplicationCommandUserOption';
                },
              ];
            };
            maxItems: 25;
          };
        };
        required: ['type', 'name', 'description'];
      };
      ApplicationCommandSubcommandOptionResponse: {
        type: 'object';
        properties: {
          type: {
            type: 'integer';
            enum: [1];
            allOf: [
              {
                $ref: '#/components/schemas/ApplicationCommandOptionType';
              },
            ];
            format: 'int32';
          };
          name: {
            type: 'string';
          };
          name_localized: {
            type: ['string', 'null'];
          };
          name_localizations: {
            type: ['object', 'null'];
            additionalProperties: {
              type: 'string';
            };
          };
          description: {
            type: 'string';
          };
          description_localized: {
            type: ['string', 'null'];
          };
          description_localizations: {
            type: ['object', 'null'];
            additionalProperties: {
              type: 'string';
            };
          };
          required: {
            type: ['boolean', 'null'];
          };
          options: {
            type: ['array', 'null'];
            items: {
              oneOf: [
                {
                  $ref: '#/components/schemas/ApplicationCommandAttachmentOptionResponse';
                },
                {
                  $ref: '#/components/schemas/ApplicationCommandBooleanOptionResponse';
                },
                {
                  $ref: '#/components/schemas/ApplicationCommandChannelOptionResponse';
                },
                {
                  $ref: '#/components/schemas/ApplicationCommandIntegerOptionResponse';
                },
                {
                  $ref: '#/components/schemas/ApplicationCommandMentionableOptionResponse';
                },
                {
                  $ref: '#/components/schemas/ApplicationCommandNumberOptionResponse';
                },
                {
                  $ref: '#/components/schemas/ApplicationCommandRoleOptionResponse';
                },
                {
                  $ref: '#/components/schemas/ApplicationCommandStringOptionResponse';
                },
                {
                  $ref: '#/components/schemas/ApplicationCommandUserOptionResponse';
                },
              ];
            };
          };
        };
        required: ['type', 'name', 'description'];
      };
      ApplicationCommandType: {
        type: 'integer';
        oneOf: [
          {
            title: 'CHAT';
            description: 'Slash commands; a text-based command that shows up when a user types /';
            const: 1;
          },
          {
            title: 'USER';
            description: 'A UI-based command that shows up when you right click or tap on a user';
            const: 2;
          },
          {
            title: 'MESSAGE';
            description: 'A UI-based command that shows up when you right click or tap on a message';
            const: 3;
          },
        ];
        format: 'int32';
      };
      ApplicationCommandUpdateRequest: {
        type: 'object';
        properties: {
          name: {
            type: 'string';
            minLength: 1;
            maxLength: 32;
          };
          name_localizations: {
            type: ['object', 'null'];
            additionalProperties: {
              type: 'string';
              minLength: 1;
              maxLength: 32;
            };
            maxProperties: 34;
          };
          description: {
            type: ['string', 'null'];
            maxLength: 100;
          };
          description_localizations: {
            type: ['object', 'null'];
            additionalProperties: {
              type: 'string';
              minLength: 1;
              maxLength: 100;
            };
            maxProperties: 34;
          };
          options: {
            type: ['array', 'null'];
            items: {
              oneOf: [
                {
                  $ref: '#/components/schemas/ApplicationCommandAttachmentOption';
                },
                {
                  $ref: '#/components/schemas/ApplicationCommandBooleanOption';
                },
                {
                  $ref: '#/components/schemas/ApplicationCommandChannelOption';
                },
                {
                  $ref: '#/components/schemas/ApplicationCommandIntegerOption';
                },
                {
                  $ref: '#/components/schemas/ApplicationCommandMentionableOption';
                },
                {
                  $ref: '#/components/schemas/ApplicationCommandNumberOption';
                },
                {
                  $ref: '#/components/schemas/ApplicationCommandRoleOption';
                },
                {
                  $ref: '#/components/schemas/ApplicationCommandStringOption';
                },
                {
                  $ref: '#/components/schemas/ApplicationCommandSubcommandGroupOption';
                },
                {
                  $ref: '#/components/schemas/ApplicationCommandSubcommandOption';
                },
                {
                  $ref: '#/components/schemas/ApplicationCommandUserOption';
                },
              ];
            };
            maxItems: 25;
          };
          default_member_permissions: {
            type: ['integer', 'null'];
            minimum: 0;
            maximum: 562949953421311;
          };
          dm_permission: {
            type: ['boolean', 'null'];
          };
          type: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/ApplicationCommandType';
              },
            ];
          };
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
        };
        required: ['name'];
      };
      ApplicationCommandUserOption: {
        type: 'object';
        properties: {
          type: {
            type: 'integer';
            enum: [6];
            allOf: [
              {
                $ref: '#/components/schemas/ApplicationCommandOptionType';
              },
            ];
            format: 'int32';
          };
          name: {
            type: 'string';
            minLength: 1;
            maxLength: 32;
          };
          name_localizations: {
            type: ['object', 'null'];
            additionalProperties: {
              type: 'string';
              minLength: 1;
              maxLength: 32;
            };
            maxProperties: 34;
          };
          description: {
            type: 'string';
            minLength: 1;
            maxLength: 100;
          };
          description_localizations: {
            type: ['object', 'null'];
            additionalProperties: {
              type: 'string';
              minLength: 1;
              maxLength: 100;
            };
            maxProperties: 34;
          };
          required: {
            type: ['boolean', 'null'];
          };
        };
        required: ['type', 'name', 'description'];
      };
      ApplicationCommandUserOptionResponse: {
        type: 'object';
        properties: {
          type: {
            type: 'integer';
            enum: [6];
            allOf: [
              {
                $ref: '#/components/schemas/ApplicationCommandOptionType';
              },
            ];
            format: 'int32';
          };
          name: {
            type: 'string';
          };
          name_localized: {
            type: ['string', 'null'];
          };
          name_localizations: {
            type: ['object', 'null'];
            additionalProperties: {
              type: 'string';
            };
          };
          description: {
            type: 'string';
          };
          description_localized: {
            type: ['string', 'null'];
          };
          description_localizations: {
            type: ['object', 'null'];
            additionalProperties: {
              type: 'string';
            };
          };
          required: {
            type: ['boolean', 'null'];
          };
        };
        required: ['type', 'name', 'description'];
      };
      ApplicationFormPartial: {
        type: 'object';
        properties: {
          description: {
            type: ['object', 'null'];
            properties: {
              default: {
                type: 'string';
                maxLength: 2048;
              };
              localizations: {
                type: ['object', 'null'];
                additionalProperties: {
                  type: 'string';
                  maxLength: 2048;
                };
              };
            };
            required: ['default'];
          };
          icon: {
            type: ['string', 'null'];
            contentEncoding: 'base64';
          };
          cover_image: {
            type: ['string', 'null'];
            contentEncoding: 'base64';
          };
          team_id: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/SnowflakeType';
              },
            ];
          };
          flags: {
            type: ['integer', 'null'];
          };
          interactions_endpoint_url: {
            type: ['string', 'null'];
            maxLength: 2048;
            format: 'uri';
          };
          max_participants: {
            type: ['integer', 'null'];
            minimum: -1;
            format: 'int32';
          };
          type: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/ApplicationTypes';
              },
            ];
          };
          tags: {
            type: ['array', 'null'];
            items: {
              type: 'string';
              maxLength: 20;
            };
            maxItems: 5;
            uniqueItems: true;
          };
          custom_install_url: {
            type: ['string', 'null'];
            maxLength: 2048;
            format: 'uri';
          };
          install_params: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/ApplicationOAuth2Params';
              },
            ];
          };
          role_connections_verification_url: {
            type: ['string', 'null'];
            maxLength: 2048;
            format: 'uri';
          };
        };
      };
      ApplicationIncomingWebhookResponse: {
        type: 'object';
        properties: {
          application_id: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/SnowflakeType';
              },
            ];
          };
          avatar: {
            type: ['string', 'null'];
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
          guild_id: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/SnowflakeType';
              },
            ];
          };
          id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          name: {
            type: 'string';
          };
          type: {
            type: 'integer';
            enum: [3];
            allOf: [
              {
                $ref: '#/components/schemas/WebhookTypes';
              },
            ];
            format: 'int32';
          };
          user: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/UserResponse';
              },
            ];
          };
        };
        required: ['id', 'name', 'type'];
      };
      ApplicationOAuth2Params: {
        type: 'object';
        properties: {
          scopes: {
            type: ['array', 'null'];
            items: {
              type: 'string';
              enum: ['applications.commands', 'bot'];
              allOf: [
                {
                  $ref: '#/components/schemas/OAuth2Scopes';
                },
              ];
            };
            minItems: 1;
            uniqueItems: true;
          };
          permissions: {
            type: ['integer', 'null'];
            minimum: 0;
            maximum: 562949953421311;
          };
        };
      };
      ApplicationOAuth2ParamsResponse: {
        type: 'object';
        properties: {
          scopes: {
            type: 'array';
            items: {
              type: 'string';
              enum: ['applications.commands', 'bot'];
              allOf: [
                {
                  $ref: '#/components/schemas/OAuth2Scopes';
                },
              ];
            };
            uniqueItems: true;
          };
          permissions: {
            type: 'string';
          };
        };
        required: ['scopes', 'permissions'];
      };
      ApplicationResponse: {
        type: 'object';
        properties: {
          id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          name: {
            type: 'string';
          };
          icon: {
            type: ['string', 'null'];
          };
          description: {
            type: 'string';
          };
          type: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/ApplicationTypes';
              },
            ];
          };
          cover_image: {
            type: ['string', 'null'];
          };
          primary_sku_id: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/SnowflakeType';
              },
            ];
          };
          bot: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/UserResponse';
              },
            ];
          };
          slug: {
            type: ['string', 'null'];
          };
          guild_id: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/SnowflakeType';
              },
            ];
          };
          rpc_origins: {
            type: ['array', 'null'];
            items: {
              type: ['string', 'null'];
            };
          };
          bot_public: {
            type: ['boolean', 'null'];
          };
          bot_require_code_grant: {
            type: ['boolean', 'null'];
          };
          terms_of_service_url: {
            type: ['string', 'null'];
            format: 'uri';
          };
          privacy_policy_url: {
            type: ['string', 'null'];
            format: 'uri';
          };
          custom_install_url: {
            type: ['string', 'null'];
            format: 'uri';
          };
          install_params: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/ApplicationOAuth2ParamsResponse';
              },
            ];
          };
          verify_key: {
            type: 'string';
          };
          flags: {
            type: 'integer';
            format: 'int32';
          };
          max_participants: {
            type: ['integer', 'null'];
            format: 'int32';
          };
          tags: {
            type: ['array', 'null'];
            items: {
              type: 'string';
            };
            uniqueItems: true;
          };
        };
        required: ['id', 'name', 'description', 'verify_key', 'flags'];
      };
      ApplicationRoleConnectionsMetadataItemRequest: {
        type: 'object';
        properties: {
          type: {
            $ref: '#/components/schemas/MetadataItemTypes';
          };
          key: {
            type: 'string';
            minLength: 1;
            maxLength: 50;
          };
          name: {
            type: 'string';
            minLength: 1;
            maxLength: 100;
          };
          name_localizations: {
            type: ['object', 'null'];
            additionalProperties: {
              type: ['string', 'null'];
              minLength: 1;
              maxLength: 100;
            };
            maxProperties: 1521;
          };
          description: {
            type: 'string';
            minLength: 1;
            maxLength: 200;
          };
          description_localizations: {
            type: ['object', 'null'];
            additionalProperties: {
              type: ['string', 'null'];
              minLength: 1;
              maxLength: 200;
            };
            maxProperties: 1521;
          };
        };
        required: ['type', 'key', 'name', 'description'];
      };
      ApplicationRoleConnectionsMetadataItemResponse: {
        type: 'object';
        properties: {
          type: {
            $ref: '#/components/schemas/MetadataItemTypes';
          };
          key: {
            type: 'string';
          };
          name: {
            type: 'string';
          };
          name_localizations: {
            type: ['object', 'null'];
            additionalProperties: {
              type: 'string';
            };
          };
          description: {
            type: 'string';
          };
          description_localizations: {
            type: ['object', 'null'];
            additionalProperties: {
              type: 'string';
            };
          };
        };
        required: ['type', 'key', 'name', 'description'];
      };
      ApplicationTypes: {
        type: 'integer';
        oneOf: [
          {
            title: 'GUILD_ROLE_SUBSCRIPTIONS';
            const: 4;
          },
        ];
        format: 'int32';
      };
      ApplicationUserRoleConnectionResponse: {
        type: 'object';
        properties: {
          platform_name: {
            type: ['string', 'null'];
          };
          platform_username: {
            type: ['string', 'null'];
          };
          metadata: {
            type: ['object', 'null'];
            additionalProperties: {
              type: 'string';
            };
          };
        };
      };
      AuditLogActionTypes: {
        type: 'integer';
        oneOf: [
          {
            title: 'GUILD_UPDATE';
            const: 1;
          },
          {
            title: 'CHANNEL_CREATE';
            const: 10;
          },
          {
            title: 'CHANNEL_UPDATE';
            const: 11;
          },
          {
            title: 'CHANNEL_DELETE';
            const: 12;
          },
          {
            title: 'CHANNEL_OVERWRITE_CREATE';
            const: 13;
          },
          {
            title: 'CHANNEL_OVERWRITE_UPDATE';
            const: 14;
          },
          {
            title: 'CHANNEL_OVERWRITE_DELETE';
            const: 15;
          },
          {
            title: 'MEMBER_KICK';
            const: 20;
          },
          {
            title: 'MEMBER_PRUNE';
            const: 21;
          },
          {
            title: 'MEMBER_BAN_ADD';
            const: 22;
          },
          {
            title: 'MEMBER_BAN_REMOVE';
            const: 23;
          },
          {
            title: 'MEMBER_UPDATE';
            const: 24;
          },
          {
            title: 'MEMBER_ROLE_UPDATE';
            const: 25;
          },
          {
            title: 'MEMBER_MOVE';
            const: 26;
          },
          {
            title: 'MEMBER_DISCONNECT';
            const: 27;
          },
          {
            title: 'BOT_ADD';
            const: 28;
          },
          {
            title: 'ROLE_CREATE';
            const: 30;
          },
          {
            title: 'ROLE_UPDATE';
            const: 31;
          },
          {
            title: 'ROLE_DELETE';
            const: 32;
          },
          {
            title: 'INVITE_CREATE';
            const: 40;
          },
          {
            title: 'INVITE_UPDATE';
            const: 41;
          },
          {
            title: 'INVITE_DELETE';
            const: 42;
          },
          {
            title: 'WEBHOOK_CREATE';
            const: 50;
          },
          {
            title: 'WEBHOOK_UPDATE';
            const: 51;
          },
          {
            title: 'WEBHOOK_DELETE';
            const: 52;
          },
          {
            title: 'EMOJI_CREATE';
            const: 60;
          },
          {
            title: 'EMOJI_UPDATE';
            const: 61;
          },
          {
            title: 'EMOJI_DELETE';
            const: 62;
          },
          {
            title: 'MESSAGE_DELETE';
            const: 72;
          },
          {
            title: 'MESSAGE_BULK_DELETE';
            const: 73;
          },
          {
            title: 'MESSAGE_PIN';
            const: 74;
          },
          {
            title: 'MESSAGE_UNPIN';
            const: 75;
          },
          {
            title: 'INTEGRATION_CREATE';
            const: 80;
          },
          {
            title: 'INTEGRATION_UPDATE';
            const: 81;
          },
          {
            title: 'INTEGRATION_DELETE';
            const: 82;
          },
          {
            title: 'STAGE_INSTANCE_CREATE';
            const: 83;
          },
          {
            title: 'STAGE_INSTANCE_UPDATE';
            const: 84;
          },
          {
            title: 'STAGE_INSTANCE_DELETE';
            const: 85;
          },
          {
            title: 'STICKER_CREATE';
            const: 90;
          },
          {
            title: 'STICKER_UPDATE';
            const: 91;
          },
          {
            title: 'STICKER_DELETE';
            const: 92;
          },
          {
            title: 'GUILD_SCHEDULED_EVENT_CREATE';
            const: 100;
          },
          {
            title: 'GUILD_SCHEDULED_EVENT_UPDATE';
            const: 101;
          },
          {
            title: 'GUILD_SCHEDULED_EVENT_DELETE';
            const: 102;
          },
          {
            title: 'THREAD_CREATE';
            const: 110;
          },
          {
            title: 'THREAD_UPDATE';
            const: 111;
          },
          {
            title: 'THREAD_DELETE';
            const: 112;
          },
          {
            title: 'APPLICATION_COMMAND_PERMISSION_UPDATE';
            const: 121;
          },
          {
            title: 'SOUNDBOARD_SOUND_CREATE';
            const: 130;
          },
          {
            title: 'SOUNDBOARD_SOUND_UPDATE';
            const: 131;
          },
          {
            title: 'SOUNDBOARD_SOUND_DELETE';
            const: 132;
          },
          {
            title: 'AUTO_MODERATION_RULE_CREATE';
            const: 140;
          },
          {
            title: 'AUTO_MODERATION_RULE_UPDATE';
            const: 141;
          },
          {
            title: 'AUTO_MODERATION_RULE_DELETE';
            const: 142;
          },
          {
            title: 'AUTO_MODERATION_BLOCK_MESSAGE';
            const: 143;
          },
          {
            title: 'AUTO_MODERATION_FLAG_TO_CHANNEL';
            const: 144;
          },
          {
            title: 'AUTO_MODERATION_USER_COMM_DISABLED';
            const: 145;
          },
          {
            title: 'AUTO_MODERATION_QUARANTINE_USER';
            const: 146;
          },
          {
            title: 'CREATOR_MONETIZATION_REQUEST_CREATED';
            const: 150;
          },
          {
            title: 'CREATOR_MONETIZATION_TERMS_ACCEPTED';
            const: 151;
          },
          {
            title: 'ONBOARDING_PROMPT_CREATE';
            const: 163;
          },
          {
            title: 'ONBOARDING_PROMPT_UPDATE';
            const: 164;
          },
          {
            title: 'ONBOARDING_PROMPT_DELETE';
            const: 165;
          },
          {
            title: 'ONBOARDING_CREATE';
            const: 166;
          },
          {
            title: 'ONBOARDING_UPDATE';
            const: 167;
          },
          {
            title: 'GUILD_HOME_FEATURE_ITEM';
            const: 171;
          },
          {
            title: 'GUILD_HOME_REMOVE_ITEM';
            const: 172;
          },
          {
            title: 'HARMFUL_LINKS_BLOCKED_MESSAGE';
            const: 180;
          },
          {
            title: 'HOME_SETTINGS_CREATE';
            const: 190;
          },
          {
            title: 'HOME_SETTINGS_UPDATE';
            const: 191;
          },
          {
            title: 'VOICE_CHANNEL_STATUS_CREATE';
            const: 192;
          },
          {
            title: 'VOICE_CHANNEL_STATUS_DELETE';
            const: 193;
          },
        ];
        format: 'int32';
      };
      AuditLogEntryResponse: {
        type: 'object';
        properties: {
          id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          action_type: {
            $ref: '#/components/schemas/AuditLogActionTypes';
          };
          user_id: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/SnowflakeType';
              },
            ];
          };
          target_id: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/SnowflakeType';
              },
            ];
          };
          changes: {
            type: ['array', 'null'];
            items: {
              $ref: '#/components/schemas/AuditLogObjectChangeResponse';
            };
          };
          options: {
            type: ['object', 'null'];
            additionalProperties: {
              type: 'string';
            };
          };
          reason: {
            type: ['string', 'null'];
          };
        };
        required: ['id', 'action_type'];
      };
      AuditLogObjectChangeResponse: {
        type: 'object';
        properties: {
          key: {
            type: ['string', 'null'];
          };
          new_value: {};
          old_value: {};
        };
      };
      AutomodActionType: {
        type: 'integer';
        oneOf: [
          {
            title: 'BLOCK_MESSAGE';
            description: "Block a user's message and prevent it from being posted. A custom explanation can be specified and shown to members whenever their message is blocked";
            const: 1;
          },
          {
            title: 'FLAG_TO_CHANNEL';
            description: 'Send a system message to a channel in order to log the user message that triggered the rule';
            const: 2;
          },
          {
            title: 'USER_COMMUNICATION_DISABLED';
            description: "Temporarily disable a user's ability to communicate in the server (timeout)";
            const: 3;
          },
          {
            title: 'QUARANTINE_USER';
            description: 'Prevent a user from interacting in the server';
            const: 4;
          },
        ];
        format: 'int32';
      };
      AutomodEventType: {
        type: 'integer';
        oneOf: [
          {
            title: 'MESSAGE_SEND';
            description: 'A user submitted a message to a channel';
            const: 1;
          },
          {
            title: 'GUILD_MEMBER_JOIN_OR_UPDATE';
            description: "A user is attempting to join the server or a member's properties were updated.";
            const: 2;
          },
        ];
        format: 'int32';
      };
      AutomodKeywordPresetType: {
        type: 'integer';
        oneOf: [
          {
            title: 'PROFANITY';
            description: 'Words and phrases that may be considered profanity';
            const: 1;
          },
          {
            title: 'SEXUAL_CONTENT';
            description: 'Words and phrases that may be considered as sexual content';
            const: 2;
          },
          {
            title: 'SLURS';
            description: 'Words and phrases that may be considered slurs and hate speech';
            const: 3;
          },
        ];
        format: 'int32';
      };
      AutomodTriggerType: {
        type: 'integer';
        oneOf: [
          {
            title: 'KEYWORD';
            description: 'Check if content contains words from a list of keywords or matches regex';
            const: 1;
          },
          {
            title: 'SPAM_LINK';
            description: 'DEPRECATED';
            const: 2;
          },
          {
            title: 'ML_SPAM';
            description: 'Check if content represents generic spam';
            const: 3;
          },
          {
            title: 'DEFAULT_KEYWORD_LIST';
            description: 'Check if content contains words from internal pre-defined wordsets';
            const: 4;
          },
          {
            title: 'MENTION_SPAM';
            description: 'Check if content contains more unique mentions than allowed';
            const: 5;
          },
        ];
        format: 'int32';
      };
      AvailableLocalesEnum: {
        type: 'string';
        oneOf: [
          {
            title: 'ar';
            description: 'The ar locale';
            const: 'ar';
          },
          {
            title: 'bg';
            description: 'The bg locale';
            const: 'bg';
          },
          {
            title: 'cs';
            description: 'The cs locale';
            const: 'cs';
          },
          {
            title: 'da';
            description: 'The da locale';
            const: 'da';
          },
          {
            title: 'de';
            description: 'The de locale';
            const: 'de';
          },
          {
            title: 'el';
            description: 'The el locale';
            const: 'el';
          },
          {
            title: 'en-GB';
            description: 'The en-GB locale';
            const: 'en-GB';
          },
          {
            title: 'en-US';
            description: 'The en-US locale';
            const: 'en-US';
          },
          {
            title: 'es-419';
            description: 'The es-419 locale';
            const: 'es-419';
          },
          {
            title: 'es-ES';
            description: 'The es-ES locale';
            const: 'es-ES';
          },
          {
            title: 'fi';
            description: 'The fi locale';
            const: 'fi';
          },
          {
            title: 'fr';
            description: 'The fr locale';
            const: 'fr';
          },
          {
            title: 'he';
            description: 'The he locale';
            const: 'he';
          },
          {
            title: 'hi';
            description: 'The hi locale';
            const: 'hi';
          },
          {
            title: 'hr';
            description: 'The hr locale';
            const: 'hr';
          },
          {
            title: 'hu';
            description: 'The hu locale';
            const: 'hu';
          },
          {
            title: 'id';
            description: 'The id locale';
            const: 'id';
          },
          {
            title: 'it';
            description: 'The it locale';
            const: 'it';
          },
          {
            title: 'ja';
            description: 'The ja locale';
            const: 'ja';
          },
          {
            title: 'ko';
            description: 'The ko locale';
            const: 'ko';
          },
          {
            title: 'lt';
            description: 'The lt locale';
            const: 'lt';
          },
          {
            title: 'nl';
            description: 'The nl locale';
            const: 'nl';
          },
          {
            title: 'no';
            description: 'The no locale';
            const: 'no';
          },
          {
            title: 'pl';
            description: 'The pl locale';
            const: 'pl';
          },
          {
            title: 'pt-BR';
            description: 'The pt-BR locale';
            const: 'pt-BR';
          },
          {
            title: 'ro';
            description: 'The ro locale';
            const: 'ro';
          },
          {
            title: 'ru';
            description: 'The ru locale';
            const: 'ru';
          },
          {
            title: 'sv-SE';
            description: 'The sv-SE locale';
            const: 'sv-SE';
          },
          {
            title: 'th';
            description: 'The th locale';
            const: 'th';
          },
          {
            title: 'tr';
            description: 'The tr locale';
            const: 'tr';
          },
          {
            title: 'uk';
            description: 'The uk locale';
            const: 'uk';
          },
          {
            title: 'vi';
            description: 'The vi locale';
            const: 'vi';
          },
          {
            title: 'zh-CN';
            description: 'The zh-CN locale';
            const: 'zh-CN';
          },
          {
            title: 'zh-TW';
            description: 'The zh-TW locale';
            const: 'zh-TW';
          },
        ];
      };
      BaseCreateMessageCreateRequest: {
        type: 'object';
        properties: {
          content: {
            type: ['string', 'null'];
            maxLength: 4000;
          };
          embeds: {
            type: ['array', 'null'];
            items: {
              $ref: '#/components/schemas/RichEmbed';
            };
            maxItems: 10;
          };
          allowed_mentions: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/MessageAllowedMentionsRequest';
              },
            ];
          };
          sticker_ids: {
            type: ['array', 'null'];
            items: {
              $ref: '#/components/schemas/SnowflakeType';
            };
            maxItems: 3;
          };
          components: {
            type: ['array', 'null'];
            items: {
              oneOf: [
                {
                  $ref: '#/components/schemas/ActionRow';
                },
                {
                  $ref: '#/components/schemas/Button';
                },
                {
                  $ref: '#/components/schemas/ChannelSelect';
                },
                {
                  $ref: '#/components/schemas/MentionableSelect';
                },
                {
                  $ref: '#/components/schemas/RoleSelect';
                },
                {
                  $ref: '#/components/schemas/StringSelect';
                },
                {
                  $ref: '#/components/schemas/UserSelect';
                },
              ];
            };
            maxItems: 5;
          };
          flags: {
            type: ['integer', 'null'];
          };
          attachments: {
            type: ['array', 'null'];
            items: {
              $ref: '#/components/schemas/MessageAttachmentRequest';
            };
            maxItems: 10;
          };
        };
      };
      BasicApplicationResponse: {
        type: 'object';
        properties: {
          id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          name: {
            type: 'string';
          };
          icon: {
            type: ['string', 'null'];
          };
          description: {
            type: 'string';
          };
          type: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/ApplicationTypes';
              },
            ];
          };
          cover_image: {
            type: ['string', 'null'];
          };
          primary_sku_id: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/SnowflakeType';
              },
            ];
          };
          bot: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/UserResponse';
              },
            ];
          };
        };
        required: ['id', 'name', 'description'];
      };
      BasicMessageResponse: {
        type: 'object';
        properties: {
          id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          type: {
            $ref: '#/components/schemas/MessageType';
          };
          content: {
            type: 'string';
          };
          channel_id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          author: {
            $ref: '#/components/schemas/UserResponse';
          };
          attachments: {
            type: 'array';
            items: {
              $ref: '#/components/schemas/MessageAttachmentResponse';
            };
          };
          embeds: {
            type: 'array';
            items: {
              $ref: '#/components/schemas/MessageEmbedResponse';
            };
          };
          mentions: {
            type: 'array';
            items: {
              $ref: '#/components/schemas/UserResponse';
            };
          };
          mention_roles: {
            type: 'array';
            items: {
              $ref: '#/components/schemas/SnowflakeType';
            };
            uniqueItems: true;
          };
          pinned: {
            type: 'boolean';
          };
          mention_everyone: {
            type: 'boolean';
          };
          tts: {
            type: 'boolean';
          };
          timestamp: {
            type: 'string';
            format: 'date-time';
          };
          edited_timestamp: {
            type: ['string', 'null'];
            format: 'date-time';
          };
          flags: {
            type: 'integer';
            format: 'int32';
          };
          components: {
            type: 'array';
            items: {
              oneOf: [
                {
                  $ref: '#/components/schemas/MessageComponentActionRowResponse';
                },
                {
                  $ref: '#/components/schemas/MessageComponentButtonResponse';
                },
                {
                  $ref: '#/components/schemas/MessageComponentChannelSelectResponse';
                },
                {
                  $ref: '#/components/schemas/MessageComponentInputTextResponse';
                },
                {
                  $ref: '#/components/schemas/MessageComponentMentionableSelectResponse';
                },
                {
                  $ref: '#/components/schemas/MessageComponentRoleSelectResponse';
                },
                {
                  $ref: '#/components/schemas/MessageComponentStringSelectResponse';
                },
                {
                  $ref: '#/components/schemas/MessageComponentUserSelectResponse';
                },
              ];
            };
          };
          activity: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/MessageActivityResponse';
              },
            ];
          };
          application: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/BasicApplicationResponse';
              },
            ];
          };
          application_id: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/SnowflakeType';
              },
            ];
          };
          interaction: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/MessageInteractionResponse';
              },
            ];
          };
          nonce: {
            oneOf: [
              {
                type: 'integer';
                minimum: -9223372036854776000;
                maximum: 9223372036854776000;
                format: 'int64';
              },
              {
                type: 'string';
                maxLength: 25;
                format: 'nonce';
              },
              {
                type: 'null';
              },
            ];
          };
          webhook_id: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/SnowflakeType';
              },
            ];
          };
          message_reference: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/MessageReferenceResponse';
              },
            ];
          };
          thread: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/ThreadResponse';
              },
            ];
          };
          mention_channels: {
            type: ['array', 'null'];
            items: {
              oneOf: [
                {
                  type: 'null';
                },
                {
                  $ref: '#/components/schemas/MessageMentionChannelResponse';
                },
              ];
            };
          };
          stickers: {
            type: ['array', 'null'];
            items: {
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
          sticker_items: {
            type: ['array', 'null'];
            items: {
              $ref: '#/components/schemas/MessageStickerItemResponse';
            };
          };
          role_subscription_data: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/MessageRoleSubscriptionDataResponse';
              },
            ];
          };
          purchase_notification: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/PurchaseNotificationResponse';
              },
            ];
          };
          position: {
            type: ['integer', 'null'];
            format: 'int32';
          };
          resolved: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/ResolvedObjectsResponse';
              },
            ];
          };
        };
        required: [
          'id',
          'type',
          'content',
          'channel_id',
          'author',
          'attachments',
          'embeds',
          'mentions',
          'mention_roles',
          'pinned',
          'mention_everyone',
          'tts',
          'timestamp',
          'flags',
          'components',
        ];
      };
      BlockMessageAction: {
        type: 'object';
        properties: {
          type: {
            type: 'integer';
            enum: [1];
            allOf: [
              {
                $ref: '#/components/schemas/AutomodActionType';
              },
            ];
            format: 'int32';
          };
          metadata: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/BlockMessageActionMetadata';
              },
            ];
          };
        };
        required: ['type'];
      };
      BlockMessageActionMetadata: {
        type: 'object';
        properties: {
          custom_message: {
            type: ['string', 'null'];
            maxLength: 150;
          };
        };
      };
      BlockMessageActionMetadataResponse: {
        type: 'object';
        properties: {
          custom_message: {
            type: ['string', 'null'];
          };
        };
      };
      BlockMessageActionResponse: {
        type: 'object';
        properties: {
          type: {
            type: 'integer';
            enum: [1];
            allOf: [
              {
                $ref: '#/components/schemas/AutomodActionType';
              },
            ];
            format: 'int32';
          };
          metadata: {
            $ref: '#/components/schemas/BlockMessageActionMetadataResponse';
          };
        };
        required: ['type', 'metadata'];
      };
      BotAccountPatchRequest: {
        type: 'object';
        properties: {
          username: {
            type: 'string';
            minLength: 2;
            maxLength: 32;
          };
          avatar: {
            type: ['string', 'null'];
            contentEncoding: 'base64';
          };
        };
        required: ['username'];
      };
      Button: {
        type: 'object';
        properties: {
          type: {
            type: 'integer';
            enum: [2];
            allOf: [
              {
                $ref: '#/components/schemas/MessageComponentTypes';
              },
            ];
            format: 'int32';
          };
          custom_id: {
            type: ['string', 'null'];
            maxLength: 100;
          };
          style: {
            $ref: '#/components/schemas/ButtonStyleTypes';
          };
          label: {
            type: ['string', 'null'];
            maxLength: 80;
          };
          disabled: {
            type: ['boolean', 'null'];
          };
          emoji: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/Emoji';
              },
            ];
          };
          url: {
            type: ['string', 'null'];
            maxLength: 512;
            format: 'uri';
          };
        };
        required: ['type', 'style'];
      };
      ButtonStyleTypes: {
        type: 'integer';
        oneOf: [
          {
            title: 'PRIMARY';
            const: 1;
          },
          {
            title: 'SECONDARY';
            const: 2;
          },
          {
            title: 'SUCCESS';
            const: 3;
          },
          {
            title: 'DANGER';
            const: 4;
          },
          {
            title: 'LINK';
            const: 5;
          },
        ];
        format: 'int32';
      };
      ChannelFollowerResponse: {
        type: 'object';
        properties: {
          channel_id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          webhook_id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
        };
        required: ['channel_id', 'webhook_id'];
      };
      ChannelFollowerWebhookResponse: {
        type: 'object';
        properties: {
          application_id: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/SnowflakeType';
              },
            ];
          };
          avatar: {
            type: ['string', 'null'];
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
          guild_id: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/SnowflakeType';
              },
            ];
          };
          id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          name: {
            type: 'string';
          };
          type: {
            type: 'integer';
            enum: [2];
            allOf: [
              {
                $ref: '#/components/schemas/WebhookTypes';
              },
            ];
            format: 'int32';
          };
          user: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/UserResponse';
              },
            ];
          };
          source_guild: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/WebhookSourceGuildResponse';
              },
            ];
          };
          source_channel: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/WebhookSourceChannelResponse';
              },
            ];
          };
        };
        required: ['id', 'name', 'type'];
      };
      ChannelPermissionOverwriteRequest: {
        type: 'object';
        properties: {
          id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
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
        required: ['id'];
      };
      ChannelPermissionOverwriteResponse: {
        type: 'object';
        properties: {
          id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          type: {
            $ref: '#/components/schemas/ChannelPermissionOverwrites';
          };
          allow: {
            type: 'string';
          };
          deny: {
            type: 'string';
          };
        };
        required: ['id', 'type', 'allow', 'deny'];
      };
      ChannelPermissionOverwrites: {
        type: 'integer';
        oneOf: [
          {
            title: 'ROLE';
            const: 0;
          },
          {
            title: 'MEMBER';
            const: 1;
          },
        ];
        format: 'int32';
      };
      ChannelSelect: {
        type: 'object';
        properties: {
          type: {
            type: 'integer';
            enum: [8];
            allOf: [
              {
                $ref: '#/components/schemas/MessageComponentTypes';
              },
            ];
            format: 'int32';
          };
          custom_id: {
            type: 'string';
            maxLength: 100;
          };
          placeholder: {
            type: ['string', 'null'];
            maxLength: 150;
          };
          min_values: {
            type: ['integer', 'null'];
            minimum: 0;
            maximum: 25;
          };
          max_values: {
            type: ['integer', 'null'];
            minimum: 1;
            maximum: 25;
          };
          disabled: {
            type: ['boolean', 'null'];
          };
          default_values: {
            type: ['array', 'null'];
            items: {
              $ref: '#/components/schemas/ChannelSelectDefaultValue';
            };
            maxItems: 25;
          };
          channel_types: {
            type: ['array', 'null'];
            items: {
              $ref: '#/components/schemas/ChannelTypes';
            };
            uniqueItems: true;
          };
        };
        required: ['type', 'custom_id'];
      };
      ChannelSelectDefaultValue: {
        type: 'object';
        properties: {
          type: {
            $ref: '#/components/schemas/SnowflakeSelectDefaultValueTypes';
          };
          id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
        };
        required: ['type', 'id'];
      };
      ChannelTypes: {
        type: 'integer';
        oneOf: [
          {
            title: 'DM';
            description: 'A direct message between users';
            const: 1;
          },
          {
            title: 'GROUP_DM';
            description: 'A direct message between multiple users';
            const: 3;
          },
          {
            title: 'GUILD_TEXT';
            description: 'A text channel within a server';
            const: 0;
          },
          {
            title: 'GUILD_VOICE';
            description: 'A voice channel within a server';
            const: 2;
          },
          {
            title: 'GUILD_CATEGORY';
            description: 'An organizational category that contains up to 50 channels';
            const: 4;
          },
          {
            title: 'GUILD_ANNOUNCEMENT';
            description: 'A channel that users can follow and crosspost into their own server (formerly news channels)';
            const: 5;
          },
          {
            title: 'ANNOUNCEMENT_THREAD';
            description: 'A temporary sub-channel within a GUILD_ANNOUNCEMENT channel';
            const: 10;
          },
          {
            title: 'PUBLIC_THREAD';
            description: 'A temporary sub-channel within a GUILD_TEXT or GUILD_THREADS_ONLY channel type set';
            const: 11;
          },
          {
            title: 'PRIVATE_THREAD';
            description: 'A temporary sub-channel within a GUILD_TEXT channel that is only viewable by those invited and those with the MANAGE_THREADS permission';
            const: 12;
          },
          {
            title: 'GUILD_STAGE_VOICE';
            description: 'A voice channel for hosting events with an audience';
            const: 13;
          },
          {
            title: 'GUILD_DIRECTORY';
            description: 'The channel in a hub containing the listed servers';
            const: 14;
          },
          {
            title: 'GUILD_FORUM';
            description: 'Channel that can only contain threads';
            const: 15;
          },
        ];
        format: 'int32';
      };
      CommandPermissionResponse: {
        type: 'object';
        properties: {
          id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          type: {
            $ref: '#/components/schemas/ApplicationCommandPermissionType';
          };
          permission: {
            type: 'boolean';
          };
        };
        required: ['id', 'type', 'permission'];
      };
      CommandPermissionsResponse: {
        type: 'object';
        properties: {
          id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          application_id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          guild_id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          permissions: {
            type: 'array';
            items: {
              $ref: '#/components/schemas/CommandPermissionResponse';
            };
          };
        };
        required: ['id', 'application_id', 'guild_id', 'permissions'];
      };
      ConnectedAccountGuildResponse: {
        type: 'object';
        properties: {
          id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          name: {
            type: 'string';
          };
          icon: {
            type: ['string', 'null'];
          };
        };
        required: ['id', 'name'];
      };
      ConnectedAccountIntegrationResponse: {
        type: 'object';
        properties: {
          id: {
            type: 'string';
          };
          type: {
            $ref: '#/components/schemas/IntegrationTypes';
          };
          account: {
            $ref: '#/components/schemas/AccountResponse';
          };
          guild: {
            $ref: '#/components/schemas/ConnectedAccountGuildResponse';
          };
        };
        required: ['id', 'type', 'account', 'guild'];
      };
      ConnectedAccountProviders: {
        type: 'string';
        oneOf: [
          {
            title: 'BATTLENET';
            const: 'battlenet';
          },
          {
            title: 'EBAY';
            const: 'ebay';
          },
          {
            title: 'EPIC_GAMES';
            const: 'epicgames';
          },
          {
            title: 'FACEBOOK';
            const: 'facebook';
          },
          {
            title: 'GITHUB';
            const: 'github';
          },
          {
            title: 'INSTAGRAM';
            const: 'instagram';
          },
          {
            title: 'LEAGUE_OF_LEGENDS';
            const: 'leagueoflegends';
          },
          {
            title: 'PAYPAL';
            const: 'paypal';
          },
          {
            title: 'PLAYSTATION';
            const: 'playstation';
          },
          {
            title: 'REDDIT';
            const: 'reddit';
          },
          {
            title: 'RIOT_GAMES';
            const: 'riotgames';
          },
          {
            title: 'SKYPE';
            const: 'skype';
          },
          {
            title: 'SPOTIFY';
            const: 'spotify';
          },
          {
            title: 'STEAM';
            const: 'steam';
          },
          {
            title: 'TIKTOK';
            const: 'tiktok';
          },
          {
            title: 'TWITCH';
            const: 'twitch';
          },
          {
            title: 'TWITTER';
            const: 'twitter';
          },
          {
            title: 'XBOX';
            const: 'xbox';
          },
          {
            title: 'YOUTUBE';
            const: 'youtube';
          },
        ];
      };
      ConnectedAccountResponse: {
        type: 'object';
        properties: {
          id: {
            type: 'string';
          };
          name: {
            type: ['string', 'null'];
          };
          type: {
            $ref: '#/components/schemas/ConnectedAccountProviders';
          };
          friend_sync: {
            type: 'boolean';
          };
          integrations: {
            type: ['array', 'null'];
            items: {
              $ref: '#/components/schemas/ConnectedAccountIntegrationResponse';
            };
          };
          show_activity: {
            type: 'boolean';
          };
          two_way_link: {
            type: 'boolean';
          };
          verified: {
            type: 'boolean';
          };
          visibility: {
            $ref: '#/components/schemas/ConnectedAccountVisibility';
          };
          revoked: {
            type: ['boolean', 'null'];
          };
        };
        required: ['id', 'type', 'friend_sync', 'show_activity', 'two_way_link', 'verified', 'visibility'];
      };
      ConnectedAccountVisibility: {
        type: 'integer';
        oneOf: [
          {
            title: 'NONE';
            const: 0;
          },
          {
            title: 'EVERYONE';
            const: 1;
          },
        ];
        format: 'int32';
      };
      CreateForumThreadRequest: {
        type: 'object';
        properties: {
          name: {
            type: 'string';
            minLength: 1;
            maxLength: 100;
          };
          auto_archive_duration: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/ThreadAutoArchiveDuration';
              },
            ];
          };
          rate_limit_per_user: {
            type: ['integer', 'null'];
            minimum: 0;
            maximum: 21600;
          };
          applied_tags: {
            type: ['array', 'null'];
            items: {
              $ref: '#/components/schemas/SnowflakeType';
            };
            maxItems: 5;
          };
          message: {
            $ref: '#/components/schemas/BaseCreateMessageCreateRequest';
          };
        };
        required: ['name', 'message'];
      };
      CreateGroupDMInviteRequest: {
        type: 'object';
        properties: {
          max_age: {
            type: ['integer', 'null'];
            minimum: 1;
            maximum: 604800;
          };
        };
      };
      CreateGuildChannelRequest: {
        type: 'object';
        properties: {
          type: {
            oneOf: [
              {
                type: 'null';
              },
              {
                type: 'integer';
                enum: [0, 2, 4, 5, 13, 14, 15];
                allOf: [
                  {
                    $ref: '#/components/schemas/ChannelTypes';
                  },
                ];
                format: 'int32';
              },
            ];
          };
          name: {
            type: 'string';
            minLength: 1;
            maxLength: 100;
          };
          position: {
            type: ['integer', 'null'];
            minimum: 0;
            format: 'int32';
          };
          topic: {
            type: ['string', 'null'];
            minLength: 0;
            maxLength: 4096;
          };
          bitrate: {
            type: ['integer', 'null'];
            minimum: 8000;
            format: 'int32';
          };
          user_limit: {
            type: ['integer', 'null'];
            minimum: 0;
            format: 'int32';
          };
          nsfw: {
            type: ['boolean', 'null'];
          };
          rate_limit_per_user: {
            type: ['integer', 'null'];
            minimum: 0;
            maximum: 21600;
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
          permission_overwrites: {
            type: ['array', 'null'];
            items: {
              $ref: '#/components/schemas/ChannelPermissionOverwriteRequest';
            };
            maxItems: 100;
          };
          rtc_region: {
            type: ['string', 'null'];
          };
          video_quality_mode: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/VideoQualityModes';
              },
            ];
          };
          default_auto_archive_duration: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/ThreadAutoArchiveDuration';
              },
            ];
          };
          default_reaction_emoji: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/UpdateDefaultReactionEmojiRequest';
              },
            ];
          };
          default_thread_rate_limit_per_user: {
            type: ['integer', 'null'];
            minimum: 0;
            maximum: 21600;
          };
          default_sort_order: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/ThreadSortOrder';
              },
            ];
          };
          default_forum_layout: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/ForumLayout';
              },
            ];
          };
          available_tags: {
            type: ['array', 'null'];
            items: {
              oneOf: [
                {
                  type: 'null';
                },
                {
                  $ref: '#/components/schemas/CreateOrUpdateThreadTagRequest';
                },
              ];
            };
            maxItems: 20;
          };
        };
        required: ['name'];
      };
      CreateGuildInviteRequest: {
        type: 'object';
        properties: {
          max_age: {
            type: ['integer', 'null'];
            minimum: 0;
            maximum: 2592000;
          };
          temporary: {
            type: ['boolean', 'null'];
          };
          max_uses: {
            type: ['integer', 'null'];
            minimum: 0;
            maximum: 100;
          };
          unique: {
            type: ['boolean', 'null'];
          };
          target_user_id: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/SnowflakeType';
              },
            ];
          };
          target_application_id: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/SnowflakeType';
              },
            ];
          };
          target_type: {
            oneOf: [
              {
                type: 'null';
              },
              {
                type: 'integer';
                enum: [1, 2];
                allOf: [
                  {
                    $ref: '#/components/schemas/InviteTargetTypes';
                  },
                ];
                format: 'int32';
              },
            ];
          };
        };
      };
      CreateGuildRequestChannelItem: {
        type: 'object';
        properties: {
          type: {
            oneOf: [
              {
                type: 'null';
              },
              {
                type: 'integer';
                enum: [0, 2, 4];
                allOf: [
                  {
                    $ref: '#/components/schemas/ChannelTypes';
                  },
                ];
                format: 'int32';
              },
            ];
          };
          name: {
            type: 'string';
            minLength: 1;
            maxLength: 100;
          };
          position: {
            type: ['integer', 'null'];
            minimum: 0;
            format: 'int32';
          };
          topic: {
            type: ['string', 'null'];
            minLength: 0;
            maxLength: 4096;
          };
          bitrate: {
            type: ['integer', 'null'];
            minimum: 8000;
            format: 'int32';
          };
          user_limit: {
            type: ['integer', 'null'];
            minimum: 0;
            format: 'int32';
          };
          nsfw: {
            type: ['boolean', 'null'];
          };
          rate_limit_per_user: {
            type: ['integer', 'null'];
            minimum: 0;
            maximum: 21600;
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
          permission_overwrites: {
            type: ['array', 'null'];
            items: {
              $ref: '#/components/schemas/ChannelPermissionOverwriteRequest';
            };
            maxItems: 100;
          };
          rtc_region: {
            type: ['string', 'null'];
          };
          video_quality_mode: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/VideoQualityModes';
              },
            ];
          };
          default_auto_archive_duration: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/ThreadAutoArchiveDuration';
              },
            ];
          };
          default_reaction_emoji: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/UpdateDefaultReactionEmojiRequest';
              },
            ];
          };
          default_thread_rate_limit_per_user: {
            type: ['integer', 'null'];
            minimum: 0;
            maximum: 21600;
          };
          default_sort_order: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/ThreadSortOrder';
              },
            ];
          };
          default_forum_layout: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/ForumLayout';
              },
            ];
          };
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
          available_tags: {
            type: ['array', 'null'];
            items: {
              $ref: '#/components/schemas/CreateOrUpdateThreadTagRequest';
            };
            maxItems: 20;
          };
        };
        required: ['name'];
      };
      CreateGuildRequestRoleItem: {
        type: 'object';
        properties: {
          id: {
            type: 'integer';
          };
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
          unicode_emoji: {
            type: ['string', 'null'];
            maxLength: 100;
          };
        };
        required: ['id'];
      };
      CreateMessageInteractionCallbackRequest: {
        type: 'object';
        properties: {
          type: {
            type: 'integer';
            enum: [4, 5];
            allOf: [
              {
                $ref: '#/components/schemas/InteractionCallbackTypes';
              },
            ];
            format: 'int32';
          };
          data: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/IncomingWebhookInteractionRequest';
              },
            ];
          };
        };
        required: ['type'];
      };
      CreateOrUpdateThreadTagRequest: {
        type: 'object';
        properties: {
          name: {
            type: 'string';
            minLength: 0;
            maxLength: 20;
          };
          emoji_id: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/SnowflakeType';
              },
            ];
          };
          emoji_name: {
            type: ['string', 'null'];
            maxLength: 100;
          };
          moderated: {
            type: ['boolean', 'null'];
          };
        };
        required: ['name'];
      };
      CreatePrivateChannelRequest: {
        type: 'object';
        properties: {
          recipient_id: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/SnowflakeType';
              },
            ];
          };
          access_tokens: {
            type: ['array', 'null'];
            items: {
              type: 'string';
              maxLength: 152133;
            };
            maxItems: 1521;
            uniqueItems: true;
          };
          nicks: {
            type: ['object', 'null'];
            additionalProperties: {
              type: ['string', 'null'];
              maxLength: 152133;
            };
            maxProperties: 1521;
          };
        };
      };
      CreateTextThreadWithMessageRequest: {
        type: 'object';
        properties: {
          name: {
            type: 'string';
            minLength: 1;
            maxLength: 100;
          };
          auto_archive_duration: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/ThreadAutoArchiveDuration';
              },
            ];
          };
          rate_limit_per_user: {
            type: ['integer', 'null'];
            minimum: 0;
            maximum: 21600;
          };
        };
        required: ['name'];
      };
      CreateTextThreadWithoutMessageRequest: {
        type: 'object';
        properties: {
          name: {
            type: 'string';
            minLength: 1;
            maxLength: 100;
          };
          auto_archive_duration: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/ThreadAutoArchiveDuration';
              },
            ];
          };
          rate_limit_per_user: {
            type: ['integer', 'null'];
            minimum: 0;
            maximum: 21600;
          };
          type: {
            oneOf: [
              {
                type: 'null';
              },
              {
                type: 'integer';
                enum: [10, 11, 12];
                allOf: [
                  {
                    $ref: '#/components/schemas/ChannelTypes';
                  },
                ];
                format: 'int32';
              },
            ];
          };
          invitable: {
            type: ['boolean', 'null'];
          };
        };
        required: ['name'];
      };
      CreatedThreadResponse: {
        type: 'object';
        properties: {
          id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          type: {
            type: 'integer';
            enum: [10, 11, 12];
            allOf: [
              {
                $ref: '#/components/schemas/ChannelTypes';
              },
            ];
            format: 'int32';
          };
          last_message_id: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/SnowflakeType';
              },
            ];
          };
          flags: {
            type: 'integer';
            format: 'int32';
          };
          last_pin_timestamp: {
            type: ['string', 'null'];
            format: 'date-time';
          };
          guild_id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          name: {
            type: 'string';
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
          rate_limit_per_user: {
            type: ['integer', 'null'];
            format: 'int32';
          };
          bitrate: {
            type: ['integer', 'null'];
            format: 'int32';
          };
          user_limit: {
            type: ['integer', 'null'];
            format: 'int32';
          };
          rtc_region: {
            type: ['string', 'null'];
          };
          video_quality_mode: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/VideoQualityModes';
              },
            ];
          };
          permissions: {
            type: ['string', 'null'];
          };
          owner_id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          thread_metadata: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/ThreadMetadataResponse';
              },
            ];
          };
          message_count: {
            type: 'integer';
            format: 'int32';
          };
          member_count: {
            type: 'integer';
            format: 'int32';
          };
          total_message_sent: {
            type: 'integer';
            format: 'int32';
          };
          applied_tags: {
            type: ['array', 'null'];
            items: {
              $ref: '#/components/schemas/SnowflakeType';
            };
          };
          member: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/ThreadMemberResponse';
              },
            ];
          };
        };
        required: [
          'id',
          'type',
          'flags',
          'guild_id',
          'name',
          'owner_id',
          'message_count',
          'member_count',
          'total_message_sent',
        ];
      };
      DefaultKeywordListTriggerMetadata: {
        type: 'object';
        properties: {
          allow_list: {
            type: ['array', 'null'];
            items: {
              type: 'string';
              minLength: 1;
              maxLength: 60;
            };
            maxItems: 1000;
          };
          presets: {
            type: ['array', 'null'];
            items: {
              $ref: '#/components/schemas/AutomodKeywordPresetType';
            };
            uniqueItems: true;
          };
        };
      };
      DefaultKeywordListTriggerMetadataResponse: {
        type: 'object';
        properties: {
          allow_list: {
            type: 'array';
            items: {
              type: 'string';
            };
          };
          presets: {
            type: 'array';
            items: {
              $ref: '#/components/schemas/AutomodKeywordPresetType';
            };
            uniqueItems: true;
          };
        };
        required: ['allow_list', 'presets'];
      };
      DefaultKeywordListUpsertRequest: {
        type: 'object';
        properties: {
          name: {
            type: 'string';
            maxLength: 100;
          };
          event_type: {
            $ref: '#/components/schemas/AutomodEventType';
          };
          actions: {
            type: ['array', 'null'];
            items: {
              oneOf: [
                {
                  $ref: '#/components/schemas/BlockMessageAction';
                },
                {
                  $ref: '#/components/schemas/FlagToChannelAction';
                },
                {
                  $ref: '#/components/schemas/QuarantineUserAction';
                },
                {
                  $ref: '#/components/schemas/UserCommunicationDisabledAction';
                },
              ];
            };
            minItems: 1;
            maxItems: 5;
          };
          enabled: {
            type: ['boolean', 'null'];
          };
          exempt_roles: {
            type: ['array', 'null'];
            items: {
              $ref: '#/components/schemas/SnowflakeType';
            };
            maxItems: 20;
            uniqueItems: true;
          };
          exempt_channels: {
            type: ['array', 'null'];
            items: {
              $ref: '#/components/schemas/SnowflakeType';
            };
            maxItems: 50;
            uniqueItems: true;
          };
          trigger_type: {
            type: 'integer';
            enum: [4];
            allOf: [
              {
                $ref: '#/components/schemas/AutomodTriggerType';
              },
            ];
            format: 'int32';
          };
          trigger_metadata: {
            $ref: '#/components/schemas/DefaultKeywordListTriggerMetadata';
          };
        };
        required: ['name', 'event_type', 'trigger_type', 'trigger_metadata'];
      };
      DefaultKeywordListUpsertRequestPartial: {
        type: 'object';
        properties: {
          name: {
            type: 'string';
            maxLength: 100;
          };
          event_type: {
            $ref: '#/components/schemas/AutomodEventType';
          };
          actions: {
            type: ['array', 'null'];
            items: {
              oneOf: [
                {
                  $ref: '#/components/schemas/BlockMessageAction';
                },
                {
                  $ref: '#/components/schemas/FlagToChannelAction';
                },
                {
                  $ref: '#/components/schemas/QuarantineUserAction';
                },
                {
                  $ref: '#/components/schemas/UserCommunicationDisabledAction';
                },
              ];
            };
            minItems: 1;
            maxItems: 5;
          };
          enabled: {
            type: ['boolean', 'null'];
          };
          exempt_roles: {
            type: ['array', 'null'];
            items: {
              $ref: '#/components/schemas/SnowflakeType';
            };
            maxItems: 20;
            uniqueItems: true;
          };
          exempt_channels: {
            type: ['array', 'null'];
            items: {
              $ref: '#/components/schemas/SnowflakeType';
            };
            maxItems: 50;
            uniqueItems: true;
          };
          trigger_type: {
            type: 'integer';
            enum: [4];
            allOf: [
              {
                $ref: '#/components/schemas/AutomodTriggerType';
              },
            ];
            format: 'int32';
          };
          trigger_metadata: {
            $ref: '#/components/schemas/DefaultKeywordListTriggerMetadata';
          };
        };
      };
      DefaultKeywordRuleResponse: {
        type: 'object';
        properties: {
          id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          guild_id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          creator_id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          name: {
            type: 'string';
          };
          event_type: {
            $ref: '#/components/schemas/AutomodEventType';
          };
          actions: {
            type: 'array';
            items: {
              oneOf: [
                {
                  $ref: '#/components/schemas/BlockMessageActionResponse';
                },
                {
                  $ref: '#/components/schemas/FlagToChannelActionResponse';
                },
                {
                  $ref: '#/components/schemas/QuarantineUserActionResponse';
                },
                {
                  $ref: '#/components/schemas/UserCommunicationDisabledActionResponse';
                },
              ];
            };
          };
          trigger_type: {
            type: 'integer';
            enum: [4];
            allOf: [
              {
                $ref: '#/components/schemas/AutomodTriggerType';
              },
            ];
            format: 'int32';
          };
          enabled: {
            type: ['boolean', 'null'];
          };
          exempt_roles: {
            type: ['array', 'null'];
            items: {
              $ref: '#/components/schemas/SnowflakeType';
            };
            uniqueItems: true;
          };
          exempt_channels: {
            type: ['array', 'null'];
            items: {
              $ref: '#/components/schemas/SnowflakeType';
            };
            uniqueItems: true;
          };
          trigger_metadata: {
            $ref: '#/components/schemas/DefaultKeywordListTriggerMetadataResponse';
          };
        };
        required: ['id', 'guild_id', 'creator_id', 'name', 'event_type', 'actions', 'trigger_type', 'trigger_metadata'];
      };
      DefaultReactionEmojiResponse: {
        type: 'object';
        properties: {
          emoji_id: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/SnowflakeType';
              },
            ];
          };
          emoji_name: {
            type: ['string', 'null'];
          };
        };
      };
      DiscordIntegrationResponse: {
        type: 'object';
        properties: {
          type: {
            type: 'string';
            enum: ['discord'];
            allOf: [
              {
                $ref: '#/components/schemas/IntegrationTypes';
              },
            ];
          };
          name: {
            type: ['string', 'null'];
          };
          account: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/AccountResponse';
              },
            ];
          };
          enabled: {
            type: ['boolean', 'null'];
          };
          id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          application: {
            $ref: '#/components/schemas/IntegrationApplicationResponse';
          };
          scopes: {
            type: 'array';
            items: {
              type: 'string';
              enum: ['applications.commands', 'bot', 'webhook.incoming'];
              allOf: [
                {
                  $ref: '#/components/schemas/OAuth2Scopes';
                },
              ];
            };
            uniqueItems: true;
          };
          user: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/UserResponse';
              },
            ];
          };
        };
        required: ['type', 'id', 'application', 'scopes'];
      };
      Emoji: {
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
          name: {
            type: 'string';
            maxLength: 32;
          };
          animated: {
            type: ['boolean', 'null'];
          };
        };
        required: ['name'];
      };
      EmojiResponse: {
        type: 'object';
        properties: {
          id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          name: {
            type: 'string';
          };
          user: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/UserResponse';
              },
            ];
          };
          roles: {
            type: 'array';
            items: {
              $ref: '#/components/schemas/SnowflakeType';
            };
          };
          require_colons: {
            type: 'boolean';
          };
          managed: {
            type: 'boolean';
          };
          animated: {
            type: 'boolean';
          };
          available: {
            type: 'boolean';
          };
        };
        required: ['id', 'name', 'roles', 'require_colons', 'managed', 'animated', 'available'];
      };
      EntityMetadataExternal: {
        type: 'object';
        properties: {
          location: {
            type: 'string';
            maxLength: 100;
          };
        };
        required: ['location'];
      };
      EntityMetadataExternalResponse: {
        type: 'object';
        properties: {
          location: {
            type: 'string';
          };
        };
        required: ['location'];
      };
      EntityMetadataStageInstance: {
        type: 'object';
        properties: {};
      };
      EntityMetadataStageInstanceResponse: {
        type: 'object';
        properties: {};
      };
      EntityMetadataVoice: {
        type: 'object';
        properties: {};
      };
      EntityMetadataVoiceResponse: {
        type: 'object';
        properties: {};
      };
      ExternalConnectionIntegrationResponse: {
        type: 'object';
        properties: {
          type: {
            type: 'string';
            enum: ['twitch', 'youtube'];
            allOf: [
              {
                $ref: '#/components/schemas/IntegrationTypes';
              },
            ];
          };
          name: {
            type: ['string', 'null'];
          };
          account: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/AccountResponse';
              },
            ];
          };
          enabled: {
            type: ['boolean', 'null'];
          };
          id: {
            type: 'string';
          };
          user: {
            $ref: '#/components/schemas/UserResponse';
          };
          revoked: {
            type: ['boolean', 'null'];
          };
          expire_behavior: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/IntegrationExpireBehaviorTypes';
              },
            ];
          };
          expire_grace_period: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/IntegrationExpireGracePeriodTypes';
              },
            ];
          };
          subscriber_count: {
            type: ['integer', 'null'];
            format: 'int32';
          };
          synced_at: {
            type: ['string', 'null'];
            format: 'date-time';
          };
          role_id: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/SnowflakeType';
              },
            ];
          };
          syncing: {
            type: ['boolean', 'null'];
          };
          enable_emoticons: {
            type: ['boolean', 'null'];
          };
        };
        required: ['type', 'id', 'user'];
      };
      ExternalScheduledEventCreateRequest: {
        type: 'object';
        properties: {
          name: {
            type: 'string';
            maxLength: 100;
          };
          description: {
            type: ['string', 'null'];
            maxLength: 1000;
          };
          image: {
            type: ['string', 'null'];
            contentEncoding: 'base64';
          };
          scheduled_start_time: {
            type: 'string';
            format: 'date-time';
          };
          scheduled_end_time: {
            type: ['string', 'null'];
            format: 'date-time';
          };
          privacy_level: {
            $ref: '#/components/schemas/GuildScheduledEventPrivacyLevels';
          };
          entity_type: {
            type: 'integer';
            enum: [3];
            allOf: [
              {
                $ref: '#/components/schemas/GuildScheduledEventEntityTypes';
              },
            ];
            format: 'int32';
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
          entity_metadata: {
            $ref: '#/components/schemas/EntityMetadataExternal';
          };
        };
        required: ['name', 'scheduled_start_time', 'privacy_level', 'entity_type', 'entity_metadata'];
      };
      ExternalScheduledEventPatchRequestPartial: {
        type: 'object';
        properties: {
          status: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/GuildScheduledEventStatuses';
              },
            ];
          };
          name: {
            type: 'string';
            maxLength: 100;
          };
          description: {
            type: ['string', 'null'];
            maxLength: 1000;
          };
          image: {
            type: ['string', 'null'];
            contentEncoding: 'base64';
          };
          scheduled_start_time: {
            type: 'string';
            format: 'date-time';
          };
          scheduled_end_time: {
            type: ['string', 'null'];
            format: 'date-time';
          };
          entity_type: {
            oneOf: [
              {
                type: 'null';
              },
              {
                type: 'integer';
                enum: [3];
                allOf: [
                  {
                    $ref: '#/components/schemas/GuildScheduledEventEntityTypes';
                  },
                ];
                format: 'int32';
              },
            ];
          };
          privacy_level: {
            $ref: '#/components/schemas/GuildScheduledEventPrivacyLevels';
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
          entity_metadata: {
            $ref: '#/components/schemas/EntityMetadataExternal';
          };
        };
      };
      ExternalScheduledEventResponse: {
        type: 'object';
        properties: {
          id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          guild_id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          name: {
            type: 'string';
          };
          description: {
            type: ['string', 'null'];
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
          creator_id: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/SnowflakeType';
              },
            ];
          };
          creator: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/UserResponse';
              },
            ];
          };
          image: {
            type: ['string', 'null'];
          };
          scheduled_start_time: {
            type: 'string';
            format: 'date-time';
          };
          scheduled_end_time: {
            type: ['string', 'null'];
            format: 'date-time';
          };
          status: {
            $ref: '#/components/schemas/GuildScheduledEventStatuses';
          };
          entity_type: {
            type: 'integer';
            enum: [3];
            allOf: [
              {
                $ref: '#/components/schemas/GuildScheduledEventEntityTypes';
              },
            ];
            format: 'int32';
          };
          entity_id: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/SnowflakeType';
              },
            ];
          };
          user_count: {
            type: ['integer', 'null'];
            format: 'int32';
          };
          privacy_level: {
            $ref: '#/components/schemas/GuildScheduledEventPrivacyLevels';
          };
          user_rsvp: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/ScheduledEventUserResponse';
              },
            ];
          };
          entity_metadata: {
            $ref: '#/components/schemas/EntityMetadataExternalResponse';
          };
        };
        required: [
          'id',
          'guild_id',
          'name',
          'scheduled_start_time',
          'status',
          'entity_type',
          'privacy_level',
          'entity_metadata',
        ];
      };
      FlagToChannelAction: {
        type: 'object';
        properties: {
          type: {
            type: 'integer';
            enum: [2];
            allOf: [
              {
                $ref: '#/components/schemas/AutomodActionType';
              },
            ];
            format: 'int32';
          };
          metadata: {
            $ref: '#/components/schemas/FlagToChannelActionMetadata';
          };
        };
        required: ['type', 'metadata'];
      };
      FlagToChannelActionMetadata: {
        type: 'object';
        properties: {
          channel_id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
        };
        required: ['channel_id'];
      };
      FlagToChannelActionMetadataResponse: {
        type: 'object';
        properties: {
          channel_id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
        };
        required: ['channel_id'];
      };
      FlagToChannelActionResponse: {
        type: 'object';
        properties: {
          type: {
            type: 'integer';
            enum: [2];
            allOf: [
              {
                $ref: '#/components/schemas/AutomodActionType';
              },
            ];
            format: 'int32';
          };
          metadata: {
            $ref: '#/components/schemas/FlagToChannelActionMetadataResponse';
          };
        };
        required: ['type', 'metadata'];
      };
      ForumLayout: {
        type: 'integer';
        oneOf: [
          {
            title: 'DEFAULT';
            description: 'No default has been set for forum channel';
            const: 0;
          },
          {
            title: 'LIST';
            description: 'Display posts as a list';
            const: 1;
          },
          {
            title: 'GRID';
            description: 'Display posts as a collection of tiles';
            const: 2;
          },
        ];
        format: 'int32';
      };
      ForumTagResponse: {
        type: 'object';
        properties: {
          id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          name: {
            type: 'string';
          };
          moderated: {
            type: 'boolean';
          };
          emoji_id: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/SnowflakeType';
              },
            ];
          };
          emoji_name: {
            type: ['string', 'null'];
          };
        };
        required: ['id', 'name', 'moderated'];
      };
      FriendInviteResponse: {
        type: 'object';
        properties: {
          type: {
            oneOf: [
              {
                type: 'null';
              },
              {
                type: 'integer';
                enum: [2];
                allOf: [
                  {
                    $ref: '#/components/schemas/InviteTypes';
                  },
                ];
                format: 'int32';
              },
            ];
          };
          code: {
            type: 'string';
          };
          inviter: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/UserResponse';
              },
            ];
          };
          max_age: {
            type: ['integer', 'null'];
            format: 'int32';
          };
          created_at: {
            type: ['string', 'null'];
            format: 'date-time';
          };
          expires_at: {
            type: ['string', 'null'];
            format: 'date-time';
          };
          friends_count: {
            type: ['integer', 'null'];
            format: 'int32';
          };
          channel: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/InviteChannelResponse';
              },
            ];
          };
          is_contact: {
            type: ['boolean', 'null'];
          };
          uses: {
            type: ['integer', 'null'];
            format: 'int32';
          };
          max_uses: {
            type: ['integer', 'null'];
            format: 'int32';
          };
          flags: {
            type: ['integer', 'null'];
            format: 'int32';
          };
        };
        required: ['code'];
      };
      GatewayBotResponse: {
        type: 'object';
        properties: {
          url: {
            type: 'string';
            format: 'uri';
          };
          session_start_limit: {
            $ref: '#/components/schemas/GatewayBotSessionStartLimitResponse';
          };
          shards: {
            type: 'integer';
            format: 'int32';
          };
        };
        required: ['url', 'session_start_limit', 'shards'];
      };
      GatewayBotSessionStartLimitResponse: {
        type: 'object';
        properties: {
          max_concurrency: {
            type: 'integer';
            format: 'int32';
          };
          remaining: {
            type: 'integer';
            format: 'int32';
          };
          reset_after: {
            type: 'integer';
            format: 'int32';
          };
          total: {
            type: 'integer';
            format: 'int32';
          };
        };
        required: ['max_concurrency', 'remaining', 'reset_after', 'total'];
      };
      GatewayResponse: {
        type: 'object';
        properties: {
          url: {
            type: 'string';
            format: 'uri';
          };
        };
        required: ['url'];
      };
      GithubAuthor: {
        type: 'object';
        properties: {
          username: {
            type: ['string', 'null'];
            maxLength: 152133;
          };
          name: {
            type: 'string';
            maxLength: 152133;
          };
        };
        required: ['name'];
      };
      GithubCheckApp: {
        type: 'object';
        properties: {
          name: {
            type: 'string';
            maxLength: 152133;
          };
        };
        required: ['name'];
      };
      GithubCheckPullRequest: {
        type: 'object';
        properties: {
          number: {
            type: 'integer';
          };
        };
        required: ['number'];
      };
      GithubCheckRun: {
        type: 'object';
        properties: {
          conclusion: {
            type: ['string', 'null'];
            maxLength: 152133;
          };
          name: {
            type: 'string';
            maxLength: 152133;
          };
          html_url: {
            type: 'string';
            maxLength: 2048;
            format: 'uri';
          };
          check_suite: {
            $ref: '#/components/schemas/GithubCheckSuite';
          };
          details_url: {
            type: ['string', 'null'];
            maxLength: 2048;
            format: 'uri';
          };
          output: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/GithubCheckRunOutput';
              },
            ];
          };
          pull_requests: {
            type: ['array', 'null'];
            items: {
              $ref: '#/components/schemas/GithubCheckPullRequest';
            };
            maxItems: 1521;
          };
        };
        required: ['name', 'html_url', 'check_suite'];
      };
      GithubCheckRunOutput: {
        type: 'object';
        properties: {
          title: {
            type: ['string', 'null'];
            maxLength: 152133;
          };
          summary: {
            type: ['string', 'null'];
            maxLength: 152133;
          };
        };
      };
      GithubCheckSuite: {
        type: 'object';
        properties: {
          conclusion: {
            type: ['string', 'null'];
            maxLength: 152133;
          };
          head_branch: {
            type: ['string', 'null'];
            maxLength: 152133;
          };
          head_sha: {
            type: 'string';
            maxLength: 152133;
          };
          pull_requests: {
            type: ['array', 'null'];
            items: {
              $ref: '#/components/schemas/GithubCheckPullRequest';
            };
            maxItems: 1521;
          };
          app: {
            $ref: '#/components/schemas/GithubCheckApp';
          };
        };
        required: ['head_sha', 'app'];
      };
      GithubComment: {
        type: 'object';
        properties: {
          id: {
            type: 'integer';
          };
          html_url: {
            type: 'string';
            maxLength: 2048;
            format: 'uri';
          };
          user: {
            $ref: '#/components/schemas/GithubUser';
          };
          commit_id: {
            type: ['string', 'null'];
            maxLength: 152133;
          };
          body: {
            type: 'string';
            maxLength: 152133;
          };
        };
        required: ['id', 'html_url', 'user', 'body'];
      };
      GithubCommit: {
        type: 'object';
        properties: {
          id: {
            type: 'string';
            maxLength: 152133;
          };
          url: {
            type: 'string';
            maxLength: 2048;
            format: 'uri';
          };
          message: {
            type: 'string';
            maxLength: 152133;
          };
          author: {
            $ref: '#/components/schemas/GithubAuthor';
          };
        };
        required: ['id', 'url', 'message', 'author'];
      };
      GithubDiscussion: {
        type: 'object';
        properties: {
          title: {
            type: 'string';
            maxLength: 152133;
          };
          number: {
            type: 'integer';
          };
          html_url: {
            type: 'string';
            maxLength: 2048;
            format: 'uri';
          };
          answer_html_url: {
            type: ['string', 'null'];
            maxLength: 2048;
            format: 'uri';
          };
          body: {
            type: ['string', 'null'];
            maxLength: 152133;
          };
          user: {
            $ref: '#/components/schemas/GithubUser';
          };
        };
        required: ['title', 'number', 'html_url', 'user'];
      };
      GithubIssue: {
        type: 'object';
        properties: {
          id: {
            type: 'integer';
          };
          number: {
            type: 'integer';
          };
          html_url: {
            type: 'string';
            maxLength: 2048;
            format: 'uri';
          };
          user: {
            $ref: '#/components/schemas/GithubUser';
          };
          title: {
            type: 'string';
            maxLength: 152133;
          };
          body: {
            type: ['string', 'null'];
            maxLength: 152133;
          };
          pull_request: {};
        };
        required: ['id', 'number', 'html_url', 'user', 'title'];
      };
      GithubRelease: {
        type: 'object';
        properties: {
          id: {
            type: 'integer';
          };
          tag_name: {
            type: 'string';
            maxLength: 152133;
          };
          html_url: {
            type: 'string';
            maxLength: 2048;
            format: 'uri';
          };
          author: {
            $ref: '#/components/schemas/GithubUser';
          };
        };
        required: ['id', 'tag_name', 'html_url', 'author'];
      };
      GithubRepository: {
        type: 'object';
        properties: {
          id: {
            type: 'integer';
          };
          html_url: {
            type: 'string';
            maxLength: 2048;
            format: 'uri';
          };
          name: {
            type: 'string';
            maxLength: 152133;
          };
          full_name: {
            type: 'string';
            maxLength: 152133;
          };
        };
        required: ['id', 'html_url', 'name', 'full_name'];
      };
      GithubReview: {
        type: 'object';
        properties: {
          user: {
            $ref: '#/components/schemas/GithubUser';
          };
          body: {
            type: ['string', 'null'];
            maxLength: 152133;
          };
          html_url: {
            type: 'string';
            maxLength: 2048;
            format: 'uri';
          };
          state: {
            type: 'string';
            maxLength: 152133;
          };
        };
        required: ['user', 'html_url', 'state'];
      };
      GithubUser: {
        type: 'object';
        properties: {
          id: {
            type: 'integer';
          };
          login: {
            type: 'string';
            maxLength: 152133;
          };
          html_url: {
            type: 'string';
            maxLength: 2048;
            format: 'uri';
          };
          avatar_url: {
            type: 'string';
            maxLength: 2048;
            format: 'uri';
          };
        };
        required: ['id', 'login', 'html_url', 'avatar_url'];
      };
      GithubWebhook: {
        type: 'object';
        properties: {
          action: {
            type: ['string', 'null'];
            maxLength: 152133;
          };
          ref: {
            type: ['string', 'null'];
            maxLength: 152133;
          };
          ref_type: {
            type: ['string', 'null'];
            maxLength: 152133;
          };
          comment: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/GithubComment';
              },
            ];
          };
          issue: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/GithubIssue';
              },
            ];
          };
          pull_request: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/GithubIssue';
              },
            ];
          };
          repository: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/GithubRepository';
              },
            ];
          };
          forkee: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/GithubRepository';
              },
            ];
          };
          sender: {
            $ref: '#/components/schemas/GithubUser';
          };
          member: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/GithubUser';
              },
            ];
          };
          release: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/GithubRelease';
              },
            ];
          };
          head_commit: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/GithubCommit';
              },
            ];
          };
          commits: {
            type: ['array', 'null'];
            items: {
              $ref: '#/components/schemas/GithubCommit';
            };
            maxItems: 1521;
          };
          forced: {
            type: ['boolean', 'null'];
          };
          compare: {
            type: ['string', 'null'];
            maxLength: 2048;
            format: 'uri';
          };
          review: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/GithubReview';
              },
            ];
          };
          check_run: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/GithubCheckRun';
              },
            ];
          };
          check_suite: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/GithubCheckSuite';
              },
            ];
          };
          discussion: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/GithubDiscussion';
              },
            ];
          };
          answer: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/GithubComment';
              },
            ];
          };
        };
        required: ['sender'];
      };
      GroupDMInviteResponse: {
        type: 'object';
        properties: {
          type: {
            oneOf: [
              {
                type: 'null';
              },
              {
                type: 'integer';
                enum: [1];
                allOf: [
                  {
                    $ref: '#/components/schemas/InviteTypes';
                  },
                ];
                format: 'int32';
              },
            ];
          };
          code: {
            type: 'string';
          };
          inviter: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/UserResponse';
              },
            ];
          };
          max_age: {
            type: ['integer', 'null'];
            format: 'int32';
          };
          created_at: {
            type: ['string', 'null'];
            format: 'date-time';
          };
          expires_at: {
            type: ['string', 'null'];
            format: 'date-time';
          };
          channel: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/InviteChannelResponse';
              },
            ];
          };
          approximate_member_count: {
            type: ['integer', 'null'];
            format: 'int32';
          };
        };
        required: ['code'];
      };
      GuildAuditLogResponse: {
        type: 'object';
        properties: {
          audit_log_entries: {
            type: 'array';
            items: {
              $ref: '#/components/schemas/AuditLogEntryResponse';
            };
          };
          users: {
            type: 'array';
            items: {
              $ref: '#/components/schemas/UserResponse';
            };
          };
          integrations: {
            type: 'array';
            items: {
              oneOf: [
                {
                  $ref: '#/components/schemas/PartialDiscordIntegrationResponse';
                },
                {
                  $ref: '#/components/schemas/PartialExternalConnectionIntegrationResponse';
                },
                {
                  $ref: '#/components/schemas/PartialGuildSubscriptionIntegrationResponse';
                },
              ];
            };
          };
          webhooks: {
            type: 'array';
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
          guild_scheduled_events: {
            type: 'array';
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
          threads: {
            type: 'array';
            items: {
              $ref: '#/components/schemas/ThreadResponse';
            };
          };
          application_commands: {
            type: 'array';
            items: {
              $ref: '#/components/schemas/ApplicationCommandResponse';
            };
          };
          auto_moderation_rules: {
            type: 'array';
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
        required: [
          'audit_log_entries',
          'users',
          'integrations',
          'webhooks',
          'guild_scheduled_events',
          'threads',
          'application_commands',
          'auto_moderation_rules',
        ];
      };
      GuildBanResponse: {
        type: 'object';
        properties: {
          user: {
            $ref: '#/components/schemas/UserResponse';
          };
          reason: {
            type: ['string', 'null'];
          };
        };
        required: ['user'];
      };
      GuildChannelResponse: {
        type: 'object';
        properties: {
          id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          type: {
            type: 'integer';
            enum: [0, 2, 4, 5, 13, 14, 15];
            allOf: [
              {
                $ref: '#/components/schemas/ChannelTypes';
              },
            ];
            format: 'int32';
          };
          last_message_id: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/SnowflakeType';
              },
            ];
          };
          flags: {
            type: 'integer';
            format: 'int32';
          };
          last_pin_timestamp: {
            type: ['string', 'null'];
            format: 'date-time';
          };
          guild_id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          name: {
            type: 'string';
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
          rate_limit_per_user: {
            type: ['integer', 'null'];
            format: 'int32';
          };
          bitrate: {
            type: ['integer', 'null'];
            format: 'int32';
          };
          user_limit: {
            type: ['integer', 'null'];
            format: 'int32';
          };
          rtc_region: {
            type: ['string', 'null'];
          };
          video_quality_mode: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/VideoQualityModes';
              },
            ];
          };
          permissions: {
            type: ['string', 'null'];
          };
          topic: {
            type: ['string', 'null'];
          };
          default_auto_archive_duration: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/ThreadAutoArchiveDuration';
              },
            ];
          };
          default_thread_rate_limit_per_user: {
            type: ['integer', 'null'];
            format: 'int32';
          };
          position: {
            type: 'integer';
            format: 'int32';
          };
          permission_overwrites: {
            type: ['array', 'null'];
            items: {
              $ref: '#/components/schemas/ChannelPermissionOverwriteResponse';
            };
          };
          nsfw: {
            type: ['boolean', 'null'];
          };
          available_tags: {
            type: ['array', 'null'];
            items: {
              $ref: '#/components/schemas/ForumTagResponse';
            };
          };
          default_reaction_emoji: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/DefaultReactionEmojiResponse';
              },
            ];
          };
          default_sort_order: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/ThreadSortOrder';
              },
            ];
          };
          default_forum_layout: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/ForumLayout';
              },
            ];
          };
        };
        required: ['id', 'type', 'flags', 'guild_id', 'name', 'position'];
      };
      GuildCreateRequest: {
        type: 'object';
        properties: {
          name: {
            type: 'string';
            minLength: 2;
            maxLength: 100;
          };
          description: {
            type: ['string', 'null'];
            minLength: 0;
            maxLength: 1024;
          };
          region: {
            type: ['string', 'null'];
          };
          icon: {
            type: ['string', 'null'];
            contentEncoding: 'base64';
          };
          verification_level: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/VerificationLevels';
              },
            ];
          };
          default_message_notifications: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/UserNotificationSettings';
              },
            ];
          };
          explicit_content_filter: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/GuildExplicitContentFilterTypes';
              },
            ];
          };
          preferred_locale: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/AvailableLocalesEnum';
              },
            ];
          };
          afk_timeout: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/AfkTimeouts';
              },
            ];
          };
          roles: {
            type: ['array', 'null'];
            items: {
              $ref: '#/components/schemas/CreateGuildRequestRoleItem';
            };
            maxItems: 1521;
          };
          channels: {
            type: ['array', 'null'];
            items: {
              $ref: '#/components/schemas/CreateGuildRequestChannelItem';
            };
            maxItems: 1521;
          };
          afk_channel_id: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/SnowflakeType';
              },
            ];
          };
          system_channel_id: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/SnowflakeType';
              },
            ];
          };
          system_channel_flags: {
            type: ['integer', 'null'];
          };
        };
        required: ['name'];
      };
      GuildExplicitContentFilterTypes: {
        type: 'integer';
        oneOf: [
          {
            title: 'DISABLED';
            description: 'media content will not be scanned';
            const: 0;
          },
          {
            title: 'MEMBERS_WITHOUT_ROLES';
            description: 'media content sent by members without roles will be scanned';
            const: 1;
          },
          {
            title: 'ALL_MEMBERS';
            description: 'media content sent by all members will be scanned';
            const: 2;
          },
        ];
        format: 'int32';
      };
      GuildFeatures: {
        type: 'string';
        oneOf: [
          {
            title: 'ANIMATED_BANNER';
            description: 'guild has access to set an animated guild banner image';
            const: 'ANIMATED_BANNER';
          },
          {
            title: 'ANIMATED_ICON';
            description: 'guild has access to set an animated guild icon';
            const: 'ANIMATED_ICON';
          },
          {
            title: 'APPLICATION_COMMAND_PERMISSIONS_V2';
            description: 'guild is using the old permissions configuration behavior';
            const: 'APPLICATION_COMMAND_PERMISSIONS_V2';
          },
          {
            title: 'AUTO_MODERATION';
            description: 'guild has set up auto moderation rules';
            const: 'AUTO_MODERATION';
          },
          {
            title: 'BANNER';
            description: 'guild has access to set a guild banner image';
            const: 'BANNER';
          },
          {
            title: 'COMMUNITY';
            description: 'guild can enable welcome screen, Membership Screening, stage channels and discovery, and             receives community updates';
            const: 'COMMUNITY';
          },
          {
            title: 'CREATOR_MONETIZABLE_PROVISIONAL';
            description: 'guild has enabled monetization';
            const: 'CREATOR_MONETIZABLE_PROVISIONAL';
          },
          {
            title: 'CREATOR_STORE_PAGE';
            description: 'guild has enabled the role subscription promo page';
            const: 'CREATOR_STORE_PAGE';
          },
          {
            title: 'DEVELOPER_SUPPORT_SERVER';
            description: 'guild has been set as a support server on the App Directory';
            const: 'DEVELOPER_SUPPORT_SERVER';
          },
          {
            title: 'DISCOVERABLE';
            description: 'guild is able to be discovered in the directory';
            const: 'DISCOVERABLE';
          },
          {
            title: 'FEATURABLE';
            description: 'guild is able to be featured in the directory';
            const: 'FEATURABLE';
          },
          {
            title: 'INVITES_DISABLED';
            description: 'guild has paused invites, preventing new users from joining';
            const: 'INVITES_DISABLED';
          },
          {
            title: 'INVITE_SPLASH';
            description: 'guild has access to set an invite splash background';
            const: 'INVITE_SPLASH';
          },
          {
            title: 'MEMBER_VERIFICATION_GATE_ENABLED';
            description: 'guild has enabled Membership Screening';
            const: 'MEMBER_VERIFICATION_GATE_ENABLED';
          },
          {
            title: 'MORE_STICKERS';
            description: 'guild has increased custom sticker slots';
            const: 'MORE_STICKERS';
          },
          {
            title: 'NEWS';
            description: 'guild has access to create announcement channels';
            const: 'NEWS';
          },
          {
            title: 'PARTNERED';
            description: 'guild is partnered';
            const: 'PARTNERED';
          },
          {
            title: 'PREVIEW_ENABLED';
            description: 'guild can be previewed before joining via Membership Screening or the directory';
            const: 'PREVIEW_ENABLED';
          },
          {
            title: 'RAID_ALERTS_DISABLED';
            description: 'guild has disabled activity alerts in the configured safety alerts channel';
            const: 'RAID_ALERTS_DISABLED';
          },
          {
            title: 'ROLE_ICONS';
            description: 'guild is able to set role icons';
            const: 'ROLE_ICONS';
          },
          {
            title: 'ROLE_SUBSCRIPTIONS_AVAILABLE_FOR_PURCHASE';
            description: 'guild has role subscriptions that can be purchased';
            const: 'ROLE_SUBSCRIPTIONS_AVAILABLE_FOR_PURCHASE';
          },
          {
            title: 'ROLE_SUBSCRIPTIONS_ENABLED';
            description: 'guild has enabled role subscriptions';
            const: 'ROLE_SUBSCRIPTIONS_ENABLED';
          },
          {
            title: 'TICKETED_EVENTS_ENABLED';
            description: 'guild has enabled ticketed events';
            const: 'TICKETED_EVENTS_ENABLED';
          },
          {
            title: 'VANITY_URL';
            description: 'guild has access to set a vanity URL';
            const: 'VANITY_URL';
          },
          {
            title: 'VERIFIED';
            description: 'guild is verified';
            const: 'VERIFIED';
          },
          {
            title: 'VIP_REGIONS';
            description: 'guild has access to set 384kbps bitrate in voice (previously VIP voice servers)';
            const: 'VIP_REGIONS';
          },
          {
            title: 'WELCOME_SCREEN_ENABLED';
            description: 'guild has enabled the welcome screen';
            const: 'WELCOME_SCREEN_ENABLED';
          },
        ];
      };
      GuildHomeSettingsResponse: {
        type: 'object';
        properties: {
          guild_id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          enabled: {
            type: 'boolean';
          };
          welcome_message: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/WelcomeMessageResponse';
              },
            ];
          };
          new_member_actions: {
            type: ['array', 'null'];
            items: {
              oneOf: [
                {
                  type: 'null';
                },
                {
                  $ref: '#/components/schemas/NewMemberActionResponse';
                },
              ];
            };
          };
          resource_channels: {
            type: ['array', 'null'];
            items: {
              oneOf: [
                {
                  type: 'null';
                },
                {
                  $ref: '#/components/schemas/ResourceChannelResponse';
                },
              ];
            };
          };
        };
        required: ['guild_id', 'enabled'];
      };
      GuildIncomingWebhookResponse: {
        type: 'object';
        properties: {
          application_id: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/SnowflakeType';
              },
            ];
          };
          avatar: {
            type: ['string', 'null'];
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
          guild_id: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/SnowflakeType';
              },
            ];
          };
          id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          name: {
            type: 'string';
          };
          type: {
            type: 'integer';
            enum: [1];
            allOf: [
              {
                $ref: '#/components/schemas/WebhookTypes';
              },
            ];
            format: 'int32';
          };
          user: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/UserResponse';
              },
            ];
          };
          token: {
            type: ['string', 'null'];
          };
          url: {
            type: ['string', 'null'];
            format: 'uri';
          };
        };
        required: ['id', 'name', 'type'];
      };
      GuildInviteResponse: {
        type: 'object';
        properties: {
          type: {
            oneOf: [
              {
                type: 'null';
              },
              {
                type: 'integer';
                enum: [0];
                allOf: [
                  {
                    $ref: '#/components/schemas/InviteTypes';
                  },
                ];
                format: 'int32';
              },
            ];
          };
          code: {
            type: 'string';
          };
          inviter: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/UserResponse';
              },
            ];
          };
          max_age: {
            type: ['integer', 'null'];
            format: 'int32';
          };
          created_at: {
            type: ['string', 'null'];
            format: 'date-time';
          };
          expires_at: {
            type: ['string', 'null'];
            format: 'date-time';
          };
          is_contact: {
            type: ['boolean', 'null'];
          };
          flags: {
            type: ['integer', 'null'];
            format: 'int32';
          };
          guild: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/InviteGuildResponse';
              },
            ];
          };
          guild_id: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/SnowflakeType';
              },
            ];
          };
          channel: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/InviteChannelResponse';
              },
            ];
          };
          stage_instance: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/InviteStageInstanceResponse';
              },
            ];
          };
          target_type: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/InviteTargetTypes';
              },
            ];
          };
          target_user: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/UserResponse';
              },
            ];
          };
          target_application: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/InviteApplicationResponse';
              },
            ];
          };
          guild_scheduled_event: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/ScheduledEventResponse';
              },
            ];
          };
          uses: {
            type: ['integer', 'null'];
            format: 'int32';
          };
          max_uses: {
            type: ['integer', 'null'];
            format: 'int32';
          };
          temporary: {
            type: ['boolean', 'null'];
          };
          approximate_member_count: {
            type: ['integer', 'null'];
            format: 'int32';
          };
          approximate_presence_count: {
            type: ['integer', 'null'];
            format: 'int32';
          };
        };
        required: ['code'];
      };
      GuildMFALevel: {
        type: 'integer';
        oneOf: [
          {
            title: 'NONE';
            description: 'Guild has no MFA/2FA requirement for moderation actions';
            const: 0;
          },
          {
            title: 'ELEVATED';
            description: 'Guild has a 2FA requirement for moderation actions';
            const: 1;
          },
        ];
        format: 'int32';
      };
      GuildMFALevelResponse: {
        type: 'object';
        properties: {
          level: {
            $ref: '#/components/schemas/GuildMFALevel';
          };
        };
        required: ['level'];
      };
      GuildMemberResponse: {
        type: 'object';
        properties: {
          avatar: {
            type: ['string', 'null'];
          };
          communication_disabled_until: {
            type: ['string', 'null'];
            format: 'date-time';
          };
          flags: {
            type: 'integer';
            format: 'int32';
          };
          joined_at: {
            type: 'string';
            format: 'date-time';
          };
          nick: {
            type: ['string', 'null'];
          };
          pending: {
            type: 'boolean';
          };
          premium_since: {
            type: ['string', 'null'];
            format: 'date-time';
          };
          roles: {
            type: 'array';
            items: {
              $ref: '#/components/schemas/SnowflakeType';
            };
            uniqueItems: true;
          };
          user: {
            $ref: '#/components/schemas/UserResponse';
          };
          mute: {
            type: 'boolean';
          };
          deaf: {
            type: 'boolean';
          };
        };
        required: ['flags', 'joined_at', 'pending', 'roles', 'user', 'mute', 'deaf'];
      };
      GuildNSFWContentLevel: {
        type: 'integer';
        oneOf: [
          {
            title: 'DEFAULT';
            const: 0;
          },
          {
            title: 'EXPLICIT';
            const: 1;
          },
          {
            title: 'SAFE';
            const: 2;
          },
          {
            title: 'AGE_RESTRICTED';
            const: 3;
          },
        ];
        format: 'int32';
      };
      GuildOnboardingMode: {
        type: 'integer';
        oneOf: [
          {
            title: 'ONBOARDING_DEFAULT';
            description: 'Only Default Channels considered in constraints';
            const: 0;
          },
          {
            title: 'ONBOARDING_ADVANCED';
            description: 'Default Channels and Onboarding Prompts considered in constraints';
            const: 1;
          },
        ];
        format: 'int32';
      };
      GuildOnboardingResponse: {
        type: 'object';
        properties: {
          guild_id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          prompts: {
            type: 'array';
            items: {
              $ref: '#/components/schemas/OnboardingPromptResponse';
            };
          };
          default_channel_ids: {
            type: 'array';
            items: {
              $ref: '#/components/schemas/SnowflakeType';
            };
            uniqueItems: true;
          };
          enabled: {
            type: 'boolean';
          };
        };
        required: ['guild_id', 'prompts', 'default_channel_ids', 'enabled'];
      };
      GuildPatchRequestPartial: {
        type: 'object';
        properties: {
          name: {
            type: 'string';
            minLength: 2;
            maxLength: 100;
          };
          description: {
            type: ['string', 'null'];
            minLength: 0;
            maxLength: 1024;
          };
          region: {
            type: ['string', 'null'];
          };
          icon: {
            type: ['string', 'null'];
            contentEncoding: 'base64';
          };
          verification_level: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/VerificationLevels';
              },
            ];
          };
          default_message_notifications: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/UserNotificationSettings';
              },
            ];
          };
          explicit_content_filter: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/GuildExplicitContentFilterTypes';
              },
            ];
          };
          preferred_locale: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/AvailableLocalesEnum';
              },
            ];
          };
          afk_timeout: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/AfkTimeouts';
              },
            ];
          };
          afk_channel_id: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/SnowflakeType';
              },
            ];
          };
          system_channel_id: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/SnowflakeType';
              },
            ];
          };
          owner_id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          splash: {
            type: ['string', 'null'];
            contentEncoding: 'base64';
          };
          banner: {
            type: ['string', 'null'];
            contentEncoding: 'base64';
          };
          system_channel_flags: {
            type: ['integer', 'null'];
          };
          features: {
            type: ['array', 'null'];
            items: {
              type: ['string', 'null'];
              maxLength: 152133;
            };
            maxItems: 1521;
            uniqueItems: true;
          };
          discovery_splash: {
            type: ['string', 'null'];
            contentEncoding: 'base64';
          };
          home_header: {
            type: ['string', 'null'];
            contentEncoding: 'base64';
          };
          rules_channel_id: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/SnowflakeType';
              },
            ];
          };
          safety_alerts_channel_id: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/SnowflakeType';
              },
            ];
          };
          public_updates_channel_id: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/SnowflakeType';
              },
            ];
          };
          premium_progress_bar_enabled: {
            type: ['boolean', 'null'];
          };
        };
      };
      GuildPreviewResponse: {
        type: 'object';
        properties: {
          id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          name: {
            type: 'string';
          };
          icon: {
            type: ['string', 'null'];
          };
          description: {
            type: ['string', 'null'];
          };
          home_header: {
            type: ['string', 'null'];
          };
          splash: {
            type: ['string', 'null'];
          };
          discovery_splash: {
            type: ['string', 'null'];
          };
          features: {
            type: 'array';
            items: {
              $ref: '#/components/schemas/GuildFeatures';
            };
            uniqueItems: true;
          };
          approximate_member_count: {
            type: 'integer';
            format: 'int32';
          };
          approximate_presence_count: {
            type: 'integer';
            format: 'int32';
          };
          emojis: {
            type: 'array';
            items: {
              $ref: '#/components/schemas/EmojiResponse';
            };
          };
          stickers: {
            type: 'array';
            items: {
              $ref: '#/components/schemas/GuildStickerResponse';
            };
          };
        };
        required: [
          'id',
          'name',
          'features',
          'approximate_member_count',
          'approximate_presence_count',
          'emojis',
          'stickers',
        ];
      };
      GuildProductPurchaseResponse: {
        type: 'object';
        properties: {
          listing_id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          product_name: {
            type: 'string';
          };
        };
        required: ['listing_id', 'product_name'];
      };
      GuildPruneResponse: {
        type: 'object';
        properties: {
          pruned: {
            type: ['integer', 'null'];
            format: 'int32';
          };
        };
      };
      GuildResponse: {
        type: 'object';
        properties: {
          id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          name: {
            type: 'string';
          };
          icon: {
            type: ['string', 'null'];
          };
          description: {
            type: ['string', 'null'];
          };
          home_header: {
            type: ['string', 'null'];
          };
          splash: {
            type: ['string', 'null'];
          };
          discovery_splash: {
            type: ['string', 'null'];
          };
          features: {
            type: 'array';
            items: {
              $ref: '#/components/schemas/GuildFeatures';
            };
            uniqueItems: true;
          };
          banner: {
            type: ['string', 'null'];
          };
          owner_id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          application_id: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/SnowflakeType';
              },
            ];
          };
          region: {
            type: 'string';
          };
          afk_channel_id: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/SnowflakeType';
              },
            ];
          };
          afk_timeout: {
            $ref: '#/components/schemas/AfkTimeouts';
          };
          system_channel_id: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/SnowflakeType';
              },
            ];
          };
          system_channel_flags: {
            type: 'integer';
            format: 'int32';
          };
          widget_enabled: {
            type: 'boolean';
          };
          widget_channel_id: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/SnowflakeType';
              },
            ];
          };
          verification_level: {
            $ref: '#/components/schemas/VerificationLevels';
          };
          roles: {
            type: 'array';
            items: {
              $ref: '#/components/schemas/GuildRoleResponse';
            };
          };
          default_message_notifications: {
            $ref: '#/components/schemas/UserNotificationSettings';
          };
          mfa_level: {
            $ref: '#/components/schemas/GuildMFALevel';
          };
          explicit_content_filter: {
            $ref: '#/components/schemas/GuildExplicitContentFilterTypes';
          };
          max_presences: {
            type: ['integer', 'null'];
            format: 'int32';
          };
          max_members: {
            type: ['integer', 'null'];
            format: 'int32';
          };
          max_stage_video_channel_users: {
            type: ['integer', 'null'];
            format: 'int32';
          };
          max_video_channel_users: {
            type: ['integer', 'null'];
            format: 'int32';
          };
          vanity_url_code: {
            type: ['string', 'null'];
          };
          premium_tier: {
            $ref: '#/components/schemas/PremiumGuildTiers';
          };
          premium_subscription_count: {
            type: 'integer';
            format: 'int32';
          };
          preferred_locale: {
            $ref: '#/components/schemas/AvailableLocalesEnum';
          };
          rules_channel_id: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/SnowflakeType';
              },
            ];
          };
          safety_alerts_channel_id: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/SnowflakeType';
              },
            ];
          };
          public_updates_channel_id: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/SnowflakeType';
              },
            ];
          };
          premium_progress_bar_enabled: {
            type: 'boolean';
          };
          nsfw: {
            type: 'boolean';
          };
          nsfw_level: {
            $ref: '#/components/schemas/GuildNSFWContentLevel';
          };
          emojis: {
            type: 'array';
            items: {
              $ref: '#/components/schemas/EmojiResponse';
            };
          };
          stickers: {
            type: 'array';
            items: {
              $ref: '#/components/schemas/GuildStickerResponse';
            };
          };
        };
        required: [
          'id',
          'name',
          'features',
          'owner_id',
          'region',
          'afk_timeout',
          'system_channel_flags',
          'widget_enabled',
          'verification_level',
          'roles',
          'default_message_notifications',
          'mfa_level',
          'explicit_content_filter',
          'premium_tier',
          'premium_subscription_count',
          'preferred_locale',
          'premium_progress_bar_enabled',
          'nsfw',
          'nsfw_level',
          'emojis',
          'stickers',
        ];
      };
      GuildRoleResponse: {
        type: 'object';
        properties: {
          id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          name: {
            type: 'string';
          };
          description: {
            type: ['string', 'null'];
          };
          permissions: {
            type: 'string';
          };
          position: {
            type: 'integer';
            format: 'int32';
          };
          color: {
            type: 'integer';
            format: 'int32';
          };
          hoist: {
            type: 'boolean';
          };
          managed: {
            type: 'boolean';
          };
          mentionable: {
            type: 'boolean';
          };
          icon: {
            type: ['string', 'null'];
          };
          unicode_emoji: {
            type: ['string', 'null'];
          };
          tags: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/GuildRoleTagsResponse';
              },
            ];
          };
        };
        required: ['id', 'name', 'permissions', 'position', 'color', 'hoist', 'managed', 'mentionable'];
      };
      GuildRoleTagsResponse: {
        type: 'object';
        properties: {
          premium_subscriber: {
            type: 'null';
          };
          bot_id: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/SnowflakeType';
              },
            ];
          };
          integration_id: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/SnowflakeType';
              },
            ];
          };
          subscription_listing_id: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/SnowflakeType';
              },
            ];
          };
          available_for_purchase: {
            type: 'null';
          };
          guild_connections: {
            type: 'null';
          };
        };
      };
      GuildScheduledEventEntityTypes: {
        type: 'integer';
        oneOf: [
          {
            title: 'NONE';
            const: 0;
          },
          {
            title: 'STAGE_INSTANCE';
            const: 1;
          },
          {
            title: 'VOICE';
            const: 2;
          },
          {
            title: 'EXTERNAL';
            const: 3;
          },
        ];
        format: 'int32';
      };
      GuildScheduledEventPrivacyLevels: {
        type: 'integer';
        oneOf: [
          {
            title: 'GUILD_ONLY';
            description: 'the scheduled event is only accessible to guild members';
            const: 2;
          },
        ];
        format: 'int32';
      };
      GuildScheduledEventStatuses: {
        type: 'integer';
        oneOf: [
          {
            title: 'SCHEDULED';
            const: 1;
          },
          {
            title: 'ACTIVE';
            const: 2;
          },
          {
            title: 'COMPLETED';
            const: 3;
          },
          {
            title: 'CANCELED';
            const: 4;
          },
        ];
        format: 'int32';
      };
      GuildStickerResponse: {
        type: 'object';
        properties: {
          id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          name: {
            type: 'string';
          };
          tags: {
            type: 'string';
          };
          type: {
            type: 'integer';
            enum: [2];
            allOf: [
              {
                $ref: '#/components/schemas/StickerTypes';
              },
            ];
            format: 'int32';
          };
          format_type: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/StickerFormatTypes';
              },
            ];
          };
          description: {
            type: ['string', 'null'];
          };
          available: {
            type: 'boolean';
          };
          guild_id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          user: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/UserResponse';
              },
            ];
          };
        };
        required: ['id', 'name', 'tags', 'type', 'available', 'guild_id'];
      };
      GuildSubscriptionIntegrationResponse: {
        type: 'object';
        properties: {
          type: {
            type: 'string';
            enum: ['guild_subscription'];
            allOf: [
              {
                $ref: '#/components/schemas/IntegrationTypes';
              },
            ];
          };
          name: {
            type: ['string', 'null'];
          };
          account: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/AccountResponse';
              },
            ];
          };
          enabled: {
            type: ['boolean', 'null'];
          };
          id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
        };
        required: ['type', 'id'];
      };
      GuildTemplateChannelResponse: {
        type: 'object';
        properties: {
          id: {
            type: ['integer', 'null'];
            format: 'int32';
          };
          type: {
            type: 'integer';
            enum: [0, 2, 4];
            allOf: [
              {
                $ref: '#/components/schemas/ChannelTypes';
              },
            ];
            format: 'int32';
          };
          name: {
            type: ['string', 'null'];
          };
          position: {
            type: ['integer', 'null'];
            format: 'int32';
          };
          topic: {
            type: ['string', 'null'];
          };
          bitrate: {
            type: 'integer';
            format: 'int32';
          };
          user_limit: {
            type: 'integer';
            format: 'int32';
          };
          nsfw: {
            type: 'boolean';
          };
          rate_limit_per_user: {
            type: 'integer';
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
          default_auto_archive_duration: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/ThreadAutoArchiveDuration';
              },
            ];
          };
          permission_overwrites: {
            type: 'array';
            items: {
              oneOf: [
                {
                  type: 'null';
                },
                {
                  $ref: '#/components/schemas/ChannelPermissionOverwriteResponse';
                },
              ];
            };
          };
          available_tags: {
            type: ['array', 'null'];
            items: {
              $ref: '#/components/schemas/GuildTemplateChannelTags';
            };
          };
          template: {
            type: 'string';
          };
          default_reaction_emoji: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/DefaultReactionEmojiResponse';
              },
            ];
          };
          default_thread_rate_limit_per_user: {
            type: ['integer', 'null'];
            format: 'int32';
          };
          default_sort_order: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/ThreadSortOrder';
              },
            ];
          };
          default_forum_layout: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/ForumLayout';
              },
            ];
          };
          icon_emoji: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/IconEmojiResponse';
              },
            ];
          };
          theme_color: {
            type: ['integer', 'null'];
            format: 'int32';
          };
        };
        required: ['type', 'bitrate', 'user_limit', 'nsfw', 'rate_limit_per_user', 'permission_overwrites', 'template'];
      };
      GuildTemplateChannelTags: {
        type: 'object';
        properties: {
          name: {
            type: 'string';
          };
          emoji_id: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/SnowflakeType';
              },
            ];
          };
          emoji_name: {
            type: ['string', 'null'];
          };
          moderated: {
            type: ['boolean', 'null'];
          };
        };
        required: ['name'];
      };
      GuildTemplateResponse: {
        type: 'object';
        properties: {
          code: {
            type: 'string';
          };
          name: {
            type: 'string';
          };
          description: {
            type: ['string', 'null'];
          };
          usage_count: {
            type: 'integer';
            format: 'int32';
          };
          creator_id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          creator: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/UserResponse';
              },
            ];
          };
          created_at: {
            type: 'string';
            format: 'date-time';
          };
          updated_at: {
            type: 'string';
            format: 'date-time';
          };
          source_guild_id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          serialized_source_guild: {
            $ref: '#/components/schemas/GuildTemplateSnapshotResponse';
          };
          is_dirty: {
            type: ['boolean', 'null'];
          };
        };
        required: [
          'code',
          'name',
          'usage_count',
          'creator_id',
          'created_at',
          'updated_at',
          'source_guild_id',
          'serialized_source_guild',
        ];
      };
      GuildTemplateRoleResponse: {
        type: 'object';
        properties: {
          id: {
            type: 'integer';
            format: 'int32';
          };
          name: {
            type: 'string';
          };
          permissions: {
            type: 'string';
          };
          color: {
            type: 'integer';
            format: 'int32';
          };
          hoist: {
            type: 'boolean';
          };
          mentionable: {
            type: 'boolean';
          };
          icon: {
            type: ['string', 'null'];
          };
          unicode_emoji: {
            type: ['string', 'null'];
          };
        };
        required: ['id', 'name', 'permissions', 'color', 'hoist', 'mentionable'];
      };
      GuildTemplateSnapshotResponse: {
        type: 'object';
        properties: {
          name: {
            type: 'string';
          };
          description: {
            type: ['string', 'null'];
          };
          region: {
            type: ['string', 'null'];
          };
          verification_level: {
            $ref: '#/components/schemas/VerificationLevels';
          };
          default_message_notifications: {
            $ref: '#/components/schemas/UserNotificationSettings';
          };
          explicit_content_filter: {
            $ref: '#/components/schemas/GuildExplicitContentFilterTypes';
          };
          preferred_locale: {
            $ref: '#/components/schemas/AvailableLocalesEnum';
          };
          afk_channel_id: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/SnowflakeType';
              },
            ];
          };
          afk_timeout: {
            $ref: '#/components/schemas/AfkTimeouts';
          };
          system_channel_id: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/SnowflakeType';
              },
            ];
          };
          system_channel_flags: {
            type: 'integer';
            format: 'int32';
          };
          roles: {
            type: 'array';
            items: {
              $ref: '#/components/schemas/GuildTemplateRoleResponse';
            };
          };
          channels: {
            type: 'array';
            items: {
              $ref: '#/components/schemas/GuildTemplateChannelResponse';
            };
          };
        };
        required: [
          'name',
          'verification_level',
          'default_message_notifications',
          'explicit_content_filter',
          'preferred_locale',
          'afk_timeout',
          'system_channel_flags',
          'roles',
          'channels',
        ];
      };
      GuildWelcomeChannel: {
        type: 'object';
        properties: {
          channel_id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          description: {
            type: 'string';
            minLength: 1;
            maxLength: 50;
          };
          emoji_id: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/SnowflakeType';
              },
            ];
          };
          emoji_name: {
            type: ['string', 'null'];
            maxLength: 152133;
          };
        };
        required: ['channel_id', 'description'];
      };
      GuildWelcomeScreenChannelResponse: {
        type: 'object';
        properties: {
          channel_id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          description: {
            type: 'string';
          };
          emoji_id: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/SnowflakeType';
              },
            ];
          };
          emoji_name: {
            type: ['string', 'null'];
          };
        };
        required: ['channel_id', 'description'];
      };
      GuildWelcomeScreenResponse: {
        type: 'object';
        properties: {
          description: {
            type: ['string', 'null'];
          };
          welcome_channels: {
            type: 'array';
            items: {
              $ref: '#/components/schemas/GuildWelcomeScreenChannelResponse';
            };
          };
        };
        required: ['welcome_channels'];
      };
      GuildWithCountsResponse: {
        type: 'object';
        properties: {
          id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          name: {
            type: 'string';
          };
          icon: {
            type: ['string', 'null'];
          };
          description: {
            type: ['string', 'null'];
          };
          home_header: {
            type: ['string', 'null'];
          };
          splash: {
            type: ['string', 'null'];
          };
          discovery_splash: {
            type: ['string', 'null'];
          };
          features: {
            type: 'array';
            items: {
              $ref: '#/components/schemas/GuildFeatures';
            };
            uniqueItems: true;
          };
          banner: {
            type: ['string', 'null'];
          };
          owner_id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          application_id: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/SnowflakeType';
              },
            ];
          };
          region: {
            type: 'string';
          };
          afk_channel_id: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/SnowflakeType';
              },
            ];
          };
          afk_timeout: {
            $ref: '#/components/schemas/AfkTimeouts';
          };
          system_channel_id: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/SnowflakeType';
              },
            ];
          };
          system_channel_flags: {
            type: 'integer';
            format: 'int32';
          };
          widget_enabled: {
            type: 'boolean';
          };
          widget_channel_id: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/SnowflakeType';
              },
            ];
          };
          verification_level: {
            $ref: '#/components/schemas/VerificationLevels';
          };
          roles: {
            type: 'array';
            items: {
              $ref: '#/components/schemas/GuildRoleResponse';
            };
          };
          default_message_notifications: {
            $ref: '#/components/schemas/UserNotificationSettings';
          };
          mfa_level: {
            $ref: '#/components/schemas/GuildMFALevel';
          };
          explicit_content_filter: {
            $ref: '#/components/schemas/GuildExplicitContentFilterTypes';
          };
          max_presences: {
            type: ['integer', 'null'];
            format: 'int32';
          };
          max_members: {
            type: ['integer', 'null'];
            format: 'int32';
          };
          max_stage_video_channel_users: {
            type: ['integer', 'null'];
            format: 'int32';
          };
          max_video_channel_users: {
            type: ['integer', 'null'];
            format: 'int32';
          };
          vanity_url_code: {
            type: ['string', 'null'];
          };
          premium_tier: {
            $ref: '#/components/schemas/PremiumGuildTiers';
          };
          premium_subscription_count: {
            type: 'integer';
            format: 'int32';
          };
          preferred_locale: {
            $ref: '#/components/schemas/AvailableLocalesEnum';
          };
          rules_channel_id: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/SnowflakeType';
              },
            ];
          };
          safety_alerts_channel_id: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/SnowflakeType';
              },
            ];
          };
          public_updates_channel_id: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/SnowflakeType';
              },
            ];
          };
          premium_progress_bar_enabled: {
            type: 'boolean';
          };
          nsfw: {
            type: 'boolean';
          };
          nsfw_level: {
            $ref: '#/components/schemas/GuildNSFWContentLevel';
          };
          emojis: {
            type: 'array';
            items: {
              $ref: '#/components/schemas/EmojiResponse';
            };
          };
          stickers: {
            type: 'array';
            items: {
              $ref: '#/components/schemas/GuildStickerResponse';
            };
          };
          approximate_member_count: {
            type: ['integer', 'null'];
            format: 'int32';
          };
          approximate_presence_count: {
            type: ['integer', 'null'];
            format: 'int32';
          };
        };
        required: [
          'id',
          'name',
          'features',
          'owner_id',
          'region',
          'afk_timeout',
          'system_channel_flags',
          'widget_enabled',
          'verification_level',
          'roles',
          'default_message_notifications',
          'mfa_level',
          'explicit_content_filter',
          'premium_tier',
          'premium_subscription_count',
          'preferred_locale',
          'premium_progress_bar_enabled',
          'nsfw',
          'nsfw_level',
          'emojis',
          'stickers',
        ];
      };
      IconEmojiResponse: {
        type: 'object';
        properties: {};
      };
      IncomingWebhookInteractionRequest: {
        type: 'object';
        properties: {
          content: {
            type: ['string', 'null'];
            maxLength: 2000;
          };
          embeds: {
            type: ['array', 'null'];
            items: {
              $ref: '#/components/schemas/RichEmbed';
            };
            maxItems: 10;
          };
          allowed_mentions: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/MessageAllowedMentionsRequest';
              },
            ];
          };
          components: {
            type: ['array', 'null'];
            items: {
              oneOf: [
                {
                  $ref: '#/components/schemas/ActionRow';
                },
                {
                  $ref: '#/components/schemas/Button';
                },
                {
                  $ref: '#/components/schemas/ChannelSelect';
                },
                {
                  $ref: '#/components/schemas/MentionableSelect';
                },
                {
                  $ref: '#/components/schemas/RoleSelect';
                },
                {
                  $ref: '#/components/schemas/StringSelect';
                },
                {
                  $ref: '#/components/schemas/UserSelect';
                },
              ];
            };
            maxItems: 5;
          };
          attachments: {
            type: ['array', 'null'];
            items: {
              $ref: '#/components/schemas/MessageAttachmentRequest';
            };
            maxItems: 10;
          };
          tts: {
            type: ['boolean', 'null'];
          };
          flags: {
            type: ['integer', 'null'];
          };
        };
      };
      IncomingWebhookRequestPartial: {
        type: 'object';
        properties: {
          content: {
            type: ['string', 'null'];
            maxLength: 2000;
          };
          embeds: {
            type: ['array', 'null'];
            items: {
              $ref: '#/components/schemas/RichEmbed';
            };
            maxItems: 10;
          };
          allowed_mentions: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/MessageAllowedMentionsRequest';
              },
            ];
          };
          components: {
            type: ['array', 'null'];
            items: {
              oneOf: [
                {
                  $ref: '#/components/schemas/ActionRow';
                },
                {
                  $ref: '#/components/schemas/Button';
                },
                {
                  $ref: '#/components/schemas/ChannelSelect';
                },
                {
                  $ref: '#/components/schemas/MentionableSelect';
                },
                {
                  $ref: '#/components/schemas/RoleSelect';
                },
                {
                  $ref: '#/components/schemas/StringSelect';
                },
                {
                  $ref: '#/components/schemas/UserSelect';
                },
              ];
            };
            maxItems: 5;
          };
          attachments: {
            type: ['array', 'null'];
            items: {
              $ref: '#/components/schemas/MessageAttachmentRequest';
            };
            maxItems: 10;
          };
          tts: {
            type: ['boolean', 'null'];
          };
          flags: {
            type: ['integer', 'null'];
          };
          username: {
            type: ['string', 'null'];
            minLength: 1;
            maxLength: 80;
          };
          avatar_url: {
            type: ['string', 'null'];
            maxLength: 2048;
            format: 'uri';
          };
          thread_name: {
            type: ['string', 'null'];
            minLength: 0;
            maxLength: 100;
          };
          applied_tags: {
            type: ['array', 'null'];
            items: {
              $ref: '#/components/schemas/SnowflakeType';
            };
            maxItems: 5;
          };
        };
      };
      IncomingWebhookUpdateForInteractionCallbackRequestPartial: {
        type: 'object';
        properties: {
          content: {
            type: ['string', 'null'];
            maxLength: 2000;
          };
          embeds: {
            type: ['array', 'null'];
            items: {
              $ref: '#/components/schemas/RichEmbed';
            };
            maxItems: 10;
          };
          allowed_mentions: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/MessageAllowedMentionsRequest';
              },
            ];
          };
          components: {
            type: ['array', 'null'];
            items: {
              oneOf: [
                {
                  $ref: '#/components/schemas/ActionRow';
                },
                {
                  $ref: '#/components/schemas/Button';
                },
                {
                  $ref: '#/components/schemas/ChannelSelect';
                },
                {
                  $ref: '#/components/schemas/MentionableSelect';
                },
                {
                  $ref: '#/components/schemas/RoleSelect';
                },
                {
                  $ref: '#/components/schemas/StringSelect';
                },
                {
                  $ref: '#/components/schemas/UserSelect';
                },
              ];
            };
            maxItems: 5;
          };
          attachments: {
            type: ['array', 'null'];
            items: {
              $ref: '#/components/schemas/MessageAttachmentRequest';
            };
            maxItems: 10;
          };
          flags: {
            type: ['integer', 'null'];
          };
        };
      };
      IncomingWebhookUpdateRequestPartial: {
        type: 'object';
        properties: {
          content: {
            type: ['string', 'null'];
            maxLength: 2000;
          };
          embeds: {
            type: ['array', 'null'];
            items: {
              $ref: '#/components/schemas/RichEmbed';
            };
            maxItems: 10;
          };
          allowed_mentions: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/MessageAllowedMentionsRequest';
              },
            ];
          };
          components: {
            type: ['array', 'null'];
            items: {
              oneOf: [
                {
                  $ref: '#/components/schemas/ActionRow';
                },
                {
                  $ref: '#/components/schemas/Button';
                },
                {
                  $ref: '#/components/schemas/ChannelSelect';
                },
                {
                  $ref: '#/components/schemas/MentionableSelect';
                },
                {
                  $ref: '#/components/schemas/RoleSelect';
                },
                {
                  $ref: '#/components/schemas/StringSelect';
                },
                {
                  $ref: '#/components/schemas/UserSelect';
                },
              ];
            };
            maxItems: 5;
          };
          attachments: {
            type: ['array', 'null'];
            items: {
              $ref: '#/components/schemas/MessageAttachmentRequest';
            };
            maxItems: 10;
          };
          flags: {
            type: ['integer', 'null'];
          };
        };
      };
      InputText: {
        type: 'object';
        properties: {
          type: {
            type: 'integer';
            enum: [4];
            allOf: [
              {
                $ref: '#/components/schemas/MessageComponentTypes';
              },
            ];
            format: 'int32';
          };
          custom_id: {
            type: 'string';
            maxLength: 100;
          };
          style: {
            $ref: '#/components/schemas/TextStyleTypes';
          };
          label: {
            type: 'string';
            maxLength: 45;
          };
          value: {
            type: ['string', 'null'];
            maxLength: 4000;
          };
          placeholder: {
            type: ['string', 'null'];
            maxLength: 100;
          };
          required: {
            type: ['boolean', 'null'];
          };
          min_length: {
            type: ['integer', 'null'];
            minimum: 0;
            maximum: 4000;
          };
          max_length: {
            type: ['integer', 'null'];
            minimum: 1;
            maximum: 4000;
          };
        };
        required: ['type', 'custom_id', 'style', 'label'];
      };
      Int53Type: {
        type: 'integer';
        minimum: -9007199254740991;
        maximum: 9007199254740991;
        format: 'int64';
      };
      IntegrationApplicationResponse: {
        type: 'object';
        properties: {
          id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          name: {
            type: 'string';
          };
          icon: {
            type: ['string', 'null'];
          };
          description: {
            type: 'string';
          };
          type: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/ApplicationTypes';
              },
            ];
          };
          cover_image: {
            type: ['string', 'null'];
          };
          primary_sku_id: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/SnowflakeType';
              },
            ];
          };
          bot: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/UserResponse';
              },
            ];
          };
        };
        required: ['id', 'name', 'description'];
      };
      IntegrationExpireBehaviorTypes: {
        type: 'integer';
        oneOf: [
          {
            title: 'REMOVE_ROLE';
            description: 'Remove role';
            const: 0;
          },
          {
            title: 'KICK';
            description: 'Kick';
            const: 1;
          },
        ];
        format: 'int32';
      };
      IntegrationExpireGracePeriodTypes: {
        type: 'integer';
        oneOf: [
          {
            title: 'ONE_DAY';
            description: '1 day';
            const: 1;
          },
          {
            title: 'THREE_DAYS';
            description: '3 days';
            const: 3;
          },
          {
            title: 'SEVEN_DAYS';
            description: '7 days';
            const: 7;
          },
          {
            title: 'FOURTEEN_DAYS';
            description: '14 days';
            const: 14;
          },
          {
            title: 'THIRTY_DAYS';
            description: '30 days';
            const: 30;
          },
        ];
        format: 'int32';
      };
      IntegrationTypes: {
        type: 'string';
        oneOf: [
          {
            title: 'DISCORD';
            const: 'discord';
          },
          {
            title: 'TWITCH';
            const: 'twitch';
          },
          {
            title: 'YOUTUBE';
            const: 'youtube';
          },
          {
            title: 'GUILD_SUBSCRIPTION';
            const: 'guild_subscription';
          },
        ];
      };
      InteractionApplicationCommandAutocompleteCallbackIntegerData: {
        type: 'object';
        properties: {
          choices: {
            type: ['array', 'null'];
            items: {
              oneOf: [
                {
                  type: 'null';
                },
                {
                  $ref: '#/components/schemas/ApplicationCommandOptionIntegerChoice';
                },
              ];
            };
            maxItems: 25;
          };
        };
      };
      InteractionApplicationCommandAutocompleteCallbackNumberData: {
        type: 'object';
        properties: {
          choices: {
            type: ['array', 'null'];
            items: {
              oneOf: [
                {
                  type: 'null';
                },
                {
                  $ref: '#/components/schemas/ApplicationCommandOptionNumberChoice';
                },
              ];
            };
            maxItems: 25;
          };
        };
      };
      InteractionApplicationCommandAutocompleteCallbackStringData: {
        type: 'object';
        properties: {
          choices: {
            type: ['array', 'null'];
            items: {
              oneOf: [
                {
                  type: 'null';
                },
                {
                  $ref: '#/components/schemas/ApplicationCommandOptionStringChoice';
                },
              ];
            };
            maxItems: 25;
          };
        };
      };
      InteractionCallbackTypes: {
        type: 'integer';
        oneOf: [
          {
            title: 'PONG';
            const: 1;
          },
          {
            title: 'CHANNEL_MESSAGE_WITH_SOURCE';
            const: 4;
          },
          {
            title: 'DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE';
            const: 5;
          },
          {
            title: 'DEFERRED_UPDATE_MESSAGE';
            const: 6;
          },
          {
            title: 'UPDATE_MESSAGE';
            const: 7;
          },
          {
            title: 'APPLICATION_COMMAND_AUTOCOMPLETE_RESULT';
            const: 8;
          },
          {
            title: 'MODAL';
            const: 9;
          },
        ];
        format: 'int32';
      };
      InteractionTypes: {
        type: 'integer';
        oneOf: [
          {
            title: 'PING';
            description: "Sent by Discord to validate your application's interaction handler";
            const: 1;
          },
          {
            title: 'APPLICATION_COMMAND';
            description: 'Sent when a user uses an application command';
            const: 2;
          },
          {
            title: 'MESSAGE_COMPONENT';
            description: 'Sent when a user interacts with a message component previously sent by your application';
            const: 3;
          },
          {
            title: 'APPLICATION_COMMAND_AUTOCOMPLETE';
            description: 'Sent when a user is filling in an autocomplete option in a chat command';
            const: 4;
          },
          {
            title: 'MODAL_SUBMIT';
            description: 'Sent when a user submits a modal previously sent by your application';
            const: 5;
          },
        ];
        format: 'int32';
      };
      InviteApplicationResponse: {
        type: 'object';
        properties: {
          id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          name: {
            type: 'string';
          };
          icon: {
            type: ['string', 'null'];
          };
          description: {
            type: 'string';
          };
          type: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/ApplicationTypes';
              },
            ];
          };
          cover_image: {
            type: ['string', 'null'];
          };
          primary_sku_id: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/SnowflakeType';
              },
            ];
          };
          bot: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/UserResponse';
              },
            ];
          };
          slug: {
            type: ['string', 'null'];
          };
          guild_id: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/SnowflakeType';
              },
            ];
          };
          rpc_origins: {
            type: ['array', 'null'];
            items: {
              type: ['string', 'null'];
            };
          };
          bot_public: {
            type: ['boolean', 'null'];
          };
          bot_require_code_grant: {
            type: ['boolean', 'null'];
          };
          terms_of_service_url: {
            type: ['string', 'null'];
            format: 'uri';
          };
          privacy_policy_url: {
            type: ['string', 'null'];
            format: 'uri';
          };
          custom_install_url: {
            type: ['string', 'null'];
            format: 'uri';
          };
          install_params: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/ApplicationOAuth2ParamsResponse';
              },
            ];
          };
          verify_key: {
            type: 'string';
          };
          flags: {
            type: 'integer';
            format: 'int32';
          };
          max_participants: {
            type: ['integer', 'null'];
            format: 'int32';
          };
          tags: {
            type: ['array', 'null'];
            items: {
              type: 'string';
            };
            uniqueItems: true;
          };
        };
        required: ['id', 'name', 'description', 'verify_key', 'flags'];
      };
      InviteChannelRecipientResponse: {
        type: 'object';
        properties: {
          username: {
            type: 'string';
          };
        };
        required: ['username'];
      };
      InviteChannelResponse: {
        type: 'object';
        properties: {
          id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          type: {
            $ref: '#/components/schemas/ChannelTypes';
          };
          name: {
            type: ['string', 'null'];
          };
          icon: {
            type: ['string', 'null'];
          };
          recipients: {
            type: ['array', 'null'];
            items: {
              $ref: '#/components/schemas/InviteChannelRecipientResponse';
            };
          };
        };
        required: ['id', 'type'];
      };
      InviteGuildResponse: {
        type: 'object';
        properties: {
          id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          name: {
            type: 'string';
          };
          splash: {
            type: ['string', 'null'];
          };
          banner: {
            type: ['string', 'null'];
          };
          description: {
            type: ['string', 'null'];
          };
          icon: {
            type: ['string', 'null'];
          };
          features: {
            type: 'array';
            items: {
              $ref: '#/components/schemas/GuildFeatures';
            };
            uniqueItems: true;
          };
          verification_level: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/VerificationLevels';
              },
            ];
          };
          vanity_url_code: {
            type: ['string', 'null'];
          };
          nsfw_level: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/GuildNSFWContentLevel';
              },
            ];
          };
          nsfw: {
            type: ['boolean', 'null'];
          };
          premium_subscription_count: {
            type: ['integer', 'null'];
            format: 'int32';
          };
        };
        required: ['id', 'name', 'features'];
      };
      InviteStageInstanceResponse: {
        type: 'object';
        properties: {
          topic: {
            type: 'string';
          };
          participant_count: {
            type: ['integer', 'null'];
            format: 'int32';
          };
          speaker_count: {
            type: ['integer', 'null'];
            format: 'int32';
          };
          members: {
            type: ['array', 'null'];
            items: {
              $ref: '#/components/schemas/GuildMemberResponse';
            };
          };
        };
        required: ['topic'];
      };
      InviteTargetTypes: {
        type: 'integer';
        oneOf: [
          {
            title: 'STREAM';
            const: 1;
          },
          {
            title: 'EMBEDDED_APPLICATION';
            const: 2;
          },
          {
            title: 'ROLE_SUBSCRIPTIONS_PURCHASE';
            const: 3;
          },
        ];
        format: 'int32';
      };
      InviteTypes: {
        type: 'integer';
        oneOf: [
          {
            title: 'GUILD';
            const: 0;
          },
          {
            title: 'GROUP_DM';
            const: 1;
          },
          {
            title: 'FRIEND';
            const: 2;
          },
        ];
        format: 'int32';
      };
      KeywordRuleResponse: {
        type: 'object';
        properties: {
          id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          guild_id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          creator_id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          name: {
            type: 'string';
          };
          event_type: {
            $ref: '#/components/schemas/AutomodEventType';
          };
          actions: {
            type: 'array';
            items: {
              oneOf: [
                {
                  $ref: '#/components/schemas/BlockMessageActionResponse';
                },
                {
                  $ref: '#/components/schemas/FlagToChannelActionResponse';
                },
                {
                  $ref: '#/components/schemas/QuarantineUserActionResponse';
                },
                {
                  $ref: '#/components/schemas/UserCommunicationDisabledActionResponse';
                },
              ];
            };
          };
          trigger_type: {
            type: 'integer';
            enum: [1];
            allOf: [
              {
                $ref: '#/components/schemas/AutomodTriggerType';
              },
            ];
            format: 'int32';
          };
          enabled: {
            type: ['boolean', 'null'];
          };
          exempt_roles: {
            type: ['array', 'null'];
            items: {
              $ref: '#/components/schemas/SnowflakeType';
            };
            uniqueItems: true;
          };
          exempt_channels: {
            type: ['array', 'null'];
            items: {
              $ref: '#/components/schemas/SnowflakeType';
            };
            uniqueItems: true;
          };
          trigger_metadata: {
            $ref: '#/components/schemas/KeywordTriggerMetadataResponse';
          };
        };
        required: ['id', 'guild_id', 'creator_id', 'name', 'event_type', 'actions', 'trigger_type', 'trigger_metadata'];
      };
      KeywordTriggerMetadata: {
        type: 'object';
        properties: {
          keyword_filter: {
            type: ['array', 'null'];
            items: {
              type: 'string';
              minLength: 1;
              maxLength: 60;
            };
            maxItems: 1000;
          };
          regex_patterns: {
            type: ['array', 'null'];
            items: {
              type: 'string';
              minLength: 1;
              maxLength: 260;
            };
            maxItems: 10;
          };
          allow_list: {
            type: ['array', 'null'];
            items: {
              type: 'string';
              minLength: 1;
              maxLength: 60;
            };
            maxItems: 100;
          };
        };
      };
      KeywordTriggerMetadataResponse: {
        type: 'object';
        properties: {
          keyword_filter: {
            type: 'array';
            items: {
              type: 'string';
            };
          };
          regex_patterns: {
            type: 'array';
            items: {
              type: 'string';
            };
          };
          allow_list: {
            type: 'array';
            items: {
              type: 'string';
            };
          };
        };
        required: ['keyword_filter', 'regex_patterns', 'allow_list'];
      };
      KeywordUpsertRequest: {
        type: 'object';
        properties: {
          name: {
            type: 'string';
            maxLength: 100;
          };
          event_type: {
            $ref: '#/components/schemas/AutomodEventType';
          };
          actions: {
            type: ['array', 'null'];
            items: {
              oneOf: [
                {
                  $ref: '#/components/schemas/BlockMessageAction';
                },
                {
                  $ref: '#/components/schemas/FlagToChannelAction';
                },
                {
                  $ref: '#/components/schemas/QuarantineUserAction';
                },
                {
                  $ref: '#/components/schemas/UserCommunicationDisabledAction';
                },
              ];
            };
            minItems: 1;
            maxItems: 5;
          };
          enabled: {
            type: ['boolean', 'null'];
          };
          exempt_roles: {
            type: ['array', 'null'];
            items: {
              $ref: '#/components/schemas/SnowflakeType';
            };
            maxItems: 20;
            uniqueItems: true;
          };
          exempt_channels: {
            type: ['array', 'null'];
            items: {
              $ref: '#/components/schemas/SnowflakeType';
            };
            maxItems: 50;
            uniqueItems: true;
          };
          trigger_type: {
            type: 'integer';
            enum: [1];
            allOf: [
              {
                $ref: '#/components/schemas/AutomodTriggerType';
              },
            ];
            format: 'int32';
          };
          trigger_metadata: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/KeywordTriggerMetadata';
              },
            ];
          };
        };
        required: ['name', 'event_type', 'trigger_type'];
      };
      KeywordUpsertRequestPartial: {
        type: 'object';
        properties: {
          name: {
            type: 'string';
            maxLength: 100;
          };
          event_type: {
            $ref: '#/components/schemas/AutomodEventType';
          };
          actions: {
            type: ['array', 'null'];
            items: {
              oneOf: [
                {
                  $ref: '#/components/schemas/BlockMessageAction';
                },
                {
                  $ref: '#/components/schemas/FlagToChannelAction';
                },
                {
                  $ref: '#/components/schemas/QuarantineUserAction';
                },
                {
                  $ref: '#/components/schemas/UserCommunicationDisabledAction';
                },
              ];
            };
            minItems: 1;
            maxItems: 5;
          };
          enabled: {
            type: ['boolean', 'null'];
          };
          exempt_roles: {
            type: ['array', 'null'];
            items: {
              $ref: '#/components/schemas/SnowflakeType';
            };
            maxItems: 20;
            uniqueItems: true;
          };
          exempt_channels: {
            type: ['array', 'null'];
            items: {
              $ref: '#/components/schemas/SnowflakeType';
            };
            maxItems: 50;
            uniqueItems: true;
          };
          trigger_type: {
            type: 'integer';
            enum: [1];
            allOf: [
              {
                $ref: '#/components/schemas/AutomodTriggerType';
              },
            ];
            format: 'int32';
          };
          trigger_metadata: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/KeywordTriggerMetadata';
              },
            ];
          };
        };
      };
      MLSpamRuleResponse: {
        type: 'object';
        properties: {
          id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          guild_id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          creator_id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          name: {
            type: 'string';
          };
          event_type: {
            $ref: '#/components/schemas/AutomodEventType';
          };
          actions: {
            type: 'array';
            items: {
              oneOf: [
                {
                  $ref: '#/components/schemas/BlockMessageActionResponse';
                },
                {
                  $ref: '#/components/schemas/FlagToChannelActionResponse';
                },
                {
                  $ref: '#/components/schemas/QuarantineUserActionResponse';
                },
                {
                  $ref: '#/components/schemas/UserCommunicationDisabledActionResponse';
                },
              ];
            };
          };
          trigger_type: {
            type: 'integer';
            enum: [3];
            allOf: [
              {
                $ref: '#/components/schemas/AutomodTriggerType';
              },
            ];
            format: 'int32';
          };
          enabled: {
            type: ['boolean', 'null'];
          };
          exempt_roles: {
            type: ['array', 'null'];
            items: {
              $ref: '#/components/schemas/SnowflakeType';
            };
            uniqueItems: true;
          };
          exempt_channels: {
            type: ['array', 'null'];
            items: {
              $ref: '#/components/schemas/SnowflakeType';
            };
            uniqueItems: true;
          };
          trigger_metadata: {
            $ref: '#/components/schemas/MLSpamTriggerMetadataResponse';
          };
        };
        required: ['id', 'guild_id', 'creator_id', 'name', 'event_type', 'actions', 'trigger_type', 'trigger_metadata'];
      };
      MLSpamTriggerMetadata: {
        type: 'object';
        properties: {};
      };
      MLSpamTriggerMetadataResponse: {
        type: 'object';
        properties: {};
      };
      MLSpamUpsertRequest: {
        type: 'object';
        properties: {
          name: {
            type: 'string';
            maxLength: 100;
          };
          event_type: {
            $ref: '#/components/schemas/AutomodEventType';
          };
          actions: {
            type: ['array', 'null'];
            items: {
              oneOf: [
                {
                  $ref: '#/components/schemas/BlockMessageAction';
                },
                {
                  $ref: '#/components/schemas/FlagToChannelAction';
                },
                {
                  $ref: '#/components/schemas/QuarantineUserAction';
                },
                {
                  $ref: '#/components/schemas/UserCommunicationDisabledAction';
                },
              ];
            };
            minItems: 1;
            maxItems: 5;
          };
          enabled: {
            type: ['boolean', 'null'];
          };
          exempt_roles: {
            type: ['array', 'null'];
            items: {
              $ref: '#/components/schemas/SnowflakeType';
            };
            maxItems: 20;
            uniqueItems: true;
          };
          exempt_channels: {
            type: ['array', 'null'];
            items: {
              $ref: '#/components/schemas/SnowflakeType';
            };
            maxItems: 50;
            uniqueItems: true;
          };
          trigger_type: {
            type: 'integer';
            enum: [3];
            allOf: [
              {
                $ref: '#/components/schemas/AutomodTriggerType';
              },
            ];
            format: 'int32';
          };
          trigger_metadata: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/MLSpamTriggerMetadata';
              },
            ];
          };
        };
        required: ['name', 'event_type', 'trigger_type'];
      };
      MLSpamUpsertRequestPartial: {
        type: 'object';
        properties: {
          name: {
            type: 'string';
            maxLength: 100;
          };
          event_type: {
            $ref: '#/components/schemas/AutomodEventType';
          };
          actions: {
            type: ['array', 'null'];
            items: {
              oneOf: [
                {
                  $ref: '#/components/schemas/BlockMessageAction';
                },
                {
                  $ref: '#/components/schemas/FlagToChannelAction';
                },
                {
                  $ref: '#/components/schemas/QuarantineUserAction';
                },
                {
                  $ref: '#/components/schemas/UserCommunicationDisabledAction';
                },
              ];
            };
            minItems: 1;
            maxItems: 5;
          };
          enabled: {
            type: ['boolean', 'null'];
          };
          exempt_roles: {
            type: ['array', 'null'];
            items: {
              $ref: '#/components/schemas/SnowflakeType';
            };
            maxItems: 20;
            uniqueItems: true;
          };
          exempt_channels: {
            type: ['array', 'null'];
            items: {
              $ref: '#/components/schemas/SnowflakeType';
            };
            maxItems: 50;
            uniqueItems: true;
          };
          trigger_type: {
            type: 'integer';
            enum: [3];
            allOf: [
              {
                $ref: '#/components/schemas/AutomodTriggerType';
              },
            ];
            format: 'int32';
          };
          trigger_metadata: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/MLSpamTriggerMetadata';
              },
            ];
          };
        };
      };
      MentionSpamRuleResponse: {
        type: 'object';
        properties: {
          id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          guild_id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          creator_id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          name: {
            type: 'string';
          };
          event_type: {
            $ref: '#/components/schemas/AutomodEventType';
          };
          actions: {
            type: 'array';
            items: {
              oneOf: [
                {
                  $ref: '#/components/schemas/BlockMessageActionResponse';
                },
                {
                  $ref: '#/components/schemas/FlagToChannelActionResponse';
                },
                {
                  $ref: '#/components/schemas/QuarantineUserActionResponse';
                },
                {
                  $ref: '#/components/schemas/UserCommunicationDisabledActionResponse';
                },
              ];
            };
          };
          trigger_type: {
            type: 'integer';
            enum: [5];
            allOf: [
              {
                $ref: '#/components/schemas/AutomodTriggerType';
              },
            ];
            format: 'int32';
          };
          enabled: {
            type: ['boolean', 'null'];
          };
          exempt_roles: {
            type: ['array', 'null'];
            items: {
              $ref: '#/components/schemas/SnowflakeType';
            };
            uniqueItems: true;
          };
          exempt_channels: {
            type: ['array', 'null'];
            items: {
              $ref: '#/components/schemas/SnowflakeType';
            };
            uniqueItems: true;
          };
          trigger_metadata: {
            $ref: '#/components/schemas/MentionSpamTriggerMetadataResponse';
          };
        };
        required: ['id', 'guild_id', 'creator_id', 'name', 'event_type', 'actions', 'trigger_type', 'trigger_metadata'];
      };
      MentionSpamTriggerMetadata: {
        type: 'object';
        properties: {
          mention_total_limit: {
            type: 'integer';
            minimum: 0;
            maximum: 50;
          };
          mention_raid_protection_enabled: {
            type: ['boolean', 'null'];
          };
        };
        required: ['mention_total_limit'];
      };
      MentionSpamTriggerMetadataResponse: {
        type: 'object';
        properties: {
          mention_total_limit: {
            type: 'integer';
            format: 'int32';
          };
        };
        required: ['mention_total_limit'];
      };
      MentionSpamUpsertRequest: {
        type: 'object';
        properties: {
          name: {
            type: 'string';
            maxLength: 100;
          };
          event_type: {
            $ref: '#/components/schemas/AutomodEventType';
          };
          actions: {
            type: ['array', 'null'];
            items: {
              oneOf: [
                {
                  $ref: '#/components/schemas/BlockMessageAction';
                },
                {
                  $ref: '#/components/schemas/FlagToChannelAction';
                },
                {
                  $ref: '#/components/schemas/QuarantineUserAction';
                },
                {
                  $ref: '#/components/schemas/UserCommunicationDisabledAction';
                },
              ];
            };
            minItems: 1;
            maxItems: 5;
          };
          enabled: {
            type: ['boolean', 'null'];
          };
          exempt_roles: {
            type: ['array', 'null'];
            items: {
              $ref: '#/components/schemas/SnowflakeType';
            };
            maxItems: 20;
            uniqueItems: true;
          };
          exempt_channels: {
            type: ['array', 'null'];
            items: {
              $ref: '#/components/schemas/SnowflakeType';
            };
            maxItems: 50;
            uniqueItems: true;
          };
          trigger_type: {
            type: 'integer';
            enum: [5];
            allOf: [
              {
                $ref: '#/components/schemas/AutomodTriggerType';
              },
            ];
            format: 'int32';
          };
          trigger_metadata: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/MentionSpamTriggerMetadata';
              },
            ];
          };
        };
        required: ['name', 'event_type', 'trigger_type'];
      };
      MentionSpamUpsertRequestPartial: {
        type: 'object';
        properties: {
          name: {
            type: 'string';
            maxLength: 100;
          };
          event_type: {
            $ref: '#/components/schemas/AutomodEventType';
          };
          actions: {
            type: ['array', 'null'];
            items: {
              oneOf: [
                {
                  $ref: '#/components/schemas/BlockMessageAction';
                },
                {
                  $ref: '#/components/schemas/FlagToChannelAction';
                },
                {
                  $ref: '#/components/schemas/QuarantineUserAction';
                },
                {
                  $ref: '#/components/schemas/UserCommunicationDisabledAction';
                },
              ];
            };
            minItems: 1;
            maxItems: 5;
          };
          enabled: {
            type: ['boolean', 'null'];
          };
          exempt_roles: {
            type: ['array', 'null'];
            items: {
              $ref: '#/components/schemas/SnowflakeType';
            };
            maxItems: 20;
            uniqueItems: true;
          };
          exempt_channels: {
            type: ['array', 'null'];
            items: {
              $ref: '#/components/schemas/SnowflakeType';
            };
            maxItems: 50;
            uniqueItems: true;
          };
          trigger_type: {
            type: 'integer';
            enum: [5];
            allOf: [
              {
                $ref: '#/components/schemas/AutomodTriggerType';
              },
            ];
            format: 'int32';
          };
          trigger_metadata: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/MentionSpamTriggerMetadata';
              },
            ];
          };
        };
      };
      MentionableSelect: {
        type: 'object';
        properties: {
          type: {
            type: 'integer';
            enum: [7];
            allOf: [
              {
                $ref: '#/components/schemas/MessageComponentTypes';
              },
            ];
            format: 'int32';
          };
          custom_id: {
            type: 'string';
            maxLength: 100;
          };
          placeholder: {
            type: ['string', 'null'];
            maxLength: 150;
          };
          min_values: {
            type: ['integer', 'null'];
            minimum: 0;
            maximum: 25;
          };
          max_values: {
            type: ['integer', 'null'];
            minimum: 1;
            maximum: 25;
          };
          disabled: {
            type: ['boolean', 'null'];
          };
          default_values: {
            type: ['array', 'null'];
            items: {};
            maxItems: 25;
          };
        };
        required: ['type', 'custom_id'];
      };
      MessageActivityResponse: {
        type: 'object';
        properties: {};
      };
      MessageAllowedMentionsRequest: {
        type: 'object';
        properties: {
          parse: {
            type: ['array', 'null'];
            items: {
              oneOf: [
                {
                  type: 'null';
                },
                {
                  $ref: '#/components/schemas/AllowedMentionTypes';
                },
              ];
            };
            maxItems: 1521;
            uniqueItems: true;
          };
          users: {
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
            maxItems: 100;
            uniqueItems: true;
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
            maxItems: 100;
            uniqueItems: true;
          };
          replied_user: {
            type: ['boolean', 'null'];
          };
        };
      };
      MessageAttachmentRequest: {
        type: 'object';
        properties: {
          id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          filename: {
            type: ['string', 'null'];
            maxLength: 1024;
          };
          description: {
            type: ['string', 'null'];
            maxLength: 1024;
          };
          is_remix: {
            type: ['boolean', 'null'];
          };
        };
        required: ['id'];
      };
      MessageAttachmentResponse: {
        type: 'object';
        properties: {
          id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          filename: {
            type: 'string';
          };
          size: {
            type: 'integer';
            format: 'int32';
          };
          url: {
            type: 'string';
            format: 'uri';
          };
          proxy_url: {
            type: 'string';
            format: 'uri';
          };
          width: {
            type: ['integer', 'null'];
            format: 'int32';
          };
          height: {
            type: ['integer', 'null'];
            format: 'int32';
          };
          duration_secs: {
            type: ['number', 'null'];
            format: 'double';
          };
          waveform: {
            type: ['string', 'null'];
          };
          description: {
            type: ['string', 'null'];
          };
          content_type: {
            type: ['string', 'null'];
          };
          ephemeral: {
            type: ['boolean', 'null'];
          };
          title: {
            type: ['string', 'null'];
          };
          application: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/ApplicationResponse';
              },
            ];
          };
          clip_created_at: {
            type: ['string', 'null'];
            format: 'date-time';
          };
          clip_participants: {
            type: ['array', 'null'];
            items: {
              $ref: '#/components/schemas/UserResponse';
            };
          };
        };
        required: ['id', 'filename', 'size', 'url', 'proxy_url'];
      };
      MessageComponentActionRowResponse: {
        type: 'object';
        properties: {
          type: {
            type: 'integer';
            enum: [1];
            allOf: [
              {
                $ref: '#/components/schemas/MessageComponentTypes';
              },
            ];
            format: 'int32';
          };
          components: {
            type: ['array', 'null'];
            items: {
              oneOf: [
                {
                  $ref: '#/components/schemas/MessageComponentButtonResponse';
                },
                {
                  $ref: '#/components/schemas/MessageComponentChannelSelectResponse';
                },
                {
                  $ref: '#/components/schemas/MessageComponentInputTextResponse';
                },
                {
                  $ref: '#/components/schemas/MessageComponentMentionableSelectResponse';
                },
                {
                  $ref: '#/components/schemas/MessageComponentRoleSelectResponse';
                },
                {
                  $ref: '#/components/schemas/MessageComponentStringSelectResponse';
                },
                {
                  $ref: '#/components/schemas/MessageComponentUserSelectResponse';
                },
              ];
            };
          };
        };
        required: ['type'];
      };
      MessageComponentButtonResponse: {
        type: 'object';
        properties: {
          type: {
            type: 'integer';
            enum: [2];
            allOf: [
              {
                $ref: '#/components/schemas/MessageComponentTypes';
              },
            ];
            format: 'int32';
          };
          custom_id: {
            type: ['string', 'null'];
          };
          style: {
            $ref: '#/components/schemas/ButtonStyleTypes';
          };
          label: {
            type: ['string', 'null'];
          };
          disabled: {
            type: ['boolean', 'null'];
          };
          emoji: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/MessageComponentEmojiResponse';
              },
            ];
          };
          url: {
            type: ['string', 'null'];
            maxLength: 2048;
            format: 'uri';
          };
        };
        required: ['type', 'style'];
      };
      MessageComponentChannelSelectResponse: {
        type: 'object';
        properties: {
          type: {
            type: 'integer';
            enum: [8];
            allOf: [
              {
                $ref: '#/components/schemas/MessageComponentTypes';
              },
            ];
            format: 'int32';
          };
          custom_id: {
            type: 'string';
          };
          placeholder: {
            type: ['string', 'null'];
          };
          min_values: {
            type: ['integer', 'null'];
            format: 'int32';
          };
          max_values: {
            type: ['integer', 'null'];
            format: 'int32';
          };
          disabled: {
            type: ['boolean', 'null'];
          };
          channel_types: {
            type: ['array', 'null'];
            items: {
              $ref: '#/components/schemas/ChannelTypes';
            };
            uniqueItems: true;
          };
        };
        required: ['type', 'custom_id'];
      };
      MessageComponentEmojiResponse: {
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
          name: {
            type: 'string';
          };
          animated: {
            type: ['boolean', 'null'];
          };
        };
        required: ['name'];
      };
      MessageComponentInputTextResponse: {
        type: 'object';
        properties: {
          type: {
            type: 'integer';
            enum: [4];
            allOf: [
              {
                $ref: '#/components/schemas/MessageComponentTypes';
              },
            ];
            format: 'int32';
          };
          custom_id: {
            type: 'string';
          };
          style: {
            $ref: '#/components/schemas/TextStyleTypes';
          };
          label: {
            type: ['string', 'null'];
          };
          value: {
            type: ['string', 'null'];
          };
          placeholder: {
            type: ['string', 'null'];
          };
          required: {
            type: ['boolean', 'null'];
          };
          min_length: {
            type: ['integer', 'null'];
            format: 'int32';
          };
          max_length: {
            type: ['integer', 'null'];
            format: 'int32';
          };
        };
        required: ['type', 'custom_id', 'style'];
      };
      MessageComponentMentionableSelectResponse: {
        type: 'object';
        properties: {
          type: {
            type: 'integer';
            enum: [7];
            allOf: [
              {
                $ref: '#/components/schemas/MessageComponentTypes';
              },
            ];
            format: 'int32';
          };
          custom_id: {
            type: 'string';
          };
          placeholder: {
            type: ['string', 'null'];
          };
          min_values: {
            type: ['integer', 'null'];
            format: 'int32';
          };
          max_values: {
            type: ['integer', 'null'];
            format: 'int32';
          };
          disabled: {
            type: ['boolean', 'null'];
          };
        };
        required: ['type', 'custom_id'];
      };
      MessageComponentRoleSelectResponse: {
        type: 'object';
        properties: {
          type: {
            type: 'integer';
            enum: [6];
            allOf: [
              {
                $ref: '#/components/schemas/MessageComponentTypes';
              },
            ];
            format: 'int32';
          };
          custom_id: {
            type: 'string';
          };
          placeholder: {
            type: ['string', 'null'];
          };
          min_values: {
            type: ['integer', 'null'];
            format: 'int32';
          };
          max_values: {
            type: ['integer', 'null'];
            format: 'int32';
          };
          disabled: {
            type: ['boolean', 'null'];
          };
        };
        required: ['type', 'custom_id'];
      };
      MessageComponentStringSelectResponse: {
        type: 'object';
        properties: {
          type: {
            type: 'integer';
            enum: [3];
            allOf: [
              {
                $ref: '#/components/schemas/MessageComponentTypes';
              },
            ];
            format: 'int32';
          };
          custom_id: {
            type: 'string';
          };
          placeholder: {
            type: ['string', 'null'];
          };
          min_values: {
            type: ['integer', 'null'];
            format: 'int32';
          };
          max_values: {
            type: ['integer', 'null'];
            format: 'int32';
          };
          disabled: {
            type: ['boolean', 'null'];
          };
          options: {
            type: ['array', 'null'];
            items: {
              oneOf: [
                {
                  type: 'null';
                },
                {
                  $ref: '#/components/schemas/SelectOptionResponse';
                },
              ];
            };
          };
        };
        required: ['type', 'custom_id'];
      };
      MessageComponentTypes: {
        type: 'integer';
        oneOf: [
          {
            title: 'ACTION_ROW';
            description: 'Container for other components';
            const: 1;
          },
          {
            title: 'BUTTON';
            description: 'Button object';
            const: 2;
          },
          {
            title: 'STRING_SELECT';
            description: 'Select menu for picking from defined text options';
            const: 3;
          },
          {
            title: 'INPUT_TEXT';
            description: 'Text input object';
            const: 4;
          },
          {
            title: 'USER_SELECT';
            description: 'Select menu for users';
            const: 5;
          },
          {
            title: 'ROLE_SELECT';
            description: 'Select menu for roles';
            const: 6;
          },
          {
            title: 'MENTIONABLE_SELECT';
            description: 'Select menu for mentionables (users and roles)';
            const: 7;
          },
          {
            title: 'CHANNEL_SELECT';
            description: 'Select menu for channels';
            const: 8;
          },
        ];
        format: 'int32';
      };
      MessageComponentUserSelectResponse: {
        type: 'object';
        properties: {
          type: {
            type: 'integer';
            enum: [5];
            allOf: [
              {
                $ref: '#/components/schemas/MessageComponentTypes';
              },
            ];
            format: 'int32';
          };
          custom_id: {
            type: 'string';
          };
          placeholder: {
            type: ['string', 'null'];
          };
          min_values: {
            type: ['integer', 'null'];
            format: 'int32';
          };
          max_values: {
            type: ['integer', 'null'];
            format: 'int32';
          };
          disabled: {
            type: ['boolean', 'null'];
          };
        };
        required: ['type', 'custom_id'];
      };
      MessageCreateRequest: {
        type: 'object';
        properties: {
          content: {
            type: ['string', 'null'];
            maxLength: 4000;
          };
          embeds: {
            type: ['array', 'null'];
            items: {
              $ref: '#/components/schemas/RichEmbed';
            };
            maxItems: 10;
          };
          allowed_mentions: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/MessageAllowedMentionsRequest';
              },
            ];
          };
          sticker_ids: {
            type: ['array', 'null'];
            items: {
              $ref: '#/components/schemas/SnowflakeType';
            };
            maxItems: 3;
          };
          components: {
            type: ['array', 'null'];
            items: {
              oneOf: [
                {
                  $ref: '#/components/schemas/ActionRow';
                },
                {
                  $ref: '#/components/schemas/Button';
                },
                {
                  $ref: '#/components/schemas/ChannelSelect';
                },
                {
                  $ref: '#/components/schemas/MentionableSelect';
                },
                {
                  $ref: '#/components/schemas/RoleSelect';
                },
                {
                  $ref: '#/components/schemas/StringSelect';
                },
                {
                  $ref: '#/components/schemas/UserSelect';
                },
              ];
            };
            maxItems: 5;
          };
          flags: {
            type: ['integer', 'null'];
          };
          attachments: {
            type: ['array', 'null'];
            items: {
              $ref: '#/components/schemas/MessageAttachmentRequest';
            };
            maxItems: 10;
          };
          message_reference: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/ReplyMessageReferenceRequest';
              },
            ];
          };
          nonce: {
            oneOf: [
              {
                type: 'integer';
                minimum: -9223372036854776000;
                maximum: 9223372036854776000;
                format: 'int64';
              },
              {
                type: 'string';
                maxLength: 25;
                format: 'nonce';
              },
              {
                type: 'null';
              },
            ];
          };
          tts: {
            type: ['boolean', 'null'];
          };
        };
      };
      MessageEditRequestPartial: {
        type: 'object';
        properties: {
          content: {
            type: ['string', 'null'];
            maxLength: 4000;
          };
          embeds: {
            type: ['array', 'null'];
            items: {
              $ref: '#/components/schemas/RichEmbed';
            };
            maxItems: 10;
          };
          flags: {
            type: ['integer', 'null'];
          };
          allowed_mentions: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/MessageAllowedMentionsRequest';
              },
            ];
          };
          sticker_ids: {
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
          };
          components: {
            type: ['array', 'null'];
            items: {
              oneOf: [
                {
                  $ref: '#/components/schemas/ActionRow';
                },
                {
                  $ref: '#/components/schemas/Button';
                },
                {
                  $ref: '#/components/schemas/ChannelSelect';
                },
                {
                  $ref: '#/components/schemas/MentionableSelect';
                },
                {
                  $ref: '#/components/schemas/RoleSelect';
                },
                {
                  $ref: '#/components/schemas/StringSelect';
                },
                {
                  $ref: '#/components/schemas/UserSelect';
                },
              ];
            };
            maxItems: 5;
          };
          attachments: {
            type: ['array', 'null'];
            items: {
              $ref: '#/components/schemas/MessageAttachmentRequest';
            };
            maxItems: 10;
          };
        };
      };
      MessageEmbedAuthorResponse: {
        type: 'object';
        properties: {
          name: {
            type: 'string';
          };
          url: {
            type: ['string', 'null'];
          };
          icon_url: {
            type: ['string', 'null'];
          };
          proxy_icon_url: {
            type: ['string', 'null'];
            format: 'uri';
          };
        };
        required: ['name'];
      };
      MessageEmbedFieldResponse: {
        type: 'object';
        properties: {
          name: {
            type: 'string';
          };
          value: {
            type: 'string';
          };
          inline: {
            type: 'boolean';
          };
        };
        required: ['name', 'value', 'inline'];
      };
      MessageEmbedFooterResponse: {
        type: 'object';
        properties: {
          text: {
            type: 'string';
          };
          icon_url: {
            type: ['string', 'null'];
          };
          proxy_icon_url: {
            type: ['string', 'null'];
            format: 'uri';
          };
        };
        required: ['text'];
      };
      MessageEmbedImageResponse: {
        type: 'object';
        properties: {
          url: {
            type: ['string', 'null'];
          };
          proxy_url: {
            type: ['string', 'null'];
            format: 'uri';
          };
          width: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/UInt32Type';
              },
            ];
          };
          height: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/UInt32Type';
              },
            ];
          };
          placeholder: {
            type: ['string', 'null'];
          };
          placeholder_version: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/UInt32Type';
              },
            ];
          };
        };
      };
      MessageEmbedProviderResponse: {
        type: 'object';
        properties: {
          name: {
            type: 'string';
          };
          url: {
            type: ['string', 'null'];
            format: 'uri';
          };
        };
        required: ['name'];
      };
      MessageEmbedResponse: {
        type: 'object';
        properties: {
          type: {
            type: 'string';
          };
          url: {
            type: ['string', 'null'];
            format: 'uri';
          };
          title: {
            type: ['string', 'null'];
          };
          description: {
            type: ['string', 'null'];
          };
          color: {
            type: ['integer', 'null'];
            format: 'int32';
          };
          timestamp: {
            type: ['string', 'null'];
            format: 'date-time';
          };
          fields: {
            type: ['array', 'null'];
            items: {
              $ref: '#/components/schemas/MessageEmbedFieldResponse';
            };
          };
          author: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/MessageEmbedAuthorResponse';
              },
            ];
          };
          provider: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/MessageEmbedProviderResponse';
              },
            ];
          };
          image: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/MessageEmbedImageResponse';
              },
            ];
          };
          thumbnail: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/MessageEmbedImageResponse';
              },
            ];
          };
          video: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/MessageEmbedVideoResponse';
              },
            ];
          };
          footer: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/MessageEmbedFooterResponse';
              },
            ];
          };
        };
        required: ['type'];
      };
      MessageEmbedVideoResponse: {
        type: 'object';
        properties: {
          url: {
            type: ['string', 'null'];
          };
          proxy_url: {
            type: ['string', 'null'];
            format: 'uri';
          };
          width: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/UInt32Type';
              },
            ];
          };
          height: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/UInt32Type';
              },
            ];
          };
          placeholder: {
            type: ['string', 'null'];
          };
          placeholder_version: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/UInt32Type';
              },
            ];
          };
        };
      };
      MessageInteractionResponse: {
        type: 'object';
        properties: {
          id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          type: {
            $ref: '#/components/schemas/InteractionTypes';
          };
          name: {
            type: 'string';
          };
          user: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/UserResponse';
              },
            ];
          };
          name_localized: {
            type: ['string', 'null'];
          };
        };
        required: ['id', 'type', 'name'];
      };
      MessageMentionChannelResponse: {
        type: 'object';
        properties: {
          id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          name: {
            type: 'string';
          };
          type: {
            $ref: '#/components/schemas/ChannelTypes';
          };
          guild_id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
        };
        required: ['id', 'name', 'type', 'guild_id'];
      };
      MessageReactionCountDetailsResponse: {
        type: 'object';
        properties: {
          burst: {
            type: 'integer';
            format: 'int32';
          };
          normal: {
            type: 'integer';
            format: 'int32';
          };
        };
        required: ['burst', 'normal'];
      };
      MessageReactionEmojiResponse: {
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
          name: {
            type: ['string', 'null'];
          };
          animated: {
            type: ['boolean', 'null'];
          };
        };
      };
      MessageReactionResponse: {
        type: 'object';
        properties: {
          emoji: {
            $ref: '#/components/schemas/MessageReactionEmojiResponse';
          };
          count: {
            type: 'integer';
            format: 'int32';
          };
          count_details: {
            $ref: '#/components/schemas/MessageReactionCountDetailsResponse';
          };
          burst_colors: {
            type: 'array';
            items: {
              type: 'string';
            };
          };
          me_burst: {
            type: 'boolean';
          };
          me: {
            type: 'boolean';
          };
        };
        required: ['emoji', 'count', 'count_details', 'burst_colors', 'me_burst', 'me'];
      };
      MessageReferenceResponse: {
        type: 'object';
        properties: {
          channel_id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          message_id: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/SnowflakeType';
              },
            ];
          };
          guild_id: {
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
        required: ['channel_id'];
      };
      MessageResponse: {
        type: 'object';
        properties: {
          id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          type: {
            $ref: '#/components/schemas/MessageType';
          };
          content: {
            type: 'string';
          };
          channel_id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          author: {
            $ref: '#/components/schemas/UserResponse';
          };
          attachments: {
            type: 'array';
            items: {
              $ref: '#/components/schemas/MessageAttachmentResponse';
            };
          };
          embeds: {
            type: 'array';
            items: {
              $ref: '#/components/schemas/MessageEmbedResponse';
            };
          };
          mentions: {
            type: 'array';
            items: {
              $ref: '#/components/schemas/UserResponse';
            };
          };
          mention_roles: {
            type: 'array';
            items: {
              $ref: '#/components/schemas/SnowflakeType';
            };
            uniqueItems: true;
          };
          pinned: {
            type: 'boolean';
          };
          mention_everyone: {
            type: 'boolean';
          };
          tts: {
            type: 'boolean';
          };
          timestamp: {
            type: 'string';
            format: 'date-time';
          };
          edited_timestamp: {
            type: ['string', 'null'];
            format: 'date-time';
          };
          flags: {
            type: 'integer';
            format: 'int32';
          };
          components: {
            type: 'array';
            items: {
              oneOf: [
                {
                  $ref: '#/components/schemas/MessageComponentActionRowResponse';
                },
                {
                  $ref: '#/components/schemas/MessageComponentButtonResponse';
                },
                {
                  $ref: '#/components/schemas/MessageComponentChannelSelectResponse';
                },
                {
                  $ref: '#/components/schemas/MessageComponentInputTextResponse';
                },
                {
                  $ref: '#/components/schemas/MessageComponentMentionableSelectResponse';
                },
                {
                  $ref: '#/components/schemas/MessageComponentRoleSelectResponse';
                },
                {
                  $ref: '#/components/schemas/MessageComponentStringSelectResponse';
                },
                {
                  $ref: '#/components/schemas/MessageComponentUserSelectResponse';
                },
              ];
            };
          };
          activity: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/MessageActivityResponse';
              },
            ];
          };
          application: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/BasicApplicationResponse';
              },
            ];
          };
          application_id: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/SnowflakeType';
              },
            ];
          };
          interaction: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/MessageInteractionResponse';
              },
            ];
          };
          nonce: {
            oneOf: [
              {
                type: 'integer';
                minimum: -9223372036854776000;
                maximum: 9223372036854776000;
                format: 'int64';
              },
              {
                type: 'string';
                maxLength: 25;
                format: 'nonce';
              },
              {
                type: 'null';
              },
            ];
          };
          webhook_id: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/SnowflakeType';
              },
            ];
          };
          message_reference: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/MessageReferenceResponse';
              },
            ];
          };
          thread: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/ThreadResponse';
              },
            ];
          };
          mention_channels: {
            type: ['array', 'null'];
            items: {
              oneOf: [
                {
                  type: 'null';
                },
                {
                  $ref: '#/components/schemas/MessageMentionChannelResponse';
                },
              ];
            };
          };
          stickers: {
            type: ['array', 'null'];
            items: {
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
          sticker_items: {
            type: ['array', 'null'];
            items: {
              $ref: '#/components/schemas/MessageStickerItemResponse';
            };
          };
          role_subscription_data: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/MessageRoleSubscriptionDataResponse';
              },
            ];
          };
          purchase_notification: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/PurchaseNotificationResponse';
              },
            ];
          };
          position: {
            type: ['integer', 'null'];
            format: 'int32';
          };
          resolved: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/ResolvedObjectsResponse';
              },
            ];
          };
          reactions: {
            type: ['array', 'null'];
            items: {
              $ref: '#/components/schemas/MessageReactionResponse';
            };
          };
          referenced_message: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/BasicMessageResponse';
              },
            ];
          };
        };
        required: [
          'id',
          'type',
          'content',
          'channel_id',
          'author',
          'attachments',
          'embeds',
          'mentions',
          'mention_roles',
          'pinned',
          'mention_everyone',
          'tts',
          'timestamp',
          'flags',
          'components',
        ];
      };
      MessageRoleSubscriptionDataResponse: {
        type: 'object';
        properties: {
          role_subscription_listing_id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          tier_name: {
            type: 'string';
          };
          total_months_subscribed: {
            type: 'integer';
            format: 'int32';
          };
          is_renewal: {
            type: 'boolean';
          };
        };
        required: ['role_subscription_listing_id', 'tier_name', 'total_months_subscribed', 'is_renewal'];
      };
      MessageStickerItemResponse: {
        type: 'object';
        properties: {
          id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          name: {
            type: 'string';
          };
          format_type: {
            $ref: '#/components/schemas/StickerFormatTypes';
          };
        };
        required: ['id', 'name', 'format_type'];
      };
      MessageType: {
        type: 'integer';
        oneOf: [
          {
            title: 'DEFAULT';
            description: '';
            const: 0;
          },
          {
            title: 'RECIPIENT_ADD';
            description: '';
            const: 1;
          },
          {
            title: 'RECIPIENT_REMOVE';
            description: '';
            const: 2;
          },
          {
            title: 'CALL';
            description: '';
            const: 3;
          },
          {
            title: 'CHANNEL_NAME_CHANGE';
            description: '';
            const: 4;
          },
          {
            title: 'CHANNEL_ICON_CHANGE';
            description: '';
            const: 5;
          },
          {
            title: 'CHANNEL_PINNED_MESSAGE';
            description: '';
            const: 6;
          },
          {
            title: 'USER_JOIN';
            description: '';
            const: 7;
          },
          {
            title: 'GUILD_BOOST';
            description: '';
            const: 8;
          },
          {
            title: 'GUILD_BOOST_TIER_1';
            description: '';
            const: 9;
          },
          {
            title: 'GUILD_BOOST_TIER_2';
            description: '';
            const: 10;
          },
          {
            title: 'GUILD_BOOST_TIER_3';
            description: '';
            const: 11;
          },
          {
            title: 'CHANNEL_FOLLOW_ADD';
            description: '';
            const: 12;
          },
          {
            title: 'GUILD_DISCOVERY_DISQUALIFIED';
            description: '';
            const: 14;
          },
          {
            title: 'GUILD_DISCOVERY_REQUALIFIED';
            description: '';
            const: 15;
          },
          {
            title: 'GUILD_DISCOVERY_GRACE_PERIOD_INITIAL_WARNING';
            description: '';
            const: 16;
          },
          {
            title: 'GUILD_DISCOVERY_GRACE_PERIOD_FINAL_WARNING';
            description: '';
            const: 17;
          },
          {
            title: 'THREAD_CREATED';
            description: '';
            const: 18;
          },
          {
            title: 'REPLY';
            description: '';
            const: 19;
          },
          {
            title: 'CHAT_INPUT_COMMAND';
            description: '';
            const: 20;
          },
          {
            title: 'THREAD_STARTER_MESSAGE';
            description: '';
            const: 21;
          },
          {
            title: 'GUILD_INVITE_REMINDER';
            description: '';
            const: 22;
          },
          {
            title: 'CONTEXT_MENU_COMMAND';
            description: '';
            const: 23;
          },
          {
            title: 'AUTO_MODERATION_ACTION';
            description: '';
            const: 24;
          },
          {
            title: 'ROLE_SUBSCRIPTION_PURCHASE';
            description: '';
            const: 25;
          },
          {
            title: 'INTERACTION_PREMIUM_UPSELL';
            description: '';
            const: 26;
          },
          {
            title: 'STAGE_START';
            description: '';
            const: 27;
          },
          {
            title: 'STAGE_END';
            description: '';
            const: 28;
          },
          {
            title: 'STAGE_SPEAKER';
            description: '';
            const: 29;
          },
          {
            title: 'STAGE_TOPIC';
            description: '';
            const: 31;
          },
          {
            title: 'GUILD_APPLICATION_PREMIUM_SUBSCRIPTION';
            description: '';
            const: 32;
          },
        ];
        format: 'int32';
      };
      MetadataItemTypes: {
        type: 'integer';
        oneOf: [
          {
            title: 'INTEGER_LESS_THAN_EQUAL';
            description: "the metadata value (integer) is less than or equal to the guild's configured value (integer)";
            const: 1;
          },
          {
            title: 'INTEGER_GREATER_THAN_EQUAL';
            description: "the metadata value (integer) is greater than or equal to the guild's configured value (integer)";
            const: 2;
          },
          {
            title: 'INTEGER_EQUAL';
            description: "the metadata value (integer) is equal to the guild's configured value (integer)";
            const: 3;
          },
          {
            title: 'INTEGER_NOT_EQUAL';
            description: "the metadata value (integer) is not equal to the guild's configured value (integer)";
            const: 4;
          },
          {
            title: 'DATETIME_LESS_THAN_EQUAL';
            description: "the metadata value (ISO8601 string) is less than or equal to the guild's configured value (integer; days before current date)";
            const: 5;
          },
          {
            title: 'DATETIME_GREATER_THAN_EQUAL';
            description: "the metadata value (ISO8601 string) is greater than or equal to the guild's configured value (integer; days before current date)";
            const: 6;
          },
          {
            title: 'BOOLEAN_EQUAL';
            description: "the metadata value (integer) is equal to the guild's configured value (integer; 1)";
            const: 7;
          },
          {
            title: 'BOOLEAN_NOT_EQUAL';
            description: "the metadata value (integer) is not equal to the guild's configured value (integer; 1)";
            const: 8;
          },
        ];
        format: 'int32';
      };
      ModalInteractionCallbackData: {
        type: 'object';
        properties: {
          custom_id: {
            type: 'string';
            maxLength: 100;
          };
          title: {
            type: 'string';
            maxLength: 45;
          };
          components: {
            type: 'array';
            items: {
              oneOf: [
                {
                  $ref: '#/components/schemas/ActionRow';
                },
                {
                  $ref: '#/components/schemas/InputText';
                },
              ];
            };
            minItems: 1;
            maxItems: 5;
          };
        };
        required: ['custom_id', 'title', 'components'];
      };
      ModalInteractionCallbackRequest: {
        type: 'object';
        properties: {
          type: {
            type: 'integer';
            enum: [9];
            allOf: [
              {
                $ref: '#/components/schemas/InteractionCallbackTypes';
              },
            ];
            format: 'int32';
          };
          data: {
            $ref: '#/components/schemas/ModalInteractionCallbackData';
          };
        };
        required: ['type', 'data'];
      };
      MyGuildResponse: {
        type: 'object';
        properties: {
          id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          name: {
            type: 'string';
          };
          icon: {
            type: ['string', 'null'];
          };
          owner: {
            type: 'boolean';
          };
          permissions: {
            type: 'string';
          };
          features: {
            type: 'array';
            items: {
              $ref: '#/components/schemas/GuildFeatures';
            };
            uniqueItems: true;
          };
          approximate_member_count: {
            type: ['integer', 'null'];
            format: 'int32';
          };
          approximate_presence_count: {
            type: ['integer', 'null'];
            format: 'int32';
          };
        };
        required: ['id', 'name', 'owner', 'permissions', 'features'];
      };
      NewMemberActionResponse: {
        type: 'object';
        properties: {
          channel_id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          action_type: {
            $ref: '#/components/schemas/NewMemberActionType';
          };
          title: {
            type: 'string';
          };
          description: {
            type: 'string';
          };
          emoji: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/SettingsEmojiResponse';
              },
            ];
          };
          icon: {
            type: ['string', 'null'];
          };
        };
        required: ['channel_id', 'action_type', 'title', 'description'];
      };
      NewMemberActionType: {
        type: 'integer';
        oneOf: [
          {
            title: 'VIEW';
            const: 0;
          },
          {
            title: 'TALK';
            const: 1;
          },
        ];
        format: 'int32';
      };
      OAuth2GetAuthorizationResponse: {
        type: 'object';
        properties: {
          application: {
            $ref: '#/components/schemas/ApplicationResponse';
          };
          expires: {
            type: 'string';
            format: 'date-time';
          };
          scopes: {
            type: 'array';
            items: {
              $ref: '#/components/schemas/OAuth2Scopes';
            };
            uniqueItems: true;
          };
          user: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/UserResponse';
              },
            ];
          };
        };
        required: ['application', 'expires', 'scopes'];
      };
      OAuth2Scopes: {
        type: 'string';
        oneOf: [
          {
            title: 'IDENTIFY';
            description: 'allows /users/@me without email';
            const: 'identify';
          },
          {
            title: 'EMAIL';
            description: 'enables /users/@me to return an email';
            const: 'email';
          },
          {
            title: 'CONNECTIONS';
            description: 'allows /users/@me/connections to return linked third-party accounts';
            const: 'connections';
          },
          {
            title: 'GUILDS';
            description: "allows /users/@me/guilds to return basic information about all of a user's guilds";
            const: 'guilds';
          },
          {
            title: 'GUILDS_JOIN';
            description: 'allows /guilds/{guild.id}/members/{user.id} to be used for joining users to a guild';
            const: 'guilds.join';
          },
          {
            title: 'GUILDS_MEMBERS_READ';
            description: "allows /users/@me/guilds/{guild.id}/member to return a user's member information in a guild";
            const: 'guilds.members.read';
          },
          {
            title: 'GDM_JOIN';
            description: 'allows your app to join users to a group dm';
            const: 'gdm.join';
          },
          {
            title: 'BOT';
            description: "for oauth2 bots, this puts the bot in the user's selected guild by default";
            const: 'bot';
          },
          {
            title: 'RPC';
            description: "for local rpc server access, this allows you to control a user's local Discord client - requires Discord approval";
            const: 'rpc';
          },
          {
            title: 'RPC_NOTIFICATIONS_READ';
            description: 'for local rpc server access, this allows you to receive notifications pushed out to the user - requires Discord approval';
            const: 'rpc.notifications.read';
          },
          {
            title: 'RPC_VOICE_READ';
            description: "for local rpc server access, this allows you to read a user's voice settings and listen for voice events - requires Discord approval";
            const: 'rpc.voice.read';
          },
          {
            title: 'RPC_VOICE_WRITE';
            description: "for local rpc server access, this allows you to update a user's voice settings - requires Discord approval";
            const: 'rpc.voice.write';
          },
          {
            title: 'RPC_VIDEO_READ';
            description: "for local rpc server access, this allows you to read a user's video status - requires Discord approval";
            const: 'rpc.video.read';
          },
          {
            title: 'RPC_VIDEO_WRITE';
            description: "for local rpc server access, this allows you to update a user's video settings - requires Discord approval";
            const: 'rpc.video.write';
          },
          {
            title: 'RPC_SCREENSHARE_READ';
            description: "for local rpc server access, this allows you to read a user's screenshare status- requires Discord approval";
            const: 'rpc.screenshare.read';
          },
          {
            title: 'RPC_SCREENSHARE_WRITE';
            description: "for local rpc server access, this allows you to update a user's screenshare settings- requires Discord approval";
            const: 'rpc.screenshare.write';
          },
          {
            title: 'RPC_ACTIVITIES_WRITE';
            description: "for local rpc server access, this allows you to update a user's activity - requires Discord approval";
            const: 'rpc.activities.write';
          },
          {
            title: 'WEBHOOK_INCOMING';
            description: 'this generates a webhook that is returned in the oauth token response for authorization code grants';
            const: 'webhook.incoming';
          },
          {
            title: 'MESSAGES_READ';
            description: 'for local rpc server api access, this allows you to read messages from all client channels (otherwise restricted to channels/guilds your app creates)';
            const: 'messages.read';
          },
          {
            title: 'APPLICATIONS_BUILDS_UPLOAD';
            description: "allows your app to upload/update builds for a user's applications - requires Discord approval";
            const: 'applications.builds.upload';
          },
          {
            title: 'APPLICATIONS_BUILDS_READ';
            description: "allows your app to read build data for a user's applications";
            const: 'applications.builds.read';
          },
          {
            title: 'APPLICATIONS_COMMANDS';
            description: 'allows your app to use commands in a guild';
            const: 'applications.commands';
          },
          {
            title: 'APPLICATIONS_COMMANDS_PERMISSIONS_UPDATE';
            description: 'allows your app to update permissions for its commands in a guild a user has permissions to';
            const: 'applications.commands.permissions.update';
          },
          {
            title: 'APPLICATIONS_COMMANDS_UPDATE';
            description: 'allows your app to update its commands using a Bearer token - client credentials grant only';
            const: 'applications.commands.update';
          },
          {
            title: 'APPLICATIONS_STORE_UPDATE';
            description: "allows your app to read and update store data (SKUs, store listings, achievements, etc.) for a user's applications";
            const: 'applications.store.update';
          },
          {
            title: 'APPLICATIONS_ENTITLEMENTS';
            description: "allows your app to read entitlements for a user's applications";
            const: 'applications.entitlements';
          },
          {
            title: 'ACTIVITIES_READ';
            description: 'allows your app to fetch data from a user\'s "Now Playing/Recently Played" list - requires Discord approval';
            const: 'activities.read';
          },
          {
            title: 'ACTIVITIES_WRITE';
            description: "allows your app to update a user's activity - requires Discord approval (NOT REQUIRED FOR GAMESDK ACTIVITY MANAGER)";
            const: 'activities.write';
          },
          {
            title: 'RELATIONSHIPS_READ';
            description: "allows your app to know a user's friends and implicit relationships - requires Discord approval";
            const: 'relationships.read';
          },
          {
            title: 'VOICE';
            description: "allows your app to connect to voice on user's behalf and see all the voice members - requires Discord approval";
            const: 'voice';
          },
          {
            title: 'DM_CHANNELS_READ';
            description: "allows your app to see information about the user's DMs and group DMs - requires Discord approval";
            const: 'dm_channels.read';
          },
          {
            title: 'ROLE_CONNECTIONS_WRITE';
            description: "allows your app to update a user's connection and metadata for the app";
            const: 'role_connections.write';
          },
        ];
      };
      OnboardingPromptOptionRequest: {
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
          title: {
            type: 'string';
            minLength: 1;
            maxLength: 50;
          };
          description: {
            type: ['string', 'null'];
            maxLength: 100;
          };
          emoji_id: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/SnowflakeType';
              },
            ];
          };
          emoji_name: {
            type: ['string', 'null'];
            maxLength: 100;
          };
          emoji_animated: {
            type: ['boolean', 'null'];
          };
          role_ids: {
            type: ['array', 'null'];
            items: {
              $ref: '#/components/schemas/SnowflakeType';
            };
            maxItems: 50;
            uniqueItems: true;
          };
          channel_ids: {
            type: ['array', 'null'];
            items: {
              $ref: '#/components/schemas/SnowflakeType';
            };
            maxItems: 50;
            uniqueItems: true;
          };
        };
        required: ['title'];
      };
      OnboardingPromptOptionResponse: {
        type: 'object';
        properties: {
          id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          title: {
            type: 'string';
          };
          description: {
            type: 'string';
          };
          emoji: {
            $ref: '#/components/schemas/SettingsEmojiResponse';
          };
          role_ids: {
            type: 'array';
            items: {
              $ref: '#/components/schemas/SnowflakeType';
            };
            uniqueItems: true;
          };
          channel_ids: {
            type: 'array';
            items: {
              $ref: '#/components/schemas/SnowflakeType';
            };
            uniqueItems: true;
          };
        };
        required: ['id', 'title', 'description', 'emoji', 'role_ids', 'channel_ids'];
      };
      OnboardingPromptResponse: {
        type: 'object';
        properties: {
          id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          title: {
            type: 'string';
          };
          options: {
            type: 'array';
            items: {
              $ref: '#/components/schemas/OnboardingPromptOptionResponse';
            };
          };
          single_select: {
            type: 'boolean';
          };
          required: {
            type: 'boolean';
          };
          in_onboarding: {
            type: 'boolean';
          };
          type: {
            $ref: '#/components/schemas/OnboardingPromptType';
          };
        };
        required: ['id', 'title', 'options', 'single_select', 'required', 'in_onboarding', 'type'];
      };
      OnboardingPromptType: {
        type: 'integer';
        oneOf: [
          {
            title: 'MULTIPLE_CHOICE';
            description: 'Multiple choice options';
            const: 0;
          },
          {
            title: 'DROPDOWN';
            description: 'Many options shown as a dropdown';
            const: 1;
          },
        ];
        format: 'int32';
      };
      PartialDiscordIntegrationResponse: {
        type: 'object';
        properties: {
          id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          type: {
            type: 'string';
            enum: ['discord'];
            allOf: [
              {
                $ref: '#/components/schemas/IntegrationTypes';
              },
            ];
          };
          name: {
            type: ['string', 'null'];
          };
          account: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/AccountResponse';
              },
            ];
          };
          application_id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
        };
        required: ['id', 'type', 'application_id'];
      };
      PartialExternalConnectionIntegrationResponse: {
        type: 'object';
        properties: {
          id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          type: {
            type: 'string';
            enum: ['twitch', 'youtube'];
            allOf: [
              {
                $ref: '#/components/schemas/IntegrationTypes';
              },
            ];
          };
          name: {
            type: ['string', 'null'];
          };
          account: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/AccountResponse';
              },
            ];
          };
        };
        required: ['id', 'type'];
      };
      PartialGuildSubscriptionIntegrationResponse: {
        type: 'object';
        properties: {
          id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          type: {
            type: 'string';
            enum: ['guild_subscription'];
            allOf: [
              {
                $ref: '#/components/schemas/IntegrationTypes';
              },
            ];
          };
          name: {
            type: ['string', 'null'];
          };
          account: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/AccountResponse';
              },
            ];
          };
        };
        required: ['id', 'type'];
      };
      PongInteractionCallbackRequest: {
        type: 'object';
        properties: {
          type: {
            type: 'integer';
            enum: [1];
            allOf: [
              {
                $ref: '#/components/schemas/InteractionCallbackTypes';
              },
            ];
            format: 'int32';
          };
        };
        required: ['type'];
      };
      PremiumGuildTiers: {
        type: 'integer';
        oneOf: [
          {
            title: 'NONE';
            description: 'Guild has not unlocked any Server Boost perks';
            const: 0;
          },
          {
            title: 'TIER_1';
            description: 'Guild has unlocked Server Boost level 1 perks';
            const: 1;
          },
          {
            title: 'TIER_2';
            description: 'Guild has unlocked Server Boost level 2 perks';
            const: 2;
          },
          {
            title: 'TIER_3';
            description: 'Guild has unlocked Server Boost level 3 perks';
            const: 3;
          },
        ];
        format: 'int32';
      };
      PremiumTypes: {
        type: 'integer';
        oneOf: [
          {
            title: 'NONE';
            description: 'None';
            const: 0;
          },
          {
            title: 'TIER_1';
            description: 'Nitro Classic';
            const: 1;
          },
          {
            title: 'TIER_2';
            description: 'Nitro Standard';
            const: 2;
          },
          {
            title: 'TIER_0';
            description: 'Nitro Basic';
            const: 3;
          },
        ];
        format: 'int32';
      };
      PrivateApplicationResponse: {
        type: 'object';
        properties: {
          id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          name: {
            type: 'string';
          };
          icon: {
            type: ['string', 'null'];
          };
          description: {
            type: 'string';
          };
          type: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/ApplicationTypes';
              },
            ];
          };
          cover_image: {
            type: ['string', 'null'];
          };
          primary_sku_id: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/SnowflakeType';
              },
            ];
          };
          bot: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/UserResponse';
              },
            ];
          };
          slug: {
            type: ['string', 'null'];
          };
          guild_id: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/SnowflakeType';
              },
            ];
          };
          rpc_origins: {
            type: ['array', 'null'];
            items: {
              type: ['string', 'null'];
            };
          };
          bot_public: {
            type: ['boolean', 'null'];
          };
          bot_require_code_grant: {
            type: ['boolean', 'null'];
          };
          terms_of_service_url: {
            type: ['string', 'null'];
            format: 'uri';
          };
          privacy_policy_url: {
            type: ['string', 'null'];
            format: 'uri';
          };
          custom_install_url: {
            type: ['string', 'null'];
            format: 'uri';
          };
          install_params: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/ApplicationOAuth2ParamsResponse';
              },
            ];
          };
          verify_key: {
            type: 'string';
          };
          flags: {
            type: 'integer';
            format: 'int32';
          };
          max_participants: {
            type: ['integer', 'null'];
            format: 'int32';
          };
          tags: {
            type: ['array', 'null'];
            items: {
              type: 'string';
            };
            uniqueItems: true;
          };
          redirect_uris: {
            type: 'array';
            items: {
              type: ['string', 'null'];
              format: 'uri';
            };
          };
          interactions_endpoint_url: {
            type: ['string', 'null'];
            format: 'uri';
          };
          role_connections_verification_url: {
            type: ['string', 'null'];
            format: 'uri';
          };
          owner: {
            $ref: '#/components/schemas/UserResponse';
          };
          approximate_guild_count: {
            type: ['integer', 'null'];
            format: 'int32';
          };
          team: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/TeamResponse';
              },
            ];
          };
        };
        required: ['id', 'name', 'description', 'verify_key', 'flags', 'redirect_uris', 'owner'];
      };
      PrivateChannelRequestPartial: {
        type: 'object';
        properties: {
          name: {
            type: ['string', 'null'];
            minLength: 0;
            maxLength: 100;
          };
          icon: {
            type: ['string', 'null'];
            contentEncoding: 'base64';
          };
        };
      };
      PrivateChannelResponse: {
        type: 'object';
        properties: {
          id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          type: {
            type: 'integer';
            enum: [1];
            allOf: [
              {
                $ref: '#/components/schemas/ChannelTypes';
              },
            ];
            format: 'int32';
          };
          last_message_id: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/SnowflakeType';
              },
            ];
          };
          flags: {
            type: 'integer';
            format: 'int32';
          };
          last_pin_timestamp: {
            type: ['string', 'null'];
            format: 'date-time';
          };
          recipients: {
            type: 'array';
            items: {
              $ref: '#/components/schemas/UserResponse';
            };
          };
        };
        required: ['id', 'type', 'flags', 'recipients'];
      };
      PrivateGroupChannelResponse: {
        type: 'object';
        properties: {
          id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          type: {
            type: 'integer';
            enum: [3];
            allOf: [
              {
                $ref: '#/components/schemas/ChannelTypes';
              },
            ];
            format: 'int32';
          };
          last_message_id: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/SnowflakeType';
              },
            ];
          };
          flags: {
            type: 'integer';
            format: 'int32';
          };
          last_pin_timestamp: {
            type: ['string', 'null'];
            format: 'date-time';
          };
          recipients: {
            type: 'array';
            items: {
              $ref: '#/components/schemas/UserResponse';
            };
          };
          name: {
            type: ['string', 'null'];
          };
          icon: {
            type: ['string', 'null'];
          };
          owner_id: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/SnowflakeType';
              },
            ];
          };
          managed: {
            type: ['boolean', 'null'];
          };
          application_id: {
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
        required: ['id', 'type', 'flags', 'recipients'];
      };
      PrivateGuildMemberResponse: {
        type: 'object';
        properties: {
          avatar: {
            type: ['string', 'null'];
          };
          communication_disabled_until: {
            type: ['string', 'null'];
            format: 'date-time';
          };
          flags: {
            type: 'integer';
            format: 'int32';
          };
          joined_at: {
            type: 'string';
            format: 'date-time';
          };
          nick: {
            type: ['string', 'null'];
          };
          pending: {
            type: 'boolean';
          };
          premium_since: {
            type: ['string', 'null'];
            format: 'date-time';
          };
          roles: {
            type: 'array';
            items: {
              $ref: '#/components/schemas/SnowflakeType';
            };
            uniqueItems: true;
          };
          user: {
            $ref: '#/components/schemas/UserResponse';
          };
          mute: {
            type: 'boolean';
          };
          deaf: {
            type: 'boolean';
          };
          banner: {
            type: ['string', 'null'];
          };
        };
        required: ['flags', 'joined_at', 'pending', 'roles', 'user', 'mute', 'deaf'];
      };
      PurchaseNotificationResponse: {
        type: 'object';
        properties: {
          type: {
            $ref: '#/components/schemas/PurchaseType';
          };
          guild_product_purchase: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/GuildProductPurchaseResponse';
              },
            ];
          };
        };
        required: ['type'];
      };
      PurchaseType: {
        type: 'integer';
        oneOf: [];
        format: 'int32';
      };
      QuarantineUserAction: {
        type: 'object';
        properties: {
          type: {
            type: 'integer';
            enum: [4];
            allOf: [
              {
                $ref: '#/components/schemas/AutomodActionType';
              },
            ];
            format: 'int32';
          };
          metadata: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/QuarantineUserActionMetadata';
              },
            ];
          };
        };
        required: ['type'];
      };
      QuarantineUserActionMetadata: {
        type: 'object';
        properties: {};
      };
      QuarantineUserActionMetadataResponse: {
        type: 'object';
        properties: {};
      };
      QuarantineUserActionResponse: {
        type: 'object';
        properties: {
          type: {
            type: 'integer';
            enum: [4];
            allOf: [
              {
                $ref: '#/components/schemas/AutomodActionType';
              },
            ];
            format: 'int32';
          };
          metadata: {
            $ref: '#/components/schemas/QuarantineUserActionMetadataResponse';
          };
        };
        required: ['type', 'metadata'];
      };
      ReplyMessageReferenceRequest: {
        type: 'object';
        properties: {
          guild_id: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/SnowflakeType';
              },
            ];
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
          message_id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          fail_if_not_exists: {
            type: ['boolean', 'null'];
          };
        };
        required: ['message_id'];
      };
      ResolvedObjectsResponse: {
        type: 'object';
        properties: {
          users: {
            type: 'object';
            additionalProperties: {
              $ref: '#/components/schemas/UserResponse';
            };
          };
          members: {
            type: 'object';
            additionalProperties: {
              $ref: '#/components/schemas/GuildMemberResponse';
            };
          };
          channels: {
            type: 'object';
            additionalProperties: {
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
          roles: {
            type: 'object';
            additionalProperties: {
              $ref: '#/components/schemas/GuildRoleResponse';
            };
          };
        };
        required: ['users', 'members', 'channels', 'roles'];
      };
      ResourceChannelResponse: {
        type: 'object';
        properties: {
          channel_id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          title: {
            type: 'string';
          };
          emoji: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/SettingsEmojiResponse';
              },
            ];
          };
          icon: {
            type: ['string', 'null'];
          };
          description: {
            type: 'string';
          };
        };
        required: ['channel_id', 'title', 'description'];
      };
      RichEmbed: {
        type: 'object';
        properties: {
          type: {
            type: ['string', 'null'];
            maxLength: 152133;
          };
          url: {
            type: ['string', 'null'];
            maxLength: 2048;
            format: 'uri';
          };
          title: {
            type: ['string', 'null'];
            maxLength: 256;
          };
          color: {
            type: ['integer', 'null'];
            minimum: 0;
            maximum: 16777215;
          };
          timestamp: {
            type: ['string', 'null'];
            format: 'date-time';
          };
          description: {
            type: ['string', 'null'];
            maxLength: 4096;
          };
          author: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/RichEmbedAuthor';
              },
            ];
          };
          image: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/RichEmbedImage';
              },
            ];
          };
          thumbnail: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/RichEmbedThumbnail';
              },
            ];
          };
          footer: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/RichEmbedFooter';
              },
            ];
          };
          fields: {
            type: ['array', 'null'];
            items: {
              $ref: '#/components/schemas/RichEmbedField';
            };
            maxItems: 25;
          };
          provider: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/RichEmbedProvider';
              },
            ];
          };
          video: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/RichEmbedVideo';
              },
            ];
          };
        };
      };
      RichEmbedAuthor: {
        type: 'object';
        properties: {
          name: {
            type: ['string', 'null'];
            maxLength: 256;
          };
          url: {
            type: ['string', 'null'];
            maxLength: 2048;
            format: 'uri';
          };
          icon_url: {
            type: ['string', 'null'];
            maxLength: 2048;
            format: 'uri';
          };
        };
      };
      RichEmbedField: {
        type: 'object';
        properties: {
          name: {
            type: 'string';
            maxLength: 256;
          };
          value: {
            type: 'string';
            maxLength: 1024;
          };
          inline: {
            type: ['boolean', 'null'];
          };
        };
        required: ['name', 'value'];
      };
      RichEmbedFooter: {
        type: 'object';
        properties: {
          text: {
            type: ['string', 'null'];
            maxLength: 2048;
          };
          icon_url: {
            type: ['string', 'null'];
            maxLength: 2048;
            format: 'uri';
          };
        };
      };
      RichEmbedImage: {
        type: 'object';
        properties: {
          url: {
            type: ['string', 'null'];
            maxLength: 2048;
            format: 'uri';
          };
          width: {
            type: ['integer', 'null'];
          };
          height: {
            type: ['integer', 'null'];
          };
          placeholder: {
            type: ['string', 'null'];
            maxLength: 64;
          };
          placeholder_version: {
            type: ['integer', 'null'];
            minimum: 0;
            maximum: 2147483647;
          };
        };
      };
      RichEmbedProvider: {
        type: 'object';
        properties: {
          name: {
            type: ['string', 'null'];
            maxLength: 256;
          };
          url: {
            type: ['string', 'null'];
            maxLength: 2048;
            format: 'uri';
          };
        };
      };
      RichEmbedThumbnail: {
        type: 'object';
        properties: {
          url: {
            type: ['string', 'null'];
            maxLength: 2048;
            format: 'uri';
          };
          width: {
            type: ['integer', 'null'];
          };
          height: {
            type: ['integer', 'null'];
          };
          placeholder: {
            type: ['string', 'null'];
            maxLength: 64;
          };
          placeholder_version: {
            type: ['integer', 'null'];
            minimum: 0;
            maximum: 2147483647;
          };
        };
      };
      RichEmbedVideo: {
        type: 'object';
        properties: {
          url: {
            type: ['string', 'null'];
            maxLength: 2048;
            format: 'uri';
          };
          width: {
            type: ['integer', 'null'];
          };
          height: {
            type: ['integer', 'null'];
          };
          placeholder: {
            type: ['string', 'null'];
            maxLength: 64;
          };
          placeholder_version: {
            type: ['integer', 'null'];
            minimum: 0;
            maximum: 2147483647;
          };
        };
      };
      RoleSelect: {
        type: 'object';
        properties: {
          type: {
            type: 'integer';
            enum: [6];
            allOf: [
              {
                $ref: '#/components/schemas/MessageComponentTypes';
              },
            ];
            format: 'int32';
          };
          custom_id: {
            type: 'string';
            maxLength: 100;
          };
          placeholder: {
            type: ['string', 'null'];
            maxLength: 150;
          };
          min_values: {
            type: ['integer', 'null'];
            minimum: 0;
            maximum: 25;
          };
          max_values: {
            type: ['integer', 'null'];
            minimum: 1;
            maximum: 25;
          };
          disabled: {
            type: ['boolean', 'null'];
          };
          default_values: {
            type: ['array', 'null'];
            items: {
              $ref: '#/components/schemas/RoleSelectDefaultValue';
            };
            maxItems: 25;
          };
        };
        required: ['type', 'custom_id'];
      };
      RoleSelectDefaultValue: {
        type: 'object';
        properties: {
          type: {
            $ref: '#/components/schemas/SnowflakeSelectDefaultValueTypes';
          };
          id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
        };
        required: ['type', 'id'];
      };
      ScheduledEventResponse: {
        type: 'object';
        properties: {
          id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          guild_id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          name: {
            type: 'string';
          };
          description: {
            type: ['string', 'null'];
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
          creator_id: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/SnowflakeType';
              },
            ];
          };
          creator: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/UserResponse';
              },
            ];
          };
          image: {
            type: ['string', 'null'];
          };
          scheduled_start_time: {
            type: 'string';
            format: 'date-time';
          };
          scheduled_end_time: {
            type: ['string', 'null'];
            format: 'date-time';
          };
          status: {
            $ref: '#/components/schemas/GuildScheduledEventStatuses';
          };
          entity_type: {
            $ref: '#/components/schemas/GuildScheduledEventEntityTypes';
          };
          entity_id: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/SnowflakeType';
              },
            ];
          };
          user_count: {
            type: ['integer', 'null'];
            format: 'int32';
          };
          privacy_level: {
            $ref: '#/components/schemas/GuildScheduledEventPrivacyLevels';
          };
          user_rsvp: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/ScheduledEventUserResponse';
              },
            ];
          };
        };
        required: ['id', 'guild_id', 'name', 'scheduled_start_time', 'status', 'entity_type', 'privacy_level'];
      };
      ScheduledEventUserResponse: {
        type: 'object';
        properties: {
          guild_scheduled_event_id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          user_id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          user: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/UserResponse';
              },
            ];
          };
          member: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/GuildMemberResponse';
              },
            ];
          };
        };
        required: ['guild_scheduled_event_id', 'user_id'];
      };
      SelectOption: {
        type: 'object';
        properties: {
          label: {
            type: 'string';
            minLength: 1;
            maxLength: 100;
          };
          value: {
            type: 'string';
            minLength: 1;
            maxLength: 100;
          };
          description: {
            type: ['string', 'null'];
            maxLength: 100;
          };
          emoji: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/Emoji';
              },
            ];
          };
          default: {
            type: ['boolean', 'null'];
          };
        };
        required: ['label', 'value'];
      };
      SelectOptionResponse: {
        type: 'object';
        properties: {
          label: {
            type: 'string';
          };
          value: {
            type: 'string';
          };
          description: {
            type: ['string', 'null'];
          };
          emoji: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/MessageComponentEmojiResponse';
              },
            ];
          };
          default: {
            type: ['boolean', 'null'];
          };
        };
        required: ['label', 'value'];
      };
      SettingsEmojiResponse: {
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
          name: {
            type: ['string', 'null'];
          };
          animated: {
            type: ['boolean', 'null'];
          };
        };
      };
      SlackWebhook: {
        type: 'object';
        properties: {
          text: {
            type: ['string', 'null'];
            maxLength: 2000;
          };
          username: {
            type: ['string', 'null'];
            maxLength: 152133;
          };
          icon_url: {
            type: ['string', 'null'];
            maxLength: 2048;
            format: 'uri';
          };
          attachments: {
            type: ['array', 'null'];
            items: {
              $ref: '#/components/schemas/WebhookSlackEmbed';
            };
            maxItems: 1521;
          };
        };
      };
      SnowflakeSelectDefaultValueTypes: {
        type: 'string';
        oneOf: [];
      };
      SnowflakeType: {
        type: 'string';
        pattern: '^(0|[1-9][0-9]*)$';
        format: 'snowflake';
      };
      SpamLinkRuleResponse: {
        type: 'object';
        properties: {
          id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          guild_id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          creator_id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          name: {
            type: 'string';
          };
          event_type: {
            $ref: '#/components/schemas/AutomodEventType';
          };
          actions: {
            type: 'array';
            items: {
              oneOf: [
                {
                  $ref: '#/components/schemas/BlockMessageActionResponse';
                },
                {
                  $ref: '#/components/schemas/FlagToChannelActionResponse';
                },
                {
                  $ref: '#/components/schemas/QuarantineUserActionResponse';
                },
                {
                  $ref: '#/components/schemas/UserCommunicationDisabledActionResponse';
                },
              ];
            };
          };
          trigger_type: {
            type: 'integer';
            enum: [2];
            allOf: [
              {
                $ref: '#/components/schemas/AutomodTriggerType';
              },
            ];
            format: 'int32';
          };
          enabled: {
            type: ['boolean', 'null'];
          };
          exempt_roles: {
            type: ['array', 'null'];
            items: {
              $ref: '#/components/schemas/SnowflakeType';
            };
            uniqueItems: true;
          };
          exempt_channels: {
            type: ['array', 'null'];
            items: {
              $ref: '#/components/schemas/SnowflakeType';
            };
            uniqueItems: true;
          };
          trigger_metadata: {
            $ref: '#/components/schemas/SpamLinkTriggerMetadataResponse';
          };
        };
        required: ['id', 'guild_id', 'creator_id', 'name', 'event_type', 'actions', 'trigger_type', 'trigger_metadata'];
      };
      SpamLinkTriggerMetadataResponse: {
        type: 'object';
        properties: {};
      };
      StageInstanceResponse: {
        type: 'object';
        properties: {
          guild_id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          channel_id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          topic: {
            type: 'string';
          };
          privacy_level: {
            $ref: '#/components/schemas/StageInstancesPrivacyLevels';
          };
          id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          discoverable_disabled: {
            type: ['boolean', 'null'];
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
        };
        required: ['guild_id', 'channel_id', 'topic', 'privacy_level', 'id'];
      };
      StageInstancesPrivacyLevels: {
        type: 'integer';
        oneOf: [
          {
            title: 'PUBLIC';
            description: 'The Stage instance is visible publicly. (deprecated)';
            const: 1;
          },
          {
            title: 'GUILD_ONLY';
            description: 'The Stage instance is visible publicly. (deprecated)';
            const: 2;
          },
        ];
        format: 'int32';
      };
      StageScheduledEventCreateRequest: {
        type: 'object';
        properties: {
          name: {
            type: 'string';
            maxLength: 100;
          };
          description: {
            type: ['string', 'null'];
            maxLength: 1000;
          };
          image: {
            type: ['string', 'null'];
            contentEncoding: 'base64';
          };
          scheduled_start_time: {
            type: 'string';
            format: 'date-time';
          };
          scheduled_end_time: {
            type: ['string', 'null'];
            format: 'date-time';
          };
          privacy_level: {
            $ref: '#/components/schemas/GuildScheduledEventPrivacyLevels';
          };
          entity_type: {
            type: 'integer';
            enum: [1];
            allOf: [
              {
                $ref: '#/components/schemas/GuildScheduledEventEntityTypes';
              },
            ];
            format: 'int32';
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
          entity_metadata: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/EntityMetadataStageInstance';
              },
            ];
          };
        };
        required: ['name', 'scheduled_start_time', 'privacy_level', 'entity_type'];
      };
      StageScheduledEventPatchRequestPartial: {
        type: 'object';
        properties: {
          status: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/GuildScheduledEventStatuses';
              },
            ];
          };
          name: {
            type: 'string';
            maxLength: 100;
          };
          description: {
            type: ['string', 'null'];
            maxLength: 1000;
          };
          image: {
            type: ['string', 'null'];
            contentEncoding: 'base64';
          };
          scheduled_start_time: {
            type: 'string';
            format: 'date-time';
          };
          scheduled_end_time: {
            type: ['string', 'null'];
            format: 'date-time';
          };
          entity_type: {
            oneOf: [
              {
                type: 'null';
              },
              {
                type: 'integer';
                enum: [1];
                allOf: [
                  {
                    $ref: '#/components/schemas/GuildScheduledEventEntityTypes';
                  },
                ];
                format: 'int32';
              },
            ];
          };
          privacy_level: {
            $ref: '#/components/schemas/GuildScheduledEventPrivacyLevels';
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
          entity_metadata: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/EntityMetadataStageInstance';
              },
            ];
          };
        };
      };
      StageScheduledEventResponse: {
        type: 'object';
        properties: {
          id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          guild_id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          name: {
            type: 'string';
          };
          description: {
            type: ['string', 'null'];
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
          creator_id: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/SnowflakeType';
              },
            ];
          };
          creator: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/UserResponse';
              },
            ];
          };
          image: {
            type: ['string', 'null'];
          };
          scheduled_start_time: {
            type: 'string';
            format: 'date-time';
          };
          scheduled_end_time: {
            type: ['string', 'null'];
            format: 'date-time';
          };
          status: {
            $ref: '#/components/schemas/GuildScheduledEventStatuses';
          };
          entity_type: {
            type: 'integer';
            enum: [1];
            allOf: [
              {
                $ref: '#/components/schemas/GuildScheduledEventEntityTypes';
              },
            ];
            format: 'int32';
          };
          entity_id: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/SnowflakeType';
              },
            ];
          };
          user_count: {
            type: ['integer', 'null'];
            format: 'int32';
          };
          privacy_level: {
            $ref: '#/components/schemas/GuildScheduledEventPrivacyLevels';
          };
          user_rsvp: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/ScheduledEventUserResponse';
              },
            ];
          };
          entity_metadata: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/EntityMetadataStageInstanceResponse';
              },
            ];
          };
        };
        required: ['id', 'guild_id', 'name', 'scheduled_start_time', 'status', 'entity_type', 'privacy_level'];
      };
      StandardStickerResponse: {
        type: 'object';
        properties: {
          id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          name: {
            type: 'string';
          };
          tags: {
            type: 'string';
          };
          type: {
            type: 'integer';
            enum: [1];
            allOf: [
              {
                $ref: '#/components/schemas/StickerTypes';
              },
            ];
            format: 'int32';
          };
          format_type: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/StickerFormatTypes';
              },
            ];
          };
          description: {
            type: ['string', 'null'];
          };
          pack_id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          sort_value: {
            type: 'integer';
            format: 'int32';
          };
        };
        required: ['id', 'name', 'tags', 'type', 'pack_id', 'sort_value'];
      };
      StickerFormatTypes: {
        type: 'integer';
        oneOf: [
          {
            title: 'PNG';
            const: 1;
          },
          {
            title: 'APNG';
            const: 2;
          },
          {
            title: 'LOTTIE';
            const: 3;
          },
          {
            title: 'GIF';
            const: 4;
          },
        ];
        format: 'int32';
      };
      StickerPackCollectionResponse: {
        type: 'object';
        properties: {
          sticker_packs: {
            type: 'array';
            items: {
              $ref: '#/components/schemas/StickerPackResponse';
            };
          };
        };
        required: ['sticker_packs'];
      };
      StickerPackResponse: {
        type: 'object';
        properties: {
          id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          sku_id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          name: {
            type: 'string';
          };
          description: {
            type: ['string', 'null'];
          };
          stickers: {
            type: 'array';
            items: {
              $ref: '#/components/schemas/StandardStickerResponse';
            };
          };
          cover_sticker_id: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/SnowflakeType';
              },
            ];
          };
          banner_asset_id: {
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
        required: ['id', 'sku_id', 'name', 'stickers'];
      };
      StickerTypes: {
        type: 'integer';
        oneOf: [
          {
            title: 'STANDARD';
            description: 'an official sticker in a pack, part of Nitro or in a removed purchasable pack';
            const: 1;
          },
          {
            title: 'GUILD';
            description: "a sticker uploaded to a guild for the guild's members";
            const: 2;
          },
        ];
        format: 'int32';
      };
      StringSelect: {
        type: 'object';
        properties: {
          type: {
            type: 'integer';
            enum: [3];
            allOf: [
              {
                $ref: '#/components/schemas/MessageComponentTypes';
              },
            ];
            format: 'int32';
          };
          custom_id: {
            type: 'string';
            maxLength: 100;
          };
          placeholder: {
            type: ['string', 'null'];
            maxLength: 150;
          };
          min_values: {
            type: ['integer', 'null'];
            minimum: 0;
            maximum: 25;
          };
          max_values: {
            type: ['integer', 'null'];
            minimum: 1;
            maximum: 25;
          };
          disabled: {
            type: ['boolean', 'null'];
          };
          options: {
            type: 'array';
            items: {
              $ref: '#/components/schemas/SelectOption';
            };
            minItems: 1;
            maxItems: 25;
          };
        };
        required: ['type', 'custom_id', 'options'];
      };
      TeamMemberResponse: {
        type: 'object';
        properties: {
          user: {
            $ref: '#/components/schemas/UserResponse';
          };
          team_id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          membership_state: {
            $ref: '#/components/schemas/TeamMembershipStates';
          };
        };
        required: ['user', 'team_id', 'membership_state'];
      };
      TeamMembershipStates: {
        type: 'integer';
        oneOf: [
          {
            title: 'INVITED';
            description: 'User has been invited to the team.';
            const: 1;
          },
          {
            title: 'ACCEPTED';
            description: 'User has accepted the team invitation.';
            const: 2;
          },
        ];
        format: 'int32';
      };
      TeamResponse: {
        type: 'object';
        properties: {
          id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          icon: {
            type: ['string', 'null'];
          };
          name: {
            type: 'string';
          };
          owner_user_id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          members: {
            type: 'array';
            items: {
              $ref: '#/components/schemas/TeamMemberResponse';
            };
          };
        };
        required: ['id', 'name', 'owner_user_id', 'members'];
      };
      TextStyleTypes: {
        type: 'integer';
        oneOf: [
          {
            title: 'SHORT';
            description: 'Single-line input';
            const: 1;
          },
          {
            title: 'PARAGRAPH';
            description: 'Multi-line input';
            const: 2;
          },
        ];
        format: 'int32';
      };
      ThreadAutoArchiveDuration: {
        type: 'integer';
        oneOf: [
          {
            title: 'ONE_HOUR';
            description: 'One hour';
            const: 60;
          },
          {
            title: 'ONE_DAY';
            description: 'One day';
            const: 1440;
          },
          {
            title: 'THREE_DAY';
            description: 'Three days';
            const: 4320;
          },
          {
            title: 'SEVEN_DAY';
            description: 'Seven days';
            const: 10080;
          },
        ];
        format: 'int32';
      };
      ThreadMemberResponse: {
        type: 'object';
        properties: {
          id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          user_id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          join_timestamp: {
            type: 'string';
            format: 'date-time';
          };
          flags: {
            type: 'integer';
            format: 'int32';
          };
          member: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/GuildMemberResponse';
              },
            ];
          };
        };
        required: ['id', 'user_id', 'join_timestamp', 'flags'];
      };
      ThreadMetadataResponse: {
        type: 'object';
        properties: {
          archived: {
            type: 'boolean';
          };
          archive_timestamp: {
            type: ['string', 'null'];
            format: 'date-time';
          };
          auto_archive_duration: {
            $ref: '#/components/schemas/ThreadAutoArchiveDuration';
          };
          locked: {
            type: 'boolean';
          };
          create_timestamp: {
            type: ['string', 'null'];
            format: 'date-time';
          };
          invitable: {
            type: ['boolean', 'null'];
          };
        };
        required: ['archived', 'auto_archive_duration', 'locked'];
      };
      ThreadResponse: {
        type: 'object';
        properties: {
          id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          type: {
            type: 'integer';
            enum: [10, 11, 12];
            allOf: [
              {
                $ref: '#/components/schemas/ChannelTypes';
              },
            ];
            format: 'int32';
          };
          last_message_id: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/SnowflakeType';
              },
            ];
          };
          flags: {
            type: 'integer';
            format: 'int32';
          };
          last_pin_timestamp: {
            type: ['string', 'null'];
            format: 'date-time';
          };
          guild_id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          name: {
            type: 'string';
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
          rate_limit_per_user: {
            type: ['integer', 'null'];
            format: 'int32';
          };
          bitrate: {
            type: ['integer', 'null'];
            format: 'int32';
          };
          user_limit: {
            type: ['integer', 'null'];
            format: 'int32';
          };
          rtc_region: {
            type: ['string', 'null'];
          };
          video_quality_mode: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/VideoQualityModes';
              },
            ];
          };
          permissions: {
            type: ['string', 'null'];
          };
          owner_id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          thread_metadata: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/ThreadMetadataResponse';
              },
            ];
          };
          message_count: {
            type: 'integer';
            format: 'int32';
          };
          member_count: {
            type: 'integer';
            format: 'int32';
          };
          total_message_sent: {
            type: 'integer';
            format: 'int32';
          };
          applied_tags: {
            type: ['array', 'null'];
            items: {
              $ref: '#/components/schemas/SnowflakeType';
            };
          };
          member: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/ThreadMemberResponse';
              },
            ];
          };
        };
        required: [
          'id',
          'type',
          'flags',
          'guild_id',
          'name',
          'owner_id',
          'message_count',
          'member_count',
          'total_message_sent',
        ];
      };
      ThreadSortOrder: {
        type: 'integer';
        oneOf: [
          {
            title: 'LATEST_ACTIVITY';
            description: 'Sort forum posts by activity';
            const: 0;
          },
          {
            title: 'CREATION_DATE';
            description: 'Sort forum posts by creation time (from most recent to oldest)';
            const: 1;
          },
        ];
        format: 'int32';
      };
      ThreadsResponse: {
        type: 'object';
        properties: {
          threads: {
            type: 'array';
            items: {
              $ref: '#/components/schemas/ThreadResponse';
            };
          };
          members: {
            type: 'array';
            items: {
              $ref: '#/components/schemas/ThreadMemberResponse';
            };
          };
          has_more: {
            type: ['boolean', 'null'];
          };
        };
        required: ['threads', 'members'];
      };
      TypingIndicatorResponse: {
        type: 'object';
        properties: {};
      };
      UInt32Type: {
        type: 'integer';
        minimum: 0;
        maximum: 4294967295;
        format: 'int64';
      };
      UpdateDefaultReactionEmojiRequest: {
        type: 'object';
        properties: {
          emoji_id: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/SnowflakeType';
              },
            ];
          };
          emoji_name: {
            type: ['string', 'null'];
            maxLength: 100;
          };
        };
      };
      UpdateGuildChannelRequestPartial: {
        type: 'object';
        properties: {
          type: {
            oneOf: [
              {
                type: 'null';
              },
              {
                type: 'integer';
                enum: [0, 2, 4, 5, 13, 14, 15];
                allOf: [
                  {
                    $ref: '#/components/schemas/ChannelTypes';
                  },
                ];
                format: 'int32';
              },
            ];
          };
          name: {
            type: 'string';
            minLength: 1;
            maxLength: 100;
          };
          position: {
            type: ['integer', 'null'];
            minimum: 0;
            format: 'int32';
          };
          topic: {
            type: ['string', 'null'];
            minLength: 0;
            maxLength: 4096;
          };
          bitrate: {
            type: ['integer', 'null'];
            minimum: 8000;
            format: 'int32';
          };
          user_limit: {
            type: ['integer', 'null'];
            minimum: 0;
            format: 'int32';
          };
          nsfw: {
            type: ['boolean', 'null'];
          };
          rate_limit_per_user: {
            type: ['integer', 'null'];
            minimum: 0;
            maximum: 21600;
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
          permission_overwrites: {
            type: ['array', 'null'];
            items: {
              $ref: '#/components/schemas/ChannelPermissionOverwriteRequest';
            };
            maxItems: 100;
          };
          rtc_region: {
            type: ['string', 'null'];
          };
          video_quality_mode: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/VideoQualityModes';
              },
            ];
          };
          default_auto_archive_duration: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/ThreadAutoArchiveDuration';
              },
            ];
          };
          default_reaction_emoji: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/UpdateDefaultReactionEmojiRequest';
              },
            ];
          };
          default_thread_rate_limit_per_user: {
            type: ['integer', 'null'];
            minimum: 0;
            maximum: 21600;
          };
          default_sort_order: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/ThreadSortOrder';
              },
            ];
          };
          default_forum_layout: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/ForumLayout';
              },
            ];
          };
          flags: {
            type: ['integer', 'null'];
          };
          available_tags: {
            type: ['array', 'null'];
            items: {
              $ref: '#/components/schemas/UpdateThreadTagRequest';
            };
            maxItems: 20;
          };
        };
      };
      UpdateGuildOnboardingRequest: {
        type: 'object';
        properties: {
          prompts: {
            type: ['array', 'null'];
            items: {
              $ref: '#/components/schemas/UpdateOnboardingPromptRequest';
            };
            maxItems: 15;
          };
          enabled: {
            type: ['boolean', 'null'];
          };
          default_channel_ids: {
            type: ['array', 'null'];
            items: {
              $ref: '#/components/schemas/SnowflakeType';
            };
            maxItems: 500;
            uniqueItems: true;
          };
          mode: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/GuildOnboardingMode';
              },
            ];
          };
        };
      };
      UpdateMessageInteractionCallbackRequest: {
        type: 'object';
        properties: {
          type: {
            type: 'integer';
            enum: [6, 7];
            allOf: [
              {
                $ref: '#/components/schemas/InteractionCallbackTypes';
              },
            ];
            format: 'int32';
          };
          data: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/IncomingWebhookUpdateForInteractionCallbackRequestPartial';
              },
            ];
          };
        };
        required: ['type'];
      };
      UpdateOnboardingPromptRequest: {
        type: 'object';
        properties: {
          title: {
            type: 'string';
            minLength: 1;
            maxLength: 100;
          };
          options: {
            type: 'array';
            items: {
              $ref: '#/components/schemas/OnboardingPromptOptionRequest';
            };
            minItems: 1;
            maxItems: 50;
          };
          single_select: {
            type: ['boolean', 'null'];
          };
          required: {
            type: ['boolean', 'null'];
          };
          in_onboarding: {
            type: ['boolean', 'null'];
          };
          type: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/OnboardingPromptType';
              },
            ];
          };
          id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
        };
        required: ['title', 'options', 'id'];
      };
      UpdateThreadRequestPartial: {
        type: 'object';
        properties: {
          name: {
            type: ['string', 'null'];
            minLength: 0;
            maxLength: 100;
          };
          archived: {
            type: ['boolean', 'null'];
          };
          locked: {
            type: ['boolean', 'null'];
          };
          invitable: {
            type: ['boolean', 'null'];
          };
          auto_archive_duration: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/ThreadAutoArchiveDuration';
              },
            ];
          };
          rate_limit_per_user: {
            type: ['integer', 'null'];
            minimum: 0;
            maximum: 21600;
          };
          flags: {
            type: ['integer', 'null'];
          };
          applied_tags: {
            type: ['array', 'null'];
            items: {
              $ref: '#/components/schemas/SnowflakeType';
            };
            maxItems: 5;
          };
          bitrate: {
            type: ['integer', 'null'];
            minimum: 8000;
            format: 'int32';
          };
          user_limit: {
            type: ['integer', 'null'];
            minimum: 0;
            maximum: 99;
          };
          rtc_region: {
            type: ['string', 'null'];
          };
          video_quality_mode: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/VideoQualityModes';
              },
            ];
          };
        };
      };
      UpdateThreadTagRequest: {
        type: 'object';
        properties: {
          name: {
            type: 'string';
            minLength: 0;
            maxLength: 20;
          };
          emoji_id: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/SnowflakeType';
              },
            ];
          };
          emoji_name: {
            type: ['string', 'null'];
            maxLength: 100;
          };
          moderated: {
            type: ['boolean', 'null'];
          };
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
        };
        required: ['name'];
      };
      UserCommunicationDisabledAction: {
        type: 'object';
        properties: {
          type: {
            type: 'integer';
            enum: [3];
            allOf: [
              {
                $ref: '#/components/schemas/AutomodActionType';
              },
            ];
            format: 'int32';
          };
          metadata: {
            $ref: '#/components/schemas/UserCommunicationDisabledActionMetadata';
          };
        };
        required: ['type', 'metadata'];
      };
      UserCommunicationDisabledActionMetadata: {
        type: 'object';
        properties: {
          duration_seconds: {
            type: 'integer';
            minimum: 0;
            maximum: 2419200;
          };
        };
        required: ['duration_seconds'];
      };
      UserCommunicationDisabledActionMetadataResponse: {
        type: 'object';
        properties: {
          duration_seconds: {
            type: 'integer';
            format: 'int32';
          };
        };
        required: ['duration_seconds'];
      };
      UserCommunicationDisabledActionResponse: {
        type: 'object';
        properties: {
          type: {
            type: 'integer';
            enum: [3];
            allOf: [
              {
                $ref: '#/components/schemas/AutomodActionType';
              },
            ];
            format: 'int32';
          };
          metadata: {
            $ref: '#/components/schemas/UserCommunicationDisabledActionMetadataResponse';
          };
        };
        required: ['type', 'metadata'];
      };
      UserGuildOnboardingResponse: {
        type: 'object';
        properties: {
          guild_id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          prompts: {
            type: 'array';
            items: {
              $ref: '#/components/schemas/OnboardingPromptResponse';
            };
          };
          default_channel_ids: {
            type: 'array';
            items: {
              $ref: '#/components/schemas/SnowflakeType';
            };
            uniqueItems: true;
          };
          enabled: {
            type: 'boolean';
          };
        };
        required: ['guild_id', 'prompts', 'default_channel_ids', 'enabled'];
      };
      UserNotificationSettings: {
        type: 'integer';
        oneOf: [
          {
            title: 'ALL_MESSAGES';
            description: 'members will receive notifications for all messages by default';
            const: 0;
          },
          {
            title: 'ONLY_MENTIONS';
            description: 'members will receive notifications only for messages that @mention them by default';
            const: 1;
          },
        ];
        format: 'int32';
      };
      UserPIIResponse: {
        type: 'object';
        properties: {
          id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          username: {
            type: 'string';
          };
          avatar: {
            type: ['string', 'null'];
          };
          discriminator: {
            type: 'string';
          };
          public_flags: {
            type: 'integer';
            format: 'int32';
          };
          premium_type: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/PremiumTypes';
              },
            ];
          };
          flags: {
            $ref: '#/components/schemas/Int53Type';
          };
          bot: {
            type: ['boolean', 'null'];
          };
          system: {
            type: ['boolean', 'null'];
          };
          banner: {
            type: ['string', 'null'];
          };
          accent_color: {
            type: ['integer', 'null'];
            format: 'int32';
          };
          global_name: {
            type: ['string', 'null'];
          };
          mfa_enabled: {
            type: 'boolean';
          };
          locale: {
            $ref: '#/components/schemas/AvailableLocalesEnum';
          };
          email: {
            type: ['string', 'null'];
          };
          verified: {
            type: ['boolean', 'null'];
          };
        };
        required: ['id', 'username', 'discriminator', 'public_flags', 'flags', 'mfa_enabled', 'locale'];
      };
      UserResponse: {
        type: 'object';
        properties: {
          id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          username: {
            type: 'string';
          };
          avatar: {
            type: ['string', 'null'];
          };
          discriminator: {
            type: 'string';
          };
          public_flags: {
            type: 'integer';
            format: 'int32';
          };
          premium_type: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/PremiumTypes';
              },
            ];
          };
          flags: {
            $ref: '#/components/schemas/Int53Type';
          };
          bot: {
            type: ['boolean', 'null'];
          };
          system: {
            type: ['boolean', 'null'];
          };
          banner: {
            type: ['string', 'null'];
          };
          accent_color: {
            type: ['integer', 'null'];
            format: 'int32';
          };
          global_name: {
            type: ['string', 'null'];
          };
        };
        required: ['id', 'username', 'discriminator', 'public_flags', 'flags'];
      };
      UserSelect: {
        type: 'object';
        properties: {
          type: {
            type: 'integer';
            enum: [5];
            allOf: [
              {
                $ref: '#/components/schemas/MessageComponentTypes';
              },
            ];
            format: 'int32';
          };
          custom_id: {
            type: 'string';
            maxLength: 100;
          };
          placeholder: {
            type: ['string', 'null'];
            maxLength: 150;
          };
          min_values: {
            type: ['integer', 'null'];
            minimum: 0;
            maximum: 25;
          };
          max_values: {
            type: ['integer', 'null'];
            minimum: 1;
            maximum: 25;
          };
          disabled: {
            type: ['boolean', 'null'];
          };
          default_values: {
            type: ['array', 'null'];
            items: {
              $ref: '#/components/schemas/UserSelectDefaultValue';
            };
            maxItems: 25;
          };
        };
        required: ['type', 'custom_id'];
      };
      UserSelectDefaultValue: {
        type: 'object';
        properties: {
          type: {
            $ref: '#/components/schemas/SnowflakeSelectDefaultValueTypes';
          };
          id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
        };
        required: ['type', 'id'];
      };
      VanityURLErrorResponse: {
        type: 'object';
        properties: {
          message: {
            type: 'string';
          };
          code: {
            type: 'integer';
            format: 'int32';
          };
        };
        required: ['message', 'code'];
      };
      VanityURLResponse: {
        type: 'object';
        properties: {
          code: {
            type: ['string', 'null'];
          };
          uses: {
            type: 'integer';
            format: 'int32';
          };
          error: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/VanityURLErrorResponse';
              },
            ];
          };
        };
        required: ['uses'];
      };
      VerificationLevels: {
        type: 'integer';
        oneOf: [
          {
            title: 'NONE';
            description: 'unrestricted';
            const: 0;
          },
          {
            title: 'LOW';
            description: 'must have verified email on account';
            const: 1;
          },
          {
            title: 'MEDIUM';
            description: 'must be registered on Discord for longer than 5 minutes';
            const: 2;
          },
          {
            title: 'HIGH';
            description: 'must be a member of the server for longer than 10 minutes';
            const: 3;
          },
          {
            title: 'VERY_HIGH';
            description: 'must have a verified phone number';
            const: 4;
          },
        ];
        format: 'int32';
      };
      VideoQualityModes: {
        type: 'integer';
        oneOf: [
          {
            title: 'AUTO';
            description: 'Discord chooses the quality for optimal performance';
            const: 1;
          },
          {
            title: 'FULL';
            description: '720p';
            const: 2;
          },
        ];
        format: 'int32';
      };
      VoiceRegionResponse: {
        type: 'object';
        properties: {
          id: {
            type: 'string';
          };
          name: {
            type: 'string';
          };
          custom: {
            type: 'boolean';
          };
          deprecated: {
            type: 'boolean';
          };
          optimal: {
            type: 'boolean';
          };
        };
        required: ['id', 'name', 'custom', 'deprecated', 'optimal'];
      };
      VoiceScheduledEventCreateRequest: {
        type: 'object';
        properties: {
          name: {
            type: 'string';
            maxLength: 100;
          };
          description: {
            type: ['string', 'null'];
            maxLength: 1000;
          };
          image: {
            type: ['string', 'null'];
            contentEncoding: 'base64';
          };
          scheduled_start_time: {
            type: 'string';
            format: 'date-time';
          };
          scheduled_end_time: {
            type: ['string', 'null'];
            format: 'date-time';
          };
          privacy_level: {
            $ref: '#/components/schemas/GuildScheduledEventPrivacyLevels';
          };
          entity_type: {
            type: 'integer';
            enum: [2];
            allOf: [
              {
                $ref: '#/components/schemas/GuildScheduledEventEntityTypes';
              },
            ];
            format: 'int32';
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
          entity_metadata: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/EntityMetadataVoice';
              },
            ];
          };
        };
        required: ['name', 'scheduled_start_time', 'privacy_level', 'entity_type'];
      };
      VoiceScheduledEventPatchRequestPartial: {
        type: 'object';
        properties: {
          status: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/GuildScheduledEventStatuses';
              },
            ];
          };
          name: {
            type: 'string';
            maxLength: 100;
          };
          description: {
            type: ['string', 'null'];
            maxLength: 1000;
          };
          image: {
            type: ['string', 'null'];
            contentEncoding: 'base64';
          };
          scheduled_start_time: {
            type: 'string';
            format: 'date-time';
          };
          scheduled_end_time: {
            type: ['string', 'null'];
            format: 'date-time';
          };
          entity_type: {
            oneOf: [
              {
                type: 'null';
              },
              {
                type: 'integer';
                enum: [2];
                allOf: [
                  {
                    $ref: '#/components/schemas/GuildScheduledEventEntityTypes';
                  },
                ];
                format: 'int32';
              },
            ];
          };
          privacy_level: {
            $ref: '#/components/schemas/GuildScheduledEventPrivacyLevels';
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
          entity_metadata: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/EntityMetadataVoice';
              },
            ];
          };
        };
      };
      VoiceScheduledEventResponse: {
        type: 'object';
        properties: {
          id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          guild_id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          name: {
            type: 'string';
          };
          description: {
            type: ['string', 'null'];
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
          creator_id: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/SnowflakeType';
              },
            ];
          };
          creator: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/UserResponse';
              },
            ];
          };
          image: {
            type: ['string', 'null'];
          };
          scheduled_start_time: {
            type: 'string';
            format: 'date-time';
          };
          scheduled_end_time: {
            type: ['string', 'null'];
            format: 'date-time';
          };
          status: {
            $ref: '#/components/schemas/GuildScheduledEventStatuses';
          };
          entity_type: {
            type: 'integer';
            enum: [2];
            allOf: [
              {
                $ref: '#/components/schemas/GuildScheduledEventEntityTypes';
              },
            ];
            format: 'int32';
          };
          entity_id: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/SnowflakeType';
              },
            ];
          };
          user_count: {
            type: ['integer', 'null'];
            format: 'int32';
          };
          privacy_level: {
            $ref: '#/components/schemas/GuildScheduledEventPrivacyLevels';
          };
          user_rsvp: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/ScheduledEventUserResponse';
              },
            ];
          };
          entity_metadata: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/EntityMetadataVoiceResponse';
              },
            ];
          };
        };
        required: ['id', 'guild_id', 'name', 'scheduled_start_time', 'status', 'entity_type', 'privacy_level'];
      };
      WebhookSlackEmbed: {
        type: 'object';
        properties: {
          title: {
            type: ['string', 'null'];
            maxLength: 152133;
          };
          title_link: {
            type: ['string', 'null'];
            maxLength: 2048;
            format: 'uri';
          };
          text: {
            type: ['string', 'null'];
            maxLength: 152133;
          };
          color: {
            type: ['string', 'null'];
            maxLength: 7;
            pattern: '^#(([0-9a-fA-F]{2}){3}|([0-9a-fA-F]){3})$';
          };
          ts: {
            type: ['integer', 'null'];
          };
          pretext: {
            type: ['string', 'null'];
            maxLength: 152133;
          };
          footer: {
            type: ['string', 'null'];
            maxLength: 152133;
          };
          footer_icon: {
            type: ['string', 'null'];
            maxLength: 2048;
            format: 'uri';
          };
          author_name: {
            type: ['string', 'null'];
            maxLength: 152133;
          };
          author_link: {
            type: ['string', 'null'];
            maxLength: 2048;
            format: 'uri';
          };
          author_icon: {
            type: ['string', 'null'];
            maxLength: 2048;
            format: 'uri';
          };
          image_url: {
            type: ['string', 'null'];
            maxLength: 2048;
            format: 'uri';
          };
          thumb_url: {
            type: ['string', 'null'];
            maxLength: 2048;
            format: 'uri';
          };
          fields: {
            type: ['array', 'null'];
            items: {
              $ref: '#/components/schemas/WebhookSlackEmbedField';
            };
            maxItems: 1521;
          };
        };
      };
      WebhookSlackEmbedField: {
        type: 'object';
        properties: {
          name: {
            type: ['string', 'null'];
            maxLength: 152133;
          };
          value: {
            type: ['string', 'null'];
            maxLength: 152133;
          };
          inline: {
            type: ['boolean', 'null'];
          };
        };
      };
      WebhookSourceChannelResponse: {
        type: 'object';
        properties: {
          id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          name: {
            type: 'string';
          };
        };
        required: ['id', 'name'];
      };
      WebhookSourceGuildResponse: {
        type: 'object';
        properties: {
          id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          icon: {
            type: ['string', 'null'];
          };
          name: {
            type: 'string';
          };
        };
        required: ['id', 'name'];
      };
      WebhookTypes: {
        type: 'integer';
        oneOf: [
          {
            title: 'GUILD_INCOMING';
            description: 'Incoming Webhooks can post messages to channels with a generated token';
            const: 1;
          },
          {
            title: 'CHANNEL_FOLLOWER';
            description: 'Channel Follower Webhooks are internal webhooks used with Channel Following to post new messages into channels';
            const: 2;
          },
          {
            title: 'APPLICATION_INCOMING';
            description: 'Application webhooks are webhooks used with Interactions';
            const: 3;
          },
        ];
        format: 'int32';
      };
      WelcomeMessageResponse: {
        type: 'object';
        properties: {
          author_ids: {
            type: 'array';
            items: {
              $ref: '#/components/schemas/SnowflakeType';
            };
          };
          message: {
            type: 'string';
          };
        };
        required: ['author_ids', 'message'];
      };
      WelcomeScreenPatchRequestPartial: {
        type: 'object';
        properties: {
          description: {
            type: ['string', 'null'];
            maxLength: 140;
          };
          welcome_channels: {
            type: ['array', 'null'];
            items: {
              $ref: '#/components/schemas/GuildWelcomeChannel';
            };
            maxItems: 5;
          };
          enabled: {
            type: ['boolean', 'null'];
          };
        };
      };
      WidgetActivity: {
        type: 'object';
        properties: {
          name: {
            type: 'string';
          };
        };
        required: ['name'];
      };
      WidgetChannel: {
        type: 'object';
        properties: {
          id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          name: {
            type: 'string';
          };
          position: {
            type: 'integer';
            format: 'int32';
          };
        };
        required: ['id', 'name', 'position'];
      };
      WidgetImageStyles: {
        type: 'string';
        oneOf: [
          {
            title: 'SHIELD';
            description: 'shield style widget with Discord icon and guild members online count';
            const: 'shield';
          },
          {
            title: 'BANNER1';
            description: 'large image with guild icon, name and online count. "POWERED BY DISCORD" as the footer of the widget';
            const: 'banner1';
          },
          {
            title: 'BANNER2';
            description: 'smaller widget style with guild icon, name and online count. Split on the right with Discord logo';
            const: 'banner2';
          },
          {
            title: 'BANNER3';
            description: 'large image with guild icon, name and online count. In the footer, Discord logo on the left and "Chat Now" on the right';
            const: 'banner3';
          },
          {
            title: 'BANNER4';
            description: 'large Discord logo at the top of the widget. Guild icon, name and online count in the middle portion of the widget and a "JOIN MY SERVER" button at the bottom';
            const: 'banner4';
          },
        ];
      };
      WidgetMember: {
        type: 'object';
        properties: {
          id: {
            type: 'string';
          };
          username: {
            type: 'string';
          };
          discriminator: {
            $ref: '#/components/schemas/WidgetUserDiscriminator';
          };
          avatar: {
            type: 'null';
          };
          status: {
            type: 'string';
          };
          avatar_url: {
            type: 'string';
            format: 'uri';
          };
          activity: {
            oneOf: [
              {
                type: 'null';
              },
              {
                $ref: '#/components/schemas/WidgetActivity';
              },
            ];
          };
          deaf: {
            type: ['boolean', 'null'];
          };
          mute: {
            type: ['boolean', 'null'];
          };
          self_deaf: {
            type: ['boolean', 'null'];
          };
          self_mute: {
            type: ['boolean', 'null'];
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
        required: ['id', 'username', 'discriminator', 'status', 'avatar_url'];
      };
      WidgetResponse: {
        type: 'object';
        properties: {
          id: {
            $ref: '#/components/schemas/SnowflakeType';
          };
          name: {
            type: 'string';
          };
          instant_invite: {
            type: ['string', 'null'];
          };
          channels: {
            type: 'array';
            items: {
              $ref: '#/components/schemas/WidgetChannel';
            };
          };
          members: {
            type: 'array';
            items: {
              $ref: '#/components/schemas/WidgetMember';
            };
          };
          presence_count: {
            type: 'integer';
            format: 'int32';
          };
        };
        required: ['id', 'name', 'channels', 'members', 'presence_count'];
      };
      WidgetSettingsResponse: {
        type: 'object';
        properties: {
          enabled: {
            type: 'boolean';
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
        required: ['enabled'];
      };
      WidgetUserDiscriminator: {
        type: 'string';
        oneOf: [
          {
            title: 'ZEROES';
            const: '0000';
          },
        ];
      };
      Error: {
        type: 'object';
        description: 'A single error, either for an API response or a specific field.';
        properties: {
          code: {
            type: 'integer';
            description: 'Discord internal error code. See error code reference';
          };
          message: {
            type: 'string';
            description: 'Human-readable error message';
          };
        };
        required: ['code', 'message'];
      };
      InnerErrors: {
        type: 'object';
        properties: {
          _errors: {
            type: 'array';
            description: 'The list of errors for this field';
            items: {
              $ref: '#/components/schemas/Error';
            };
          };
        };
        additionalProperties: false;
        required: ['_errors'];
      };
      ErrorDetails: {
        oneOf: [
          {
            type: 'object';
            additionalProperties: {
              $ref: '#/components/schemas/ErrorDetails';
            };
          },
          {
            $ref: '#/components/schemas/InnerErrors';
          },
        ];
      };
      ErrorResponse: {
        type: 'object';
        description: 'Errors object returned by the Discord API';
        allOf: [
          {
            $ref: '#/components/schemas/Error';
          },
          {
            type: 'object';
            properties: {
              errors: {
                $ref: '#/components/schemas/ErrorDetails';
              };
            };
          },
        ];
      };
    };
    securitySchemes: {
      BotToken: {
        type: 'apiKey';
        description: 'Discord bot token';
        name: 'Authorization';
        in: 'header';
      };
      OAuth2: {
        type: 'oauth2';
        flows: {
          implicit: {
            authorizationUrl: 'discord.com/oauth2/authorize';
            refreshUrl: 'https://discord.com/api/oauth2/token';
            scopes: {
              'activities.read': 'allows your app to fetch data from a user\'s "Now Playing/Recently Played" list - requires Discord approval';
              'activities.write': "allows your app to update a user's activity - requires Discord approval (NOT REQUIRED FOR GAMESDK ACTIVITY MANAGER)";
              'applications.builds.read': "allows your app to read build data for a user's applications";
              'applications.builds.upload': "allows your app to upload/update builds for a user's applications - requires Discord approval";
              'applications.commands': 'allows your app to use commands in a guild';
              'applications.commands.permissions.update': 'allows your app to update permissions for its commands in a guild a user has permissions to';
              'applications.entitlements': "allows your app to read entitlements for a user's applications";
              'applications.store.update': "allows your app to read and update store data (SKUs, store listings, achievements, etc.) for a user's applications";
              bot: "for oauth2 bots, this puts the bot in the user's selected guild by default";
              connections: 'allows /users/@me/connections to return linked third-party accounts';
              'dm_channels.read': "allows your app to see information about the user's DMs and group DMs - requires Discord approval";
              email: 'enables /users/@me to return an email';
              'gdm.join': 'allows your app to join users to a group dm';
              guilds: "allows /users/@me/guilds to return basic information about all of a user's guilds";
              'guilds.join': 'allows /guilds/{guild.id}/members/{user.id} to be used for joining users to a guild';
              'guilds.members.read': "allows /users/@me/guilds/{guild.id}/member to return a user's member information in a guild";
              identify: 'allows /users/@me without email';
              'messages.read': 'for local rpc server api access, this allows you to read messages from all client channels (otherwise restricted to channels/guilds your app creates)';
              'relationships.read': "allows your app to know a user's friends and implicit relationships - requires Discord approval";
              rpc: "for local rpc server access, this allows you to control a user's local Discord client - requires Discord approval";
              'rpc.activities.write': "for local rpc server access, this allows you to update a user's activity - requires Discord approval";
              'rpc.notifications.read': 'for local rpc server access, this allows you to receive notifications pushed out to the user - requires Discord approval';
              'rpc.screenshare.read': "for local rpc server access, this allows you to read a user's screenshare status- requires Discord approval";
              'rpc.screenshare.write': "for local rpc server access, this allows you to update a user's screenshare settings- requires Discord approval";
              'rpc.video.read': "for local rpc server access, this allows you to read a user's video status - requires Discord approval";
              'rpc.video.write': "for local rpc server access, this allows you to update a user's video settings - requires Discord approval";
              'rpc.voice.read': "for local rpc server access, this allows you to read a user's voice settings and listen for voice events - requires Discord approval";
              'rpc.voice.write': "for local rpc server access, this allows you to update a user's voice settings - requires Discord approval";
              voice: "allows your app to connect to voice on user's behalf and see all the voice members - requires Discord approval";
              'webhook.incoming': 'this generates a webhook that is returned in the oauth token response for authorization code grants';
            };
          };
          clientCredentials: {
            tokenUrl: 'https://discord.com/api/oauth2/token';
            refreshUrl: 'https://discord.com/api/oauth2/token';
            scopes: {
              'activities.read': 'allows your app to fetch data from a user\'s "Now Playing/Recently Played" list - requires Discord approval';
              'activities.write': "allows your app to update a user's activity - requires Discord approval (NOT REQUIRED FOR GAMESDK ACTIVITY MANAGER)";
              'applications.builds.read': "allows your app to read build data for a user's applications";
              'applications.builds.upload': "allows your app to upload/update builds for a user's applications - requires Discord approval";
              'applications.commands': 'allows your app to use commands in a guild';
              'applications.commands.permissions.update': 'allows your app to update permissions for its commands in a guild a user has permissions to';
              'applications.commands.update': 'allows your app to update its commands using a Bearer token - client credentials grant only';
              'applications.entitlements': "allows your app to read entitlements for a user's applications";
              'applications.store.update': "allows your app to read and update store data (SKUs, store listings, achievements, etc.) for a user's applications";
              bot: "for oauth2 bots, this puts the bot in the user's selected guild by default";
              connections: 'allows /users/@me/connections to return linked third-party accounts';
              'dm_channels.read': "allows your app to see information about the user's DMs and group DMs - requires Discord approval";
              email: 'enables /users/@me to return an email';
              'gdm.join': 'allows your app to join users to a group dm';
              guilds: "allows /users/@me/guilds to return basic information about all of a user's guilds";
              'guilds.join': 'allows /guilds/{guild.id}/members/{user.id} to be used for joining users to a guild';
              'guilds.members.read': "allows /users/@me/guilds/{guild.id}/member to return a user's member information in a guild";
              identify: 'allows /users/@me without email';
              'messages.read': 'for local rpc server api access, this allows you to read messages from all client channels (otherwise restricted to channels/guilds your app creates)';
              'relationships.read': "allows your app to know a user's friends and implicit relationships - requires Discord approval";
              rpc: "for local rpc server access, this allows you to control a user's local Discord client - requires Discord approval";
              'rpc.activities.write': "for local rpc server access, this allows you to update a user's activity - requires Discord approval";
              'rpc.notifications.read': 'for local rpc server access, this allows you to receive notifications pushed out to the user - requires Discord approval';
              'rpc.screenshare.read': "for local rpc server access, this allows you to read a user's screenshare status- requires Discord approval";
              'rpc.screenshare.write': "for local rpc server access, this allows you to update a user's screenshare settings- requires Discord approval";
              'rpc.video.read': "for local rpc server access, this allows you to read a user's video status - requires Discord approval";
              'rpc.video.write': "for local rpc server access, this allows you to update a user's video settings - requires Discord approval";
              'rpc.voice.read': "for local rpc server access, this allows you to read a user's voice settings and listen for voice events - requires Discord approval";
              'rpc.voice.write': "for local rpc server access, this allows you to update a user's voice settings - requires Discord approval";
              voice: "allows your app to connect to voice on user's behalf and see all the voice members - requires Discord approval";
              'webhook.incoming': 'this generates a webhook that is returned in the oauth token response for authorization code grants';
            };
          };
          authorizationCode: {
            authorizationUrl: 'discord.com/oauth2/authorize';
            tokenUrl: 'https://discord.com/api/oauth2/token';
            refreshUrl: 'https://discord.com/api/oauth2/token';
            scopes: {
              'activities.read': 'allows your app to fetch data from a user\'s "Now Playing/Recently Played" list - requires Discord approval';
              'activities.write': "allows your app to update a user's activity - requires Discord approval (NOT REQUIRED FOR GAMESDK ACTIVITY MANAGER)";
              'applications.builds.read': "allows your app to read build data for a user's applications";
              'applications.builds.upload': "allows your app to upload/update builds for a user's applications - requires Discord approval";
              'applications.commands': 'allows your app to use commands in a guild';
              'applications.commands.permissions.update': 'allows your app to update permissions for its commands in a guild a user has permissions to';
              'applications.entitlements': "allows your app to read entitlements for a user's applications";
              'applications.store.update': "allows your app to read and update store data (SKUs, store listings, achievements, etc.) for a user's applications";
              bot: "for oauth2 bots, this puts the bot in the user's selected guild by default";
              connections: 'allows /users/@me/connections to return linked third-party accounts';
              'dm_channels.read': "allows your app to see information about the user's DMs and group DMs - requires Discord approval";
              email: 'enables /users/@me to return an email';
              'gdm.join': 'allows your app to join users to a group dm';
              guilds: "allows /users/@me/guilds to return basic information about all of a user's guilds";
              'guilds.join': 'allows /guilds/{guild.id}/members/{user.id} to be used for joining users to a guild';
              'guilds.members.read': "allows /users/@me/guilds/{guild.id}/member to return a user's member information in a guild";
              identify: 'allows /users/@me without email';
              'messages.read': 'for local rpc server api access, this allows you to read messages from all client channels (otherwise restricted to channels/guilds your app creates)';
              'relationships.read': "allows your app to know a user's friends and implicit relationships - requires Discord approval";
              'role_connections.write': "allows your app to update a user's connection and metadata for the app";
              rpc: "for local rpc server access, this allows you to control a user's local Discord client - requires Discord approval";
              'rpc.activities.write': "for local rpc server access, this allows you to update a user's activity - requires Discord approval";
              'rpc.notifications.read': 'for local rpc server access, this allows you to receive notifications pushed out to the user - requires Discord approval';
              'rpc.screenshare.read': "for local rpc server access, this allows you to read a user's screenshare status- requires Discord approval";
              'rpc.screenshare.write': "for local rpc server access, this allows you to update a user's screenshare settings- requires Discord approval";
              'rpc.video.read': "for local rpc server access, this allows you to read a user's video status - requires Discord approval";
              'rpc.video.write': "for local rpc server access, this allows you to update a user's video settings - requires Discord approval";
              'rpc.voice.read': "for local rpc server access, this allows you to read a user's voice settings and listen for voice events - requires Discord approval";
              'rpc.voice.write': "for local rpc server access, this allows you to update a user's voice settings - requires Discord approval";
              voice: "allows your app to connect to voice on user's behalf and see all the voice members - requires Discord approval";
              'webhook.incoming': 'this generates a webhook that is returned in the oauth token response for authorization code grants';
            };
          };
        };
      };
    };
    responses: {
      ClientErrorResponse: {
        description: 'Client error response';
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/ErrorResponse';
            };
          };
        };
      };
    };
  };
};
