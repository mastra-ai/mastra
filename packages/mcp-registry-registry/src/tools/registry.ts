import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { z } from 'zod';
import { fromPackageRoot } from '../utils';

// Define the schema for registry entries
const RegistryEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  url: z.string().url(),
  tags: z.array(z.string()).optional(),
  count: z.union([z.number(), z.string()]).optional(),
});

// Define the schema for the registry file
const RegistryFileSchema = z.object({
  registries: z.array(RegistryEntrySchema),
});

export type RegistryEntry = z.infer<typeof RegistryEntrySchema>;
export type RegistryFile = z.infer<typeof RegistryFileSchema>;

// Define the input schema for the registry tool
export const registryInputSchema = z.object({
  id: z.string().optional().describe('Optional registry ID to filter by'),
  tag: z.string().optional().describe('Optional tag to filter by (e.g., "verified", "official", "open-source")'),
  name: z.string().optional().describe('Optional name to search for in registry names'),
});

export type RegistryInput = z.infer<typeof registryInputSchema>;

// Helper function to load registry data
async function loadRegistryData(): Promise<RegistryFile> {
  try {
    const registryPath = fromPackageRoot('registry.json');
    const data = await fs.readFile(registryPath, 'utf-8');
    const parsedData = JSON.parse(data);
    return RegistryFileSchema.parse(parsedData);
  } catch (error) {
    console.error('Error loading registry data:', error);
    return { registries: [] };
  }
}

export const registryTool = {
  description:
    'This is a tool from the registry-registry MCP server.\nGet information about various MCP registries. You can filter by ID, tag, or search by name.',

  async execute(args: RegistryInput) {
    const { id, tag, name } = args;

    // Load registry data
    const registryData = await loadRegistryData();

    // Filter registries based on provided parameters
    let filteredRegistries = registryData.registries;

    if (id) {
      filteredRegistries = filteredRegistries.filter(registry => registry.id === id);
    }

    if (tag) {
      filteredRegistries = filteredRegistries.filter(registry => registry.tags?.includes(tag));
    }

    if (name) {
      const searchTerm = name.toLowerCase();
      filteredRegistries = filteredRegistries.filter(registry => registry.name.toLowerCase().includes(searchTerm));
    }

    // Format the response
    if (filteredRegistries.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: 'No registries found matching the provided criteria.',
          },
        ],
      };
    }

    // If only one registry is found, provide detailed information
    if (filteredRegistries.length === 1) {
      const registry = filteredRegistries[0];
      const tagsText = registry.tags ? `\nTags: ${registry.tags.join(', ')}` : '';
      const countText = registry.count ? `\nCount: ${registry.count}` : '';

      return {
        content: [
          {
            type: 'text',
            text: `Registry: ${registry.name} (${registry.id})\n\nDescription: ${registry.description}\nURL: ${registry.url}${tagsText}${countText}`,
          },
        ],
      };
    }

    // If multiple registries are found, provide a list
    const registriesList = filteredRegistries
      .map(registry => `- ${registry.name} (${registry.id}): ${registry.description}`)
      .join('\n');

    return {
      content: [
        {
          type: 'text',
          text: `Found ${filteredRegistries.length} registries:\n\n${registriesList}`,
        },
      ],
    };
  },
};
