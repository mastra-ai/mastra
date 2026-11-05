import type { ChannelHandler } from '@mastra/core/channels';
import { classifyProviderError } from '@mastra/core/error';
import type { ProviderFailureKind } from '@mastra/core/error';
import { Actions, Card, CardText, LinkButton } from 'chat';
import { z } from 'zod';

import { tenantOrgId } from '../../routes/provider-credentials.js';
import type { ModelCredentialsStorage } from '../../storage/domains/credentials/base.js';
import { effectiveModelScope } from '../../storage/domains/projects/base.js';
import type { VoiceSettingsStorage } from '../../storage/domains/voice-settings/base.js';
import type { STTChoice, STTSelection, VoiceFactory } from '../../voice/transcription.js';
import {
  chooseSTTModel,
  MAX_TRANSCRIBE_AUDIO_BYTES,
  savedSTTModel,
  tenantVoiceCaller,
  transcribeAudio,
  transcriptionFailureReason,
  voicePolicy,
} from '../../voice/transcription.js';
import { voiceSettingsLink } from './channel-reply-processor.js';

type HandlerMessage = Parameters<ChannelHandler>[1];
type HandlerAttachment = HandlerMessage['attachments'][number];

/** Download plus provider call, per clip. The provider call isn't cancelled; a late result is dropped. */
export const VOICE_CLIP_TIMEOUT_MS = 60_000;

type VoiceClipFix = 'settings' | 'retry' | 'shorter' | 'rerecord' | 'none';

export interface VoiceClipFailure {
  reason: string;
  fix: VoiceClipFix;
}

export interface VoiceClipReport {
  transcribed: number;
  failures: VoiceClipFailure[];
  settingsFactoryId?: string;
}

export interface VoiceClipFactories {
  run?: () => Promise<VoiceFactory | undefined>;
  home?: () => Promise<VoiceFactory | undefined>;
}

type ClipOutcome = { transcript: string } | VoiceClipFailure;

const DOWNLOAD_FAILED: VoiceClipFailure = { reason: 'The clip could not be downloaded.', fix: 'retry' };
const TOO_LONG: VoiceClipFailure = { reason: 'The clip is too long.', fix: 'shorter' };

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

function detach(message: HandlerMessage, clip: HandlerAttachment): void {
  message.attachments = message.attachments.filter(attachment => attachment !== clip);
}

function sentence(fragment: string): string {
  return `${fragment.charAt(0).toUpperCase()}${fragment.slice(1)}.`;
}

const SETUP_FAILURES = new Set<ProviderFailureKind>(['auth', 'quota', 'model_rejected']);

function providerFailure(error: unknown): VoiceClipFailure {
  return {
    reason: sentence(transcriptionFailureReason(error)),
    fix: SETUP_FAILURES.has(classifyProviderError(error)) ? 'settings' : 'retry',
  };
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
  if (data === undefined) return DOWNLOAD_FAILED;
  const audio = data instanceof ArrayBuffer ? Buffer.from(data) : data;
  if (audio.byteLength > MAX_TRANSCRIBE_AUDIO_BYTES) return TOO_LONG;
  const transcript = await transcribeAudio(selection, audio, mimeType);
  return transcript ? { transcript } : { reason: 'No speech was detected in the clip.', fix: 'rerecord' };
}

async function withinTimeout(work: Promise<ClipOutcome>): Promise<ClipOutcome> {
  let timer: NodeJS.Timeout | undefined;
  const timedOut = new Promise<ClipOutcome>(resolve => {
    timer = setTimeout(
      () => resolve({ reason: `Transcription timed out after ${VOICE_CLIP_TIMEOUT_MS / 1000} seconds.`, fix: 'retry' }),
      VOICE_CLIP_TIMEOUT_MS,
    );
  });
  try {
    return await Promise.race([work, timedOut]);
  } finally {
    clearTimeout(timer);
  }
}

async function resolveSettingsFactory(
  run: VoiceFactory | undefined,
  home: VoiceClipFactories['home'],
): Promise<string | undefined> {
  if (run) return run.id;
  const factory = await home?.().catch((error: unknown) => {
    console.warn('[slack] voice clip settings Factory lookup failed', { error });
    return undefined;
  });
  return factory && effectiveModelScope(factory.modelScope, 'session') !== 'factory' ? factory.id : undefined;
}

