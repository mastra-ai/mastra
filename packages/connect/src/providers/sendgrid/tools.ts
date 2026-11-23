// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createPlatformProxy } from '../../runtime/platform-proxy.js';
import type { ProviderToolsOptions } from '../../toolset.js';
import { applyToolFilter } from '../../toolset.js';
import { activateTemplateVersionTool } from './tools/activate-template-version.js';
import { addContactsToListTool } from './tools/add-contacts-to-list.js';
import { addGlobalSuppressionsTool } from './tools/add-global-suppressions.js';
import { addGroupSuppressionsTool } from './tools/add-group-suppressions.js';
import { createCustomFieldTool } from './tools/create-custom-field.js';
import { createDynamicTemplateTool } from './tools/create-dynamic-template.js';
import { createListTool } from './tools/create-list.js';
import { createSegmentTool } from './tools/create-segment.js';
import { createSenderIdentityTool } from './tools/create-sender-identity.js';
import { createSuppressionGroupTool } from './tools/create-suppression-group.js';
import { createTemplateVersionTool } from './tools/create-template-version.js';
import { deleteBlocksTool } from './tools/delete-blocks.js';
import { deleteBouncesTool } from './tools/delete-bounces.js';
import { deleteContactsTool } from './tools/delete-contacts.js';
import { deleteCustomFieldTool } from './tools/delete-custom-field.js';
import { deleteDynamicTemplateTool } from './tools/delete-dynamic-template.js';
import { deleteGlobalSuppressionTool } from './tools/delete-global-suppression.js';
import { deleteGroupSuppressionTool } from './tools/delete-group-suppression.js';
import { deleteInvalidEmailsTool } from './tools/delete-invalid-emails.js';
import { deleteListTool } from './tools/delete-list.js';
import { deleteSegmentTool } from './tools/delete-segment.js';
import { deleteSenderIdentityTool } from './tools/delete-sender-identity.js';
import { deleteSpamReportsTool } from './tools/delete-spam-reports.js';
import { deleteSuppressionGroupTool } from './tools/delete-suppression-group.js';
import { deleteTemplateVersionTool } from './tools/delete-template-version.js';
import { getContactsCountTool } from './tools/get-contacts-count.js';
import { getDynamicTemplateTool } from './tools/get-dynamic-template.js';
import { getListTool } from './tools/get-list.js';
import { getSegmentTool } from './tools/get-segment.js';
import { getStatsTool } from './tools/get-stats.js';
import { listBlocksTool } from './tools/list-blocks.js';
import { listBouncesTool } from './tools/list-bounces.js';
import { listContactsTool } from './tools/list-contacts.js';
import { listCustomFieldsTool } from './tools/list-custom-fields.js';
import { listDynamicTemplatesTool } from './tools/list-dynamic-templates.js';
import { listGlobalSuppressionsTool } from './tools/list-global-suppressions.js';
import { listGroupSuppressionsTool } from './tools/list-group-suppressions.js';
import { listInvalidEmailsTool } from './tools/list-invalid-emails.js';
import { listListsTool } from './tools/list-lists.js';
import { listSegmentsTool } from './tools/list-segments.js';
import { listSenderIdentitiesTool } from './tools/list-sender-identities.js';
import { listSpamReportsTool } from './tools/list-spam-reports.js';
import { listSuppressionGroupsTool } from './tools/list-suppression-groups.js';
import { removeContactsFromListTool } from './tools/remove-contacts-from-list.js';
import { resendSenderVerificationTool } from './tools/resend-sender-verification.js';
import { searchContactsTool } from './tools/search-contacts.js';
import { sendMailTool } from './tools/send-mail.js';
import { updateDynamicTemplateTool } from './tools/update-dynamic-template.js';
import { updateSegmentTool } from './tools/update-segment.js';
import { updateSenderIdentityTool } from './tools/update-sender-identity.js';
import { updateSuppressionGroupTool } from './tools/update-suppression-group.js';
import { updateTemplateVersionTool } from './tools/update-template-version.js';
import { upsertContactsTool } from './tools/upsert-contacts.js';

