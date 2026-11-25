// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createPlatformProxy } from '../../runtime/platform-proxy.js';
import type { ProviderToolsOptions } from '../../toolset.js';
import { applyToolFilter } from '../../toolset.js';
import { archiveArticleTool } from './tools/archive-article.js';
import { createArticleTool } from './tools/create-article.js';
import { createCategoryTool } from './tools/create-category.js';
import { createOrganizationTool } from './tools/create-organization.js';
import { createSectionTool } from './tools/create-section.js';
import { createTicketTool } from './tools/create-ticket.js';
import { createUserTool } from './tools/create-user.js';
import { deleteCategoryTool } from './tools/delete-category.js';
import { deleteOrganizationTool } from './tools/delete-organization.js';
import { deleteSectionTool } from './tools/delete-section.js';
import { deleteTicketTool } from './tools/delete-ticket.js';
import { deleteUserTool } from './tools/delete-user.js';
import { getArticleTool } from './tools/get-article.js';
import { getGroupTool } from './tools/get-group.js';
import { getOrganizationTool } from './tools/get-organization.js';
import { getTicketCommentsTool } from './tools/get-ticket-comments.js';
import { getTicketFieldTool } from './tools/get-ticket-field.js';
import { getTicketFormTool } from './tools/get-ticket-form.js';
import { getTicketTool } from './tools/get-ticket.js';
import { getUserTool } from './tools/get-user.js';
import { listArticlesTool } from './tools/list-articles.js';
import { listGroupsTool } from './tools/list-groups.js';
import { listMacrosTool } from './tools/list-macros.js';
import { listOrganizationsTool } from './tools/list-organizations.js';
import { listPermissionGroupsTool } from './tools/list-permission-groups.js';
import { listTicketFieldsTool } from './tools/list-ticket-fields.js';
import { listTicketFormsTool } from './tools/list-ticket-forms.js';
import { listTicketsTool } from './tools/list-tickets.js';
import { listUsersTool } from './tools/list-users.js';
import { listViewsTool } from './tools/list-views.js';
import { searchTicketsTool } from './tools/search-tickets.js';
import { updateArticleTranslationTool } from './tools/update-article-translation.js';
import { updateArticleTool } from './tools/update-article.js';
import { updateOrganizationTool } from './tools/update-organization.js';
import { updateTicketTool } from './tools/update-ticket.js';
import { updateUserTool } from './tools/update-user.js';

export function createZendeskTools(options?: ProviderToolsOptions) {
  const platformProxy = createPlatformProxy({ connectionId: options?.connectionId, client: options?.client });
  const tools = {
    zendesk_archive_article: archiveArticleTool(platformProxy),
    zendesk_create_article: createArticleTool(platformProxy),
    zendesk_create_category: createCategoryTool(platformProxy),
    zendesk_create_organization: createOrganizationTool(platformProxy),
    zendesk_create_section: createSectionTool(platformProxy),
    zendesk_create_ticket: createTicketTool(platformProxy),
    zendesk_create_user: createUserTool(platformProxy),
    zendesk_delete_category: deleteCategoryTool(platformProxy),
    zendesk_delete_organization: deleteOrganizationTool(platformProxy),
    zendesk_delete_section: deleteSectionTool(platformProxy),
    zendesk_delete_ticket: deleteTicketTool(platformProxy),
    zendesk_delete_user: deleteUserTool(platformProxy),
    zendesk_get_article: getArticleTool(platformProxy),
    zendesk_get_group: getGroupTool(platformProxy),
    zendesk_get_organization: getOrganizationTool(platformProxy),
    zendesk_get_ticket_comments: getTicketCommentsTool(platformProxy),
    zendesk_get_ticket_field: getTicketFieldTool(platformProxy),
    zendesk_get_ticket_form: getTicketFormTool(platformProxy),
    zendesk_get_ticket: getTicketTool(platformProxy),
    zendesk_get_user: getUserTool(platformProxy),
    zendesk_list_articles: listArticlesTool(platformProxy),
    zendesk_list_groups: listGroupsTool(platformProxy),
    zendesk_list_macros: listMacrosTool(platformProxy),
    zendesk_list_organizations: listOrganizationsTool(platformProxy),
    zendesk_list_permission_groups: listPermissionGroupsTool(platformProxy),
    zendesk_list_ticket_fields: listTicketFieldsTool(platformProxy),
    zendesk_list_ticket_forms: listTicketFormsTool(platformProxy),
    zendesk_list_tickets: listTicketsTool(platformProxy),
    zendesk_list_users: listUsersTool(platformProxy),
    zendesk_list_views: listViewsTool(platformProxy),
    zendesk_search_tickets: searchTicketsTool(platformProxy),
    zendesk_update_article_translation: updateArticleTranslationTool(platformProxy),
    zendesk_update_article: updateArticleTool(platformProxy),
    zendesk_update_organization: updateOrganizationTool(platformProxy),
    zendesk_update_ticket: updateTicketTool(platformProxy),
    zendesk_update_user: updateUserTool(platformProxy),
  };
  return applyToolFilter(tools, { allowTools: options?.allowTools, disallowTools: options?.disallowTools });
}
