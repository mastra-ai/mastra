import type { ToolsInput } from '@mastra/core/agent';
import { z } from 'zod';

import { MastraConnectError } from '../errors.js';
import type { ProviderToolsOptions } from '../toolset.js';
import { applyAllowTools, defineProxyTool } from '../toolset.js';

const ENV_VAR = 'MASTRA_CLOUDFLARE_CONNECTION_ID';

/**
 * Cloudflare client API. The Nango proxy base is
 * https://api.cloudflare.com/client, so every path carries the v4 prefix.
 * Responses are enveloped as { success, errors, result }; `unwrap` surfaces
 * Cloudflare errors as proxy_error even on HTTP 200.
 */
const API = 'v4';

const DNS_RECORD_TYPES = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SRV', 'CAA'] as const;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

/** Unwraps the Cloudflare envelope; throws proxy_error with the Cloudflare messages on failure. */
function unwrap(raw: unknown): unknown {
  const data = asRecord(raw);
  if (data.success !== true) {
    const errors = Array.isArray(data.errors) ? data.errors.map(asRecord) : [];
    const detail =
      errors
        .map(error => (typeof error.message === 'string' ? error.message : ''))
        .filter(Boolean)
        .join('; ') || 'Cloudflare reported failure without details';
    throw new MastraConnectError('proxy_error', `Cloudflare request failed: ${detail}`, { detail });
  }
  return data.result;
}

function resultList(raw: unknown): Record<string, unknown>[] {
  const result = unwrap(raw);
  return Array.isArray(result) ? result.map(asRecord) : [];
}

const paginationInput = {
  page: z.number().int().min(1).optional().describe('Page number, starting at 1'),
  perPage: z.number().int().min(1).max(50).optional().describe('Results per page (1-50, Cloudflare default 20)'),
};

const zoneIdInput = z.string().min(1).describe('Zone id (find it via cloudflare_list_zones)');

const dnsRecordSchema = z.object({
  id: z.string(),
  type: z.string(),
  name: z.string(),
  content: z.string(),
  ttl: z.number(),
  proxied: z.boolean(),
  comment: z.string().nullable(),
});

function shapeDnsRecord(record: Record<string, unknown>) {
  return {
    id: String(record.id ?? ''),
    type: String(record.type ?? ''),
    name: String(record.name ?? ''),
    content: String(record.content ?? ''),
    ttl: typeof record.ttl === 'number' ? record.ttl : Number(record.ttl ?? 0),
    proxied: record.proxied === true,
    comment: typeof record.comment === 'string' && record.comment !== '' ? record.comment : null,
  };
}

/**
 * Curated Cloudflare toolset executing through the platform connection
 * proxy. All tools resolve the connection from `options.connectionId` or
 * MASTRA_CLOUDFLARE_CONNECTION_ID at execute time.
 */
