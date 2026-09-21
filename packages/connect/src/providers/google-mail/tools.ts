// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createPlatformProxy } from '../../runtime/platform-proxy.js';
import type { ProviderToolsOptions } from '../../toolset.js';
import { applyAllowTools } from '../../toolset.js';
import { batchDeleteMessagesTool } from './tools/batch-delete-messages.js';
import { batchModifyMessagesTool } from './tools/batch-modify-messages.js';
import { createDraftTool } from './tools/create-draft.js';
import { createFilterTool } from './tools/create-filter.js';
import { createLabelTool } from './tools/create-label.js';
import { createSendAsAliasTool } from './tools/create-send-as-alias.js';
import { deleteDraftTool } from './tools/delete-draft.js';
import { deleteFilterTool } from './tools/delete-filter.js';
import { deleteForwardingAddressTool } from './tools/delete-forwarding-address.js';
import { deleteLabelTool } from './tools/delete-label.js';
import { deleteMessageTool } from './tools/delete-message.js';
import { deleteThreadTool } from './tools/delete-thread.js';
import { getAttachmentTool } from './tools/get-attachment.js';
import { getAutoForwardingSettingsTool } from './tools/get-auto-forwarding-settings.js';
import { getDraftTool } from './tools/get-draft.js';
import { getFilterTool } from './tools/get-filter.js';
import { getForwardingAddressTool } from './tools/get-forwarding-address.js';
import { getImapSettingsTool } from './tools/get-imap-settings.js';
import { getLabelTool } from './tools/get-label.js';
import { getLanguageSettingsTool } from './tools/get-language-settings.js';
import { getMessageTool } from './tools/get-message.js';
import { getPopSettingsTool } from './tools/get-pop-settings.js';
import { getSendAsAliasTool } from './tools/get-send-as-alias.js';
import { getThreadTool } from './tools/get-thread.js';
import { getVacationSettingsTool } from './tools/get-vacation-settings.js';
import { listDraftsTool } from './tools/list-drafts.js';
import { listFiltersTool } from './tools/list-filters.js';
import { listForwardingAddressesTool } from './tools/list-forwarding-addresses.js';
import { listLabelsTool } from './tools/list-labels.js';
import { listMessagesTool } from './tools/list-messages.js';
import { listSendAsAliasesTool } from './tools/list-send-as-aliases.js';
import { listThreadsTool } from './tools/list-threads.js';
import { listWatchHistoryTool } from './tools/list-watch-history.js';
import { modifyMessageTool } from './tools/modify-message.js';
import { modifyThreadTool } from './tools/modify-thread.js';
import { sendDraftTool } from './tools/send-draft.js';
import { sendMessageTool } from './tools/send-message.js';
import { stopWatchTool } from './tools/stop-watch.js';
import { trashMessageTool } from './tools/trash-message.js';
import { trashThreadTool } from './tools/trash-thread.js';
import { untrashMessageTool } from './tools/untrash-message.js';
import { untrashThreadTool } from './tools/untrash-thread.js';
import { updateAutoForwardingSettingsTool } from './tools/update-auto-forwarding-settings.js';
import { updateDraftTool } from './tools/update-draft.js';
import { updateImapSettingsTool } from './tools/update-imap-settings.js';
import { updateLabelTool } from './tools/update-label.js';
import { updateLanguageSettingsTool } from './tools/update-language-settings.js';
import { updatePopSettingsTool } from './tools/update-pop-settings.js';
import { updateSendAsAliasTool } from './tools/update-send-as-alias.js';
import { updateSendAsSmtpMsaTool } from './tools/update-send-as-smtp-msa.js';
import { updateVacationSettingsTool } from './tools/update-vacation-settings.js';
import { watchMailboxTool } from './tools/watch-mailbox.js';

