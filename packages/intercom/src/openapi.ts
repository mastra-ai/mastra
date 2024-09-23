// @ts-nocheck
export type openapi = {
  openapi: '3.0.1';
  paths: {
    '/me': {
      get: {
        summary: 'Identify an admin';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
        ];
        tags: ['Admins'];
        operationId: 'identifyAdmin';
        description: '\nYou can view the currently authorised admin along with the embedded app object (a "workspace" in legacy terminology).\n\n> 🚧 Single Sign On\n>\n> If you are building a custom "Log in with Intercom" flow for your site, and you call the `/me` endpoint to identify the logged-in user, you should not accept any sign-ins from users with unverified email addresses as it poses a potential impersonation security risk.\n';
        responses: {
          '200': {
            description: 'Successful response';
            content: {
              'application/json': {
                examples: {
                  'Successful response': {
                    value: {
                      type: 'admin';
                      id: '991267242';
                      email: 'admin1@email.com';
                      name: 'Ciaran1 Lee';
                      email_verified: true;
                      app: {
                        type: 'app';
                        id_code: 'this_is_an_id1_that_should_be_at_least_40';
                        name: 'MyApp 1';
                        created_at: 1717021328;
                        secure: false;
                        identity_verification: false;
                        timezone: 'America/Los_Angeles';
                        region: 'US';
                      };
                      avatar: {
                        type: 'avatar';
                        image_url: 'https://static.intercomassets.com/assets/default-avatars/admins/128.png';
                      };
                      has_inbox_seat: true;
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/admin_with_app';
                };
              };
            };
          };
        };
      };
    };
    '/admins/{id}/away': {
      put: {
        summary: 'Set an admin to away';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
          {
            name: 'id';
            in: 'path';
            required: true;
            description: 'The unique identifier of a given admin';
            schema: {
              type: 'integer';
            };
          },
        ];
        tags: ['Admins'];
        operationId: 'setAwayAdmin';
        description: 'You can set an Admin as away for the Inbox.';
        responses: {
          '200': {
            description: 'Successful response';
            content: {
              'application/json': {
                examples: {
                  'Successful response': {
                    value: {
                      type: 'admin';
                      id: '991267243';
                      name: 'Ciaran2 Lee';
                      email: 'admin2@email.com';
                      away_mode_enabled: true;
                      away_mode_reassign: true;
                      has_inbox_seat: true;
                      team_ids: [];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/admin';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: 'ee1782d2-154b-4a94-824b-144059b4e321';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
          '404': {
            description: 'Admin not found';
            content: {
              'application/json': {
                examples: {
                  'Admin not found': {
                    value: {
                      type: 'error.list';
                      request_id: '20a813b6-c6b4-4430-a9db-12956e806ec1';
                      errors: [
                        {
                          code: 'admin_not_found';
                          message: 'Admin for admin_id not found';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object';
                required: ['away_mode_enabled', 'away_mode_reassign'];
                properties: {
                  away_mode_enabled: {
                    type: 'boolean';
                    description: 'Set to "true" to change the status of the admin to away.';
                    example: true;
                    default: true;
                  };
                  away_mode_reassign: {
                    type: 'boolean';
                    description: 'Set to "true" to assign any new conversation replies to your default inbox.';
                    example: false;
                    default: false;
                  };
                };
              };
              examples: {
                successful_response: {
                  summary: 'Successful response';
                  value: {
                    away_mode_enabled: true;
                    away_mode_reassign: true;
                  };
                };
                admin_not_found: {
                  summary: 'Admin not found';
                  value: {
                    away_mode_enabled: true;
                    away_mode_reassign: true;
                  };
                };
                unauthorized: {
                  summary: 'Unauthorized';
                  value: {
                    away_mode_enabled: true;
                    away_mode_reassign: true;
                  };
                };
              };
            };
          };
        };
      };
    };
    '/admins/activity_logs': {
      get: {
        summary: 'List all activity logs';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
          {
            name: 'created_at_after';
            in: 'query';
            required: true;
            description: 'The start date that you request data for. It must be formatted as a UNIX timestamp.';
            example: '1677253093';
            schema: {
              type: 'string';
            };
          },
          {
            name: 'created_at_before';
            in: 'query';
            required: false;
            description: 'The end date that you request data for. It must be formatted as a UNIX timestamp.';
            example: '1677861493';
            schema: {
              type: 'string';
            };
          },
        ];
        tags: ['Admins'];
        operationId: 'listActivityLogs';
        description: 'You can get a log of activities by all admins in an app.';
        responses: {
          '200': {
            description: 'Successful response';
            content: {
              'application/json': {
                examples: {
                  'Successful response': {
                    value: {
                      type: 'activity_log.list';
                      pages: {
                        type: 'pages';
                        next: null;
                        page: 1;
                        per_page: 20;
                        total_pages: 1;
                      };
                      activity_logs: [
                        {
                          id: 'b12d89d1-922f-4bec-b532-247bb581fd15';
                          performed_by: {
                            type: 'admin';
                            id: '991267247';
                            email: 'admin5@email.com';
                            ip: '127.0.0.1';
                          };
                          metadata: {
                            message: {
                              id: 123;
                              title: 'Initial message title';
                            };
                            before: 'Initial message title';
                            after: 'Eventual message title';
                          };
                          created_at: 1717021333;
                          activity_type: 'message_state_change';
                          activity_description: 'Ciaran5 Lee changed your Initial message title message from Initial message title to Eventual message title.';
                        },
                        {
                          id: 'ab862e22-dac4-430a-bd06-6324b9bfbe53';
                          performed_by: {
                            type: 'admin';
                            id: '991267247';
                            email: 'admin5@email.com';
                            ip: '127.0.0.1';
                          };
                          metadata: {
                            before: 'before';
                            after: 'after';
                          };
                          created_at: 1717021333;
                          activity_type: 'app_name_change';
                          activity_description: 'Ciaran5 Lee changed your app name from before to after.';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/activity_log_list';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: '69a6cf16-1eaf-42f3-bf89-e4a9944f5f89';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
      };
    };
    '/admins': {
      get: {
        summary: 'List all admins';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
        ];
        tags: ['Admins'];
        operationId: 'listAdmins';
        description: 'You can fetch a list of admins for a given workspace.';
        responses: {
          '200': {
            description: 'Successful response';
            content: {
              'application/json': {
                examples: {
                  'Successful response': {
                    value: {
                      type: 'admin.list';
                      admins: [
                        {
                          type: 'admin';
                          email: 'admin7@email.com';
                          id: '991267249';
                          name: 'Ciaran7 Lee';
                          away_mode_enabled: false;
                          away_mode_reassign: false;
                          has_inbox_seat: true;
                          team_ids: [];
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/admin_list';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: '7ce06acd-f398-4faf-8fe8-7c5b8bc5c3ca';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
      };
    };
    '/admins/{id}': {
      get: {
        summary: 'Retrieve an admin';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
          {
            name: 'id';
            in: 'path';
            required: true;
            description: 'The unique identifier of a given admin';
            example: 123;
            schema: {
              type: 'integer';
            };
          },
        ];
        tags: ['Admins'];
        operationId: 'retrieveAdmin';
        description: 'You can retrieve the details of a single admin.';
        responses: {
          '200': {
            description: 'Admin found';
            content: {
              'application/json': {
                examples: {
                  'Admin found': {
                    value: {
                      type: 'admin';
                      id: '991267251';
                      name: 'Ciaran9 Lee';
                      email: 'admin9@email.com';
                      away_mode_enabled: false;
                      away_mode_reassign: false;
                      has_inbox_seat: true;
                      team_ids: [];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/admin';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: '231aad72-f519-4f47-b436-663eb5046063';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
          '404': {
            description: 'Admin not found';
            content: {
              'application/json': {
                examples: {
                  'Admin not found': {
                    value: {
                      type: 'error.list';
                      request_id: '8d8d85cb-c827-44f2-abee-58edbb4d1dda';
                      errors: [
                        {
                          code: 'admin_not_found';
                          message: 'Admin not found';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
      };
    };
    '/articles': {
      get: {
        summary: 'List all articles';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
        ];
        tags: ['Articles'];
        operationId: 'listArticles';
        description: "You can fetch a list of all articles by making a GET request to `https://api.intercom.io/articles`.\n\n> 📘 How are the articles sorted and ordered?\n>\n> Articles will be returned in descending order on the `updated_at` attribute. This means if you need to iterate through results then we'll show the most recently updated articles first.\n";
        responses: {
          '200': {
            description: 'successful';
            content: {
              'application/json': {
                examples: {
                  successful: {
                    value: {
                      type: 'list';
                      pages: {
                        type: 'pages';
                        page: 1;
                        per_page: 25;
                        total_pages: 1;
                      };
                      total_count: 1;
                      data: [
                        {
                          id: '35';
                          type: 'article';
                          workspace_id: 'this_is_an_id33_that_should_be_at_least_4';
                          parent_id: 145;
                          parent_type: 'collection';
                          parent_ids: [];
                          title: 'This is the article title';
                          description: '';
                          body: '';
                          author_id: 991267254;
                          state: 'published';
                          created_at: 1717021340;
                          updated_at: 1717021340;
                          url: 'http://help-center.test/myapp-33/en/articles/35-this-is-the-article-title';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/article_list';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: '78e7c2d8-6d98-4b85-af8a-3e4ae5438eb3';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
      };
      post: {
        summary: 'Create an article';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
        ];
        tags: ['Articles'];
        operationId: 'createArticle';
        description: 'You can create a new article by making a POST request to `https://api.intercom.io/articles`.';
        responses: {
          '200': {
            description: 'article created';
            content: {
              'application/json': {
                examples: {
                  'article created': {
                    value: {
                      id: '38';
                      type: 'article';
                      workspace_id: 'this_is_an_id37_that_should_be_at_least_4';
                      parent_id: 147;
                      parent_type: 'collection';
                      parent_ids: [];
                      statistics: {
                        type: 'article_statistics';
                        views: 0;
                        conversations: 0;
                        reactions: 0;
                        happy_reaction_percentage: 0;
                        neutral_reaction_percentage: 0;
                        sad_reaction_percentage: 0;
                      };
                      title: 'Thanks for everything';
                      description: 'Description of the Article';
                      body: '<p class="no-margin">Body of the Article</p>';
                      author_id: 991267259;
                      state: 'published';
                      created_at: 1717021342;
                      updated_at: 1717021342;
                      url: 'http://help-center.test/myapp-37/en/articles/38-thanks-for-everything';
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/article';
                };
              };
            };
          };
          '400': {
            description: 'Bad Request';
            content: {
              'application/json': {
                examples: {
                  'Bad Request': {
                    value: {
                      type: 'error.list';
                      request_id: 'dc6520ae-9647-4c5e-a83f-344532dc9a59';
                      errors: [
                        {
                          code: 'parameter_not_found';
                          message: 'author_id must be in the main body or default locale translated_content object';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: '58823089-52e6-4242-8693-b881c74a26d7';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/create_article_request';
              };
              examples: {
                article_created: {
                  summary: 'article created';
                  value: {
                    title: 'Thanks for everything';
                    description: 'Description of the Article';
                    body: 'Body of the Article';
                    author_id: 991267259;
                    state: 'published';
                    parent_id: 147;
                    parent_type: 'collection';
                    translated_content: {
                      fr: {
                        title: 'Merci pour tout';
                        description: "Description de l'article";
                        body: "Corps de l'article";
                        author_id: 991267259;
                        state: 'published';
                      };
                    };
                  };
                };
                bad_request: {
                  summary: 'Bad Request';
                  value: {
                    title: 'Thanks for everything';
                    description: 'Description of the Article';
                    body: 'Body of the Article';
                    state: 'published';
                  };
                };
              };
            };
          };
        };
      };
    };
    '/articles/{id}': {
      get: {
        summary: 'Retrieve an article';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
          {
            name: 'id';
            in: 'path';
            required: true;
            description: 'The unique identifier for the article which is given by Intercom.';
            example: 123;
            schema: {
              type: 'integer';
            };
          },
        ];
        tags: ['Articles'];
        operationId: 'retrieveArticle';
        description: 'You can fetch the details of a single article by making a GET request to `https://api.intercom.io/articles/<id>`.';
        responses: {
          '200': {
            description: 'Article found';
            content: {
              'application/json': {
                examples: {
                  'Article found': {
                    value: {
                      id: '41';
                      type: 'article';
                      workspace_id: 'this_is_an_id43_that_should_be_at_least_4';
                      parent_id: 150;
                      parent_type: 'collection';
                      parent_ids: [];
                      statistics: {
                        type: 'article_statistics';
                        views: 0;
                        conversations: 0;
                        reactions: 0;
                        happy_reaction_percentage: 0;
                        neutral_reaction_percentage: 0;
                        sad_reaction_percentage: 0;
                      };
                      title: 'This is the article title';
                      description: '';
                      body: '';
                      author_id: 991267264;
                      state: 'published';
                      created_at: 1717021344;
                      updated_at: 1717021344;
                      url: 'http://help-center.test/myapp-43/en/articles/41-this-is-the-article-title';
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/article';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: '4df4917b-c4d0-45a9-a61e-6c3597e96e10';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
          '404': {
            description: 'Article not found';
            content: {
              'application/json': {
                examples: {
                  'Article not found': {
                    value: {
                      type: 'error.list';
                      request_id: 'f15f878f-3fb3-47f0-acc7-c7adcef0c61d';
                      errors: [
                        {
                          code: 'not_found';
                          message: 'Resource Not Found';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
      };
      put: {
        summary: 'Update an article';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
          {
            name: 'id';
            in: 'path';
            required: true;
            description: 'The unique identifier for the article which is given by Intercom.';
            example: 123;
            schema: {
              type: 'integer';
            };
          },
        ];
        tags: ['Articles'];
        operationId: 'updateArticle';
        description: 'You can update the details of a single article by making a PUT request to `https://api.intercom.io/articles/<id>`.';
        responses: {
          '200': {
            description: 'successful';
            content: {
              'application/json': {
                examples: {
                  successful: {
                    value: {
                      id: '44';
                      type: 'article';
                      workspace_id: 'this_is_an_id49_that_should_be_at_least_4';
                      parent_id: 153;
                      parent_type: 'collection';
                      parent_ids: [];
                      statistics: {
                        type: 'article_statistics';
                        views: 0;
                        conversations: 0;
                        reactions: 0;
                        happy_reaction_percentage: 0;
                        neutral_reaction_percentage: 0;
                        sad_reaction_percentage: 0;
                      };
                      title: 'Christmas is here!';
                      description: '';
                      body: '<p class="no-margin">New gifts in store for the jolly season</p>';
                      author_id: 991267270;
                      state: 'published';
                      created_at: 1717021347;
                      updated_at: 1717021347;
                      url: 'http://help-center.test/myapp-49/en/articles/44-christmas-is-here';
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/article';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: 'b48c9005-6e42-46aa-a792-ffe1279164c0';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
          '404': {
            description: 'Article Not Found';
            content: {
              'application/json': {
                examples: {
                  'Article Not Found': {
                    value: {
                      type: 'error.list';
                      request_id: 'ebc188c3-3680-4724-a6a4-939f760cf1ff';
                      errors: [
                        {
                          code: 'not_found';
                          message: 'Resource Not Found';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/update_article_request';
              };
              examples: {
                successful: {
                  summary: 'successful';
                  value: {
                    title: 'Christmas is here!';
                    body: '<p>New gifts in store for the jolly season</p>';
                  };
                };
                article_not_found: {
                  summary: 'Article Not Found';
                  value: {
                    title: 'Christmas is here!';
                    body: '<p>New gifts in store for the jolly season</p>';
                  };
                };
              };
            };
          };
        };
      };
      delete: {
        summary: 'Delete an article';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
          {
            name: 'id';
            in: 'path';
            required: true;
            description: 'The unique identifier for the article which is given by Intercom.';
            example: 123;
            schema: {
              type: 'integer';
            };
          },
        ];
        tags: ['Articles'];
        operationId: 'deleteArticle';
        description: 'You can delete a single article by making a DELETE request to `https://api.intercom.io/articles/<id>`.';
        responses: {
          '200': {
            description: 'successful';
            content: {
              'application/json': {
                examples: {
                  successful: {
                    value: {
                      id: '47';
                      object: 'article';
                      deleted: true;
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/deleted_article_object';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: '50e2264e-9795-4eda-839b-8435da6eb115';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
          '404': {
            description: 'Article Not Found';
            content: {
              'application/json': {
                examples: {
                  'Article Not Found': {
                    value: {
                      type: 'error.list';
                      request_id: '1c891e3d-b5c7-4f63-93f1-c131397c71ec';
                      errors: [
                        {
                          code: 'not_found';
                          message: 'Resource Not Found';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
      };
    };
    '/help_center/collections': {
      get: {
        summary: 'List all collections';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
        ];
        tags: ['Help Center'];
        operationId: 'listAllCollections';
        description: "You can fetch a list of all collections by making a GET request to `https://api.intercom.io/help_center/collections`.\n\nCollections will be returned in descending order on the `updated_at` attribute. This means if you need to iterate through results then we'll show the most recently updated collections first.\n";
        responses: {
          '200': {
            description: 'Successful';
            content: {
              'application/json': {
                examples: {
                  Successful: {
                    value: {
                      type: 'list';
                      data: [
                        {
                          id: '161';
                          workspace_id: 'this_is_an_id63_that_should_be_at_least_4';
                          name: 'English collection title';
                          url: 'http://help-center.test/myapp-63/collection-17';
                          order: 17;
                          created_at: 1717021353;
                          updated_at: 1717021353;
                          description: 'english collection description';
                          icon: 'bookmark';
                          help_center_id: 89;
                          type: 'collection';
                        },
                      ];
                      total_count: 1;
                      pages: {
                        type: 'pages';
                        page: 1;
                        per_page: 20;
                        total_pages: 1;
                      };
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/collection_list';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: '26131e21-0b21-495d-8931-162525858184';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
      };
      post: {
        summary: 'Create a collection';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
        ];
        tags: ['Help Center'];
        operationId: 'createCollection';
        description: 'You can create a new collection by making a POST request to `https://api.intercom.io/help_center/collections.`';
        responses: {
          '200': {
            description: 'collection created';
            content: {
              'application/json': {
                examples: {
                  'collection created': {
                    value: {
                      id: '167';
                      workspace_id: 'this_is_an_id67_that_should_be_at_least_4';
                      name: 'Thanks for everything';
                      url: 'http://help-center.test/myapp-67/';
                      order: 1;
                      created_at: 1717021354;
                      updated_at: 1717021354;
                      description: '';
                      icon: 'book-bookmark';
                      help_center_id: 91;
                      type: 'collection';
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/collection';
                };
              };
            };
          };
          '400': {
            description: 'Bad Request';
            content: {
              'application/json': {
                examples: {
                  'Bad Request': {
                    value: {
                      type: 'error.list';
                      request_id: '7ad38384-798f-4780-a4e7-98e6e52ca290';
                      errors: [
                        {
                          code: 'parameter_not_found';
                          message: 'Name is a required parameter.';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: '834f5ddd-4c83-457a-848f-054e4bd86eae';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/create_collection_request';
              };
              examples: {
                collection_created: {
                  summary: 'collection created';
                  value: {
                    name: 'Thanks for everything';
                  };
                };
                bad_request: {
                  summary: 'Bad Request';
                  value: {
                    description: 'Missing required parameter';
                  };
                };
              };
            };
          };
        };
      };
    };
    '/help_center/collections/{id}': {
      get: {
        summary: 'Retrieve a collection';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
          {
            name: 'id';
            in: 'path';
            required: true;
            description: 'The unique identifier for the collection which is given by Intercom.';
            example: 123;
            schema: {
              type: 'integer';
            };
          },
        ];
        tags: ['Help Center'];
        operationId: 'retrieveCollection';
        description: 'You can fetch the details of a single collection by making a GET request to `https://api.intercom.io/help_center/collections/<id>`.';
        responses: {
          '200': {
            description: 'Collection found';
            content: {
              'application/json': {
                examples: {
                  'Collection found': {
                    value: {
                      id: '172';
                      workspace_id: 'this_is_an_id73_that_should_be_at_least_4';
                      name: 'English collection title';
                      url: 'http://help-center.test/myapp-73/collection-22';
                      order: 22;
                      created_at: 1717021355;
                      updated_at: 1717021355;
                      description: 'english collection description';
                      icon: 'bookmark';
                      help_center_id: 94;
                      type: 'collection';
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/collection';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: 'f4bd9fb5-b105-4f16-971a-7f0ba29023f1';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
          '404': {
            description: 'Collection not found';
            content: {
              'application/json': {
                examples: {
                  'Collection not found': {
                    value: {
                      type: 'error.list';
                      request_id: 'c5a684d9-dde7-426d-b220-e624931cc6df';
                      errors: [
                        {
                          code: 'not_found';
                          message: 'Resource Not Found';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
      };
      put: {
        summary: 'Update a collection';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
          {
            name: 'id';
            in: 'path';
            required: true;
            description: 'The unique identifier for the collection which is given by Intercom.';
            example: 123;
            schema: {
              type: 'integer';
            };
          },
        ];
        tags: ['Help Center'];
        operationId: 'updateCollection';
        description: 'You can update the details of a single collection by making a PUT request to `https://api.intercom.io/collections/<id>`.';
        responses: {
          '200': {
            description: 'successful';
            content: {
              'application/json': {
                examples: {
                  successful: {
                    value: {
                      id: '178';
                      workspace_id: 'this_is_an_id79_that_should_be_at_least_4';
                      name: 'Update collection name';
                      url: 'http://help-center.test/myapp-79/collection-25';
                      order: 25;
                      created_at: 1717021357;
                      updated_at: 1717021357;
                      description: 'english collection description';
                      icon: 'folder';
                      help_center_id: 97;
                      type: 'collection';
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/collection';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: '7ba596ad-8e27-4dbc-8c3d-4982d3c8b988';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
          '404': {
            description: 'Collection Not Found';
            content: {
              'application/json': {
                examples: {
                  'Collection Not Found': {
                    value: {
                      type: 'error.list';
                      request_id: '63095699-29bc-4fd8-bb65-0de9b8e547a1';
                      errors: [
                        {
                          code: 'not_found';
                          message: 'Resource Not Found';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/update_collection_request';
              };
              examples: {
                successful: {
                  summary: 'successful';
                  value: {
                    name: 'Update collection name';
                  };
                };
                collection_not_found: {
                  summary: 'Collection Not Found';
                  value: {
                    name: 'Update collection name';
                  };
                };
              };
            };
          };
        };
      };
      delete: {
        summary: 'Delete a collection';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
          {
            name: 'id';
            in: 'path';
            required: true;
            description: 'The unique identifier for the collection which is given by Intercom.';
            example: 123;
            schema: {
              type: 'integer';
            };
          },
        ];
        tags: ['Help Center'];
        operationId: 'deleteCollection';
        description: 'You can delete a single collection by making a DELETE request to `https://api.intercom.io/collections/<id>`.';
        responses: {
          '200': {
            description: 'successful';
            content: {
              'application/json': {
                examples: {
                  successful: {
                    value: {
                      id: '184';
                      object: 'collection';
                      deleted: true;
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/deleted_collection_object';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: '0c63c1fa-7eef-47e7-a49c-cff4bb859cb2';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
          '404': {
            description: 'collection Not Found';
            content: {
              'application/json': {
                examples: {
                  'collection Not Found': {
                    value: {
                      type: 'error.list';
                      request_id: '4d55ff13-21ee-4dae-835a-dca073c727e6';
                      errors: [
                        {
                          code: 'not_found';
                          message: 'Resource Not Found';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
      };
    };
    '/help_center/help_centers/{id}': {
      get: {
        summary: 'Retrieve a Help Center';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
          {
            name: 'id';
            in: 'path';
            required: true;
            description: 'The unique identifier for the collection which is given by Intercom.';
            example: 123;
            schema: {
              type: 'integer';
            };
          },
        ];
        tags: ['Help Center'];
        operationId: 'retrieveHelpCenter';
        description: 'You can fetch the details of a single Help Center by making a GET request to `https://api.intercom.io/help_center/help_center/<id>`.';
        responses: {
          '200': {
            description: 'Collection found';
            content: {
              'application/json': {
                examples: {
                  'Collection found': {
                    value: {
                      id: '103';
                      workspace_id: 'this_is_an_id91_that_should_be_at_least_4';
                      created_at: 1717021361;
                      updated_at: 1717021361;
                      identifier: 'help-center-1';
                      website_turned_on: false;
                      display_name: 'Intercom Help Center';
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/help_center';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: 'ba42a13b-92b4-4322-8c13-10ed6ffd493e';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
          '404': {
            description: 'Collection not found';
            content: {
              'application/json': {
                examples: {
                  'Collection not found': {
                    value: {
                      type: 'error.list';
                      request_id: '19d9dda0-1643-4a16-8b4e-e1690ef5d27c';
                      errors: [
                        {
                          code: 'not_found';
                          message: 'Resource Not Found';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
      };
    };
    '/help_center/help_centers': {
      get: {
        summary: 'List all Help Centers';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
        ];
        tags: ['Help Center'];
        operationId: 'listHelpCenters';
        description: 'You can list all Help Centers by making a GET request to `https://api.intercom.io/help_center/help_centers`.';
        responses: {
          '200': {
            description: 'Help Centers found';
            content: {
              'application/json': {
                examples: {
                  'Help Centers found': {
                    value: {
                      type: 'list';
                      data: [];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/help_center_list';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: '8f33a54a-8db1-43c2-9a80-59e0e6779333';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
      };
    };
    '/help_center/sections': {
      get: {
        summary: 'List all sections';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
        ];
        tags: ['Help Center'];
        operationId: 'listAllSections';
        description: "You can fetch a list of all sections by making a GET request to `https://api.intercom.io/help_center/sections`.\n> 📘 How are the sections sorted and ordered?\n>\n> Sections will be returned in descending order on the `updated_at` attribute. This means if you need to iterate through results then we'll show the most recently updated sections first.\n";
        responses: {
          '200': {
            description: 'Successful';
            content: {
              'application/json': {
                examples: {
                  Successful: {
                    value: {
                      type: 'list';
                      data: [
                        {
                          id: '191';
                          workspace_id: 'this_is_an_id101_that_should_be_at_least_';
                          name: 'English section title';
                          url: 'http://help-center.test/myapp-101/section-15';
                          order: 15;
                          created_at: 1717021363;
                          updated_at: 1717021363;
                          type: 'section';
                          parent_id: 190;
                        },
                      ];
                      total_count: 1;
                      pages: {
                        type: 'pages';
                        page: 1;
                        per_page: 20;
                        total_pages: 1;
                      };
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/section_list';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: 'cf47bffc-9759-4792-8556-a25fbe66ed45';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
      };
      post: {
        summary: 'Create a section';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
        ];
        tags: ['Help Center'];
        operationId: 'createSection';
        description: 'You can create a new section by making a POST request to `https://api.intercom.io/help_center/sections.`';
        responses: {
          '200': {
            description: 'section created';
            content: {
              'application/json': {
                examples: {
                  'section created': {
                    value: {
                      id: '196';
                      workspace_id: 'this_is_an_id105_that_should_be_at_least_';
                      name: 'Thanks for everything';
                      url: 'http://help-center.test/myapp-105/';
                      order: 1;
                      created_at: 1717021364;
                      updated_at: 1717021364;
                      type: 'section';
                      parent_id: '194';
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/section';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: '3053d544-e1a1-4fd8-9662-0f74ff782f14';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/create_section_request';
              };
              examples: {
                section_created: {
                  summary: 'section created';
                  value: {
                    name: 'Thanks for everything';
                    parent_id: 194;
                  };
                };
              };
            };
          };
        };
      };
    };
    '/help_center/sections/{id}': {
      get: {
        summary: 'Retrieve a section';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
          {
            name: 'id';
            in: 'path';
            required: true;
            description: 'The unique identifier for the section which is given by Intercom.';
            example: 123;
            schema: {
              type: 'integer';
            };
          },
        ];
        tags: ['Help Center'];
        operationId: 'retrieveSection';
        description: 'You can fetch the details of a single section by making a GET request to `https://api.intercom.io/help_center/sections/<id>`.';
        responses: {
          '200': {
            description: 'Section found';
            content: {
              'application/json': {
                examples: {
                  'Section found': {
                    value: {
                      id: '200';
                      workspace_id: 'this_is_an_id109_that_should_be_at_least_';
                      name: 'English section title';
                      url: 'http://help-center.test/myapp-109/section-19';
                      order: 19;
                      created_at: 1717021365;
                      updated_at: 1717021365;
                      type: 'section';
                      parent_id: 199;
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/section';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: 'ddd1b999-84bc-414b-8e83-d47e3fb1660a';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
          '404': {
            description: 'Section not found';
            content: {
              'application/json': {
                examples: {
                  'Section not found': {
                    value: {
                      type: 'error.list';
                      request_id: '6fccbab7-24fa-4eed-8686-c241d4bbdb86';
                      errors: [
                        {
                          code: 'not_found';
                          message: 'Resource Not Found';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
      };
      put: {
        summary: 'Update a section';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
          {
            name: 'id';
            in: 'path';
            required: true;
            description: 'The unique identifier for the section which is given by Intercom.';
            example: 123;
            schema: {
              type: 'integer';
            };
          },
        ];
        tags: ['Help Center'];
        operationId: 'updateSection';
        description: 'You can update the details of a single section by making a PUT request to `https://api.intercom.io/sections/<id>`.';
        responses: {
          '200': {
            description: 'successful';
            content: {
              'application/json': {
                examples: {
                  successful: {
                    value: {
                      id: '206';
                      workspace_id: 'this_is_an_id115_that_should_be_at_least_';
                      name: 'Update section name';
                      url: 'http://help-center.test/myapp-115/section-22';
                      order: 22;
                      created_at: 1717021366;
                      updated_at: 1717021367;
                      type: 'section';
                      parent_id: '205';
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/section';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: '1c08c7df-d5a9-4227-aba7-d252280baaaa';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
          '404': {
            description: 'Section Not Found';
            content: {
              'application/json': {
                examples: {
                  'Section Not Found': {
                    value: {
                      type: 'error.list';
                      request_id: '70d7d473-e3d1-4630-b310-3e7a327e9a74';
                      errors: [
                        {
                          code: 'not_found';
                          message: 'Resource Not Found';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/update_section_request';
              };
              examples: {
                successful: {
                  summary: 'successful';
                  value: {
                    name: 'Update section name';
                    parent_id: 205;
                  };
                };
                section_not_found: {
                  summary: 'Section Not Found';
                  value: {
                    name: 'Update section name';
                    parent_id: 207;
                  };
                };
              };
            };
          };
        };
      };
      delete: {
        summary: 'Delete a section';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
          {
            name: 'id';
            in: 'path';
            required: true;
            description: 'The unique identifier for the section which is given by Intercom.';
            example: 123;
            schema: {
              type: 'integer';
            };
          },
        ];
        tags: ['Help Center'];
        operationId: 'deleteSection';
        description: 'You can delete a single section by making a DELETE request to `https://api.intercom.io/sections/<id>`.';
        responses: {
          '200': {
            description: 'successful';
            content: {
              'application/json': {
                examples: {
                  successful: {
                    value: {
                      id: '212';
                      object: 'section';
                      deleted: true;
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/deleted_section_object';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: 'f48d51c1-cebd-4805-9268-4a8c8459cc4f';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
          '404': {
            description: 'section Not Found';
            content: {
              'application/json': {
                examples: {
                  'section Not Found': {
                    value: {
                      type: 'error.list';
                      request_id: 'd2b2e713-177e-43e9-9e07-51ba367845c9';
                      errors: [
                        {
                          code: 'not_found';
                          message: 'Resource Not Found';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
      };
    };
    '/companies': {
      post: {
        summary: 'Create or Update a company';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
        ];
        tags: ['Companies'];
        operationId: 'createOrUpdateCompany';
        description: 'You can create or update a company.\n\nCompanies will be only visible in Intercom when there is at least one associated user.\n\nCompanies are looked up via `company_id` in a `POST` request, if not found via `company_id`, the new company will be created, if found, that company will be updated.\n\n{% admonition type="attention" name="Using `company_id`" %}\n  You can set a unique `company_id` value when creating a company. However, it is not possible to update `company_id`. Be sure to set a unique value once upon creation of the company.\n{% /admonition %}\n';
        responses: {
          '200': {
            description: 'Successful';
            content: {
              'application/json': {
                examples: {
                  Successful: {
                    value: {
                      type: 'company';
                      company_id: 'company_remote_id';
                      id: '6657aaba6abd0164c24b0c8e';
                      app_id: 'this_is_an_id127_that_should_be_at_least_';
                      name: 'my company';
                      remote_created_at: 1374138000;
                      created_at: 1717021370;
                      updated_at: 1717021370;
                      monthly_spend: 0;
                      session_count: 0;
                      user_count: 0;
                      tags: {
                        type: 'tag.list';
                        tags: [];
                      };
                      segments: {
                        type: 'segment.list';
                        segments: [];
                      };
                      plan: {};
                      custom_attributes: {
                        creation_source: 'api';
                      };
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/company';
                };
              };
            };
          };
          '400': {
            description: 'Bad Request';
            content: {
              'application/json': {
                examples: {
                  'Bad Request': {
                    value: {
                      type: 'error.list';
                      request_id: null;
                      errors: [
                        {
                          code: 'bad_request';
                          message: "bad 'test' parameter";
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: 'bfe6a349-0654-4e5e-b9c8-f3fdda83e0fa';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/create_or_update_company_request';
              };
              examples: {
                successful: {
                  summary: 'Successful';
                  value: {
                    company_id: 'company_remote_id';
                    name: 'my company';
                    remote_created_at: 1374138000;
                  };
                };
                bad_request: {
                  summary: 'Bad Request';
                  value: {
                    test: 'invalid';
                  };
                };
              };
            };
          };
        };
      };
      get: {
        summary: 'Retrieve companies';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
          {
            name: 'name';
            in: 'query';
            required: false;
            description: 'The `name` of the company to filter by.';
            example: 'my company';
            schema: {
              type: 'string';
            };
          },
          {
            name: 'company_id';
            in: 'query';
            required: false;
            description: 'The `company_id` of the company to filter by.';
            example: '12345';
            schema: {
              type: 'string';
            };
          },
          {
            name: 'tag_id';
            in: 'query';
            required: false;
            description: 'The `tag_id` of the company to filter by.';
            example: '678910';
            schema: {
              type: 'string';
            };
          },
          {
            name: 'segment_id';
            in: 'query';
            required: false;
            description: 'The `segment_id` of the company to filter by.';
            example: '98765';
            schema: {
              type: 'string';
            };
          },
          {
            name: 'page';
            in: 'query';
            required: false;
            description: 'The page of results to fetch. Defaults to first page';
            example: 1;
            schema: {
              type: 'integer';
            };
          },
          {
            name: 'per_page';
            in: 'query';
            required: false;
            description: 'How many results to display per page. Defaults to 15';
            example: 15;
            schema: {
              type: 'integer';
            };
          },
        ];
        tags: ['Companies'];
        operationId: 'retrieveCompany';
        description: 'You can fetch a single company by passing in `company_id` or `name`.\n\n  `https://api.intercom.io/companies?name={name}`\n\n  `https://api.intercom.io/companies?company_id={company_id}`\n\nYou can fetch all companies and filter by `segment_id` or `tag_id` as a query parameter.\n\n  `https://api.intercom.io/companies?tag_id={tag_id}`\n\n  `https://api.intercom.io/companies?segment_id={segment_id}`\n';
        responses: {
          '200': {
            description: 'Successful';
            content: {
              'application/json': {
                examples: {
                  Successful: {
                    value: {
                      type: 'list';
                      data: [
                        {
                          type: 'company';
                          company_id: 'remote_companies_scroll_2';
                          id: '6657aabc6abd0164c24b0c96';
                          app_id: 'this_is_an_id133_that_should_be_at_least_';
                          name: 'IntercomQATest1';
                          remote_created_at: 1717021372;
                          created_at: 1717021372;
                          updated_at: 1717021372;
                          monthly_spend: 0;
                          session_count: 0;
                          user_count: 4;
                          tags: {
                            type: 'tag.list';
                            tags: [];
                          };
                          segments: {
                            type: 'segment.list';
                            segments: [];
                          };
                          plan: {};
                          custom_attributes: {};
                        },
                      ];
                      pages: {
                        type: 'pages';
                        next: null;
                        page: 1;
                        per_page: 15;
                        total_pages: 1;
                      };
                      total_count: 1;
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/company_list';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: '7aebb259-19d4-4319-87ef-5be8441c07b6';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
          '404': {
            description: 'Company Not Found';
            content: {
              'application/json': {
                examples: {
                  'Company Not Found': {
                    value: {
                      type: 'error.list';
                      request_id: '1f01a6c6-5bfd-4b36-9778-aaf35e7c40b3';
                      errors: [
                        {
                          code: 'company_not_found';
                          message: 'Company Not Found';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
      };
    };
    '/companies/{id}': {
      get: {
        summary: 'Retrieve a company by ID';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
          {
            name: 'id';
            in: 'path';
            required: true;
            description: 'The unique identifier for the company which is given by Intercom';
            example: '5f4d3c1c-7b1b-4d7d-a97e-6095715c6632';
            schema: {
              type: 'string';
            };
          },
        ];
        tags: ['Companies'];
        operationId: 'RetrieveACompanyById';
        description: 'You can fetch a single company.';
        responses: {
          '200': {
            description: 'Successful';
            content: {
              'application/json': {
                examples: {
                  Successful: {
                    value: {
                      type: 'company';
                      company_id: '1';
                      id: '6657aabe6abd0164c24b0ca1';
                      app_id: 'this_is_an_id139_that_should_be_at_least_';
                      name: 'company1';
                      remote_created_at: 1717021374;
                      created_at: 1717021374;
                      updated_at: 1717021374;
                      monthly_spend: 0;
                      session_count: 0;
                      user_count: 1;
                      tags: {
                        type: 'tag.list';
                        tags: [];
                      };
                      segments: {
                        type: 'segment.list';
                        segments: [];
                      };
                      plan: {};
                      custom_attributes: {};
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/company';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: 'a2e85fb1-4b73-4001-81f1-59b1eae9acbe';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
          '404': {
            description: 'Company Not Found';
            content: {
              'application/json': {
                examples: {
                  'Company Not Found': {
                    value: {
                      type: 'error.list';
                      request_id: '6f14da94-ea76-4693-8ee8-f7d0cfdf4c6e';
                      errors: [
                        {
                          code: 'company_not_found';
                          message: 'Company Not Found';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
      };
      put: {
        summary: 'Update a company';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
          {
            name: 'id';
            in: 'path';
            required: true;
            description: 'The unique identifier for the company which is given by Intercom';
            example: '5f4d3c1c-7b1b-4d7d-a97e-6095715c6632';
            schema: {
              type: 'string';
            };
          },
        ];
        tags: ['Companies'];
        operationId: 'UpdateCompany';
        description: 'You can update a single company using the Intercom provisioned `id`.\n\n{% admonition type="attention" name="Using `company_id`" %}\n  When updating a company it is not possible to update `company_id`. This can only be set once upon creation of the company.\n{% /admonition %}\n';
        responses: {
          '200': {
            description: 'Successful';
            content: {
              'application/json': {
                examples: {
                  Successful: {
                    value: {
                      type: 'company';
                      company_id: '1';
                      id: '6657aac06abd0164c24b0cab';
                      app_id: 'this_is_an_id145_that_should_be_at_least_';
                      name: 'company2';
                      remote_created_at: 1717021376;
                      created_at: 1717021376;
                      updated_at: 1717021376;
                      monthly_spend: 0;
                      session_count: 0;
                      user_count: 1;
                      tags: {
                        type: 'tag.list';
                        tags: [];
                      };
                      segments: {
                        type: 'segment.list';
                        segments: [];
                      };
                      plan: {};
                      custom_attributes: {};
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/company';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: '5457ba38-3d4e-47c1-98f2-8ea519cbd63f';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
          '404': {
            description: 'Company Not Found';
            content: {
              'application/json': {
                examples: {
                  'Company Not Found': {
                    value: {
                      type: 'error.list';
                      request_id: '1dc7b16f-9368-42a7-97e7-db4068df5c6c';
                      errors: [
                        {
                          code: 'company_not_found';
                          message: 'Company Not Found';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
      };
      delete: {
        summary: 'Delete a company';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
          {
            name: 'id';
            in: 'path';
            required: true;
            description: 'The unique identifier for the company which is given by Intercom';
            example: '5f4d3c1c-7b1b-4d7d-a97e-6095715c6632';
            schema: {
              type: 'string';
            };
          },
        ];
        tags: ['Companies'];
        operationId: 'deleteCompany';
        description: 'You can delete a single company.';
        responses: {
          '200': {
            description: 'Successful';
            content: {
              'application/json': {
                examples: {
                  Successful: {
                    value: {
                      id: '6657aac36abd0164c24b0cb5';
                      object: 'company';
                      deleted: true;
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/deleted_company_object';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: 'b1857b1c-7be0-4c1b-b417-991e48903439';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
          '404': {
            description: 'Company Not Found';
            content: {
              'application/json': {
                examples: {
                  'Company Not Found': {
                    value: {
                      type: 'error.list';
                      request_id: 'fc9dc442-d14b-4500-bd17-340d4081e0a8';
                      errors: [
                        {
                          code: 'company_not_found';
                          message: 'Company Not Found';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
      };
    };
    '/companies/{id}/contacts': {
      get: {
        summary: 'List attached contacts';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
          {
            name: 'id';
            in: 'path';
            required: true;
            description: 'The unique identifier for the company which is given by Intercom';
            example: '5f4d3c1c-7b1b-4d7d-a97e-6095715c6632';
            schema: {
              type: 'string';
            };
          },
        ];
        tags: ['Companies', 'Contacts'];
        operationId: 'ListAttachedContacts';
        description: 'You can fetch a list of all contacts that belong to a company.';
        responses: {
          '200': {
            description: 'Successful';
            content: {
              'application/json': {
                examples: {
                  Successful: {
                    value: {
                      type: 'list';
                      data: [];
                      total_count: 0;
                      pages: {
                        type: 'pages';
                        page: 1;
                        per_page: 50;
                        total_pages: 0;
                      };
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/company_attached_contacts';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: '8c869368-88be-4489-8a12-588bae568529';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
          '404': {
            description: 'Company Not Found';
            content: {
              'application/json': {
                examples: {
                  'Company Not Found': {
                    value: {
                      type: 'error.list';
                      request_id: '3f658ef0-56a2-48f2-a3ba-f86b379a75eb';
                      errors: [
                        {
                          code: 'company_not_found';
                          message: 'Company Not Found';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
      };
    };
    '/companies/{id}/segments': {
      get: {
        summary: 'List attached segments for companies';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
          {
            name: 'id';
            in: 'path';
            required: true;
            description: 'The unique identifier for the company which is given by Intercom';
            example: '5f4d3c1c-7b1b-4d7d-a97e-6095715c6632';
            schema: {
              type: 'string';
            };
          },
        ];
        tags: ['Companies'];
        operationId: 'ListAttachedSegmentsForCompanies';
        description: 'You can fetch a list of all segments that belong to a company.';
        responses: {
          '200': {
            description: 'Successful';
            content: {
              'application/json': {
                examples: {
                  Successful: {
                    value: {
                      type: 'list';
                      data: [];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/company_attached_segments';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: 'd835d6ef-48b4-4ba9-9814-86e66e5bd8e9';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
          '404': {
            description: 'Company Not Found';
            content: {
              'application/json': {
                examples: {
                  'Company Not Found': {
                    value: {
                      type: 'error.list';
                      request_id: '4b8e5c25-306a-4073-b5ae-d87a2c96519d';
                      errors: [
                        {
                          code: 'company_not_found';
                          message: 'Company Not Found';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
      };
    };
    '/companies/list': {
      post: {
        summary: 'List all companies';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
          {
            name: 'page';
            in: 'query';
            required: false;
            description: 'The page of results to fetch. Defaults to first page';
            example: 1;
            schema: {
              type: 'integer';
            };
          },
          {
            name: 'per_page';
            in: 'query';
            required: false;
            description: 'How many results to return per page. Defaults to 15';
            example: 15;
            schema: {
              type: 'integer';
            };
          },
          {
            name: 'order';
            in: 'query';
            required: false;
            description: '`asc` or `desc`. Return the companies in ascending or descending order. Defaults to desc';
            example: 'desc';
            schema: {
              type: 'string';
            };
          },
        ];
        tags: ['Companies'];
        operationId: 'listAllCompanies';
        description: 'You can list companies. The company list is sorted by the `last_request_at` field and by default is ordered descending, most recently requested first.\n\nNote that the API does not include companies who have no associated users in list responses.\n\nWhen using the Companies endpoint and the pages object to iterate through the returned companies, there is a limit of 10,000 Companies that can be returned. If you need to list or iterate on more than 10,000 Companies, please use the [Scroll API](https://developers.intercom.com/reference#iterating-over-all-companies).\n{% admonition type="warning" name="Pagination" %}\n  You can use pagination to limit the number of results returned. The default is `20` results per page.\n  See the [pagination section](https://developers.intercom.com/docs/build-an-integration/learn-more/rest-apis/pagination/#pagination-for-list-apis) for more details on how to use the `starting_after` param.\n{% /admonition %}\n';
        responses: {
          '200': {
            description: 'Successful';
            content: {
              'application/json': {
                examples: {
                  Successful: {
                    value: {
                      type: 'list';
                      data: [
                        {
                          type: 'company';
                          company_id: 'remote_companies_scroll_2';
                          id: '6657aac96abd0164c24b0cd1';
                          app_id: 'this_is_an_id169_that_should_be_at_least_';
                          name: 'IntercomQATest1';
                          remote_created_at: 1717021385;
                          created_at: 1717021385;
                          updated_at: 1717021385;
                          monthly_spend: 0;
                          session_count: 0;
                          user_count: 4;
                          tags: {
                            type: 'tag.list';
                            tags: [];
                          };
                          segments: {
                            type: 'segment.list';
                            segments: [];
                          };
                          plan: {};
                          custom_attributes: {};
                        },
                      ];
                      pages: {
                        type: 'pages';
                        next: null;
                        page: 1;
                        per_page: 15;
                        total_pages: 1;
                      };
                      total_count: 1;
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/company_list';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: 'b672ed4c-464a-4606-b2c1-8d40edef7951';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
      };
    };
    '/companies/scroll': {
      get: {
        summary: 'Scroll over all companies';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
          {
            name: 'scroll_param';
            in: 'query';
            required: false;
            description: '';
            schema: {
              type: 'string';
            };
          },
        ];
        tags: ['Companies'];
        operationId: 'scrollOverAllCompanies';
        description: '      The `list all companies` functionality does not work well for huge datasets, and can result in errors and performance problems when paging deeply. The Scroll API provides an efficient mechanism for iterating over all companies in a dataset.\n\n- Each app can only have 1 scroll open at a time. You\'ll get an error message if you try to have more than one open per app.\n- If the scroll isn\'t used for 1 minute, it expires and calls with that scroll param will fail\n- If the end of the scroll is reached, "companies" will be empty and the scroll parameter will expire\n\n{% admonition type="info" name="Scroll Parameter" %}\n  You can get the first page of companies by simply sending a GET request to the scroll endpoint.\n  For subsequent requests you will need to use the scroll parameter from the response.\n{% /admonition %}\n{% admonition type="danger" name="Scroll network timeouts" %}\n  Since scroll is often used on large datasets network errors such as timeouts can be encountered. When this occurs you will see a HTTP 500 error with the following message:\n  "Request failed due to an internal network error. Please restart the scroll operation."\n  If this happens, you will need to restart your scroll query: It is not possible to continue from a specific point when using scroll.\n{% /admonition %}\n';
        responses: {
          '200': {
            description: 'Successful';
            content: {
              'application/json': {
                examples: {
                  Successful: {
                    value: {
                      type: 'list';
                      data: [
                        {
                          type: 'company';
                          company_id: 'remote_companies_scroll_2';
                          id: '6657aacb6abd0164c24b0cd7';
                          app_id: 'this_is_an_id173_that_should_be_at_least_';
                          name: 'IntercomQATest1';
                          remote_created_at: 1717021387;
                          created_at: 1717021387;
                          updated_at: 1717021387;
                          monthly_spend: 0;
                          session_count: 0;
                          user_count: 4;
                          tags: {
                            type: 'tag.list';
                            tags: [];
                          };
                          segments: {
                            type: 'segment.list';
                            segments: [];
                          };
                          plan: {};
                          custom_attributes: {};
                        },
                      ];
                      pages: null;
                      total_count: null;
                      scroll_param: '759035f4-de24-45cf-9f63-9aa86aba1248';
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/company_scroll';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: 'f40dc354-ebc0-4eaa-b713-ac942902b635';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
      };
    };
    '/contacts/{id}/companies': {
      post: {
        summary: 'Attach a Contact to a Company';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
          {
            name: 'id';
            in: 'path';
            required: true;
            description: 'The unique identifier for the contact which is given by Intercom';
            schema: {
              type: 'string';
            };
          },
        ];
        tags: ['Companies', 'Contacts'];
        operationId: 'attachContactToACompany';
        description: 'You can attach a company to a single contact.';
        responses: {
          '200': {
            description: 'Successful';
            content: {
              'application/json': {
                examples: {
                  Successful: {
                    value: {
                      type: 'company';
                      company_id: '1';
                      id: '6657aacd6abd0164c24b0ce0';
                      app_id: 'this_is_an_id177_that_should_be_at_least_';
                      name: 'company6';
                      remote_created_at: 1717021389;
                      created_at: 1717021389;
                      updated_at: 1717021389;
                      monthly_spend: 0;
                      session_count: 0;
                      user_count: 1;
                      tags: {
                        type: 'tag.list';
                        tags: [];
                      };
                      segments: {
                        type: 'segment.list';
                        segments: [];
                      };
                      plan: {};
                      custom_attributes: {};
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/company';
                };
              };
            };
          };
          '400': {
            description: 'Bad Request';
            content: {
              'application/json': {
                examples: {
                  'Bad Request': {
                    value: {
                      type: 'error.list';
                      request_id: 'acd7e8d3-23e0-4a81-9027-dc73d9eb94f9';
                      errors: [
                        {
                          code: 'parameter_not_found';
                          message: 'company not specified';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: 'a8b4fc2f-3e2c-4339-ba90-7df1c7f55d94';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
          '404': {
            description: 'Company Not Found';
            content: {
              'application/json': {
                examples: {
                  'Company Not Found': {
                    value: {
                      type: 'error.list';
                      request_id: '9b32d40e-a76d-4391-8058-c4856f47f30f';
                      errors: [
                        {
                          code: 'company_not_found';
                          message: 'Company Not Found';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object';
                required: ['id'];
                properties: {
                  id: {
                    type: 'string';
                    description: 'The unique identifier for the company which is given by Intercom';
                    example: '58a430d35458202d41b1e65b';
                  };
                };
              };
              examples: {
                successful: {
                  summary: 'Successful';
                  value: {
                    id: '6657aacd6abd0164c24b0ce0';
                  };
                };
                bad_request: {
                  summary: 'Bad Request';
                  value: null;
                };
                company_not_found: {
                  summary: 'Company Not Found';
                  value: {
                    id: '123';
                  };
                };
              };
            };
          };
        };
      };
      get: {
        summary: 'List attached companies for contact';
        parameters: [
          {
            name: 'id';
            in: 'path';
            description: 'The unique identifier for the contact which is given by Intercom';
            example: '63a07ddf05a32042dffac965';
            required: true;
            schema: {
              type: 'string';
            };
          },
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
        ];
        tags: ['Contacts', 'Companies'];
        operationId: 'listCompaniesForAContact';
        description: 'You can fetch a list of companies that are associated to a contact.';
        responses: {
          '200': {
            description: 'successful';
            content: {
              'application/json': {
                examples: {
                  successful: {
                    value: {
                      type: 'list';
                      data: [
                        {
                          type: 'company';
                          company_id: '1';
                          id: '6657aad36abd0164c24b0d01';
                          app_id: 'this_is_an_id193_that_should_be_at_least_';
                          name: 'company12';
                          remote_created_at: 1717021395;
                          created_at: 1717021395;
                          updated_at: 1717021395;
                          last_request_at: 1716848595;
                          monthly_spend: 0;
                          session_count: 0;
                          user_count: 1;
                          tags: {
                            type: 'tag.list';
                            tags: [];
                          };
                          segments: {
                            type: 'segment.list';
                            segments: [];
                          };
                          plan: {};
                          custom_attributes: {};
                        },
                      ];
                      pages: {
                        type: 'pages';
                        next: null;
                        page: 1;
                        per_page: 50;
                        total_pages: 1;
                      };
                      total_count: 1;
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/contact_attached_companies';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: '569829f1-97e6-43ae-82bf-1ddc978fd525';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
          '404': {
            description: 'Contact not found';
            content: {
              'application/json': {
                examples: {
                  'Contact not found': {
                    value: {
                      type: 'error.list';
                      request_id: '310fc913-3cc2-4222-9de9-2b327149f0dd';
                      errors: [
                        {
                          code: 'not_found';
                          message: 'User Not Found';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
      };
    };
    '/contacts/{contact_id}/companies/{id}': {
      delete: {
        summary: 'Detach a contact from a company';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
          {
            name: 'contact_id';
            in: 'path';
            required: true;
            description: 'The unique identifier for the contact which is given by Intercom';
            example: '58a430d35458202d41b1e65b';
            schema: {
              type: 'string';
            };
          },
          {
            name: 'id';
            in: 'path';
            required: true;
            description: 'The unique identifier for the company which is given by Intercom';
            example: '58a430d35458202d41b1e65b';
            schema: {
              type: 'string';
            };
          },
        ];
        tags: ['Companies', 'Contacts'];
        operationId: 'detachContactFromACompany';
        description: 'You can detach a company from a single contact.';
        responses: {
          '200': {
            description: 'Successful';
            content: {
              'application/json': {
                examples: {
                  Successful: {
                    value: {
                      type: 'company';
                      company_id: '1';
                      id: '6657aad06abd0164c24b0cf0';
                      app_id: 'this_is_an_id185_that_should_be_at_least_';
                      name: 'company8';
                      remote_created_at: 1717021392;
                      created_at: 1717021392;
                      updated_at: 1717021392;
                      monthly_spend: 0;
                      session_count: 0;
                      user_count: 0;
                      tags: {
                        type: 'tag.list';
                        tags: [];
                      };
                      segments: {
                        type: 'segment.list';
                        segments: [];
                      };
                      plan: {};
                      custom_attributes: {};
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/company';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: '2933cb04-d47e-4ad9-b764-f6abef8a224b';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
          '404': {
            description: 'Contact Not Found';
            content: {
              'application/json': {
                examples: {
                  'Company Not Found': {
                    value: {
                      type: 'error.list';
                      request_id: 'f5af06b4-da5a-442a-8610-960fa3e1ea3f';
                      errors: [
                        {
                          code: 'company_not_found';
                          message: 'Company Not Found';
                        },
                      ];
                    };
                  };
                  'Contact Not Found': {
                    value: {
                      type: 'error.list';
                      request_id: '16ac995d-d962-4fe6-8a45-571d40a85932';
                      errors: [
                        {
                          code: 'not_found';
                          message: 'User Not Found';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
      };
    };
    '/contacts/{id}/notes': {
      get: {
        summary: 'List all notes';
        parameters: [
          {
            name: 'id';
            in: 'path';
            required: true;
            description: 'The unique identifier of a contact.';
            schema: {
              type: 'integer';
            };
          },
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
        ];
        tags: ['Notes', 'Contacts'];
        operationId: 'listNotes';
        description: 'You can fetch a list of notes that are associated to a contact.';
        responses: {
          '200': {
            description: 'Successful response';
            content: {
              'application/json': {
                examples: {
                  'Successful response': {
                    value: {
                      type: 'list';
                      data: [
                        {
                          type: 'note';
                          id: '29';
                          created_at: 1716416598;
                          contact: {
                            type: 'contact';
                            id: '6657aad66abd0164c24b0d0c';
                          };
                          author: {
                            type: 'admin';
                            id: '991267352';
                            name: 'Ciaran110 Lee';
                            email: 'admin110@email.com';
                            away_mode_enabled: false;
                            away_mode_reassign: false;
                          };
                          body: '<p>This is a note.</p>';
                        },
                        {
                          type: 'note';
                          id: '28';
                          created_at: 1716330198;
                          contact: {
                            type: 'contact';
                            id: '6657aad66abd0164c24b0d0c';
                          };
                          author: {
                            type: 'admin';
                            id: '991267352';
                            name: 'Ciaran110 Lee';
                            email: 'admin110@email.com';
                            away_mode_enabled: false;
                            away_mode_reassign: false;
                          };
                          body: '<p>This is a note.</p>';
                        },
                        {
                          type: 'note';
                          id: '27';
                          created_at: 1716330197;
                          contact: {
                            type: 'contact';
                            id: '6657aad66abd0164c24b0d0c';
                          };
                          author: {
                            type: 'admin';
                            id: '991267352';
                            name: 'Ciaran110 Lee';
                            email: 'admin110@email.com';
                            away_mode_enabled: false;
                            away_mode_reassign: false;
                          };
                          body: '<p>This is a note.</p>';
                        },
                      ];
                      total_count: 3;
                      pages: {
                        type: 'pages';
                        next: null;
                        page: 1;
                        per_page: 50;
                        total_pages: 1;
                      };
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/note_list';
                };
              };
            };
          };
          '404': {
            description: 'Contact not found';
            content: {
              'application/json': {
                examples: {
                  'Contact not found': {
                    value: {
                      type: 'error.list';
                      request_id: '5c017b27-069c-45ac-8012-4fd96bc575a1';
                      errors: [
                        {
                          code: 'not_found';
                          message: 'User Not Found';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
      };
      post: {
        summary: 'Create a note';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
          {
            name: 'id';
            in: 'path';
            required: true;
            description: 'The unique identifier of a given contact.';
            example: '123';
            schema: {
              type: 'integer';
            };
          },
        ];
        tags: ['Notes', 'Contacts'];
        operationId: 'createNote';
        description: 'You can add a note to a single contact.';
        responses: {
          '200': {
            description: 'Successful response';
            content: {
              'application/json': {
                examples: {
                  'Successful response': {
                    value: {
                      type: 'note';
                      id: '34';
                      created_at: 1717021399;
                      contact: {
                        type: 'contact';
                        id: '6657aad76abd0164c24b0d0e';
                      };
                      author: {
                        type: 'admin';
                        id: '991267354';
                        name: 'Ciaran112 Lee';
                        email: 'admin112@email.com';
                        away_mode_enabled: false;
                        away_mode_reassign: false;
                      };
                      body: '<p>Hello</p>';
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/note';
                };
              };
            };
          };
          '404': {
            description: 'Contact not found';
            content: {
              'application/json': {
                examples: {
                  'Admin not found': {
                    value: {
                      type: 'error.list';
                      request_id: 'b4f4eb11-8a81-49b9-91db-42e8c1eca575';
                      errors: [
                        {
                          code: 'not_found';
                          message: 'Resource Not Found';
                        },
                      ];
                    };
                  };
                  'Contact not found': {
                    value: {
                      type: 'error.list';
                      request_id: '385e508f-749b-462b-a1a7-fa63325e488e';
                      errors: [
                        {
                          code: 'not_found';
                          message: 'User Not Found';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object';
                required: ['body'];
                properties: {
                  body: {
                    type: 'string';
                    description: 'The text of the note.';
                    example: 'New note';
                  };
                  contact_id: {
                    type: 'string';
                    description: 'The unique identifier of a given contact.';
                    example: '123';
                  };
                  admin_id: {
                    type: 'string';
                    description: 'The unique identifier of a given admin.';
                    example: '123';
                  };
                };
              };
              examples: {
                successful_response: {
                  summary: 'Successful response';
                  value: {
                    contact_id: '6657aad76abd0164c24b0d0e';
                    admin_id: 991267354;
                    body: 'Hello';
                  };
                };
                admin_not_found: {
                  summary: 'Admin not found';
                  value: {
                    contact_id: '6657aad76abd0164c24b0d0f';
                    admin_id: 123;
                    body: 'Hello';
                  };
                };
                contact_not_found: {
                  summary: 'Contact not found';
                  value: {
                    contact_id: 123;
                    admin_id: 991267356;
                    body: 'Hello';
                  };
                };
              };
            };
          };
        };
      };
    };
    '/contacts/{contact_id}/segments': {
      get: {
        summary: 'List attached segments for contact';
        parameters: [
          {
            name: 'contact_id';
            in: 'path';
            description: 'The unique identifier for the contact which is given by Intercom';
            example: '63a07ddf05a32042dffac965';
            required: true;
            schema: {
              type: 'string';
            };
          },
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
        ];
        tags: ['Contacts', 'Segments'];
        operationId: 'listSegmentsForAContact';
        description: 'You can fetch a list of segments that are associated to a contact.';
        responses: {
          '200': {
            description: 'successful';
            content: {
              'application/json': {
                examples: {
                  successful: {
                    value: {
                      type: 'list';
                      data: [
                        {
                          type: 'segment';
                          id: '6657aad96abd0164c24b0d11';
                          name: 'segment';
                          created_at: 1717021401;
                          updated_at: 1717021401;
                          person_type: 'user';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/contact_segments';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: '35d42f23-43c1-47e0-86ec-66e17a98c904';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
          '404': {
            description: 'Contact not found';
            content: {
              'application/json': {
                examples: {
                  'Contact not found': {
                    value: {
                      type: 'error.list';
                      request_id: '9451e8b0-0b60-4a3c-8eda-9e644eaec3a0';
                      errors: [
                        {
                          code: 'not_found';
                          message: 'User Not Found';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
      };
    };
    '/contacts/{contact_id}/subscriptions': {
      get: {
        summary: 'List subscriptions for a contact';
        parameters: [
          {
            name: 'contact_id';
            in: 'path';
            description: 'The unique identifier for the contact which is given by Intercom';
            example: '63a07ddf05a32042dffac965';
            required: true;
            schema: {
              type: 'string';
            };
          },
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
        ];
        tags: ['Contacts', 'Subscription Types'];
        operationId: 'listSubscriptionsForAContact';
        description: "You can fetch a list of subscription types that are attached to a contact. These can be subscriptions that a user has 'opted-in' to or has 'opted-out' from, depending on the subscription type.\nThis will return a list of Subscription Type objects that the contact is associated with.\n\nThe data property will show a combined list of:\n\n  1.Opt-out subscription types that the user has opted-out from.\n  2.Opt-in subscription types that the user has opted-in to receiving.\n";
        responses: {
          '200': {
            description: 'Successful';
            content: {
              'application/json': {
                examples: {
                  Successful: {
                    value: {
                      type: 'list';
                      data: [
                        {
                          type: 'subscription';
                          id: '93';
                          state: 'live';
                          consent_type: 'opt_out';
                          default_translation: {
                            name: 'Newsletters';
                            description: 'Lorem ipsum dolor sit amet';
                            locale: 'en';
                          };
                          translations: [
                            {
                              name: 'Newsletters';
                              description: 'Lorem ipsum dolor sit amet';
                              locale: 'en';
                            },
                          ];
                          content_types: ['email'];
                        },
                        {
                          type: 'subscription';
                          id: '95';
                          state: 'live';
                          consent_type: 'opt_in';
                          default_translation: {
                            name: 'Newsletters';
                            description: 'Lorem ipsum dolor sit amet';
                            locale: 'en';
                          };
                          translations: [
                            {
                              name: 'Newsletters';
                              description: 'Lorem ipsum dolor sit amet';
                              locale: 'en';
                            },
                          ];
                          content_types: ['sms_message'];
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/subscription_type_list';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: '917619e6-202c-4837-bc02-24fcfe95e17c';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
          '404': {
            description: 'Contact not found';
            content: {
              'application/json': {
                examples: {
                  'Contact not found': {
                    value: {
                      type: 'error.list';
                      request_id: 'de54f84d-185c-4565-b1f8-4b9a6d8a5b6a';
                      errors: [
                        {
                          code: 'not_found';
                          message: 'User Not Found';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
      };
      post: {
        summary: 'Add subscription to a contact';
        tags: ['Subscription Types', 'Contacts'];
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
          {
            name: 'contact_id';
            in: 'path';
            description: 'The unique identifier for the contact which is given by Intercom';
            example: '63a07ddf05a32042dffac965';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        operationId: 'attachSubscriptionTypeToContact';
        description: 'You can add a specific subscription to a contact. In Intercom, we have two different subscription types based on user consent - opt-out and opt-in:\n\n  1.Attaching a contact to an opt-out subscription type will opt that user out from receiving messages related to that subscription type.\n\n  2.Attaching a contact to an opt-in subscription type will opt that user in to receiving messages related to that subscription type.\n\nThis will return a subscription type model for the subscription type that was added to the contact.\n';
        responses: {
          '200': {
            description: 'Successful';
            content: {
              'application/json': {
                examples: {
                  Successful: {
                    value: {
                      type: 'subscription';
                      id: '108';
                      state: 'live';
                      consent_type: 'opt_in';
                      default_translation: {
                        name: 'Newsletters';
                        description: 'Lorem ipsum dolor sit amet';
                        locale: 'en';
                      };
                      translations: [
                        {
                          name: 'Newsletters';
                          description: 'Lorem ipsum dolor sit amet';
                          locale: 'en';
                        },
                      ];
                      content_types: ['sms_message'];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/subscription_type';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: '6e57c92f-9224-46d6-9315-38263aff308b';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
          '404': {
            description: 'Resource not found';
            content: {
              'application/json': {
                examples: {
                  'Contact not found': {
                    value: {
                      type: 'error.list';
                      request_id: 'f0eaf097-047e-40a0-bdcf-bc124bffe683';
                      errors: [
                        {
                          code: 'not_found';
                          message: 'User Not Found';
                        },
                      ];
                    };
                  };
                  'Resource not found': {
                    value: {
                      type: 'error.list';
                      request_id: 'f9e0a206-a1b0-4bc3-a5b2-58925130e490';
                      errors: [
                        {
                          code: 'not_found';
                          message: 'Resource Not Found';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object';
                required: ['id', 'consent_type'];
                properties: {
                  id: {
                    type: 'string';
                    description: 'The unique identifier for the subscription which is given by Intercom';
                    example: '37846';
                  };
                  consent_type: {
                    type: 'string';
                    description: 'The consent_type of a subscription, opt_out or opt_in.';
                    example: 'opt_in';
                  };
                };
              };
              examples: {
                successful: {
                  summary: 'Successful';
                  value: {
                    id: 108;
                    consent_type: 'opt_in';
                  };
                };
                contact_not_found: {
                  summary: 'Contact not found';
                  value: {
                    id: 112;
                    consent_type: 'opt_in';
                  };
                };
                resource_not_found: {
                  summary: 'Resource not found';
                  value: {
                    id: 'invalid_id';
                    consent_type: 'opt_in';
                  };
                };
              };
            };
          };
        };
      };
    };
    '/contacts/{contact_id}/subscriptions/{id}': {
      delete: {
        summary: 'Remove subscription from a contact';
        tags: ['Subscription Types', 'Contacts'];
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
          {
            name: 'contact_id';
            in: 'path';
            description: 'The unique identifier for the contact which is given by Intercom';
            example: '63a07ddf05a32042dffac965';
            required: true;
            schema: {
              type: 'string';
            };
          },
          {
            name: 'id';
            in: 'path';
            description: 'The unique identifier for the subscription type which is given by Intercom';
            example: '37846';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        operationId: 'detachSubscriptionTypeToContact';
        description: 'You can remove a specific subscription from a contact. This will return a subscription type model for the subscription type that was removed from the contact.';
        responses: {
          '200': {
            description: 'Successful';
            content: {
              'application/json': {
                examples: {
                  Successful: {
                    value: {
                      type: 'subscription';
                      id: '124';
                      state: 'live';
                      consent_type: 'opt_in';
                      default_translation: {
                        name: 'Newsletters';
                        description: 'Lorem ipsum dolor sit amet';
                        locale: 'en';
                      };
                      translations: [
                        {
                          name: 'Newsletters';
                          description: 'Lorem ipsum dolor sit amet';
                          locale: 'en';
                        },
                      ];
                      content_types: ['sms_message'];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/subscription_type';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: '79a857ea-0495-4122-a11c-7e00140bdaf3';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
          '404': {
            description: 'Resource not found';
            content: {
              'application/json': {
                examples: {
                  'Contact not found': {
                    value: {
                      type: 'error.list';
                      request_id: '10fb9404-d330-4531-81ca-c04ca4d55947';
                      errors: [
                        {
                          code: 'not_found';
                          message: 'User Not Found';
                        },
                      ];
                    };
                  };
                  'Resource not found': {
                    value: {
                      type: 'error.list';
                      request_id: '2879d387-dc58-4b94-91e3-e4abbc4ac50d';
                      errors: [
                        {
                          code: 'not_found';
                          message: 'Resource Not Found';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
      };
    };
    '/contacts/{contact_id}/tags': {
      get: {
        summary: 'List tags attached to a contact';
        tags: ['Contacts', 'Tags'];
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
          {
            name: 'contact_id';
            in: 'path';
            description: 'The unique identifier for the contact which is given by Intercom';
            example: '63a07ddf05a32042dffac965';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        operationId: 'listTagsForAContact';
        description: 'You can fetch a list of all tags that are attached to a specific contact.';
        responses: {
          '200': {
            description: 'successful';
            content: {
              'application/json': {
                examples: {
                  successful: {
                    value: {
                      type: 'list';
                      data: [
                        {
                          type: 'tag';
                          id: '83';
                          name: 'Manual tag';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/tag_list';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: '889da38c-3715-4edd-829f-c6234c6b61c5';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
          '404': {
            description: 'Contact not found';
            content: {
              'application/json': {
                examples: {
                  'Contact not found': {
                    value: {
                      type: 'error.list';
                      request_id: '9831ae15-042d-4df0-8709-05712becdc48';
                      errors: [
                        {
                          code: 'not_found';
                          message: 'User Not Found';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
      };
      post: {
        summary: 'Add tag to a contact';
        tags: ['Tags', 'Contacts'];
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
          {
            name: 'contact_id';
            in: 'path';
            description: 'The unique identifier for the contact which is given by Intercom';
            example: '63a07ddf05a32042dffac965';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        operationId: 'attachTagToContact';
        description: 'You can tag a specific contact. This will return a tag object for the tag that was added to the contact.';
        responses: {
          '200': {
            description: 'successful';
            content: {
              'application/json': {
                examples: {
                  successful: {
                    value: {
                      type: 'tag';
                      id: '84';
                      name: 'Manual tag';
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/tag';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: 'e33c99ea-541f-4662-bd11-677745c60510';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
          '404': {
            description: 'Tag not found';
            content: {
              'application/json': {
                examples: {
                  'Contact not found': {
                    value: {
                      type: 'error.list';
                      request_id: '56dc903d-e3b7-49e9-aeeb-44f658ec1881';
                      errors: [
                        {
                          code: 'not_found';
                          message: 'User Not Found';
                        },
                      ];
                    };
                  };
                  'Tag not found': {
                    value: {
                      type: 'error.list';
                      request_id: 'bed647c1-2d8b-4fa0-b16e-92184a12ef6f';
                      errors: [
                        {
                          code: 'not_found';
                          message: 'Resource Not Found';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object';
                required: ['id'];
                properties: {
                  id: {
                    type: 'string';
                    description: 'The unique identifier for the tag which is given by Intercom';
                    example: '7522907';
                  };
                };
              };
              examples: {
                successful: {
                  summary: 'successful';
                  value: {
                    id: 84;
                  };
                };
                contact_not_found: {
                  summary: 'Contact not found';
                  value: {
                    id: 85;
                  };
                };
                tag_not_found: {
                  summary: 'Tag not found';
                  value: {
                    id: '123';
                  };
                };
              };
            };
          };
        };
      };
    };
    '/contacts/{contact_id}/tags/{id}': {
      delete: {
        summary: 'Remove tag from a contact';
        tags: ['Tags', 'Contacts'];
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
          {
            name: 'contact_id';
            in: 'path';
            description: 'The unique identifier for the contact which is given by Intercom';
            example: '63a07ddf05a32042dffac965';
            required: true;
            schema: {
              type: 'string';
            };
          },
          {
            name: 'id';
            in: 'path';
            description: 'The unique identifier for the tag which is given by Intercom';
            example: '7522907';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        operationId: 'detachTagFromContact';
        description: 'You can remove tag from a specific contact. This will return a tag object for the tag that was removed from the contact.';
        responses: {
          '200': {
            description: 'successful';
            content: {
              'application/json': {
                examples: {
                  successful: {
                    value: {
                      type: 'tag';
                      id: '87';
                      name: 'Manual tag';
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/tag';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: '994fceee-e6d2-455f-b5e4-ae7304feec2e';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
          '404': {
            description: 'Tag not found';
            content: {
              'application/json': {
                examples: {
                  'Contact not found': {
                    value: {
                      type: 'error.list';
                      request_id: 'f5167a40-7d57-4480-921a-7144ab21e273';
                      errors: [
                        {
                          code: 'not_found';
                          message: 'User Not Found';
                        },
                      ];
                    };
                  };
                  'Tag not found': {
                    value: {
                      type: 'error.list';
                      request_id: 'c0dc7099-cb44-4f33-9efe-e22d24c1a227';
                      errors: [
                        {
                          code: 'not_found';
                          message: 'Resource Not Found';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
      };
    };
    '/contacts/{id}': {
      put: {
        summary: 'Update a contact';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
          {
            name: 'id';
            in: 'path';
            description: 'id';
            example: '63a07ddf05a32042dffac965';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        tags: ['Contacts'];
        operationId: 'UpdateContact';
        description: 'You can update an existing contact (ie. user or lead).';
        responses: {
          '200': {
            description: 'successful';
            content: {
              'application/json': {
                examples: {
                  successful: {
                    value: {
                      type: 'contact';
                      id: '6657aae76abd0164c24b0d28';
                      workspace_id: 'this_is_an_id259_that_should_be_at_least_';
                      external_id: '70';
                      role: 'user';
                      email: 'joebloggs@intercom.io';
                      phone: null;
                      name: 'joe bloggs';
                      avatar: null;
                      owner_id: null;
                      social_profiles: {
                        type: 'list';
                        data: [];
                      };
                      has_hard_bounced: false;
                      marked_email_as_spam: false;
                      unsubscribed_from_emails: false;
                      created_at: 1717021415;
                      updated_at: 1717021415;
                      signed_up_at: 1717021415;
                      last_seen_at: null;
                      last_replied_at: null;
                      last_contacted_at: null;
                      last_email_opened_at: null;
                      last_email_clicked_at: null;
                      language_override: null;
                      browser: null;
                      browser_version: null;
                      browser_language: null;
                      os: null;
                      location: {
                        type: 'location';
                        country: null;
                        region: null;
                        city: null;
                        country_code: null;
                        continent_code: null;
                      };
                      android_app_name: null;
                      android_app_version: null;
                      android_device: null;
                      android_os_version: null;
                      android_sdk_version: null;
                      android_last_seen_at: null;
                      ios_app_name: null;
                      ios_app_version: null;
                      ios_device: null;
                      ios_os_version: null;
                      ios_sdk_version: null;
                      ios_last_seen_at: null;
                      custom_attributes: {};
                      tags: {
                        type: 'list';
                        data: [];
                        url: '/contacts/6657aae76abd0164c24b0d28/tags';
                        total_count: 0;
                        has_more: false;
                      };
                      notes: {
                        type: 'list';
                        data: [];
                        url: '/contacts/6657aae76abd0164c24b0d28/notes';
                        total_count: 0;
                        has_more: false;
                      };
                      companies: {
                        type: 'list';
                        data: [];
                        url: '/contacts/6657aae76abd0164c24b0d28/companies';
                        total_count: 0;
                        has_more: false;
                      };
                      opted_out_subscription_types: {
                        type: 'list';
                        data: [];
                        url: '/contacts/6657aae76abd0164c24b0d28/subscriptions';
                        total_count: 0;
                        has_more: false;
                      };
                      opted_in_subscription_types: {
                        type: 'list';
                        data: [];
                        url: '/contacts/6657aae76abd0164c24b0d28/subscriptions';
                        total_count: 0;
                        has_more: false;
                      };
                      utm_campaign: null;
                      utm_content: null;
                      utm_medium: null;
                      utm_source: null;
                      utm_term: null;
                      referrer: null;
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/contact';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: 'babb0a78-a81a-4c20-b2b6-b407dfeb6b2d';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
        requestBody: {
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    $ref: '#/components/schemas/update_contact_request';
                  },
                ];
              };
              examples: {
                successful: {
                  summary: 'successful';
                  value: {
                    email: 'joebloggs@intercom.io';
                    name: 'joe bloggs';
                  };
                };
              };
            };
          };
        };
      };
      get: {
        summary: 'Get a contact';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
          {
            name: 'id';
            in: 'path';
            description: 'id';
            example: '63a07ddf05a32042dffac965';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        tags: ['Contacts'];
        operationId: 'ShowContact';
        description: 'You can fetch the details of a single contact.';
        responses: {
          '200': {
            description: 'successful';
            content: {
              'application/json': {
                examples: {
                  successful: {
                    value: {
                      type: 'contact';
                      id: '6657aae86abd0164c24b0d29';
                      workspace_id: 'this_is_an_id263_that_should_be_at_least_';
                      external_id: '70';
                      role: 'user';
                      email: 'joe@bloggs.com';
                      phone: null;
                      name: 'Joe Bloggs';
                      avatar: null;
                      owner_id: null;
                      social_profiles: {
                        type: 'list';
                        data: [];
                      };
                      has_hard_bounced: false;
                      marked_email_as_spam: false;
                      unsubscribed_from_emails: false;
                      created_at: 1717021416;
                      updated_at: 1717021416;
                      signed_up_at: 1717021416;
                      last_seen_at: null;
                      last_replied_at: null;
                      last_contacted_at: null;
                      last_email_opened_at: null;
                      last_email_clicked_at: null;
                      language_override: null;
                      browser: null;
                      browser_version: null;
                      browser_language: null;
                      os: null;
                      location: {
                        type: 'location';
                        country: null;
                        region: null;
                        city: null;
                        country_code: null;
                        continent_code: null;
                      };
                      android_app_name: null;
                      android_app_version: null;
                      android_device: null;
                      android_os_version: null;
                      android_sdk_version: null;
                      android_last_seen_at: null;
                      ios_app_name: null;
                      ios_app_version: null;
                      ios_device: null;
                      ios_os_version: null;
                      ios_sdk_version: null;
                      ios_last_seen_at: null;
                      custom_attributes: {};
                      tags: {
                        type: 'list';
                        data: [];
                        url: '/contacts/6657aae86abd0164c24b0d29/tags';
                        total_count: 0;
                        has_more: false;
                      };
                      notes: {
                        type: 'list';
                        data: [];
                        url: '/contacts/6657aae86abd0164c24b0d29/notes';
                        total_count: 0;
                        has_more: false;
                      };
                      companies: {
                        type: 'list';
                        data: [];
                        url: '/contacts/6657aae86abd0164c24b0d29/companies';
                        total_count: 0;
                        has_more: false;
                      };
                      opted_out_subscription_types: {
                        type: 'list';
                        data: [];
                        url: '/contacts/6657aae86abd0164c24b0d29/subscriptions';
                        total_count: 0;
                        has_more: false;
                      };
                      opted_in_subscription_types: {
                        type: 'list';
                        data: [];
                        url: '/contacts/6657aae86abd0164c24b0d29/subscriptions';
                        total_count: 0;
                        has_more: false;
                      };
                      utm_campaign: null;
                      utm_content: null;
                      utm_medium: null;
                      utm_source: null;
                      utm_term: null;
                      referrer: null;
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/contact';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: '4101d4ef-8205-4e5f-b513-479f749c34c9';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
      };
      delete: {
        summary: 'Delete a contact';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
          {
            name: 'id';
            in: 'path';
            description: 'id';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        tags: ['Contacts'];
        operationId: 'DeleteContact';
        description: 'You can delete a single contact.';
        responses: {
          '200': {
            description: 'successful';
            content: {
              'application/json': {
                examples: {
                  successful: {
                    value: {
                      id: '6657aaea6abd0164c24b0d2a';
                      object: 'contact';
                      deleted: true;
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/contact_deleted';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: '13311953-9f38-4984-a63f-83d70dee0110';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
      };
    };
    '/contacts/merge': {
      post: {
        summary: 'Merge a lead and a user';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
        ];
        tags: ['Contacts'];
        operationId: 'MergeContact';
        description: 'You can merge a contact with a `role` of `lead` into a contact with a `role` of `user`.';
        responses: {
          '200': {
            description: 'successful';
            content: {
              'application/json': {
                examples: {
                  successful: {
                    value: {
                      type: 'contact';
                      id: '6657aaeb6abd0164c24b0d2c';
                      workspace_id: 'this_is_an_id271_that_should_be_at_least_';
                      external_id: '70';
                      role: 'user';
                      email: 'joe@bloggs.com';
                      phone: null;
                      name: 'Joe Bloggs';
                      avatar: null;
                      owner_id: null;
                      social_profiles: {
                        type: 'list';
                        data: [];
                      };
                      has_hard_bounced: false;
                      marked_email_as_spam: false;
                      unsubscribed_from_emails: false;
                      created_at: 1717021419;
                      updated_at: 1717021420;
                      signed_up_at: 1717021419;
                      last_seen_at: null;
                      last_replied_at: null;
                      last_contacted_at: null;
                      last_email_opened_at: null;
                      last_email_clicked_at: null;
                      language_override: null;
                      browser: null;
                      browser_version: null;
                      browser_language: null;
                      os: null;
                      location: {
                        type: 'location';
                        country: null;
                        region: null;
                        city: null;
                        country_code: null;
                        continent_code: null;
                      };
                      android_app_name: null;
                      android_app_version: null;
                      android_device: null;
                      android_os_version: null;
                      android_sdk_version: null;
                      android_last_seen_at: null;
                      ios_app_name: null;
                      ios_app_version: null;
                      ios_device: null;
                      ios_os_version: null;
                      ios_sdk_version: null;
                      ios_last_seen_at: null;
                      custom_attributes: {};
                      tags: {
                        type: 'list';
                        data: [];
                        url: '/contacts/6657aaeb6abd0164c24b0d2c/tags';
                        total_count: 0;
                        has_more: false;
                      };
                      notes: {
                        type: 'list';
                        data: [];
                        url: '/contacts/6657aaeb6abd0164c24b0d2c/notes';
                        total_count: 0;
                        has_more: false;
                      };
                      companies: {
                        type: 'list';
                        data: [];
                        url: '/contacts/6657aaeb6abd0164c24b0d2c/companies';
                        total_count: 0;
                        has_more: false;
                      };
                      opted_out_subscription_types: {
                        type: 'list';
                        data: [];
                        url: '/contacts/6657aaeb6abd0164c24b0d2c/subscriptions';
                        total_count: 0;
                        has_more: false;
                      };
                      opted_in_subscription_types: {
                        type: 'list';
                        data: [];
                        url: '/contacts/6657aaeb6abd0164c24b0d2c/subscriptions';
                        total_count: 0;
                        has_more: false;
                      };
                      utm_campaign: null;
                      utm_content: null;
                      utm_medium: null;
                      utm_source: null;
                      utm_term: null;
                      referrer: null;
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/contact';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: '8084b6b3-60e7-46b9-96ab-ed0d9ef45e67';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/merge_contacts_request';
              };
              examples: {
                successful: {
                  summary: 'successful';
                  value: {
                    from: '6657aaeb6abd0164c24b0d2b';
                    into: '6657aaeb6abd0164c24b0d2c';
                  };
                };
              };
            };
          };
        };
      };
    };
    '/contacts/search': {
      post: {
        summary: 'Search contacts';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
        ];
        tags: ['Contacts'];
        operationId: 'SearchContacts';
        description: 'You can search for multiple contacts by the value of their attributes in order to fetch exactly who you want.\n\nTo search for contacts, you need to send a `POST` request to `https://api.intercom.io/contacts/search`.\n\nThis will accept a query object in the body which will define your filters in order to search for contacts.\n\n{% admonition type="warning" name="Optimizing search queries" %}\n  Search queries can be complex, so optimizing them can help the performance of your search.\n  Use the `AND` and `OR` operators to combine multiple filters to get the exact results you need and utilize\n  pagination to limit the number of results returned. The default is `50` results per page.\n  See the [pagination section](https://developers.intercom.com/docs/build-an-integration/learn-more/rest-apis/pagination/#example-search-conversations-request) for more details on how to use the `starting_after` param.\n{% /admonition %}\n### Contact Creation Delay\n\nIf a contact has recently been created, there is a possibility that it will not yet be available when searching. This means that it may not appear in the response. This delay can take a few minutes. If you need to be instantly notified it is recommended to use webhooks and iterate to see if they match your search filters.\n\n### Nesting & Limitations\n\nYou can nest these filters in order to get even more granular insights that pinpoint exactly what you need. Example: (1 OR 2) AND (3 OR 4).\nThere are some limitations to the amount of multiple\'s there can be:\n* There\'s a limit of max 2 nested filters\n* There\'s a limit of max 15 filters for each AND or OR group\n\n### Searching for Timestamp Fields\n\nAll timestamp fields (created_at, updated_at etc.) are indexed as Dates for Contact Search queries; Datetime queries are not currently supported. This means you can only query for timestamp fields by day - not hour, minute or second.\nFor example, if you search for all Contacts with a created_at value greater (>) than 1577869200 (the UNIX timestamp for January 1st, 2020 9:00 AM), that will be interpreted as 1577836800 (January 1st, 2020 12:00 AM). The search results will then include Contacts created from January 2nd, 2020 12:00 AM onwards.\nIf you\'d like to get contacts created on January 1st, 2020 you should search with a created_at value equal (=) to 1577836800 (January 1st, 2020 12:00 AM).\nThis behaviour applies only to timestamps used in search queries. The search results will still contain the full UNIX timestamp and be sorted accordingly.\n\n### Accepted Fields\n\nMost key listed as part of the Contacts Model are searchable, whether writeable or not. The value you search for has to match the accepted type, otherwise the query will fail (ie. as `created_at` accepts a date, the `value` cannot be a string such as `"foorbar"`).\n\n| Field                              | Type                           |\n| ---------------------------------- | ------------------------------ |\n| id                                 | String                         |\n| role                               | String<br>Accepts user or lead |\n| name                               | String                         |\n| avatar                             | String                         |\n| owner_id                           | Integer                        |\n| email                              | String                         |\n| email_domain                       | String                         |\n| phone                              | String                         |\n| formatted_phone                    | String                         |\n| external_id                        | String                         |\n| created_at                         | Date (UNIX Timestamp)          |\n| signed_up_at                       | Date (UNIX Timestamp)          |\n| updated_at                         | Date (UNIX Timestamp)          |\n| last_seen_at                       | Date (UNIX Timestamp)          |\n| last_contacted_at                  | Date (UNIX Timestamp)          |\n| last_replied_at                    | Date (UNIX Timestamp)          |\n| last_email_opened_at               | Date (UNIX Timestamp)          |\n| last_email_clicked_at              | Date (UNIX Timestamp)          |\n| language_override                  | String                         |\n| browser                            | String                         |\n| browser_language                   | String                         |\n| os                                 | String                         |\n| location.country                   | String                         |\n| location.region                    | String                         |\n| location.city                      | String                         |\n| unsubscribed_from_emails           | Boolean                        |\n| marked_email_as_spam               | Boolean                        |\n| has_hard_bounced                   | Boolean                        |\n| ios_last_seen_at                   | Date (UNIX Timestamp)          |\n| ios_app_version                    | String                         |\n| ios_device                         | String                         |\n| ios_app_device                     | String                         |\n| ios_os_version                     | String                         |\n| ios_app_name                       | String                         |\n| ios_sdk_version                    | String                         |\n| android_last_seen_at               | Date (UNIX Timestamp)          |\n| android_app_version                | String                         |\n| android_device                     | String                         |\n| android_app_name                   | String                         |\n| andoid_sdk_version                 | String                         |\n| segment_id                         | String                         |\n| tag_id                             | String                         |\n| custom_attributes.{attribute_name} | String                         |\n\n### Accepted Operators\n\n{% admonition type="attention" name="Searching based on `created_at`" %}\n  You cannot use the `<=` or `>=` operators to search by `created_at`.\n{% /admonition %}\n\nThe table below shows the operators you can use to define how you want to search for the value.  The operator should be put in as a string (`"="`). The operator has to be compatible with the field\'s type (eg. you cannot search with `>` for a given string value as it\'s only compatible for integer\'s and dates).\n\n| Operator | Valid Types                      | Description                                                      |\n| :------- | :------------------------------- | :--------------------------------------------------------------- |\n| =        | All                              | Equals                                                           |\n| !=       | All                              | Doesn\'t Equal                                                    |\n| IN       | All                              | In<br>Shortcut for `OR` queries<br>Values must be in Array       |\n| NIN      | All                              | Not In<br>Shortcut for `OR !` queries<br>Values must be in Array |\n| >        | Integer<br>Date (UNIX Timestamp) | Greater than                                                     |\n| <       | Integer<br>Date (UNIX Timestamp) | Lower than                                                       |\n| ~        | String                           | Contains                                                         |\n| !~       | String                           | Doesn\'t Contain                                                  |\n| ^        | String                           | Starts With                                                      |\n| $        | String                           | Ends With                                                        |\n';
        responses: {
          '200': {
            description: 'successful';
            content: {
              'application/json': {
                examples: {
                  successful: {
                    value: {
                      type: 'list';
                      data: [];
                      total_count: 0;
                      pages: {
                        type: 'pages';
                        page: 1;
                        per_page: 5;
                        total_pages: 0;
                      };
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/contact_list';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: '019c15bc-59b6-46e0-a99c-9ff87e13255b';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/search_request';
              };
              examples: {
                successful: {
                  summary: 'successful';
                  value: {
                    query: {
                      operator: 'AND';
                      value: [
                        {
                          field: 'created_at';
                          operator: '>';
                          value: '1306054154';
                        },
                      ];
                    };
                    pagination: {
                      per_page: 5;
                    };
                  };
                };
              };
            };
          };
        };
      };
    };
    '/contacts': {
      get: {
        summary: 'List all contacts';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
        ];
        tags: ['Contacts'];
        operationId: 'ListContacts';
        description: 'You can fetch a list of all contacts (ie. users or leads) in your workspace.\n{% admonition type="warning" name="Pagination" %}\n  You can use pagination to limit the number of results returned. The default is `50` results per page.\n  See the [pagination section](https://developers.intercom.com/docs/build-an-integration/learn-more/rest-apis/pagination/#pagination-for-list-apis) for more details on how to use the `starting_after` param.\n{% /admonition %}\n';
        responses: {
          '200': {
            description: 'successful';
            content: {
              'application/json': {
                examples: {
                  successful: {
                    value: {
                      type: 'list';
                      data: [];
                      total_count: 0;
                      pages: {
                        type: 'pages';
                        page: 1;
                        per_page: 10;
                        total_pages: 0;
                      };
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/contact_list';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: 'e8bd0d1b-622c-4343-b613-01ba2803cbca';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
      };
      post: {
        summary: 'Create contact';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
        ];
        tags: ['Contacts'];
        operationId: 'CreateContact';
        description: 'You can create a new contact (ie. user or lead).';
        responses: {
          '200': {
            description: 'successful';
            content: {
              'application/json': {
                examples: {
                  successful: {
                    value: {
                      type: 'contact';
                      id: '6657aaf06abd0164c24b0d2f';
                      workspace_id: 'this_is_an_id283_that_should_be_at_least_';
                      external_id: null;
                      role: 'user';
                      email: 'joebloggs@intercom.io';
                      phone: null;
                      name: null;
                      avatar: null;
                      owner_id: null;
                      social_profiles: {
                        type: 'list';
                        data: [];
                      };
                      has_hard_bounced: false;
                      marked_email_as_spam: false;
                      unsubscribed_from_emails: false;
                      created_at: 1717021424;
                      updated_at: 1717021424;
                      signed_up_at: null;
                      last_seen_at: null;
                      last_replied_at: null;
                      last_contacted_at: null;
                      last_email_opened_at: null;
                      last_email_clicked_at: null;
                      language_override: null;
                      browser: null;
                      browser_version: null;
                      browser_language: null;
                      os: null;
                      location: {
                        type: 'location';
                        country: null;
                        region: null;
                        city: null;
                        country_code: null;
                        continent_code: null;
                      };
                      android_app_name: null;
                      android_app_version: null;
                      android_device: null;
                      android_os_version: null;
                      android_sdk_version: null;
                      android_last_seen_at: null;
                      ios_app_name: null;
                      ios_app_version: null;
                      ios_device: null;
                      ios_os_version: null;
                      ios_sdk_version: null;
                      ios_last_seen_at: null;
                      custom_attributes: {};
                      tags: {
                        type: 'list';
                        data: [];
                        url: '/contacts/6657aaf06abd0164c24b0d2f/tags';
                        total_count: 0;
                        has_more: false;
                      };
                      notes: {
                        type: 'list';
                        data: [];
                        url: '/contacts/6657aaf06abd0164c24b0d2f/notes';
                        total_count: 0;
                        has_more: false;
                      };
                      companies: {
                        type: 'list';
                        data: [];
                        url: '/contacts/6657aaf06abd0164c24b0d2f/companies';
                        total_count: 0;
                        has_more: false;
                      };
                      opted_out_subscription_types: {
                        type: 'list';
                        data: [];
                        url: '/contacts/6657aaf06abd0164c24b0d2f/subscriptions';
                        total_count: 0;
                        has_more: false;
                      };
                      opted_in_subscription_types: {
                        type: 'list';
                        data: [];
                        url: '/contacts/6657aaf06abd0164c24b0d2f/subscriptions';
                        total_count: 0;
                        has_more: false;
                      };
                      utm_campaign: null;
                      utm_content: null;
                      utm_medium: null;
                      utm_source: null;
                      utm_term: null;
                      referrer: null;
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/contact';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: '555fa590-2a77-4f14-a607-7fb420b1bc8b';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
        requestBody: {
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    $ref: '#/components/schemas/create_contact_request';
                  },
                ];
              };
              examples: {
                successful: {
                  summary: 'successful';
                  value: {
                    email: 'joebloggs@intercom.io';
                  };
                };
              };
            };
          };
        };
      };
    };
    '/contacts/{id}/archive': {
      post: {
        summary: 'Archive contact';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
          {
            name: 'id';
            in: 'path';
            description: 'id';
            example: '63a07ddf05a32042dffac965';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        tags: ['Contacts'];
        operationId: 'ArchiveContact';
        description: 'You can archive a single contact.';
        responses: {
          '200': {
            description: 'successful';
            content: {
              'application/json': {
                examples: {
                  successful: {
                    value: {
                      id: '6657aaf26abd0164c24b0d30';
                      object: 'contact';
                      archived: true;
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/contact_archived';
                };
              };
            };
          };
        };
      };
    };
    '/contacts/{id}/unarchive': {
      post: {
        summary: 'Unarchive contact';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
          {
            name: 'id';
            in: 'path';
            description: 'id';
            example: '63a07ddf05a32042dffac965';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        tags: ['Contacts'];
        operationId: 'UnarchiveContact';
        description: 'You can unarchive a single contact.';
        responses: {
          '200': {
            description: 'successful';
            content: {
              'application/json': {
                examples: {
                  successful: {
                    value: {
                      id: '6657aaf26abd0164c24b0d31';
                      object: 'contact';
                      archived: false;
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/contact_unarchived';
                };
              };
            };
          };
        };
      };
    };
    '/conversations/{conversation_id}/tags': {
      post: {
        summary: 'Add tag to a conversation';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
          {
            name: 'conversation_id';
            in: 'path';
            description: 'conversation_id';
            example: '64619700005694';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        tags: ['Tags', 'Conversations'];
        operationId: 'attachTagToConversation';
        description: 'You can tag a specific conversation. This will return a tag object for the tag that was added to the conversation.';
        responses: {
          '200': {
            description: 'successful';
            content: {
              'application/json': {
                examples: {
                  successful: {
                    value: {
                      type: 'tag';
                      id: '89';
                      name: 'Manual tag';
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/tag';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: 'd610fe70-342b-44fa-9e29-0bcfcaf1865f';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
          '404': {
            description: 'Conversation not found';
            content: {
              'application/json': {
                examples: {
                  'Conversation not found': {
                    value: {
                      type: 'error.list';
                      request_id: '1f017fec-9524-406d-9587-8dafdac7b0b2';
                      errors: [
                        {
                          code: 'not_found';
                          message: 'Conversation not found';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object';
                required: ['id', 'admin_id'];
                properties: {
                  id: {
                    type: 'string';
                    description: 'The unique identifier for the tag which is given by Intercom';
                    example: '7522907';
                  };
                  admin_id: {
                    type: 'string';
                    description: 'The unique identifier for the admin which is given by Intercom.';
                    example: '780';
                  };
                };
              };
              examples: {
                successful: {
                  summary: 'successful';
                  value: {
                    id: 89;
                    admin_id: 991267387;
                  };
                };
                conversation_not_found: {
                  summary: 'Conversation not found';
                  value: {
                    id: 90;
                    admin_id: 991267389;
                  };
                };
              };
            };
          };
        };
      };
    };
    '/conversations/{conversation_id}/tags/{id}': {
      delete: {
        summary: 'Remove tag from a conversation';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
          {
            name: 'conversation_id';
            in: 'path';
            description: 'conversation_id';
            example: '64619700005694';
            required: true;
            schema: {
              type: 'string';
            };
          },
          {
            name: 'id';
            in: 'path';
            description: 'id';
            example: '7522907';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        tags: ['Tags', 'Conversations'];
        operationId: 'detachTagFromConversation';
        description: 'You can remove tag from a specific conversation. This will return a tag object for the tag that was removed from the conversation.';
        responses: {
          '200': {
            description: 'successful';
            content: {
              'application/json': {
                examples: {
                  successful: {
                    value: {
                      type: 'tag';
                      id: '92';
                      name: 'Manual tag';
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/tag';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: '8591b1dd-51af-4927-a3eb-2f92738d5fe3';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
          '404': {
            description: 'Tag not found';
            content: {
              'application/json': {
                examples: {
                  'Conversation not found': {
                    value: {
                      type: 'error.list';
                      request_id: '196f750c-77c5-458d-95cd-a2eb06eb93c9';
                      errors: [
                        {
                          code: 'not_found';
                          message: 'Conversation not found';
                        },
                      ];
                    };
                  };
                  'Tag not found': {
                    value: {
                      type: 'error.list';
                      request_id: '7bf65c4c-15a4-42da-9c01-3a7fd9801d41';
                      errors: [
                        {
                          code: 'tag_not_found';
                          message: 'Tag not found';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object';
                required: ['admin_id'];
                properties: {
                  admin_id: {
                    type: 'string';
                    description: 'The unique identifier for the admin which is given by Intercom.';
                    example: '123';
                  };
                };
              };
              examples: {
                successful: {
                  summary: 'successful';
                  value: {
                    admin_id: 991267391;
                  };
                };
                conversation_not_found: {
                  summary: 'Conversation not found';
                  value: {
                    admin_id: 991267393;
                  };
                };
                tag_not_found: {
                  summary: 'Tag not found';
                  value: {
                    admin_id: 991267394;
                  };
                };
              };
            };
          };
        };
      };
    };
    '/conversations': {
      get: {
        summary: 'List all conversations';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
          {
            name: 'per_page';
            in: 'query';
            schema: {
              type: 'integer';
              default: 20;
              maximum: 150;
            };
            required: false;
            description: 'How many results per page';
          },
          {
            name: 'starting_after';
            in: 'query';
            required: false;
            description: 'String used to get the next page of conversations.';
            schema: {
              type: 'string';
            };
          },
        ];
        tags: ['Conversations'];
        operationId: 'listConversations';
        description: 'You can fetch a list of all conversations.\n\nYou can optionally request the result page size and the cursor to start after to fetch the result.\n{% admonition type="warning" name="Pagination" %}\n  You can use pagination to limit the number of results returned. The default is `20` results per page.\n  See the [pagination section](https://developers.intercom.com/docs/build-an-integration/learn-more/rest-apis/pagination/#pagination-for-list-apis) for more details on how to use the `starting_after` param.\n{% /admonition %}\n';
        responses: {
          '200': {
            description: 'successful';
            content: {
              'application/json': {
                examples: {
                  successful: {
                    value: {
                      type: 'conversation.list';
                      pages: {
                        type: 'pages';
                        page: 1;
                        per_page: 20;
                        total_pages: 1;
                      };
                      total_count: 1;
                      conversations: [
                        {
                          type: 'conversation';
                          id: '301';
                          created_at: 1717021435;
                          updated_at: 1717021435;
                          waiting_since: null;
                          snoozed_until: null;
                          source: {
                            type: 'conversation';
                            id: '403918227';
                            delivered_as: 'admin_initiated';
                            subject: '';
                            body: '<p>this is the message body</p>';
                            author: {
                              type: 'admin';
                              id: '991267397';
                              name: 'Ciaran152 Lee';
                              email: 'admin152@email.com';
                            };
                            attachments: [];
                            url: null;
                            redacted: false;
                          };
                          contacts: {
                            type: 'contact.list';
                            contacts: [
                              {
                                type: 'contact';
                                id: '6657aafb6abd0164c24b0d35';
                              },
                            ];
                          };
                          first_contact_reply: null;
                          admin_assignee_id: null;
                          team_assignee_id: null;
                          open: false;
                          state: 'closed';
                          read: false;
                          tags: {
                            type: 'tag.list';
                            tags: [];
                          };
                          priority: 'not_priority';
                          sla_applied: null;
                          statistics: null;
                          conversation_rating: null;
                          teammates: null;
                          title: null;
                          custom_attributes: {};
                          topics: {};
                          ticket: null;
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/paginated_response';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: 'de4b1b6d-c724-4b8b-829b-12f7fcb40473';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
          '403': {
            description: 'API plan restricted';
            content: {
              'application/json': {
                examples: {
                  'API plan restricted': {
                    value: {
                      type: 'error.list';
                      request_id: 'ae58f677-d8b7-4a9d-8686-2418c79b060f';
                      errors: [
                        {
                          code: 'api_plan_restricted';
                          message: 'Active subscription needed.';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
      };
      post: {
        summary: 'Creates a conversation';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
        ];
        tags: ['Conversations'];
        operationId: 'createConversation';
        description: 'You can create a conversation that has been initiated by a contact (ie. user or lead).\nThe conversation can be an in-app message only.\n\n{% admonition type="info" name="Sending for visitors" %}\nYou can also send a message from a visitor by specifying their `user_id` or `id` value in the `from` field, along with a `type` field value of `contact`.\nThis visitor will be automatically converted to a contact with a lead role once the conversation is created.\n{% /admonition %}\n\nThis will return the Message model that has been created.\n\n';
        responses: {
          '200': {
            description: 'conversation created';
            content: {
              'application/json': {
                examples: {
                  'conversation created': {
                    value: {
                      type: 'user_message';
                      id: '403918237';
                      created_at: 1717021458;
                      body: 'Hello there';
                      message_type: 'inapp';
                      conversation_id: '329';
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/message';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: '11e20110-32ad-4b8b-92db-a3430d929f55';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
          '403': {
            description: 'API plan restricted';
            content: {
              'application/json': {
                examples: {
                  'API plan restricted': {
                    value: {
                      type: 'error.list';
                      request_id: 'f304a890-faa2-4a77-90ad-6a711da1f79a';
                      errors: [
                        {
                          code: 'api_plan_restricted';
                          message: 'Active subscription needed.';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
          '404': {
            description: 'Contact Not Found';
            content: {
              'application/json': {
                examples: {
                  'Contact Not Found': {
                    value: {
                      type: 'error.list';
                      request_id: 'ffaf1bd9-3b6d-47bc-97ec-644e7739e0b0';
                      errors: [
                        {
                          code: 'not_found';
                          message: 'User Not Found';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/create_conversation_request';
              };
              examples: {
                conversation_created: {
                  summary: 'conversation created';
                  value: {
                    from: {
                      type: 'user';
                      id: '6657ab116abd0164c24b0d4d';
                    };
                    body: 'Hello there';
                  };
                };
                contact_not_found: {
                  summary: 'Contact Not Found';
                  value: {
                    from: {
                      type: 'user';
                      id: '123_doesnt_exist';
                    };
                    body: 'Hello there';
                  };
                };
              };
            };
          };
        };
      };
    };
    '/conversations/{id}': {
      get: {
        summary: 'Retrieve a conversation';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
          {
            name: 'id';
            in: 'path';
            required: true;
            description: 'The id of the conversation to target';
            example: 123;
            schema: {
              type: 'integer';
            };
          },
          {
            name: 'display_as';
            in: 'query';
            required: false;
            description: 'Set to plaintext to retrieve conversation messages in plain text.';
            example: 'plaintext';
            schema: {
              type: 'string';
            };
          },
        ];
        tags: ['Conversations'];
        operationId: 'retrieveConversation';
        description: '\nYou can fetch the details of a single conversation.\n\nThis will return a single Conversation model with all its conversation parts.\n\n{% admonition type="warning" name="Hard limit of 500 parts" %}\nThe maximum number of conversation parts that can be returned via the API is 500. If you have more than that we will return the 500 most recent conversation parts.\n{% /admonition %}\n\nFor AI agent conversation metadata, please note that you need to have the agent enabled in your workspace, which is a [paid feature](https://www.intercom.com/help/en/articles/8205718-fin-resolutions#h_97f8c2e671).\n';
        responses: {
          '200': {
            description: 'conversation found';
            content: {
              'application/json': {
                examples: {
                  'conversation found': {
                    value: {
                      type: 'conversation';
                      id: '333';
                      created_at: 1717021463;
                      updated_at: 1717021463;
                      waiting_since: null;
                      snoozed_until: null;
                      source: {
                        type: 'conversation';
                        id: '403918241';
                        delivered_as: 'admin_initiated';
                        subject: '';
                        body: '<p>this is the message body</p>';
                        author: {
                          type: 'admin';
                          id: '991267414';
                          name: 'Ciaran162 Lee';
                          email: 'admin162@email.com';
                        };
                        attachments: [];
                        url: null;
                        redacted: false;
                      };
                      contacts: {
                        type: 'contact.list';
                        contacts: [
                          {
                            type: 'contact';
                            id: '6657ab176abd0164c24b0d51';
                          },
                        ];
                      };
                      first_contact_reply: null;
                      admin_assignee_id: null;
                      team_assignee_id: null;
                      open: false;
                      state: 'closed';
                      read: false;
                      tags: {
                        type: 'tag.list';
                        tags: [];
                      };
                      priority: 'not_priority';
                      sla_applied: null;
                      statistics: null;
                      conversation_rating: null;
                      teammates: null;
                      title: null;
                      custom_attributes: {};
                      topics: {};
                      ticket: null;
                      conversation_parts: {
                        type: 'conversation_part.list';
                        conversation_parts: [];
                        total_count: 0;
                      };
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/conversation';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: '9ba8124b-f405-4d50-a274-7c91a0ccd624';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
          '403': {
            description: 'API plan restricted';
            content: {
              'application/json': {
                examples: {
                  'API plan restricted': {
                    value: {
                      type: 'error.list';
                      request_id: 'ffffbffd-8a8c-49df-a4c1-74e76782150c';
                      errors: [
                        {
                          code: 'api_plan_restricted';
                          message: 'Active subscription needed.';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
          '404': {
            description: 'Not found';
            content: {
              'application/json': {
                examples: {
                  'Not found': {
                    value: {
                      type: 'error.list';
                      request_id: '3b602881-22c9-4fd1-86d4-668e2befa292';
                      errors: [
                        {
                          code: 'not_found';
                          message: 'Resource Not Found';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
      };
      put: {
        summary: 'Update a conversation';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
          {
            name: 'id';
            in: 'path';
            required: true;
            description: 'The id of the conversation to target';
            example: 123;
            schema: {
              type: 'integer';
            };
          },
          {
            name: 'display_as';
            in: 'query';
            required: false;
            description: 'Set to plaintext to retrieve conversation messages in plain text.';
            example: 'plaintext';
            schema: {
              type: 'string';
            };
          },
        ];
        tags: ['Conversations'];
        operationId: 'updateConversation';
        description: '\nYou can update an existing conversation.\n\n{% admonition type="info" name="Replying and other actions" %}\nIf you want to reply to a coveration or take an action such as assign, unassign, open, close or snooze, take a look at the reply and manage endpoints.\n{% /admonition %}\n\n';
        responses: {
          '200': {
            description: 'conversation found';
            content: {
              'application/json': {
                examples: {
                  'conversation found': {
                    value: {
                      type: 'conversation';
                      id: '337';
                      created_at: 1717021469;
                      updated_at: 1717021471;
                      waiting_since: null;
                      snoozed_until: null;
                      source: {
                        type: 'conversation';
                        id: '403918245';
                        delivered_as: 'admin_initiated';
                        subject: '';
                        body: '<p>this is the message body</p>';
                        author: {
                          type: 'admin';
                          id: '991267422';
                          name: 'Ciaran166 Lee';
                          email: 'admin166@email.com';
                        };
                        attachments: [];
                        url: null;
                        redacted: false;
                      };
                      contacts: {
                        type: 'contact.list';
                        contacts: [
                          {
                            type: 'contact';
                            id: '6657ab1d6abd0164c24b0d55';
                          },
                        ];
                      };
                      first_contact_reply: null;
                      admin_assignee_id: null;
                      team_assignee_id: null;
                      open: false;
                      state: 'closed';
                      read: true;
                      tags: {
                        type: 'tag.list';
                        tags: [];
                      };
                      priority: 'not_priority';
                      sla_applied: null;
                      statistics: null;
                      conversation_rating: null;
                      teammates: null;
                      title: null;
                      custom_attributes: {
                        issue_type: 'Billing';
                        priority: 'High';
                      };
                      topics: {};
                      ticket: null;
                      conversation_parts: {
                        type: 'conversation_part.list';
                        conversation_parts: [
                          {
                            type: 'conversation_part';
                            id: '68';
                            part_type: 'conversation_attribute_updated_by_admin';
                            body: null;
                            created_at: 1717021471;
                            updated_at: 1717021471;
                            notified_at: 1717021471;
                            assigned_to: null;
                            author: {
                              id: '991267423';
                              type: 'bot';
                              name: 'Operator';
                              email: 'operator+this_is_an_id332_that_should_be_at_least_@intercom.io';
                            };
                            attachments: [];
                            external_id: null;
                            redacted: false;
                          },
                          {
                            type: 'conversation_part';
                            id: '69';
                            part_type: 'conversation_attribute_updated_by_admin';
                            body: null;
                            created_at: 1717021471;
                            updated_at: 1717021471;
                            notified_at: 1717021471;
                            assigned_to: null;
                            author: {
                              id: '991267423';
                              type: 'bot';
                              name: 'Operator';
                              email: 'operator+this_is_an_id332_that_should_be_at_least_@intercom.io';
                            };
                            attachments: [];
                            external_id: null;
                            redacted: false;
                          },
                        ];
                        total_count: 2;
                      };
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/conversation';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: '91390a0b-072d-460f-8479-68b449551f18';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
          '403': {
            description: 'API plan restricted';
            content: {
              'application/json': {
                examples: {
                  'API plan restricted': {
                    value: {
                      type: 'error.list';
                      request_id: '550bb111-91b0-4b1a-a0ba-7a0d4d4fe4a5';
                      errors: [
                        {
                          code: 'api_plan_restricted';
                          message: 'Active subscription needed.';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
          '404': {
            description: 'Not found';
            content: {
              'application/json': {
                examples: {
                  'Not found': {
                    value: {
                      type: 'error.list';
                      request_id: '10e790d1-780d-44c8-8f3d-10ad1e4ada0c';
                      errors: [
                        {
                          code: 'not_found';
                          message: 'Resource Not Found';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/update_conversation_request';
              };
              examples: {
                conversation_found: {
                  summary: 'conversation found';
                  value: {
                    read: true;
                    custom_attributes: {
                      issue_type: 'Billing';
                      priority: 'High';
                    };
                  };
                };
                not_found: {
                  summary: 'Not found';
                  value: {
                    read: true;
                    custom_attributes: {
                      issue_type: 'Billing';
                      priority: 'High';
                    };
                  };
                };
              };
            };
          };
        };
      };
    };
    '/conversations/search': {
      post: {
        summary: 'Search conversations';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
        ];
        tags: ['Conversations'];
        operationId: 'searchConversations';
        description: 'You can search for multiple conversations by the value of their attributes in order to fetch exactly which ones you want.\n\nTo search for conversations, you need to send a `POST` request to `https://api.intercom.io/conversations/search`.\n\nThis will accept a query object in the body which will define your filters in order to search for conversations.\n{% admonition type="warning" name="Optimizing search queries" %}\n  Search queries can be complex, so optimizing them can help the performance of your search.\n  Use the `AND` and `OR` operators to combine multiple filters to get the exact results you need and utilize\n  pagination to limit the number of results returned. The default is `20` results per page and maximum is `150`.\n  See the [pagination section](https://developers.intercom.com/docs/build-an-integration/learn-more/rest-apis/pagination/#example-search-conversations-request) for more details on how to use the `starting_after` param.\n{% /admonition %}\n\n### Nesting & Limitations\n\nYou can nest these filters in order to get even more granular insights that pinpoint exactly what you need. Example: (1 OR 2) AND (3 OR 4).\nThere are some limitations to the amount of multiple\'s there can be:\n- There\'s a limit of max 2 nested filters\n- There\'s a limit of max 15 filters for each AND or OR group\n\n### Accepted Fields\n\nMost keys listed as part of the The conversation model is searchable, whether writeable or not. The value you search for has to match the accepted type, otherwise the query will fail (ie. as `created_at` accepts a date, the `value` cannot be a string such as `"foorbar"`).\nThe `source.body` field is unique as the search will not be performed against the entire value, but instead against every element of the value separately. For example, when searching for a conversation with a `"I need support"` body - the query should contain a `=` operator with the value `"support"` for such conversation to be returned. A query with a `=` operator and a `"need support"` value will not yield a result.\n\n| Field                                     | Type                                                                                                                                                   |\n| :---------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------- |\n| id                                        | String                                                                                                                                                 |\n| created_at                                | Date (UNIX timestamp)                                                                                                                                  |\n| updated_at                                | Date (UNIX timestamp)                                                                                                                                  |\n| source.type                               | String<br>Accepted fields are `conversation`, `email`, `facebook`, `instagram`, `phone_call`, `phone_switch`, `push`, `sms`, `twitter` and `whatsapp`. |\n| source.id                                 | String                                                                                                                                                 |\n| source.delivered_as                       | String                                                                                                                                                 |\n| source.subject                            | String                                                                                                                                                 |\n| source.body                               | String                                                                                                                                                 |\n| source.author.id                          | String                                                                                                                                                 |\n| source.author.type                        | String                                                                                                                                                 |\n| source.author.name                        | String                                                                                                                                                 |\n| source.author.email                       | String                                                                                                                                                 |\n| source.url                                | String                                                                                                                                                 |\n| contact_ids                               | String                                                                                                                                                 |\n| teammate_ids                              | String                                                                                                                                                 |\n| admin_assignee_id                         | String                                                                                                                                                 |\n| team_assignee_id                          | String                                                                                                                                                 |\n| channel_initiated                         | String                                                                                                                                                 |\n| open                                      | Boolean                                                                                                                                                |\n| read                                      | Boolean                                                                                                                                                |\n| state                                     | String                                                                                                                                                 |\n| waiting_since                             | Date (UNIX timestamp)                                                                                                                                  |\n| snoozed_until                             | Date (UNIX timestamp)                                                                                                                                  |\n| tag_ids                                   | String                                                                                                                                                 |\n| priority                                  | String                                                                                                                                                 |\n| statistics.time_to_assignment             | Integer                                                                                                                                                |\n| statistics.time_to_admin_reply            | Integer                                                                                                                                                |\n| statistics.time_to_first_close            | Integer                                                                                                                                                |\n| statistics.time_to_last_close             | Integer                                                                                                                                                |\n| statistics.median_time_to_reply           | Integer                                                                                                                                                |\n| statistics.first_contact_reply_at         | Date (UNIX timestamp)                                                                                                                                  |\n| statistics.first_assignment_at            | Date (UNIX timestamp)                                                                                                                                  |\n| statistics.first_admin_reply_at           | Date (UNIX timestamp)                                                                                                                                  |\n| statistics.first_close_at                 | Date (UNIX timestamp)                                                                                                                                  |\n| statistics.last_assignment_at             | Date (UNIX timestamp)                                                                                                                                  |\n| statistics.last_assignment_admin_reply_at | Date (UNIX timestamp)                                                                                                                                  |\n| statistics.last_contact_reply_at          | Date (UNIX timestamp)                                                                                                                                  |\n| statistics.last_admin_reply_at            | Date (UNIX timestamp)                                                                                                                                  |\n| statistics.last_close_at                  | Date (UNIX timestamp)                                                                                                                                  |\n| statistics.last_closed_by_id              | String                                                                                                                                                 |\n| statistics.count_reopens                  | Integer                                                                                                                                                |\n| statistics.count_assignments              | Integer                                                                                                                                                |\n| statistics.count_conversation_parts       | Integer                                                                                                                                                |\n| conversation_rating.requested_at          | Date (UNIX timestamp)                                                                                                                                  |\n| conversation_rating.replied_at            | Date (UNIX timestamp)                                                                                                                                  |\n| conversation_rating.score                 | Integer                                                                                                                                                |\n| conversation_rating.remark                | String                                                                                                                                                 |\n| conversation_rating.contact_id            | String                                                                                                                                                 |\n| conversation_rating.admin_d               | String                                                                                                                                                 |\n| ai_agent_participated                     | Boolean                                                                                                                                                |\n| ai_agent.resolution_state                 | String                                                                                                                                                 |\n| ai_agent.last_answer_type                 | String                                                                                                                                                 |\n| ai_agent.rating                           | Integer                                                                                                                                                |\n| ai_agent.rating_remark                    | String                                                                                                                                                 |\n| ai_agent.source_type                      | String                                                                                                                                                 |\n| ai_agent.source_title                     | String                                                                                                                                                 |\n\n### Accepted Operators\n\nThe table below shows the operators you can use to define how you want to search for the value.  The operator should be put in as a string (`"="`). The operator has to be compatible with the field\'s type  (eg. you cannot search with `>` for a given string value as it\'s only compatible for integer\'s and dates).\n\n| Operator | Valid Types                    | Description                                                  |\n| :------- | :----------------------------- | :----------------------------------------------------------- |\n| =        | All                            | Equals                                                       |\n| !=       | All                            | Doesn\'t Equal                                                |\n| IN       | All                            | In  Shortcut for `OR` queries  Values most be in Array       |\n| NIN      | All                            | Not In  Shortcut for `OR !` queries  Values must be in Array |\n| >        | Integer  Date (UNIX Timestamp) | Greater (or equal) than                                      |\n| <       | Integer  Date (UNIX Timestamp) | Lower (or equal) than                                        |\n| ~        | String                         | Contains                                                     |\n| !~       | String                         | Doesn\'t Contain                                              |\n| ^        | String                         | Starts With                                                  |\n| $        | String                         | Ends With                                                    |\n';
        responses: {
          '200': {
            description: 'successful';
            content: {
              'application/json': {
                examples: {
                  successful: {
                    value: {
                      type: 'conversation.list';
                      pages: {
                        type: 'pages';
                        page: 1;
                        per_page: 5;
                        total_pages: 1;
                      };
                      total_count: 1;
                      conversations: [
                        {
                          type: 'conversation';
                          id: '344';
                          created_at: 1717021480;
                          updated_at: 1717021480;
                          waiting_since: null;
                          snoozed_until: null;
                          source: {
                            type: 'conversation';
                            id: '403918252';
                            delivered_as: 'admin_initiated';
                            subject: '';
                            body: '<p>this is the message body</p>';
                            author: {
                              type: 'admin';
                              id: '991267452';
                              name: 'Ciaran189 Lee';
                              email: 'admin189@email.com';
                            };
                            attachments: [];
                            url: null;
                            redacted: false;
                          };
                          contacts: {
                            type: 'contact.list';
                            contacts: [
                              {
                                type: 'contact';
                                id: '6657ab286abd0164c24b0d5c';
                              },
                            ];
                          };
                          first_contact_reply: null;
                          admin_assignee_id: null;
                          team_assignee_id: null;
                          open: false;
                          state: 'closed';
                          read: false;
                          tags: {
                            type: 'tag.list';
                            tags: [];
                          };
                          priority: 'not_priority';
                          sla_applied: null;
                          statistics: null;
                          conversation_rating: null;
                          teammates: null;
                          title: null;
                          custom_attributes: {};
                          topics: {};
                          ticket: null;
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/conversation_list';
                };
              };
            };
          };
        };
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/search_request';
              };
              examples: {
                successful: {
                  summary: 'successful';
                  value: {
                    query: {
                      operator: 'AND';
                      value: [
                        {
                          field: 'created_at';
                          operator: '>';
                          value: '1306054154';
                        },
                      ];
                    };
                    pagination: {
                      per_page: 5;
                    };
                  };
                };
              };
            };
          };
        };
      };
    };
    '/conversations/{id}/reply': {
      post: {
        summary: 'Reply to a conversation';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
          {
            name: 'id';
            in: 'path';
            required: true;
            description: 'The Intercom provisioned identifier for the conversation or the string "last" to reply to the last part of the conversation';
            example: '123 or "last"';
            schema: {
              type: 'string';
            };
          },
        ];
        tags: ['Conversations'];
        operationId: 'replyConversation';
        description: 'You can reply to a conversation with a message from an admin or on behalf of a contact, or with a note for admins.';
        responses: {
          '200': {
            description: 'User last conversation reply';
            content: {
              'application/json': {
                examples: {
                  'User reply': {
                    value: {
                      type: 'conversation';
                      id: '353';
                      created_at: 1717021487;
                      updated_at: 1717021489;
                      waiting_since: 1717021488;
                      snoozed_until: null;
                      source: {
                        type: 'conversation';
                        id: '403918255';
                        delivered_as: 'admin_initiated';
                        subject: '';
                        body: '<p>this is the message body</p>';
                        author: {
                          type: 'admin';
                          id: '991267455';
                          name: 'Ciaran191 Lee';
                          email: 'admin191@email.com';
                        };
                        attachments: [];
                        url: null;
                        redacted: false;
                      };
                      contacts: {
                        type: 'contact.list';
                        contacts: [
                          {
                            type: 'contact';
                            id: '6657ab2f6abd0164c24b0d64';
                          },
                        ];
                      };
                      first_contact_reply: {
                        created_at: 1717021488;
                        type: 'conversation';
                        url: null;
                      };
                      admin_assignee_id: null;
                      team_assignee_id: null;
                      open: true;
                      state: 'open';
                      read: false;
                      tags: {
                        type: 'tag.list';
                        tags: [];
                      };
                      priority: 'not_priority';
                      sla_applied: null;
                      statistics: null;
                      conversation_rating: null;
                      teammates: null;
                      title: null;
                      custom_attributes: {};
                      topics: {};
                      ticket: null;
                      conversation_parts: {
                        type: 'conversation_part.list';
                        conversation_parts: [
                          {
                            type: 'conversation_part';
                            id: '71';
                            part_type: 'open';
                            body: '<p>Thanks again :)</p>';
                            created_at: 1717021488;
                            updated_at: 1717021488;
                            notified_at: 1717021488;
                            assigned_to: null;
                            author: {
                              id: '6657ab2f6abd0164c24b0d64';
                              type: 'user';
                              name: 'Joe Bloggs';
                              email: 'joe@bloggs.com';
                            };
                            attachments: [];
                            external_id: null;
                            redacted: false;
                          },
                          {
                            type: 'conversation_part';
                            id: '72';
                            part_type: 'language_detection_details';
                            body: null;
                            created_at: 1717021489;
                            updated_at: 1717021489;
                            notified_at: 1717021489;
                            assigned_to: null;
                            author: {
                              id: '991267456';
                              type: 'bot';
                              name: 'Operator';
                              email: 'operator+this_is_an_id346_that_should_be_at_least_@intercom.io';
                            };
                            attachments: [];
                            external_id: null;
                            redacted: false;
                          },
                        ];
                        total_count: 2;
                      };
                    };
                  };
                  'Admin note reply': {
                    value: {
                      type: 'conversation';
                      id: '354';
                      created_at: 1717021490;
                      updated_at: 1717021491;
                      waiting_since: null;
                      snoozed_until: null;
                      source: {
                        type: 'conversation';
                        id: '403918256';
                        delivered_as: 'admin_initiated';
                        subject: '';
                        body: '<p>this is the message body</p>';
                        author: {
                          type: 'admin';
                          id: '991267457';
                          name: 'Ciaran192 Lee';
                          email: 'admin192@email.com';
                        };
                        attachments: [];
                        url: null;
                        redacted: false;
                      };
                      contacts: {
                        type: 'contact.list';
                        contacts: [
                          {
                            type: 'contact';
                            id: '6657ab326abd0164c24b0d65';
                          },
                        ];
                      };
                      first_contact_reply: null;
                      admin_assignee_id: null;
                      team_assignee_id: null;
                      open: false;
                      state: 'closed';
                      read: false;
                      tags: {
                        type: 'tag.list';
                        tags: [];
                      };
                      priority: 'not_priority';
                      sla_applied: null;
                      statistics: null;
                      conversation_rating: null;
                      teammates: null;
                      title: null;
                      custom_attributes: {};
                      topics: {};
                      ticket: null;
                      conversation_parts: {
                        type: 'conversation_part.list';
                        conversation_parts: [
                          {
                            type: 'conversation_part';
                            id: '73';
                            part_type: 'note';
                            body: '<h2>An Unordered HTML List</h2>\n<ul>\n<li>Coffee</li>\n<li>Tea</li>\n<li>Milk</li>\n</ul>\n<h2>An Ordered HTML List</h2>\n<ol>\n<li>Coffee</li>\n<li>Tea</li>\n<li>Milk</li>\n</ol>';
                            created_at: 1717021491;
                            updated_at: 1717021491;
                            notified_at: 1717021491;
                            assigned_to: null;
                            author: {
                              id: '991267457';
                              type: 'admin';
                              name: 'Ciaran192 Lee';
                              email: 'admin192@email.com';
                            };
                            attachments: [];
                            external_id: null;
                            redacted: false;
                          },
                        ];
                        total_count: 1;
                      };
                    };
                  };
                  'User last conversation reply': {
                    value: {
                      type: 'conversation';
                      id: '356';
                      created_at: 1717021493;
                      updated_at: 1717021494;
                      waiting_since: 1717021494;
                      snoozed_until: null;
                      source: {
                        type: 'conversation';
                        id: '403918258';
                        delivered_as: 'admin_initiated';
                        subject: '';
                        body: '<p>this is the message body</p>';
                        author: {
                          type: 'admin';
                          id: '991267461';
                          name: 'Ciaran194 Lee';
                          email: 'admin194@email.com';
                        };
                        attachments: [];
                        url: null;
                        redacted: false;
                      };
                      contacts: {
                        type: 'contact.list';
                        contacts: [
                          {
                            type: 'contact';
                            id: '6657ab356abd0164c24b0d67';
                          },
                        ];
                      };
                      first_contact_reply: {
                        created_at: 1717021494;
                        type: 'conversation';
                        url: null;
                      };
                      admin_assignee_id: null;
                      team_assignee_id: null;
                      open: true;
                      state: 'open';
                      read: false;
                      tags: {
                        type: 'tag.list';
                        tags: [];
                      };
                      priority: 'not_priority';
                      sla_applied: null;
                      statistics: null;
                      conversation_rating: null;
                      teammates: null;
                      title: null;
                      custom_attributes: {};
                      topics: {};
                      ticket: null;
                      conversation_parts: {
                        type: 'conversation_part.list';
                        conversation_parts: [
                          {
                            type: 'conversation_part';
                            id: '74';
                            part_type: 'open';
                            body: '<p>Thanks again :)</p>';
                            created_at: 1717021494;
                            updated_at: 1717021494;
                            notified_at: 1717021494;
                            assigned_to: null;
                            author: {
                              id: '6657ab356abd0164c24b0d67';
                              type: 'user';
                              name: 'Joe Bloggs';
                              email: 'joe@bloggs.com';
                            };
                            attachments: [];
                            external_id: null;
                            redacted: false;
                          },
                          {
                            type: 'conversation_part';
                            id: '75';
                            part_type: 'language_detection_details';
                            body: null;
                            created_at: 1717021494;
                            updated_at: 1717021494;
                            notified_at: 1717021494;
                            assigned_to: null;
                            author: {
                              id: '991267462';
                              type: 'bot';
                              name: 'Operator';
                              email: 'operator+this_is_an_id352_that_should_be_at_least_@intercom.io';
                            };
                            attachments: [];
                            external_id: null;
                            redacted: false;
                          },
                        ];
                        total_count: 2;
                      };
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/conversation';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: 'b7b53b82-b194-4cca-ae16-e96b5f026b32';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
          '403': {
            description: 'API plan restricted';
            content: {
              'application/json': {
                examples: {
                  'API plan restricted': {
                    value: {
                      type: 'error.list';
                      request_id: '14779f4f-31d1-46cc-a4fa-7d799bdcbef6';
                      errors: [
                        {
                          code: 'api_plan_restricted';
                          message: 'Active subscription needed.';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
          '404': {
            description: 'Not found';
            content: {
              'application/json': {
                examples: {
                  'Not found': {
                    value: {
                      type: 'error.list';
                      request_id: '89de1a37-4535-4bd5-84d8-8ce890d12fa5';
                      errors: [
                        {
                          code: 'not_found';
                          message: 'Resource Not Found';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/reply_conversation_request';
              };
              examples: {
                user_reply: {
                  summary: 'User reply';
                  value: {
                    message_type: 'comment';
                    type: 'user';
                    intercom_user_id: '6657ab2f6abd0164c24b0d64';
                    body: 'Thanks again :)';
                  };
                };
                admin_note_reply: {
                  summary: 'Admin note reply';
                  value: {
                    message_type: 'note';
                    type: 'admin';
                    admin_id: 991267457;
                    body: '<html> <body>  <h2>An Unordered HTML List</h2>  <ul>   <li>Coffee</li>   <li>Tea</li>   <li>Milk</li> </ul>    <h2>An Ordered HTML List</h2>  <ol>   <li>Coffee</li>   <li>Tea</li>   <li>Milk</li> </ol>   </body> </html>';
                  };
                };
                user_last_conversation_reply: {
                  summary: 'User last conversation reply';
                  value: {
                    message_type: 'comment';
                    type: 'user';
                    intercom_user_id: '6657ab356abd0164c24b0d67';
                    body: 'Thanks again :)';
                  };
                };
                not_found: {
                  summary: 'Not found';
                  value: {
                    message_type: 'comment';
                    type: 'user';
                    intercom_user_id: '6657ab376abd0164c24b0d68';
                    body: 'Thanks again :)';
                  };
                };
              };
            };
          };
        };
      };
    };
    '/conversations/{id}/parts': {
      post: {
        summary: 'Manage a conversation';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
          {
            name: 'id';
            in: 'path';
            required: true;
            description: 'The identifier for the conversation as given by Intercom.';
            example: '123';
            schema: {
              type: 'string';
            };
          },
        ];
        tags: ['Conversations'];
        operationId: 'manageConversation';
        description: 'For managing conversations you can:\n- Close a conversation\n- Snooze a conversation to reopen on a future date\n- Open a conversation which is `snoozed` or `closed`\n- Assign a conversation to an admin and/or team.\n';
        responses: {
          '200': {
            description: 'Assign a conversation';
            content: {
              'application/json': {
                examples: {
                  'Close a conversation': {
                    value: {
                      type: 'conversation';
                      id: '360';
                      created_at: 1717021500;
                      updated_at: 1717021501;
                      waiting_since: null;
                      snoozed_until: null;
                      source: {
                        type: 'conversation';
                        id: '403918262';
                        delivered_as: 'admin_initiated';
                        subject: '';
                        body: '<p>this is the message body</p>';
                        author: {
                          type: 'admin';
                          id: '991267469';
                          name: 'Ciaran198 Lee';
                          email: 'admin198@email.com';
                        };
                        attachments: [];
                        url: null;
                        redacted: false;
                      };
                      contacts: {
                        type: 'contact.list';
                        contacts: [
                          {
                            type: 'contact';
                            id: '6657ab3c6abd0164c24b0d6b';
                          },
                        ];
                      };
                      first_contact_reply: null;
                      admin_assignee_id: null;
                      team_assignee_id: null;
                      open: false;
                      state: 'closed';
                      read: false;
                      tags: {
                        type: 'tag.list';
                        tags: [];
                      };
                      priority: 'not_priority';
                      sla_applied: null;
                      statistics: null;
                      conversation_rating: null;
                      teammates: null;
                      title: null;
                      custom_attributes: {};
                      topics: {};
                      ticket: null;
                      conversation_parts: {
                        type: 'conversation_part.list';
                        conversation_parts: [
                          {
                            type: 'conversation_part';
                            id: '76';
                            part_type: 'close';
                            body: '<p>Goodbye :)</p>';
                            created_at: 1717021501;
                            updated_at: 1717021501;
                            notified_at: 1717021501;
                            assigned_to: null;
                            author: {
                              id: '991267469';
                              type: 'admin';
                              name: 'Ciaran198 Lee';
                              email: 'admin198@email.com';
                            };
                            attachments: [];
                            external_id: null;
                            redacted: false;
                          },
                        ];
                        total_count: 1;
                      };
                    };
                  };
                  'Snooze a conversation': {
                    value: {
                      type: 'conversation';
                      id: '361';
                      created_at: 1717021502;
                      updated_at: 1717021503;
                      waiting_since: null;
                      snoozed_until: 1717025103;
                      source: {
                        type: 'conversation';
                        id: '403918263';
                        delivered_as: 'admin_initiated';
                        subject: '';
                        body: '<p>this is the message body</p>';
                        author: {
                          type: 'admin';
                          id: '991267471';
                          name: 'Ciaran199 Lee';
                          email: 'admin199@email.com';
                        };
                        attachments: [];
                        url: null;
                        redacted: false;
                      };
                      contacts: {
                        type: 'contact.list';
                        contacts: [
                          {
                            type: 'contact';
                            id: '6657ab3e6abd0164c24b0d6c';
                          },
                        ];
                      };
                      first_contact_reply: null;
                      admin_assignee_id: null;
                      team_assignee_id: null;
                      open: true;
                      state: 'snoozed';
                      read: false;
                      tags: {
                        type: 'tag.list';
                        tags: [];
                      };
                      priority: 'not_priority';
                      sla_applied: null;
                      statistics: null;
                      conversation_rating: null;
                      teammates: null;
                      title: null;
                      custom_attributes: {};
                      topics: {};
                      ticket: null;
                      conversation_parts: {
                        type: 'conversation_part.list';
                        conversation_parts: [
                          {
                            type: 'conversation_part';
                            id: '77';
                            part_type: 'snoozed';
                            body: null;
                            created_at: 1717021503;
                            updated_at: 1717021503;
                            notified_at: 1717021503;
                            assigned_to: null;
                            author: {
                              id: '991267471';
                              type: 'admin';
                              name: 'Ciaran199 Lee';
                              email: 'admin199@email.com';
                            };
                            attachments: [];
                            external_id: null;
                            redacted: false;
                          },
                        ];
                        total_count: 1;
                      };
                    };
                  };
                  'Open a conversation': {
                    value: {
                      type: 'conversation';
                      id: '366';
                      created_at: 1717021502;
                      updated_at: 1717021512;
                      waiting_since: null;
                      snoozed_until: null;
                      source: {
                        type: 'conversation';
                        id: '403918264';
                        delivered_as: 'admin_initiated';
                        subject: '';
                        body: '<p>this is the message body</p>';
                        author: {
                          type: 'admin';
                          id: '991267473';
                          name: 'Ciaran200 Lee';
                          email: 'admin200@email.com';
                        };
                        attachments: [];
                        url: null;
                        redacted: false;
                      };
                      contacts: {
                        type: 'contact.list';
                        contacts: [
                          {
                            type: 'contact';
                            id: '6657ab426abd0164c24b0d71';
                          },
                        ];
                      };
                      first_contact_reply: null;
                      admin_assignee_id: null;
                      team_assignee_id: null;
                      open: true;
                      state: 'open';
                      read: true;
                      tags: {
                        type: 'tag.list';
                        tags: [];
                      };
                      priority: 'not_priority';
                      sla_applied: null;
                      statistics: null;
                      conversation_rating: null;
                      teammates: null;
                      title: '';
                      custom_attributes: {};
                      topics: {};
                      ticket: null;
                      conversation_parts: {
                        type: 'conversation_part.list';
                        conversation_parts: [
                          {
                            type: 'conversation_part';
                            id: '79';
                            part_type: 'open';
                            body: null;
                            created_at: 1717021512;
                            updated_at: 1717021512;
                            notified_at: 1717021512;
                            assigned_to: null;
                            author: {
                              id: '991267473';
                              type: 'admin';
                              name: 'Ciaran200 Lee';
                              email: 'admin200@email.com';
                            };
                            attachments: [];
                            external_id: null;
                            redacted: false;
                          },
                        ];
                        total_count: 1;
                      };
                    };
                  };
                  'Assign a conversation': {
                    value: {
                      type: 'conversation';
                      id: '371';
                      created_at: 1717021513;
                      updated_at: 1717021514;
                      waiting_since: null;
                      snoozed_until: null;
                      source: {
                        type: 'conversation';
                        id: '403918267';
                        delivered_as: 'admin_initiated';
                        subject: '';
                        body: '<p>this is the message body</p>';
                        author: {
                          type: 'admin';
                          id: '991267476';
                          name: 'Ciaran202 Lee';
                          email: 'admin202@email.com';
                        };
                        attachments: [];
                        url: null;
                        redacted: false;
                      };
                      contacts: {
                        type: 'contact.list';
                        contacts: [
                          {
                            type: 'contact';
                            id: '6657ab496abd0164c24b0d75';
                          },
                        ];
                      };
                      first_contact_reply: null;
                      admin_assignee_id: 991267476;
                      team_assignee_id: null;
                      open: true;
                      state: 'open';
                      read: false;
                      tags: {
                        type: 'tag.list';
                        tags: [];
                      };
                      priority: 'not_priority';
                      sla_applied: null;
                      statistics: null;
                      conversation_rating: null;
                      teammates: null;
                      title: null;
                      custom_attributes: {};
                      topics: {};
                      ticket: null;
                      conversation_parts: {
                        type: 'conversation_part.list';
                        conversation_parts: [
                          {
                            type: 'conversation_part';
                            id: '80';
                            part_type: 'assign_and_reopen';
                            body: null;
                            created_at: 1717021514;
                            updated_at: 1717021514;
                            notified_at: 1717021514;
                            assigned_to: {
                              type: 'admin';
                              id: '991267476';
                            };
                            author: {
                              id: '991267476';
                              type: 'admin';
                              name: 'Ciaran202 Lee';
                              email: 'admin202@email.com';
                            };
                            attachments: [];
                            external_id: null;
                            redacted: false;
                          },
                        ];
                        total_count: 1;
                      };
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/conversation';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: '09df82cc-f148-4e0a-aceb-de32ffccc17a';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
          '403': {
            description: 'API plan restricted';
            content: {
              'application/json': {
                examples: {
                  'API plan restricted': {
                    value: {
                      type: 'error.list';
                      request_id: '8e3d0d18-8021-46c4-a041-2dc3993810ee';
                      errors: [
                        {
                          code: 'api_plan_restricted';
                          message: 'Active subscription needed.';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
          '404': {
            description: 'Not found';
            content: {
              'application/json': {
                examples: {
                  'Not found': {
                    value: {
                      type: 'error.list';
                      request_id: '69371e02-f296-471e-a494-1a532b5a1aa2';
                      errors: [
                        {
                          code: 'not_found';
                          message: 'Resource Not Found';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
        requestBody: {
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    $ref: '#/components/schemas/close_conversation_request';
                  },
                  {
                    $ref: '#/components/schemas/snooze_conversation_request';
                  },
                  {
                    $ref: '#/components/schemas/open_conversation_request';
                  },
                  {
                    $ref: '#/components/schemas/assign_conversation_request';
                  },
                ];
              };
              examples: {
                close_a_conversation: {
                  summary: 'Close a conversation';
                  value: {
                    message_type: 'close';
                    type: 'admin';
                    admin_id: 991267469;
                    body: 'Goodbye :)';
                  };
                };
                snooze_a_conversation: {
                  summary: 'Snooze a conversation';
                  value: {
                    message_type: 'snoozed';
                    admin_id: 991267471;
                    snoozed_until: 1717025103;
                  };
                };
                open_a_conversation: {
                  summary: 'Open a conversation';
                  value: {
                    message_type: 'open';
                    admin_id: 991267473;
                  };
                };
                assign_a_conversation: {
                  summary: 'Assign a conversation';
                  value: {
                    message_type: 'assignment';
                    type: 'admin';
                    admin_id: 991267476;
                    assignee_id: 991267476;
                  };
                };
                not_found: {
                  summary: 'Not found';
                  value: {
                    message_type: 'close';
                    type: 'admin';
                    admin_id: 991267478;
                    body: 'Goodbye :)';
                  };
                };
              };
            };
          };
        };
      };
    };
    '/conversations/{id}/run_assignment_rules': {
      post: {
        summary: 'Run Assignment Rules on a conversation';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
          {
            name: 'id';
            in: 'path';
            required: true;
            description: 'The identifier for the conversation as given by Intercom.';
            example: '123';
            schema: {
              type: 'string';
            };
          },
        ];
        tags: ['Conversations'];
        operationId: 'autoAssignConversation';
        description: 'You can let a conversation be automatically assigned following assignment rules.\n{% admonition type="attention" name="When using workflows" %}\nIt is not possible to use this endpoint with Workflows.\n{% /admonition %}\n';
        responses: {
          '200': {
            description: 'Assign a conversation using assignment rules';
            content: {
              'application/json': {
                examples: {
                  'Assign a conversation using assignment rules': {
                    value: {
                      type: 'conversation';
                      id: '375';
                      created_at: 1717021520;
                      updated_at: 1717021521;
                      waiting_since: null;
                      snoozed_until: null;
                      source: {
                        type: 'conversation';
                        id: '403918271';
                        delivered_as: 'admin_initiated';
                        subject: '';
                        body: '<p>this is the message body</p>';
                        author: {
                          type: 'admin';
                          id: '991267484';
                          name: 'Ciaran206 Lee';
                          email: 'admin206@email.com';
                        };
                        attachments: [];
                        url: null;
                        redacted: false;
                      };
                      contacts: {
                        type: 'contact.list';
                        contacts: [
                          {
                            type: 'contact';
                            id: '6657ab4f6abd0164c24b0d79';
                          },
                        ];
                      };
                      first_contact_reply: null;
                      admin_assignee_id: null;
                      team_assignee_id: null;
                      open: false;
                      state: 'closed';
                      read: false;
                      tags: {
                        type: 'tag.list';
                        tags: [];
                      };
                      priority: 'not_priority';
                      sla_applied: null;
                      statistics: null;
                      conversation_rating: null;
                      teammates: null;
                      title: null;
                      custom_attributes: {};
                      topics: {};
                      ticket: null;
                      conversation_parts: {
                        type: 'conversation_part.list';
                        conversation_parts: [
                          {
                            type: 'conversation_part';
                            id: '81';
                            part_type: 'default_assignment';
                            body: null;
                            created_at: 1717021521;
                            updated_at: 1717021521;
                            notified_at: 1717021521;
                            assigned_to: {
                              type: 'nobody_admin';
                              id: null;
                            };
                            author: {
                              id: '991267485';
                              type: 'bot';
                              name: 'Operator';
                              email: 'operator+this_is_an_id375_that_should_be_at_least_@intercom.io';
                            };
                            attachments: [];
                            external_id: null;
                            redacted: false;
                          },
                        ];
                        total_count: 1;
                      };
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/conversation';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: '469fd3bb-93cc-440a-92dc-a13b1677d376';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
          '403': {
            description: 'API plan restricted';
            content: {
              'application/json': {
                examples: {
                  'API plan restricted': {
                    value: {
                      type: 'error.list';
                      request_id: '5315a8cb-df46-4bb3-90ec-143d787edda3';
                      errors: [
                        {
                          code: 'api_plan_restricted';
                          message: 'Active subscription needed.';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
          '404': {
            description: 'Not found';
            content: {
              'application/json': {
                examples: {
                  'Not found': {
                    value: {
                      type: 'error.list';
                      request_id: '57b08a56-d3a2-4b62-9c10-7779a72d3b40';
                      errors: [
                        {
                          code: 'not_found';
                          message: 'Resource Not Found';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
      };
    };
    '/conversations/{id}/customers': {
      post: {
        summary: 'Attach a contact to a conversation';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
          {
            name: 'id';
            in: 'path';
            required: true;
            description: 'The identifier for the conversation as given by Intercom.';
            example: '123';
            schema: {
              type: 'string';
            };
          },
        ];
        tags: ['Conversations'];
        operationId: 'attachContactToConversation';
        description: 'You can add participants who are contacts to a conversation, on behalf of either another contact or an admin.\n\n{% admonition type="attention" name="Contacts without an email" %}\nIf you add a contact via the email parameter and there is no user/lead found on that workspace with he given email, then we will create a new contact with `role` set to `lead`.\n{% /admonition %}\n\n';
        responses: {
          '200': {
            description: 'Attach a contact to a conversation';
            content: {
              'application/json': {
                examples: {
                  'Attach a contact to a conversation': {
                    value: {
                      customers: [
                        {
                          type: 'user';
                          id: '6657ab566abd0164c24b0d7d';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/conversation';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: '1c005bf9-c6f0-4fc1-b352-53e84c675cc5';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
          '403': {
            description: 'API plan restricted';
            content: {
              'application/json': {
                examples: {
                  'API plan restricted': {
                    value: {
                      type: 'error.list';
                      request_id: '717510bb-f9b8-4237-a89d-41bccf8dca5c';
                      errors: [
                        {
                          code: 'api_plan_restricted';
                          message: 'Active subscription needed.';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
          '404': {
            description: 'Not found';
            content: {
              'application/json': {
                examples: {
                  'Not found': {
                    value: {
                      type: 'error.list';
                      request_id: 'd203f7a5-6175-4a1a-9c64-cc807288bcda';
                      errors: [
                        {
                          code: 'not_found';
                          message: 'Resource Not Found';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/attach_contact_to_conversation_request';
              };
              examples: {
                attach_a_contact_to_a_conversation: {
                  summary: 'Attach a contact to a conversation';
                  value: {
                    admin_id: 991267492;
                    customer: {
                      intercom_user_id: '6657ab566abd0164c24b0d7d';
                    };
                  };
                };
                not_found: {
                  summary: 'Not found';
                  value: {
                    admin_id: 991267494;
                    customer: {
                      intercom_user_id: '6657ab576abd0164c24b0d7e';
                    };
                  };
                };
              };
            };
          };
        };
      };
    };
    '/conversations/{conversation_id}/customers/{contact_id}': {
      delete: {
        summary: 'Detach a contact from a group conversation';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
          {
            name: 'conversation_id';
            in: 'path';
            required: true;
            description: 'The identifier for the conversation as given by Intercom.';
            example: '123';
            schema: {
              type: 'string';
            };
          },
          {
            name: 'contact_id';
            in: 'path';
            required: true;
            description: 'The identifier for the contact as given by Intercom.';
            example: '123';
            schema: {
              type: 'string';
            };
          },
        ];
        tags: ['Conversations'];
        operationId: 'detachContactFromConversation';
        description: 'You can add participants who are contacts to a conversation, on behalf of either another contact or an admin.\n\n{% admonition type="attention" name="Contacts without an email" %}\nIf you add a contact via the email parameter and there is no user/lead found on that workspace with he given email, then we will create a new contact with `role` set to `lead`.\n{% /admonition %}\n\n';
        responses: {
          '200': {
            description: 'Detach a contact from a group conversation';
            content: {
              'application/json': {
                examples: {
                  'Detach a contact from a group conversation': {
                    value: {
                      customers: [
                        {
                          type: 'user';
                          id: '6657ab636abd0164c24b0d89';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/conversation';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: 'f4ac4049-1de5-4587-ae47-42149bab024a';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
          '403': {
            description: 'API plan restricted';
            content: {
              'application/json': {
                examples: {
                  'API plan restricted': {
                    value: {
                      type: 'error.list';
                      request_id: '6c084c7f-9ff4-47d9-94ce-f7241256d119';
                      errors: [
                        {
                          code: 'api_plan_restricted';
                          message: 'Active subscription needed.';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
          '404': {
            description: 'Contact not found';
            content: {
              'application/json': {
                examples: {
                  'Conversation not found': {
                    value: {
                      type: 'error.list';
                      request_id: '52dc69da-3bbd-486a-b932-adf6bcd9bfce';
                      errors: [
                        {
                          code: 'not_found';
                          message: 'Resource Not Found';
                        },
                      ];
                    };
                  };
                  'Contact not found': {
                    value: {
                      type: 'error.list';
                      request_id: '08be5e8d-4a8d-4bdc-9352-5044268a97a8';
                      errors: [
                        {
                          code: 'not_found';
                          message: 'User Not Found';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
          '422': {
            description: 'Last customer';
            content: {
              'application/json': {
                examples: {
                  'Last customer': {
                    value: {
                      type: 'error.list';
                      request_id: 'e1e0f127-bd7e-4d98-923e-792ceaca8575';
                      errors: [
                        {
                          code: 'parameter_invalid';
                          message: 'Removing the last customer is not allowed';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/detach_contact_from_conversation_request';
              };
              examples: {
                detach_a_contact_from_a_group_conversation: {
                  summary: 'Detach a contact from a group conversation';
                  value: {
                    admin_id: 991267500;
                    customer: {
                      intercom_user_id: '6657ab5c6abd0164c24b0d81';
                    };
                  };
                };
                conversation_not_found: {
                  summary: 'Conversation not found';
                  value: {
                    admin_id: 991267503;
                    customer: {
                      intercom_user_id: '6657ab656abd0164c24b0d8a';
                    };
                  };
                };
                contact_not_found: {
                  summary: 'Contact not found';
                  value: {
                    admin_id: 991267506;
                    customer: {
                      intercom_user_id: '6657ab6c6abd0164c24b0d92';
                    };
                  };
                };
                last_customer: {
                  summary: 'Last customer';
                  value: {
                    admin_id: 991267509;
                    customer: {
                      intercom_user_id: '6657ab736abd0164c24b0d9a';
                    };
                  };
                };
              };
            };
          };
        };
      };
    };
    '/conversations/redact': {
      post: {
        summary: 'Redact a conversation part';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
        ];
        tags: ['Conversations'];
        operationId: 'redactConversation';
        description: 'You can redact a conversation part or the source message of a conversation (as seen in the source object).\n\n{% admonition type="info" name="Redacting parts and messages" %}\nIf you are redacting a conversation part, it must have a `body`. If you are redacting a source message, it must have been created by a contact. We will return a `conversation_part_not_redactable` error if these criteria are not met.\n{% /admonition %}\n\n';
        responses: {
          '200': {
            description: 'Redact a conversation part';
            content: {
              'application/json': {
                examples: {
                  'Redact a conversation part': {
                    value: {
                      type: 'conversation';
                      id: '437';
                      created_at: 1717021579;
                      updated_at: 1717021582;
                      waiting_since: 1717021580;
                      snoozed_until: null;
                      source: {
                        type: 'conversation';
                        id: '403918297';
                        delivered_as: 'admin_initiated';
                        subject: '';
                        body: '<p>this is the message body</p>';
                        author: {
                          type: 'admin';
                          id: '991267518';
                          name: 'Ciaran226 Lee';
                          email: 'admin226@email.com';
                        };
                        attachments: [];
                        url: null;
                        redacted: false;
                      };
                      contacts: {
                        type: 'contact.list';
                        contacts: [
                          {
                            type: 'contact';
                            id: '6657ab8b6abd0164c24b0db2';
                          },
                        ];
                      };
                      first_contact_reply: {
                        created_at: 1717021580;
                        type: 'conversation';
                        url: null;
                      };
                      admin_assignee_id: null;
                      team_assignee_id: null;
                      open: true;
                      state: 'open';
                      read: true;
                      tags: {
                        type: 'tag.list';
                        tags: [];
                      };
                      priority: 'not_priority';
                      sla_applied: null;
                      statistics: null;
                      conversation_rating: null;
                      teammates: null;
                      title: null;
                      custom_attributes: {};
                      topics: {};
                      ticket: null;
                      conversation_parts: {
                        type: 'conversation_part.list';
                        conversation_parts: [
                          {
                            type: 'conversation_part';
                            id: '89';
                            part_type: 'open';
                            body: '<p><i>This message was deleted</i></p>';
                            created_at: 1717021580;
                            updated_at: 1717021582;
                            notified_at: 1717021580;
                            assigned_to: null;
                            author: {
                              id: '6657ab8b6abd0164c24b0db2';
                              type: 'user';
                              name: 'Joe Bloggs';
                              email: 'joe@bloggs.com';
                            };
                            attachments: [];
                            external_id: null;
                            redacted: true;
                          },
                          {
                            type: 'conversation_part';
                            id: '90';
                            part_type: 'language_detection_details';
                            body: null;
                            created_at: 1717021580;
                            updated_at: 1717021580;
                            notified_at: 1717021580;
                            assigned_to: null;
                            author: {
                              id: '991267519';
                              type: 'bot';
                              name: 'Operator';
                              email: 'operator+this_is_an_id409_that_should_be_at_least_@intercom.io';
                            };
                            attachments: [];
                            external_id: null;
                            redacted: false;
                          },
                        ];
                        total_count: 2;
                      };
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/conversation';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: '892510d5-1003-4dae-ae3a-16f032ce47ed';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
          '404': {
            description: 'Not found';
            content: {
              'application/json': {
                examples: {
                  'Not found': {
                    value: {
                      type: 'error.list';
                      request_id: '4bfb74f7-a3f1-491f-bed8-6d1f7a9231cc';
                      errors: [
                        {
                          code: 'conversation_part_or_message_not_found';
                          message: 'Conversation part or message not found';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/redact_conversation_request';
              };
              examples: {
                redact_a_conversation_part: {
                  summary: 'Redact a conversation part';
                  value: {
                    type: 'conversation_part';
                    conversation_id: 437;
                    conversation_part_id: 89;
                  };
                };
                not_found: {
                  summary: 'Not found';
                  value: {
                    type: 'conversation_part';
                    conversation_id: 'really_123_doesnt_exist';
                    conversation_part_id: 'really_123_doesnt_exist';
                  };
                };
              };
            };
          };
        };
      };
    };
    '/data_attributes': {
      get: {
        summary: 'List all data attributes';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
          {
            name: 'model';
            in: 'query';
            required: false;
            description: 'Specify the data attribute model to return.';
            schema: {
              type: 'string';
              enum: ['contact', 'company', 'conversation'];
            };
            example: 'company';
          },
          {
            name: 'include_archived';
            in: 'query';
            required: false;
            description: 'Include archived attributes in the list. By default we return only non archived data attributes.';
            example: false;
            schema: {
              type: 'boolean';
            };
          },
        ];
        tags: ['Data Attributes'];
        operationId: 'lisDataAttributes';
        description: 'You can fetch a list of all data attributes belonging to a workspace for contacts, companies or conversations.';
        responses: {
          '200': {
            description: 'Successful response';
            content: {
              'application/json': {
                examples: {
                  'Successful response': {
                    value: {
                      type: 'list';
                      data: [
                        {
                          type: 'data_attribute';
                          name: 'name';
                          full_name: 'name';
                          label: 'Company name';
                          description: 'The name of a company';
                          data_type: 'string';
                          api_writable: true;
                          ui_writable: false;
                          messenger_writable: true;
                          custom: false;
                          archived: false;
                          model: 'company';
                        },
                        {
                          type: 'data_attribute';
                          name: 'company_id';
                          full_name: 'company_id';
                          label: 'Company ID';
                          description: 'A number identifying a company';
                          data_type: 'string';
                          api_writable: false;
                          ui_writable: false;
                          messenger_writable: true;
                          custom: false;
                          archived: false;
                          model: 'company';
                        },
                        {
                          type: 'data_attribute';
                          name: 'last_request_at';
                          full_name: 'last_request_at';
                          label: 'Company last seen';
                          description: 'The last day anyone from a company visited your site or app';
                          data_type: 'date';
                          api_writable: false;
                          ui_writable: false;
                          messenger_writable: true;
                          custom: false;
                          archived: false;
                          model: 'company';
                        },
                        {
                          type: 'data_attribute';
                          name: 'remote_created_at';
                          full_name: 'remote_created_at';
                          label: 'Company created at';
                          description: 'The day a company was added to Intercom';
                          data_type: 'date';
                          api_writable: true;
                          ui_writable: false;
                          messenger_writable: true;
                          custom: false;
                          archived: false;
                          model: 'company';
                        },
                        {
                          type: 'data_attribute';
                          name: 'user_count';
                          full_name: 'user_count';
                          label: 'People';
                          description: 'The number of people in a company';
                          data_type: 'integer';
                          api_writable: false;
                          ui_writable: false;
                          messenger_writable: true;
                          custom: false;
                          archived: false;
                          model: 'company';
                        },
                        {
                          type: 'data_attribute';
                          name: 'session_count';
                          full_name: 'session_count';
                          label: 'Company web sessions';
                          description: "All visits from anyone in a company to your product's site or app";
                          data_type: 'integer';
                          api_writable: false;
                          ui_writable: false;
                          messenger_writable: true;
                          custom: false;
                          archived: false;
                          model: 'company';
                        },
                        {
                          type: 'data_attribute';
                          name: 'name';
                          full_name: 'plan.name';
                          label: 'Plan';
                          description: 'A specific plan or level within your product that companies have signed up to';
                          data_type: 'string';
                          api_writable: false;
                          ui_writable: false;
                          messenger_writable: true;
                          custom: false;
                          archived: false;
                          model: 'company';
                        },
                        {
                          type: 'data_attribute';
                          name: 'monthly_spend';
                          full_name: 'monthly_spend';
                          label: 'Monthly Spend';
                          description: 'The monthly revenue you receive from a company';
                          data_type: 'float';
                          api_writable: true;
                          ui_writable: false;
                          messenger_writable: true;
                          custom: false;
                          archived: false;
                          model: 'company';
                        },
                        {
                          type: 'data_attribute';
                          name: 'size';
                          full_name: 'size';
                          label: 'Company size';
                          description: 'The number of people employed in this company, expressed as a single number';
                          data_type: 'integer';
                          api_writable: true;
                          ui_writable: false;
                          messenger_writable: true;
                          custom: false;
                          archived: false;
                          model: 'company';
                        },
                        {
                          type: 'data_attribute';
                          name: 'industry';
                          full_name: 'industry';
                          label: 'Company industry';
                          description: "The category or domain this company belongs to e.g. 'ecommerce' or 'SaaS'";
                          data_type: 'string';
                          api_writable: true;
                          ui_writable: false;
                          messenger_writable: true;
                          custom: false;
                          archived: false;
                          model: 'company';
                        },
                        {
                          type: 'data_attribute';
                          name: 'website';
                          full_name: 'website';
                          label: 'Company website';
                          description: "The web address for the company's primary marketing site";
                          data_type: 'string';
                          api_writable: true;
                          ui_writable: false;
                          messenger_writable: true;
                          custom: false;
                          archived: false;
                          model: 'company';
                        },
                        {
                          id: 34;
                          type: 'data_attribute';
                          name: 'The One Ring';
                          full_name: 'custom_attributes.The One Ring';
                          label: 'The One Ring';
                          description: 'One ring to rule them all, one ring to find them, One ring to bring them all and in the darkness bind them.';
                          data_type: 'string';
                          api_writable: true;
                          ui_writable: false;
                          messenger_writable: true;
                          custom: true;
                          archived: false;
                          admin_id: '991267543';
                          created_at: 1717021596;
                          updated_at: 1717021596;
                          model: 'company';
                        },
                        {
                          type: 'data_attribute';
                          name: 'id';
                          full_name: 'id';
                          label: 'ID';
                          description: 'The Intercom defined id representing the company';
                          data_type: 'string';
                          api_writable: false;
                          ui_writable: false;
                          messenger_writable: true;
                          custom: false;
                          archived: false;
                          model: 'company';
                        },
                        {
                          type: 'data_attribute';
                          name: 'created_at';
                          full_name: 'created_at';
                          label: 'Created at';
                          description: 'The time the company was added to Intercom';
                          data_type: 'date';
                          api_writable: false;
                          ui_writable: false;
                          messenger_writable: true;
                          custom: false;
                          archived: false;
                          model: 'company';
                        },
                        {
                          type: 'data_attribute';
                          name: 'updated_at';
                          full_name: 'updated_at';
                          label: 'Updated at';
                          description: 'The last time the company was updated';
                          data_type: 'date';
                          api_writable: false;
                          ui_writable: false;
                          messenger_writable: true;
                          custom: false;
                          archived: false;
                          model: 'company';
                        },
                        {
                          type: 'data_attribute';
                          name: 'id';
                          full_name: 'plan.id';
                          label: 'Plan ID';
                          description: 'The Intercom defined id representing the plan';
                          data_type: 'string';
                          api_writable: false;
                          ui_writable: false;
                          messenger_writable: true;
                          custom: false;
                          archived: false;
                          model: 'company';
                        },
                        {
                          type: 'data_attribute';
                          name: 'app_id';
                          full_name: 'app_id';
                          label: 'App ID';
                          description: 'The Intercom defined id representing the app';
                          data_type: 'string';
                          api_writable: false;
                          ui_writable: false;
                          messenger_writable: true;
                          custom: false;
                          archived: false;
                          model: 'company';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/data_attribute_list';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: '347e1bef-2b93-48e7-994f-2d84b5754cca';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
      };
      post: {
        summary: 'Create a data attribute';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
        ];
        tags: ['Data Attributes'];
        operationId: 'createDataAttribute';
        description: 'You can create a data attributes for a `contact` or a `company`.';
        responses: {
          '200': {
            description: 'Successful';
            content: {
              'application/json': {
                examples: {
                  Successful: {
                    value: {
                      id: 37;
                      type: 'data_attribute';
                      name: 'Mithril Shirt';
                      full_name: 'custom_attributes.Mithril Shirt';
                      label: 'Mithril Shirt';
                      data_type: 'string';
                      api_writable: true;
                      ui_writable: false;
                      messenger_writable: true;
                      custom: true;
                      archived: false;
                      admin_id: '991267545';
                      created_at: 1717021597;
                      updated_at: 1717021597;
                      model: 'company';
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/data_attribute';
                };
              };
            };
          };
          '400': {
            description: 'Too few options for list';
            content: {
              'application/json': {
                examples: {
                  'Same name already exists': {
                    value: {
                      type: 'error.list';
                      request_id: 'cc7918cc-666a-4e83-b82c-0bf0c8a71376';
                      errors: [
                        {
                          code: 'parameter_invalid';
                          message: "You already have 'The One Ring' in your company data. To save this as new people data, use a different name.";
                        },
                      ];
                    };
                  };
                  'Invalid name': {
                    value: {
                      type: 'error.list';
                      request_id: 'a482b171-5581-4f05-a8b4-71a9aca2246d';
                      errors: [
                        {
                          code: 'parameter_invalid';
                          message: 'Your name for this attribute must only contain alphanumeric characters, currency symbols, and hyphens';
                        },
                      ];
                    };
                  };
                  'Attribute already exists': {
                    value: {
                      type: 'error.list';
                      request_id: '82f80d44-20a6-45bb-a69c-abb1eeaab5ff';
                      errors: [
                        {
                          code: 'parameter_invalid';
                          message: "You already have 'The One Ring' in your company data. To save this as new company data, use a different name.";
                        },
                      ];
                    };
                  };
                  'Invalid Data Type': {
                    value: {
                      type: 'error.list';
                      request_id: '48e4900b-b047-4064-a060-d19d936986f2';
                      errors: [
                        {
                          code: 'parameter_invalid';
                          message: "Data Type isn't an option";
                        },
                      ];
                    };
                  };
                  'Too few options for list': {
                    value: {
                      type: 'error.list';
                      request_id: '9671eab5-6cb1-47ea-bef6-9877d24aa8be';
                      errors: [
                        {
                          code: 'parameter_invalid';
                          message: 'The Data Attribute model field must be either contact or company';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: '5b7162e1-b827-4c54-9299-1923661ab15a';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/create_data_attribute_request';
              };
              examples: {
                successful: {
                  summary: 'Successful';
                  value: {
                    name: 'Mithril Shirt';
                    model: 'company';
                    data_type: 'string';
                  };
                };
                same_name_already_exists: {
                  summary: 'Same name already exists';
                  value: {
                    name: 'The One Ring';
                    model: 'contact';
                    data_type: 'integer';
                  };
                };
                invalid_name: {
                  summary: 'Invalid name';
                  value: {
                    name: '!nv@l!d n@me';
                    model: 'company';
                    data_type: 'string';
                  };
                };
                attribute_already_exists: {
                  summary: 'Attribute already exists';
                  value: {
                    name: 'The One Ring';
                    model: 'company';
                    data_type: 'string';
                  };
                };
                invalid_data_type: {
                  summary: 'Invalid Data Type';
                  value: {
                    name: 'The Second Ring';
                    model: 'company';
                    data_type: 'mithril';
                  };
                };
                too_few_options_for_list: {
                  summary: 'Too few options for list';
                  value: {
                    description: 'Just a plain old ring';
                    options: [
                      {
                        value: '1-10';
                      },
                    ];
                    archived: false;
                  };
                };
              };
            };
          };
        };
      };
    };
    '/data_attributes/{id}': {
      put: {
        summary: 'Update a data attribute';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
          {
            name: 'id';
            in: 'path';
            required: true;
            description: 'The data attribute id';
            example: 1;
            schema: {
              type: 'integer';
            };
          },
        ];
        tags: ['Data Attributes'];
        operationId: 'updateDataAttribute';
        description: "\nYou can update a data attribute.\n\n> 🚧 Updating the data type is not possible\n>\n> It is currently a dangerous action to execute changing a data attribute's type via the API. You will need to update the type via the UI instead.\n";
        responses: {
          '200': {
            description: 'Successful';
            content: {
              'application/json': {
                examples: {
                  Successful: {
                    value: {
                      id: 44;
                      type: 'data_attribute';
                      name: 'The One Ring';
                      full_name: 'custom_attributes.The One Ring';
                      label: 'The One Ring';
                      description: 'Just a plain old ring';
                      data_type: 'string';
                      options: ['1-10', '11-20'];
                      api_writable: true;
                      ui_writable: false;
                      messenger_writable: true;
                      custom: true;
                      archived: false;
                      admin_id: '991267552';
                      created_at: 1717021600;
                      updated_at: 1717021601;
                      model: 'company';
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/data_attribute';
                };
              };
            };
          };
          '400': {
            description: 'Too few options in list';
            content: {
              'application/json': {
                examples: {
                  'Too few options in list': {
                    value: {
                      type: 'error.list';
                      request_id: '3f2e9798-2691-4757-8ddd-990cd23b1ee4';
                      errors: [
                        {
                          code: 'parameter_invalid';
                          message: "Options isn't an array";
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: '3f503566-39bd-4e10-a030-dc0bf2a305cb';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
          '404': {
            description: 'Attribute Not Found';
            content: {
              'application/json': {
                examples: {
                  'Attribute Not Found': {
                    value: {
                      type: 'error.list';
                      request_id: '364ec895-b362-42d0-96c8-f3ad314a25a6';
                      errors: [
                        {
                          code: 'field_not_found';
                          message: "We couldn't find that data attribute to update";
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
          '422': {
            description: 'Has Dependant Object';
            content: {
              'application/json': {
                examples: {
                  'Has Dependant Object': {
                    value: {
                      type: 'error.list';
                      request_id: '0ae09d21-a5ec-4cea-a56f-d22d4423112e';
                      errors: [
                        {
                          code: 'data_invalid';
                          message: 'The Data Attribute you are trying to archive has a dependant object';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/update_data_attribute_request';
              };
              examples: {
                successful: {
                  summary: 'Successful';
                  value: {
                    description: 'Just a plain old ring';
                    options: [
                      {
                        value: '1-10';
                      },
                      {
                        value: '11-20';
                      },
                    ];
                    archived: false;
                  };
                };
                too_few_options_in_list: {
                  summary: 'Too few options in list';
                  value: {
                    description: 'Too few options';
                    options: {
                      value: '1-10';
                    };
                    archived: false;
                  };
                };
                attribute_not_found: {
                  summary: 'Attribute Not Found';
                  value: {
                    description: 'Just a plain old ring';
                    options: [
                      {
                        value: '1-10';
                      },
                      {
                        value: '11-20';
                      },
                    ];
                    archived: false;
                  };
                };
                has_dependant_object: {
                  summary: 'Has Dependant Object';
                  value: {
                    description: 'Trying to archieve';
                    archived: true;
                  };
                };
              };
            };
          };
        };
      };
    };
    '/events': {
      post: {
        summary: 'Submit a data event';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
        ];
        tags: ['Data Events'];
        operationId: 'createDataEvent';
        description: '\nYou will need an Access Token that has write permissions to send Events. Once you have a key you can submit events via POST to the Events resource, which is located at https://api.intercom.io/events, or you can send events using one of the client libraries. When working with the HTTP API directly a client should send the event with a `Content-Type` of `application/json`.\n\nWhen using the JavaScript API, [adding the code to your app](http://docs.intercom.io/configuring-Intercom/tracking-user-events-in-your-app) makes the Events API available. Once added, you can submit an event using the `trackEvent` method. This will associate the event with the Lead or currently logged-in user or logged-out visitor/lead and send it to Intercom. The final parameter is a map that can be used to send optional metadata about the event.\n\nWith the Ruby client you pass a hash describing the event to `Intercom::Event.create`, or call the `track_user` method directly on the current user object (e.g. `user.track_event`).\n\n**NB: For the JSON object types, please note that we do not currently support nested JSON structure.**\n\n| Type            | Description                                                                                                                                                                                                     | Example                                                                           |\n| :-------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------- |\n| String          | The value is a JSON String                                                                                                                                                                                      | `"source":"desktop"`                                                              |\n| Number          | The value is a JSON Number                                                                                                                                                                                      | `"load": 3.67`                                                                    |\n| Date            | The key ends with the String `_date` and the value is a [Unix timestamp](http://en.wikipedia.org/wiki/Unix_time), assumed to be in the [UTC](http://en.wikipedia.org/wiki/Coordinated_Universal_Time) timezone. | `"contact_date": 1392036272`                                                      |\n| Link            | The value is a HTTP or HTTPS URI.                                                                                                                                                                               | `"article": "https://example.org/ab1de.html"`                                     |\n| Rich Link       | The value is a JSON object that contains `url` and `value` keys.                                                                                                                                                | `"article": {"url": "https://example.org/ab1de.html", "value":"the dude abides"}` |\n| Monetary Amount | The value is a JSON object that contains `amount` and `currency` keys. The `amount` key is a positive integer representing the amount in cents. The price in the example to the right denotes €349.99.          | `"price": {"amount": 34999, "currency": "eur"}`                                   |\n\n**Lead Events**\n\nWhen submitting events for Leads, you will need to specify the Lead\'s `id`.\n\n**Metadata behaviour**\n\n- We currently limit the number of tracked metadata keys to 10 per event. Once the quota is reached, we ignore any further keys we receive. The first 10 metadata keys are determined by the order in which they are sent in with the event.\n- It is not possible to change the metadata keys once the event has been sent. A new event will need to be created with the new keys and you can archive the old one.\n- There might be up to 24 hrs delay when you send a new metadata for an existing event.\n\n**Event de-duplication**\n\nThe API may detect and ignore duplicate events. Each event is uniquely identified as a combination of the following data - the Workspace identifier, the Contact external identifier, the Data Event name and the Data Event created time. As a result, it is **strongly recommended** to send a second granularity Unix timestamp in the `created_at` field.\n\nDuplicated events are responded to using the normal `202 Accepted` code - an error is not thrown, however repeat requests will be counted against any rate limit that is in place.\n\n### HTTP API Responses\n\n- Successful responses to submitted events return `202 Accepted` with an empty body.\n- Unauthorised access will be rejected with a `401 Unauthorized` or `403 Forbidden` response code.\n- Events sent about users that cannot be found will return a `404 Not Found`.\n- Event lists containing duplicate events will have those duplicates ignored.\n- Server errors will return a `500` response code and may contain an error message in the body.\n\n';
        responses: {
          '202': {
            description: 'successful';
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: '5ebeb1a3-2867-48c4-8122-4ab53e63a6b7';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/create_data_event_request';
              };
            };
          };
        };
      };
      get: {
        summary: 'List all data events';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
          {
            in: 'query';
            name: 'filter';
            required: true;
            style: 'form';
            explode: true;
            schema: {
              type: 'object';
              oneOf: [
                {
                  title: 'user_id query parameter';
                  properties: {
                    user_id: {
                      type: 'string';
                    };
                  };
                  required: ['user_id'];
                  additionalProperties: false;
                },
                {
                  title: 'intercom_user_id query parameter';
                  properties: {
                    intercom_user_id: {
                      type: 'string';
                    };
                  };
                  required: ['intercom_user_id'];
                  additionalProperties: false;
                },
                {
                  title: 'email query parameter';
                  properties: {
                    email: {
                      type: 'string';
                    };
                  };
                  required: ['email'];
                  additionalProperties: false;
                },
              ];
            };
          },
          {
            name: 'type';
            in: 'query';
            required: true;
            description: 'The value must be user';
            schema: {
              type: 'string';
            };
          },
          {
            name: 'summary';
            in: 'query';
            required: false;
            description: 'summary flag';
            schema: {
              type: 'boolean';
            };
          },
        ];
        tags: ['Data Events'];
        operationId: 'lisDataEvents';
        description: "\n> 🚧\n>\n> Please note that you can only 'list' events that are less than 90 days old. Event counts and summaries will still include your events older than 90 days but you cannot 'list' these events individually if they are older than 90 days\n\nThe events belonging to a customer can be listed by sending a GET request to `https://api.intercom.io/events` with a user or lead identifier along with a `type` parameter. The identifier parameter can be one of `user_id`, `email` or `intercom_user_id`. The `type` parameter value must be `user`.\n\n- `https://api.intercom.io/events?type=user&user_id={user_id}`\n- `https://api.intercom.io/events?type=user&email={email}`\n- `https://api.intercom.io/events?type=user&intercom_user_id={id}` (this call can be used to list leads)\n\nThe `email` parameter value should be [url encoded](http://en.wikipedia.org/wiki/Percent-encoding) when sending.\n\nYou can optionally define the result page size as well with the `per_page` parameter.\n";
        responses: {
          '200': {
            description: 'Successful response';
            content: {
              'application/json': {
                examples: {
                  'Successful response': {
                    value: {
                      type: 'event.summary';
                      events: [];
                      pages: {
                        next: 'http://api.intercom.test/events?next page';
                      };
                      email: 'user26@email.com';
                      intercom_user_id: '6657aba56abd0164c24b0dbb';
                      user_id: '3ecf64d0-9ed1-4e9f-88e1-da7d6e6782f3';
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/data_event_summary';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: '80fcaff4-e81a-4155-82de-3130830c6f2c';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
      };
    };
    '/events/summaries': {
      post: {
        summary: 'Create event summaries';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
        ];
        tags: ['Data Events'];
        operationId: 'dataEventSummaries';
        description: 'Create event summaries for a user. Event summaries are used to track the number of times an event has occurred, the first time it occurred and the last time it occurred.\n\n';
        responses: {
          '200': {
            description: 'successful';
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: '6721c78e-3aaf-4da1-8fb5-ff546b6560c2';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/create_data_event_summaries_request';
              };
            };
          };
        };
      };
    };
    '/export/content/data': {
      post: {
        summary: 'Create content data export';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
        ];
        tags: ['Data Export'];
        operationId: 'createDataExport';
        description: 'To create your export job, you need to send a `POST` request to the export endpoint `https://api.intercom.io/export/content/data`.\n\nThe only parameters you need to provide are the range of dates that you want exported.\n\n>🚧 Limit of one active job\n>\n> You can only have one active job per workspace. You will receive a HTTP status code of 429 with the message Exceeded rate limit of 1 pending message data export jobs if you attempt to create a second concurrent job.\n\n>❗️ Updated_at not included\n>\n> It should be noted that the timeframe only includes messages sent during the time period and not messages that were only updated during this period. For example, if a message was updated yesterday but sent two days ago, you would need to set the created_at_after date before the message was sent to include that in your retrieval job.\n\n>📘 Date ranges are inclusive\n>\n> Requesting data for 2018-06-01 until 2018-06-30 will get all data for those days including those specified - e.g. 2018-06-01 00:00:00 until 2018-06-30 23:59:99.\n';
        responses: {
          '200': {
            description: 'successful';
            content: {
              'application/json': {
                examples: {
                  successful: {
                    value: {
                      job_identifier: 'm3489fdme82zmm0j';
                      status: 'pending';
                      download_url: '';
                      download_expires_at: '';
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/data_export';
                };
              };
            };
          };
        };
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/create_data_exports_request';
              };
              examples: {
                successful: {
                  summary: 'successful';
                  value: {
                    created_at_after: 1717003608;
                    created_at_before: 1717021608;
                  };
                };
              };
            };
          };
        };
      };
    };
    '/export/content/data/{job_identifier}': {
      get: {
        summary: 'Show content data export';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
          {
            name: 'job_identifier';
            in: 'path';
            description: 'job_identifier';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        tags: ['Data Export'];
        operationId: 'getDataExport';
        description: 'You can view the status of your job by sending a `GET` request to the URL\n`https://api.intercom.io/export/content/data/{job_identifier}` - the `{job_identifier}` is the value returned in the response when you first created the export job. More on it can be seen in the Export Job Model.\n\n> 🚧 Jobs expire after two days\n> All jobs that have completed processing (and are thus available to download from the provided URL) will have an expiry limit of two days from when the export ob completed. After this, the data will no longer be available.\n';
        responses: {
          '200': {
            description: 'successful';
            content: {
              'application/json': {
                examples: {
                  successful: {
                    value: {
                      job_identifier: 'nhhv3bazoxu29hxd';
                      status: 'pending';
                      download_url: '';
                      download_expires_at: '';
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/data_export';
                };
              };
            };
          };
        };
      };
    };
    '/export/cancel/{job_identifier}': {
      post: {
        summary: 'Cancel content data export';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
          {
            name: 'job_identifier';
            in: 'path';
            description: 'job_identifier';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        tags: ['Data Export'];
        operationId: 'cancelDataExport';
        description: 'You can cancel your job';
        responses: {
          '200': {
            description: 'successful';
            content: {
              'application/json': {
                examples: {
                  successful: {
                    value: {
                      job_identifier: '63tf5lz9hk0ean3z';
                      status: 'canceled';
                      download_url: '';
                      download_expires_at: '';
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/data_export';
                };
              };
            };
          };
        };
      };
    };
    '/download/content/data/{job_identifier}': {
      get: {
        summary: 'Download content data export';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
          {
            name: 'job_identifier';
            in: 'path';
            description: 'job_identifier';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        tags: ['Data Export'];
        operationId: 'downloadDataExport';
        description: 'When a job has a status of complete, and thus a filled download_url, you can download your data by hitting that provided URL, formatted like so: https://api.intercom.io/download/content/data/xyz1234.\n\nYour exported message data will be streamed continuously back down to you in a gzipped CSV format.\n\n> 📘 Octet header required\n>\n> You will have to specify the header Accept: `application/octet-stream` when hitting this endpoint.\n';
        responses: {
          '200': {
            description: 'successful';
          };
        };
      };
    };
    '/messages': {
      post: {
        summary: 'Create a message';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
        ];
        tags: ['Messages'];
        operationId: 'createMessage';
        description: "You can create a message that has been initiated by an admin. The conversation can be either an in-app message or an email.\n\n> 🚧 Sending for visitors\n>\n> There can be a short delay between when a contact is created and when a contact becomes available to be messaged through the API. A 404 Not Found error will be returned in this case.\n\nThis will return the Message model that has been created.\n\n> 🚧 Retrieving Associated Conversations\n>\n> As this is a message, there will be no conversation present until the contact responds. Once they do, you will have to search for a contact's conversations with the id of the message.\n";
        responses: {
          '200': {
            description: 'admin message created';
            content: {
              'application/json': {
                examples: {
                  'user message created': {
                    value: {
                      type: 'user_message';
                      id: '403918302';
                      created_at: 1717021611;
                      body: 'heyy';
                      message_type: 'inapp';
                      conversation_id: '442';
                    };
                  };
                  'lead message created': {
                    value: {
                      type: 'user_message';
                      id: '403918303';
                      created_at: 1717021612;
                      body: 'heyy';
                      message_type: 'inapp';
                      conversation_id: '443';
                    };
                  };
                  'admin message created': {
                    value: {
                      type: 'admin_message';
                      id: '15';
                      created_at: 1717021614;
                      subject: 'heyy';
                      body: 'heyy';
                      message_type: 'inapp';
                      owner: {
                        type: 'admin';
                        id: '991267575';
                        name: 'Ciaran276 Lee';
                        email: 'admin276@email.com';
                        away_mode_enabled: false;
                        away_mode_reassign: false;
                      };
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/message';
                };
              };
            };
          };
          '400': {
            description: 'No body supplied for email message';
            content: {
              'application/json': {
                examples: {
                  'No body supplied for message': {
                    value: {
                      type: 'error.list';
                      request_id: '049f5096-216f-467e-8fd0-2331ac74a002';
                      errors: [
                        {
                          code: 'parameter_invalid';
                          message: 'Body is required';
                        },
                      ];
                    };
                  };
                  'No body supplied for email message': {
                    value: {
                      type: 'error.list';
                      request_id: '26b582f5-81ba-4f2a-a533-fbce3944c563';
                      errors: [
                        {
                          code: 'parameter_invalid';
                          message: 'Body is required';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: '24f9aaf3-e8a7-40cd-b439-0841baa44805';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
          '403': {
            description: 'API plan restricted';
            content: {
              'application/json': {
                examples: {
                  'API plan restricted': {
                    value: {
                      type: 'error.list';
                      request_id: '4b08a866-f009-468a-893a-865e7d8ced74';
                      errors: [
                        {
                          code: 'api_plan_restricted';
                          message: 'Active subscription needed.';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
          '422': {
            description: 'No subject supplied for email message';
            content: {
              'application/json': {
                examples: {
                  'No subject supplied for email message': {
                    value: {
                      type: 'error.list';
                      request_id: '29713c7a-484b-499e-8c50-1e39d999b495';
                      errors: [
                        {
                          code: 'parameter_not_found';
                          message: 'No subject supplied for email message';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/create_message_request';
              };
              examples: {
                user_message_created: {
                  summary: 'user message created';
                  value: {
                    from: {
                      type: 'user';
                      id: '6657abab6abd0164c24b0dc0';
                    };
                    body: 'heyy';
                    referer: 'https://twitter.com/bob';
                  };
                };
                lead_message_created: {
                  summary: 'lead message created';
                  value: {
                    from: {
                      type: 'lead';
                      id: '6657abac6abd0164c24b0dc1';
                    };
                    body: 'heyy';
                    referer: 'https://twitter.com/bob';
                  };
                };
                admin_message_created: {
                  summary: 'admin message created';
                  value: {
                    from: {
                      type: 'admin';
                      id: '991267575';
                    };
                    to: {
                      type: 'user';
                      id: '6657abad6abd0164c24b0dc2';
                    };
                    message_type: 'conversation';
                    body: 'heyy';
                  };
                };
                no_body_supplied_for_message: {
                  summary: 'No body supplied for message';
                  value: {
                    from: {
                      type: 'admin';
                      id: '991267577';
                    };
                    to: {
                      type: 'user';
                      id: '6657abaf6abd0164c24b0dc3';
                    };
                    message_type: 'inapp';
                    body: null;
                    subject: 'heyy';
                  };
                };
                no_subject_supplied_for_email_message: {
                  summary: 'No subject supplied for email message';
                  value: {
                    from: {
                      type: 'admin';
                      id: '991267578';
                    };
                    to: {
                      type: 'user';
                      user_id: '70';
                    };
                    message_type: 'email';
                    body: 'hey there';
                  };
                };
                no_body_supplied_for_email_message: {
                  summary: 'No body supplied for email message';
                  value: {
                    from: {
                      type: 'admin';
                      id: '991267579';
                    };
                    to: {
                      type: 'user';
                      id: '6657abb06abd0164c24b0dc5';
                    };
                    message_type: 'email';
                    body: null;
                    subject: 'heyy';
                  };
                };
              };
            };
          };
        };
      };
    };
    '/news/news_items': {
      get: {
        summary: 'List all news items';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
        ];
        tags: ['News'];
        operationId: 'listNewsItems';
        description: 'You can fetch a list of all news items';
        responses: {
          '200': {
            description: 'successful';
            content: {
              'application/json': {
                examples: {
                  successful: {
                    value: {
                      type: 'list';
                      pages: {
                        page: 1;
                        per_page: 10;
                        total_pages: 1;
                        type: 'pages';
                      };
                      data: [
                        {
                          id: '30';
                          type: 'news-item';
                          workspace_id: 'this_is_an_id503_that_should_be_at_least_';
                          title: 'We have news';
                          body: '<p>Hello there,</p>';
                          sender_id: 991267586;
                          state: 'draft';
                          labels: [];
                          cover_image_url: null;
                          reactions: [null, null, null, null];
                          deliver_silently: false;
                          created_at: 1717021618;
                          updated_at: 1717021618;
                          newsfeed_assignments: [];
                        },
                        {
                          id: '29';
                          type: 'news-item';
                          workspace_id: 'this_is_an_id503_that_should_be_at_least_';
                          title: 'We have news';
                          body: '<p>Hello there,</p>';
                          sender_id: 991267584;
                          state: 'draft';
                          labels: [];
                          cover_image_url: null;
                          reactions: [null, null, null, null];
                          deliver_silently: false;
                          created_at: 1717021617;
                          updated_at: 1717021617;
                          newsfeed_assignments: [];
                        },
                      ];
                      total_count: 2;
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/paginated_response';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: '8a9a7c2e-15b7-4dba-a3c7-1aa75decb59e';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
      };
      post: {
        summary: 'Create a news item';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
        ];
        tags: ['News'];
        operationId: 'createNewsItem';
        description: 'You can create a news item';
        responses: {
          '200': {
            description: 'successful';
            content: {
              'application/json': {
                examples: {
                  successful: {
                    value: {
                      id: '33';
                      type: 'news-item';
                      workspace_id: 'this_is_an_id507_that_should_be_at_least_';
                      title: 'Halloween is here!';
                      body: '<p>New costumes in store for this spooky season</p>';
                      sender_id: 991267593;
                      state: 'live';
                      labels: ['New', 'Product', 'Update'];
                      cover_image_url: null;
                      reactions: ['😆', '😅'];
                      deliver_silently: true;
                      created_at: 1717021620;
                      updated_at: 1717021620;
                      newsfeed_assignments: [
                        {
                          newsfeed_id: 53;
                          published_at: 1664638214;
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/news_item';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: 'd8bfbb7c-b0b6-405a-8bbd-5422697e1dc1';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/news_item_request';
              };
              examples: {
                successful: {
                  summary: 'successful';
                  value: {
                    title: 'Halloween is here!';
                    body: '<p>New costumes in store for this spooky season</p>';
                    labels: ['Product', 'Update', 'New'];
                    sender_id: 991267593;
                    deliver_silently: true;
                    reactions: ['😆', '😅'];
                    state: 'live';
                    newsfeed_assignments: [
                      {
                        newsfeed_id: 53;
                        published_at: 1664638214;
                      },
                    ];
                  };
                };
              };
            };
          };
        };
      };
    };
    '/news/news_items/{id}': {
      get: {
        summary: 'Retrieve a news item';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
          {
            name: 'id';
            in: 'path';
            required: true;
            description: 'The unique identifier for the news item which is given by Intercom.';
            example: 123;
            schema: {
              type: 'integer';
            };
          },
        ];
        tags: ['News'];
        operationId: 'retrieveNewsItem';
        description: 'You can fetch the details of a single news item.';
        responses: {
          '200': {
            description: 'successful';
            content: {
              'application/json': {
                examples: {
                  successful: {
                    value: {
                      id: '34';
                      type: 'news-item';
                      workspace_id: 'this_is_an_id511_that_should_be_at_least_';
                      title: 'We have news';
                      body: '<p>Hello there,</p>';
                      sender_id: 991267596;
                      state: 'live';
                      labels: [];
                      cover_image_url: null;
                      reactions: [null, null, null, null];
                      deliver_silently: false;
                      created_at: 1717021621;
                      updated_at: 1717021621;
                      newsfeed_assignments: [
                        {
                          newsfeed_id: 55;
                          published_at: 1717021621;
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/news_item';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: 'e67ea708-23ce-417d-b8d0-5f0feadcf33c';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
          '404': {
            description: 'News Item Not Found';
            content: {
              'application/json': {
                examples: {
                  'News Item Not Found': {
                    value: {
                      type: 'error.list';
                      request_id: 'f4423d98-b41c-42f7-ba88-79d792097cf8';
                      errors: [
                        {
                          code: 'not_found';
                          message: 'Resource Not Found';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
      };
      put: {
        summary: 'Update a news item';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
          {
            name: 'id';
            in: 'path';
            required: true;
            description: 'The unique identifier for the news item which is given by Intercom.';
            example: 123;
            schema: {
              type: 'integer';
            };
          },
        ];
        tags: ['News'];
        operationId: 'updateNewsItem';
        responses: {
          '200': {
            description: 'successful';
            content: {
              'application/json': {
                examples: {
                  successful: {
                    value: {
                      id: '37';
                      type: 'news-item';
                      workspace_id: 'this_is_an_id517_that_should_be_at_least_';
                      title: 'Christmas is here!';
                      body: '<p>New gifts in store for the jolly season</p>';
                      sender_id: 991267604;
                      state: 'live';
                      labels: [];
                      cover_image_url: null;
                      reactions: ['😝', '😂'];
                      deliver_silently: false;
                      created_at: 1717021623;
                      updated_at: 1717021624;
                      newsfeed_assignments: [];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/news_item';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: '403da25a-8045-4987-9a34-b3347a02c8b0';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
          '404': {
            description: 'News Item Not Found';
            content: {
              'application/json': {
                examples: {
                  'News Item Not Found': {
                    value: {
                      type: 'error.list';
                      request_id: '500997db-736a-473c-a8be-58a7a89b89d5';
                      errors: [
                        {
                          code: 'not_found';
                          message: 'Resource Not Found';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/news_item_request';
              };
              examples: {
                successful: {
                  summary: 'successful';
                  value: {
                    title: 'Christmas is here!';
                    body: '<p>New gifts in store for the jolly season</p>';
                    sender_id: 991267604;
                    reactions: ['😝', '😂'];
                  };
                };
                news_item_not_found: {
                  summary: 'News Item Not Found';
                  value: {
                    title: 'Christmas is here!';
                    body: '<p>New gifts in store for the jolly season</p>';
                    sender_id: 991267607;
                    reactions: ['😝', '😂'];
                  };
                };
              };
            };
          };
        };
      };
      delete: {
        summary: 'Delete a news item';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
          {
            name: 'id';
            in: 'path';
            required: true;
            description: 'The unique identifier for the news item which is given by Intercom.';
            example: 123;
            schema: {
              type: 'integer';
            };
          },
        ];
        tags: ['News'];
        operationId: 'deleteNewsItem';
        description: 'You can delete a single news item.';
        responses: {
          '200': {
            description: 'successful';
            content: {
              'application/json': {
                examples: {
                  successful: {
                    value: {
                      id: '40';
                      object: 'news-item';
                      deleted: true;
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/deleted_object';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: 'f990d4f8-43c3-4719-9560-ee30422462ce';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
          '404': {
            description: 'News Item Not Found';
            content: {
              'application/json': {
                examples: {
                  'News Item Not Found': {
                    value: {
                      type: 'error.list';
                      request_id: '7a923ed2-c82a-45b5-b859-ac8d35bedecc';
                      errors: [
                        {
                          code: 'not_found';
                          message: 'Resource Not Found';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
      };
    };
    '/news/newsfeeds/{id}/items': {
      get: {
        summary: 'List all live newsfeed items';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
          {
            name: 'id';
            in: 'path';
            required: true;
            description: 'The unique identifier for the news feed item which is given by Intercom.';
            example: '123';
            schema: {
              type: 'string';
            };
          },
        ];
        tags: ['News'];
        operationId: 'listLiveNewsfeedItems';
        description: 'You can fetch a list of all news items that are live on a given newsfeed';
        responses: {
          '200': {
            description: 'successful';
            content: {
              'application/json': {
                examples: {
                  successful: {
                    value: {
                      type: 'list';
                      pages: {
                        page: 1;
                        per_page: 20;
                        total_pages: 0;
                        type: 'pages';
                      };
                      data: [];
                      total_count: 0;
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/paginated_response';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: 'a9bb7a8c-ce91-4197-9732-b0d68678ea42';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
      };
    };
    '/news/newsfeeds': {
      get: {
        summary: 'List all newsfeeds';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
        ];
        tags: ['News'];
        operationId: 'listNewsfeeds';
        description: 'You can fetch a list of all newsfeeds';
        responses: {
          '200': {
            description: 'successful';
            content: {
              'application/json': {
                examples: {
                  successful: {
                    value: {
                      type: 'list';
                      pages: {
                        page: 1;
                        per_page: 10;
                        total_pages: 1;
                        type: 'pages';
                      };
                      data: [
                        {
                          id: '68';
                          type: 'newsfeed';
                          name: 'Visitor Feed';
                          created_at: 1717021629;
                          updated_at: 1717021629;
                        },
                        {
                          id: '69';
                          type: 'newsfeed';
                          name: 'Visitor Feed';
                          created_at: 1717021629;
                          updated_at: 1717021629;
                        },
                      ];
                      total_count: 2;
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/paginated_response';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: '98f77a2e-a0fa-461a-9ca7-b388f1dea32c';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
      };
    };
    '/news/newsfeeds/{id}': {
      get: {
        summary: 'Retrieve a newsfeed';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
          {
            name: 'id';
            in: 'path';
            required: true;
            description: 'The unique identifier for the news feed item which is given by Intercom.';
            example: '123';
            schema: {
              type: 'string';
            };
          },
        ];
        tags: ['News'];
        operationId: 'retrieveNewsfeed';
        description: 'You can fetch the details of a single newsfeed';
        responses: {
          '200': {
            description: 'successful';
            content: {
              'application/json': {
                examples: {
                  successful: {
                    value: {
                      id: '72';
                      type: 'newsfeed';
                      name: 'Visitor Feed';
                      created_at: 1717021630;
                      updated_at: 1717021630;
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/newsfeed';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: 'b3ac2f76-21d8-444c-80d3-4d28ad72da7f';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
      };
    };
    '/notes/{id}': {
      get: {
        summary: 'Retrieve a note';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
          {
            name: 'id';
            in: 'path';
            required: true;
            description: 'The unique identifier of a given note';
            example: 1;
            schema: {
              type: 'integer';
            };
          },
        ];
        tags: ['Notes'];
        operationId: 'retrieveNote';
        description: 'You can fetch the details of a single note.';
        responses: {
          '200': {
            description: 'Note found';
            content: {
              'application/json': {
                examples: {
                  'Note found': {
                    value: {
                      type: 'note';
                      id: '37';
                      created_at: 1716330431;
                      contact: {
                        type: 'contact';
                        id: '6657abbf6abd0164c24b0dc8';
                      };
                      author: {
                        type: 'admin';
                        id: '991267623';
                        name: 'Ciaran323 Lee';
                        email: 'admin323@email.com';
                        away_mode_enabled: false;
                        away_mode_reassign: false;
                      };
                      body: '<p>This is a note.</p>';
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/note';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: '6ae7fce4-8d40-4c5f-b4dd-d88f1faae666';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
          '404': {
            description: 'Note not found';
            content: {
              'application/json': {
                examples: {
                  'Note not found': {
                    value: {
                      type: 'error.list';
                      request_id: '011cacd4-8b6a-47d2-8c62-d53840407296';
                      errors: [
                        {
                          code: 'not_found';
                          message: 'Resource Not Found';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
      };
    };
    '/segments': {
      get: {
        summary: 'List all segments';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
          {
            name: 'include_count';
            in: 'query';
            required: false;
            description: 'It includes the count of contacts that belong to each segment.';
            example: true;
            schema: {
              type: 'boolean';
            };
          },
        ];
        tags: ['Segments'];
        operationId: 'listSegments';
        description: 'You can fetch a list of all segments.';
        responses: {
          '200': {
            description: 'Successful response';
            content: {
              'application/json': {
                examples: {
                  'Successful response': {
                    value: {
                      type: 'segment.list';
                      segments: [
                        {
                          type: 'segment';
                          id: '6657abc16abd0164c24b0dcb';
                          name: 'John segment';
                          created_at: 1717021633;
                          updated_at: 1717021633;
                          person_type: 'user';
                        },
                        {
                          type: 'segment';
                          id: '6657abc16abd0164c24b0dcc';
                          name: 'Jane segment';
                          created_at: 1717021633;
                          updated_at: 1717021633;
                          person_type: 'user';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/segment_list';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: '8f262c81-9866-4bc9-a311-7f0d5626063d';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
      };
    };
    '/segments/{id}': {
      get: {
        summary: 'Retrieve a segment';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
          {
            name: 'id';
            in: 'path';
            required: true;
            description: 'The unique identified of a given segment.';
            example: '123';
            schema: {
              type: 'string';
            };
          },
        ];
        tags: ['Segments'];
        operationId: 'retrieveSegment';
        description: 'You can fetch the details of a single segment.';
        responses: {
          '200': {
            description: 'Successful response';
            content: {
              'application/json': {
                examples: {
                  'Successful response': {
                    value: {
                      type: 'segment';
                      id: '6657abc26abd0164c24b0dcf';
                      name: 'John segment';
                      created_at: 1717021634;
                      updated_at: 1717021634;
                      person_type: 'user';
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/segment';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: '2a342688-3235-4ff6-b05b-d22fe703b554';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
          '404': {
            description: 'Segment not found';
            content: {
              'application/json': {
                examples: {
                  'Segment not found': {
                    value: {
                      type: 'error.list';
                      request_id: '1031750e-cb16-44a9-acae-3fdefacf973c';
                      errors: [
                        {
                          code: 'not_found';
                          message: 'Resource Not Found';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
      };
    };
    '/subscription_types': {
      get: {
        summary: 'List subscription types';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
        ];
        tags: ['Subscription Types'];
        operationId: 'listSubscriptionTypes';
        description: 'You can list all subscription types. A list of subscription type objects will be returned.';
        responses: {
          '200': {
            description: 'Successful';
            content: {
              'application/json': {
                examples: {
                  Successful: {
                    value: {
                      type: 'list';
                      data: [
                        {
                          type: 'subscription';
                          id: '137';
                          state: 'live';
                          consent_type: 'opt_out';
                          default_translation: {
                            name: 'Newsletters';
                            description: 'Lorem ipsum dolor sit amet';
                            locale: 'en';
                          };
                          translations: [
                            {
                              name: 'Newsletters';
                              description: 'Lorem ipsum dolor sit amet';
                              locale: 'en';
                            },
                          ];
                          content_types: ['email'];
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/subscription_type_list';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: '387640aa-d3cb-40c0-b8b7-ed3d52a57f17';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
      };
    };
    '/phone_call_redirects': {
      post: {
        summary: 'Create a phone Switch';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
        ];
        tags: ['Switch'];
        operationId: 'createPhoneSwitch';
        description: "You can use the API to deflect phone calls to the Intercom Messenger.\nCalling this endpoint will send an SMS with a link to the Messenger to the phone number specified.\n\nIf custom attributes are specified, they will be added to the user or lead's custom data attributes.\n";
        responses: {
          '200': {
            description: 'successful';
            content: {
              'application/json': {
                examples: {
                  successful: {
                    value: {
                      url: 'http://via.intercom.io/msgr/12b27d11-b981-41a9-a922-886b54bf93b7';
                      type: 'phone_call_redirect';
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/phone_switch';
                };
              };
            };
          };
          '400': {
            description: 'bad request - invalid number';
            content: {
              'application/json': {
                examples: {
                  'bad request - exception sending sms': {
                    value: {
                      error_key: 'sms_failed';
                      message: 'SMS was not sent due to an unknown error';
                    };
                  };
                  'bad request - invalid number': {
                    value: {
                      error_key: 'invalid_phone_number';
                      message: 'Invalid phone number';
                    };
                  };
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: '67b6c667-7107-406f-9d87-ff6116dca52b';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
          '422': {
            description: 'unprocessable entity';
            content: {
              'application/json': {
                examples: {
                  'unprocessable entity': {
                    value: {
                      error_key: 'some_error';
                    };
                  };
                };
              };
            };
          };
        };
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/create_phone_switch_request';
              };
              examples: {
                successful: {
                  summary: 'successful';
                  value: {
                    phone: '+353832345678';
                    custom_attributes: {
                      issue_type: 'Billing';
                      priority: 'High';
                    };
                  };
                };
                'bad_request_-_exception_sending_sms': {
                  summary: 'bad request - exception sending sms';
                  value: {
                    phone: '+353832345678';
                    custom_attributes: {
                      issue_type: 'Billing';
                      priority: 'High';
                    };
                  };
                };
                'bad_request_-_invalid_number': {
                  summary: 'bad request - invalid number';
                  value: {
                    phone: '+353832345678';
                    custom_attributes: {
                      issue_type: 'Billing';
                      priority: 'High';
                    };
                  };
                };
                unprocessable_entity: {
                  summary: 'unprocessable entity';
                  value: {
                    phone: '+40241100100';
                    custom_attributes: {
                      issue_type: 'Billing';
                      priority: 'High';
                    };
                  };
                };
              };
            };
          };
        };
      };
    };
    '/tags': {
      get: {
        summary: 'List all tags';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
        ];
        tags: ['Tags'];
        operationId: 'listTags';
        description: 'You can fetch a list of all tags for a given workspace.\n\n';
        responses: {
          '200': {
            description: 'successful';
            content: {
              'application/json': {
                examples: {
                  successful: {
                    value: {
                      type: 'list';
                      data: [
                        {
                          type: 'tag';
                          id: '105';
                          name: 'Manual tag 1';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/tag_list';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: '3c4758e2-e787-4f70-9fdf-d56ee7d3d830';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
      };
      post: {
        summary: 'Create or update a tag, Tag or untag companies, Tag contacts';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
        ];
        tags: ['Tags'];
        operationId: 'createTag';
        description: 'You can use this endpoint to perform the following operations:\n\n  **1. Create a new tag:** You can create a new tag by passing in the tag name as specified in "Create or Update Tag Request Payload" described below.\n\n  **2. Update an existing tag:** You can update an existing tag by passing the id of the tag as specified in "Create or Update Tag Request Payload" described below.\n\n  **3. Tag Companies:** You can tag single company or a list of companies. You can tag a company by passing in the tag name and the company details as specified in "Tag Company Request Payload" described below. Also, if the tag doesn\'t exist then a new one will be created automatically.\n\n  **4. Untag Companies:** You can untag a single company or a list of companies. You can untag a company by passing in the tag id and the company details as specified in "Untag Company Request Payload" described below.\n\n  **5. Tag Multiple Users:** You can tag a list of users. You can tag the users by passing in the tag name and the user details as specified in "Tag Users Request Payload" described below.\n\nEach operation will return a tag object.\n';
        responses: {
          '200': {
            description: 'Action successful';
            content: {
              'application/json': {
                examples: {
                  'Action successful': {
                    value: {
                      type: 'tag';
                      id: '108';
                      name: 'test';
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/tag';
                };
              };
            };
          };
          '400': {
            description: 'Invalid parameters';
            content: {
              'application/json': {
                examples: {
                  'Invalid parameters': {
                    value: {
                      type: 'error.list';
                      request_id: 'e25d8bd7-817a-4171-b5f3-9fad4c76cf00';
                      errors: [
                        {
                          code: 'parameter_invalid';
                          message: 'invalid tag parameters';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: 'bae6bbdb-8eb5-4ee5-8db9-141bb17bd32b';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
          '404': {
            description: 'User  not found';
            content: {
              'application/json': {
                examples: {
                  'Company not found': {
                    value: {
                      type: 'error.list';
                      request_id: 'a9716d1d-378f-4f9f-b86a-88b3a0237d99';
                      errors: [
                        {
                          code: 'company_not_found';
                          message: 'Company Not Found';
                        },
                      ];
                    };
                  };
                  'User  not found': {
                    value: {
                      type: 'error.list';
                      request_id: 'a7430819-e714-4464-b909-efee0a364a27';
                      errors: [
                        {
                          code: 'not_found';
                          message: 'User Not Found';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
        requestBody: {
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    $ref: '#/components/schemas/create_or_update_tag_request';
                  },
                  {
                    $ref: '#/components/schemas/tag_company_request';
                  },
                  {
                    $ref: '#/components/schemas/untag_company_request';
                  },
                  {
                    $ref: '#/components/schemas/tag_multiple_users_request';
                  },
                ];
              };
              examples: {
                action_successful: {
                  summary: 'Action successful';
                  value: {
                    name: 'test';
                  };
                };
                invalid_parameters: {
                  summary: 'Invalid parameters';
                  value: {
                    test: 'invalid';
                  };
                };
                company_not_found: {
                  summary: 'Company not found';
                  value: {
                    name: 'test';
                    companies: [
                      {
                        company_id: '123';
                      },
                    ];
                  };
                };
                user_not_found: {
                  summary: 'User  not found';
                  value: {
                    name: 'test';
                    users: [
                      {
                        id: '123';
                      },
                    ];
                  };
                };
              };
            };
          };
        };
      };
    };
    '/tags/{id}': {
      get: {
        summary: 'Find a specific tag';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
          {
            name: 'id';
            in: 'path';
            description: 'The unique identifier of a given tag';
            example: '123';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        tags: ['Tags'];
        operationId: 'findTag';
        description: 'You can fetch the details of tags that are on the workspace by their id.\nThis will return a tag object.\n';
        responses: {
          '200': {
            description: 'Tag found';
            content: {
              'application/json': {
                examples: {
                  'Tag found': {
                    value: {
                      type: 'tag';
                      id: '116';
                      name: 'Manual tag';
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/tag';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: '6fbffa27-6ff2-4eac-9595-3eaff5d9e998';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
          '404': {
            description: 'Tag not found';
            content: {
              'application/json': {
                examples: {
                  'Tag not found': {
                    value: {
                      type: 'error.list';
                      request_id: 'c19e3e7f-3095-4e68-9d6e-015abdff20e5';
                      errors: [
                        {
                          code: 'not_found';
                          message: 'Resource Not Found';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
      };
      delete: {
        summary: 'Delete tag';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
          {
            name: 'id';
            in: 'path';
            description: 'The unique identifier of a given tag';
            example: '123';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        tags: ['Tags'];
        operationId: 'deleteTag';
        description: 'You can delete the details of tags that are on the workspace by passing in the id.';
        responses: {
          '200': {
            description: 'Successful';
          };
          '400': {
            description: 'Tag has dependent objects';
            content: {
              'application/json': {
                examples: {
                  'Tag has dependent objects': {
                    value: {
                      type: 'error.list';
                      request_id: 'f8f3114a-ce4b-48b5-a43a-adfd8eb25a53';
                      errors: [
                        {
                          code: 'tag_has_dependent_objects';
                          message: 'Unable to delete Tag with dependent objects. Segments: Seg 1.';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: '283deaf2-c25c-49c7-a076-db7fa2b60201';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
          '404': {
            description: 'Resource not found';
            content: {
              'application/json': {
                examples: {
                  'Resource not found': {
                    value: {
                      type: 'error.list';
                      request_id: '6c9d0394-0a09-46ba-8ba5-b78b8c7e1e82';
                      errors: [
                        {
                          code: 'not_found';
                          message: 'Resource Not Found';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
      };
    };
    '/teams': {
      get: {
        summary: 'List all teams';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
        ];
        tags: ['Teams'];
        operationId: 'listTeams';
        description: 'This will return a list of team objects for the App.';
        responses: {
          '200': {
            description: 'successful';
            content: {
              'application/json': {
                examples: {
                  successful: {
                    value: {
                      type: 'team.list';
                      teams: [];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/team_list';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: 'f4b16541-5c75-45d1-887c-b9cf7ca35de7';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
      };
    };
    '/teams/{id}': {
      get: {
        summary: 'Retrieve a team';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
          {
            name: 'id';
            in: 'path';
            required: true;
            description: 'The unique identifier of a given team.';
            example: '123';
            schema: {
              type: 'string';
            };
          },
        ];
        tags: ['Teams'];
        operationId: 'retrieveTeam';
        description: 'You can fetch the details of a single team, containing an array of admins that belong to this team.';
        responses: {
          '200': {
            description: 'successful';
            content: {
              'application/json': {
                examples: {
                  successful: {
                    value: {
                      type: 'team';
                      id: '991267661';
                      name: 'team 1';
                      admin_ids: [];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/team';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: '5e20abcf-e0f9-4ba3-aab2-f966923ecf21';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
          '404': {
            description: 'Team not found';
            content: {
              'application/json': {
                examples: {
                  'Team not found': {
                    value: {
                      type: 'error.list';
                      request_id: '1afb669d-00be-48c8-afcf-ae3a2ab35c39';
                      errors: [
                        {
                          code: 'team_not_found';
                          message: 'Team not found';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
      };
    };
    '/ticket_types/{ticket_type_id}/attributes': {
      post: {
        summary: 'Create a new attribute for a ticket type';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
          {
            name: 'ticket_type_id';
            in: 'path';
            required: true;
            description: 'The unique identifier for the ticket type which is given by Intercom.';
            schema: {
              type: 'string';
            };
          },
        ];
        tags: ['Ticket Type Attributes'];
        description: 'You can create a new attribute for a ticket type.';
        operationId: 'createTicketTypeAttribute';
        responses: {
          '200': {
            description: 'Ticket Type Attribute created';
            content: {
              'application/json': {
                examples: {
                  'Ticket Type Attribute created': {
                    value: {
                      type: 'ticket_type_attribute';
                      id: '163';
                      workspace_id: 'this_is_an_id609_that_should_be_at_least_';
                      name: 'Attribute Title';
                      description: 'Attribute Description';
                      data_type: 'string';
                      input_options: {
                        multiline: false;
                      };
                      order: 2;
                      required_to_create: false;
                      required_to_create_for_contacts: false;
                      visible_on_create: true;
                      visible_to_contacts: true;
                      default: false;
                      ticket_type_id: 51;
                      archived: false;
                      created_at: 1717021654;
                      updated_at: 1717021654;
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/ticket_type_attribute';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: '094e1e29-ba56-453f-8faa-5008558e1aab';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/create_ticket_type_attribute_request';
              };
              examples: {
                ticket_type_attribute_created: {
                  summary: 'Ticket Type Attribute created';
                  value: {
                    name: 'Attribute Title';
                    description: 'Attribute Description';
                    data_type: 'string';
                    required_to_create: false;
                  };
                };
              };
            };
          };
        };
      };
    };
    '/ticket_types/{ticket_type_id}/attributes/{id}': {
      put: {
        summary: 'Update an existing attribute for a ticket type';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
          {
            name: 'ticket_type_id';
            in: 'path';
            required: true;
            description: 'The unique identifier for the ticket type which is given by Intercom.';
            schema: {
              type: 'string';
            };
          },
          {
            name: 'id';
            in: 'path';
            required: true;
            description: 'The unique identifier for the ticket type attribute which is given by Intercom.';
            schema: {
              type: 'string';
            };
          },
        ];
        tags: ['Ticket Type Attributes'];
        description: 'You can update an existing attribute for a ticket type.';
        operationId: 'updateTicketTypeAttribute';
        responses: {
          '200': {
            description: 'Ticket Type Attribute updated';
            content: {
              'application/json': {
                examples: {
                  'Ticket Type Attribute updated': {
                    value: {
                      type: 'ticket_type_attribute';
                      id: '168';
                      workspace_id: 'this_is_an_id613_that_should_be_at_least_';
                      name: 'name';
                      description: 'New Attribute Description';
                      data_type: 'string';
                      order: 0;
                      required_to_create: false;
                      required_to_create_for_contacts: false;
                      visible_on_create: false;
                      visible_to_contacts: false;
                      default: false;
                      ticket_type_id: 53;
                      archived: false;
                      created_at: 1717021655;
                      updated_at: 1717021656;
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/ticket_type_attribute';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: 'bc5574be-db90-4757-bff5-a8829af8dd0d';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/update_ticket_type_attribute_request';
              };
              examples: {
                ticket_type_attribute_updated: {
                  summary: 'Ticket Type Attribute updated';
                  value: {
                    description: 'New Attribute Description';
                  };
                };
              };
            };
          };
        };
      };
    };
    '/ticket_types': {
      get: {
        summary: 'List all ticket types';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
        ];
        tags: ['Ticket Types'];
        operationId: 'listTicketTypes';
        description: 'You can get a list of all ticket types for a workspace.';
        responses: {
          '200': {
            description: 'successful';
            content: {
              'application/json': {
                examples: {
                  successful: {
                    value: {
                      type: 'list';
                      data: [
                        {
                          type: 'ticket_type';
                          id: '55';
                          name: 'Bug Report';
                          description: 'Bug Report Template';
                          icon: '🎟️';
                          workspace_id: 'this_is_an_id617_that_should_be_at_least_';
                          archived: false;
                          created_at: 1717021657;
                          updated_at: 1717021657;
                          is_internal: false;
                          ticket_type_attributes: {
                            type: 'list';
                            data: [
                              {
                                type: 'ticket_type_attribute';
                                id: '171';
                                workspace_id: 'this_is_an_id617_that_should_be_at_least_';
                                name: '_default_title_';
                                description: '';
                                data_type: 'string';
                                input_options: {
                                  multiline: false;
                                };
                                order: 0;
                                required_to_create: false;
                                required_to_create_for_contacts: false;
                                visible_on_create: true;
                                visible_to_contacts: true;
                                default: true;
                                ticket_type_id: 55;
                                archived: false;
                                created_at: 1717021657;
                                updated_at: 1717021657;
                              },
                              {
                                type: 'ticket_type_attribute';
                                id: '173';
                                workspace_id: 'this_is_an_id617_that_should_be_at_least_';
                                name: 'name';
                                description: 'description';
                                data_type: 'string';
                                input_options: null;
                                order: 0;
                                required_to_create: false;
                                required_to_create_for_contacts: false;
                                visible_on_create: false;
                                visible_to_contacts: false;
                                default: false;
                                ticket_type_id: 55;
                                archived: false;
                                created_at: 1717021657;
                                updated_at: 1717021657;
                              },
                              {
                                type: 'ticket_type_attribute';
                                id: '172';
                                workspace_id: 'this_is_an_id617_that_should_be_at_least_';
                                name: '_default_description_';
                                description: '';
                                data_type: 'string';
                                input_options: {
                                  multiline: true;
                                };
                                order: 1;
                                required_to_create: false;
                                required_to_create_for_contacts: false;
                                visible_on_create: true;
                                visible_to_contacts: true;
                                default: true;
                                ticket_type_id: 55;
                                archived: false;
                                created_at: 1717021657;
                                updated_at: 1717021657;
                              },
                            ];
                          };
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/ticket_type_list';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: 'a09f28f1-0b27-4977-a34f-0ac84850a9af';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
      };
      post: {
        summary: 'Create a ticket type';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
        ];
        tags: ['Ticket Types'];
        operationId: 'createTicketType';
        description: 'You can create a new ticket type.\n> 📘 Creating ticket types.\n>\n> Every ticket type will be created with two default attributes: _default_title_ and _default_description_.\n> For the `icon` propery, use an emoji from [Twemoji Cheatsheet](https://twemoji-cheatsheet.vercel.app/)\n';
        responses: {
          '200': {
            description: 'Ticket type created';
            content: {
              'application/json': {
                examples: {
                  'Ticket type created': {
                    value: {
                      type: 'ticket_type';
                      id: '58';
                      name: 'Customer Issue';
                      description: 'Customer Report Template';
                      icon: '🎟️';
                      workspace_id: 'this_is_an_id621_that_should_be_at_least_';
                      archived: false;
                      created_at: 1717021658;
                      updated_at: 1717021658;
                      is_internal: false;
                      ticket_type_attributes: {
                        type: 'list';
                        data: [
                          {
                            type: 'ticket_type_attribute';
                            id: '180';
                            workspace_id: 'this_is_an_id621_that_should_be_at_least_';
                            name: '_default_title_';
                            description: '';
                            data_type: 'string';
                            input_options: {
                              multiline: false;
                            };
                            order: 0;
                            required_to_create: false;
                            required_to_create_for_contacts: false;
                            visible_on_create: true;
                            visible_to_contacts: true;
                            default: true;
                            ticket_type_id: 58;
                            archived: false;
                            created_at: 1717021658;
                            updated_at: 1717021658;
                          },
                          {
                            type: 'ticket_type_attribute';
                            id: '181';
                            workspace_id: 'this_is_an_id621_that_should_be_at_least_';
                            name: '_default_description_';
                            description: '';
                            data_type: 'string';
                            input_options: {
                              multiline: true;
                            };
                            order: 1;
                            required_to_create: false;
                            required_to_create_for_contacts: false;
                            visible_on_create: true;
                            visible_to_contacts: true;
                            default: true;
                            ticket_type_id: 58;
                            archived: false;
                            created_at: 1717021658;
                            updated_at: 1717021658;
                          },
                        ];
                      };
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/ticket_type';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: '078d21f5-f247-4178-adf1-4dc7e3640249';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/create_ticket_type_request';
              };
              examples: {
                ticket_type_created: {
                  summary: 'Ticket type created';
                  value: {
                    name: 'Customer Issue';
                    description: 'Customer Report Template';
                    icon: '🎟️';
                  };
                };
              };
            };
          };
        };
      };
    };
    '/ticket_types/{id}': {
      get: {
        summary: 'Retrieve a ticket type';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
          {
            name: 'id';
            in: 'path';
            required: true;
            description: 'The unique identifier for the ticket type which is given by Intercom.';
            schema: {
              type: 'string';
            };
          },
        ];
        tags: ['Ticket Types'];
        operationId: 'getTicketType';
        description: 'You can fetch the details of a single ticket type.';
        responses: {
          '200': {
            description: 'Ticket type found';
            content: {
              'application/json': {
                examples: {
                  'Ticket type found': {
                    value: {
                      type: 'ticket_type';
                      id: '60';
                      name: 'Bug Report';
                      description: 'Bug Report Template';
                      icon: '🎟️';
                      workspace_id: 'this_is_an_id625_that_should_be_at_least_';
                      archived: false;
                      created_at: 1717021659;
                      updated_at: 1717021659;
                      is_internal: false;
                      ticket_type_attributes: {
                        type: 'list';
                        data: [
                          {
                            type: 'ticket_type_attribute';
                            id: '185';
                            workspace_id: 'this_is_an_id625_that_should_be_at_least_';
                            name: '_default_title_';
                            description: '';
                            data_type: 'string';
                            input_options: {
                              multiline: false;
                            };
                            order: 0;
                            required_to_create: false;
                            required_to_create_for_contacts: false;
                            visible_on_create: true;
                            visible_to_contacts: true;
                            default: true;
                            ticket_type_id: 60;
                            archived: false;
                            created_at: 1717021659;
                            updated_at: 1717021659;
                          },
                          {
                            type: 'ticket_type_attribute';
                            id: '187';
                            workspace_id: 'this_is_an_id625_that_should_be_at_least_';
                            name: 'name';
                            description: 'description';
                            data_type: 'string';
                            input_options: null;
                            order: 0;
                            required_to_create: false;
                            required_to_create_for_contacts: false;
                            visible_on_create: false;
                            visible_to_contacts: false;
                            default: false;
                            ticket_type_id: 60;
                            archived: false;
                            created_at: 1717021659;
                            updated_at: 1717021659;
                          },
                          {
                            type: 'ticket_type_attribute';
                            id: '186';
                            workspace_id: 'this_is_an_id625_that_should_be_at_least_';
                            name: '_default_description_';
                            description: '';
                            data_type: 'string';
                            input_options: {
                              multiline: true;
                            };
                            order: 1;
                            required_to_create: false;
                            required_to_create_for_contacts: false;
                            visible_on_create: true;
                            visible_to_contacts: true;
                            default: true;
                            ticket_type_id: 60;
                            archived: false;
                            created_at: 1717021659;
                            updated_at: 1717021659;
                          },
                        ];
                      };
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/ticket_type';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: '06b9904b-f065-400b-9641-186e64864045';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
      };
      put: {
        summary: 'Update a ticket type';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
          {
            name: 'id';
            in: 'path';
            required: true;
            description: 'The unique identifier for the ticket type which is given by Intercom.';
            schema: {
              type: 'string';
            };
          },
        ];
        tags: ['Ticket Types'];
        operationId: 'updateTicketType';
        description: '\nYou can update a ticket type.\n\n> 📘 Updating a ticket type.\n>\n> For the `icon` propery, use an emoji from [Twemoji Cheatsheet](https://twemoji-cheatsheet.vercel.app/)\n';
        responses: {
          '200': {
            description: 'Ticket type updated';
            content: {
              'application/json': {
                examples: {
                  'Ticket type updated': {
                    value: {
                      type: 'ticket_type';
                      id: '62';
                      name: 'Bug Report 2';
                      description: 'Bug Report Template';
                      icon: '🎟️';
                      workspace_id: 'this_is_an_id629_that_should_be_at_least_';
                      archived: false;
                      created_at: 1717021660;
                      updated_at: 1717021661;
                      is_internal: false;
                      ticket_type_attributes: {
                        type: 'list';
                        data: [
                          {
                            type: 'ticket_type_attribute';
                            id: '191';
                            workspace_id: 'this_is_an_id629_that_should_be_at_least_';
                            name: '_default_title_';
                            description: '';
                            data_type: 'string';
                            input_options: {
                              multiline: false;
                            };
                            order: 0;
                            required_to_create: false;
                            required_to_create_for_contacts: false;
                            visible_on_create: true;
                            visible_to_contacts: true;
                            default: true;
                            ticket_type_id: 62;
                            archived: false;
                            created_at: 1717021660;
                            updated_at: 1717021660;
                          },
                          {
                            type: 'ticket_type_attribute';
                            id: '193';
                            workspace_id: 'this_is_an_id629_that_should_be_at_least_';
                            name: 'name';
                            description: 'description';
                            data_type: 'string';
                            input_options: null;
                            order: 0;
                            required_to_create: false;
                            required_to_create_for_contacts: false;
                            visible_on_create: false;
                            visible_to_contacts: false;
                            default: false;
                            ticket_type_id: 62;
                            archived: false;
                            created_at: 1717021660;
                            updated_at: 1717021660;
                          },
                          {
                            type: 'ticket_type_attribute';
                            id: '192';
                            workspace_id: 'this_is_an_id629_that_should_be_at_least_';
                            name: '_default_description_';
                            description: '';
                            data_type: 'string';
                            input_options: {
                              multiline: true;
                            };
                            order: 1;
                            required_to_create: false;
                            required_to_create_for_contacts: false;
                            visible_on_create: true;
                            visible_to_contacts: true;
                            default: true;
                            ticket_type_id: 62;
                            archived: false;
                            created_at: 1717021660;
                            updated_at: 1717021660;
                          },
                        ];
                      };
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/ticket_type';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: 'b6a4ebf0-661c-4d2c-bf2a-c0e98c7c49ae';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/update_ticket_type_request';
              };
              examples: {
                ticket_type_updated: {
                  summary: 'Ticket type updated';
                  value: {
                    name: 'Bug Report 2';
                  };
                };
              };
            };
          };
        };
      };
    };
    '/tickets/{id}/reply': {
      post: {
        summary: 'Reply to a ticket';
        operationId: 'replyTicket';
        description: 'You can reply to a ticket with a note from an admin.';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
          {
            name: 'id';
            in: 'path';
            required: true;
            schema: {
              title: 'Ticket ID';
              type: 'string';
              description: 'The id of the ticket to target.';
              example: '123';
            };
          },
        ];
        tags: ['Tickets'];
        responses: {
          '200': {
            description: 'Admin note reply';
            content: {
              'application/json': {
                examples: {
                  'Admin note reply': {
                    value: {
                      type: 'ticket_part';
                      id: '98';
                      part_type: 'note';
                      body: '<h2>An Unordered HTML List</h2>\n<ul>\n<li>Coffee</li>\n<li>Tea</li>\n<li>Milk</li>\n</ul>\n<h2>An Ordered HTML List</h2>\n<ol>\n<li>Coffee</li>\n<li>Tea</li>\n<li>Milk</li>\n</ol>';
                      created_at: 1717021664;
                      updated_at: 1717021664;
                      author: {
                        id: '991267687';
                        type: 'admin';
                        name: 'Ciaran382 Lee';
                        email: 'admin382@email.com';
                      };
                      attachments: [];
                      redacted: false;
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/ticket_note';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: '8bcefa1e-70b4-456d-baf7-d97bf8ca5401';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/create_ticket_reply_request';
              };
              examples: {
                admin_note_reply: {
                  summary: 'Admin note reply';
                  value: {
                    message_type: 'note';
                    type: 'admin';
                    admin_id: 991267687;
                    body: '<html> <body>  <h2>An Unordered HTML List</h2>  <ul>   <li>Coffee</li>   <li>Tea</li>   <li>Milk</li> </ul>    <h2>An Ordered HTML List</h2>  <ol>   <li>Coffee</li>   <li>Tea</li>   <li>Milk</li> </ol>   </body> </html>';
                  };
                };
              };
            };
          };
        };
      };
    };
    '/tickets': {
      post: {
        summary: 'Create a ticket';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
        ];
        tags: ['Tickets'];
        description: 'You can create a new ticket.';
        operationId: 'createTicket';
        responses: {
          '200': {
            description: 'Successful response';
            content: {
              'application/json': {
                examples: {
                  'Successful response': {
                    value: {
                      type: 'ticket';
                      id: '446';
                      ticket_attributes: {
                        _default_title_: 'example';
                        _default_description_: 'there is a problem';
                      };
                      ticket_state: 'submitted';
                      ticket_state_internal_label: 'Submitted';
                      ticket_state_external_label: 'Submitted';
                      ticket_type: {
                        type: 'ticket_type';
                        id: '69';
                        name: 'my-ticket-type-6';
                        description: 'my ticket type description is awesome.';
                        icon: '🦁';
                        workspace_id: 'this_is_an_id643_that_should_be_at_least_';
                        archived: false;
                        created_at: 1717021667;
                        updated_at: 1717021667;
                        is_internal: false;
                        ticket_type_attributes: {
                          type: 'list';
                          data: [
                            {
                              type: 'ticket_type_attribute';
                              id: '203';
                              workspace_id: 'this_is_an_id643_that_should_be_at_least_';
                              name: '_default_title_';
                              description: 'ola';
                              data_type: 'string';
                              input_options: null;
                              order: 0;
                              required_to_create: true;
                              required_to_create_for_contacts: false;
                              visible_on_create: true;
                              visible_to_contacts: false;
                              default: false;
                              ticket_type_id: 69;
                              archived: false;
                              created_at: 1717021667;
                              updated_at: 1717021667;
                            },
                            {
                              type: 'ticket_type_attribute';
                              id: '204';
                              workspace_id: 'this_is_an_id643_that_should_be_at_least_';
                              name: '_default_description_';
                              description: 'ola';
                              data_type: 'string';
                              input_options: null;
                              order: 0;
                              required_to_create: true;
                              required_to_create_for_contacts: false;
                              visible_on_create: true;
                              visible_to_contacts: false;
                              default: false;
                              ticket_type_id: 69;
                              archived: false;
                              created_at: 1717021668;
                              updated_at: 1717021668;
                            },
                          ];
                        };
                      };
                      contacts: {
                        type: 'contact.list';
                        contacts: [
                          {
                            id: '6657abe46abd0164c24b0df2';
                            role: 'user';
                          },
                        ];
                      };
                      admin_assignee_id: '0';
                      team_assignee_id: '0';
                      created_at: 1717021669;
                      updated_at: 1717021669;
                      ticket_parts: {
                        type: 'ticket_part.list';
                        ticket_parts: [
                          {
                            type: 'ticket_part';
                            id: '99';
                            part_type: 'ticket_state_updated_by_admin';
                            ticket_state: 'submitted';
                            previous_ticket_state: 'submitted';
                            created_at: 1717021669;
                            updated_at: 1717021669;
                            author: {
                              id: '991267707';
                              type: 'bot';
                              name: 'Operator';
                              email: 'operator+this_is_an_id643_that_should_be_at_least_@intercom.io';
                            };
                            attachments: [];
                            redacted: false;
                          },
                        ];
                        total_count: 1;
                      };
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/ticket';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: '10eb82e2-1019-4426-b5d0-8d3a817d0578';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/create_ticket_request';
              };
              examples: {
                successful_response: {
                  summary: 'Successful response';
                  value: {
                    ticket_type_id: 69;
                    contacts: [
                      {
                        id: '6657abe46abd0164c24b0df2';
                      },
                    ];
                    ticket_attributes: {
                      _default_title_: 'example';
                      _default_description_: 'there is a problem';
                    };
                  };
                };
              };
            };
          };
        };
      };
    };
    '/tickets/{id}': {
      put: {
        summary: 'Update a ticket';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
          {
            name: 'id';
            in: 'path';
            required: true;
            description: 'The unique identifier for the ticket which is given by Intercom';
            schema: {
              type: 'string';
            };
          },
        ];
        tags: ['Tickets'];
        operationId: 'updateTicket';
        description: 'You can update a ticket.';
        responses: {
          '200': {
            description: 'Successful response';
            content: {
              'application/json': {
                examples: {
                  'Successful response': {
                    value: {
                      type: 'ticket';
                      id: '447';
                      ticket_attributes: {
                        _default_title_: 'example';
                        _default_description_: 'there is a problem';
                      };
                      ticket_state: 'in_progress';
                      ticket_state_internal_label: 'In progress';
                      ticket_state_external_label: 'In progress';
                      ticket_type: {
                        type: 'ticket_type';
                        id: '71';
                        name: 'my-ticket-type-8';
                        description: 'my ticket type description is awesome.';
                        icon: '🦁';
                        workspace_id: 'this_is_an_id647_that_should_be_at_least_';
                        archived: false;
                        created_at: 1717021671;
                        updated_at: 1717021671;
                        is_internal: false;
                        ticket_type_attributes: {
                          type: 'list';
                          data: [
                            {
                              type: 'ticket_type_attribute';
                              id: '208';
                              workspace_id: 'this_is_an_id647_that_should_be_at_least_';
                              name: '_default_title_';
                              description: 'ola';
                              data_type: 'string';
                              input_options: null;
                              order: 0;
                              required_to_create: true;
                              required_to_create_for_contacts: false;
                              visible_on_create: true;
                              visible_to_contacts: false;
                              default: false;
                              ticket_type_id: 71;
                              archived: false;
                              created_at: 1717021671;
                              updated_at: 1717021671;
                            },
                            {
                              type: 'ticket_type_attribute';
                              id: '209';
                              workspace_id: 'this_is_an_id647_that_should_be_at_least_';
                              name: '_default_description_';
                              description: 'ola';
                              data_type: 'string';
                              input_options: null;
                              order: 0;
                              required_to_create: true;
                              required_to_create_for_contacts: false;
                              visible_on_create: true;
                              visible_to_contacts: false;
                              default: false;
                              ticket_type_id: 71;
                              archived: false;
                              created_at: 1717021671;
                              updated_at: 1717021671;
                            },
                          ];
                        };
                      };
                      contacts: {
                        type: 'contact.list';
                        contacts: [
                          {
                            id: '6657abe76abd0164c24b0df3';
                            role: 'lead';
                          },
                        ];
                      };
                      admin_assignee_id: '991267721';
                      team_assignee_id: '0';
                      created_at: 1717021672;
                      updated_at: 1717021674;
                      ticket_parts: {
                        type: 'ticket_part.list';
                        ticket_parts: [
                          {
                            type: 'ticket_part';
                            id: '100';
                            part_type: 'ticket_state_updated_by_admin';
                            ticket_state: 'submitted';
                            previous_ticket_state: 'submitted';
                            created_at: 1717021672;
                            updated_at: 1717021672;
                            author: {
                              id: '991267719';
                              type: 'admin';
                              name: 'Ciaran412 Lee';
                              email: 'admin412@email.com';
                            };
                            attachments: [];
                            redacted: false;
                          },
                          {
                            type: 'ticket_part';
                            id: '101';
                            part_type: 'ticket_attribute_updated_by_admin';
                            created_at: 1717021673;
                            updated_at: 1717021673;
                            author: {
                              id: '991267720';
                              type: 'bot';
                              name: 'Operator';
                              email: 'operator+this_is_an_id647_that_should_be_at_least_@intercom.io';
                            };
                            attachments: [];
                            redacted: false;
                          },
                          {
                            type: 'ticket_part';
                            id: '102';
                            part_type: 'ticket_attribute_updated_by_admin';
                            created_at: 1717021673;
                            updated_at: 1717021673;
                            author: {
                              id: '991267720';
                              type: 'bot';
                              name: 'Operator';
                              email: 'operator+this_is_an_id647_that_should_be_at_least_@intercom.io';
                            };
                            attachments: [];
                            redacted: false;
                          },
                          {
                            type: 'ticket_part';
                            id: '103';
                            part_type: 'ticket_state_updated_by_admin';
                            ticket_state: 'in_progress';
                            previous_ticket_state: 'submitted';
                            created_at: 1717021674;
                            updated_at: 1717021674;
                            author: {
                              id: '991267720';
                              type: 'bot';
                              name: 'Operator';
                              email: 'operator+this_is_an_id647_that_should_be_at_least_@intercom.io';
                            };
                            attachments: [];
                            redacted: false;
                          },
                          {
                            type: 'ticket_part';
                            id: '104';
                            part_type: 'assignment';
                            created_at: 1717021674;
                            updated_at: 1717021674;
                            assigned_to: {
                              type: 'admin';
                              id: '991267721';
                            };
                            author: {
                              id: '991267719';
                              type: 'admin';
                              name: 'Ciaran412 Lee';
                              email: 'admin412@email.com';
                            };
                            attachments: [];
                            redacted: false;
                          },
                        ];
                        total_count: 5;
                      };
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/ticket';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: '475d6530-9b7b-45fe-ae9b-2eac68b2e305';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
          '404': {
            description: 'Assignee not found';
            content: {
              'application/json': {
                examples: {
                  'Admin not found': {
                    value: {
                      type: 'error.list';
                      request_id: '297e6005-a6fa-476a-ad07-878b51f5646f';
                      errors: [
                        {
                          code: 'assignee_not_found';
                          message: 'Assignee not found';
                        },
                      ];
                    };
                  };
                  'Assignee not found': {
                    value: {
                      type: 'error.list';
                      request_id: '1d253700-fff8-4664-a0bb-b05242b3b2c0';
                      errors: [
                        {
                          code: 'assignee_not_found';
                          message: 'Assignee not found';
                        },
                      ];
                    };
                  };
                };
              };
            };
          };
        };
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/update_ticket_request';
              };
              examples: {
                successful_response: {
                  summary: 'Successful response';
                  value: {
                    ticket_attributes: {
                      _default_title_: 'example';
                      _default_description_: 'there is a problem';
                    };
                    state: 'in_progress';
                    assignment: {
                      admin_id: '991267719';
                      assignee_id: '991267721';
                    };
                    open: true;
                    snoozed_until: 1673609604;
                  };
                };
                admin_not_found: {
                  summary: 'Admin not found';
                  value: {
                    ticket_attributes: {
                      _default_title_: 'example';
                      _default_description_: 'there is a problem';
                    };
                    state: 'in_progress';
                    assignment: {
                      admin_id: '123';
                      assignee_id: '991267729';
                    };
                  };
                };
                assignee_not_found: {
                  summary: 'Assignee not found';
                  value: {
                    ticket_attributes: {
                      _default_title_: 'example';
                      _default_description_: 'there is a problem';
                    };
                    state: 'in_progress';
                    assignment: {
                      admin_id: '991267735';
                      assignee_id: '456';
                    };
                  };
                };
              };
            };
          };
        };
      };
      get: {
        summary: 'Retrieve a ticket';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
          {
            name: 'id';
            in: 'path';
            required: true;
            description: 'The unique identifier for the ticket which is given by Intercom.';
            schema: {
              type: 'string';
            };
          },
        ];
        tags: ['Tickets'];
        operationId: 'getTicket';
        description: 'You can fetch the details of a single ticket.';
        responses: {
          '200': {
            description: 'Ticket found';
            content: {
              'application/json': {
                examples: {
                  'Ticket found': {
                    value: {
                      type: 'ticket';
                      id: '450';
                      ticket_attributes: {
                        _default_title_: 'attribute_value';
                        _default_description_: null;
                      };
                      ticket_state: 'submitted';
                      ticket_state_internal_label: 'Submitted';
                      ticket_state_external_label: 'Submitted';
                      ticket_type: {
                        type: 'ticket_type';
                        id: '75';
                        name: 'my-ticket-type-12';
                        description: 'my ticket type description is awesome.';
                        icon: '🦁';
                        workspace_id: 'this_is_an_id655_that_should_be_at_least_';
                        archived: false;
                        created_at: 1717021681;
                        updated_at: 1717021681;
                        is_internal: false;
                        ticket_type_attributes: {
                          type: 'list';
                          data: [
                            {
                              type: 'ticket_type_attribute';
                              id: '219';
                              workspace_id: 'this_is_an_id655_that_should_be_at_least_';
                              name: '_default_title_';
                              description: 'ola';
                              data_type: 'string';
                              input_options: null;
                              order: 0;
                              required_to_create: true;
                              required_to_create_for_contacts: false;
                              visible_on_create: true;
                              visible_to_contacts: false;
                              default: false;
                              ticket_type_id: 75;
                              archived: false;
                              created_at: 1717021681;
                              updated_at: 1717021681;
                            },
                            {
                              type: 'ticket_type_attribute';
                              id: '220';
                              workspace_id: 'this_is_an_id655_that_should_be_at_least_';
                              name: '_default_description_';
                              description: 'ola';
                              data_type: 'string';
                              input_options: null;
                              order: 0;
                              required_to_create: true;
                              required_to_create_for_contacts: false;
                              visible_on_create: true;
                              visible_to_contacts: false;
                              default: false;
                              ticket_type_id: 75;
                              archived: false;
                              created_at: 1717021681;
                              updated_at: 1717021681;
                            },
                          ];
                        };
                      };
                      contacts: {
                        type: 'contact.list';
                        contacts: [
                          {
                            id: '6657abf16abd0164c24b0df6';
                            role: 'lead';
                          },
                        ];
                      };
                      admin_assignee_id: '0';
                      team_assignee_id: '0';
                      created_at: 1717021682;
                      updated_at: 1717021682;
                      ticket_parts: {
                        type: 'ticket_part.list';
                        ticket_parts: [
                          {
                            type: 'ticket_part';
                            id: '107';
                            part_type: 'ticket_state_updated_by_admin';
                            ticket_state: 'submitted';
                            previous_ticket_state: 'submitted';
                            created_at: 1717021682;
                            updated_at: 1717021682;
                            author: {
                              id: '991267748';
                              type: 'admin';
                              name: 'Ciaran438 Lee';
                              email: 'admin438@email.com';
                            };
                            attachments: [];
                            redacted: false;
                          },
                        ];
                        total_count: 1;
                      };
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/ticket';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: 'cfbb87fd-8bbe-443d-9e21-cb3dc71f0de8';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
      };
    };
    '/visitors': {
      put: {
        summary: 'Update a visitor';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
        ];
        tags: ['Visitors'];
        operationId: 'updateVisitor';
        description: 'Sending a PUT request to `/visitors` will result in an update of an existing Visitor.\n\n**Option 1.** You can update a visitor by passing in the `user_id` of the visitor in the Request body.\n\n**Option 2.** You can update a visitor by passing in the `id` of the visitor in the Request body.\n';
        responses: {
          '200': {
            description: 'successful';
            content: {
              'application/json': {
                examples: {
                  successful: {
                    value: {
                      type: 'visitor';
                      id: '6657abf76abd0164c24b0df9';
                      user_id: '3ecf64d0-9ed1-4e9f-88e1-da7d6e6782f3';
                      anonymous: true;
                      email: '';
                      phone: null;
                      name: 'Gareth Bale';
                      pseudonym: 'Indigo Guitar';
                      avatar: {
                        type: 'avatar';
                        image_url: 'https://static.intercomassets.com/app/pseudonym_avatars_2019/indigo-guitar.png';
                      };
                      app_id: 'this_is_an_id665_that_should_be_at_least_';
                      companies: {
                        type: 'company.list';
                        companies: [];
                      };
                      location_data: {};
                      last_request_at: null;
                      created_at: 1717021687;
                      remote_created_at: 1717021687;
                      signed_up_at: 1717021687;
                      updated_at: 1717021687;
                      session_count: 0;
                      social_profiles: {
                        type: 'social_profile.list';
                        social_profiles: [];
                      };
                      owner_id: null;
                      unsubscribed_from_emails: false;
                      marked_email_as_spam: false;
                      has_hard_bounced: false;
                      tags: {
                        type: 'tag.list';
                        tags: [];
                      };
                      segments: {
                        type: 'segment.list';
                        segments: [];
                      };
                      custom_attributes: {};
                      referrer: null;
                      utm_campaign: null;
                      utm_content: null;
                      utm_medium: null;
                      utm_source: null;
                      utm_term: null;
                      do_not_track: null;
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/visitor';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: '629db2ed-d045-457f-81f7-a24d5b629c5f';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
          '404': {
            description: 'visitor Not Found';
            content: {
              'application/json': {
                examples: {
                  'visitor Not Found': {
                    value: {
                      type: 'error.list';
                      request_id: '08bbf6c3-96e7-4f46-9623-1ffdd7176b04';
                      errors: [
                        {
                          code: 'not_found';
                          message: 'Visitor Not Found';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/update_visitor_request';
              };
              examples: {
                successful: {
                  summary: 'successful';
                  value: {
                    id: '6657abf76abd0164c24b0df9';
                    name: 'Gareth Bale';
                  };
                };
                visitor_not_found: {
                  summary: 'visitor Not Found';
                  value: {
                    user_id: 'fail';
                    name: 'Christian Fail';
                  };
                };
              };
            };
          };
        };
      };
      get: {
        summary: 'Retrieve a visitor with User ID';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
          {
            name: 'user_id';
            in: 'query';
            description: 'The user_id of the Visitor you want to retrieve.';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        tags: ['Visitors'];
        operationId: 'retrieveVisitorWithUserId';
        description: 'You can fetch the details of a single visitor.';
        responses: {
          '200': {
            description: 'successful';
            content: {
              'application/json': {
                examples: {
                  successful: {
                    value: {
                      type: 'visitor';
                      id: '6657abf96abd0164c24b0dff';
                      user_id: '3ecf64d0-9ed1-4e9f-88e1-da7d6e6782f3';
                      anonymous: true;
                      email: '';
                      phone: null;
                      name: null;
                      pseudonym: null;
                      avatar: {
                        type: 'avatar';
                        image_url: null;
                      };
                      app_id: 'this_is_an_id671_that_should_be_at_least_';
                      companies: {
                        type: 'company.list';
                        companies: [];
                      };
                      location_data: {};
                      last_request_at: null;
                      created_at: 1717021689;
                      remote_created_at: 1717021689;
                      signed_up_at: 1717021689;
                      updated_at: 1717021689;
                      session_count: 0;
                      social_profiles: {
                        type: 'social_profile.list';
                        social_profiles: [];
                      };
                      owner_id: null;
                      unsubscribed_from_emails: false;
                      marked_email_as_spam: false;
                      has_hard_bounced: false;
                      tags: {
                        type: 'tag.list';
                        tags: [];
                      };
                      segments: {
                        type: 'segment.list';
                        segments: [];
                      };
                      custom_attributes: {};
                      referrer: null;
                      utm_campaign: null;
                      utm_content: null;
                      utm_medium: null;
                      utm_source: null;
                      utm_term: null;
                      do_not_track: null;
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/visitor';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: '3f38ffa3-4cb5-463a-98ac-795cadb5d475';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
          '404': {
            description: 'Visitor not found';
            content: {
              'application/json': {
                examples: {
                  'Visitor not found': {
                    value: {
                      type: 'error.list';
                      request_id: 'dcae890e-9ff2-449a-bcc3-ab4ceb151767';
                      errors: [
                        {
                          code: 'not_found';
                          message: 'Visitor Not Found';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
      };
    };
    '/visitors/convert': {
      post: {
        summary: 'Convert a visitor';
        parameters: [
          {
            name: 'Intercom-Version';
            in: 'header';
            schema: {
              $ref: '#/components/schemas/intercom_version';
            };
          },
        ];
        tags: ['Visitors'];
        operationId: 'convertVisitor';
        description: "You can merge a Visitor to a Contact of role type `lead` or `user`.\n\n> 📘 What happens upon a visitor being converted?\n>\n> If the User exists, then the Visitor will be merged into it, the Visitor deleted and the User returned. If the User does not exist, the Visitor will be converted to a User, with the User identifiers replacing it's Visitor identifiers.\n";
        responses: {
          '200': {
            description: 'successful';
            content: {
              'application/json': {
                examples: {
                  successful: {
                    value: {
                      type: 'contact';
                      id: '6657abfb6abd0164c24b0e06';
                      workspace_id: 'this_is_an_id677_that_should_be_at_least_';
                      external_id: null;
                      role: 'user';
                      email: 'foo@bar.com';
                      phone: null;
                      name: null;
                      avatar: null;
                      owner_id: null;
                      social_profiles: {
                        type: 'list';
                        data: [];
                      };
                      has_hard_bounced: false;
                      marked_email_as_spam: false;
                      unsubscribed_from_emails: false;
                      created_at: 1717021691;
                      updated_at: 1717021691;
                      signed_up_at: 1717021691;
                      last_seen_at: null;
                      last_replied_at: null;
                      last_contacted_at: null;
                      last_email_opened_at: null;
                      last_email_clicked_at: null;
                      language_override: null;
                      browser: null;
                      browser_version: null;
                      browser_language: null;
                      os: null;
                      location: {
                        type: 'location';
                        country: null;
                        region: null;
                        city: null;
                        country_code: null;
                        continent_code: null;
                      };
                      android_app_name: null;
                      android_app_version: null;
                      android_device: null;
                      android_os_version: null;
                      android_sdk_version: null;
                      android_last_seen_at: null;
                      ios_app_name: null;
                      ios_app_version: null;
                      ios_device: null;
                      ios_os_version: null;
                      ios_sdk_version: null;
                      ios_last_seen_at: null;
                      custom_attributes: {};
                      tags: {
                        type: 'list';
                        data: [];
                        url: '/contacts/6657abfb6abd0164c24b0e06/tags';
                        total_count: 0;
                        has_more: false;
                      };
                      notes: {
                        type: 'list';
                        data: [];
                        url: '/contacts/6657abfb6abd0164c24b0e06/notes';
                        total_count: 0;
                        has_more: false;
                      };
                      companies: {
                        type: 'list';
                        data: [];
                        url: '/contacts/6657abfb6abd0164c24b0e06/companies';
                        total_count: 0;
                        has_more: false;
                      };
                      opted_out_subscription_types: {
                        type: 'list';
                        data: [];
                        url: '/contacts/6657abfb6abd0164c24b0e06/subscriptions';
                        total_count: 0;
                        has_more: false;
                      };
                      opted_in_subscription_types: {
                        type: 'list';
                        data: [];
                        url: '/contacts/6657abfb6abd0164c24b0e06/subscriptions';
                        total_count: 0;
                        has_more: false;
                      };
                      utm_campaign: null;
                      utm_content: null;
                      utm_medium: null;
                      utm_source: null;
                      utm_term: null;
                      referrer: null;
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/contact';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                examples: {
                  Unauthorized: {
                    value: {
                      type: 'error.list';
                      request_id: 'dea6a078-4db1-4f21-a9f6-14bfce68209d';
                      errors: [
                        {
                          code: 'unauthorized';
                          message: 'Access Token Invalid';
                        },
                      ];
                    };
                  };
                };
                schema: {
                  $ref: '#/components/schemas/error';
                };
              };
            };
          };
        };
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/convert_visitor_request';
              };
              examples: {
                successful: {
                  summary: 'successful';
                  value: {
                    visitor: {
                      user_id: '3ecf64d0-9ed1-4e9f-88e1-da7d6e6782f3';
                    };
                    user: {
                      email: 'foo@bar.com';
                    };
                    type: 'user';
                  };
                };
              };
            };
          };
        };
      };
    };
  };
  components: {
    schemas: {
      activity_log: {
        title: 'Activity Log';
        type: 'object';
        description: 'Activities performed by Admins.';
        nullable: true;
        properties: {
          id: {
            type: 'string';
            description: 'The id representing the activity.';
            example: '6';
          };
          performed_by: {
            type: 'object';
            description: 'Details about the Admin involved in the activity.';
            properties: {
              type: {
                type: 'string';
                description: "String representing the object's type. Always has the value `admin`.";
                example: 'admin';
              };
              id: {
                type: 'string';
                description: 'The id representing the admin.';
                example: '1295';
              };
              email: {
                type: 'string';
                description: 'The email of the admin.';
                example: 'john@example.com';
              };
              ip: {
                type: 'string';
                description: 'The IP address of the admin.';
                example: '198.51.100.255';
              };
            };
          };
          metadata: {
            $ref: '#/components/schemas/activity_log_metadata';
          };
          created_at: {
            type: 'integer';
            format: 'date-time';
            description: 'The time the activity was created.';
            example: 1671028894;
          };
          activity_type: {
            type: 'string';
            enum: [
              'admin_assignment_limit_change',
              'admin_away_mode_change',
              'admin_deletion',
              'admin_deprovisioned',
              'admin_impersonation_end',
              'admin_impersonation_start',
              'admin_invite_change',
              'admin_invite_creation',
              'admin_invite_deletion',
              'admin_login_failure',
              'admin_login_success',
              'admin_logout',
              'admin_password_reset_request',
              'admin_password_reset_success',
              'admin_permission_change',
              'admin_provisioned',
              'admin_two_factor_auth_change',
              'admin_unauthorized_sign_in_method',
              'app_admin_join',
              'app_authentication_method_change',
              'app_data_deletion',
              'app_data_export',
              'app_google_sso_domain_change',
              'app_identity_verification_change',
              'app_name_change',
              'app_outbound_address_change',
              'app_package_installation',
              'app_package_token_regeneration',
              'app_package_uninstallation',
              'app_team_creation',
              'app_team_deletion',
              'app_team_membership_modification',
              'app_timezone_change',
              'app_webhook_creation',
              'app_webhook_deletion',
              'articles_in_messenger_enabled_change',
              'bulk_delete',
              'bulk_export',
              'campaign_deletion',
              'campaign_state_change',
              'conversation_part_deletion',
              'conversation_topic_change',
              'conversation_topic_creation',
              'conversation_topic_deletion',
              'help_center_settings_change',
              'inbound_conversations_change',
              'inbox_access_change',
              'message_deletion',
              'message_state_change',
              'messenger_look_and_feel_change',
              'messenger_search_required_change',
              'messenger_spaces_change',
              'office_hours_change',
              'role_change',
              'role_creation',
              'role_deletion',
              'ruleset_activation_title_preview',
              'ruleset_creation',
              'ruleset_deletion',
              'search_browse_enabled_change',
              'search_browse_required_change',
              'seat_change',
              'seat_revoke',
              'security_settings_change',
              'temporary_expectation_change',
              'upfront_email_collection_change',
              'welcome_message_change',
            ];
            example: 'app_name_change';
          };
          activity_description: {
            type: 'string';
            description: 'A sentence or two describing the activity.';
            example: 'Admin updated the app\'s name to "My App".';
          };
        };
      };
      activity_log_list: {
        title: 'Paginated Response';
        type: 'object';
        description: 'A paginated list of activity logs.';
        properties: {
          type: {
            type: 'string';
            description: "String representing the object's type. Always has the value `activity_log.list`.";
            example: 'activity_log.list';
          };
          pages: {
            $ref: '#/components/schemas/cursor_pages';
          };
          activity_logs: {
            type: 'array';
            description: 'An array of activity logs';
            items: {
              $ref: '#/components/schemas/activity_log';
            };
          };
        };
      };
      activity_log_metadata: {
        title: 'Activity Log Metadata';
        type: 'object';
        description: 'Additional data provided about Admin activity.';
        nullable: true;
        properties: {
          sign_in_method: {
            type: 'string';
            nullable: true;
            description: 'The way the admin signed in.';
            example: 'email_password';
          };
          external_id: {
            type: 'string';
            nullable: true;
            description: 'The unique identifier for the contact which is provided by the Client.';
            example: 'f3b87a2e09d514c6c2e79b9a';
          };
          away_mode: {
            type: 'boolean';
            nullable: true;
            description: 'The away mode status which is set to true when away and false when returned.';
            example: true;
          };
          away_status_reason: {
            type: 'string';
            nullable: true;
            description: 'The reason the Admin is away.';
            example: '😌 On a break';
          };
          reassign_conversations: {
            type: 'boolean';
            nullable: true;
            description: 'Indicates if conversations should be reassigned while an Admin is away.';
            example: false;
          };
          source: {
            type: 'string';
            nullable: true;
            description: 'The action that initiated the status change.';
            example: 'admin update from web - Admin id: 93';
          };
          auto_changed: {
            type: 'string';
            nullable: true;
            description: 'Indicates if the status was changed automatically or manually.';
            example: false;
          };
          update_by: {
            type: 'integer';
            nullable: true;
            description: 'The ID of the Admin who initiated the activity.';
            example: 93;
          };
          update_by_name: {
            type: 'string';
            nullable: true;
            description: 'The name of the Admin who initiated the activity.';
            example: 'Joe Bloggs';
          };
        };
      };
      addressable_list: {
        title: 'Addressable List';
        type: 'object';
        nullable: false;
        description: 'A list used to access other resources from a parent model.';
        properties: {
          type: {
            type: 'string';
            format: 'uri';
            description: 'The addressable object type';
            example: 'note';
          };
          id: {
            type: 'string';
            description: 'The id of the addressable object';
            example: '123';
          };
          url: {
            type: 'string';
            format: 'uri';
            description: 'Url to get more company resources for this contact';
            example: '/contacts/5ba682d23d7cf92bef87bfd4/notes';
          };
        };
      };
      admin: {
        title: 'Admin';
        type: 'object';
        'x-tags': ['Admins'];
        description: 'Admins are teammate accounts that have access to a workspace.';
        nullable: true;
        properties: {
          type: {
            type: 'string';
            description: "String representing the object's type. Always has the value `admin`.";
            example: 'admin';
          };
          id: {
            type: 'string';
            description: 'The id representing the admin.';
            example: '1295';
          };
          name: {
            type: 'string';
            description: 'The name of the admin.';
            example: 'Hoban Washburne';
          };
          email: {
            type: 'string';
            description: 'The email of the admin.';
            example: 'wash@serenity.io';
          };
          job_title: {
            type: 'string';
            description: 'The job title of the admin.';
            example: 'Philosopher';
          };
          away_mode_enabled: {
            type: 'boolean';
            description: 'Identifies if this admin is currently set in away mode.';
            example: false;
          };
          away_mode_reassign: {
            type: 'boolean';
            description: 'Identifies if this admin is set to automatically reassign new conversations to the apps default inbox.';
            example: false;
          };
          has_inbox_seat: {
            type: 'boolean';
            description: 'Identifies if this admin has a paid inbox seat to restrict/allow features that require them.';
            example: true;
          };
          team_ids: {
            type: 'array';
            description: 'This object represents the avatar associated with the admin.';
            example: [814865];
            items: {
              type: 'integer';
            };
          };
          avatar: {
            type: 'string';
            format: 'uri';
            nullable: true;
            description: 'Image for the associated team or teammate';
            example: 'https://picsum.photos/200/300';
          };
          team_priority_level: {
            $ref: '#/components/schemas/team_priority_level';
          };
        };
      };
      admin_list: {
        title: 'Admins';
        type: 'object';
        description: 'A list of admins associated with a given workspace.';
        properties: {
          type: {
            type: 'string';
            description: "String representing the object's type. Always has the value `admin.list`.";
            example: 'admin.list';
          };
          admins: {
            type: 'array';
            description: 'A list of admins associated with a given workspace.';
            items: {
              $ref: '#/components/schemas/admin';
            };
          };
        };
      };
      admin_priority_level: {
        title: 'Admin Priority Level';
        type: 'object';
        nullable: true;
        description: 'Admin priority levels for the team';
        properties: {
          primary_admin_ids: {
            type: 'array';
            description: 'The primary admin ids for the team';
            nullable: true;
            example: [493881];
            items: {
              type: 'integer';
            };
          };
          secondary_admin_ids: {
            type: 'array';
            description: 'The secondary admin ids for the team';
            nullable: true;
            example: [814865];
            items: {
              type: 'integer';
            };
          };
        };
      };
      admin_reply_conversation_request: {
        title: 'Admin Reply';
        type: 'object';
        description: 'Payload of the request to reply on behalf of an admin';
        properties: {
          message_type: {
            type: 'string';
            enum: ['comment', 'note'];
          };
          type: {
            type: 'string';
            enum: ['admin'];
            example: 'admin';
          };
          body: {
            type: 'string';
            description: 'The text body of the reply. Notes accept some HTML formatting. Must be present for comment and note message types.';
            example: 'Hello there!';
          };
          admin_id: {
            type: 'string';
            description: 'The id of the admin who is authoring the comment.';
            example: '3156780';
          };
          created_at: {
            type: 'integer';
            description: 'The time the reply was created. If not provided, the current time will be used.';
            example: 1590000000;
          };
          attachment_urls: {
            type: 'array';
            description: 'A list of image URLs that will be added as attachments. You can include up to 10 URLs.';
            items: {
              type: 'string';
              format: 'uri';
            };
            maxItems: 10;
          };
          attachment_files: {
            type: 'array';
            description: 'A list of files that will be added as attachments. You can include up to 10 files';
            items: {
              $ref: '#/components/schemas/conversation_attachment_files';
            };
            maxItems: 10;
          };
        };
        required: ['message_type', 'type', 'admin_id'];
      };
      admin_with_app: {
        title: 'Admin';
        type: 'object';
        description: 'Admins are the teammate accounts that have access to a workspace';
        nullable: true;
        properties: {
          type: {
            type: 'string';
            description: "String representing the object's type. Always has the value `admin`.";
            example: 'admin';
          };
          id: {
            type: 'string';
            description: 'The id representing the admin.';
            example: '1295';
          };
          name: {
            type: 'string';
            description: 'The name of the admin.';
            example: 'Hoban Washburne';
          };
          email: {
            type: 'string';
            description: 'The email of the admin.';
            example: 'wash@serenity.io';
          };
          job_title: {
            type: 'string';
            description: 'The job title of the admin.';
            example: 'Philosopher';
          };
          away_mode_enabled: {
            type: 'boolean';
            description: 'Identifies if this admin is currently set in away mode.';
            example: false;
          };
          away_mode_reassign: {
            type: 'boolean';
            description: 'Identifies if this admin is set to automatically reassign new conversations to the apps default inbox.';
            example: false;
          };
          has_inbox_seat: {
            type: 'boolean';
            description: 'Identifies if this admin has a paid inbox seat to restrict/allow features that require them.';
            example: true;
          };
          team_ids: {
            type: 'array';
            description: 'This is a list of ids of the teams that this admin is part of.';
            example: [814865];
            items: {
              type: 'integer';
            };
          };
          avatar: {
            type: 'object';
            description: 'This object represents the avatar associated with the admin.';
            properties: {
              type: {
                type: 'string';
                description: 'This is a string that identifies the type of the object. It will always have the value `avatar`.';
                default: 'avatar';
                example: 'avatar';
              };
              image_url: {
                type: 'string';
                format: 'uri';
                nullable: true;
                description: 'This object represents the avatar associated with the admin.';
                example: 'https://example.com/avatar.png';
              };
            };
          };
          email_verified: {
            type: 'boolean';
            description: "Identifies if this admin's email is verified.";
            nullable: true;
            example: true;
          };
          app: {
            $ref: '#/components/schemas/app';
            nullable: true;
            description: 'App that the admin belongs to.';
          };
        };
      };
      app: {
        title: 'App';
        type: 'object';
        description: 'App is a workspace on Intercom';
        nullable: true;
        properties: {
          type: {
            type: 'string';
            description: '';
            default: 'app';
            example: 'app';
          };
          id_code: {
            type: 'string';
            description: 'The id of the app.';
            example: 'xyz789';
          };
          name: {
            type: 'string';
            description: 'The name of the app.';
            example: 'ACME';
          };
          region: {
            type: 'string';
            description: 'The Intercom region the app is located in.';
            example: 'US';
          };
          timezone: {
            type: 'string';
            description: 'The timezone of the region where the app is located.';
            example: 'America/Los_Angeles';
          };
          created_at: {
            type: 'integer';
            description: 'When the app was created.';
            example: 1671465577;
          };
          identity_verification: {
            type: 'boolean';
            description: 'Whether or not the app uses identity verification.';
            example: false;
          };
        };
      };
      article: {
        title: 'Article';
        type: 'object';
        'x-tags': ['Articles'];
        description: 'The Articles API is a central place to gather all information and take actions on your articles. Articles can live within collections and sections, or alternatively they can stand alone.';
        properties: {
          statistics: {
            nullable: true;
            $ref: '#/components/schemas/article_statistics';
          };
        };
        allOf: [
          {
            $ref: '#/components/schemas/article_list_item';
          },
        ];
      };
      article_content: {
        title: 'Article Content';
        type: 'object';
        description: 'The Content of an Article.';
        nullable: true;
        properties: {
          type: {
            type: 'string';
            description: 'The type of object - `article_content` .';
            enum: [null, 'article_content'];
            example: 'article_content';
            nullable: true;
          };
          title: {
            type: 'string';
            description: 'The title of the article.';
            example: 'How to create a new article';
          };
          description: {
            type: 'string';
            description: 'The description of the article.';
            example: 'This article will show you how to create a new article.';
          };
          body: {
            type: 'string';
            description: 'The body of the article.';
            example: 'This is the body of the article.';
          };
          author_id: {
            type: 'integer';
            description: 'The ID of the author of the article.';
            example: '5017691';
          };
          state: {
            type: 'string';
            description: 'Whether the article is `published` or is a `draft` .';
            enum: ['published', 'draft'];
            example: 'draft';
          };
          created_at: {
            type: 'integer';
            format: 'date-time';
            description: 'The time when the article was created (seconds).';
            example: 1663597223;
          };
          updated_at: {
            type: 'integer';
            format: 'date-time';
            description: 'The time when the article was last updated (seconds).';
            example: 1663597260;
          };
          url: {
            type: 'string';
            description: 'The URL of the article.';
            example: 'http://intercom.test/help/en/articles/3-default-language';
          };
        };
      };
      article_list: {
        title: 'Articles';
        type: 'object';
        description: 'This will return a list of articles for the App.';
        properties: {
          type: {
            type: 'string';
            description: 'The type of the object - `list`.';
            enum: ['list'];
            example: 'list';
          };
          pages: {
            $ref: '#/components/schemas/cursor_pages';
          };
          total_count: {
            type: 'integer';
            description: 'A count of the total number of articles.';
            example: 1;
          };
          data: {
            type: 'array';
            description: 'An array of Article objects';
            items: {
              $ref: '#/components/schemas/article_list_item';
            };
          };
        };
      };
      article_list_item: {
        title: 'Articles';
        type: 'object';
        'x-tags': ['Articles'];
        description: 'The data returned about your articles when you list them.';
        properties: {
          type: {
            type: 'string';
            description: 'The type of object - `article`.';
            enum: ['article'];
            default: 'article';
            example: 'article';
          };
          id: {
            type: 'string';
            description: 'The unique identifier for the article which is given by Intercom.';
            example: '6871119';
          };
          workspace_id: {
            type: 'string';
            description: 'The id of the workspace which the article belongs to.';
            example: 'hfi1bx4l';
          };
          title: {
            type: 'string';
            description: "The title of the article. For multilingual articles, this will be the title of the default language's content.";
            example: 'Default language title';
          };
          description: {
            type: 'string';
            nullable: true;
            description: "The description of the article. For multilingual articles, this will be the description of the default language's content.";
            example: 'Default language description';
          };
          body: {
            type: 'string';
            nullable: true;
            description: "The body of the article in HTML. For multilingual articles, this will be the body of the default language's content.";
            example: 'Default language body in html';
          };
          author_id: {
            type: 'integer';
            description: "The id of the author of the article. For multilingual articles, this will be the id of the author of the default language's content. Must be a teammate on the help center's workspace.";
            example: '5017691';
          };
          state: {
            type: 'string';
            description: "Whether the article is `published` or is a `draft`. For multilingual articles, this will be the state of the default language's content.";
            enum: ['published', 'draft'];
            default: 'draft';
            example: 'published';
          };
          created_at: {
            type: 'integer';
            format: 'date-time';
            description: "The time when the article was created. For multilingual articles, this will be the timestamp of creation of the default language's content in seconds.";
            example: 1672928359;
          };
          updated_at: {
            type: 'integer';
            format: 'date-time';
            description: "The time when the article was last updated. For multilingual articles, this will be the timestamp of last update of the default language's content in seconds.";
            example: 1672928610;
          };
          url: {
            type: 'string';
            nullable: true;
            description: "The URL of the article. For multilingual articles, this will be the URL of the default language's content.";
            example: 'http://intercom.test/help/en/articles/3-default-language';
          };
          parent_id: {
            type: 'integer';
            nullable: true;
            description: "The id of the article's parent collection or section. An article without this field stands alone.";
            example: '125685';
          };
          parent_ids: {
            type: 'array';
            description: "The ids of the article's parent collections or sections. An article without this field stands alone.";
            items: {
              type: 'integer';
            };
            example: [18, 19];
          };
          parent_type: {
            type: 'string';
            nullable: true;
            description: 'The type of parent, which can either be a `collection` or `section`.';
            example: 'collection';
          };
          default_locale: {
            type: 'string';
            description: 'The default locale of the help center. This field is only returned for multilingual help centers.';
            example: 'en';
          };
          translated_content: {
            nullable: true;
            $ref: '#/components/schemas/article_translated_content';
          };
        };
      };
      article_statistics: {
        title: 'Article Statistics';
        type: 'object';
        description: 'The statistics of an article.';
        nullable: true;
        properties: {
          type: {
            type: 'string';
            description: 'The type of object - `article_statistics`.';
            enum: ['article_statistics'];
            default: 'article_statistics';
            example: 'article_statistics';
          };
          views: {
            type: 'integer';
            description: 'The number of total views the article has received.';
            example: 10;
          };
          conversions: {
            type: 'integer';
            description: 'The number of conversations started from the article.';
            example: 0;
          };
          reactions: {
            type: 'integer';
            description: 'The number of total reactions the article has received.';
            example: 10;
          };
          happy_reaction_percentage: {
            type: 'number';
            format: 'float';
            description: 'The percentage of happy reactions the article has received against other types of reaction.';
            example: 40;
          };
          neutral_reaction_percentage: {
            type: 'number';
            format: 'float';
            description: 'The percentage of neutral reactions the article has received against other types of reaction.';
            example: 40;
          };
          sad_reaction_percentage: {
            type: 'number';
            format: 'float';
            description: 'The percentage of sad reactions the article has received against other types of reaction.';
            example: 20;
          };
        };
      };
      article_translated_content: {
        title: 'Article Translated Content';
        type: 'object';
        description: 'The Translated Content of an Article. The keys are the locale codes and the values are the translated content of the article.';
        nullable: true;
        properties: {
          type: {
            type: 'string';
            description: 'The type of object - article_translated_content.';
            enum: [null, 'article_translated_content'];
            example: 'article_translated_content';
            nullable: true;
          };
          ar: {
            description: 'The content of the article in Arabic';
            $ref: '#/components/schemas/article_content';
          };
          bg: {
            description: 'The content of the article in Bulgarian';
            $ref: '#/components/schemas/article_content';
          };
          bs: {
            description: 'The content of the article in Bosnian';
            $ref: '#/components/schemas/article_content';
          };
          ca: {
            description: 'The content of the article in Catalan';
            $ref: '#/components/schemas/article_content';
          };
          cs: {
            description: 'The content of the article in Czech';
            $ref: '#/components/schemas/article_content';
          };
          da: {
            description: 'The content of the article in Danish';
            $ref: '#/components/schemas/article_content';
          };
          de: {
            description: 'The content of the article in German';
            $ref: '#/components/schemas/article_content';
          };
          el: {
            description: 'The content of the article in Greek';
            $ref: '#/components/schemas/article_content';
          };
          en: {
            description: 'The content of the article in English';
            $ref: '#/components/schemas/article_content';
          };
          es: {
            description: 'The content of the article in Spanish';
            $ref: '#/components/schemas/article_content';
          };
          et: {
            description: 'The content of the article in Estonian';
            $ref: '#/components/schemas/article_content';
          };
          fi: {
            description: 'The content of the article in Finnish';
            $ref: '#/components/schemas/article_content';
          };
          fr: {
            description: 'The content of the article in French';
            $ref: '#/components/schemas/article_content';
          };
          he: {
            description: 'The content of the article in Hebrew';
            $ref: '#/components/schemas/article_content';
          };
          hr: {
            description: 'The content of the article in Croatian';
            $ref: '#/components/schemas/article_content';
          };
          hu: {
            description: 'The content of the article in Hungarian';
            $ref: '#/components/schemas/article_content';
          };
          id: {
            description: 'The content of the article in Indonesian';
            $ref: '#/components/schemas/article_content';
          };
          it: {
            description: 'The content of the article in Italian';
            $ref: '#/components/schemas/article_content';
          };
          ja: {
            description: 'The content of the article in Japanese';
            $ref: '#/components/schemas/article_content';
          };
          ko: {
            description: 'The content of the article in Korean';
            $ref: '#/components/schemas/article_content';
          };
          lt: {
            description: 'The content of the article in Lithuanian';
            $ref: '#/components/schemas/article_content';
          };
          lv: {
            description: 'The content of the article in Latvian';
            $ref: '#/components/schemas/article_content';
          };
          mn: {
            description: 'The content of the article in Mongolian';
            $ref: '#/components/schemas/article_content';
          };
          nb: {
            description: 'The content of the article in Norwegian';
            $ref: '#/components/schemas/article_content';
          };
          nl: {
            description: 'The content of the article in Dutch';
            $ref: '#/components/schemas/article_content';
          };
          pl: {
            description: 'The content of the article in Polish';
            $ref: '#/components/schemas/article_content';
          };
          pt: {
            description: 'The content of the article in Portuguese (Portugal)';
            $ref: '#/components/schemas/article_content';
          };
          ro: {
            description: 'The content of the article in Romanian';
            $ref: '#/components/schemas/article_content';
          };
          ru: {
            description: 'The content of the article in Russian';
            $ref: '#/components/schemas/article_content';
          };
          sl: {
            description: 'The content of the article in Slovenian';
            $ref: '#/components/schemas/article_content';
          };
          sr: {
            description: 'The content of the article in Serbian';
            $ref: '#/components/schemas/article_content';
          };
          sv: {
            description: 'The content of the article in Swedish';
            $ref: '#/components/schemas/article_content';
          };
          tr: {
            description: 'The content of the article in Turkish';
            $ref: '#/components/schemas/article_content';
          };
          vi: {
            description: 'The content of the article in Vietnamese';
            $ref: '#/components/schemas/article_content';
          };
          'pt-BR': {
            description: 'The content of the article in Portuguese (Brazil)';
            $ref: '#/components/schemas/article_content';
          };
          'zh-CN': {
            description: 'The content of the article in Chinese (China)';
            $ref: '#/components/schemas/article_content';
          };
          'zh-TW': {
            description: 'The content of the article in Chinese (Taiwan)';
            $ref: '#/components/schemas/article_content';
          };
        };
      };
      assign_conversation_request: {
        title: 'Assign Conversation Request';
        type: 'object';
        description: 'Payload of the request to assign a conversation';
        properties: {
          message_type: {
            type: 'string';
            enum: ['assignment'];
            example: 'assignment';
          };
          type: {
            type: 'string';
            enum: ['admin', 'team'];
            example: 'admin';
          };
          admin_id: {
            type: 'string';
            description: 'The id of the admin who is performing the action.';
            example: '12345';
          };
          assignee_id: {
            type: 'string';
            description: 'The `id` of the `admin` or `team` which will be assigned the conversation. A conversation can be assigned both an admin and a team.\\nSet `0` if you want this assign to no admin or team (ie. Unassigned).';
            example: '4324241';
          };
          body: {
            type: 'string';
            description: 'Optionally you can send a response in the conversation when it is assigned.';
            example: 'Let me pass you over to one of my colleagues.';
          };
        };
        required: ['message_type', 'type', 'admin_id', 'assignee_id'];
      };
      attach_contact_to_conversation_request: {
        title: 'Assign Conversation Request';
        type: 'object';
        description: 'Payload of the request to assign a conversation';
        properties: {
          admin_id: {
            type: 'string';
            description: 'The `id` of the admin who is adding the new participant.';
            example: '12345';
          };
          customer: {
            type: 'object';
            oneOf: [
              {
                title: 'Intercom User ID';
                properties: {
                  intercom_user_id: {
                    type: 'string';
                    description: 'The identifier for the contact as given by Intercom.';
                    example: '6329bd9ffe4e2e91dac76188';
                  };
                  customer: {
                    $ref: '#/components/schemas/customer_request';
                  };
                };
                required: ['intercom_user_id'];
              },
              {
                title: 'User ID';
                properties: {
                  user_id: {
                    type: 'string';
                    description: 'The external_id you have defined for the contact who is being added as a participant.';
                    example: '6329bd9ffe4e2e91dac76188';
                  };
                  customer: {
                    $ref: '#/components/schemas/customer_request';
                  };
                };
                required: ['user_id'];
              },
              {
                title: 'Email';
                properties: {
                  email: {
                    type: 'string';
                    description: 'The email you have defined for the contact who is being added as a participant.';
                    example: 'winstonsmith@truth.org';
                  };
                  customer: {
                    $ref: '#/components/schemas/customer_request';
                  };
                };
                required: ['email'];
              },
            ];
          };
        };
      };
      close_conversation_request: {
        title: 'Close Conversation Request';
        type: 'object';
        description: 'Payload of the request to close a conversation';
        properties: {
          message_type: {
            type: 'string';
            enum: ['close'];
            example: 'close';
          };
          type: {
            type: 'string';
            enum: ['admin'];
            example: 'admin';
          };
          admin_id: {
            type: 'string';
            description: 'The id of the admin who is performing the action.';
            example: '12345';
          };
          body: {
            type: 'string';
            description: 'Optionally you can leave a message in the conversation to provide additional context to the user and other teammates.';
            example: ' This conversation is now closed!';
          };
        };
        required: ['message_type', 'type', 'admin_id'];
      };
      collection: {
        title: 'Collection';
        type: 'object';
        'x-tags': ['Help Center'];
        description: 'Collections are top level containers for Articles within the Help Center.';
        properties: {
          id: {
            type: 'string';
            description: 'The unique identifier for the collection which is given by Intercom.';
            example: '6871119';
          };
          workspace_id: {
            type: 'string';
            description: 'The id of the workspace which the collection belongs to.';
            example: 'hfi1bx4l';
          };
          name: {
            type: 'string';
            description: "The name of the collection. For multilingual collections, this will be the name of the default language's content.";
            example: 'Default language name';
          };
          description: {
            type: 'string';
            nullable: true;
            description: 'The description of the collection. For multilingual help centers, this will be the description of the collection for the default language.';
            example: 'Default language description';
          };
          created_at: {
            type: 'integer';
            format: 'date-time';
            description: "The time when the article was created (seconds). For multilingual articles, this will be the timestamp of creation of the default language's content.";
            example: 1672928359;
          };
          updated_at: {
            type: 'integer';
            format: 'date-time';
            description: "The time when the article was last updated (seconds). For multilingual articles, this will be the timestamp of last update of the default language's content.";
            example: 1672928610;
          };
          url: {
            type: 'string';
            nullable: true;
            description: 'The URL of the collection. For multilingual help centers, this will be the URL of the collection for the default language.';
            example: 'http://intercom.test/help/collection/name';
          };
          icon: {
            type: 'string';
            nullable: true;
            description: 'The icon of the collection.';
            example: 'book-bookmark';
          };
          order: {
            type: 'integer';
            description: "The order of the section in relation to others sections within a collection. Values go from `0` upwards. `0` is the default if there's no order.";
            example: '1';
          };
          default_locale: {
            type: 'string';
            description: 'The default locale of the help center. This field is only returned for multilingual help centers.';
            example: 'en';
          };
          translated_content: {
            nullable: true;
            $ref: '#/components/schemas/group_translated_content';
          };
          help_center_id: {
            type: 'integer';
            nullable: true;
            description: 'The id of the help center the collection is in.';
            example: '123';
          };
          type: {
            type: 'string';
            description: 'The type of object - `collection`.';
            enum: ['collection'];
            default: 'collection';
            example: 'collection';
          };
        };
      };
      collection_list: {
        title: 'Collections';
        type: 'object';
        description: 'This will return a list of Collections for the App.';
        properties: {
          type: {
            type: 'string';
            description: 'The type of the object - `list`.';
            enum: ['list'];
            example: 'list';
          };
          pages: {
            $ref: '#/components/schemas/cursor_pages';
          };
          total_count: {
            type: 'integer';
            description: 'A count of the total number of collections.';
            example: 1;
          };
          data: {
            type: 'array';
            description: 'An array of collection objects';
            items: {
              $ref: '#/components/schemas/collection';
            };
          };
        };
      };
      company: {
        title: 'Company';
        type: 'object';
        'x-tags': ['Companies'];
        description: 'Companies allow you to represent organizations using your product. Each company will have its own description and be associated with contacts. You can fetch, create, update and list companies.';
        properties: {
          type: {
            type: 'string';
            description: 'Value is `company`';
            enum: ['company'];
            example: 'company';
          };
          id: {
            type: 'string';
            description: 'The Intercom defined id representing the company.';
            example: '531ee472cce572a6ec000006';
          };
          name: {
            type: 'string';
            description: 'The name of the company.';
            example: 'Blue Sun';
          };
          app_id: {
            type: 'string';
            description: 'The Intercom defined code of the workspace the company is associated to.';
            example: 'ecahpwf5';
          };
          plan: {
            type: 'object';
            properties: {
              type: {
                type: 'string';
                description: 'Value is always "plan"';
                example: 'plan';
              };
              id: {
                type: 'string';
                description: 'The id of the plan';
                example: '269315';
              };
              name: {
                type: 'string';
                description: 'The name of the plan';
                example: 'Pro';
              };
            };
          };
          company_id: {
            type: 'string';
            description: 'The company id you have defined for the company.';
            example: '6';
          };
          remote_created_at: {
            type: 'integer';
            description: 'The time the company was created by you.';
            example: 1663597223;
          };
          created_at: {
            type: 'integer';
            description: 'The time the company was added in Intercom.';
            example: 1663597223;
          };
          updated_at: {
            type: 'integer';
            description: 'The last time the company was updated.';
            example: 1663597223;
          };
          last_request_at: {
            type: 'integer';
            description: 'The time the company last recorded making a request.';
            example: 1663597223;
          };
          size: {
            type: 'integer';
            description: 'The number of employees in the company.';
            example: 100;
          };
          website: {
            type: 'string';
            description: 'The URL for the company website.';
            example: 'https://www.intercom.com';
          };
          industry: {
            type: 'string';
            description: 'The industry that the company operates in.';
            example: 'Software';
          };
          monthly_spend: {
            type: 'integer';
            description: 'How much revenue the company generates for your business.';
            example: 100;
          };
          session_count: {
            type: 'integer';
            description: 'How many sessions the company has recorded.';
            example: 100;
          };
          user_count: {
            type: 'integer';
            description: 'The number of users in the company.';
            example: 100;
          };
          custom_attributes: {
            type: 'object';
            description: 'The custom attributes you have set on the company.';
            additionalProperties: {
              type: 'string';
            };
            example: {
              paid_subscriber: true;
              monthly_spend: 155.5;
              team_mates: 9;
            };
          };
          tags: {
            type: 'object';
            description: 'The list of tags associated with the company';
            properties: {
              type: {
                type: 'string';
                description: 'The type of the object';
                enum: ['tag.list'];
              };
              tags: {
                type: 'array';
                items: {
                  items: {
                    $ref: '#/components/schemas/tag';
                  };
                };
              };
            };
          };
          segments: {
            type: 'object';
            description: 'The list of segments associated with the company';
            properties: {
              type: {
                type: 'string';
                description: 'The type of the object';
                enum: ['segment.list'];
              };
              segments: {
                type: 'array';
                items: {
                  $ref: '#/components/schemas/segment';
                };
              };
            };
          };
        };
      };
      company_attached_contacts: {
        title: 'Company Attached Contacts';
        type: 'object';
        description: 'A list of Contact Objects';
        properties: {
          type: {
            type: 'string';
            description: 'The type of object - `list`';
            enum: ['list'];
            example: 'list';
          };
          data: {
            type: 'array';
            description: 'An array containing Contact Objects';
            items: {
              $ref: '#/components/schemas/contact';
            };
          };
          total_count: {
            type: 'integer';
            description: 'The total number of contacts';
            example: 100;
          };
          pages: {
            $ref: '#/components/schemas/cursor_pages';
          };
        };
      };
      company_attached_segments: {
        title: 'Company Attached Segments';
        type: 'object';
        description: 'A list of Segment Objects';
        properties: {
          type: {
            type: 'string';
            description: 'The type of object - `list`';
            enum: ['list'];
            example: 'list';
          };
          data: {
            type: 'array';
            description: 'An array containing Segment Objects';
            items: {
              $ref: '#/components/schemas/segment';
            };
          };
        };
      };
      company_list: {
        title: 'Companies';
        type: 'object';
        description: 'This will return a list of companies for the App.';
        properties: {
          type: {
            type: 'string';
            description: 'The type of object - `list`.';
            enum: ['list'];
            example: 'list';
          };
          pages: {
            $ref: '#/components/schemas/cursor_pages';
          };
          total_count: {
            type: 'integer';
            description: 'The total number of companies.';
            example: 100;
          };
          data: {
            type: 'array';
            description: 'An array containing Company Objects.';
            items: {
              $ref: '#/components/schemas/company';
            };
          };
        };
      };
      company_scroll: {
        title: 'Company Scroll';
        type: 'object';
        description: 'Companies allow you to represent organizations using your product. Each company will have its own description and be associated with contacts. You can fetch, create, update and list companies.';
        nullable: true;
        properties: {
          type: {
            type: 'string';
            description: 'The type of object - `list`';
            enum: ['list'];
            example: 'list';
          };
          data: {
            type: 'array';
            items: {
              $ref: '#/components/schemas/company';
            };
          };
          pages: {
            $ref: '#/components/schemas/cursor_pages';
          };
          total_count: {
            type: 'integer';
            description: 'The total number of companies';
            nullable: true;
            example: 100;
          };
          scroll_param: {
            type: 'string';
            description: 'The scroll parameter to use in the next request to fetch the next page of results.';
            example: '25b649f7-4d33-4ef6-88f5-60e5b8244309';
          };
        };
      };
      contact: {
        title: 'Contact';
        type: 'object';
        'x-tags': ['Contacts'];
        description: 'Contact are the objects that represent your leads and users in Intercom.';
        properties: {
          type: {
            type: 'string';
            description: 'The type of object.';
            example: 'contact';
          };
          id: {
            type: 'string';
            description: 'The unique identifier for the contact which is given by Intercom.';
            example: '5ba682d23d7cf92bef87bfd4';
          };
          external_id: {
            type: 'string';
            nullable: true;
            description: 'The unique identifier for the contact which is provided by the Client.';
            example: 'f3b87a2e09d514c6c2e79b9a';
          };
          workspace_id: {
            type: 'string';
            description: 'The id of the workspace which the contact belongs to.';
            example: 'ecahpwf5';
          };
          role: {
            type: 'string';
            description: 'The role of the contact.';
            example: 'user';
          };
          email: {
            type: 'string';
            description: "The contact's email.";
            example: 'joe@example.com';
          };
          email_domain: {
            type: 'string';
            description: "The contact's email domain.";
            example: 'example.com';
          };
          phone: {
            type: 'string';
            nullable: true;
            description: 'The contacts phone.';
            example: '+1123456789';
          };
          formatted_phone: {
            type: 'string';
            nullable: true;
            description: 'The contacts phone number normalized to the E164 format';
            example: '+1123456789';
          };
          name: {
            type: 'string';
            nullable: true;
            description: 'The contacts name.';
            example: 'John Doe';
          };
          owner_id: {
            type: 'integer';
            nullable: true;
            description: 'The id of an admin that has been assigned account ownership of the contact.';
            example: 123;
          };
          has_hard_bounced: {
            type: 'boolean';
            description: 'Whether the contact has had an email sent to them hard bounce.';
            example: true;
          };
          marked_email_as_spam: {
            type: 'boolean';
            description: 'Whether the contact has marked an email sent to them as spam.';
            example: true;
          };
          unsubscribed_from_emails: {
            type: 'boolean';
            description: 'Whether the contact is unsubscribed from emails.';
            example: true;
          };
          created_at: {
            type: 'integer';
            format: 'date-time';
            description: '(UNIX timestamp) The time when the contact was created.';
            example: 1571672154;
          };
          updated_at: {
            type: 'integer';
            format: 'date-time';
            description: '(UNIX timestamp) The time when the contact was last updated.';
            example: 1571672154;
          };
          signed_up_at: {
            type: 'integer';
            format: 'date-time';
            nullable: true;
            description: '(UNIX timestamp) The time specified for when a contact signed up.';
            example: 1571672154;
          };
          last_seen_at: {
            type: 'integer';
            format: 'date-time';
            nullable: true;
            description: '(UNIX timestamp) The time when the contact was last seen (either where the Intercom Messenger was installed or when specified manually).';
            example: 1571672154;
          };
          last_replied_at: {
            type: 'integer';
            format: 'date-time';
            nullable: true;
            description: '(UNIX timestamp) The time when the contact last messaged in.';
            example: 1571672154;
          };
          last_contacted_at: {
            type: 'integer';
            format: 'date-time';
            nullable: true;
            description: '(UNIX timestamp) The time when the contact was last messaged.';
            example: 1571672154;
          };
          last_email_opened_at: {
            type: 'integer';
            format: 'date-time';
            nullable: true;
            description: '(UNIX timestamp) The time when the contact last opened an email.';
            example: 1571672154;
          };
          last_email_clicked_at: {
            type: 'integer';
            format: 'date-time';
            nullable: true;
            description: '(UNIX timestamp) The time when the contact last clicked a link in an email.';
            example: 1571672154;
          };
          language_override: {
            type: 'string';
            nullable: true;
            description: 'A preferred language setting for the contact, used by the Intercom Messenger even if their browser settings change.';
            example: 'en';
          };
          browser: {
            type: 'string';
            nullable: true;
            description: 'The name of the browser which the contact is using.';
            example: 'Chrome';
          };
          browser_version: {
            type: 'string';
            nullable: true;
            description: 'The version of the browser which the contact is using.';
            example: '80.0.3987.132';
          };
          browser_language: {
            type: 'string';
            nullable: true;
            description: 'The language set by the browser which the contact is using.';
            example: 'en-US';
          };
          os: {
            type: 'string';
            nullable: true;
            description: 'The operating system which the contact is using.';
            example: 'Mac OS X';
          };
          android_app_name: {
            type: 'string';
            nullable: true;
            description: 'The name of the Android app which the contact is using.';
            example: 'Intercom';
          };
          android_app_version: {
            type: 'string';
            nullable: true;
            description: 'The version of the Android app which the contact is using.';
            example: '5.0.0';
          };
          android_device: {
            type: 'string';
            nullable: true;
            description: 'The Android device which the contact is using.';
            example: 'Pixel 3';
          };
          android_os_version: {
            type: 'string';
            nullable: true;
            description: 'The version of the Android OS which the contact is using.';
            example: '10';
          };
          android_sdk_version: {
            type: 'string';
            nullable: true;
            description: 'The version of the Android SDK which the contact is using.';
            example: '28';
          };
          android_last_seen_at: {
            type: 'integer';
            nullable: true;
            format: 'date-time';
            description: '(UNIX timestamp) The time when the contact was last seen on an Android device.';
            example: 1571672154;
          };
          ios_app_name: {
            type: 'string';
            nullable: true;
            description: 'The name of the iOS app which the contact is using.';
            example: 'Intercom';
          };
          ios_app_version: {
            type: 'string';
            nullable: true;
            description: 'The version of the iOS app which the contact is using.';
            example: '5.0.0';
          };
          ios_device: {
            type: 'string';
            nullable: true;
            description: 'The iOS device which the contact is using.';
            example: 'iPhone 11';
          };
          ios_os_version: {
            type: 'string';
            nullable: true;
            description: 'The version of iOS which the contact is using.';
            example: '13.3.1';
          };
          ios_sdk_version: {
            type: 'string';
            nullable: true;
            description: 'The version of the iOS SDK which the contact is using.';
            example: '13.3.1';
          };
          ios_last_seen_at: {
            type: 'integer';
            nullable: true;
            format: 'date-time';
            description: '(UNIX timestamp) The last time the contact used the iOS app.';
            example: 1571672154;
          };
          custom_attributes: {
            type: 'object';
            description: 'The custom attributes which are set for the contact.';
          };
          avatar: {
            type: 'object';
            nullable: true;
            properties: {
              type: {
                type: 'string';
                description: 'The type of object';
                example: 'avatar';
              };
              image_url: {
                type: 'string';
                format: 'uri';
                nullable: true;
                description: 'An image URL containing the avatar of a contact.';
                example: 'https://example.org/128Wash.jpg';
              };
            };
          };
          tags: {
            $ref: '#/components/schemas/contact_tags';
          };
          notes: {
            $ref: '#/components/schemas/contact_notes';
          };
          companies: {
            $ref: '#/components/schemas/contact_companies';
          };
          location: {
            $ref: '#/components/schemas/contact_location';
          };
          social_profiles: {
            $ref: '#/components/schemas/contact_social_profiles';
          };
        };
      };
      contact_archived: {
        title: 'Contact Archived';
        type: 'object';
        description: 'archived contact object';
        properties: {
          type: {
            type: 'string';
            description: 'always contact';
            enum: ['contact'];
            example: 'contact';
          };
          id: {
            type: 'string';
            description: 'The unique identifier for the contact which is given by Intercom.';
            example: '5ba682d23d7cf92bef87bfd4';
          };
          external_id: {
            type: 'string';
            nullable: true;
            description: 'The unique identifier for the contact which is provided by the Client.';
            example: 'f3b87a2e09d514c6c2e79b9a';
          };
          archived: {
            type: 'boolean';
            description: 'Whether the contact is archived or not.';
            example: true;
          };
        };
      };
      contact_attached_companies: {
        title: 'Contact Attached Companies';
        type: 'object';
        description: 'A list of Company Objects';
        properties: {
          type: {
            type: 'string';
            description: 'The type of object';
            enum: ['list'];
            example: 'list';
          };
          companies: {
            type: 'array';
            description: 'An array containing Company Objects';
            items: {
              $ref: '#/components/schemas/company';
            };
          };
          total_count: {
            type: 'integer';
            description: 'The total number of companies associated to this contact';
            example: 100;
          };
          pages: {
            $ref: '#/components/schemas/pages_link';
          };
        };
      };
      contact_companies: {
        title: 'Contact companies';
        type: 'object';
        nullable: false;
        description: 'An object containing companies meta data about the companies that a contact has. Up to 10 will be displayed here. Use the url to get more.';
        properties: {
          url: {
            type: 'string';
            format: 'uri';
            description: 'Url to get more company resources for this contact';
            example: '/contacts/5ba682d23d7cf92bef87bfd4/companies';
          };
          total_count: {
            type: 'integer';
            description: 'Int representing the total number of companyies attached to this contact';
            example: 100;
          };
          has_more: {
            type: 'boolean';
            description: "Whether there's more Addressable Objects to be viewed. If true, use the url to view all";
            example: true;
          };
        };
      };
      contact_deleted: {
        title: 'Contact Deleted';
        type: 'object';
        description: 'deleted contact object';
        properties: {
          type: {
            type: 'string';
            description: 'always contact';
            enum: ['contact'];
            example: 'contact';
          };
          id: {
            type: 'string';
            description: 'The unique identifier for the contact which is given by Intercom.';
            example: '5ba682d23d7cf92bef87bfd4';
          };
          external_id: {
            type: 'string';
            nullable: true;
            description: 'The unique identifier for the contact which is provided by the Client.';
            example: 'f3b87a2e09d514c6c2e79b9a';
          };
          deleted: {
            type: 'boolean';
            description: 'Whether the contact is deleted or not.';
            example: true;
          };
        };
      };
      contact_list: {
        title: 'Contact List';
        type: 'object';
        description: 'Contacts are your users in Intercom.';
        properties: {
          type: {
            type: 'string';
            description: 'Always list';
            enum: ['list'];
            example: 'list';
          };
          data: {
            type: 'array';
            description: 'The list of contact objects';
            items: {
              $ref: '#/components/schemas/contact';
            };
          };
          total_count: {
            type: 'integer';
            description: 'A count of the total number of objects.';
            example: 100;
          };
          pages: {
            $ref: '#/components/schemas/cursor_pages';
          };
        };
      };
      contact_location: {
        title: 'Contact Location';
        type: 'object';
        nullable: false;
        description: 'An object containing location meta data about a Intercom contact.';
        properties: {
          type: {
            type: 'string';
            nullable: true;
            description: 'Always location';
            example: 'location';
          };
          country: {
            type: 'string';
            nullable: true;
            description: 'The country that the contact is located in';
            example: 'Ireland';
          };
          region: {
            type: 'string';
            nullable: true;
            description: 'The overal region that the contact is located in';
            example: 'Dublin';
          };
          city: {
            type: 'string';
            nullable: true;
            description: 'The city that the contact is located in';
            example: 'Dublin';
          };
        };
      };
      contact_notes: {
        title: 'Contact notes';
        type: 'object';
        nullable: false;
        description: 'An object containing notes meta data about the notes that a contact has. Up to 10 will be displayed here. Use the url to get more.';
        properties: {
          data: {
            type: 'array';
            description: 'This object represents the notes attached to a contact.';
            items: {
              $ref: '#/components/schemas/addressable_list';
            };
          };
          url: {
            type: 'string';
            format: 'uri';
            description: 'Url to get more company resources for this contact';
            example: '/contacts/5ba682d23d7cf92bef87bfd4/notes';
          };
          total_count: {
            type: 'integer';
            description: 'Int representing the total number of companyies attached to this contact';
            example: 100;
          };
          has_more: {
            type: 'boolean';
            description: "Whether there's more Addressable Objects to be viewed. If true, use the url to view all";
            example: true;
          };
        };
      };
      contact_reference: {
        title: 'Contact Reference';
        type: 'object';
        description: 'reference to contact object';
        properties: {
          type: {
            type: 'string';
            description: 'always contact';
            enum: ['contact'];
            example: 'contact';
          };
          id: {
            type: 'string';
            description: 'The unique identifier for the contact which is given by Intercom.';
            example: '5ba682d23d7cf92bef87bfd4';
          };
          external_id: {
            type: 'string';
            nullable: true;
            description: 'The unique identifier for the contact which is provided by the Client.';
            example: 'f3b87a2e09d514c6c2e79b9a';
          };
        };
      };
      contact_reply_base_request: {
        title: 'Contact Reply Base Object';
        type: 'object';
        properties: {
          message_type: {
            type: 'string';
            enum: ['comment'];
          };
          type: {
            type: 'string';
            enum: ['user'];
          };
          body: {
            type: 'string';
            description: 'The text body of the comment.';
          };
          attachment_urls: {
            title: 'Attachment URLs';
            type: 'array';
            description: 'A list of image URLs that will be added as attachments. You can include up to 10 URLs.';
            items: {
              type: 'string';
              format: 'uri';
            };
            maxItems: 10;
          };
        };
        required: ['message_type', 'type', 'body'];
      };
      contact_reply_conversation_request: {
        title: 'Contact Reply';
        oneOf: [
          {
            $ref: '#/components/schemas/contact_reply_intercom_user_id_request';
          },
          {
            $ref: '#/components/schemas/contact_reply_email_request';
          },
          {
            $ref: '#/components/schemas/contact_reply_user_id_request';
          },
        ];
      };
      contact_reply_email_request: {
        title: 'Email';
        type: 'object';
        description: 'Payload of the request to reply on behalf of a contact using their `email`';
        properties: {
          email: {
            type: 'string';
            description: 'The email you have defined for the user.';
          };
          attachment_files: {
            type: 'array';
            description: 'A list of files that will be added as attachments.';
            items: {
              $ref: '#/components/schemas/conversation_attachment_files';
            };
          };
        };
        allOf: [
          {
            $ref: '#/components/schemas/contact_reply_base_request';
          },
        ];
        required: ['email'];
      };
      contact_reply_intercom_user_id_request: {
        title: 'Intercom User ID';
        type: 'object';
        description: 'Payload of the request to reply on behalf of a contact using their `intercom_user_id`';
        allOf: [
          {
            $ref: '#/components/schemas/contact_reply_base_request';
          },
        ];
        properties: {
          intercom_user_id: {
            type: 'string';
            description: 'The identifier for the contact as given by Intercom.';
          };
          attachment_files: {
            type: 'array';
            description: 'A list of files that will be added as attachments.';
            items: {
              $ref: '#/components/schemas/conversation_attachment_files';
            };
          };
        };
        required: ['intercom_user_id'];
      };
      contact_reply_ticket_email_request: {
        title: 'Email';
        type: 'object';
        description: 'Payload of the request to reply on behalf of a contact using their `email`';
        properties: {
          email: {
            type: 'string';
            description: 'The email you have defined for the user.';
          };
        };
        allOf: [
          {
            $ref: '#/components/schemas/contact_reply_base_request';
          },
        ];
        required: ['email'];
      };
      contact_reply_ticket_intercom_user_id_request: {
        title: 'Intercom User ID';
        type: 'object';
        description: 'Payload of the request to reply on behalf of a contact using their `intercom_user_id`';
        allOf: [
          {
            $ref: '#/components/schemas/contact_reply_base_request';
          },
        ];
        properties: {
          intercom_user_id: {
            type: 'string';
            description: 'The identifier for the contact as given by Intercom.';
          };
        };
        required: ['intercom_user_id'];
      };
      contact_reply_ticket_user_id_request: {
        title: 'User ID';
        type: 'object';
        description: 'Payload of the request to reply on behalf of a contact using their `user_id`';
        allOf: [
          {
            $ref: '#/components/schemas/contact_reply_base_request';
          },
        ];
        properties: {
          user_id: {
            type: 'string';
            description: 'The external_id you have defined for the contact.';
          };
        };
        required: ['user_id'];
      };
      contact_reply_user_id_request: {
        title: 'User ID';
        type: 'object';
        description: 'Payload of the request to reply on behalf of a contact using their `user_id`';
        allOf: [
          {
            $ref: '#/components/schemas/contact_reply_base_request';
          },
        ];
        properties: {
          user_id: {
            type: 'string';
            description: 'The external_id you have defined for the contact.';
          };
          attachment_files: {
            type: 'array';
            description: 'A list of files that will be added as attachments. You can include up to 10 files.';
            items: {
              $ref: '#/components/schemas/conversation_attachment_files';
            };
            maxItems: 10;
          };
        };
        required: ['user_id'];
      };
      contact_segments: {
        title: 'Segments';
        type: 'object';
        description: 'A list of segments objects attached to a specific contact.';
        properties: {
          type: {
            type: 'string';
            description: 'The type of the object';
            enum: ['list'];
            example: 'list';
          };
          data: {
            type: 'array';
            description: 'Segment objects associated with the contact.';
            items: {
              $ref: '#/components/schemas/segment';
            };
          };
        };
      };
      contact_social_profiles: {
        title: 'Social Profile';
        type: 'object';
        nullable: false;
        description: 'An object containing social profiles that a contact has.';
        properties: {
          data: {
            type: 'array';
            description: 'A list of social profiles objects associated with the contact.';
            items: {
              $ref: '#/components/schemas/social_profile';
            };
          };
        };
      };
      contact_subscription_types: {
        title: 'Contact Subscription Types';
        type: 'object';
        nullable: false;
        description: 'An object containing Subscription Types meta data about the SubscriptionTypes that a contact has.';
        properties: {
          data: {
            type: 'array';
            description: 'This object represents the subscriptions attached to a contact.';
            items: {
              $ref: '#/components/schemas/addressable_list';
            };
          };
          url: {
            type: 'string';
            format: 'uri';
            description: 'Url to get more subscription type resources for this contact';
            example: '/contacts/5ba682d23d7cf92bef87bfd4/subscriptions';
          };
          total_count: {
            type: 'integer';
            description: 'Int representing the total number of subscription types attached to this contact';
            example: 100;
          };
          has_more: {
            type: 'boolean';
            description: "Whether there's more Addressable Objects to be viewed. If true, use the url to view all";
            example: true;
          };
        };
      };
      contact_tags: {
        title: 'Contact Tags';
        type: 'object';
        nullable: true;
        description: 'An object containing tags meta data about the tags that a contact has. Up to 10 will be displayed here. Use the url to get more.';
        properties: {
          data: {
            type: 'array';
            description: 'This object represents the tags attached to a contact.';
            items: {
              $ref: '#/components/schemas/addressable_list';
            };
          };
          url: {
            type: 'string';
            format: 'uri';
            description: 'url to get more tag resources for this contact';
            example: '/contacts/5ba682d23d7cf92bef87bfd4/tags';
          };
          total_count: {
            type: 'integer';
            description: 'Int representing the total number of tags attached to this contact';
            example: 100;
          };
          has_more: {
            type: 'boolean';
            description: "Whether there's more Addressable Objects to be viewed. If true, use the url to view all";
            example: true;
          };
        };
      };
      contact_unarchived: {
        title: 'Contact Unarchived';
        type: 'object';
        description: 'unarchived contact object';
        properties: {
          type: {
            type: 'string';
            description: 'always contact';
            enum: ['contact'];
            example: 'contact';
          };
          id: {
            type: 'string';
            description: 'The unique identifier for the contact which is given by Intercom.';
            example: '5ba682d23d7cf92bef87bfd4';
          };
          external_id: {
            type: 'string';
            nullable: true;
            description: 'The unique identifier for the contact which is provided by the Client.';
            example: 'f3b87a2e09d514c6c2e79b9a';
          };
          archived: {
            type: 'boolean';
            description: 'Whether the contact is archived or not.';
            example: false;
          };
        };
      };
      conversation: {
        title: 'Conversation';
        type: 'object';
        'x-tags': ['Conversations'];
        description: 'Conversations are how you can communicate with users in Intercom. They are created when a contact replies to an outbound message, or when one admin directly sends a message to a single contact.';
        properties: {
          type: {
            type: 'string';
            description: 'Always conversation.';
            example: 'conversation';
          };
          id: {
            type: 'string';
            description: 'The id representing the conversation.';
            example: '1295';
          };
          title: {
            type: 'string';
            nullable: true;
            description: 'The title given to the conversation.';
            example: 'Conversation Title';
          };
          created_at: {
            type: 'integer';
            format: 'date-time';
            description: 'The time the conversation was created.';
            example: 1663597223;
          };
          updated_at: {
            type: 'integer';
            format: 'date-time';
            description: 'The last time the conversation was updated.';
            example: 1663597260;
          };
          waiting_since: {
            type: 'integer';
            format: 'date-time';
            nullable: true;
            description: 'The last time a Contact responded to an Admin. In other words, the time a customer started waiting for a response. Set to null if last reply is from an Admin.';
            example: 1663597260;
          };
          snoozed_until: {
            type: 'integer';
            format: 'date-time';
            nullable: true;
            description: 'If set this is the time in the future when this conversation will be marked as open. i.e. it will be in a snoozed state until this time. i.e. it will be in a snoozed state until this time.';
            example: 1663597260;
          };
          open: {
            type: 'boolean';
            description: 'Indicates whether a conversation is open (true) or closed (false).';
            example: true;
          };
          state: {
            type: 'string';
            enum: ['open', 'closed', 'snoozed'];
            description: 'Can be set to "open", "closed" or "snoozed".';
            example: 'open';
          };
          read: {
            type: 'boolean';
            description: 'Indicates whether a conversation has been read.';
            example: true;
          };
          priority: {
            type: 'string';
            enum: ['priority', 'not_priority'];
            description: 'If marked as priority, it will return priority or else not_priority.';
            example: 'priority';
          };
          admin_assignee_id: {
            type: 'integer';
            nullable: true;
            description: "The id of the admin assigned to the conversation. If it's not assigned to an admin it will return null.";
            example: 0;
          };
          team_assignee_id: {
            type: 'string';
            nullable: true;
            description: "The id of the team assigned to the conversation. If it's not assigned to a team it will return null.";
            example: '5017691';
          };
          tags: {
            $ref: '#/components/schemas/tags';
          };
          conversation_rating: {
            $ref: '#/components/schemas/conversation_rating';
          };
          source: {
            $ref: '#/components/schemas/conversation_source';
          };
          contacts: {
            $ref: '#/components/schemas/conversation_contacts';
          };
          teammates: {
            $ref: '#/components/schemas/conversation_teammates';
          };
          custom_attributes: {
            $ref: '#/components/schemas/custom_attributes';
          };
          first_contact_reply: {
            $ref: '#/components/schemas/conversation_first_contact_reply';
          };
          sla_applied: {
            $ref: '#/components/schemas/sla_applied';
          };
          statistics: {
            $ref: '#/components/schemas/conversation_statistics';
          };
          conversation_parts: {
            $ref: '#/components/schemas/conversation_parts';
          };
        };
      };
      conversation_attachment_files: {
        title: 'Conversation attachment files';
        type: 'object';
        description: 'Properties of the attachment files in a conversation part';
        properties: {
          content_type: {
            type: 'string';
            description: 'The content type of the file';
            example: 'application/json';
          };
          data: {
            type: 'string';
            description: 'The base64 encoded file data.';
            example: 'ewogICJ0ZXN0IjogMQp9';
          };
          name: {
            type: 'string';
            description: 'The name of the file.';
            example: 'test.json';
          };
        };
      };
      conversation_contacts: {
        title: 'Contacts';
        type: 'object';
        description: 'The list of contacts (users or leads) involved in this conversation. This will only contain one customer unless more were added via the group conversation feature.';
        properties: {
          type: {
            type: 'string';
            description: '';
            enum: ['contact.list'];
            example: 'contact.list';
          };
          contacts: {
            type: 'array';
            description: 'The list of contacts (users or leads) involved in this conversation. This will only contain one customer unless more were added via the group conversation feature.';
            items: {
              $ref: '#/components/schemas/contact_reference';
            };
          };
        };
      };
      conversation_first_contact_reply: {
        title: 'First contact reply';
        type: 'object';
        nullable: true;
        description: 'An object containing information on the first users message. For a contact initiated message this will represent the users original message.';
        properties: {
          created_at: {
            type: 'integer';
            format: 'date-time';
            description: '';
            example: 1663597223;
          };
          type: {
            type: 'string';
            description: '';
            example: 'conversation';
          };
          url: {
            type: 'string';
            nullable: true;
            description: '';
            example: 'https://developers.intercom.com/';
          };
        };
      };
      conversation_list: {
        title: 'Conversation List';
        type: 'object';
        description: 'Conversations are how you can communicate with users in Intercom. They are created when a contact replies to an outbound message, or when one admin directly sends a message to a single contact.';
        properties: {
          type: {
            type: 'string';
            description: 'Always conversation.list';
            enum: ['conversation.list'];
            example: 'conversation.list';
          };
          conversations: {
            type: 'array';
            description: 'The list of conversation objects';
            items: {
              $ref: '#/components/schemas/conversation';
            };
          };
          total_count: {
            type: 'integer';
            description: 'A count of the total number of objects.';
            example: 12345;
          };
          pages: {
            $ref: '#/components/schemas/cursor_pages';
          };
        };
      };
      conversation_part: {
        title: 'Conversation Part';
        type: 'object';
        description: 'A Conversation Part represents a message in the conversation.';
        properties: {
          type: {
            type: 'string';
            description: 'Always conversation_part';
            example: 'conversation_part';
          };
          id: {
            type: 'string';
            description: 'The id representing the conversation part.';
            example: '3';
          };
          part_type: {
            type: 'string';
            description: 'The type of conversation part.';
            example: 'comment';
          };
          body: {
            type: 'string';
            nullable: true;
            description: 'The message body, which may contain HTML. For Twitter, this will show a generic message regarding why the body is obscured.';
            example: '<p>Okay!</p>';
          };
          created_at: {
            type: 'integer';
            format: 'date-time';
            description: 'The time the conversation part was created.';
            example: 1663597223;
          };
          updated_at: {
            type: 'integer';
            format: 'date-time';
            description: 'The last time the conversation part was updated.';
            example: 1663597260;
          };
          notified_at: {
            type: 'integer';
            format: 'date-time';
            description: 'The time the user was notified with the conversation part.';
            example: 1663597260;
          };
          assigned_to: {
            $ref: '#/components/schemas/reference';
            nullable: true;
            description: 'The id of the admin that was assigned the conversation by this conversation_part (null if there has been no change in assignment.)';
          };
          author: {
            $ref: '#/components/schemas/conversation_part_author';
          };
          attachments: {
            title: 'Conversation part attachments';
            type: 'array';
            description: 'A list of attachments for the part.';
            items: {
              $ref: '#/components/schemas/part_attachment';
            };
          };
          external_id: {
            type: 'string';
            nullable: true;
            description: 'The external id of the conversation part';
            example: 'abcd1234';
          };
          redacted: {
            type: 'boolean';
            description: 'Whether or not the conversation part has been redacted.';
            example: false;
          };
        };
      };
      conversation_part_author: {
        title: 'Conversation part author';
        type: 'object';
        description: 'The object who initiated the conversation, which can be a Contact, Admin or Team. Bots and campaigns send messages on behalf of Admins or Teams. For Twitter, this will be blank.';
        properties: {
          type: {
            type: 'string';
            description: 'The type of the author';
            example: 'admin';
          };
          id: {
            type: 'string';
            description: 'The id of the author';
            example: '274';
          };
          name: {
            type: 'string';
            description: 'The name of the author';
            example: 'Operator';
          };
          email: {
            type: 'string';
            format: 'email';
            description: 'The email of the author';
            example: 'operator+abcd1234@intercom.io';
          };
        };
      };
      conversation_parts: {
        title: 'Conversation Parts';
        type: 'object';
        description: 'A list of Conversation Part objects for each part message in the conversation. This is only returned when Retrieving a Conversation, and ignored when Listing all Conversations. There is a limit of 500 parts.';
        properties: {
          type: {
            type: 'string';
            description: '';
            enum: ['conversation_part.list'];
            example: 'conversation_part.list';
          };
          conversation_parts: {
            title: 'Conversation Parts';
            type: 'array';
            description: 'A list of Conversation Part objects for each part message in the conversation. This is only returned when Retrieving a Conversation, and ignored when Listing all Conversations. There is a limit of 500 parts.';
            items: {
              $ref: '#/components/schemas/conversation_part';
            };
          };
          total_count: {
            type: 'integer';
            description: '';
            example: 2;
          };
        };
      };
      conversation_rating: {
        title: 'Conversation Rating';
        type: 'object';
        nullable: true;
        description: 'The Conversation Rating object which contains information on the rating and/or remark added by a Contact and the Admin assigned to the conversation.';
        properties: {
          rating: {
            type: 'integer';
            description: 'The rating, between 1 and 5, for the conversation.';
            example: 5;
          };
          remark: {
            type: 'string';
            description: 'An optional field to add a remark to correspond to the number rating';
            example: '';
          };
          created_at: {
            type: 'integer';
            format: 'date-time';
            description: 'The time the rating was requested in the conversation being rated.';
            example: 1671028894;
          };
          contact: {
            $ref: '#/components/schemas/contact_reference';
          };
          teammate: {
            $ref: '#/components/schemas/reference';
          };
        };
      };
      conversation_source: {
        title: 'Conversation source';
        type: 'object';
        description: 'The Conversation Part that originated this conversation, which can be Contact, Admin, Campaign, Automated or Operator initiated.';
        properties: {
          type: {
            type: 'string';
            description: 'This includes conversation, email, facebook, instagram, phone_call, phone_switch, push, sms, twitter and whatsapp.';
            example: 'conversation';
          };
          id: {
            type: 'string';
            description: 'The id representing the message.';
            example: '3';
          };
          delivered_as: {
            type: 'string';
            description: "The conversation's initiation type. Possible values are customer_initiated, campaigns_initiated (legacy campaigns), operator_initiated (Custom bot), automated (Series and other outbounds with dynamic audience message) and admin_initiated (fixed audience message, ticket initiated by an admin, group email).";
            example: 'operator_initiated';
          };
          subject: {
            type: 'string';
            description: 'Optional. The message subject. For Twitter, this will show a generic message regarding why the subject is obscured.';
            example: '';
          };
          body: {
            type: 'string';
            description: 'The message body, which may contain HTML. For Twitter, this will show a generic message regarding why the body is obscured.';
            example: '<p>Hey there!</p>';
          };
          author: {
            $ref: '#/components/schemas/conversation_part_author';
          };
          attachments: {
            type: 'array';
            description: 'A list of attachments for the part.';
            items: {
              $ref: '#/components/schemas/part_attachment';
            };
          };
          url: {
            type: 'string';
            nullable: true;
            description: 'The URL where the conversation was started. For Twitter, Email, and Bots, this will be blank.';
            example: null;
          };
          redacted: {
            type: 'boolean';
            description: 'Whether or not the source message has been redacted. Only applicable for contact initiated messages.';
            example: false;
          };
        };
      };
      conversation_statistics: {
        title: 'Conversation statistics';
        type: 'object';
        nullable: true;
        description: 'A Statistics object containing all information required for reporting, with timestamps and calculated metrics.';
        properties: {
          type: {
            type: 'string';
            description: '';
            example: 'conversation_statistics';
          };
          time_to_assignment: {
            type: 'integer';
            description: 'Duration until last assignment before first admin reply. In seconds.';
            example: 2310;
          };
          time_to_admin_reply: {
            type: 'integer';
            description: 'Duration until first admin reply. Subtracts out of business hours. In seconds.';
            example: 2310;
          };
          time_to_first_close: {
            type: 'integer';
            description: 'Duration until conversation was closed first time. Subtracts out of business hours. In seconds.';
            example: 2310;
          };
          time_to_last_close: {
            type: 'integer';
            description: 'Duration until conversation was closed last time. Subtracts out of business hours. In seconds.';
            example: 2310;
          };
          median_time_to_reply: {
            type: 'integer';
            description: 'Median based on all admin replies after a contact reply. Subtracts out of business hours. In seconds.';
            example: 2310;
          };
          first_contact_reply_at: {
            type: 'integer';
            format: 'date-time';
            description: 'Time of first text conversation part from a contact.';
            example: 1663597233;
          };
          first_assignment_at: {
            type: 'integer';
            format: 'date-time';
            description: 'Time of first assignment after first_contact_reply_at.';
            example: 1663597233;
          };
          first_admin_reply_at: {
            type: 'integer';
            format: 'date-time';
            description: 'Time of first admin reply after first_contact_reply_at.';
            example: 1663597233;
          };
          first_close_at: {
            type: 'integer';
            format: 'date-time';
            description: 'Time of first close after first_contact_reply_at.';
            example: 1663597233;
          };
          last_assignment_at: {
            type: 'integer';
            format: 'date-time';
            description: 'Time of last assignment after first_contact_reply_at.';
            example: 1663597233;
          };
          last_assignment_admin_reply_at: {
            type: 'integer';
            format: 'date-time';
            description: 'Time of first admin reply since most recent assignment.';
            example: 1663597233;
          };
          last_contact_reply_at: {
            type: 'integer';
            format: 'date-time';
            description: 'Time of the last conversation part from a contact.';
            example: 1663597233;
          };
          last_admin_reply_at: {
            type: 'integer';
            format: 'date-time';
            description: 'Time of the last conversation part from an admin.';
            example: 1663597233;
          };
          last_close_at: {
            type: 'integer';
            format: 'date-time';
            description: 'Time of the last conversation close.';
            example: 1663597233;
          };
          last_closed_by_id: {
            type: 'string';
            description: 'The last admin who closed the conversation. Returns a reference to an Admin object.';
            example: 'c3po';
          };
          count_reopens: {
            type: 'integer';
            description: 'Number of reopens after first_contact_reply_at.';
            example: 1;
          };
          count_assignments: {
            type: 'integer';
            description: 'Number of assignments after first_contact_reply_at.';
            example: 1;
          };
          count_conversation_parts: {
            type: 'integer';
            description: 'Total number of conversation parts.';
            example: 1;
          };
        };
      };
      conversation_teammates: {
        title: 'Conversation teammates';
        type: 'object';
        nullable: true;
        description: 'The list of teammates who participated in the conversation (wrote at least one conversation part).';
        properties: {
          type: {
            type: 'string';
            description: 'The type of the object - `admin.list`.';
            example: 'admin.list';
          };
          teammates: {
            type: 'array';
            description: 'The list of teammates who participated in the conversation (wrote at least one conversation part).';
            items: {
              $ref: '#/components/schemas/reference';
            };
          };
        };
      };
      convert_visitor_request: {
        description: 'You can merge a Visitor to a Contact of role type lead or user.';
        type: 'object';
        title: 'Convert Visitor Request Payload';
        properties: {
          type: {
            type: 'string';
            description: 'Represents the role of the Contact model. Accepts `lead` or `user`.';
            example: 'user';
          };
          user: {
            type: 'object';
            description: 'The unique identifiers retained after converting or merging.';
            properties: {
              id: {
                type: 'string';
                description: 'The unique identifier for the contact which is given by Intercom.';
                example: '8a88a590-e1c3-41e2-a502-e0649dbf721c';
              };
              user_id: {
                type: 'string';
                description: 'A unique identifier for the contact which is given to Intercom, which will be represented as external_id.';
                example: '8a88a590-e1c3-41e2-a502-e0649dbf721c';
              };
              email: {
                type: 'string';
                description: "The contact's email, retained by default if one is present.";
                example: 'winstonsmith@truth.org';
              };
            };
            anyOf: [
              {
                required: ['id'];
              },
              {
                required: ['user_id'];
              },
            ];
          };
          visitor: {
            type: 'object';
            description: 'The unique identifiers to convert a single Visitor.';
            properties: {
              id: {
                type: 'string';
                description: 'The unique identifier for the contact which is given by Intercom.';
                example: '8a88a590-e1c3-41e2-a502-e0649dbf721c';
              };
              user_id: {
                type: 'string';
                description: 'A unique identifier for the contact which is given to Intercom.';
                example: '8a88a590-e1c3-41e2-a502-e0649dbf721c';
              };
              email: {
                type: 'string';
                description: "The visitor's email.";
                example: 'winstonsmith@truth.org';
              };
            };
            anyOf: [
              {
                required: ['id'];
              },
              {
                required: ['user_id'];
              },
              {
                required: ['email'];
              },
            ];
          };
        };
        required: ['type', 'user', 'visitor'];
      };
      create_article_request: {
        description: 'You can create an Article';
        type: 'object';
        title: 'Create Article Request Payload';
        nullable: true;
        properties: {
          title: {
            type: 'string';
            description: "The title of the article.For multilingual articles, this will be the title of the default language's content.";
            example: 'Thanks for everything';
          };
          description: {
            type: 'string';
            description: "The description of the article. For multilingual articles, this will be the description of the default language's content.";
            example: 'Description of the Article';
          };
          body: {
            type: 'string';
            description: "The content of the article. For multilingual articles, this will be the body of the default language's content.";
            example: '<p>This is the body in html</p>';
          };
          author_id: {
            type: 'integer';
            description: "The id of the author of the article. For multilingual articles, this will be the id of the author of the default language's content. Must be a teammate on the help center's workspace.";
            example: 1295;
          };
          state: {
            type: 'string';
            description: "Whether the article will be `published` or will be a `draft`. Defaults to draft. For multilingual articles, this will be the state of the default language's content.";
            enum: ['published', 'draft'];
            example: 'draft';
          };
          parent_id: {
            type: 'integer';
            description: "The id of the article's parent collection or section. An article without this field stands alone.";
            example: 18;
          };
          parent_type: {
            type: 'string';
            description: 'The type of parent, which can either be a `collection` or `section`.';
            example: 'collection';
          };
          translated_content: {
            $ref: '#/components/schemas/article_translated_content';
          };
        };
        required: ['title', 'author_id'];
      };
      create_collection_request: {
        description: 'You can create a collection';
        type: 'object';
        title: 'Create Collection Request Payload';
        properties: {
          name: {
            type: 'string';
            description: "The name of the collection. For multilingual collections, this will be the name of the default language's content.";
            example: 'collection 51';
          };
          description: {
            type: 'string';
            description: "The description of the collection. For multilingual collections, this will be the description of the default language's content.";
            example: 'English description';
          };
          translated_content: {
            nullable: true;
            $ref: '#/components/schemas/group_translated_content';
          };
          help_center_id: {
            type: 'integer';
            nullable: true;
            description: 'The id of the help center where the collection will be created. If `null` then it will be created in the default help center.';
            example: '123';
          };
        };
        required: ['name'];
      };
      create_contact_request: {
        description: 'Payload to create a contact';
        type: 'object';
        title: 'Create Contact Request Payload';
        properties: {
          role: {
            type: 'string';
            description: 'The role of the contact.';
          };
          external_id: {
            type: 'string';
            description: 'A unique identifier for the contact which is given to Intercom';
          };
          email: {
            type: 'string';
            description: 'The contacts email';
            example: 'jdoe@example.com';
          };
          phone: {
            type: 'string';
            nullable: true;
            description: 'The contacts phone';
            example: '+353871234567';
          };
          name: {
            type: 'string';
            nullable: true;
            description: 'The contacts name';
            example: 'John Doe';
          };
          avatar: {
            type: 'string';
            nullable: true;
            description: 'An image URL containing the avatar of a contact';
            example: 'https://www.example.com/avatar_image.jpg';
          };
          signed_up_at: {
            type: 'integer';
            format: 'date-time';
            nullable: true;
            description: 'The time specified for when a contact signed up';
            example: 1571672154;
          };
          last_seen_at: {
            type: 'integer';
            format: 'date-time';
            nullable: true;
            description: 'The time when the contact was last seen (either where the Intercom Messenger was installed or when specified manually)';
            example: 1571672154;
          };
          owner_id: {
            type: 'integer';
            nullable: true;
            description: 'The id of an admin that has been assigned account ownership of the contact';
            example: 123;
          };
          unsubscribed_from_emails: {
            type: 'boolean';
            nullable: true;
            description: 'Whether the contact is unsubscribed from emails';
            example: true;
          };
          custom_attributes: {
            type: 'object';
            nullable: true;
            description: 'The custom attributes which are set for the contact';
          };
        };
        anyOf: [
          {
            required: ['email'];
            title: 'Create contact with email';
          },
          {
            required: ['external_id'];
            title: 'Create contact with external_id';
          },
          {
            required: ['role'];
            title: 'Create contact with role';
          },
        ];
      };
      create_conversation_request: {
        description: 'Conversations are how you can communicate with users in Intercom. They are created when a contact replies to an outbound message, or when one admin directly sends a message to a single contact.';
        type: 'object';
        title: 'Create Conversation Request Payload';
        properties: {
          from: {
            type: 'object';
            properties: {
              type: {
                type: 'string';
                enum: ['lead', 'user', 'contact'];
                description: 'The role associated to the contact - user or lead.';
                example: 'user';
              };
              id: {
                type: 'string';
                description: 'The identifier for the contact which is given by Intercom.';
                format: 'uuid';
                minLength: 24;
                maxLength: 24;
                example: '536e564f316c83104c000020';
              };
            };
            required: ['type', 'id'];
          };
          body: {
            type: 'string';
            description: 'The content of the message. HTML is not supported.';
            example: 'Hello';
          };
        };
        required: ['from', 'body'];
      };
      create_data_attribute_request: {
        description: '';
        type: 'object';
        title: 'Create Data Attribute Request';
        properties: {
          name: {
            type: 'string';
            description: 'The name of the data attribute.';
            example: 'My Data Attribute';
          };
          model: {
            type: 'string';
            description: 'The model that the data attribute belongs to.';
            enum: ['contact', 'company'];
            example: 'contact';
          };
          data_type: {
            type: 'string';
            description: 'The type of data stored for this attribute.';
            enum: ['string', 'integer', 'float', 'boolean', 'datetime', 'date'];
            example: 'string';
          };
          description: {
            type: 'string';
            description: 'The readable description you see in the UI for the attribute.';
            example: 'My Data Attribute Description';
          };
          options: {
            type: 'array';
            description: 'To create list attributes. Provide a set of hashes with `value` as the key of the options you want to make. `data_type` must be `string`.';
            items: {
              type: 'string';
            };
            example: ['option1', 'option2'];
          };
          messenger_writable: {
            type: 'boolean';
            description: 'Can this attribute be updated by the Messenger';
            example: false;
          };
        };
        required: ['name', 'model', 'data_type'];
      };
      create_data_event_request: {
        description: '';
        type: 'object';
        title: 'Create Data Event Request';
        properties: {
          event_name: {
            type: 'string';
            description: "The name of the event that occurred. This is presented to your App's admins when filtering and creating segments - a good event name is typically a past tense 'verb-noun' combination, to improve readability, for example `updated-plan`.";
            example: 'invited-friend';
          };
          created_at: {
            type: 'integer';
            format: 'date-time';
            description: 'The time the event occurred as a UTC Unix timestamp';
            example: 1671028894;
          };
          user_id: {
            type: 'string';
            description: 'Your identifier for the user.';
            example: '314159';
          };
          id: {
            type: 'string';
            description: 'The unique identifier for the contact (lead or user) which is given by Intercom.';
            example: '8a88a590-e1c3-41e2-a502-e0649dbf721c';
          };
          email: {
            type: 'string';
            description: 'An email address for your user. An email should only be used where your application uses email to uniquely identify users.';
            example: 'frodo.baggins@example.com';
          };
          metadata: {
            type: 'object';
            description: 'Optional metadata about the event.';
            additionalProperties: {
              type: 'string';
            };
            example: {
              invite_code: 'ADDAFRIEND';
            };
          };
        };
        anyOf: [
          {
            title: 'id required';
            required: ['event_name', 'created_at', 'id'];
          },
          {
            title: 'user_id required';
            required: ['event_name', 'created_at', 'user_id'];
          },
          {
            title: 'email required';
            required: ['event_name', 'created_at', 'email'];
          },
        ];
      };
      create_data_event_summaries_request: {
        description: 'You can send a list of event summaries for a user. Each event summary should contain the event name, the time the event occurred, and the number of times the event occurred. The event name should be a past tense "verb-noun" combination, to improve readability, for example `updated-plan`.';
        type: 'object';
        title: 'Create Data Event Summaries Request';
        properties: {
          user_id: {
            type: 'string';
            description: 'Your identifier for the user.';
            example: '314159';
          };
          event_summaries: {
            type: 'object';
            description: "A list of event summaries for the user. Each event summary should contain the event name, the time the event occurred, and the number of times the event occurred. The event name should be a past tense 'verb-noun' combination, to improve readability, for example `updated-plan`.";
            properties: {
              event_name: {
                type: 'string';
                description: "The name of the event that occurred. A good event name is typically a past tense 'verb-noun' combination, to improve readability, for example `updated-plan`.";
                example: 'invited-friend';
              };
              count: {
                type: 'integer';
                description: 'The number of times the event occurred.';
                example: 1;
              };
              first: {
                type: 'integer';
                format: 'date-time';
                description: 'The first time the event was sent';
                example: 1671028894;
              };
              last: {
                type: 'integer';
                format: 'date-time';
                description: 'The last time the event was sent';
                example: 1671028894;
              };
            };
          };
        };
      };
      create_data_exports_request: {
        description: 'Request for creating a data export';
        type: 'object';
        title: 'Create Data Export Request';
        properties: {
          created_at_after: {
            type: 'integer';
            description: 'The start date that you request data for. It must be formatted as a unix timestamp.';
            example: 1527811200;
          };
          created_at_before: {
            type: 'integer';
            description: 'The end date that you request data for. It must be formatted as a unix timestamp.';
            example: 1527811200;
          };
        };
        required: ['created_at_after', 'created_at_before'];
      };
      create_message_request: {
        description: 'You can create a message';
        type: 'object';
        title: 'Create Message Request Payload';
        nullable: true;
        properties: {
          message_type: {
            type: 'string';
            description: 'The kind of message being created. Values: `in_app` or `email`.';
            enum: ['in_app', 'email'];
            example: 'in_app';
          };
          subject: {
            type: 'string';
            description: 'The title of the email.';
            example: 'Thanks for everything';
          };
          body: {
            type: 'string';
            description: 'The content of the message. HTML and plaintext are supported.';
            example: 'Hello there';
          };
          template: {
            type: 'string';
            description: 'The style of the outgoing message. Possible values `plain` or `personal`.';
            example: 'plain';
          };
          from: {
            type: 'object';
            description: 'The sender of the message. If not provided, the default sender will be used.';
            properties: {
              type: {
                type: 'string';
                description: 'Always `admin`.';
                enum: ['admin'];
                example: 'admin';
              };
              id: {
                type: 'integer';
                description: 'The identifier for the admin which is given by Intercom.';
                example: 394051;
              };
            };
            required: ['type', 'id'];
          };
          to: {
            type: 'object';
            description: 'The sender of the message. If not provided, the default sender will be used.';
            properties: {
              type: {
                type: 'string';
                description: 'The role associated to the contact - `user` or `lead`.';
                enum: ['user', 'lead'];
                example: 'user';
              };
              id: {
                type: 'string';
                description: 'The identifier for the contact which is given by Intercom.';
                example: '536e564f316c83104c000020';
              };
            };
            required: ['type', 'id'];
          };
          create_conversation_without_contact_reply: {
            type: 'boolean';
            description: 'Whether a conversation should be opened in the inbox for the message without the contact replying. Defaults to false if not provided.';
            default: false;
            example: true;
          };
        };
        anyOf: [
          {
            title: 'message_type: `email`.';
            required: ['message_type', 'subject', 'body', 'template', 'from', 'to'];
          },
          {
            title: 'message_type: `inapp`.';
            required: ['message_type', 'body', 'from', 'to'];
          },
        ];
      };
      create_or_update_company_request: {
        type: 'object';
        title: 'Create Or Update Company Request Payload';
        description: 'You can create or update a Company';
        nullable: true;
        properties: {
          name: {
            type: 'string';
            description: 'The name of the Company';
            example: 'Intercom';
          };
          company_id: {
            type: 'string';
            description: "The company id you have defined for the company. Can't be updated";
            example: '625e90fc55ab113b6d92175f';
          };
          plan: {
            type: 'string';
            description: 'The name of the plan you have associated with the company.';
            example: 'Enterprise';
          };
          size: {
            type: 'integer';
            description: 'The number of employees in this company.';
            example: '100';
          };
          website: {
            type: 'string';
            description: "The URL for this company's website. Please note that the value specified here is not validated. Accepts any string.";
            example: 'https://www.example.com';
          };
          industry: {
            type: 'string';
            description: 'The industry that this company operates in.';
            example: 'Manufacturing';
          };
          custom_attributes: {
            type: 'object';
            description: 'A hash of key/value pairs containing any other data about the company you want Intercom to store.';
            additionalProperties: {
              type: 'string';
            };
            example: {
              paid_subscriber: true;
              monthly_spend: 155.5;
              team_mates: 9;
            };
          };
          remote_created_at: {
            type: 'integer';
            description: 'The time the company was created by you.';
            example: 1394531169;
          };
          monthly_spend: {
            type: 'integer';
            description: 'How much revenue the company generates for your business. Note that this will truncate floats. i.e. it only allow for whole integers, 155.98 will be truncated to 155. Note that this has an upper limit of 2**31-1 or 2147483647..';
            example: 1000;
          };
        };
      };
      create_or_update_tag_request: {
        description: 'You can create or update an existing tag.';
        type: 'object';
        title: 'Create or Update Tag Request Payload';
        properties: {
          name: {
            type: 'string';
            description: 'The name of the tag, which will be created if not found, or the new name for the tag if this is an update request. Names are case insensitive.';
            example: 'Independent';
          };
          id: {
            type: 'string';
            description: 'The id of tag to updates.';
            example: '656452352';
          };
        };
        required: ['name'];
      };
      create_phone_switch_request: {
        description: 'You can create an phone switch';
        type: 'object';
        title: 'Create Phone Switch Request Payload';
        nullable: true;
        properties: {
          phone: {
            type: 'string';
            description: 'Phone number in E.164 format, that will receive the SMS to continue the conversation in the Messenger.';
            example: '+1 1234567890';
          };
          custom_attributes: {
            $ref: '#/components/schemas/custom_attributes';
          };
        };
        required: ['phone'];
      };
      create_section_request: {
        description: 'You can create a Section';
        type: 'object';
        title: 'Create Section Request Payload';
        properties: {
          name: {
            type: 'string';
            description: "The name of the collection. For multilingual collections, this will be the name of the default language's content.";
            example: 'Section 51';
          };
          parent_id: {
            type: 'integer';
            description: 'The id for the collection this section will be within.';
            example: 18;
          };
          translated_content: {
            nullable: true;
            $ref: '#/components/schemas/group_translated_content';
          };
        };
        required: ['name', 'parent_id'];
      };
      create_ticket_reply_request: {
        title: 'Create Ticket Reply Request Payload';
        type: 'object';
        properties: {
          body: {
            type: 'string';
            description: 'The message body of the note, which may contain HTML.';
            example: '<p>Okay!</p>';
          };
          message_type: {
            type: 'string';
            description: 'The type of the reply. Only `note` is supported at the moment.';
            example: 'note';
            default: 'note';
          };
          admin_id: {
            type: 'string';
            description: 'The id of the admin who is making the note.';
            example: '1234';
          };
        };
        required: ['body', 'admin_id'];
      };
      create_ticket_request: {
        description: 'You can create a Ticket';
        type: 'object';
        title: 'Create Ticket Request Payload';
        properties: {
          ticket_type_id: {
            type: 'string';
            description: 'The ID of the type of ticket you want to create';
            example: '1234';
          };
          contacts: {
            type: 'array';
            description: 'The list of contacts (users or leads) affected by this ticket. Currently only one is allowed';
            items: {
              type: 'object';
              oneOf: [
                {
                  title: 'ID';
                  properties: {
                    id: {
                      type: 'string';
                      description: 'The identifier for the contact as given by Intercom.';
                    };
                  };
                  required: ['id'];
                },
                {
                  title: 'External ID';
                  properties: {
                    external_id: {
                      type: 'string';
                      description: 'The external_id you have defined for the contact who is being added as a participant.';
                    };
                  };
                  required: ['external_id'];
                },
                {
                  title: 'Email';
                  properties: {
                    email: {
                      type: 'string';
                      description: 'The email you have defined for the contact who is being added as a participant. If a contact with this email does not exist, one will be created.';
                    };
                  };
                  required: ['email'];
                },
              ];
            };
            example: [
              {
                id: '1234';
              },
            ];
          };
          company_id: {
            type: 'string';
            description: 'The ID of the company that the ticket is associated with. The ID that you set upon company creation.';
            example: '1234';
          };
          ticket_attributes: {
            $ref: '#/components/schemas/ticket_request_custom_attributes';
          };
        };
        required: ['ticket_type_id', 'contacts'];
      };
      create_ticket_type_attribute_request: {
        description: 'You can create a Ticket Type Attribute';
        type: 'object';
        title: 'Create Ticket Type Attribute Request Payload';
        properties: {
          name: {
            type: 'string';
            description: 'The name of the ticket type attribute';
            example: 'Bug Priority';
          };
          description: {
            type: 'string';
            description: 'The description of the attribute presented to the teammate or contact';
            example: 'Priority level of the bug';
          };
          data_type: {
            type: 'string';
            description: 'The data type of the attribute';
            enum: ['string', 'list', 'integer', 'decimal', 'boolean', 'datetime', 'files'];
            example: 'string';
          };
          required_to_create: {
            type: 'boolean';
            description: 'Whether the attribute is required to be filled in when teammates are creating the ticket in Inbox.';
            default: false;
            example: false;
          };
          required_to_create_for_contacts: {
            type: 'boolean';
            description: 'Whether the attribute is required to be filled in when contacts are creating the ticket in Messenger.';
            default: false;
            example: false;
          };
          visible_on_create: {
            type: 'boolean';
            description: 'Whether the attribute is visible to teammates when creating a ticket in Inbox.';
            default: true;
            example: true;
          };
          visible_to_contacts: {
            type: 'boolean';
            description: 'Whether the attribute is visible to contacts when creating a ticket in Messenger.';
            default: true;
            example: true;
          };
          multiline: {
            type: 'boolean';
            description: 'Whether the attribute allows multiple lines of text (only applicable to string attributes)';
            example: false;
          };
          list_items: {
            type: 'string';
            description: 'A comma delimited list of items for the attribute value (only applicable to list attributes)';
            example: 'Low Priority,Medium Priority,High Priority';
          };
          allow_multiple_values: {
            type: 'boolean';
            description: 'Whether the attribute allows multiple files to be attached to it (only applicable to file attributes)';
            example: false;
          };
        };
        required: ['name', 'description', 'data_type'];
      };
      create_ticket_type_request: {
        description: 'The request payload for creating a ticket type.\n  You can copy the `icon` property for your ticket type from [Twemoji Cheatsheet](https://twemoji-cheatsheet.vercel.app/)\n';
        type: 'object';
        title: 'Create Ticket Type Request Payload';
        nullable: true;
        properties: {
          name: {
            type: 'string';
            description: 'The name of the ticket type.';
            example: 'Bug';
          };
          description: {
            type: 'string';
            description: 'The description of the ticket type.';
            example: 'Used for tracking bugs';
          };
          icon: {
            type: 'string';
            description: 'The icon of the ticket type.';
            example: '🐞';
            default: '🎟️';
          };
          is_internal: {
            type: 'boolean';
            description: 'Whether the tickets associated with this ticket type are intended for internal use only or will be shared with customers. This is currently a limited attribute.';
            example: false;
            default: false;
          };
        };
        required: ['name'];
      };
      cursor_pages: {
        title: 'Cursor based pages';
        type: 'object';
        description: 'Cursor-based pagination is a technique used in the Intercom API to navigate through large amounts of data.\nA "cursor" or pointer is used to keep track of the current position in the result set, allowing the API to return the data in small chunks or "pages" as needed.\n';
        nullable: true;
        properties: {
          type: {
            type: 'string';
            description: 'the type of object `pages`.';
            example: 'pages';
            enum: ['pages'];
          };
          page: {
            type: 'integer';
            description: 'The current page';
            example: 1;
          };
          next: {
            $ref: '#/components/schemas/starting_after_paging';
          };
          per_page: {
            type: 'integer';
            description: 'Number of results per page';
            example: 2;
          };
          total_pages: {
            type: 'integer';
            description: 'Total number of pages';
            example: 13;
          };
        };
      };
      custom_attributes: {
        title: 'Custom Attributes';
        type: 'object';
        description: 'An object containing the different custom attributes associated to the conversation as key-value pairs. For relationship attributes the value will be a list of custom object instance models.';
        additionalProperties: {
          anyOf: [
            {
              type: 'string';
            },
            {
              $ref: '#/components/schemas/custom_object_instance';
            },
          ];
        };
      };
      custom_object_instance: {
        title: 'Custom Object Instance';
        type: 'object';
        'x-tags': ['Custom Object Instances'];
        nullable: true;
        description: 'A Custom Object Instance represents an instance of a custom object type. This allows you to create and set custom attributes to store data about your customers that is not already captured by Intercom. The parent object includes recommended default attributes and you can add your own custom attributes.';
        properties: {
          id: {
            type: 'string';
            description: 'The Intercom defined id representing the custom object instance.';
            example: '5a7a19e9f59ae20001d1c1e6';
          };
          external_id: {
            type: 'string';
            description: 'The id you have defined for the custom object instance.';
            example: '0001d1c1e65a7a19e9f59ae2';
          };
          type: {
            type: 'string';
            description: 'The identifier of the custom object type that defines the structure of the custom object instance.';
            example: 'Order';
          };
          custom_attributes: {
            type: 'object';
            description: 'The custom attributes you have set on the custom object instance.';
            additionalProperties: {
              type: 'string';
            };
          };
        };
      };
      customer_request: {
        type: 'object';
        nullable: true;
        oneOf: [
          {
            title: 'Intercom User ID';
            properties: {
              intercom_user_id: {
                type: 'string';
                description: 'The identifier for the contact as given by Intercom.';
                example: '6329bd9ffe4e2e91dac76188';
              };
            };
            required: ['intercom_user_id'];
          },
          {
            title: 'User ID';
            properties: {
              user_id: {
                type: 'string';
                description: 'The external_id you have defined for the contact who is being added as a participant.';
                example: '2e91dac761886329bd9ffe4e';
              };
            };
            required: ['user_id'];
          },
          {
            title: 'Email';
            properties: {
              email: {
                type: 'string';
                description: 'The email you have defined for the contact who is being added as a participant.';
                example: 'sam.sung@example.com';
              };
            };
            required: ['email'];
          },
        ];
      };
      data_attribute: {
        title: 'Data Attribute';
        type: 'object';
        'x-tags': ['Data Attributes'];
        description: 'Data Attributes are metadata used to describe your contact, company and conversation models. These include standard and custom attributes. By using the data attributes endpoint, you can get the global list of attributes for your workspace, as well as create and archive custom attributes.';
        properties: {
          type: {
            type: 'string';
            description: 'Value is `data_attribute`.';
            enum: ['data_attribute'];
            example: 'data_attribute';
          };
          id: {
            type: 'integer';
            description: 'The unique identifier for the data attribute which is given by Intercom. Only available for custom attributes.';
            example: 12878;
          };
          model: {
            type: 'string';
            description: 'Value is `contact` for user/lead attributes and `company` for company attributes.';
            enum: ['contact', 'company'];
            example: 'contact';
          };
          name: {
            type: 'string';
            description: 'Name of the attribute.';
            example: 'paid_subscriber';
          };
          full_name: {
            type: 'string';
            description: "Full name of the attribute. Should match the name unless it's a nested attribute. We can split full_name on `.` to access nested user object values.";
            example: 'custom_attributes.paid_subscriber';
          };
          label: {
            type: 'string';
            description: 'Readable name of the attribute (i.e. name you see in the UI)';
            example: 'Paid Subscriber';
          };
          description: {
            type: 'string';
            description: 'Readable description of the attribute.';
            example: 'Whether the user is a paid subscriber.';
          };
          data_type: {
            type: 'string';
            description: 'The data type of the attribute.';
            enum: ['string', 'integer', 'float', 'boolean', 'date'];
            example: 'boolean';
          };
          options: {
            type: 'array';
            description: 'List of predefined options for attribute value.';
            items: {
              type: 'string';
            };
            example: ['true', 'false'];
          };
          api_writable: {
            type: 'boolean';
            description: 'Can this attribute be updated through API';
            example: true;
          };
          messenger_writable: {
            type: 'boolean';
            description: 'Can this attribute be updated by the Messenger';
            example: false;
          };
          ui_writable: {
            type: 'boolean';
            description: 'Can this attribute be updated in the UI';
            example: true;
          };
          custom: {
            type: 'boolean';
            description: 'Set to true if this is a CDA';
            example: true;
          };
          archived: {
            type: 'boolean';
            description: 'Is this attribute archived. (Only applicable to CDAs)';
            example: false;
          };
          created_at: {
            type: 'integer';
            format: 'date-time';
            description: 'The time the attribute was created as a UTC Unix timestamp';
            example: 1671028894;
          };
          updated_at: {
            type: 'integer';
            format: 'date-time';
            description: 'The time the attribute was last updated as a UTC Unix timestamp';
            example: 1671028894;
          };
          admin_id: {
            type: 'string';
            description: 'Teammate who created the attribute. Only applicable to CDAs';
            example: '5712945';
          };
        };
      };
      data_attribute_list: {
        title: 'Data Attribute List';
        type: 'object';
        description: 'A list of all data attributes belonging to a workspace for contacts, companies or conversations.';
        properties: {
          type: {
            type: 'string';
            description: 'The type of the object';
            enum: ['list'];
            example: 'list';
          };
          data: {
            type: 'array';
            description: 'A list of data attributes';
            items: {
              $ref: '#/components/schemas/data_attribute';
            };
          };
        };
      };
      data_event: {
        title: 'Data Event';
        type: 'object';
        'x-tags': ['Data Events'];
        description: 'Data events are used to notify Intercom of changes to your data.';
        properties: {
          type: {
            type: 'string';
            description: 'The type of the object';
            enum: ['event'];
            example: 'event';
          };
          event_name: {
            type: 'string';
            description: "The name of the event that occurred. This is presented to your App's admins when filtering and creating segments - a good event name is typically a past tense 'verb-noun' combination, to improve readability, for example `updated-plan`.";
            example: 'invited-friend';
          };
          created_at: {
            type: 'integer';
            format: 'date-time';
            description: 'The time the event occurred as a UTC Unix timestamp';
            example: 1671028894;
          };
          user_id: {
            type: 'string';
            description: 'Your identifier for the user.';
            example: '314159';
          };
          id: {
            type: 'string';
            description: 'Your identifier for a lead or a user.';
            example: '8a88a590-e1c3-41e2-a502-e0649dbf721c';
          };
          intercom_user_id: {
            type: 'string';
            description: 'The Intercom identifier for the user.';
            example: '63a0979a5eeebeaf28dd56ba';
          };
          email: {
            type: 'string';
            description: 'An email address for your user. An email should only be used where your application uses email to uniquely identify users.';
            example: 'frodo.baggins@example.com';
          };
          metadata: {
            type: 'object';
            description: 'Optional metadata about the event.';
            additionalProperties: {
              type: 'string';
            };
            example: {
              invite_code: 'ADDAFRIEND';
            };
          };
        };
        required: ['event_name', 'created_at'];
      };
      data_event_list: {
        title: 'Data Event List';
        type: 'object';
        description: 'This will return a list of data events for the App.';
        properties: {
          type: {
            type: 'string';
            description: 'The type of the object';
            enum: ['event.list'];
            example: 'event.list';
          };
          events: {
            type: 'array';
            description: 'A list of data events';
            items: {
              $ref: '#/components/schemas/data_event';
            };
          };
          pages: {
            type: 'object';
            description: 'Pagination';
            properties: {
              next: {
                type: 'string';
                example: 'https://api.intercom.io/events?per_page=2&before=1389913941064&intercom_user_id=63a0979a5eeebeaf28dd56ba&type=user"';
              };
              since: {
                type: 'string';
                example: 'https://api.intercom.io/events?intercom_user_id=63a0979a5eeebeaf28dd56ba&type=user&since=1389913941065';
              };
            };
          };
        };
      };
      data_event_summary: {
        title: 'Data Event Summary';
        type: 'object';
        description: 'This will return a summary of data events for the App.';
        properties: {
          type: {
            type: 'string';
            description: 'The type of the object';
            enum: ['event.summary'];
            example: 'event.summary';
          };
          email: {
            type: 'string';
            description: 'The email address of the user';
            example: 'Sam.Sung@example.com';
          };
          intercom_user_id: {
            type: 'string';
            description: 'The Intercom user ID of the user';
            example: '63a0979a5eeebeaf28dd56ba';
          };
          user_id: {
            type: 'string';
            description: 'The user ID of the user';
            example: '62b997f288e14803c5006932';
          };
          events: {
            type: 'array';
            description: 'A summary of data events';
            items: {
              $ref: '#/components/schemas/data_event_summary_item';
            };
          };
        };
      };
      data_event_summary_item: {
        title: 'Data Event Summary Item';
        type: 'object';
        description: 'This will return a summary of a data event for the App.';
        nullable: true;
        properties: {
          name: {
            type: 'string';
            description: 'The name of the event';
            example: 'placed-order';
          };
          first: {
            type: 'string';
            description: 'The first time the event was sent';
            example: '2014-01-16T23:12:21.000+00:00';
          };
          last: {
            type: 'string';
            description: 'The last time the event was sent';
            example: '2014-01-16T23:12:21.000+00:00 ';
          };
          count: {
            type: 'integer';
            description: 'The number of times the event was sent';
            example: 1;
          };
          description: {
            type: 'string';
            description: 'The description of the event';
            example: 'A user placed an order';
          };
        };
      };
      data_export: {
        title: 'Data Export';
        type: 'object';
        'x-tags': ['Data Export'];
        description: 'The data export api is used to view all message sent & viewed in a given timeframe.';
        properties: {
          job_identfier: {
            type: 'string';
            description: 'The identifier for your job.';
            example: 'orzzsbd7hk67xyu';
          };
          status: {
            type: 'string';
            enum: ['pending', 'in_progress', 'failed', 'completed', 'no_data', 'canceled'];
            description: 'The current state of your job.';
            example: 'pending';
          };
          download_expires_at: {
            type: 'string';
            description: 'The time after which you will not be able to access the data.';
            example: '1674917488';
          };
          download_url: {
            type: 'string';
            description: 'The location where you can download your data.';
            example: 'https://api.intercom.test/download/messages/data/example';
          };
        };
      };
      data_export_csv: {
        title: 'Data Export CSV';
        type: 'object';
        description: 'A CSV output file';
        properties: {
          user_id: {
            type: 'string';
            description: 'The user_id of the user who was sent the message.';
          };
          user_external_id: {
            type: 'string';
            description: 'The external_user_id of the user who was sent the message';
          };
          company_id: {
            type: 'string';
            description: 'The company ID of the user in relation to the message that was sent. Will return -1 if no company is present.';
          };
          email: {
            type: 'string';
            description: 'The users email who was sent the message.';
          };
          name: {
            type: 'string';
            description: 'The full name of the user receiving the message';
          };
          ruleset_id: {
            type: 'string';
            description: 'The id of the message.';
          };
          content_id: {
            type: 'string';
            description: 'The specific content that was received. In an A/B test each version has its own Content ID.';
          };
          content_type: {
            type: 'string';
            description: 'Email, Chat, Post etc.';
          };
          content_title: {
            type: 'string';
            description: 'The title of the content you see in your Intercom workspace.';
          };
          ruleset_version_id: {
            type: 'string';
            description: 'As you edit content we record new versions. This ID can help you determine which version of a piece of content that was received.';
          };
          receipt_id: {
            type: 'string';
            description: 'ID for this receipt. Will be included with any related stats in other files to identify this specific delivery of a message.';
          };
          received_at: {
            type: 'integer';
            description: 'Timestamp for when the receipt was recorded.';
          };
          series_id: {
            type: 'string';
            description: 'The id of the series that this content is part of. Will return -1 if not part of a series.';
          };
          series_title: {
            type: 'string';
            description: 'The title of the series that this content is part of.';
          };
          node_id: {
            type: 'string';
            description: 'The id of the series node that this ruleset is associated with. Each block in a series has a corresponding node_id.';
          };
          first_reply: {
            type: 'integer';
            description: 'The first time a user replied to this message if the content was able to receive replies.';
          };
          first_completion: {
            type: 'integer';
            description: 'The first time a user completed this message if the content was able to be completed e.g. Tours, Surveys.';
          };
          first_series_completion: {
            type: 'integer';
            description: 'The first time the series this message was a part of was completed by the user.';
          };
          first_series_disengagement: {
            type: 'integer';
            description: 'The first time the series this message was a part of was disengaged by the user.';
          };
          first_series_exit: {
            type: 'integer';
            description: 'The first time the series this message was a part of was exited by the user.';
          };
          first_goal_success: {
            type: 'integer';
            description: 'The first time the user met this messages associated goal if one exists.';
          };
          first_open: {
            type: 'integer';
            description: 'The first time the user opened this message.';
          };
          first_click: {
            type: 'integer';
            description: 'The first time the series the user clicked on a link within this message.';
          };
          first_dismisall: {
            type: 'integer';
            description: 'The first time the series the user dismissed this message.';
          };
          first_unsubscribe: {
            type: 'integer';
            description: 'The first time the user unsubscribed from this message.';
          };
          first_hard_bounce: {
            type: 'integer';
            description: 'The first time this message hard bounced for this user';
          };
        };
      };
      deleted_article_object: {
        title: 'Deleted Article Object';
        type: 'object';
        description: 'Response returned when an object is deleted';
        properties: {
          id: {
            type: 'string';
            description: 'The unique identifier for the article which you provided in the URL.';
            example: '6890762';
          };
          object: {
            type: 'string';
            description: 'The type of object which was deleted. - article';
            enum: ['article'];
            example: 'article';
          };
          deleted: {
            type: 'boolean';
            description: 'Whether the article was deleted successfully or not.';
            example: true;
          };
        };
      };
      deleted_collection_object: {
        title: 'Deleted Collection Object';
        type: 'object';
        description: 'Response returned when an object is deleted';
        properties: {
          id: {
            type: 'string';
            description: 'The unique identifier for the collection which you provided in the URL.';
            example: '6890762';
          };
          object: {
            type: 'string';
            description: 'The type of object which was deleted. - `collection`';
            enum: ['collection'];
            example: 'collection';
          };
          deleted: {
            type: 'boolean';
            description: 'Whether the collection was deleted successfully or not.';
            example: true;
          };
        };
      };
      deleted_company_object: {
        title: 'Deleted Company Object';
        type: 'object';
        description: 'Response returned when an object is deleted';
        properties: {
          id: {
            type: 'string';
            description: 'The unique identifier for the company which is given by Intercom.';
            example: '5b7e8b2f-7a1a-4e6c-8e1b-4f9d4f4c4d4f';
          };
          object: {
            type: 'string';
            description: 'The type of object which was deleted. - `company`';
            enum: ['company'];
            example: 'company';
          };
          deleted: {
            type: 'boolean';
            description: 'Whether the company was deleted successfully or not.';
            example: true;
          };
        };
      };
      deleted_object: {
        title: 'Deleted Object';
        type: 'object';
        description: 'Response returned when an object is deleted';
        properties: {
          id: {
            type: 'string';
            description: 'The unique identifier for the news item which you provided in the URL.';
            example: '6890762';
          };
          object: {
            type: 'string';
            description: 'The type of object which was deleted - news-item.';
            enum: ['news-item'];
            example: 'news-item';
          };
          deleted: {
            type: 'boolean';
            description: 'Whether the news item was deleted successfully or not.';
            example: true;
          };
        };
      };
      deleted_section_object: {
        title: 'Deleted Section Object';
        type: 'object';
        description: 'Response returned when an object is deleted';
        properties: {
          id: {
            type: 'string';
            description: 'The unique identifier for the section which you provided in the URL.';
            example: '6890762';
          };
          object: {
            type: 'string';
            description: 'The type of object which was deleted. - `section`';
            enum: ['section'];
            example: 'section';
          };
          deleted: {
            type: 'boolean';
            description: 'Whether the section was deleted successfully or not.';
            example: true;
          };
        };
      };
      detach_contact_from_conversation_request: {
        properties: {
          admin_id: {
            type: 'string';
            description: 'The `id` of the admin who is performing the action.';
            example: '5017690';
          };
        };
        required: ['admin_id'];
      };
      error: {
        type: 'object';
        title: 'Error';
        description: 'The API will return an Error List for a failed request, which will contain one or more Error objects.';
        properties: {
          type: {
            type: 'string';
            description: 'The type is error.list';
            example: 'error.list';
          };
          request_id: {
            type: 'string';
            nullable: true;
            format: 'uuid';
            description: '';
            example: 'f93ecfa8-d08a-4325-8694-89aeb89c8f85';
          };
          errors: {
            type: 'array';
            description: 'An array of one or more error objects';
            items: {
              properties: {
                code: {
                  type: 'string';
                  description: 'A string indicating the kind of error, used to further qualify the HTTP response code';
                  example: 'unauthorized';
                };
                message: {
                  type: 'string';
                  nullable: true;
                  description: 'Optional. Human readable description of the error.';
                  example: 'Access Token Invalid';
                };
                field: {
                  type: 'string';
                  nullable: true;
                  description: 'Optional. Used to identify a particular field or query parameter that was in error.';
                  example: 'email';
                };
              };
              required: ['code'];
            };
          };
        };
        required: ['type', 'errors'];
      };
      file_attribute: {
        title: 'File';
        type: 'object';
        description: 'The value describing a file upload set for a custom attribute';
        properties: {
          type: {
            type: 'string';
            example: 'upload';
          };
          name: {
            type: 'string';
            description: 'The name of the file';
            example: 'Screenshot.png';
          };
          url: {
            type: 'string';
            description: 'The url of the file. This is a temporary URL and will expire after 30 minutes.';
            example: 'https://intercom-attachments-1.com/.../Screenshot.png';
          };
          content_type: {
            type: 'string';
            description: 'The type of file';
            example: 'image/png';
          };
          filesize: {
            type: 'integer';
            description: 'The size of the file in bytes';
            example: 11308309;
          };
          width: {
            type: 'integer';
            description: 'The width of the file in pixels, if applicable';
            example: 3024;
          };
          height: {
            type: 'integer';
            description: 'The height of the file in pixels, if applicable';
            example: 1964;
          };
        };
      };
      group_content: {
        title: 'Group Content';
        type: 'object';
        description: 'The Content of a Group.';
        nullable: true;
        properties: {
          type: {
            type: 'string';
            description: 'The type of object - `group_content` .';
            enum: [null, 'group_content'];
            example: 'group_content';
            nullable: true;
          };
          name: {
            type: 'string';
            description: 'The name of the collection or section.';
            example: 'Collection name';
          };
          description: {
            type: 'string';
            description: 'The description of the collection. Only available for collections.';
            example: ' Collection description';
          };
        };
      };
      group_translated_content: {
        title: 'Group Translated Content';
        type: 'object';
        description: 'The Translated Content of an Group. The keys are the locale codes and the values are the translated content of the Group.';
        nullable: true;
        properties: {
          type: {
            type: 'string';
            description: 'The type of object - group_translated_content.';
            nullable: true;
            enum: [null, 'group_translated_content'];
            example: 'group_translated_content';
          };
          ar: {
            description: 'The content of the group in Arabic';
            $ref: '#/components/schemas/group_content';
          };
          bg: {
            description: 'The content of the group in Bulgarian';
            $ref: '#/components/schemas/group_content';
          };
          bs: {
            description: 'The content of the group in Bosnian';
            $ref: '#/components/schemas/group_content';
          };
          ca: {
            description: 'The content of the group in Catalan';
            $ref: '#/components/schemas/group_content';
          };
          cs: {
            description: 'The content of the group in Czech';
            $ref: '#/components/schemas/group_content';
          };
          da: {
            description: 'The content of the group in Danish';
            $ref: '#/components/schemas/group_content';
          };
          de: {
            description: 'The content of the group in German';
            $ref: '#/components/schemas/group_content';
          };
          el: {
            description: 'The content of the group in Greek';
            $ref: '#/components/schemas/group_content';
          };
          en: {
            description: 'The content of the group in English';
            $ref: '#/components/schemas/group_content';
          };
          es: {
            description: 'The content of the group in Spanish';
            $ref: '#/components/schemas/group_content';
          };
          et: {
            description: 'The content of the group in Estonian';
            $ref: '#/components/schemas/group_content';
          };
          fi: {
            description: 'The content of the group in Finnish';
            $ref: '#/components/schemas/group_content';
          };
          fr: {
            description: 'The content of the group in French';
            $ref: '#/components/schemas/group_content';
          };
          he: {
            description: 'The content of the group in Hebrew';
            $ref: '#/components/schemas/group_content';
          };
          hr: {
            description: 'The content of the group in Croatian';
            $ref: '#/components/schemas/group_content';
          };
          hu: {
            description: 'The content of the group in Hungarian';
            $ref: '#/components/schemas/group_content';
          };
          id: {
            description: 'The content of the group in Indonesian';
            $ref: '#/components/schemas/group_content';
          };
          it: {
            description: 'The content of the group in Italian';
            $ref: '#/components/schemas/group_content';
          };
          ja: {
            description: 'The content of the group in Japanese';
            $ref: '#/components/schemas/group_content';
          };
          ko: {
            description: 'The content of the group in Korean';
            $ref: '#/components/schemas/group_content';
          };
          lt: {
            description: 'The content of the group in Lithuanian';
            $ref: '#/components/schemas/group_content';
          };
          lv: {
            description: 'The content of the group in Latvian';
            $ref: '#/components/schemas/group_content';
          };
          mn: {
            description: 'The content of the group in Mongolian';
            $ref: '#/components/schemas/group_content';
          };
          nb: {
            description: 'The content of the group in Norwegian';
            $ref: '#/components/schemas/group_content';
          };
          nl: {
            description: 'The content of the group in Dutch';
            $ref: '#/components/schemas/group_content';
          };
          pl: {
            description: 'The content of the group in Polish';
            $ref: '#/components/schemas/group_content';
          };
          pt: {
            description: 'The content of the group in Portuguese (Portugal)';
            $ref: '#/components/schemas/group_content';
          };
          ro: {
            description: 'The content of the group in Romanian';
            $ref: '#/components/schemas/group_content';
          };
          ru: {
            description: 'The content of the group in Russian';
            $ref: '#/components/schemas/group_content';
          };
          sl: {
            description: 'The content of the group in Slovenian';
            $ref: '#/components/schemas/group_content';
          };
          sr: {
            description: 'The content of the group in Serbian';
            $ref: '#/components/schemas/group_content';
          };
          sv: {
            description: 'The content of the group in Swedish';
            $ref: '#/components/schemas/group_content';
          };
          tr: {
            description: 'The content of the group in Turkish';
            $ref: '#/components/schemas/group_content';
          };
          vi: {
            description: 'The content of the group in Vietnamese';
            $ref: '#/components/schemas/group_content';
          };
          'pt-BR': {
            description: 'The content of the group in Portuguese (Brazil)';
            $ref: '#/components/schemas/group_content';
          };
          'zh-CN': {
            description: 'The content of the group in Chinese (China)';
            $ref: '#/components/schemas/group_content';
          };
          'zh-TW': {
            description: 'The content of the group in Chinese (Taiwan)';
            $ref: '#/components/schemas/group_content';
          };
        };
      };
      help_center: {
        title: 'Help Center';
        type: 'object';
        'x-tags': ['Help Center'];
        description: 'Help Centers contain collections';
        properties: {
          id: {
            type: 'string';
            description: 'The unique identifier for the Help Center which is given by Intercom.';
            example: '123';
          };
          workspace_id: {
            type: 'string';
            description: 'The id of the workspace which the Help Center belongs to.';
            example: 'hfi1bx4l';
          };
          created_at: {
            type: 'integer';
            format: 'date-time';
            description: 'The time when the Help Center was created.';
            example: 1672928359;
          };
          updated_at: {
            type: 'integer';
            format: 'date-time';
            description: 'The time when the Help Center was last updated.';
            example: 1672928610;
          };
          identifier: {
            type: 'string';
            description: 'The identifier of the Help Center. This is used in the URL of the Help Center.';
            example: 'intercom';
          };
          website_turned_on: {
            type: 'boolean';
            description: 'Whether the Help Center is turned on or not. This is controlled in your Help Center settings.';
            example: true;
          };
          display_name: {
            type: 'string';
            description: 'The display name of the Help Center only seen by teammates.';
            example: 'Intercom Help Center';
          };
        };
      };
      help_center_list: {
        title: 'Help Centers';
        type: 'object';
        'x-tags': ['Help Center'];
        description: 'A list of Help Centers belonging to the App';
        properties: {
          type: {
            type: 'string';
            description: 'The type of the object - `list`.';
            enum: ['list'];
            example: 'list';
          };
          data: {
            type: 'array';
            description: 'An array of Help Center objects';
            items: {
              $ref: '#/components/schemas/help_center';
            };
          };
        };
      };
      intercom_version: {
        description: "Intercom API version.</br>By default, it's equal to the version set in the app package.";
        type: 'string';
        example: '2.9';
        default: '2.9';
        enum: [
          '1.0',
          '1.1',
          '1.2',
          '1.3',
          '1.4',
          '2.0',
          '2.1',
          '2.2',
          '2.3',
          '2.4',
          '2.5',
          '2.6',
          '2.7',
          '2.8',
          '2.9',
          '2.10',
          '2.11',
          'Unstable',
        ];
      };
      merge_contacts_request: {
        description: 'Merge contact data.';
        type: 'object';
        title: 'Merge contact data';
        properties: {
          from: {
            type: 'string';
            description: 'The unique identifier for the contact to merge away from. Must be a lead.';
            example: '5d70dd30de4efd54f42fd526';
          };
          into: {
            type: 'string';
            description: 'The unique identifier for the contact to merge into. Must be a user.';
            example: '5ba682d23d7cf92bef87bfd4';
          };
        };
      };
      message: {
        type: 'object';
        title: 'Message';
        'x-tags': ['Messages'];
        description: 'Message are how you reach out to contacts in Intercom. They are created when an admin sends an outbound message to a contact.';
        properties: {
          type: {
            type: 'string';
            description: 'The type of the message';
            example: 'user_message';
          };
          id: {
            type: 'string';
            description: 'The id representing the message.';
            example: '1488971108';
          };
          created_at: {
            type: 'integer';
            format: 'date-time';
            description: 'The time the conversation was created.';
            example: 1667560812;
          };
          subject: {
            type: 'string';
            description: 'The subject of the message. Only present if message_type: email.';
            example: 'Greetings';
          };
          body: {
            type: 'string';
            description: 'The message body, which may contain HTML.';
            example: 'Hello';
          };
          message_type: {
            type: 'string';
            enum: ['email', 'inapp', 'facebook', 'twitter'];
            description: 'The type of message that was sent. Can be email, inapp, facebook or twitter.';
            example: 'inapp';
          };
          conversation_id: {
            type: 'string';
            description: 'The associated conversation_id';
            example: '64619700005570';
          };
        };
        required: ['type', 'id', 'created_at', 'body', 'message_type'];
      };
      multiple_filter_search_request: {
        title: 'Multiple Filter Search Request';
        description: 'Search using Intercoms Search APIs with more than one filter.';
        type: 'object';
        properties: {
          operator: {
            type: 'string';
            enum: ['AND', 'OR'];
            description: 'An operator to allow boolean inspection between multiple fields.';
            example: 'AND';
          };
          value: {
            oneOf: [
              {
                type: 'array';
                description: 'Add mutiple filters.';
                title: 'multiple filter search request';
                items: {
                  $ref: '#/components/schemas/multiple_filter_search_request';
                };
              },
              {
                type: 'array';
                description: 'Add a single filter field.';
                title: 'single filter search request';
                items: {
                  $ref: '#/components/schemas/single_filter_search_request';
                };
              },
            ];
          };
        };
      };
      news_item: {
        title: 'News Item';
        type: 'object';
        'x-tags': ['News'];
        description: 'A News Item is a content type in Intercom enabling you to announce product updates, company news, promotions, events and more with your customers.';
        properties: {
          type: {
            type: 'string';
            description: 'The type of object.';
            enum: ['news-item'];
            example: 'news-item';
          };
          id: {
            type: 'string';
            description: 'The unique identifier for the news item which is given by Intercom.';
            example: '141';
          };
          workspace_id: {
            type: 'string';
            description: 'The id of the workspace which the news item belongs to.';
            example: 't74hdn32';
          };
          title: {
            type: 'string';
            description: 'The title of the news item.';
            example: 'New feature: News Items';
          };
          body: {
            type: 'string';
            description: 'The news item body, which may contain HTML.';
            example: 'We are excited to announce the launch of News Items, a new content type in Intercom enabling you to announce product updates, company news, promotions, events and more with your customers.';
          };
          sender_id: {
            type: 'integer';
            description: 'The id of the sender of the news item. Must be a teammate on the workspace.';
            example: 123;
          };
          state: {
            type: 'string';
            description: 'News items will not be visible to your users in the assigned newsfeeds until they are set live.';
            enum: ['draft', 'live'];
            example: 'live';
          };
          newsfeed_assignments: {
            type: 'array';
            description: 'A list of newsfeed_assignments to assign to the specified newsfeed.';
            items: {
              $ref: '#/components/schemas/newsfeed_assignment';
            };
          };
          labels: {
            type: 'array';
            description: 'Label names displayed to users to categorize the news item.';
            items: {
              type: 'string';
              nullable: true;
              description: 'The label name.';
              example: 'Product Update';
            };
          };
          cover_image_url: {
            type: 'string';
            format: 'uri';
            nullable: true;
            description: 'URL of the image used as cover. Must have .jpg or .png extension.';
            example: 'https://example.com/cover.jpg';
          };
          reactions: {
            type: 'array';
            description: 'Ordered list of emoji reactions to the news item. When empty, reactions are disabled.';
            items: {
              type: 'string';
              nullable: true;
              description: 'The emoji reaction to the news item.';
              example: '👍';
            };
          };
          deliver_silently: {
            type: 'boolean';
            description: 'When set to true, the news item will appear in the messenger newsfeed without showing a notification badge.';
            example: true;
          };
          created_at: {
            type: 'integer';
            format: 'timestamp';
            description: 'Timestamp for when the news item was created.';
            example: 1610589632;
          };
          updated_at: {
            type: 'integer';
            format: 'timestamp';
            description: 'Timestamp for when the news item was last updated.';
            example: 1610589632;
          };
        };
      };
      news_item_request: {
        description: 'A News Item is a content type in Intercom enabling you to announce product updates, company news, promotions, events and more with your customers.';
        type: 'object';
        title: 'Create News Item Request';
        properties: {
          title: {
            type: 'string';
            description: 'The title of the news item.';
            example: 'Halloween is here!';
          };
          body: {
            type: 'string';
            description: 'The news item body, which may contain HTML.';
            example: '<p>New costumes in store for this spooky season</p>';
          };
          sender_id: {
            type: 'integer';
            description: 'The id of the sender of the news item. Must be a teammate on the workspace.';
            example: 123;
          };
          state: {
            type: 'string';
            description: 'News items will not be visible to your users in the assigned newsfeeds until they are set live.';
            enum: ['draft', 'live'];
            example: 'live';
          };
          deliver_silently: {
            type: 'boolean';
            description: 'When set to `true`, the news item will appear in the messenger newsfeed without showing a notification badge.';
            example: true;
          };
          labels: {
            type: 'array';
            description: 'Label names displayed to users to categorize the news item.';
            items: {
              type: 'string';
            };
            example: ['Product', 'Update', 'New'];
          };
          reactions: {
            type: 'array';
            description: 'Ordered list of emoji reactions to the news item. When empty, reactions are disabled.';
            items: {
              type: 'string';
              nullable: true;
            };
            example: ['😆', '😅'];
          };
          newsfeed_assignments: {
            type: 'array';
            description: 'A list of newsfeed_assignments to assign to the specified newsfeed.';
            items: {
              $ref: '#/components/schemas/newsfeed_assignment';
            };
          };
        };
        required: ['title', 'sender_id'];
      };
      newsfeed: {
        title: 'Newsfeed';
        type: 'object';
        'x-tags': ['News'];
        description: 'A newsfeed is a collection of news items, targeted to a specific audience.\n\nNewsfeeds currently cannot be edited through the API, please refer to [this article](https://www.intercom.com/help/en/articles/6362267-getting-started-with-news) to set up your newsfeeds in Intercom.\n';
        properties: {
          id: {
            type: 'string';
            description: 'The unique identifier for the newsfeed which is given by Intercom.';
            example: '12312';
          };
          type: {
            type: 'string';
            description: 'The type of object.';
            enum: ['newsfeed'];
            example: 'newsfeed';
          };
          name: {
            type: 'string';
            description: 'The name of the newsfeed. This name will never be visible to your users.';
            example: 'My Newsfeed';
          };
          created_at: {
            type: 'integer';
            format: 'timestamp';
            description: 'Timestamp for when the newsfeed was created.';
            example: 1674917488;
          };
          updated_at: {
            type: 'integer';
            format: 'timestamp';
            description: 'Timestamp for when the newsfeed was last updated.';
            example: 1674917488;
          };
        };
      };
      newsfeed_assignment: {
        title: 'Newsfeed Assignment';
        type: 'object';
        'x-tags': ['News'];
        description: 'Assigns a news item to a newsfeed.';
        properties: {
          newsfeed_id: {
            type: 'integer';
            description: 'The unique identifier for the newsfeed which is given by Intercom. Publish dates cannot be in the future, to schedule news items use the dedicated feature in app (see this article).';
            example: 198313;
          };
          published_at: {
            type: 'integer';
            format: 'timestamp';
            description: 'Publish date of the news item on the newsfeed, use this field if you want to set a publish date in the past (e.g. when importing existing news items). On write, this field will be ignored if the news item state is "draft".';
            example: 1674917488;
          };
        };
      };
      note: {
        title: 'Note';
        type: 'object';
        'x-tags': ['Notes'];
        description: 'Notes allow you to annotate and comment on your contacts.';
        properties: {
          type: {
            type: 'string';
            description: "String representing the object's type. Always has the value `note`.";
            example: 'note';
          };
          id: {
            type: 'string';
            description: 'The id of the note.';
            example: '17495962';
          };
          created_at: {
            type: 'integer';
            format: 'timestamp';
            description: 'The time the note was created.';
            example: 1674589321;
          };
          contact: {
            type: 'object';
            description: 'Represents the contact that the note was created about.';
            nullable: true;
            properties: {
              type: {
                type: 'string';
                description: "String representing the object's type. Always has the value `contact`.";
              };
              id: {
                type: 'string';
                description: 'The id of the contact.';
                example: '214656d0c743eafcfde7f248';
              };
            };
          };
          author: {
            $ref: '#/components/schemas/admin';
            description: 'Optional. Represents the Admin that created the note.';
          };
          body: {
            type: 'string';
            description: 'The body text of the note.';
            example: '<p>Text for the note.</p>';
          };
        };
      };
      note_list: {
        title: 'Paginated Response';
        type: 'object';
        description: 'A paginated list of notes associated with a contact.';
        properties: {
          type: {
            type: 'string';
            description: "String representing the object's type. Always has the value `list`.";
            example: 'list';
          };
          data: {
            type: 'array';
            description: 'An array of notes.';
            items: {
              $ref: '#/components/schemas/note';
            };
          };
          total_count: {
            type: 'integer';
            description: 'A count of the total number of notes.';
            example: 1;
          };
          pages: {
            $ref: '#/components/schemas/cursor_pages';
          };
        };
      };
      open_conversation_request: {
        title: 'Open Conversation Request';
        type: 'object';
        description: 'Payload of the request to open a conversation';
        properties: {
          message_type: {
            type: 'string';
            enum: ['open'];
            example: 'open';
          };
          admin_id: {
            type: 'string';
            description: 'The id of the admin who is performing the action.';
            example: '5017690';
          };
        };
        required: ['message_type', 'admin_id'];
      };
      pages_link: {
        title: 'Pagination Object';
        type: 'object';
        description: 'The majority of list resources in the API are paginated to allow clients to traverse data over multiple requests.\n\nTheir responses are likely to contain a pages object that hosts pagination links which a client can use to paginate through the data without having to construct a query. The link relations for the pages field are as follows.\n';
        properties: {
          type: {
            type: 'string';
            example: 'pages';
            enum: ['pages'];
          };
          page: {
            type: 'integer';
            example: 1;
          };
          next: {
            type: 'string';
            format: 'uri';
            description: 'A link to the next page of results. A response that does not contain a next link does not have further data to fetch.';
            nullable: true;
          };
          per_page: {
            type: 'integer';
            example: 50;
          };
          total_pages: {
            type: 'integer';
            example: 1;
          };
        };
      };
      paginated_response: {
        title: 'Paginated Response';
        type: 'object';
        description: 'Paginated Response';
        properties: {
          type: {
            type: 'string';
            description: 'The type of object';
            enum: ['list', 'conversation.list'];
            example: 'list';
          };
          pages: {
            $ref: '#/components/schemas/cursor_pages';
          };
          total_count: {
            type: 'integer';
            description: 'A count of the total number of objects.';
            example: 1;
          };
          data: {
            type: 'array';
            description: 'An array of Objects';
            items: {
              anyOf: [
                {
                  $ref: '#/components/schemas/news_item';
                },
                {
                  $ref: '#/components/schemas/newsfeed';
                },
              ];
            };
          };
        };
      };
      part_attachment: {
        title: 'Part attachment';
        type: 'object';
        description: 'The file attached to a part';
        properties: {
          type: {
            type: 'string';
            description: 'The type of attachment';
            example: 'upload';
          };
          name: {
            type: 'string';
            description: 'The name of the attachment';
            example: 'example.png';
          };
          url: {
            type: 'string';
            description: 'The URL of the attachment';
            example: 'https://picsum.photos/200/300';
          };
          content_type: {
            type: 'string';
            description: 'The content type of the attachment';
            example: 'image/png';
          };
          filesize: {
            type: 'integer';
            description: 'The size of the attachment';
            example: 100;
          };
          width: {
            type: 'integer';
            description: 'The width of the attachment';
            example: 100;
          };
          height: {
            type: 'integer';
            description: 'The height of the attachment';
            example: 100;
          };
        };
      };
      phone_switch: {
        title: 'Phone Switch';
        type: 'object';
        description: 'Phone Switch Response';
        nullable: true;
        properties: {
          type: {
            type: 'string';
            description: '';
            enum: ['phone_call_redirect'];
            default: 'phone_call_redirect';
            example: 'phone_call_redirect';
          };
          phone: {
            type: 'string';
            description: 'Phone number in E.164 format, that has received the SMS to continue the conversation in the Messenger.';
            example: '+1 1234567890';
          };
        };
      };
      redact_conversation_request: {
        oneOf: [
          {
            title: 'Redact Conversation Part Request';
            type: 'object';
            description: 'Payload of the request to redact a conversation part';
            properties: {
              type: {
                type: 'string';
                enum: ['conversation_part'];
                description: 'The type of resource being redacted.';
                example: 'conversation_part';
              };
              conversation_id: {
                type: 'string';
                description: 'The id of the conversation.';
                example: '19894788788';
              };
              conversation_part_id: {
                type: 'string';
                description: 'The id of the conversation_part.';
                example: '19381789428';
              };
            };
            required: ['type', 'conversation_id', 'conversation_part_id'];
          },
          {
            title: 'Redact Conversation Source Request';
            type: 'object';
            description: 'Payload of the request to redact a conversation source';
            properties: {
              type: {
                type: 'string';
                enum: ['source'];
                description: 'The type of resource being redacted.';
                example: 'source';
              };
              conversation_id: {
                type: 'string';
                description: 'The id of the conversation.';
                example: '19894788788';
              };
              source_id: {
                type: 'string';
                description: 'The id of the source.';
                example: '19894781231';
              };
            };
            required: ['type', 'conversation_id', 'source_id'];
          },
        ];
      };
      reference: {
        title: 'Reference';
        type: 'object';
        description: 'reference to another object';
        properties: {
          type: {
            type: 'string';
            description: '';
            example: 'contact';
          };
          id: {
            type: 'string';
            nullable: true;
            description: '';
            example: '1a2b3c';
          };
        };
      };
      reply_conversation_request: {
        oneOf: [
          {
            $ref: '#/components/schemas/contact_reply_conversation_request';
          },
          {
            $ref: '#/components/schemas/admin_reply_conversation_request';
          },
        ];
      };
      search_request: {
        description: 'Search using Intercoms Search APIs.';
        type: 'object';
        title: 'Search data';
        properties: {
          query: {
            oneOf: [
              {
                $ref: '#/components/schemas/single_filter_search_request';
                title: 'Single filter search request';
              },
              {
                $ref: '#/components/schemas/multiple_filter_search_request';
                title: 'multiple filter search request';
              },
            ];
          };
          pagination: {
            $ref: '#/components/schemas/starting_after_paging';
          };
        };
        required: ['query'];
      };
      section: {
        title: 'Section';
        type: 'object';
        'x-tags': ['Help Center'];
        description: 'Sections are subdivisions of a collection, with a collection potentially having multiple sections.';
        properties: {
          type: {
            type: 'string';
            description: 'The type of object - `section`.';
            enum: ['section'];
            default: 'section';
            example: 'section';
          };
          id: {
            type: 'string';
            description: 'The unique identifier for the section which is given by Intercom.';
            example: '6871119';
          };
          workspace_id: {
            type: 'string';
            description: 'The id of the workspace which the section belongs to.';
            example: 'hfi1bx4l';
          };
          name: {
            type: 'string';
            description: "The name of the section. For multilingual sections, this will be the name of the default language's content.";
            example: 'Default language name';
          };
          created_at: {
            type: 'integer';
            format: 'date-time';
            description: "The time when the section was created. For multilingual sections, this will be the timestamp of creation of the default language's content.";
            example: 1672928359;
          };
          updated_at: {
            type: 'integer';
            format: 'date-time';
            description: "The time when the section was last updated. For multilingual sections, this will be the timestamp of last update of the default language's content.";
            example: 1672928610;
          };
          url: {
            type: 'string';
            nullable: true;
            description: 'The URL of the section. For multilingual help centers, this will be the URL of the section for the default language.';
            example: 'http://intercom.test/help/section/name';
          };
          icon: {
            type: 'string';
            nullable: true;
            description: 'The icon of the section.';
            example: 'book-bookmark';
          };
          order: {
            type: 'integer';
            description: "The order of the section in relation to others sections within a collection. Values go from `0` upwards. `0` is the default if there's no order.";
            example: '1';
          };
          parent_id: {
            oneOf: [
              {
                type: 'integer';
                title: 'Integer';
              },
              {
                type: 'string';
                title: 'String';
              },
            ];
            description: 'The id of the parent section.';
            example: 6871119;
          };
          default_locale: {
            type: 'string';
            description: 'The default locale of the help center. This field is only returned for multilingual help centers.';
            example: 'en';
          };
          translated_content: {
            nullable: true;
            $ref: '#/components/schemas/group_translated_content';
          };
        };
      };
      section_list: {
        title: 'Sections';
        type: 'object';
        description: 'This will return a list of Sections for the App.';
        properties: {
          type: {
            type: 'string';
            description: 'The type of the object - `list`.';
            enum: ['list'];
            example: 'list';
          };
          pages: {
            $ref: '#/components/schemas/cursor_pages';
          };
          total_count: {
            type: 'integer';
            description: 'A count of the total number of sections.';
            example: 12;
          };
          data: {
            type: 'array';
            description: 'An array of section objects';
            items: {
              $ref: '#/components/schemas/section';
            };
          };
        };
      };
      segment: {
        title: 'Segment';
        type: 'object';
        'x-tags': ['Segments'];
        description: 'A segment is a group of your contacts defined by the rules that you set.';
        properties: {
          type: {
            type: 'string';
            description: 'The type of object.';
            enum: ['segment'];
            example: 'segment';
          };
          id: {
            type: 'string';
            description: 'The unique identifier representing the segment.';
            example: '56203d253cba154d39010062';
          };
          name: {
            type: 'string';
            description: 'The name of the segment.';
            example: 'Active';
          };
          created_at: {
            type: 'integer';
            description: 'The time the segment was created.';
            example: 1394621988;
          };
          updated_at: {
            type: 'integer';
            description: 'The time the segment was updated.';
            example: 1394622004;
          };
          person_type: {
            type: 'string';
            description: 'Type of the contact: contact (lead) or user.';
            enum: ['contact', 'user'];
            example: 'contact';
          };
          count: {
            type: 'integer';
            description: "The number of items in the user segment. It's returned when `include_count=true` is included in the request.";
            example: 3;
            nullable: true;
          };
        };
      };
      segment_list: {
        title: 'Segment List';
        type: 'object';
        description: 'This will return a list of Segment Objects. The result may also have a pages object if the response is paginated.';
        properties: {
          type: {
            type: 'string';
            description: 'The type of the object';
            enum: ['segment.list'];
            example: 'segment.list';
          };
          segments: {
            type: 'array';
            description: 'A list of Segment objects';
            items: {
              $ref: '#/components/schemas/segment';
            };
          };
          pages: {
            type: 'object';
            description: 'A pagination object, which may be empty, indicating no further pages to fetch.';
          };
        };
      };
      single_filter_search_request: {
        title: 'Single Filter Search Request';
        description: 'Search using Intercoms Search APIs with a single filter.';
        type: 'object';
        properties: {
          field: {
            type: 'string';
            description: 'The accepted field that you want to search on.';
            example: 'created_at';
          };
          operator: {
            type: 'string';
            enum: ['=', '!=', 'IN', 'NIN', '<', '>', '~', '!~', '^', '$'];
            description: 'The accepted operators you can use to define how you want to search for the value.';
            example: '>';
          };
          value: {
            type: 'string';
            description: 'The value that you want to search on.';
            example: '73732934';
          };
        };
      };
      sla_applied: {
        title: 'Applied SLA';
        type: 'object';
        nullable: true;
        description: 'The SLA Applied object contains the details for which SLA has been applied to this conversation.\nImportant: if there are any canceled sla_events for the conversation - meaning an SLA has been manually removed from a conversation, the sla_status will always be returned as null.\n';
        properties: {
          type: {
            type: 'string';
            description: 'object type';
            example: 'conversation_sla_summary';
          };
          sla_name: {
            type: 'string';
            description: 'The name of the SLA as given by the teammate when it was created.';
            example: '';
          };
          sla_status: {
            type: 'string';
            enum: ['hit', 'missed', 'cancelled', 'active'];
            description: 'SLA statuses:\n            - `hit`: If there’s at least one hit event in the underlying sla_events table, and no “missed” or “canceled” events for the conversation.\n            - `missed`: If there are any missed sla_events for the conversation and no canceled events. If there’s even a single missed sla event, the status will always be missed. A missed status is not applied when the SLA expires, only the next time a teammate replies.\n            - `active`: An SLA has been applied to a conversation, but has not yet been fulfilled. SLA status is active only if there are no “hit, “missed”, or “canceled” events.';
            example: 'hit';
          };
        };
      };
      snooze_conversation_request: {
        title: 'Snooze Conversation Request';
        type: 'object';
        description: 'Payload of the request to snooze a conversation';
        properties: {
          message_type: {
            type: 'string';
            enum: ['snoozed'];
            example: 'snoozed';
          };
          admin_id: {
            type: 'string';
            description: 'The id of the admin who is performing the action.';
            example: '5017691';
          };
          snoozed_until: {
            type: 'integer';
            format: 'timestamp';
            description: 'The time you want the conversation to reopen.';
            example: 1673609604;
          };
        };
        required: ['message_type', 'admin_id', 'snoozed_until'];
      };
      social_profile: {
        title: 'Social Profile';
        type: 'object';
        description: 'A Social Profile allows you to label your contacts, companies, and conversations and list them using that Social Profile.';
        properties: {
          type: {
            type: 'string';
            description: 'value is "social_profile"';
            example: 'social_profile';
          };
          name: {
            type: 'string';
            description: 'The name of the Social media profile';
            example: 'Facebook';
          };
          url: {
            type: 'string';
            format: 'uri';
            description: 'The name of the Social media profile';
            example: 'http://twitter.com/th1sland';
          };
        };
      };
      starting_after_paging: {
        title: 'Pagination: Starting After';
        type: 'object';
        nullable: true;
        properties: {
          per_page: {
            type: 'integer';
            description: 'The number of results to fetch per page.';
            example: 2;
          };
          starting_after: {
            type: 'string';
            description: 'The cursor to use in the next request to get the next page of results.';
            nullable: true;
            example: 'your-cursor-from-response';
          };
        };
      };
      subscription_type: {
        title: 'Subscription Types';
        type: 'object';
        'x-tags': ['Subscription Types'];
        description: "A subscription type lets customers easily opt out of non-essential communications without missing what's important to them.";
        properties: {
          type: {
            type: 'string';
            description: 'The type of the object - subscription';
            example: 'subscription';
          };
          id: {
            type: 'string';
            description: 'The unique identifier representing the subscription type.';
            example: '123456';
          };
          state: {
            type: 'string';
            description: 'The state of the subscription type.';
            enum: ['live', 'draft', 'archived'];
            example: 'live';
          };
          default_translation: {
            $ref: '#/components/schemas/translation';
          };
          translations: {
            type: 'array';
            description: 'An array of translations objects with the localised version of the subscription type in each available locale within your translation settings.';
            items: {
              $ref: '#/components/schemas/translation';
            };
          };
          consent_type: {
            type: 'string';
            description: 'Describes the type of consent.';
            enum: ['opt_out', 'opt_in'];
            example: 'opt_in';
          };
          content_types: {
            type: 'array';
            description: 'The message types that this subscription supports - can contain `email` or `sms_message`.';
            items: {
              type: 'string';
              enum: ['email', 'sms_message'];
              example: 'email';
            };
          };
        };
      };
      subscription_type_list: {
        title: 'Subscription Types';
        type: 'object';
        description: 'A list of subscription type objects.';
        properties: {
          type: {
            type: 'string';
            description: 'The type of the object';
            enum: ['list'];
            example: 'list';
          };
          data: {
            type: 'array';
            description: 'A list of subscription type objects associated with the workspace .';
            items: {
              $ref: '#/components/schemas/subscription_type';
            };
          };
        };
      };
      tag: {
        title: 'Tag';
        type: 'object';
        'x-tags': ['Tags'];
        description: 'A tag allows you to label your contacts, companies, and conversations and list them using that tag.';
        properties: {
          type: {
            type: 'string';
            description: 'value is "tag"';
            example: 'tag';
          };
          id: {
            type: 'string';
            description: 'The id of the tag';
            example: '123456';
          };
          name: {
            type: 'string';
            description: 'The name of the tag';
            example: 'Test tag';
          };
          applied_at: {
            type: 'integer';
            format: 'date-time';
            description: 'The time when the tag was applied to the object';
            example: 1663597223;
          };
          applied_by: {
            $ref: '#/components/schemas/reference';
          };
        };
      };
      tag_company_request: {
        description: 'You can tag a single company or a list of companies.';
        type: 'object';
        title: 'Tag Company Request Payload';
        properties: {
          name: {
            type: 'string';
            description: 'The name of the tag, which will be created if not found.';
            example: 'Independent';
          };
          companies: {
            type: 'array';
            items: {
              properties: {
                id: {
                  type: 'string';
                  description: 'The Intercom defined id representing the company.';
                  example: '531ee472cce572a6ec000006';
                };
                company_id: {
                  type: 'string';
                  description: 'The company id you have defined for the company.';
                  example: '6';
                };
              };
            };
            description: 'The id or company_id of the company can be passed as input parameters.';
          };
        };
        required: ['name', 'companies'];
      };
      tag_list: {
        title: 'Tags';
        type: 'object';
        description: 'A list of tags objects in the workspace.';
        properties: {
          type: {
            type: 'string';
            description: 'The type of the object';
            enum: ['list'];
            example: 'list';
          };
          data: {
            type: 'array';
            description: 'A list of tags objects associated with the workspace .';
            items: {
              $ref: '#/components/schemas/tag';
            };
          };
        };
      };
      tag_multiple_users_request: {
        description: 'You can tag a list of users.';
        type: 'object';
        title: 'Tag Users Request Payload';
        properties: {
          name: {
            type: 'string';
            description: 'The name of the tag, which will be created if not found.';
            example: 'Independent';
          };
          users: {
            type: 'array';
            items: {
              properties: {
                id: {
                  type: 'string';
                  description: 'The Intercom defined id representing the user.';
                  example: '5f7f0d217289f8d2f4262080';
                };
              };
            };
          };
        };
        required: ['name', 'users'];
      };
      tags: {
        title: 'Tags';
        type: 'object';
        description: 'A list of tags objects associated with a conversation';
        properties: {
          type: {
            type: 'string';
            description: 'The type of the object';
            enum: ['tag.list'];
            example: 'tag.list';
          };
          tags: {
            type: 'array';
            description: 'A list of tags objects associated with the conversation.';
            items: {
              $ref: '#/components/schemas/tag';
            };
          };
        };
      };
      team: {
        title: 'Team';
        type: 'object';
        'x-tags': ['Teams'];
        description: 'Teams are groups of admins in Intercom.';
        properties: {
          type: {
            type: 'string';
            description: 'Value is always "team"';
            example: 'team';
          };
          id: {
            type: 'string';
            description: 'The id of the team';
            example: '814865';
          };
          name: {
            type: 'string';
            description: 'The name of the team';
            example: 'Example Team';
          };
          admin_ids: {
            type: 'array';
            description: 'The list of admin IDs that are a part of the team.';
            example: [493881];
            items: {
              type: 'integer';
            };
          };
          admin_priority_level: {
            $ref: '#/components/schemas/admin_priority_level';
          };
        };
      };
      team_list: {
        title: 'Team List';
        type: 'object';
        description: 'This will return a list of team objects for the App.';
        properties: {
          type: {
            type: 'string';
            description: 'The type of the object';
            enum: ['team.list'];
            example: 'team.list';
          };
          teams: {
            type: 'array';
            description: 'A list of team objects';
            items: {
              $ref: '#/components/schemas/team';
            };
          };
        };
      };
      team_priority_level: {
        title: 'Team Priority Level';
        type: 'object';
        nullable: true;
        description: 'Admin priority levels for teams';
        properties: {
          primary_team_ids: {
            type: 'array';
            description: 'The primary team ids for the team';
            nullable: true;
            example: [814865];
            items: {
              type: 'integer';
            };
          };
          secondary_team_ids: {
            type: 'array';
            description: 'The secondary team ids for the team';
            nullable: true;
            example: [493881];
            items: {
              type: 'integer';
            };
          };
        };
      };
      ticket: {
        title: 'Ticket';
        type: 'object';
        'x-tags': ['Tickets'];
        description: 'Tickets are how you track requests from your users.';
        nullable: true;
        properties: {
          type: {
            type: 'string';
            description: 'Always ticket';
            enum: ['ticket'];
            default: 'ticket';
            example: 'ticket';
          };
          id: {
            type: 'string';
            description: 'The unique identifier for the ticket which is given by Intercom.';
            example: '1295';
          };
          ticket_id: {
            type: 'string';
            description: 'The ID of the Ticket used in the Intercom Inbox and Messenger. Do not use ticket_id for API queries.';
            example: '1390';
          };
          ticket_attributes: {
            $ref: '#/components/schemas/ticket_custom_attributes';
          };
          ticket_state: {
            type: 'string';
            description: 'The state the ticket is currenly in';
            enum: ['submitted', 'in_progress', 'waiting_on_customer', 'resolved'];
            example: 'submitted';
          };
          ticket_state_internal_label: {
            type: 'string';
            description: 'The state the ticket is currently in, in a human readable form - visible in Intercom';
          };
          ticket_state_external_label: {
            type: 'string';
            description: 'The state the ticket is currently in, in a human readable form - visible to customers, in the messenger, email and tickets portal.';
          };
          ticket_type: {
            $ref: '#/components/schemas/ticket_type';
          };
          contacts: {
            $ref: '#/components/schemas/ticket_contacts';
          };
          admin_assignee_id: {
            type: 'string';
            description: 'The id representing the admin assigned to the ticket.';
            example: '1295';
          };
          team_assignee_id: {
            type: 'string';
            description: 'The id representing the team assigned to the ticket.';
            example: '1295';
          };
          created_at: {
            type: 'integer';
            format: 'date-time';
            description: 'The time the ticket was created as a UTC Unix timestamp.';
            example: 1663597223;
          };
          updated_at: {
            type: 'integer';
            format: 'date-time';
            description: 'The last time the ticket was updated as a UTC Unix timestamp.';
            example: 1663597260;
          };
          ticket_parts: {
            $ref: '#/components/schemas/ticket_parts';
          };
          is_shared: {
            type: 'boolean';
            description: 'Whether or not the ticket is shared with the customer.';
            example: true;
          };
        };
      };
      ticket_contacts: {
        title: 'Contacts';
        type: 'object';
        'x-tags': ['Tickets'];
        description: 'The list of contacts affected by a ticket.';
        properties: {
          type: {
            type: 'string';
            description: 'always contact.list';
            enum: ['contact.list'];
            example: 'contact.list';
          };
          contacts: {
            type: 'array';
            description: 'The list of contacts affected by this ticket.';
            items: {
              $ref: '#/components/schemas/contact_reference';
            };
          };
        };
      };
      ticket_custom_attributes: {
        title: 'Ticket Attributes';
        type: 'object';
        description: 'An object containing the different attributes associated to the ticket as key-value pairs. For the default title and description attributes, the keys are `_default_title_` and `_default_description_`.';
        additionalProperties: {
          anyOf: [
            {
              type: 'string';
              nullable: true;
            },
            {
              type: 'number';
            },
            {
              type: 'boolean';
            },
            {
              type: 'array';
            },
            {
              $ref: '#/components/schemas/file_attribute';
            },
          ];
        };
        example: {
          _default_title_: 'Found a bug';
          _default_description_: "The button's not working";
        };
      };
      ticket_note: {
        title: 'A Ticket Part representing a note';
        type: 'object';
        description: 'A Ticket Part representing a note in the ticket';
        properties: {
          type: {
            type: 'string';
            description: 'Always ticket_part';
            example: 'ticket_part';
            enum: ['ticket_part'];
          };
          id: {
            type: 'string';
            description: 'The id representing the note.';
            example: '3';
          };
          part_type: {
            type: 'string';
            description: 'Always note';
            example: 'note';
            enum: ['note'];
          };
          body: {
            type: 'string';
            nullable: true;
            description: 'The message body, which may contain HTML.';
            example: '<p>Okay!</p>';
          };
          created_at: {
            type: 'integer';
            format: 'date-time';
            description: 'The time the note was created.';
            example: 1663597223;
          };
          updated_at: {
            type: 'integer';
            format: 'date-time';
            description: 'The last time the note was updated.';
            example: 1663597260;
          };
          author: {
            $ref: '#/components/schemas/ticket_part_author';
          };
          attachments: {
            title: 'Ticket part attachments';
            type: 'array';
            description: 'A list of attachments for the part.';
            items: {
              $ref: '#/components/schemas/part_attachment';
            };
          };
          redacted: {
            type: 'boolean';
            description: 'Whether or not the ticket part has been redacted.';
            example: false;
          };
        };
      };
      ticket_part: {
        title: 'Ticket Part';
        type: 'object';
        'x-tags': ['Tickets'];
        description: 'A Ticket Part represents a message in the ticket.';
        properties: {
          type: {
            type: 'string';
            description: 'Always ticket_part';
            example: 'ticket_part';
          };
          id: {
            type: 'string';
            description: 'The id representing the ticket part.';
            example: '3';
          };
          part_type: {
            type: 'string';
            description: 'The type of ticket part.';
            example: 'comment';
          };
          body: {
            type: 'string';
            nullable: true;
            description: 'The message body, which may contain HTML.';
            example: '<p>Okay!</p>';
          };
          previous_ticket_state: {
            type: 'string';
            enum: ['submitted', 'in_progress', 'waiting_on_customer', 'resolved'];
            description: 'The previous state of the ticket.';
            example: 'submitted';
          };
          ticket_state: {
            type: 'string';
            enum: ['submitted', 'in_progress', 'waiting_on_customer', 'resolved'];
            description: 'The state of the ticket.';
            example: 'submitted';
          };
          created_at: {
            type: 'integer';
            format: 'date-time';
            description: 'The time the ticket part was created.';
            example: 1663597223;
          };
          updated_at: {
            type: 'integer';
            format: 'date-time';
            description: 'The last time the ticket part was updated.';
            example: 1663597260;
          };
          assigned_to: {
            $ref: '#/components/schemas/reference';
            nullable: true;
            description: 'The id of the admin that was assigned the ticket by this ticket_part (null if there has been no change in assignment.)';
          };
          author: {
            $ref: '#/components/schemas/ticket_part_author';
          };
          attachments: {
            title: 'Ticket part attachments';
            type: 'array';
            description: 'A list of attachments for the part.';
            items: {
              $ref: '#/components/schemas/part_attachment';
            };
          };
          external_id: {
            type: 'string';
            nullable: true;
            description: 'The external id of the ticket part';
            example: 'abcd1234';
          };
          redacted: {
            type: 'boolean';
            description: 'Whether or not the ticket part has been redacted.';
            example: false;
          };
        };
      };
      ticket_part_author: {
        title: 'Ticket part author';
        type: 'object';
        description: 'The author that wrote or triggered the part. Can be a bot, admin, team or user.';
        properties: {
          type: {
            type: 'string';
            enum: ['admin', 'bot', 'team'];
          };
          id: {
            type: 'string';
            description: 'The id of the author';
            example: '274';
          };
          name: {
            type: 'string';
            nullable: true;
            description: 'The name of the author';
            example: 'Operator';
          };
          email: {
            type: 'string';
            format: 'email';
            description: 'The email of the author';
            example: 'operator+abcd1234@intercom.io';
          };
        };
      };
      ticket_parts: {
        title: 'Ticket Parts';
        type: 'object';
        description: 'A list of Ticket Part objects for each note and event in the ticket. There is a limit of 500 parts.';
        properties: {
          type: {
            type: 'string';
            description: '';
            enum: ['ticket_part.list'];
            example: 'ticket_part.list';
          };
          ticket_parts: {
            title: 'Tickt Parts';
            type: 'array';
            description: 'A list of Ticket Part objects for each ticket. There is a limit of 500 parts.';
            items: {
              $ref: '#/components/schemas/ticket_part';
            };
          };
          total_count: {
            type: 'integer';
            description: '';
            example: 2;
          };
        };
      };
      ticket_request_custom_attributes: {
        title: 'Ticket Attributes';
        type: 'object';
        description: 'The attributes set on the ticket. When setting the default title and description attributes, the attribute keys that should be used are `_default_title_` and `_default_description_`. When setting ticket type attributes of the list attribute type, the key should be the attribute name and the value of the attribute should be the list item id, obtainable by [listing the ticket type](ref:get_ticket-types). For example, if the ticket type has an attribute called `priority` of type `list`, the key should be `priority` and the value of the attribute should be the guid of the list item (e.g. `de1825a0-0164-4070-8ca6-13e22462fa7e`).';
        additionalProperties: {
          anyOf: [
            {
              type: 'string';
              nullable: true;
            },
            {
              type: 'number';
            },
            {
              type: 'boolean';
            },
            {
              type: 'array';
            },
          ];
        };
        example: {
          _default_title_: 'Found a bug';
          _default_description_: 'The button is not working';
        };
      };
      ticket_type: {
        title: 'Ticket Type';
        type: 'object';
        'x-tags': ['Tickets'];
        description: 'A ticket type, used to define the data fields to be captured in a ticket.';
        nullable: true;
        properties: {
          type: {
            type: 'string';
            description: "String representing the object's type. Always has the value `ticket_type`.";
            example: 'ticket_type';
          };
          id: {
            type: 'string';
            description: 'The id representing the ticket type.';
            example: '1295';
          };
          name: {
            type: 'string';
            description: 'The name of the ticket type';
            example: 'Bug';
          };
          description: {
            type: 'string';
            description: 'The description of the ticket type';
            example: 'A bug that has been reported.';
          };
          icon: {
            type: 'string';
            description: 'The icon of the ticket type';
            example: '🐞';
          };
          workspace_id: {
            type: 'string';
            description: 'The id of the workspace that the ticket type belongs to.';
            example: 'ecahpwf5';
          };
          ticket_type_attributes: {
            $ref: '#/components/schemas/ticket_type_attribute_list';
          };
          archived: {
            type: 'boolean';
            description: 'Whether the ticket type is archived or not.';
            example: false;
          };
          created_at: {
            type: 'integer';
            format: 'timestamp';
            description: 'The date and time the ticket type was created.';
          };
          updated_at: {
            type: 'integer';
            format: 'timestamp';
            description: 'The date and time the ticket type was last updated.';
          };
        };
      };
      ticket_type_attribute: {
        title: 'Ticket Type Attribute';
        type: 'object';
        description: 'Ticket type attribute, used to define each data field to be captured in a ticket.';
        nullable: true;
        properties: {
          type: {
            type: 'string';
            description: "String representing the object's type. Always has the value `ticket_type_attribute`.";
            example: 'ticket_type_attribute';
          };
          id: {
            type: 'string';
            description: 'The id representing the ticket type attribute.';
            example: '1';
          };
          workspace_id: {
            type: 'string';
            description: 'The id of the workspace that the ticket type attribute belongs to.';
            example: 'ecahpwf5';
          };
          name: {
            type: 'string';
            description: 'The name of the ticket type attribute';
            example: 'Title';
          };
          description: {
            type: 'string';
            description: 'The description of the ticket type attribute';
            example: 'Bug title.';
          };
          data_type: {
            type: 'string';
            description: 'The type of the data attribute (allowed values: "string list integer decimal boolean datetime files")';
            example: 'string';
          };
          input_options: {
            type: 'object';
            description: 'Input options for the attribute';
            example: 'multiline: true';
          };
          order: {
            type: 'integer';
            description: 'The order of the attribute against other attributes';
            example: 1;
          };
          required_to_create: {
            type: 'boolean';
            description: 'Whether the attribute is required or not for teammates.';
            default: false;
            example: false;
          };
          required_to_create_for_contacts: {
            type: 'boolean';
            description: 'Whether the attribute is required or not for contacts.';
            default: false;
            example: false;
          };
          visible_on_create: {
            type: 'boolean';
            description: 'Whether the attribute is visible or not to teammates.';
            default: true;
            example: false;
          };
          visible_to_contacts: {
            type: 'boolean';
            description: 'Whether the attribute is visible or not to contacts.';
            default: true;
            example: false;
          };
          default: {
            type: 'boolean';
            description: 'Whether the attribute is built in or not.';
            example: true;
          };
          ticket_type_id: {
            type: 'integer';
            description: 'The id of the ticket type that the attribute belongs to.';
            example: 42;
          };
          archived: {
            type: 'boolean';
            description: 'Whether the ticket type attribute is archived or not.';
            example: false;
          };
          created_at: {
            type: 'integer';
            format: 'timestamp';
            description: 'The date and time the ticket type attribute was created.';
          };
          updated_at: {
            type: 'integer';
            format: 'timestamp';
            description: 'The date and time the ticket type attribute was last updated.';
          };
        };
      };
      ticket_type_attribute_list: {
        title: 'Ticket Type Attributes';
        type: 'object';
        description: 'A list of attributes associated with a given ticket type.';
        properties: {
          type: {
            type: 'string';
            description: "String representing the object's type. Always has the value `ticket_type_attributes.list`.";
          };
          ticket_type_attributes: {
            type: 'array';
            description: 'A list of ticket type attributes associated with a given ticket type.';
            items: {
              $ref: '#/components/schemas/ticket_type_attribute';
            };
          };
        };
      };
      ticket_type_list: {
        title: 'Ticket Types';
        type: 'object';
        description: 'A list of ticket types associated with a given workspace.';
        properties: {
          type: {
            type: 'string';
            description: "String representing the object's type. Always has the value `ticket_type.list`.";
          };
          ticket_types: {
            type: 'array';
            description: 'A list of ticket_types associated with a given workspace.';
            items: {
              $ref: '#/components/schemas/ticket_type';
            };
          };
        };
      };
      translation: {
        title: 'Translation';
        type: 'object';
        description: 'A translation object contains the localised details of a subscription type.';
        properties: {
          name: {
            type: 'string';
            description: 'The localised name of the subscription type.';
            example: 'Announcements';
          };
          description: {
            type: 'string';
            description: 'The localised description of the subscription type.';
            example: 'Offers, product and feature announcements';
          };
          locale: {
            type: 'string';
            description: 'The two character identifier for the language of the translation object.';
            example: 'en';
          };
        };
      };
      untag_company_request: {
        description: 'You can tag a single company or a list of companies.';
        type: 'object';
        title: 'Untag Company Request Payload';
        properties: {
          name: {
            type: 'string';
            description: 'The name of the tag which will be untagged from the company';
            example: 'Independent';
          };
          companies: {
            type: 'array';
            items: {
              properties: {
                id: {
                  type: 'string';
                  description: 'The Intercom defined id representing the company.';
                  example: '531ee472cce572a6ec000006';
                };
                company_id: {
                  type: 'string';
                  description: 'The company id you have defined for the company.';
                  example: '6';
                };
                untag: {
                  type: 'boolean';
                  description: 'Always set to true';
                  example: 'true';
                };
              };
            };
            description: 'The id or company_id of the company can be passed as input parameters.';
          };
        };
        required: ['name', 'companies'];
      };
      update_article_request: {
        description: 'You can Update an Article';
        type: 'object';
        title: 'Update Article Request Payload';
        nullable: true;
        properties: {
          title: {
            type: 'string';
            description: "The title of the article.For multilingual articles, this will be the title of the default language's content.";
            example: 'Thanks for everything';
          };
          description: {
            type: 'string';
            description: "The description of the article. For multilingual articles, this will be the description of the default language's content.";
            example: 'Description of the Article';
          };
          body: {
            type: 'string';
            description: "The content of the article. For multilingual articles, this will be the body of the default language's content.";
            example: '<p>This is the body in html</p>';
          };
          author_id: {
            type: 'integer';
            description: "The id of the author of the article. For multilingual articles, this will be the id of the author of the default language's content. Must be a teammate on the help center's workspace.";
            example: 1295;
          };
          state: {
            type: 'string';
            description: "Whether the article will be `published` or will be a `draft`. Defaults to draft. For multilingual articles, this will be the state of the default language's content.";
            enum: ['published', 'draft'];
            example: 'draft';
          };
          parent_id: {
            type: 'string';
            description: "The id of the article's parent collection or section. An article without this field stands alone.";
            example: '18';
          };
          parent_type: {
            type: 'string';
            description: 'The type of parent, which can either be a `collection` or `section`.';
            example: 'collection';
          };
          translated_content: {
            $ref: '#/components/schemas/article_translated_content';
          };
        };
      };
      update_collection_request: {
        description: 'You can update a collection';
        type: 'object';
        title: 'Update Collection Request Payload';
        properties: {
          name: {
            type: 'string';
            description: "The name of the collection. For multilingual collections, this will be the name of the default language's content.";
            example: 'collection 51';
          };
          description: {
            type: 'string';
            description: "The description of the collection. For multilingual collections, this will be the description of the default language's content.";
            example: 'English description';
          };
          translated_content: {
            nullable: true;
            $ref: '#/components/schemas/group_translated_content';
          };
        };
      };
      update_contact_request: {
        description: 'You can update a contact';
        type: 'object';
        title: 'Update Contact Request Payload';
        properties: {
          role: {
            type: 'string';
            description: 'The role of the contact.';
          };
          external_id: {
            type: 'string';
            description: 'A unique identifier for the contact which is given to Intercom';
          };
          email: {
            type: 'string';
            description: 'The contacts email';
            example: 'jdoe@example.com';
          };
          phone: {
            type: 'string';
            nullable: true;
            description: 'The contacts phone';
            example: '+353871234567';
          };
          name: {
            type: 'string';
            nullable: true;
            description: 'The contacts name';
            example: 'John Doe';
          };
          avatar: {
            type: 'string';
            nullable: true;
            description: 'An image URL containing the avatar of a contact';
            example: 'https://www.example.com/avatar_image.jpg';
          };
          signed_up_at: {
            type: 'integer';
            format: 'date-time';
            nullable: true;
            description: 'The time specified for when a contact signed up';
            example: 1571672154;
          };
          last_seen_at: {
            type: 'integer';
            format: 'date-time';
            nullable: true;
            description: 'The time when the contact was last seen (either where the Intercom Messenger was installed or when specified manually)';
            example: 1571672154;
          };
          owner_id: {
            type: 'integer';
            nullable: true;
            description: 'The id of an admin that has been assigned account ownership of the contact';
            example: 123;
          };
          unsubscribed_from_emails: {
            type: 'boolean';
            nullable: true;
            description: 'Whether the contact is unsubscribed from emails';
            example: true;
          };
          custom_attributes: {
            type: 'object';
            nullable: true;
            description: 'The custom attributes which are set for the contact';
          };
        };
      };
      update_conversation_request: {
        title: 'Update Conversation Request';
        type: 'object';
        description: 'Payload of the request to update a conversation';
        properties: {
          read: {
            type: 'boolean';
            description: 'Mark a conversation as read within Intercom.';
            example: true;
          };
          custom_attributes: {
            $ref: '#/components/schemas/custom_attributes';
          };
        };
      };
      update_data_attribute_request: {
        description: '';
        type: 'object';
        title: 'Update Data Attribute Request';
        properties: {
          archived: {
            type: 'boolean';
            description: 'Whether the attribute is to be archived or not.';
            example: false;
          };
          description: {
            type: 'string';
            description: 'The readable description you see in the UI for the attribute.';
            example: 'My Data Attribute Description';
          };
          options: {
            type: 'array';
            description: 'To create list attributes. Provide a set of hashes with `value` as the key of the options you want to make. `data_type` must be `string`.';
            items: {
              type: 'string';
            };
            example: ['option1', 'option2'];
          };
          messenger_writable: {
            type: 'boolean';
            description: 'Can this attribute be updated by the Messenger';
            example: false;
          };
        };
      };
      update_section_request: {
        description: 'You can update a Section';
        type: 'object';
        title: 'Update Section Request Payload';
        properties: {
          name: {
            type: 'string';
            description: "The name of the collection. For multilingual collections, this will be the name of the default language's content.";
            example: 'Section 51';
          };
          parent_id: {
            type: 'integer';
            description: 'The id for the collection this section will be within.';
            example: 18;
          };
          translated_content: {
            nullable: true;
            $ref: '#/components/schemas/group_translated_content';
          };
        };
      };
      update_ticket_request: {
        description: 'You can update a Ticket';
        type: 'object';
        title: 'Update Ticket Request Payload';
        properties: {
          ticket_attributes: {
            type: 'object';
            description: 'The attributes set on the ticket.';
            example: {
              _default_title_: 'example';
              _default_description_: 'having a problem';
            };
          };
          state: {
            type: 'string';
            enum: ['in_progress', 'waiting_on_customer', 'resolved'];
            description: 'The state of the ticket.';
            example: 'submitted';
          };
          is_shared: {
            type: 'boolean';
            description: 'Specify whether the ticket is visible to users.';
            example: true;
          };
          assignment: {
            type: 'object';
            properties: {
              admin_id: {
                type: 'string';
                description: 'The ID of the admin performing the action.';
                example: '123';
              };
              assignee_id: {
                type: 'string';
                description: 'The ID of the admin or team to which the ticket is assigned. Set this 0 to unassign it.';
                example: '123';
              };
            };
          };
        };
      };
      update_ticket_type_attribute_request: {
        description: 'You can update a Ticket Type Attribute';
        type: 'object';
        title: 'Update Ticket Type Attribute Request Payload';
        properties: {
          name: {
            type: 'string';
            description: 'The name of the ticket type attribute';
            example: 'Bug Priority';
          };
          description: {
            type: 'string';
            description: 'The description of the attribute presented to the teammate or contact';
            example: 'Priority level of the bug';
          };
          required_to_create: {
            type: 'boolean';
            description: 'Whether the attribute is required to be filled in when teammates are creating the ticket in Inbox.';
            default: false;
            example: false;
          };
          required_to_create_for_contacts: {
            type: 'boolean';
            description: 'Whether the attribute is required to be filled in when contacts are creating the ticket in Messenger.';
            default: false;
            example: false;
          };
          visible_on_create: {
            type: 'boolean';
            description: 'Whether the attribute is visible to teammates when creating a ticket in Inbox.';
            default: true;
            example: true;
          };
          visible_to_contacts: {
            type: 'boolean';
            description: 'Whether the attribute is visible to contacts when creating a ticket in Messenger.';
            default: true;
            example: true;
          };
          multiline: {
            type: 'boolean';
            description: 'Whether the attribute allows multiple lines of text (only applicable to string attributes)';
            example: false;
          };
          list_items: {
            type: 'string';
            description: 'A comma delimited list of items for the attribute value (only applicable to list attributes)';
            example: 'Low Priority,Medium Priority,High Priority';
          };
          allow_multiple_values: {
            type: 'boolean';
            description: 'Whether the attribute allows multiple files to be attached to it (only applicable to file attributes)';
            example: false;
          };
          archived: {
            type: 'boolean';
            description: 'Whether the attribute should be archived and not shown during creation of the ticket (it will still be present on previously created tickets)';
            example: false;
          };
        };
      };
      update_ticket_type_request: {
        description: 'The request payload for updating a ticket type.\nYou can copy the `icon` property for your ticket type from [Twemoji Cheatsheet](https://twemoji-cheatsheet.vercel.app/)\n';
        type: 'object';
        title: 'Update Ticket Type Request Payload';
        nullable: true;
        properties: {
          name: {
            type: 'string';
            description: 'The name of the ticket type.';
            example: 'Bug';
          };
          description: {
            type: 'string';
            description: 'The description of the ticket type.';
            example: 'A bug has been occured';
          };
          icon: {
            type: 'string';
            description: 'The icon of the ticket type.';
            example: '🐞';
            default: '🎟️';
          };
          archived: {
            type: 'boolean';
            description: 'The archived status of the ticket type.';
            example: false;
          };
          is_internal: {
            type: 'boolean';
            description: 'Whether the tickets associated with this ticket type are intended for internal use only or will be shared with customers. This is currently a limited attribute.';
            example: false;
            default: false;
          };
        };
      };
      update_visitor_request: {
        description: 'Update an existing visitor.';
        type: 'object';
        title: 'Update Visitor Request Payload';
        properties: {
          id: {
            type: 'string';
            description: 'A unique identified for the visitor which is given by Intercom.';
            example: '8a88a590-e';
          };
          user_id: {
            type: 'string';
            description: 'A unique identified for the visitor which is given by you.';
            example: '123';
          };
          name: {
            type: 'string';
            description: "The visitor's name.";
            example: 'Christian Bale';
          };
          custom_attributes: {
            type: 'object';
            description: 'The custom attributes which are set for the visitor.';
            additionalProperties: {
              type: 'string';
            };
            example: {
              paid_subscriber: true;
              monthly_spend: 155.5;
              team_mates: 9;
            };
          };
        };
        anyOf: [
          {
            required: ['id'];
          },
          {
            required: ['user_id'];
          },
        ];
      };
      visitor: {
        title: 'Visitor';
        type: 'object';
        description: 'Visitors are useful for representing anonymous people that have not yet been identified. They usually represent website visitors. Visitors are not visible in Intercom platform. The Visitors resource provides methods to fetch, update, convert and delete.';
        nullable: true;
        properties: {
          type: {
            type: 'string';
            description: "Value is 'visitor'";
            default: 'visitor';
            example: 'visitor';
          };
          id: {
            type: 'string';
            description: 'The Intercom defined id representing the Visitor.';
            example: '530370b477ad7120001d';
          };
          user_id: {
            type: 'string';
            description: 'Automatically generated identifier for the Visitor.';
            example: '8a88a590-e1c3-41e2-a502-e0649dbf721c';
          };
          anonymous: {
            type: 'boolean';
            description: 'Identifies if this visitor is anonymous.';
            example: false;
          };
          email: {
            type: 'string';
            format: 'email';
            description: 'The email of the visitor.';
            example: 'jane.doe@example.com';
          };
          phone: {
            type: 'string';
            nullable: true;
            description: 'The phone number of the visitor.';
            example: '555-555-5555';
          };
          name: {
            type: 'string';
            nullable: true;
            description: 'The name of the visitor.';
            example: 'Jane Doe';
          };
          pseudonym: {
            type: 'string';
            nullable: true;
            description: 'The pseudonym of the visitor.';
            example: 'Red Duck from Dublin';
          };
          avatar: {
            type: 'object';
            properties: {
              type: {
                type: 'string';
                description: '';
                default: 'avatar';
                example: 'avatar';
              };
              image_url: {
                type: 'string';
                format: 'uri';
                nullable: true;
                description: 'This object represents the avatar associated with the visitor.';
                example: 'https://example.com/avatar.png';
              };
            };
          };
          app_id: {
            type: 'string';
            description: 'The id of the app the visitor is associated with.';
            example: 'hfi1bx4l';
          };
          companies: {
            type: 'object';
            properties: {
              type: {
                type: 'string';
                description: 'The type of the object';
                enum: ['company.list'];
                example: 'company.list';
              };
              companies: {
                type: 'array';
                items: {
                  $ref: '#/components/schemas/company';
                };
              };
            };
          };
          location_data: {
            type: 'object';
            properties: {
              type: {
                type: 'string';
                description: '';
                default: 'location_data';
                example: 'location_data';
              };
              city_name: {
                type: 'string';
                description: 'The city name of the visitor.';
                example: 'Dublin';
              };
              continent_code: {
                type: 'string';
                description: 'The continent code of the visitor.';
                example: 'EU';
              };
              country_code: {
                type: 'string';
                description: 'The country code of the visitor.';
                example: 'IRL';
              };
              country_name: {
                type: 'string';
                description: 'The country name of the visitor.';
                example: 'Ireland';
              };
              postal_code: {
                type: 'string';
                description: 'The postal code of the visitor.';
                example: 'D02 N960';
              };
              region_name: {
                type: 'string';
                description: 'The region name of the visitor.';
                example: 'Leinster';
              };
              timezone: {
                type: 'string';
                description: 'The timezone of the visitor.';
                example: 'Europe/Dublin';
              };
            };
          };
          las_request_at: {
            type: 'integer';
            description: 'The time the Lead last recorded making a request.';
            example: 1663597260;
          };
          created_at: {
            type: 'integer';
            description: 'The time the Visitor was added to Intercom.';
            example: 1663597223;
          };
          remote_created_at: {
            type: 'integer';
            description: 'The time the Visitor was added to Intercom.';
            example: 1663597223;
          };
          signed_up_at: {
            type: 'integer';
            description: 'The time the Visitor signed up for your product.';
            example: 1663597223;
          };
          updated_at: {
            type: 'integer';
            description: 'The last time the Visitor was updated.';
            example: 1663597260;
          };
          session_count: {
            type: 'integer';
            description: 'The number of sessions the Visitor has had.';
            example: 1;
          };
          social_profiles: {
            type: 'object';
            properties: {
              type: {
                type: 'string';
                description: 'The type of the object';
                enum: ['social_profile.list'];
                example: 'social_profile.list';
              };
              social_profiles: {
                type: 'array';
                items: {
                  type: 'string';
                };
              };
            };
          };
          owner_id: {
            type: 'string';
            nullable: true;
            description: 'The id of the admin that owns the Visitor.';
            example: '5169261';
          };
          unsubscribed_from_emails: {
            type: 'boolean';
            description: 'Whether the Visitor is unsubscribed from emails.';
            example: false;
          };
          marked_email_as_spam: {
            type: 'boolean';
            description: 'Identifies if this visitor has marked an email as spam.';
            example: false;
          };
          has_hard_bounced: {
            type: 'boolean';
            description: 'Identifies if this visitor has had a hard bounce.';
            example: false;
          };
          tags: {
            type: 'object';
            properties: {
              type: {
                type: 'string';
                description: 'The type of the object';
                enum: ['tag.list'];
                example: 'tag.list';
              };
              tags: {
                type: 'array';
                items: {
                  properties: {
                    type: {
                      type: 'string';
                      description: 'The type of the object';
                      enum: ['tag'];
                      example: 'tag';
                    };
                    id: {
                      type: 'string';
                      description: 'The id of the tag.';
                      example: '8482';
                    };
                    name: {
                      type: 'string';
                      description: 'The name of the tag.';
                      example: 'tag_name';
                    };
                  };
                };
              };
            };
          };
          segments: {
            type: 'object';
            properties: {
              type: {
                type: 'string';
                description: 'The type of the object';
                enum: ['segment.list'];
                example: 'segment.list';
              };
              segments: {
                type: 'array';
                items: {
                  type: 'string';
                };
              };
            };
          };
          custom_attributes: {
            type: 'object';
            description: 'The custom attributes you have set on the Visitor.';
            additionalProperties: {
              type: 'string';
            };
          };
          referrer: {
            type: 'string';
            nullable: true;
            description: 'The referer of the visitor.';
            example: 'https://www.google.com/';
          };
          utm_campaign: {
            type: 'string';
            nullable: true;
            description: 'The utm_campaign of the visitor.';
            example: 'intercom-link';
          };
          utm_content: {
            type: 'string';
            nullable: true;
            description: 'The utm_content of the visitor.';
            example: 'banner';
          };
          utm_medium: {
            type: 'string';
            nullable: true;
            description: 'The utm_medium of the visitor.';
            example: 'email';
          };
          utm_source: {
            type: 'string';
            nullable: true;
            description: 'The utm_source of the visitor.';
            example: 'Intercom';
          };
          utm_term: {
            type: 'string';
            nullable: true;
            description: 'The utm_term of the visitor.';
            example: 'messenger';
          };
          do_not_track: {
            type: 'boolean';
            nullable: true;
            description: 'Identifies if this visitor has do not track enabled.';
            example: false;
          };
        };
      };
      visitor_deleted_object: {
        title: 'Visitor Deleted Object';
        type: 'object';
        description: 'Response returned when an object is deleted';
        properties: {
          id: {
            type: 'string';
            description: 'The unique identifier for the visitor which is given by Intercom.';
            example: '530370b477ad7120001d';
          };
          type: {
            type: 'string';
            description: 'The type of object which was deleted';
            enum: ['visitor'];
            example: 'visitor';
          };
          user_id: {
            type: 'string';
            description: 'Automatically generated identifier for the Visitor.';
            example: '8a88a590-e1c3-41e2-a502-e0649dbf721c';
          };
        };
      };
    };
    securitySchemes: {
      bearerAuth: {
        type: 'http';
        scheme: 'bearer';
      };
    };
  };
  servers: [
    {
      url: 'https://api.intercom.io';
      description: 'The production API server';
    },
    {
      url: 'https://api.eu.intercom.io';
      description: 'The european API server';
    },
    {
      url: 'https://api.au.intercom.io';
      description: 'The australian API server';
    },
  ];
  security: [
    {
      bearerAuth: [];
    },
  ];
};
