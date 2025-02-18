import { Integration } from '@mastra/core/integration';
import { createTool, type ToolAction } from '@mastra/core/tools';
import { jsonSchemaToModel } from '@mastra/core/utils';
import { Composio } from 'composio-core';
import { z } from 'zod';

import { type ComposioConfig } from './types';

type ComposioToolsetParams = {
  actions?: Array<string>;
  apps?: Array<string>;
  tags?: Array<string>;
  useCase?: string;
  usecaseLimit?: number;
};

const zExecuteToolCallParams = z.object({
  actions: z.array(z.string()).optional(),
  apps: z.array(z.string()).optional(),
  params: z.record(z.any()).optional(),
  entityId: z.string().optional(),
  useCase: z.string().optional(),
  usecaseLimit: z.number().optional(),
  connectedAccountId: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export class ComposioIntegration extends Integration<ComposioToolsetParams> {
  readonly name = 'COMPOSIO';
  readonly logoUrl = '';
  config: ComposioConfig;
  categories = ['dev-tools', 'ai', 'automation'];
  description =
    'Easily Integrate LLMs with 250+ tools (Github, Salesforce, File Manager, Code Execution & More) to perform actions & subscribe to triggers.';
  client: Composio;

  constructor({ config }: { config: ComposioConfig }) {
    super();
    this.config = config;

    this.client = new Composio(config.API_KEY, config.baseUrl, 'mastra-ai');
  }

  private generateTool(schema: Record<string, any>) {
    const parameters = jsonSchemaToModel(schema.parameters);

    // use name as ID - if we use description as id, long descriptions will cause API errors - the id can't be longer than 63 chars
    const id = schema.name;

    return createTool({
      id,
      description: schema.description,
      inputSchema: parameters,
      execute: async ({ context }) => {
        try {
          const d = await this.client
            .getEntity(this.config.entityId!)
            .execute(id, context || {}, undefined, this.config.connectedAccountId!);
          return d;
        } catch (e) {
          console.error(e);
          throw e;
        }
      },
    });
  }

  async getTools(filters: ComposioToolsetParams) {
    const { apps, tags, useCase, usecaseLimit, actions } = zExecuteToolCallParams.parse(filters);

    const actionsList = await this.client.actions.list({
      ...(apps && { apps: apps?.join(',') }),
      ...(tags && { tags: tags?.join(',') }),
      ...(useCase && { useCase: useCase }),
      ...(actions && { actions: actions?.join(',') }),
      ...(usecaseLimit && { usecaseLimit: usecaseLimit }),
      filterByAvailableApps: true,
    });

    const tools: Record<string, ToolAction<any, any, any, any>> = {};

    actionsList.items?.forEach(actionSchema => {
      tools[actionSchema.name!] = this.generateTool(actionSchema);
    });

    return tools;
  }
}
