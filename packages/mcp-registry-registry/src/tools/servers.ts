import { z } from 'zod';
import { getServersFromRegistry } from '../registry/fetch-servers';

// Define the input schema for the servers tool
export const serversInputSchema = z.object({
  registryId: z.string(),
  tag: z.string().optional(),
  search: z.string().optional(),
});

export type ServersToolInput = z.infer<typeof serversInputSchema>;

// Define the servers tool
export const serversTool = {
  name: 'registryServers',
  description: 'Get servers from a specific MCP registry. Can filter by tag or search term.',
  async execute(input: ServersToolInput) {
    try {
      const result = await getServersFromRegistry(input.registryId, {
        tag: input.tag,
        search: input.search,
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error fetching servers: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  },
};
