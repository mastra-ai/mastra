import type { ChannelConfig, ChannelHandlers } from '@mastra/core/channels';

import type { FactoryChannelsConfig } from './integrations/base.js';

export interface ChannelsContribution {
  integrationClassName: string;
  config: FactoryChannelsConfig;
}

export const CHANNEL_CONFIG_KEYS = [
  'adapters',
  'handlers',
  'inlineMedia',
  'inlineLinks',
  'state',
  'userName',
  'threadContext',
  'tools',
  'chatOptions',
  'resolveResourceId',
  'resolveThreadId',
  'waitUntil',
  'resolveWaitUntil',
] as const satisfies readonly (keyof ChannelConfig)[];

type MissingChannelConfigKey = Exclude<keyof ChannelConfig, (typeof CHANNEL_CONFIG_KEYS)[number]>;
const channelConfigKeysAreExhaustive: MissingChannelConfigKey extends never ? true : never = true;
void channelConfigKeysAreExhaustive;

const HANDLER_KEYS = [
  'onDirectMessage',
  'onMention',
  'onSubscribedMessage',
] as const satisfies readonly (keyof ChannelHandlers)[];

type MissingHandlerKey = Exclude<keyof ChannelHandlers, (typeof HANDLER_KEYS)[number]>;
const handlerKeysAreExhaustive: MissingHandlerKey extends never ? true : never = true;
void handlerKeysAreExhaustive;

const SINGLE_WRITER_KEYS = [
  'inlineMedia',
  'inlineLinks',
  'state',
  'userName',
  'threadContext',
  'tools',
  'chatOptions',
  'resolveResourceId',
  'resolveThreadId',
  'waitUntil',
  'resolveWaitUntil',
] as const satisfies readonly Exclude<keyof ChannelConfig, 'adapters' | 'handlers'>[];

type MissingSingleWriterKey = Exclude<
  Exclude<keyof ChannelConfig, 'adapters' | 'handlers'>,
  (typeof SINGLE_WRITER_KEYS)[number]
>;
const singleWriterKeysAreExhaustive: MissingSingleWriterKey extends never ? true : never = true;
void singleWriterKeysAreExhaustive;

type SingleWriterKey = (typeof SINGLE_WRITER_KEYS)[number];

function mergeHandlerSlot<K extends keyof ChannelHandlers>(
  contributions: readonly ChannelsContribution[],
  slot: K,
): ChannelHandlers[K] {
  let owner: string | undefined;
  let merged: ChannelHandlers[K] = undefined;

  for (const contribution of contributions) {
    const value = contribution.config.handlers?.[slot];
    if (value === undefined) continue;
    if (owner !== undefined) {
      throw new Error(
        `MastraFactory: integrations [${owner}, ${contribution.integrationClassName}] both set channels handler '${slot}'; only one integration may set each handler slot.`,
      );
    }
    owner = contribution.integrationClassName;
    merged = value;
  }

  return merged;
}

function mergeSingleWriterField<K extends SingleWriterKey>(
  contributions: readonly ChannelsContribution[],
  field: K,
): FactoryChannelsConfig[K] {
  let owner: string | undefined;
  let merged: FactoryChannelsConfig[K] = undefined;

  for (const contribution of contributions) {
    const value = contribution.config[field];
    if (value === undefined) continue;
    if (owner !== undefined) {
      throw new Error(
        `MastraFactory: integrations [${owner}, ${contribution.integrationClassName}] both set channels field '${field}'; only one integration may set each top-level field.`,
      );
    }
    owner = contribution.integrationClassName;
    merged = value;
  }

  return merged;
}

export function mergeChannelsConfigs(contributions: readonly ChannelsContribution[]): FactoryChannelsConfig {
  if (contributions.length === 0) {
    throw new Error('MastraFactory: mergeChannelsConfigs received zero contributions; this is a call site bug.');
  }
  if (contributions.length === 1) return contributions[0]!.config;

  const merged: FactoryChannelsConfig = { adapters: {} };
  const adapterOwners = new Map<string, string>();

  for (const contribution of contributions) {
    for (const [platformKey, adapter] of Object.entries(contribution.config.adapters)) {
      const owner = adapterOwners.get(platformKey);
      if (owner !== undefined) {
        throw new Error(
          `MastraFactory: integrations [${owner}, ${contribution.integrationClassName}] both contribute a channel adapter under key '${platformKey}'; only one integration may own a given platform adapter.`,
        );
      }
      adapterOwners.set(platformKey, contribution.integrationClassName);
      merged.adapters[platformKey] = adapter;
    }
  }

  const handlers: ChannelHandlers = {};
  const onDirectMessage = mergeHandlerSlot(contributions, 'onDirectMessage');
  const onMention = mergeHandlerSlot(contributions, 'onMention');
  const onSubscribedMessage = mergeHandlerSlot(contributions, 'onSubscribedMessage');
  if (onDirectMessage !== undefined) handlers.onDirectMessage = onDirectMessage;
  if (onMention !== undefined) handlers.onMention = onMention;
  if (onSubscribedMessage !== undefined) handlers.onSubscribedMessage = onSubscribedMessage;
  if (Object.keys(handlers).length > 0) merged.handlers = handlers;

  const inlineMedia = mergeSingleWriterField(contributions, 'inlineMedia');
  const inlineLinks = mergeSingleWriterField(contributions, 'inlineLinks');
  const state = mergeSingleWriterField(contributions, 'state');
  const userName = mergeSingleWriterField(contributions, 'userName');
  const threadContext = mergeSingleWriterField(contributions, 'threadContext');
  const tools = mergeSingleWriterField(contributions, 'tools');
  const chatOptions = mergeSingleWriterField(contributions, 'chatOptions');
  const resolveResourceId = mergeSingleWriterField(contributions, 'resolveResourceId');
  const resolveThreadId = mergeSingleWriterField(contributions, 'resolveThreadId');
  const waitUntil = mergeSingleWriterField(contributions, 'waitUntil');
  const resolveWaitUntil = mergeSingleWriterField(contributions, 'resolveWaitUntil');

  if (inlineMedia !== undefined) merged.inlineMedia = inlineMedia;
  if (inlineLinks !== undefined) merged.inlineLinks = inlineLinks;
  if (state !== undefined) merged.state = state;
  if (userName !== undefined) merged.userName = userName;
  if (threadContext !== undefined) merged.threadContext = threadContext;
  if (tools !== undefined) merged.tools = tools;
  if (chatOptions !== undefined) merged.chatOptions = chatOptions;
  if (resolveResourceId !== undefined) merged.resolveResourceId = resolveResourceId;
  if (resolveThreadId !== undefined) merged.resolveThreadId = resolveThreadId;
  if (waitUntil !== undefined) merged.waitUntil = waitUntil;
  if (resolveWaitUntil !== undefined) merged.resolveWaitUntil = resolveWaitUntil;

  return merged;
}
