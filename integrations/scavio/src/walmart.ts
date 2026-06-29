import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { getScavioClient } from './client.js';
import type { ScavioClient, ScavioClientOptions } from './client.js';

const outputSchema = z.record(z.string(), z.unknown());

export function createScavioWalmartSearchTool(config?: ScavioClientOptions) {
  let client: ScavioClient | null = null;
  const getClient = () => (client ??= getScavioClient(config));

  return createTool({
    id: 'scavio-walmart-search',
    description: 'Search Walmart for products via Scavio. Returns matching products as structured JSON.',
    inputSchema: z.object({
      query: z.string().describe('The product search query'),
      sort_by: z.string().optional().describe('Sort order for results'),
      min_price: z.number().optional().describe('Minimum price filter'),
      max_price: z.number().optional().describe('Maximum price filter'),
    }),
    outputSchema,
    execute: async input => getClient().walmart.search(input),
  });
}

export function createScavioWalmartProductTool(config?: ScavioClientOptions) {
  let client: ScavioClient | null = null;
  const getClient = () => (client ??= getScavioClient(config));

  return createTool({
    id: 'scavio-walmart-product',
    description: 'Fetch full Walmart product details by product id via Scavio.',
    inputSchema: z.object({
      product_id: z.string().describe('Walmart product id'),
    }),
    outputSchema,
    execute: async input => getClient().walmart.product(input),
  });
}
