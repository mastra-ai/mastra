import { z } from 'zod';

import { createTool } from '../tools';
import { ToolApi } from '../tools/types';

export abstract class OpenAPIToolset {
  abstract readonly name: string;
  abstract readonly tools: Record<string, ToolApi>;

  authType: string = 'API_KEY';

  constructor() {}

  protected get toolSchemas(): any {
    return {};
  }

  protected get toolDocumentations(): Record<string, { comment: string; doc?: string }> {
    return {};
  }

  protected get baseClient(): any {
    return {};
  }

  async getApiClient(): Promise<any> {
    throw new Error('API not implemented');
  }

  protected _generateIntegrationTools<T>() {
    const { client, ...clientMethods } = this.baseClient;
    const schemas = this.toolSchemas;
    const documentations = this.toolDocumentations;

    const tools = Object.keys(clientMethods).reduce((acc, key) => {
      const comment = documentations[key]?.comment;
      const doc = documentations[key]?.doc;
      const fallbackComment = `Execute ${key}`;

      const tool = createTool({
        label: key,
        schema: schemas[key] || z.object({}),
        description: comment || fallbackComment,
        documentation: doc || fallbackComment,
        executor: async ({ data }) => {
          const client = await this.getApiClient();
          const value = client[key as keyof typeof client];
          return (value as any)({
            ...(data as any),
          });
        },
      });

      return { ...acc, [key]: tool };
    }, {});

    return tools as T;
  }
}