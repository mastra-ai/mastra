import type { ToolsInput } from '@mastra/core/agent';

import type { ChannelProviderRegistration } from './providers/channel-provider.js';
import { CHANNELS as CHANNELS_LIST } from './providers/channels.js';
import { PROVIDERS as GENERATED_PROVIDERS } from './providers/index.js';
import type { ProviderToolsOptions } from './toolset.js';

interface ProviderRegistrationBase {
  /** Platform catalog id used to match project connections. */
  integrationId: string;
  /** Fallback connection-id environment variable when more than one active connection exists. */
  envVar: string;
}

/** A provider whose checked-in tools call the Platform HTTP proxy. */
export interface ProxyProviderRegistration extends ProviderRegistrationBase {
  transport?: 'proxy';
  createTools: (options?: ProviderToolsOptions) => ToolsInput;
}

/** A provider whose tools are discovered from an MCP server through Platform. */
export interface McpProviderRegistration extends ProviderRegistrationBase {
  transport: 'mcp';
}

export type ProviderRegistration = ProxyProviderRegistration | McpProviderRegistration;

/**
 * Providers with checked-in HTTP toolsets. MCP-backed providers are discovered
 * from the Platform integration catalog at runtime.
 */
export const TOOLS: readonly ProviderRegistration[] = GENERATED_PROVIDERS;

/**
 * @deprecated Use `TOOLS`. This alias is retained for one release cycle so
 * downstream consumers keep working; it will be removed in the next minor.
 */
export const PROVIDERS: readonly ProviderRegistration[] = TOOLS;

export function findRegistration(integrationId: string): ProviderRegistration | undefined {
  return TOOLS.find(p => p.integrationId === integrationId);
}

/**
 * Channel-capable providers with a hand-maintained `channels()` registration.
 * The launch ships three (Slack, Telegram, Discord); the provider generator
 * grows to cover new entries when a fourth lands.
 */
export const CHANNELS: readonly ChannelProviderRegistration[] = CHANNELS_LIST;

export function findChannelRegistration(integrationId: string): ChannelProviderRegistration | undefined {
  return CHANNELS.find(c => c.integrationId === integrationId);
}
