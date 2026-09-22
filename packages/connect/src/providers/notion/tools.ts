// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createPlatformProxy } from '../../runtime/platform-proxy.js';
import type { ProviderToolsOptions } from '../../toolset.js';
import { applyAllowTools } from '../../toolset.js';
import { appendBlockChildrenTool } from './tools/append-block-children.js';
import { appendBulletedListTool } from './tools/append-bulleted-list.js';
import { appendCalloutBlockTool } from './tools/append-callout-block.js';
import { appendCodeBlockTool } from './tools/append-code-block.js';
import { appendDividerTool } from './tools/append-divider.js';
import { appendHeadingBlockTool } from './tools/append-heading-block.js';
import { appendTodoBlockTool } from './tools/append-todo-block.js';
import { archivePageTool } from './tools/archive-page.js';
import { createCommentTool } from './tools/create-comment.js';
import { createDataSourceTool } from './tools/create-data-source.js';
import { createDatabaseTool } from './tools/create-database.js';
import { createPageTool } from './tools/create-page.js';
import { deleteBlockTool } from './tools/delete-block.js';
import { duplicatePageTool } from './tools/duplicate-page.js';
import { getBotUserTool } from './tools/get-bot-user.js';
import { getPageAsMarkdownTool } from './tools/get-page-as-markdown.js';
import { getPagePropertyItemTool } from './tools/get-page-property-item.js';
import { getUserTool } from './tools/get-user.js';
import { listBlockChildrenTool } from './tools/list-block-children.js';
import { listCommentsTool } from './tools/list-comments.js';
import { listDataSourceTemplatesTool } from './tools/list-data-source-templates.js';
import { listUsersTool } from './tools/list-users.js';
import { movePageTool } from './tools/move-page.js';
import { queryDataSourceTool } from './tools/query-data-source.js';
import { queryDatabaseFilteredTool } from './tools/query-database-filtered.js';
import { queryDatabaseSortedTool } from './tools/query-database-sorted.js';
import { queryDatabaseTool } from './tools/query-database.js';
import { restorePageTool } from './tools/restore-page.js';
import { retrieveBlockChildrenTool } from './tools/retrieve-block-children.js';
import { retrieveBlockTool } from './tools/retrieve-block.js';
import { retrieveCommentTool } from './tools/retrieve-comment.js';
import { retrieveDataSourceTool } from './tools/retrieve-data-source.js';
import { retrieveDatabaseTool } from './tools/retrieve-database.js';
import { retrievePagePropertyTool } from './tools/retrieve-page-property.js';
import { retrievePageTool } from './tools/retrieve-page.js';
import { retrieveUserTool } from './tools/retrieve-user.js';
import { searchDatabasesTool } from './tools/search-databases.js';
import { searchPagesTool } from './tools/search-pages.js';
import { searchTool } from './tools/search.js';
import { updateBlockTool } from './tools/update-block.js';
import { updateDataSourceTool } from './tools/update-data-source.js';
import { updateDatabaseTool } from './tools/update-database.js';
import { updatePageMarkdownTool } from './tools/update-page-markdown.js';
import { updatePageTool } from './tools/update-page.js';

export function createNotionTools(options?: ProviderToolsOptions) {
  const platformProxy = createPlatformProxy({ connectionId: options?.connectionId, client: options?.client });
  const tools = {
    notion_append_block_children: appendBlockChildrenTool(platformProxy),
    notion_append_bulleted_list: appendBulletedListTool(platformProxy),
    notion_append_callout_block: appendCalloutBlockTool(platformProxy),
    notion_append_code_block: appendCodeBlockTool(platformProxy),
    notion_append_divider: appendDividerTool(platformProxy),
    notion_append_heading_block: appendHeadingBlockTool(platformProxy),
    notion_append_todo_block: appendTodoBlockTool(platformProxy),
    notion_archive_page: archivePageTool(platformProxy),
    notion_create_comment: createCommentTool(platformProxy),
    notion_create_data_source: createDataSourceTool(platformProxy),
    notion_create_database: createDatabaseTool(platformProxy),
    notion_create_page: createPageTool(platformProxy),
    notion_delete_block: deleteBlockTool(platformProxy),
    notion_duplicate_page: duplicatePageTool(platformProxy),
    notion_get_bot_user: getBotUserTool(platformProxy),
    notion_get_page_as_markdown: getPageAsMarkdownTool(platformProxy),
    notion_get_page_property_item: getPagePropertyItemTool(platformProxy),
    notion_get_user: getUserTool(platformProxy),
    notion_list_block_children: listBlockChildrenTool(platformProxy),
    notion_list_comments: listCommentsTool(platformProxy),
    notion_list_data_source_templates: listDataSourceTemplatesTool(platformProxy),
    notion_list_users: listUsersTool(platformProxy),
    notion_move_page: movePageTool(platformProxy),
    notion_query_data_source: queryDataSourceTool(platformProxy),
    notion_query_database_filtered: queryDatabaseFilteredTool(platformProxy),
    notion_query_database_sorted: queryDatabaseSortedTool(platformProxy),
    notion_query_database: queryDatabaseTool(platformProxy),
    notion_restore_page: restorePageTool(platformProxy),
    notion_retrieve_block_children: retrieveBlockChildrenTool(platformProxy),
    notion_retrieve_block: retrieveBlockTool(platformProxy),
    notion_retrieve_comment: retrieveCommentTool(platformProxy),
    notion_retrieve_data_source: retrieveDataSourceTool(platformProxy),
    notion_retrieve_database: retrieveDatabaseTool(platformProxy),
    notion_retrieve_page_property: retrievePagePropertyTool(platformProxy),
    notion_retrieve_page: retrievePageTool(platformProxy),
    notion_retrieve_user: retrieveUserTool(platformProxy),
    notion_search_databases: searchDatabasesTool(platformProxy),
    notion_search_pages: searchPagesTool(platformProxy),
    notion_search: searchTool(platformProxy),
    notion_update_block: updateBlockTool(platformProxy),
    notion_update_data_source: updateDataSourceTool(platformProxy),
    notion_update_database: updateDatabaseTool(platformProxy),
    notion_update_page_markdown: updatePageMarkdownTool(platformProxy),
    notion_update_page: updatePageTool(platformProxy),
  };
  return applyAllowTools(tools, options?.allowTools);
}
