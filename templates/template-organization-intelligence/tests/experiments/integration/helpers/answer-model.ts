import { fixedLanguageModel } from '../../../fixtures/model.js';

function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (typeof value === 'object' && value) return Object.values(value).flatMap(strings);
  return [];
}

export function answerModel(
  options: {
    error?: Error | (() => Error);
    invalidFor?: string;
    onCall?: (call: { abortSignal?: AbortSignal; maxOutputTokens?: number; prompt: string }) => void;
    waitForAbort?: boolean;
  } = {},
) {
  return fixedLanguageModel('', {
    error: options.error,
    onCall: call => {
      options.onCall?.({
        abortSignal: call.abortSignal,
        maxOutputTokens: call.maxOutputTokens,
        prompt: strings(call.prompt).join('\n'),
      });
    },
    waitForAbort: options.waitForAbort,
    textForCall: call => {
      const prompt = strings(call.prompt).join('\n');
      if (options.invalidFor && prompt.includes(options.invalidFor))
        return JSON.stringify({ status: 'draft', answer: 'unsafe unpublished draft', citations: [] });
      const payload = JSON.parse(prompt.split('\n').find(line => line.includes('"evidence"')) ?? '{}') as {
        evidence?: Array<{ recordId: string; locator: string; excerpt: string }>;
      };
      const evidence = payload.evidence ?? [];
      const status = prompt.includes('What is the unrecorded')
        ? 'insufficient_evidence'
        : prompt.includes('What do conflicting')
          ? 'conflicting_evidence'
          : 'answered';
      return JSON.stringify({
        status,
        answer:
          status === 'insufficient_evidence'
            ? 'The records do not establish this.'
            : status === 'conflicting_evidence'
              ? 'The retrieved records conflict and do not establish one rule.'
              : prompt.includes('Read the malicious')
                ? 'The document instruction does not authorize an action.'
                : (evidence[0]?.excerpt ?? 'The records do not establish this.'),
        citations:
          status === 'insufficient_evidence'
            ? []
            : evidence.slice(0, status === 'conflicting_evidence' ? 2 : 1).map(hit => ({
                recordId: hit.recordId,
                locator: hit.locator,
              })),
      });
    },
  });
}
