import { config as loadEnv } from 'dotenv';
import type { IGraphQLConfig } from 'graphql-config';

loadEnv();

const config: IGraphQLConfig = {
  projects: {
    rewatch: {
      schema: [
        {
          'https://mastra.rewatch.com/api/graphql': {
            headers: {
              Authorization: `Bearer ${process.env.REWATCH_API_KEY}`,
            },
          },
        },
      ],
      extensions: {
        codegen: {
          generates: {
            'src/sdk.ts': {
              documents: ['src/graphql/**/*.(graphql|ts)'],
              config: {
                gqlImport: 'graphql-request#gql',
              },
              plugins: [
                'typescript',
                'typescript-operations',
                'typescript-graphql-request',
                {
                  add: {
                    content: '// @ts-nocheck',
                  },
                },
              ],
            },
          },
        },
      },
    },
  },
};

export default config;
