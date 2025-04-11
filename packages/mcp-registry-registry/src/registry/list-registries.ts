import { z } from 'zod';
import { registryData } from './registry';
import type { RegistryEntry, RegistryFile } from './types';

// Define the schema for registry entries for validation
const RegistryEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  url: z.string().url(),
  servers_url: z.string().url().optional(),
  tags: z.array(z.string()).optional(),
  count: z.union([z.number(), z.string()]).optional(),
});

// Define the schema for the registry file for validation
const RegistryFileSchema = z.object({
  registries: z.array(RegistryEntrySchema),
});

/**
 * Returns the registry data from the registry.ts file
 */
export async function loadRegistryData(): Promise<RegistryFile> {
  try {
    // Validate the registry data against our schema
    return RegistryFileSchema.parse(registryData);
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
