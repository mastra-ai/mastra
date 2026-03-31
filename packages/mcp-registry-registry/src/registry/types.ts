import { z } from 'zod';

// Define the schema for server entries
export const ServerEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type ServerEntry = z.infer<typeof ServerEntrySchema>;

export interface RegistryEntry {
  id: string;
  name: string;
  description: string;
  url: string;
  servers_url?: string;
  tags?: string[];
  count?: number | string;
  // Custom post-processing function for this registry's server data
  postProcessServers?: (data: unknown) => ServerEntry[];
}

export interface RegistryFile {
  registries: RegistryEntry[];
}
