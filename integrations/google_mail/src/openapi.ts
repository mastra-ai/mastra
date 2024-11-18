// @ts-nocheck
export type openapi = {
  openapi: '3.0.0';
  servers: [
    {
      url: 'https://gmail.googleapis.com/';
    },
  ];
  'x-hasEquivalentPaths': true;
  externalDocs: {
    url: 'https://developers.google.com/gmail/api/';
  };
  paths: {
    '/gmail/v1/users/{userId}/drafts': {
      get: {
        description: "Lists the drafts in the user's mailbox.";
        operationId: 'gmail.users.drafts.list';
        parameters: [
          {
            description: "The user's email address. The special value `me` can be used to indicate the authenticated user.";
            in: 'path';
            name: 'userId';
            required: true;
            schema: {
              type: 'string';
            };
          },
          {
            description: 'Include drafts from `SPAM` and `TRASH` in the results.';
            in: 'query';
            name: 'includeSpamTrash';
            schema: {
              type: 'boolean';
            };
          },
          {
            description: 'Maximum number of drafts to return. This field defaults to 100. The maximum allowed value for this field is 500.';
            in: 'query';
            name: 'maxResults';
            schema: {
              type: 'integer';
            };
          },
          {
            description: 'Page token to retrieve a specific page of results in the list.';
            in: 'query';
            name: 'pageToken';
            schema: {
              type: 'string';
            };
          },
          {
            description: 'Only return draft messages matching the specified query. Supports the same query format as the Gmail search box. For example, `"from:someuser@example.com rfc822msgid: is:unread"`.';
            in: 'query';
            name: 'q';
            schema: {
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ListDraftsResponse';
                };
              };
            };
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://mail.google.com/'];
            Oauth2c: ['https://mail.google.com/'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.compose'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.compose'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.modify'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.readonly'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.readonly'];
          },
        ];
        tags: ['users'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/_.xgafv';
        },
        {
          $ref: '#/components/parameters/access_token';
        },
        {
          $ref: '#/components/parameters/alt';
        },
        {
          $ref: '#/components/parameters/callback';
        },
        {
          $ref: '#/components/parameters/fields';
        },
        {
          $ref: '#/components/parameters/key';
        },
        {
          $ref: '#/components/parameters/oauth_token';
        },
        {
          $ref: '#/components/parameters/prettyPrint';
        },
        {
          $ref: '#/components/parameters/quotaUser';
        },
        {
          $ref: '#/components/parameters/upload_protocol';
        },
        {
          $ref: '#/components/parameters/uploadType';
        },
      ];
      post: {
        description: 'Creates a new draft with the `DRAFT` label.';
        operationId: 'gmail.users.drafts.create';
        parameters: [
          {
            description: "The user's email address. The special value `me` can be used to indicate the authenticated user.";
            in: 'path';
            name: 'userId';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        requestBody: {
          content: {
            'message/cpim': {
              schema: {
                $ref: '#/components/schemas/Draft';
              };
            };
            'message/delivery-status': {
              schema: {
                $ref: '#/components/schemas/Draft';
              };
            };
            'message/disposition-notification': {
              schema: {
                $ref: '#/components/schemas/Draft';
              };
            };
            'message/external-body': {
              schema: {
                $ref: '#/components/schemas/Draft';
              };
            };
            'message/feedback-report': {
              schema: {
                $ref: '#/components/schemas/Draft';
              };
            };
            'message/global': {
              schema: {
                $ref: '#/components/schemas/Draft';
              };
            };
            'message/global-delivery-status': {
              schema: {
                $ref: '#/components/schemas/Draft';
              };
            };
            'message/global-disposition-notification': {
              schema: {
                $ref: '#/components/schemas/Draft';
              };
            };
            'message/global-headers': {
              schema: {
                $ref: '#/components/schemas/Draft';
              };
            };
            'message/http': {
              schema: {
                $ref: '#/components/schemas/Draft';
              };
            };
            'message/imdn+xml': {
              schema: {
                $ref: '#/components/schemas/Draft';
              };
            };
            'message/news': {
              schema: {
                $ref: '#/components/schemas/Draft';
              };
            };
            'message/partial': {
              schema: {
                $ref: '#/components/schemas/Draft';
              };
            };
            'message/rfc822': {
              schema: {
                $ref: '#/components/schemas/Draft';
              };
            };
            'message/s-http': {
              schema: {
                $ref: '#/components/schemas/Draft';
              };
            };
            'message/sip': {
              schema: {
                $ref: '#/components/schemas/Draft';
              };
            };
            'message/sipfrag': {
              schema: {
                $ref: '#/components/schemas/Draft';
              };
            };
            'message/tracking-status': {
              schema: {
                $ref: '#/components/schemas/Draft';
              };
            };
            'message/vnd.si.simp': {
              schema: {
                $ref: '#/components/schemas/Draft';
              };
            };
            'message/vnd.wfa.wsc': {
              schema: {
                $ref: '#/components/schemas/Draft';
              };
            };
          };
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Draft';
                };
              };
            };
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://mail.google.com/'];
            Oauth2c: ['https://mail.google.com/'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.addons.current.action.compose'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.addons.current.action.compose'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.compose'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.compose'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.modify'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'];
          },
        ];
        tags: ['users'];
      };
    };
    '/gmail/v1/users/{userId}/drafts/send': {
      parameters: [
        {
          $ref: '#/components/parameters/_.xgafv';
        },
        {
          $ref: '#/components/parameters/access_token';
        },
        {
          $ref: '#/components/parameters/alt';
        },
        {
          $ref: '#/components/parameters/callback';
        },
        {
          $ref: '#/components/parameters/fields';
        },
        {
          $ref: '#/components/parameters/key';
        },
        {
          $ref: '#/components/parameters/oauth_token';
        },
        {
          $ref: '#/components/parameters/prettyPrint';
        },
        {
          $ref: '#/components/parameters/quotaUser';
        },
        {
          $ref: '#/components/parameters/upload_protocol';
        },
        {
          $ref: '#/components/parameters/uploadType';
        },
      ];
      post: {
        description: 'Sends the specified, existing draft to the recipients in the `To`, `Cc`, and `Bcc` headers.';
        operationId: 'gmail.users.drafts.send';
        parameters: [
          {
            description: "The user's email address. The special value `me` can be used to indicate the authenticated user.";
            in: 'path';
            name: 'userId';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        requestBody: {
          content: {
            'message/cpim': {
              schema: {
                $ref: '#/components/schemas/Draft';
              };
            };
            'message/delivery-status': {
              schema: {
                $ref: '#/components/schemas/Draft';
              };
            };
            'message/disposition-notification': {
              schema: {
                $ref: '#/components/schemas/Draft';
              };
            };
            'message/external-body': {
              schema: {
                $ref: '#/components/schemas/Draft';
              };
            };
            'message/feedback-report': {
              schema: {
                $ref: '#/components/schemas/Draft';
              };
            };
            'message/global': {
              schema: {
                $ref: '#/components/schemas/Draft';
              };
            };
            'message/global-delivery-status': {
              schema: {
                $ref: '#/components/schemas/Draft';
              };
            };
            'message/global-disposition-notification': {
              schema: {
                $ref: '#/components/schemas/Draft';
              };
            };
            'message/global-headers': {
              schema: {
                $ref: '#/components/schemas/Draft';
              };
            };
            'message/http': {
              schema: {
                $ref: '#/components/schemas/Draft';
              };
            };
            'message/imdn+xml': {
              schema: {
                $ref: '#/components/schemas/Draft';
              };
            };
            'message/news': {
              schema: {
                $ref: '#/components/schemas/Draft';
              };
            };
            'message/partial': {
              schema: {
                $ref: '#/components/schemas/Draft';
              };
            };
            'message/rfc822': {
              schema: {
                $ref: '#/components/schemas/Draft';
              };
            };
            'message/s-http': {
              schema: {
                $ref: '#/components/schemas/Draft';
              };
            };
            'message/sip': {
              schema: {
                $ref: '#/components/schemas/Draft';
              };
            };
            'message/sipfrag': {
              schema: {
                $ref: '#/components/schemas/Draft';
              };
            };
            'message/tracking-status': {
              schema: {
                $ref: '#/components/schemas/Draft';
              };
            };
            'message/vnd.si.simp': {
              schema: {
                $ref: '#/components/schemas/Draft';
              };
            };
            'message/vnd.wfa.wsc': {
              schema: {
                $ref: '#/components/schemas/Draft';
              };
            };
          };
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Message';
                };
              };
            };
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://mail.google.com/'];
            Oauth2c: ['https://mail.google.com/'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.addons.current.action.compose'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.addons.current.action.compose'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.compose'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.compose'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.modify'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'];
          },
        ];
        tags: ['users'];
      };
    };
    '/gmail/v1/users/{userId}/drafts/{id}': {
      delete: {
        description: 'Immediately and permanently deletes the specified draft. Does not simply trash it.';
        operationId: 'gmail.users.drafts.delete';
        parameters: [
          {
            description: "The user's email address. The special value `me` can be used to indicate the authenticated user.";
            in: 'path';
            name: 'userId';
            required: true;
            schema: {
              type: 'string';
            };
          },
          {
            description: 'The ID of the draft to delete.';
            in: 'path';
            name: 'id';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://mail.google.com/'];
            Oauth2c: ['https://mail.google.com/'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.addons.current.action.compose'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.addons.current.action.compose'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.compose'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.compose'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.modify'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'];
          },
        ];
        tags: ['users'];
      };
      get: {
        description: 'Gets the specified draft.';
        operationId: 'gmail.users.drafts.get';
        parameters: [
          {
            description: "The user's email address. The special value `me` can be used to indicate the authenticated user.";
            in: 'path';
            name: 'userId';
            required: true;
            schema: {
              type: 'string';
            };
          },
          {
            description: 'The ID of the draft to retrieve.';
            in: 'path';
            name: 'id';
            required: true;
            schema: {
              type: 'string';
            };
          },
          {
            description: 'The format to return the draft in.';
            in: 'query';
            name: 'format';
            schema: {
              enum: ['minimal', 'full', 'raw', 'metadata'];
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Draft';
                };
              };
            };
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://mail.google.com/'];
            Oauth2c: ['https://mail.google.com/'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.compose'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.compose'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.modify'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.readonly'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.readonly'];
          },
        ];
        tags: ['users'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/_.xgafv';
        },
        {
          $ref: '#/components/parameters/access_token';
        },
        {
          $ref: '#/components/parameters/alt';
        },
        {
          $ref: '#/components/parameters/callback';
        },
        {
          $ref: '#/components/parameters/fields';
        },
        {
          $ref: '#/components/parameters/key';
        },
        {
          $ref: '#/components/parameters/oauth_token';
        },
        {
          $ref: '#/components/parameters/prettyPrint';
        },
        {
          $ref: '#/components/parameters/quotaUser';
        },
        {
          $ref: '#/components/parameters/upload_protocol';
        },
        {
          $ref: '#/components/parameters/uploadType';
        },
      ];
      put: {
        description: "Replaces a draft's content.";
        operationId: 'gmail.users.drafts.update';
        parameters: [
          {
            description: "The user's email address. The special value `me` can be used to indicate the authenticated user.";
            in: 'path';
            name: 'userId';
            required: true;
            schema: {
              type: 'string';
            };
          },
          {
            description: 'The ID of the draft to update.';
            in: 'path';
            name: 'id';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        requestBody: {
          content: {
            'message/cpim': {
              schema: {
                $ref: '#/components/schemas/Draft';
              };
            };
            'message/delivery-status': {
              schema: {
                $ref: '#/components/schemas/Draft';
              };
            };
            'message/disposition-notification': {
              schema: {
                $ref: '#/components/schemas/Draft';
              };
            };
            'message/external-body': {
              schema: {
                $ref: '#/components/schemas/Draft';
              };
            };
            'message/feedback-report': {
              schema: {
                $ref: '#/components/schemas/Draft';
              };
            };
            'message/global': {
              schema: {
                $ref: '#/components/schemas/Draft';
              };
            };
            'message/global-delivery-status': {
              schema: {
                $ref: '#/components/schemas/Draft';
              };
            };
            'message/global-disposition-notification': {
              schema: {
                $ref: '#/components/schemas/Draft';
              };
            };
            'message/global-headers': {
              schema: {
                $ref: '#/components/schemas/Draft';
              };
            };
            'message/http': {
              schema: {
                $ref: '#/components/schemas/Draft';
              };
            };
            'message/imdn+xml': {
              schema: {
                $ref: '#/components/schemas/Draft';
              };
            };
            'message/news': {
              schema: {
                $ref: '#/components/schemas/Draft';
              };
            };
            'message/partial': {
              schema: {
                $ref: '#/components/schemas/Draft';
              };
            };
            'message/rfc822': {
              schema: {
                $ref: '#/components/schemas/Draft';
              };
            };
            'message/s-http': {
              schema: {
                $ref: '#/components/schemas/Draft';
              };
            };
            'message/sip': {
              schema: {
                $ref: '#/components/schemas/Draft';
              };
            };
            'message/sipfrag': {
              schema: {
                $ref: '#/components/schemas/Draft';
              };
            };
            'message/tracking-status': {
              schema: {
                $ref: '#/components/schemas/Draft';
              };
            };
            'message/vnd.si.simp': {
              schema: {
                $ref: '#/components/schemas/Draft';
              };
            };
            'message/vnd.wfa.wsc': {
              schema: {
                $ref: '#/components/schemas/Draft';
              };
            };
          };
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Draft';
                };
              };
            };
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://mail.google.com/'];
            Oauth2c: ['https://mail.google.com/'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.addons.current.action.compose'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.addons.current.action.compose'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.compose'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.compose'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.modify'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'];
          },
        ];
        tags: ['users'];
      };
    };
    '/gmail/v1/users/{userId}/history': {
      get: {
        description: 'Lists the history of all changes to the given mailbox. History results are returned in chronological order (increasing `historyId`).';
        operationId: 'gmail.users.history.list';
        parameters: [
          {
            description: "The user's email address. The special value `me` can be used to indicate the authenticated user.";
            in: 'path';
            name: 'userId';
            required: true;
            schema: {
              type: 'string';
            };
          },
          {
            description: 'History types to be returned by the function';
            explode: true;
            in: 'query';
            name: 'historyTypes';
            schema: {
              items: {
                enum: ['messageAdded', 'messageDeleted', 'labelAdded', 'labelRemoved'];
                type: 'string';
              };
              type: 'array';
            };
            style: 'form';
          },
          {
            description: 'Only return messages with a label matching the ID.';
            in: 'query';
            name: 'labelId';
            schema: {
              type: 'string';
            };
          },
          {
            description: 'Maximum number of history records to return. This field defaults to 100. The maximum allowed value for this field is 500.';
            in: 'query';
            name: 'maxResults';
            schema: {
              type: 'integer';
            };
          },
          {
            description: 'Page token to retrieve a specific page of results in the list.';
            in: 'query';
            name: 'pageToken';
            schema: {
              type: 'string';
            };
          },
          {
            description: 'Required. Returns history records after the specified `startHistoryId`. The supplied `startHistoryId` should be obtained from the `historyId` of a message, thread, or previous `list` response. History IDs increase chronologically but are not contiguous with random gaps in between valid IDs. Supplying an invalid or out of date `startHistoryId` typically returns an `HTTP 404` error code. A `historyId` is typically valid for at least a week, but in some rare circumstances may be valid for only a few hours. If you receive an `HTTP 404` error response, your application should perform a full sync. If you receive no `nextPageToken` in the response, there are no updates to retrieve and you can store the returned `historyId` for a future request.';
            in: 'query';
            name: 'startHistoryId';
            schema: {
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ListHistoryResponse';
                };
              };
            };
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://mail.google.com/'];
            Oauth2c: ['https://mail.google.com/'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.metadata'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.metadata'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.modify'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.readonly'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.readonly'];
          },
        ];
        tags: ['users'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/_.xgafv';
        },
        {
          $ref: '#/components/parameters/access_token';
        },
        {
          $ref: '#/components/parameters/alt';
        },
        {
          $ref: '#/components/parameters/callback';
        },
        {
          $ref: '#/components/parameters/fields';
        },
        {
          $ref: '#/components/parameters/key';
        },
        {
          $ref: '#/components/parameters/oauth_token';
        },
        {
          $ref: '#/components/parameters/prettyPrint';
        },
        {
          $ref: '#/components/parameters/quotaUser';
        },
        {
          $ref: '#/components/parameters/upload_protocol';
        },
        {
          $ref: '#/components/parameters/uploadType';
        },
      ];
    };
    '/gmail/v1/users/{userId}/labels': {
      get: {
        description: "Lists all labels in the user's mailbox.";
        operationId: 'gmail.users.labels.list';
        parameters: [
          {
            description: "The user's email address. The special value `me` can be used to indicate the authenticated user.";
            in: 'path';
            name: 'userId';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ListLabelsResponse';
                };
              };
            };
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://mail.google.com/'];
            Oauth2c: ['https://mail.google.com/'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.labels'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.labels'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.metadata'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.metadata'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.modify'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.readonly'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.readonly'];
          },
        ];
        tags: ['users'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/_.xgafv';
        },
        {
          $ref: '#/components/parameters/access_token';
        },
        {
          $ref: '#/components/parameters/alt';
        },
        {
          $ref: '#/components/parameters/callback';
        },
        {
          $ref: '#/components/parameters/fields';
        },
        {
          $ref: '#/components/parameters/key';
        },
        {
          $ref: '#/components/parameters/oauth_token';
        },
        {
          $ref: '#/components/parameters/prettyPrint';
        },
        {
          $ref: '#/components/parameters/quotaUser';
        },
        {
          $ref: '#/components/parameters/upload_protocol';
        },
        {
          $ref: '#/components/parameters/uploadType';
        },
      ];
      post: {
        description: 'Creates a new label.';
        operationId: 'gmail.users.labels.create';
        parameters: [
          {
            description: "The user's email address. The special value `me` can be used to indicate the authenticated user.";
            in: 'path';
            name: 'userId';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Label';
              };
            };
          };
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Label';
                };
              };
            };
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://mail.google.com/'];
            Oauth2c: ['https://mail.google.com/'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.labels'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.labels'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.modify'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'];
          },
        ];
        tags: ['users'];
      };
    };
    '/gmail/v1/users/{userId}/labels/{id}': {
      delete: {
        description: 'Immediately and permanently deletes the specified label and removes it from any messages and threads that it is applied to.';
        operationId: 'gmail.users.labels.delete';
        parameters: [
          {
            description: "The user's email address. The special value `me` can be used to indicate the authenticated user.";
            in: 'path';
            name: 'userId';
            required: true;
            schema: {
              type: 'string';
            };
          },
          {
            description: 'The ID of the label to delete.';
            in: 'path';
            name: 'id';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://mail.google.com/'];
            Oauth2c: ['https://mail.google.com/'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.labels'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.labels'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.modify'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'];
          },
        ];
        tags: ['users'];
      };
      get: {
        description: 'Gets the specified label.';
        operationId: 'gmail.users.labels.get';
        parameters: [
          {
            description: "The user's email address. The special value `me` can be used to indicate the authenticated user.";
            in: 'path';
            name: 'userId';
            required: true;
            schema: {
              type: 'string';
            };
          },
          {
            description: 'The ID of the label to retrieve.';
            in: 'path';
            name: 'id';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Label';
                };
              };
            };
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://mail.google.com/'];
            Oauth2c: ['https://mail.google.com/'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.labels'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.labels'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.metadata'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.metadata'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.modify'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.readonly'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.readonly'];
          },
        ];
        tags: ['users'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/_.xgafv';
        },
        {
          $ref: '#/components/parameters/access_token';
        },
        {
          $ref: '#/components/parameters/alt';
        },
        {
          $ref: '#/components/parameters/callback';
        },
        {
          $ref: '#/components/parameters/fields';
        },
        {
          $ref: '#/components/parameters/key';
        },
        {
          $ref: '#/components/parameters/oauth_token';
        },
        {
          $ref: '#/components/parameters/prettyPrint';
        },
        {
          $ref: '#/components/parameters/quotaUser';
        },
        {
          $ref: '#/components/parameters/upload_protocol';
        },
        {
          $ref: '#/components/parameters/uploadType';
        },
      ];
      patch: {
        description: 'Patch the specified label.';
        operationId: 'gmail.users.labels.patch';
        parameters: [
          {
            description: "The user's email address. The special value `me` can be used to indicate the authenticated user.";
            in: 'path';
            name: 'userId';
            required: true;
            schema: {
              type: 'string';
            };
          },
          {
            description: 'The ID of the label to update.';
            in: 'path';
            name: 'id';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Label';
              };
            };
          };
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Label';
                };
              };
            };
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://mail.google.com/'];
            Oauth2c: ['https://mail.google.com/'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.labels'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.labels'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.modify'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'];
          },
        ];
        tags: ['users'];
      };
      put: {
        description: 'Updates the specified label.';
        operationId: 'gmail.users.labels.update';
        parameters: [
          {
            description: "The user's email address. The special value `me` can be used to indicate the authenticated user.";
            in: 'path';
            name: 'userId';
            required: true;
            schema: {
              type: 'string';
            };
          },
          {
            description: 'The ID of the label to update.';
            in: 'path';
            name: 'id';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Label';
              };
            };
          };
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Label';
                };
              };
            };
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://mail.google.com/'];
            Oauth2c: ['https://mail.google.com/'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.labels'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.labels'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.modify'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'];
          },
        ];
        tags: ['users'];
      };
    };
    '/gmail/v1/users/{userId}/messages': {
      get: {
        description: "Lists the messages in the user's mailbox.";
        operationId: 'gmail.users.messages.list';
        parameters: [
          {
            description: "The user's email address. The special value `me` can be used to indicate the authenticated user.";
            in: 'path';
            name: 'userId';
            required: true;
            schema: {
              type: 'string';
            };
          },
          {
            description: 'Include messages from `SPAM` and `TRASH` in the results.';
            in: 'query';
            name: 'includeSpamTrash';
            schema: {
              type: 'boolean';
            };
          },
          {
            description: "Only return messages with labels that match all of the specified label IDs. Messages in a thread might have labels that other messages in the same thread don't have. To learn more, see [Manage labels on messages and threads](https://developers.google.com/gmail/api/guides/labels#manage_labels_on_messages_threads).";
            explode: true;
            in: 'query';
            name: 'labelIds';
            schema: {
              items: {
                type: 'string';
              };
              type: 'array';
            };
            style: 'form';
          },
          {
            description: 'Maximum number of messages to return. This field defaults to 100. The maximum allowed value for this field is 500.';
            in: 'query';
            name: 'maxResults';
            schema: {
              type: 'integer';
            };
          },
          {
            description: 'Page token to retrieve a specific page of results in the list.';
            in: 'query';
            name: 'pageToken';
            schema: {
              type: 'string';
            };
          },
          {
            description: 'Only return messages matching the specified query. Supports the same query format as the Gmail search box. For example, `"from:someuser@example.com rfc822msgid: is:unread"`. Parameter cannot be used when accessing the api using the gmail.metadata scope.';
            in: 'query';
            name: 'q';
            schema: {
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ListMessagesResponse';
                };
              };
            };
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://mail.google.com/'];
            Oauth2c: ['https://mail.google.com/'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.metadata'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.metadata'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.modify'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.readonly'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.readonly'];
          },
        ];
        tags: ['users'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/_.xgafv';
        },
        {
          $ref: '#/components/parameters/access_token';
        },
        {
          $ref: '#/components/parameters/alt';
        },
        {
          $ref: '#/components/parameters/callback';
        },
        {
          $ref: '#/components/parameters/fields';
        },
        {
          $ref: '#/components/parameters/key';
        },
        {
          $ref: '#/components/parameters/oauth_token';
        },
        {
          $ref: '#/components/parameters/prettyPrint';
        },
        {
          $ref: '#/components/parameters/quotaUser';
        },
        {
          $ref: '#/components/parameters/upload_protocol';
        },
        {
          $ref: '#/components/parameters/uploadType';
        },
      ];
      post: {
        description: "Directly inserts a message into only this user's mailbox similar to `IMAP APPEND`, bypassing most scanning and classification. Does not send a message.";
        operationId: 'gmail.users.messages.insert';
        parameters: [
          {
            description: "The user's email address. The special value `me` can be used to indicate the authenticated user.";
            in: 'path';
            name: 'userId';
            required: true;
            schema: {
              type: 'string';
            };
          },
          {
            description: 'Mark the email as permanently deleted (not TRASH) and only visible in Google Vault to a Vault administrator. Only used for Google Workspace accounts.';
            in: 'query';
            name: 'deleted';
            schema: {
              type: 'boolean';
            };
          },
          {
            description: "Source for Gmail's internal date of the message.";
            in: 'query';
            name: 'internalDateSource';
            schema: {
              enum: ['receivedTime', 'dateHeader'];
              type: 'string';
            };
          },
        ];
        requestBody: {
          content: {
            'message/cpim': {
              schema: {
                $ref: '#/components/schemas/Message';
              };
            };
            'message/delivery-status': {
              schema: {
                $ref: '#/components/schemas/Message';
              };
            };
            'message/disposition-notification': {
              schema: {
                $ref: '#/components/schemas/Message';
              };
            };
            'message/external-body': {
              schema: {
                $ref: '#/components/schemas/Message';
              };
            };
            'message/feedback-report': {
              schema: {
                $ref: '#/components/schemas/Message';
              };
            };
            'message/global': {
              schema: {
                $ref: '#/components/schemas/Message';
              };
            };
            'message/global-delivery-status': {
              schema: {
                $ref: '#/components/schemas/Message';
              };
            };
            'message/global-disposition-notification': {
              schema: {
                $ref: '#/components/schemas/Message';
              };
            };
            'message/global-headers': {
              schema: {
                $ref: '#/components/schemas/Message';
              };
            };
            'message/http': {
              schema: {
                $ref: '#/components/schemas/Message';
              };
            };
            'message/imdn+xml': {
              schema: {
                $ref: '#/components/schemas/Message';
              };
            };
            'message/news': {
              schema: {
                $ref: '#/components/schemas/Message';
              };
            };
            'message/partial': {
              schema: {
                $ref: '#/components/schemas/Message';
              };
            };
            'message/rfc822': {
              schema: {
                $ref: '#/components/schemas/Message';
              };
            };
            'message/s-http': {
              schema: {
                $ref: '#/components/schemas/Message';
              };
            };
            'message/sip': {
              schema: {
                $ref: '#/components/schemas/Message';
              };
            };
            'message/sipfrag': {
              schema: {
                $ref: '#/components/schemas/Message';
              };
            };
            'message/tracking-status': {
              schema: {
                $ref: '#/components/schemas/Message';
              };
            };
            'message/vnd.si.simp': {
              schema: {
                $ref: '#/components/schemas/Message';
              };
            };
            'message/vnd.wfa.wsc': {
              schema: {
                $ref: '#/components/schemas/Message';
              };
            };
          };
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Message';
                };
              };
            };
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://mail.google.com/'];
            Oauth2c: ['https://mail.google.com/'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.insert'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.insert'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.modify'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'];
          },
        ];
        tags: ['users'];
      };
    };
    '/gmail/v1/users/{userId}/messages/batchDelete': {
      parameters: [
        {
          $ref: '#/components/parameters/_.xgafv';
        },
        {
          $ref: '#/components/parameters/access_token';
        },
        {
          $ref: '#/components/parameters/alt';
        },
        {
          $ref: '#/components/parameters/callback';
        },
        {
          $ref: '#/components/parameters/fields';
        },
        {
          $ref: '#/components/parameters/key';
        },
        {
          $ref: '#/components/parameters/oauth_token';
        },
        {
          $ref: '#/components/parameters/prettyPrint';
        },
        {
          $ref: '#/components/parameters/quotaUser';
        },
        {
          $ref: '#/components/parameters/upload_protocol';
        },
        {
          $ref: '#/components/parameters/uploadType';
        },
      ];
      post: {
        description: 'Deletes many messages by message ID. Provides no guarantees that messages were not already deleted or even existed at all.';
        operationId: 'gmail.users.messages.batchDelete';
        parameters: [
          {
            description: "The user's email address. The special value `me` can be used to indicate the authenticated user.";
            in: 'path';
            name: 'userId';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/BatchDeleteMessagesRequest';
              };
            };
          };
        };
        responses: {
          '200': {
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://mail.google.com/'];
            Oauth2c: ['https://mail.google.com/'];
          },
        ];
        tags: ['users'];
      };
    };
    '/gmail/v1/users/{userId}/messages/batchModify': {
      parameters: [
        {
          $ref: '#/components/parameters/_.xgafv';
        },
        {
          $ref: '#/components/parameters/access_token';
        },
        {
          $ref: '#/components/parameters/alt';
        },
        {
          $ref: '#/components/parameters/callback';
        },
        {
          $ref: '#/components/parameters/fields';
        },
        {
          $ref: '#/components/parameters/key';
        },
        {
          $ref: '#/components/parameters/oauth_token';
        },
        {
          $ref: '#/components/parameters/prettyPrint';
        },
        {
          $ref: '#/components/parameters/quotaUser';
        },
        {
          $ref: '#/components/parameters/upload_protocol';
        },
        {
          $ref: '#/components/parameters/uploadType';
        },
      ];
      post: {
        description: 'Modifies the labels on the specified messages.';
        operationId: 'gmail.users.messages.batchModify';
        parameters: [
          {
            description: "The user's email address. The special value `me` can be used to indicate the authenticated user.";
            in: 'path';
            name: 'userId';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/BatchModifyMessagesRequest';
              };
            };
          };
        };
        responses: {
          '200': {
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://mail.google.com/'];
            Oauth2c: ['https://mail.google.com/'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.modify'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'];
          },
        ];
        tags: ['users'];
      };
    };
    '/gmail/v1/users/{userId}/messages/import': {
      parameters: [
        {
          $ref: '#/components/parameters/_.xgafv';
        },
        {
          $ref: '#/components/parameters/access_token';
        },
        {
          $ref: '#/components/parameters/alt';
        },
        {
          $ref: '#/components/parameters/callback';
        },
        {
          $ref: '#/components/parameters/fields';
        },
        {
          $ref: '#/components/parameters/key';
        },
        {
          $ref: '#/components/parameters/oauth_token';
        },
        {
          $ref: '#/components/parameters/prettyPrint';
        },
        {
          $ref: '#/components/parameters/quotaUser';
        },
        {
          $ref: '#/components/parameters/upload_protocol';
        },
        {
          $ref: '#/components/parameters/uploadType';
        },
      ];
      post: {
        description: "Imports a message into only this user's mailbox, with standard email delivery scanning and classification similar to receiving via SMTP. This method doesn't perform SPF checks, so it might not work for some spam messages, such as those attempting to perform domain spoofing. This method does not send a message.";
        operationId: 'gmail.users.messages.import';
        parameters: [
          {
            description: "The user's email address. The special value `me` can be used to indicate the authenticated user.";
            in: 'path';
            name: 'userId';
            required: true;
            schema: {
              type: 'string';
            };
          },
          {
            description: 'Mark the email as permanently deleted (not TRASH) and only visible in Google Vault to a Vault administrator. Only used for Google Workspace accounts.';
            in: 'query';
            name: 'deleted';
            schema: {
              type: 'boolean';
            };
          },
          {
            description: "Source for Gmail's internal date of the message.";
            in: 'query';
            name: 'internalDateSource';
            schema: {
              enum: ['receivedTime', 'dateHeader'];
              type: 'string';
            };
          },
          {
            description: 'Ignore the Gmail spam classifier decision and never mark this email as SPAM in the mailbox.';
            in: 'query';
            name: 'neverMarkSpam';
            schema: {
              type: 'boolean';
            };
          },
          {
            description: 'Process calendar invites in the email and add any extracted meetings to the Google Calendar for this user.';
            in: 'query';
            name: 'processForCalendar';
            schema: {
              type: 'boolean';
            };
          },
        ];
        requestBody: {
          content: {
            'message/cpim': {
              schema: {
                $ref: '#/components/schemas/Message';
              };
            };
            'message/delivery-status': {
              schema: {
                $ref: '#/components/schemas/Message';
              };
            };
            'message/disposition-notification': {
              schema: {
                $ref: '#/components/schemas/Message';
              };
            };
            'message/external-body': {
              schema: {
                $ref: '#/components/schemas/Message';
              };
            };
            'message/feedback-report': {
              schema: {
                $ref: '#/components/schemas/Message';
              };
            };
            'message/global': {
              schema: {
                $ref: '#/components/schemas/Message';
              };
            };
            'message/global-delivery-status': {
              schema: {
                $ref: '#/components/schemas/Message';
              };
            };
            'message/global-disposition-notification': {
              schema: {
                $ref: '#/components/schemas/Message';
              };
            };
            'message/global-headers': {
              schema: {
                $ref: '#/components/schemas/Message';
              };
            };
            'message/http': {
              schema: {
                $ref: '#/components/schemas/Message';
              };
            };
            'message/imdn+xml': {
              schema: {
                $ref: '#/components/schemas/Message';
              };
            };
            'message/news': {
              schema: {
                $ref: '#/components/schemas/Message';
              };
            };
            'message/partial': {
              schema: {
                $ref: '#/components/schemas/Message';
              };
            };
            'message/rfc822': {
              schema: {
                $ref: '#/components/schemas/Message';
              };
            };
            'message/s-http': {
              schema: {
                $ref: '#/components/schemas/Message';
              };
            };
            'message/sip': {
              schema: {
                $ref: '#/components/schemas/Message';
              };
            };
            'message/sipfrag': {
              schema: {
                $ref: '#/components/schemas/Message';
              };
            };
            'message/tracking-status': {
              schema: {
                $ref: '#/components/schemas/Message';
              };
            };
            'message/vnd.si.simp': {
              schema: {
                $ref: '#/components/schemas/Message';
              };
            };
            'message/vnd.wfa.wsc': {
              schema: {
                $ref: '#/components/schemas/Message';
              };
            };
          };
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Message';
                };
              };
            };
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://mail.google.com/'];
            Oauth2c: ['https://mail.google.com/'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.insert'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.insert'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.modify'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'];
          },
        ];
        tags: ['users'];
      };
    };
    '/gmail/v1/users/{userId}/messages/send': {
      parameters: [
        {
          $ref: '#/components/parameters/_.xgafv';
        },
        {
          $ref: '#/components/parameters/access_token';
        },
        {
          $ref: '#/components/parameters/alt';
        },
        {
          $ref: '#/components/parameters/callback';
        },
        {
          $ref: '#/components/parameters/fields';
        },
        {
          $ref: '#/components/parameters/key';
        },
        {
          $ref: '#/components/parameters/oauth_token';
        },
        {
          $ref: '#/components/parameters/prettyPrint';
        },
        {
          $ref: '#/components/parameters/quotaUser';
        },
        {
          $ref: '#/components/parameters/upload_protocol';
        },
        {
          $ref: '#/components/parameters/uploadType';
        },
      ];
      post: {
        description: 'Sends the specified message to the recipients in the `To`, `Cc`, and `Bcc` headers. For example usage, see [Sending email](https://developers.google.com/gmail/api/guides/sending).';
        operationId: 'gmail.users.messages.send';
        parameters: [
          {
            description: "The user's email address. The special value `me` can be used to indicate the authenticated user.";
            in: 'path';
            name: 'userId';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        requestBody: {
          content: {
            'message/cpim': {
              schema: {
                $ref: '#/components/schemas/Message';
              };
            };
            'message/delivery-status': {
              schema: {
                $ref: '#/components/schemas/Message';
              };
            };
            'message/disposition-notification': {
              schema: {
                $ref: '#/components/schemas/Message';
              };
            };
            'message/external-body': {
              schema: {
                $ref: '#/components/schemas/Message';
              };
            };
            'message/feedback-report': {
              schema: {
                $ref: '#/components/schemas/Message';
              };
            };
            'message/global': {
              schema: {
                $ref: '#/components/schemas/Message';
              };
            };
            'message/global-delivery-status': {
              schema: {
                $ref: '#/components/schemas/Message';
              };
            };
            'message/global-disposition-notification': {
              schema: {
                $ref: '#/components/schemas/Message';
              };
            };
            'message/global-headers': {
              schema: {
                $ref: '#/components/schemas/Message';
              };
            };
            'message/http': {
              schema: {
                $ref: '#/components/schemas/Message';
              };
            };
            'message/imdn+xml': {
              schema: {
                $ref: '#/components/schemas/Message';
              };
            };
            'message/news': {
              schema: {
                $ref: '#/components/schemas/Message';
              };
            };
            'message/partial': {
              schema: {
                $ref: '#/components/schemas/Message';
              };
            };
            'message/rfc822': {
              schema: {
                $ref: '#/components/schemas/Message';
              };
            };
            'message/s-http': {
              schema: {
                $ref: '#/components/schemas/Message';
              };
            };
            'message/sip': {
              schema: {
                $ref: '#/components/schemas/Message';
              };
            };
            'message/sipfrag': {
              schema: {
                $ref: '#/components/schemas/Message';
              };
            };
            'message/tracking-status': {
              schema: {
                $ref: '#/components/schemas/Message';
              };
            };
            'message/vnd.si.simp': {
              schema: {
                $ref: '#/components/schemas/Message';
              };
            };
            'message/vnd.wfa.wsc': {
              schema: {
                $ref: '#/components/schemas/Message';
              };
            };
          };
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Message';
                };
              };
            };
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://mail.google.com/'];
            Oauth2c: ['https://mail.google.com/'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.addons.current.action.compose'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.addons.current.action.compose'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.compose'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.compose'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.modify'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.send'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.send'];
          },
        ];
        tags: ['users'];
      };
    };
    '/gmail/v1/users/{userId}/messages/{id}': {
      delete: {
        description: 'Immediately and permanently deletes the specified message. This operation cannot be undone. Prefer `messages.trash` instead.';
        operationId: 'gmail.users.messages.delete';
        parameters: [
          {
            description: "The user's email address. The special value `me` can be used to indicate the authenticated user.";
            in: 'path';
            name: 'userId';
            required: true;
            schema: {
              type: 'string';
            };
          },
          {
            description: 'The ID of the message to delete.';
            in: 'path';
            name: 'id';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://mail.google.com/'];
            Oauth2c: ['https://mail.google.com/'];
          },
        ];
        tags: ['users'];
      };
      get: {
        description: 'Gets the specified message.';
        operationId: 'gmail.users.messages.get';
        parameters: [
          {
            description: "The user's email address. The special value `me` can be used to indicate the authenticated user.";
            in: 'path';
            name: 'userId';
            required: true;
            schema: {
              type: 'string';
            };
          },
          {
            description: 'The ID of the message to retrieve. This ID is usually retrieved using `messages.list`. The ID is also contained in the result when a message is inserted (`messages.insert`) or imported (`messages.import`).';
            in: 'path';
            name: 'id';
            required: true;
            schema: {
              type: 'string';
            };
          },
          {
            description: 'The format to return the message in.';
            in: 'query';
            name: 'format';
            schema: {
              enum: ['minimal', 'full', 'raw', 'metadata'];
              type: 'string';
            };
          },
          {
            description: 'When given and format is `METADATA`, only include headers specified.';
            explode: true;
            in: 'query';
            name: 'metadataHeaders';
            schema: {
              items: {
                type: 'string';
              };
              type: 'array';
            };
            style: 'form';
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Message';
                };
              };
            };
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://mail.google.com/'];
            Oauth2c: ['https://mail.google.com/'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.addons.current.message.action'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.addons.current.message.action'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.addons.current.message.metadata'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.addons.current.message.metadata'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.addons.current.message.readonly'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.addons.current.message.readonly'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.metadata'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.metadata'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.modify'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.readonly'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.readonly'];
          },
        ];
        tags: ['users'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/_.xgafv';
        },
        {
          $ref: '#/components/parameters/access_token';
        },
        {
          $ref: '#/components/parameters/alt';
        },
        {
          $ref: '#/components/parameters/callback';
        },
        {
          $ref: '#/components/parameters/fields';
        },
        {
          $ref: '#/components/parameters/key';
        },
        {
          $ref: '#/components/parameters/oauth_token';
        },
        {
          $ref: '#/components/parameters/prettyPrint';
        },
        {
          $ref: '#/components/parameters/quotaUser';
        },
        {
          $ref: '#/components/parameters/upload_protocol';
        },
        {
          $ref: '#/components/parameters/uploadType';
        },
      ];
    };
    '/gmail/v1/users/{userId}/messages/{id}/modify': {
      parameters: [
        {
          $ref: '#/components/parameters/_.xgafv';
        },
        {
          $ref: '#/components/parameters/access_token';
        },
        {
          $ref: '#/components/parameters/alt';
        },
        {
          $ref: '#/components/parameters/callback';
        },
        {
          $ref: '#/components/parameters/fields';
        },
        {
          $ref: '#/components/parameters/key';
        },
        {
          $ref: '#/components/parameters/oauth_token';
        },
        {
          $ref: '#/components/parameters/prettyPrint';
        },
        {
          $ref: '#/components/parameters/quotaUser';
        },
        {
          $ref: '#/components/parameters/upload_protocol';
        },
        {
          $ref: '#/components/parameters/uploadType';
        },
      ];
      post: {
        description: 'Modifies the labels on the specified message.';
        operationId: 'gmail.users.messages.modify';
        parameters: [
          {
            description: "The user's email address. The special value `me` can be used to indicate the authenticated user.";
            in: 'path';
            name: 'userId';
            required: true;
            schema: {
              type: 'string';
            };
          },
          {
            description: 'The ID of the message to modify.';
            in: 'path';
            name: 'id';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ModifyMessageRequest';
              };
            };
          };
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Message';
                };
              };
            };
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://mail.google.com/'];
            Oauth2c: ['https://mail.google.com/'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.modify'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'];
          },
        ];
        tags: ['users'];
      };
    };
    '/gmail/v1/users/{userId}/messages/{id}/trash': {
      parameters: [
        {
          $ref: '#/components/parameters/_.xgafv';
        },
        {
          $ref: '#/components/parameters/access_token';
        },
        {
          $ref: '#/components/parameters/alt';
        },
        {
          $ref: '#/components/parameters/callback';
        },
        {
          $ref: '#/components/parameters/fields';
        },
        {
          $ref: '#/components/parameters/key';
        },
        {
          $ref: '#/components/parameters/oauth_token';
        },
        {
          $ref: '#/components/parameters/prettyPrint';
        },
        {
          $ref: '#/components/parameters/quotaUser';
        },
        {
          $ref: '#/components/parameters/upload_protocol';
        },
        {
          $ref: '#/components/parameters/uploadType';
        },
      ];
      post: {
        description: 'Moves the specified message to the trash.';
        operationId: 'gmail.users.messages.trash';
        parameters: [
          {
            description: "The user's email address. The special value `me` can be used to indicate the authenticated user.";
            in: 'path';
            name: 'userId';
            required: true;
            schema: {
              type: 'string';
            };
          },
          {
            description: 'The ID of the message to Trash.';
            in: 'path';
            name: 'id';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Message';
                };
              };
            };
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://mail.google.com/'];
            Oauth2c: ['https://mail.google.com/'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.modify'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'];
          },
        ];
        tags: ['users'];
      };
    };
    '/gmail/v1/users/{userId}/messages/{id}/untrash': {
      parameters: [
        {
          $ref: '#/components/parameters/_.xgafv';
        },
        {
          $ref: '#/components/parameters/access_token';
        },
        {
          $ref: '#/components/parameters/alt';
        },
        {
          $ref: '#/components/parameters/callback';
        },
        {
          $ref: '#/components/parameters/fields';
        },
        {
          $ref: '#/components/parameters/key';
        },
        {
          $ref: '#/components/parameters/oauth_token';
        },
        {
          $ref: '#/components/parameters/prettyPrint';
        },
        {
          $ref: '#/components/parameters/quotaUser';
        },
        {
          $ref: '#/components/parameters/upload_protocol';
        },
        {
          $ref: '#/components/parameters/uploadType';
        },
      ];
      post: {
        description: 'Removes the specified message from the trash.';
        operationId: 'gmail.users.messages.untrash';
        parameters: [
          {
            description: "The user's email address. The special value `me` can be used to indicate the authenticated user.";
            in: 'path';
            name: 'userId';
            required: true;
            schema: {
              type: 'string';
            };
          },
          {
            description: 'The ID of the message to remove from Trash.';
            in: 'path';
            name: 'id';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Message';
                };
              };
            };
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://mail.google.com/'];
            Oauth2c: ['https://mail.google.com/'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.modify'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'];
          },
        ];
        tags: ['users'];
      };
    };
    '/gmail/v1/users/{userId}/messages/{messageId}/attachments/{id}': {
      get: {
        description: 'Gets the specified message attachment.';
        operationId: 'gmail.users.messages.attachments.get';
        parameters: [
          {
            description: "The user's email address. The special value `me` can be used to indicate the authenticated user.";
            in: 'path';
            name: 'userId';
            required: true;
            schema: {
              type: 'string';
            };
          },
          {
            description: 'The ID of the message containing the attachment.';
            in: 'path';
            name: 'messageId';
            required: true;
            schema: {
              type: 'string';
            };
          },
          {
            description: 'The ID of the attachment.';
            in: 'path';
            name: 'id';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/MessagePartBody';
                };
              };
            };
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://mail.google.com/'];
            Oauth2c: ['https://mail.google.com/'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.addons.current.message.action'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.addons.current.message.action'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.addons.current.message.readonly'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.addons.current.message.readonly'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.modify'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.readonly'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.readonly'];
          },
        ];
        tags: ['users'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/_.xgafv';
        },
        {
          $ref: '#/components/parameters/access_token';
        },
        {
          $ref: '#/components/parameters/alt';
        },
        {
          $ref: '#/components/parameters/callback';
        },
        {
          $ref: '#/components/parameters/fields';
        },
        {
          $ref: '#/components/parameters/key';
        },
        {
          $ref: '#/components/parameters/oauth_token';
        },
        {
          $ref: '#/components/parameters/prettyPrint';
        },
        {
          $ref: '#/components/parameters/quotaUser';
        },
        {
          $ref: '#/components/parameters/upload_protocol';
        },
        {
          $ref: '#/components/parameters/uploadType';
        },
      ];
    };
    '/gmail/v1/users/{userId}/profile': {
      get: {
        description: "Gets the current user's Gmail profile.";
        operationId: 'gmail.users.getProfile';
        parameters: [
          {
            description: "The user's email address. The special value `me` can be used to indicate the authenticated user.";
            in: 'path';
            name: 'userId';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Profile';
                };
              };
            };
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://mail.google.com/'];
            Oauth2c: ['https://mail.google.com/'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.compose'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.compose'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.metadata'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.metadata'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.modify'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.readonly'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.readonly'];
          },
        ];
        tags: ['users'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/_.xgafv';
        },
        {
          $ref: '#/components/parameters/access_token';
        },
        {
          $ref: '#/components/parameters/alt';
        },
        {
          $ref: '#/components/parameters/callback';
        },
        {
          $ref: '#/components/parameters/fields';
        },
        {
          $ref: '#/components/parameters/key';
        },
        {
          $ref: '#/components/parameters/oauth_token';
        },
        {
          $ref: '#/components/parameters/prettyPrint';
        },
        {
          $ref: '#/components/parameters/quotaUser';
        },
        {
          $ref: '#/components/parameters/upload_protocol';
        },
        {
          $ref: '#/components/parameters/uploadType';
        },
      ];
    };
    '/gmail/v1/users/{userId}/settings/autoForwarding': {
      get: {
        description: 'Gets the auto-forwarding setting for the specified account.';
        operationId: 'gmail.users.settings.getAutoForwarding';
        parameters: [
          {
            description: 'User\'s email address. The special value "me" can be used to indicate the authenticated user.';
            in: 'path';
            name: 'userId';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/AutoForwarding';
                };
              };
            };
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://mail.google.com/'];
            Oauth2c: ['https://mail.google.com/'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.modify'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.readonly'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.readonly'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.settings.basic'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.basic'];
          },
        ];
        tags: ['users'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/_.xgafv';
        },
        {
          $ref: '#/components/parameters/access_token';
        },
        {
          $ref: '#/components/parameters/alt';
        },
        {
          $ref: '#/components/parameters/callback';
        },
        {
          $ref: '#/components/parameters/fields';
        },
        {
          $ref: '#/components/parameters/key';
        },
        {
          $ref: '#/components/parameters/oauth_token';
        },
        {
          $ref: '#/components/parameters/prettyPrint';
        },
        {
          $ref: '#/components/parameters/quotaUser';
        },
        {
          $ref: '#/components/parameters/upload_protocol';
        },
        {
          $ref: '#/components/parameters/uploadType';
        },
      ];
      put: {
        description: 'Updates the auto-forwarding setting for the specified account. A verified forwarding address must be specified when auto-forwarding is enabled. This method is only available to service account clients that have been delegated domain-wide authority.';
        operationId: 'gmail.users.settings.updateAutoForwarding';
        parameters: [
          {
            description: 'User\'s email address. The special value "me" can be used to indicate the authenticated user.';
            in: 'path';
            name: 'userId';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/AutoForwarding';
              };
            };
          };
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/AutoForwarding';
                };
              };
            };
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.settings.sharing'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.sharing'];
          },
        ];
        tags: ['users'];
      };
    };
    '/gmail/v1/users/{userId}/settings/cse/identities': {
      get: {
        description: 'Lists the client-side encrypted identities for an authenticated user.';
        operationId: 'gmail.users.settings.cse.identities.list';
        parameters: [
          {
            description: "The requester's primary email address. To indicate the authenticated user, you can use the special value `me`.";
            in: 'path';
            name: 'userId';
            required: true;
            schema: {
              type: 'string';
            };
          },
          {
            description: 'The number of identities to return. If not provided, the page size will default to 20 entries.';
            in: 'query';
            name: 'pageSize';
            schema: {
              type: 'integer';
            };
          },
          {
            description: 'Pagination token indicating which page of identities to return. If the token is not supplied, then the API will return the first page of results.';
            in: 'query';
            name: 'pageToken';
            schema: {
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ListCseIdentitiesResponse';
                };
              };
            };
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://mail.google.com/'];
            Oauth2c: ['https://mail.google.com/'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.modify'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.readonly'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.readonly'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.settings.basic'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.basic'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.settings.sharing'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.sharing'];
          },
        ];
        tags: ['users'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/_.xgafv';
        },
        {
          $ref: '#/components/parameters/access_token';
        },
        {
          $ref: '#/components/parameters/alt';
        },
        {
          $ref: '#/components/parameters/callback';
        },
        {
          $ref: '#/components/parameters/fields';
        },
        {
          $ref: '#/components/parameters/key';
        },
        {
          $ref: '#/components/parameters/oauth_token';
        },
        {
          $ref: '#/components/parameters/prettyPrint';
        },
        {
          $ref: '#/components/parameters/quotaUser';
        },
        {
          $ref: '#/components/parameters/upload_protocol';
        },
        {
          $ref: '#/components/parameters/uploadType';
        },
      ];
      post: {
        description: "Creates and configures a client-side encryption identity that's authorized to send mail from the user account. Google publishes the S/MIME certificate to a shared domain-wide directory so that people within a Google Workspace organization can encrypt and send mail to the identity.";
        operationId: 'gmail.users.settings.cse.identities.create';
        parameters: [
          {
            description: "The requester's primary email address. To indicate the authenticated user, you can use the special value `me`.";
            in: 'path';
            name: 'userId';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CseIdentity';
              };
            };
          };
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/CseIdentity';
                };
              };
            };
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.settings.basic'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.basic'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.settings.sharing'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.sharing'];
          },
        ];
        tags: ['users'];
      };
    };
    '/gmail/v1/users/{userId}/settings/cse/identities/{cseEmailAddress}': {
      delete: {
        description: 'Deletes a client-side encryption identity. The authenticated user can no longer use the identity to send encrypted messages. You cannot restore the identity after you delete it. Instead, use the CreateCseIdentity method to create another identity with the same configuration.';
        operationId: 'gmail.users.settings.cse.identities.delete';
        parameters: [
          {
            description: "The requester's primary email address. To indicate the authenticated user, you can use the special value `me`.";
            in: 'path';
            name: 'userId';
            required: true;
            schema: {
              type: 'string';
            };
          },
          {
            description: "The primary email address associated with the client-side encryption identity configuration that's removed.";
            in: 'path';
            name: 'cseEmailAddress';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.settings.basic'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.basic'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.settings.sharing'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.sharing'];
          },
        ];
        tags: ['users'];
      };
      get: {
        description: 'Retrieves a client-side encryption identity configuration.';
        operationId: 'gmail.users.settings.cse.identities.get';
        parameters: [
          {
            description: "The requester's primary email address. To indicate the authenticated user, you can use the special value `me`.";
            in: 'path';
            name: 'userId';
            required: true;
            schema: {
              type: 'string';
            };
          },
          {
            description: "The primary email address associated with the client-side encryption identity configuration that's retrieved.";
            in: 'path';
            name: 'cseEmailAddress';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/CseIdentity';
                };
              };
            };
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://mail.google.com/'];
            Oauth2c: ['https://mail.google.com/'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.modify'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.readonly'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.readonly'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.settings.basic'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.basic'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.settings.sharing'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.sharing'];
          },
        ];
        tags: ['users'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/_.xgafv';
        },
        {
          $ref: '#/components/parameters/access_token';
        },
        {
          $ref: '#/components/parameters/alt';
        },
        {
          $ref: '#/components/parameters/callback';
        },
        {
          $ref: '#/components/parameters/fields';
        },
        {
          $ref: '#/components/parameters/key';
        },
        {
          $ref: '#/components/parameters/oauth_token';
        },
        {
          $ref: '#/components/parameters/prettyPrint';
        },
        {
          $ref: '#/components/parameters/quotaUser';
        },
        {
          $ref: '#/components/parameters/upload_protocol';
        },
        {
          $ref: '#/components/parameters/uploadType';
        },
      ];
    };
    '/gmail/v1/users/{userId}/settings/cse/identities/{emailAddress}': {
      parameters: [
        {
          $ref: '#/components/parameters/_.xgafv';
        },
        {
          $ref: '#/components/parameters/access_token';
        },
        {
          $ref: '#/components/parameters/alt';
        },
        {
          $ref: '#/components/parameters/callback';
        },
        {
          $ref: '#/components/parameters/fields';
        },
        {
          $ref: '#/components/parameters/key';
        },
        {
          $ref: '#/components/parameters/oauth_token';
        },
        {
          $ref: '#/components/parameters/prettyPrint';
        },
        {
          $ref: '#/components/parameters/quotaUser';
        },
        {
          $ref: '#/components/parameters/upload_protocol';
        },
        {
          $ref: '#/components/parameters/uploadType';
        },
      ];
      patch: {
        description: "Associates a different key pair with an existing client-side encryption identity. The updated key pair must validate against Google's [S/MIME certificate profiles](https://support.google.com/a/answer/7300887).";
        operationId: 'gmail.users.settings.cse.identities.patch';
        parameters: [
          {
            description: "The requester's primary email address. To indicate the authenticated user, you can use the special value `me`.";
            in: 'path';
            name: 'userId';
            required: true;
            schema: {
              type: 'string';
            };
          },
          {
            description: 'The email address of the client-side encryption identity to update.';
            in: 'path';
            name: 'emailAddress';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CseIdentity';
              };
            };
          };
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/CseIdentity';
                };
              };
            };
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.settings.basic'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.basic'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.settings.sharing'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.sharing'];
          },
        ];
        tags: ['users'];
      };
    };
    '/gmail/v1/users/{userId}/settings/cse/keypairs': {
      get: {
        description: 'Lists client-side encryption key pairs for an authenticated user.';
        operationId: 'gmail.users.settings.cse.keypairs.list';
        parameters: [
          {
            description: "The requester's primary email address. To indicate the authenticated user, you can use the special value `me`.";
            in: 'path';
            name: 'userId';
            required: true;
            schema: {
              type: 'string';
            };
          },
          {
            description: 'The number of key pairs to return. If not provided, the page size will default to 20 entries.';
            in: 'query';
            name: 'pageSize';
            schema: {
              type: 'integer';
            };
          },
          {
            description: 'Pagination token indicating which page of key pairs to return. If the token is not supplied, then the API will return the first page of results.';
            in: 'query';
            name: 'pageToken';
            schema: {
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ListCseKeyPairsResponse';
                };
              };
            };
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://mail.google.com/'];
            Oauth2c: ['https://mail.google.com/'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.modify'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.readonly'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.readonly'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.settings.basic'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.basic'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.settings.sharing'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.sharing'];
          },
        ];
        tags: ['users'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/_.xgafv';
        },
        {
          $ref: '#/components/parameters/access_token';
        },
        {
          $ref: '#/components/parameters/alt';
        },
        {
          $ref: '#/components/parameters/callback';
        },
        {
          $ref: '#/components/parameters/fields';
        },
        {
          $ref: '#/components/parameters/key';
        },
        {
          $ref: '#/components/parameters/oauth_token';
        },
        {
          $ref: '#/components/parameters/prettyPrint';
        },
        {
          $ref: '#/components/parameters/quotaUser';
        },
        {
          $ref: '#/components/parameters/upload_protocol';
        },
        {
          $ref: '#/components/parameters/uploadType';
        },
      ];
      post: {
        description: 'Creates and uploads a client-side encryption S/MIME public key certificate chain and private key metadata for the authenticated user.';
        operationId: 'gmail.users.settings.cse.keypairs.create';
        parameters: [
          {
            description: "The requester's primary email address. To indicate the authenticated user, you can use the special value `me`.";
            in: 'path';
            name: 'userId';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CseKeyPair';
              };
            };
          };
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/CseKeyPair';
                };
              };
            };
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.settings.basic'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.basic'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.settings.sharing'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.sharing'];
          },
        ];
        tags: ['users'];
      };
    };
    '/gmail/v1/users/{userId}/settings/cse/keypairs/{keyPairId}': {
      get: {
        description: 'Retrieves an existing client-side encryption key pair.';
        operationId: 'gmail.users.settings.cse.keypairs.get';
        parameters: [
          {
            description: "The requester's primary email address. To indicate the authenticated user, you can use the special value `me`.";
            in: 'path';
            name: 'userId';
            required: true;
            schema: {
              type: 'string';
            };
          },
          {
            description: 'The identifier of the key pair to retrieve.';
            in: 'path';
            name: 'keyPairId';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/CseKeyPair';
                };
              };
            };
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://mail.google.com/'];
            Oauth2c: ['https://mail.google.com/'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.modify'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.readonly'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.readonly'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.settings.basic'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.basic'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.settings.sharing'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.sharing'];
          },
        ];
        tags: ['users'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/_.xgafv';
        },
        {
          $ref: '#/components/parameters/access_token';
        },
        {
          $ref: '#/components/parameters/alt';
        },
        {
          $ref: '#/components/parameters/callback';
        },
        {
          $ref: '#/components/parameters/fields';
        },
        {
          $ref: '#/components/parameters/key';
        },
        {
          $ref: '#/components/parameters/oauth_token';
        },
        {
          $ref: '#/components/parameters/prettyPrint';
        },
        {
          $ref: '#/components/parameters/quotaUser';
        },
        {
          $ref: '#/components/parameters/upload_protocol';
        },
        {
          $ref: '#/components/parameters/uploadType';
        },
      ];
    };
    '/gmail/v1/users/{userId}/settings/cse/keypairs/{keyPairId}:disable': {
      parameters: [
        {
          $ref: '#/components/parameters/_.xgafv';
        },
        {
          $ref: '#/components/parameters/access_token';
        },
        {
          $ref: '#/components/parameters/alt';
        },
        {
          $ref: '#/components/parameters/callback';
        },
        {
          $ref: '#/components/parameters/fields';
        },
        {
          $ref: '#/components/parameters/key';
        },
        {
          $ref: '#/components/parameters/oauth_token';
        },
        {
          $ref: '#/components/parameters/prettyPrint';
        },
        {
          $ref: '#/components/parameters/quotaUser';
        },
        {
          $ref: '#/components/parameters/upload_protocol';
        },
        {
          $ref: '#/components/parameters/uploadType';
        },
      ];
      post: {
        description: 'Turns off a client-side encryption key pair. The authenticated user can no longer use the key pair to decrypt incoming CSE message texts or sign outgoing CSE mail. To regain access, use the EnableCseKeyPair to turn on the key pair. After 30 days, you can permanently delete the key pair by using the ObliterateCseKeyPair method.';
        operationId: 'gmail.users.settings.cse.keypairs.disable';
        parameters: [
          {
            description: "The requester's primary email address. To indicate the authenticated user, you can use the special value `me`.";
            in: 'path';
            name: 'userId';
            required: true;
            schema: {
              type: 'string';
            };
          },
          {
            description: 'The identifier of the key pair to turn off.';
            in: 'path';
            name: 'keyPairId';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/DisableCseKeyPairRequest';
              };
            };
          };
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/CseKeyPair';
                };
              };
            };
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.settings.basic'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.basic'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.settings.sharing'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.sharing'];
          },
        ];
        tags: ['users'];
      };
    };
    '/gmail/v1/users/{userId}/settings/cse/keypairs/{keyPairId}:enable': {
      parameters: [
        {
          $ref: '#/components/parameters/_.xgafv';
        },
        {
          $ref: '#/components/parameters/access_token';
        },
        {
          $ref: '#/components/parameters/alt';
        },
        {
          $ref: '#/components/parameters/callback';
        },
        {
          $ref: '#/components/parameters/fields';
        },
        {
          $ref: '#/components/parameters/key';
        },
        {
          $ref: '#/components/parameters/oauth_token';
        },
        {
          $ref: '#/components/parameters/prettyPrint';
        },
        {
          $ref: '#/components/parameters/quotaUser';
        },
        {
          $ref: '#/components/parameters/upload_protocol';
        },
        {
          $ref: '#/components/parameters/uploadType';
        },
      ];
      post: {
        description: 'Turns on a client-side encryption key pair that was turned off. The key pair becomes active again for any associated client-side encryption identities.';
        operationId: 'gmail.users.settings.cse.keypairs.enable';
        parameters: [
          {
            description: "The requester's primary email address. To indicate the authenticated user, you can use the special value `me`.";
            in: 'path';
            name: 'userId';
            required: true;
            schema: {
              type: 'string';
            };
          },
          {
            description: 'The identifier of the key pair to turn on.';
            in: 'path';
            name: 'keyPairId';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/EnableCseKeyPairRequest';
              };
            };
          };
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/CseKeyPair';
                };
              };
            };
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.settings.basic'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.basic'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.settings.sharing'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.sharing'];
          },
        ];
        tags: ['users'];
      };
    };
    '/gmail/v1/users/{userId}/settings/cse/keypairs/{keyPairId}:obliterate': {
      parameters: [
        {
          $ref: '#/components/parameters/_.xgafv';
        },
        {
          $ref: '#/components/parameters/access_token';
        },
        {
          $ref: '#/components/parameters/alt';
        },
        {
          $ref: '#/components/parameters/callback';
        },
        {
          $ref: '#/components/parameters/fields';
        },
        {
          $ref: '#/components/parameters/key';
        },
        {
          $ref: '#/components/parameters/oauth_token';
        },
        {
          $ref: '#/components/parameters/prettyPrint';
        },
        {
          $ref: '#/components/parameters/quotaUser';
        },
        {
          $ref: '#/components/parameters/upload_protocol';
        },
        {
          $ref: '#/components/parameters/uploadType';
        },
      ];
      post: {
        description: "Deletes a client-side encryption key pair permanently and immediately. You can only permanently delete key pairs that have been turned off for more than 30 days. To turn off a key pair, use the DisableCseKeyPair method. Gmail can't restore or decrypt any messages that were encrypted by an obliterated key. Authenticated users and Google Workspace administrators lose access to reading the encrypted messages.";
        operationId: 'gmail.users.settings.cse.keypairs.obliterate';
        parameters: [
          {
            description: "The requester's primary email address. To indicate the authenticated user, you can use the special value `me`.";
            in: 'path';
            name: 'userId';
            required: true;
            schema: {
              type: 'string';
            };
          },
          {
            description: 'The identifier of the key pair to obliterate.';
            in: 'path';
            name: 'keyPairId';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ObliterateCseKeyPairRequest';
              };
            };
          };
        };
        responses: {
          '200': {
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.settings.basic'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.basic'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.settings.sharing'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.sharing'];
          },
        ];
        tags: ['users'];
      };
    };
    '/gmail/v1/users/{userId}/settings/delegates': {
      get: {
        description: 'Lists the delegates for the specified account. This method is only available to service account clients that have been delegated domain-wide authority.';
        operationId: 'gmail.users.settings.delegates.list';
        parameters: [
          {
            description: 'User\'s email address. The special value "me" can be used to indicate the authenticated user.';
            in: 'path';
            name: 'userId';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ListDelegatesResponse';
                };
              };
            };
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://mail.google.com/'];
            Oauth2c: ['https://mail.google.com/'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.modify'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.readonly'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.readonly'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.settings.basic'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.basic'];
          },
        ];
        tags: ['users'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/_.xgafv';
        },
        {
          $ref: '#/components/parameters/access_token';
        },
        {
          $ref: '#/components/parameters/alt';
        },
        {
          $ref: '#/components/parameters/callback';
        },
        {
          $ref: '#/components/parameters/fields';
        },
        {
          $ref: '#/components/parameters/key';
        },
        {
          $ref: '#/components/parameters/oauth_token';
        },
        {
          $ref: '#/components/parameters/prettyPrint';
        },
        {
          $ref: '#/components/parameters/quotaUser';
        },
        {
          $ref: '#/components/parameters/upload_protocol';
        },
        {
          $ref: '#/components/parameters/uploadType';
        },
      ];
      post: {
        description: 'Adds a delegate with its verification status set directly to `accepted`, without sending any verification email. The delegate user must be a member of the same Google Workspace organization as the delegator user. Gmail imposes limitations on the number of delegates and delegators each user in a Google Workspace organization can have. These limits depend on your organization, but in general each user can have up to 25 delegates and up to 10 delegators. Note that a delegate user must be referred to by their primary email address, and not an email alias. Also note that when a new delegate is created, there may be up to a one minute delay before the new delegate is available for use. This method is only available to service account clients that have been delegated domain-wide authority.';
        operationId: 'gmail.users.settings.delegates.create';
        parameters: [
          {
            description: 'User\'s email address. The special value "me" can be used to indicate the authenticated user.';
            in: 'path';
            name: 'userId';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Delegate';
              };
            };
          };
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Delegate';
                };
              };
            };
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.settings.sharing'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.sharing'];
          },
        ];
        tags: ['users'];
      };
    };
    '/gmail/v1/users/{userId}/settings/delegates/{delegateEmail}': {
      delete: {
        description: 'Removes the specified delegate (which can be of any verification status), and revokes any verification that may have been required for using it. Note that a delegate user must be referred to by their primary email address, and not an email alias. This method is only available to service account clients that have been delegated domain-wide authority.';
        operationId: 'gmail.users.settings.delegates.delete';
        parameters: [
          {
            description: 'User\'s email address. The special value "me" can be used to indicate the authenticated user.';
            in: 'path';
            name: 'userId';
            required: true;
            schema: {
              type: 'string';
            };
          },
          {
            description: 'The email address of the user to be removed as a delegate.';
            in: 'path';
            name: 'delegateEmail';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.settings.sharing'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.sharing'];
          },
        ];
        tags: ['users'];
      };
      get: {
        description: 'Gets the specified delegate. Note that a delegate user must be referred to by their primary email address, and not an email alias. This method is only available to service account clients that have been delegated domain-wide authority.';
        operationId: 'gmail.users.settings.delegates.get';
        parameters: [
          {
            description: 'User\'s email address. The special value "me" can be used to indicate the authenticated user.';
            in: 'path';
            name: 'userId';
            required: true;
            schema: {
              type: 'string';
            };
          },
          {
            description: 'The email address of the user whose delegate relationship is to be retrieved.';
            in: 'path';
            name: 'delegateEmail';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Delegate';
                };
              };
            };
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://mail.google.com/'];
            Oauth2c: ['https://mail.google.com/'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.modify'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.readonly'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.readonly'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.settings.basic'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.basic'];
          },
        ];
        tags: ['users'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/_.xgafv';
        },
        {
          $ref: '#/components/parameters/access_token';
        },
        {
          $ref: '#/components/parameters/alt';
        },
        {
          $ref: '#/components/parameters/callback';
        },
        {
          $ref: '#/components/parameters/fields';
        },
        {
          $ref: '#/components/parameters/key';
        },
        {
          $ref: '#/components/parameters/oauth_token';
        },
        {
          $ref: '#/components/parameters/prettyPrint';
        },
        {
          $ref: '#/components/parameters/quotaUser';
        },
        {
          $ref: '#/components/parameters/upload_protocol';
        },
        {
          $ref: '#/components/parameters/uploadType';
        },
      ];
    };
    '/gmail/v1/users/{userId}/settings/filters': {
      get: {
        description: 'Lists the message filters of a Gmail user.';
        operationId: 'gmail.users.settings.filters.list';
        parameters: [
          {
            description: 'User\'s email address. The special value "me" can be used to indicate the authenticated user.';
            in: 'path';
            name: 'userId';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ListFiltersResponse';
                };
              };
            };
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://mail.google.com/'];
            Oauth2c: ['https://mail.google.com/'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.modify'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.readonly'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.readonly'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.settings.basic'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.basic'];
          },
        ];
        tags: ['users'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/_.xgafv';
        },
        {
          $ref: '#/components/parameters/access_token';
        },
        {
          $ref: '#/components/parameters/alt';
        },
        {
          $ref: '#/components/parameters/callback';
        },
        {
          $ref: '#/components/parameters/fields';
        },
        {
          $ref: '#/components/parameters/key';
        },
        {
          $ref: '#/components/parameters/oauth_token';
        },
        {
          $ref: '#/components/parameters/prettyPrint';
        },
        {
          $ref: '#/components/parameters/quotaUser';
        },
        {
          $ref: '#/components/parameters/upload_protocol';
        },
        {
          $ref: '#/components/parameters/uploadType';
        },
      ];
      post: {
        description: 'Creates a filter. Note: you can only create a maximum of 1,000 filters.';
        operationId: 'gmail.users.settings.filters.create';
        parameters: [
          {
            description: 'User\'s email address. The special value "me" can be used to indicate the authenticated user.';
            in: 'path';
            name: 'userId';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Filter';
              };
            };
          };
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Filter';
                };
              };
            };
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.settings.basic'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.basic'];
          },
        ];
        tags: ['users'];
      };
    };
    '/gmail/v1/users/{userId}/settings/filters/{id}': {
      delete: {
        description: 'Immediately and permanently deletes the specified filter.';
        operationId: 'gmail.users.settings.filters.delete';
        parameters: [
          {
            description: 'User\'s email address. The special value "me" can be used to indicate the authenticated user.';
            in: 'path';
            name: 'userId';
            required: true;
            schema: {
              type: 'string';
            };
          },
          {
            description: 'The ID of the filter to be deleted.';
            in: 'path';
            name: 'id';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.settings.basic'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.basic'];
          },
        ];
        tags: ['users'];
      };
      get: {
        description: 'Gets a filter.';
        operationId: 'gmail.users.settings.filters.get';
        parameters: [
          {
            description: 'User\'s email address. The special value "me" can be used to indicate the authenticated user.';
            in: 'path';
            name: 'userId';
            required: true;
            schema: {
              type: 'string';
            };
          },
          {
            description: 'The ID of the filter to be fetched.';
            in: 'path';
            name: 'id';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Filter';
                };
              };
            };
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://mail.google.com/'];
            Oauth2c: ['https://mail.google.com/'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.modify'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.readonly'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.readonly'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.settings.basic'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.basic'];
          },
        ];
        tags: ['users'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/_.xgafv';
        },
        {
          $ref: '#/components/parameters/access_token';
        },
        {
          $ref: '#/components/parameters/alt';
        },
        {
          $ref: '#/components/parameters/callback';
        },
        {
          $ref: '#/components/parameters/fields';
        },
        {
          $ref: '#/components/parameters/key';
        },
        {
          $ref: '#/components/parameters/oauth_token';
        },
        {
          $ref: '#/components/parameters/prettyPrint';
        },
        {
          $ref: '#/components/parameters/quotaUser';
        },
        {
          $ref: '#/components/parameters/upload_protocol';
        },
        {
          $ref: '#/components/parameters/uploadType';
        },
      ];
    };
    '/gmail/v1/users/{userId}/settings/forwardingAddresses': {
      get: {
        description: 'Lists the forwarding addresses for the specified account.';
        operationId: 'gmail.users.settings.forwardingAddresses.list';
        parameters: [
          {
            description: 'User\'s email address. The special value "me" can be used to indicate the authenticated user.';
            in: 'path';
            name: 'userId';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ListForwardingAddressesResponse';
                };
              };
            };
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://mail.google.com/'];
            Oauth2c: ['https://mail.google.com/'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.modify'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.readonly'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.readonly'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.settings.basic'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.basic'];
          },
        ];
        tags: ['users'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/_.xgafv';
        },
        {
          $ref: '#/components/parameters/access_token';
        },
        {
          $ref: '#/components/parameters/alt';
        },
        {
          $ref: '#/components/parameters/callback';
        },
        {
          $ref: '#/components/parameters/fields';
        },
        {
          $ref: '#/components/parameters/key';
        },
        {
          $ref: '#/components/parameters/oauth_token';
        },
        {
          $ref: '#/components/parameters/prettyPrint';
        },
        {
          $ref: '#/components/parameters/quotaUser';
        },
        {
          $ref: '#/components/parameters/upload_protocol';
        },
        {
          $ref: '#/components/parameters/uploadType';
        },
      ];
      post: {
        description: "Creates a forwarding address. If ownership verification is required, a message will be sent to the recipient and the resource's verification status will be set to `pending`; otherwise, the resource will be created with verification status set to `accepted`. This method is only available to service account clients that have been delegated domain-wide authority.";
        operationId: 'gmail.users.settings.forwardingAddresses.create';
        parameters: [
          {
            description: 'User\'s email address. The special value "me" can be used to indicate the authenticated user.';
            in: 'path';
            name: 'userId';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ForwardingAddress';
              };
            };
          };
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ForwardingAddress';
                };
              };
            };
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.settings.sharing'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.sharing'];
          },
        ];
        tags: ['users'];
      };
    };
    '/gmail/v1/users/{userId}/settings/forwardingAddresses/{forwardingEmail}': {
      delete: {
        description: 'Deletes the specified forwarding address and revokes any verification that may have been required. This method is only available to service account clients that have been delegated domain-wide authority.';
        operationId: 'gmail.users.settings.forwardingAddresses.delete';
        parameters: [
          {
            description: 'User\'s email address. The special value "me" can be used to indicate the authenticated user.';
            in: 'path';
            name: 'userId';
            required: true;
            schema: {
              type: 'string';
            };
          },
          {
            description: 'The forwarding address to be deleted.';
            in: 'path';
            name: 'forwardingEmail';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.settings.sharing'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.sharing'];
          },
        ];
        tags: ['users'];
      };
      get: {
        description: 'Gets the specified forwarding address.';
        operationId: 'gmail.users.settings.forwardingAddresses.get';
        parameters: [
          {
            description: 'User\'s email address. The special value "me" can be used to indicate the authenticated user.';
            in: 'path';
            name: 'userId';
            required: true;
            schema: {
              type: 'string';
            };
          },
          {
            description: 'The forwarding address to be retrieved.';
            in: 'path';
            name: 'forwardingEmail';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ForwardingAddress';
                };
              };
            };
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://mail.google.com/'];
            Oauth2c: ['https://mail.google.com/'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.modify'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.readonly'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.readonly'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.settings.basic'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.basic'];
          },
        ];
        tags: ['users'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/_.xgafv';
        },
        {
          $ref: '#/components/parameters/access_token';
        },
        {
          $ref: '#/components/parameters/alt';
        },
        {
          $ref: '#/components/parameters/callback';
        },
        {
          $ref: '#/components/parameters/fields';
        },
        {
          $ref: '#/components/parameters/key';
        },
        {
          $ref: '#/components/parameters/oauth_token';
        },
        {
          $ref: '#/components/parameters/prettyPrint';
        },
        {
          $ref: '#/components/parameters/quotaUser';
        },
        {
          $ref: '#/components/parameters/upload_protocol';
        },
        {
          $ref: '#/components/parameters/uploadType';
        },
      ];
    };
    '/gmail/v1/users/{userId}/settings/imap': {
      get: {
        description: 'Gets IMAP settings.';
        operationId: 'gmail.users.settings.getImap';
        parameters: [
          {
            description: 'User\'s email address. The special value "me" can be used to indicate the authenticated user.';
            in: 'path';
            name: 'userId';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ImapSettings';
                };
              };
            };
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://mail.google.com/'];
            Oauth2c: ['https://mail.google.com/'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.modify'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.readonly'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.readonly'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.settings.basic'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.basic'];
          },
        ];
        tags: ['users'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/_.xgafv';
        },
        {
          $ref: '#/components/parameters/access_token';
        },
        {
          $ref: '#/components/parameters/alt';
        },
        {
          $ref: '#/components/parameters/callback';
        },
        {
          $ref: '#/components/parameters/fields';
        },
        {
          $ref: '#/components/parameters/key';
        },
        {
          $ref: '#/components/parameters/oauth_token';
        },
        {
          $ref: '#/components/parameters/prettyPrint';
        },
        {
          $ref: '#/components/parameters/quotaUser';
        },
        {
          $ref: '#/components/parameters/upload_protocol';
        },
        {
          $ref: '#/components/parameters/uploadType';
        },
      ];
      put: {
        description: 'Updates IMAP settings.';
        operationId: 'gmail.users.settings.updateImap';
        parameters: [
          {
            description: 'User\'s email address. The special value "me" can be used to indicate the authenticated user.';
            in: 'path';
            name: 'userId';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ImapSettings';
              };
            };
          };
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ImapSettings';
                };
              };
            };
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.settings.basic'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.basic'];
          },
        ];
        tags: ['users'];
      };
    };
    '/gmail/v1/users/{userId}/settings/language': {
      get: {
        description: 'Gets language settings.';
        operationId: 'gmail.users.settings.getLanguage';
        parameters: [
          {
            description: 'User\'s email address. The special value "me" can be used to indicate the authenticated user.';
            in: 'path';
            name: 'userId';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/LanguageSettings';
                };
              };
            };
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://mail.google.com/'];
            Oauth2c: ['https://mail.google.com/'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.modify'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.readonly'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.readonly'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.settings.basic'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.basic'];
          },
        ];
        tags: ['users'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/_.xgafv';
        },
        {
          $ref: '#/components/parameters/access_token';
        },
        {
          $ref: '#/components/parameters/alt';
        },
        {
          $ref: '#/components/parameters/callback';
        },
        {
          $ref: '#/components/parameters/fields';
        },
        {
          $ref: '#/components/parameters/key';
        },
        {
          $ref: '#/components/parameters/oauth_token';
        },
        {
          $ref: '#/components/parameters/prettyPrint';
        },
        {
          $ref: '#/components/parameters/quotaUser';
        },
        {
          $ref: '#/components/parameters/upload_protocol';
        },
        {
          $ref: '#/components/parameters/uploadType';
        },
      ];
      put: {
        description: 'Updates language settings. If successful, the return object contains the `displayLanguage` that was saved for the user, which may differ from the value passed into the request. This is because the requested `displayLanguage` may not be directly supported by Gmail but have a close variant that is, and so the variant may be chosen and saved instead.';
        operationId: 'gmail.users.settings.updateLanguage';
        parameters: [
          {
            description: 'User\'s email address. The special value "me" can be used to indicate the authenticated user.';
            in: 'path';
            name: 'userId';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/LanguageSettings';
              };
            };
          };
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/LanguageSettings';
                };
              };
            };
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.settings.basic'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.basic'];
          },
        ];
        tags: ['users'];
      };
    };
    '/gmail/v1/users/{userId}/settings/pop': {
      get: {
        description: 'Gets POP settings.';
        operationId: 'gmail.users.settings.getPop';
        parameters: [
          {
            description: 'User\'s email address. The special value "me" can be used to indicate the authenticated user.';
            in: 'path';
            name: 'userId';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/PopSettings';
                };
              };
            };
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://mail.google.com/'];
            Oauth2c: ['https://mail.google.com/'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.modify'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.readonly'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.readonly'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.settings.basic'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.basic'];
          },
        ];
        tags: ['users'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/_.xgafv';
        },
        {
          $ref: '#/components/parameters/access_token';
        },
        {
          $ref: '#/components/parameters/alt';
        },
        {
          $ref: '#/components/parameters/callback';
        },
        {
          $ref: '#/components/parameters/fields';
        },
        {
          $ref: '#/components/parameters/key';
        },
        {
          $ref: '#/components/parameters/oauth_token';
        },
        {
          $ref: '#/components/parameters/prettyPrint';
        },
        {
          $ref: '#/components/parameters/quotaUser';
        },
        {
          $ref: '#/components/parameters/upload_protocol';
        },
        {
          $ref: '#/components/parameters/uploadType';
        },
      ];
      put: {
        description: 'Updates POP settings.';
        operationId: 'gmail.users.settings.updatePop';
        parameters: [
          {
            description: 'User\'s email address. The special value "me" can be used to indicate the authenticated user.';
            in: 'path';
            name: 'userId';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PopSettings';
              };
            };
          };
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/PopSettings';
                };
              };
            };
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.settings.basic'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.basic'];
          },
        ];
        tags: ['users'];
      };
    };
    '/gmail/v1/users/{userId}/settings/sendAs': {
      get: {
        description: 'Lists the send-as aliases for the specified account. The result includes the primary send-as address associated with the account as well as any custom "from" aliases.';
        operationId: 'gmail.users.settings.sendAs.list';
        parameters: [
          {
            description: 'User\'s email address. The special value "me" can be used to indicate the authenticated user.';
            in: 'path';
            name: 'userId';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ListSendAsResponse';
                };
              };
            };
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://mail.google.com/'];
            Oauth2c: ['https://mail.google.com/'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.modify'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.readonly'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.readonly'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.settings.basic'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.basic'];
          },
        ];
        tags: ['users'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/_.xgafv';
        },
        {
          $ref: '#/components/parameters/access_token';
        },
        {
          $ref: '#/components/parameters/alt';
        },
        {
          $ref: '#/components/parameters/callback';
        },
        {
          $ref: '#/components/parameters/fields';
        },
        {
          $ref: '#/components/parameters/key';
        },
        {
          $ref: '#/components/parameters/oauth_token';
        },
        {
          $ref: '#/components/parameters/prettyPrint';
        },
        {
          $ref: '#/components/parameters/quotaUser';
        },
        {
          $ref: '#/components/parameters/upload_protocol';
        },
        {
          $ref: '#/components/parameters/uploadType';
        },
      ];
      post: {
        description: 'Creates a custom "from" send-as alias. If an SMTP MSA is specified, Gmail will attempt to connect to the SMTP service to validate the configuration before creating the alias. If ownership verification is required for the alias, a message will be sent to the email address and the resource\'s verification status will be set to `pending`; otherwise, the resource will be created with verification status set to `accepted`. If a signature is provided, Gmail will sanitize the HTML before saving it with the alias. This method is only available to service account clients that have been delegated domain-wide authority.';
        operationId: 'gmail.users.settings.sendAs.create';
        parameters: [
          {
            description: 'User\'s email address. The special value "me" can be used to indicate the authenticated user.';
            in: 'path';
            name: 'userId';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/SendAs';
              };
            };
          };
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/SendAs';
                };
              };
            };
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.settings.sharing'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.sharing'];
          },
        ];
        tags: ['users'];
      };
    };
    '/gmail/v1/users/{userId}/settings/sendAs/{sendAsEmail}': {
      delete: {
        description: 'Deletes the specified send-as alias. Revokes any verification that may have been required for using it. This method is only available to service account clients that have been delegated domain-wide authority.';
        operationId: 'gmail.users.settings.sendAs.delete';
        parameters: [
          {
            description: 'User\'s email address. The special value "me" can be used to indicate the authenticated user.';
            in: 'path';
            name: 'userId';
            required: true;
            schema: {
              type: 'string';
            };
          },
          {
            description: 'The send-as alias to be deleted.';
            in: 'path';
            name: 'sendAsEmail';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.settings.sharing'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.sharing'];
          },
        ];
        tags: ['users'];
      };
      get: {
        description: 'Gets the specified send-as alias. Fails with an HTTP 404 error if the specified address is not a member of the collection.';
        operationId: 'gmail.users.settings.sendAs.get';
        parameters: [
          {
            description: 'User\'s email address. The special value "me" can be used to indicate the authenticated user.';
            in: 'path';
            name: 'userId';
            required: true;
            schema: {
              type: 'string';
            };
          },
          {
            description: 'The send-as alias to be retrieved.';
            in: 'path';
            name: 'sendAsEmail';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/SendAs';
                };
              };
            };
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://mail.google.com/'];
            Oauth2c: ['https://mail.google.com/'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.modify'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.readonly'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.readonly'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.settings.basic'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.basic'];
          },
        ];
        tags: ['users'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/_.xgafv';
        },
        {
          $ref: '#/components/parameters/access_token';
        },
        {
          $ref: '#/components/parameters/alt';
        },
        {
          $ref: '#/components/parameters/callback';
        },
        {
          $ref: '#/components/parameters/fields';
        },
        {
          $ref: '#/components/parameters/key';
        },
        {
          $ref: '#/components/parameters/oauth_token';
        },
        {
          $ref: '#/components/parameters/prettyPrint';
        },
        {
          $ref: '#/components/parameters/quotaUser';
        },
        {
          $ref: '#/components/parameters/upload_protocol';
        },
        {
          $ref: '#/components/parameters/uploadType';
        },
      ];
      patch: {
        description: 'Patch the specified send-as alias.';
        operationId: 'gmail.users.settings.sendAs.patch';
        parameters: [
          {
            description: 'User\'s email address. The special value "me" can be used to indicate the authenticated user.';
            in: 'path';
            name: 'userId';
            required: true;
            schema: {
              type: 'string';
            };
          },
          {
            description: 'The send-as alias to be updated.';
            in: 'path';
            name: 'sendAsEmail';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/SendAs';
              };
            };
          };
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/SendAs';
                };
              };
            };
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.settings.basic'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.basic'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.settings.sharing'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.sharing'];
          },
        ];
        tags: ['users'];
      };
      put: {
        description: 'Updates a send-as alias. If a signature is provided, Gmail will sanitize the HTML before saving it with the alias. Addresses other than the primary address for the account can only be updated by service account clients that have been delegated domain-wide authority.';
        operationId: 'gmail.users.settings.sendAs.update';
        parameters: [
          {
            description: 'User\'s email address. The special value "me" can be used to indicate the authenticated user.';
            in: 'path';
            name: 'userId';
            required: true;
            schema: {
              type: 'string';
            };
          },
          {
            description: 'The send-as alias to be updated.';
            in: 'path';
            name: 'sendAsEmail';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/SendAs';
              };
            };
          };
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/SendAs';
                };
              };
            };
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.settings.basic'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.basic'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.settings.sharing'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.sharing'];
          },
        ];
        tags: ['users'];
      };
    };
    '/gmail/v1/users/{userId}/settings/sendAs/{sendAsEmail}/smimeInfo': {
      get: {
        description: 'Lists S/MIME configs for the specified send-as alias.';
        operationId: 'gmail.users.settings.sendAs.smimeInfo.list';
        parameters: [
          {
            description: "The user's email address. The special value `me` can be used to indicate the authenticated user.";
            in: 'path';
            name: 'userId';
            required: true;
            schema: {
              type: 'string';
            };
          },
          {
            description: 'The email address that appears in the "From:" header for mail sent using this alias.';
            in: 'path';
            name: 'sendAsEmail';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ListSmimeInfoResponse';
                };
              };
            };
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://mail.google.com/'];
            Oauth2c: ['https://mail.google.com/'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.modify'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.readonly'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.readonly'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.settings.basic'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.basic'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.settings.sharing'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.sharing'];
          },
        ];
        tags: ['users'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/_.xgafv';
        },
        {
          $ref: '#/components/parameters/access_token';
        },
        {
          $ref: '#/components/parameters/alt';
        },
        {
          $ref: '#/components/parameters/callback';
        },
        {
          $ref: '#/components/parameters/fields';
        },
        {
          $ref: '#/components/parameters/key';
        },
        {
          $ref: '#/components/parameters/oauth_token';
        },
        {
          $ref: '#/components/parameters/prettyPrint';
        },
        {
          $ref: '#/components/parameters/quotaUser';
        },
        {
          $ref: '#/components/parameters/upload_protocol';
        },
        {
          $ref: '#/components/parameters/uploadType';
        },
      ];
      post: {
        description: 'Insert (upload) the given S/MIME config for the specified send-as alias. Note that pkcs12 format is required for the key.';
        operationId: 'gmail.users.settings.sendAs.smimeInfo.insert';
        parameters: [
          {
            description: "The user's email address. The special value `me` can be used to indicate the authenticated user.";
            in: 'path';
            name: 'userId';
            required: true;
            schema: {
              type: 'string';
            };
          },
          {
            description: 'The email address that appears in the "From:" header for mail sent using this alias.';
            in: 'path';
            name: 'sendAsEmail';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/SmimeInfo';
              };
            };
          };
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/SmimeInfo';
                };
              };
            };
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.settings.basic'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.basic'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.settings.sharing'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.sharing'];
          },
        ];
        tags: ['users'];
      };
    };
    '/gmail/v1/users/{userId}/settings/sendAs/{sendAsEmail}/smimeInfo/{id}': {
      delete: {
        description: 'Deletes the specified S/MIME config for the specified send-as alias.';
        operationId: 'gmail.users.settings.sendAs.smimeInfo.delete';
        parameters: [
          {
            description: "The user's email address. The special value `me` can be used to indicate the authenticated user.";
            in: 'path';
            name: 'userId';
            required: true;
            schema: {
              type: 'string';
            };
          },
          {
            description: 'The email address that appears in the "From:" header for mail sent using this alias.';
            in: 'path';
            name: 'sendAsEmail';
            required: true;
            schema: {
              type: 'string';
            };
          },
          {
            description: 'The immutable ID for the SmimeInfo.';
            in: 'path';
            name: 'id';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.settings.basic'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.basic'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.settings.sharing'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.sharing'];
          },
        ];
        tags: ['users'];
      };
      get: {
        description: 'Gets the specified S/MIME config for the specified send-as alias.';
        operationId: 'gmail.users.settings.sendAs.smimeInfo.get';
        parameters: [
          {
            description: "The user's email address. The special value `me` can be used to indicate the authenticated user.";
            in: 'path';
            name: 'userId';
            required: true;
            schema: {
              type: 'string';
            };
          },
          {
            description: 'The email address that appears in the "From:" header for mail sent using this alias.';
            in: 'path';
            name: 'sendAsEmail';
            required: true;
            schema: {
              type: 'string';
            };
          },
          {
            description: 'The immutable ID for the SmimeInfo.';
            in: 'path';
            name: 'id';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/SmimeInfo';
                };
              };
            };
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://mail.google.com/'];
            Oauth2c: ['https://mail.google.com/'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.modify'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.readonly'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.readonly'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.settings.basic'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.basic'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.settings.sharing'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.sharing'];
          },
        ];
        tags: ['users'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/_.xgafv';
        },
        {
          $ref: '#/components/parameters/access_token';
        },
        {
          $ref: '#/components/parameters/alt';
        },
        {
          $ref: '#/components/parameters/callback';
        },
        {
          $ref: '#/components/parameters/fields';
        },
        {
          $ref: '#/components/parameters/key';
        },
        {
          $ref: '#/components/parameters/oauth_token';
        },
        {
          $ref: '#/components/parameters/prettyPrint';
        },
        {
          $ref: '#/components/parameters/quotaUser';
        },
        {
          $ref: '#/components/parameters/upload_protocol';
        },
        {
          $ref: '#/components/parameters/uploadType';
        },
      ];
    };
    '/gmail/v1/users/{userId}/settings/sendAs/{sendAsEmail}/smimeInfo/{id}/setDefault': {
      parameters: [
        {
          $ref: '#/components/parameters/_.xgafv';
        },
        {
          $ref: '#/components/parameters/access_token';
        },
        {
          $ref: '#/components/parameters/alt';
        },
        {
          $ref: '#/components/parameters/callback';
        },
        {
          $ref: '#/components/parameters/fields';
        },
        {
          $ref: '#/components/parameters/key';
        },
        {
          $ref: '#/components/parameters/oauth_token';
        },
        {
          $ref: '#/components/parameters/prettyPrint';
        },
        {
          $ref: '#/components/parameters/quotaUser';
        },
        {
          $ref: '#/components/parameters/upload_protocol';
        },
        {
          $ref: '#/components/parameters/uploadType';
        },
      ];
      post: {
        description: 'Sets the default S/MIME config for the specified send-as alias.';
        operationId: 'gmail.users.settings.sendAs.smimeInfo.setDefault';
        parameters: [
          {
            description: "The user's email address. The special value `me` can be used to indicate the authenticated user.";
            in: 'path';
            name: 'userId';
            required: true;
            schema: {
              type: 'string';
            };
          },
          {
            description: 'The email address that appears in the "From:" header for mail sent using this alias.';
            in: 'path';
            name: 'sendAsEmail';
            required: true;
            schema: {
              type: 'string';
            };
          },
          {
            description: 'The immutable ID for the SmimeInfo.';
            in: 'path';
            name: 'id';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.settings.basic'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.basic'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.settings.sharing'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.sharing'];
          },
        ];
        tags: ['users'];
      };
    };
    '/gmail/v1/users/{userId}/settings/sendAs/{sendAsEmail}/verify': {
      parameters: [
        {
          $ref: '#/components/parameters/_.xgafv';
        },
        {
          $ref: '#/components/parameters/access_token';
        },
        {
          $ref: '#/components/parameters/alt';
        },
        {
          $ref: '#/components/parameters/callback';
        },
        {
          $ref: '#/components/parameters/fields';
        },
        {
          $ref: '#/components/parameters/key';
        },
        {
          $ref: '#/components/parameters/oauth_token';
        },
        {
          $ref: '#/components/parameters/prettyPrint';
        },
        {
          $ref: '#/components/parameters/quotaUser';
        },
        {
          $ref: '#/components/parameters/upload_protocol';
        },
        {
          $ref: '#/components/parameters/uploadType';
        },
      ];
      post: {
        description: 'Sends a verification email to the specified send-as alias address. The verification status must be `pending`. This method is only available to service account clients that have been delegated domain-wide authority.';
        operationId: 'gmail.users.settings.sendAs.verify';
        parameters: [
          {
            description: 'User\'s email address. The special value "me" can be used to indicate the authenticated user.';
            in: 'path';
            name: 'userId';
            required: true;
            schema: {
              type: 'string';
            };
          },
          {
            description: 'The send-as alias to be verified.';
            in: 'path';
            name: 'sendAsEmail';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.settings.sharing'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.sharing'];
          },
        ];
        tags: ['users'];
      };
    };
    '/gmail/v1/users/{userId}/settings/vacation': {
      get: {
        description: 'Gets vacation responder settings.';
        operationId: 'gmail.users.settings.getVacation';
        parameters: [
          {
            description: 'User\'s email address. The special value "me" can be used to indicate the authenticated user.';
            in: 'path';
            name: 'userId';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/VacationSettings';
                };
              };
            };
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://mail.google.com/'];
            Oauth2c: ['https://mail.google.com/'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.modify'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.readonly'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.readonly'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.settings.basic'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.basic'];
          },
        ];
        tags: ['users'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/_.xgafv';
        },
        {
          $ref: '#/components/parameters/access_token';
        },
        {
          $ref: '#/components/parameters/alt';
        },
        {
          $ref: '#/components/parameters/callback';
        },
        {
          $ref: '#/components/parameters/fields';
        },
        {
          $ref: '#/components/parameters/key';
        },
        {
          $ref: '#/components/parameters/oauth_token';
        },
        {
          $ref: '#/components/parameters/prettyPrint';
        },
        {
          $ref: '#/components/parameters/quotaUser';
        },
        {
          $ref: '#/components/parameters/upload_protocol';
        },
        {
          $ref: '#/components/parameters/uploadType';
        },
      ];
      put: {
        description: 'Updates vacation responder settings.';
        operationId: 'gmail.users.settings.updateVacation';
        parameters: [
          {
            description: 'User\'s email address. The special value "me" can be used to indicate the authenticated user.';
            in: 'path';
            name: 'userId';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/VacationSettings';
              };
            };
          };
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/VacationSettings';
                };
              };
            };
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.settings.basic'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.basic'];
          },
        ];
        tags: ['users'];
      };
    };
    '/gmail/v1/users/{userId}/stop': {
      parameters: [
        {
          $ref: '#/components/parameters/_.xgafv';
        },
        {
          $ref: '#/components/parameters/access_token';
        },
        {
          $ref: '#/components/parameters/alt';
        },
        {
          $ref: '#/components/parameters/callback';
        },
        {
          $ref: '#/components/parameters/fields';
        },
        {
          $ref: '#/components/parameters/key';
        },
        {
          $ref: '#/components/parameters/oauth_token';
        },
        {
          $ref: '#/components/parameters/prettyPrint';
        },
        {
          $ref: '#/components/parameters/quotaUser';
        },
        {
          $ref: '#/components/parameters/upload_protocol';
        },
        {
          $ref: '#/components/parameters/uploadType';
        },
      ];
      post: {
        description: 'Stop receiving push notifications for the given user mailbox.';
        operationId: 'gmail.users.stop';
        parameters: [
          {
            description: "The user's email address. The special value `me` can be used to indicate the authenticated user.";
            in: 'path';
            name: 'userId';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://mail.google.com/'];
            Oauth2c: ['https://mail.google.com/'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.metadata'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.metadata'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.modify'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.readonly'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.readonly'];
          },
        ];
        tags: ['users'];
      };
    };
    '/gmail/v1/users/{userId}/threads': {
      get: {
        description: "Lists the threads in the user's mailbox.";
        operationId: 'gmail.users.threads.list';
        parameters: [
          {
            description: "The user's email address. The special value `me` can be used to indicate the authenticated user.";
            in: 'path';
            name: 'userId';
            required: true;
            schema: {
              type: 'string';
            };
          },
          {
            description: 'Include threads from `SPAM` and `TRASH` in the results.';
            in: 'query';
            name: 'includeSpamTrash';
            schema: {
              type: 'boolean';
            };
          },
          {
            description: 'Only return threads with labels that match all of the specified label IDs.';
            explode: true;
            in: 'query';
            name: 'labelIds';
            schema: {
              items: {
                type: 'string';
              };
              type: 'array';
            };
            style: 'form';
          },
          {
            description: 'Maximum number of threads to return. This field defaults to 100. The maximum allowed value for this field is 500.';
            in: 'query';
            name: 'maxResults';
            schema: {
              type: 'integer';
            };
          },
          {
            description: 'Page token to retrieve a specific page of results in the list.';
            in: 'query';
            name: 'pageToken';
            schema: {
              type: 'string';
            };
          },
          {
            description: 'Only return threads matching the specified query. Supports the same query format as the Gmail search box. For example, `"from:someuser@example.com rfc822msgid: is:unread"`. Parameter cannot be used when accessing the api using the gmail.metadata scope.';
            in: 'query';
            name: 'q';
            schema: {
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ListThreadsResponse';
                };
              };
            };
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://mail.google.com/'];
            Oauth2c: ['https://mail.google.com/'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.metadata'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.metadata'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.modify'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.readonly'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.readonly'];
          },
        ];
        tags: ['users'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/_.xgafv';
        },
        {
          $ref: '#/components/parameters/access_token';
        },
        {
          $ref: '#/components/parameters/alt';
        },
        {
          $ref: '#/components/parameters/callback';
        },
        {
          $ref: '#/components/parameters/fields';
        },
        {
          $ref: '#/components/parameters/key';
        },
        {
          $ref: '#/components/parameters/oauth_token';
        },
        {
          $ref: '#/components/parameters/prettyPrint';
        },
        {
          $ref: '#/components/parameters/quotaUser';
        },
        {
          $ref: '#/components/parameters/upload_protocol';
        },
        {
          $ref: '#/components/parameters/uploadType';
        },
      ];
    };
    '/gmail/v1/users/{userId}/threads/{id}': {
      delete: {
        description: 'Immediately and permanently deletes the specified thread. Any messages that belong to the thread are also deleted. This operation cannot be undone. Prefer `threads.trash` instead.';
        operationId: 'gmail.users.threads.delete';
        parameters: [
          {
            description: "The user's email address. The special value `me` can be used to indicate the authenticated user.";
            in: 'path';
            name: 'userId';
            required: true;
            schema: {
              type: 'string';
            };
          },
          {
            description: 'ID of the Thread to delete.';
            in: 'path';
            name: 'id';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://mail.google.com/'];
            Oauth2c: ['https://mail.google.com/'];
          },
        ];
        tags: ['users'];
      };
      get: {
        description: 'Gets the specified thread.';
        operationId: 'gmail.users.threads.get';
        parameters: [
          {
            description: "The user's email address. The special value `me` can be used to indicate the authenticated user.";
            in: 'path';
            name: 'userId';
            required: true;
            schema: {
              type: 'string';
            };
          },
          {
            description: 'The ID of the thread to retrieve.';
            in: 'path';
            name: 'id';
            required: true;
            schema: {
              type: 'string';
            };
          },
          {
            description: 'The format to return the messages in.';
            in: 'query';
            name: 'format';
            schema: {
              enum: ['full', 'metadata', 'minimal'];
              type: 'string';
            };
          },
          {
            description: 'When given and format is METADATA, only include headers specified.';
            explode: true;
            in: 'query';
            name: 'metadataHeaders';
            schema: {
              items: {
                type: 'string';
              };
              type: 'array';
            };
            style: 'form';
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Thread';
                };
              };
            };
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://mail.google.com/'];
            Oauth2c: ['https://mail.google.com/'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.addons.current.message.action'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.addons.current.message.action'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.addons.current.message.metadata'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.addons.current.message.metadata'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.addons.current.message.readonly'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.addons.current.message.readonly'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.metadata'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.metadata'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.modify'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.readonly'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.readonly'];
          },
        ];
        tags: ['users'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/_.xgafv';
        },
        {
          $ref: '#/components/parameters/access_token';
        },
        {
          $ref: '#/components/parameters/alt';
        },
        {
          $ref: '#/components/parameters/callback';
        },
        {
          $ref: '#/components/parameters/fields';
        },
        {
          $ref: '#/components/parameters/key';
        },
        {
          $ref: '#/components/parameters/oauth_token';
        },
        {
          $ref: '#/components/parameters/prettyPrint';
        },
        {
          $ref: '#/components/parameters/quotaUser';
        },
        {
          $ref: '#/components/parameters/upload_protocol';
        },
        {
          $ref: '#/components/parameters/uploadType';
        },
      ];
    };
    '/gmail/v1/users/{userId}/threads/{id}/modify': {
      parameters: [
        {
          $ref: '#/components/parameters/_.xgafv';
        },
        {
          $ref: '#/components/parameters/access_token';
        },
        {
          $ref: '#/components/parameters/alt';
        },
        {
          $ref: '#/components/parameters/callback';
        },
        {
          $ref: '#/components/parameters/fields';
        },
        {
          $ref: '#/components/parameters/key';
        },
        {
          $ref: '#/components/parameters/oauth_token';
        },
        {
          $ref: '#/components/parameters/prettyPrint';
        },
        {
          $ref: '#/components/parameters/quotaUser';
        },
        {
          $ref: '#/components/parameters/upload_protocol';
        },
        {
          $ref: '#/components/parameters/uploadType';
        },
      ];
      post: {
        description: 'Modifies the labels applied to the thread. This applies to all messages in the thread.';
        operationId: 'gmail.users.threads.modify';
        parameters: [
          {
            description: "The user's email address. The special value `me` can be used to indicate the authenticated user.";
            in: 'path';
            name: 'userId';
            required: true;
            schema: {
              type: 'string';
            };
          },
          {
            description: 'The ID of the thread to modify.';
            in: 'path';
            name: 'id';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ModifyThreadRequest';
              };
            };
          };
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Thread';
                };
              };
            };
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://mail.google.com/'];
            Oauth2c: ['https://mail.google.com/'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.modify'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'];
          },
        ];
        tags: ['users'];
      };
    };
    '/gmail/v1/users/{userId}/threads/{id}/trash': {
      parameters: [
        {
          $ref: '#/components/parameters/_.xgafv';
        },
        {
          $ref: '#/components/parameters/access_token';
        },
        {
          $ref: '#/components/parameters/alt';
        },
        {
          $ref: '#/components/parameters/callback';
        },
        {
          $ref: '#/components/parameters/fields';
        },
        {
          $ref: '#/components/parameters/key';
        },
        {
          $ref: '#/components/parameters/oauth_token';
        },
        {
          $ref: '#/components/parameters/prettyPrint';
        },
        {
          $ref: '#/components/parameters/quotaUser';
        },
        {
          $ref: '#/components/parameters/upload_protocol';
        },
        {
          $ref: '#/components/parameters/uploadType';
        },
      ];
      post: {
        description: 'Moves the specified thread to the trash. Any messages that belong to the thread are also moved to the trash.';
        operationId: 'gmail.users.threads.trash';
        parameters: [
          {
            description: "The user's email address. The special value `me` can be used to indicate the authenticated user.";
            in: 'path';
            name: 'userId';
            required: true;
            schema: {
              type: 'string';
            };
          },
          {
            description: 'The ID of the thread to Trash.';
            in: 'path';
            name: 'id';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Thread';
                };
              };
            };
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://mail.google.com/'];
            Oauth2c: ['https://mail.google.com/'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.modify'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'];
          },
        ];
        tags: ['users'];
      };
    };
    '/gmail/v1/users/{userId}/threads/{id}/untrash': {
      parameters: [
        {
          $ref: '#/components/parameters/_.xgafv';
        },
        {
          $ref: '#/components/parameters/access_token';
        },
        {
          $ref: '#/components/parameters/alt';
        },
        {
          $ref: '#/components/parameters/callback';
        },
        {
          $ref: '#/components/parameters/fields';
        },
        {
          $ref: '#/components/parameters/key';
        },
        {
          $ref: '#/components/parameters/oauth_token';
        },
        {
          $ref: '#/components/parameters/prettyPrint';
        },
        {
          $ref: '#/components/parameters/quotaUser';
        },
        {
          $ref: '#/components/parameters/upload_protocol';
        },
        {
          $ref: '#/components/parameters/uploadType';
        },
      ];
      post: {
        description: 'Removes the specified thread from the trash. Any messages that belong to the thread are also removed from the trash.';
        operationId: 'gmail.users.threads.untrash';
        parameters: [
          {
            description: "The user's email address. The special value `me` can be used to indicate the authenticated user.";
            in: 'path';
            name: 'userId';
            required: true;
            schema: {
              type: 'string';
            };
          },
          {
            description: 'The ID of the thread to remove from Trash.';
            in: 'path';
            name: 'id';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Thread';
                };
              };
            };
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://mail.google.com/'];
            Oauth2c: ['https://mail.google.com/'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.modify'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'];
          },
        ];
        tags: ['users'];
      };
    };
    '/gmail/v1/users/{userId}/watch': {
      parameters: [
        {
          $ref: '#/components/parameters/_.xgafv';
        },
        {
          $ref: '#/components/parameters/access_token';
        },
        {
          $ref: '#/components/parameters/alt';
        },
        {
          $ref: '#/components/parameters/callback';
        },
        {
          $ref: '#/components/parameters/fields';
        },
        {
          $ref: '#/components/parameters/key';
        },
        {
          $ref: '#/components/parameters/oauth_token';
        },
        {
          $ref: '#/components/parameters/prettyPrint';
        },
        {
          $ref: '#/components/parameters/quotaUser';
        },
        {
          $ref: '#/components/parameters/upload_protocol';
        },
        {
          $ref: '#/components/parameters/uploadType';
        },
      ];
      post: {
        description: 'Set up or update a push notification watch on the given user mailbox.';
        operationId: 'gmail.users.watch';
        parameters: [
          {
            description: "The user's email address. The special value `me` can be used to indicate the authenticated user.";
            in: 'path';
            name: 'userId';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/WatchRequest';
              };
            };
          };
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/WatchResponse';
                };
              };
            };
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://mail.google.com/'];
            Oauth2c: ['https://mail.google.com/'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.metadata'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.metadata'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.modify'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/gmail.readonly'];
            Oauth2c: ['https://www.googleapis.com/auth/gmail.readonly'];
          },
        ];
        tags: ['users'];
      };
    };
  };
  components: {
    parameters: {
      '_.xgafv': {
        description: 'V1 error format.';
        in: 'query';
        name: '$.xgafv';
        schema: {
          enum: ['1', '2'];
          type: 'string';
        };
      };
      access_token: {
        description: 'OAuth access token.';
        in: 'query';
        name: 'access_token';
        schema: {
          type: 'string';
        };
      };
      alt: {
        description: 'Data format for response.';
        in: 'query';
        name: 'alt';
        schema: {
          enum: ['json', 'media', 'proto'];
          type: 'string';
        };
      };
      callback: {
        description: 'JSONP';
        in: 'query';
        name: 'callback';
        schema: {
          type: 'string';
        };
      };
      fields: {
        description: 'Selector specifying which fields to include in a partial response.';
        in: 'query';
        name: 'fields';
        schema: {
          type: 'string';
        };
      };
      key: {
        description: 'API key. Your API key identifies your project and provides you with API access, quota, and reports. Required unless you provide an OAuth 2.0 token.';
        in: 'query';
        name: 'key';
        schema: {
          type: 'string';
        };
      };
      oauth_token: {
        description: 'OAuth 2.0 token for the current user.';
        in: 'query';
        name: 'oauth_token';
        schema: {
          type: 'string';
        };
      };
      prettyPrint: {
        description: 'Returns response with indentations and line breaks.';
        in: 'query';
        name: 'prettyPrint';
        schema: {
          type: 'boolean';
        };
      };
      quotaUser: {
        description: 'Available to use for quota purposes for server-side applications. Can be any arbitrary string assigned to a user, but should not exceed 40 characters.';
        in: 'query';
        name: 'quotaUser';
        schema: {
          type: 'string';
        };
      };
      uploadType: {
        description: 'Legacy upload protocol for media (e.g. "media", "multipart").';
        in: 'query';
        name: 'uploadType';
        schema: {
          type: 'string';
        };
      };
      upload_protocol: {
        description: 'Upload protocol for media (e.g. "raw", "multipart").';
        in: 'query';
        name: 'upload_protocol';
        schema: {
          type: 'string';
        };
      };
    };
    schemas: {
      AutoForwarding: {
        description: 'Auto-forwarding settings for an account.';
        properties: {
          disposition: {
            description: 'The state that a message should be left in after it has been forwarded.';
            enum: ['dispositionUnspecified', 'leaveInInbox', 'archive', 'trash', 'markRead'];
            type: 'string';
          };
          emailAddress: {
            description: 'Email address to which all incoming messages are forwarded. This email address must be a verified member of the forwarding addresses.';
            type: 'string';
          };
          enabled: {
            description: 'Whether all incoming mail is automatically forwarded to another address.';
            type: 'boolean';
          };
        };
        type: 'object';
      };
      BatchDeleteMessagesRequest: {
        properties: {
          ids: {
            description: 'The IDs of the messages to delete.';
            items: {
              type: 'string';
            };
            type: 'array';
          };
        };
        type: 'object';
      };
      BatchModifyMessagesRequest: {
        properties: {
          addLabelIds: {
            description: 'A list of label IDs to add to messages.';
            items: {
              type: 'string';
            };
            type: 'array';
          };
          ids: {
            description: 'The IDs of the messages to modify. There is a limit of 1000 ids per request.';
            items: {
              type: 'string';
            };
            type: 'array';
          };
          removeLabelIds: {
            description: 'A list of label IDs to remove from messages.';
            items: {
              type: 'string';
            };
            type: 'array';
          };
        };
        type: 'object';
      };
      CseIdentity: {
        description: 'The client-side encryption (CSE) configuration for the email address of an authenticated user. Gmail uses CSE configurations to save drafts of client-side encrypted email messages, and to sign and send encrypted email messages.';
        properties: {
          emailAddress: {
            description: 'The email address for the sending identity. The email address must be the primary email address of the authenticated user.';
            type: 'string';
          };
          primaryKeyPairId: {
            description: 'If a key pair is associated, the ID of the key pair, CseKeyPair.';
            type: 'string';
          };
          signAndEncryptKeyPairs: {
            $ref: '#/components/schemas/SignAndEncryptKeyPairs';
            description: 'The configuration of a CSE identity that uses different key pairs for signing and encryption.';
          };
        };
        type: 'object';
      };
      CseKeyPair: {
        description: 'A client-side encryption S/MIME key pair, which is comprised of a public key, its certificate chain, and metadata for its paired private key. Gmail uses the key pair to complete the following tasks: - Sign outgoing client-side encrypted messages. - Save and reopen drafts of client-side encrypted messages. - Save and reopen sent messages. - Decrypt incoming or archived S/MIME messages.';
        properties: {
          disableTime: {
            description: "Output only. If a key pair is set to `DISABLED`, the time that the key pair's state changed from `ENABLED` to `DISABLED`. This field is present only when the key pair is in state `DISABLED`.";
            format: 'google-datetime';
            readOnly: true;
            type: 'string';
          };
          enablementState: {
            description: 'Output only. The current state of the key pair.';
            enum: ['stateUnspecified', 'enabled', 'disabled'];
            readOnly: true;
            type: 'string';
          };
          keyPairId: {
            description: 'Output only. The immutable ID for the client-side encryption S/MIME key pair.';
            readOnly: true;
            type: 'string';
          };
          pem: {
            description: 'Output only. The public key and its certificate chain, in [PEM](https://en.wikipedia.org/wiki/Privacy-Enhanced_Mail) format.';
            readOnly: true;
            type: 'string';
          };
          pkcs7: {
            description: 'Input only. The public key and its certificate chain. The chain must be in [PKCS#7](https://en.wikipedia.org/wiki/PKCS_7) format and use PEM encoding and ASCII armor.';
            type: 'string';
          };
          privateKeyMetadata: {
            description: "Metadata for instances of this key pair's private key.";
            items: {
              $ref: '#/components/schemas/CsePrivateKeyMetadata';
            };
            type: 'array';
          };
          subjectEmailAddresses: {
            description: 'Output only. The email address identities that are specified on the leaf certificate.';
            items: {
              type: 'string';
            };
            readOnly: true;
            type: 'array';
          };
        };
        type: 'object';
      };
      CsePrivateKeyMetadata: {
        description: 'Metadata for a private key instance.';
        properties: {
          hardwareKeyMetadata: {
            $ref: '#/components/schemas/HardwareKeyMetadata';
            description: 'Metadata for hardware keys.';
          };
          kaclsKeyMetadata: {
            $ref: '#/components/schemas/KaclsKeyMetadata';
            description: 'Metadata for a private key instance managed by an external key access control list service.';
          };
          privateKeyMetadataId: {
            description: 'Output only. The immutable ID for the private key metadata instance.';
            readOnly: true;
            type: 'string';
          };
        };
        type: 'object';
      };
      Delegate: {
        description: 'Settings for a delegate. Delegates can read, send, and delete messages, as well as view and add contacts, for the delegator\'s account. See "Set up mail delegation" for more information about delegates.';
        properties: {
          delegateEmail: {
            description: 'The email address of the delegate.';
            type: 'string';
          };
          verificationStatus: {
            description: 'Indicates whether this address has been verified and can act as a delegate for the account. Read-only.';
            enum: ['verificationStatusUnspecified', 'accepted', 'pending', 'rejected', 'expired'];
            type: 'string';
          };
        };
        type: 'object';
      };
      DisableCseKeyPairRequest: {
        description: 'Requests to turn off a client-side encryption key pair.';
        properties: {};
        type: 'object';
      };
      Draft: {
        description: "A draft email in the user's mailbox.";
        properties: {
          id: {
            description: 'The immutable ID of the draft.';
            type: 'string';
          };
          message: {
            $ref: '#/components/schemas/Message';
            description: 'The message content of the draft.';
          };
        };
        type: 'object';
      };
      EnableCseKeyPairRequest: {
        description: 'Requests to turn on a client-side encryption key pair.';
        properties: {};
        type: 'object';
      };
      Filter: {
        description: 'Resource definition for Gmail filters. Filters apply to specific messages instead of an entire email thread.';
        properties: {
          action: {
            $ref: '#/components/schemas/FilterAction';
            description: 'Action that the filter performs.';
          };
          criteria: {
            $ref: '#/components/schemas/FilterCriteria';
            description: 'Matching criteria for the filter.';
          };
          id: {
            description: 'The server assigned ID of the filter.';
            type: 'string';
          };
        };
        type: 'object';
      };
      FilterAction: {
        description: 'A set of actions to perform on a message.';
        properties: {
          addLabelIds: {
            description: 'List of labels to add to the message.';
            items: {
              type: 'string';
            };
            type: 'array';
          };
          forward: {
            description: 'Email address that the message should be forwarded to.';
            type: 'string';
          };
          removeLabelIds: {
            description: 'List of labels to remove from the message.';
            items: {
              type: 'string';
            };
            type: 'array';
          };
        };
        type: 'object';
      };
      FilterCriteria: {
        description: 'Message matching criteria.';
        properties: {
          excludeChats: {
            description: 'Whether the response should exclude chats.';
            type: 'boolean';
          };
          from: {
            description: "The sender's display name or email address.";
            type: 'string';
          };
          hasAttachment: {
            description: 'Whether the message has any attachment.';
            type: 'boolean';
          };
          negatedQuery: {
            description: 'Only return messages not matching the specified query. Supports the same query format as the Gmail search box. For example, `"from:someuser@example.com rfc822msgid: is:unread"`.';
            type: 'string';
          };
          query: {
            description: 'Only return messages matching the specified query. Supports the same query format as the Gmail search box. For example, `"from:someuser@example.com rfc822msgid: is:unread"`.';
            type: 'string';
          };
          size: {
            description: 'The size of the entire RFC822 message in bytes, including all headers and attachments.';
            format: 'int32';
            type: 'integer';
          };
          sizeComparison: {
            description: 'How the message size in bytes should be in relation to the size field.';
            enum: ['unspecified', 'smaller', 'larger'];
            type: 'string';
          };
          subject: {
            description: "Case-insensitive phrase found in the message's subject. Trailing and leading whitespace are be trimmed and adjacent spaces are collapsed.";
            type: 'string';
          };
          to: {
            description: 'The recipient\'s display name or email address. Includes recipients in the "to", "cc", and "bcc" header fields. You can use simply the local part of the email address. For example, "example" and "example@" both match "example@gmail.com". This field is case-insensitive.';
            type: 'string';
          };
        };
        type: 'object';
      };
      ForwardingAddress: {
        description: 'Settings for a forwarding address.';
        properties: {
          forwardingEmail: {
            description: 'An email address to which messages can be forwarded.';
            type: 'string';
          };
          verificationStatus: {
            description: 'Indicates whether this address has been verified and is usable for forwarding. Read-only.';
            enum: ['verificationStatusUnspecified', 'accepted', 'pending'];
            type: 'string';
          };
        };
        type: 'object';
      };
      HardwareKeyMetadata: {
        description: 'Metadata for hardware keys.';
        properties: {
          description: {
            description: 'Description about the hardware key.';
            type: 'string';
          };
        };
        type: 'object';
      };
      History: {
        description: "A record of a change to the user's mailbox. Each history change may affect multiple messages in multiple ways.";
        properties: {
          id: {
            description: 'The mailbox sequence ID.';
            format: 'uint64';
            type: 'string';
          };
          labelsAdded: {
            description: 'Labels added to messages in this history record.';
            items: {
              $ref: '#/components/schemas/HistoryLabelAdded';
            };
            type: 'array';
          };
          labelsRemoved: {
            description: 'Labels removed from messages in this history record.';
            items: {
              $ref: '#/components/schemas/HistoryLabelRemoved';
            };
            type: 'array';
          };
          messages: {
            description: 'List of messages changed in this history record. The fields for specific change types, such as `messagesAdded` may duplicate messages in this field. We recommend using the specific change-type fields instead of this.';
            items: {
              $ref: '#/components/schemas/Message';
            };
            type: 'array';
          };
          messagesAdded: {
            description: 'Messages added to the mailbox in this history record.';
            items: {
              $ref: '#/components/schemas/HistoryMessageAdded';
            };
            type: 'array';
          };
          messagesDeleted: {
            description: 'Messages deleted (not Trashed) from the mailbox in this history record.';
            items: {
              $ref: '#/components/schemas/HistoryMessageDeleted';
            };
            type: 'array';
          };
        };
        type: 'object';
      };
      HistoryLabelAdded: {
        properties: {
          labelIds: {
            description: 'Label IDs added to the message.';
            items: {
              type: 'string';
            };
            type: 'array';
          };
          message: {
            $ref: '#/components/schemas/Message';
          };
        };
        type: 'object';
      };
      HistoryLabelRemoved: {
        properties: {
          labelIds: {
            description: 'Label IDs removed from the message.';
            items: {
              type: 'string';
            };
            type: 'array';
          };
          message: {
            $ref: '#/components/schemas/Message';
          };
        };
        type: 'object';
      };
      HistoryMessageAdded: {
        properties: {
          message: {
            $ref: '#/components/schemas/Message';
          };
        };
        type: 'object';
      };
      HistoryMessageDeleted: {
        properties: {
          message: {
            $ref: '#/components/schemas/Message';
          };
        };
        type: 'object';
      };
      ImapSettings: {
        description: 'IMAP settings for an account.';
        properties: {
          autoExpunge: {
            description: 'If this value is true, Gmail will immediately expunge a message when it is marked as deleted in IMAP. Otherwise, Gmail will wait for an update from the client before expunging messages marked as deleted.';
            type: 'boolean';
          };
          enabled: {
            description: 'Whether IMAP is enabled for the account.';
            type: 'boolean';
          };
          expungeBehavior: {
            description: 'The action that will be executed on a message when it is marked as deleted and expunged from the last visible IMAP folder.';
            enum: ['expungeBehaviorUnspecified', 'archive', 'trash', 'deleteForever'];
            type: 'string';
          };
          maxFolderSize: {
            description: 'An optional limit on the number of messages that an IMAP folder may contain. Legal values are 0, 1000, 2000, 5000 or 10000. A value of zero is interpreted to mean that there is no limit.';
            format: 'int32';
            type: 'integer';
          };
        };
        type: 'object';
      };
      KaclsKeyMetadata: {
        description: 'Metadata for private keys managed by an external key access control list service. For details about managing key access, see [Google Workspace CSE API Reference](https://developers.google.com/workspace/cse/reference).';
        properties: {
          kaclsData: {
            description: 'Opaque data generated and used by the key access control list service. Maximum size: 8 KiB.';
            type: 'string';
          };
          kaclsUri: {
            description: 'The URI of the key access control list service that manages the private key.';
            type: 'string';
          };
        };
        type: 'object';
      };
      Label: {
        description: "Labels are used to categorize messages and threads within the user's mailbox. The maximum number of labels supported for a user's mailbox is 10,000.";
        properties: {
          color: {
            $ref: '#/components/schemas/LabelColor';
            description: 'The color to assign to the label. Color is only available for labels that have their `type` set to `user`.';
          };
          id: {
            description: 'The immutable ID of the label.';
            type: 'string';
          };
          labelListVisibility: {
            description: 'The visibility of the label in the label list in the Gmail web interface.';
            enum: ['labelShow', 'labelShowIfUnread', 'labelHide'];
            type: 'string';
          };
          messageListVisibility: {
            description: 'The visibility of messages with this label in the message list in the Gmail web interface.';
            enum: ['show', 'hide'];
            type: 'string';
          };
          messagesTotal: {
            description: 'The total number of messages with the label.';
            format: 'int32';
            type: 'integer';
          };
          messagesUnread: {
            description: 'The number of unread messages with the label.';
            format: 'int32';
            type: 'integer';
          };
          name: {
            description: 'The display name of the label.';
            type: 'string';
          };
          threadsTotal: {
            description: 'The total number of threads with the label.';
            format: 'int32';
            type: 'integer';
          };
          threadsUnread: {
            description: 'The number of unread threads with the label.';
            format: 'int32';
            type: 'integer';
          };
          type: {
            description: 'The owner type for the label. User labels are created by the user and can be modified and deleted by the user and can be applied to any message or thread. System labels are internally created and cannot be added, modified, or deleted. System labels may be able to be applied to or removed from messages and threads under some circumstances but this is not guaranteed. For example, users can apply and remove the `INBOX` and `UNREAD` labels from messages and threads, but cannot apply or remove the `DRAFTS` or `SENT` labels from messages or threads.';
            enum: ['system', 'user'];
            type: 'string';
          };
        };
        type: 'object';
      };
      LabelColor: {
        properties: {
          backgroundColor: {
            description: 'The background color represented as hex string #RRGGBB (ex #000000). This field is required in order to set the color of a label. Only the following predefined set of color values are allowed: \\#000000, #434343, #666666, #999999, #cccccc, #efefef, #f3f3f3, #ffffff, \\#fb4c2f, #ffad47, #fad165, #16a766, #43d692, #4a86e8, #a479e2, #f691b3, \\#f6c5be, #ffe6c7, #fef1d1, #b9e4d0, #c6f3de, #c9daf8, #e4d7f5, #fcdee8, \\#efa093, #ffd6a2, #fce8b3, #89d3b2, #a0eac9, #a4c2f4, #d0bcf1, #fbc8d9, \\#e66550, #ffbc6b, #fcda83, #44b984, #68dfa9, #6d9eeb, #b694e8, #f7a7c0, \\#cc3a21, #eaa041, #f2c960, #149e60, #3dc789, #3c78d8, #8e63ce, #e07798, \\#ac2b16, #cf8933, #d5ae49, #0b804b, #2a9c68, #285bac, #653e9b, #b65775, \\#822111, #a46a21, #aa8831, #076239, #1a764d, #1c4587, #41236d, #83334c \\#464646, #e7e7e7, #0d3472, #b6cff5, #0d3b44, #98d7e4, #3d188e, #e3d7ff, \\#711a36, #fbd3e0, #8a1c0a, #f2b2a8, #7a2e0b, #ffc8af, #7a4706, #ffdeb5, \\#594c05, #fbe983, #684e07, #fdedc1, #0b4f30, #b3efd3, #04502e, #a2dcc1, \\#c2c2c2, #4986e7, #2da2bb, #b99aff, #994a64, #f691b2, #ff7537, #ffad46, \\#662e37, #ebdbde, #cca6ac, #094228, #42d692, #16a765';
            type: 'string';
          };
          textColor: {
            description: 'The text color of the label, represented as hex string. This field is required in order to set the color of a label. Only the following predefined set of color values are allowed: \\#000000, #434343, #666666, #999999, #cccccc, #efefef, #f3f3f3, #ffffff, \\#fb4c2f, #ffad47, #fad165, #16a766, #43d692, #4a86e8, #a479e2, #f691b3, \\#f6c5be, #ffe6c7, #fef1d1, #b9e4d0, #c6f3de, #c9daf8, #e4d7f5, #fcdee8, \\#efa093, #ffd6a2, #fce8b3, #89d3b2, #a0eac9, #a4c2f4, #d0bcf1, #fbc8d9, \\#e66550, #ffbc6b, #fcda83, #44b984, #68dfa9, #6d9eeb, #b694e8, #f7a7c0, \\#cc3a21, #eaa041, #f2c960, #149e60, #3dc789, #3c78d8, #8e63ce, #e07798, \\#ac2b16, #cf8933, #d5ae49, #0b804b, #2a9c68, #285bac, #653e9b, #b65775, \\#822111, #a46a21, #aa8831, #076239, #1a764d, #1c4587, #41236d, #83334c \\#464646, #e7e7e7, #0d3472, #b6cff5, #0d3b44, #98d7e4, #3d188e, #e3d7ff, \\#711a36, #fbd3e0, #8a1c0a, #f2b2a8, #7a2e0b, #ffc8af, #7a4706, #ffdeb5, \\#594c05, #fbe983, #684e07, #fdedc1, #0b4f30, #b3efd3, #04502e, #a2dcc1, \\#c2c2c2, #4986e7, #2da2bb, #b99aff, #994a64, #f691b2, #ff7537, #ffad46, \\#662e37, #ebdbde, #cca6ac, #094228, #42d692, #16a765';
            type: 'string';
          };
        };
        type: 'object';
      };
      LanguageSettings: {
        description: 'Language settings for an account. These settings correspond to the "Language settings" feature in the web interface.';
        properties: {
          displayLanguage: {
            description: 'The language to display Gmail in, formatted as an RFC 3066 Language Tag (for example `en-GB`, `fr` or `ja` for British English, French, or Japanese respectively). The set of languages supported by Gmail evolves over time, so please refer to the "Language" dropdown in the Gmail settings for all available options, as described in the language settings help article. A table of sample values is also provided in the Managing Language Settings guide Not all Gmail clients can display the same set of languages. In the case that a user\'s display language is not available for use on a particular client, said client automatically chooses to display in the closest supported variant (or a reasonable default).';
            type: 'string';
          };
        };
        type: 'object';
      };
      ListCseIdentitiesResponse: {
        properties: {
          cseIdentities: {
            description: 'One page of the list of CSE identities configured for the user.';
            items: {
              $ref: '#/components/schemas/CseIdentity';
            };
            type: 'array';
          };
          nextPageToken: {
            description: 'Pagination token to be passed to a subsequent ListCseIdentities call in order to retrieve the next page of identities. If this value is not returned or is the empty string, then no further pages remain.';
            type: 'string';
          };
        };
        type: 'object';
      };
      ListCseKeyPairsResponse: {
        properties: {
          cseKeyPairs: {
            description: 'One page of the list of CSE key pairs installed for the user.';
            items: {
              $ref: '#/components/schemas/CseKeyPair';
            };
            type: 'array';
          };
          nextPageToken: {
            description: 'Pagination token to be passed to a subsequent ListCseKeyPairs call in order to retrieve the next page of key pairs. If this value is not returned, then no further pages remain.';
            type: 'string';
          };
        };
        type: 'object';
      };
      ListDelegatesResponse: {
        description: 'Response for the ListDelegates method.';
        properties: {
          delegates: {
            description: "List of the user's delegates (with any verification status). If an account doesn't have delegates, this field doesn't appear.";
            items: {
              $ref: '#/components/schemas/Delegate';
            };
            type: 'array';
          };
        };
        type: 'object';
      };
      ListDraftsResponse: {
        properties: {
          drafts: {
            description: 'List of drafts. Note that the `Message` property in each `Draft` resource only contains an `id` and a `threadId`. The messages.get method can fetch additional message details.';
            items: {
              $ref: '#/components/schemas/Draft';
            };
            type: 'array';
          };
          nextPageToken: {
            description: 'Token to retrieve the next page of results in the list.';
            type: 'string';
          };
          resultSizeEstimate: {
            description: 'Estimated total number of results.';
            format: 'uint32';
            type: 'integer';
          };
        };
        type: 'object';
      };
      ListFiltersResponse: {
        description: 'Response for the ListFilters method.';
        properties: {
          filter: {
            description: "List of a user's filters.";
            items: {
              $ref: '#/components/schemas/Filter';
            };
            type: 'array';
          };
        };
        type: 'object';
      };
      ListForwardingAddressesResponse: {
        description: 'Response for the ListForwardingAddresses method.';
        properties: {
          forwardingAddresses: {
            description: 'List of addresses that may be used for forwarding.';
            items: {
              $ref: '#/components/schemas/ForwardingAddress';
            };
            type: 'array';
          };
        };
        type: 'object';
      };
      ListHistoryResponse: {
        properties: {
          history: {
            description: 'List of history records. Any `messages` contained in the response will typically only have `id` and `threadId` fields populated.';
            items: {
              $ref: '#/components/schemas/History';
            };
            type: 'array';
          };
          historyId: {
            description: "The ID of the mailbox's current history record.";
            format: 'uint64';
            type: 'string';
          };
          nextPageToken: {
            description: 'Page token to retrieve the next page of results in the list.';
            type: 'string';
          };
        };
        type: 'object';
      };
      ListLabelsResponse: {
        properties: {
          labels: {
            description: 'List of labels. Note that each label resource only contains an `id`, `name`, `messageListVisibility`, `labelListVisibility`, and `type`. The labels.get method can fetch additional label details.';
            items: {
              $ref: '#/components/schemas/Label';
            };
            type: 'array';
          };
        };
        type: 'object';
      };
      ListMessagesResponse: {
        properties: {
          messages: {
            description: 'List of messages. Note that each message resource contains only an `id` and a `threadId`. Additional message details can be fetched using the messages.get method.';
            items: {
              $ref: '#/components/schemas/Message';
            };
            type: 'array';
          };
          nextPageToken: {
            description: 'Token to retrieve the next page of results in the list.';
            type: 'string';
          };
          resultSizeEstimate: {
            description: 'Estimated total number of results.';
            format: 'uint32';
            type: 'integer';
          };
        };
        type: 'object';
      };
      ListSendAsResponse: {
        description: 'Response for the ListSendAs method.';
        properties: {
          sendAs: {
            description: 'List of send-as aliases.';
            items: {
              $ref: '#/components/schemas/SendAs';
            };
            type: 'array';
          };
        };
        type: 'object';
      };
      ListSmimeInfoResponse: {
        properties: {
          smimeInfo: {
            description: 'List of SmimeInfo.';
            items: {
              $ref: '#/components/schemas/SmimeInfo';
            };
            type: 'array';
          };
        };
        type: 'object';
      };
      ListThreadsResponse: {
        properties: {
          nextPageToken: {
            description: 'Page token to retrieve the next page of results in the list.';
            type: 'string';
          };
          resultSizeEstimate: {
            description: 'Estimated total number of results.';
            format: 'uint32';
            type: 'integer';
          };
          threads: {
            description: 'List of threads. Note that each thread resource does not contain a list of `messages`. The list of `messages` for a given thread can be fetched using the threads.get method.';
            items: {
              $ref: '#/components/schemas/Thread';
            };
            type: 'array';
          };
        };
        type: 'object';
      };
      Message: {
        description: 'An email message.';
        properties: {
          historyId: {
            description: 'The ID of the last history record that modified this message.';
            format: 'uint64';
            type: 'string';
          };
          id: {
            description: 'The immutable ID of the message.';
            type: 'string';
          };
          internalDate: {
            description: 'The internal message creation timestamp (epoch ms), which determines ordering in the inbox. For normal SMTP-received email, this represents the time the message was originally accepted by Google, which is more reliable than the `Date` header. However, for API-migrated mail, it can be configured by client to be based on the `Date` header.';
            format: 'int64';
            type: 'string';
          };
          labelIds: {
            description: 'List of IDs of labels applied to this message.';
            items: {
              type: 'string';
            };
            type: 'array';
          };
          payload: {
            $ref: '#/components/schemas/MessagePart';
            description: 'The parsed email structure in the message parts.';
          };
          raw: {
            description: 'The entire email message in an RFC 2822 formatted and base64url encoded string. Returned in `messages.get` and `drafts.get` responses when the `format=RAW` parameter is supplied.';
            format: 'byte';
            type: 'string';
          };
          sizeEstimate: {
            description: 'Estimated size in bytes of the message.';
            format: 'int32';
            type: 'integer';
          };
          snippet: {
            description: 'A short part of the message text.';
            type: 'string';
          };
          threadId: {
            description: 'The ID of the thread the message belongs to. To add a message or draft to a thread, the following criteria must be met: 1. The requested `threadId` must be specified on the `Message` or `Draft.Message` you supply with your request. 2. The `References` and `In-Reply-To` headers must be set in compliance with the [RFC 2822](https://tools.ietf.org/html/rfc2822) standard. 3. The `Subject` headers must match. ';
            type: 'string';
          };
        };
        type: 'object';
      };
      MessagePart: {
        description: 'A single MIME message part.';
        properties: {
          body: {
            $ref: '#/components/schemas/MessagePartBody';
            description: 'The message part body for this part, which may be empty for container MIME message parts.';
          };
          filename: {
            description: 'The filename of the attachment. Only present if this message part represents an attachment.';
            type: 'string';
          };
          headers: {
            description: 'List of headers on this message part. For the top-level message part, representing the entire message payload, it will contain the standard RFC 2822 email headers such as `To`, `From`, and `Subject`.';
            items: {
              $ref: '#/components/schemas/MessagePartHeader';
            };
            type: 'array';
          };
          mimeType: {
            description: 'The MIME type of the message part.';
            type: 'string';
          };
          partId: {
            description: 'The immutable ID of the message part.';
            type: 'string';
          };
          parts: {
            description: 'The child MIME message parts of this part. This only applies to container MIME message parts, for example `multipart/*`. For non- container MIME message part types, such as `text/plain`, this field is empty. For more information, see RFC 1521.';
            items: {
              $ref: '#/components/schemas/MessagePart';
            };
            type: 'array';
          };
        };
        type: 'object';
      };
      MessagePartBody: {
        description: 'The body of a single MIME message part.';
        properties: {
          attachmentId: {
            description: 'When present, contains the ID of an external attachment that can be retrieved in a separate `messages.attachments.get` request. When not present, the entire content of the message part body is contained in the data field.';
            type: 'string';
          };
          data: {
            description: 'The body data of a MIME message part as a base64url encoded string. May be empty for MIME container types that have no message body or when the body data is sent as a separate attachment. An attachment ID is present if the body data is contained in a separate attachment.';
            format: 'byte';
            type: 'string';
          };
          size: {
            description: 'Number of bytes for the message part data (encoding notwithstanding).';
            format: 'int32';
            type: 'integer';
          };
        };
        type: 'object';
      };
      MessagePartHeader: {
        properties: {
          name: {
            description: 'The name of the header before the `:` separator. For example, `To`.';
            type: 'string';
          };
          value: {
            description: 'The value of the header after the `:` separator. For example, `someuser@example.com`.';
            type: 'string';
          };
        };
        type: 'object';
      };
      ModifyMessageRequest: {
        properties: {
          addLabelIds: {
            description: 'A list of IDs of labels to add to this message. You can add up to 100 labels with each update.';
            items: {
              type: 'string';
            };
            type: 'array';
          };
          removeLabelIds: {
            description: 'A list IDs of labels to remove from this message. You can remove up to 100 labels with each update.';
            items: {
              type: 'string';
            };
            type: 'array';
          };
        };
        type: 'object';
      };
      ModifyThreadRequest: {
        properties: {
          addLabelIds: {
            description: 'A list of IDs of labels to add to this thread. You can add up to 100 labels with each update.';
            items: {
              type: 'string';
            };
            type: 'array';
          };
          removeLabelIds: {
            description: 'A list of IDs of labels to remove from this thread. You can remove up to 100 labels with each update.';
            items: {
              type: 'string';
            };
            type: 'array';
          };
        };
        type: 'object';
      };
      ObliterateCseKeyPairRequest: {
        description: 'Request to obliterate a CSE key pair.';
        properties: {};
        type: 'object';
      };
      PopSettings: {
        description: 'POP settings for an account.';
        properties: {
          accessWindow: {
            description: 'The range of messages which are accessible via POP.';
            enum: ['accessWindowUnspecified', 'disabled', 'fromNowOn', 'allMail'];
            type: 'string';
          };
          disposition: {
            description: 'The action that will be executed on a message after it has been fetched via POP.';
            enum: ['dispositionUnspecified', 'leaveInInbox', 'archive', 'trash', 'markRead'];
            type: 'string';
          };
        };
        type: 'object';
      };
      Profile: {
        description: 'Profile for a Gmail user.';
        properties: {
          emailAddress: {
            description: "The user's email address.";
            type: 'string';
          };
          historyId: {
            description: "The ID of the mailbox's current history record.";
            format: 'uint64';
            type: 'string';
          };
          messagesTotal: {
            description: 'The total number of messages in the mailbox.';
            format: 'int32';
            type: 'integer';
          };
          threadsTotal: {
            description: 'The total number of threads in the mailbox.';
            format: 'int32';
            type: 'integer';
          };
        };
        type: 'object';
      };
      SendAs: {
        description: 'Settings associated with a send-as alias, which can be either the primary login address associated with the account or a custom "from" address. Send-as aliases correspond to the "Send Mail As" feature in the web interface.';
        properties: {
          displayName: {
            description: 'A name that appears in the "From:" header for mail sent using this alias. For custom "from" addresses, when this is empty, Gmail will populate the "From:" header with the name that is used for the primary address associated with the account. If the admin has disabled the ability for users to update their name format, requests to update this field for the primary login will silently fail.';
            type: 'string';
          };
          isDefault: {
            description: 'Whether this address is selected as the default "From:" address in situations such as composing a new message or sending a vacation auto-reply. Every Gmail account has exactly one default send-as address, so the only legal value that clients may write to this field is `true`. Changing this from `false` to `true` for an address will result in this field becoming `false` for the other previous default address.';
            type: 'boolean';
          };
          isPrimary: {
            description: 'Whether this address is the primary address used to login to the account. Every Gmail account has exactly one primary address, and it cannot be deleted from the collection of send-as aliases. This field is read-only.';
            type: 'boolean';
          };
          replyToAddress: {
            description: 'An optional email address that is included in a "Reply-To:" header for mail sent using this alias. If this is empty, Gmail will not generate a "Reply-To:" header.';
            type: 'string';
          };
          sendAsEmail: {
            description: 'The email address that appears in the "From:" header for mail sent using this alias. This is read-only for all operations except create.';
            type: 'string';
          };
          signature: {
            description: 'An optional HTML signature that is included in messages composed with this alias in the Gmail web UI. This signature is added to new emails only.';
            type: 'string';
          };
          smtpMsa: {
            $ref: '#/components/schemas/SmtpMsa';
            description: 'An optional SMTP service that will be used as an outbound relay for mail sent using this alias. If this is empty, outbound mail will be sent directly from Gmail\'s servers to the destination SMTP service. This setting only applies to custom "from" aliases.';
          };
          treatAsAlias: {
            description: 'Whether Gmail should treat this address as an alias for the user\'s primary email address. This setting only applies to custom "from" aliases.';
            type: 'boolean';
          };
          verificationStatus: {
            description: 'Indicates whether this address has been verified for use as a send-as alias. Read-only. This setting only applies to custom "from" aliases.';
            enum: ['verificationStatusUnspecified', 'accepted', 'pending'];
            type: 'string';
          };
        };
        type: 'object';
      };
      SignAndEncryptKeyPairs: {
        description: 'The configuration of a CSE identity that uses different key pairs for signing and encryption.';
        properties: {
          encryptionKeyPairId: {
            description: 'The ID of the CseKeyPair that encrypts signed outgoing mail.';
            type: 'string';
          };
          signingKeyPairId: {
            description: 'The ID of the CseKeyPair that signs outgoing mail.';
            type: 'string';
          };
        };
        type: 'object';
      };
      SmimeInfo: {
        description: 'An S/MIME email config.';
        properties: {
          encryptedKeyPassword: {
            description: 'Encrypted key password, when key is encrypted.';
            type: 'string';
          };
          expiration: {
            description: 'When the certificate expires (in milliseconds since epoch).';
            format: 'int64';
            type: 'string';
          };
          id: {
            description: 'The immutable ID for the SmimeInfo.';
            type: 'string';
          };
          isDefault: {
            description: "Whether this SmimeInfo is the default one for this user's send-as address.";
            type: 'boolean';
          };
          issuerCn: {
            description: "The S/MIME certificate issuer's common name.";
            type: 'string';
          };
          pem: {
            description: 'PEM formatted X509 concatenated certificate string (standard base64 encoding). Format used for returning key, which includes public key as well as certificate chain (not private key).';
            type: 'string';
          };
          pkcs12: {
            description: 'PKCS#12 format containing a single private/public key pair and certificate chain. This format is only accepted from client for creating a new SmimeInfo and is never returned, because the private key is not intended to be exported. PKCS#12 may be encrypted, in which case encryptedKeyPassword should be set appropriately.';
            format: 'byte';
            type: 'string';
          };
        };
        type: 'object';
      };
      SmtpMsa: {
        description: 'Configuration for communication with an SMTP service.';
        properties: {
          host: {
            description: 'The hostname of the SMTP service. Required.';
            type: 'string';
          };
          password: {
            description: 'The password that will be used for authentication with the SMTP service. This is a write-only field that can be specified in requests to create or update SendAs settings; it is never populated in responses.';
            type: 'string';
          };
          port: {
            description: 'The port of the SMTP service. Required.';
            format: 'int32';
            type: 'integer';
          };
          securityMode: {
            description: 'The protocol that will be used to secure communication with the SMTP service. Required.';
            enum: ['securityModeUnspecified', 'none', 'ssl', 'starttls'];
            type: 'string';
          };
          username: {
            description: 'The username that will be used for authentication with the SMTP service. This is a write-only field that can be specified in requests to create or update SendAs settings; it is never populated in responses.';
            type: 'string';
          };
        };
        type: 'object';
      };
      Thread: {
        description: 'A collection of messages representing a conversation.';
        properties: {
          historyId: {
            description: 'The ID of the last history record that modified this thread.';
            format: 'uint64';
            type: 'string';
          };
          id: {
            description: 'The unique ID of the thread.';
            type: 'string';
          };
          messages: {
            description: 'The list of messages in the thread.';
            items: {
              $ref: '#/components/schemas/Message';
            };
            type: 'array';
          };
          snippet: {
            description: 'A short part of the message text.';
            type: 'string';
          };
        };
        type: 'object';
      };
      VacationSettings: {
        description: 'Vacation auto-reply settings for an account. These settings correspond to the "Vacation responder" feature in the web interface.';
        properties: {
          enableAutoReply: {
            description: 'Flag that controls whether Gmail automatically replies to messages.';
            type: 'boolean';
          };
          endTime: {
            description: 'An optional end time for sending auto-replies (epoch ms). When this is specified, Gmail will automatically reply only to messages that it receives before the end time. If both `startTime` and `endTime` are specified, `startTime` must precede `endTime`.';
            format: 'int64';
            type: 'string';
          };
          responseBodyHtml: {
            description: 'Response body in HTML format. Gmail will sanitize the HTML before storing it. If both `response_body_plain_text` and `response_body_html` are specified, `response_body_html` will be used.';
            type: 'string';
          };
          responseBodyPlainText: {
            description: 'Response body in plain text format. If both `response_body_plain_text` and `response_body_html` are specified, `response_body_html` will be used.';
            type: 'string';
          };
          responseSubject: {
            description: 'Optional text to prepend to the subject line in vacation responses. In order to enable auto-replies, either the response subject or the response body must be nonempty.';
            type: 'string';
          };
          restrictToContacts: {
            description: "Flag that determines whether responses are sent to recipients who are not in the user's list of contacts.";
            type: 'boolean';
          };
          restrictToDomain: {
            description: "Flag that determines whether responses are sent to recipients who are outside of the user's domain. This feature is only available for Google Workspace users.";
            type: 'boolean';
          };
          startTime: {
            description: 'An optional start time for sending auto-replies (epoch ms). When this is specified, Gmail will automatically reply only to messages that it receives after the start time. If both `startTime` and `endTime` are specified, `startTime` must precede `endTime`.';
            format: 'int64';
            type: 'string';
          };
        };
        type: 'object';
      };
      WatchRequest: {
        description: "Set up or update a new push notification watch on this user's mailbox.";
        properties: {
          labelFilterAction: {
            deprecated: true;
            description: 'Filtering behavior of `labelIds list` specified. This field is deprecated because it caused incorrect behavior in some cases; use `label_filter_behavior` instead.';
            enum: ['include', 'exclude'];
            type: 'string';
          };
          labelFilterBehavior: {
            description: 'Filtering behavior of `labelIds list` specified. This field replaces `label_filter_action`; if set, `label_filter_action` is ignored.';
            enum: ['include', 'exclude'];
            type: 'string';
          };
          labelIds: {
            description: 'List of label_ids to restrict notifications about. By default, if unspecified, all changes are pushed out. If specified then dictates which labels are required for a push notification to be generated.';
            items: {
              type: 'string';
            };
            type: 'array';
          };
          topicName: {
            description: 'A fully qualified Google Cloud Pub/Sub API topic name to publish the events to. This topic name **must** already exist in Cloud Pub/Sub and you **must** have already granted gmail "publish" permission on it. For example, "projects/my-project-identifier/topics/my-topic-name" (using the Cloud Pub/Sub "v1" topic naming format). Note that the "my-project-identifier" portion must exactly match your Google developer project id (the one executing this watch request).';
            type: 'string';
          };
        };
        type: 'object';
      };
      WatchResponse: {
        description: 'Push notification watch response.';
        properties: {
          expiration: {
            description: 'When Gmail will stop sending notifications for mailbox updates (epoch millis). Call `watch` again before this time to renew the watch.';
            format: 'int64';
            type: 'string';
          };
          historyId: {
            description: "The ID of the mailbox's current history record.";
            format: 'uint64';
            type: 'string';
          };
        };
        type: 'object';
      };
    };
    securitySchemes: {
      Oauth2: {
        description: 'Oauth 2.0 implicit authentication';
        flows: {
          implicit: {
            authorizationUrl: 'https://accounts.google.com/o/oauth2/auth';
            scopes: {
              'https://mail.google.com/': 'Read, compose, send, and permanently delete all your email from Gmail';
              'https://www.googleapis.com/auth/gmail.addons.current.action.compose': 'Manage drafts and send emails when you interact with the add-on';
              'https://www.googleapis.com/auth/gmail.addons.current.message.action': 'View your email messages when you interact with the add-on';
              'https://www.googleapis.com/auth/gmail.addons.current.message.metadata': 'View your email message metadata when the add-on is running';
              'https://www.googleapis.com/auth/gmail.addons.current.message.readonly': 'View your email messages when the add-on is running';
              'https://www.googleapis.com/auth/gmail.compose': 'Manage drafts and send emails';
              'https://www.googleapis.com/auth/gmail.insert': 'Add emails into your Gmail mailbox';
              'https://www.googleapis.com/auth/gmail.labels': 'See and edit your email labels';
              'https://www.googleapis.com/auth/gmail.metadata': 'View your email message metadata such as labels and headers, but not the email body';
              'https://www.googleapis.com/auth/gmail.modify': 'Read, compose, and send emails from your Gmail account';
              'https://www.googleapis.com/auth/gmail.readonly': 'View your email messages and settings';
              'https://www.googleapis.com/auth/gmail.send': 'Send email on your behalf';
              'https://www.googleapis.com/auth/gmail.settings.basic': 'See, edit, create, or change your email settings and filters in Gmail';
              'https://www.googleapis.com/auth/gmail.settings.sharing': 'Manage your sensitive mail settings, including who can manage your mail';
            };
          };
        };
        type: 'oauth2';
      };
      Oauth2c: {
        description: 'Oauth 2.0 authorizationCode authentication';
        flows: {
          authorizationCode: {
            authorizationUrl: 'https://accounts.google.com/o/oauth2/auth';
            scopes: {
              'https://mail.google.com/': 'Read, compose, send, and permanently delete all your email from Gmail';
              'https://www.googleapis.com/auth/gmail.addons.current.action.compose': 'Manage drafts and send emails when you interact with the add-on';
              'https://www.googleapis.com/auth/gmail.addons.current.message.action': 'View your email messages when you interact with the add-on';
              'https://www.googleapis.com/auth/gmail.addons.current.message.metadata': 'View your email message metadata when the add-on is running';
              'https://www.googleapis.com/auth/gmail.addons.current.message.readonly': 'View your email messages when the add-on is running';
              'https://www.googleapis.com/auth/gmail.compose': 'Manage drafts and send emails';
              'https://www.googleapis.com/auth/gmail.insert': 'Add emails into your Gmail mailbox';
              'https://www.googleapis.com/auth/gmail.labels': 'See and edit your email labels';
              'https://www.googleapis.com/auth/gmail.metadata': 'View your email message metadata such as labels and headers, but not the email body';
              'https://www.googleapis.com/auth/gmail.modify': 'Read, compose, and send emails from your Gmail account';
              'https://www.googleapis.com/auth/gmail.readonly': 'View your email messages and settings';
              'https://www.googleapis.com/auth/gmail.send': 'Send email on your behalf';
              'https://www.googleapis.com/auth/gmail.settings.basic': 'See, edit, create, or change your email settings and filters in Gmail';
              'https://www.googleapis.com/auth/gmail.settings.sharing': 'Manage your sensitive mail settings, including who can manage your mail';
            };
            tokenUrl: 'https://accounts.google.com/o/oauth2/token';
          };
        };
        type: 'oauth2';
      };
    };
  };
};
