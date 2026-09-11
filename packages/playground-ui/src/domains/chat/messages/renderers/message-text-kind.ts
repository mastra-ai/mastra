import type { MessageMetadata } from '../message-metadata';

/** How a run that failed before the model wrote anything reaches the transcript. */
const ERROR_PREFIXES = ['__ERROR__:', 'Error:'];

export type MessageTextKind = 'tripwire' | 'warning' | 'error' | 'completion' | 'prose';

export function messageTextKind(text: string, metadata: MessageMetadata | undefined): MessageTextKind {
  if (metadata?.status === 'tripwire') return 'tripwire';
  if (metadata?.status === 'warning') return 'warning';
  if (metadata?.status === 'error') return 'error';
  if (metadata?.completionResult) return 'completion';

  return ERROR_PREFIXES.some(prefix => text.trim().startsWith(prefix)) ? 'error' : 'prose';
}

export function errorMessage(text: string): string {
  const trimmed = text.trim();
  const prefix = ERROR_PREFIXES.find(candidate => trimmed.startsWith(candidate));

  return prefix ? trimmed.slice(prefix.length).trim() : text;
}
