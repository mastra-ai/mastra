// @ts-nocheck
export type TPaths = {
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
export const paths = {
  '/me': {
    get: {
      summary: 'Identify an admin',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
      ],
      tags: ['Admins'],
      operationId: 'identifyAdmin',
      description:
        '\nYou can view the currently authorised admin along with the embedded app object (a "workspace" in legacy terminology).\n\n> 🚧 Single Sign On\n>\n> If you are building a custom "Log in with Intercom" flow for your site, and you call the `/me` endpoint to identify the logged-in user, you should not accept any sign-ins from users with unverified email addresses as it poses a potential impersonation security risk.\n',
      responses: {
        '200': {
          description: 'Successful response',
          content: {
            'application/json': {
              examples: {
                'Successful response': {
                  value: {
                    type: 'admin',
                    id: '991267242',
                    email: 'admin1@email.com',
                    name: 'Ciaran1 Lee',
                    email_verified: true,
                    app: {
                      type: 'app',
                      id_code: 'this_is_an_id1_that_should_be_at_least_40',
                      name: 'MyApp 1',
                      created_at: 1717021328,
                      secure: false,
                      identity_verification: false,
                      timezone: 'America/Los_Angeles',
                      region: 'US',
                    },
                    avatar: {
                      type: 'avatar',
                      image_url: 'https://static.intercomassets.com/assets/default-avatars/admins/128.png',
                    },
                    has_inbox_seat: true,
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/admin_with_app',
              },
            },
          },
        },
      },
    },
  },
  '/admins/{id}/away': {
    put: {
      summary: 'Set an admin to away',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
        {
          name: 'id',
          in: 'path',
          required: true,
          description: 'The unique identifier of a given admin',
          schema: {
            type: 'integer',
          },
        },
      ],
      tags: ['Admins'],
      operationId: 'setAwayAdmin',
      description: 'You can set an Admin as away for the Inbox.',
      responses: {
        '200': {
          description: 'Successful response',
          content: {
            'application/json': {
              examples: {
                'Successful response': {
                  value: {
                    type: 'admin',
                    id: '991267243',
                    name: 'Ciaran2 Lee',
                    email: 'admin2@email.com',
                    away_mode_enabled: true,
                    away_mode_reassign: true,
                    has_inbox_seat: true,
                    team_ids: [],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/admin',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: 'ee1782d2-154b-4a94-824b-144059b4e321',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
        '404': {
          description: 'Admin not found',
          content: {
            'application/json': {
              examples: {
                'Admin not found': {
                  value: {
                    type: 'error.list',
                    request_id: '20a813b6-c6b4-4430-a9db-12956e806ec1',
                    errors: [
                      {
                        code: 'admin_not_found',
                        message: 'Admin for admin_id not found',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['away_mode_enabled', 'away_mode_reassign'],
              properties: {
                away_mode_enabled: {
                  type: 'boolean',
                  description: 'Set to "true" to change the status of the admin to away.',
                  example: true,
                  default: true,
                },
                away_mode_reassign: {
                  type: 'boolean',
                  description: 'Set to "true" to assign any new conversation replies to your default inbox.',
                  example: false,
                  default: false,
                },
              },
            },
            examples: {
              successful_response: {
                summary: 'Successful response',
                value: {
                  away_mode_enabled: true,
                  away_mode_reassign: true,
                },
              },
              admin_not_found: {
                summary: 'Admin not found',
                value: {
                  away_mode_enabled: true,
                  away_mode_reassign: true,
                },
              },
              unauthorized: {
                summary: 'Unauthorized',
                value: {
                  away_mode_enabled: true,
                  away_mode_reassign: true,
                },
              },
            },
          },
        },
      },
    },
  },
  '/admins/activity_logs': {
    get: {
      summary: 'List all activity logs',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
        {
          name: 'created_at_after',
          in: 'query',
          required: true,
          description: 'The start date that you request data for. It must be formatted as a UNIX timestamp.',
          example: '1677253093',
          schema: {
            type: 'string',
          },
        },
        {
          name: 'created_at_before',
          in: 'query',
          required: false,
          description: 'The end date that you request data for. It must be formatted as a UNIX timestamp.',
          example: '1677861493',
          schema: {
            type: 'string',
          },
        },
      ],
      tags: ['Admins'],
      operationId: 'listActivityLogs',
      description: 'You can get a log of activities by all admins in an app.',
      responses: {
        '200': {
          description: 'Successful response',
          content: {
            'application/json': {
              examples: {
                'Successful response': {
                  value: {
                    type: 'activity_log.list',
                    pages: {
                      type: 'pages',
                      next: null,
                      page: 1,
                      per_page: 20,
                      total_pages: 1,
                    },
                    activity_logs: [
                      {
                        id: 'b12d89d1-922f-4bec-b532-247bb581fd15',
                        performed_by: {
                          type: 'admin',
                          id: '991267247',
                          email: 'admin5@email.com',
                          ip: '127.0.0.1',
                        },
                        metadata: {
                          message: {
                            id: 123,
                            title: 'Initial message title',
                          },
                          before: 'Initial message title',
                          after: 'Eventual message title',
                        },
                        created_at: 1717021333,
                        activity_type: 'message_state_change',
                        activity_description:
                          'Ciaran5 Lee changed your Initial message title message from Initial message title to Eventual message title.',
                      },
                      {
                        id: 'ab862e22-dac4-430a-bd06-6324b9bfbe53',
                        performed_by: {
                          type: 'admin',
                          id: '991267247',
                          email: 'admin5@email.com',
                          ip: '127.0.0.1',
                        },
                        metadata: {
                          before: 'before',
                          after: 'after',
                        },
                        created_at: 1717021333,
                        activity_type: 'app_name_change',
                        activity_description: 'Ciaran5 Lee changed your app name from before to after.',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/activity_log_list',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: '69a6cf16-1eaf-42f3-bf89-e4a9944f5f89',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
    },
  },
  '/admins': {
    get: {
      summary: 'List all admins',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
      ],
      tags: ['Admins'],
      operationId: 'listAdmins',
      description: 'You can fetch a list of admins for a given workspace.',
      responses: {
        '200': {
          description: 'Successful response',
          content: {
            'application/json': {
              examples: {
                'Successful response': {
                  value: {
                    type: 'admin.list',
                    admins: [
                      {
                        type: 'admin',
                        email: 'admin7@email.com',
                        id: '991267249',
                        name: 'Ciaran7 Lee',
                        away_mode_enabled: false,
                        away_mode_reassign: false,
                        has_inbox_seat: true,
                        team_ids: [],
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/admin_list',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: '7ce06acd-f398-4faf-8fe8-7c5b8bc5c3ca',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
    },
  },
  '/admins/{id}': {
    get: {
      summary: 'Retrieve an admin',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
        {
          name: 'id',
          in: 'path',
          required: true,
          description: 'The unique identifier of a given admin',
          example: 123,
          schema: {
            type: 'integer',
          },
        },
      ],
      tags: ['Admins'],
      operationId: 'retrieveAdmin',
      description: 'You can retrieve the details of a single admin.',
      responses: {
        '200': {
          description: 'Admin found',
          content: {
            'application/json': {
              examples: {
                'Admin found': {
                  value: {
                    type: 'admin',
                    id: '991267251',
                    name: 'Ciaran9 Lee',
                    email: 'admin9@email.com',
                    away_mode_enabled: false,
                    away_mode_reassign: false,
                    has_inbox_seat: true,
                    team_ids: [],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/admin',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: '231aad72-f519-4f47-b436-663eb5046063',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
        '404': {
          description: 'Admin not found',
          content: {
            'application/json': {
              examples: {
                'Admin not found': {
                  value: {
                    type: 'error.list',
                    request_id: '8d8d85cb-c827-44f2-abee-58edbb4d1dda',
                    errors: [
                      {
                        code: 'admin_not_found',
                        message: 'Admin not found',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
    },
  },
  '/articles': {
    get: {
      summary: 'List all articles',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
      ],
      tags: ['Articles'],
      operationId: 'listArticles',
      description:
        "You can fetch a list of all articles by making a GET request to `https://api.intercom.io/articles`.\n\n> 📘 How are the articles sorted and ordered?\n>\n> Articles will be returned in descending order on the `updated_at` attribute. This means if you need to iterate through results then we'll show the most recently updated articles first.\n",
      responses: {
        '200': {
          description: 'successful',
          content: {
            'application/json': {
              examples: {
                successful: {
                  value: {
                    type: 'list',
                    pages: {
                      type: 'pages',
                      page: 1,
                      per_page: 25,
                      total_pages: 1,
                    },
                    total_count: 1,
                    data: [
                      {
                        id: '35',
                        type: 'article',
                        workspace_id: 'this_is_an_id33_that_should_be_at_least_4',
                        parent_id: 145,
                        parent_type: 'collection',
                        parent_ids: [],
                        title: 'This is the article title',
                        description: '',
                        body: '',
                        author_id: 991267254,
                        state: 'published',
                        created_at: 1717021340,
                        updated_at: 1717021340,
                        url: 'http://help-center.test/myapp-33/en/articles/35-this-is-the-article-title',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/article_list',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: '78e7c2d8-6d98-4b85-af8a-3e4ae5438eb3',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
    },
    post: {
      summary: 'Create an article',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
      ],
      tags: ['Articles'],
      operationId: 'createArticle',
      description: 'You can create a new article by making a POST request to `https://api.intercom.io/articles`.',
      responses: {
        '200': {
          description: 'article created',
          content: {
            'application/json': {
              examples: {
                'article created': {
                  value: {
                    id: '38',
                    type: 'article',
                    workspace_id: 'this_is_an_id37_that_should_be_at_least_4',
                    parent_id: 147,
                    parent_type: 'collection',
                    parent_ids: [],
                    statistics: {
                      type: 'article_statistics',
                      views: 0,
                      conversations: 0,
                      reactions: 0,
                      happy_reaction_percentage: 0,
                      neutral_reaction_percentage: 0,
                      sad_reaction_percentage: 0,
                    },
                    title: 'Thanks for everything',
                    description: 'Description of the Article',
                    body: '<p class="no-margin">Body of the Article</p>',
                    author_id: 991267259,
                    state: 'published',
                    created_at: 1717021342,
                    updated_at: 1717021342,
                    url: 'http://help-center.test/myapp-37/en/articles/38-thanks-for-everything',
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/article',
              },
            },
          },
        },
        '400': {
          description: 'Bad Request',
          content: {
            'application/json': {
              examples: {
                'Bad Request': {
                  value: {
                    type: 'error.list',
                    request_id: 'dc6520ae-9647-4c5e-a83f-344532dc9a59',
                    errors: [
                      {
                        code: 'parameter_not_found',
                        message: 'author_id must be in the main body or default locale translated_content object',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: '58823089-52e6-4242-8693-b881c74a26d7',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/create_article_request',
            },
            examples: {
              article_created: {
                summary: 'article created',
                value: {
                  title: 'Thanks for everything',
                  description: 'Description of the Article',
                  body: 'Body of the Article',
                  author_id: 991267259,
                  state: 'published',
                  parent_id: 147,
                  parent_type: 'collection',
                  translated_content: {
                    fr: {
                      title: 'Merci pour tout',
                      description: "Description de l'article",
                      body: "Corps de l'article",
                      author_id: 991267259,
                      state: 'published',
                    },
                  },
                },
              },
              bad_request: {
                summary: 'Bad Request',
                value: {
                  title: 'Thanks for everything',
                  description: 'Description of the Article',
                  body: 'Body of the Article',
                  state: 'published',
                },
              },
            },
          },
        },
      },
    },
  },
  '/articles/{id}': {
    get: {
      summary: 'Retrieve an article',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
        {
          name: 'id',
          in: 'path',
          required: true,
          description: 'The unique identifier for the article which is given by Intercom.',
          example: 123,
          schema: {
            type: 'integer',
          },
        },
      ],
      tags: ['Articles'],
      operationId: 'retrieveArticle',
      description:
        'You can fetch the details of a single article by making a GET request to `https://api.intercom.io/articles/<id>`.',
      responses: {
        '200': {
          description: 'Article found',
          content: {
            'application/json': {
              examples: {
                'Article found': {
                  value: {
                    id: '41',
                    type: 'article',
                    workspace_id: 'this_is_an_id43_that_should_be_at_least_4',
                    parent_id: 150,
                    parent_type: 'collection',
                    parent_ids: [],
                    statistics: {
                      type: 'article_statistics',
                      views: 0,
                      conversations: 0,
                      reactions: 0,
                      happy_reaction_percentage: 0,
                      neutral_reaction_percentage: 0,
                      sad_reaction_percentage: 0,
                    },
                    title: 'This is the article title',
                    description: '',
                    body: '',
                    author_id: 991267264,
                    state: 'published',
                    created_at: 1717021344,
                    updated_at: 1717021344,
                    url: 'http://help-center.test/myapp-43/en/articles/41-this-is-the-article-title',
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/article',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: '4df4917b-c4d0-45a9-a61e-6c3597e96e10',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
        '404': {
          description: 'Article not found',
          content: {
            'application/json': {
              examples: {
                'Article not found': {
                  value: {
                    type: 'error.list',
                    request_id: 'f15f878f-3fb3-47f0-acc7-c7adcef0c61d',
                    errors: [
                      {
                        code: 'not_found',
                        message: 'Resource Not Found',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
    },
    put: {
      summary: 'Update an article',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
        {
          name: 'id',
          in: 'path',
          required: true,
          description: 'The unique identifier for the article which is given by Intercom.',
          example: 123,
          schema: {
            type: 'integer',
          },
        },
      ],
      tags: ['Articles'],
      operationId: 'updateArticle',
      description:
        'You can update the details of a single article by making a PUT request to `https://api.intercom.io/articles/<id>`.',
      responses: {
        '200': {
          description: 'successful',
          content: {
            'application/json': {
              examples: {
                successful: {
                  value: {
                    id: '44',
                    type: 'article',
                    workspace_id: 'this_is_an_id49_that_should_be_at_least_4',
                    parent_id: 153,
                    parent_type: 'collection',
                    parent_ids: [],
                    statistics: {
                      type: 'article_statistics',
                      views: 0,
                      conversations: 0,
                      reactions: 0,
                      happy_reaction_percentage: 0,
                      neutral_reaction_percentage: 0,
                      sad_reaction_percentage: 0,
                    },
                    title: 'Christmas is here!',
                    description: '',
                    body: '<p class="no-margin">New gifts in store for the jolly season</p>',
                    author_id: 991267270,
                    state: 'published',
                    created_at: 1717021347,
                    updated_at: 1717021347,
                    url: 'http://help-center.test/myapp-49/en/articles/44-christmas-is-here',
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/article',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: 'b48c9005-6e42-46aa-a792-ffe1279164c0',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
        '404': {
          description: 'Article Not Found',
          content: {
            'application/json': {
              examples: {
                'Article Not Found': {
                  value: {
                    type: 'error.list',
                    request_id: 'ebc188c3-3680-4724-a6a4-939f760cf1ff',
                    errors: [
                      {
                        code: 'not_found',
                        message: 'Resource Not Found',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/update_article_request',
            },
            examples: {
              successful: {
                summary: 'successful',
                value: {
                  title: 'Christmas is here!',
                  body: '<p>New gifts in store for the jolly season</p>',
                },
              },
              article_not_found: {
                summary: 'Article Not Found',
                value: {
                  title: 'Christmas is here!',
                  body: '<p>New gifts in store for the jolly season</p>',
                },
              },
            },
          },
        },
      },
    },
    delete: {
      summary: 'Delete an article',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
        {
          name: 'id',
          in: 'path',
          required: true,
          description: 'The unique identifier for the article which is given by Intercom.',
          example: 123,
          schema: {
            type: 'integer',
          },
        },
      ],
      tags: ['Articles'],
      operationId: 'deleteArticle',
      description:
        'You can delete a single article by making a DELETE request to `https://api.intercom.io/articles/<id>`.',
      responses: {
        '200': {
          description: 'successful',
          content: {
            'application/json': {
              examples: {
                successful: {
                  value: {
                    id: '47',
                    object: 'article',
                    deleted: true,
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/deleted_article_object',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: '50e2264e-9795-4eda-839b-8435da6eb115',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
        '404': {
          description: 'Article Not Found',
          content: {
            'application/json': {
              examples: {
                'Article Not Found': {
                  value: {
                    type: 'error.list',
                    request_id: '1c891e3d-b5c7-4f63-93f1-c131397c71ec',
                    errors: [
                      {
                        code: 'not_found',
                        message: 'Resource Not Found',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
    },
  },
  '/help_center/collections': {
    get: {
      summary: 'List all collections',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
      ],
      tags: ['Help Center'],
      operationId: 'listAllCollections',
      description:
        "You can fetch a list of all collections by making a GET request to `https://api.intercom.io/help_center/collections`.\n\nCollections will be returned in descending order on the `updated_at` attribute. This means if you need to iterate through results then we'll show the most recently updated collections first.\n",
      responses: {
        '200': {
          description: 'Successful',
          content: {
            'application/json': {
              examples: {
                Successful: {
                  value: {
                    type: 'list',
                    data: [
                      {
                        id: '161',
                        workspace_id: 'this_is_an_id63_that_should_be_at_least_4',
                        name: 'English collection title',
                        url: 'http://help-center.test/myapp-63/collection-17',
                        order: 17,
                        created_at: 1717021353,
                        updated_at: 1717021353,
                        description: 'english collection description',
                        icon: 'bookmark',
                        help_center_id: 89,
                        type: 'collection',
                      },
                    ],
                    total_count: 1,
                    pages: {
                      type: 'pages',
                      page: 1,
                      per_page: 20,
                      total_pages: 1,
                    },
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/collection_list',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: '26131e21-0b21-495d-8931-162525858184',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
    },
    post: {
      summary: 'Create a collection',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
      ],
      tags: ['Help Center'],
      operationId: 'createCollection',
      description:
        'You can create a new collection by making a POST request to `https://api.intercom.io/help_center/collections.`',
      responses: {
        '200': {
          description: 'collection created',
          content: {
            'application/json': {
              examples: {
                'collection created': {
                  value: {
                    id: '167',
                    workspace_id: 'this_is_an_id67_that_should_be_at_least_4',
                    name: 'Thanks for everything',
                    url: 'http://help-center.test/myapp-67/',
                    order: 1,
                    created_at: 1717021354,
                    updated_at: 1717021354,
                    description: '',
                    icon: 'book-bookmark',
                    help_center_id: 91,
                    type: 'collection',
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/collection',
              },
            },
          },
        },
        '400': {
          description: 'Bad Request',
          content: {
            'application/json': {
              examples: {
                'Bad Request': {
                  value: {
                    type: 'error.list',
                    request_id: '7ad38384-798f-4780-a4e7-98e6e52ca290',
                    errors: [
                      {
                        code: 'parameter_not_found',
                        message: 'Name is a required parameter.',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: '834f5ddd-4c83-457a-848f-054e4bd86eae',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/create_collection_request',
            },
            examples: {
              collection_created: {
                summary: 'collection created',
                value: {
                  name: 'Thanks for everything',
                },
              },
              bad_request: {
                summary: 'Bad Request',
                value: {
                  description: 'Missing required parameter',
                },
              },
            },
          },
        },
      },
    },
  },
  '/help_center/collections/{id}': {
    get: {
      summary: 'Retrieve a collection',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
        {
          name: 'id',
          in: 'path',
          required: true,
          description: 'The unique identifier for the collection which is given by Intercom.',
          example: 123,
          schema: {
            type: 'integer',
          },
        },
      ],
      tags: ['Help Center'],
      operationId: 'retrieveCollection',
      description:
        'You can fetch the details of a single collection by making a GET request to `https://api.intercom.io/help_center/collections/<id>`.',
      responses: {
        '200': {
          description: 'Collection found',
          content: {
            'application/json': {
              examples: {
                'Collection found': {
                  value: {
                    id: '172',
                    workspace_id: 'this_is_an_id73_that_should_be_at_least_4',
                    name: 'English collection title',
                    url: 'http://help-center.test/myapp-73/collection-22',
                    order: 22,
                    created_at: 1717021355,
                    updated_at: 1717021355,
                    description: 'english collection description',
                    icon: 'bookmark',
                    help_center_id: 94,
                    type: 'collection',
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/collection',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: 'f4bd9fb5-b105-4f16-971a-7f0ba29023f1',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
        '404': {
          description: 'Collection not found',
          content: {
            'application/json': {
              examples: {
                'Collection not found': {
                  value: {
                    type: 'error.list',
                    request_id: 'c5a684d9-dde7-426d-b220-e624931cc6df',
                    errors: [
                      {
                        code: 'not_found',
                        message: 'Resource Not Found',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
    },
    put: {
      summary: 'Update a collection',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
        {
          name: 'id',
          in: 'path',
          required: true,
          description: 'The unique identifier for the collection which is given by Intercom.',
          example: 123,
          schema: {
            type: 'integer',
          },
        },
      ],
      tags: ['Help Center'],
      operationId: 'updateCollection',
      description:
        'You can update the details of a single collection by making a PUT request to `https://api.intercom.io/collections/<id>`.',
      responses: {
        '200': {
          description: 'successful',
          content: {
            'application/json': {
              examples: {
                successful: {
                  value: {
                    id: '178',
                    workspace_id: 'this_is_an_id79_that_should_be_at_least_4',
                    name: 'Update collection name',
                    url: 'http://help-center.test/myapp-79/collection-25',
                    order: 25,
                    created_at: 1717021357,
                    updated_at: 1717021357,
                    description: 'english collection description',
                    icon: 'folder',
                    help_center_id: 97,
                    type: 'collection',
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/collection',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: '7ba596ad-8e27-4dbc-8c3d-4982d3c8b988',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
        '404': {
          description: 'Collection Not Found',
          content: {
            'application/json': {
              examples: {
                'Collection Not Found': {
                  value: {
                    type: 'error.list',
                    request_id: '63095699-29bc-4fd8-bb65-0de9b8e547a1',
                    errors: [
                      {
                        code: 'not_found',
                        message: 'Resource Not Found',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/update_collection_request',
            },
            examples: {
              successful: {
                summary: 'successful',
                value: {
                  name: 'Update collection name',
                },
              },
              collection_not_found: {
                summary: 'Collection Not Found',
                value: {
                  name: 'Update collection name',
                },
              },
            },
          },
        },
      },
    },
    delete: {
      summary: 'Delete a collection',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
        {
          name: 'id',
          in: 'path',
          required: true,
          description: 'The unique identifier for the collection which is given by Intercom.',
          example: 123,
          schema: {
            type: 'integer',
          },
        },
      ],
      tags: ['Help Center'],
      operationId: 'deleteCollection',
      description:
        'You can delete a single collection by making a DELETE request to `https://api.intercom.io/collections/<id>`.',
      responses: {
        '200': {
          description: 'successful',
          content: {
            'application/json': {
              examples: {
                successful: {
                  value: {
                    id: '184',
                    object: 'collection',
                    deleted: true,
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/deleted_collection_object',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: '0c63c1fa-7eef-47e7-a49c-cff4bb859cb2',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
        '404': {
          description: 'collection Not Found',
          content: {
            'application/json': {
              examples: {
                'collection Not Found': {
                  value: {
                    type: 'error.list',
                    request_id: '4d55ff13-21ee-4dae-835a-dca073c727e6',
                    errors: [
                      {
                        code: 'not_found',
                        message: 'Resource Not Found',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
    },
  },
  '/help_center/help_centers/{id}': {
    get: {
      summary: 'Retrieve a Help Center',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
        {
          name: 'id',
          in: 'path',
          required: true,
          description: 'The unique identifier for the collection which is given by Intercom.',
          example: 123,
          schema: {
            type: 'integer',
          },
        },
      ],
      tags: ['Help Center'],
      operationId: 'retrieveHelpCenter',
      description:
        'You can fetch the details of a single Help Center by making a GET request to `https://api.intercom.io/help_center/help_center/<id>`.',
      responses: {
        '200': {
          description: 'Collection found',
          content: {
            'application/json': {
              examples: {
                'Collection found': {
                  value: {
                    id: '103',
                    workspace_id: 'this_is_an_id91_that_should_be_at_least_4',
                    created_at: 1717021361,
                    updated_at: 1717021361,
                    identifier: 'help-center-1',
                    website_turned_on: false,
                    display_name: 'Intercom Help Center',
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/help_center',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: 'ba42a13b-92b4-4322-8c13-10ed6ffd493e',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
        '404': {
          description: 'Collection not found',
          content: {
            'application/json': {
              examples: {
                'Collection not found': {
                  value: {
                    type: 'error.list',
                    request_id: '19d9dda0-1643-4a16-8b4e-e1690ef5d27c',
                    errors: [
                      {
                        code: 'not_found',
                        message: 'Resource Not Found',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
    },
  },
  '/help_center/help_centers': {
    get: {
      summary: 'List all Help Centers',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
      ],
      tags: ['Help Center'],
      operationId: 'listHelpCenters',
      description:
        'You can list all Help Centers by making a GET request to `https://api.intercom.io/help_center/help_centers`.',
      responses: {
        '200': {
          description: 'Help Centers found',
          content: {
            'application/json': {
              examples: {
                'Help Centers found': {
                  value: {
                    type: 'list',
                    data: [],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/help_center_list',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: '8f33a54a-8db1-43c2-9a80-59e0e6779333',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
    },
  },
  '/help_center/sections': {
    get: {
      summary: 'List all sections',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
      ],
      tags: ['Help Center'],
      operationId: 'listAllSections',
      description:
        "You can fetch a list of all sections by making a GET request to `https://api.intercom.io/help_center/sections`.\n> 📘 How are the sections sorted and ordered?\n>\n> Sections will be returned in descending order on the `updated_at` attribute. This means if you need to iterate through results then we'll show the most recently updated sections first.\n",
      responses: {
        '200': {
          description: 'Successful',
          content: {
            'application/json': {
              examples: {
                Successful: {
                  value: {
                    type: 'list',
                    data: [
                      {
                        id: '191',
                        workspace_id: 'this_is_an_id101_that_should_be_at_least_',
                        name: 'English section title',
                        url: 'http://help-center.test/myapp-101/section-15',
                        order: 15,
                        created_at: 1717021363,
                        updated_at: 1717021363,
                        type: 'section',
                        parent_id: 190,
                      },
                    ],
                    total_count: 1,
                    pages: {
                      type: 'pages',
                      page: 1,
                      per_page: 20,
                      total_pages: 1,
                    },
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/section_list',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: 'cf47bffc-9759-4792-8556-a25fbe66ed45',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
    },
    post: {
      summary: 'Create a section',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
      ],
      tags: ['Help Center'],
      operationId: 'createSection',
      description:
        'You can create a new section by making a POST request to `https://api.intercom.io/help_center/sections.`',
      responses: {
        '200': {
          description: 'section created',
          content: {
            'application/json': {
              examples: {
                'section created': {
                  value: {
                    id: '196',
                    workspace_id: 'this_is_an_id105_that_should_be_at_least_',
                    name: 'Thanks for everything',
                    url: 'http://help-center.test/myapp-105/',
                    order: 1,
                    created_at: 1717021364,
                    updated_at: 1717021364,
                    type: 'section',
                    parent_id: '194',
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/section',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: '3053d544-e1a1-4fd8-9662-0f74ff782f14',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/create_section_request',
            },
            examples: {
              section_created: {
                summary: 'section created',
                value: {
                  name: 'Thanks for everything',
                  parent_id: 194,
                },
              },
            },
          },
        },
      },
    },
  },
  '/help_center/sections/{id}': {
    get: {
      summary: 'Retrieve a section',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
        {
          name: 'id',
          in: 'path',
          required: true,
          description: 'The unique identifier for the section which is given by Intercom.',
          example: 123,
          schema: {
            type: 'integer',
          },
        },
      ],
      tags: ['Help Center'],
      operationId: 'retrieveSection',
      description:
        'You can fetch the details of a single section by making a GET request to `https://api.intercom.io/help_center/sections/<id>`.',
      responses: {
        '200': {
          description: 'Section found',
          content: {
            'application/json': {
              examples: {
                'Section found': {
                  value: {
                    id: '200',
                    workspace_id: 'this_is_an_id109_that_should_be_at_least_',
                    name: 'English section title',
                    url: 'http://help-center.test/myapp-109/section-19',
                    order: 19,
                    created_at: 1717021365,
                    updated_at: 1717021365,
                    type: 'section',
                    parent_id: 199,
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/section',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: 'ddd1b999-84bc-414b-8e83-d47e3fb1660a',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
        '404': {
          description: 'Section not found',
          content: {
            'application/json': {
              examples: {
                'Section not found': {
                  value: {
                    type: 'error.list',
                    request_id: '6fccbab7-24fa-4eed-8686-c241d4bbdb86',
                    errors: [
                      {
                        code: 'not_found',
                        message: 'Resource Not Found',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
    },
    put: {
      summary: 'Update a section',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
        {
          name: 'id',
          in: 'path',
          required: true,
          description: 'The unique identifier for the section which is given by Intercom.',
          example: 123,
          schema: {
            type: 'integer',
          },
        },
      ],
      tags: ['Help Center'],
      operationId: 'updateSection',
      description:
        'You can update the details of a single section by making a PUT request to `https://api.intercom.io/sections/<id>`.',
      responses: {
        '200': {
          description: 'successful',
          content: {
            'application/json': {
              examples: {
                successful: {
                  value: {
                    id: '206',
                    workspace_id: 'this_is_an_id115_that_should_be_at_least_',
                    name: 'Update section name',
                    url: 'http://help-center.test/myapp-115/section-22',
                    order: 22,
                    created_at: 1717021366,
                    updated_at: 1717021367,
                    type: 'section',
                    parent_id: '205',
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/section',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: '1c08c7df-d5a9-4227-aba7-d252280baaaa',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
        '404': {
          description: 'Section Not Found',
          content: {
            'application/json': {
              examples: {
                'Section Not Found': {
                  value: {
                    type: 'error.list',
                    request_id: '70d7d473-e3d1-4630-b310-3e7a327e9a74',
                    errors: [
                      {
                        code: 'not_found',
                        message: 'Resource Not Found',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/update_section_request',
            },
            examples: {
              successful: {
                summary: 'successful',
                value: {
                  name: 'Update section name',
                  parent_id: 205,
                },
              },
              section_not_found: {
                summary: 'Section Not Found',
                value: {
                  name: 'Update section name',
                  parent_id: 207,
                },
              },
            },
          },
        },
      },
    },
    delete: {
      summary: 'Delete a section',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
        {
          name: 'id',
          in: 'path',
          required: true,
          description: 'The unique identifier for the section which is given by Intercom.',
          example: 123,
          schema: {
            type: 'integer',
          },
        },
      ],
      tags: ['Help Center'],
      operationId: 'deleteSection',
      description:
        'You can delete a single section by making a DELETE request to `https://api.intercom.io/sections/<id>`.',
      responses: {
        '200': {
          description: 'successful',
          content: {
            'application/json': {
              examples: {
                successful: {
                  value: {
                    id: '212',
                    object: 'section',
                    deleted: true,
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/deleted_section_object',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: 'f48d51c1-cebd-4805-9268-4a8c8459cc4f',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
        '404': {
          description: 'section Not Found',
          content: {
            'application/json': {
              examples: {
                'section Not Found': {
                  value: {
                    type: 'error.list',
                    request_id: 'd2b2e713-177e-43e9-9e07-51ba367845c9',
                    errors: [
                      {
                        code: 'not_found',
                        message: 'Resource Not Found',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
    },
  },
  '/companies': {
    post: {
      summary: 'Create or Update a company',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
      ],
      tags: ['Companies'],
      operationId: 'createOrUpdateCompany',
      description:
        'You can create or update a company.\n\nCompanies will be only visible in Intercom when there is at least one associated user.\n\nCompanies are looked up via `company_id` in a `POST` request, if not found via `company_id`, the new company will be created, if found, that company will be updated.\n\n{% admonition type="attention" name="Using `company_id`" %}\n  You can set a unique `company_id` value when creating a company. However, it is not possible to update `company_id`. Be sure to set a unique value once upon creation of the company.\n{% /admonition %}\n',
      responses: {
        '200': {
          description: 'Successful',
          content: {
            'application/json': {
              examples: {
                Successful: {
                  value: {
                    type: 'company',
                    company_id: 'company_remote_id',
                    id: '6657aaba6abd0164c24b0c8e',
                    app_id: 'this_is_an_id127_that_should_be_at_least_',
                    name: 'my company',
                    remote_created_at: 1374138000,
                    created_at: 1717021370,
                    updated_at: 1717021370,
                    monthly_spend: 0,
                    session_count: 0,
                    user_count: 0,
                    tags: {
                      type: 'tag.list',
                      tags: [],
                    },
                    segments: {
                      type: 'segment.list',
                      segments: [],
                    },
                    plan: {},
                    custom_attributes: {
                      creation_source: 'api',
                    },
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/company',
              },
            },
          },
        },
        '400': {
          description: 'Bad Request',
          content: {
            'application/json': {
              examples: {
                'Bad Request': {
                  value: {
                    type: 'error.list',
                    request_id: null,
                    errors: [
                      {
                        code: 'bad_request',
                        message: "bad 'test' parameter",
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: 'bfe6a349-0654-4e5e-b9c8-f3fdda83e0fa',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/create_or_update_company_request',
            },
            examples: {
              successful: {
                summary: 'Successful',
                value: {
                  company_id: 'company_remote_id',
                  name: 'my company',
                  remote_created_at: 1374138000,
                },
              },
              bad_request: {
                summary: 'Bad Request',
                value: {
                  test: 'invalid',
                },
              },
            },
          },
        },
      },
    },
    get: {
      summary: 'Retrieve companies',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
        {
          name: 'name',
          in: 'query',
          required: false,
          description: 'The `name` of the company to filter by.',
          example: 'my company',
          schema: {
            type: 'string',
          },
        },
        {
          name: 'company_id',
          in: 'query',
          required: false,
          description: 'The `company_id` of the company to filter by.',
          example: '12345',
          schema: {
            type: 'string',
          },
        },
        {
          name: 'tag_id',
          in: 'query',
          required: false,
          description: 'The `tag_id` of the company to filter by.',
          example: '678910',
          schema: {
            type: 'string',
          },
        },
        {
          name: 'segment_id',
          in: 'query',
          required: false,
          description: 'The `segment_id` of the company to filter by.',
          example: '98765',
          schema: {
            type: 'string',
          },
        },
        {
          name: 'page',
          in: 'query',
          required: false,
          description: 'The page of results to fetch. Defaults to first page',
          example: 1,
          schema: {
            type: 'integer',
          },
        },
        {
          name: 'per_page',
          in: 'query',
          required: false,
          description: 'How many results to display per page. Defaults to 15',
          example: 15,
          schema: {
            type: 'integer',
          },
        },
      ],
      tags: ['Companies'],
      operationId: 'retrieveCompany',
      description:
        'You can fetch a single company by passing in `company_id` or `name`.\n\n  `https://api.intercom.io/companies?name={name}`\n\n  `https://api.intercom.io/companies?company_id={company_id}`\n\nYou can fetch all companies and filter by `segment_id` or `tag_id` as a query parameter.\n\n  `https://api.intercom.io/companies?tag_id={tag_id}`\n\n  `https://api.intercom.io/companies?segment_id={segment_id}`\n',
      responses: {
        '200': {
          description: 'Successful',
          content: {
            'application/json': {
              examples: {
                Successful: {
                  value: {
                    type: 'list',
                    data: [
                      {
                        type: 'company',
                        company_id: 'remote_companies_scroll_2',
                        id: '6657aabc6abd0164c24b0c96',
                        app_id: 'this_is_an_id133_that_should_be_at_least_',
                        name: 'IntercomQATest1',
                        remote_created_at: 1717021372,
                        created_at: 1717021372,
                        updated_at: 1717021372,
                        monthly_spend: 0,
                        session_count: 0,
                        user_count: 4,
                        tags: {
                          type: 'tag.list',
                          tags: [],
                        },
                        segments: {
                          type: 'segment.list',
                          segments: [],
                        },
                        plan: {},
                        custom_attributes: {},
                      },
                    ],
                    pages: {
                      type: 'pages',
                      next: null,
                      page: 1,
                      per_page: 15,
                      total_pages: 1,
                    },
                    total_count: 1,
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/company_list',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: '7aebb259-19d4-4319-87ef-5be8441c07b6',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
        '404': {
          description: 'Company Not Found',
          content: {
            'application/json': {
              examples: {
                'Company Not Found': {
                  value: {
                    type: 'error.list',
                    request_id: '1f01a6c6-5bfd-4b36-9778-aaf35e7c40b3',
                    errors: [
                      {
                        code: 'company_not_found',
                        message: 'Company Not Found',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
    },
  },
  '/companies/{id}': {
    get: {
      summary: 'Retrieve a company by ID',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
        {
          name: 'id',
          in: 'path',
          required: true,
          description: 'The unique identifier for the company which is given by Intercom',
          example: '5f4d3c1c-7b1b-4d7d-a97e-6095715c6632',
          schema: {
            type: 'string',
          },
        },
      ],
      tags: ['Companies'],
      operationId: 'RetrieveACompanyById',
      description: 'You can fetch a single company.',
      responses: {
        '200': {
          description: 'Successful',
          content: {
            'application/json': {
              examples: {
                Successful: {
                  value: {
                    type: 'company',
                    company_id: '1',
                    id: '6657aabe6abd0164c24b0ca1',
                    app_id: 'this_is_an_id139_that_should_be_at_least_',
                    name: 'company1',
                    remote_created_at: 1717021374,
                    created_at: 1717021374,
                    updated_at: 1717021374,
                    monthly_spend: 0,
                    session_count: 0,
                    user_count: 1,
                    tags: {
                      type: 'tag.list',
                      tags: [],
                    },
                    segments: {
                      type: 'segment.list',
                      segments: [],
                    },
                    plan: {},
                    custom_attributes: {},
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/company',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: 'a2e85fb1-4b73-4001-81f1-59b1eae9acbe',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
        '404': {
          description: 'Company Not Found',
          content: {
            'application/json': {
              examples: {
                'Company Not Found': {
                  value: {
                    type: 'error.list',
                    request_id: '6f14da94-ea76-4693-8ee8-f7d0cfdf4c6e',
                    errors: [
                      {
                        code: 'company_not_found',
                        message: 'Company Not Found',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
    },
    put: {
      summary: 'Update a company',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
        {
          name: 'id',
          in: 'path',
          required: true,
          description: 'The unique identifier for the company which is given by Intercom',
          example: '5f4d3c1c-7b1b-4d7d-a97e-6095715c6632',
          schema: {
            type: 'string',
          },
        },
      ],
      tags: ['Companies'],
      operationId: 'UpdateCompany',
      description:
        'You can update a single company using the Intercom provisioned `id`.\n\n{% admonition type="attention" name="Using `company_id`" %}\n  When updating a company it is not possible to update `company_id`. This can only be set once upon creation of the company.\n{% /admonition %}\n',
      responses: {
        '200': {
          description: 'Successful',
          content: {
            'application/json': {
              examples: {
                Successful: {
                  value: {
                    type: 'company',
                    company_id: '1',
                    id: '6657aac06abd0164c24b0cab',
                    app_id: 'this_is_an_id145_that_should_be_at_least_',
                    name: 'company2',
                    remote_created_at: 1717021376,
                    created_at: 1717021376,
                    updated_at: 1717021376,
                    monthly_spend: 0,
                    session_count: 0,
                    user_count: 1,
                    tags: {
                      type: 'tag.list',
                      tags: [],
                    },
                    segments: {
                      type: 'segment.list',
                      segments: [],
                    },
                    plan: {},
                    custom_attributes: {},
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/company',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: '5457ba38-3d4e-47c1-98f2-8ea519cbd63f',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
        '404': {
          description: 'Company Not Found',
          content: {
            'application/json': {
              examples: {
                'Company Not Found': {
                  value: {
                    type: 'error.list',
                    request_id: '1dc7b16f-9368-42a7-97e7-db4068df5c6c',
                    errors: [
                      {
                        code: 'company_not_found',
                        message: 'Company Not Found',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
    },
    delete: {
      summary: 'Delete a company',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
        {
          name: 'id',
          in: 'path',
          required: true,
          description: 'The unique identifier for the company which is given by Intercom',
          example: '5f4d3c1c-7b1b-4d7d-a97e-6095715c6632',
          schema: {
            type: 'string',
          },
        },
      ],
      tags: ['Companies'],
      operationId: 'deleteCompany',
      description: 'You can delete a single company.',
      responses: {
        '200': {
          description: 'Successful',
          content: {
            'application/json': {
              examples: {
                Successful: {
                  value: {
                    id: '6657aac36abd0164c24b0cb5',
                    object: 'company',
                    deleted: true,
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/deleted_company_object',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: 'b1857b1c-7be0-4c1b-b417-991e48903439',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
        '404': {
          description: 'Company Not Found',
          content: {
            'application/json': {
              examples: {
                'Company Not Found': {
                  value: {
                    type: 'error.list',
                    request_id: 'fc9dc442-d14b-4500-bd17-340d4081e0a8',
                    errors: [
                      {
                        code: 'company_not_found',
                        message: 'Company Not Found',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
    },
  },
  '/companies/{id}/contacts': {
    get: {
      summary: 'List attached contacts',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
        {
          name: 'id',
          in: 'path',
          required: true,
          description: 'The unique identifier for the company which is given by Intercom',
          example: '5f4d3c1c-7b1b-4d7d-a97e-6095715c6632',
          schema: {
            type: 'string',
          },
        },
      ],
      tags: ['Companies', 'Contacts'],
      operationId: 'ListAttachedContacts',
      description: 'You can fetch a list of all contacts that belong to a company.',
      responses: {
        '200': {
          description: 'Successful',
          content: {
            'application/json': {
              examples: {
                Successful: {
                  value: {
                    type: 'list',
                    data: [],
                    total_count: 0,
                    pages: {
                      type: 'pages',
                      page: 1,
                      per_page: 50,
                      total_pages: 0,
                    },
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/company_attached_contacts',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: '8c869368-88be-4489-8a12-588bae568529',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
        '404': {
          description: 'Company Not Found',
          content: {
            'application/json': {
              examples: {
                'Company Not Found': {
                  value: {
                    type: 'error.list',
                    request_id: '3f658ef0-56a2-48f2-a3ba-f86b379a75eb',
                    errors: [
                      {
                        code: 'company_not_found',
                        message: 'Company Not Found',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
    },
  },
  '/companies/{id}/segments': {
    get: {
      summary: 'List attached segments for companies',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
        {
          name: 'id',
          in: 'path',
          required: true,
          description: 'The unique identifier for the company which is given by Intercom',
          example: '5f4d3c1c-7b1b-4d7d-a97e-6095715c6632',
          schema: {
            type: 'string',
          },
        },
      ],
      tags: ['Companies'],
      operationId: 'ListAttachedSegmentsForCompanies',
      description: 'You can fetch a list of all segments that belong to a company.',
      responses: {
        '200': {
          description: 'Successful',
          content: {
            'application/json': {
              examples: {
                Successful: {
                  value: {
                    type: 'list',
                    data: [],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/company_attached_segments',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: 'd835d6ef-48b4-4ba9-9814-86e66e5bd8e9',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
        '404': {
          description: 'Company Not Found',
          content: {
            'application/json': {
              examples: {
                'Company Not Found': {
                  value: {
                    type: 'error.list',
                    request_id: '4b8e5c25-306a-4073-b5ae-d87a2c96519d',
                    errors: [
                      {
                        code: 'company_not_found',
                        message: 'Company Not Found',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
    },
  },
  '/companies/list': {
    post: {
      summary: 'List all companies',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
        {
          name: 'page',
          in: 'query',
          required: false,
          description: 'The page of results to fetch. Defaults to first page',
          example: 1,
          schema: {
            type: 'integer',
          },
        },
        {
          name: 'per_page',
          in: 'query',
          required: false,
          description: 'How many results to return per page. Defaults to 15',
          example: 15,
          schema: {
            type: 'integer',
          },
        },
        {
          name: 'order',
          in: 'query',
          required: false,
          description: '`asc` or `desc`. Return the companies in ascending or descending order. Defaults to desc',
          example: 'desc',
          schema: {
            type: 'string',
          },
        },
      ],
      tags: ['Companies'],
      operationId: 'listAllCompanies',
      description:
        'You can list companies. The company list is sorted by the `last_request_at` field and by default is ordered descending, most recently requested first.\n\nNote that the API does not include companies who have no associated users in list responses.\n\nWhen using the Companies endpoint and the pages object to iterate through the returned companies, there is a limit of 10,000 Companies that can be returned. If you need to list or iterate on more than 10,000 Companies, please use the [Scroll API](https://developers.intercom.com/reference#iterating-over-all-companies).\n{% admonition type="warning" name="Pagination" %}\n  You can use pagination to limit the number of results returned. The default is `20` results per page.\n  See the [pagination section](https://developers.intercom.com/docs/build-an-integration/learn-more/rest-apis/pagination/#pagination-for-list-apis) for more details on how to use the `starting_after` param.\n{% /admonition %}\n',
      responses: {
        '200': {
          description: 'Successful',
          content: {
            'application/json': {
              examples: {
                Successful: {
                  value: {
                    type: 'list',
                    data: [
                      {
                        type: 'company',
                        company_id: 'remote_companies_scroll_2',
                        id: '6657aac96abd0164c24b0cd1',
                        app_id: 'this_is_an_id169_that_should_be_at_least_',
                        name: 'IntercomQATest1',
                        remote_created_at: 1717021385,
                        created_at: 1717021385,
                        updated_at: 1717021385,
                        monthly_spend: 0,
                        session_count: 0,
                        user_count: 4,
                        tags: {
                          type: 'tag.list',
                          tags: [],
                        },
                        segments: {
                          type: 'segment.list',
                          segments: [],
                        },
                        plan: {},
                        custom_attributes: {},
                      },
                    ],
                    pages: {
                      type: 'pages',
                      next: null,
                      page: 1,
                      per_page: 15,
                      total_pages: 1,
                    },
                    total_count: 1,
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/company_list',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: 'b672ed4c-464a-4606-b2c1-8d40edef7951',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
    },
  },
  '/companies/scroll': {
    get: {
      summary: 'Scroll over all companies',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
        {
          name: 'scroll_param',
          in: 'query',
          required: false,
          description: '',
          schema: {
            type: 'string',
          },
        },
      ],
      tags: ['Companies'],
      operationId: 'scrollOverAllCompanies',
      description:
        '      The `list all companies` functionality does not work well for huge datasets, and can result in errors and performance problems when paging deeply. The Scroll API provides an efficient mechanism for iterating over all companies in a dataset.\n\n- Each app can only have 1 scroll open at a time. You\'ll get an error message if you try to have more than one open per app.\n- If the scroll isn\'t used for 1 minute, it expires and calls with that scroll param will fail\n- If the end of the scroll is reached, "companies" will be empty and the scroll parameter will expire\n\n{% admonition type="info" name="Scroll Parameter" %}\n  You can get the first page of companies by simply sending a GET request to the scroll endpoint.\n  For subsequent requests you will need to use the scroll parameter from the response.\n{% /admonition %}\n{% admonition type="danger" name="Scroll network timeouts" %}\n  Since scroll is often used on large datasets network errors such as timeouts can be encountered. When this occurs you will see a HTTP 500 error with the following message:\n  "Request failed due to an internal network error. Please restart the scroll operation."\n  If this happens, you will need to restart your scroll query: It is not possible to continue from a specific point when using scroll.\n{% /admonition %}\n',
      responses: {
        '200': {
          description: 'Successful',
          content: {
            'application/json': {
              examples: {
                Successful: {
                  value: {
                    type: 'list',
                    data: [
                      {
                        type: 'company',
                        company_id: 'remote_companies_scroll_2',
                        id: '6657aacb6abd0164c24b0cd7',
                        app_id: 'this_is_an_id173_that_should_be_at_least_',
                        name: 'IntercomQATest1',
                        remote_created_at: 1717021387,
                        created_at: 1717021387,
                        updated_at: 1717021387,
                        monthly_spend: 0,
                        session_count: 0,
                        user_count: 4,
                        tags: {
                          type: 'tag.list',
                          tags: [],
                        },
                        segments: {
                          type: 'segment.list',
                          segments: [],
                        },
                        plan: {},
                        custom_attributes: {},
                      },
                    ],
                    pages: null,
                    total_count: null,
                    scroll_param: '759035f4-de24-45cf-9f63-9aa86aba1248',
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/company_scroll',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: 'f40dc354-ebc0-4eaa-b713-ac942902b635',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
    },
  },
  '/contacts/{id}/companies': {
    post: {
      summary: 'Attach a Contact to a Company',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
        {
          name: 'id',
          in: 'path',
          required: true,
          description: 'The unique identifier for the contact which is given by Intercom',
          schema: {
            type: 'string',
          },
        },
      ],
      tags: ['Companies', 'Contacts'],
      operationId: 'attachContactToACompany',
      description: 'You can attach a company to a single contact.',
      responses: {
        '200': {
          description: 'Successful',
          content: {
            'application/json': {
              examples: {
                Successful: {
                  value: {
                    type: 'company',
                    company_id: '1',
                    id: '6657aacd6abd0164c24b0ce0',
                    app_id: 'this_is_an_id177_that_should_be_at_least_',
                    name: 'company6',
                    remote_created_at: 1717021389,
                    created_at: 1717021389,
                    updated_at: 1717021389,
                    monthly_spend: 0,
                    session_count: 0,
                    user_count: 1,
                    tags: {
                      type: 'tag.list',
                      tags: [],
                    },
                    segments: {
                      type: 'segment.list',
                      segments: [],
                    },
                    plan: {},
                    custom_attributes: {},
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/company',
              },
            },
          },
        },
        '400': {
          description: 'Bad Request',
          content: {
            'application/json': {
              examples: {
                'Bad Request': {
                  value: {
                    type: 'error.list',
                    request_id: 'acd7e8d3-23e0-4a81-9027-dc73d9eb94f9',
                    errors: [
                      {
                        code: 'parameter_not_found',
                        message: 'company not specified',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: 'a8b4fc2f-3e2c-4339-ba90-7df1c7f55d94',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
        '404': {
          description: 'Company Not Found',
          content: {
            'application/json': {
              examples: {
                'Company Not Found': {
                  value: {
                    type: 'error.list',
                    request_id: '9b32d40e-a76d-4391-8058-c4856f47f30f',
                    errors: [
                      {
                        code: 'company_not_found',
                        message: 'Company Not Found',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['id'],
              properties: {
                id: {
                  type: 'string',
                  description: 'The unique identifier for the company which is given by Intercom',
                  example: '58a430d35458202d41b1e65b',
                },
              },
            },
            examples: {
              successful: {
                summary: 'Successful',
                value: {
                  id: '6657aacd6abd0164c24b0ce0',
                },
              },
              bad_request: {
                summary: 'Bad Request',
                value: null,
              },
              company_not_found: {
                summary: 'Company Not Found',
                value: {
                  id: '123',
                },
              },
            },
          },
        },
      },
    },
    get: {
      summary: 'List attached companies for contact',
      parameters: [
        {
          name: 'id',
          in: 'path',
          description: 'The unique identifier for the contact which is given by Intercom',
          example: '63a07ddf05a32042dffac965',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
      ],
      tags: ['Contacts', 'Companies'],
      operationId: 'listCompaniesForAContact',
      description: 'You can fetch a list of companies that are associated to a contact.',
      responses: {
        '200': {
          description: 'successful',
          content: {
            'application/json': {
              examples: {
                successful: {
                  value: {
                    type: 'list',
                    data: [
                      {
                        type: 'company',
                        company_id: '1',
                        id: '6657aad36abd0164c24b0d01',
                        app_id: 'this_is_an_id193_that_should_be_at_least_',
                        name: 'company12',
                        remote_created_at: 1717021395,
                        created_at: 1717021395,
                        updated_at: 1717021395,
                        last_request_at: 1716848595,
                        monthly_spend: 0,
                        session_count: 0,
                        user_count: 1,
                        tags: {
                          type: 'tag.list',
                          tags: [],
                        },
                        segments: {
                          type: 'segment.list',
                          segments: [],
                        },
                        plan: {},
                        custom_attributes: {},
                      },
                    ],
                    pages: {
                      type: 'pages',
                      next: null,
                      page: 1,
                      per_page: 50,
                      total_pages: 1,
                    },
                    total_count: 1,
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/contact_attached_companies',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: '569829f1-97e6-43ae-82bf-1ddc978fd525',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
        '404': {
          description: 'Contact not found',
          content: {
            'application/json': {
              examples: {
                'Contact not found': {
                  value: {
                    type: 'error.list',
                    request_id: '310fc913-3cc2-4222-9de9-2b327149f0dd',
                    errors: [
                      {
                        code: 'not_found',
                        message: 'User Not Found',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
    },
  },
  '/contacts/{contact_id}/companies/{id}': {
    delete: {
      summary: 'Detach a contact from a company',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
        {
          name: 'contact_id',
          in: 'path',
          required: true,
          description: 'The unique identifier for the contact which is given by Intercom',
          example: '58a430d35458202d41b1e65b',
          schema: {
            type: 'string',
          },
        },
        {
          name: 'id',
          in: 'path',
          required: true,
          description: 'The unique identifier for the company which is given by Intercom',
          example: '58a430d35458202d41b1e65b',
          schema: {
            type: 'string',
          },
        },
      ],
      tags: ['Companies', 'Contacts'],
      operationId: 'detachContactFromACompany',
      description: 'You can detach a company from a single contact.',
      responses: {
        '200': {
          description: 'Successful',
          content: {
            'application/json': {
              examples: {
                Successful: {
                  value: {
                    type: 'company',
                    company_id: '1',
                    id: '6657aad06abd0164c24b0cf0',
                    app_id: 'this_is_an_id185_that_should_be_at_least_',
                    name: 'company8',
                    remote_created_at: 1717021392,
                    created_at: 1717021392,
                    updated_at: 1717021392,
                    monthly_spend: 0,
                    session_count: 0,
                    user_count: 0,
                    tags: {
                      type: 'tag.list',
                      tags: [],
                    },
                    segments: {
                      type: 'segment.list',
                      segments: [],
                    },
                    plan: {},
                    custom_attributes: {},
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/company',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: '2933cb04-d47e-4ad9-b764-f6abef8a224b',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
        '404': {
          description: 'Contact Not Found',
          content: {
            'application/json': {
              examples: {
                'Company Not Found': {
                  value: {
                    type: 'error.list',
                    request_id: 'f5af06b4-da5a-442a-8610-960fa3e1ea3f',
                    errors: [
                      {
                        code: 'company_not_found',
                        message: 'Company Not Found',
                      },
                    ],
                  },
                },
                'Contact Not Found': {
                  value: {
                    type: 'error.list',
                    request_id: '16ac995d-d962-4fe6-8a45-571d40a85932',
                    errors: [
                      {
                        code: 'not_found',
                        message: 'User Not Found',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
    },
  },
  '/contacts/{id}/notes': {
    get: {
      summary: 'List all notes',
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          description: 'The unique identifier of a contact.',
          schema: {
            type: 'integer',
          },
        },
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
      ],
      tags: ['Notes', 'Contacts'],
      operationId: 'listNotes',
      description: 'You can fetch a list of notes that are associated to a contact.',
      responses: {
        '200': {
          description: 'Successful response',
          content: {
            'application/json': {
              examples: {
                'Successful response': {
                  value: {
                    type: 'list',
                    data: [
                      {
                        type: 'note',
                        id: '29',
                        created_at: 1716416598,
                        contact: {
                          type: 'contact',
                          id: '6657aad66abd0164c24b0d0c',
                        },
                        author: {
                          type: 'admin',
                          id: '991267352',
                          name: 'Ciaran110 Lee',
                          email: 'admin110@email.com',
                          away_mode_enabled: false,
                          away_mode_reassign: false,
                        },
                        body: '<p>This is a note.</p>',
                      },
                      {
                        type: 'note',
                        id: '28',
                        created_at: 1716330198,
                        contact: {
                          type: 'contact',
                          id: '6657aad66abd0164c24b0d0c',
                        },
                        author: {
                          type: 'admin',
                          id: '991267352',
                          name: 'Ciaran110 Lee',
                          email: 'admin110@email.com',
                          away_mode_enabled: false,
                          away_mode_reassign: false,
                        },
                        body: '<p>This is a note.</p>',
                      },
                      {
                        type: 'note',
                        id: '27',
                        created_at: 1716330197,
                        contact: {
                          type: 'contact',
                          id: '6657aad66abd0164c24b0d0c',
                        },
                        author: {
                          type: 'admin',
                          id: '991267352',
                          name: 'Ciaran110 Lee',
                          email: 'admin110@email.com',
                          away_mode_enabled: false,
                          away_mode_reassign: false,
                        },
                        body: '<p>This is a note.</p>',
                      },
                    ],
                    total_count: 3,
                    pages: {
                      type: 'pages',
                      next: null,
                      page: 1,
                      per_page: 50,
                      total_pages: 1,
                    },
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/note_list',
              },
            },
          },
        },
        '404': {
          description: 'Contact not found',
          content: {
            'application/json': {
              examples: {
                'Contact not found': {
                  value: {
                    type: 'error.list',
                    request_id: '5c017b27-069c-45ac-8012-4fd96bc575a1',
                    errors: [
                      {
                        code: 'not_found',
                        message: 'User Not Found',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
    },
    post: {
      summary: 'Create a note',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
        {
          name: 'id',
          in: 'path',
          required: true,
          description: 'The unique identifier of a given contact.',
          example: '123',
          schema: {
            type: 'integer',
          },
        },
      ],
      tags: ['Notes', 'Contacts'],
      operationId: 'createNote',
      description: 'You can add a note to a single contact.',
      responses: {
        '200': {
          description: 'Successful response',
          content: {
            'application/json': {
              examples: {
                'Successful response': {
                  value: {
                    type: 'note',
                    id: '34',
                    created_at: 1717021399,
                    contact: {
                      type: 'contact',
                      id: '6657aad76abd0164c24b0d0e',
                    },
                    author: {
                      type: 'admin',
                      id: '991267354',
                      name: 'Ciaran112 Lee',
                      email: 'admin112@email.com',
                      away_mode_enabled: false,
                      away_mode_reassign: false,
                    },
                    body: '<p>Hello</p>',
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/note',
              },
            },
          },
        },
        '404': {
          description: 'Contact not found',
          content: {
            'application/json': {
              examples: {
                'Admin not found': {
                  value: {
                    type: 'error.list',
                    request_id: 'b4f4eb11-8a81-49b9-91db-42e8c1eca575',
                    errors: [
                      {
                        code: 'not_found',
                        message: 'Resource Not Found',
                      },
                    ],
                  },
                },
                'Contact not found': {
                  value: {
                    type: 'error.list',
                    request_id: '385e508f-749b-462b-a1a7-fa63325e488e',
                    errors: [
                      {
                        code: 'not_found',
                        message: 'User Not Found',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['body'],
              properties: {
                body: {
                  type: 'string',
                  description: 'The text of the note.',
                  example: 'New note',
                },
                contact_id: {
                  type: 'string',
                  description: 'The unique identifier of a given contact.',
                  example: '123',
                },
                admin_id: {
                  type: 'string',
                  description: 'The unique identifier of a given admin.',
                  example: '123',
                },
              },
            },
            examples: {
              successful_response: {
                summary: 'Successful response',
                value: {
                  contact_id: '6657aad76abd0164c24b0d0e',
                  admin_id: 991267354,
                  body: 'Hello',
                },
              },
              admin_not_found: {
                summary: 'Admin not found',
                value: {
                  contact_id: '6657aad76abd0164c24b0d0f',
                  admin_id: 123,
                  body: 'Hello',
                },
              },
              contact_not_found: {
                summary: 'Contact not found',
                value: {
                  contact_id: 123,
                  admin_id: 991267356,
                  body: 'Hello',
                },
              },
            },
          },
        },
      },
    },
  },
  '/contacts/{contact_id}/segments': {
    get: {
      summary: 'List attached segments for contact',
      parameters: [
        {
          name: 'contact_id',
          in: 'path',
          description: 'The unique identifier for the contact which is given by Intercom',
          example: '63a07ddf05a32042dffac965',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
      ],
      tags: ['Contacts', 'Segments'],
      operationId: 'listSegmentsForAContact',
      description: 'You can fetch a list of segments that are associated to a contact.',
      responses: {
        '200': {
          description: 'successful',
          content: {
            'application/json': {
              examples: {
                successful: {
                  value: {
                    type: 'list',
                    data: [
                      {
                        type: 'segment',
                        id: '6657aad96abd0164c24b0d11',
                        name: 'segment',
                        created_at: 1717021401,
                        updated_at: 1717021401,
                        person_type: 'user',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/contact_segments',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: '35d42f23-43c1-47e0-86ec-66e17a98c904',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
        '404': {
          description: 'Contact not found',
          content: {
            'application/json': {
              examples: {
                'Contact not found': {
                  value: {
                    type: 'error.list',
                    request_id: '9451e8b0-0b60-4a3c-8eda-9e644eaec3a0',
                    errors: [
                      {
                        code: 'not_found',
                        message: 'User Not Found',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
    },
  },
  '/contacts/{contact_id}/subscriptions': {
    get: {
      summary: 'List subscriptions for a contact',
      parameters: [
        {
          name: 'contact_id',
          in: 'path',
          description: 'The unique identifier for the contact which is given by Intercom',
          example: '63a07ddf05a32042dffac965',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
      ],
      tags: ['Contacts', 'Subscription Types'],
      operationId: 'listSubscriptionsForAContact',
      description:
        "You can fetch a list of subscription types that are attached to a contact. These can be subscriptions that a user has 'opted-in' to or has 'opted-out' from, depending on the subscription type.\nThis will return a list of Subscription Type objects that the contact is associated with.\n\nThe data property will show a combined list of:\n\n  1.Opt-out subscription types that the user has opted-out from.\n  2.Opt-in subscription types that the user has opted-in to receiving.\n",
      responses: {
        '200': {
          description: 'Successful',
          content: {
            'application/json': {
              examples: {
                Successful: {
                  value: {
                    type: 'list',
                    data: [
                      {
                        type: 'subscription',
                        id: '93',
                        state: 'live',
                        consent_type: 'opt_out',
                        default_translation: {
                          name: 'Newsletters',
                          description: 'Lorem ipsum dolor sit amet',
                          locale: 'en',
                        },
                        translations: [
                          {
                            name: 'Newsletters',
                            description: 'Lorem ipsum dolor sit amet',
                            locale: 'en',
                          },
                        ],
                        content_types: ['email'],
                      },
                      {
                        type: 'subscription',
                        id: '95',
                        state: 'live',
                        consent_type: 'opt_in',
                        default_translation: {
                          name: 'Newsletters',
                          description: 'Lorem ipsum dolor sit amet',
                          locale: 'en',
                        },
                        translations: [
                          {
                            name: 'Newsletters',
                            description: 'Lorem ipsum dolor sit amet',
                            locale: 'en',
                          },
                        ],
                        content_types: ['sms_message'],
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/subscription_type_list',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: '917619e6-202c-4837-bc02-24fcfe95e17c',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
        '404': {
          description: 'Contact not found',
          content: {
            'application/json': {
              examples: {
                'Contact not found': {
                  value: {
                    type: 'error.list',
                    request_id: 'de54f84d-185c-4565-b1f8-4b9a6d8a5b6a',
                    errors: [
                      {
                        code: 'not_found',
                        message: 'User Not Found',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
    },
    post: {
      summary: 'Add subscription to a contact',
      tags: ['Subscription Types', 'Contacts'],
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
        {
          name: 'contact_id',
          in: 'path',
          description: 'The unique identifier for the contact which is given by Intercom',
          example: '63a07ddf05a32042dffac965',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      operationId: 'attachSubscriptionTypeToContact',
      description:
        'You can add a specific subscription to a contact. In Intercom, we have two different subscription types based on user consent - opt-out and opt-in:\n\n  1.Attaching a contact to an opt-out subscription type will opt that user out from receiving messages related to that subscription type.\n\n  2.Attaching a contact to an opt-in subscription type will opt that user in to receiving messages related to that subscription type.\n\nThis will return a subscription type model for the subscription type that was added to the contact.\n',
      responses: {
        '200': {
          description: 'Successful',
          content: {
            'application/json': {
              examples: {
                Successful: {
                  value: {
                    type: 'subscription',
                    id: '108',
                    state: 'live',
                    consent_type: 'opt_in',
                    default_translation: {
                      name: 'Newsletters',
                      description: 'Lorem ipsum dolor sit amet',
                      locale: 'en',
                    },
                    translations: [
                      {
                        name: 'Newsletters',
                        description: 'Lorem ipsum dolor sit amet',
                        locale: 'en',
                      },
                    ],
                    content_types: ['sms_message'],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/subscription_type',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: '6e57c92f-9224-46d6-9315-38263aff308b',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
        '404': {
          description: 'Resource not found',
          content: {
            'application/json': {
              examples: {
                'Contact not found': {
                  value: {
                    type: 'error.list',
                    request_id: 'f0eaf097-047e-40a0-bdcf-bc124bffe683',
                    errors: [
                      {
                        code: 'not_found',
                        message: 'User Not Found',
                      },
                    ],
                  },
                },
                'Resource not found': {
                  value: {
                    type: 'error.list',
                    request_id: 'f9e0a206-a1b0-4bc3-a5b2-58925130e490',
                    errors: [
                      {
                        code: 'not_found',
                        message: 'Resource Not Found',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['id', 'consent_type'],
              properties: {
                id: {
                  type: 'string',
                  description: 'The unique identifier for the subscription which is given by Intercom',
                  example: '37846',
                },
                consent_type: {
                  type: 'string',
                  description: 'The consent_type of a subscription, opt_out or opt_in.',
                  example: 'opt_in',
                },
              },
            },
            examples: {
              successful: {
                summary: 'Successful',
                value: {
                  id: 108,
                  consent_type: 'opt_in',
                },
              },
              contact_not_found: {
                summary: 'Contact not found',
                value: {
                  id: 112,
                  consent_type: 'opt_in',
                },
              },
              resource_not_found: {
                summary: 'Resource not found',
                value: {
                  id: 'invalid_id',
                  consent_type: 'opt_in',
                },
              },
            },
          },
        },
      },
    },
  },
  '/contacts/{contact_id}/subscriptions/{id}': {
    delete: {
      summary: 'Remove subscription from a contact',
      tags: ['Subscription Types', 'Contacts'],
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
        {
          name: 'contact_id',
          in: 'path',
          description: 'The unique identifier for the contact which is given by Intercom',
          example: '63a07ddf05a32042dffac965',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          name: 'id',
          in: 'path',
          description: 'The unique identifier for the subscription type which is given by Intercom',
          example: '37846',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      operationId: 'detachSubscriptionTypeToContact',
      description:
        'You can remove a specific subscription from a contact. This will return a subscription type model for the subscription type that was removed from the contact.',
      responses: {
        '200': {
          description: 'Successful',
          content: {
            'application/json': {
              examples: {
                Successful: {
                  value: {
                    type: 'subscription',
                    id: '124',
                    state: 'live',
                    consent_type: 'opt_in',
                    default_translation: {
                      name: 'Newsletters',
                      description: 'Lorem ipsum dolor sit amet',
                      locale: 'en',
                    },
                    translations: [
                      {
                        name: 'Newsletters',
                        description: 'Lorem ipsum dolor sit amet',
                        locale: 'en',
                      },
                    ],
                    content_types: ['sms_message'],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/subscription_type',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: '79a857ea-0495-4122-a11c-7e00140bdaf3',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
        '404': {
          description: 'Resource not found',
          content: {
            'application/json': {
              examples: {
                'Contact not found': {
                  value: {
                    type: 'error.list',
                    request_id: '10fb9404-d330-4531-81ca-c04ca4d55947',
                    errors: [
                      {
                        code: 'not_found',
                        message: 'User Not Found',
                      },
                    ],
                  },
                },
                'Resource not found': {
                  value: {
                    type: 'error.list',
                    request_id: '2879d387-dc58-4b94-91e3-e4abbc4ac50d',
                    errors: [
                      {
                        code: 'not_found',
                        message: 'Resource Not Found',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
    },
  },
  '/contacts/{contact_id}/tags': {
    get: {
      summary: 'List tags attached to a contact',
      tags: ['Contacts', 'Tags'],
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
        {
          name: 'contact_id',
          in: 'path',
          description: 'The unique identifier for the contact which is given by Intercom',
          example: '63a07ddf05a32042dffac965',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      operationId: 'listTagsForAContact',
      description: 'You can fetch a list of all tags that are attached to a specific contact.',
      responses: {
        '200': {
          description: 'successful',
          content: {
            'application/json': {
              examples: {
                successful: {
                  value: {
                    type: 'list',
                    data: [
                      {
                        type: 'tag',
                        id: '83',
                        name: 'Manual tag',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/tag_list',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: '889da38c-3715-4edd-829f-c6234c6b61c5',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
        '404': {
          description: 'Contact not found',
          content: {
            'application/json': {
              examples: {
                'Contact not found': {
                  value: {
                    type: 'error.list',
                    request_id: '9831ae15-042d-4df0-8709-05712becdc48',
                    errors: [
                      {
                        code: 'not_found',
                        message: 'User Not Found',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
    },
    post: {
      summary: 'Add tag to a contact',
      tags: ['Tags', 'Contacts'],
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
        {
          name: 'contact_id',
          in: 'path',
          description: 'The unique identifier for the contact which is given by Intercom',
          example: '63a07ddf05a32042dffac965',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      operationId: 'attachTagToContact',
      description:
        'You can tag a specific contact. This will return a tag object for the tag that was added to the contact.',
      responses: {
        '200': {
          description: 'successful',
          content: {
            'application/json': {
              examples: {
                successful: {
                  value: {
                    type: 'tag',
                    id: '84',
                    name: 'Manual tag',
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/tag',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: 'e33c99ea-541f-4662-bd11-677745c60510',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
        '404': {
          description: 'Tag not found',
          content: {
            'application/json': {
              examples: {
                'Contact not found': {
                  value: {
                    type: 'error.list',
                    request_id: '56dc903d-e3b7-49e9-aeeb-44f658ec1881',
                    errors: [
                      {
                        code: 'not_found',
                        message: 'User Not Found',
                      },
                    ],
                  },
                },
                'Tag not found': {
                  value: {
                    type: 'error.list',
                    request_id: 'bed647c1-2d8b-4fa0-b16e-92184a12ef6f',
                    errors: [
                      {
                        code: 'not_found',
                        message: 'Resource Not Found',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['id'],
              properties: {
                id: {
                  type: 'string',
                  description: 'The unique identifier for the tag which is given by Intercom',
                  example: '7522907',
                },
              },
            },
            examples: {
              successful: {
                summary: 'successful',
                value: {
                  id: 84,
                },
              },
              contact_not_found: {
                summary: 'Contact not found',
                value: {
                  id: 85,
                },
              },
              tag_not_found: {
                summary: 'Tag not found',
                value: {
                  id: '123',
                },
              },
            },
          },
        },
      },
    },
  },
  '/contacts/{contact_id}/tags/{id}': {
    delete: {
      summary: 'Remove tag from a contact',
      tags: ['Tags', 'Contacts'],
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
        {
          name: 'contact_id',
          in: 'path',
          description: 'The unique identifier for the contact which is given by Intercom',
          example: '63a07ddf05a32042dffac965',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          name: 'id',
          in: 'path',
          description: 'The unique identifier for the tag which is given by Intercom',
          example: '7522907',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      operationId: 'detachTagFromContact',
      description:
        'You can remove tag from a specific contact. This will return a tag object for the tag that was removed from the contact.',
      responses: {
        '200': {
          description: 'successful',
          content: {
            'application/json': {
              examples: {
                successful: {
                  value: {
                    type: 'tag',
                    id: '87',
                    name: 'Manual tag',
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/tag',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: '994fceee-e6d2-455f-b5e4-ae7304feec2e',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
        '404': {
          description: 'Tag not found',
          content: {
            'application/json': {
              examples: {
                'Contact not found': {
                  value: {
                    type: 'error.list',
                    request_id: 'f5167a40-7d57-4480-921a-7144ab21e273',
                    errors: [
                      {
                        code: 'not_found',
                        message: 'User Not Found',
                      },
                    ],
                  },
                },
                'Tag not found': {
                  value: {
                    type: 'error.list',
                    request_id: 'c0dc7099-cb44-4f33-9efe-e22d24c1a227',
                    errors: [
                      {
                        code: 'not_found',
                        message: 'Resource Not Found',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
    },
  },
  '/contacts/{id}': {
    put: {
      summary: 'Update a contact',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
        {
          name: 'id',
          in: 'path',
          description: 'id',
          example: '63a07ddf05a32042dffac965',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      tags: ['Contacts'],
      operationId: 'UpdateContact',
      description: 'You can update an existing contact (ie. user or lead).',
      responses: {
        '200': {
          description: 'successful',
          content: {
            'application/json': {
              examples: {
                successful: {
                  value: {
                    type: 'contact',
                    id: '6657aae76abd0164c24b0d28',
                    workspace_id: 'this_is_an_id259_that_should_be_at_least_',
                    external_id: '70',
                    role: 'user',
                    email: 'joebloggs@intercom.io',
                    phone: null,
                    name: 'joe bloggs',
                    avatar: null,
                    owner_id: null,
                    social_profiles: {
                      type: 'list',
                      data: [],
                    },
                    has_hard_bounced: false,
                    marked_email_as_spam: false,
                    unsubscribed_from_emails: false,
                    created_at: 1717021415,
                    updated_at: 1717021415,
                    signed_up_at: 1717021415,
                    last_seen_at: null,
                    last_replied_at: null,
                    last_contacted_at: null,
                    last_email_opened_at: null,
                    last_email_clicked_at: null,
                    language_override: null,
                    browser: null,
                    browser_version: null,
                    browser_language: null,
                    os: null,
                    location: {
                      type: 'location',
                      country: null,
                      region: null,
                      city: null,
                      country_code: null,
                      continent_code: null,
                    },
                    android_app_name: null,
                    android_app_version: null,
                    android_device: null,
                    android_os_version: null,
                    android_sdk_version: null,
                    android_last_seen_at: null,
                    ios_app_name: null,
                    ios_app_version: null,
                    ios_device: null,
                    ios_os_version: null,
                    ios_sdk_version: null,
                    ios_last_seen_at: null,
                    custom_attributes: {},
                    tags: {
                      type: 'list',
                      data: [],
                      url: '/contacts/6657aae76abd0164c24b0d28/tags',
                      total_count: 0,
                      has_more: false,
                    },
                    notes: {
                      type: 'list',
                      data: [],
                      url: '/contacts/6657aae76abd0164c24b0d28/notes',
                      total_count: 0,
                      has_more: false,
                    },
                    companies: {
                      type: 'list',
                      data: [],
                      url: '/contacts/6657aae76abd0164c24b0d28/companies',
                      total_count: 0,
                      has_more: false,
                    },
                    opted_out_subscription_types: {
                      type: 'list',
                      data: [],
                      url: '/contacts/6657aae76abd0164c24b0d28/subscriptions',
                      total_count: 0,
                      has_more: false,
                    },
                    opted_in_subscription_types: {
                      type: 'list',
                      data: [],
                      url: '/contacts/6657aae76abd0164c24b0d28/subscriptions',
                      total_count: 0,
                      has_more: false,
                    },
                    utm_campaign: null,
                    utm_content: null,
                    utm_medium: null,
                    utm_source: null,
                    utm_term: null,
                    referrer: null,
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/contact',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: 'babb0a78-a81a-4c20-b2b6-b407dfeb6b2d',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
      requestBody: {
        content: {
          'application/json': {
            schema: {
              oneOf: [
                {
                  $ref: '#/components/schemas/update_contact_request',
                },
              ],
            },
            examples: {
              successful: {
                summary: 'successful',
                value: {
                  email: 'joebloggs@intercom.io',
                  name: 'joe bloggs',
                },
              },
            },
          },
        },
      },
    },
    get: {
      summary: 'Get a contact',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
        {
          name: 'id',
          in: 'path',
          description: 'id',
          example: '63a07ddf05a32042dffac965',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      tags: ['Contacts'],
      operationId: 'ShowContact',
      description: 'You can fetch the details of a single contact.',
      responses: {
        '200': {
          description: 'successful',
          content: {
            'application/json': {
              examples: {
                successful: {
                  value: {
                    type: 'contact',
                    id: '6657aae86abd0164c24b0d29',
                    workspace_id: 'this_is_an_id263_that_should_be_at_least_',
                    external_id: '70',
                    role: 'user',
                    email: 'joe@bloggs.com',
                    phone: null,
                    name: 'Joe Bloggs',
                    avatar: null,
                    owner_id: null,
                    social_profiles: {
                      type: 'list',
                      data: [],
                    },
                    has_hard_bounced: false,
                    marked_email_as_spam: false,
                    unsubscribed_from_emails: false,
                    created_at: 1717021416,
                    updated_at: 1717021416,
                    signed_up_at: 1717021416,
                    last_seen_at: null,
                    last_replied_at: null,
                    last_contacted_at: null,
                    last_email_opened_at: null,
                    last_email_clicked_at: null,
                    language_override: null,
                    browser: null,
                    browser_version: null,
                    browser_language: null,
                    os: null,
                    location: {
                      type: 'location',
                      country: null,
                      region: null,
                      city: null,
                      country_code: null,
                      continent_code: null,
                    },
                    android_app_name: null,
                    android_app_version: null,
                    android_device: null,
                    android_os_version: null,
                    android_sdk_version: null,
                    android_last_seen_at: null,
                    ios_app_name: null,
                    ios_app_version: null,
                    ios_device: null,
                    ios_os_version: null,
                    ios_sdk_version: null,
                    ios_last_seen_at: null,
                    custom_attributes: {},
                    tags: {
                      type: 'list',
                      data: [],
                      url: '/contacts/6657aae86abd0164c24b0d29/tags',
                      total_count: 0,
                      has_more: false,
                    },
                    notes: {
                      type: 'list',
                      data: [],
                      url: '/contacts/6657aae86abd0164c24b0d29/notes',
                      total_count: 0,
                      has_more: false,
                    },
                    companies: {
                      type: 'list',
                      data: [],
                      url: '/contacts/6657aae86abd0164c24b0d29/companies',
                      total_count: 0,
                      has_more: false,
                    },
                    opted_out_subscription_types: {
                      type: 'list',
                      data: [],
                      url: '/contacts/6657aae86abd0164c24b0d29/subscriptions',
                      total_count: 0,
                      has_more: false,
                    },
                    opted_in_subscription_types: {
                      type: 'list',
                      data: [],
                      url: '/contacts/6657aae86abd0164c24b0d29/subscriptions',
                      total_count: 0,
                      has_more: false,
                    },
                    utm_campaign: null,
                    utm_content: null,
                    utm_medium: null,
                    utm_source: null,
                    utm_term: null,
                    referrer: null,
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/contact',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: '4101d4ef-8205-4e5f-b513-479f749c34c9',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
    },
    delete: {
      summary: 'Delete a contact',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
        {
          name: 'id',
          in: 'path',
          description: 'id',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      tags: ['Contacts'],
      operationId: 'DeleteContact',
      description: 'You can delete a single contact.',
      responses: {
        '200': {
          description: 'successful',
          content: {
            'application/json': {
              examples: {
                successful: {
                  value: {
                    id: '6657aaea6abd0164c24b0d2a',
                    object: 'contact',
                    deleted: true,
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/contact_deleted',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: '13311953-9f38-4984-a63f-83d70dee0110',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
    },
  },
  '/contacts/merge': {
    post: {
      summary: 'Merge a lead and a user',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
      ],
      tags: ['Contacts'],
      operationId: 'MergeContact',
      description: 'You can merge a contact with a `role` of `lead` into a contact with a `role` of `user`.',
      responses: {
        '200': {
          description: 'successful',
          content: {
            'application/json': {
              examples: {
                successful: {
                  value: {
                    type: 'contact',
                    id: '6657aaeb6abd0164c24b0d2c',
                    workspace_id: 'this_is_an_id271_that_should_be_at_least_',
                    external_id: '70',
                    role: 'user',
                    email: 'joe@bloggs.com',
                    phone: null,
                    name: 'Joe Bloggs',
                    avatar: null,
                    owner_id: null,
                    social_profiles: {
                      type: 'list',
                      data: [],
                    },
                    has_hard_bounced: false,
                    marked_email_as_spam: false,
                    unsubscribed_from_emails: false,
                    created_at: 1717021419,
                    updated_at: 1717021420,
                    signed_up_at: 1717021419,
                    last_seen_at: null,
                    last_replied_at: null,
                    last_contacted_at: null,
                    last_email_opened_at: null,
                    last_email_clicked_at: null,
                    language_override: null,
                    browser: null,
                    browser_version: null,
                    browser_language: null,
                    os: null,
                    location: {
                      type: 'location',
                      country: null,
                      region: null,
                      city: null,
                      country_code: null,
                      continent_code: null,
                    },
                    android_app_name: null,
                    android_app_version: null,
                    android_device: null,
                    android_os_version: null,
                    android_sdk_version: null,
                    android_last_seen_at: null,
                    ios_app_name: null,
                    ios_app_version: null,
                    ios_device: null,
                    ios_os_version: null,
                    ios_sdk_version: null,
                    ios_last_seen_at: null,
                    custom_attributes: {},
                    tags: {
                      type: 'list',
                      data: [],
                      url: '/contacts/6657aaeb6abd0164c24b0d2c/tags',
                      total_count: 0,
                      has_more: false,
                    },
                    notes: {
                      type: 'list',
                      data: [],
                      url: '/contacts/6657aaeb6abd0164c24b0d2c/notes',
                      total_count: 0,
                      has_more: false,
                    },
                    companies: {
                      type: 'list',
                      data: [],
                      url: '/contacts/6657aaeb6abd0164c24b0d2c/companies',
                      total_count: 0,
                      has_more: false,
                    },
                    opted_out_subscription_types: {
                      type: 'list',
                      data: [],
                      url: '/contacts/6657aaeb6abd0164c24b0d2c/subscriptions',
                      total_count: 0,
                      has_more: false,
                    },
                    opted_in_subscription_types: {
                      type: 'list',
                      data: [],
                      url: '/contacts/6657aaeb6abd0164c24b0d2c/subscriptions',
                      total_count: 0,
                      has_more: false,
                    },
                    utm_campaign: null,
                    utm_content: null,
                    utm_medium: null,
                    utm_source: null,
                    utm_term: null,
                    referrer: null,
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/contact',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: '8084b6b3-60e7-46b9-96ab-ed0d9ef45e67',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/merge_contacts_request',
            },
            examples: {
              successful: {
                summary: 'successful',
                value: {
                  from: '6657aaeb6abd0164c24b0d2b',
                  into: '6657aaeb6abd0164c24b0d2c',
                },
              },
            },
          },
        },
      },
    },
  },
  '/contacts/search': {
    post: {
      summary: 'Search contacts',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
      ],
      tags: ['Contacts'],
      operationId: 'SearchContacts',
      description:
        'You can search for multiple contacts by the value of their attributes in order to fetch exactly who you want.\n\nTo search for contacts, you need to send a `POST` request to `https://api.intercom.io/contacts/search`.\n\nThis will accept a query object in the body which will define your filters in order to search for contacts.\n\n{% admonition type="warning" name="Optimizing search queries" %}\n  Search queries can be complex, so optimizing them can help the performance of your search.\n  Use the `AND` and `OR` operators to combine multiple filters to get the exact results you need and utilize\n  pagination to limit the number of results returned. The default is `50` results per page.\n  See the [pagination section](https://developers.intercom.com/docs/build-an-integration/learn-more/rest-apis/pagination/#example-search-conversations-request) for more details on how to use the `starting_after` param.\n{% /admonition %}\n### Contact Creation Delay\n\nIf a contact has recently been created, there is a possibility that it will not yet be available when searching. This means that it may not appear in the response. This delay can take a few minutes. If you need to be instantly notified it is recommended to use webhooks and iterate to see if they match your search filters.\n\n### Nesting & Limitations\n\nYou can nest these filters in order to get even more granular insights that pinpoint exactly what you need. Example: (1 OR 2) AND (3 OR 4).\nThere are some limitations to the amount of multiple\'s there can be:\n* There\'s a limit of max 2 nested filters\n* There\'s a limit of max 15 filters for each AND or OR group\n\n### Searching for Timestamp Fields\n\nAll timestamp fields (created_at, updated_at etc.) are indexed as Dates for Contact Search queries; Datetime queries are not currently supported. This means you can only query for timestamp fields by day - not hour, minute or second.\nFor example, if you search for all Contacts with a created_at value greater (>) than 1577869200 (the UNIX timestamp for January 1st, 2020 9:00 AM), that will be interpreted as 1577836800 (January 1st, 2020 12:00 AM). The search results will then include Contacts created from January 2nd, 2020 12:00 AM onwards.\nIf you\'d like to get contacts created on January 1st, 2020 you should search with a created_at value equal (=) to 1577836800 (January 1st, 2020 12:00 AM).\nThis behaviour applies only to timestamps used in search queries. The search results will still contain the full UNIX timestamp and be sorted accordingly.\n\n### Accepted Fields\n\nMost key listed as part of the Contacts Model are searchable, whether writeable or not. The value you search for has to match the accepted type, otherwise the query will fail (ie. as `created_at` accepts a date, the `value` cannot be a string such as `"foorbar"`).\n\n| Field                              | Type                           |\n| ---------------------------------- | ------------------------------ |\n| id                                 | String                         |\n| role                               | String<br>Accepts user or lead |\n| name                               | String                         |\n| avatar                             | String                         |\n| owner_id                           | Integer                        |\n| email                              | String                         |\n| email_domain                       | String                         |\n| phone                              | String                         |\n| formatted_phone                    | String                         |\n| external_id                        | String                         |\n| created_at                         | Date (UNIX Timestamp)          |\n| signed_up_at                       | Date (UNIX Timestamp)          |\n| updated_at                         | Date (UNIX Timestamp)          |\n| last_seen_at                       | Date (UNIX Timestamp)          |\n| last_contacted_at                  | Date (UNIX Timestamp)          |\n| last_replied_at                    | Date (UNIX Timestamp)          |\n| last_email_opened_at               | Date (UNIX Timestamp)          |\n| last_email_clicked_at              | Date (UNIX Timestamp)          |\n| language_override                  | String                         |\n| browser                            | String                         |\n| browser_language                   | String                         |\n| os                                 | String                         |\n| location.country                   | String                         |\n| location.region                    | String                         |\n| location.city                      | String                         |\n| unsubscribed_from_emails           | Boolean                        |\n| marked_email_as_spam               | Boolean                        |\n| has_hard_bounced                   | Boolean                        |\n| ios_last_seen_at                   | Date (UNIX Timestamp)          |\n| ios_app_version                    | String                         |\n| ios_device                         | String                         |\n| ios_app_device                     | String                         |\n| ios_os_version                     | String                         |\n| ios_app_name                       | String                         |\n| ios_sdk_version                    | String                         |\n| android_last_seen_at               | Date (UNIX Timestamp)          |\n| android_app_version                | String                         |\n| android_device                     | String                         |\n| android_app_name                   | String                         |\n| andoid_sdk_version                 | String                         |\n| segment_id                         | String                         |\n| tag_id                             | String                         |\n| custom_attributes.{attribute_name} | String                         |\n\n### Accepted Operators\n\n{% admonition type="attention" name="Searching based on `created_at`" %}\n  You cannot use the `<=` or `>=` operators to search by `created_at`.\n{% /admonition %}\n\nThe table below shows the operators you can use to define how you want to search for the value.  The operator should be put in as a string (`"="`). The operator has to be compatible with the field\'s type (eg. you cannot search with `>` for a given string value as it\'s only compatible for integer\'s and dates).\n\n| Operator | Valid Types                      | Description                                                      |\n| :------- | :------------------------------- | :--------------------------------------------------------------- |\n| =        | All                              | Equals                                                           |\n| !=       | All                              | Doesn\'t Equal                                                    |\n| IN       | All                              | In<br>Shortcut for `OR` queries<br>Values must be in Array       |\n| NIN      | All                              | Not In<br>Shortcut for `OR !` queries<br>Values must be in Array |\n| >        | Integer<br>Date (UNIX Timestamp) | Greater than                                                     |\n| <       | Integer<br>Date (UNIX Timestamp) | Lower than                                                       |\n| ~        | String                           | Contains                                                         |\n| !~       | String                           | Doesn\'t Contain                                                  |\n| ^        | String                           | Starts With                                                      |\n| $        | String                           | Ends With                                                        |\n',
      responses: {
        '200': {
          description: 'successful',
          content: {
            'application/json': {
              examples: {
                successful: {
                  value: {
                    type: 'list',
                    data: [],
                    total_count: 0,
                    pages: {
                      type: 'pages',
                      page: 1,
                      per_page: 5,
                      total_pages: 0,
                    },
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/contact_list',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: '019c15bc-59b6-46e0-a99c-9ff87e13255b',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/search_request',
            },
            examples: {
              successful: {
                summary: 'successful',
                value: {
                  query: {
                    operator: 'AND',
                    value: [
                      {
                        field: 'created_at',
                        operator: '>',
                        value: '1306054154',
                      },
                    ],
                  },
                  pagination: {
                    per_page: 5,
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  '/contacts': {
    get: {
      summary: 'List all contacts',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
      ],
      tags: ['Contacts'],
      operationId: 'ListContacts',
      description:
        'You can fetch a list of all contacts (ie. users or leads) in your workspace.\n{% admonition type="warning" name="Pagination" %}\n  You can use pagination to limit the number of results returned. The default is `50` results per page.\n  See the [pagination section](https://developers.intercom.com/docs/build-an-integration/learn-more/rest-apis/pagination/#pagination-for-list-apis) for more details on how to use the `starting_after` param.\n{% /admonition %}\n',
      responses: {
        '200': {
          description: 'successful',
          content: {
            'application/json': {
              examples: {
                successful: {
                  value: {
                    type: 'list',
                    data: [],
                    total_count: 0,
                    pages: {
                      type: 'pages',
                      page: 1,
                      per_page: 10,
                      total_pages: 0,
                    },
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/contact_list',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: 'e8bd0d1b-622c-4343-b613-01ba2803cbca',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
    },
    post: {
      summary: 'Create contact',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
      ],
      tags: ['Contacts'],
      operationId: 'CreateContact',
      description: 'You can create a new contact (ie. user or lead).',
      responses: {
        '200': {
          description: 'successful',
          content: {
            'application/json': {
              examples: {
                successful: {
                  value: {
                    type: 'contact',
                    id: '6657aaf06abd0164c24b0d2f',
                    workspace_id: 'this_is_an_id283_that_should_be_at_least_',
                    external_id: null,
                    role: 'user',
                    email: 'joebloggs@intercom.io',
                    phone: null,
                    name: null,
                    avatar: null,
                    owner_id: null,
                    social_profiles: {
                      type: 'list',
                      data: [],
                    },
                    has_hard_bounced: false,
                    marked_email_as_spam: false,
                    unsubscribed_from_emails: false,
                    created_at: 1717021424,
                    updated_at: 1717021424,
                    signed_up_at: null,
                    last_seen_at: null,
                    last_replied_at: null,
                    last_contacted_at: null,
                    last_email_opened_at: null,
                    last_email_clicked_at: null,
                    language_override: null,
                    browser: null,
                    browser_version: null,
                    browser_language: null,
                    os: null,
                    location: {
                      type: 'location',
                      country: null,
                      region: null,
                      city: null,
                      country_code: null,
                      continent_code: null,
                    },
                    android_app_name: null,
                    android_app_version: null,
                    android_device: null,
                    android_os_version: null,
                    android_sdk_version: null,
                    android_last_seen_at: null,
                    ios_app_name: null,
                    ios_app_version: null,
                    ios_device: null,
                    ios_os_version: null,
                    ios_sdk_version: null,
                    ios_last_seen_at: null,
                    custom_attributes: {},
                    tags: {
                      type: 'list',
                      data: [],
                      url: '/contacts/6657aaf06abd0164c24b0d2f/tags',
                      total_count: 0,
                      has_more: false,
                    },
                    notes: {
                      type: 'list',
                      data: [],
                      url: '/contacts/6657aaf06abd0164c24b0d2f/notes',
                      total_count: 0,
                      has_more: false,
                    },
                    companies: {
                      type: 'list',
                      data: [],
                      url: '/contacts/6657aaf06abd0164c24b0d2f/companies',
                      total_count: 0,
                      has_more: false,
                    },
                    opted_out_subscription_types: {
                      type: 'list',
                      data: [],
                      url: '/contacts/6657aaf06abd0164c24b0d2f/subscriptions',
                      total_count: 0,
                      has_more: false,
                    },
                    opted_in_subscription_types: {
                      type: 'list',
                      data: [],
                      url: '/contacts/6657aaf06abd0164c24b0d2f/subscriptions',
                      total_count: 0,
                      has_more: false,
                    },
                    utm_campaign: null,
                    utm_content: null,
                    utm_medium: null,
                    utm_source: null,
                    utm_term: null,
                    referrer: null,
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/contact',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: '555fa590-2a77-4f14-a607-7fb420b1bc8b',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
      requestBody: {
        content: {
          'application/json': {
            schema: {
              oneOf: [
                {
                  $ref: '#/components/schemas/create_contact_request',
                },
              ],
            },
            examples: {
              successful: {
                summary: 'successful',
                value: {
                  email: 'joebloggs@intercom.io',
                },
              },
            },
          },
        },
      },
    },
  },
  '/contacts/{id}/archive': {
    post: {
      summary: 'Archive contact',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
        {
          name: 'id',
          in: 'path',
          description: 'id',
          example: '63a07ddf05a32042dffac965',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      tags: ['Contacts'],
      operationId: 'ArchiveContact',
      description: 'You can archive a single contact.',
      responses: {
        '200': {
          description: 'successful',
          content: {
            'application/json': {
              examples: {
                successful: {
                  value: {
                    id: '6657aaf26abd0164c24b0d30',
                    object: 'contact',
                    archived: true,
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/contact_archived',
              },
            },
          },
        },
      },
    },
  },
  '/contacts/{id}/unarchive': {
    post: {
      summary: 'Unarchive contact',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
        {
          name: 'id',
          in: 'path',
          description: 'id',
          example: '63a07ddf05a32042dffac965',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      tags: ['Contacts'],
      operationId: 'UnarchiveContact',
      description: 'You can unarchive a single contact.',
      responses: {
        '200': {
          description: 'successful',
          content: {
            'application/json': {
              examples: {
                successful: {
                  value: {
                    id: '6657aaf26abd0164c24b0d31',
                    object: 'contact',
                    archived: false,
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/contact_unarchived',
              },
            },
          },
        },
      },
    },
  },
  '/conversations/{conversation_id}/tags': {
    post: {
      summary: 'Add tag to a conversation',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
        {
          name: 'conversation_id',
          in: 'path',
          description: 'conversation_id',
          example: '64619700005694',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      tags: ['Tags', 'Conversations'],
      operationId: 'attachTagToConversation',
      description:
        'You can tag a specific conversation. This will return a tag object for the tag that was added to the conversation.',
      responses: {
        '200': {
          description: 'successful',
          content: {
            'application/json': {
              examples: {
                successful: {
                  value: {
                    type: 'tag',
                    id: '89',
                    name: 'Manual tag',
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/tag',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: 'd610fe70-342b-44fa-9e29-0bcfcaf1865f',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
        '404': {
          description: 'Conversation not found',
          content: {
            'application/json': {
              examples: {
                'Conversation not found': {
                  value: {
                    type: 'error.list',
                    request_id: '1f017fec-9524-406d-9587-8dafdac7b0b2',
                    errors: [
                      {
                        code: 'not_found',
                        message: 'Conversation not found',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['id', 'admin_id'],
              properties: {
                id: {
                  type: 'string',
                  description: 'The unique identifier for the tag which is given by Intercom',
                  example: '7522907',
                },
                admin_id: {
                  type: 'string',
                  description: 'The unique identifier for the admin which is given by Intercom.',
                  example: '780',
                },
              },
            },
            examples: {
              successful: {
                summary: 'successful',
                value: {
                  id: 89,
                  admin_id: 991267387,
                },
              },
              conversation_not_found: {
                summary: 'Conversation not found',
                value: {
                  id: 90,
                  admin_id: 991267389,
                },
              },
            },
          },
        },
      },
    },
  },
  '/conversations/{conversation_id}/tags/{id}': {
    delete: {
      summary: 'Remove tag from a conversation',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
        {
          name: 'conversation_id',
          in: 'path',
          description: 'conversation_id',
          example: '64619700005694',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          name: 'id',
          in: 'path',
          description: 'id',
          example: '7522907',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      tags: ['Tags', 'Conversations'],
      operationId: 'detachTagFromConversation',
      description:
        'You can remove tag from a specific conversation. This will return a tag object for the tag that was removed from the conversation.',
      responses: {
        '200': {
          description: 'successful',
          content: {
            'application/json': {
              examples: {
                successful: {
                  value: {
                    type: 'tag',
                    id: '92',
                    name: 'Manual tag',
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/tag',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: '8591b1dd-51af-4927-a3eb-2f92738d5fe3',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
        '404': {
          description: 'Tag not found',
          content: {
            'application/json': {
              examples: {
                'Conversation not found': {
                  value: {
                    type: 'error.list',
                    request_id: '196f750c-77c5-458d-95cd-a2eb06eb93c9',
                    errors: [
                      {
                        code: 'not_found',
                        message: 'Conversation not found',
                      },
                    ],
                  },
                },
                'Tag not found': {
                  value: {
                    type: 'error.list',
                    request_id: '7bf65c4c-15a4-42da-9c01-3a7fd9801d41',
                    errors: [
                      {
                        code: 'tag_not_found',
                        message: 'Tag not found',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['admin_id'],
              properties: {
                admin_id: {
                  type: 'string',
                  description: 'The unique identifier for the admin which is given by Intercom.',
                  example: '123',
                },
              },
            },
            examples: {
              successful: {
                summary: 'successful',
                value: {
                  admin_id: 991267391,
                },
              },
              conversation_not_found: {
                summary: 'Conversation not found',
                value: {
                  admin_id: 991267393,
                },
              },
              tag_not_found: {
                summary: 'Tag not found',
                value: {
                  admin_id: 991267394,
                },
              },
            },
          },
        },
      },
    },
  },
  '/conversations': {
    get: {
      summary: 'List all conversations',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
        {
          name: 'per_page',
          in: 'query',
          schema: {
            type: 'integer',
            default: 20,
            maximum: 150,
          },
          required: false,
          description: 'How many results per page',
        },
        {
          name: 'starting_after',
          in: 'query',
          required: false,
          description: 'String used to get the next page of conversations.',
          schema: {
            type: 'string',
          },
        },
      ],
      tags: ['Conversations'],
      operationId: 'listConversations',
      description:
        'You can fetch a list of all conversations.\n\nYou can optionally request the result page size and the cursor to start after to fetch the result.\n{% admonition type="warning" name="Pagination" %}\n  You can use pagination to limit the number of results returned. The default is `20` results per page.\n  See the [pagination section](https://developers.intercom.com/docs/build-an-integration/learn-more/rest-apis/pagination/#pagination-for-list-apis) for more details on how to use the `starting_after` param.\n{% /admonition %}\n',
      responses: {
        '200': {
          description: 'successful',
          content: {
            'application/json': {
              examples: {
                successful: {
                  value: {
                    type: 'conversation.list',
                    pages: {
                      type: 'pages',
                      page: 1,
                      per_page: 20,
                      total_pages: 1,
                    },
                    total_count: 1,
                    conversations: [
                      {
                        type: 'conversation',
                        id: '301',
                        created_at: 1717021435,
                        updated_at: 1717021435,
                        waiting_since: null,
                        snoozed_until: null,
                        source: {
                          type: 'conversation',
                          id: '403918227',
                          delivered_as: 'admin_initiated',
                          subject: '',
                          body: '<p>this is the message body</p>',
                          author: {
                            type: 'admin',
                            id: '991267397',
                            name: 'Ciaran152 Lee',
                            email: 'admin152@email.com',
                          },
                          attachments: [],
                          url: null,
                          redacted: false,
                        },
                        contacts: {
                          type: 'contact.list',
                          contacts: [
                            {
                              type: 'contact',
                              id: '6657aafb6abd0164c24b0d35',
                            },
                          ],
                        },
                        first_contact_reply: null,
                        admin_assignee_id: null,
                        team_assignee_id: null,
                        open: false,
                        state: 'closed',
                        read: false,
                        tags: {
                          type: 'tag.list',
                          tags: [],
                        },
                        priority: 'not_priority',
                        sla_applied: null,
                        statistics: null,
                        conversation_rating: null,
                        teammates: null,
                        title: null,
                        custom_attributes: {},
                        topics: {},
                        ticket: null,
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/paginated_response',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: 'de4b1b6d-c724-4b8b-829b-12f7fcb40473',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
        '403': {
          description: 'API plan restricted',
          content: {
            'application/json': {
              examples: {
                'API plan restricted': {
                  value: {
                    type: 'error.list',
                    request_id: 'ae58f677-d8b7-4a9d-8686-2418c79b060f',
                    errors: [
                      {
                        code: 'api_plan_restricted',
                        message: 'Active subscription needed.',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
    },
    post: {
      summary: 'Creates a conversation',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
      ],
      tags: ['Conversations'],
      operationId: 'createConversation',
      description:
        'You can create a conversation that has been initiated by a contact (ie. user or lead).\nThe conversation can be an in-app message only.\n\n{% admonition type="info" name="Sending for visitors" %}\nYou can also send a message from a visitor by specifying their `user_id` or `id` value in the `from` field, along with a `type` field value of `contact`.\nThis visitor will be automatically converted to a contact with a lead role once the conversation is created.\n{% /admonition %}\n\nThis will return the Message model that has been created.\n\n',
      responses: {
        '200': {
          description: 'conversation created',
          content: {
            'application/json': {
              examples: {
                'conversation created': {
                  value: {
                    type: 'user_message',
                    id: '403918237',
                    created_at: 1717021458,
                    body: 'Hello there',
                    message_type: 'inapp',
                    conversation_id: '329',
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/message',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: '11e20110-32ad-4b8b-92db-a3430d929f55',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
        '403': {
          description: 'API plan restricted',
          content: {
            'application/json': {
              examples: {
                'API plan restricted': {
                  value: {
                    type: 'error.list',
                    request_id: 'f304a890-faa2-4a77-90ad-6a711da1f79a',
                    errors: [
                      {
                        code: 'api_plan_restricted',
                        message: 'Active subscription needed.',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
        '404': {
          description: 'Contact Not Found',
          content: {
            'application/json': {
              examples: {
                'Contact Not Found': {
                  value: {
                    type: 'error.list',
                    request_id: 'ffaf1bd9-3b6d-47bc-97ec-644e7739e0b0',
                    errors: [
                      {
                        code: 'not_found',
                        message: 'User Not Found',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/create_conversation_request',
            },
            examples: {
              conversation_created: {
                summary: 'conversation created',
                value: {
                  from: {
                    type: 'user',
                    id: '6657ab116abd0164c24b0d4d',
                  },
                  body: 'Hello there',
                },
              },
              contact_not_found: {
                summary: 'Contact Not Found',
                value: {
                  from: {
                    type: 'user',
                    id: '123_doesnt_exist',
                  },
                  body: 'Hello there',
                },
              },
            },
          },
        },
      },
    },
  },
  '/conversations/{id}': {
    get: {
      summary: 'Retrieve a conversation',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
        {
          name: 'id',
          in: 'path',
          required: true,
          description: 'The id of the conversation to target',
          example: 123,
          schema: {
            type: 'integer',
          },
        },
        {
          name: 'display_as',
          in: 'query',
          required: false,
          description: 'Set to plaintext to retrieve conversation messages in plain text.',
          example: 'plaintext',
          schema: {
            type: 'string',
          },
        },
      ],
      tags: ['Conversations'],
      operationId: 'retrieveConversation',
      description:
        '\nYou can fetch the details of a single conversation.\n\nThis will return a single Conversation model with all its conversation parts.\n\n{% admonition type="warning" name="Hard limit of 500 parts" %}\nThe maximum number of conversation parts that can be returned via the API is 500. If you have more than that we will return the 500 most recent conversation parts.\n{% /admonition %}\n\nFor AI agent conversation metadata, please note that you need to have the agent enabled in your workspace, which is a [paid feature](https://www.intercom.com/help/en/articles/8205718-fin-resolutions#h_97f8c2e671).\n',
      responses: {
        '200': {
          description: 'conversation found',
          content: {
            'application/json': {
              examples: {
                'conversation found': {
                  value: {
                    type: 'conversation',
                    id: '333',
                    created_at: 1717021463,
                    updated_at: 1717021463,
                    waiting_since: null,
                    snoozed_until: null,
                    source: {
                      type: 'conversation',
                      id: '403918241',
                      delivered_as: 'admin_initiated',
                      subject: '',
                      body: '<p>this is the message body</p>',
                      author: {
                        type: 'admin',
                        id: '991267414',
                        name: 'Ciaran162 Lee',
                        email: 'admin162@email.com',
                      },
                      attachments: [],
                      url: null,
                      redacted: false,
                    },
                    contacts: {
                      type: 'contact.list',
                      contacts: [
                        {
                          type: 'contact',
                          id: '6657ab176abd0164c24b0d51',
                        },
                      ],
                    },
                    first_contact_reply: null,
                    admin_assignee_id: null,
                    team_assignee_id: null,
                    open: false,
                    state: 'closed',
                    read: false,
                    tags: {
                      type: 'tag.list',
                      tags: [],
                    },
                    priority: 'not_priority',
                    sla_applied: null,
                    statistics: null,
                    conversation_rating: null,
                    teammates: null,
                    title: null,
                    custom_attributes: {},
                    topics: {},
                    ticket: null,
                    conversation_parts: {
                      type: 'conversation_part.list',
                      conversation_parts: [],
                      total_count: 0,
                    },
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/conversation',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: '9ba8124b-f405-4d50-a274-7c91a0ccd624',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
        '403': {
          description: 'API plan restricted',
          content: {
            'application/json': {
              examples: {
                'API plan restricted': {
                  value: {
                    type: 'error.list',
                    request_id: 'ffffbffd-8a8c-49df-a4c1-74e76782150c',
                    errors: [
                      {
                        code: 'api_plan_restricted',
                        message: 'Active subscription needed.',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
        '404': {
          description: 'Not found',
          content: {
            'application/json': {
              examples: {
                'Not found': {
                  value: {
                    type: 'error.list',
                    request_id: '3b602881-22c9-4fd1-86d4-668e2befa292',
                    errors: [
                      {
                        code: 'not_found',
                        message: 'Resource Not Found',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
    },
    put: {
      summary: 'Update a conversation',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
        {
          name: 'id',
          in: 'path',
          required: true,
          description: 'The id of the conversation to target',
          example: 123,
          schema: {
            type: 'integer',
          },
        },
        {
          name: 'display_as',
          in: 'query',
          required: false,
          description: 'Set to plaintext to retrieve conversation messages in plain text.',
          example: 'plaintext',
          schema: {
            type: 'string',
          },
        },
      ],
      tags: ['Conversations'],
      operationId: 'updateConversation',
      description:
        '\nYou can update an existing conversation.\n\n{% admonition type="info" name="Replying and other actions" %}\nIf you want to reply to a coveration or take an action such as assign, unassign, open, close or snooze, take a look at the reply and manage endpoints.\n{% /admonition %}\n\n',
      responses: {
        '200': {
          description: 'conversation found',
          content: {
            'application/json': {
              examples: {
                'conversation found': {
                  value: {
                    type: 'conversation',
                    id: '337',
                    created_at: 1717021469,
                    updated_at: 1717021471,
                    waiting_since: null,
                    snoozed_until: null,
                    source: {
                      type: 'conversation',
                      id: '403918245',
                      delivered_as: 'admin_initiated',
                      subject: '',
                      body: '<p>this is the message body</p>',
                      author: {
                        type: 'admin',
                        id: '991267422',
                        name: 'Ciaran166 Lee',
                        email: 'admin166@email.com',
                      },
                      attachments: [],
                      url: null,
                      redacted: false,
                    },
                    contacts: {
                      type: 'contact.list',
                      contacts: [
                        {
                          type: 'contact',
                          id: '6657ab1d6abd0164c24b0d55',
                        },
                      ],
                    },
                    first_contact_reply: null,
                    admin_assignee_id: null,
                    team_assignee_id: null,
                    open: false,
                    state: 'closed',
                    read: true,
                    tags: {
                      type: 'tag.list',
                      tags: [],
                    },
                    priority: 'not_priority',
                    sla_applied: null,
                    statistics: null,
                    conversation_rating: null,
                    teammates: null,
                    title: null,
                    custom_attributes: {
                      issue_type: 'Billing',
                      priority: 'High',
                    },
                    topics: {},
                    ticket: null,
                    conversation_parts: {
                      type: 'conversation_part.list',
                      conversation_parts: [
                        {
                          type: 'conversation_part',
                          id: '68',
                          part_type: 'conversation_attribute_updated_by_admin',
                          body: null,
                          created_at: 1717021471,
                          updated_at: 1717021471,
                          notified_at: 1717021471,
                          assigned_to: null,
                          author: {
                            id: '991267423',
                            type: 'bot',
                            name: 'Operator',
                            email: 'operator+this_is_an_id332_that_should_be_at_least_@intercom.io',
                          },
                          attachments: [],
                          external_id: null,
                          redacted: false,
                        },
                        {
                          type: 'conversation_part',
                          id: '69',
                          part_type: 'conversation_attribute_updated_by_admin',
                          body: null,
                          created_at: 1717021471,
                          updated_at: 1717021471,
                          notified_at: 1717021471,
                          assigned_to: null,
                          author: {
                            id: '991267423',
                            type: 'bot',
                            name: 'Operator',
                            email: 'operator+this_is_an_id332_that_should_be_at_least_@intercom.io',
                          },
                          attachments: [],
                          external_id: null,
                          redacted: false,
                        },
                      ],
                      total_count: 2,
                    },
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/conversation',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: '91390a0b-072d-460f-8479-68b449551f18',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
        '403': {
          description: 'API plan restricted',
          content: {
            'application/json': {
              examples: {
                'API plan restricted': {
                  value: {
                    type: 'error.list',
                    request_id: '550bb111-91b0-4b1a-a0ba-7a0d4d4fe4a5',
                    errors: [
                      {
                        code: 'api_plan_restricted',
                        message: 'Active subscription needed.',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
        '404': {
          description: 'Not found',
          content: {
            'application/json': {
              examples: {
                'Not found': {
                  value: {
                    type: 'error.list',
                    request_id: '10e790d1-780d-44c8-8f3d-10ad1e4ada0c',
                    errors: [
                      {
                        code: 'not_found',
                        message: 'Resource Not Found',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/update_conversation_request',
            },
            examples: {
              conversation_found: {
                summary: 'conversation found',
                value: {
                  read: true,
                  custom_attributes: {
                    issue_type: 'Billing',
                    priority: 'High',
                  },
                },
              },
              not_found: {
                summary: 'Not found',
                value: {
                  read: true,
                  custom_attributes: {
                    issue_type: 'Billing',
                    priority: 'High',
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  '/conversations/search': {
    post: {
      summary: 'Search conversations',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
      ],
      tags: ['Conversations'],
      operationId: 'searchConversations',
      description:
        'You can search for multiple conversations by the value of their attributes in order to fetch exactly which ones you want.\n\nTo search for conversations, you need to send a `POST` request to `https://api.intercom.io/conversations/search`.\n\nThis will accept a query object in the body which will define your filters in order to search for conversations.\n{% admonition type="warning" name="Optimizing search queries" %}\n  Search queries can be complex, so optimizing them can help the performance of your search.\n  Use the `AND` and `OR` operators to combine multiple filters to get the exact results you need and utilize\n  pagination to limit the number of results returned. The default is `20` results per page and maximum is `150`.\n  See the [pagination section](https://developers.intercom.com/docs/build-an-integration/learn-more/rest-apis/pagination/#example-search-conversations-request) for more details on how to use the `starting_after` param.\n{% /admonition %}\n\n### Nesting & Limitations\n\nYou can nest these filters in order to get even more granular insights that pinpoint exactly what you need. Example: (1 OR 2) AND (3 OR 4).\nThere are some limitations to the amount of multiple\'s there can be:\n- There\'s a limit of max 2 nested filters\n- There\'s a limit of max 15 filters for each AND or OR group\n\n### Accepted Fields\n\nMost keys listed as part of the The conversation model is searchable, whether writeable or not. The value you search for has to match the accepted type, otherwise the query will fail (ie. as `created_at` accepts a date, the `value` cannot be a string such as `"foorbar"`).\nThe `source.body` field is unique as the search will not be performed against the entire value, but instead against every element of the value separately. For example, when searching for a conversation with a `"I need support"` body - the query should contain a `=` operator with the value `"support"` for such conversation to be returned. A query with a `=` operator and a `"need support"` value will not yield a result.\n\n| Field                                     | Type                                                                                                                                                   |\n| :---------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------- |\n| id                                        | String                                                                                                                                                 |\n| created_at                                | Date (UNIX timestamp)                                                                                                                                  |\n| updated_at                                | Date (UNIX timestamp)                                                                                                                                  |\n| source.type                               | String<br>Accepted fields are `conversation`, `email`, `facebook`, `instagram`, `phone_call`, `phone_switch`, `push`, `sms`, `twitter` and `whatsapp`. |\n| source.id                                 | String                                                                                                                                                 |\n| source.delivered_as                       | String                                                                                                                                                 |\n| source.subject                            | String                                                                                                                                                 |\n| source.body                               | String                                                                                                                                                 |\n| source.author.id                          | String                                                                                                                                                 |\n| source.author.type                        | String                                                                                                                                                 |\n| source.author.name                        | String                                                                                                                                                 |\n| source.author.email                       | String                                                                                                                                                 |\n| source.url                                | String                                                                                                                                                 |\n| contact_ids                               | String                                                                                                                                                 |\n| teammate_ids                              | String                                                                                                                                                 |\n| admin_assignee_id                         | String                                                                                                                                                 |\n| team_assignee_id                          | String                                                                                                                                                 |\n| channel_initiated                         | String                                                                                                                                                 |\n| open                                      | Boolean                                                                                                                                                |\n| read                                      | Boolean                                                                                                                                                |\n| state                                     | String                                                                                                                                                 |\n| waiting_since                             | Date (UNIX timestamp)                                                                                                                                  |\n| snoozed_until                             | Date (UNIX timestamp)                                                                                                                                  |\n| tag_ids                                   | String                                                                                                                                                 |\n| priority                                  | String                                                                                                                                                 |\n| statistics.time_to_assignment             | Integer                                                                                                                                                |\n| statistics.time_to_admin_reply            | Integer                                                                                                                                                |\n| statistics.time_to_first_close            | Integer                                                                                                                                                |\n| statistics.time_to_last_close             | Integer                                                                                                                                                |\n| statistics.median_time_to_reply           | Integer                                                                                                                                                |\n| statistics.first_contact_reply_at         | Date (UNIX timestamp)                                                                                                                                  |\n| statistics.first_assignment_at            | Date (UNIX timestamp)                                                                                                                                  |\n| statistics.first_admin_reply_at           | Date (UNIX timestamp)                                                                                                                                  |\n| statistics.first_close_at                 | Date (UNIX timestamp)                                                                                                                                  |\n| statistics.last_assignment_at             | Date (UNIX timestamp)                                                                                                                                  |\n| statistics.last_assignment_admin_reply_at | Date (UNIX timestamp)                                                                                                                                  |\n| statistics.last_contact_reply_at          | Date (UNIX timestamp)                                                                                                                                  |\n| statistics.last_admin_reply_at            | Date (UNIX timestamp)                                                                                                                                  |\n| statistics.last_close_at                  | Date (UNIX timestamp)                                                                                                                                  |\n| statistics.last_closed_by_id              | String                                                                                                                                                 |\n| statistics.count_reopens                  | Integer                                                                                                                                                |\n| statistics.count_assignments              | Integer                                                                                                                                                |\n| statistics.count_conversation_parts       | Integer                                                                                                                                                |\n| conversation_rating.requested_at          | Date (UNIX timestamp)                                                                                                                                  |\n| conversation_rating.replied_at            | Date (UNIX timestamp)                                                                                                                                  |\n| conversation_rating.score                 | Integer                                                                                                                                                |\n| conversation_rating.remark                | String                                                                                                                                                 |\n| conversation_rating.contact_id            | String                                                                                                                                                 |\n| conversation_rating.admin_d               | String                                                                                                                                                 |\n| ai_agent_participated                     | Boolean                                                                                                                                                |\n| ai_agent.resolution_state                 | String                                                                                                                                                 |\n| ai_agent.last_answer_type                 | String                                                                                                                                                 |\n| ai_agent.rating                           | Integer                                                                                                                                                |\n| ai_agent.rating_remark                    | String                                                                                                                                                 |\n| ai_agent.source_type                      | String                                                                                                                                                 |\n| ai_agent.source_title                     | String                                                                                                                                                 |\n\n### Accepted Operators\n\nThe table below shows the operators you can use to define how you want to search for the value.  The operator should be put in as a string (`"="`). The operator has to be compatible with the field\'s type  (eg. you cannot search with `>` for a given string value as it\'s only compatible for integer\'s and dates).\n\n| Operator | Valid Types                    | Description                                                  |\n| :------- | :----------------------------- | :----------------------------------------------------------- |\n| =        | All                            | Equals                                                       |\n| !=       | All                            | Doesn\'t Equal                                                |\n| IN       | All                            | In  Shortcut for `OR` queries  Values most be in Array       |\n| NIN      | All                            | Not In  Shortcut for `OR !` queries  Values must be in Array |\n| >        | Integer  Date (UNIX Timestamp) | Greater (or equal) than                                      |\n| <       | Integer  Date (UNIX Timestamp) | Lower (or equal) than                                        |\n| ~        | String                         | Contains                                                     |\n| !~       | String                         | Doesn\'t Contain                                              |\n| ^        | String                         | Starts With                                                  |\n| $        | String                         | Ends With                                                    |\n',
      responses: {
        '200': {
          description: 'successful',
          content: {
            'application/json': {
              examples: {
                successful: {
                  value: {
                    type: 'conversation.list',
                    pages: {
                      type: 'pages',
                      page: 1,
                      per_page: 5,
                      total_pages: 1,
                    },
                    total_count: 1,
                    conversations: [
                      {
                        type: 'conversation',
                        id: '344',
                        created_at: 1717021480,
                        updated_at: 1717021480,
                        waiting_since: null,
                        snoozed_until: null,
                        source: {
                          type: 'conversation',
                          id: '403918252',
                          delivered_as: 'admin_initiated',
                          subject: '',
                          body: '<p>this is the message body</p>',
                          author: {
                            type: 'admin',
                            id: '991267452',
                            name: 'Ciaran189 Lee',
                            email: 'admin189@email.com',
                          },
                          attachments: [],
                          url: null,
                          redacted: false,
                        },
                        contacts: {
                          type: 'contact.list',
                          contacts: [
                            {
                              type: 'contact',
                              id: '6657ab286abd0164c24b0d5c',
                            },
                          ],
                        },
                        first_contact_reply: null,
                        admin_assignee_id: null,
                        team_assignee_id: null,
                        open: false,
                        state: 'closed',
                        read: false,
                        tags: {
                          type: 'tag.list',
                          tags: [],
                        },
                        priority: 'not_priority',
                        sla_applied: null,
                        statistics: null,
                        conversation_rating: null,
                        teammates: null,
                        title: null,
                        custom_attributes: {},
                        topics: {},
                        ticket: null,
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/conversation_list',
              },
            },
          },
        },
      },
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/search_request',
            },
            examples: {
              successful: {
                summary: 'successful',
                value: {
                  query: {
                    operator: 'AND',
                    value: [
                      {
                        field: 'created_at',
                        operator: '>',
                        value: '1306054154',
                      },
                    ],
                  },
                  pagination: {
                    per_page: 5,
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  '/conversations/{id}/reply': {
    post: {
      summary: 'Reply to a conversation',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
        {
          name: 'id',
          in: 'path',
          required: true,
          description:
            'The Intercom provisioned identifier for the conversation or the string "last" to reply to the last part of the conversation',
          example: '123 or "last"',
          schema: {
            type: 'string',
          },
        },
      ],
      tags: ['Conversations'],
      operationId: 'replyConversation',
      description:
        'You can reply to a conversation with a message from an admin or on behalf of a contact, or with a note for admins.',
      responses: {
        '200': {
          description: 'User last conversation reply',
          content: {
            'application/json': {
              examples: {
                'User reply': {
                  value: {
                    type: 'conversation',
                    id: '353',
                    created_at: 1717021487,
                    updated_at: 1717021489,
                    waiting_since: 1717021488,
                    snoozed_until: null,
                    source: {
                      type: 'conversation',
                      id: '403918255',
                      delivered_as: 'admin_initiated',
                      subject: '',
                      body: '<p>this is the message body</p>',
                      author: {
                        type: 'admin',
                        id: '991267455',
                        name: 'Ciaran191 Lee',
                        email: 'admin191@email.com',
                      },
                      attachments: [],
                      url: null,
                      redacted: false,
                    },
                    contacts: {
                      type: 'contact.list',
                      contacts: [
                        {
                          type: 'contact',
                          id: '6657ab2f6abd0164c24b0d64',
                        },
                      ],
                    },
                    first_contact_reply: {
                      created_at: 1717021488,
                      type: 'conversation',
                      url: null,
                    },
                    admin_assignee_id: null,
                    team_assignee_id: null,
                    open: true,
                    state: 'open',
                    read: false,
                    tags: {
                      type: 'tag.list',
                      tags: [],
                    },
                    priority: 'not_priority',
                    sla_applied: null,
                    statistics: null,
                    conversation_rating: null,
                    teammates: null,
                    title: null,
                    custom_attributes: {},
                    topics: {},
                    ticket: null,
                    conversation_parts: {
                      type: 'conversation_part.list',
                      conversation_parts: [
                        {
                          type: 'conversation_part',
                          id: '71',
                          part_type: 'open',
                          body: '<p>Thanks again :)</p>',
                          created_at: 1717021488,
                          updated_at: 1717021488,
                          notified_at: 1717021488,
                          assigned_to: null,
                          author: {
                            id: '6657ab2f6abd0164c24b0d64',
                            type: 'user',
                            name: 'Joe Bloggs',
                            email: 'joe@bloggs.com',
                          },
                          attachments: [],
                          external_id: null,
                          redacted: false,
                        },
                        {
                          type: 'conversation_part',
                          id: '72',
                          part_type: 'language_detection_details',
                          body: null,
                          created_at: 1717021489,
                          updated_at: 1717021489,
                          notified_at: 1717021489,
                          assigned_to: null,
                          author: {
                            id: '991267456',
                            type: 'bot',
                            name: 'Operator',
                            email: 'operator+this_is_an_id346_that_should_be_at_least_@intercom.io',
                          },
                          attachments: [],
                          external_id: null,
                          redacted: false,
                        },
                      ],
                      total_count: 2,
                    },
                  },
                },
                'Admin note reply': {
                  value: {
                    type: 'conversation',
                    id: '354',
                    created_at: 1717021490,
                    updated_at: 1717021491,
                    waiting_since: null,
                    snoozed_until: null,
                    source: {
                      type: 'conversation',
                      id: '403918256',
                      delivered_as: 'admin_initiated',
                      subject: '',
                      body: '<p>this is the message body</p>',
                      author: {
                        type: 'admin',
                        id: '991267457',
                        name: 'Ciaran192 Lee',
                        email: 'admin192@email.com',
                      },
                      attachments: [],
                      url: null,
                      redacted: false,
                    },
                    contacts: {
                      type: 'contact.list',
                      contacts: [
                        {
                          type: 'contact',
                          id: '6657ab326abd0164c24b0d65',
                        },
                      ],
                    },
                    first_contact_reply: null,
                    admin_assignee_id: null,
                    team_assignee_id: null,
                    open: false,
                    state: 'closed',
                    read: false,
                    tags: {
                      type: 'tag.list',
                      tags: [],
                    },
                    priority: 'not_priority',
                    sla_applied: null,
                    statistics: null,
                    conversation_rating: null,
                    teammates: null,
                    title: null,
                    custom_attributes: {},
                    topics: {},
                    ticket: null,
                    conversation_parts: {
                      type: 'conversation_part.list',
                      conversation_parts: [
                        {
                          type: 'conversation_part',
                          id: '73',
                          part_type: 'note',
                          body: '<h2>An Unordered HTML List</h2>\n<ul>\n<li>Coffee</li>\n<li>Tea</li>\n<li>Milk</li>\n</ul>\n<h2>An Ordered HTML List</h2>\n<ol>\n<li>Coffee</li>\n<li>Tea</li>\n<li>Milk</li>\n</ol>',
                          created_at: 1717021491,
                          updated_at: 1717021491,
                          notified_at: 1717021491,
                          assigned_to: null,
                          author: {
                            id: '991267457',
                            type: 'admin',
                            name: 'Ciaran192 Lee',
                            email: 'admin192@email.com',
                          },
                          attachments: [],
                          external_id: null,
                          redacted: false,
                        },
                      ],
                      total_count: 1,
                    },
                  },
                },
                'User last conversation reply': {
                  value: {
                    type: 'conversation',
                    id: '356',
                    created_at: 1717021493,
                    updated_at: 1717021494,
                    waiting_since: 1717021494,
                    snoozed_until: null,
                    source: {
                      type: 'conversation',
                      id: '403918258',
                      delivered_as: 'admin_initiated',
                      subject: '',
                      body: '<p>this is the message body</p>',
                      author: {
                        type: 'admin',
                        id: '991267461',
                        name: 'Ciaran194 Lee',
                        email: 'admin194@email.com',
                      },
                      attachments: [],
                      url: null,
                      redacted: false,
                    },
                    contacts: {
                      type: 'contact.list',
                      contacts: [
                        {
                          type: 'contact',
                          id: '6657ab356abd0164c24b0d67',
                        },
                      ],
                    },
                    first_contact_reply: {
                      created_at: 1717021494,
                      type: 'conversation',
                      url: null,
                    },
                    admin_assignee_id: null,
                    team_assignee_id: null,
                    open: true,
                    state: 'open',
                    read: false,
                    tags: {
                      type: 'tag.list',
                      tags: [],
                    },
                    priority: 'not_priority',
                    sla_applied: null,
                    statistics: null,
                    conversation_rating: null,
                    teammates: null,
                    title: null,
                    custom_attributes: {},
                    topics: {},
                    ticket: null,
                    conversation_parts: {
                      type: 'conversation_part.list',
                      conversation_parts: [
                        {
                          type: 'conversation_part',
                          id: '74',
                          part_type: 'open',
                          body: '<p>Thanks again :)</p>',
                          created_at: 1717021494,
                          updated_at: 1717021494,
                          notified_at: 1717021494,
                          assigned_to: null,
                          author: {
                            id: '6657ab356abd0164c24b0d67',
                            type: 'user',
                            name: 'Joe Bloggs',
                            email: 'joe@bloggs.com',
                          },
                          attachments: [],
                          external_id: null,
                          redacted: false,
                        },
                        {
                          type: 'conversation_part',
                          id: '75',
                          part_type: 'language_detection_details',
                          body: null,
                          created_at: 1717021494,
                          updated_at: 1717021494,
                          notified_at: 1717021494,
                          assigned_to: null,
                          author: {
                            id: '991267462',
                            type: 'bot',
                            name: 'Operator',
                            email: 'operator+this_is_an_id352_that_should_be_at_least_@intercom.io',
                          },
                          attachments: [],
                          external_id: null,
                          redacted: false,
                        },
                      ],
                      total_count: 2,
                    },
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/conversation',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: 'b7b53b82-b194-4cca-ae16-e96b5f026b32',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
        '403': {
          description: 'API plan restricted',
          content: {
            'application/json': {
              examples: {
                'API plan restricted': {
                  value: {
                    type: 'error.list',
                    request_id: '14779f4f-31d1-46cc-a4fa-7d799bdcbef6',
                    errors: [
                      {
                        code: 'api_plan_restricted',
                        message: 'Active subscription needed.',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
        '404': {
          description: 'Not found',
          content: {
            'application/json': {
              examples: {
                'Not found': {
                  value: {
                    type: 'error.list',
                    request_id: '89de1a37-4535-4bd5-84d8-8ce890d12fa5',
                    errors: [
                      {
                        code: 'not_found',
                        message: 'Resource Not Found',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/reply_conversation_request',
            },
            examples: {
              user_reply: {
                summary: 'User reply',
                value: {
                  message_type: 'comment',
                  type: 'user',
                  intercom_user_id: '6657ab2f6abd0164c24b0d64',
                  body: 'Thanks again :)',
                },
              },
              admin_note_reply: {
                summary: 'Admin note reply',
                value: {
                  message_type: 'note',
                  type: 'admin',
                  admin_id: 991267457,
                  body: '<html> <body>  <h2>An Unordered HTML List</h2>  <ul>   <li>Coffee</li>   <li>Tea</li>   <li>Milk</li> </ul>    <h2>An Ordered HTML List</h2>  <ol>   <li>Coffee</li>   <li>Tea</li>   <li>Milk</li> </ol>   </body> </html>',
                },
              },
              user_last_conversation_reply: {
                summary: 'User last conversation reply',
                value: {
                  message_type: 'comment',
                  type: 'user',
                  intercom_user_id: '6657ab356abd0164c24b0d67',
                  body: 'Thanks again :)',
                },
              },
              not_found: {
                summary: 'Not found',
                value: {
                  message_type: 'comment',
                  type: 'user',
                  intercom_user_id: '6657ab376abd0164c24b0d68',
                  body: 'Thanks again :)',
                },
              },
            },
          },
        },
      },
    },
  },
  '/conversations/{id}/parts': {
    post: {
      summary: 'Manage a conversation',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
        {
          name: 'id',
          in: 'path',
          required: true,
          description: 'The identifier for the conversation as given by Intercom.',
          example: '123',
          schema: {
            type: 'string',
          },
        },
      ],
      tags: ['Conversations'],
      operationId: 'manageConversation',
      description:
        'For managing conversations you can:\n- Close a conversation\n- Snooze a conversation to reopen on a future date\n- Open a conversation which is `snoozed` or `closed`\n- Assign a conversation to an admin and/or team.\n',
      responses: {
        '200': {
          description: 'Assign a conversation',
          content: {
            'application/json': {
              examples: {
                'Close a conversation': {
                  value: {
                    type: 'conversation',
                    id: '360',
                    created_at: 1717021500,
                    updated_at: 1717021501,
                    waiting_since: null,
                    snoozed_until: null,
                    source: {
                      type: 'conversation',
                      id: '403918262',
                      delivered_as: 'admin_initiated',
                      subject: '',
                      body: '<p>this is the message body</p>',
                      author: {
                        type: 'admin',
                        id: '991267469',
                        name: 'Ciaran198 Lee',
                        email: 'admin198@email.com',
                      },
                      attachments: [],
                      url: null,
                      redacted: false,
                    },
                    contacts: {
                      type: 'contact.list',
                      contacts: [
                        {
                          type: 'contact',
                          id: '6657ab3c6abd0164c24b0d6b',
                        },
                      ],
                    },
                    first_contact_reply: null,
                    admin_assignee_id: null,
                    team_assignee_id: null,
                    open: false,
                    state: 'closed',
                    read: false,
                    tags: {
                      type: 'tag.list',
                      tags: [],
                    },
                    priority: 'not_priority',
                    sla_applied: null,
                    statistics: null,
                    conversation_rating: null,
                    teammates: null,
                    title: null,
                    custom_attributes: {},
                    topics: {},
                    ticket: null,
                    conversation_parts: {
                      type: 'conversation_part.list',
                      conversation_parts: [
                        {
                          type: 'conversation_part',
                          id: '76',
                          part_type: 'close',
                          body: '<p>Goodbye :)</p>',
                          created_at: 1717021501,
                          updated_at: 1717021501,
                          notified_at: 1717021501,
                          assigned_to: null,
                          author: {
                            id: '991267469',
                            type: 'admin',
                            name: 'Ciaran198 Lee',
                            email: 'admin198@email.com',
                          },
                          attachments: [],
                          external_id: null,
                          redacted: false,
                        },
                      ],
                      total_count: 1,
                    },
                  },
                },
                'Snooze a conversation': {
                  value: {
                    type: 'conversation',
                    id: '361',
                    created_at: 1717021502,
                    updated_at: 1717021503,
                    waiting_since: null,
                    snoozed_until: 1717025103,
                    source: {
                      type: 'conversation',
                      id: '403918263',
                      delivered_as: 'admin_initiated',
                      subject: '',
                      body: '<p>this is the message body</p>',
                      author: {
                        type: 'admin',
                        id: '991267471',
                        name: 'Ciaran199 Lee',
                        email: 'admin199@email.com',
                      },
                      attachments: [],
                      url: null,
                      redacted: false,
                    },
                    contacts: {
                      type: 'contact.list',
                      contacts: [
                        {
                          type: 'contact',
                          id: '6657ab3e6abd0164c24b0d6c',
                        },
                      ],
                    },
                    first_contact_reply: null,
                    admin_assignee_id: null,
                    team_assignee_id: null,
                    open: true,
                    state: 'snoozed',
                    read: false,
                    tags: {
                      type: 'tag.list',
                      tags: [],
                    },
                    priority: 'not_priority',
                    sla_applied: null,
                    statistics: null,
                    conversation_rating: null,
                    teammates: null,
                    title: null,
                    custom_attributes: {},
                    topics: {},
                    ticket: null,
                    conversation_parts: {
                      type: 'conversation_part.list',
                      conversation_parts: [
                        {
                          type: 'conversation_part',
                          id: '77',
                          part_type: 'snoozed',
                          body: null,
                          created_at: 1717021503,
                          updated_at: 1717021503,
                          notified_at: 1717021503,
                          assigned_to: null,
                          author: {
                            id: '991267471',
                            type: 'admin',
                            name: 'Ciaran199 Lee',
                            email: 'admin199@email.com',
                          },
                          attachments: [],
                          external_id: null,
                          redacted: false,
                        },
                      ],
                      total_count: 1,
                    },
                  },
                },
                'Open a conversation': {
                  value: {
                    type: 'conversation',
                    id: '366',
                    created_at: 1717021502,
                    updated_at: 1717021512,
                    waiting_since: null,
                    snoozed_until: null,
                    source: {
                      type: 'conversation',
                      id: '403918264',
                      delivered_as: 'admin_initiated',
                      subject: '',
                      body: '<p>this is the message body</p>',
                      author: {
                        type: 'admin',
                        id: '991267473',
                        name: 'Ciaran200 Lee',
                        email: 'admin200@email.com',
                      },
                      attachments: [],
                      url: null,
                      redacted: false,
                    },
                    contacts: {
                      type: 'contact.list',
                      contacts: [
                        {
                          type: 'contact',
                          id: '6657ab426abd0164c24b0d71',
                        },
                      ],
                    },
                    first_contact_reply: null,
                    admin_assignee_id: null,
                    team_assignee_id: null,
                    open: true,
                    state: 'open',
                    read: true,
                    tags: {
                      type: 'tag.list',
                      tags: [],
                    },
                    priority: 'not_priority',
                    sla_applied: null,
                    statistics: null,
                    conversation_rating: null,
                    teammates: null,
                    title: '',
                    custom_attributes: {},
                    topics: {},
                    ticket: null,
                    conversation_parts: {
                      type: 'conversation_part.list',
                      conversation_parts: [
                        {
                          type: 'conversation_part',
                          id: '79',
                          part_type: 'open',
                          body: null,
                          created_at: 1717021512,
                          updated_at: 1717021512,
                          notified_at: 1717021512,
                          assigned_to: null,
                          author: {
                            id: '991267473',
                            type: 'admin',
                            name: 'Ciaran200 Lee',
                            email: 'admin200@email.com',
                          },
                          attachments: [],
                          external_id: null,
                          redacted: false,
                        },
                      ],
                      total_count: 1,
                    },
                  },
                },
                'Assign a conversation': {
                  value: {
                    type: 'conversation',
                    id: '371',
                    created_at: 1717021513,
                    updated_at: 1717021514,
                    waiting_since: null,
                    snoozed_until: null,
                    source: {
                      type: 'conversation',
                      id: '403918267',
                      delivered_as: 'admin_initiated',
                      subject: '',
                      body: '<p>this is the message body</p>',
                      author: {
                        type: 'admin',
                        id: '991267476',
                        name: 'Ciaran202 Lee',
                        email: 'admin202@email.com',
                      },
                      attachments: [],
                      url: null,
                      redacted: false,
                    },
                    contacts: {
                      type: 'contact.list',
                      contacts: [
                        {
                          type: 'contact',
                          id: '6657ab496abd0164c24b0d75',
                        },
                      ],
                    },
                    first_contact_reply: null,
                    admin_assignee_id: 991267476,
                    team_assignee_id: null,
                    open: true,
                    state: 'open',
                    read: false,
                    tags: {
                      type: 'tag.list',
                      tags: [],
                    },
                    priority: 'not_priority',
                    sla_applied: null,
                    statistics: null,
                    conversation_rating: null,
                    teammates: null,
                    title: null,
                    custom_attributes: {},
                    topics: {},
                    ticket: null,
                    conversation_parts: {
                      type: 'conversation_part.list',
                      conversation_parts: [
                        {
                          type: 'conversation_part',
                          id: '80',
                          part_type: 'assign_and_reopen',
                          body: null,
                          created_at: 1717021514,
                          updated_at: 1717021514,
                          notified_at: 1717021514,
                          assigned_to: {
                            type: 'admin',
                            id: '991267476',
                          },
                          author: {
                            id: '991267476',
                            type: 'admin',
                            name: 'Ciaran202 Lee',
                            email: 'admin202@email.com',
                          },
                          attachments: [],
                          external_id: null,
                          redacted: false,
                        },
                      ],
                      total_count: 1,
                    },
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/conversation',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: '09df82cc-f148-4e0a-aceb-de32ffccc17a',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
        '403': {
          description: 'API plan restricted',
          content: {
            'application/json': {
              examples: {
                'API plan restricted': {
                  value: {
                    type: 'error.list',
                    request_id: '8e3d0d18-8021-46c4-a041-2dc3993810ee',
                    errors: [
                      {
                        code: 'api_plan_restricted',
                        message: 'Active subscription needed.',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
        '404': {
          description: 'Not found',
          content: {
            'application/json': {
              examples: {
                'Not found': {
                  value: {
                    type: 'error.list',
                    request_id: '69371e02-f296-471e-a494-1a532b5a1aa2',
                    errors: [
                      {
                        code: 'not_found',
                        message: 'Resource Not Found',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
      requestBody: {
        content: {
          'application/json': {
            schema: {
              oneOf: [
                {
                  $ref: '#/components/schemas/close_conversation_request',
                },
                {
                  $ref: '#/components/schemas/snooze_conversation_request',
                },
                {
                  $ref: '#/components/schemas/open_conversation_request',
                },
                {
                  $ref: '#/components/schemas/assign_conversation_request',
                },
              ],
            },
            examples: {
              close_a_conversation: {
                summary: 'Close a conversation',
                value: {
                  message_type: 'close',
                  type: 'admin',
                  admin_id: 991267469,
                  body: 'Goodbye :)',
                },
              },
              snooze_a_conversation: {
                summary: 'Snooze a conversation',
                value: {
                  message_type: 'snoozed',
                  admin_id: 991267471,
                  snoozed_until: 1717025103,
                },
              },
              open_a_conversation: {
                summary: 'Open a conversation',
                value: {
                  message_type: 'open',
                  admin_id: 991267473,
                },
              },
              assign_a_conversation: {
                summary: 'Assign a conversation',
                value: {
                  message_type: 'assignment',
                  type: 'admin',
                  admin_id: 991267476,
                  assignee_id: 991267476,
                },
              },
              not_found: {
                summary: 'Not found',
                value: {
                  message_type: 'close',
                  type: 'admin',
                  admin_id: 991267478,
                  body: 'Goodbye :)',
                },
              },
            },
          },
        },
      },
    },
  },
  '/conversations/{id}/run_assignment_rules': {
    post: {
      summary: 'Run Assignment Rules on a conversation',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
        {
          name: 'id',
          in: 'path',
          required: true,
          description: 'The identifier for the conversation as given by Intercom.',
          example: '123',
          schema: {
            type: 'string',
          },
        },
      ],
      tags: ['Conversations'],
      operationId: 'autoAssignConversation',
      description:
        'You can let a conversation be automatically assigned following assignment rules.\n{% admonition type="attention" name="When using workflows" %}\nIt is not possible to use this endpoint with Workflows.\n{% /admonition %}\n',
      responses: {
        '200': {
          description: 'Assign a conversation using assignment rules',
          content: {
            'application/json': {
              examples: {
                'Assign a conversation using assignment rules': {
                  value: {
                    type: 'conversation',
                    id: '375',
                    created_at: 1717021520,
                    updated_at: 1717021521,
                    waiting_since: null,
                    snoozed_until: null,
                    source: {
                      type: 'conversation',
                      id: '403918271',
                      delivered_as: 'admin_initiated',
                      subject: '',
                      body: '<p>this is the message body</p>',
                      author: {
                        type: 'admin',
                        id: '991267484',
                        name: 'Ciaran206 Lee',
                        email: 'admin206@email.com',
                      },
                      attachments: [],
                      url: null,
                      redacted: false,
                    },
                    contacts: {
                      type: 'contact.list',
                      contacts: [
                        {
                          type: 'contact',
                          id: '6657ab4f6abd0164c24b0d79',
                        },
                      ],
                    },
                    first_contact_reply: null,
                    admin_assignee_id: null,
                    team_assignee_id: null,
                    open: false,
                    state: 'closed',
                    read: false,
                    tags: {
                      type: 'tag.list',
                      tags: [],
                    },
                    priority: 'not_priority',
                    sla_applied: null,
                    statistics: null,
                    conversation_rating: null,
                    teammates: null,
                    title: null,
                    custom_attributes: {},
                    topics: {},
                    ticket: null,
                    conversation_parts: {
                      type: 'conversation_part.list',
                      conversation_parts: [
                        {
                          type: 'conversation_part',
                          id: '81',
                          part_type: 'default_assignment',
                          body: null,
                          created_at: 1717021521,
                          updated_at: 1717021521,
                          notified_at: 1717021521,
                          assigned_to: {
                            type: 'nobody_admin',
                            id: null,
                          },
                          author: {
                            id: '991267485',
                            type: 'bot',
                            name: 'Operator',
                            email: 'operator+this_is_an_id375_that_should_be_at_least_@intercom.io',
                          },
                          attachments: [],
                          external_id: null,
                          redacted: false,
                        },
                      ],
                      total_count: 1,
                    },
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/conversation',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: '469fd3bb-93cc-440a-92dc-a13b1677d376',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
        '403': {
          description: 'API plan restricted',
          content: {
            'application/json': {
              examples: {
                'API plan restricted': {
                  value: {
                    type: 'error.list',
                    request_id: '5315a8cb-df46-4bb3-90ec-143d787edda3',
                    errors: [
                      {
                        code: 'api_plan_restricted',
                        message: 'Active subscription needed.',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
        '404': {
          description: 'Not found',
          content: {
            'application/json': {
              examples: {
                'Not found': {
                  value: {
                    type: 'error.list',
                    request_id: '57b08a56-d3a2-4b62-9c10-7779a72d3b40',
                    errors: [
                      {
                        code: 'not_found',
                        message: 'Resource Not Found',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
    },
  },
  '/conversations/{id}/customers': {
    post: {
      summary: 'Attach a contact to a conversation',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
        {
          name: 'id',
          in: 'path',
          required: true,
          description: 'The identifier for the conversation as given by Intercom.',
          example: '123',
          schema: {
            type: 'string',
          },
        },
      ],
      tags: ['Conversations'],
      operationId: 'attachContactToConversation',
      description:
        'You can add participants who are contacts to a conversation, on behalf of either another contact or an admin.\n\n{% admonition type="attention" name="Contacts without an email" %}\nIf you add a contact via the email parameter and there is no user/lead found on that workspace with he given email, then we will create a new contact with `role` set to `lead`.\n{% /admonition %}\n\n',
      responses: {
        '200': {
          description: 'Attach a contact to a conversation',
          content: {
            'application/json': {
              examples: {
                'Attach a contact to a conversation': {
                  value: {
                    customers: [
                      {
                        type: 'user',
                        id: '6657ab566abd0164c24b0d7d',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/conversation',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: '1c005bf9-c6f0-4fc1-b352-53e84c675cc5',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
        '403': {
          description: 'API plan restricted',
          content: {
            'application/json': {
              examples: {
                'API plan restricted': {
                  value: {
                    type: 'error.list',
                    request_id: '717510bb-f9b8-4237-a89d-41bccf8dca5c',
                    errors: [
                      {
                        code: 'api_plan_restricted',
                        message: 'Active subscription needed.',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
        '404': {
          description: 'Not found',
          content: {
            'application/json': {
              examples: {
                'Not found': {
                  value: {
                    type: 'error.list',
                    request_id: 'd203f7a5-6175-4a1a-9c64-cc807288bcda',
                    errors: [
                      {
                        code: 'not_found',
                        message: 'Resource Not Found',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/attach_contact_to_conversation_request',
            },
            examples: {
              attach_a_contact_to_a_conversation: {
                summary: 'Attach a contact to a conversation',
                value: {
                  admin_id: 991267492,
                  customer: {
                    intercom_user_id: '6657ab566abd0164c24b0d7d',
                  },
                },
              },
              not_found: {
                summary: 'Not found',
                value: {
                  admin_id: 991267494,
                  customer: {
                    intercom_user_id: '6657ab576abd0164c24b0d7e',
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  '/conversations/{conversation_id}/customers/{contact_id}': {
    delete: {
      summary: 'Detach a contact from a group conversation',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
        {
          name: 'conversation_id',
          in: 'path',
          required: true,
          description: 'The identifier for the conversation as given by Intercom.',
          example: '123',
          schema: {
            type: 'string',
          },
        },
        {
          name: 'contact_id',
          in: 'path',
          required: true,
          description: 'The identifier for the contact as given by Intercom.',
          example: '123',
          schema: {
            type: 'string',
          },
        },
      ],
      tags: ['Conversations'],
      operationId: 'detachContactFromConversation',
      description:
        'You can add participants who are contacts to a conversation, on behalf of either another contact or an admin.\n\n{% admonition type="attention" name="Contacts without an email" %}\nIf you add a contact via the email parameter and there is no user/lead found on that workspace with he given email, then we will create a new contact with `role` set to `lead`.\n{% /admonition %}\n\n',
      responses: {
        '200': {
          description: 'Detach a contact from a group conversation',
          content: {
            'application/json': {
              examples: {
                'Detach a contact from a group conversation': {
                  value: {
                    customers: [
                      {
                        type: 'user',
                        id: '6657ab636abd0164c24b0d89',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/conversation',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: 'f4ac4049-1de5-4587-ae47-42149bab024a',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
        '403': {
          description: 'API plan restricted',
          content: {
            'application/json': {
              examples: {
                'API plan restricted': {
                  value: {
                    type: 'error.list',
                    request_id: '6c084c7f-9ff4-47d9-94ce-f7241256d119',
                    errors: [
                      {
                        code: 'api_plan_restricted',
                        message: 'Active subscription needed.',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
        '404': {
          description: 'Contact not found',
          content: {
            'application/json': {
              examples: {
                'Conversation not found': {
                  value: {
                    type: 'error.list',
                    request_id: '52dc69da-3bbd-486a-b932-adf6bcd9bfce',
                    errors: [
                      {
                        code: 'not_found',
                        message: 'Resource Not Found',
                      },
                    ],
                  },
                },
                'Contact not found': {
                  value: {
                    type: 'error.list',
                    request_id: '08be5e8d-4a8d-4bdc-9352-5044268a97a8',
                    errors: [
                      {
                        code: 'not_found',
                        message: 'User Not Found',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
        '422': {
          description: 'Last customer',
          content: {
            'application/json': {
              examples: {
                'Last customer': {
                  value: {
                    type: 'error.list',
                    request_id: 'e1e0f127-bd7e-4d98-923e-792ceaca8575',
                    errors: [
                      {
                        code: 'parameter_invalid',
                        message: 'Removing the last customer is not allowed',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/detach_contact_from_conversation_request',
            },
            examples: {
              detach_a_contact_from_a_group_conversation: {
                summary: 'Detach a contact from a group conversation',
                value: {
                  admin_id: 991267500,
                  customer: {
                    intercom_user_id: '6657ab5c6abd0164c24b0d81',
                  },
                },
              },
              conversation_not_found: {
                summary: 'Conversation not found',
                value: {
                  admin_id: 991267503,
                  customer: {
                    intercom_user_id: '6657ab656abd0164c24b0d8a',
                  },
                },
              },
              contact_not_found: {
                summary: 'Contact not found',
                value: {
                  admin_id: 991267506,
                  customer: {
                    intercom_user_id: '6657ab6c6abd0164c24b0d92',
                  },
                },
              },
              last_customer: {
                summary: 'Last customer',
                value: {
                  admin_id: 991267509,
                  customer: {
                    intercom_user_id: '6657ab736abd0164c24b0d9a',
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  '/conversations/redact': {
    post: {
      summary: 'Redact a conversation part',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
      ],
      tags: ['Conversations'],
      operationId: 'redactConversation',
      description:
        'You can redact a conversation part or the source message of a conversation (as seen in the source object).\n\n{% admonition type="info" name="Redacting parts and messages" %}\nIf you are redacting a conversation part, it must have a `body`. If you are redacting a source message, it must have been created by a contact. We will return a `conversation_part_not_redactable` error if these criteria are not met.\n{% /admonition %}\n\n',
      responses: {
        '200': {
          description: 'Redact a conversation part',
          content: {
            'application/json': {
              examples: {
                'Redact a conversation part': {
                  value: {
                    type: 'conversation',
                    id: '437',
                    created_at: 1717021579,
                    updated_at: 1717021582,
                    waiting_since: 1717021580,
                    snoozed_until: null,
                    source: {
                      type: 'conversation',
                      id: '403918297',
                      delivered_as: 'admin_initiated',
                      subject: '',
                      body: '<p>this is the message body</p>',
                      author: {
                        type: 'admin',
                        id: '991267518',
                        name: 'Ciaran226 Lee',
                        email: 'admin226@email.com',
                      },
                      attachments: [],
                      url: null,
                      redacted: false,
                    },
                    contacts: {
                      type: 'contact.list',
                      contacts: [
                        {
                          type: 'contact',
                          id: '6657ab8b6abd0164c24b0db2',
                        },
                      ],
                    },
                    first_contact_reply: {
                      created_at: 1717021580,
                      type: 'conversation',
                      url: null,
                    },
                    admin_assignee_id: null,
                    team_assignee_id: null,
                    open: true,
                    state: 'open',
                    read: true,
                    tags: {
                      type: 'tag.list',
                      tags: [],
                    },
                    priority: 'not_priority',
                    sla_applied: null,
                    statistics: null,
                    conversation_rating: null,
                    teammates: null,
                    title: null,
                    custom_attributes: {},
                    topics: {},
                    ticket: null,
                    conversation_parts: {
                      type: 'conversation_part.list',
                      conversation_parts: [
                        {
                          type: 'conversation_part',
                          id: '89',
                          part_type: 'open',
                          body: '<p><i>This message was deleted</i></p>',
                          created_at: 1717021580,
                          updated_at: 1717021582,
                          notified_at: 1717021580,
                          assigned_to: null,
                          author: {
                            id: '6657ab8b6abd0164c24b0db2',
                            type: 'user',
                            name: 'Joe Bloggs',
                            email: 'joe@bloggs.com',
                          },
                          attachments: [],
                          external_id: null,
                          redacted: true,
                        },
                        {
                          type: 'conversation_part',
                          id: '90',
                          part_type: 'language_detection_details',
                          body: null,
                          created_at: 1717021580,
                          updated_at: 1717021580,
                          notified_at: 1717021580,
                          assigned_to: null,
                          author: {
                            id: '991267519',
                            type: 'bot',
                            name: 'Operator',
                            email: 'operator+this_is_an_id409_that_should_be_at_least_@intercom.io',
                          },
                          attachments: [],
                          external_id: null,
                          redacted: false,
                        },
                      ],
                      total_count: 2,
                    },
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/conversation',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: '892510d5-1003-4dae-ae3a-16f032ce47ed',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
        '404': {
          description: 'Not found',
          content: {
            'application/json': {
              examples: {
                'Not found': {
                  value: {
                    type: 'error.list',
                    request_id: '4bfb74f7-a3f1-491f-bed8-6d1f7a9231cc',
                    errors: [
                      {
                        code: 'conversation_part_or_message_not_found',
                        message: 'Conversation part or message not found',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/redact_conversation_request',
            },
            examples: {
              redact_a_conversation_part: {
                summary: 'Redact a conversation part',
                value: {
                  type: 'conversation_part',
                  conversation_id: 437,
                  conversation_part_id: 89,
                },
              },
              not_found: {
                summary: 'Not found',
                value: {
                  type: 'conversation_part',
                  conversation_id: 'really_123_doesnt_exist',
                  conversation_part_id: 'really_123_doesnt_exist',
                },
              },
            },
          },
        },
      },
    },
  },
  '/data_attributes': {
    get: {
      summary: 'List all data attributes',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
        {
          name: 'model',
          in: 'query',
          required: false,
          description: 'Specify the data attribute model to return.',
          schema: {
            type: 'string',
            enum: ['contact', 'company', 'conversation'],
          },
          example: 'company',
        },
        {
          name: 'include_archived',
          in: 'query',
          required: false,
          description:
            'Include archived attributes in the list. By default we return only non archived data attributes.',
          example: false,
          schema: {
            type: 'boolean',
          },
        },
      ],
      tags: ['Data Attributes'],
      operationId: 'lisDataAttributes',
      description:
        'You can fetch a list of all data attributes belonging to a workspace for contacts, companies or conversations.',
      responses: {
        '200': {
          description: 'Successful response',
          content: {
            'application/json': {
              examples: {
                'Successful response': {
                  value: {
                    type: 'list',
                    data: [
                      {
                        type: 'data_attribute',
                        name: 'name',
                        full_name: 'name',
                        label: 'Company name',
                        description: 'The name of a company',
                        data_type: 'string',
                        api_writable: true,
                        ui_writable: false,
                        messenger_writable: true,
                        custom: false,
                        archived: false,
                        model: 'company',
                      },
                      {
                        type: 'data_attribute',
                        name: 'company_id',
                        full_name: 'company_id',
                        label: 'Company ID',
                        description: 'A number identifying a company',
                        data_type: 'string',
                        api_writable: false,
                        ui_writable: false,
                        messenger_writable: true,
                        custom: false,
                        archived: false,
                        model: 'company',
                      },
                      {
                        type: 'data_attribute',
                        name: 'last_request_at',
                        full_name: 'last_request_at',
                        label: 'Company last seen',
                        description: 'The last day anyone from a company visited your site or app',
                        data_type: 'date',
                        api_writable: false,
                        ui_writable: false,
                        messenger_writable: true,
                        custom: false,
                        archived: false,
                        model: 'company',
                      },
                      {
                        type: 'data_attribute',
                        name: 'remote_created_at',
                        full_name: 'remote_created_at',
                        label: 'Company created at',
                        description: 'The day a company was added to Intercom',
                        data_type: 'date',
                        api_writable: true,
                        ui_writable: false,
                        messenger_writable: true,
                        custom: false,
                        archived: false,
                        model: 'company',
                      },
                      {
                        type: 'data_attribute',
                        name: 'user_count',
                        full_name: 'user_count',
                        label: 'People',
                        description: 'The number of people in a company',
                        data_type: 'integer',
                        api_writable: false,
                        ui_writable: false,
                        messenger_writable: true,
                        custom: false,
                        archived: false,
                        model: 'company',
                      },
                      {
                        type: 'data_attribute',
                        name: 'session_count',
                        full_name: 'session_count',
                        label: 'Company web sessions',
                        description: "All visits from anyone in a company to your product's site or app",
                        data_type: 'integer',
                        api_writable: false,
                        ui_writable: false,
                        messenger_writable: true,
                        custom: false,
                        archived: false,
                        model: 'company',
                      },
                      {
                        type: 'data_attribute',
                        name: 'name',
                        full_name: 'plan.name',
                        label: 'Plan',
                        description: 'A specific plan or level within your product that companies have signed up to',
                        data_type: 'string',
                        api_writable: false,
                        ui_writable: false,
                        messenger_writable: true,
                        custom: false,
                        archived: false,
                        model: 'company',
                      },
                      {
                        type: 'data_attribute',
                        name: 'monthly_spend',
                        full_name: 'monthly_spend',
                        label: 'Monthly Spend',
                        description: 'The monthly revenue you receive from a company',
                        data_type: 'float',
                        api_writable: true,
                        ui_writable: false,
                        messenger_writable: true,
                        custom: false,
                        archived: false,
                        model: 'company',
                      },
                      {
                        type: 'data_attribute',
                        name: 'size',
                        full_name: 'size',
                        label: 'Company size',
                        description: 'The number of people employed in this company, expressed as a single number',
                        data_type: 'integer',
                        api_writable: true,
                        ui_writable: false,
                        messenger_writable: true,
                        custom: false,
                        archived: false,
                        model: 'company',
                      },
                      {
                        type: 'data_attribute',
                        name: 'industry',
                        full_name: 'industry',
                        label: 'Company industry',
                        description: "The category or domain this company belongs to e.g. 'ecommerce' or 'SaaS'",
                        data_type: 'string',
                        api_writable: true,
                        ui_writable: false,
                        messenger_writable: true,
                        custom: false,
                        archived: false,
                        model: 'company',
                      },
                      {
                        type: 'data_attribute',
                        name: 'website',
                        full_name: 'website',
                        label: 'Company website',
                        description: "The web address for the company's primary marketing site",
                        data_type: 'string',
                        api_writable: true,
                        ui_writable: false,
                        messenger_writable: true,
                        custom: false,
                        archived: false,
                        model: 'company',
                      },
                      {
                        id: 34,
                        type: 'data_attribute',
                        name: 'The One Ring',
                        full_name: 'custom_attributes.The One Ring',
                        label: 'The One Ring',
                        description:
                          'One ring to rule them all, one ring to find them, One ring to bring them all and in the darkness bind them.',
                        data_type: 'string',
                        api_writable: true,
                        ui_writable: false,
                        messenger_writable: true,
                        custom: true,
                        archived: false,
                        admin_id: '991267543',
                        created_at: 1717021596,
                        updated_at: 1717021596,
                        model: 'company',
                      },
                      {
                        type: 'data_attribute',
                        name: 'id',
                        full_name: 'id',
                        label: 'ID',
                        description: 'The Intercom defined id representing the company',
                        data_type: 'string',
                        api_writable: false,
                        ui_writable: false,
                        messenger_writable: true,
                        custom: false,
                        archived: false,
                        model: 'company',
                      },
                      {
                        type: 'data_attribute',
                        name: 'created_at',
                        full_name: 'created_at',
                        label: 'Created at',
                        description: 'The time the company was added to Intercom',
                        data_type: 'date',
                        api_writable: false,
                        ui_writable: false,
                        messenger_writable: true,
                        custom: false,
                        archived: false,
                        model: 'company',
                      },
                      {
                        type: 'data_attribute',
                        name: 'updated_at',
                        full_name: 'updated_at',
                        label: 'Updated at',
                        description: 'The last time the company was updated',
                        data_type: 'date',
                        api_writable: false,
                        ui_writable: false,
                        messenger_writable: true,
                        custom: false,
                        archived: false,
                        model: 'company',
                      },
                      {
                        type: 'data_attribute',
                        name: 'id',
                        full_name: 'plan.id',
                        label: 'Plan ID',
                        description: 'The Intercom defined id representing the plan',
                        data_type: 'string',
                        api_writable: false,
                        ui_writable: false,
                        messenger_writable: true,
                        custom: false,
                        archived: false,
                        model: 'company',
                      },
                      {
                        type: 'data_attribute',
                        name: 'app_id',
                        full_name: 'app_id',
                        label: 'App ID',
                        description: 'The Intercom defined id representing the app',
                        data_type: 'string',
                        api_writable: false,
                        ui_writable: false,
                        messenger_writable: true,
                        custom: false,
                        archived: false,
                        model: 'company',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/data_attribute_list',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: '347e1bef-2b93-48e7-994f-2d84b5754cca',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
    },
    post: {
      summary: 'Create a data attribute',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
      ],
      tags: ['Data Attributes'],
      operationId: 'createDataAttribute',
      description: 'You can create a data attributes for a `contact` or a `company`.',
      responses: {
        '200': {
          description: 'Successful',
          content: {
            'application/json': {
              examples: {
                Successful: {
                  value: {
                    id: 37,
                    type: 'data_attribute',
                    name: 'Mithril Shirt',
                    full_name: 'custom_attributes.Mithril Shirt',
                    label: 'Mithril Shirt',
                    data_type: 'string',
                    api_writable: true,
                    ui_writable: false,
                    messenger_writable: true,
                    custom: true,
                    archived: false,
                    admin_id: '991267545',
                    created_at: 1717021597,
                    updated_at: 1717021597,
                    model: 'company',
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/data_attribute',
              },
            },
          },
        },
        '400': {
          description: 'Too few options for list',
          content: {
            'application/json': {
              examples: {
                'Same name already exists': {
                  value: {
                    type: 'error.list',
                    request_id: 'cc7918cc-666a-4e83-b82c-0bf0c8a71376',
                    errors: [
                      {
                        code: 'parameter_invalid',
                        message:
                          "You already have 'The One Ring' in your company data. To save this as new people data, use a different name.",
                      },
                    ],
                  },
                },
                'Invalid name': {
                  value: {
                    type: 'error.list',
                    request_id: 'a482b171-5581-4f05-a8b4-71a9aca2246d',
                    errors: [
                      {
                        code: 'parameter_invalid',
                        message:
                          'Your name for this attribute must only contain alphanumeric characters, currency symbols, and hyphens',
                      },
                    ],
                  },
                },
                'Attribute already exists': {
                  value: {
                    type: 'error.list',
                    request_id: '82f80d44-20a6-45bb-a69c-abb1eeaab5ff',
                    errors: [
                      {
                        code: 'parameter_invalid',
                        message:
                          "You already have 'The One Ring' in your company data. To save this as new company data, use a different name.",
                      },
                    ],
                  },
                },
                'Invalid Data Type': {
                  value: {
                    type: 'error.list',
                    request_id: '48e4900b-b047-4064-a060-d19d936986f2',
                    errors: [
                      {
                        code: 'parameter_invalid',
                        message: "Data Type isn't an option",
                      },
                    ],
                  },
                },
                'Too few options for list': {
                  value: {
                    type: 'error.list',
                    request_id: '9671eab5-6cb1-47ea-bef6-9877d24aa8be',
                    errors: [
                      {
                        code: 'parameter_invalid',
                        message: 'The Data Attribute model field must be either contact or company',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: '5b7162e1-b827-4c54-9299-1923661ab15a',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/create_data_attribute_request',
            },
            examples: {
              successful: {
                summary: 'Successful',
                value: {
                  name: 'Mithril Shirt',
                  model: 'company',
                  data_type: 'string',
                },
              },
              same_name_already_exists: {
                summary: 'Same name already exists',
                value: {
                  name: 'The One Ring',
                  model: 'contact',
                  data_type: 'integer',
                },
              },
              invalid_name: {
                summary: 'Invalid name',
                value: {
                  name: '!nv@l!d n@me',
                  model: 'company',
                  data_type: 'string',
                },
              },
              attribute_already_exists: {
                summary: 'Attribute already exists',
                value: {
                  name: 'The One Ring',
                  model: 'company',
                  data_type: 'string',
                },
              },
              invalid_data_type: {
                summary: 'Invalid Data Type',
                value: {
                  name: 'The Second Ring',
                  model: 'company',
                  data_type: 'mithril',
                },
              },
              too_few_options_for_list: {
                summary: 'Too few options for list',
                value: {
                  description: 'Just a plain old ring',
                  options: [
                    {
                      value: '1-10',
                    },
                  ],
                  archived: false,
                },
              },
            },
          },
        },
      },
    },
  },
  '/data_attributes/{id}': {
    put: {
      summary: 'Update a data attribute',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
        {
          name: 'id',
          in: 'path',
          required: true,
          description: 'The data attribute id',
          example: 1,
          schema: {
            type: 'integer',
          },
        },
      ],
      tags: ['Data Attributes'],
      operationId: 'updateDataAttribute',
      description:
        "\nYou can update a data attribute.\n\n> 🚧 Updating the data type is not possible\n>\n> It is currently a dangerous action to execute changing a data attribute's type via the API. You will need to update the type via the UI instead.\n",
      responses: {
        '200': {
          description: 'Successful',
          content: {
            'application/json': {
              examples: {
                Successful: {
                  value: {
                    id: 44,
                    type: 'data_attribute',
                    name: 'The One Ring',
                    full_name: 'custom_attributes.The One Ring',
                    label: 'The One Ring',
                    description: 'Just a plain old ring',
                    data_type: 'string',
                    options: ['1-10', '11-20'],
                    api_writable: true,
                    ui_writable: false,
                    messenger_writable: true,
                    custom: true,
                    archived: false,
                    admin_id: '991267552',
                    created_at: 1717021600,
                    updated_at: 1717021601,
                    model: 'company',
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/data_attribute',
              },
            },
          },
        },
        '400': {
          description: 'Too few options in list',
          content: {
            'application/json': {
              examples: {
                'Too few options in list': {
                  value: {
                    type: 'error.list',
                    request_id: '3f2e9798-2691-4757-8ddd-990cd23b1ee4',
                    errors: [
                      {
                        code: 'parameter_invalid',
                        message: "Options isn't an array",
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: '3f503566-39bd-4e10-a030-dc0bf2a305cb',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
        '404': {
          description: 'Attribute Not Found',
          content: {
            'application/json': {
              examples: {
                'Attribute Not Found': {
                  value: {
                    type: 'error.list',
                    request_id: '364ec895-b362-42d0-96c8-f3ad314a25a6',
                    errors: [
                      {
                        code: 'field_not_found',
                        message: "We couldn't find that data attribute to update",
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
        '422': {
          description: 'Has Dependant Object',
          content: {
            'application/json': {
              examples: {
                'Has Dependant Object': {
                  value: {
                    type: 'error.list',
                    request_id: '0ae09d21-a5ec-4cea-a56f-d22d4423112e',
                    errors: [
                      {
                        code: 'data_invalid',
                        message: 'The Data Attribute you are trying to archive has a dependant object',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/update_data_attribute_request',
            },
            examples: {
              successful: {
                summary: 'Successful',
                value: {
                  description: 'Just a plain old ring',
                  options: [
                    {
                      value: '1-10',
                    },
                    {
                      value: '11-20',
                    },
                  ],
                  archived: false,
                },
              },
              too_few_options_in_list: {
                summary: 'Too few options in list',
                value: {
                  description: 'Too few options',
                  options: {
                    value: '1-10',
                  },
                  archived: false,
                },
              },
              attribute_not_found: {
                summary: 'Attribute Not Found',
                value: {
                  description: 'Just a plain old ring',
                  options: [
                    {
                      value: '1-10',
                    },
                    {
                      value: '11-20',
                    },
                  ],
                  archived: false,
                },
              },
              has_dependant_object: {
                summary: 'Has Dependant Object',
                value: {
                  description: 'Trying to archieve',
                  archived: true,
                },
              },
            },
          },
        },
      },
    },
  },
  '/events': {
    post: {
      summary: 'Submit a data event',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
      ],
      tags: ['Data Events'],
      operationId: 'createDataEvent',
      description:
        '\nYou will need an Access Token that has write permissions to send Events. Once you have a key you can submit events via POST to the Events resource, which is located at https://api.intercom.io/events, or you can send events using one of the client libraries. When working with the HTTP API directly a client should send the event with a `Content-Type` of `application/json`.\n\nWhen using the JavaScript API, [adding the code to your app](http://docs.intercom.io/configuring-Intercom/tracking-user-events-in-your-app) makes the Events API available. Once added, you can submit an event using the `trackEvent` method. This will associate the event with the Lead or currently logged-in user or logged-out visitor/lead and send it to Intercom. The final parameter is a map that can be used to send optional metadata about the event.\n\nWith the Ruby client you pass a hash describing the event to `Intercom::Event.create`, or call the `track_user` method directly on the current user object (e.g. `user.track_event`).\n\n**NB: For the JSON object types, please note that we do not currently support nested JSON structure.**\n\n| Type            | Description                                                                                                                                                                                                     | Example                                                                           |\n| :-------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------- |\n| String          | The value is a JSON String                                                                                                                                                                                      | `"source":"desktop"`                                                              |\n| Number          | The value is a JSON Number                                                                                                                                                                                      | `"load": 3.67`                                                                    |\n| Date            | The key ends with the String `_date` and the value is a [Unix timestamp](http://en.wikipedia.org/wiki/Unix_time), assumed to be in the [UTC](http://en.wikipedia.org/wiki/Coordinated_Universal_Time) timezone. | `"contact_date": 1392036272`                                                      |\n| Link            | The value is a HTTP or HTTPS URI.                                                                                                                                                                               | `"article": "https://example.org/ab1de.html"`                                     |\n| Rich Link       | The value is a JSON object that contains `url` and `value` keys.                                                                                                                                                | `"article": {"url": "https://example.org/ab1de.html", "value":"the dude abides"}` |\n| Monetary Amount | The value is a JSON object that contains `amount` and `currency` keys. The `amount` key is a positive integer representing the amount in cents. The price in the example to the right denotes €349.99.          | `"price": {"amount": 34999, "currency": "eur"}`                                   |\n\n**Lead Events**\n\nWhen submitting events for Leads, you will need to specify the Lead\'s `id`.\n\n**Metadata behaviour**\n\n- We currently limit the number of tracked metadata keys to 10 per event. Once the quota is reached, we ignore any further keys we receive. The first 10 metadata keys are determined by the order in which they are sent in with the event.\n- It is not possible to change the metadata keys once the event has been sent. A new event will need to be created with the new keys and you can archive the old one.\n- There might be up to 24 hrs delay when you send a new metadata for an existing event.\n\n**Event de-duplication**\n\nThe API may detect and ignore duplicate events. Each event is uniquely identified as a combination of the following data - the Workspace identifier, the Contact external identifier, the Data Event name and the Data Event created time. As a result, it is **strongly recommended** to send a second granularity Unix timestamp in the `created_at` field.\n\nDuplicated events are responded to using the normal `202 Accepted` code - an error is not thrown, however repeat requests will be counted against any rate limit that is in place.\n\n### HTTP API Responses\n\n- Successful responses to submitted events return `202 Accepted` with an empty body.\n- Unauthorised access will be rejected with a `401 Unauthorized` or `403 Forbidden` response code.\n- Events sent about users that cannot be found will return a `404 Not Found`.\n- Event lists containing duplicate events will have those duplicates ignored.\n- Server errors will return a `500` response code and may contain an error message in the body.\n\n',
      responses: {
        '202': {
          description: 'successful',
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: '5ebeb1a3-2867-48c4-8122-4ab53e63a6b7',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/create_data_event_request',
            },
          },
        },
      },
    },
    get: {
      summary: 'List all data events',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
        {
          in: 'query',
          name: 'filter',
          required: true,
          style: 'form',
          explode: true,
          schema: {
            type: 'object',
            oneOf: [
              {
                title: 'user_id query parameter',
                properties: {
                  user_id: {
                    type: 'string',
                  },
                },
                required: ['user_id'],
                additionalProperties: false,
              },
              {
                title: 'intercom_user_id query parameter',
                properties: {
                  intercom_user_id: {
                    type: 'string',
                  },
                },
                required: ['intercom_user_id'],
                additionalProperties: false,
              },
              {
                title: 'email query parameter',
                properties: {
                  email: {
                    type: 'string',
                  },
                },
                required: ['email'],
                additionalProperties: false,
              },
            ],
          },
        },
        {
          name: 'type',
          in: 'query',
          required: true,
          description: 'The value must be user',
          schema: {
            type: 'string',
          },
        },
        {
          name: 'summary',
          in: 'query',
          required: false,
          description: 'summary flag',
          schema: {
            type: 'boolean',
          },
        },
      ],
      tags: ['Data Events'],
      operationId: 'lisDataEvents',
      description:
        "\n> 🚧\n>\n> Please note that you can only 'list' events that are less than 90 days old. Event counts and summaries will still include your events older than 90 days but you cannot 'list' these events individually if they are older than 90 days\n\nThe events belonging to a customer can be listed by sending a GET request to `https://api.intercom.io/events` with a user or lead identifier along with a `type` parameter. The identifier parameter can be one of `user_id`, `email` or `intercom_user_id`. The `type` parameter value must be `user`.\n\n- `https://api.intercom.io/events?type=user&user_id={user_id}`\n- `https://api.intercom.io/events?type=user&email={email}`\n- `https://api.intercom.io/events?type=user&intercom_user_id={id}` (this call can be used to list leads)\n\nThe `email` parameter value should be [url encoded](http://en.wikipedia.org/wiki/Percent-encoding) when sending.\n\nYou can optionally define the result page size as well with the `per_page` parameter.\n",
      responses: {
        '200': {
          description: 'Successful response',
          content: {
            'application/json': {
              examples: {
                'Successful response': {
                  value: {
                    type: 'event.summary',
                    events: [],
                    pages: {
                      next: 'http://api.intercom.test/events?next page',
                    },
                    email: 'user26@email.com',
                    intercom_user_id: '6657aba56abd0164c24b0dbb',
                    user_id: '3ecf64d0-9ed1-4e9f-88e1-da7d6e6782f3',
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/data_event_summary',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: '80fcaff4-e81a-4155-82de-3130830c6f2c',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
    },
  },
  '/events/summaries': {
    post: {
      summary: 'Create event summaries',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
      ],
      tags: ['Data Events'],
      operationId: 'dataEventSummaries',
      description:
        'Create event summaries for a user. Event summaries are used to track the number of times an event has occurred, the first time it occurred and the last time it occurred.\n\n',
      responses: {
        '200': {
          description: 'successful',
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: '6721c78e-3aaf-4da1-8fb5-ff546b6560c2',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/create_data_event_summaries_request',
            },
          },
        },
      },
    },
  },
  '/export/content/data': {
    post: {
      summary: 'Create content data export',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
      ],
      tags: ['Data Export'],
      operationId: 'createDataExport',
      description:
        'To create your export job, you need to send a `POST` request to the export endpoint `https://api.intercom.io/export/content/data`.\n\nThe only parameters you need to provide are the range of dates that you want exported.\n\n>🚧 Limit of one active job\n>\n> You can only have one active job per workspace. You will receive a HTTP status code of 429 with the message Exceeded rate limit of 1 pending message data export jobs if you attempt to create a second concurrent job.\n\n>❗️ Updated_at not included\n>\n> It should be noted that the timeframe only includes messages sent during the time period and not messages that were only updated during this period. For example, if a message was updated yesterday but sent two days ago, you would need to set the created_at_after date before the message was sent to include that in your retrieval job.\n\n>📘 Date ranges are inclusive\n>\n> Requesting data for 2018-06-01 until 2018-06-30 will get all data for those days including those specified - e.g. 2018-06-01 00:00:00 until 2018-06-30 23:59:99.\n',
      responses: {
        '200': {
          description: 'successful',
          content: {
            'application/json': {
              examples: {
                successful: {
                  value: {
                    job_identifier: 'm3489fdme82zmm0j',
                    status: 'pending',
                    download_url: '',
                    download_expires_at: '',
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/data_export',
              },
            },
          },
        },
      },
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/create_data_exports_request',
            },
            examples: {
              successful: {
                summary: 'successful',
                value: {
                  created_at_after: 1717003608,
                  created_at_before: 1717021608,
                },
              },
            },
          },
        },
      },
    },
  },
  '/export/content/data/{job_identifier}': {
    get: {
      summary: 'Show content data export',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
        {
          name: 'job_identifier',
          in: 'path',
          description: 'job_identifier',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      tags: ['Data Export'],
      operationId: 'getDataExport',
      description:
        'You can view the status of your job by sending a `GET` request to the URL\n`https://api.intercom.io/export/content/data/{job_identifier}` - the `{job_identifier}` is the value returned in the response when you first created the export job. More on it can be seen in the Export Job Model.\n\n> 🚧 Jobs expire after two days\n> All jobs that have completed processing (and are thus available to download from the provided URL) will have an expiry limit of two days from when the export ob completed. After this, the data will no longer be available.\n',
      responses: {
        '200': {
          description: 'successful',
          content: {
            'application/json': {
              examples: {
                successful: {
                  value: {
                    job_identifier: 'nhhv3bazoxu29hxd',
                    status: 'pending',
                    download_url: '',
                    download_expires_at: '',
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/data_export',
              },
            },
          },
        },
      },
    },
  },
  '/export/cancel/{job_identifier}': {
    post: {
      summary: 'Cancel content data export',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
        {
          name: 'job_identifier',
          in: 'path',
          description: 'job_identifier',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      tags: ['Data Export'],
      operationId: 'cancelDataExport',
      description: 'You can cancel your job',
      responses: {
        '200': {
          description: 'successful',
          content: {
            'application/json': {
              examples: {
                successful: {
                  value: {
                    job_identifier: '63tf5lz9hk0ean3z',
                    status: 'canceled',
                    download_url: '',
                    download_expires_at: '',
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/data_export',
              },
            },
          },
        },
      },
    },
  },
  '/download/content/data/{job_identifier}': {
    get: {
      summary: 'Download content data export',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
        {
          name: 'job_identifier',
          in: 'path',
          description: 'job_identifier',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      tags: ['Data Export'],
      operationId: 'downloadDataExport',
      description:
        'When a job has a status of complete, and thus a filled download_url, you can download your data by hitting that provided URL, formatted like so: https://api.intercom.io/download/content/data/xyz1234.\n\nYour exported message data will be streamed continuously back down to you in a gzipped CSV format.\n\n> 📘 Octet header required\n>\n> You will have to specify the header Accept: `application/octet-stream` when hitting this endpoint.\n',
      responses: {
        '200': {
          description: 'successful',
        },
      },
    },
  },
  '/messages': {
    post: {
      summary: 'Create a message',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
      ],
      tags: ['Messages'],
      operationId: 'createMessage',
      description:
        "You can create a message that has been initiated by an admin. The conversation can be either an in-app message or an email.\n\n> 🚧 Sending for visitors\n>\n> There can be a short delay between when a contact is created and when a contact becomes available to be messaged through the API. A 404 Not Found error will be returned in this case.\n\nThis will return the Message model that has been created.\n\n> 🚧 Retrieving Associated Conversations\n>\n> As this is a message, there will be no conversation present until the contact responds. Once they do, you will have to search for a contact's conversations with the id of the message.\n",
      responses: {
        '200': {
          description: 'admin message created',
          content: {
            'application/json': {
              examples: {
                'user message created': {
                  value: {
                    type: 'user_message',
                    id: '403918302',
                    created_at: 1717021611,
                    body: 'heyy',
                    message_type: 'inapp',
                    conversation_id: '442',
                  },
                },
                'lead message created': {
                  value: {
                    type: 'user_message',
                    id: '403918303',
                    created_at: 1717021612,
                    body: 'heyy',
                    message_type: 'inapp',
                    conversation_id: '443',
                  },
                },
                'admin message created': {
                  value: {
                    type: 'admin_message',
                    id: '15',
                    created_at: 1717021614,
                    subject: 'heyy',
                    body: 'heyy',
                    message_type: 'inapp',
                    owner: {
                      type: 'admin',
                      id: '991267575',
                      name: 'Ciaran276 Lee',
                      email: 'admin276@email.com',
                      away_mode_enabled: false,
                      away_mode_reassign: false,
                    },
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/message',
              },
            },
          },
        },
        '400': {
          description: 'No body supplied for email message',
          content: {
            'application/json': {
              examples: {
                'No body supplied for message': {
                  value: {
                    type: 'error.list',
                    request_id: '049f5096-216f-467e-8fd0-2331ac74a002',
                    errors: [
                      {
                        code: 'parameter_invalid',
                        message: 'Body is required',
                      },
                    ],
                  },
                },
                'No body supplied for email message': {
                  value: {
                    type: 'error.list',
                    request_id: '26b582f5-81ba-4f2a-a533-fbce3944c563',
                    errors: [
                      {
                        code: 'parameter_invalid',
                        message: 'Body is required',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: '24f9aaf3-e8a7-40cd-b439-0841baa44805',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
        '403': {
          description: 'API plan restricted',
          content: {
            'application/json': {
              examples: {
                'API plan restricted': {
                  value: {
                    type: 'error.list',
                    request_id: '4b08a866-f009-468a-893a-865e7d8ced74',
                    errors: [
                      {
                        code: 'api_plan_restricted',
                        message: 'Active subscription needed.',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
        '422': {
          description: 'No subject supplied for email message',
          content: {
            'application/json': {
              examples: {
                'No subject supplied for email message': {
                  value: {
                    type: 'error.list',
                    request_id: '29713c7a-484b-499e-8c50-1e39d999b495',
                    errors: [
                      {
                        code: 'parameter_not_found',
                        message: 'No subject supplied for email message',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/create_message_request',
            },
            examples: {
              user_message_created: {
                summary: 'user message created',
                value: {
                  from: {
                    type: 'user',
                    id: '6657abab6abd0164c24b0dc0',
                  },
                  body: 'heyy',
                  referer: 'https://twitter.com/bob',
                },
              },
              lead_message_created: {
                summary: 'lead message created',
                value: {
                  from: {
                    type: 'lead',
                    id: '6657abac6abd0164c24b0dc1',
                  },
                  body: 'heyy',
                  referer: 'https://twitter.com/bob',
                },
              },
              admin_message_created: {
                summary: 'admin message created',
                value: {
                  from: {
                    type: 'admin',
                    id: '991267575',
                  },
                  to: {
                    type: 'user',
                    id: '6657abad6abd0164c24b0dc2',
                  },
                  message_type: 'conversation',
                  body: 'heyy',
                },
              },
              no_body_supplied_for_message: {
                summary: 'No body supplied for message',
                value: {
                  from: {
                    type: 'admin',
                    id: '991267577',
                  },
                  to: {
                    type: 'user',
                    id: '6657abaf6abd0164c24b0dc3',
                  },
                  message_type: 'inapp',
                  body: null,
                  subject: 'heyy',
                },
              },
              no_subject_supplied_for_email_message: {
                summary: 'No subject supplied for email message',
                value: {
                  from: {
                    type: 'admin',
                    id: '991267578',
                  },
                  to: {
                    type: 'user',
                    user_id: '70',
                  },
                  message_type: 'email',
                  body: 'hey there',
                },
              },
              no_body_supplied_for_email_message: {
                summary: 'No body supplied for email message',
                value: {
                  from: {
                    type: 'admin',
                    id: '991267579',
                  },
                  to: {
                    type: 'user',
                    id: '6657abb06abd0164c24b0dc5',
                  },
                  message_type: 'email',
                  body: null,
                  subject: 'heyy',
                },
              },
            },
          },
        },
      },
    },
  },
  '/news/news_items': {
    get: {
      summary: 'List all news items',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
      ],
      tags: ['News'],
      operationId: 'listNewsItems',
      description: 'You can fetch a list of all news items',
      responses: {
        '200': {
          description: 'successful',
          content: {
            'application/json': {
              examples: {
                successful: {
                  value: {
                    type: 'list',
                    pages: {
                      page: 1,
                      per_page: 10,
                      total_pages: 1,
                      type: 'pages',
                    },
                    data: [
                      {
                        id: '30',
                        type: 'news-item',
                        workspace_id: 'this_is_an_id503_that_should_be_at_least_',
                        title: 'We have news',
                        body: '<p>Hello there,</p>',
                        sender_id: 991267586,
                        state: 'draft',
                        labels: [],
                        cover_image_url: null,
                        reactions: [null, null, null, null],
                        deliver_silently: false,
                        created_at: 1717021618,
                        updated_at: 1717021618,
                        newsfeed_assignments: [],
                      },
                      {
                        id: '29',
                        type: 'news-item',
                        workspace_id: 'this_is_an_id503_that_should_be_at_least_',
                        title: 'We have news',
                        body: '<p>Hello there,</p>',
                        sender_id: 991267584,
                        state: 'draft',
                        labels: [],
                        cover_image_url: null,
                        reactions: [null, null, null, null],
                        deliver_silently: false,
                        created_at: 1717021617,
                        updated_at: 1717021617,
                        newsfeed_assignments: [],
                      },
                    ],
                    total_count: 2,
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/paginated_response',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: '8a9a7c2e-15b7-4dba-a3c7-1aa75decb59e',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
    },
    post: {
      summary: 'Create a news item',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
      ],
      tags: ['News'],
      operationId: 'createNewsItem',
      description: 'You can create a news item',
      responses: {
        '200': {
          description: 'successful',
          content: {
            'application/json': {
              examples: {
                successful: {
                  value: {
                    id: '33',
                    type: 'news-item',
                    workspace_id: 'this_is_an_id507_that_should_be_at_least_',
                    title: 'Halloween is here!',
                    body: '<p>New costumes in store for this spooky season</p>',
                    sender_id: 991267593,
                    state: 'live',
                    labels: ['New', 'Product', 'Update'],
                    cover_image_url: null,
                    reactions: ['😆', '😅'],
                    deliver_silently: true,
                    created_at: 1717021620,
                    updated_at: 1717021620,
                    newsfeed_assignments: [
                      {
                        newsfeed_id: 53,
                        published_at: 1664638214,
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/news_item',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: 'd8bfbb7c-b0b6-405a-8bbd-5422697e1dc1',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/news_item_request',
            },
            examples: {
              successful: {
                summary: 'successful',
                value: {
                  title: 'Halloween is here!',
                  body: '<p>New costumes in store for this spooky season</p>',
                  labels: ['Product', 'Update', 'New'],
                  sender_id: 991267593,
                  deliver_silently: true,
                  reactions: ['😆', '😅'],
                  state: 'live',
                  newsfeed_assignments: [
                    {
                      newsfeed_id: 53,
                      published_at: 1664638214,
                    },
                  ],
                },
              },
            },
          },
        },
      },
    },
  },
  '/news/news_items/{id}': {
    get: {
      summary: 'Retrieve a news item',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
        {
          name: 'id',
          in: 'path',
          required: true,
          description: 'The unique identifier for the news item which is given by Intercom.',
          example: 123,
          schema: {
            type: 'integer',
          },
        },
      ],
      tags: ['News'],
      operationId: 'retrieveNewsItem',
      description: 'You can fetch the details of a single news item.',
      responses: {
        '200': {
          description: 'successful',
          content: {
            'application/json': {
              examples: {
                successful: {
                  value: {
                    id: '34',
                    type: 'news-item',
                    workspace_id: 'this_is_an_id511_that_should_be_at_least_',
                    title: 'We have news',
                    body: '<p>Hello there,</p>',
                    sender_id: 991267596,
                    state: 'live',
                    labels: [],
                    cover_image_url: null,
                    reactions: [null, null, null, null],
                    deliver_silently: false,
                    created_at: 1717021621,
                    updated_at: 1717021621,
                    newsfeed_assignments: [
                      {
                        newsfeed_id: 55,
                        published_at: 1717021621,
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/news_item',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: 'e67ea708-23ce-417d-b8d0-5f0feadcf33c',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
        '404': {
          description: 'News Item Not Found',
          content: {
            'application/json': {
              examples: {
                'News Item Not Found': {
                  value: {
                    type: 'error.list',
                    request_id: 'f4423d98-b41c-42f7-ba88-79d792097cf8',
                    errors: [
                      {
                        code: 'not_found',
                        message: 'Resource Not Found',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
    },
    put: {
      summary: 'Update a news item',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
        {
          name: 'id',
          in: 'path',
          required: true,
          description: 'The unique identifier for the news item which is given by Intercom.',
          example: 123,
          schema: {
            type: 'integer',
          },
        },
      ],
      tags: ['News'],
      operationId: 'updateNewsItem',
      responses: {
        '200': {
          description: 'successful',
          content: {
            'application/json': {
              examples: {
                successful: {
                  value: {
                    id: '37',
                    type: 'news-item',
                    workspace_id: 'this_is_an_id517_that_should_be_at_least_',
                    title: 'Christmas is here!',
                    body: '<p>New gifts in store for the jolly season</p>',
                    sender_id: 991267604,
                    state: 'live',
                    labels: [],
                    cover_image_url: null,
                    reactions: ['😝', '😂'],
                    deliver_silently: false,
                    created_at: 1717021623,
                    updated_at: 1717021624,
                    newsfeed_assignments: [],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/news_item',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: '403da25a-8045-4987-9a34-b3347a02c8b0',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
        '404': {
          description: 'News Item Not Found',
          content: {
            'application/json': {
              examples: {
                'News Item Not Found': {
                  value: {
                    type: 'error.list',
                    request_id: '500997db-736a-473c-a8be-58a7a89b89d5',
                    errors: [
                      {
                        code: 'not_found',
                        message: 'Resource Not Found',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/news_item_request',
            },
            examples: {
              successful: {
                summary: 'successful',
                value: {
                  title: 'Christmas is here!',
                  body: '<p>New gifts in store for the jolly season</p>',
                  sender_id: 991267604,
                  reactions: ['😝', '😂'],
                },
              },
              news_item_not_found: {
                summary: 'News Item Not Found',
                value: {
                  title: 'Christmas is here!',
                  body: '<p>New gifts in store for the jolly season</p>',
                  sender_id: 991267607,
                  reactions: ['😝', '😂'],
                },
              },
            },
          },
        },
      },
    },
    delete: {
      summary: 'Delete a news item',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
        {
          name: 'id',
          in: 'path',
          required: true,
          description: 'The unique identifier for the news item which is given by Intercom.',
          example: 123,
          schema: {
            type: 'integer',
          },
        },
      ],
      tags: ['News'],
      operationId: 'deleteNewsItem',
      description: 'You can delete a single news item.',
      responses: {
        '200': {
          description: 'successful',
          content: {
            'application/json': {
              examples: {
                successful: {
                  value: {
                    id: '40',
                    object: 'news-item',
                    deleted: true,
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/deleted_object',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: 'f990d4f8-43c3-4719-9560-ee30422462ce',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
        '404': {
          description: 'News Item Not Found',
          content: {
            'application/json': {
              examples: {
                'News Item Not Found': {
                  value: {
                    type: 'error.list',
                    request_id: '7a923ed2-c82a-45b5-b859-ac8d35bedecc',
                    errors: [
                      {
                        code: 'not_found',
                        message: 'Resource Not Found',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
    },
  },
  '/news/newsfeeds/{id}/items': {
    get: {
      summary: 'List all live newsfeed items',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
        {
          name: 'id',
          in: 'path',
          required: true,
          description: 'The unique identifier for the news feed item which is given by Intercom.',
          example: '123',
          schema: {
            type: 'string',
          },
        },
      ],
      tags: ['News'],
      operationId: 'listLiveNewsfeedItems',
      description: 'You can fetch a list of all news items that are live on a given newsfeed',
      responses: {
        '200': {
          description: 'successful',
          content: {
            'application/json': {
              examples: {
                successful: {
                  value: {
                    type: 'list',
                    pages: {
                      page: 1,
                      per_page: 20,
                      total_pages: 0,
                      type: 'pages',
                    },
                    data: [],
                    total_count: 0,
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/paginated_response',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: 'a9bb7a8c-ce91-4197-9732-b0d68678ea42',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
    },
  },
  '/news/newsfeeds': {
    get: {
      summary: 'List all newsfeeds',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
      ],
      tags: ['News'],
      operationId: 'listNewsfeeds',
      description: 'You can fetch a list of all newsfeeds',
      responses: {
        '200': {
          description: 'successful',
          content: {
            'application/json': {
              examples: {
                successful: {
                  value: {
                    type: 'list',
                    pages: {
                      page: 1,
                      per_page: 10,
                      total_pages: 1,
                      type: 'pages',
                    },
                    data: [
                      {
                        id: '68',
                        type: 'newsfeed',
                        name: 'Visitor Feed',
                        created_at: 1717021629,
                        updated_at: 1717021629,
                      },
                      {
                        id: '69',
                        type: 'newsfeed',
                        name: 'Visitor Feed',
                        created_at: 1717021629,
                        updated_at: 1717021629,
                      },
                    ],
                    total_count: 2,
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/paginated_response',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: '98f77a2e-a0fa-461a-9ca7-b388f1dea32c',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
    },
  },
  '/news/newsfeeds/{id}': {
    get: {
      summary: 'Retrieve a newsfeed',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
        {
          name: 'id',
          in: 'path',
          required: true,
          description: 'The unique identifier for the news feed item which is given by Intercom.',
          example: '123',
          schema: {
            type: 'string',
          },
        },
      ],
      tags: ['News'],
      operationId: 'retrieveNewsfeed',
      description: 'You can fetch the details of a single newsfeed',
      responses: {
        '200': {
          description: 'successful',
          content: {
            'application/json': {
              examples: {
                successful: {
                  value: {
                    id: '72',
                    type: 'newsfeed',
                    name: 'Visitor Feed',
                    created_at: 1717021630,
                    updated_at: 1717021630,
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/newsfeed',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: 'b3ac2f76-21d8-444c-80d3-4d28ad72da7f',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
    },
  },
  '/notes/{id}': {
    get: {
      summary: 'Retrieve a note',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
        {
          name: 'id',
          in: 'path',
          required: true,
          description: 'The unique identifier of a given note',
          example: 1,
          schema: {
            type: 'integer',
          },
        },
      ],
      tags: ['Notes'],
      operationId: 'retrieveNote',
      description: 'You can fetch the details of a single note.',
      responses: {
        '200': {
          description: 'Note found',
          content: {
            'application/json': {
              examples: {
                'Note found': {
                  value: {
                    type: 'note',
                    id: '37',
                    created_at: 1716330431,
                    contact: {
                      type: 'contact',
                      id: '6657abbf6abd0164c24b0dc8',
                    },
                    author: {
                      type: 'admin',
                      id: '991267623',
                      name: 'Ciaran323 Lee',
                      email: 'admin323@email.com',
                      away_mode_enabled: false,
                      away_mode_reassign: false,
                    },
                    body: '<p>This is a note.</p>',
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/note',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: '6ae7fce4-8d40-4c5f-b4dd-d88f1faae666',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
        '404': {
          description: 'Note not found',
          content: {
            'application/json': {
              examples: {
                'Note not found': {
                  value: {
                    type: 'error.list',
                    request_id: '011cacd4-8b6a-47d2-8c62-d53840407296',
                    errors: [
                      {
                        code: 'not_found',
                        message: 'Resource Not Found',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
    },
  },
  '/segments': {
    get: {
      summary: 'List all segments',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
        {
          name: 'include_count',
          in: 'query',
          required: false,
          description: 'It includes the count of contacts that belong to each segment.',
          example: true,
          schema: {
            type: 'boolean',
          },
        },
      ],
      tags: ['Segments'],
      operationId: 'listSegments',
      description: 'You can fetch a list of all segments.',
      responses: {
        '200': {
          description: 'Successful response',
          content: {
            'application/json': {
              examples: {
                'Successful response': {
                  value: {
                    type: 'segment.list',
                    segments: [
                      {
                        type: 'segment',
                        id: '6657abc16abd0164c24b0dcb',
                        name: 'John segment',
                        created_at: 1717021633,
                        updated_at: 1717021633,
                        person_type: 'user',
                      },
                      {
                        type: 'segment',
                        id: '6657abc16abd0164c24b0dcc',
                        name: 'Jane segment',
                        created_at: 1717021633,
                        updated_at: 1717021633,
                        person_type: 'user',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/segment_list',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: '8f262c81-9866-4bc9-a311-7f0d5626063d',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
    },
  },
  '/segments/{id}': {
    get: {
      summary: 'Retrieve a segment',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
        {
          name: 'id',
          in: 'path',
          required: true,
          description: 'The unique identified of a given segment.',
          example: '123',
          schema: {
            type: 'string',
          },
        },
      ],
      tags: ['Segments'],
      operationId: 'retrieveSegment',
      description: 'You can fetch the details of a single segment.',
      responses: {
        '200': {
          description: 'Successful response',
          content: {
            'application/json': {
              examples: {
                'Successful response': {
                  value: {
                    type: 'segment',
                    id: '6657abc26abd0164c24b0dcf',
                    name: 'John segment',
                    created_at: 1717021634,
                    updated_at: 1717021634,
                    person_type: 'user',
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/segment',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: '2a342688-3235-4ff6-b05b-d22fe703b554',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
        '404': {
          description: 'Segment not found',
          content: {
            'application/json': {
              examples: {
                'Segment not found': {
                  value: {
                    type: 'error.list',
                    request_id: '1031750e-cb16-44a9-acae-3fdefacf973c',
                    errors: [
                      {
                        code: 'not_found',
                        message: 'Resource Not Found',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
    },
  },
  '/subscription_types': {
    get: {
      summary: 'List subscription types',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
      ],
      tags: ['Subscription Types'],
      operationId: 'listSubscriptionTypes',
      description: 'You can list all subscription types. A list of subscription type objects will be returned.',
      responses: {
        '200': {
          description: 'Successful',
          content: {
            'application/json': {
              examples: {
                Successful: {
                  value: {
                    type: 'list',
                    data: [
                      {
                        type: 'subscription',
                        id: '137',
                        state: 'live',
                        consent_type: 'opt_out',
                        default_translation: {
                          name: 'Newsletters',
                          description: 'Lorem ipsum dolor sit amet',
                          locale: 'en',
                        },
                        translations: [
                          {
                            name: 'Newsletters',
                            description: 'Lorem ipsum dolor sit amet',
                            locale: 'en',
                          },
                        ],
                        content_types: ['email'],
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/subscription_type_list',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: '387640aa-d3cb-40c0-b8b7-ed3d52a57f17',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
    },
  },
  '/phone_call_redirects': {
    post: {
      summary: 'Create a phone Switch',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
      ],
      tags: ['Switch'],
      operationId: 'createPhoneSwitch',
      description:
        "You can use the API to deflect phone calls to the Intercom Messenger.\nCalling this endpoint will send an SMS with a link to the Messenger to the phone number specified.\n\nIf custom attributes are specified, they will be added to the user or lead's custom data attributes.\n",
      responses: {
        '200': {
          description: 'successful',
          content: {
            'application/json': {
              examples: {
                successful: {
                  value: {
                    url: 'http://via.intercom.io/msgr/12b27d11-b981-41a9-a922-886b54bf93b7',
                    type: 'phone_call_redirect',
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/phone_switch',
              },
            },
          },
        },
        '400': {
          description: 'bad request - invalid number',
          content: {
            'application/json': {
              examples: {
                'bad request - exception sending sms': {
                  value: {
                    error_key: 'sms_failed',
                    message: 'SMS was not sent due to an unknown error',
                  },
                },
                'bad request - invalid number': {
                  value: {
                    error_key: 'invalid_phone_number',
                    message: 'Invalid phone number',
                  },
                },
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: '67b6c667-7107-406f-9d87-ff6116dca52b',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
        '422': {
          description: 'unprocessable entity',
          content: {
            'application/json': {
              examples: {
                'unprocessable entity': {
                  value: {
                    error_key: 'some_error',
                  },
                },
              },
            },
          },
        },
      },
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/create_phone_switch_request',
            },
            examples: {
              successful: {
                summary: 'successful',
                value: {
                  phone: '+353832345678',
                  custom_attributes: {
                    issue_type: 'Billing',
                    priority: 'High',
                  },
                },
              },
              'bad_request_-_exception_sending_sms': {
                summary: 'bad request - exception sending sms',
                value: {
                  phone: '+353832345678',
                  custom_attributes: {
                    issue_type: 'Billing',
                    priority: 'High',
                  },
                },
              },
              'bad_request_-_invalid_number': {
                summary: 'bad request - invalid number',
                value: {
                  phone: '+353832345678',
                  custom_attributes: {
                    issue_type: 'Billing',
                    priority: 'High',
                  },
                },
              },
              unprocessable_entity: {
                summary: 'unprocessable entity',
                value: {
                  phone: '+40241100100',
                  custom_attributes: {
                    issue_type: 'Billing',
                    priority: 'High',
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  '/tags': {
    get: {
      summary: 'List all tags',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
      ],
      tags: ['Tags'],
      operationId: 'listTags',
      description: 'You can fetch a list of all tags for a given workspace.\n\n',
      responses: {
        '200': {
          description: 'successful',
          content: {
            'application/json': {
              examples: {
                successful: {
                  value: {
                    type: 'list',
                    data: [
                      {
                        type: 'tag',
                        id: '105',
                        name: 'Manual tag 1',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/tag_list',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: '3c4758e2-e787-4f70-9fdf-d56ee7d3d830',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
    },
    post: {
      summary: 'Create or update a tag, Tag or untag companies, Tag contacts',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
      ],
      tags: ['Tags'],
      operationId: 'createTag',
      description:
        'You can use this endpoint to perform the following operations:\n\n  **1. Create a new tag:** You can create a new tag by passing in the tag name as specified in "Create or Update Tag Request Payload" described below.\n\n  **2. Update an existing tag:** You can update an existing tag by passing the id of the tag as specified in "Create or Update Tag Request Payload" described below.\n\n  **3. Tag Companies:** You can tag single company or a list of companies. You can tag a company by passing in the tag name and the company details as specified in "Tag Company Request Payload" described below. Also, if the tag doesn\'t exist then a new one will be created automatically.\n\n  **4. Untag Companies:** You can untag a single company or a list of companies. You can untag a company by passing in the tag id and the company details as specified in "Untag Company Request Payload" described below.\n\n  **5. Tag Multiple Users:** You can tag a list of users. You can tag the users by passing in the tag name and the user details as specified in "Tag Users Request Payload" described below.\n\nEach operation will return a tag object.\n',
      responses: {
        '200': {
          description: 'Action successful',
          content: {
            'application/json': {
              examples: {
                'Action successful': {
                  value: {
                    type: 'tag',
                    id: '108',
                    name: 'test',
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/tag',
              },
            },
          },
        },
        '400': {
          description: 'Invalid parameters',
          content: {
            'application/json': {
              examples: {
                'Invalid parameters': {
                  value: {
                    type: 'error.list',
                    request_id: 'e25d8bd7-817a-4171-b5f3-9fad4c76cf00',
                    errors: [
                      {
                        code: 'parameter_invalid',
                        message: 'invalid tag parameters',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: 'bae6bbdb-8eb5-4ee5-8db9-141bb17bd32b',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
        '404': {
          description: 'User  not found',
          content: {
            'application/json': {
              examples: {
                'Company not found': {
                  value: {
                    type: 'error.list',
                    request_id: 'a9716d1d-378f-4f9f-b86a-88b3a0237d99',
                    errors: [
                      {
                        code: 'company_not_found',
                        message: 'Company Not Found',
                      },
                    ],
                  },
                },
                'User  not found': {
                  value: {
                    type: 'error.list',
                    request_id: 'a7430819-e714-4464-b909-efee0a364a27',
                    errors: [
                      {
                        code: 'not_found',
                        message: 'User Not Found',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
      requestBody: {
        content: {
          'application/json': {
            schema: {
              oneOf: [
                {
                  $ref: '#/components/schemas/create_or_update_tag_request',
                },
                {
                  $ref: '#/components/schemas/tag_company_request',
                },
                {
                  $ref: '#/components/schemas/untag_company_request',
                },
                {
                  $ref: '#/components/schemas/tag_multiple_users_request',
                },
              ],
            },
            examples: {
              action_successful: {
                summary: 'Action successful',
                value: {
                  name: 'test',
                },
              },
              invalid_parameters: {
                summary: 'Invalid parameters',
                value: {
                  test: 'invalid',
                },
              },
              company_not_found: {
                summary: 'Company not found',
                value: {
                  name: 'test',
                  companies: [
                    {
                      company_id: '123',
                    },
                  ],
                },
              },
              user_not_found: {
                summary: 'User  not found',
                value: {
                  name: 'test',
                  users: [
                    {
                      id: '123',
                    },
                  ],
                },
              },
            },
          },
        },
      },
    },
  },
  '/tags/{id}': {
    get: {
      summary: 'Find a specific tag',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
        {
          name: 'id',
          in: 'path',
          description: 'The unique identifier of a given tag',
          example: '123',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      tags: ['Tags'],
      operationId: 'findTag',
      description:
        'You can fetch the details of tags that are on the workspace by their id.\nThis will return a tag object.\n',
      responses: {
        '200': {
          description: 'Tag found',
          content: {
            'application/json': {
              examples: {
                'Tag found': {
                  value: {
                    type: 'tag',
                    id: '116',
                    name: 'Manual tag',
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/tag',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: '6fbffa27-6ff2-4eac-9595-3eaff5d9e998',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
        '404': {
          description: 'Tag not found',
          content: {
            'application/json': {
              examples: {
                'Tag not found': {
                  value: {
                    type: 'error.list',
                    request_id: 'c19e3e7f-3095-4e68-9d6e-015abdff20e5',
                    errors: [
                      {
                        code: 'not_found',
                        message: 'Resource Not Found',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
    },
    delete: {
      summary: 'Delete tag',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
        {
          name: 'id',
          in: 'path',
          description: 'The unique identifier of a given tag',
          example: '123',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      tags: ['Tags'],
      operationId: 'deleteTag',
      description: 'You can delete the details of tags that are on the workspace by passing in the id.',
      responses: {
        '200': {
          description: 'Successful',
        },
        '400': {
          description: 'Tag has dependent objects',
          content: {
            'application/json': {
              examples: {
                'Tag has dependent objects': {
                  value: {
                    type: 'error.list',
                    request_id: 'f8f3114a-ce4b-48b5-a43a-adfd8eb25a53',
                    errors: [
                      {
                        code: 'tag_has_dependent_objects',
                        message: 'Unable to delete Tag with dependent objects. Segments: Seg 1.',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: '283deaf2-c25c-49c7-a076-db7fa2b60201',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
        '404': {
          description: 'Resource not found',
          content: {
            'application/json': {
              examples: {
                'Resource not found': {
                  value: {
                    type: 'error.list',
                    request_id: '6c9d0394-0a09-46ba-8ba5-b78b8c7e1e82',
                    errors: [
                      {
                        code: 'not_found',
                        message: 'Resource Not Found',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
    },
  },
  '/teams': {
    get: {
      summary: 'List all teams',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
      ],
      tags: ['Teams'],
      operationId: 'listTeams',
      description: 'This will return a list of team objects for the App.',
      responses: {
        '200': {
          description: 'successful',
          content: {
            'application/json': {
              examples: {
                successful: {
                  value: {
                    type: 'team.list',
                    teams: [],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/team_list',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: 'f4b16541-5c75-45d1-887c-b9cf7ca35de7',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
    },
  },
  '/teams/{id}': {
    get: {
      summary: 'Retrieve a team',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
        {
          name: 'id',
          in: 'path',
          required: true,
          description: 'The unique identifier of a given team.',
          example: '123',
          schema: {
            type: 'string',
          },
        },
      ],
      tags: ['Teams'],
      operationId: 'retrieveTeam',
      description:
        'You can fetch the details of a single team, containing an array of admins that belong to this team.',
      responses: {
        '200': {
          description: 'successful',
          content: {
            'application/json': {
              examples: {
                successful: {
                  value: {
                    type: 'team',
                    id: '991267661',
                    name: 'team 1',
                    admin_ids: [],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/team',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: '5e20abcf-e0f9-4ba3-aab2-f966923ecf21',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
        '404': {
          description: 'Team not found',
          content: {
            'application/json': {
              examples: {
                'Team not found': {
                  value: {
                    type: 'error.list',
                    request_id: '1afb669d-00be-48c8-afcf-ae3a2ab35c39',
                    errors: [
                      {
                        code: 'team_not_found',
                        message: 'Team not found',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
    },
  },
  '/ticket_types/{ticket_type_id}/attributes': {
    post: {
      summary: 'Create a new attribute for a ticket type',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
        {
          name: 'ticket_type_id',
          in: 'path',
          required: true,
          description: 'The unique identifier for the ticket type which is given by Intercom.',
          schema: {
            type: 'string',
          },
        },
      ],
      tags: ['Ticket Type Attributes'],
      description: 'You can create a new attribute for a ticket type.',
      operationId: 'createTicketTypeAttribute',
      responses: {
        '200': {
          description: 'Ticket Type Attribute created',
          content: {
            'application/json': {
              examples: {
                'Ticket Type Attribute created': {
                  value: {
                    type: 'ticket_type_attribute',
                    id: '163',
                    workspace_id: 'this_is_an_id609_that_should_be_at_least_',
                    name: 'Attribute Title',
                    description: 'Attribute Description',
                    data_type: 'string',
                    input_options: {
                      multiline: false,
                    },
                    order: 2,
                    required_to_create: false,
                    required_to_create_for_contacts: false,
                    visible_on_create: true,
                    visible_to_contacts: true,
                    default: false,
                    ticket_type_id: 51,
                    archived: false,
                    created_at: 1717021654,
                    updated_at: 1717021654,
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/ticket_type_attribute',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: '094e1e29-ba56-453f-8faa-5008558e1aab',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/create_ticket_type_attribute_request',
            },
            examples: {
              ticket_type_attribute_created: {
                summary: 'Ticket Type Attribute created',
                value: {
                  name: 'Attribute Title',
                  description: 'Attribute Description',
                  data_type: 'string',
                  required_to_create: false,
                },
              },
            },
          },
        },
      },
    },
  },
  '/ticket_types/{ticket_type_id}/attributes/{id}': {
    put: {
      summary: 'Update an existing attribute for a ticket type',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
        {
          name: 'ticket_type_id',
          in: 'path',
          required: true,
          description: 'The unique identifier for the ticket type which is given by Intercom.',
          schema: {
            type: 'string',
          },
        },
        {
          name: 'id',
          in: 'path',
          required: true,
          description: 'The unique identifier for the ticket type attribute which is given by Intercom.',
          schema: {
            type: 'string',
          },
        },
      ],
      tags: ['Ticket Type Attributes'],
      description: 'You can update an existing attribute for a ticket type.',
      operationId: 'updateTicketTypeAttribute',
      responses: {
        '200': {
          description: 'Ticket Type Attribute updated',
          content: {
            'application/json': {
              examples: {
                'Ticket Type Attribute updated': {
                  value: {
                    type: 'ticket_type_attribute',
                    id: '168',
                    workspace_id: 'this_is_an_id613_that_should_be_at_least_',
                    name: 'name',
                    description: 'New Attribute Description',
                    data_type: 'string',
                    order: 0,
                    required_to_create: false,
                    required_to_create_for_contacts: false,
                    visible_on_create: false,
                    visible_to_contacts: false,
                    default: false,
                    ticket_type_id: 53,
                    archived: false,
                    created_at: 1717021655,
                    updated_at: 1717021656,
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/ticket_type_attribute',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: 'bc5574be-db90-4757-bff5-a8829af8dd0d',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/update_ticket_type_attribute_request',
            },
            examples: {
              ticket_type_attribute_updated: {
                summary: 'Ticket Type Attribute updated',
                value: {
                  description: 'New Attribute Description',
                },
              },
            },
          },
        },
      },
    },
  },
  '/ticket_types': {
    get: {
      summary: 'List all ticket types',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
      ],
      tags: ['Ticket Types'],
      operationId: 'listTicketTypes',
      description: 'You can get a list of all ticket types for a workspace.',
      responses: {
        '200': {
          description: 'successful',
          content: {
            'application/json': {
              examples: {
                successful: {
                  value: {
                    type: 'list',
                    data: [
                      {
                        type: 'ticket_type',
                        id: '55',
                        name: 'Bug Report',
                        description: 'Bug Report Template',
                        icon: '🎟️',
                        workspace_id: 'this_is_an_id617_that_should_be_at_least_',
                        archived: false,
                        created_at: 1717021657,
                        updated_at: 1717021657,
                        is_internal: false,
                        ticket_type_attributes: {
                          type: 'list',
                          data: [
                            {
                              type: 'ticket_type_attribute',
                              id: '171',
                              workspace_id: 'this_is_an_id617_that_should_be_at_least_',
                              name: '_default_title_',
                              description: '',
                              data_type: 'string',
                              input_options: {
                                multiline: false,
                              },
                              order: 0,
                              required_to_create: false,
                              required_to_create_for_contacts: false,
                              visible_on_create: true,
                              visible_to_contacts: true,
                              default: true,
                              ticket_type_id: 55,
                              archived: false,
                              created_at: 1717021657,
                              updated_at: 1717021657,
                            },
                            {
                              type: 'ticket_type_attribute',
                              id: '173',
                              workspace_id: 'this_is_an_id617_that_should_be_at_least_',
                              name: 'name',
                              description: 'description',
                              data_type: 'string',
                              input_options: null,
                              order: 0,
                              required_to_create: false,
                              required_to_create_for_contacts: false,
                              visible_on_create: false,
                              visible_to_contacts: false,
                              default: false,
                              ticket_type_id: 55,
                              archived: false,
                              created_at: 1717021657,
                              updated_at: 1717021657,
                            },
                            {
                              type: 'ticket_type_attribute',
                              id: '172',
                              workspace_id: 'this_is_an_id617_that_should_be_at_least_',
                              name: '_default_description_',
                              description: '',
                              data_type: 'string',
                              input_options: {
                                multiline: true,
                              },
                              order: 1,
                              required_to_create: false,
                              required_to_create_for_contacts: false,
                              visible_on_create: true,
                              visible_to_contacts: true,
                              default: true,
                              ticket_type_id: 55,
                              archived: false,
                              created_at: 1717021657,
                              updated_at: 1717021657,
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/ticket_type_list',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: 'a09f28f1-0b27-4977-a34f-0ac84850a9af',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
    },
    post: {
      summary: 'Create a ticket type',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
      ],
      tags: ['Ticket Types'],
      operationId: 'createTicketType',
      description:
        'You can create a new ticket type.\n> 📘 Creating ticket types.\n>\n> Every ticket type will be created with two default attributes: _default_title_ and _default_description_.\n> For the `icon` propery, use an emoji from [Twemoji Cheatsheet](https://twemoji-cheatsheet.vercel.app/)\n',
      responses: {
        '200': {
          description: 'Ticket type created',
          content: {
            'application/json': {
              examples: {
                'Ticket type created': {
                  value: {
                    type: 'ticket_type',
                    id: '58',
                    name: 'Customer Issue',
                    description: 'Customer Report Template',
                    icon: '🎟️',
                    workspace_id: 'this_is_an_id621_that_should_be_at_least_',
                    archived: false,
                    created_at: 1717021658,
                    updated_at: 1717021658,
                    is_internal: false,
                    ticket_type_attributes: {
                      type: 'list',
                      data: [
                        {
                          type: 'ticket_type_attribute',
                          id: '180',
                          workspace_id: 'this_is_an_id621_that_should_be_at_least_',
                          name: '_default_title_',
                          description: '',
                          data_type: 'string',
                          input_options: {
                            multiline: false,
                          },
                          order: 0,
                          required_to_create: false,
                          required_to_create_for_contacts: false,
                          visible_on_create: true,
                          visible_to_contacts: true,
                          default: true,
                          ticket_type_id: 58,
                          archived: false,
                          created_at: 1717021658,
                          updated_at: 1717021658,
                        },
                        {
                          type: 'ticket_type_attribute',
                          id: '181',
                          workspace_id: 'this_is_an_id621_that_should_be_at_least_',
                          name: '_default_description_',
                          description: '',
                          data_type: 'string',
                          input_options: {
                            multiline: true,
                          },
                          order: 1,
                          required_to_create: false,
                          required_to_create_for_contacts: false,
                          visible_on_create: true,
                          visible_to_contacts: true,
                          default: true,
                          ticket_type_id: 58,
                          archived: false,
                          created_at: 1717021658,
                          updated_at: 1717021658,
                        },
                      ],
                    },
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/ticket_type',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: '078d21f5-f247-4178-adf1-4dc7e3640249',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/create_ticket_type_request',
            },
            examples: {
              ticket_type_created: {
                summary: 'Ticket type created',
                value: {
                  name: 'Customer Issue',
                  description: 'Customer Report Template',
                  icon: '🎟️',
                },
              },
            },
          },
        },
      },
    },
  },
  '/ticket_types/{id}': {
    get: {
      summary: 'Retrieve a ticket type',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
        {
          name: 'id',
          in: 'path',
          required: true,
          description: 'The unique identifier for the ticket type which is given by Intercom.',
          schema: {
            type: 'string',
          },
        },
      ],
      tags: ['Ticket Types'],
      operationId: 'getTicketType',
      description: 'You can fetch the details of a single ticket type.',
      responses: {
        '200': {
          description: 'Ticket type found',
          content: {
            'application/json': {
              examples: {
                'Ticket type found': {
                  value: {
                    type: 'ticket_type',
                    id: '60',
                    name: 'Bug Report',
                    description: 'Bug Report Template',
                    icon: '🎟️',
                    workspace_id: 'this_is_an_id625_that_should_be_at_least_',
                    archived: false,
                    created_at: 1717021659,
                    updated_at: 1717021659,
                    is_internal: false,
                    ticket_type_attributes: {
                      type: 'list',
                      data: [
                        {
                          type: 'ticket_type_attribute',
                          id: '185',
                          workspace_id: 'this_is_an_id625_that_should_be_at_least_',
                          name: '_default_title_',
                          description: '',
                          data_type: 'string',
                          input_options: {
                            multiline: false,
                          },
                          order: 0,
                          required_to_create: false,
                          required_to_create_for_contacts: false,
                          visible_on_create: true,
                          visible_to_contacts: true,
                          default: true,
                          ticket_type_id: 60,
                          archived: false,
                          created_at: 1717021659,
                          updated_at: 1717021659,
                        },
                        {
                          type: 'ticket_type_attribute',
                          id: '187',
                          workspace_id: 'this_is_an_id625_that_should_be_at_least_',
                          name: 'name',
                          description: 'description',
                          data_type: 'string',
                          input_options: null,
                          order: 0,
                          required_to_create: false,
                          required_to_create_for_contacts: false,
                          visible_on_create: false,
                          visible_to_contacts: false,
                          default: false,
                          ticket_type_id: 60,
                          archived: false,
                          created_at: 1717021659,
                          updated_at: 1717021659,
                        },
                        {
                          type: 'ticket_type_attribute',
                          id: '186',
                          workspace_id: 'this_is_an_id625_that_should_be_at_least_',
                          name: '_default_description_',
                          description: '',
                          data_type: 'string',
                          input_options: {
                            multiline: true,
                          },
                          order: 1,
                          required_to_create: false,
                          required_to_create_for_contacts: false,
                          visible_on_create: true,
                          visible_to_contacts: true,
                          default: true,
                          ticket_type_id: 60,
                          archived: false,
                          created_at: 1717021659,
                          updated_at: 1717021659,
                        },
                      ],
                    },
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/ticket_type',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: '06b9904b-f065-400b-9641-186e64864045',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
    },
    put: {
      summary: 'Update a ticket type',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
        {
          name: 'id',
          in: 'path',
          required: true,
          description: 'The unique identifier for the ticket type which is given by Intercom.',
          schema: {
            type: 'string',
          },
        },
      ],
      tags: ['Ticket Types'],
      operationId: 'updateTicketType',
      description:
        '\nYou can update a ticket type.\n\n> 📘 Updating a ticket type.\n>\n> For the `icon` propery, use an emoji from [Twemoji Cheatsheet](https://twemoji-cheatsheet.vercel.app/)\n',
      responses: {
        '200': {
          description: 'Ticket type updated',
          content: {
            'application/json': {
              examples: {
                'Ticket type updated': {
                  value: {
                    type: 'ticket_type',
                    id: '62',
                    name: 'Bug Report 2',
                    description: 'Bug Report Template',
                    icon: '🎟️',
                    workspace_id: 'this_is_an_id629_that_should_be_at_least_',
                    archived: false,
                    created_at: 1717021660,
                    updated_at: 1717021661,
                    is_internal: false,
                    ticket_type_attributes: {
                      type: 'list',
                      data: [
                        {
                          type: 'ticket_type_attribute',
                          id: '191',
                          workspace_id: 'this_is_an_id629_that_should_be_at_least_',
                          name: '_default_title_',
                          description: '',
                          data_type: 'string',
                          input_options: {
                            multiline: false,
                          },
                          order: 0,
                          required_to_create: false,
                          required_to_create_for_contacts: false,
                          visible_on_create: true,
                          visible_to_contacts: true,
                          default: true,
                          ticket_type_id: 62,
                          archived: false,
                          created_at: 1717021660,
                          updated_at: 1717021660,
                        },
                        {
                          type: 'ticket_type_attribute',
                          id: '193',
                          workspace_id: 'this_is_an_id629_that_should_be_at_least_',
                          name: 'name',
                          description: 'description',
                          data_type: 'string',
                          input_options: null,
                          order: 0,
                          required_to_create: false,
                          required_to_create_for_contacts: false,
                          visible_on_create: false,
                          visible_to_contacts: false,
                          default: false,
                          ticket_type_id: 62,
                          archived: false,
                          created_at: 1717021660,
                          updated_at: 1717021660,
                        },
                        {
                          type: 'ticket_type_attribute',
                          id: '192',
                          workspace_id: 'this_is_an_id629_that_should_be_at_least_',
                          name: '_default_description_',
                          description: '',
                          data_type: 'string',
                          input_options: {
                            multiline: true,
                          },
                          order: 1,
                          required_to_create: false,
                          required_to_create_for_contacts: false,
                          visible_on_create: true,
                          visible_to_contacts: true,
                          default: true,
                          ticket_type_id: 62,
                          archived: false,
                          created_at: 1717021660,
                          updated_at: 1717021660,
                        },
                      ],
                    },
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/ticket_type',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: 'b6a4ebf0-661c-4d2c-bf2a-c0e98c7c49ae',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/update_ticket_type_request',
            },
            examples: {
              ticket_type_updated: {
                summary: 'Ticket type updated',
                value: {
                  name: 'Bug Report 2',
                },
              },
            },
          },
        },
      },
    },
  },
  '/tickets/{id}/reply': {
    post: {
      summary: 'Reply to a ticket',
      operationId: 'replyTicket',
      description: 'You can reply to a ticket with a note from an admin.',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: {
            title: 'Ticket ID',
            type: 'string',
            description: 'The id of the ticket to target.',
            example: '123',
          },
        },
      ],
      tags: ['Tickets'],
      responses: {
        '200': {
          description: 'Admin note reply',
          content: {
            'application/json': {
              examples: {
                'Admin note reply': {
                  value: {
                    type: 'ticket_part',
                    id: '98',
                    part_type: 'note',
                    body: '<h2>An Unordered HTML List</h2>\n<ul>\n<li>Coffee</li>\n<li>Tea</li>\n<li>Milk</li>\n</ul>\n<h2>An Ordered HTML List</h2>\n<ol>\n<li>Coffee</li>\n<li>Tea</li>\n<li>Milk</li>\n</ol>',
                    created_at: 1717021664,
                    updated_at: 1717021664,
                    author: {
                      id: '991267687',
                      type: 'admin',
                      name: 'Ciaran382 Lee',
                      email: 'admin382@email.com',
                    },
                    attachments: [],
                    redacted: false,
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/ticket_note',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: '8bcefa1e-70b4-456d-baf7-d97bf8ca5401',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/create_ticket_reply_request',
            },
            examples: {
              admin_note_reply: {
                summary: 'Admin note reply',
                value: {
                  message_type: 'note',
                  type: 'admin',
                  admin_id: 991267687,
                  body: '<html> <body>  <h2>An Unordered HTML List</h2>  <ul>   <li>Coffee</li>   <li>Tea</li>   <li>Milk</li> </ul>    <h2>An Ordered HTML List</h2>  <ol>   <li>Coffee</li>   <li>Tea</li>   <li>Milk</li> </ol>   </body> </html>',
                },
              },
            },
          },
        },
      },
    },
  },
  '/tickets': {
    post: {
      summary: 'Create a ticket',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
      ],
      tags: ['Tickets'],
      description: 'You can create a new ticket.',
      operationId: 'createTicket',
      responses: {
        '200': {
          description: 'Successful response',
          content: {
            'application/json': {
              examples: {
                'Successful response': {
                  value: {
                    type: 'ticket',
                    id: '446',
                    ticket_attributes: {
                      _default_title_: 'example',
                      _default_description_: 'there is a problem',
                    },
                    ticket_state: 'submitted',
                    ticket_state_internal_label: 'Submitted',
                    ticket_state_external_label: 'Submitted',
                    ticket_type: {
                      type: 'ticket_type',
                      id: '69',
                      name: 'my-ticket-type-6',
                      description: 'my ticket type description is awesome.',
                      icon: '🦁',
                      workspace_id: 'this_is_an_id643_that_should_be_at_least_',
                      archived: false,
                      created_at: 1717021667,
                      updated_at: 1717021667,
                      is_internal: false,
                      ticket_type_attributes: {
                        type: 'list',
                        data: [
                          {
                            type: 'ticket_type_attribute',
                            id: '203',
                            workspace_id: 'this_is_an_id643_that_should_be_at_least_',
                            name: '_default_title_',
                            description: 'ola',
                            data_type: 'string',
                            input_options: null,
                            order: 0,
                            required_to_create: true,
                            required_to_create_for_contacts: false,
                            visible_on_create: true,
                            visible_to_contacts: false,
                            default: false,
                            ticket_type_id: 69,
                            archived: false,
                            created_at: 1717021667,
                            updated_at: 1717021667,
                          },
                          {
                            type: 'ticket_type_attribute',
                            id: '204',
                            workspace_id: 'this_is_an_id643_that_should_be_at_least_',
                            name: '_default_description_',
                            description: 'ola',
                            data_type: 'string',
                            input_options: null,
                            order: 0,
                            required_to_create: true,
                            required_to_create_for_contacts: false,
                            visible_on_create: true,
                            visible_to_contacts: false,
                            default: false,
                            ticket_type_id: 69,
                            archived: false,
                            created_at: 1717021668,
                            updated_at: 1717021668,
                          },
                        ],
                      },
                    },
                    contacts: {
                      type: 'contact.list',
                      contacts: [
                        {
                          id: '6657abe46abd0164c24b0df2',
                          role: 'user',
                        },
                      ],
                    },
                    admin_assignee_id: '0',
                    team_assignee_id: '0',
                    created_at: 1717021669,
                    updated_at: 1717021669,
                    ticket_parts: {
                      type: 'ticket_part.list',
                      ticket_parts: [
                        {
                          type: 'ticket_part',
                          id: '99',
                          part_type: 'ticket_state_updated_by_admin',
                          ticket_state: 'submitted',
                          previous_ticket_state: 'submitted',
                          created_at: 1717021669,
                          updated_at: 1717021669,
                          author: {
                            id: '991267707',
                            type: 'bot',
                            name: 'Operator',
                            email: 'operator+this_is_an_id643_that_should_be_at_least_@intercom.io',
                          },
                          attachments: [],
                          redacted: false,
                        },
                      ],
                      total_count: 1,
                    },
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/ticket',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: '10eb82e2-1019-4426-b5d0-8d3a817d0578',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/create_ticket_request',
            },
            examples: {
              successful_response: {
                summary: 'Successful response',
                value: {
                  ticket_type_id: 69,
                  contacts: [
                    {
                      id: '6657abe46abd0164c24b0df2',
                    },
                  ],
                  ticket_attributes: {
                    _default_title_: 'example',
                    _default_description_: 'there is a problem',
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  '/tickets/{id}': {
    put: {
      summary: 'Update a ticket',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
        {
          name: 'id',
          in: 'path',
          required: true,
          description: 'The unique identifier for the ticket which is given by Intercom',
          schema: {
            type: 'string',
          },
        },
      ],
      tags: ['Tickets'],
      operationId: 'updateTicket',
      description: 'You can update a ticket.',
      responses: {
        '200': {
          description: 'Successful response',
          content: {
            'application/json': {
              examples: {
                'Successful response': {
                  value: {
                    type: 'ticket',
                    id: '447',
                    ticket_attributes: {
                      _default_title_: 'example',
                      _default_description_: 'there is a problem',
                    },
                    ticket_state: 'in_progress',
                    ticket_state_internal_label: 'In progress',
                    ticket_state_external_label: 'In progress',
                    ticket_type: {
                      type: 'ticket_type',
                      id: '71',
                      name: 'my-ticket-type-8',
                      description: 'my ticket type description is awesome.',
                      icon: '🦁',
                      workspace_id: 'this_is_an_id647_that_should_be_at_least_',
                      archived: false,
                      created_at: 1717021671,
                      updated_at: 1717021671,
                      is_internal: false,
                      ticket_type_attributes: {
                        type: 'list',
                        data: [
                          {
                            type: 'ticket_type_attribute',
                            id: '208',
                            workspace_id: 'this_is_an_id647_that_should_be_at_least_',
                            name: '_default_title_',
                            description: 'ola',
                            data_type: 'string',
                            input_options: null,
                            order: 0,
                            required_to_create: true,
                            required_to_create_for_contacts: false,
                            visible_on_create: true,
                            visible_to_contacts: false,
                            default: false,
                            ticket_type_id: 71,
                            archived: false,
                            created_at: 1717021671,
                            updated_at: 1717021671,
                          },
                          {
                            type: 'ticket_type_attribute',
                            id: '209',
                            workspace_id: 'this_is_an_id647_that_should_be_at_least_',
                            name: '_default_description_',
                            description: 'ola',
                            data_type: 'string',
                            input_options: null,
                            order: 0,
                            required_to_create: true,
                            required_to_create_for_contacts: false,
                            visible_on_create: true,
                            visible_to_contacts: false,
                            default: false,
                            ticket_type_id: 71,
                            archived: false,
                            created_at: 1717021671,
                            updated_at: 1717021671,
                          },
                        ],
                      },
                    },
                    contacts: {
                      type: 'contact.list',
                      contacts: [
                        {
                          id: '6657abe76abd0164c24b0df3',
                          role: 'lead',
                        },
                      ],
                    },
                    admin_assignee_id: '991267721',
                    team_assignee_id: '0',
                    created_at: 1717021672,
                    updated_at: 1717021674,
                    ticket_parts: {
                      type: 'ticket_part.list',
                      ticket_parts: [
                        {
                          type: 'ticket_part',
                          id: '100',
                          part_type: 'ticket_state_updated_by_admin',
                          ticket_state: 'submitted',
                          previous_ticket_state: 'submitted',
                          created_at: 1717021672,
                          updated_at: 1717021672,
                          author: {
                            id: '991267719',
                            type: 'admin',
                            name: 'Ciaran412 Lee',
                            email: 'admin412@email.com',
                          },
                          attachments: [],
                          redacted: false,
                        },
                        {
                          type: 'ticket_part',
                          id: '101',
                          part_type: 'ticket_attribute_updated_by_admin',
                          created_at: 1717021673,
                          updated_at: 1717021673,
                          author: {
                            id: '991267720',
                            type: 'bot',
                            name: 'Operator',
                            email: 'operator+this_is_an_id647_that_should_be_at_least_@intercom.io',
                          },
                          attachments: [],
                          redacted: false,
                        },
                        {
                          type: 'ticket_part',
                          id: '102',
                          part_type: 'ticket_attribute_updated_by_admin',
                          created_at: 1717021673,
                          updated_at: 1717021673,
                          author: {
                            id: '991267720',
                            type: 'bot',
                            name: 'Operator',
                            email: 'operator+this_is_an_id647_that_should_be_at_least_@intercom.io',
                          },
                          attachments: [],
                          redacted: false,
                        },
                        {
                          type: 'ticket_part',
                          id: '103',
                          part_type: 'ticket_state_updated_by_admin',
                          ticket_state: 'in_progress',
                          previous_ticket_state: 'submitted',
                          created_at: 1717021674,
                          updated_at: 1717021674,
                          author: {
                            id: '991267720',
                            type: 'bot',
                            name: 'Operator',
                            email: 'operator+this_is_an_id647_that_should_be_at_least_@intercom.io',
                          },
                          attachments: [],
                          redacted: false,
                        },
                        {
                          type: 'ticket_part',
                          id: '104',
                          part_type: 'assignment',
                          created_at: 1717021674,
                          updated_at: 1717021674,
                          assigned_to: {
                            type: 'admin',
                            id: '991267721',
                          },
                          author: {
                            id: '991267719',
                            type: 'admin',
                            name: 'Ciaran412 Lee',
                            email: 'admin412@email.com',
                          },
                          attachments: [],
                          redacted: false,
                        },
                      ],
                      total_count: 5,
                    },
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/ticket',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: '475d6530-9b7b-45fe-ae9b-2eac68b2e305',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
        '404': {
          description: 'Assignee not found',
          content: {
            'application/json': {
              examples: {
                'Admin not found': {
                  value: {
                    type: 'error.list',
                    request_id: '297e6005-a6fa-476a-ad07-878b51f5646f',
                    errors: [
                      {
                        code: 'assignee_not_found',
                        message: 'Assignee not found',
                      },
                    ],
                  },
                },
                'Assignee not found': {
                  value: {
                    type: 'error.list',
                    request_id: '1d253700-fff8-4664-a0bb-b05242b3b2c0',
                    errors: [
                      {
                        code: 'assignee_not_found',
                        message: 'Assignee not found',
                      },
                    ],
                  },
                },
              },
            },
          },
        },
      },
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/update_ticket_request',
            },
            examples: {
              successful_response: {
                summary: 'Successful response',
                value: {
                  ticket_attributes: {
                    _default_title_: 'example',
                    _default_description_: 'there is a problem',
                  },
                  state: 'in_progress',
                  assignment: {
                    admin_id: '991267719',
                    assignee_id: '991267721',
                  },
                  open: true,
                  snoozed_until: 1673609604,
                },
              },
              admin_not_found: {
                summary: 'Admin not found',
                value: {
                  ticket_attributes: {
                    _default_title_: 'example',
                    _default_description_: 'there is a problem',
                  },
                  state: 'in_progress',
                  assignment: {
                    admin_id: '123',
                    assignee_id: '991267729',
                  },
                },
              },
              assignee_not_found: {
                summary: 'Assignee not found',
                value: {
                  ticket_attributes: {
                    _default_title_: 'example',
                    _default_description_: 'there is a problem',
                  },
                  state: 'in_progress',
                  assignment: {
                    admin_id: '991267735',
                    assignee_id: '456',
                  },
                },
              },
            },
          },
        },
      },
    },
    get: {
      summary: 'Retrieve a ticket',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
        {
          name: 'id',
          in: 'path',
          required: true,
          description: 'The unique identifier for the ticket which is given by Intercom.',
          schema: {
            type: 'string',
          },
        },
      ],
      tags: ['Tickets'],
      operationId: 'getTicket',
      description: 'You can fetch the details of a single ticket.',
      responses: {
        '200': {
          description: 'Ticket found',
          content: {
            'application/json': {
              examples: {
                'Ticket found': {
                  value: {
                    type: 'ticket',
                    id: '450',
                    ticket_attributes: {
                      _default_title_: 'attribute_value',
                      _default_description_: null,
                    },
                    ticket_state: 'submitted',
                    ticket_state_internal_label: 'Submitted',
                    ticket_state_external_label: 'Submitted',
                    ticket_type: {
                      type: 'ticket_type',
                      id: '75',
                      name: 'my-ticket-type-12',
                      description: 'my ticket type description is awesome.',
                      icon: '🦁',
                      workspace_id: 'this_is_an_id655_that_should_be_at_least_',
                      archived: false,
                      created_at: 1717021681,
                      updated_at: 1717021681,
                      is_internal: false,
                      ticket_type_attributes: {
                        type: 'list',
                        data: [
                          {
                            type: 'ticket_type_attribute',
                            id: '219',
                            workspace_id: 'this_is_an_id655_that_should_be_at_least_',
                            name: '_default_title_',
                            description: 'ola',
                            data_type: 'string',
                            input_options: null,
                            order: 0,
                            required_to_create: true,
                            required_to_create_for_contacts: false,
                            visible_on_create: true,
                            visible_to_contacts: false,
                            default: false,
                            ticket_type_id: 75,
                            archived: false,
                            created_at: 1717021681,
                            updated_at: 1717021681,
                          },
                          {
                            type: 'ticket_type_attribute',
                            id: '220',
                            workspace_id: 'this_is_an_id655_that_should_be_at_least_',
                            name: '_default_description_',
                            description: 'ola',
                            data_type: 'string',
                            input_options: null,
                            order: 0,
                            required_to_create: true,
                            required_to_create_for_contacts: false,
                            visible_on_create: true,
                            visible_to_contacts: false,
                            default: false,
                            ticket_type_id: 75,
                            archived: false,
                            created_at: 1717021681,
                            updated_at: 1717021681,
                          },
                        ],
                      },
                    },
                    contacts: {
                      type: 'contact.list',
                      contacts: [
                        {
                          id: '6657abf16abd0164c24b0df6',
                          role: 'lead',
                        },
                      ],
                    },
                    admin_assignee_id: '0',
                    team_assignee_id: '0',
                    created_at: 1717021682,
                    updated_at: 1717021682,
                    ticket_parts: {
                      type: 'ticket_part.list',
                      ticket_parts: [
                        {
                          type: 'ticket_part',
                          id: '107',
                          part_type: 'ticket_state_updated_by_admin',
                          ticket_state: 'submitted',
                          previous_ticket_state: 'submitted',
                          created_at: 1717021682,
                          updated_at: 1717021682,
                          author: {
                            id: '991267748',
                            type: 'admin',
                            name: 'Ciaran438 Lee',
                            email: 'admin438@email.com',
                          },
                          attachments: [],
                          redacted: false,
                        },
                      ],
                      total_count: 1,
                    },
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/ticket',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: 'cfbb87fd-8bbe-443d-9e21-cb3dc71f0de8',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
    },
  },
  '/visitors': {
    put: {
      summary: 'Update a visitor',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
      ],
      tags: ['Visitors'],
      operationId: 'updateVisitor',
      description:
        'Sending a PUT request to `/visitors` will result in an update of an existing Visitor.\n\n**Option 1.** You can update a visitor by passing in the `user_id` of the visitor in the Request body.\n\n**Option 2.** You can update a visitor by passing in the `id` of the visitor in the Request body.\n',
      responses: {
        '200': {
          description: 'successful',
          content: {
            'application/json': {
              examples: {
                successful: {
                  value: {
                    type: 'visitor',
                    id: '6657abf76abd0164c24b0df9',
                    user_id: '3ecf64d0-9ed1-4e9f-88e1-da7d6e6782f3',
                    anonymous: true,
                    email: '',
                    phone: null,
                    name: 'Gareth Bale',
                    pseudonym: 'Indigo Guitar',
                    avatar: {
                      type: 'avatar',
                      image_url: 'https://static.intercomassets.com/app/pseudonym_avatars_2019/indigo-guitar.png',
                    },
                    app_id: 'this_is_an_id665_that_should_be_at_least_',
                    companies: {
                      type: 'company.list',
                      companies: [],
                    },
                    location_data: {},
                    last_request_at: null,
                    created_at: 1717021687,
                    remote_created_at: 1717021687,
                    signed_up_at: 1717021687,
                    updated_at: 1717021687,
                    session_count: 0,
                    social_profiles: {
                      type: 'social_profile.list',
                      social_profiles: [],
                    },
                    owner_id: null,
                    unsubscribed_from_emails: false,
                    marked_email_as_spam: false,
                    has_hard_bounced: false,
                    tags: {
                      type: 'tag.list',
                      tags: [],
                    },
                    segments: {
                      type: 'segment.list',
                      segments: [],
                    },
                    custom_attributes: {},
                    referrer: null,
                    utm_campaign: null,
                    utm_content: null,
                    utm_medium: null,
                    utm_source: null,
                    utm_term: null,
                    do_not_track: null,
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/visitor',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: '629db2ed-d045-457f-81f7-a24d5b629c5f',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
        '404': {
          description: 'visitor Not Found',
          content: {
            'application/json': {
              examples: {
                'visitor Not Found': {
                  value: {
                    type: 'error.list',
                    request_id: '08bbf6c3-96e7-4f46-9623-1ffdd7176b04',
                    errors: [
                      {
                        code: 'not_found',
                        message: 'Visitor Not Found',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/update_visitor_request',
            },
            examples: {
              successful: {
                summary: 'successful',
                value: {
                  id: '6657abf76abd0164c24b0df9',
                  name: 'Gareth Bale',
                },
              },
              visitor_not_found: {
                summary: 'visitor Not Found',
                value: {
                  user_id: 'fail',
                  name: 'Christian Fail',
                },
              },
            },
          },
        },
      },
    },
    get: {
      summary: 'Retrieve a visitor with User ID',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
        {
          name: 'user_id',
          in: 'query',
          description: 'The user_id of the Visitor you want to retrieve.',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      tags: ['Visitors'],
      operationId: 'retrieveVisitorWithUserId',
      description: 'You can fetch the details of a single visitor.',
      responses: {
        '200': {
          description: 'successful',
          content: {
            'application/json': {
              examples: {
                successful: {
                  value: {
                    type: 'visitor',
                    id: '6657abf96abd0164c24b0dff',
                    user_id: '3ecf64d0-9ed1-4e9f-88e1-da7d6e6782f3',
                    anonymous: true,
                    email: '',
                    phone: null,
                    name: null,
                    pseudonym: null,
                    avatar: {
                      type: 'avatar',
                      image_url: null,
                    },
                    app_id: 'this_is_an_id671_that_should_be_at_least_',
                    companies: {
                      type: 'company.list',
                      companies: [],
                    },
                    location_data: {},
                    last_request_at: null,
                    created_at: 1717021689,
                    remote_created_at: 1717021689,
                    signed_up_at: 1717021689,
                    updated_at: 1717021689,
                    session_count: 0,
                    social_profiles: {
                      type: 'social_profile.list',
                      social_profiles: [],
                    },
                    owner_id: null,
                    unsubscribed_from_emails: false,
                    marked_email_as_spam: false,
                    has_hard_bounced: false,
                    tags: {
                      type: 'tag.list',
                      tags: [],
                    },
                    segments: {
                      type: 'segment.list',
                      segments: [],
                    },
                    custom_attributes: {},
                    referrer: null,
                    utm_campaign: null,
                    utm_content: null,
                    utm_medium: null,
                    utm_source: null,
                    utm_term: null,
                    do_not_track: null,
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/visitor',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: '3f38ffa3-4cb5-463a-98ac-795cadb5d475',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
        '404': {
          description: 'Visitor not found',
          content: {
            'application/json': {
              examples: {
                'Visitor not found': {
                  value: {
                    type: 'error.list',
                    request_id: 'dcae890e-9ff2-449a-bcc3-ab4ceb151767',
                    errors: [
                      {
                        code: 'not_found',
                        message: 'Visitor Not Found',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
    },
  },
  '/visitors/convert': {
    post: {
      summary: 'Convert a visitor',
      parameters: [
        {
          name: 'Intercom-Version',
          in: 'header',
          schema: {
            $ref: '#/components/schemas/intercom_version',
          },
        },
      ],
      tags: ['Visitors'],
      operationId: 'convertVisitor',
      description:
        "You can merge a Visitor to a Contact of role type `lead` or `user`.\n\n> 📘 What happens upon a visitor being converted?\n>\n> If the User exists, then the Visitor will be merged into it, the Visitor deleted and the User returned. If the User does not exist, the Visitor will be converted to a User, with the User identifiers replacing it's Visitor identifiers.\n",
      responses: {
        '200': {
          description: 'successful',
          content: {
            'application/json': {
              examples: {
                successful: {
                  value: {
                    type: 'contact',
                    id: '6657abfb6abd0164c24b0e06',
                    workspace_id: 'this_is_an_id677_that_should_be_at_least_',
                    external_id: null,
                    role: 'user',
                    email: 'foo@bar.com',
                    phone: null,
                    name: null,
                    avatar: null,
                    owner_id: null,
                    social_profiles: {
                      type: 'list',
                      data: [],
                    },
                    has_hard_bounced: false,
                    marked_email_as_spam: false,
                    unsubscribed_from_emails: false,
                    created_at: 1717021691,
                    updated_at: 1717021691,
                    signed_up_at: 1717021691,
                    last_seen_at: null,
                    last_replied_at: null,
                    last_contacted_at: null,
                    last_email_opened_at: null,
                    last_email_clicked_at: null,
                    language_override: null,
                    browser: null,
                    browser_version: null,
                    browser_language: null,
                    os: null,
                    location: {
                      type: 'location',
                      country: null,
                      region: null,
                      city: null,
                      country_code: null,
                      continent_code: null,
                    },
                    android_app_name: null,
                    android_app_version: null,
                    android_device: null,
                    android_os_version: null,
                    android_sdk_version: null,
                    android_last_seen_at: null,
                    ios_app_name: null,
                    ios_app_version: null,
                    ios_device: null,
                    ios_os_version: null,
                    ios_sdk_version: null,
                    ios_last_seen_at: null,
                    custom_attributes: {},
                    tags: {
                      type: 'list',
                      data: [],
                      url: '/contacts/6657abfb6abd0164c24b0e06/tags',
                      total_count: 0,
                      has_more: false,
                    },
                    notes: {
                      type: 'list',
                      data: [],
                      url: '/contacts/6657abfb6abd0164c24b0e06/notes',
                      total_count: 0,
                      has_more: false,
                    },
                    companies: {
                      type: 'list',
                      data: [],
                      url: '/contacts/6657abfb6abd0164c24b0e06/companies',
                      total_count: 0,
                      has_more: false,
                    },
                    opted_out_subscription_types: {
                      type: 'list',
                      data: [],
                      url: '/contacts/6657abfb6abd0164c24b0e06/subscriptions',
                      total_count: 0,
                      has_more: false,
                    },
                    opted_in_subscription_types: {
                      type: 'list',
                      data: [],
                      url: '/contacts/6657abfb6abd0164c24b0e06/subscriptions',
                      total_count: 0,
                      has_more: false,
                    },
                    utm_campaign: null,
                    utm_content: null,
                    utm_medium: null,
                    utm_source: null,
                    utm_term: null,
                    referrer: null,
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/contact',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              examples: {
                Unauthorized: {
                  value: {
                    type: 'error.list',
                    request_id: 'dea6a078-4db1-4f21-a9f6-14bfce68209d',
                    errors: [
                      {
                        code: 'unauthorized',
                        message: 'Access Token Invalid',
                      },
                    ],
                  },
                },
              },
              schema: {
                $ref: '#/components/schemas/error',
              },
            },
          },
        },
      },
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/convert_visitor_request',
            },
            examples: {
              successful: {
                summary: 'successful',
                value: {
                  visitor: {
                    user_id: '3ecf64d0-9ed1-4e9f-88e1-da7d6e6782f3',
                  },
                  user: {
                    email: 'foo@bar.com',
                  },
                  type: 'user',
                },
              },
            },
          },
        },
      },
    },
  },
} as TPaths;
