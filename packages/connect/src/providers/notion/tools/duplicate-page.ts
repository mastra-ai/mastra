// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function cleanBlock(block: Record<string, unknown>): Record<string, unknown> | null {
  // Get the block type - blocks must have a type field
  const blockType = block['type'];
  if (typeof blockType !== 'string') {
    return null;
  }

  const cleaned: Record<string, unknown> = {};

  // Always include type and object fields
  cleaned['type'] = blockType;
  if ('object' in block && typeof block['object'] === 'string') {
    cleaned['object'] = block['object'];
  }

  // Get the block content based on type (e.g., paragraph, heading_1, etc.)
  const blockContent = block[blockType];
  if (isRecord(blockContent)) {
    const cleanedContent: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(blockContent)) {
      // Skip API-generated fields
      if (['id', 'created_time', 'last_edited_time', 'created_by', 'last_edited_by'].includes(key)) {
        continue;
      }
      // Skip null values
      if (value === null) {
        continue;
      }
      // Keep arrays as-is
      if (Array.isArray(value)) {
        cleanedContent[key] = value;
      } else if (isRecord(value)) {
        // Only apply block cleaning to actual block objects; pass everything else through
        if (value['object'] === 'block') {
          const nestedBlock = cleanBlock(value);
          if (nestedBlock !== null) {
            cleanedContent[key] = nestedBlock;
          }
        } else {
          cleanedContent[key] = value;
        }
      } else {
        cleanedContent[key] = value;
      }
    }
    cleaned[blockType] = cleanedContent;
  }

  // Preserve pre-fetched nested children
  const children = block['children'];
  if (Array.isArray(children)) {
    const cleanedChildren = children
      .map(child => (isRecord(child) ? cleanBlock(child) : null))
      .filter((c): c is Record<string, unknown> => c !== null);
    if (cleanedChildren.length > 0) {
      cleaned['children'] = cleanedChildren;
    }
  }

  return cleaned;
}

export const duplicatePageInputSchema = z.object({
  page_id: z.string().describe('The ID of the Notion page to duplicate. Example: "35261e8ce0a38035a054fcdf4d7e1a31"'),
  parent_page_id: z
    .string()
    .optional()
    .describe(
      'Optional ID of the parent page where the duplicated page should be created. If not provided, the duplicated page will be created under the same parent as the original.',
    ),
  title: z
    .string()
    .optional()
    .describe(
      'Optional title for the duplicated page. If not provided, the original page title will be used with " (Copy)" suffix.',
    ),
});

const ParentSchema = z.object({
  type: z.string(),
  page_id: z.string().optional(),
  database_id: z.string().optional(),
  data_source_id: z.string().optional(),
  workspace: z.boolean().optional(),
});

const PageSchema = z.object({
  object: z.literal('page'),
  id: z.string(),
  created_time: z.string(),
  last_edited_time: z.string(),
  created_by: z
    .object({
      object: z.literal('user'),
      id: z.string(),
    })
    .optional(),
  last_edited_by: z
    .object({
      object: z.literal('user'),
      id: z.string(),
    })
    .optional(),
  cover: z.unknown().nullable().optional(),
  icon: z.unknown().nullable().optional(),
  parent: ParentSchema,
  archived: z.boolean().optional(),
  in_trash: z.boolean().optional(),
  properties: z.object({}).passthrough(),
  url: z.string().optional(),
  public_url: z.string().nullable().optional(),
});

const BlockSchema = z.object({}).passthrough();

const BlockListSchema = z.object({
  object: z.literal('list'),
  results: z.array(BlockSchema),
  next_cursor: z.string().nullable().optional(),
  has_more: z.boolean().optional(),
});

export const duplicatePageOutputSchema = z.object({
  id: z.string().describe('The ID of the duplicated page'),
  url: z.string().optional().describe('The URL of the duplicated page'),
  title: z.string().optional().describe('The title of the duplicated page'),
});

