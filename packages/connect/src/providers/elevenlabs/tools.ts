// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createPlatformProxy } from '../../runtime/platform-proxy.js';
import type { ProviderToolsOptions } from '../../toolset.js';
import { applyToolFilter } from '../../toolset.js';
import { addPronunciationDictionaryRulesTool } from './tools/add-pronunciation-dictionary-rules.js';
import { cloneVoiceTool } from './tools/clone-voice.js';
import { composeMusicTool } from './tools/compose-music.js';
import { createAgentTool } from './tools/create-agent.js';
import { createCompositionPlanTool } from './tools/create-composition-plan.js';
import { deleteAgentTool } from './tools/delete-agent.js';
import { deleteConversationTool } from './tools/delete-conversation.js';
import { deleteDubbingProjectTool } from './tools/delete-dubbing-project.js';
import { deleteHistoryItemTool } from './tools/delete-history-item.js';
import { deleteKnowledgeBaseDocumentTool } from './tools/delete-knowledge-base-document.js';
import { deleteVoiceTool } from './tools/delete-voice.js';
import { editVoiceSettingsTool } from './tools/edit-voice-settings.js';
import { getAgentTool } from './tools/get-agent.js';
import { getConversationTool } from './tools/get-conversation.js';
import { getDefaultVoiceSettingsTool } from './tools/get-default-voice-settings.js';
import { getDubbingProjectTool } from './tools/get-dubbing-project.js';
import { getHistoryItemTool } from './tools/get-history-item.js';
import { getKnowledgeBaseDocumentTool } from './tools/get-knowledge-base-document.js';
import { getPronunciationDictionaryTool } from './tools/get-pronunciation-dictionary.js';
import { getUserSubscriptionTool } from './tools/get-user-subscription.js';
import { getUserTool } from './tools/get-user.js';
import { getVoiceSettingsTool } from './tools/get-voice-settings.js';
import { getVoiceTool } from './tools/get-voice.js';
import { listAgentsTool } from './tools/list-agents.js';
import { listConversationsTool } from './tools/list-conversations.js';
import { listDubbingProjectsTool } from './tools/list-dubbing-projects.js';
import { listHistoryTool } from './tools/list-history.js';
import { listKnowledgeBaseTool } from './tools/list-knowledge-base.js';
import { listModelsTool } from './tools/list-models.js';
import { listPronunciationDictionariesTool } from './tools/list-pronunciation-dictionaries.js';
import { listVoicesTool } from './tools/list-voices.js';
import { removePronunciationDictionaryRulesTool } from './tools/remove-pronunciation-dictionary-rules.js';
import { speechToTextTool } from './tools/speech-to-text.js';
import { textToSpeechTool } from './tools/text-to-speech.js';
import { updateAgentTool } from './tools/update-agent.js';

export function createElevenlabsTools(options?: ProviderToolsOptions) {
  const platformProxy = createPlatformProxy({ connectionId: options?.connectionId, client: options?.client });
  const tools = {
    elevenlabs_add_pronunciation_dictionary_rules: addPronunciationDictionaryRulesTool(platformProxy),
    elevenlabs_clone_voice: cloneVoiceTool(platformProxy),
    elevenlabs_compose_music: composeMusicTool(platformProxy),
    elevenlabs_create_agent: createAgentTool(platformProxy),
    elevenlabs_create_composition_plan: createCompositionPlanTool(platformProxy),
    elevenlabs_delete_agent: deleteAgentTool(platformProxy),
    elevenlabs_delete_conversation: deleteConversationTool(platformProxy),
    elevenlabs_delete_dubbing_project: deleteDubbingProjectTool(platformProxy),
    elevenlabs_delete_history_item: deleteHistoryItemTool(platformProxy),
    elevenlabs_delete_knowledge_base_document: deleteKnowledgeBaseDocumentTool(platformProxy),
    elevenlabs_delete_voice: deleteVoiceTool(platformProxy),
    elevenlabs_edit_voice_settings: editVoiceSettingsTool(platformProxy),
    elevenlabs_get_agent: getAgentTool(platformProxy),
    elevenlabs_get_conversation: getConversationTool(platformProxy),
    elevenlabs_get_default_voice_settings: getDefaultVoiceSettingsTool(platformProxy),
    elevenlabs_get_dubbing_project: getDubbingProjectTool(platformProxy),
    elevenlabs_get_history_item: getHistoryItemTool(platformProxy),
    elevenlabs_get_knowledge_base_document: getKnowledgeBaseDocumentTool(platformProxy),
    elevenlabs_get_pronunciation_dictionary: getPronunciationDictionaryTool(platformProxy),
    elevenlabs_get_user: getUserTool(platformProxy),
    elevenlabs_get_user_subscription: getUserSubscriptionTool(platformProxy),
    elevenlabs_get_voice: getVoiceTool(platformProxy),
    elevenlabs_get_voice_settings: getVoiceSettingsTool(platformProxy),
    elevenlabs_list_agents: listAgentsTool(platformProxy),
    elevenlabs_list_conversations: listConversationsTool(platformProxy),
    elevenlabs_list_dubbing_projects: listDubbingProjectsTool(platformProxy),
    elevenlabs_list_history: listHistoryTool(platformProxy),
    elevenlabs_list_knowledge_base: listKnowledgeBaseTool(platformProxy),
    elevenlabs_list_models: listModelsTool(platformProxy),
    elevenlabs_list_pronunciation_dictionaries: listPronunciationDictionariesTool(platformProxy),
    elevenlabs_list_voices: listVoicesTool(platformProxy),
    elevenlabs_remove_pronunciation_dictionary_rules: removePronunciationDictionaryRulesTool(platformProxy),
    elevenlabs_speech_to_text: speechToTextTool(platformProxy),
    elevenlabs_text_to_speech: textToSpeechTool(platformProxy),
    elevenlabs_update_agent: updateAgentTool(platformProxy),
  };
  return applyToolFilter(tools, { allowTools: options?.allowTools, disallowTools: options?.disallowTools });
}
