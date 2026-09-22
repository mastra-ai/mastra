// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createPlatformProxy } from '../../runtime/platform-proxy.js';
import type { ProviderToolsOptions } from '../../toolset.js';
import { applyAllowTools } from '../../toolset.js';
import { batchCreateCompaniesTool } from './tools/batch-create-companies.js';
import { batchUpdateCompaniesTool } from './tools/batch-update-companies.js';
import { changeUserRoleTool } from './tools/change-user-role.js';
import { cloneMarketingEmailTool } from './tools/clone-marketing-email.js';
import { createAssociationTool } from './tools/create-association.js';
import { createCompanyTool } from './tools/create-company.js';
import { createContactTool } from './tools/create-contact.js';
import { createDealTool } from './tools/create-deal.js';
import { createMarketingEmailTool } from './tools/create-marketing-email.js';
import { createNoteTool } from './tools/create-note.js';
import { createPropertyTool } from './tools/create-property.js';
import { createTaskTool } from './tools/create-task.js';
import { createTicketTool } from './tools/create-ticket.js';
import { createUserTool } from './tools/create-user.js';
import { deleteAWorkflowTool } from './tools/delete-a-workflow.js';
import { deleteCompanyTool } from './tools/delete-company.js';
import { deleteContactTool } from './tools/delete-contact.js';
import { deleteDealTool } from './tools/delete-deal.js';
import { deleteMarketingEmailTool } from './tools/delete-marketing-email.js';
import { deleteTaskTool } from './tools/delete-task.js';
import { deleteTicketTool } from './tools/delete-ticket.js';
import { deleteUserTool } from './tools/delete-user.js';
import { fetchAccountInformationTool } from './tools/fetch-account-information.js';
import { fetchPipelinesTool } from './tools/fetch-pipelines.js';
import { fetchPropertiesTool } from './tools/fetch-properties.js';
import { fetchRolesTool } from './tools/fetch-roles.js';
import { getCompanyTool } from './tools/get-company.js';
import { getContactTool } from './tools/get-contact.js';
import { getDealTool } from './tools/get-deal.js';
import { getMarketingEmailTool } from './tools/get-marketing-email.js';
import { getOwnerTool } from './tools/get-owner.js';
import { getTicketTool } from './tools/get-ticket.js';
import { listCompaniesTool } from './tools/list-companies.js';
import { listContactsTool } from './tools/list-contacts.js';
import { listDealsTool } from './tools/list-deals.js';
import { listFormsTool } from './tools/list-forms.js';
import { listMarketingEmailsTool } from './tools/list-marketing-emails.js';
import { listTicketsTool } from './tools/list-tickets.js';
import { searchCompaniesTool } from './tools/search-companies.js';
import { searchDealsTool } from './tools/search-deals.js';
import { searchTicketsTool } from './tools/search-tickets.js';
import { submitFormTool } from './tools/submit-form.js';
import { updateCompanyTool } from './tools/update-company.js';
import { updateContactTool } from './tools/update-contact.js';
import { updateDealTool } from './tools/update-deal.js';
import { updateMarketingEmailTool } from './tools/update-marketing-email.js';
import { updateTaskTool } from './tools/update-task.js';
import { updateTicketTool } from './tools/update-ticket.js';
import { whoamiTool } from './tools/whoami.js';

export function createHubspotTools(options?: ProviderToolsOptions) {
  const platformProxy = createPlatformProxy({ connectionId: options?.connectionId, client: options?.client });
  const tools = {
    hubspot_batch_create_companies: batchCreateCompaniesTool(platformProxy),
    hubspot_batch_update_companies: batchUpdateCompaniesTool(platformProxy),
    hubspot_change_user_role: changeUserRoleTool(platformProxy),
    hubspot_clone_marketing_email: cloneMarketingEmailTool(platformProxy),
    hubspot_create_association: createAssociationTool(platformProxy),
    hubspot_create_company: createCompanyTool(platformProxy),
    hubspot_create_contact: createContactTool(platformProxy),
    hubspot_create_deal: createDealTool(platformProxy),
    hubspot_create_marketing_email: createMarketingEmailTool(platformProxy),
    hubspot_create_note: createNoteTool(platformProxy),
    hubspot_create_property: createPropertyTool(platformProxy),
    hubspot_create_task: createTaskTool(platformProxy),
    hubspot_create_ticket: createTicketTool(platformProxy),
    hubspot_create_user: createUserTool(platformProxy),
    hubspot_delete_a_workflow: deleteAWorkflowTool(platformProxy),
    hubspot_delete_company: deleteCompanyTool(platformProxy),
    hubspot_delete_contact: deleteContactTool(platformProxy),
    hubspot_delete_deal: deleteDealTool(platformProxy),
    hubspot_delete_marketing_email: deleteMarketingEmailTool(platformProxy),
    hubspot_delete_task: deleteTaskTool(platformProxy),
    hubspot_delete_ticket: deleteTicketTool(platformProxy),
    hubspot_delete_user: deleteUserTool(platformProxy),
    hubspot_fetch_account_information: fetchAccountInformationTool(platformProxy),
    hubspot_fetch_pipelines: fetchPipelinesTool(platformProxy),
    hubspot_fetch_properties: fetchPropertiesTool(platformProxy),
    hubspot_fetch_roles: fetchRolesTool(platformProxy),
    hubspot_get_company: getCompanyTool(platformProxy),
    hubspot_get_contact: getContactTool(platformProxy),
    hubspot_get_deal: getDealTool(platformProxy),
    hubspot_get_marketing_email: getMarketingEmailTool(platformProxy),
    hubspot_get_owner: getOwnerTool(platformProxy),
    hubspot_get_ticket: getTicketTool(platformProxy),
    hubspot_list_companies: listCompaniesTool(platformProxy),
    hubspot_list_contacts: listContactsTool(platformProxy),
    hubspot_list_deals: listDealsTool(platformProxy),
    hubspot_list_forms: listFormsTool(platformProxy),
    hubspot_list_marketing_emails: listMarketingEmailsTool(platformProxy),
    hubspot_list_tickets: listTicketsTool(platformProxy),
    hubspot_search_companies: searchCompaniesTool(platformProxy),
    hubspot_search_deals: searchDealsTool(platformProxy),
    hubspot_search_tickets: searchTicketsTool(platformProxy),
    hubspot_submit_form: submitFormTool(platformProxy),
    hubspot_update_company: updateCompanyTool(platformProxy),
    hubspot_update_contact: updateContactTool(platformProxy),
    hubspot_update_deal: updateDealTool(platformProxy),
    hubspot_update_marketing_email: updateMarketingEmailTool(platformProxy),
    hubspot_update_task: updateTaskTool(platformProxy),
    hubspot_update_ticket: updateTicketTool(platformProxy),
    hubspot_whoami: whoamiTool(platformProxy),
  };
  return applyAllowTools(tools, options?.allowTools);
}
