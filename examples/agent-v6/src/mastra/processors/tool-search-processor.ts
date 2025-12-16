import { createTool, Tool } from '@mastra/core/tools';
import { ProcessInputStepArgs, Processor } from '@mastra/core/processors';
import z from 'zod';

export class ToolSearchProcessor implements Processor {
  readonly id = 'tool-search-processor';
  readonly name = 'Tool Search Processor';

  allTools: Record<string, Tool<any>> = {};
  enabledTools: Record<string, Tool<any>> = {};

  constructor(opts: { tools: Record<string, Tool<any, any>> }) {
    this.allTools = opts.tools;
  }

  async processInputStep({ tools, messageList }: ProcessInputStepArgs) {
    messageList.addSystem(
      'To check available tools, call the tool-lookup tool. To add a new tool to the conversation, call the tool-add tool with the tool ID.',
    );

    return {
      tools: {
        toolLookup: createTool({
          id: 'tool-lookup',
          description: 'Lookup available tools to add to the conversation',
          inputSchema: z.object({}), // or a search query
          execute: async () => {
            return {
              tools: Object.values(this.allTools).map(tool => ({
                id: tool.id,
                description: tool.description,
              })),
            };
          },
        }),

        toolAdd: createTool({
          id: 'tool-add',
          description: 'Add a tool to the current conversation',
          inputSchema: z.object({
            toolId: z.string().describe('The ID of the tool to add'),
          }),
          execute: async ({ toolId }) => {
            const matchingTool = this.allTools[toolId] ?? Object.values(this.allTools).find(tool => tool.id === toolId);
            if (!matchingTool) {
              return `Failed to add tool. Tool ${toolId} not found`;
            }
            if (this.enabledTools[toolId]) {
              return `Tool ${toolId} already added to conversation`;
            }

            this.enabledTools[toolId] = matchingTool;
            return `Tool ${toolId} added to conversation`;
          },
        }),

        ...(tools ?? {}),
        ...this.enabledTools,
      },
    };
  }
}
