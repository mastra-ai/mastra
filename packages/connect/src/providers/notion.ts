import type { ToolsInput } from '@mastra/core/agent';
import { z } from 'zod';

import type { ProviderToolsOptions } from '../toolset.js';
import { applyAllowTools, defineProxyTool } from '../toolset.js';

const ENV_VAR = 'MASTRA_NOTION_CONNECTION_ID';

/**
 * Pinned deliberately: the 2025-09 Notion API restructures database querying
 * around data sources; this is the stable, widely-documented surface for v1.
 */
const NOTION_VERSION = '2022-06-28';

const headers = { 'Notion-Version': NOTION_VERSION };

const paginationInput = {
  limit: z.number().int().min(1).max(50).optional().describe('Max results to return (1-50, default 25)'),
  after: z.string().optional().describe('Pagination cursor from a previous page (nextCursor)'),
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function listOf(raw: unknown): { results: Record<string, unknown>[]; nextCursor: string | null; hasMore: boolean } {
  const data = asRecord(raw);
  const results = Array.isArray(data.results) ? data.results.map(asRecord) : [];
  return {
    results,
    nextCursor: typeof data.next_cursor === 'string' ? data.next_cursor : null,
    hasMore: data.has_more === true,
  };
}

/** Joins the plain_text of a Notion rich text array. */
function plainText(richText: unknown): string {
  if (!Array.isArray(richText)) return '';
  return richText
    .map(item => {
      const text = asRecord(item).plain_text;
      return typeof text === 'string' ? text : '';
    })
    .join('');
}

/** Extracts a human-readable title from a page or database object. */
function titleOf(item: Record<string, unknown>): string {
  if (Array.isArray(item.title)) return plainText(item.title);
  for (const prop of Object.values(asRecord(item.properties))) {
    const record = asRecord(prop);
    if (record.type === 'title') return plainText(record.title);
  }
  return '';
}

const pageSchema = z.object({
  id: z.string(),
  url: z.string(),
  title: z.string(),
  archived: z.boolean(),
  properties: z.record(z.string(), z.unknown()),
});

function shapePage(page: Record<string, unknown>) {
  return {
    id: String(page.id ?? ''),
    url: String(page.url ?? ''),
    title: titleOf(page),
    archived: page.archived === true,
    properties: asRecord(page.properties),
  };
}

const blockSchema = z.object({ id: z.string(), type: z.string(), text: z.string(), hasChildren: z.boolean() });

function shapeBlock(block: Record<string, unknown>) {
  const type = String(block.type ?? '');
  const content = asRecord(block[type]);
  return {
    id: String(block.id ?? ''),
    type,
    text: plainText(content.rich_text),
    hasChildren: block.has_children === true,
  };
}

/** Wraps plain text in a minimal Notion paragraph block. */
function paragraph(text: string) {
  return {
    object: 'block',
    type: 'paragraph',
    paragraph: { rich_text: [{ type: 'text', text: { content: text } }] },
  };
}

/**
 * Curated Notion toolset executing through the platform connection proxy.
 * All tools resolve the connection from `options.connectionId` or
 * MASTRA_NOTION_CONNECTION_ID at execute time. Requests pin
 * Notion-Version 2022-06-28.
 */
export function createNotionTools(options?: ProviderToolsOptions): ToolsInput {
  const context = { envVar: ENV_VAR, options };

  const tools = {
    notion_search: defineProxyTool(context, {
      id: 'notion_search',
      description: 'Search Notion pages and databases shared with the integration by title.',
      inputSchema: z.object({
        query: z.string().optional().describe('Search terms; omit to list everything accessible'),
        filter: z.enum(['page', 'database']).optional().describe('Restrict results to pages or databases'),
        ...paginationInput,
      }),
      outputSchema: z.object({
        results: z.array(z.object({ id: z.string(), object: z.string(), url: z.string(), title: z.string() })),
        nextCursor: z.string().nullable(),
        hasMore: z.boolean(),
      }),
      request: input => ({
        method: 'POST',
        path: 'v1/search',
        headers,
        body: {
          query: input.query,
          filter: input.filter ? { property: 'object', value: input.filter } : undefined,
          page_size: input.limit ?? 25,
          start_cursor: input.after,
        },
      }),
      transform: raw => {
        const { results, nextCursor, hasMore } = listOf(raw);
        return {
          results: results.map(item => ({
            id: String(item.id ?? ''),
            object: String(item.object ?? ''),
            url: String(item.url ?? ''),
            title: titleOf(item),
          })),
          nextCursor,
          hasMore,
        };
      },
    }),

    notion_get_page: defineProxyTool(context, {
      id: 'notion_get_page',
      description: 'Get a Notion page by id, including its property values.',
      inputSchema: z.object({ pageId: z.string().describe('Page id (UUID)') }),
      outputSchema: z.object({ page: pageSchema }),
      request: input => ({ method: 'GET', path: `v1/pages/${encodeURIComponent(input.pageId)}`, headers }),
      transform: raw => ({ page: shapePage(asRecord(raw)) }),
    }),

    notion_create_page: defineProxyTool(context, {
      id: 'notion_create_page',
      description:
        'Create a Notion page under a parent page or database. For a page parent, provide title (and optional plain-text paragraphs); for a database parent, provide properties matching the database schema (including its title column). Content paragraphs are appended as children for both parent kinds.',
      inputSchema: z
        .object({
          parentPageId: z.string().optional().describe('Parent page id (exactly one parent is required)'),
          parentDatabaseId: z.string().optional().describe('Parent database id (exactly one parent is required)'),
          title: z.string().optional().describe('Page title (required when the parent is a page)'),
          content: z.array(z.string()).optional().describe('Plain-text paragraphs to add as page content'),
          properties: z
            .record(z.string(), z.unknown())
            .optional()
            .describe(
              'Raw Notion properties object matching the database schema (required when the parent is a database)',
            ),
        })
        .refine(input => !input.parentPageId !== !input.parentDatabaseId, {
          message: 'Provide exactly one of parentPageId or parentDatabaseId.',
        })
        .refine(input => !input.parentPageId || Boolean(input.title?.trim()), {
          message: 'title is required when the parent is a page.',
        })
        .refine(input => !input.parentDatabaseId || Object.keys(input.properties ?? {}).length > 0, {
          message: 'properties (matching the database schema) are required when the parent is a database.',
        })
        .refine(input => !input.parentPageId || input.properties === undefined, {
          message: 'properties only apply to database parents; page parents take title.',
        })
        .refine(input => !input.parentDatabaseId || input.title === undefined, {
          message: 'title only applies to page parents; for database parents set the title column inside properties.',
        }),
      outputSchema: z.object({ page: pageSchema }),
      request: input => {
        const properties = input.parentPageId
          ? { title: { title: [{ type: 'text', text: { content: input.title } }] } }
          : input.properties;
        return {
          method: 'POST',
          path: 'v1/pages',
          headers,
          body: {
            parent: input.parentPageId ? { page_id: input.parentPageId } : { database_id: input.parentDatabaseId },
            properties,
            children: input.content?.map(paragraph),
          },
        };
      },
      transform: raw => ({ page: shapePage(asRecord(raw)) }),
    }),

    notion_update_page_properties: defineProxyTool(context, {
      id: 'notion_update_page_properties',
      description: 'Update property values of a Notion page (raw Notion properties object), or archive/unarchive it.',
      inputSchema: z
        .object({
          pageId: z.string().describe('Page id (UUID)'),
          properties: z.record(z.string(), z.unknown()).optional().describe('Raw Notion properties object to set'),
          archived: z.boolean().optional().describe('Set true to archive the page, false to restore it'),
        })
        .refine(
          input =>
            (input.properties !== undefined && Object.keys(input.properties).length > 0) ||
            input.archived !== undefined,
          { message: 'Provide non-empty properties and/or archived to update.' },
        ),
      outputSchema: z.object({ page: pageSchema }),
      request: input => ({
        method: 'PATCH',
        path: `v1/pages/${encodeURIComponent(input.pageId)}`,
        headers,
        body: { properties: input.properties, archived: input.archived },
      }),
      transform: raw => ({ page: shapePage(asRecord(raw)) }),
    }),

    notion_get_block_children: defineProxyTool(context, {
      id: 'notion_get_block_children',
      description: 'List the child blocks of a Notion page or block, with their plain-text content.',
      inputSchema: z.object({
        blockId: z.string().describe('Page or block id (UUID)'),
        ...paginationInput,
      }),
      outputSchema: z.object({
        blocks: z.array(blockSchema),
        nextCursor: z.string().nullable(),
        hasMore: z.boolean(),
      }),
      request: input => ({
        method: 'GET',
        path: `v1/blocks/${encodeURIComponent(input.blockId)}/children`,
        headers,
        query: { page_size: input.limit ?? 25, start_cursor: input.after },
      }),
      transform: raw => {
        const { results, nextCursor, hasMore } = listOf(raw);
        return { blocks: results.map(shapeBlock), nextCursor, hasMore };
      },
    }),

    notion_append_block_children: defineProxyTool(context, {
      id: 'notion_append_block_children',
      description: 'Append plain-text paragraphs (or raw Notion blocks) to a Notion page or block.',
      inputSchema: z
        .object({
          blockId: z.string().describe('Page or block id (UUID)'),
          paragraphs: z.array(z.string()).optional().describe('Plain-text paragraphs to append'),
          blocks: z.array(z.record(z.string(), z.unknown())).optional().describe('Raw Notion block objects to append'),
        })
        .refine(input => (input.paragraphs?.length ?? 0) + (input.blocks?.length ?? 0) > 0, {
          message: 'Provide paragraphs or blocks to append.',
        }),
      outputSchema: z.object({ blocks: z.array(blockSchema) }),
      request: input => ({
        method: 'PATCH',
        path: `v1/blocks/${encodeURIComponent(input.blockId)}/children`,
        headers,
        body: { children: [...(input.paragraphs?.map(paragraph) ?? []), ...(input.blocks ?? [])] },
      }),
      transform: raw => ({ blocks: listOf(raw).results.map(shapeBlock) }),
    }),

    notion_query_database: defineProxyTool(context, {
      id: 'notion_query_database',
      description:
        'Query pages in a Notion database, optionally with a raw Notion filter/sorts (see Notion API docs for their shape).',
      inputSchema: z.object({
        databaseId: z.string().describe('Database id (UUID)'),
        filter: z.record(z.string(), z.unknown()).optional().describe('Raw Notion filter object'),
        sorts: z.array(z.record(z.string(), z.unknown())).optional().describe('Raw Notion sorts array'),
        ...paginationInput,
      }),
      outputSchema: z.object({
        pages: z.array(pageSchema),
        nextCursor: z.string().nullable(),
        hasMore: z.boolean(),
      }),
      request: input => ({
        method: 'POST',
        path: `v1/databases/${encodeURIComponent(input.databaseId)}/query`,
        headers,
        body: {
          filter: input.filter,
          sorts: input.sorts,
          page_size: input.limit ?? 25,
          start_cursor: input.after,
        },
      }),
      transform: raw => {
        const { results, nextCursor, hasMore } = listOf(raw);
        return { pages: results.map(shapePage), nextCursor, hasMore };
      },
    }),

    notion_get_database: defineProxyTool(context, {
      id: 'notion_get_database',
      description: 'Get a Notion database by id, including its title and column names/types.',
      inputSchema: z.object({ databaseId: z.string().describe('Database id (UUID)') }),
      outputSchema: z.object({
        database: z.object({
          id: z.string(),
          url: z.string(),
          title: z.string(),
          properties: z.record(z.string(), z.object({ type: z.string() })),
        }),
      }),
      request: input => ({ method: 'GET', path: `v1/databases/${encodeURIComponent(input.databaseId)}`, headers }),
      transform: raw => {
        const database = asRecord(raw);
        const properties: Record<string, { type: string }> = {};
        for (const [name, prop] of Object.entries(asRecord(database.properties))) {
          properties[name] = { type: String(asRecord(prop).type ?? '') };
        }
        return {
          database: {
            id: String(database.id ?? ''),
            url: String(database.url ?? ''),
            title: titleOf(database),
            properties,
          },
        };
      },
    }),

    notion_create_comment: defineProxyTool(context, {
      id: 'notion_create_comment',
      description: 'Add a plain-text comment to a Notion page (or an existing discussion thread).',
      inputSchema: z
        .object({
          pageId: z.string().optional().describe('Page id to start a new comment thread on'),
          discussionId: z.string().optional().describe('Existing discussion id to reply to'),
          body: z.string().describe('Comment text'),
        })
        .refine(input => !input.pageId !== !input.discussionId, {
          message: 'Provide exactly one of pageId or discussionId.',
        }),
      outputSchema: z.object({ comment: z.object({ id: z.string(), discussionId: z.string() }) }),
      request: input => ({
        method: 'POST',
        path: 'v1/comments',
        headers,
        body: {
          parent: input.pageId ? { page_id: input.pageId } : undefined,
          discussion_id: input.discussionId,
          rich_text: [{ type: 'text', text: { content: input.body } }],
        },
      }),
      transform: raw => {
        const comment = asRecord(raw);
        return {
          comment: { id: String(comment.id ?? ''), discussionId: String(comment.discussion_id ?? '') },
        };
      },
    }),
  } satisfies ToolsInput;

  return applyAllowTools(tools, options?.allowTools);
}
