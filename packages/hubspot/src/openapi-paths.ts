// @ts-nocheck
export type TPaths = {
  '/automation/v4/actions/callbacks/{callbackId}/complete': {
    post: {
      tags: ['Callbacks'];
      summary: 'Completes a single callback';
      operationId: 'post-/automation/v4/actions/callbacks/{callbackId}/complete_complete';
      parameters: [
        {
          name: 'callbackId';
          in: 'path';
          required: true;
          style: 'simple';
          explode: false;
          schema: {
            type: 'string';
          };
        },
      ];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/CallbackCompletionRequest';
            };
          };
        };
        required: true;
      };
      responses: {
        '204': {
          description: 'No content';
          content: {};
        };
        default: {
          $ref: '#/components/responses/Error';
        };
      };
      security: [
        {
          oauth2_legacy: ['automation'];
        },
        {
          private_apps_legacy: ['automation'];
        },
      ];
    };
  };
  '/automation/v4/actions/callbacks/complete': {
    post: {
      tags: ['Callbacks'];
      summary: 'Completes a batch of callbacks';
      operationId: 'post-/automation/v4/actions/callbacks/complete_completeBatch';
      parameters: [];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/BatchInputCallbackCompletionBatchRequest';
            };
          };
        };
        required: true;
      };
      responses: {
        '204': {
          description: 'No content';
          content: {};
        };
        default: {
          $ref: '#/components/responses/Error';
        };
      };
      security: [
        {
          oauth2_legacy: ['automation'];
        },
        {
          private_apps_legacy: ['automation'];
        },
      ];
    };
  };
  '/automation/v4/actions/{appId}': {
    get: {
      tags: ['Definitions'];
      summary: 'Get paged extension definitions';
      operationId: 'get-/automation/v4/actions/{appId}_getPage';
      parameters: [
        {
          name: 'limit';
          in: 'query';
          description: 'The maximum number of results to display per page.';
          required: false;
          style: 'form';
          explode: true;
          schema: {
            type: 'integer';
            format: 'int32';
          };
        },
        {
          name: 'after';
          in: 'query';
          description: 'The paging cursor token of the last successfully read resource will be returned as the `paging.next.after` JSON property of a paged response containing more results.';
          required: false;
          style: 'form';
          explode: true;
          schema: {
            type: 'string';
          };
        },
        {
          name: 'archived';
          in: 'query';
          description: 'Whether to return only results that have been archived.';
          required: false;
          style: 'form';
          explode: true;
          schema: {
            type: 'boolean';
            default: false;
          };
        },
        {
          name: 'appId';
          in: 'path';
          required: true;
          style: 'simple';
          explode: false;
          schema: {
            type: 'integer';
            format: 'int32';
          };
        },
      ];
      responses: {
        '200': {
          description: 'successful operation';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CollectionResponsePublicActionDefinitionForwardPaging';
              };
            };
          };
        };
        default: {
          $ref: '#/components/responses/Error';
        };
      };
      security: [
        {
          developer_hapikey: [];
        },
      ];
    };
    post: {
      tags: ['Definitions'];
      summary: 'Create a new extension definition';
      operationId: 'post-/automation/v4/actions/{appId}_create';
      parameters: [
        {
          name: 'appId';
          in: 'path';
          required: true;
          style: 'simple';
          explode: false;
          schema: {
            type: 'integer';
            format: 'int32';
          };
        },
      ];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/PublicActionDefinitionEgg';
            };
          };
        };
        required: true;
      };
      responses: {
        '201': {
          description: 'successful operation';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PublicActionDefinition';
              };
            };
          };
        };
        default: {
          $ref: '#/components/responses/Error';
        };
      };
      security: [
        {
          developer_hapikey: [];
        },
      ];
    };
  };
  '/automation/v4/actions/{appId}/{definitionId}/functions': {
    get: {
      tags: ['Functions'];
      summary: 'Get all functions for a given definition';
      operationId: 'get-/automation/v4/actions/{appId}/{definitionId}/functions_getPage';
      parameters: [
        {
          name: 'definitionId';
          in: 'path';
          required: true;
          style: 'simple';
          explode: false;
          schema: {
            type: 'string';
          };
        },
        {
          name: 'appId';
          in: 'path';
          required: true;
          style: 'simple';
          explode: false;
          schema: {
            type: 'integer';
            format: 'int32';
          };
        },
      ];
      responses: {
        '200': {
          description: 'successful operation';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CollectionResponsePublicActionFunctionIdentifierNoPaging';
              };
            };
          };
        };
        default: {
          $ref: '#/components/responses/Error';
        };
      };
      security: [
        {
          developer_hapikey: [];
        },
      ];
    };
  };
  '/automation/v4/actions/{appId}/{definitionId}/functions/{functionType}': {
    get: {
      tags: ['Functions'];
      summary: 'Get all functions by a type for a given definition';
      operationId: 'get-/automation/v4/actions/{appId}/{definitionId}/functions/{functionType}_getByFunctionType';
      parameters: [
        {
          name: 'definitionId';
          in: 'path';
          required: true;
          style: 'simple';
          explode: false;
          schema: {
            type: 'string';
          };
        },
        {
          name: 'functionType';
          in: 'path';
          required: true;
          style: 'simple';
          explode: false;
          schema: {
            type: 'string';
            enum: ['PRE_ACTION_EXECUTION', 'PRE_FETCH_OPTIONS', 'POST_FETCH_OPTIONS', 'POST_ACTION_EXECUTION'];
          };
        },
        {
          name: 'appId';
          in: 'path';
          required: true;
          style: 'simple';
          explode: false;
          schema: {
            type: 'integer';
            format: 'int32';
          };
        },
      ];
      responses: {
        '200': {
          description: 'successful operation';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PublicActionFunction';
              };
            };
          };
        };
        default: {
          $ref: '#/components/responses/Error';
        };
      };
      security: [
        {
          developer_hapikey: [];
        },
      ];
    };
    put: {
      tags: ['Functions'];
      summary: 'Insert a function for a definition';
      operationId: 'put-/automation/v4/actions/{appId}/{definitionId}/functions/{functionType}_createOrReplaceByFunctionType';
      parameters: [
        {
          name: 'definitionId';
          in: 'path';
          required: true;
          style: 'simple';
          explode: false;
          schema: {
            type: 'string';
          };
        },
        {
          name: 'functionType';
          in: 'path';
          required: true;
          style: 'simple';
          explode: false;
          schema: {
            type: 'string';
            enum: ['PRE_ACTION_EXECUTION', 'PRE_FETCH_OPTIONS', 'POST_FETCH_OPTIONS', 'POST_ACTION_EXECUTION'];
          };
        },
        {
          name: 'appId';
          in: 'path';
          required: true;
          style: 'simple';
          explode: false;
          schema: {
            type: 'integer';
            format: 'int32';
          };
        },
      ];
      requestBody: {
        content: {
          'text/plain': {
            schema: {
              type: 'string';
            };
          };
        };
        required: true;
      };
      responses: {
        '200': {
          description: 'successful operation';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PublicActionFunctionIdentifier';
              };
            };
          };
        };
        default: {
          $ref: '#/components/responses/Error';
        };
      };
      security: [
        {
          developer_hapikey: [];
        },
      ];
    };
    delete: {
      tags: ['Functions'];
      summary: 'Delete a function for a definition';
      operationId: 'delete-/automation/v4/actions/{appId}/{definitionId}/functions/{functionType}_archiveByFunctionType';
      parameters: [
        {
          name: 'definitionId';
          in: 'path';
          required: true;
          style: 'simple';
          explode: false;
          schema: {
            type: 'string';
          };
        },
        {
          name: 'functionType';
          in: 'path';
          required: true;
          style: 'simple';
          explode: false;
          schema: {
            type: 'string';
            enum: ['PRE_ACTION_EXECUTION', 'PRE_FETCH_OPTIONS', 'POST_FETCH_OPTIONS', 'POST_ACTION_EXECUTION'];
          };
        },
        {
          name: 'appId';
          in: 'path';
          required: true;
          style: 'simple';
          explode: false;
          schema: {
            type: 'integer';
            format: 'int32';
          };
        },
      ];
      responses: {
        '204': {
          description: 'No content';
          content: {};
        };
        default: {
          $ref: '#/components/responses/Error';
        };
      };
      security: [
        {
          developer_hapikey: [];
        },
      ];
    };
  };
  '/automation/v4/actions/{appId}/{definitionId}/revisions/{revisionId}': {
    get: {
      tags: ['Revisions'];
      summary: 'Gets a revision for a given definition by revision id';
      operationId: 'get-/automation/v4/actions/{appId}/{definitionId}/revisions/{revisionId}_getById';
      parameters: [
        {
          name: 'definitionId';
          in: 'path';
          required: true;
          style: 'simple';
          explode: false;
          schema: {
            type: 'string';
          };
        },
        {
          name: 'revisionId';
          in: 'path';
          required: true;
          style: 'simple';
          explode: false;
          schema: {
            type: 'string';
          };
        },
        {
          name: 'appId';
          in: 'path';
          required: true;
          style: 'simple';
          explode: false;
          schema: {
            type: 'integer';
            format: 'int32';
          };
        },
      ];
      responses: {
        '200': {
          description: 'successful operation';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PublicActionRevision';
              };
            };
          };
        };
        default: {
          $ref: '#/components/responses/Error';
        };
      };
      security: [
        {
          developer_hapikey: [];
        },
      ];
    };
  };
  '/automation/v4/actions/{appId}/{definitionId}': {
    get: {
      tags: ['Definitions'];
      summary: 'Get extension definition by Id';
      operationId: 'get-/automation/v4/actions/{appId}/{definitionId}_getById';
      parameters: [
        {
          name: 'definitionId';
          in: 'path';
          required: true;
          style: 'simple';
          explode: false;
          schema: {
            type: 'string';
          };
        },
        {
          name: 'archived';
          in: 'query';
          description: 'Whether to return only results that have been archived.';
          required: false;
          style: 'form';
          explode: true;
          schema: {
            type: 'boolean';
            default: false;
          };
        },
        {
          name: 'appId';
          in: 'path';
          required: true;
          style: 'simple';
          explode: false;
          schema: {
            type: 'integer';
            format: 'int32';
          };
        },
      ];
      responses: {
        '200': {
          description: 'successful operation';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PublicActionDefinition';
              };
            };
          };
        };
        default: {
          $ref: '#/components/responses/Error';
        };
      };
      security: [
        {
          developer_hapikey: [];
        },
      ];
    };
    delete: {
      tags: ['Definitions'];
      summary: 'Archive an extension definition';
      operationId: 'delete-/automation/v4/actions/{appId}/{definitionId}_archive';
      parameters: [
        {
          name: 'definitionId';
          in: 'path';
          required: true;
          style: 'simple';
          explode: false;
          schema: {
            type: 'string';
          };
        },
        {
          name: 'appId';
          in: 'path';
          required: true;
          style: 'simple';
          explode: false;
          schema: {
            type: 'integer';
            format: 'int32';
          };
        },
      ];
      responses: {
        '204': {
          description: 'No content';
          content: {};
        };
        default: {
          $ref: '#/components/responses/Error';
        };
      };
      security: [
        {
          developer_hapikey: [];
        },
      ];
    };
    patch: {
      tags: ['Definitions'];
      summary: 'Patch an existing extension definition';
      operationId: 'patch-/automation/v4/actions/{appId}/{definitionId}_update';
      parameters: [
        {
          name: 'definitionId';
          in: 'path';
          required: true;
          style: 'simple';
          explode: false;
          schema: {
            type: 'string';
          };
        },
        {
          name: 'appId';
          in: 'path';
          required: true;
          style: 'simple';
          explode: false;
          schema: {
            type: 'integer';
            format: 'int32';
          };
        },
      ];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/PublicActionDefinitionPatch';
            };
          };
        };
        required: true;
      };
      responses: {
        '200': {
          description: 'successful operation';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PublicActionDefinition';
              };
            };
          };
        };
        default: {
          $ref: '#/components/responses/Error';
        };
      };
      security: [
        {
          developer_hapikey: [];
        },
      ];
    };
  };
  '/automation/v4/actions/{appId}/{definitionId}/functions/{functionType}/{functionId}': {
    get: {
      tags: ['Functions'];
      summary: 'Get a function for a given definition';
      operationId: 'get-/automation/v4/actions/{appId}/{definitionId}/functions/{functionType}/{functionId}_getById';
      parameters: [
        {
          name: 'definitionId';
          in: 'path';
          required: true;
          style: 'simple';
          explode: false;
          schema: {
            type: 'string';
          };
        },
        {
          name: 'functionType';
          in: 'path';
          required: true;
          style: 'simple';
          explode: false;
          schema: {
            type: 'string';
            enum: ['PRE_ACTION_EXECUTION', 'PRE_FETCH_OPTIONS', 'POST_FETCH_OPTIONS', 'POST_ACTION_EXECUTION'];
          };
        },
        {
          name: 'functionId';
          in: 'path';
          required: true;
          style: 'simple';
          explode: false;
          schema: {
            type: 'string';
          };
        },
        {
          name: 'appId';
          in: 'path';
          required: true;
          style: 'simple';
          explode: false;
          schema: {
            type: 'integer';
            format: 'int32';
          };
        },
      ];
      responses: {
        '200': {
          description: 'successful operation';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PublicActionFunction';
              };
            };
          };
        };
        default: {
          $ref: '#/components/responses/Error';
        };
      };
      security: [
        {
          developer_hapikey: [];
        },
      ];
    };
    put: {
      tags: ['Functions'];
      summary: 'Insert a function for a definition';
      operationId: 'put-/automation/v4/actions/{appId}/{definitionId}/functions/{functionType}/{functionId}_createOrReplace';
      parameters: [
        {
          name: 'definitionId';
          in: 'path';
          required: true;
          style: 'simple';
          explode: false;
          schema: {
            type: 'string';
          };
        },
        {
          name: 'functionType';
          in: 'path';
          required: true;
          style: 'simple';
          explode: false;
          schema: {
            type: 'string';
            enum: ['PRE_ACTION_EXECUTION', 'PRE_FETCH_OPTIONS', 'POST_FETCH_OPTIONS', 'POST_ACTION_EXECUTION'];
          };
        },
        {
          name: 'functionId';
          in: 'path';
          required: true;
          style: 'simple';
          explode: false;
          schema: {
            type: 'string';
          };
        },
        {
          name: 'appId';
          in: 'path';
          required: true;
          style: 'simple';
          explode: false;
          schema: {
            type: 'integer';
            format: 'int32';
          };
        },
      ];
      requestBody: {
        content: {
          'text/plain': {
            schema: {
              type: 'string';
            };
          };
        };
        required: true;
      };
      responses: {
        '200': {
          description: 'successful operation';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PublicActionFunctionIdentifier';
              };
            };
          };
        };
        default: {
          $ref: '#/components/responses/Error';
        };
      };
      security: [
        {
          developer_hapikey: [];
        },
      ];
    };
    delete: {
      tags: ['Functions'];
      summary: 'Archive a function for a definition';
      operationId: 'delete-/automation/v4/actions/{appId}/{definitionId}/functions/{functionType}/{functionId}_archive';
      parameters: [
        {
          name: 'definitionId';
          in: 'path';
          required: true;
          style: 'simple';
          explode: false;
          schema: {
            type: 'string';
          };
        },
        {
          name: 'functionType';
          in: 'path';
          required: true;
          style: 'simple';
          explode: false;
          schema: {
            type: 'string';
            enum: ['PRE_ACTION_EXECUTION', 'PRE_FETCH_OPTIONS', 'POST_FETCH_OPTIONS', 'POST_ACTION_EXECUTION'];
          };
        },
        {
          name: 'functionId';
          in: 'path';
          required: true;
          style: 'simple';
          explode: false;
          schema: {
            type: 'string';
          };
        },
        {
          name: 'appId';
          in: 'path';
          required: true;
          style: 'simple';
          explode: false;
          schema: {
            type: 'integer';
            format: 'int32';
          };
        },
      ];
      responses: {
        '204': {
          description: 'No content';
          content: {};
        };
        default: {
          $ref: '#/components/responses/Error';
        };
      };
      security: [
        {
          developer_hapikey: [];
        },
      ];
    };
  };
  '/automation/v4/actions/{appId}/{definitionId}/revisions': {
    get: {
      tags: ['Revisions'];
      summary: 'Get all revisions for a given definition';
      operationId: 'get-/automation/v4/actions/{appId}/{definitionId}/revisions_getPage';
      parameters: [
        {
          name: 'definitionId';
          in: 'path';
          required: true;
          style: 'simple';
          explode: false;
          schema: {
            type: 'string';
          };
        },
        {
          name: 'limit';
          in: 'query';
          description: 'The maximum number of results to display per page.';
          required: false;
          style: 'form';
          explode: true;
          schema: {
            type: 'integer';
            format: 'int32';
          };
        },
        {
          name: 'after';
          in: 'query';
          description: 'The paging cursor token of the last successfully read resource will be returned as the `paging.next.after` JSON property of a paged response containing more results.';
          required: false;
          style: 'form';
          explode: true;
          schema: {
            type: 'string';
          };
        },
        {
          name: 'appId';
          in: 'path';
          required: true;
          style: 'simple';
          explode: false;
          schema: {
            type: 'integer';
            format: 'int32';
          };
        },
      ];
      responses: {
        '200': {
          description: 'successful operation';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CollectionResponsePublicActionRevisionForwardPaging';
              };
            };
          };
        };
        default: {
          $ref: '#/components/responses/Error';
        };
      };
      security: [
        {
          developer_hapikey: [];
        },
      ];
    };
  };
};
export const paths = {
  '/automation/v4/actions/callbacks/{callbackId}/complete': {
    post: {
      tags: ['Callbacks'],
      summary: 'Completes a single callback',
      operationId: 'post-/automation/v4/actions/callbacks/{callbackId}/complete_complete',
      parameters: [
        {
          name: 'callbackId',
          in: 'path',
          required: true,
          style: 'simple',
          explode: false,
          schema: {
            type: 'string',
          },
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/CallbackCompletionRequest',
            },
          },
        },
        required: true,
      },
      responses: {
        '204': {
          description: 'No content',
          content: {},
        },
        default: {
          $ref: '#/components/responses/Error',
        },
      },
      security: [
        {
          oauth2_legacy: ['automation'],
        },
        {
          private_apps_legacy: ['automation'],
        },
      ],
    },
  },
  '/automation/v4/actions/callbacks/complete': {
    post: {
      tags: ['Callbacks'],
      summary: 'Completes a batch of callbacks',
      operationId: 'post-/automation/v4/actions/callbacks/complete_completeBatch',
      parameters: [],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/BatchInputCallbackCompletionBatchRequest',
            },
          },
        },
        required: true,
      },
      responses: {
        '204': {
          description: 'No content',
          content: {},
        },
        default: {
          $ref: '#/components/responses/Error',
        },
      },
      security: [
        {
          oauth2_legacy: ['automation'],
        },
        {
          private_apps_legacy: ['automation'],
        },
      ],
    },
  },
  '/automation/v4/actions/{appId}': {
    get: {
      tags: ['Definitions'],
      summary: 'Get paged extension definitions',
      operationId: 'get-/automation/v4/actions/{appId}_getPage',
      parameters: [
        {
          name: 'limit',
          in: 'query',
          description: 'The maximum number of results to display per page.',
          required: false,
          style: 'form',
          explode: true,
          schema: {
            type: 'integer',
            format: 'int32',
          },
        },
        {
          name: 'after',
          in: 'query',
          description:
            'The paging cursor token of the last successfully read resource will be returned as the `paging.next.after` JSON property of a paged response containing more results.',
          required: false,
          style: 'form',
          explode: true,
          schema: {
            type: 'string',
          },
        },
        {
          name: 'archived',
          in: 'query',
          description: 'Whether to return only results that have been archived.',
          required: false,
          style: 'form',
          explode: true,
          schema: {
            type: 'boolean',
            default: false,
          },
        },
        {
          name: 'appId',
          in: 'path',
          required: true,
          style: 'simple',
          explode: false,
          schema: {
            type: 'integer',
            format: 'int32',
          },
        },
      ],
      responses: {
        '200': {
          description: 'successful operation',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CollectionResponsePublicActionDefinitionForwardPaging',
              },
            },
          },
        },
        default: {
          $ref: '#/components/responses/Error',
        },
      },
      security: [
        {
          developer_hapikey: [],
        },
      ],
    },
    post: {
      tags: ['Definitions'],
      summary: 'Create a new extension definition',
      operationId: 'post-/automation/v4/actions/{appId}_create',
      parameters: [
        {
          name: 'appId',
          in: 'path',
          required: true,
          style: 'simple',
          explode: false,
          schema: {
            type: 'integer',
            format: 'int32',
          },
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/PublicActionDefinitionEgg',
            },
          },
        },
        required: true,
      },
      responses: {
        '201': {
          description: 'successful operation',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PublicActionDefinition',
              },
            },
          },
        },
        default: {
          $ref: '#/components/responses/Error',
        },
      },
      security: [
        {
          developer_hapikey: [],
        },
      ],
    },
  },
  '/automation/v4/actions/{appId}/{definitionId}/functions': {
    get: {
      tags: ['Functions'],
      summary: 'Get all functions for a given definition',
      operationId: 'get-/automation/v4/actions/{appId}/{definitionId}/functions_getPage',
      parameters: [
        {
          name: 'definitionId',
          in: 'path',
          required: true,
          style: 'simple',
          explode: false,
          schema: {
            type: 'string',
          },
        },
        {
          name: 'appId',
          in: 'path',
          required: true,
          style: 'simple',
          explode: false,
          schema: {
            type: 'integer',
            format: 'int32',
          },
        },
      ],
      responses: {
        '200': {
          description: 'successful operation',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CollectionResponsePublicActionFunctionIdentifierNoPaging',
              },
            },
          },
        },
        default: {
          $ref: '#/components/responses/Error',
        },
      },
      security: [
        {
          developer_hapikey: [],
        },
      ],
    },
  },
  '/automation/v4/actions/{appId}/{definitionId}/functions/{functionType}': {
    get: {
      tags: ['Functions'],
      summary: 'Get all functions by a type for a given definition',
      operationId: 'get-/automation/v4/actions/{appId}/{definitionId}/functions/{functionType}_getByFunctionType',
      parameters: [
        {
          name: 'definitionId',
          in: 'path',
          required: true,
          style: 'simple',
          explode: false,
          schema: {
            type: 'string',
          },
        },
        {
          name: 'functionType',
          in: 'path',
          required: true,
          style: 'simple',
          explode: false,
          schema: {
            type: 'string',
            enum: ['PRE_ACTION_EXECUTION', 'PRE_FETCH_OPTIONS', 'POST_FETCH_OPTIONS', 'POST_ACTION_EXECUTION'],
          },
        },
        {
          name: 'appId',
          in: 'path',
          required: true,
          style: 'simple',
          explode: false,
          schema: {
            type: 'integer',
            format: 'int32',
          },
        },
      ],
      responses: {
        '200': {
          description: 'successful operation',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PublicActionFunction',
              },
            },
          },
        },
        default: {
          $ref: '#/components/responses/Error',
        },
      },
      security: [
        {
          developer_hapikey: [],
        },
      ],
    },
    put: {
      tags: ['Functions'],
      summary: 'Insert a function for a definition',
      operationId:
        'put-/automation/v4/actions/{appId}/{definitionId}/functions/{functionType}_createOrReplaceByFunctionType',
      parameters: [
        {
          name: 'definitionId',
          in: 'path',
          required: true,
          style: 'simple',
          explode: false,
          schema: {
            type: 'string',
          },
        },
        {
          name: 'functionType',
          in: 'path',
          required: true,
          style: 'simple',
          explode: false,
          schema: {
            type: 'string',
            enum: ['PRE_ACTION_EXECUTION', 'PRE_FETCH_OPTIONS', 'POST_FETCH_OPTIONS', 'POST_ACTION_EXECUTION'],
          },
        },
        {
          name: 'appId',
          in: 'path',
          required: true,
          style: 'simple',
          explode: false,
          schema: {
            type: 'integer',
            format: 'int32',
          },
        },
      ],
      requestBody: {
        content: {
          'text/plain': {
            schema: {
              type: 'string',
            },
          },
        },
        required: true,
      },
      responses: {
        '200': {
          description: 'successful operation',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PublicActionFunctionIdentifier',
              },
            },
          },
        },
        default: {
          $ref: '#/components/responses/Error',
        },
      },
      security: [
        {
          developer_hapikey: [],
        },
      ],
    },
    delete: {
      tags: ['Functions'],
      summary: 'Delete a function for a definition',
      operationId:
        'delete-/automation/v4/actions/{appId}/{definitionId}/functions/{functionType}_archiveByFunctionType',
      parameters: [
        {
          name: 'definitionId',
          in: 'path',
          required: true,
          style: 'simple',
          explode: false,
          schema: {
            type: 'string',
          },
        },
        {
          name: 'functionType',
          in: 'path',
          required: true,
          style: 'simple',
          explode: false,
          schema: {
            type: 'string',
            enum: ['PRE_ACTION_EXECUTION', 'PRE_FETCH_OPTIONS', 'POST_FETCH_OPTIONS', 'POST_ACTION_EXECUTION'],
          },
        },
        {
          name: 'appId',
          in: 'path',
          required: true,
          style: 'simple',
          explode: false,
          schema: {
            type: 'integer',
            format: 'int32',
          },
        },
      ],
      responses: {
        '204': {
          description: 'No content',
          content: {},
        },
        default: {
          $ref: '#/components/responses/Error',
        },
      },
      security: [
        {
          developer_hapikey: [],
        },
      ],
    },
  },
  '/automation/v4/actions/{appId}/{definitionId}/revisions/{revisionId}': {
    get: {
      tags: ['Revisions'],
      summary: 'Gets a revision for a given definition by revision id',
      operationId: 'get-/automation/v4/actions/{appId}/{definitionId}/revisions/{revisionId}_getById',
      parameters: [
        {
          name: 'definitionId',
          in: 'path',
          required: true,
          style: 'simple',
          explode: false,
          schema: {
            type: 'string',
          },
        },
        {
          name: 'revisionId',
          in: 'path',
          required: true,
          style: 'simple',
          explode: false,
          schema: {
            type: 'string',
          },
        },
        {
          name: 'appId',
          in: 'path',
          required: true,
          style: 'simple',
          explode: false,
          schema: {
            type: 'integer',
            format: 'int32',
          },
        },
      ],
      responses: {
        '200': {
          description: 'successful operation',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PublicActionRevision',
              },
            },
          },
        },
        default: {
          $ref: '#/components/responses/Error',
        },
      },
      security: [
        {
          developer_hapikey: [],
        },
      ],
    },
  },
  '/automation/v4/actions/{appId}/{definitionId}': {
    get: {
      tags: ['Definitions'],
      summary: 'Get extension definition by Id',
      operationId: 'get-/automation/v4/actions/{appId}/{definitionId}_getById',
      parameters: [
        {
          name: 'definitionId',
          in: 'path',
          required: true,
          style: 'simple',
          explode: false,
          schema: {
            type: 'string',
          },
        },
        {
          name: 'archived',
          in: 'query',
          description: 'Whether to return only results that have been archived.',
          required: false,
          style: 'form',
          explode: true,
          schema: {
            type: 'boolean',
            default: false,
          },
        },
        {
          name: 'appId',
          in: 'path',
          required: true,
          style: 'simple',
          explode: false,
          schema: {
            type: 'integer',
            format: 'int32',
          },
        },
      ],
      responses: {
        '200': {
          description: 'successful operation',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PublicActionDefinition',
              },
            },
          },
        },
        default: {
          $ref: '#/components/responses/Error',
        },
      },
      security: [
        {
          developer_hapikey: [],
        },
      ],
    },
    delete: {
      tags: ['Definitions'],
      summary: 'Archive an extension definition',
      operationId: 'delete-/automation/v4/actions/{appId}/{definitionId}_archive',
      parameters: [
        {
          name: 'definitionId',
          in: 'path',
          required: true,
          style: 'simple',
          explode: false,
          schema: {
            type: 'string',
          },
        },
        {
          name: 'appId',
          in: 'path',
          required: true,
          style: 'simple',
          explode: false,
          schema: {
            type: 'integer',
            format: 'int32',
          },
        },
      ],
      responses: {
        '204': {
          description: 'No content',
          content: {},
        },
        default: {
          $ref: '#/components/responses/Error',
        },
      },
      security: [
        {
          developer_hapikey: [],
        },
      ],
    },
    patch: {
      tags: ['Definitions'],
      summary: 'Patch an existing extension definition',
      operationId: 'patch-/automation/v4/actions/{appId}/{definitionId}_update',
      parameters: [
        {
          name: 'definitionId',
          in: 'path',
          required: true,
          style: 'simple',
          explode: false,
          schema: {
            type: 'string',
          },
        },
        {
          name: 'appId',
          in: 'path',
          required: true,
          style: 'simple',
          explode: false,
          schema: {
            type: 'integer',
            format: 'int32',
          },
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/PublicActionDefinitionPatch',
            },
          },
        },
        required: true,
      },
      responses: {
        '200': {
          description: 'successful operation',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PublicActionDefinition',
              },
            },
          },
        },
        default: {
          $ref: '#/components/responses/Error',
        },
      },
      security: [
        {
          developer_hapikey: [],
        },
      ],
    },
  },
  '/automation/v4/actions/{appId}/{definitionId}/functions/{functionType}/{functionId}': {
    get: {
      tags: ['Functions'],
      summary: 'Get a function for a given definition',
      operationId: 'get-/automation/v4/actions/{appId}/{definitionId}/functions/{functionType}/{functionId}_getById',
      parameters: [
        {
          name: 'definitionId',
          in: 'path',
          required: true,
          style: 'simple',
          explode: false,
          schema: {
            type: 'string',
          },
        },
        {
          name: 'functionType',
          in: 'path',
          required: true,
          style: 'simple',
          explode: false,
          schema: {
            type: 'string',
            enum: ['PRE_ACTION_EXECUTION', 'PRE_FETCH_OPTIONS', 'POST_FETCH_OPTIONS', 'POST_ACTION_EXECUTION'],
          },
        },
        {
          name: 'functionId',
          in: 'path',
          required: true,
          style: 'simple',
          explode: false,
          schema: {
            type: 'string',
          },
        },
        {
          name: 'appId',
          in: 'path',
          required: true,
          style: 'simple',
          explode: false,
          schema: {
            type: 'integer',
            format: 'int32',
          },
        },
      ],
      responses: {
        '200': {
          description: 'successful operation',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PublicActionFunction',
              },
            },
          },
        },
        default: {
          $ref: '#/components/responses/Error',
        },
      },
      security: [
        {
          developer_hapikey: [],
        },
      ],
    },
    put: {
      tags: ['Functions'],
      summary: 'Insert a function for a definition',
      operationId:
        'put-/automation/v4/actions/{appId}/{definitionId}/functions/{functionType}/{functionId}_createOrReplace',
      parameters: [
        {
          name: 'definitionId',
          in: 'path',
          required: true,
          style: 'simple',
          explode: false,
          schema: {
            type: 'string',
          },
        },
        {
          name: 'functionType',
          in: 'path',
          required: true,
          style: 'simple',
          explode: false,
          schema: {
            type: 'string',
            enum: ['PRE_ACTION_EXECUTION', 'PRE_FETCH_OPTIONS', 'POST_FETCH_OPTIONS', 'POST_ACTION_EXECUTION'],
          },
        },
        {
          name: 'functionId',
          in: 'path',
          required: true,
          style: 'simple',
          explode: false,
          schema: {
            type: 'string',
          },
        },
        {
          name: 'appId',
          in: 'path',
          required: true,
          style: 'simple',
          explode: false,
          schema: {
            type: 'integer',
            format: 'int32',
          },
        },
      ],
      requestBody: {
        content: {
          'text/plain': {
            schema: {
              type: 'string',
            },
          },
        },
        required: true,
      },
      responses: {
        '200': {
          description: 'successful operation',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PublicActionFunctionIdentifier',
              },
            },
          },
        },
        default: {
          $ref: '#/components/responses/Error',
        },
      },
      security: [
        {
          developer_hapikey: [],
        },
      ],
    },
    delete: {
      tags: ['Functions'],
      summary: 'Archive a function for a definition',
      operationId: 'delete-/automation/v4/actions/{appId}/{definitionId}/functions/{functionType}/{functionId}_archive',
      parameters: [
        {
          name: 'definitionId',
          in: 'path',
          required: true,
          style: 'simple',
          explode: false,
          schema: {
            type: 'string',
          },
        },
        {
          name: 'functionType',
          in: 'path',
          required: true,
          style: 'simple',
          explode: false,
          schema: {
            type: 'string',
            enum: ['PRE_ACTION_EXECUTION', 'PRE_FETCH_OPTIONS', 'POST_FETCH_OPTIONS', 'POST_ACTION_EXECUTION'],
          },
        },
        {
          name: 'functionId',
          in: 'path',
          required: true,
          style: 'simple',
          explode: false,
          schema: {
            type: 'string',
          },
        },
        {
          name: 'appId',
          in: 'path',
          required: true,
          style: 'simple',
          explode: false,
          schema: {
            type: 'integer',
            format: 'int32',
          },
        },
      ],
      responses: {
        '204': {
          description: 'No content',
          content: {},
        },
        default: {
          $ref: '#/components/responses/Error',
        },
      },
      security: [
        {
          developer_hapikey: [],
        },
      ],
    },
  },
  '/automation/v4/actions/{appId}/{definitionId}/revisions': {
    get: {
      tags: ['Revisions'],
      summary: 'Get all revisions for a given definition',
      operationId: 'get-/automation/v4/actions/{appId}/{definitionId}/revisions_getPage',
      parameters: [
        {
          name: 'definitionId',
          in: 'path',
          required: true,
          style: 'simple',
          explode: false,
          schema: {
            type: 'string',
          },
        },
        {
          name: 'limit',
          in: 'query',
          description: 'The maximum number of results to display per page.',
          required: false,
          style: 'form',
          explode: true,
          schema: {
            type: 'integer',
            format: 'int32',
          },
        },
        {
          name: 'after',
          in: 'query',
          description:
            'The paging cursor token of the last successfully read resource will be returned as the `paging.next.after` JSON property of a paged response containing more results.',
          required: false,
          style: 'form',
          explode: true,
          schema: {
            type: 'string',
          },
        },
        {
          name: 'appId',
          in: 'path',
          required: true,
          style: 'simple',
          explode: false,
          schema: {
            type: 'integer',
            format: 'int32',
          },
        },
      ],
      responses: {
        '200': {
          description: 'successful operation',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CollectionResponsePublicActionRevisionForwardPaging',
              },
            },
          },
        },
        default: {
          $ref: '#/components/responses/Error',
        },
      },
      security: [
        {
          developer_hapikey: [],
        },
      ],
    },
  },
} as TPaths;
