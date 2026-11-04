import { createHash } from 'node:crypto';

import { z } from 'zod';

import { parseMcpServerUrl } from './url-policy.js';
import type { McpServerNetworkOptions } from './url-policy.js';

export const MCP_SERVER_LIMITS = {
  nameLength: 100,
  urlLength: 2048,
  headers: 20,
  headerNameLength: 100,
  headerValueLength: 8192,
  scopes: 25,
  scopeLength: 200,
  clientIdLength: 512,
  clientSecretLength: 4096,
  serversPerOrg: 50,
  tools: 500,
  toolNameLength: 256,
} as const;

export const MCP_SERVER_AUTH_TYPES = ['none', 'headers', 'oauth'] as const;

/** Headers the transport owns; letting users set them would break or spoof the connection. */
const RESERVED_HEADER_NAMES = new Set([
  'host',
  'content-length',
  'connection',
  'transfer-encoding',
  'mcp-session-id',
  'mcp-protocol-version',
]);

/** RFC 7230 `token`. */
const HEADER_NAME_PATTERN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;
/** RFC 6749 `scope-token`. */
const SCOPE_PATTERN = /^[\x21\x23-\x5B\x5D-\x7E]+$/;
/** Provider tool-name rule (`^[a-zA-Z0-9_-]{1,64}$`). */
const MAX_EXPOSED_TOOL_NAME_LENGTH = 64;
const SLUG_LENGTH = 40;

function shortHash(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 6);
}

/** Stable per-organization identifier for a server, used as its tool-name prefix. */
export function slugify(name: string): string {
  const slug = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .slice(0, SLUG_LENGTH)
    .replace(/-+$/, '');
  return slug || `server-${shortHash(name)}`;
}

/**
 * The tool name the agent and permission rules see: `${slug}_${toolName}`,
 * limited to `[A-Za-z0-9_-]`. Names over 64 characters are truncated and
 * suffixed with a hash of the full name so they stay unique and stable.
 */
export function toolExposedName(slug: string, toolName: string): string {
  const full = `${slug}_${toolName}`;
  const sanitized = full.replace(/[^A-Za-z0-9_-]/g, '_');
  if (sanitized.length <= MAX_EXPOSED_TOOL_NAME_LENGTH) return sanitized;
  return `${sanitized.slice(0, MAX_EXPOSED_TOOL_NAME_LENGTH - 7)}_${shortHash(full)}`;
}

const nameSchema = z.string().trim().min(1, 'Enter a name.').max(MCP_SERVER_LIMITS.nameLength);
const authTypeSchema = z.enum(MCP_SERVER_AUTH_TYPES);

const headerSchema = z.strictObject({
  name: z
    .string()
    .trim()
    .min(1, 'Enter a header name.')
    .max(MCP_SERVER_LIMITS.headerNameLength)
    .regex(HEADER_NAME_PATTERN, "Header names may only contain letters, digits, and !#$%&'*+-.^_`|~.")
    .refine(name => !RESERVED_HEADER_NAMES.has(name.toLowerCase()), {
      message: 'This header is set by the MCP connection and cannot be configured.',
    }),
  value: z
    .string()
    .trim()
    .min(1, 'Enter a header value.')
    .max(MCP_SERVER_LIMITS.headerValueLength)
    .refine(value => !/[\r\n\0]/.test(value), { message: 'Header values cannot contain line breaks.' }),
});

const headersSchema = z
  .array(headerSchema)
  .min(1, 'Add at least one header.')
  .max(MCP_SERVER_LIMITS.headers)
  .superRefine((headers, ctx) => {
    const seen = new Set<string>();
    headers.forEach((header, index) => {
      const key = header.name.toLowerCase();
      if (seen.has(key))
        ctx.addIssue({ code: 'custom', path: [index, 'name'], message: 'Header names must be unique.' });
      seen.add(key);
    });
  })
  .transform(headers => Object.fromEntries(headers.map(header => [header.name, header.value])));

const scopesSchema = z
  .array(
    z
      .string()
      .trim()
      .min(1)
      .max(MCP_SERVER_LIMITS.scopeLength)
      .regex(SCOPE_PATTERN, 'Scopes cannot contain spaces, quotes, or backslashes.'),
  )
  .max(MCP_SERVER_LIMITS.scopes)
  .transform(scopes => [...new Set(scopes)]);

