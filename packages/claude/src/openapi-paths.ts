// @ts-nocheck
export type TPaths = {
  '/v1/complete': {
    post: {
      summary: 'Sends a prompt to Claude for completion';
      tags: ['Complete'];
      requestBody: {
        required: true;
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/CompleteRequest';
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Successful response';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CompleteResponse';
              };
            };
          };
        };
      };
    };
  };
};
export const paths = {
  '/v1/complete': {
    post: {
      summary: 'Sends a prompt to Claude for completion',
      tags: ['Complete'],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/CompleteRequest',
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Successful response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CompleteResponse',
              },
            },
          },
        },
      },
    },
  },
} as TPaths;
