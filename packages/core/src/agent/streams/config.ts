import type { AgentDurableOption } from '../types';
import type { AgentStreamsConfig } from './types';

/** Whether a plain agent publishes its runs on a resumable stream. */
export function areAgentStreamsEnabled(durable: AgentDurableOption | undefined, registered: boolean): boolean {
  if (durable === undefined) return registered;
  return durable !== false;
}

/** The stream configuration for a plain agent's bus. */
export function agentStreamsConfig(durable: AgentDurableOption | undefined): AgentStreamsConfig {
  return typeof durable === 'object' ? durable : {};
}