const clientIdSchema = z.string().trim().min(1).max(MCP_SERVER_LIMITS.clientIdLength);
const clientSecretSchema = z.string().trim().min(1).max(MCP_SERVER_LIMITS.clientSecretLength);

function urlSchema(network: McpServerNetworkOptions) {
  return z
    .string()
    .trim()
    .min(1, 'Enter the server URL.')
    .max(MCP_SERVER_LIMITS.urlLength)
    .transform((raw, ctx) => {
      try {
        return parseMcpServerUrl(raw, network).toString();
      } catch (error) {
        ctx.addIssue({ code: 'custom', message: error instanceof Error ? error.message : 'Invalid URL.' });
        return z.NEVER;
      }
    });
}

/**
 * Request-body schemas. The URL policy depends on deployment configuration,
 * so the schemas are built per deployment rather than declared once.
 */
export function createMcpServerSchemas(network: McpServerNetworkOptions) {
  const create = z
    .strictObject({
      name: nameSchema,
      url: urlSchema(network),
      authType: authTypeSchema,
      headers: headersSchema.optional(),
      oauth: z
        .strictObject({
          clientId: clientIdSchema.optional(),
          clientSecret: clientSecretSchema.optional(),
          scopes: scopesSchema.optional(),
        })
        .refine(oauth => !oauth.clientSecret || oauth.clientId, {
          message: 'A client secret needs a client ID.',
          path: ['clientSecret'],
        })
        .optional(),
    })
    .superRefine((body, ctx) => {
      if (body.authType === 'headers' && !body.headers) {
        ctx.addIssue({ code: 'custom', path: ['headers'], message: 'Add at least one header.' });
      }
      if (body.authType !== 'headers' && body.headers) {
        ctx.addIssue({
          code: 'custom',
          path: ['headers'],
          message: 'Headers are only used with header authentication.',
        });
      }
      if (body.authType !== 'oauth' && body.oauth) {
        ctx.addIssue({ code: 'custom', path: ['oauth'], message: 'OAuth settings are only used with OAuth.' });
      }
    });

  /**
   * Omitted fields keep their stored values. `headers` replaces every stored
   * header; OAuth `clientId`/`clientSecret` accept `null` to clear them.
   */
  const update = z
    .strictObject({
      name: nameSchema.optional(),
      url: urlSchema(network).optional(),
      authType: authTypeSchema.optional(),
      headers: headersSchema.optional(),
      oauth: z
        .strictObject({
          clientId: clientIdSchema.nullable().optional(),
          clientSecret: clientSecretSchema.nullable().optional(),
          scopes: scopesSchema.optional(),
        })
        .refine(oauth => !(oauth.clientSecret && oauth.clientId === null), {
          message: 'A client secret needs a client ID.',
          path: ['clientSecret'],
        })
        .optional(),
    })
    .superRefine((body, ctx) => {
      if (Object.values(body).every(value => value === undefined)) {
        ctx.addIssue({ code: 'custom', message: 'Nothing to update.' });
      }
      if (body.authType && body.authType !== 'headers' && body.headers) {
        ctx.addIssue({
          code: 'custom',
          path: ['headers'],
          message: 'Headers are only used with header authentication.',
        });
      }
      if (body.authType && body.authType !== 'oauth' && body.oauth) {
        ctx.addIssue({ code: 'custom', path: ['oauth'], message: 'OAuth settings are only used with OAuth.' });
      }
    });

  const selectTools = z.strictObject({
    selected: z
      .array(z.string().min(1).max(MCP_SERVER_LIMITS.toolNameLength))
      .max(MCP_SERVER_LIMITS.tools)
      .transform(names => [...new Set(names)]),
  });

  return { create, update, selectTools };
}

export type McpServerSchemas = ReturnType<typeof createMcpServerSchemas>;
export type CreateMcpServerBody = z.output<McpServerSchemas['create']>;
export type UpdateMcpServerBody = z.output<McpServerSchemas['update']>;
