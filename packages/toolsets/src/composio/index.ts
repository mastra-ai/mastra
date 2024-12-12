import { createTool, MastraToolset, ToolApi } from '@mastra/core';
import { Composio } from 'composio-core';
import { z } from 'zod';

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

type ComposioToolsetParams = {
  actions?: Array<string>;
  apps?: Array<string>;
  tags?: Array<string>;
  useCase?: string;
  usecaseLimit?: number;
};

export class ComposioToolset extends MastraToolset<ComposioToolsetParams> {
  client: Composio;
  entityId?: string | null;
  connectedAccountId?: string | null;
  constructor({
    apiKey,
    baseUrl,
    entityId,
    connectedAccountId,
  }: {
    apiKey: string;
    baseUrl?: string;
    entityId?: string;
    connectedAccountId?: string;
  }) {
    super();

    this.connectedAccountId = connectedAccountId;
    this.entityId = entityId;
    this.client = new Composio(apiKey, baseUrl, 'mastra-ai');
  }

  private generateTool(schema: Record<string, any>) {
    const parameters = this.jsonSchemaToModel(schema.parameters);
    return createTool({
      label: schema.description,
      description: schema.description,
      schema: parameters,
      executor: async ({ data }) => {
        try {
          const d = await this.client
            .getEntity(this.entityId!)
            .execute(schema.name, data || {}, undefined, this.connectedAccountId!);
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

    const tools: Record<string, ToolApi> = {};

    actionsList.items?.forEach(actionSchema => {
      tools[actionSchema.name!] = this.generateTool(actionSchema);
    });

    return tools;
  }
}