export function createGoogleMailTools(options?: ProviderToolsOptions) {
  const platformProxy = createPlatformProxy({ connectionId: options?.connectionId, client: options?.client });
  const tools = {
    google_mail_batch_delete_messages: batchDeleteMessagesTool(platformProxy),
    google_mail_batch_modify_messages: batchModifyMessagesTool(platformProxy),
    google_mail_create_draft: createDraftTool(platformProxy),
    google_mail_create_filter: createFilterTool(platformProxy),
    google_mail_create_label: createLabelTool(platformProxy),
    google_mail_create_send_as_alias: createSendAsAliasTool(platformProxy),
    google_mail_delete_draft: deleteDraftTool(platformProxy),
    google_mail_delete_filter: deleteFilterTool(platformProxy),
    google_mail_delete_forwarding_address: deleteForwardingAddressTool(platformProxy),
    google_mail_delete_label: deleteLabelTool(platformProxy),
    google_mail_delete_message: deleteMessageTool(platformProxy),
    google_mail_delete_thread: deleteThreadTool(platformProxy),
    google_mail_get_attachment: getAttachmentTool(platformProxy),
    google_mail_get_auto_forwarding_settings: getAutoForwardingSettingsTool(platformProxy),
    google_mail_get_draft: getDraftTool(platformProxy),
    google_mail_get_filter: getFilterTool(platformProxy),
    google_mail_get_forwarding_address: getForwardingAddressTool(platformProxy),
    google_mail_get_imap_settings: getImapSettingsTool(platformProxy),
    google_mail_get_label: getLabelTool(platformProxy),
    google_mail_get_language_settings: getLanguageSettingsTool(platformProxy),
    google_mail_get_message: getMessageTool(platformProxy),
    google_mail_get_pop_settings: getPopSettingsTool(platformProxy),
    google_mail_get_send_as_alias: getSendAsAliasTool(platformProxy),
    google_mail_get_thread: getThreadTool(platformProxy),
    google_mail_get_vacation_settings: getVacationSettingsTool(platformProxy),
    google_mail_list_drafts: listDraftsTool(platformProxy),
    google_mail_list_filters: listFiltersTool(platformProxy),
    google_mail_list_forwarding_addresses: listForwardingAddressesTool(platformProxy),
    google_mail_list_labels: listLabelsTool(platformProxy),
    google_mail_list_messages: listMessagesTool(platformProxy),
    google_mail_list_send_as_aliases: listSendAsAliasesTool(platformProxy),
    google_mail_list_threads: listThreadsTool(platformProxy),
    google_mail_list_watch_history: listWatchHistoryTool(platformProxy),
    google_mail_modify_message: modifyMessageTool(platformProxy),
    google_mail_modify_thread: modifyThreadTool(platformProxy),
    google_mail_send_draft: sendDraftTool(platformProxy),
    google_mail_send_message: sendMessageTool(platformProxy),
    google_mail_stop_watch: stopWatchTool(platformProxy),
    google_mail_trash_message: trashMessageTool(platformProxy),
    google_mail_trash_thread: trashThreadTool(platformProxy),
    google_mail_untrash_message: untrashMessageTool(platformProxy),
    google_mail_untrash_thread: untrashThreadTool(platformProxy),
    google_mail_update_auto_forwarding_settings: updateAutoForwardingSettingsTool(platformProxy),
    google_mail_update_draft: updateDraftTool(platformProxy),
    google_mail_update_imap_settings: updateImapSettingsTool(platformProxy),
    google_mail_update_label: updateLabelTool(platformProxy),
    google_mail_update_language_settings: updateLanguageSettingsTool(platformProxy),
    google_mail_update_pop_settings: updatePopSettingsTool(platformProxy),
    google_mail_update_send_as_alias: updateSendAsAliasTool(platformProxy),
    google_mail_update_send_as_smtp_msa: updateSendAsSmtpMsaTool(platformProxy),
    google_mail_update_vacation_settings: updateVacationSettingsTool(platformProxy),
    google_mail_watch_mailbox: watchMailboxTool(platformProxy),
  };
  return applyAllowTools(tools, options?.allowTools);
}
