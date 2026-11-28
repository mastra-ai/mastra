import type { DynamicArgument } from '../types/dynamic-argument';

/** The persona fields a host may set on an Agent's `metadata.persona`. @experimental */
export interface AgentPersona {
  name?: string;
  role?: string;
  teamId?: string;
}

function merge(metadata: Record<string, unknown> | undefined, persona: AgentPersona): Record<string, unknown> {
  const code = metadata?.persona;
  const base = code && typeof code === 'object' && !Array.isArray(code) ? code : {};
  const set = Object.fromEntries(Object.entries(persona).filter(([, value]) => value !== undefined));
  return { ...metadata, persona: { ...base, ...set } };
}

/**
 * Overrides an Agent's `metadata.persona` field by field: a field `persona` sets wins, a field it leaves
 * unset keeps the code's value, and keys outside `persona` stay as they are. Function-form metadata is
 * wrapped so the override applies to whatever it resolves to.
 * @experimental
 */
export function mergeAgentPersona<TRequestContext extends Record<string, any> | unknown = unknown>(
  metadata: DynamicArgument<Record<string, unknown>, TRequestContext> | undefined,
  persona: AgentPersona,
): DynamicArgument<Record<string, unknown>, TRequestContext> {
  if (typeof metadata !== 'function') return merge(metadata, persona);
  return async context => merge(await metadata(context), persona);
}
