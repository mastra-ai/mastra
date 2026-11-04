/**
 * Slack voice clips reach the agent as an audio attachment the model can't
 * hear. Before dispatch, each clip is transcribed with the model and key the
 * routed Factory's model scope picks for the sender (Settings → Models →
 * Voice input) and the transcript replaces the clip as the message's text, so
 * the agent answers it like a typed message.
 */

import type { Attachment, Message } from 'chat';

import { tenantOrgId } from '../../routes/provider-credentials.js';
import type { ModelCredentialsStorage } from '../../storage/domains/credentials/base.js';
import type { FactoryProjectsStorage } from '../../storage/domains/projects/base.js';
import type { VoiceSettingsStorage } from '../../storage/domains/voice-settings/base.js';
import type { VoiceFactory } from '../../voice/transcription.js';
import {
  chooseSTTModel,
  MAX_TRANSCRIBE_AUDIO_BYTES,
  tenantVoiceCaller,
  transcribeAudio,
  voicePolicy,
} from '../../voice/transcription.js';

export interface VoiceClipDeps {
  modelCredentials?: ModelCredentialsStorage;
  voiceSettings?: VoiceSettingsStorage;
  projects?: FactoryProjectsStorage;
}

async function routedFactory(
  projects: FactoryProjectsStorage | undefined,
  orgId: string,
  factoryProjectId: string | undefined,
): Promise<VoiceFactory | undefined> {
  if (!projects || !factoryProjectId) return undefined;
  const project = await projects.get({ orgId, id: factoryProjectId });
  return project ? { id: project.id, orgId: project.orgId, modelScope: project.modelScope } : undefined;
}

function isVoiceClip(attachment: Attachment): boolean {
  return attachment.type === 'audio' || (attachment.mimeType?.startsWith('audio/') ?? false);
}

function say(message: Message, text: string): void {
  message.text = message.text ? `${message.text}\n\n${text}` : text;
  message.formatted.children.push({ type: 'paragraph', children: [{ type: 'text', value: text }] });
}

function replaceWithTranscript(message: Message, clip: Attachment, transcript: string): void {
  message.attachments = message.attachments.filter(attachment => attachment !== clip);
  say(message, transcript);
}

/**
 * Replace every voice clip in `messages` (the dispatched message plus the
 * earlier ones batched into the same run) with its transcript. A clip that
 * can't be transcribed stays attached with a note saying why, so the agent can
 * tell the sender instead of guessing at an empty message. `factoryProjectId`
 * is the Factory the message routes to; its model scope decides whose model
 * and key apply. Without one, the sender's personal choice and key come first.
 */
export async function transcribeVoiceClips(
  messages: readonly Message[],
  sender: { orgId?: string; userId: string } | undefined,
  deps: VoiceClipDeps,
  factoryProjectId?: string,
): Promise<void> {
  const clips = messages.flatMap(message => message.attachments.filter(isVoiceClip).map(clip => ({ message, clip })));
  if (clips.length === 0) return;

  const note = (message: Message, reason: string) => say(message, `Voice clip not transcribed: ${reason}`);

  if (!sender || !deps.modelCredentials) {
    for (const { message } of clips)
      note(message, 'voice clips need a linked Mastra account with a speech-to-text API key');
    return;
  }

  const orgId = tenantOrgId(sender);
  const records = await deps.modelCredentials.listCredentials(orgId, sender.userId);
  const factory = await routedFactory(deps.projects, orgId, factoryProjectId);
  const caller = tenantVoiceCaller(records, orgId, sender.userId);
  const choice = await chooseSTTModel(voicePolicy(caller, factory), deps.voiceSettings);
  if ('error' in choice) {
    for (const { message } of clips) note(message, choice.error);
    return;
  }

  for (const { message, clip } of clips) {
    if (!clip.fetchData || (clip.size !== undefined && clip.size > MAX_TRANSCRIBE_AUDIO_BYTES)) {
      note(message, 'the clip is too long or could not be downloaded');
      continue;
    }
    try {
      const data = await clip.fetchData();
      const audio = data instanceof ArrayBuffer ? Buffer.from(data) : data;
      if (audio.byteLength > MAX_TRANSCRIBE_AUDIO_BYTES) {
        note(message, 'the clip is too long');
        continue;
      }
      const transcript = await transcribeAudio(choice, audio, clip.mimeType ?? 'audio/mp4');
      if (transcript) replaceWithTranscript(message, clip, transcript);
      else note(message, 'no speech was detected in the clip');
    } catch (error) {
      console.warn('[slack] voice clip transcription failed', { messageId: message.id, error });
      note(message, error instanceof Error ? error.message : String(error));
    }
  }
}
