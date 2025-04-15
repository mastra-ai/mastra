import { z } from 'zod';
import { getRegistryListings } from '../registry/list-registries';

// Define the input schema for the registry listing tool
export const listInputSchema = z.object({
  id: z.string().optional(),
  tag: z.string().optional(),
  name: z.string().optional(),
  detailed: z.boolean().optional().default(false),
});

export type ListToolInput = z.infer<typeof listInputSchema>;

// Define the registry listing tool
export const listTool = {
  name: 'registryList',
  description: 'List available MCP registries. Can filter by ID, tag, or name and provide detailed or summary views.',
  async execute(input: ListToolInput) {
    try {
      const result = await getRegistryListings(
        {
          id: input.id,
          tag: input.tag,
          name: input.name,
        },
        {
          detailed: input.detailed,
        },
      );

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
            text: `Error listing registries: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  },
};