export function createSendgridTools(options?: ProviderToolsOptions) {
  const platformProxy = createPlatformProxy({ connectionId: options?.connectionId, client: options?.client });
  const tools = {
    sendgrid_activate_template_version: activateTemplateVersionTool(platformProxy),
    sendgrid_add_contacts_to_list: addContactsToListTool(platformProxy),
    sendgrid_add_global_suppressions: addGlobalSuppressionsTool(platformProxy),
    sendgrid_add_group_suppressions: addGroupSuppressionsTool(platformProxy),
    sendgrid_create_custom_field: createCustomFieldTool(platformProxy),
    sendgrid_create_dynamic_template: createDynamicTemplateTool(platformProxy),
    sendgrid_create_list: createListTool(platformProxy),
    sendgrid_create_segment: createSegmentTool(platformProxy),
    sendgrid_create_sender_identity: createSenderIdentityTool(platformProxy),
    sendgrid_create_suppression_group: createSuppressionGroupTool(platformProxy),
    sendgrid_create_template_version: createTemplateVersionTool(platformProxy),
    sendgrid_delete_blocks: deleteBlocksTool(platformProxy),
    sendgrid_delete_bounces: deleteBouncesTool(platformProxy),
    sendgrid_delete_contacts: deleteContactsTool(platformProxy),
    sendgrid_delete_custom_field: deleteCustomFieldTool(platformProxy),
    sendgrid_delete_dynamic_template: deleteDynamicTemplateTool(platformProxy),
    sendgrid_delete_global_suppression: deleteGlobalSuppressionTool(platformProxy),
    sendgrid_delete_group_suppression: deleteGroupSuppressionTool(platformProxy),
    sendgrid_delete_invalid_emails: deleteInvalidEmailsTool(platformProxy),
    sendgrid_delete_list: deleteListTool(platformProxy),
    sendgrid_delete_segment: deleteSegmentTool(platformProxy),
    sendgrid_delete_sender_identity: deleteSenderIdentityTool(platformProxy),
    sendgrid_delete_spam_reports: deleteSpamReportsTool(platformProxy),
    sendgrid_delete_suppression_group: deleteSuppressionGroupTool(platformProxy),
    sendgrid_delete_template_version: deleteTemplateVersionTool(platformProxy),
    sendgrid_get_contacts_count: getContactsCountTool(platformProxy),
    sendgrid_get_dynamic_template: getDynamicTemplateTool(platformProxy),
    sendgrid_get_list: getListTool(platformProxy),
    sendgrid_get_segment: getSegmentTool(platformProxy),
    sendgrid_get_stats: getStatsTool(platformProxy),
    sendgrid_list_blocks: listBlocksTool(platformProxy),
    sendgrid_list_bounces: listBouncesTool(platformProxy),
    sendgrid_list_contacts: listContactsTool(platformProxy),
    sendgrid_list_custom_fields: listCustomFieldsTool(platformProxy),
    sendgrid_list_dynamic_templates: listDynamicTemplatesTool(platformProxy),
    sendgrid_list_global_suppressions: listGlobalSuppressionsTool(platformProxy),
    sendgrid_list_group_suppressions: listGroupSuppressionsTool(platformProxy),
    sendgrid_list_invalid_emails: listInvalidEmailsTool(platformProxy),
    sendgrid_list_lists: listListsTool(platformProxy),
    sendgrid_list_segments: listSegmentsTool(platformProxy),
    sendgrid_list_sender_identities: listSenderIdentitiesTool(platformProxy),
    sendgrid_list_spam_reports: listSpamReportsTool(platformProxy),
    sendgrid_list_suppression_groups: listSuppressionGroupsTool(platformProxy),
    sendgrid_remove_contacts_from_list: removeContactsFromListTool(platformProxy),
    sendgrid_resend_sender_verification: resendSenderVerificationTool(platformProxy),
    sendgrid_search_contacts: searchContactsTool(platformProxy),
    sendgrid_send_mail: sendMailTool(platformProxy),
    sendgrid_update_dynamic_template: updateDynamicTemplateTool(platformProxy),
    sendgrid_update_segment: updateSegmentTool(platformProxy),
    sendgrid_update_sender_identity: updateSenderIdentityTool(platformProxy),
    sendgrid_update_suppression_group: updateSuppressionGroupTool(platformProxy),
    sendgrid_update_template_version: updateTemplateVersionTool(platformProxy),
    sendgrid_upsert_contacts: upsertContactsTool(platformProxy),
  };
  return applyToolFilter(tools, { allowTools: options?.allowTools, disallowTools: options?.disallowTools });
}
