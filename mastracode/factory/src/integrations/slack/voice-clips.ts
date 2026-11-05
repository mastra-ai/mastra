import type { ChannelHandler } from '@mastra/core/channels';
import { classifyProviderError } from '@mastra/core/error';
import type { ProviderFailureKind } from '@mastra/core/error';
import { z } from 'zod';

import { tenantOrgId } from '../../routes/provider-credentials.js';
import type { ModelCredentialsStorage } from '../../storage/domains/credentials/base.js';
import type { VoiceSettingsStorage } from '../../storage/domains/voice-settings/base.js';
import type { STTChoice, STTSelection, VoiceFactory } from '../../voice/transcription.js';
import {
  chooseSTTModel,
  MAX_TRANSCRIBE_AUDIO_BYTES,
  savedSTTModel,
  tenantVoiceCaller,
  transcribeAudio,
  voicePolicy,
} from '../../voice/transcription.js';

type HandlerMessage = Parameters<ChannelHandler>[1];
type HandlerAttachment = HandlerMessage['attachments'][number];

/** Download plus provider call, per clip. The provider call isn't cancelled; a late result is dropped. */
export const VOICE_CLIP_TIMEOUT_MS = 60_000;

type ClipOutcome = { transcript: string } | { problem: string };

export interface VoiceClipDeps {
  modelCredentials?: ModelCredentialsStorage;
  voiceSettings?: VoiceSettingsStorage;
}

const slackEventFiles = z.object({
  files: z.array(z.object({ subtype: z.string().optional(), url_private: z.string().optional() })),
});

/** Slack marks composer recordings with `subtype: 'slack_audio'` and names them `audio_message.*`; other audio is an upload. */
function recordedClipUrls(message: HandlerMessage): Set<string> {
  const event = slackEventFiles.safeParse(message.raw);
  if (!event.success) return new Set();
  return new Set(
    event.data.files.flatMap(file => (file.subtype === 'slack_audio' && file.url_private ? [file.url_private] : [])),
  );
}

function voiceClips(message: HandlerMessage): HandlerAttachment[] {
  const recorded = recordedClipUrls(message);
  return message.attachments.filter(
    attachment =>
      (attachment.url !== undefined && recorded.has(attachment.url)) ||
      ((attachment.type === 'audio' || attachment.type === 'video') &&
        (attachment.name?.startsWith('audio_message') ?? false)),
  );
}

function say(message: HandlerMessage, text: string): void {
  message.text = message.text ? `${message.text}\n\n${text}` : text;
  message.formatted.children.push({ type: 'paragraph', children: [{ type: 'text', value: text }] });
}

function note(message: HandlerMessage, clip: HandlerAttachment, reason: string): void {
  say(message, `Voice clip${clip.name ? ` "${clip.name}"` : ''} not transcribed: ${reason}`);
}

const PROVIDER_FAILURES: Partial<Record<ProviderFailureKind, string>> = {
  auth: 'the speech-to-text provider rejected the API key',
  quota: 'the speech-to-text provider account is out of credit',
  rate_limited: 'the speech-to-text provider is rate limiting requests, try again shortly',
  timeout: 'speech-to-text timed out',
  unavailable: 'the speech-to-text provider is unavailable, try again shortly',
};

/** Slack threads can include guests, so raw provider text (bodies, key fragments) stays in the server log. */
function failureReason(error: unknown): string {
  return PROVIDER_FAILURES[classifyProviderError(error)] ?? 'the speech-to-text provider returned an error';
}

function replaceWithTranscript(message: HandlerMessage, clip: HandlerAttachment, transcript: string): void {
  message.attachments = message.attachments.filter(attachment => attachment !== clip);
  say(message, transcript);
}

async function transcribeClip(
  selection: STTSelection,
  fetchData: () => Promise<Buffer | ArrayBuffer>,
  mimeType: string,
): Promise<ClipOutcome> {
  const data = await fetchData().catch((error: unknown) => {
    console.warn('[slack] voice clip download failed', { error });
    return undefined;
  });
  if (data === undefined) return { problem: 'the clip could not be downloaded' };
  const audio = data instanceof ArrayBuffer ? Buffer.from(data) : data;
  if (audio.byteLength > MAX_TRANSCRIBE_AUDIO_BYTES) return { problem: 'the clip is too long' };
  const transcript = await transcribeAudio(selection, audio, mimeType);
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
  messages: readonly HandlerMessage[],
  sender: { orgId?: string; userId: string } | undefined,
  deps: VoiceClipDeps,
  runFactory?: () => Promise<VoiceFactory | undefined>,
): Promise<void> {
  const clips = messages.flatMap(message => voiceClips(message).map(clip => ({ message, clip })));
  if (clips.length === 0) return;

  if (!sender || !deps.modelCredentials) {
    for (const { message, clip } of clips)
      note(message, clip, 'voice clips need a linked Mastra account with a speech-to-text API key');
    return;
  }

  // Routing failures stay fatal: the message must not run under the wrong Factory.
  const factory = await runFactory?.();
  const orgId = tenantOrgId(sender);
  let choice: STTChoice;
  try {
    const records = await deps.modelCredentials.listCredentials(orgId, sender.userId);
    const policy = voicePolicy(tenantVoiceCaller(records, orgId, sender.userId), factory);
    const saved = deps.voiceSettings ? await savedSTTModel(deps.voiceSettings, policy.settingsKey) : undefined;
    choice = chooseSTTModel(policy, saved);
  } catch (error) {
    console.warn('[slack] voice clip settings lookup failed', { error });
    choice = { error: 'speech-to-text settings could not be loaded, try again shortly' };
  }
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
      note(message, clip, failureReason(error));
    }
  }
}
