import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { fromPackageRoot } from '../utils';

// Get the directory name in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define the schema for registry entries
const RegistryEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  url: z.string().url(),
  servers_url: z.string().url().optional(),
  tags: z.array(z.string()).optional(),
  count: z.union([z.number(), z.string()]).optional(),
});

// Define the schema for the registry file
const RegistryFileSchema = z.object({
  registries: z.array(RegistryEntrySchema),
});

export type RegistryEntry = z.infer<typeof RegistryEntrySchema>;
export type RegistryFile = z.infer<typeof RegistryFileSchema>;

/**
 * Reads the registry.json file and returns the parsed registry data
 */
export async function loadRegistryData(): Promise<RegistryFile> {
  try {
    // Try multiple possible locations for the registry.json file
    const possiblePaths = [
      // Development path (in src directory)
      path.join(__dirname, 'registry.json'),
      // Production path (in dist directory)
      path.join(process.cwd(), 'dist', 'registry', 'registry.json'),
      // Root package path
      path.join(process.cwd(), 'registry.json'),
      // Try one directory up (for when running from dist)
      path.join(process.cwd(), '..', 'registry.json'),
      // Try src directory
      path.join(process.cwd(), 'src', 'registry', 'registry.json'),
    ];

    let registryPath = '';
    let data = '';

    // Try each path until we find one that works
    for (const tryPath of possiblePaths) {
      try {
        console.log('Trying to load registry from:', tryPath);
        data = await fs.readFile(tryPath, 'utf-8');
        registryPath = tryPath;
        console.log('Successfully loaded registry from:', registryPath);
        break;
      } catch (e) {
        // Continue to the next path
      }
    }

    if (!data) {
      // If we couldn't find the file, use the embedded registry data
      console.log('Could not find registry.json file, using embedded registry data');
      // Include the registry data directly in the code as a fallback
      data = JSON.stringify({
        registries: [
          {
            id: 'apitracker',
            name: 'apitracker',
            description: 'Discover the best APIs and developer resources',
            url: 'https://apitracker.com/',
            servers_url: 'https://apitracker.io/api/mcp-servers',
            tags: ['verified'],
          },
          {
            id: 'fleur',
            name: 'Fleur',
            description: 'Fleur is the app store for Claude',
            url: 'https://www.fleurmcp.com/',
            servers_url: 'https://raw.githubusercontent.com/fleuristes/app-registry/refs/heads/main/apps.json',
            tags: ['verified'],
          },
          {
            id: 'mcp-run',
            name: 'MCP Run',
            description: 'One platform for vertical AI across your entire organization.',
            url: 'https://www.mcp.run/',
            servers_url: 'https://www.mcp.run/api/servlets',
            tags: ['verified'],
          },
          {
            id: 'smithery',
            name: 'Smithery',
            description: 'Extend your agent with 4,274 capabilities via Model Context Protocol servers.',
            url: 'https://smithery.ai/',
            servers_url: 'https://registry.smithery.ai/servers',
            tags: ['verified'],
            count: 2208,
          },
        ],
      });
    }

    const parsedData = JSON.parse(data);
    return RegistryFileSchema.parse(parsedData);
  } catch (error) {
    console.error('Error loading registry data:', error);
    return { registries: [] };
  }
}

/**
 * Filters registry entries based on provided criteria
 */
export function filterRegistries(
  registries: RegistryEntry[],
  filters: {
    id?: string;
    tag?: string;
    name?: string;
  },
): RegistryEntry[] {
  let filteredRegistries = [...registries];

  if (filters.id) {
    filteredRegistries = filteredRegistries.filter(registry => registry.id === filters.id);
  }

  if (filters.tag) {
    filteredRegistries = filteredRegistries.filter(registry => registry.tags?.includes(filters.tag!));
  }

  if (filters.name) {
    const searchTerm = filters.name.toLowerCase();
    filteredRegistries = filteredRegistries.filter(registry => registry.name.toLowerCase().includes(searchTerm));
  }

  return filteredRegistries;
}

/**
 * Formats registry entries for API response
 */
export function formatRegistryResponse(registries: RegistryEntry[], detailed: boolean = false): any {
  if (registries.length === 0) {
    return {
      count: 0,
      registries: [],
    };
  }

  if (detailed) {
    return {
      count: registries.length,
      registries: registries.map(registry => ({
        id: registry.id,
        name: registry.name,
        description: registry.description,
        url: registry.url,
        servers_url: registry.servers_url,
        tags: registry.tags || [],
        count: registry.count,
      })),
    };
  }

  return {
    count: registries.length,
    registries: registries.map(registry => ({
      id: registry.id,
      name: registry.name,
      description: registry.description,
    })),
  };
}

/**
 * Main function to get registry listings with optional filtering
 */
export async function getRegistryListings(
  filters: {
    id?: string;
    tag?: string;
    name?: string;
  } = {},
  options: {
    detailed?: boolean;
  } = {},
): Promise<any> {
  try {
    const registryData = await loadRegistryData();
    const filteredRegistries = filterRegistries(registryData.registries, filters);
    return formatRegistryResponse(filteredRegistries, options.detailed);
  } catch (error) {
    console.error('Error getting registry listings:', error);
    throw error;
  }
}
