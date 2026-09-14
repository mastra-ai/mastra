// AUTO-GENERATED from rhysbalevicius/integration-templates @ 2faa11af97d8 — do not edit by hand.
import { createPlatformProxy } from '../../runtime/platform-proxy.js';
import type { ProviderToolsOptions } from '../../toolset.js';
import { applyAllowTools } from '../../toolset.js';
import { addContactToSegmentTool } from './tools/add-contact-to-segment.js';
import { cancelBroadcastTool } from './tools/cancel-broadcast.js';
import { cancelEmailTool } from './tools/cancel-email.js';
import { createAudienceTool } from './tools/create-audience.js';
import { createBroadcastTool } from './tools/create-broadcast.js';
import { createContactImportTool } from './tools/create-contact-import.js';
import { createContactPropertyTool } from './tools/create-contact-property.js';
import { createContactTool } from './tools/create-contact.js';
import { createDomainClaimTool } from './tools/create-domain-claim.js';
import { createDomainTool } from './tools/create-domain.js';
import { createSegmentTool } from './tools/create-segment.js';
import { createTemplateTool } from './tools/create-template.js';
import { createTopicTool } from './tools/create-topic.js';
import { createWebhookTool } from './tools/create-webhook.js';
import { deleteAudienceTool } from './tools/delete-audience.js';
import { deleteBroadcastTool } from './tools/delete-broadcast.js';
import { deleteContactPropertyTool } from './tools/delete-contact-property.js';
import { deleteContactTool } from './tools/delete-contact.js';
import { deleteDomainTool } from './tools/delete-domain.js';
import { deleteSegmentTool } from './tools/delete-segment.js';
import { deleteTemplateTool } from './tools/delete-template.js';
import { deleteTopicTool } from './tools/delete-topic.js';
import { deleteWebhookTool } from './tools/delete-webhook.js';
import { duplicateTemplateTool } from './tools/duplicate-template.js';
import { getAudienceTool } from './tools/get-audience.js';
import { getBroadcastTool } from './tools/get-broadcast.js';
import { getContactImportTool } from './tools/get-contact-import.js';
import { getContactPropertyTool } from './tools/get-contact-property.js';
import { getContactTool } from './tools/get-contact.js';
import { getDomainClaimTool } from './tools/get-domain-claim.js';
import { getDomainTool } from './tools/get-domain.js';
import { getEmailAttachmentTool } from './tools/get-email-attachment.js';
import { getEmailMetricsTool } from './tools/get-email-metrics.js';
import { getEmailTool } from './tools/get-email.js';
import { getReceivedEmailAttachmentTool } from './tools/get-received-email-attachment.js';
import { getReceivedEmailTool } from './tools/get-received-email.js';
import { getSegmentTool } from './tools/get-segment.js';
import { getTemplateTool } from './tools/get-template.js';
import { getTopicTool } from './tools/get-topic.js';
import { getWebhookEventTool } from './tools/get-webhook-event.js';
import { getWebhookTool } from './tools/get-webhook.js';
import { listAudiencesTool } from './tools/list-audiences.js';
import { listBroadcastClickedLinksTool } from './tools/list-broadcast-clicked-links.js';
import { listBroadcastRecipientsTool } from './tools/list-broadcast-recipients.js';
import { listBroadcastsTool } from './tools/list-broadcasts.js';
import { listContactImportsTool } from './tools/list-contact-imports.js';
import { listContactPropertiesTool } from './tools/list-contact-properties.js';
import { listContactSegmentsTool } from './tools/list-contact-segments.js';
import { listContactTopicsTool } from './tools/list-contact-topics.js';
import { listContactsTool } from './tools/list-contacts.js';
import { listDomainsTool } from './tools/list-domains.js';
import { listEmailAttachmentsTool } from './tools/list-email-attachments.js';
import { listEmailsTool } from './tools/list-emails.js';
import { listReceivedEmailAttachmentsTool } from './tools/list-received-email-attachments.js';
import { listReceivedEmailsTool } from './tools/list-received-emails.js';
import { listSegmentsTool } from './tools/list-segments.js';
import { listTemplatesTool } from './tools/list-templates.js';
import { listTopicsTool } from './tools/list-topics.js';
import { listWebhookEventAttemptsTool } from './tools/list-webhook-event-attempts.js';
import { listWebhookEventsTool } from './tools/list-webhook-events.js';
import { listWebhooksTool } from './tools/list-webhooks.js';
import { publishTemplateTool } from './tools/publish-template.js';
import { removeContactFromSegmentTool } from './tools/remove-contact-from-segment.js';
import { replayWebhookEventTool } from './tools/replay-webhook-event.js';
import { sendBroadcastTool } from './tools/send-broadcast.js';
import { sendEmailBatchTool } from './tools/send-email-batch.js';
import { sendEmailTool } from './tools/send-email.js';
import { shareEmailTool } from './tools/share-email.js';
import { updateBroadcastTool } from './tools/update-broadcast.js';
import { updateContactPropertyTool } from './tools/update-contact-property.js';
import { updateContactTopicsTool } from './tools/update-contact-topics.js';
import { updateContactTool } from './tools/update-contact.js';
import { updateDomainTool } from './tools/update-domain.js';
import { updateEmailTool } from './tools/update-email.js';
import { updateSegmentTool } from './tools/update-segment.js';
import { updateTemplateTool } from './tools/update-template.js';
import { updateTopicTool } from './tools/update-topic.js';
import { updateWebhookTool } from './tools/update-webhook.js';
import { verifyDomainClaimTool } from './tools/verify-domain-claim.js';
import { verifyDomainTool } from './tools/verify-domain.js';

