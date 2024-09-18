// @ts-nocheck
export type openapi = {
  openapi: '3.0.0';
  servers: [
    {
      url: 'https://api.anthropic.com/v1';
    },
  ];
  paths: {
    '/complete': {
      post: {
        operationId: 'complete';
        tags: ['Anthropic'];
        summary: 'Creates a completion for the provided prompt and parameters.';
        requestBody: {
          required: true;
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CreateCompletionRequest';
              };
            };
          };
        };
        responses: {
          '200': {
            description: 'OK';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/CreateCompletionResponse';
                };
              };
            };
          };
        };
        'x-oaiMeta': {
          name: 'Create completion';
          group: 'completions';
          path: 'create';
          examples: {
            curl: 'curl https://api.anthropic.com/v1/complete \\\n  --header \'accept: application/json\' \\\n  --header \'anthropic-version: 2023-06-01\' \\\n  --header \'content-type: application/json\' \\\n  --header \'x-api-key: $ANTHROPIC_API_KEY\' \\\n  --data \'\n  {\n    "model": "claude-2",\n    "prompt": "\\n\\nHuman: Hello, world!\\n\\nAssistant:",\n    "max_tokens_to_sample": 256\n  }\'\n';
          };
          parameters: '{\n  "model": "claude-2",\n  "prompt": "\\n\\nHuman: Hello, world!\\n\\nAssistant:",\n  "max_tokens_to_sample": 256\n}\n';
          response: '{\n  "completion": " Hello! My name is Claude.",\n  "stop_reason": "stop_sequence",\n  "model": "claude-2"\n}\n';
        };
      };
    };
  };
  components: {
    schemas: {
      Error: {
        type: 'object';
        properties: {
          type: {
            type: 'string';
            nullable: false;
          };
          message: {
            type: 'string';
            nullable: false;
          };
        };
        required: ['type', 'message'];
      };
      ErrorResponse: {
        type: 'object';
        properties: {
          error: {
            $ref: '#/components/schemas/Error';
          };
        };
        required: ['error'];
      };
      CreateCompletionRequest: {
        type: 'object';
        properties: {
          model: {
            description: 'The model that will complete your prompt.\nAs we improve Claude, we develop new versions of it that you can query.\nThis parameter controls which version of Claude answers your request.\nRight now we are offering two model families: Claude, and Claude Instant.\nYou can use them by setting model to "claude-2" or "claude-instant-1", respectively.\nSee models for additional details.\n';
            oneOf: [
              {
                type: 'string';
              },
              {
                type: 'string';
                enum: ['claude-2', 'claude-2.0', 'claude-instant-1', 'claude-instant-1.1'];
              },
            ];
            'x-oaiTypeLabel': 'string';
          };
          prompt: {
            description: 'The prompt that you want Claude to complete.\n\nFor proper response generation you will need to format your prompt as follows:\n\\n\\nHuman: ${userQuestion}\\n\\nAssistant:\nSee our comments on prompts for more context.\n';
            default: '<|endoftext|>';
            nullable: true;
            oneOf: [
              {
                type: 'string';
                default: '';
                example: 'This is a test.';
              },
              {
                type: 'array';
                items: {
                  type: 'string';
                  default: '';
                  example: 'This is a test.';
                };
              },
              {
                type: 'array';
                minItems: 1;
                items: {
                  type: 'integer';
                };
                example: '[1212, 318, 257, 1332, 13]';
              },
              {
                type: 'array';
                minItems: 1;
                items: {
                  type: 'array';
                  minItems: 1;
                  items: {
                    type: 'integer';
                  };
                };
                example: '[[1212, 318, 257, 1332, 13]]';
              },
            ];
          };
          max_tokens_to_sample: {
            type: 'integer';
            minimum: 1;
            default: 256;
            example: 256;
            nullable: true;
            description: 'The maximum number of tokens to generate before stopping.\n\nNote that our models may stop before reaching this maximum. This parameter only specifies the absolute maximum number of tokens to generate.\n';
          };
          temperature: {
            type: 'number';
            minimum: 0;
            maximum: 1;
            default: 1;
            example: 1;
            nullable: true;
            description: 'Amount of randomness injected into the response.\n\nDefaults to 1. Ranges from 0 to 1. Use temp closer to 0 for analytical / multiple choice, and closer to 1 for creative and generative tasks.\n';
          };
          top_p: {
            type: 'number';
            minimum: 0;
            maximum: 1;
            default: 1;
            example: 1;
            nullable: true;
            description: 'Use nucleus sampling.\n\nIn nucleus sampling, we compute the cumulative distribution over all the options \nfor each subsequent token in decreasing probability order and cut it off once \nit reaches a particular probability specified by top_p. You should either alter temperature or top_p, but not both.\n';
          };
          top_k: {
            type: 'number';
            minimum: 0;
            default: 5;
            example: 5;
            nullable: true;
            description: 'Only sample from the top K options for each subsequent token.\n\nUsed to remove "long tail" low probability responses. Learn more technical details here.\n';
          };
          stream: {
            description: 'Whether to incrementally stream the response using server-sent events.\nSee this guide to SSE events for details.type: boolean\n';
            nullable: true;
            default: false;
          };
          stop_sequences: {
            description: 'Sequences that will cause the model to stop generating completion text.\nOur models stop on "\\n\\nHuman:", and may include additional built-in stop sequences in the future. By providing the stop_sequences parameter, you may include additional strings that will cause the model to stop generating.\n';
            default: null;
            nullable: true;
            oneOf: [
              {
                type: 'string';
                default: '<|endoftext|>';
                example: '\n';
                nullable: true;
              },
              {
                type: 'array';
                minItems: 1;
                maxItems: 4;
                items: {
                  type: 'string';
                  example: '["\\n"]';
                };
              },
            ];
          };
          metadata: {
            type: 'object';
            properties: {
              user_id: {
                type: 'string';
                example: '13803d75-b4b5-4c3e-b2a2-6f21399b021b';
                description: 'An external identifier for the user who is associated with the request.\n\nThis should be a uuid, hash value, or other opaque identifier. Anthropic may use this id to help detect abuse. \nDo not include any identifying information such as name, email address, or phone number.\n';
              };
            };
            description: 'An object describing metadata about the request.\n';
          };
        };
        required: ['model', 'prompt', 'max_tokens_to_sample'];
      };
      CreateCompletionResponse: {
        type: 'object';
        properties: {
          stop_reason: {
            type: 'string';
            enum: ['stop_sequence', 'max_tokens'];
            description: 'The reason that we stopped sampling.\n\nThis may be one the following values:\n\n"stop_sequence": we reached a stop sequence — either provided by you via the stop_sequences parameter, or a stop sequence built into the model\n"max_tokens": we exceeded max_tokens_to_sample or the model\'s maximum\n';
          };
          model: {
            type: 'string';
            description: 'The model that performed the completion.\n';
          };
          completion: {
            type: 'string';
            description: 'The resulting completion up to and excluding the stop sequences.\n';
          };
        };
        required: ['completion', 'stop_reason', 'model'];
      };
      CreateCompletionStreamResponse: {
        type: 'object';
        properties: {
          stop_reason: {
            type: 'string';
            enum: ['stop_sequence', 'max_tokens'];
            description: 'The reason that we stopped sampling.\n\nThis may be one the following values:\n\n"stop_sequence": we reached a stop sequence — either provided by you via the stop_sequences parameter, or a stop sequence built into the model\n"max_tokens": we exceeded max_tokens_to_sample or the model\'s maximum\n';
          };
          model: {
            type: 'string';
            description: 'The model that performed the completion.\n';
          };
          completion: {
            type: 'string';
            description: 'The resulting completion up to and excluding the stop sequences.\n';
          };
          choices: {
            type: 'array';
            items: {
              type: 'object';
              properties: {
                delta: {
                  $ref: '#/components/schemas/CompletionStreamResponseDelta';
                };
              };
            };
          };
        };
        required: ['completion', 'stop_reason', 'model'];
      };
      CompletionStreamResponseDelta: {
        type: 'object';
        properties: {
          completion: {
            type: 'string';
            description: 'The contents of the chunk message.';
            nullable: true;
          };
          stop_reason: {
            type: 'string';
            enum: ['stop_sequence', 'max_tokens'];
            description: 'The reason that we stopped sampling.\n\nThis may be one the following values:\n\n"stop_sequence": we reached a stop sequence — either provided by you via the stop_sequences parameter, or a stop sequence built into the model\n"max_tokens": we exceeded max_tokens_to_sample or the model\'s maximum\n';
            nullable: true;
          };
          model: {
            type: 'string';
            description: 'The model that performed the completion.\n';
          };
        };
      };
    };
  };
  'x-oaiMeta': {
    groups: [
      {
        id: 'completions';
        title: 'Completions';
        description: 'Given a prompt, the model will return one or more predicted completions, and can also return the probabilities of alternative tokens at each position. Note: We recommend most users use our Chat Completions API. [Learn more](/docs/deprecations/2023-07-06-gpt-and-embeddings)\n';
      },
    ];
  };
};
