// @ts-nocheck
export type TComponents = {
  schemas: {
    CompleteRequest: {
      type: 'object';
      properties: {
        prompt: {
          type: 'string';
          description: 'The prompt you want Claude to complete';
          example: '\\n\\nHuman: Tell me a haiku about trees\\n\\nAssistant: ';
        };
        model: {
          type: 'string';
          description: 'Model version to use for completion. Valid options are claude-v1, claude-v1-100k, claude-instant-v1, claude-instant-v1-100k, claude-v1.3, claude-v1.3-100k, claude-v1.2, claude-v1.0, claude-instant-v1.1, claude-instant-v1.1-100k, claude-instant-v1.0.';
          example: 'claude-v1';
          enum: [
            'claude-v1',
            'claude-v1-100k',
            'claude-instant-v1',
            'claude-instant-v1-100k',
            'claude-v1.3',
            'claude-v1.3-100k',
            'claude-v1.2',
            'claude-v1.0',
            'claude-instant-v1.1',
            'claude-instant-v1.1-100k',
            'claude-instant-v1.0',
          ];
        };
        max_tokens_to_sample: {
          type: 'integer';
          description: 'A maximum number of tokens to generate before stopping';
          example: 300;
        };
        stop_sequences: {
          type: 'array';
          items: {
            type: 'string';
          };
          description: 'A list of strings upon which to stop generating';
          example: ['\n\nHuman:'];
        };
        stream: {
          type: 'boolean';
          description: 'Whether to incrementally stream the response using SSE';
          example: false;
        };
        temperature: {
          type: 'number';
          description: 'Amount of randomness injected into the response. Ranges from 0 to 1. Use temp closer to 0 for analytical / multiple choice, and temp closer to 1 for creative and generative tasks.';
          example: 1;
        };
        top_k: {
          type: 'integer';
          description: 'Only sample from the top K options for each subsequent token. Used to remove "long tail" low probability responses. Set to -1 to disable (default).';
          example: -1;
        };
        top_p: {
          type: 'number';
          description: 'Does nucleus sampling. Compute the cumulative distribution over all the options for each subsequent token in decreasing probability order and cut it off once it reaches a particular probability specified by top_p. Set to -1 to disable (default). Note that you should either alter temperature or top_p, but not both.';
          example: -1;
        };
        metadata: {
          type: 'object';
          description: 'An object describing metadata about the request';
        };
      };
      required: ['prompt', 'model', 'max_tokens_to_sample'];
    };
    CompleteResponse: {
      type: 'object';
      properties: {
        completion: {
          type: 'string';
          description: 'The resulting completion up to and excluding the stop sequences';
        };
        stop_reason: {
          type: 'string';
          description: 'The reason we stopped sampling';
          enum: ['stop_sequence', 'max_tokens'];
        };
      };
    };
  };
};
export const components = {
  schemas: {
    CompleteRequest: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'The prompt you want Claude to complete',
          example: '\\n\\nHuman: Tell me a haiku about trees\\n\\nAssistant: ',
        },
        model: {
          type: 'string',
          description:
            'Model version to use for completion. Valid options are claude-v1, claude-v1-100k, claude-instant-v1, claude-instant-v1-100k, claude-v1.3, claude-v1.3-100k, claude-v1.2, claude-v1.0, claude-instant-v1.1, claude-instant-v1.1-100k, claude-instant-v1.0.',
          example: 'claude-v1',
          enum: [
            'claude-v1',
            'claude-v1-100k',
            'claude-instant-v1',
            'claude-instant-v1-100k',
            'claude-v1.3',
            'claude-v1.3-100k',
            'claude-v1.2',
            'claude-v1.0',
            'claude-instant-v1.1',
            'claude-instant-v1.1-100k',
            'claude-instant-v1.0',
          ],
        },
        max_tokens_to_sample: {
          type: 'integer',
          description: 'A maximum number of tokens to generate before stopping',
          example: 300,
        },
        stop_sequences: {
          type: 'array',
          items: {
            type: 'string',
          },
          description: 'A list of strings upon which to stop generating',
          example: ['\n\nHuman:'],
        },
        stream: {
          type: 'boolean',
          description: 'Whether to incrementally stream the response using SSE',
          example: false,
        },
        temperature: {
          type: 'number',
          description:
            'Amount of randomness injected into the response. Ranges from 0 to 1. Use temp closer to 0 for analytical / multiple choice, and temp closer to 1 for creative and generative tasks.',
          example: 1,
        },
        top_k: {
          type: 'integer',
          description:
            'Only sample from the top K options for each subsequent token. Used to remove "long tail" low probability responses. Set to -1 to disable (default).',
          example: -1,
        },
        top_p: {
          type: 'number',
          description:
            'Does nucleus sampling. Compute the cumulative distribution over all the options for each subsequent token in decreasing probability order and cut it off once it reaches a particular probability specified by top_p. Set to -1 to disable (default). Note that you should either alter temperature or top_p, but not both.',
          example: -1,
        },
        metadata: {
          type: 'object',
          description: 'An object describing metadata about the request',
        },
      },
      required: ['prompt', 'model', 'max_tokens_to_sample'],
    },
    CompleteResponse: {
      type: 'object',
      properties: {
        completion: {
          type: 'string',
          description: 'The resulting completion up to and excluding the stop sequences',
        },
        stop_reason: {
          type: 'string',
          description: 'The reason we stopped sampling',
          enum: ['stop_sequence', 'max_tokens'],
        },
      },
    },
  },
} as TComponents;