async function transcribeAll(
  clips: { message: HandlerMessage; clip: HandlerAttachment }[],
  sender: { orgId?: string; userId: string },
  modelCredentials: ModelCredentialsStorage,
  voiceSettings: VoiceSettingsStorage | undefined,
  factory: VoiceFactory | undefined,
): Promise<VoiceClipFailure[]> {
  const failEvery = (failure: VoiceClipFailure) => clips.map(() => failure);
  const orgId = tenantOrgId(sender);
  let choice: STTChoice;
  try {
    const records = await modelCredentials.listCredentials(orgId, sender.userId);
    const policy = voicePolicy(tenantVoiceCaller(records, orgId, sender.userId), factory);
    const saved = voiceSettings ? await savedSTTModel(voiceSettings, policy.settingsKey) : undefined;
    choice = chooseSTTModel(policy, saved);
  } catch (error) {
    console.warn('[slack] voice clip settings lookup failed', { error });
    return failEvery({ reason: 'Speech-to-text settings could not be loaded.', fix: 'retry' });
  }
  if ('error' in choice) return failEvery({ reason: choice.error, fix: 'settings' });

  const failures: VoiceClipFailure[] = [];
  for (const { message, clip } of clips) {
    const outcome = await transcribeAttachment(choice, message, clip);
    if ('transcript' in outcome) say(message, outcome.transcript);
    else failures.push(outcome);
  }
  return failures;
}

export async function transcribeVoiceClips(
  messages: readonly HandlerMessage[],
  sender: { orgId?: string; userId: string } | undefined,
  deps: VoiceClipDeps,
  factories: VoiceClipFactories = {},
): Promise<VoiceClipReport> {
  const clips = messages.flatMap(message => voiceClips(message).map(clip => ({ message, clip })));
  if (clips.length === 0) return { transcribed: 0, failures: [] };

  if (!sender || !deps.modelCredentials) {
    for (const { message, clip } of clips) detach(message, clip);
    const failure: VoiceClipFailure = {
      reason: 'Voice clips need a linked Mastra account with a speech-to-text API key.',
      fix: 'none',
    };
    return { transcribed: 0, failures: clips.map(() => failure) };
  }

  // Routing failures stay fatal: the message must not run under the wrong Factory.
  const factory = await factories.run?.();
  const failures = await transcribeAll(clips, sender, deps.modelCredentials, deps.voiceSettings, factory);
  for (const { message, clip } of clips) detach(message, clip);
  const transcribed = clips.length - failures.length;
  if (!failures.some(failure => failure.fix === 'settings')) return { transcribed, failures };
  const settingsFactoryId = await resolveSettingsFactory(factory, factories.home);
  return settingsFactoryId ? { transcribed, failures, settingsFactoryId } : { transcribed, failures };
}

async function transcribeAttachment(
  selection: STTSelection,
  message: HandlerMessage,
  clip: HandlerAttachment,
): Promise<ClipOutcome> {
  if (!clip.fetchData) return DOWNLOAD_FAILED;
  if (clip.size !== undefined && clip.size > MAX_TRANSCRIBE_AUDIO_BYTES) return TOO_LONG;
  try {
    return await withinTimeout(transcribeClip(selection, clip.fetchData, clip.mimeType ?? 'audio/mp4'));
  } catch (error) {
    console.warn('[slack] voice clip transcription failed', { messageId: message.id, error });
    return providerFailure(error);
  }
}

function nextStep(fix: VoiceClipFix, retryHint: string): string | undefined {
  switch (fix) {
    case 'settings':
      return `Once that's fixed, ${retryHint} with the clip.`;
    case 'retry':
      return `Wait a moment, then ${retryHint} with the clip.`;
    case 'shorter':
      return 'Record a shorter clip, or type your message instead.';
    case 'rerecord':
      return 'Record the clip again.';
    case 'none':
      return undefined;
  }
}

export function voiceClipFailureCard({ failures, settingsFactoryId }: VoiceClipReport, retryHint: string) {
  const reasons = [...new Set(failures.map(failure => failure.reason))];
  const fixes = [...new Set(failures.map(failure => failure.fix))];
  const steps = fixes.flatMap(fix => nextStep(fix, retryHint) ?? []);
  const settingsUrl = fixes.includes('settings') && settingsFactoryId ? voiceSettingsLink(settingsFactoryId) : undefined;
  return Card({
    title: failures.length === 1 ? 'Voice clip not transcribed' : `${failures.length} voice clips not transcribed`,
    children: [
      CardText(reasons.join('\n')),
      ...(steps.length > 0 ? [CardText(steps.join(' '))] : []),
      ...(settingsUrl ? [Actions([LinkButton({ url: settingsUrl, label: 'Open voice settings' })])] : []),
    ],
  });
}
