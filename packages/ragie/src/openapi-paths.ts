// @ts-nocheck
export type TPaths = {
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
export const paths = {
  '/documents': {
    post: {
      tags: ['documents'],
      summary: 'Create Document',
      description:
        'On ingest, the document goes through a series of steps before it is ready for retrieval. Each step is reflected in the status of the document which can be one of [pending, partitioned, refined, extracted, chunked, indexed, summary_indexed, ready, failed]. The document is available for retreival once it is in ready state. The summary index step can take a few seconds. You can optionally use the document for retrieval once it is in indexed state. However the summary will only be available once the state has changed to summary_indexed or ready.',
      operationId: 'CreateDocument',
      security: [
        {
          auth: [],
        },
      ],
      requestBody: {
        required: true,
        content: {
          'multipart/form-data': {
            schema: {
              $ref: '#/components/schemas/CreateDocumentParams',
            },
          },
        },
      },
      responses: {
        '201': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Document',
              },
            },
          },
        },
        '400': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorMessage',
              },
            },
          },
          description: 'Bad Request',
        },
        '401': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorMessage',
              },
            },
          },
          description: 'Unauthorized',
        },
        '422': {
          description: 'Validation Error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/HTTPValidationError',
              },
            },
          },
        },
      },
      'x-speakeasy-name-override': 'create',
    },
    get: {
      tags: ['documents'],
      summary: 'List Documents',
      description:
        'List all documents sorted by created_at in descending order. Results are paginated with a max limit of 100. When more documents are available, a `cursor` will be provided. Use the `cursor` parameter to retrieve the subsequent page.',
      operationId: 'ListDocuments',
      security: [
        {
          auth: [],
        },
      ],
      parameters: [
        {
          name: 'cursor',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
              },
              {
                type: 'null',
              },
            ],
            description: 'An opaque cursor for pagination',
            title: 'Cursor',
          },
          description: 'An opaque cursor for pagination',
        },
        {
          name: 'page_size',
          in: 'query',
          required: false,
          schema: {
            type: 'integer',
            maximum: 100,
            minimum: 1,
            description: 'The number of items per page (must be greater than 0 and less than or equal to 100)',
            default: 10,
            title: 'Page Size',
          },
          description: 'The number of items per page (must be greater than 0 and less than or equal to 100)',
        },
        {
          name: 'filter',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
              },
              {
                type: 'null',
              },
            ],
            description:
              'The metadata search filter on documents. Returns only documents which match the filter. The following filter operators are supported: $eq - Equal to (number, string, boolean), $ne - Not equal to (number, string, boolean), $gt - Greater than (number), $gte - Greater than or equal to (number), $lt - Less than (number), $lte - Less than or equal to (number), $in - In array (string or number), $nin - Not in array (string or number). The operators can be combined with AND and OR. Read [Metadata & Filters guide](https://docs.ragie.ai/docs/metadata-filters) for more details and examples.',
            examples: {
              department: {
                $in: ['sales', 'marketing'],
              },
            },
            title: 'Filter',
          },
          description:
            'The metadata search filter on documents. Returns only documents which match the filter. The following filter operators are supported: $eq - Equal to (number, string, boolean), $ne - Not equal to (number, string, boolean), $gt - Greater than (number), $gte - Greater than or equal to (number), $lt - Less than (number), $lte - Less than or equal to (number), $in - In array (string or number), $nin - Not in array (string or number). The operators can be combined with AND and OR. Read [Metadata & Filters guide](https://docs.ragie.ai/docs/metadata-filters) for more details and examples.',
        },
      ],
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/DocumentList',
              },
            },
          },
        },
        '401': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorMessage',
              },
            },
          },
          description: 'Unauthorized',
        },
        '404': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorMessage',
              },
            },
          },
          description: 'Not Found',
        },
        '422': {
          description: 'Validation Error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/HTTPValidationError',
              },
            },
          },
        },
      },
      'x-speakeasy-name-override': 'list',
      'x-speakeasy-max-method-params': 0,
      'x-speakeasy-pagination': {
        type: 'cursor',
        inputs: [
          {
            name: 'cursor',
            type: 'cursor',
            in: 'parameters',
          },
        ],
        outputs: {
          nextCursor: '$.pagination.next_cursor',
        },
      },
    },
  },
  '/documents/raw': {
    post: {
      tags: ['documents'],
      summary: 'Create Document Raw',
      description:
        'Ingest a document as raw text. On ingest, the document goes through a series of steps before it is ready for retrieval. Each step is reflected in the status of the document which can be one of [pending, partitioned, refined, extracted, chunked, indexed, summary_indexed, ready, failed]. The document is available for retreival once it is in ready state. The summary index step can take a few seconds. You can optionally use the document for retrieval once it is in indexed state. However the summary will only be available once the state has changed to summary_indexed or ready.',
      operationId: 'CreateDocumentRaw',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/CreateDocumentRawParams',
            },
          },
        },
        required: true,
      },
      responses: {
        '201': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Document',
              },
            },
          },
        },
        '400': {
          description: 'Bad Request',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorMessage',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorMessage',
              },
            },
          },
        },
        '422': {
          description: 'Validation Error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/HTTPValidationError',
              },
            },
          },
        },
      },
      security: [
        {
          auth: [],
        },
      ],
      'x-speakeasy-name-override': 'createRaw',
    },
  },
  '/documents/url': {
    post: {
      tags: ['documents'],
      summary: 'Create Document From Url',
      operationId: 'CreateDocumentFromUrl',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/CreateDocumentFromUrlParams',
            },
          },
        },
        required: true,
      },
      responses: {
        '201': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Document',
              },
            },
          },
        },
        '400': {
          description: 'Bad Request',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorMessage',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorMessage',
              },
            },
          },
        },
        '422': {
          description: 'Validation Error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/HTTPValidationError',
              },
            },
          },
        },
      },
      security: [
        {
          auth: [],
        },
      ],
    },
  },
  '/documents/{document_id}': {
    get: {
      tags: ['documents'],
      summary: 'Get Document',
      operationId: 'GetDocument',
      security: [
        {
          auth: [],
        },
      ],
      parameters: [
        {
          name: 'document_id',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            description: 'The id of the document.',
            title: 'Document Id',
          },
          description: 'The id of the document.',
          example: '<DOCUMENT_ID>',
        },
      ],
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Document',
              },
            },
          },
        },
        '401': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorMessage',
              },
            },
          },
          description: 'Unauthorized',
        },
        '404': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorMessage',
              },
            },
          },
          description: 'Not Found',
        },
        '422': {
          description: 'Validation Error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/HTTPValidationError',
              },
            },
          },
        },
      },
      'x-speakeasy-name-override': 'get',
    },
    delete: {
      tags: ['documents'],
      summary: 'Delete Document',
      operationId: 'DeleteDocument',
      security: [
        {
          auth: [],
        },
      ],
      parameters: [
        {
          name: 'document_id',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            description: 'The id of the document.',
            title: 'Document Id',
          },
          description: 'The id of the document.',
          example: '<DOCUMENT_ID>',
        },
      ],
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/DocumentDelete',
              },
            },
          },
        },
        '401': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorMessage',
              },
            },
          },
          description: 'Unauthorized',
        },
        '404': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorMessage',
              },
            },
          },
          description: 'Not Found',
        },
        '422': {
          description: 'Validation Error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/HTTPValidationError',
              },
            },
          },
        },
      },
      'x-speakeasy-name-override': 'delete',
    },
  },
  '/documents/{document_id}/file': {
    put: {
      tags: ['documents'],
      summary: 'Update Document File',
      operationId: 'UpdateDocumentFile',
      security: [
        {
          auth: [],
        },
      ],
      parameters: [
        {
          name: 'document_id',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            description: 'The id of the document.',
            title: 'Document Id',
          },
          description: 'The id of the document.',
          example: '<DOCUMENT_ID>',
        },
      ],
      requestBody: {
        required: true,
        content: {
          'multipart/form-data': {
            schema: {
              $ref: '#/components/schemas/UpdateDocumentFileParams',
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/DocumentFileUpdate',
              },
            },
          },
        },
        '401': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorMessage',
              },
            },
          },
          description: 'Unauthorized',
        },
        '404': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorMessage',
              },
            },
          },
          description: 'Not Found',
        },
        '422': {
          description: 'Validation Error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/HTTPValidationError',
              },
            },
          },
        },
      },
      'x-speakeasy-name-override': 'updateFile',
    },
  },
  '/documents/{document_id}/raw': {
    put: {
      tags: ['documents'],
      summary: 'Update Document Raw',
      operationId: 'UpdateDocumentRaw',
      security: [
        {
          auth: [],
        },
      ],
      parameters: [
        {
          name: 'document_id',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            description: 'The id of the document.',
            title: 'Document Id',
          },
          description: 'The id of the document.',
          example: '<DOCUMENT_ID>',
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/UpdateDocumentRawParams',
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/DocumentRawUpdate',
              },
            },
          },
        },
        '401': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorMessage',
              },
            },
          },
          description: 'Unauthorized',
        },
        '404': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorMessage',
              },
            },
          },
          description: 'Not Found',
        },
        '422': {
          description: 'Validation Error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/HTTPValidationError',
              },
            },
          },
        },
      },
      'x-speakeasy-name-override': 'updateRaw',
    },
  },
  '/documents/{document_id}/metadata': {
    patch: {
      tags: ['documents'],
      summary: 'Patch Document Metadata',
      operationId: 'PatchDocumentMetadata',
      security: [
        {
          auth: [],
        },
      ],
      parameters: [
        {
          name: 'document_id',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            description: 'The id of the document.',
            title: 'Document Id',
          },
          description: 'The id of the document.',
          example: '<DOCUMENT_ID>',
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/PatchDocumentMetadataParams',
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/DocumentMetadataUpdate',
              },
            },
          },
        },
        '401': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorMessage',
              },
            },
          },
          description: 'Unauthorized',
        },
        '404': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorMessage',
              },
            },
          },
          description: 'Not Found',
        },
        '422': {
          description: 'Validation Error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/HTTPValidationError',
              },
            },
          },
        },
      },
      'x-speakeasy-name-override': 'patchMetadata',
    },
  },
  '/retrievals': {
    post: {
      tags: ['retrievals'],
      summary: 'Retrieve',
      operationId: 'Retrieve',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/RetrieveParams',
            },
          },
        },
        required: true,
      },
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Retrieval',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorMessage',
              },
            },
          },
        },
        '422': {
          description: 'Validation Error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/HTTPValidationError',
              },
            },
          },
        },
      },
      security: [
        {
          auth: [],
        },
      ],
      'x-speakeasy-name-override': 'retrieve',
    },
  },
  '/documents/{document_id}/summary': {
    get: {
      tags: ['documents'],
      summary: 'Get Document Summary',
      description:
        "Get a LLM generated summary of the document. The summary is created when the document is first created or updated. Documents of types ['xlsx', 'csv', 'json'] are not supported for summarization. Documents greater than 1M in token length are not supported. This feature is in beta and may change in the future.",
      operationId: 'GetDocumentSummary',
      security: [
        {
          auth: [],
        },
      ],
      parameters: [
        {
          name: 'document_id',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            description: 'The id of the document.',
            title: 'Document Id',
          },
          description: 'The id of the document.',
          example: '<DOCUMENT_ID>',
        },
      ],
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/DocumentSummary',
              },
            },
          },
        },
        '401': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorMessage',
              },
            },
          },
          description: 'Unauthorized',
        },
        '404': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorMessage',
              },
            },
          },
          description: 'Not Found',
        },
        '422': {
          description: 'Validation Error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/HTTPValidationError',
              },
            },
          },
        },
      },
      'x-speakeasy-name-override': 'getSummary',
    },
  },
  '/instructions': {
    get: {
      tags: ['entities'],
      summary: 'List Instructions',
      description: 'List all instructions.',
      operationId: 'ListInstructions',
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                items: {
                  $ref: '#/components/schemas/Instruction',
                },
                type: 'array',
                title: 'Response Listinstructions',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorMessage',
              },
            },
          },
        },
      },
      security: [
        {
          auth: [],
        },
      ],
      'x-speakeasy-name-override': 'listInstructions',
    },
    post: {
      tags: ['entities'],
      summary: 'Create Instruction',
      description:
        'Create a new instruction. Instructions are applied to documents as they are created or updated. The results of the instruction are stored as structured data in the schema defined by the `entity_schema` parameter. The `prompt` parameter is a natural language instruction which will be applied to documents. This feature is in beta and may change in the future.',
      operationId: 'CreateInstruction',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/CreateInstructionParams',
            },
          },
        },
        required: true,
      },
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Instruction',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorMessage',
              },
            },
          },
        },
        '422': {
          description: 'Validation Error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/HTTPValidationError',
              },
            },
          },
        },
      },
      security: [
        {
          auth: [],
        },
      ],
      'x-speakeasy-name-override': 'createInstruction',
    },
  },
  '/instructions/{instruction_id}': {
    put: {
      tags: ['entities'],
      summary: 'Update Instruction',
      operationId: 'UpdateInstruction',
      security: [
        {
          auth: [],
        },
      ],
      parameters: [
        {
          name: 'instruction_id',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            description: 'The ID of the instruction.',
            title: 'Instruction Id',
          },
          description: 'The ID of the instruction.',
          example: '<INSTRUCTION_ID>',
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/UpdateInstructionParams',
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Instruction',
              },
            },
          },
        },
        '401': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorMessage',
              },
            },
          },
          description: 'Unauthorized',
        },
        '422': {
          description: 'Validation Error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/HTTPValidationError',
              },
            },
          },
        },
      },
      'x-speakeasy-name-override': 'updateInstruction',
    },
  },
  '/instructions/{instruction_id}/entities': {
    get: {
      tags: ['entities'],
      summary: 'Get Instruction Extracted Entities',
      operationId: 'ListEntitiesByInstruction',
      security: [
        {
          auth: [],
        },
      ],
      parameters: [
        {
          name: 'instruction_id',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            description: 'The ID of the instruction.',
            title: 'Instruction Id',
          },
          description: 'The ID of the instruction.',
          example: '<INSTRUCTION_ID>',
        },
        {
          name: 'cursor',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
              },
              {
                type: 'null',
              },
            ],
            description: 'An opaque cursor for pagination',
            title: 'Cursor',
          },
          description: 'An opaque cursor for pagination',
        },
        {
          name: 'page_size',
          in: 'query',
          required: false,
          schema: {
            type: 'integer',
            maximum: 100,
            minimum: 1,
            description: 'The number of items per page (must be greater than 0 and less than or equal to 100)',
            default: 10,
            title: 'Page Size',
          },
          description: 'The number of items per page (must be greater than 0 and less than or equal to 100)',
        },
      ],
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/EntityList',
              },
            },
          },
        },
        '401': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorMessage',
              },
            },
          },
          description: 'Unauthorized',
        },
        '422': {
          description: 'Validation Error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/HTTPValidationError',
              },
            },
          },
        },
      },
      'x-speakeasy-name-override': 'listByInstruction',
      'x-speakeasy-max-method-params': 2,
      'x-speakeasy-pagination': {
        type: 'cursor',
        inputs: [
          {
            name: 'cursor',
            type: 'cursor',
            in: 'parameters',
          },
        ],
        outputs: {
          nextCursor: '$.pagination.next_cursor',
        },
      },
    },
  },
  '/documents/{document_id}/entities': {
    get: {
      tags: ['entities'],
      summary: 'Get Document Extracted Entities',
      operationId: 'ListEntitiesByDocument',
      security: [
        {
          auth: [],
        },
      ],
      parameters: [
        {
          name: 'document_id',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            description: 'The id of the document.',
            title: 'Document Id',
          },
          description: 'The id of the document.',
          example: '<DOCUMENT_ID>',
        },
        {
          name: 'cursor',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
              },
              {
                type: 'null',
              },
            ],
            description: 'An opaque cursor for pagination',
            title: 'Cursor',
          },
          description: 'An opaque cursor for pagination',
        },
        {
          name: 'page_size',
          in: 'query',
          required: false,
          schema: {
            type: 'integer',
            maximum: 100,
            minimum: 1,
            description: 'The number of items per page (must be greater than 0 and less than or equal to 100)',
            default: 10,
            title: 'Page Size',
          },
          description: 'The number of items per page (must be greater than 0 and less than or equal to 100)',
        },
      ],
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/EntityList',
              },
            },
          },
        },
        '401': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorMessage',
              },
            },
          },
          description: 'Unauthorized',
        },
        '422': {
          description: 'Validation Error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/HTTPValidationError',
              },
            },
          },
        },
      },
      'x-speakeasy-name-override': 'listByDocument',
      'x-speakeasy-max-method-params': 2,
      'x-speakeasy-pagination': {
        type: 'cursor',
        inputs: [
          {
            name: 'cursor',
            type: 'cursor',
            in: 'parameters',
          },
        ],
        outputs: {
          nextCursor: '$.pagination.next_cursor',
        },
      },
    },
  },
} as TPaths;
