import type { ServerEntry } from '../types';

// Helper function to create a basic server entry from partial data
export function createServerEntry(data: Record<string, unknown>): ServerEntry {
  // Safely access nested properties
  const metaDescription =
    typeof data.meta === 'object' && data.meta !== null
      ? ((data.meta as Record<string, unknown>).description as string)
      : undefined;

  return {
    id: (data.id as string) || (data.name as string) || (data.slug as string) || 'unknown',
    name: (data.name as string) || (data.id as string) || (data.slug as string) || 'Unknown Server',
    description: (data.description as string) || metaDescription || 'No description available',
    createdAt: (data.createdAt as string) || (data.created_at as string) || '',
    updatedAt: (data.updatedAt as string) || (data.updated_at as string) || '',
  };
}
