import type { Attachment, Message } from 'chat';

import { tenantOrgId } from '../../routes/provider-credentials.js';
import type { ModelCredentialsStorage } from '../../storage/domains/credentials/base.js';
import type { FactoryProjectsStorage } from '../../storage/domains/projects/base.js';
import type { VoiceSettingsStorage } from '../../storage/domains/voice-settings/base.js';
import type { STTChoice, VoiceFactory } from '../../voice/transcription.js';
import {
  chooseSTTModel,
  MAX_TRANSCRIBE_AUDIO_BYTES,
  tenantVoiceCaller,
  transcribeAudio,
  voicePolicy,
} from '../../voice/transcription.js';

/** Download plus provider call, per clip. */
export const VOICE_CLIP_TIMEOUT_MS = 60_000;

export interface VoiceClipDeps {
  modelCredentials?: ModelCredentialsStorage;
  voiceSettings?: VoiceSettingsStorage;
  /**
   * Factory projects domain. When provided (alongside `accountLinks`), a
   * linked sender's run must also resolve to a Factory project before it
   * dispatches: their link's default factory, else their tenant's only
   * factory (stamped back onto the link), else a "pick a default factory"
   * card posted in the thread and no run. Unset → no factory routing (runs
   * dispatch as before). The run's Factory also decides whose model and key
   * transcribe a voice clip.
   */
  projects?: FactoryProjectsStorage;
}

async function runFactory(
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

function note(message: Message, clip: Attachment, reason: string): void {
  say(message, `Voice clip${clip.name ? ` "${clip.name}"` : ''} not transcribed: ${reason}`);
}

function replaceWithTranscript(message: Message, clip: Attachment, transcript: string): void {
  message.attachments = message.attachments.filter(attachment => attachment !== clip);
  say(message, transcript);
}

type ClipOutcome = { transcript: string } | { problem: string };

async function transcribeClip(
  choice: Extract<STTChoice, { entry: unknown }>,
  fetchData: () => Promise<Buffer | ArrayBuffer>,
  mimeType: string,
): Promise<ClipOutcome> {
  const data = await fetchData();
  const audio = data instanceof ArrayBuffer ? Buffer.from(data) : data;
  if (audio.byteLength > MAX_TRANSCRIBE_AUDIO_BYTES) return { problem: 'the clip is too long' };
  const transcript = await transcribeAudio(choice, audio, mimeType);
  return transcript ? { transcript } : { problem: 'no speech was detected in the clip' };
}

async function withinTimeout(work: Promise<ClipOutcome>): Promise<ClipOutcome> {
  let timer: NodeJS.Timeout | undefined;
  const timedOut = new Promise<ClipOutcome>(resolve => {
    timer = setTimeout(
      () => resolve({ problem: `transcription timed out after ${VOICE_CLIP_TIMEOUT_MS / 1000} seconds` }),
      VOICE_CLIP_TIMEOUT_MS,
    );
  });
  try {
    return await Promise.race([work, timedOut]);
  } finally {
    clearTimeout(timer);
  }
}

export async function transcribeVoiceClips(
  messages: readonly Message[],
  sender: { orgId?: string; userId: string } | undefined,
  deps: VoiceClipDeps,
  factoryProjectId?: string,
): Promise<void> {
  const clips = messages.flatMap(message => message.attachments.filter(isVoiceClip).map(clip => ({ message, clip })));
  if (clips.length === 0) return;

  if (!sender || !deps.modelCredentials) {
    for (const { message, clip } of clips)
      note(message, clip, 'voice clips need a linked Mastra account with a speech-to-text API key');
    return;
  }

  const orgId = tenantOrgId(sender);
  const records = await deps.modelCredentials.listCredentials(orgId, sender.userId);
  const factory = await runFactory(deps.projects, orgId, factoryProjectId);
  const caller = tenantVoiceCaller(records, orgId, sender.userId);
  const choice = await chooseSTTModel(voicePolicy(caller, factory), deps.voiceSettings);
  if ('error' in choice) {
    for (const { message, clip } of clips) note(message, clip, choice.error);
    return;
  }

  for (const { message, clip } of clips) {
    if (!clip.fetchData) {
      note(message, clip, 'the clip could not be downloaded');
      continue;
    }
    if (clip.size !== undefined && clip.size > MAX_TRANSCRIBE_AUDIO_BYTES) {
      note(message, clip, 'the clip is too long');
      continue;
    }
    try {
      const outcome = await withinTimeout(transcribeClip(choice, clip.fetchData, clip.mimeType ?? 'audio/mp4'));
      if ('transcript' in outcome) replaceWithTranscript(message, clip, outcome.transcript);
      else note(message, clip, outcome.problem);
    } catch (error) {
      console.warn('[slack] voice clip transcription failed', { messageId: message.id, error });
      note(message, clip, error instanceof Error ? error.message : String(error));
    }
  }
}
