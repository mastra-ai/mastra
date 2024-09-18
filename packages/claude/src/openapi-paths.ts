// @ts-nocheck
export type TPaths = {
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
export const paths = {
  '/complete': {
    post: {
      operationId: 'complete',
      tags: ['Anthropic'],
      summary: 'Creates a completion for the provided prompt and parameters.',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/CreateCompletionRequest',
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'OK',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CreateCompletionResponse',
              },
            },
          },
        },
      },
      'x-oaiMeta': {
        name: 'Create completion',
        group: 'completions',
        path: 'create',
        examples: {
          curl: 'curl https://api.anthropic.com/v1/complete \\\n  --header \'accept: application/json\' \\\n  --header \'anthropic-version: 2023-06-01\' \\\n  --header \'content-type: application/json\' \\\n  --header \'x-api-key: $ANTHROPIC_API_KEY\' \\\n  --data \'\n  {\n    "model": "claude-2",\n    "prompt": "\\n\\nHuman: Hello, world!\\n\\nAssistant:",\n    "max_tokens_to_sample": 256\n  }\'\n',
        },
        parameters:
          '{\n  "model": "claude-2",\n  "prompt": "\\n\\nHuman: Hello, world!\\n\\nAssistant:",\n  "max_tokens_to_sample": 256\n}\n',
        response:
          '{\n  "completion": " Hello! My name is Claude.",\n  "stop_reason": "stop_sequence",\n  "model": "claude-2"\n}\n',
      },
    },
  },
} as TPaths;
