import type { AgentStreamsConfig } from './types';

export type AgentStreamsOption = boolean | AgentStreamsConfig;

const STREAM_KEYS = ['pubsub', 'cache', 'shouldCache', 'cleanupTimeoutMs'] as const;

/**
 * Whether a plain agent publishes its runs: on when `streams` is `true` or an
 * object, off when `false`, and otherwise only once registered on Mastra.
 */
export function areAgentStreamsEnabled(streams: AgentStreamsOption | undefined, registered: boolean): boolean {
  if (streams === undefined) return registered;
  return streams !== false;
}

/** The stream config a plain agent's bus is built from. */
export function agentStreamsConfig(streams: AgentStreamsOption | undefined): AgentStreamsConfig {
  return typeof streams === 'object' ? streams : {};
}

/**
 * Fold an agent's `streams` option into the stream keys of its `durable`
 * option. `streams` wins over the same key under `durable`. A durable agent
 * always publishes its runs, so `streams: false` only disables replay.
 */
export function mergeDurableStreamsConfig(
  durable: AgentStreamsConfig,
  streams: AgentStreamsOption | undefined,
  warn: (message: string) => void,
): AgentStreamsConfig {
  if (streams === undefined || streams === true) return durable;
  if (streams === false) {
    warn('`streams: false` on a durable agent only disables the replay cache; durable runs always publish events.');
    return { ...durable, cache: false };
  }
  const merged: AgentStreamsConfig = { ...durable };
  for (const key of STREAM_KEYS) {
    if (streams[key] === undefined) continue;
    if (durable[key] !== undefined && durable[key] !== streams[key]) {
      warn(`\`durable.${key}\` is ignored because \`streams.${key}\` is set.`);
    }
    (merged as Record<string, unknown>)[key] = streams[key];
  }
  return merged;
}
