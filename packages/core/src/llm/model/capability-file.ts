import type { ModelReasoningOption } from './gateways/base.js';

export interface ProviderCapabilityFile {
  attachment?: string[];
  temperature?: string[];
  structuredOutput?: string[];
  reasoning?: Record<string, ModelReasoningOption[]>;
}

export function getCapabilityFileName(provider: string): string {
  return `${encodeURIComponent(provider)}.json`;
}