export function createResendTools(options?: ProviderToolsOptions) {
  const platformProxy = createPlatformProxy({ connectionId: options?.connectionId, client: options?.client });
  const tools = {
    resend_add_contact_to_segment: addContactToSegmentTool(platformProxy),
    resend_cancel_broadcast: cancelBroadcastTool(platformProxy),
    resend_cancel_email: cancelEmailTool(platformProxy),
    resend_create_audience: createAudienceTool(platformProxy),
    resend_create_broadcast: createBroadcastTool(platformProxy),
    resend_create_contact_import: createContactImportTool(platformProxy),
    resend_create_contact_property: createContactPropertyTool(platformProxy),
    resend_create_contact: createContactTool(platformProxy),
    resend_create_domain_claim: createDomainClaimTool(platformProxy),
    resend_create_domain: createDomainTool(platformProxy),
    resend_create_segment: createSegmentTool(platformProxy),
    resend_create_template: createTemplateTool(platformProxy),
    resend_create_topic: createTopicTool(platformProxy),
    resend_create_webhook: createWebhookTool(platformProxy),
    resend_delete_audience: deleteAudienceTool(platformProxy),
    resend_delete_broadcast: deleteBroadcastTool(platformProxy),
    resend_delete_contact_property: deleteContactPropertyTool(platformProxy),
    resend_delete_contact: deleteContactTool(platformProxy),
    resend_delete_domain: deleteDomainTool(platformProxy),
    resend_delete_segment: deleteSegmentTool(platformProxy),
    resend_delete_template: deleteTemplateTool(platformProxy),
    resend_delete_topic: deleteTopicTool(platformProxy),
    resend_delete_webhook: deleteWebhookTool(platformProxy),
    resend_duplicate_template: duplicateTemplateTool(platformProxy),
    resend_get_audience: getAudienceTool(platformProxy),
    resend_get_broadcast: getBroadcastTool(platformProxy),
    resend_get_contact_import: getContactImportTool(platformProxy),
    resend_get_contact_property: getContactPropertyTool(platformProxy),
    resend_get_contact: getContactTool(platformProxy),
    resend_get_domain_claim: getDomainClaimTool(platformProxy),
    resend_get_domain: getDomainTool(platformProxy),
    resend_get_email_attachment: getEmailAttachmentTool(platformProxy),
    resend_get_email_metrics: getEmailMetricsTool(platformProxy),
    resend_get_email: getEmailTool(platformProxy),
    resend_get_received_email_attachment: getReceivedEmailAttachmentTool(platformProxy),
    resend_get_received_email: getReceivedEmailTool(platformProxy),
    resend_get_segment: getSegmentTool(platformProxy),
    resend_get_template: getTemplateTool(platformProxy),
    resend_get_topic: getTopicTool(platformProxy),
    resend_get_webhook_event: getWebhookEventTool(platformProxy),
    resend_get_webhook: getWebhookTool(platformProxy),
    resend_list_audiences: listAudiencesTool(platformProxy),
    resend_list_broadcast_clicked_links: listBroadcastClickedLinksTool(platformProxy),
    resend_list_broadcast_recipients: listBroadcastRecipientsTool(platformProxy),
    resend_list_broadcasts: listBroadcastsTool(platformProxy),
    resend_list_contact_imports: listContactImportsTool(platformProxy),
    resend_list_contact_properties: listContactPropertiesTool(platformProxy),
    resend_list_contact_segments: listContactSegmentsTool(platformProxy),
    resend_list_contact_topics: listContactTopicsTool(platformProxy),
    resend_list_contacts: listContactsTool(platformProxy),
    resend_list_domains: listDomainsTool(platformProxy),
    resend_list_email_attachments: listEmailAttachmentsTool(platformProxy),
    resend_list_emails: listEmailsTool(platformProxy),
    resend_list_received_email_attachments: listReceivedEmailAttachmentsTool(platformProxy),
    resend_list_received_emails: listReceivedEmailsTool(platformProxy),
    resend_list_segments: listSegmentsTool(platformProxy),
    resend_list_templates: listTemplatesTool(platformProxy),
    resend_list_topics: listTopicsTool(platformProxy),
    resend_list_webhook_event_attempts: listWebhookEventAttemptsTool(platformProxy),
    resend_list_webhook_events: listWebhookEventsTool(platformProxy),
    resend_list_webhooks: listWebhooksTool(platformProxy),
    resend_publish_template: publishTemplateTool(platformProxy),
    resend_remove_contact_from_segment: removeContactFromSegmentTool(platformProxy),
    resend_replay_webhook_event: replayWebhookEventTool(platformProxy),
    resend_send_broadcast: sendBroadcastTool(platformProxy),
    resend_send_email_batch: sendEmailBatchTool(platformProxy),
    resend_send_email: sendEmailTool(platformProxy),
    resend_share_email: shareEmailTool(platformProxy),
    resend_update_broadcast: updateBroadcastTool(platformProxy),
    resend_update_contact_property: updateContactPropertyTool(platformProxy),
    resend_update_contact_topics: updateContactTopicsTool(platformProxy),
    resend_update_contact: updateContactTool(platformProxy),
    resend_update_domain: updateDomainTool(platformProxy),
    resend_update_email: updateEmailTool(platformProxy),
    resend_update_segment: updateSegmentTool(platformProxy),
    resend_update_template: updateTemplateTool(platformProxy),
    resend_update_topic: updateTopicTool(platformProxy),
    resend_update_webhook: updateWebhookTool(platformProxy),
    resend_verify_domain_claim: verifyDomainClaimTool(platformProxy),
    resend_verify_domain: verifyDomainTool(platformProxy),
  };
  return applyAllowTools(tools, options?.allowTools);
}
