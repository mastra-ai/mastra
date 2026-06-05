import type { UserOutcome } from './types';

/**
 * Render a structured user outcome into a compact, LLM-friendly block that can
 * be appended to a step's prompt. Returns an empty string when no outcome is
 * available so callers can unconditionally interpolate it.
 *
 * Keeping this in one place means every qualitative step (description, name,
 * instructions, ...) grounds its generation in the same outcome representation.
 */
export function formatUserOutcome(userOutcome?: UserOutcome): string {
  if (!userOutcome) {
    return '';
  }

  const lines = [
    '',
    '',
    'User outcome to satisfy:',
    `- Goal: ${userOutcome.goal}`,
    `- Audience: ${userOutcome.audience}`,
    `- Capabilities: ${userOutcome.capabilities.join(', ')}`,
    `- Tone: ${userOutcome.tone}`,
    `- Success criteria: ${userOutcome.successCriteria.join('; ')}`,
  ];
  return lines.join('\n');
}
