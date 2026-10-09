// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createPlatformProxy } from '../../runtime/platform-proxy.js';
import type { ProviderToolsOptions } from '../../toolset.js';
import { applyToolFilter } from '../../toolset.js';
import { addToLiveTool } from './tools/add-to-live.js';
import { continueAskfredThreadTool } from './tools/continue-askfred-thread.js';
import { createAskfredThreadTool } from './tools/create-askfred-thread.js';
import { createBiteTool } from './tools/create-bite.js';
import { createLiveActionItemTool } from './tools/create-live-action-item.js';
import { createLiveSoundbiteTool } from './tools/create-live-soundbite.js';
import { deleteAskfredThreadTool } from './tools/delete-askfred-thread.js';
import { deleteTranscriptTool } from './tools/delete-transcript.js';
import { getAnalyticsTool } from './tools/get-analytics.js';
import { getAskfredThreadTool } from './tools/get-askfred-thread.js';
import { getBiteTool } from './tools/get-bite.js';
import { getChannelTool } from './tools/get-channel.js';
import { getTranscriptTool } from './tools/get-transcript.js';
import { getUserTool } from './tools/get-user.js';
import { listActiveMeetingsTool } from './tools/list-active-meetings.js';
import { listAskfredThreadsTool } from './tools/list-askfred-threads.js';
import { listBitesTool } from './tools/list-bites.js';
import { listContactsTool } from './tools/list-contacts.js';
import { listTranscriptsTool } from './tools/list-transcripts.js';
import { listUserGroupsTool } from './tools/list-user-groups.js';
import { listUsersTool } from './tools/list-users.js';
import { revokeSharedMeetingAccessTool } from './tools/revoke-shared-meeting-access.js';
import { shareMeetingTool } from './tools/share-meeting.js';
import { updateMeetingChannelTool } from './tools/update-meeting-channel.js';
import { updateMeetingPrivacyTool } from './tools/update-meeting-privacy.js';
import { updateMeetingStateTool } from './tools/update-meeting-state.js';
import { uploadAudioTool } from './tools/upload-audio.js';

export function createFirefliesTools(options?: ProviderToolsOptions) {
  const platformProxy = createPlatformProxy({ connectionId: options?.connectionId, client: options?.client });
  const tools = {
    fireflies_add_to_live: addToLiveTool(platformProxy),
    fireflies_continue_askfred_thread: continueAskfredThreadTool(platformProxy),
    fireflies_create_askfred_thread: createAskfredThreadTool(platformProxy),
    fireflies_create_bite: createBiteTool(platformProxy),
    fireflies_create_live_action_item: createLiveActionItemTool(platformProxy),
    fireflies_create_live_soundbite: createLiveSoundbiteTool(platformProxy),
    fireflies_delete_askfred_thread: deleteAskfredThreadTool(platformProxy),
    fireflies_delete_transcript: deleteTranscriptTool(platformProxy),
    fireflies_get_analytics: getAnalyticsTool(platformProxy),
    fireflies_get_askfred_thread: getAskfredThreadTool(platformProxy),
    fireflies_get_bite: getBiteTool(platformProxy),
    fireflies_get_channel: getChannelTool(platformProxy),
    fireflies_get_transcript: getTranscriptTool(platformProxy),
    fireflies_get_user: getUserTool(platformProxy),
    fireflies_list_active_meetings: listActiveMeetingsTool(platformProxy),
    fireflies_list_askfred_threads: listAskfredThreadsTool(platformProxy),
    fireflies_list_bites: listBitesTool(platformProxy),
    fireflies_list_contacts: listContactsTool(platformProxy),
    fireflies_list_transcripts: listTranscriptsTool(platformProxy),
    fireflies_list_user_groups: listUserGroupsTool(platformProxy),
    fireflies_list_users: listUsersTool(platformProxy),
    fireflies_revoke_shared_meeting_access: revokeSharedMeetingAccessTool(platformProxy),
    fireflies_share_meeting: shareMeetingTool(platformProxy),
    fireflies_update_meeting_channel: updateMeetingChannelTool(platformProxy),
    fireflies_update_meeting_privacy: updateMeetingPrivacyTool(platformProxy),
    fireflies_update_meeting_state: updateMeetingStateTool(platformProxy),
    fireflies_upload_audio: uploadAudioTool(platformProxy),
  };
  return applyToolFilter(tools, { allowTools: options?.allowTools, disallowTools: options?.disallowTools });
}