export function createCloudflareTools(options?: ProviderToolsOptions): ToolsInput {
  const context = { envVar: ENV_VAR, options };

  const tools = {
    cloudflare_verify_token: defineProxyTool(context, {
      id: 'cloudflare_verify_token',
      description: 'Verify the connected Cloudflare API token and report its status.',
      inputSchema: z.object({}),
      outputSchema: z.object({ id: z.string(), status: z.string() }),
      request: () => ({ method: 'GET', path: `${API}/user/tokens/verify` }),
      transform: raw => {
        const result = asRecord(unwrap(raw));
        return { id: String(result.id ?? ''), status: String(result.status ?? '') };
      },
    }),

    cloudflare_list_accounts: defineProxyTool(context, {
      id: 'cloudflare_list_accounts',
      description: 'List Cloudflare accounts the connected token can access.',
      inputSchema: z.object({
        name: z.string().optional().describe('Filter accounts by name'),
        ...paginationInput,
      }),
      outputSchema: z.object({ accounts: z.array(z.object({ id: z.string(), name: z.string() })) }),
      request: input => ({
        method: 'GET',
        path: `${API}/accounts`,
        query: { name: input.name, page: input.page, per_page: input.perPage },
      }),
      transform: raw => ({
        accounts: resultList(raw).map(account => ({ id: String(account.id ?? ''), name: String(account.name ?? '') })),
      }),
    }),

    cloudflare_list_zones: defineProxyTool(context, {
      id: 'cloudflare_list_zones',
      description: 'List DNS zones (domains) in a Cloudflare account.',
      inputSchema: z.object({
        accountId: z.string().optional().describe('Filter zones by account id'),
        name: z.string().optional().describe('Filter zones by domain name'),
        ...paginationInput,
      }),
      outputSchema: z.object({
        zones: z.array(z.object({ id: z.string(), name: z.string(), status: z.string(), planName: z.string() })),
      }),
      request: input => ({
        method: 'GET',
        path: `${API}/zones`,
        query: { account_id: input.accountId, name: input.name, page: input.page, per_page: input.perPage },
      }),
      transform: raw => ({
        zones: resultList(raw).map(zone => ({
          id: String(zone.id ?? ''),
          name: String(zone.name ?? ''),
          status: String(zone.status ?? ''),
          planName: String(asRecord(zone.plan).name ?? ''),
        })),
      }),
    }),

    cloudflare_list_dns_records: defineProxyTool(context, {
      id: 'cloudflare_list_dns_records',
      description: 'List DNS records of a Cloudflare zone.',
      inputSchema: z.object({
        zoneId: zoneIdInput,
        type: z.enum(DNS_RECORD_TYPES).optional().describe('Filter by record type'),
        name: z.string().optional().describe('Filter by record name'),
        ...paginationInput,
      }),
      outputSchema: z.object({ dnsRecords: z.array(dnsRecordSchema) }),
      request: input => ({
        method: 'GET',
        path: `${API}/zones/${encodeURIComponent(input.zoneId)}/dns_records`,
        query: { type: input.type, name: input.name, page: input.page, per_page: input.perPage },
      }),
      transform: raw => ({ dnsRecords: resultList(raw).map(shapeDnsRecord) }),
    }),

    cloudflare_create_dns_record: defineProxyTool(context, {
      id: 'cloudflare_create_dns_record',
      description: 'Create a DNS record in a Cloudflare zone.',
      inputSchema: z
        .object({
          zoneId: zoneIdInput,
          type: z.enum(DNS_RECORD_TYPES).describe('DNS record type'),
          name: z.string().min(1).describe('Record name, e.g. "www" or "@"'),
          content: z.string().min(1).describe('Record value, e.g. an IP address or target host'),
          ttl: z.number().int().optional().describe('TTL in seconds; 1 or omitted means automatic'),
          proxied: z.boolean().optional().describe('Proxy through Cloudflare (A/AAAA/CNAME only)'),
          priority: z.number().int().optional().describe('MX priority (required for MX records)'),
          comment: z.string().optional().describe('Free-form note stored on the record'),
        })
        .refine(input => input.type !== 'MX' || input.priority !== undefined, {
          message: 'MX records require a priority.',
        }),
      outputSchema: dnsRecordSchema,
      request: input => ({
        method: 'POST',
        path: `${API}/zones/${encodeURIComponent(input.zoneId)}/dns_records`,
        body: {
          type: input.type,
          name: input.name,
          content: input.content,
          ttl: input.ttl,
          proxied: input.proxied,
          priority: input.priority,
          comment: input.comment,
        },
      }),
      transform: raw => shapeDnsRecord(asRecord(unwrap(raw))),
    }),

    cloudflare_update_dns_record: defineProxyTool(context, {
      id: 'cloudflare_update_dns_record',
      description: 'Update an existing DNS record in a Cloudflare zone.',
      inputSchema: z
        .object({
          zoneId: zoneIdInput,
          recordId: z.string().min(1),
          type: z.enum(DNS_RECORD_TYPES).optional(),
          name: z.string().min(1).optional(),
          content: z.string().min(1).optional(),
          ttl: z.number().int().optional(),
          proxied: z.boolean().optional(),
          comment: z.string().optional(),
        })
        .refine(
          input =>
            input.type !== undefined ||
            input.name !== undefined ||
            input.content !== undefined ||
            input.ttl !== undefined ||
            input.proxied !== undefined ||
            input.comment !== undefined,
          { message: 'Provide at least one field to update.' },
        ),
      outputSchema: dnsRecordSchema,
      request: input => ({
        method: 'PATCH',
        path: `${API}/zones/${encodeURIComponent(input.zoneId)}/dns_records/${encodeURIComponent(input.recordId)}`,
        body: {
          type: input.type,
          name: input.name,
          content: input.content,
          ttl: input.ttl,
          proxied: input.proxied,
          comment: input.comment,
        },
      }),
      transform: raw => shapeDnsRecord(asRecord(unwrap(raw))),
    }),

    cloudflare_delete_dns_record: defineProxyTool(context, {
      id: 'cloudflare_delete_dns_record',
      description:
        'DESTRUCTIVE: permanently deletes a DNS record from a Cloudflare zone. Only use when the user explicitly asks to delete a record.',
      inputSchema: z.object({
        zoneId: zoneIdInput,
        recordId: z.string().min(1),
      }),
      outputSchema: z.object({ id: z.string() }),
      request: input => ({
        method: 'DELETE',
        path: `${API}/zones/${encodeURIComponent(input.zoneId)}/dns_records/${encodeURIComponent(input.recordId)}`,
      }),
      transform: (raw, input) => ({ id: String(asRecord(unwrap(raw)).id ?? input.recordId) }),
    }),

    cloudflare_purge_cache: defineProxyTool(context, {
      id: 'cloudflare_purge_cache',
      description: 'Purge the Cloudflare cache for a zone — everything, or specific files, cache tags, or hosts.',
      inputSchema: z
        .object({
          zoneId: zoneIdInput,
          everything: z
            .boolean()
            .optional()
            .describe('Purge the entire cache; cannot be combined with the other options'),
          files: z.array(z.string().url()).optional().describe('Purge these exact URLs'),
          tags: z.array(z.string().min(1)).optional().describe('Purge these cache tags'),
          hosts: z.array(z.string().min(1)).optional().describe('Purge these hostnames'),
        })
        .refine(input => !input.everything || (!input.files && !input.tags && !input.hosts), {
          message: '"everything" cannot be combined with files, tags, or hosts.',
        })
        .refine(
          input =>
            input.everything === true ||
            (input.files && input.files.length > 0) ||
            (input.tags && input.tags.length > 0) ||
            (input.hosts && input.hosts.length > 0),
          { message: 'Specify everything=true or at least one of files, tags, or hosts.' },
        ),
      outputSchema: z.object({ purgeId: z.string() }),
      request: input => ({
        method: 'POST',
        path: `${API}/zones/${encodeURIComponent(input.zoneId)}/purge_cache`,
        body:
          input.everything === true
            ? { everything: true }
            : { files: input.files, tags: input.tags, hosts: input.hosts },
      }),
      transform: raw => ({ purgeId: String(asRecord(unwrap(raw)).id ?? '') }),
    }),
  };

  return applyAllowTools(tools, options?.allowTools);
}
