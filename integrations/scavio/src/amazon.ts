import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { getScavioClient } from './client.js';
import type { ScavioClient, ScavioClientOptions } from './client.js';

const outputSchema = z.record(z.string(), z.unknown());

export function createScavioAmazonSearchTool(config?: ScavioClientOptions) {
  let client: ScavioClient | null = null;
  const getClient = () => (client ??= getScavioClient(config));

  return createTool({
    id: 'scavio-amazon-search',
    description: 'Search Amazon for products via Scavio. Returns matching products as structured JSON.',
    inputSchema: z.object({
      query: z.string().describe('The product search query'),
      domain: z.string().optional().describe('Amazon domain, e.g. "amazon.com"'),
      country: z.string().optional().describe('Two-letter country code'),
      sort_by: z.string().optional().describe('Sort order for results'),
    }),
    outputSchema,
    execute: async input => getClient().amazon.search(input),
  });
}

export function createScavioAmazonProductTool(config?: ScavioClientOptions) {
  let client: ScavioClient | null = null;
  const getClient = () => (client ??= getScavioClient(config));

  return createTool({
    id: 'scavio-amazon-product',
    description: 'Fetch full Amazon product details by ASIN via Scavio.',
    inputSchema: z.object({
      asin: z.string().describe('Amazon Standard Identification Number (ASIN)'),
      domain: z.string().optional().describe('Amazon domain, e.g. "amazon.com"'),
      country: z.string().optional().describe('Two-letter country code'),
    }),
    outputSchema,
    execute: async input => getClient().amazon.product(input),
  });
}