export function duplicatePageTool(proxy: PlatformProxy) {
  return createTool({
    id: 'notion_duplicate_page',
    description: 'Duplicate a Notion page and its content',
    inputSchema: duplicatePageInputSchema,
    outputSchema: duplicatePageOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof duplicatePageOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // Step 1: Retrieve the source page to get its properties
      // https://developers.notion.com/reference/retrieve-a-page
      const pageResponse = await platformProxy.get({
        endpoint: `/v1/pages/${encodeURIComponent(input.page_id)}`,
        retries: 3,
      });

      if (!pageResponse.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Source page not found',
          page_id: input.page_id,
        });
      }

      const sourcePage = PageSchema.parse(pageResponse.data);

      // Step 2: Retrieve the page's block children (content) with pagination
      // https://developers.notion.com/reference/get-block-children
      const blocks: unknown[] = [];
      let blockCursor: string | undefined;

      do {
        const blocksResponse = await platformProxy.get({
          endpoint: `/v1/blocks/${encodeURIComponent(input.page_id)}/children`,
          params: {
            page_size: '100',
            ...(blockCursor ? { start_cursor: blockCursor } : {}),
          },
          retries: 3,
        });

        if (!blocksResponse.data) {
          break;
        }

        const blockList = BlockListSchema.parse(blocksResponse.data);
        blocks.push(...blockList.results);
        blockCursor = blockList.has_more ? (blockList.next_cursor ?? undefined) : undefined;
      } while (blockCursor);

      // Recursively fetch children for blocks with nested content (max depth 5)
      const fetchChildBlocks = async (blockId: string, depth: number): Promise<unknown[]> => {
        if (depth > 5) return [];
        const childBlocks: unknown[] = [];
        let childCursor: string | undefined;
        do {
          const resp = await platformProxy.get({
            endpoint: `/v1/blocks/${encodeURIComponent(blockId)}/children`,
            params: { page_size: '100', ...(childCursor ? { start_cursor: childCursor } : {}) },
            retries: 3,
          });
          if (!resp.data) break;
          const list = BlockListSchema.parse(resp.data);
          childBlocks.push(...list.results);
          childCursor = list.has_more ? (list.next_cursor ?? undefined) : undefined;
        } while (childCursor);
        for (const block of childBlocks) {
          if (isRecord(block) && block['has_children'] === true && typeof block['id'] === 'string') {
            const nested = await fetchChildBlocks(block['id'], depth + 1);
            if (nested.length > 0) {
              block['children'] = nested;
            }
          }
        }
        return childBlocks;
      };

      for (const block of blocks) {
        if (isRecord(block) && block['has_children'] === true && typeof block['id'] === 'string') {
          const nestedChildren = await fetchChildBlocks(block['id'], 1);
          if (nestedChildren.length > 0) {
            block['children'] = nestedChildren;
          }
        }
      }

      // Step 3: Prepare the parent for the new page
      let parent: Record<string, unknown>;
      if (input.parent_page_id) {
        parent = {
          type: 'page_id',
          page_id: input.parent_page_id,
        };
      } else {
        // Use the same parent as the original page
        parent = sourcePage.parent;
      }

      // Step 4: Prepare the properties
      // For pages with page_id or workspace parent, only title is allowed
      // For pages with database_id or data_source_id parent, we need to filter properties
      let properties: Record<string, unknown> = {};

      if (parent['type'] === 'page_id' || parent['type'] === 'workspace') {
        // For page parents, only the title property is allowed
        const sourceTitle = sourcePage.properties['title'];
        let newTitle: string;
        if (input.title) {
          newTitle = input.title;
        } else {
          // Extract text from title property
          if (sourceTitle && isRecord(sourceTitle) && 'title' in sourceTitle) {
            const titleArray = sourceTitle['title'];
            if (Array.isArray(titleArray)) {
              const originalTitle =
                titleArray
                  .map(t => {
                    if (typeof t === 'object' && t !== null) {
                      const text = t['text'];
                      const plainText = t['plain_text'];
                      if (typeof plainText === 'string') return plainText;
                      if (typeof text === 'object' && text !== null) {
                        const content = text['content'];
                        if (typeof content === 'string') return content;
                      }
                    }
                    return '';
                  })
                  .join('') || 'Untitled';
              newTitle = `${originalTitle} (Copy)`;
            } else {
              newTitle = 'Untitled (Copy)';
            }
          } else {
            newTitle = 'Untitled (Copy)';
          }
        }
        properties = {
          title: {
            title: [{ text: { content: newTitle } }],
          },
        };
      } else if (parent['type'] === 'database_id' || parent['type'] === 'data_source_id') {
        // For database parents, we need to handle properties differently
        // Filter out system properties and prepare clean properties object
        const cleanProperties: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(sourcePage.properties)) {
          // Skip system properties like 'id', 'type', etc.
          if (key !== 'id' && isRecord(value)) {
            const propValue = value;
            // Extract the actual value based on property type
            const propType = propValue['type'];
            if (typeof propType === 'string' && propType in propValue) {
              cleanProperties[key] = { [propType]: propValue[propType] };
            }
          }
        }
        // Override the title property if input.title is provided
        if (input.title) {
          for (const [key, value] of Object.entries(sourcePage.properties)) {
            if (isRecord(value) && value['type'] === 'title') {
              cleanProperties[key] = { title: [{ text: { content: input.title } }] };
              break;
            }
          }
        }
        properties = cleanProperties;
      }

      // Helper: remove pre-fetched children so each block can be submitted independently
      const stripChildren = (block: Record<string, unknown>): Record<string, unknown> => {
        const { children: _stripped, ...rest } = block;
        return rest;
      };

      // Helper: recursively append pre-fetched children to newly created blocks.
      // Notion limits children to 100 per request and only processes 2 levels of nesting inline,
      // so deeper children must be added via separate append calls after the blocks are created.
      const appendNestedChildren = async (
        parentId: string,
        originalBlocks: Record<string, unknown>[],
      ): Promise<void> => {
        const hasAny = originalBlocks.some(b => {
          const c = b['children'];
          return Array.isArray(c) && c.length > 0;
        });
        if (!hasAny) return;

        // Fetch the IDs of the just-created blocks (positionally matched to originalBlocks)
        const newBlocks: unknown[] = [];
        let listCursor: string | undefined;
        do {
          const listResp = await platformProxy.get({
            endpoint: `/v1/blocks/${encodeURIComponent(parentId)}/children`,
            params: { page_size: '100', ...(listCursor ? { start_cursor: listCursor } : {}) },
            retries: 3,
          });
          if (!listResp.data) break;
          const listData = BlockListSchema.parse(listResp.data);
          newBlocks.push(...listData.results);
          listCursor = listData.has_more ? (listData.next_cursor ?? undefined) : undefined;
        } while (listCursor);

        for (let i = 0; i < originalBlocks.length && i < newBlocks.length; i++) {
          const origBlock = originalBlocks[i];
          if (!isRecord(origBlock)) continue;
          const childrenArr = origBlock['children'];
          if (!Array.isArray(childrenArr) || childrenArr.length === 0) continue;

          const newBlock = newBlocks[i];
          if (!isRecord(newBlock) || typeof newBlock['id'] !== 'string') continue;
          const newBlockId = newBlock['id'];

          const childRecords = childrenArr.filter((c): c is Record<string, unknown> => isRecord(c));

          // Append children in batches of 100, stripped of their own nested children
          for (let j = 0; j < childRecords.length; j += 100) {
            const chunk = childRecords.slice(j, j + 100).map(stripChildren);
            await platformProxy.patch({
              endpoint: `/v1/blocks/${encodeURIComponent(newBlockId)}/children`,
              data: { children: chunk },
              retries: 1,
            });
          }

          // Recurse for deeper levels
          await appendNestedChildren(newBlockId, childRecords);
        }
      };

      // Step 5: Create the new page with the duplicated content
      // https://developers.notion.com/reference/post-page
      const cleanedBlocks = blocks
        .map(block => (isRecord(block) ? cleanBlock(block) : null))
        .filter((block): block is Record<string, unknown> => block !== null);

      const createPagePayload: Record<string, unknown> = {
        parent,
        properties,
      };

      // Include first 100 top-level blocks without nested children.
      // Notion caps children at 100 per request and only processes 2 nesting levels inline.
      if (cleanedBlocks.length > 0) {
        createPagePayload['children'] = cleanedBlocks.slice(0, 100).map(stripChildren);
      }

      // Add icon if the source page has one
      if (sourcePage.icon) {
        createPagePayload['icon'] = sourcePage.icon;
      }

      // Add cover if the source page has one
      if (sourcePage.cover) {
        createPagePayload['cover'] = sourcePage.cover;
      }

      const createResponse = await platformProxy.post({
        endpoint: '/v1/pages',
        data: createPagePayload,
        retries: 1,
      });

      if (!createResponse.data) {
        throw new platformProxy.ActionError({
          type: 'creation_failed',
          message: 'Failed to create duplicated page',
        });
      }

      const newPage = PageSchema.parse(createResponse.data);

      // Append remaining top-level blocks in batches of 100
      for (let i = 100; i < cleanedBlocks.length; i += 100) {
        const chunk = cleanedBlocks.slice(i, i + 100).map(stripChildren);
        await platformProxy.patch({
          endpoint: `/v1/blocks/${encodeURIComponent(newPage.id)}/children`,
          data: { children: chunk },
          retries: 1,
        });
      }

      // Recursively append all nested children via separate API calls
      await appendNestedChildren(newPage.id, cleanedBlocks);

      // Extract title for output
      let outputTitle: string | undefined;
      const newTitleProp = newPage.properties['title'];
      if (newTitleProp && isRecord(newTitleProp) && 'title' in newTitleProp) {
        const titleArray = newTitleProp['title'];
        if (Array.isArray(titleArray)) {
          outputTitle =
            titleArray
              .map(t => {
                if (typeof t === 'object' && t !== null) {
                  const plainText = t['plain_text'];
                  if (typeof plainText === 'string') return plainText;
                }
                return '';
              })
              .join('') || undefined;
        }
      }

      return {
        id: newPage.id,
        url: newPage.url,
        title: outputTitle,
      };
    },
  });
}
