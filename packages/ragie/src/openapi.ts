// @ts-nocheck
export type openapi = {
  openapi: '3.1.0';
  servers: [
    {
      url: 'https://api.ragie.ai';
    },
  ];
  paths: {
    '/documents': {
      post: {
        tags: ['documents'];
        summary: 'Create Document';
        description: 'On ingest, the document goes through a series of steps before it is ready for retrieval. Each step is reflected in the status of the document which can be one of [pending, partitioned, refined, extracted, chunked, indexed, summary_indexed, ready, failed]. The document is available for retreival once it is in ready state. The summary index step can take a few seconds. You can optionally use the document for retrieval once it is in indexed state. However the summary will only be available once the state has changed to summary_indexed or ready.';
        operationId: 'CreateDocument';
        security: [
          {
            auth: [];
          },
        ];
        requestBody: {
          required: true;
          content: {
            'multipart/form-data': {
              schema: {
                $ref: '#/components/schemas/CreateDocumentParams';
              };
            };
          };
        };
        responses: {
          '201': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Document';
                };
              };
            };
          };
          '400': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorMessage';
                };
              };
            };
            description: 'Bad Request';
          };
          '401': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorMessage';
                };
              };
            };
            description: 'Unauthorized';
          };
          '422': {
            description: 'Validation Error';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HTTPValidationError';
                };
              };
            };
          };
        };
        'x-speakeasy-name-override': 'create';
      };
      get: {
        tags: ['documents'];
        summary: 'List Documents';
        description: 'List all documents sorted by created_at in descending order. Results are paginated with a max limit of 100. When more documents are available, a `cursor` will be provided. Use the `cursor` parameter to retrieve the subsequent page.';
        operationId: 'ListDocuments';
        security: [
          {
            auth: [];
          },
        ];
        parameters: [
          {
            name: 'cursor';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                },
                {
                  type: 'null';
                },
              ];
              description: 'An opaque cursor for pagination';
              title: 'Cursor';
            };
            description: 'An opaque cursor for pagination';
          },
          {
            name: 'page_size';
            in: 'query';
            required: false;
            schema: {
              type: 'integer';
              maximum: 100;
              minimum: 1;
              description: 'The number of items per page (must be greater than 0 and less than or equal to 100)';
              default: 10;
              title: 'Page Size';
            };
            description: 'The number of items per page (must be greater than 0 and less than or equal to 100)';
          },
          {
            name: 'filter';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                },
                {
                  type: 'null';
                },
              ];
              description: 'The metadata search filter on documents. Returns only documents which match the filter. The following filter operators are supported: $eq - Equal to (number, string, boolean), $ne - Not equal to (number, string, boolean), $gt - Greater than (number), $gte - Greater than or equal to (number), $lt - Less than (number), $lte - Less than or equal to (number), $in - In array (string or number), $nin - Not in array (string or number). The operators can be combined with AND and OR. Read [Metadata & Filters guide](https://docs.ragie.ai/docs/metadata-filters) for more details and examples.';
              examples: {
                department: {
                  $in: ['sales', 'marketing'];
                };
              };
              title: 'Filter';
            };
            description: 'The metadata search filter on documents. Returns only documents which match the filter. The following filter operators are supported: $eq - Equal to (number, string, boolean), $ne - Not equal to (number, string, boolean), $gt - Greater than (number), $gte - Greater than or equal to (number), $lt - Less than (number), $lte - Less than or equal to (number), $in - In array (string or number), $nin - Not in array (string or number). The operators can be combined with AND and OR. Read [Metadata & Filters guide](https://docs.ragie.ai/docs/metadata-filters) for more details and examples.';
          },
        ];
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/DocumentList';
                };
              };
            };
          };
          '401': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorMessage';
                };
              };
            };
            description: 'Unauthorized';
          };
          '404': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorMessage';
                };
              };
            };
            description: 'Not Found';
          };
          '422': {
            description: 'Validation Error';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HTTPValidationError';
                };
              };
            };
          };
        };
        'x-speakeasy-name-override': 'list';
        'x-speakeasy-max-method-params': 0;
        'x-speakeasy-pagination': {
          type: 'cursor';
          inputs: [
            {
              name: 'cursor';
              type: 'cursor';
              in: 'parameters';
            },
          ];
          outputs: {
            nextCursor: '$.pagination.next_cursor';
          };
        };
      };
    };
    '/documents/raw': {
      post: {
        tags: ['documents'];
        summary: 'Create Document Raw';
        description: 'Ingest a document as raw text. On ingest, the document goes through a series of steps before it is ready for retrieval. Each step is reflected in the status of the document which can be one of [pending, partitioned, refined, extracted, chunked, indexed, summary_indexed, ready, failed]. The document is available for retreival once it is in ready state. The summary index step can take a few seconds. You can optionally use the document for retrieval once it is in indexed state. However the summary will only be available once the state has changed to summary_indexed or ready.';
        operationId: 'CreateDocumentRaw';
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CreateDocumentRawParams';
              };
            };
          };
          required: true;
        };
        responses: {
          '201': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Document';
                };
              };
            };
          };
          '400': {
            description: 'Bad Request';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorMessage';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorMessage';
                };
              };
            };
          };
          '422': {
            description: 'Validation Error';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HTTPValidationError';
                };
              };
            };
          };
        };
        security: [
          {
            auth: [];
          },
        ];
        'x-speakeasy-name-override': 'createRaw';
      };
    };
    '/documents/url': {
      post: {
        tags: ['documents'];
        summary: 'Create Document From Url';
        operationId: 'CreateDocumentFromUrl';
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CreateDocumentFromUrlParams';
              };
            };
          };
          required: true;
        };
        responses: {
          '201': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Document';
                };
              };
            };
          };
          '400': {
            description: 'Bad Request';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorMessage';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorMessage';
                };
              };
            };
          };
          '422': {
            description: 'Validation Error';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HTTPValidationError';
                };
              };
            };
          };
        };
        security: [
          {
            auth: [];
          },
        ];
      };
    };
    '/documents/{document_id}': {
      get: {
        tags: ['documents'];
        summary: 'Get Document';
        operationId: 'GetDocument';
        security: [
          {
            auth: [];
          },
        ];
        parameters: [
          {
            name: 'document_id';
            in: 'path';
            required: true;
            schema: {
              type: 'string';
              description: 'The id of the document.';
              title: 'Document Id';
            };
            description: 'The id of the document.';
            example: '<DOCUMENT_ID>';
          },
        ];
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Document';
                };
              };
            };
          };
          '401': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorMessage';
                };
              };
            };
            description: 'Unauthorized';
          };
          '404': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorMessage';
                };
              };
            };
            description: 'Not Found';
          };
          '422': {
            description: 'Validation Error';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HTTPValidationError';
                };
              };
            };
          };
        };
        'x-speakeasy-name-override': 'get';
      };
      delete: {
        tags: ['documents'];
        summary: 'Delete Document';
        operationId: 'DeleteDocument';
        security: [
          {
            auth: [];
          },
        ];
        parameters: [
          {
            name: 'document_id';
            in: 'path';
            required: true;
            schema: {
              type: 'string';
              description: 'The id of the document.';
              title: 'Document Id';
            };
            description: 'The id of the document.';
            example: '<DOCUMENT_ID>';
          },
        ];
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/DocumentDelete';
                };
              };
            };
          };
          '401': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorMessage';
                };
              };
            };
            description: 'Unauthorized';
          };
          '404': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorMessage';
                };
              };
            };
            description: 'Not Found';
          };
          '422': {
            description: 'Validation Error';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HTTPValidationError';
                };
              };
            };
          };
        };
        'x-speakeasy-name-override': 'delete';
      };
    };
    '/documents/{document_id}/file': {
      put: {
        tags: ['documents'];
        summary: 'Update Document File';
        operationId: 'UpdateDocumentFile';
        security: [
          {
            auth: [];
          },
        ];
        parameters: [
          {
            name: 'document_id';
            in: 'path';
            required: true;
            schema: {
              type: 'string';
              description: 'The id of the document.';
              title: 'Document Id';
            };
            description: 'The id of the document.';
            example: '<DOCUMENT_ID>';
          },
        ];
        requestBody: {
          required: true;
          content: {
            'multipart/form-data': {
              schema: {
                $ref: '#/components/schemas/UpdateDocumentFileParams';
              };
            };
          };
        };
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/DocumentFileUpdate';
                };
              };
            };
          };
          '401': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorMessage';
                };
              };
            };
            description: 'Unauthorized';
          };
          '404': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorMessage';
                };
              };
            };
            description: 'Not Found';
          };
          '422': {
            description: 'Validation Error';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HTTPValidationError';
                };
              };
            };
          };
        };
        'x-speakeasy-name-override': 'updateFile';
      };
    };
    '/documents/{document_id}/raw': {
      put: {
        tags: ['documents'];
        summary: 'Update Document Raw';
        operationId: 'UpdateDocumentRaw';
        security: [
          {
            auth: [];
          },
        ];
        parameters: [
          {
            name: 'document_id';
            in: 'path';
            required: true;
            schema: {
              type: 'string';
              description: 'The id of the document.';
              title: 'Document Id';
            };
            description: 'The id of the document.';
            example: '<DOCUMENT_ID>';
          },
        ];
        requestBody: {
          required: true;
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/UpdateDocumentRawParams';
              };
            };
          };
        };
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/DocumentRawUpdate';
                };
              };
            };
          };
          '401': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorMessage';
                };
              };
            };
            description: 'Unauthorized';
          };
          '404': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorMessage';
                };
              };
            };
            description: 'Not Found';
          };
          '422': {
            description: 'Validation Error';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HTTPValidationError';
                };
              };
            };
          };
        };
        'x-speakeasy-name-override': 'updateRaw';
      };
    };
    '/documents/{document_id}/metadata': {
      patch: {
        tags: ['documents'];
        summary: 'Patch Document Metadata';
        operationId: 'PatchDocumentMetadata';
        security: [
          {
            auth: [];
          },
        ];
        parameters: [
          {
            name: 'document_id';
            in: 'path';
            required: true;
            schema: {
              type: 'string';
              description: 'The id of the document.';
              title: 'Document Id';
            };
            description: 'The id of the document.';
            example: '<DOCUMENT_ID>';
          },
        ];
        requestBody: {
          required: true;
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PatchDocumentMetadataParams';
              };
            };
          };
        };
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/DocumentMetadataUpdate';
                };
              };
            };
          };
          '401': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorMessage';
                };
              };
            };
            description: 'Unauthorized';
          };
          '404': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorMessage';
                };
              };
            };
            description: 'Not Found';
          };
          '422': {
            description: 'Validation Error';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HTTPValidationError';
                };
              };
            };
          };
        };
        'x-speakeasy-name-override': 'patchMetadata';
      };
    };
    '/retrievals': {
      post: {
        tags: ['retrievals'];
        summary: 'Retrieve';
        operationId: 'Retrieve';
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/RetrieveParams';
              };
            };
          };
          required: true;
        };
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Retrieval';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorMessage';
                };
              };
            };
          };
          '422': {
            description: 'Validation Error';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HTTPValidationError';
                };
              };
            };
          };
        };
        security: [
          {
            auth: [];
          },
        ];
        'x-speakeasy-name-override': 'retrieve';
      };
    };
    '/documents/{document_id}/summary': {
      get: {
        tags: ['documents'];
        summary: 'Get Document Summary';
        description: "Get a LLM generated summary of the document. The summary is created when the document is first created or updated. Documents of types ['xlsx', 'csv', 'json'] are not supported for summarization. Documents greater than 1M in token length are not supported. This feature is in beta and may change in the future.";
        operationId: 'GetDocumentSummary';
        security: [
          {
            auth: [];
          },
        ];
        parameters: [
          {
            name: 'document_id';
            in: 'path';
            required: true;
            schema: {
              type: 'string';
              description: 'The id of the document.';
              title: 'Document Id';
            };
            description: 'The id of the document.';
            example: '<DOCUMENT_ID>';
          },
        ];
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/DocumentSummary';
                };
              };
            };
          };
          '401': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorMessage';
                };
              };
            };
            description: 'Unauthorized';
          };
          '404': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorMessage';
                };
              };
            };
            description: 'Not Found';
          };
          '422': {
            description: 'Validation Error';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HTTPValidationError';
                };
              };
            };
          };
        };
        'x-speakeasy-name-override': 'getSummary';
      };
    };
    '/instructions': {
      get: {
        tags: ['entities'];
        summary: 'List Instructions';
        description: 'List all instructions.';
        operationId: 'ListInstructions';
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  items: {
                    $ref: '#/components/schemas/Instruction';
                  };
                  type: 'array';
                  title: 'Response Listinstructions';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorMessage';
                };
              };
            };
          };
        };
        security: [
          {
            auth: [];
          },
        ];
        'x-speakeasy-name-override': 'listInstructions';
      };
      post: {
        tags: ['entities'];
        summary: 'Create Instruction';
        description: 'Create a new instruction. Instructions are applied to documents as they are created or updated. The results of the instruction are stored as structured data in the schema defined by the `entity_schema` parameter. The `prompt` parameter is a natural language instruction which will be applied to documents. This feature is in beta and may change in the future.';
        operationId: 'CreateInstruction';
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CreateInstructionParams';
              };
            };
          };
          required: true;
        };
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Instruction';
                };
              };
            };
          };
          '401': {
            description: 'Unauthorized';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorMessage';
                };
              };
            };
          };
          '422': {
            description: 'Validation Error';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HTTPValidationError';
                };
              };
            };
          };
        };
        security: [
          {
            auth: [];
          },
        ];
        'x-speakeasy-name-override': 'createInstruction';
      };
    };
    '/instructions/{instruction_id}': {
      put: {
        tags: ['entities'];
        summary: 'Update Instruction';
        operationId: 'UpdateInstruction';
        security: [
          {
            auth: [];
          },
        ];
        parameters: [
          {
            name: 'instruction_id';
            in: 'path';
            required: true;
            schema: {
              type: 'string';
              description: 'The ID of the instruction.';
              title: 'Instruction Id';
            };
            description: 'The ID of the instruction.';
            example: '<INSTRUCTION_ID>';
          },
        ];
        requestBody: {
          required: true;
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/UpdateInstructionParams';
              };
            };
          };
        };
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Instruction';
                };
              };
            };
          };
          '401': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorMessage';
                };
              };
            };
            description: 'Unauthorized';
          };
          '422': {
            description: 'Validation Error';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HTTPValidationError';
                };
              };
            };
          };
        };
        'x-speakeasy-name-override': 'updateInstruction';
      };
    };
    '/instructions/{instruction_id}/entities': {
      get: {
        tags: ['entities'];
        summary: 'Get Instruction Extracted Entities';
        operationId: 'ListEntitiesByInstruction';
        security: [
          {
            auth: [];
          },
        ];
        parameters: [
          {
            name: 'instruction_id';
            in: 'path';
            required: true;
            schema: {
              type: 'string';
              description: 'The ID of the instruction.';
              title: 'Instruction Id';
            };
            description: 'The ID of the instruction.';
            example: '<INSTRUCTION_ID>';
          },
          {
            name: 'cursor';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                },
                {
                  type: 'null';
                },
              ];
              description: 'An opaque cursor for pagination';
              title: 'Cursor';
            };
            description: 'An opaque cursor for pagination';
          },
          {
            name: 'page_size';
            in: 'query';
            required: false;
            schema: {
              type: 'integer';
              maximum: 100;
              minimum: 1;
              description: 'The number of items per page (must be greater than 0 and less than or equal to 100)';
              default: 10;
              title: 'Page Size';
            };
            description: 'The number of items per page (must be greater than 0 and less than or equal to 100)';
          },
        ];
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/EntityList';
                };
              };
            };
          };
          '401': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorMessage';
                };
              };
            };
            description: 'Unauthorized';
          };
          '422': {
            description: 'Validation Error';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HTTPValidationError';
                };
              };
            };
          };
        };
        'x-speakeasy-name-override': 'listByInstruction';
        'x-speakeasy-max-method-params': 2;
        'x-speakeasy-pagination': {
          type: 'cursor';
          inputs: [
            {
              name: 'cursor';
              type: 'cursor';
              in: 'parameters';
            },
          ];
          outputs: {
            nextCursor: '$.pagination.next_cursor';
          };
        };
      };
    };
    '/documents/{document_id}/entities': {
      get: {
        tags: ['entities'];
        summary: 'Get Document Extracted Entities';
        operationId: 'ListEntitiesByDocument';
        security: [
          {
            auth: [];
          },
        ];
        parameters: [
          {
            name: 'document_id';
            in: 'path';
            required: true;
            schema: {
              type: 'string';
              description: 'The id of the document.';
              title: 'Document Id';
            };
            description: 'The id of the document.';
            example: '<DOCUMENT_ID>';
          },
          {
            name: 'cursor';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                },
                {
                  type: 'null';
                },
              ];
              description: 'An opaque cursor for pagination';
              title: 'Cursor';
            };
            description: 'An opaque cursor for pagination';
          },
          {
            name: 'page_size';
            in: 'query';
            required: false;
            schema: {
              type: 'integer';
              maximum: 100;
              minimum: 1;
              description: 'The number of items per page (must be greater than 0 and less than or equal to 100)';
              default: 10;
              title: 'Page Size';
            };
            description: 'The number of items per page (must be greater than 0 and less than or equal to 100)';
          },
        ];
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/EntityList';
                };
              };
            };
          };
          '401': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorMessage';
                };
              };
            };
            description: 'Unauthorized';
          };
          '422': {
            description: 'Validation Error';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HTTPValidationError';
                };
              };
            };
          };
        };
        'x-speakeasy-name-override': 'listByDocument';
        'x-speakeasy-max-method-params': 2;
        'x-speakeasy-pagination': {
          type: 'cursor';
          inputs: [
            {
              name: 'cursor';
              type: 'cursor';
              in: 'parameters';
            },
          ];
          outputs: {
            nextCursor: '$.pagination.next_cursor';
          };
        };
      };
    };
  };
  components: {
    schemas: {
      Body_CreateDocument: {
        properties: {
          mode: {
            type: 'string';
            enum: ['hi_res', 'fast'];
            title: 'Mode';
            description: "Partition strategy for the document. Options are `'hi_res'` or `'fast'`. Only applicable for rich documents such as word documents and PDFs. When set to `'hi_res'`, images and tables will be extracted from the document. `'fast'` will only extract text. `'fast'` may be up to 20x faster than `'hi_res'`.";
            default: 'fast';
          };
          metadata: {
            type: 'string';
            title: 'Metadata';
            description: 'Metadata for the document. Keys must be strings. Values may be strings, numbers, booleans, or lists of strings. Numbers may be integers or floating point and will be converted to 64 bit floating point. 1000 total values are allowed. Each item in an array counts towards the total. The following keys are reserved for internal use: `document_id`, `document_type`, `document_source`, `document_name`, `document_uploaded_at`.';
            default: '{}';
          };
          file: {
            type: 'string';
            format: 'binary';
            title: 'File';
            description: 'The binary file to upload, extract, and index for retrieval. The following file types are supported: Plain Text: `.eml` `.html` `.json` `.md` `.msg` `.rst` `.rtf` `.txt` `.xml`\nImages: `.png` `.webp` `.jpg` `.jpeg` `.tiff` `.bmp` `.heic`\nDocuments: `.csv` `.doc` `.docx` `.epub` `.odt` `.pdf` `.ppt` `.pptx` `.tsv` `.xlsx`.';
          };
          external_id: {
            type: 'string';
            title: 'External Id';
            description: 'An optional identifier for the document. A common value might be an id in an external system or the URL where the source file may be found.';
          };
        };
        type: 'object';
        required: ['file'];
        title: 'Body_CreateDocument';
      };
      Body_UpdateDocumentFile: {
        properties: {
          mode: {
            type: 'string';
            enum: ['hi_res', 'fast'];
            title: 'Mode';
            description: "Partition strategy for the document. Options are `'hi_res'` or `'fast'`. Only applicable for rich documents such as word documents and PDFs. When set to `'hi_res'`, images and tables will be extracted from the document. `'fast'` will only extract text. `'fast'` may be up to 20x faster than `'hi_res'`.";
            default: 'fast';
          };
          file: {
            type: 'string';
            format: 'binary';
            title: 'File';
            description: 'The binary file to upload, extract, and index for retrieval. The following file types are supported: Plain Text: `.eml` `.html` `.json` `.md` `.msg` `.rst` `.rtf` `.txt` `.xml`\nImages: `.png` `.webp` `.jpg` `.jpeg` `.tiff` `.bmp` `.heic`\nDocuments: `.csv` `.doc` `.docx` `.epub` `.odt` `.pdf` `.ppt` `.pptx` `.tsv` `.xlsx`.';
          };
        };
        type: 'object';
        required: ['file'];
        title: 'Body_UpdateDocumentFile';
      };
      CreateDocumentFromUrlParams: {
        properties: {
          metadata: {
            additionalProperties: {
              anyOf: [
                {
                  type: 'string';
                },
                {
                  type: 'integer';
                },
                {
                  type: 'boolean';
                },
                {
                  items: {
                    type: 'string';
                  };
                  type: 'array';
                },
              ];
            };
            type: 'object';
            title: 'Metadata';
            description: 'Metadata for the document. Keys must be strings. Values may be strings, numbers, booleans, or lists of strings. Numbers may be integers or floating point and will be converted to 64 bit floating point. 1000 total values are allowed. Each item in an array counts towards the total. The following keys are reserved for internal use: `document_id`, `document_type`, `document_source`, `document_name`, `document_uploaded_at`.';
            default: {};
          };
          mode: {
            type: 'string';
            enum: ['hi_res', 'fast'];
            title: 'Mode';
            description: "Partition strategy for the document. Options are `'hi_res'` or `'fast'`. Only applicable for rich documents such as word documents and PDFs. When set to `'hi_res'`, images and tables will be extracted from the document. `'fast'` will only extract text. `'fast'` may be up to 20x faster than `'hi_res'`.";
            default: 'fast';
          };
          name: {
            type: 'string';
            title: 'Name';
          };
          external_id: {
            type: 'string';
            title: 'External Id';
          };
          url: {
            type: 'string';
            title: 'Url';
            description: 'Url of the file to download. Must be publicly accessible and HTTP or HTTPS scheme';
          };
        };
        type: 'object';
        required: ['url'];
        title: 'CreateDocumentFromUrlParams';
      };
      CreateDocumentRawParams: {
        properties: {
          metadata: {
            additionalProperties: {
              anyOf: [
                {
                  type: 'string';
                },
                {
                  type: 'integer';
                },
                {
                  type: 'boolean';
                },
                {
                  items: {
                    type: 'string';
                  };
                  type: 'array';
                },
              ];
            };
            type: 'object';
            title: 'Metadata';
            description: 'Metadata for the document. Keys must be strings. Values may be strings, numbers, booleans, or lists of strings. Numbers may be integers or floating point and will be converted to 64 bit floating point. 1000 total values are allowed. Each item in an array counts towards the total. The following keys are reserved for internal use: `document_id`, `document_type`, `document_source`, `document_name`, `document_uploaded_at`.';
            default: {};
          };
          data: {
            anyOf: [
              {
                type: 'string';
              },
              {
                type: 'object';
              },
            ];
            minLength: 1;
            title: 'Data';
            description: 'Document data in a text or JSON format.';
          };
        };
        type: 'object';
        required: ['data'];
        title: 'CreateDocumentRawParams';
      };
      CreateInstructionParams: {
        properties: {
          name: {
            type: 'string';
            title: 'Name';
            description: 'The name of the instruction. Must be unique.';
            example: 'Find all pizzas';
          };
          active: {
            type: 'boolean';
            title: 'Active';
            description: "Whether the instruction is active. Active instructions are applied to documents when they're created or when their file is updated.";
            default: true;
            example: true;
          };
          scope: {
            type: 'string';
            enum: ['document', 'chunk'];
            title: 'Scope';
            description: "The scope of the instruction. Determines whether the instruction is applied to the entire document or to each chunk of the document. Options are `'document'` or `'chunk'`. Generally `'document'` should be used when analyzing the full document is desired, such as when generating a summary or determining sentiment, and `'chunk'` should be used when a fine grained search over a document is desired.";
            default: 'chunk';
            example: 'Find all pizzas described in the text.';
          };
          prompt: {
            type: 'string';
            title: 'Prompt';
            description: 'A natural language instruction which will be applied to documents as they are created and updated. The results of the `instruction_prompt` will be stored as an `entity` in the schema defined by the `entity_schema` parameter.';
            example: 'Find all pizzas described in the text.';
          };
          entity_schema: {
            allOf: [
              {
                $ref: '#/components/schemas/EntitySchema';
              },
            ];
            description: 'The JSON schema definition of the entity generated by an instruction. The schema must define an `object` at its root. If the instruction is expected to generate multiple items, the root object should have a key which defines an array of the expected items. An instruction which generates multiple emails may be expressed as `{"type": "object", "properties": {"emails": { "type": "array", "items": { "type": "string"}}}}`. Simple values may be expressed as an object with a single key. For example, a summary instruction may generate a single string value. The schema might be `{"type": "object", "properties": { "summary": { "type": "string"}}}`.';
            example: {
              additionalProperties: false;
              properties: {
                size: {
                  enum: ['small', 'medium', 'large'];
                  type: 'string';
                };
                crust: {
                  enum: ['thin', 'thick', 'stuffed'];
                  type: 'string';
                };
                sauce: {
                  enum: ['tomato', 'alfredo', 'pesto'];
                  type: 'string';
                };
                cheese: {
                  enum: ['mozzarella', 'cheddar', 'parmesan', 'vegan'];
                  type: 'string';
                };
                toppings: {
                  items: {
                    enum: [
                      'pepperoni',
                      'mushrooms',
                      'onions',
                      'sausage',
                      'bacon',
                      'extra cheese',
                      'black olives',
                      'green peppers',
                      'pineapple',
                      'spinach',
                    ];
                    type: 'string';
                  };
                  type: 'array';
                  uniqueItems: true;
                };
                extraInstructions: {
                  type: 'string';
                };
              };
              required: ['size', 'crust', 'sauce', 'cheese'];
              title: 'Pizza';
              type: 'object';
            };
            additional_properties: true;
          };
          filter: {
            type: 'object';
            title: 'Filter';
            description: 'An optional metadata filter that is matched against document metadata during update and creation. The instruction will only be applied to documents with metadata matching the filter.  The following filter operators are supported: $eq - Equal to (number, string, boolean), $ne - Not equal to (number, string, boolean), $gt - Greater than (number), $gte - Greater than or equal to (number), $lt - Less than (number), $lte - Less than or equal to (number), $in - In array (string or number), $nin - Not in array (string or number). The operators can be combined with AND and OR. Read [Metadata & Filters guide](https://docs.ragie.ai/docs/metadata-filters) for more details and examples.';
            example: {
              toppings: {
                $in: ['pizza', 'mushrooms'];
              };
            };
          };
        };
        type: 'object';
        required: ['name', 'prompt', 'entity_schema'];
        title: 'CreateInstructionParams';
      };
      Document: {
        properties: {
          id: {
            type: 'string';
            format: 'uuid';
            title: 'Id';
          };
          created_at: {
            type: 'string';
            format: 'date-time';
            title: 'Created At';
          };
          updated_at: {
            type: 'string';
            format: 'date-time';
            title: 'Updated At';
          };
          status: {
            type: 'string';
            title: 'Status';
          };
          name: {
            type: 'string';
            title: 'Name';
          };
          metadata: {
            additionalProperties: {
              anyOf: [
                {
                  type: 'string';
                },
                {
                  type: 'integer';
                },
                {
                  type: 'boolean';
                },
                {
                  items: {
                    type: 'string';
                  };
                  type: 'array';
                },
              ];
            };
            type: 'object';
            title: 'Metadata';
          };
          chunk_count: {
            anyOf: [
              {
                type: 'integer';
              },
              {
                type: 'null';
              },
            ];
            title: 'Chunk Count';
          };
          external_id: {
            anyOf: [
              {
                type: 'string';
              },
              {
                type: 'null';
              },
            ];
            title: 'External Id';
          };
        };
        type: 'object';
        required: ['id', 'created_at', 'updated_at', 'status', 'name', 'metadata'];
        title: 'Document';
      };
      DocumentDelete: {
        properties: {
          status: {
            type: 'string';
            title: 'Status';
          };
        };
        type: 'object';
        required: ['status'];
        title: 'DocumentDelete';
      };
      DocumentFileUpdate: {
        properties: {
          status: {
            type: 'string';
            title: 'Status';
          };
        };
        type: 'object';
        required: ['status'];
        title: 'DocumentFileUpdate';
      };
      DocumentList: {
        properties: {
          pagination: {
            $ref: '#/components/schemas/Pagination';
          };
          documents: {
            items: {
              $ref: '#/components/schemas/Document';
            };
            type: 'array';
            title: 'Documents';
          };
        };
        type: 'object';
        required: ['pagination', 'documents'];
        title: 'DocumentList';
      };
      DocumentMetadata: {
        properties: {};
        additionalProperties: true;
        type: 'object';
        title: 'DocumentMetadata';
      };
      DocumentMetadataUpdate: {
        properties: {
          metadata: {
            additionalProperties: {
              anyOf: [
                {
                  type: 'string';
                },
                {
                  type: 'integer';
                },
                {
                  type: 'boolean';
                },
                {
                  items: {
                    type: 'string';
                  };
                  type: 'array';
                },
              ];
            };
            type: 'object';
            title: 'Metadata';
            description: 'The full document metadata inclusive of the update.';
            examples: [
              {
                editors: ['Alice', 'Bob'];
                title: 'declassified report';
                unchanged_key: 'unchanged_value';
                updated_at: 1714491736216;
              },
            ];
          };
        };
        type: 'object';
        required: ['metadata'];
        title: 'DocumentMetadataUpdate';
      };
      DocumentRawUpdate: {
        properties: {
          status: {
            type: 'string';
            title: 'Status';
          };
        };
        type: 'object';
        required: ['status'];
        title: 'DocumentRawUpdate';
      };
      DocumentSummary: {
        properties: {
          document_id: {
            type: 'string';
            title: 'Document Id';
          };
          summary: {
            type: 'string';
            title: 'Summary';
          };
        };
        type: 'object';
        required: ['document_id', 'summary'];
        title: 'DocumentSummary';
      };
      Entity: {
        properties: {
          id: {
            type: 'string';
            format: 'uuid';
            title: 'Id';
          };
          created_at: {
            type: 'string';
            format: 'date-time';
            title: 'Created At';
          };
          updated_at: {
            type: 'string';
            format: 'date-time';
            title: 'Updated At';
          };
          instruction_id: {
            type: 'string';
            format: 'uuid';
            title: 'Instruction Id';
            description: 'The ID of the instruction which generated the entity.';
          };
          document_id: {
            type: 'string';
            format: 'uuid';
            title: 'Document Id';
            description: 'The ID of the document which the entity was produced from.';
          };
          data: {
            allOf: [
              {
                $ref: '#/components/schemas/EntityData';
              },
            ];
            description: 'The entity data generated by the instruction.';
          };
        };
        type: 'object';
        required: ['id', 'created_at', 'updated_at', 'instruction_id', 'document_id', 'data'];
        title: 'Entity';
      };
      EntityData: {
        properties: {};
        additionalProperties: true;
        type: 'object';
        title: 'EntityData';
      };
      EntityList: {
        properties: {
          pagination: {
            $ref: '#/components/schemas/Pagination';
          };
          entities: {
            items: {
              $ref: '#/components/schemas/Entity';
            };
            type: 'array';
            title: 'Entities';
          };
        };
        type: 'object';
        required: ['pagination', 'entities'];
        title: 'EntityList';
      };
      EntitySchema: {
        properties: {};
        additionalProperties: true;
        type: 'object';
        title: 'EntitySchema';
      };
      ErrorMessage: {
        properties: {
          detail: {
            type: 'string';
            title: 'Detail';
          };
        };
        type: 'object';
        required: ['detail'];
        title: 'ErrorMessage';
      };
      HTTPValidationError: {
        properties: {
          detail: {
            items: {
              $ref: '#/components/schemas/ValidationError';
            };
            type: 'array';
            title: 'Detail';
          };
        };
        type: 'object';
        title: 'HTTPValidationError';
      };
      Instruction: {
        properties: {
          id: {
            type: 'string';
            format: 'uuid';
            title: 'Id';
          };
          created_at: {
            type: 'string';
            format: 'date-time';
            title: 'Created At';
          };
          updated_at: {
            type: 'string';
            format: 'date-time';
            title: 'Updated At';
          };
          name: {
            type: 'string';
            title: 'Name';
            description: 'The name of the instruction. Must be unique.';
            example: 'Find all pizzas';
          };
          active: {
            type: 'boolean';
            title: 'Active';
            description: "Whether the instruction is active. Active instructions are applied to documents when they're created or when their file is updated.";
            default: true;
            example: true;
          };
          scope: {
            type: 'string';
            enum: ['document', 'chunk'];
            title: 'Scope';
            description: "The scope of the instruction. Determines whether the instruction is applied to the entire document or to each chunk of the document. Options are `'document'` or `'chunk'`. Generally `'document'` should be used when analyzing the full document is desired, such as when generating a summary or determining sentiment, and `'chunk'` should be used when a fine grained search over a document is desired.";
            default: 'chunk';
            example: 'Find all pizzas described in the text.';
          };
          prompt: {
            type: 'string';
            title: 'Prompt';
            description: 'A natural language instruction which will be applied to documents as they are created and updated. The results of the `instruction_prompt` will be stored as an `entity` in the schema defined by the `entity_schema` parameter.';
            example: 'Find all pizzas described in the text.';
          };
          entity_schema: {
            allOf: [
              {
                $ref: '#/components/schemas/EntitySchema';
              },
            ];
            description: 'The JSON schema definition of the entity generated by an instruction. The schema must define an `object` at its root. If the instruction is expected to generate multiple items, the root object should have a key which defines an array of the expected items. An instruction which generates multiple emails may be expressed as `{"type": "object", "properties": {"emails": { "type": "array", "items": { "type": "string"}}}}`. Simple values may be expressed as an object with a single key. For example, a summary instruction may generate a single string value. The schema might be `{"type": "object", "properties": { "summary": { "type": "string"}}}`.';
            example: {
              additionalProperties: false;
              properties: {
                size: {
                  enum: ['small', 'medium', 'large'];
                  type: 'string';
                };
                crust: {
                  enum: ['thin', 'thick', 'stuffed'];
                  type: 'string';
                };
                sauce: {
                  enum: ['tomato', 'alfredo', 'pesto'];
                  type: 'string';
                };
                cheese: {
                  enum: ['mozzarella', 'cheddar', 'parmesan', 'vegan'];
                  type: 'string';
                };
                toppings: {
                  items: {
                    enum: [
                      'pepperoni',
                      'mushrooms',
                      'onions',
                      'sausage',
                      'bacon',
                      'extra cheese',
                      'black olives',
                      'green peppers',
                      'pineapple',
                      'spinach',
                    ];
                    type: 'string';
                  };
                  type: 'array';
                  uniqueItems: true;
                };
                extraInstructions: {
                  type: 'string';
                };
              };
              required: ['size', 'crust', 'sauce', 'cheese'];
              title: 'Pizza';
              type: 'object';
            };
            additional_properties: true;
          };
          filter: {
            type: 'object';
            title: 'Filter';
            description: 'An optional metadata filter that is matched against document metadata during update and creation. The instruction will only be applied to documents with metadata matching the filter.  The following filter operators are supported: $eq - Equal to (number, string, boolean), $ne - Not equal to (number, string, boolean), $gt - Greater than (number), $gte - Greater than or equal to (number), $lt - Less than (number), $lte - Less than or equal to (number), $in - In array (string or number), $nin - Not in array (string or number). The operators can be combined with AND and OR. Read [Metadata & Filters guide](https://docs.ragie.ai/docs/metadata-filters) for more details and examples.';
            example: {
              toppings: {
                $in: ['pizza', 'mushrooms'];
              };
            };
          };
        };
        type: 'object';
        required: ['id', 'created_at', 'updated_at', 'name', 'prompt', 'entity_schema'];
        title: 'Instruction';
      };
      MetadataFilter: {
        properties: {};
        additionalProperties: true;
        type: 'object';
        title: 'MetadataFilter';
      };
      Pagination: {
        properties: {
          next_cursor: {
            anyOf: [
              {
                type: 'string';
              },
              {
                type: 'null';
              },
            ];
            title: 'Next Cursor';
          };
        };
        type: 'object';
        title: 'Pagination';
      };
      PatchDocumentMetadataParams: {
        properties: {
          metadata: {
            additionalProperties: {
              anyOf: [
                {
                  type: 'string';
                },
                {
                  type: 'integer';
                },
                {
                  type: 'boolean';
                },
                {
                  items: {
                    type: 'string';
                  };
                  type: 'array';
                },
                {
                  type: 'null';
                },
              ];
            };
            type: 'object';
            title: 'Metadata';
            description: "The metadata to update on the document. Performs a partial update of the document's metadata. Keys must be strings. Values may be strings, numbers, booleans, or lists of strings. Numbers may be integers or floating point and will be converted to 64 bit floating point. Keys set to `null` are deleted. 1000 total values are allowed, inclusive of existing metadata. Each item in an array counts towards the total. The following keys are reserved for internal use: `document_id`, `document_type`, `document_source`, `document_name`, `document_uploaded_at`, `__ragie__document_version_id`, `__ragie__chunk_size_chars`, `__ragie__chunk_overlap_chars`.";
            examples: [
              {
                classified: 'null (setting null deletes key from metadata)';
                editors: ['Alice', 'Bob'];
                title: 'declassified report';
                updated_at: 1714491736216;
              },
            ];
          };
        };
        type: 'object';
        required: ['metadata'];
        title: 'PatchDocumentMetadataParams';
      };
      Retrieval: {
        properties: {
          scored_chunks: {
            items: {
              $ref: '#/components/schemas/ScoredChunk';
            };
            type: 'array';
            title: 'Scored Chunks';
          };
        };
        type: 'object';
        required: ['scored_chunks'];
        title: 'Retrieval';
      };
      RetrieveParams: {
        properties: {
          query: {
            type: 'string';
            title: 'Query';
            description: 'The query to search with when retrieving document chunks.';
            example: 'What is the best pizza place in SF?';
          };
          top_k: {
            type: 'integer';
            title: 'Top K';
            description: 'The maximum number of chunks to return. Defaults to 8.';
            default: 8;
            example: 8;
          };
          filter: {
            allOf: [
              {
                $ref: '#/components/schemas/MetadataFilter';
              },
            ];
            title: 'Filter';
            description: 'The metadata search filter on documents. Returns chunks only from documents which match the filter. The following filter operators are supported: $eq - Equal to (number, string, boolean), $ne - Not equal to (number, string, boolean), $gt - Greater than (number), $gte - Greater than or equal to (number), $lt - Less than (number), $lte - Less than or equal to (number), $in - In array (string or number), $nin - Not in array (string or number). The operators can be combined with AND and OR. Read [Metadata & Filters guide](https://docs.ragie.ai/docs/metadata-filters) for more details and examples.';
            example: {
              department: {
                $in: ['sales', 'marketing'];
              };
            };
          };
          rerank: {
            type: 'boolean';
            title: 'Rerank';
            description: 'Reranks the chunks for semantic relevancy post cosine similarity. Will be slower but returns a subset of highly relevant chunks. Best for reducing hallucinations and improving accuracy for LLM generation.';
            default: false;
            example: true;
          };
          max_chunks_per_document: {
            type: 'integer';
            title: 'Max Chunks Per Document';
            description: 'Maximum number of chunks to retrieve per document. Use this to increase the number of documents the final chunks are retreived from. This feature is in beta and may change in the future.';
            example: 0;
          };
        };
        type: 'object';
        required: ['query'];
        title: 'RetrieveParams';
      };
      ScoredChunk: {
        properties: {
          text: {
            type: 'string';
            title: 'Text';
          };
          score: {
            type: 'number';
            title: 'Score';
          };
          document_id: {
            type: 'string';
            title: 'Document Id';
          };
          document_metadata: {
            $ref: '#/components/schemas/DocumentMetadata';
          };
        };
        type: 'object';
        required: ['text', 'score', 'document_id', 'document_metadata'];
        title: 'ScoredChunk';
      };
      UpdateDocumentRawParams: {
        properties: {
          data: {
            anyOf: [
              {
                type: 'string';
              },
              {
                type: 'object';
              },
            ];
            minLength: 1;
            title: 'Data';
            description: 'Document data in a text or JSON format.';
          };
        };
        type: 'object';
        required: ['data'];
        title: 'UpdateDocumentRawParams';
      };
      UpdateInstructionParams: {
        properties: {
          active: {
            type: 'boolean';
            title: 'Active';
            description: "Whether the instruction is active. Active instructions are applied to documents when they're created or when their file is updated.";
            example: true;
          };
        };
        type: 'object';
        required: ['active'];
        title: 'UpdateInstructionParams';
      };
      ValidationError: {
        properties: {
          loc: {
            items: {
              anyOf: [
                {
                  type: 'string';
                },
                {
                  type: 'integer';
                },
              ];
            };
            type: 'array';
            title: 'Location';
          };
          msg: {
            type: 'string';
            title: 'Message';
          };
          type: {
            type: 'string';
            title: 'Error Type';
          };
        };
        type: 'object';
        required: ['loc', 'msg', 'type'];
        title: 'ValidationError';
      };
      CreateDocumentParams: {
        type: 'object';
        title: 'CreateDocumentParams';
        properties: {
          mode: {
            type: 'string';
            enum: ['hi_res', 'fast'];
            title: 'Mode';
            description: "Partition strategy for the document. Options are `'hi_res'` or `'fast'`. Only applicable for rich documents such as word documents and PDFs. When set to `'hi_res'`, images and tables will be extracted from the document. `'fast'` will only extract text. `'fast'` may be up to 20x faster than `'hi_res'`.";
            default: 'fast';
          };
          metadata: {
            type: 'object';
            title: 'Metadata';
            description: 'Metadata for the document. Keys must be strings. Values may be strings, numbers, booleans, or lists of strings. Numbers may be integers or floating point and will be converted to 64 bit floating point. 1000 total values are allowed. Each item in an array counts towards the total. The following keys are reserved for internal use: `document_id`, `document_type`, `document_source`, `document_name`, `document_uploaded_at`.';
            default: '{}';
            additionalProperties: {
              oneOf: [
                {
                  type: 'string';
                },
                {
                  type: 'number';
                },
                {
                  type: 'boolean';
                },
                {
                  type: 'array';
                  items: {
                    type: 'string';
                  };
                },
              ];
            };
          };
          file: {
            type: 'string';
            format: 'binary';
            title: 'File';
            description: 'The binary file to upload, extract, and index for retrieval. The following file types are supported: Plain Text: `.eml` `.html` `.json` `.md` `.msg` `.rst` `.rtf` `.txt` `.xml`\nImages: `.png` `.webp` `.jpg` `.jpeg` `.tiff` `.bmp` `.heic`\nDocuments: `.csv` `.doc` `.docx` `.epub` `.odt` `.pdf` `.ppt` `.pptx` `.tsv` `.xlsx`.';
          };
          external_id: {
            type: 'string';
            title: 'External Id';
            description: 'An optional identifier for the document. A common value might be an id in an external system or the URL where the source file may be found.';
          };
        };
        required: ['file'];
      };
      UpdateDocumentFileParams: {
        type: 'object';
        title: 'UpdateDocumentFileParams';
        properties: {
          mode: {
            type: 'string';
            enum: ['hi_res', 'fast'];
            title: 'Mode';
            description: "Partition strategy for the document. Options are `'hi_res'` or `'fast'`. Only applicable for rich documents such as word documents and PDFs. When set to `'hi_res'`, images and tables will be extracted from the document. `'fast'` will only extract text. `'fast'` may be up to 20x faster than `'hi_res'`.";
            default: 'fast';
          };
          file: {
            type: 'string';
            format: 'binary';
            title: 'File';
            description: 'The binary file to upload, extract, and index for retrieval. The following file types are supported: Plain Text: `.eml` `.html` `.json` `.md` `.msg` `.rst` `.rtf` `.txt` `.xml`\nImages: `.png` `.webp` `.jpg` `.jpeg` `.tiff` `.bmp` `.heic`\nDocuments: `.csv` `.doc` `.docx` `.epub` `.odt` `.pdf` `.ppt` `.pptx` `.tsv` `.xlsx`.';
          };
        };
        required: ['file'];
      };
    };
    securitySchemes: {
      auth: {
        type: 'http';
        scheme: 'bearer';
      };
    };
  };
  security: [
    {
      auth: [];
    },
  ];
  'x-readme': {
    'explorer-enabled': true;
    'proxy-enabled': true;
  };
};
