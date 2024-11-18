// @ts-nocheck
export type TPaths = {
  '/v1/documents': {
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
      description: 'Creates a blank document using the title given in the request. Other fields in the request, including any provided content, are ignored. Returns the created document.';
      operationId: 'docs.documents.create';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Document';
            };
          };
        };
      };
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Document';
              };
            };
          };
          description: 'Successful response';
        };
      };
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/documents'];
          Oauth2c: ['https://www.googleapis.com/auth/documents'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive'];
          Oauth2c: ['https://www.googleapis.com/auth/drive'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.file'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.file'];
        },
      ];
      tags: ['documents'];
    };
  };
  '/v1/documents/{documentId}': {
    get: {
      description: 'Gets the latest version of the specified document.';
      operationId: 'docs.documents.get';
      parameters: [
        {
          description: 'The ID of the document to retrieve.';
          in: 'path';
          name: 'documentId';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'The suggestions view mode to apply to the document. This allows viewing the document with all suggestions inline, accepted or rejected. If one is not specified, DEFAULT_FOR_CURRENT_ACCESS is used.';
          in: 'query';
          name: 'suggestionsViewMode';
          schema: {
            enum: [
              'DEFAULT_FOR_CURRENT_ACCESS',
              'SUGGESTIONS_INLINE',
              'PREVIEW_SUGGESTIONS_ACCEPTED',
              'PREVIEW_WITHOUT_SUGGESTIONS',
            ];
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Document';
              };
            };
          };
          description: 'Successful response';
        };
      };
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/documents'];
          Oauth2c: ['https://www.googleapis.com/auth/documents'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/documents.readonly'];
          Oauth2c: ['https://www.googleapis.com/auth/documents.readonly'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive'];
          Oauth2c: ['https://www.googleapis.com/auth/drive'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.file'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.file'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.readonly'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.readonly'];
        },
      ];
      tags: ['documents'];
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
  '/v1/documents/{documentId}:batchUpdate': {
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
      description: 'Applies one or more updates to the document. Each request is validated before being applied. If any request is not valid, then the entire request will fail and nothing will be applied. Some requests have replies to give you some information about how they are applied. Other requests do not need to return information; these each return an empty reply. The order of replies matches that of the requests. For example, suppose you call batchUpdate with four updates, and only the third one returns information. The response would have two empty replies, the reply to the third request, and another empty reply, in that order. Because other users may be editing the document, the document might not exactly reflect your changes: your changes may be altered with respect to collaborator changes. If there are no collaborators, the document should reflect your changes. In any case, the updates in your request are guaranteed to be applied together atomically.';
      operationId: 'docs.documents.batchUpdate';
      parameters: [
        {
          description: 'The ID of the document to update.';
          in: 'path';
          name: 'documentId';
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
              $ref: '#/components/schemas/BatchUpdateDocumentRequest';
            };
          };
        };
      };
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/BatchUpdateDocumentResponse';
              };
            };
          };
          description: 'Successful response';
        };
      };
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/documents'];
          Oauth2c: ['https://www.googleapis.com/auth/documents'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive'];
          Oauth2c: ['https://www.googleapis.com/auth/drive'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.file'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.file'];
        },
      ];
      tags: ['documents'];
    };
  };
};
export const paths = {
  '/v1/documents': {
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
        'Creates a blank document using the title given in the request. Other fields in the request, including any provided content, are ignored. Returns the created document.',
      operationId: 'docs.documents.create',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Document',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Document',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/documents'],
          Oauth2c: ['https://www.googleapis.com/auth/documents'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive'],
          Oauth2c: ['https://www.googleapis.com/auth/drive'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.file'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.file'],
        },
      ],
      tags: ['documents'],
    },
  },
  '/v1/documents/{documentId}': {
    get: {
      description: 'Gets the latest version of the specified document.',
      operationId: 'docs.documents.get',
      parameters: [
        {
          description: 'The ID of the document to retrieve.',
          in: 'path',
          name: 'documentId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description:
            'The suggestions view mode to apply to the document. This allows viewing the document with all suggestions inline, accepted or rejected. If one is not specified, DEFAULT_FOR_CURRENT_ACCESS is used.',
          in: 'query',
          name: 'suggestionsViewMode',
          schema: {
            enum: [
              'DEFAULT_FOR_CURRENT_ACCESS',
              'SUGGESTIONS_INLINE',
              'PREVIEW_SUGGESTIONS_ACCEPTED',
              'PREVIEW_WITHOUT_SUGGESTIONS',
            ],
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Document',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/documents'],
          Oauth2c: ['https://www.googleapis.com/auth/documents'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/documents.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/documents.readonly'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive'],
          Oauth2c: ['https://www.googleapis.com/auth/drive'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.file'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.file'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.readonly'],
        },
      ],
      tags: ['documents'],
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
  '/v1/documents/{documentId}:batchUpdate': {
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
        'Applies one or more updates to the document. Each request is validated before being applied. If any request is not valid, then the entire request will fail and nothing will be applied. Some requests have replies to give you some information about how they are applied. Other requests do not need to return information; these each return an empty reply. The order of replies matches that of the requests. For example, suppose you call batchUpdate with four updates, and only the third one returns information. The response would have two empty replies, the reply to the third request, and another empty reply, in that order. Because other users may be editing the document, the document might not exactly reflect your changes: your changes may be altered with respect to collaborator changes. If there are no collaborators, the document should reflect your changes. In any case, the updates in your request are guaranteed to be applied together atomically.',
      operationId: 'docs.documents.batchUpdate',
      parameters: [
        {
          description: 'The ID of the document to update.',
          in: 'path',
          name: 'documentId',
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
              $ref: '#/components/schemas/BatchUpdateDocumentRequest',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/BatchUpdateDocumentResponse',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/documents'],
          Oauth2c: ['https://www.googleapis.com/auth/documents'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive'],
          Oauth2c: ['https://www.googleapis.com/auth/drive'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.file'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.file'],
        },
      ],
      tags: ['documents'],
    },
  },
} as TPaths;
