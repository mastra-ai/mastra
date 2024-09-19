// @ts-nocheck
export type TPaths = {
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
export const paths = {
  '/gmail/v1/users/{userId}/drafts': {
    get: {
      description: "Lists the drafts in the user's mailbox.",
      operationId: 'gmail.users.drafts.list',
      parameters: [
        {
          description:
            "The user's email address. The special value `me` can be used to indicate the authenticated user.",
          in: 'path',
          name: 'userId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Include drafts from `SPAM` and `TRASH` in the results.',
          in: 'query',
          name: 'includeSpamTrash',
          schema: {
            type: 'boolean',
          },
        },
        {
          description:
            'Maximum number of drafts to return. This field defaults to 100. The maximum allowed value for this field is 500.',
          in: 'query',
          name: 'maxResults',
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'Page token to retrieve a specific page of results in the list.',
          in: 'query',
          name: 'pageToken',
          schema: {
            type: 'string',
          },
        },
        {
          description:
            'Only return draft messages matching the specified query. Supports the same query format as the Gmail search box. For example, `"from:someuser@example.com rfc822msgid: is:unread"`.',
          in: 'query',
          name: 'q',
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ListDraftsResponse',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://mail.google.com/'],
          Oauth2c: ['https://mail.google.com/'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.compose'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.compose'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.modify'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.readonly'],
        },
      ],
      tags: ['users'],
    },
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
      },
      {
        $ref: '#/components/parameters/fields',
      },
      {
        $ref: '#/components/parameters/key',
      },
      {
        $ref: '#/components/parameters/oauth_token',
      },
      {
        $ref: '#/components/parameters/prettyPrint',
      },
      {
        $ref: '#/components/parameters/quotaUser',
      },
      {
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
    post: {
      description: 'Creates a new draft with the `DRAFT` label.',
      operationId: 'gmail.users.drafts.create',
      parameters: [
        {
          description:
            "The user's email address. The special value `me` can be used to indicate the authenticated user.",
          in: 'path',
          name: 'userId',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      requestBody: {
        content: {
          'message/cpim': {
            schema: {
              $ref: '#/components/schemas/Draft',
            },
          },
          'message/delivery-status': {
            schema: {
              $ref: '#/components/schemas/Draft',
            },
          },
          'message/disposition-notification': {
            schema: {
              $ref: '#/components/schemas/Draft',
            },
          },
          'message/external-body': {
            schema: {
              $ref: '#/components/schemas/Draft',
            },
          },
          'message/feedback-report': {
            schema: {
              $ref: '#/components/schemas/Draft',
            },
          },
          'message/global': {
            schema: {
              $ref: '#/components/schemas/Draft',
            },
          },
          'message/global-delivery-status': {
            schema: {
              $ref: '#/components/schemas/Draft',
            },
          },
          'message/global-disposition-notification': {
            schema: {
              $ref: '#/components/schemas/Draft',
            },
          },
          'message/global-headers': {
            schema: {
              $ref: '#/components/schemas/Draft',
            },
          },
          'message/http': {
            schema: {
              $ref: '#/components/schemas/Draft',
            },
          },
          'message/imdn+xml': {
            schema: {
              $ref: '#/components/schemas/Draft',
            },
          },
          'message/news': {
            schema: {
              $ref: '#/components/schemas/Draft',
            },
          },
          'message/partial': {
            schema: {
              $ref: '#/components/schemas/Draft',
            },
          },
          'message/rfc822': {
            schema: {
              $ref: '#/components/schemas/Draft',
            },
          },
          'message/s-http': {
            schema: {
              $ref: '#/components/schemas/Draft',
            },
          },
          'message/sip': {
            schema: {
              $ref: '#/components/schemas/Draft',
            },
          },
          'message/sipfrag': {
            schema: {
              $ref: '#/components/schemas/Draft',
            },
          },
          'message/tracking-status': {
            schema: {
              $ref: '#/components/schemas/Draft',
            },
          },
          'message/vnd.si.simp': {
            schema: {
              $ref: '#/components/schemas/Draft',
            },
          },
          'message/vnd.wfa.wsc': {
            schema: {
              $ref: '#/components/schemas/Draft',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Draft',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://mail.google.com/'],
          Oauth2c: ['https://mail.google.com/'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.addons.current.action.compose'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.addons.current.action.compose'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.compose'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.compose'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.modify'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'],
        },
      ],
      tags: ['users'],
    },
  },
  '/gmail/v1/users/{userId}/drafts/send': {
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
      },
      {
        $ref: '#/components/parameters/fields',
      },
      {
        $ref: '#/components/parameters/key',
      },
      {
        $ref: '#/components/parameters/oauth_token',
      },
      {
        $ref: '#/components/parameters/prettyPrint',
      },
      {
        $ref: '#/components/parameters/quotaUser',
      },
      {
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
    post: {
      description: 'Sends the specified, existing draft to the recipients in the `To`, `Cc`, and `Bcc` headers.',
      operationId: 'gmail.users.drafts.send',
      parameters: [
        {
          description:
            "The user's email address. The special value `me` can be used to indicate the authenticated user.",
          in: 'path',
          name: 'userId',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      requestBody: {
        content: {
          'message/cpim': {
            schema: {
              $ref: '#/components/schemas/Draft',
            },
          },
          'message/delivery-status': {
            schema: {
              $ref: '#/components/schemas/Draft',
            },
          },
          'message/disposition-notification': {
            schema: {
              $ref: '#/components/schemas/Draft',
            },
          },
          'message/external-body': {
            schema: {
              $ref: '#/components/schemas/Draft',
            },
          },
          'message/feedback-report': {
            schema: {
              $ref: '#/components/schemas/Draft',
            },
          },
          'message/global': {
            schema: {
              $ref: '#/components/schemas/Draft',
            },
          },
          'message/global-delivery-status': {
            schema: {
              $ref: '#/components/schemas/Draft',
            },
          },
          'message/global-disposition-notification': {
            schema: {
              $ref: '#/components/schemas/Draft',
            },
          },
          'message/global-headers': {
            schema: {
              $ref: '#/components/schemas/Draft',
            },
          },
          'message/http': {
            schema: {
              $ref: '#/components/schemas/Draft',
            },
          },
          'message/imdn+xml': {
            schema: {
              $ref: '#/components/schemas/Draft',
            },
          },
          'message/news': {
            schema: {
              $ref: '#/components/schemas/Draft',
            },
          },
          'message/partial': {
            schema: {
              $ref: '#/components/schemas/Draft',
            },
          },
          'message/rfc822': {
            schema: {
              $ref: '#/components/schemas/Draft',
            },
          },
          'message/s-http': {
            schema: {
              $ref: '#/components/schemas/Draft',
            },
          },
          'message/sip': {
            schema: {
              $ref: '#/components/schemas/Draft',
            },
          },
          'message/sipfrag': {
            schema: {
              $ref: '#/components/schemas/Draft',
            },
          },
          'message/tracking-status': {
            schema: {
              $ref: '#/components/schemas/Draft',
            },
          },
          'message/vnd.si.simp': {
            schema: {
              $ref: '#/components/schemas/Draft',
            },
          },
          'message/vnd.wfa.wsc': {
            schema: {
              $ref: '#/components/schemas/Draft',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Message',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://mail.google.com/'],
          Oauth2c: ['https://mail.google.com/'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.addons.current.action.compose'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.addons.current.action.compose'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.compose'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.compose'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.modify'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'],
        },
      ],
      tags: ['users'],
    },
  },
  '/gmail/v1/users/{userId}/drafts/{id}': {
    delete: {
      description: 'Immediately and permanently deletes the specified draft. Does not simply trash it.',
      operationId: 'gmail.users.drafts.delete',
      parameters: [
        {
          description:
            "The user's email address. The special value `me` can be used to indicate the authenticated user.",
          in: 'path',
          name: 'userId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'The ID of the draft to delete.',
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://mail.google.com/'],
          Oauth2c: ['https://mail.google.com/'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.addons.current.action.compose'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.addons.current.action.compose'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.compose'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.compose'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.modify'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'],
        },
      ],
      tags: ['users'],
    },
    get: {
      description: 'Gets the specified draft.',
      operationId: 'gmail.users.drafts.get',
      parameters: [
        {
          description:
            "The user's email address. The special value `me` can be used to indicate the authenticated user.",
          in: 'path',
          name: 'userId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'The ID of the draft to retrieve.',
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'The format to return the draft in.',
          in: 'query',
          name: 'format',
          schema: {
            enum: ['minimal', 'full', 'raw', 'metadata'],
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Draft',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://mail.google.com/'],
          Oauth2c: ['https://mail.google.com/'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.compose'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.compose'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.modify'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.readonly'],
        },
      ],
      tags: ['users'],
    },
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
      },
      {
        $ref: '#/components/parameters/fields',
      },
      {
        $ref: '#/components/parameters/key',
      },
      {
        $ref: '#/components/parameters/oauth_token',
      },
      {
        $ref: '#/components/parameters/prettyPrint',
      },
      {
        $ref: '#/components/parameters/quotaUser',
      },
      {
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
    put: {
      description: "Replaces a draft's content.",
      operationId: 'gmail.users.drafts.update',
      parameters: [
        {
          description:
            "The user's email address. The special value `me` can be used to indicate the authenticated user.",
          in: 'path',
          name: 'userId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'The ID of the draft to update.',
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      requestBody: {
        content: {
          'message/cpim': {
            schema: {
              $ref: '#/components/schemas/Draft',
            },
          },
          'message/delivery-status': {
            schema: {
              $ref: '#/components/schemas/Draft',
            },
          },
          'message/disposition-notification': {
            schema: {
              $ref: '#/components/schemas/Draft',
            },
          },
          'message/external-body': {
            schema: {
              $ref: '#/components/schemas/Draft',
            },
          },
          'message/feedback-report': {
            schema: {
              $ref: '#/components/schemas/Draft',
            },
          },
          'message/global': {
            schema: {
              $ref: '#/components/schemas/Draft',
            },
          },
          'message/global-delivery-status': {
            schema: {
              $ref: '#/components/schemas/Draft',
            },
          },
          'message/global-disposition-notification': {
            schema: {
              $ref: '#/components/schemas/Draft',
            },
          },
          'message/global-headers': {
            schema: {
              $ref: '#/components/schemas/Draft',
            },
          },
          'message/http': {
            schema: {
              $ref: '#/components/schemas/Draft',
            },
          },
          'message/imdn+xml': {
            schema: {
              $ref: '#/components/schemas/Draft',
            },
          },
          'message/news': {
            schema: {
              $ref: '#/components/schemas/Draft',
            },
          },
          'message/partial': {
            schema: {
              $ref: '#/components/schemas/Draft',
            },
          },
          'message/rfc822': {
            schema: {
              $ref: '#/components/schemas/Draft',
            },
          },
          'message/s-http': {
            schema: {
              $ref: '#/components/schemas/Draft',
            },
          },
          'message/sip': {
            schema: {
              $ref: '#/components/schemas/Draft',
            },
          },
          'message/sipfrag': {
            schema: {
              $ref: '#/components/schemas/Draft',
            },
          },
          'message/tracking-status': {
            schema: {
              $ref: '#/components/schemas/Draft',
            },
          },
          'message/vnd.si.simp': {
            schema: {
              $ref: '#/components/schemas/Draft',
            },
          },
          'message/vnd.wfa.wsc': {
            schema: {
              $ref: '#/components/schemas/Draft',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Draft',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://mail.google.com/'],
          Oauth2c: ['https://mail.google.com/'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.addons.current.action.compose'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.addons.current.action.compose'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.compose'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.compose'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.modify'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'],
        },
      ],
      tags: ['users'],
    },
  },
  '/gmail/v1/users/{userId}/history': {
    get: {
      description:
        'Lists the history of all changes to the given mailbox. History results are returned in chronological order (increasing `historyId`).',
      operationId: 'gmail.users.history.list',
      parameters: [
        {
          description:
            "The user's email address. The special value `me` can be used to indicate the authenticated user.",
          in: 'path',
          name: 'userId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'History types to be returned by the function',
          explode: true,
          in: 'query',
          name: 'historyTypes',
          schema: {
            items: {
              enum: ['messageAdded', 'messageDeleted', 'labelAdded', 'labelRemoved'],
              type: 'string',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description: 'Only return messages with a label matching the ID.',
          in: 'query',
          name: 'labelId',
          schema: {
            type: 'string',
          },
        },
        {
          description:
            'Maximum number of history records to return. This field defaults to 100. The maximum allowed value for this field is 500.',
          in: 'query',
          name: 'maxResults',
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'Page token to retrieve a specific page of results in the list.',
          in: 'query',
          name: 'pageToken',
          schema: {
            type: 'string',
          },
        },
        {
          description:
            'Required. Returns history records after the specified `startHistoryId`. The supplied `startHistoryId` should be obtained from the `historyId` of a message, thread, or previous `list` response. History IDs increase chronologically but are not contiguous with random gaps in between valid IDs. Supplying an invalid or out of date `startHistoryId` typically returns an `HTTP 404` error code. A `historyId` is typically valid for at least a week, but in some rare circumstances may be valid for only a few hours. If you receive an `HTTP 404` error response, your application should perform a full sync. If you receive no `nextPageToken` in the response, there are no updates to retrieve and you can store the returned `historyId` for a future request.',
          in: 'query',
          name: 'startHistoryId',
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ListHistoryResponse',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://mail.google.com/'],
          Oauth2c: ['https://mail.google.com/'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.metadata'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.metadata'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.modify'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.readonly'],
        },
      ],
      tags: ['users'],
    },
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
      },
      {
        $ref: '#/components/parameters/fields',
      },
      {
        $ref: '#/components/parameters/key',
      },
      {
        $ref: '#/components/parameters/oauth_token',
      },
      {
        $ref: '#/components/parameters/prettyPrint',
      },
      {
        $ref: '#/components/parameters/quotaUser',
      },
      {
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
  },
  '/gmail/v1/users/{userId}/labels': {
    get: {
      description: "Lists all labels in the user's mailbox.",
      operationId: 'gmail.users.labels.list',
      parameters: [
        {
          description:
            "The user's email address. The special value `me` can be used to indicate the authenticated user.",
          in: 'path',
          name: 'userId',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ListLabelsResponse',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://mail.google.com/'],
          Oauth2c: ['https://mail.google.com/'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.labels'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.labels'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.metadata'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.metadata'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.modify'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.readonly'],
        },
      ],
      tags: ['users'],
    },
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
      },
      {
        $ref: '#/components/parameters/fields',
      },
      {
        $ref: '#/components/parameters/key',
      },
      {
        $ref: '#/components/parameters/oauth_token',
      },
      {
        $ref: '#/components/parameters/prettyPrint',
      },
      {
        $ref: '#/components/parameters/quotaUser',
      },
      {
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
    post: {
      description: 'Creates a new label.',
      operationId: 'gmail.users.labels.create',
      parameters: [
        {
          description:
            "The user's email address. The special value `me` can be used to indicate the authenticated user.",
          in: 'path',
          name: 'userId',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Label',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Label',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://mail.google.com/'],
          Oauth2c: ['https://mail.google.com/'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.labels'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.labels'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.modify'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'],
        },
      ],
      tags: ['users'],
    },
  },
  '/gmail/v1/users/{userId}/labels/{id}': {
    delete: {
      description:
        'Immediately and permanently deletes the specified label and removes it from any messages and threads that it is applied to.',
      operationId: 'gmail.users.labels.delete',
      parameters: [
        {
          description:
            "The user's email address. The special value `me` can be used to indicate the authenticated user.",
          in: 'path',
          name: 'userId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'The ID of the label to delete.',
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://mail.google.com/'],
          Oauth2c: ['https://mail.google.com/'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.labels'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.labels'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.modify'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'],
        },
      ],
      tags: ['users'],
    },
    get: {
      description: 'Gets the specified label.',
      operationId: 'gmail.users.labels.get',
      parameters: [
        {
          description:
            "The user's email address. The special value `me` can be used to indicate the authenticated user.",
          in: 'path',
          name: 'userId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'The ID of the label to retrieve.',
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Label',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://mail.google.com/'],
          Oauth2c: ['https://mail.google.com/'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.labels'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.labels'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.metadata'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.metadata'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.modify'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.readonly'],
        },
      ],
      tags: ['users'],
    },
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
      },
      {
        $ref: '#/components/parameters/fields',
      },
      {
        $ref: '#/components/parameters/key',
      },
      {
        $ref: '#/components/parameters/oauth_token',
      },
      {
        $ref: '#/components/parameters/prettyPrint',
      },
      {
        $ref: '#/components/parameters/quotaUser',
      },
      {
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
    patch: {
      description: 'Patch the specified label.',
      operationId: 'gmail.users.labels.patch',
      parameters: [
        {
          description:
            "The user's email address. The special value `me` can be used to indicate the authenticated user.",
          in: 'path',
          name: 'userId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'The ID of the label to update.',
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Label',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Label',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://mail.google.com/'],
          Oauth2c: ['https://mail.google.com/'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.labels'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.labels'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.modify'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'],
        },
      ],
      tags: ['users'],
    },
    put: {
      description: 'Updates the specified label.',
      operationId: 'gmail.users.labels.update',
      parameters: [
        {
          description:
            "The user's email address. The special value `me` can be used to indicate the authenticated user.",
          in: 'path',
          name: 'userId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'The ID of the label to update.',
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Label',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Label',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://mail.google.com/'],
          Oauth2c: ['https://mail.google.com/'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.labels'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.labels'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.modify'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'],
        },
      ],
      tags: ['users'],
    },
  },
  '/gmail/v1/users/{userId}/messages': {
    get: {
      description: "Lists the messages in the user's mailbox.",
      operationId: 'gmail.users.messages.list',
      parameters: [
        {
          description:
            "The user's email address. The special value `me` can be used to indicate the authenticated user.",
          in: 'path',
          name: 'userId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Include messages from `SPAM` and `TRASH` in the results.',
          in: 'query',
          name: 'includeSpamTrash',
          schema: {
            type: 'boolean',
          },
        },
        {
          description:
            "Only return messages with labels that match all of the specified label IDs. Messages in a thread might have labels that other messages in the same thread don't have. To learn more, see [Manage labels on messages and threads](https://developers.google.com/gmail/api/guides/labels#manage_labels_on_messages_threads).",
          explode: true,
          in: 'query',
          name: 'labelIds',
          schema: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description:
            'Maximum number of messages to return. This field defaults to 100. The maximum allowed value for this field is 500.',
          in: 'query',
          name: 'maxResults',
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'Page token to retrieve a specific page of results in the list.',
          in: 'query',
          name: 'pageToken',
          schema: {
            type: 'string',
          },
        },
        {
          description:
            'Only return messages matching the specified query. Supports the same query format as the Gmail search box. For example, `"from:someuser@example.com rfc822msgid: is:unread"`. Parameter cannot be used when accessing the api using the gmail.metadata scope.',
          in: 'query',
          name: 'q',
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ListMessagesResponse',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://mail.google.com/'],
          Oauth2c: ['https://mail.google.com/'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.metadata'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.metadata'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.modify'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.readonly'],
        },
      ],
      tags: ['users'],
    },
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
      },
      {
        $ref: '#/components/parameters/fields',
      },
      {
        $ref: '#/components/parameters/key',
      },
      {
        $ref: '#/components/parameters/oauth_token',
      },
      {
        $ref: '#/components/parameters/prettyPrint',
      },
      {
        $ref: '#/components/parameters/quotaUser',
      },
      {
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
    post: {
      description:
        "Directly inserts a message into only this user's mailbox similar to `IMAP APPEND`, bypassing most scanning and classification. Does not send a message.",
      operationId: 'gmail.users.messages.insert',
      parameters: [
        {
          description:
            "The user's email address. The special value `me` can be used to indicate the authenticated user.",
          in: 'path',
          name: 'userId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description:
            'Mark the email as permanently deleted (not TRASH) and only visible in Google Vault to a Vault administrator. Only used for Google Workspace accounts.',
          in: 'query',
          name: 'deleted',
          schema: {
            type: 'boolean',
          },
        },
        {
          description: "Source for Gmail's internal date of the message.",
          in: 'query',
          name: 'internalDateSource',
          schema: {
            enum: ['receivedTime', 'dateHeader'],
            type: 'string',
          },
        },
      ],
      requestBody: {
        content: {
          'message/cpim': {
            schema: {
              $ref: '#/components/schemas/Message',
            },
          },
          'message/delivery-status': {
            schema: {
              $ref: '#/components/schemas/Message',
            },
          },
          'message/disposition-notification': {
            schema: {
              $ref: '#/components/schemas/Message',
            },
          },
          'message/external-body': {
            schema: {
              $ref: '#/components/schemas/Message',
            },
          },
          'message/feedback-report': {
            schema: {
              $ref: '#/components/schemas/Message',
            },
          },
          'message/global': {
            schema: {
              $ref: '#/components/schemas/Message',
            },
          },
          'message/global-delivery-status': {
            schema: {
              $ref: '#/components/schemas/Message',
            },
          },
          'message/global-disposition-notification': {
            schema: {
              $ref: '#/components/schemas/Message',
            },
          },
          'message/global-headers': {
            schema: {
              $ref: '#/components/schemas/Message',
            },
          },
          'message/http': {
            schema: {
              $ref: '#/components/schemas/Message',
            },
          },
          'message/imdn+xml': {
            schema: {
              $ref: '#/components/schemas/Message',
            },
          },
          'message/news': {
            schema: {
              $ref: '#/components/schemas/Message',
            },
          },
          'message/partial': {
            schema: {
              $ref: '#/components/schemas/Message',
            },
          },
          'message/rfc822': {
            schema: {
              $ref: '#/components/schemas/Message',
            },
          },
          'message/s-http': {
            schema: {
              $ref: '#/components/schemas/Message',
            },
          },
          'message/sip': {
            schema: {
              $ref: '#/components/schemas/Message',
            },
          },
          'message/sipfrag': {
            schema: {
              $ref: '#/components/schemas/Message',
            },
          },
          'message/tracking-status': {
            schema: {
              $ref: '#/components/schemas/Message',
            },
          },
          'message/vnd.si.simp': {
            schema: {
              $ref: '#/components/schemas/Message',
            },
          },
          'message/vnd.wfa.wsc': {
            schema: {
              $ref: '#/components/schemas/Message',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Message',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://mail.google.com/'],
          Oauth2c: ['https://mail.google.com/'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.insert'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.insert'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.modify'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'],
        },
      ],
      tags: ['users'],
    },
  },
  '/gmail/v1/users/{userId}/messages/batchDelete': {
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
      },
      {
        $ref: '#/components/parameters/fields',
      },
      {
        $ref: '#/components/parameters/key',
      },
      {
        $ref: '#/components/parameters/oauth_token',
      },
      {
        $ref: '#/components/parameters/prettyPrint',
      },
      {
        $ref: '#/components/parameters/quotaUser',
      },
      {
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
    post: {
      description:
        'Deletes many messages by message ID. Provides no guarantees that messages were not already deleted or even existed at all.',
      operationId: 'gmail.users.messages.batchDelete',
      parameters: [
        {
          description:
            "The user's email address. The special value `me` can be used to indicate the authenticated user.",
          in: 'path',
          name: 'userId',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/BatchDeleteMessagesRequest',
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://mail.google.com/'],
          Oauth2c: ['https://mail.google.com/'],
        },
      ],
      tags: ['users'],
    },
  },
  '/gmail/v1/users/{userId}/messages/batchModify': {
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
      },
      {
        $ref: '#/components/parameters/fields',
      },
      {
        $ref: '#/components/parameters/key',
      },
      {
        $ref: '#/components/parameters/oauth_token',
      },
      {
        $ref: '#/components/parameters/prettyPrint',
      },
      {
        $ref: '#/components/parameters/quotaUser',
      },
      {
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
    post: {
      description: 'Modifies the labels on the specified messages.',
      operationId: 'gmail.users.messages.batchModify',
      parameters: [
        {
          description:
            "The user's email address. The special value `me` can be used to indicate the authenticated user.",
          in: 'path',
          name: 'userId',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/BatchModifyMessagesRequest',
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://mail.google.com/'],
          Oauth2c: ['https://mail.google.com/'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.modify'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'],
        },
      ],
      tags: ['users'],
    },
  },
  '/gmail/v1/users/{userId}/messages/import': {
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
      },
      {
        $ref: '#/components/parameters/fields',
      },
      {
        $ref: '#/components/parameters/key',
      },
      {
        $ref: '#/components/parameters/oauth_token',
      },
      {
        $ref: '#/components/parameters/prettyPrint',
      },
      {
        $ref: '#/components/parameters/quotaUser',
      },
      {
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
    post: {
      description:
        "Imports a message into only this user's mailbox, with standard email delivery scanning and classification similar to receiving via SMTP. This method doesn't perform SPF checks, so it might not work for some spam messages, such as those attempting to perform domain spoofing. This method does not send a message.",
      operationId: 'gmail.users.messages.import',
      parameters: [
        {
          description:
            "The user's email address. The special value `me` can be used to indicate the authenticated user.",
          in: 'path',
          name: 'userId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description:
            'Mark the email as permanently deleted (not TRASH) and only visible in Google Vault to a Vault administrator. Only used for Google Workspace accounts.',
          in: 'query',
          name: 'deleted',
          schema: {
            type: 'boolean',
          },
        },
        {
          description: "Source for Gmail's internal date of the message.",
          in: 'query',
          name: 'internalDateSource',
          schema: {
            enum: ['receivedTime', 'dateHeader'],
            type: 'string',
          },
        },
        {
          description: 'Ignore the Gmail spam classifier decision and never mark this email as SPAM in the mailbox.',
          in: 'query',
          name: 'neverMarkSpam',
          schema: {
            type: 'boolean',
          },
        },
        {
          description:
            'Process calendar invites in the email and add any extracted meetings to the Google Calendar for this user.',
          in: 'query',
          name: 'processForCalendar',
          schema: {
            type: 'boolean',
          },
        },
      ],
      requestBody: {
        content: {
          'message/cpim': {
            schema: {
              $ref: '#/components/schemas/Message',
            },
          },
          'message/delivery-status': {
            schema: {
              $ref: '#/components/schemas/Message',
            },
          },
          'message/disposition-notification': {
            schema: {
              $ref: '#/components/schemas/Message',
            },
          },
          'message/external-body': {
            schema: {
              $ref: '#/components/schemas/Message',
            },
          },
          'message/feedback-report': {
            schema: {
              $ref: '#/components/schemas/Message',
            },
          },
          'message/global': {
            schema: {
              $ref: '#/components/schemas/Message',
            },
          },
          'message/global-delivery-status': {
            schema: {
              $ref: '#/components/schemas/Message',
            },
          },
          'message/global-disposition-notification': {
            schema: {
              $ref: '#/components/schemas/Message',
            },
          },
          'message/global-headers': {
            schema: {
              $ref: '#/components/schemas/Message',
            },
          },
          'message/http': {
            schema: {
              $ref: '#/components/schemas/Message',
            },
          },
          'message/imdn+xml': {
            schema: {
              $ref: '#/components/schemas/Message',
            },
          },
          'message/news': {
            schema: {
              $ref: '#/components/schemas/Message',
            },
          },
          'message/partial': {
            schema: {
              $ref: '#/components/schemas/Message',
            },
          },
          'message/rfc822': {
            schema: {
              $ref: '#/components/schemas/Message',
            },
          },
          'message/s-http': {
            schema: {
              $ref: '#/components/schemas/Message',
            },
          },
          'message/sip': {
            schema: {
              $ref: '#/components/schemas/Message',
            },
          },
          'message/sipfrag': {
            schema: {
              $ref: '#/components/schemas/Message',
            },
          },
          'message/tracking-status': {
            schema: {
              $ref: '#/components/schemas/Message',
            },
          },
          'message/vnd.si.simp': {
            schema: {
              $ref: '#/components/schemas/Message',
            },
          },
          'message/vnd.wfa.wsc': {
            schema: {
              $ref: '#/components/schemas/Message',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Message',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://mail.google.com/'],
          Oauth2c: ['https://mail.google.com/'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.insert'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.insert'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.modify'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'],
        },
      ],
      tags: ['users'],
    },
  },
  '/gmail/v1/users/{userId}/messages/send': {
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
      },
      {
        $ref: '#/components/parameters/fields',
      },
      {
        $ref: '#/components/parameters/key',
      },
      {
        $ref: '#/components/parameters/oauth_token',
      },
      {
        $ref: '#/components/parameters/prettyPrint',
      },
      {
        $ref: '#/components/parameters/quotaUser',
      },
      {
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
    post: {
      description:
        'Sends the specified message to the recipients in the `To`, `Cc`, and `Bcc` headers. For example usage, see [Sending email](https://developers.google.com/gmail/api/guides/sending).',
      operationId: 'gmail.users.messages.send',
      parameters: [
        {
          description:
            "The user's email address. The special value `me` can be used to indicate the authenticated user.",
          in: 'path',
          name: 'userId',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      requestBody: {
        content: {
          'message/cpim': {
            schema: {
              $ref: '#/components/schemas/Message',
            },
          },
          'message/delivery-status': {
            schema: {
              $ref: '#/components/schemas/Message',
            },
          },
          'message/disposition-notification': {
            schema: {
              $ref: '#/components/schemas/Message',
            },
          },
          'message/external-body': {
            schema: {
              $ref: '#/components/schemas/Message',
            },
          },
          'message/feedback-report': {
            schema: {
              $ref: '#/components/schemas/Message',
            },
          },
          'message/global': {
            schema: {
              $ref: '#/components/schemas/Message',
            },
          },
          'message/global-delivery-status': {
            schema: {
              $ref: '#/components/schemas/Message',
            },
          },
          'message/global-disposition-notification': {
            schema: {
              $ref: '#/components/schemas/Message',
            },
          },
          'message/global-headers': {
            schema: {
              $ref: '#/components/schemas/Message',
            },
          },
          'message/http': {
            schema: {
              $ref: '#/components/schemas/Message',
            },
          },
          'message/imdn+xml': {
            schema: {
              $ref: '#/components/schemas/Message',
            },
          },
          'message/news': {
            schema: {
              $ref: '#/components/schemas/Message',
            },
          },
          'message/partial': {
            schema: {
              $ref: '#/components/schemas/Message',
            },
          },
          'message/rfc822': {
            schema: {
              $ref: '#/components/schemas/Message',
            },
          },
          'message/s-http': {
            schema: {
              $ref: '#/components/schemas/Message',
            },
          },
          'message/sip': {
            schema: {
              $ref: '#/components/schemas/Message',
            },
          },
          'message/sipfrag': {
            schema: {
              $ref: '#/components/schemas/Message',
            },
          },
          'message/tracking-status': {
            schema: {
              $ref: '#/components/schemas/Message',
            },
          },
          'message/vnd.si.simp': {
            schema: {
              $ref: '#/components/schemas/Message',
            },
          },
          'message/vnd.wfa.wsc': {
            schema: {
              $ref: '#/components/schemas/Message',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Message',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://mail.google.com/'],
          Oauth2c: ['https://mail.google.com/'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.addons.current.action.compose'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.addons.current.action.compose'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.compose'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.compose'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.modify'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.send'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.send'],
        },
      ],
      tags: ['users'],
    },
  },
  '/gmail/v1/users/{userId}/messages/{id}': {
    delete: {
      description:
        'Immediately and permanently deletes the specified message. This operation cannot be undone. Prefer `messages.trash` instead.',
      operationId: 'gmail.users.messages.delete',
      parameters: [
        {
          description:
            "The user's email address. The special value `me` can be used to indicate the authenticated user.",
          in: 'path',
          name: 'userId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'The ID of the message to delete.',
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://mail.google.com/'],
          Oauth2c: ['https://mail.google.com/'],
        },
      ],
      tags: ['users'],
    },
    get: {
      description: 'Gets the specified message.',
      operationId: 'gmail.users.messages.get',
      parameters: [
        {
          description:
            "The user's email address. The special value `me` can be used to indicate the authenticated user.",
          in: 'path',
          name: 'userId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description:
            'The ID of the message to retrieve. This ID is usually retrieved using `messages.list`. The ID is also contained in the result when a message is inserted (`messages.insert`) or imported (`messages.import`).',
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'The format to return the message in.',
          in: 'query',
          name: 'format',
          schema: {
            enum: ['minimal', 'full', 'raw', 'metadata'],
            type: 'string',
          },
        },
        {
          description: 'When given and format is `METADATA`, only include headers specified.',
          explode: true,
          in: 'query',
          name: 'metadataHeaders',
          schema: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
          style: 'form',
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Message',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://mail.google.com/'],
          Oauth2c: ['https://mail.google.com/'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.addons.current.message.action'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.addons.current.message.action'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.addons.current.message.metadata'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.addons.current.message.metadata'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.addons.current.message.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.addons.current.message.readonly'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.metadata'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.metadata'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.modify'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.readonly'],
        },
      ],
      tags: ['users'],
    },
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
      },
      {
        $ref: '#/components/parameters/fields',
      },
      {
        $ref: '#/components/parameters/key',
      },
      {
        $ref: '#/components/parameters/oauth_token',
      },
      {
        $ref: '#/components/parameters/prettyPrint',
      },
      {
        $ref: '#/components/parameters/quotaUser',
      },
      {
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
  },
  '/gmail/v1/users/{userId}/messages/{id}/modify': {
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
      },
      {
        $ref: '#/components/parameters/fields',
      },
      {
        $ref: '#/components/parameters/key',
      },
      {
        $ref: '#/components/parameters/oauth_token',
      },
      {
        $ref: '#/components/parameters/prettyPrint',
      },
      {
        $ref: '#/components/parameters/quotaUser',
      },
      {
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
    post: {
      description: 'Modifies the labels on the specified message.',
      operationId: 'gmail.users.messages.modify',
      parameters: [
        {
          description:
            "The user's email address. The special value `me` can be used to indicate the authenticated user.",
          in: 'path',
          name: 'userId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'The ID of the message to modify.',
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/ModifyMessageRequest',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Message',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://mail.google.com/'],
          Oauth2c: ['https://mail.google.com/'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.modify'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'],
        },
      ],
      tags: ['users'],
    },
  },
  '/gmail/v1/users/{userId}/messages/{id}/trash': {
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
      },
      {
        $ref: '#/components/parameters/fields',
      },
      {
        $ref: '#/components/parameters/key',
      },
      {
        $ref: '#/components/parameters/oauth_token',
      },
      {
        $ref: '#/components/parameters/prettyPrint',
      },
      {
        $ref: '#/components/parameters/quotaUser',
      },
      {
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
    post: {
      description: 'Moves the specified message to the trash.',
      operationId: 'gmail.users.messages.trash',
      parameters: [
        {
          description:
            "The user's email address. The special value `me` can be used to indicate the authenticated user.",
          in: 'path',
          name: 'userId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'The ID of the message to Trash.',
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Message',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://mail.google.com/'],
          Oauth2c: ['https://mail.google.com/'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.modify'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'],
        },
      ],
      tags: ['users'],
    },
  },
  '/gmail/v1/users/{userId}/messages/{id}/untrash': {
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
      },
      {
        $ref: '#/components/parameters/fields',
      },
      {
        $ref: '#/components/parameters/key',
      },
      {
        $ref: '#/components/parameters/oauth_token',
      },
      {
        $ref: '#/components/parameters/prettyPrint',
      },
      {
        $ref: '#/components/parameters/quotaUser',
      },
      {
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
    post: {
      description: 'Removes the specified message from the trash.',
      operationId: 'gmail.users.messages.untrash',
      parameters: [
        {
          description:
            "The user's email address. The special value `me` can be used to indicate the authenticated user.",
          in: 'path',
          name: 'userId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'The ID of the message to remove from Trash.',
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Message',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://mail.google.com/'],
          Oauth2c: ['https://mail.google.com/'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.modify'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'],
        },
      ],
      tags: ['users'],
    },
  },
  '/gmail/v1/users/{userId}/messages/{messageId}/attachments/{id}': {
    get: {
      description: 'Gets the specified message attachment.',
      operationId: 'gmail.users.messages.attachments.get',
      parameters: [
        {
          description:
            "The user's email address. The special value `me` can be used to indicate the authenticated user.",
          in: 'path',
          name: 'userId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'The ID of the message containing the attachment.',
          in: 'path',
          name: 'messageId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'The ID of the attachment.',
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/MessagePartBody',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://mail.google.com/'],
          Oauth2c: ['https://mail.google.com/'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.addons.current.message.action'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.addons.current.message.action'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.addons.current.message.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.addons.current.message.readonly'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.modify'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.readonly'],
        },
      ],
      tags: ['users'],
    },
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
      },
      {
        $ref: '#/components/parameters/fields',
      },
      {
        $ref: '#/components/parameters/key',
      },
      {
        $ref: '#/components/parameters/oauth_token',
      },
      {
        $ref: '#/components/parameters/prettyPrint',
      },
      {
        $ref: '#/components/parameters/quotaUser',
      },
      {
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
  },
  '/gmail/v1/users/{userId}/profile': {
    get: {
      description: "Gets the current user's Gmail profile.",
      operationId: 'gmail.users.getProfile',
      parameters: [
        {
          description:
            "The user's email address. The special value `me` can be used to indicate the authenticated user.",
          in: 'path',
          name: 'userId',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Profile',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://mail.google.com/'],
          Oauth2c: ['https://mail.google.com/'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.compose'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.compose'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.metadata'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.metadata'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.modify'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.readonly'],
        },
      ],
      tags: ['users'],
    },
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
      },
      {
        $ref: '#/components/parameters/fields',
      },
      {
        $ref: '#/components/parameters/key',
      },
      {
        $ref: '#/components/parameters/oauth_token',
      },
      {
        $ref: '#/components/parameters/prettyPrint',
      },
      {
        $ref: '#/components/parameters/quotaUser',
      },
      {
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
  },
  '/gmail/v1/users/{userId}/settings/autoForwarding': {
    get: {
      description: 'Gets the auto-forwarding setting for the specified account.',
      operationId: 'gmail.users.settings.getAutoForwarding',
      parameters: [
        {
          description: 'User\'s email address. The special value "me" can be used to indicate the authenticated user.',
          in: 'path',
          name: 'userId',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/AutoForwarding',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://mail.google.com/'],
          Oauth2c: ['https://mail.google.com/'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.modify'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.readonly'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.settings.basic'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.basic'],
        },
      ],
      tags: ['users'],
    },
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
      },
      {
        $ref: '#/components/parameters/fields',
      },
      {
        $ref: '#/components/parameters/key',
      },
      {
        $ref: '#/components/parameters/oauth_token',
      },
      {
        $ref: '#/components/parameters/prettyPrint',
      },
      {
        $ref: '#/components/parameters/quotaUser',
      },
      {
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
    put: {
      description:
        'Updates the auto-forwarding setting for the specified account. A verified forwarding address must be specified when auto-forwarding is enabled. This method is only available to service account clients that have been delegated domain-wide authority.',
      operationId: 'gmail.users.settings.updateAutoForwarding',
      parameters: [
        {
          description: 'User\'s email address. The special value "me" can be used to indicate the authenticated user.',
          in: 'path',
          name: 'userId',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/AutoForwarding',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/AutoForwarding',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.settings.sharing'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.sharing'],
        },
      ],
      tags: ['users'],
    },
  },
  '/gmail/v1/users/{userId}/settings/cse/identities': {
    get: {
      description: 'Lists the client-side encrypted identities for an authenticated user.',
      operationId: 'gmail.users.settings.cse.identities.list',
      parameters: [
        {
          description:
            "The requester's primary email address. To indicate the authenticated user, you can use the special value `me`.",
          in: 'path',
          name: 'userId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'The number of identities to return. If not provided, the page size will default to 20 entries.',
          in: 'query',
          name: 'pageSize',
          schema: {
            type: 'integer',
          },
        },
        {
          description:
            'Pagination token indicating which page of identities to return. If the token is not supplied, then the API will return the first page of results.',
          in: 'query',
          name: 'pageToken',
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ListCseIdentitiesResponse',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://mail.google.com/'],
          Oauth2c: ['https://mail.google.com/'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.modify'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.readonly'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.settings.basic'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.basic'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.settings.sharing'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.sharing'],
        },
      ],
      tags: ['users'],
    },
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
      },
      {
        $ref: '#/components/parameters/fields',
      },
      {
        $ref: '#/components/parameters/key',
      },
      {
        $ref: '#/components/parameters/oauth_token',
      },
      {
        $ref: '#/components/parameters/prettyPrint',
      },
      {
        $ref: '#/components/parameters/quotaUser',
      },
      {
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
    post: {
      description:
        "Creates and configures a client-side encryption identity that's authorized to send mail from the user account. Google publishes the S/MIME certificate to a shared domain-wide directory so that people within a Google Workspace organization can encrypt and send mail to the identity.",
      operationId: 'gmail.users.settings.cse.identities.create',
      parameters: [
        {
          description:
            "The requester's primary email address. To indicate the authenticated user, you can use the special value `me`.",
          in: 'path',
          name: 'userId',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/CseIdentity',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CseIdentity',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.settings.basic'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.basic'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.settings.sharing'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.sharing'],
        },
      ],
      tags: ['users'],
    },
  },
  '/gmail/v1/users/{userId}/settings/cse/identities/{cseEmailAddress}': {
    delete: {
      description:
        'Deletes a client-side encryption identity. The authenticated user can no longer use the identity to send encrypted messages. You cannot restore the identity after you delete it. Instead, use the CreateCseIdentity method to create another identity with the same configuration.',
      operationId: 'gmail.users.settings.cse.identities.delete',
      parameters: [
        {
          description:
            "The requester's primary email address. To indicate the authenticated user, you can use the special value `me`.",
          in: 'path',
          name: 'userId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description:
            "The primary email address associated with the client-side encryption identity configuration that's removed.",
          in: 'path',
          name: 'cseEmailAddress',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.settings.basic'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.basic'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.settings.sharing'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.sharing'],
        },
      ],
      tags: ['users'],
    },
    get: {
      description: 'Retrieves a client-side encryption identity configuration.',
      operationId: 'gmail.users.settings.cse.identities.get',
      parameters: [
        {
          description:
            "The requester's primary email address. To indicate the authenticated user, you can use the special value `me`.",
          in: 'path',
          name: 'userId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description:
            "The primary email address associated with the client-side encryption identity configuration that's retrieved.",
          in: 'path',
          name: 'cseEmailAddress',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CseIdentity',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://mail.google.com/'],
          Oauth2c: ['https://mail.google.com/'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.modify'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.readonly'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.settings.basic'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.basic'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.settings.sharing'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.sharing'],
        },
      ],
      tags: ['users'],
    },
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
      },
      {
        $ref: '#/components/parameters/fields',
      },
      {
        $ref: '#/components/parameters/key',
      },
      {
        $ref: '#/components/parameters/oauth_token',
      },
      {
        $ref: '#/components/parameters/prettyPrint',
      },
      {
        $ref: '#/components/parameters/quotaUser',
      },
      {
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
  },
  '/gmail/v1/users/{userId}/settings/cse/identities/{emailAddress}': {
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
      },
      {
        $ref: '#/components/parameters/fields',
      },
      {
        $ref: '#/components/parameters/key',
      },
      {
        $ref: '#/components/parameters/oauth_token',
      },
      {
        $ref: '#/components/parameters/prettyPrint',
      },
      {
        $ref: '#/components/parameters/quotaUser',
      },
      {
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
    patch: {
      description:
        "Associates a different key pair with an existing client-side encryption identity. The updated key pair must validate against Google's [S/MIME certificate profiles](https://support.google.com/a/answer/7300887).",
      operationId: 'gmail.users.settings.cse.identities.patch',
      parameters: [
        {
          description:
            "The requester's primary email address. To indicate the authenticated user, you can use the special value `me`.",
          in: 'path',
          name: 'userId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'The email address of the client-side encryption identity to update.',
          in: 'path',
          name: 'emailAddress',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/CseIdentity',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CseIdentity',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.settings.basic'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.basic'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.settings.sharing'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.sharing'],
        },
      ],
      tags: ['users'],
    },
  },
  '/gmail/v1/users/{userId}/settings/cse/keypairs': {
    get: {
      description: 'Lists client-side encryption key pairs for an authenticated user.',
      operationId: 'gmail.users.settings.cse.keypairs.list',
      parameters: [
        {
          description:
            "The requester's primary email address. To indicate the authenticated user, you can use the special value `me`.",
          in: 'path',
          name: 'userId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'The number of key pairs to return. If not provided, the page size will default to 20 entries.',
          in: 'query',
          name: 'pageSize',
          schema: {
            type: 'integer',
          },
        },
        {
          description:
            'Pagination token indicating which page of key pairs to return. If the token is not supplied, then the API will return the first page of results.',
          in: 'query',
          name: 'pageToken',
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ListCseKeyPairsResponse',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://mail.google.com/'],
          Oauth2c: ['https://mail.google.com/'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.modify'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.readonly'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.settings.basic'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.basic'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.settings.sharing'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.sharing'],
        },
      ],
      tags: ['users'],
    },
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
      },
      {
        $ref: '#/components/parameters/fields',
      },
      {
        $ref: '#/components/parameters/key',
      },
      {
        $ref: '#/components/parameters/oauth_token',
      },
      {
        $ref: '#/components/parameters/prettyPrint',
      },
      {
        $ref: '#/components/parameters/quotaUser',
      },
      {
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
    post: {
      description:
        'Creates and uploads a client-side encryption S/MIME public key certificate chain and private key metadata for the authenticated user.',
      operationId: 'gmail.users.settings.cse.keypairs.create',
      parameters: [
        {
          description:
            "The requester's primary email address. To indicate the authenticated user, you can use the special value `me`.",
          in: 'path',
          name: 'userId',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/CseKeyPair',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CseKeyPair',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.settings.basic'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.basic'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.settings.sharing'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.sharing'],
        },
      ],
      tags: ['users'],
    },
  },
  '/gmail/v1/users/{userId}/settings/cse/keypairs/{keyPairId}': {
    get: {
      description: 'Retrieves an existing client-side encryption key pair.',
      operationId: 'gmail.users.settings.cse.keypairs.get',
      parameters: [
        {
          description:
            "The requester's primary email address. To indicate the authenticated user, you can use the special value `me`.",
          in: 'path',
          name: 'userId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'The identifier of the key pair to retrieve.',
          in: 'path',
          name: 'keyPairId',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CseKeyPair',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://mail.google.com/'],
          Oauth2c: ['https://mail.google.com/'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.modify'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.readonly'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.settings.basic'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.basic'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.settings.sharing'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.sharing'],
        },
      ],
      tags: ['users'],
    },
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
      },
      {
        $ref: '#/components/parameters/fields',
      },
      {
        $ref: '#/components/parameters/key',
      },
      {
        $ref: '#/components/parameters/oauth_token',
      },
      {
        $ref: '#/components/parameters/prettyPrint',
      },
      {
        $ref: '#/components/parameters/quotaUser',
      },
      {
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
  },
  '/gmail/v1/users/{userId}/settings/cse/keypairs/{keyPairId}:disable': {
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
      },
      {
        $ref: '#/components/parameters/fields',
      },
      {
        $ref: '#/components/parameters/key',
      },
      {
        $ref: '#/components/parameters/oauth_token',
      },
      {
        $ref: '#/components/parameters/prettyPrint',
      },
      {
        $ref: '#/components/parameters/quotaUser',
      },
      {
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
    post: {
      description:
        'Turns off a client-side encryption key pair. The authenticated user can no longer use the key pair to decrypt incoming CSE message texts or sign outgoing CSE mail. To regain access, use the EnableCseKeyPair to turn on the key pair. After 30 days, you can permanently delete the key pair by using the ObliterateCseKeyPair method.',
      operationId: 'gmail.users.settings.cse.keypairs.disable',
      parameters: [
        {
          description:
            "The requester's primary email address. To indicate the authenticated user, you can use the special value `me`.",
          in: 'path',
          name: 'userId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'The identifier of the key pair to turn off.',
          in: 'path',
          name: 'keyPairId',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/DisableCseKeyPairRequest',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CseKeyPair',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.settings.basic'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.basic'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.settings.sharing'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.sharing'],
        },
      ],
      tags: ['users'],
    },
  },
  '/gmail/v1/users/{userId}/settings/cse/keypairs/{keyPairId}:enable': {
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
      },
      {
        $ref: '#/components/parameters/fields',
      },
      {
        $ref: '#/components/parameters/key',
      },
      {
        $ref: '#/components/parameters/oauth_token',
      },
      {
        $ref: '#/components/parameters/prettyPrint',
      },
      {
        $ref: '#/components/parameters/quotaUser',
      },
      {
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
    post: {
      description:
        'Turns on a client-side encryption key pair that was turned off. The key pair becomes active again for any associated client-side encryption identities.',
      operationId: 'gmail.users.settings.cse.keypairs.enable',
      parameters: [
        {
          description:
            "The requester's primary email address. To indicate the authenticated user, you can use the special value `me`.",
          in: 'path',
          name: 'userId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'The identifier of the key pair to turn on.',
          in: 'path',
          name: 'keyPairId',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/EnableCseKeyPairRequest',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CseKeyPair',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.settings.basic'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.basic'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.settings.sharing'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.sharing'],
        },
      ],
      tags: ['users'],
    },
  },
  '/gmail/v1/users/{userId}/settings/cse/keypairs/{keyPairId}:obliterate': {
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
      },
      {
        $ref: '#/components/parameters/fields',
      },
      {
        $ref: '#/components/parameters/key',
      },
      {
        $ref: '#/components/parameters/oauth_token',
      },
      {
        $ref: '#/components/parameters/prettyPrint',
      },
      {
        $ref: '#/components/parameters/quotaUser',
      },
      {
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
    post: {
      description:
        "Deletes a client-side encryption key pair permanently and immediately. You can only permanently delete key pairs that have been turned off for more than 30 days. To turn off a key pair, use the DisableCseKeyPair method. Gmail can't restore or decrypt any messages that were encrypted by an obliterated key. Authenticated users and Google Workspace administrators lose access to reading the encrypted messages.",
      operationId: 'gmail.users.settings.cse.keypairs.obliterate',
      parameters: [
        {
          description:
            "The requester's primary email address. To indicate the authenticated user, you can use the special value `me`.",
          in: 'path',
          name: 'userId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'The identifier of the key pair to obliterate.',
          in: 'path',
          name: 'keyPairId',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/ObliterateCseKeyPairRequest',
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.settings.basic'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.basic'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.settings.sharing'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.sharing'],
        },
      ],
      tags: ['users'],
    },
  },
  '/gmail/v1/users/{userId}/settings/delegates': {
    get: {
      description:
        'Lists the delegates for the specified account. This method is only available to service account clients that have been delegated domain-wide authority.',
      operationId: 'gmail.users.settings.delegates.list',
      parameters: [
        {
          description: 'User\'s email address. The special value "me" can be used to indicate the authenticated user.',
          in: 'path',
          name: 'userId',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ListDelegatesResponse',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://mail.google.com/'],
          Oauth2c: ['https://mail.google.com/'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.modify'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.readonly'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.settings.basic'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.basic'],
        },
      ],
      tags: ['users'],
    },
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
      },
      {
        $ref: '#/components/parameters/fields',
      },
      {
        $ref: '#/components/parameters/key',
      },
      {
        $ref: '#/components/parameters/oauth_token',
      },
      {
        $ref: '#/components/parameters/prettyPrint',
      },
      {
        $ref: '#/components/parameters/quotaUser',
      },
      {
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
    post: {
      description:
        'Adds a delegate with its verification status set directly to `accepted`, without sending any verification email. The delegate user must be a member of the same Google Workspace organization as the delegator user. Gmail imposes limitations on the number of delegates and delegators each user in a Google Workspace organization can have. These limits depend on your organization, but in general each user can have up to 25 delegates and up to 10 delegators. Note that a delegate user must be referred to by their primary email address, and not an email alias. Also note that when a new delegate is created, there may be up to a one minute delay before the new delegate is available for use. This method is only available to service account clients that have been delegated domain-wide authority.',
      operationId: 'gmail.users.settings.delegates.create',
      parameters: [
        {
          description: 'User\'s email address. The special value "me" can be used to indicate the authenticated user.',
          in: 'path',
          name: 'userId',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Delegate',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Delegate',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.settings.sharing'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.sharing'],
        },
      ],
      tags: ['users'],
    },
  },
  '/gmail/v1/users/{userId}/settings/delegates/{delegateEmail}': {
    delete: {
      description:
        'Removes the specified delegate (which can be of any verification status), and revokes any verification that may have been required for using it. Note that a delegate user must be referred to by their primary email address, and not an email alias. This method is only available to service account clients that have been delegated domain-wide authority.',
      operationId: 'gmail.users.settings.delegates.delete',
      parameters: [
        {
          description: 'User\'s email address. The special value "me" can be used to indicate the authenticated user.',
          in: 'path',
          name: 'userId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'The email address of the user to be removed as a delegate.',
          in: 'path',
          name: 'delegateEmail',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.settings.sharing'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.sharing'],
        },
      ],
      tags: ['users'],
    },
    get: {
      description:
        'Gets the specified delegate. Note that a delegate user must be referred to by their primary email address, and not an email alias. This method is only available to service account clients that have been delegated domain-wide authority.',
      operationId: 'gmail.users.settings.delegates.get',
      parameters: [
        {
          description: 'User\'s email address. The special value "me" can be used to indicate the authenticated user.',
          in: 'path',
          name: 'userId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'The email address of the user whose delegate relationship is to be retrieved.',
          in: 'path',
          name: 'delegateEmail',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Delegate',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://mail.google.com/'],
          Oauth2c: ['https://mail.google.com/'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.modify'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.readonly'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.settings.basic'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.basic'],
        },
      ],
      tags: ['users'],
    },
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
      },
      {
        $ref: '#/components/parameters/fields',
      },
      {
        $ref: '#/components/parameters/key',
      },
      {
        $ref: '#/components/parameters/oauth_token',
      },
      {
        $ref: '#/components/parameters/prettyPrint',
      },
      {
        $ref: '#/components/parameters/quotaUser',
      },
      {
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
  },
  '/gmail/v1/users/{userId}/settings/filters': {
    get: {
      description: 'Lists the message filters of a Gmail user.',
      operationId: 'gmail.users.settings.filters.list',
      parameters: [
        {
          description: 'User\'s email address. The special value "me" can be used to indicate the authenticated user.',
          in: 'path',
          name: 'userId',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ListFiltersResponse',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://mail.google.com/'],
          Oauth2c: ['https://mail.google.com/'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.modify'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.readonly'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.settings.basic'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.basic'],
        },
      ],
      tags: ['users'],
    },
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
      },
      {
        $ref: '#/components/parameters/fields',
      },
      {
        $ref: '#/components/parameters/key',
      },
      {
        $ref: '#/components/parameters/oauth_token',
      },
      {
        $ref: '#/components/parameters/prettyPrint',
      },
      {
        $ref: '#/components/parameters/quotaUser',
      },
      {
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
    post: {
      description: 'Creates a filter. Note: you can only create a maximum of 1,000 filters.',
      operationId: 'gmail.users.settings.filters.create',
      parameters: [
        {
          description: 'User\'s email address. The special value "me" can be used to indicate the authenticated user.',
          in: 'path',
          name: 'userId',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Filter',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Filter',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.settings.basic'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.basic'],
        },
      ],
      tags: ['users'],
    },
  },
  '/gmail/v1/users/{userId}/settings/filters/{id}': {
    delete: {
      description: 'Immediately and permanently deletes the specified filter.',
      operationId: 'gmail.users.settings.filters.delete',
      parameters: [
        {
          description: 'User\'s email address. The special value "me" can be used to indicate the authenticated user.',
          in: 'path',
          name: 'userId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'The ID of the filter to be deleted.',
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.settings.basic'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.basic'],
        },
      ],
      tags: ['users'],
    },
    get: {
      description: 'Gets a filter.',
      operationId: 'gmail.users.settings.filters.get',
      parameters: [
        {
          description: 'User\'s email address. The special value "me" can be used to indicate the authenticated user.',
          in: 'path',
          name: 'userId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'The ID of the filter to be fetched.',
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Filter',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://mail.google.com/'],
          Oauth2c: ['https://mail.google.com/'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.modify'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.readonly'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.settings.basic'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.basic'],
        },
      ],
      tags: ['users'],
    },
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
      },
      {
        $ref: '#/components/parameters/fields',
      },
      {
        $ref: '#/components/parameters/key',
      },
      {
        $ref: '#/components/parameters/oauth_token',
      },
      {
        $ref: '#/components/parameters/prettyPrint',
      },
      {
        $ref: '#/components/parameters/quotaUser',
      },
      {
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
  },
  '/gmail/v1/users/{userId}/settings/forwardingAddresses': {
    get: {
      description: 'Lists the forwarding addresses for the specified account.',
      operationId: 'gmail.users.settings.forwardingAddresses.list',
      parameters: [
        {
          description: 'User\'s email address. The special value "me" can be used to indicate the authenticated user.',
          in: 'path',
          name: 'userId',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ListForwardingAddressesResponse',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://mail.google.com/'],
          Oauth2c: ['https://mail.google.com/'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.modify'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.readonly'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.settings.basic'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.basic'],
        },
      ],
      tags: ['users'],
    },
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
      },
      {
        $ref: '#/components/parameters/fields',
      },
      {
        $ref: '#/components/parameters/key',
      },
      {
        $ref: '#/components/parameters/oauth_token',
      },
      {
        $ref: '#/components/parameters/prettyPrint',
      },
      {
        $ref: '#/components/parameters/quotaUser',
      },
      {
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
    post: {
      description:
        "Creates a forwarding address. If ownership verification is required, a message will be sent to the recipient and the resource's verification status will be set to `pending`; otherwise, the resource will be created with verification status set to `accepted`. This method is only available to service account clients that have been delegated domain-wide authority.",
      operationId: 'gmail.users.settings.forwardingAddresses.create',
      parameters: [
        {
          description: 'User\'s email address. The special value "me" can be used to indicate the authenticated user.',
          in: 'path',
          name: 'userId',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/ForwardingAddress',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ForwardingAddress',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.settings.sharing'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.sharing'],
        },
      ],
      tags: ['users'],
    },
  },
  '/gmail/v1/users/{userId}/settings/forwardingAddresses/{forwardingEmail}': {
    delete: {
      description:
        'Deletes the specified forwarding address and revokes any verification that may have been required. This method is only available to service account clients that have been delegated domain-wide authority.',
      operationId: 'gmail.users.settings.forwardingAddresses.delete',
      parameters: [
        {
          description: 'User\'s email address. The special value "me" can be used to indicate the authenticated user.',
          in: 'path',
          name: 'userId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'The forwarding address to be deleted.',
          in: 'path',
          name: 'forwardingEmail',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.settings.sharing'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.sharing'],
        },
      ],
      tags: ['users'],
    },
    get: {
      description: 'Gets the specified forwarding address.',
      operationId: 'gmail.users.settings.forwardingAddresses.get',
      parameters: [
        {
          description: 'User\'s email address. The special value "me" can be used to indicate the authenticated user.',
          in: 'path',
          name: 'userId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'The forwarding address to be retrieved.',
          in: 'path',
          name: 'forwardingEmail',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ForwardingAddress',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://mail.google.com/'],
          Oauth2c: ['https://mail.google.com/'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.modify'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.readonly'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.settings.basic'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.basic'],
        },
      ],
      tags: ['users'],
    },
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
      },
      {
        $ref: '#/components/parameters/fields',
      },
      {
        $ref: '#/components/parameters/key',
      },
      {
        $ref: '#/components/parameters/oauth_token',
      },
      {
        $ref: '#/components/parameters/prettyPrint',
      },
      {
        $ref: '#/components/parameters/quotaUser',
      },
      {
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
  },
  '/gmail/v1/users/{userId}/settings/imap': {
    get: {
      description: 'Gets IMAP settings.',
      operationId: 'gmail.users.settings.getImap',
      parameters: [
        {
          description: 'User\'s email address. The special value "me" can be used to indicate the authenticated user.',
          in: 'path',
          name: 'userId',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ImapSettings',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://mail.google.com/'],
          Oauth2c: ['https://mail.google.com/'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.modify'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.readonly'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.settings.basic'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.basic'],
        },
      ],
      tags: ['users'],
    },
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
      },
      {
        $ref: '#/components/parameters/fields',
      },
      {
        $ref: '#/components/parameters/key',
      },
      {
        $ref: '#/components/parameters/oauth_token',
      },
      {
        $ref: '#/components/parameters/prettyPrint',
      },
      {
        $ref: '#/components/parameters/quotaUser',
      },
      {
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
    put: {
      description: 'Updates IMAP settings.',
      operationId: 'gmail.users.settings.updateImap',
      parameters: [
        {
          description: 'User\'s email address. The special value "me" can be used to indicate the authenticated user.',
          in: 'path',
          name: 'userId',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/ImapSettings',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ImapSettings',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.settings.basic'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.basic'],
        },
      ],
      tags: ['users'],
    },
  },
  '/gmail/v1/users/{userId}/settings/language': {
    get: {
      description: 'Gets language settings.',
      operationId: 'gmail.users.settings.getLanguage',
      parameters: [
        {
          description: 'User\'s email address. The special value "me" can be used to indicate the authenticated user.',
          in: 'path',
          name: 'userId',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/LanguageSettings',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://mail.google.com/'],
          Oauth2c: ['https://mail.google.com/'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.modify'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.readonly'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.settings.basic'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.basic'],
        },
      ],
      tags: ['users'],
    },
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
      },
      {
        $ref: '#/components/parameters/fields',
      },
      {
        $ref: '#/components/parameters/key',
      },
      {
        $ref: '#/components/parameters/oauth_token',
      },
      {
        $ref: '#/components/parameters/prettyPrint',
      },
      {
        $ref: '#/components/parameters/quotaUser',
      },
      {
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
    put: {
      description:
        'Updates language settings. If successful, the return object contains the `displayLanguage` that was saved for the user, which may differ from the value passed into the request. This is because the requested `displayLanguage` may not be directly supported by Gmail but have a close variant that is, and so the variant may be chosen and saved instead.',
      operationId: 'gmail.users.settings.updateLanguage',
      parameters: [
        {
          description: 'User\'s email address. The special value "me" can be used to indicate the authenticated user.',
          in: 'path',
          name: 'userId',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/LanguageSettings',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/LanguageSettings',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.settings.basic'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.basic'],
        },
      ],
      tags: ['users'],
    },
  },
  '/gmail/v1/users/{userId}/settings/pop': {
    get: {
      description: 'Gets POP settings.',
      operationId: 'gmail.users.settings.getPop',
      parameters: [
        {
          description: 'User\'s email address. The special value "me" can be used to indicate the authenticated user.',
          in: 'path',
          name: 'userId',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PopSettings',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://mail.google.com/'],
          Oauth2c: ['https://mail.google.com/'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.modify'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.readonly'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.settings.basic'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.basic'],
        },
      ],
      tags: ['users'],
    },
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
      },
      {
        $ref: '#/components/parameters/fields',
      },
      {
        $ref: '#/components/parameters/key',
      },
      {
        $ref: '#/components/parameters/oauth_token',
      },
      {
        $ref: '#/components/parameters/prettyPrint',
      },
      {
        $ref: '#/components/parameters/quotaUser',
      },
      {
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
    put: {
      description: 'Updates POP settings.',
      operationId: 'gmail.users.settings.updatePop',
      parameters: [
        {
          description: 'User\'s email address. The special value "me" can be used to indicate the authenticated user.',
          in: 'path',
          name: 'userId',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/PopSettings',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PopSettings',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.settings.basic'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.basic'],
        },
      ],
      tags: ['users'],
    },
  },
  '/gmail/v1/users/{userId}/settings/sendAs': {
    get: {
      description:
        'Lists the send-as aliases for the specified account. The result includes the primary send-as address associated with the account as well as any custom "from" aliases.',
      operationId: 'gmail.users.settings.sendAs.list',
      parameters: [
        {
          description: 'User\'s email address. The special value "me" can be used to indicate the authenticated user.',
          in: 'path',
          name: 'userId',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ListSendAsResponse',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://mail.google.com/'],
          Oauth2c: ['https://mail.google.com/'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.modify'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.readonly'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.settings.basic'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.basic'],
        },
      ],
      tags: ['users'],
    },
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
      },
      {
        $ref: '#/components/parameters/fields',
      },
      {
        $ref: '#/components/parameters/key',
      },
      {
        $ref: '#/components/parameters/oauth_token',
      },
      {
        $ref: '#/components/parameters/prettyPrint',
      },
      {
        $ref: '#/components/parameters/quotaUser',
      },
      {
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
    post: {
      description:
        'Creates a custom "from" send-as alias. If an SMTP MSA is specified, Gmail will attempt to connect to the SMTP service to validate the configuration before creating the alias. If ownership verification is required for the alias, a message will be sent to the email address and the resource\'s verification status will be set to `pending`; otherwise, the resource will be created with verification status set to `accepted`. If a signature is provided, Gmail will sanitize the HTML before saving it with the alias. This method is only available to service account clients that have been delegated domain-wide authority.',
      operationId: 'gmail.users.settings.sendAs.create',
      parameters: [
        {
          description: 'User\'s email address. The special value "me" can be used to indicate the authenticated user.',
          in: 'path',
          name: 'userId',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/SendAs',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/SendAs',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.settings.sharing'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.sharing'],
        },
      ],
      tags: ['users'],
    },
  },
  '/gmail/v1/users/{userId}/settings/sendAs/{sendAsEmail}': {
    delete: {
      description:
        'Deletes the specified send-as alias. Revokes any verification that may have been required for using it. This method is only available to service account clients that have been delegated domain-wide authority.',
      operationId: 'gmail.users.settings.sendAs.delete',
      parameters: [
        {
          description: 'User\'s email address. The special value "me" can be used to indicate the authenticated user.',
          in: 'path',
          name: 'userId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'The send-as alias to be deleted.',
          in: 'path',
          name: 'sendAsEmail',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.settings.sharing'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.sharing'],
        },
      ],
      tags: ['users'],
    },
    get: {
      description:
        'Gets the specified send-as alias. Fails with an HTTP 404 error if the specified address is not a member of the collection.',
      operationId: 'gmail.users.settings.sendAs.get',
      parameters: [
        {
          description: 'User\'s email address. The special value "me" can be used to indicate the authenticated user.',
          in: 'path',
          name: 'userId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'The send-as alias to be retrieved.',
          in: 'path',
          name: 'sendAsEmail',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/SendAs',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://mail.google.com/'],
          Oauth2c: ['https://mail.google.com/'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.modify'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.readonly'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.settings.basic'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.basic'],
        },
      ],
      tags: ['users'],
    },
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
      },
      {
        $ref: '#/components/parameters/fields',
      },
      {
        $ref: '#/components/parameters/key',
      },
      {
        $ref: '#/components/parameters/oauth_token',
      },
      {
        $ref: '#/components/parameters/prettyPrint',
      },
      {
        $ref: '#/components/parameters/quotaUser',
      },
      {
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
    patch: {
      description: 'Patch the specified send-as alias.',
      operationId: 'gmail.users.settings.sendAs.patch',
      parameters: [
        {
          description: 'User\'s email address. The special value "me" can be used to indicate the authenticated user.',
          in: 'path',
          name: 'userId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'The send-as alias to be updated.',
          in: 'path',
          name: 'sendAsEmail',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/SendAs',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/SendAs',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.settings.basic'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.basic'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.settings.sharing'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.sharing'],
        },
      ],
      tags: ['users'],
    },
    put: {
      description:
        'Updates a send-as alias. If a signature is provided, Gmail will sanitize the HTML before saving it with the alias. Addresses other than the primary address for the account can only be updated by service account clients that have been delegated domain-wide authority.',
      operationId: 'gmail.users.settings.sendAs.update',
      parameters: [
        {
          description: 'User\'s email address. The special value "me" can be used to indicate the authenticated user.',
          in: 'path',
          name: 'userId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'The send-as alias to be updated.',
          in: 'path',
          name: 'sendAsEmail',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/SendAs',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/SendAs',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.settings.basic'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.basic'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.settings.sharing'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.sharing'],
        },
      ],
      tags: ['users'],
    },
  },
  '/gmail/v1/users/{userId}/settings/sendAs/{sendAsEmail}/smimeInfo': {
    get: {
      description: 'Lists S/MIME configs for the specified send-as alias.',
      operationId: 'gmail.users.settings.sendAs.smimeInfo.list',
      parameters: [
        {
          description:
            "The user's email address. The special value `me` can be used to indicate the authenticated user.",
          in: 'path',
          name: 'userId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'The email address that appears in the "From:" header for mail sent using this alias.',
          in: 'path',
          name: 'sendAsEmail',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ListSmimeInfoResponse',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://mail.google.com/'],
          Oauth2c: ['https://mail.google.com/'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.modify'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.readonly'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.settings.basic'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.basic'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.settings.sharing'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.sharing'],
        },
      ],
      tags: ['users'],
    },
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
      },
      {
        $ref: '#/components/parameters/fields',
      },
      {
        $ref: '#/components/parameters/key',
      },
      {
        $ref: '#/components/parameters/oauth_token',
      },
      {
        $ref: '#/components/parameters/prettyPrint',
      },
      {
        $ref: '#/components/parameters/quotaUser',
      },
      {
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
    post: {
      description:
        'Insert (upload) the given S/MIME config for the specified send-as alias. Note that pkcs12 format is required for the key.',
      operationId: 'gmail.users.settings.sendAs.smimeInfo.insert',
      parameters: [
        {
          description:
            "The user's email address. The special value `me` can be used to indicate the authenticated user.",
          in: 'path',
          name: 'userId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'The email address that appears in the "From:" header for mail sent using this alias.',
          in: 'path',
          name: 'sendAsEmail',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/SmimeInfo',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/SmimeInfo',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.settings.basic'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.basic'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.settings.sharing'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.sharing'],
        },
      ],
      tags: ['users'],
    },
  },
  '/gmail/v1/users/{userId}/settings/sendAs/{sendAsEmail}/smimeInfo/{id}': {
    delete: {
      description: 'Deletes the specified S/MIME config for the specified send-as alias.',
      operationId: 'gmail.users.settings.sendAs.smimeInfo.delete',
      parameters: [
        {
          description:
            "The user's email address. The special value `me` can be used to indicate the authenticated user.",
          in: 'path',
          name: 'userId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'The email address that appears in the "From:" header for mail sent using this alias.',
          in: 'path',
          name: 'sendAsEmail',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'The immutable ID for the SmimeInfo.',
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.settings.basic'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.basic'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.settings.sharing'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.sharing'],
        },
      ],
      tags: ['users'],
    },
    get: {
      description: 'Gets the specified S/MIME config for the specified send-as alias.',
      operationId: 'gmail.users.settings.sendAs.smimeInfo.get',
      parameters: [
        {
          description:
            "The user's email address. The special value `me` can be used to indicate the authenticated user.",
          in: 'path',
          name: 'userId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'The email address that appears in the "From:" header for mail sent using this alias.',
          in: 'path',
          name: 'sendAsEmail',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'The immutable ID for the SmimeInfo.',
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/SmimeInfo',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://mail.google.com/'],
          Oauth2c: ['https://mail.google.com/'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.modify'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.readonly'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.settings.basic'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.basic'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.settings.sharing'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.sharing'],
        },
      ],
      tags: ['users'],
    },
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
      },
      {
        $ref: '#/components/parameters/fields',
      },
      {
        $ref: '#/components/parameters/key',
      },
      {
        $ref: '#/components/parameters/oauth_token',
      },
      {
        $ref: '#/components/parameters/prettyPrint',
      },
      {
        $ref: '#/components/parameters/quotaUser',
      },
      {
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
  },
  '/gmail/v1/users/{userId}/settings/sendAs/{sendAsEmail}/smimeInfo/{id}/setDefault': {
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
      },
      {
        $ref: '#/components/parameters/fields',
      },
      {
        $ref: '#/components/parameters/key',
      },
      {
        $ref: '#/components/parameters/oauth_token',
      },
      {
        $ref: '#/components/parameters/prettyPrint',
      },
      {
        $ref: '#/components/parameters/quotaUser',
      },
      {
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
    post: {
      description: 'Sets the default S/MIME config for the specified send-as alias.',
      operationId: 'gmail.users.settings.sendAs.smimeInfo.setDefault',
      parameters: [
        {
          description:
            "The user's email address. The special value `me` can be used to indicate the authenticated user.",
          in: 'path',
          name: 'userId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'The email address that appears in the "From:" header for mail sent using this alias.',
          in: 'path',
          name: 'sendAsEmail',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'The immutable ID for the SmimeInfo.',
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.settings.basic'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.basic'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.settings.sharing'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.sharing'],
        },
      ],
      tags: ['users'],
    },
  },
  '/gmail/v1/users/{userId}/settings/sendAs/{sendAsEmail}/verify': {
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
      },
      {
        $ref: '#/components/parameters/fields',
      },
      {
        $ref: '#/components/parameters/key',
      },
      {
        $ref: '#/components/parameters/oauth_token',
      },
      {
        $ref: '#/components/parameters/prettyPrint',
      },
      {
        $ref: '#/components/parameters/quotaUser',
      },
      {
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
    post: {
      description:
        'Sends a verification email to the specified send-as alias address. The verification status must be `pending`. This method is only available to service account clients that have been delegated domain-wide authority.',
      operationId: 'gmail.users.settings.sendAs.verify',
      parameters: [
        {
          description: 'User\'s email address. The special value "me" can be used to indicate the authenticated user.',
          in: 'path',
          name: 'userId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'The send-as alias to be verified.',
          in: 'path',
          name: 'sendAsEmail',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.settings.sharing'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.sharing'],
        },
      ],
      tags: ['users'],
    },
  },
  '/gmail/v1/users/{userId}/settings/vacation': {
    get: {
      description: 'Gets vacation responder settings.',
      operationId: 'gmail.users.settings.getVacation',
      parameters: [
        {
          description: 'User\'s email address. The special value "me" can be used to indicate the authenticated user.',
          in: 'path',
          name: 'userId',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/VacationSettings',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://mail.google.com/'],
          Oauth2c: ['https://mail.google.com/'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.modify'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.readonly'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.settings.basic'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.basic'],
        },
      ],
      tags: ['users'],
    },
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
      },
      {
        $ref: '#/components/parameters/fields',
      },
      {
        $ref: '#/components/parameters/key',
      },
      {
        $ref: '#/components/parameters/oauth_token',
      },
      {
        $ref: '#/components/parameters/prettyPrint',
      },
      {
        $ref: '#/components/parameters/quotaUser',
      },
      {
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
    put: {
      description: 'Updates vacation responder settings.',
      operationId: 'gmail.users.settings.updateVacation',
      parameters: [
        {
          description: 'User\'s email address. The special value "me" can be used to indicate the authenticated user.',
          in: 'path',
          name: 'userId',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/VacationSettings',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/VacationSettings',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.settings.basic'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.settings.basic'],
        },
      ],
      tags: ['users'],
    },
  },
  '/gmail/v1/users/{userId}/stop': {
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
      },
      {
        $ref: '#/components/parameters/fields',
      },
      {
        $ref: '#/components/parameters/key',
      },
      {
        $ref: '#/components/parameters/oauth_token',
      },
      {
        $ref: '#/components/parameters/prettyPrint',
      },
      {
        $ref: '#/components/parameters/quotaUser',
      },
      {
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
    post: {
      description: 'Stop receiving push notifications for the given user mailbox.',
      operationId: 'gmail.users.stop',
      parameters: [
        {
          description:
            "The user's email address. The special value `me` can be used to indicate the authenticated user.",
          in: 'path',
          name: 'userId',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://mail.google.com/'],
          Oauth2c: ['https://mail.google.com/'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.metadata'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.metadata'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.modify'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.readonly'],
        },
      ],
      tags: ['users'],
    },
  },
  '/gmail/v1/users/{userId}/threads': {
    get: {
      description: "Lists the threads in the user's mailbox.",
      operationId: 'gmail.users.threads.list',
      parameters: [
        {
          description:
            "The user's email address. The special value `me` can be used to indicate the authenticated user.",
          in: 'path',
          name: 'userId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Include threads from `SPAM` and `TRASH` in the results.',
          in: 'query',
          name: 'includeSpamTrash',
          schema: {
            type: 'boolean',
          },
        },
        {
          description: 'Only return threads with labels that match all of the specified label IDs.',
          explode: true,
          in: 'query',
          name: 'labelIds',
          schema: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description:
            'Maximum number of threads to return. This field defaults to 100. The maximum allowed value for this field is 500.',
          in: 'query',
          name: 'maxResults',
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'Page token to retrieve a specific page of results in the list.',
          in: 'query',
          name: 'pageToken',
          schema: {
            type: 'string',
          },
        },
        {
          description:
            'Only return threads matching the specified query. Supports the same query format as the Gmail search box. For example, `"from:someuser@example.com rfc822msgid: is:unread"`. Parameter cannot be used when accessing the api using the gmail.metadata scope.',
          in: 'query',
          name: 'q',
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ListThreadsResponse',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://mail.google.com/'],
          Oauth2c: ['https://mail.google.com/'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.metadata'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.metadata'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.modify'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.readonly'],
        },
      ],
      tags: ['users'],
    },
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
      },
      {
        $ref: '#/components/parameters/fields',
      },
      {
        $ref: '#/components/parameters/key',
      },
      {
        $ref: '#/components/parameters/oauth_token',
      },
      {
        $ref: '#/components/parameters/prettyPrint',
      },
      {
        $ref: '#/components/parameters/quotaUser',
      },
      {
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
  },
  '/gmail/v1/users/{userId}/threads/{id}': {
    delete: {
      description:
        'Immediately and permanently deletes the specified thread. Any messages that belong to the thread are also deleted. This operation cannot be undone. Prefer `threads.trash` instead.',
      operationId: 'gmail.users.threads.delete',
      parameters: [
        {
          description:
            "The user's email address. The special value `me` can be used to indicate the authenticated user.",
          in: 'path',
          name: 'userId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'ID of the Thread to delete.',
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://mail.google.com/'],
          Oauth2c: ['https://mail.google.com/'],
        },
      ],
      tags: ['users'],
    },
    get: {
      description: 'Gets the specified thread.',
      operationId: 'gmail.users.threads.get',
      parameters: [
        {
          description:
            "The user's email address. The special value `me` can be used to indicate the authenticated user.",
          in: 'path',
          name: 'userId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'The ID of the thread to retrieve.',
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'The format to return the messages in.',
          in: 'query',
          name: 'format',
          schema: {
            enum: ['full', 'metadata', 'minimal'],
            type: 'string',
          },
        },
        {
          description: 'When given and format is METADATA, only include headers specified.',
          explode: true,
          in: 'query',
          name: 'metadataHeaders',
          schema: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
          style: 'form',
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Thread',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://mail.google.com/'],
          Oauth2c: ['https://mail.google.com/'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.addons.current.message.action'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.addons.current.message.action'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.addons.current.message.metadata'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.addons.current.message.metadata'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.addons.current.message.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.addons.current.message.readonly'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.metadata'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.metadata'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.modify'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.readonly'],
        },
      ],
      tags: ['users'],
    },
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
      },
      {
        $ref: '#/components/parameters/fields',
      },
      {
        $ref: '#/components/parameters/key',
      },
      {
        $ref: '#/components/parameters/oauth_token',
      },
      {
        $ref: '#/components/parameters/prettyPrint',
      },
      {
        $ref: '#/components/parameters/quotaUser',
      },
      {
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
  },
  '/gmail/v1/users/{userId}/threads/{id}/modify': {
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
      },
      {
        $ref: '#/components/parameters/fields',
      },
      {
        $ref: '#/components/parameters/key',
      },
      {
        $ref: '#/components/parameters/oauth_token',
      },
      {
        $ref: '#/components/parameters/prettyPrint',
      },
      {
        $ref: '#/components/parameters/quotaUser',
      },
      {
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
    post: {
      description: 'Modifies the labels applied to the thread. This applies to all messages in the thread.',
      operationId: 'gmail.users.threads.modify',
      parameters: [
        {
          description:
            "The user's email address. The special value `me` can be used to indicate the authenticated user.",
          in: 'path',
          name: 'userId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'The ID of the thread to modify.',
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/ModifyThreadRequest',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Thread',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://mail.google.com/'],
          Oauth2c: ['https://mail.google.com/'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.modify'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'],
        },
      ],
      tags: ['users'],
    },
  },
  '/gmail/v1/users/{userId}/threads/{id}/trash': {
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
      },
      {
        $ref: '#/components/parameters/fields',
      },
      {
        $ref: '#/components/parameters/key',
      },
      {
        $ref: '#/components/parameters/oauth_token',
      },
      {
        $ref: '#/components/parameters/prettyPrint',
      },
      {
        $ref: '#/components/parameters/quotaUser',
      },
      {
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
    post: {
      description:
        'Moves the specified thread to the trash. Any messages that belong to the thread are also moved to the trash.',
      operationId: 'gmail.users.threads.trash',
      parameters: [
        {
          description:
            "The user's email address. The special value `me` can be used to indicate the authenticated user.",
          in: 'path',
          name: 'userId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'The ID of the thread to Trash.',
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Thread',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://mail.google.com/'],
          Oauth2c: ['https://mail.google.com/'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.modify'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'],
        },
      ],
      tags: ['users'],
    },
  },
  '/gmail/v1/users/{userId}/threads/{id}/untrash': {
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
      },
      {
        $ref: '#/components/parameters/fields',
      },
      {
        $ref: '#/components/parameters/key',
      },
      {
        $ref: '#/components/parameters/oauth_token',
      },
      {
        $ref: '#/components/parameters/prettyPrint',
      },
      {
        $ref: '#/components/parameters/quotaUser',
      },
      {
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
    post: {
      description:
        'Removes the specified thread from the trash. Any messages that belong to the thread are also removed from the trash.',
      operationId: 'gmail.users.threads.untrash',
      parameters: [
        {
          description:
            "The user's email address. The special value `me` can be used to indicate the authenticated user.",
          in: 'path',
          name: 'userId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'The ID of the thread to remove from Trash.',
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Thread',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://mail.google.com/'],
          Oauth2c: ['https://mail.google.com/'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.modify'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'],
        },
      ],
      tags: ['users'],
    },
  },
  '/gmail/v1/users/{userId}/watch': {
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
      },
      {
        $ref: '#/components/parameters/fields',
      },
      {
        $ref: '#/components/parameters/key',
      },
      {
        $ref: '#/components/parameters/oauth_token',
      },
      {
        $ref: '#/components/parameters/prettyPrint',
      },
      {
        $ref: '#/components/parameters/quotaUser',
      },
      {
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
    post: {
      description: 'Set up or update a push notification watch on the given user mailbox.',
      operationId: 'gmail.users.watch',
      parameters: [
        {
          description:
            "The user's email address. The special value `me` can be used to indicate the authenticated user.",
          in: 'path',
          name: 'userId',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/WatchRequest',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/WatchResponse',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://mail.google.com/'],
          Oauth2c: ['https://mail.google.com/'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.metadata'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.metadata'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.modify'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.modify'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/gmail.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/gmail.readonly'],
        },
      ],
      tags: ['users'],
    },
  },
} as TPaths;
