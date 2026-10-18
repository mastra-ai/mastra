import type { MastraModelConfig } from '@mastra/core/llm';

type RawLanguageModel<T> = T extends {
  doGenerate: (...arguments_: never[]) => infer Result;
}
  ? Awaited<Result> extends { content: unknown[] }
    ? T
    : never
  : never;
type FixtureLanguageModel = RawLanguageModel<Extract<MastraModelConfig, { specificationVersion: 'v2' }>>;
type GenerateOptions = Parameters<FixtureLanguageModel['doGenerate']>[0];
type GenerateResult = Awaited<ReturnType<FixtureLanguageModel['doGenerate']>>;
type StreamResult = Awaited<ReturnType<FixtureLanguageModel['doStream']>>;

const usage = Object.freeze({ inputTokens: 0, outputTokens: 0, totalTokens: 0 });
type HumanDecision = 'APPROVE' | 'REJECT' | 'ESCALATE';

const decisionFromNoun = (value: string): HumanDecision =>
  value === 'approval' ? 'APPROVE' : value === 'rejection' ? 'REJECT' : 'ESCALATE';

const decisionFromVerb = (value: string): HumanDecision =>
  value === 'approve' ? 'APPROVE' : value === 'reject' ? 'REJECT' : 'ESCALATE';

const decisionIsNegated = (userText: string, decision: HumanDecision): boolean => {
  const [verb, noun] =
    decision === 'APPROVE'
      ? ['approve', 'approval']
      : decision === 'REJECT'
        ? ['reject', 'rejection']
        : ['escalate', 'escalation'];
  return (
    new RegExp(`\\b(?:do|does|did|must|should|can|may|will|would)\\s+not\\s+${verb}\\b`, 'u').test(userText) ||
    new RegExp(`\\b${noun}\\s+(?:must|should|can|may|will|would)\\s+not\\b|\\bno\\s+${noun}\\b`, 'u').test(userText)
  );
};

const userTextFrom = (options: GenerateOptions): string =>
  options.prompt
    .filter(message => message.role === 'user')
    .flatMap(message => message.content)
    .filter(part => part.type === 'text')
    .map(part => part.text)
    .join(' ')
    .toLowerCase();

const explicitlyAuthorizedDecision = (userText: string): HumanDecision | null => {
  if (!userText.includes('compliance review')) return null;

  const authorizationPattern =
    /\b(?:i|we)\s+explicitly\s+(?:pre-)?authoriz(?:e|ed)\s+(?:the\s+)?(approval|rejection|escalation)\b/gu;
  const authorizations = [...userText.matchAll(authorizationPattern)];
  if (authorizations.length !== 1) return null;

  const authorization = authorizations[0];
  const decision = authorization?.[1];
  if (authorization === undefined || decision === undefined) {
    return null;
  }

  const immediateTail = userText.slice(authorization.index + authorization[0].length);
  if (/^\s+(?:or|and)\s+(?:the\s+)?(?:approval|rejection|escalation)\b/u.test(immediateTail)) {
    return null;
  }

  const authorizedDecision = decisionFromNoun(decision);
  return decisionIsNegated(userText, authorizedDecision) ? null : authorizedDecision;
};

const explicitlyRequestedPendingDecision = (userText: string): HumanDecision | null => {
  const requestPattern =
    /(?:^|[.!?]\s+)(?:please\s+)?(approve|reject|escalate)\s+the\s+pending\s+compliance\s+review(?:\s+in\s+this\s+task)?(?=[.!?]|$)/gu;
  const requests = [...userText.matchAll(requestPattern)];
  const decision = requests.length === 1 ? requests[0]?.[1] : undefined;
  return decision === undefined ? null : decisionFromVerb(decision);
};

const generateFixtureResponse = (options: GenerateOptions): GenerateResult => {
  const userText = userTextFrom(options);
  const toolResultCount = options.prompt.filter(message => message.role === 'tool').length;
  const authorizedDecision = explicitlyAuthorizedDecision(userText);
  if (toolResultCount > 0) {
    const decisionTool = options.tools?.find(
      candidate => candidate.type === 'function' && candidate.name === 'decideKycReview',
    );
    if (
      toolResultCount === 1 &&
      authorizedDecision !== null &&
      userText.includes('synthetic') &&
      userText.includes('automatic') &&
      decisionTool?.type === 'function'
    ) {
      return {
        content: [
          {
            type: 'tool-call',
            toolCallId: 'fixture-preauthorized-review-tool-call-v1',
            toolName: decisionTool.name,
            input: JSON.stringify({ decision: authorizedDecision, safeNote: null }),
          },
        ],
        finishReason: 'tool-calls',
        usage,
        warnings: [],
      };
    }
    return {
      content: [
        {
          type: 'text',
          text: 'The bounded synthetic workflow advanced using the authoritative typed tool result. I did not invent evidence or choose a compliance decision.',
        },
      ],
      finishReason: 'stop',
      usage,
      warnings: [],
    };
  }

  const isSyntheticAutomaticStart = userText.includes('synthetic') && userText.includes('automatic');
  const scenarioId = !isSyntheticAutomaticStart
    ? null
    : userText.includes('missing-information') || userText.includes('missing information')
      ? 'missing-information-v1'
      : userText.includes('unreadable')
        ? 'unreadable-document-v1'
        : userText.includes('identity mismatch')
          ? 'identity-mismatch-v1'
          : userText.includes('address inconclusive')
            ? 'address-inconclusive-v1'
            : userText.includes('watchlist') || userText.includes('sanctions')
              ? 'sanctions-strong-v1'
              : userText.includes('pep')
                ? 'pep-candidate-v1'
                : userText.includes('low-risk')
                  ? 'low-risk-v1'
                  : null;
  const pendingDecision = explicitlyRequestedPendingDecision(userText);
  const requested =
    pendingDecision !== null
      ? { name: 'decideKycReview', input: { decision: pendingDecision, safeNote: null } }
      : userText.includes('list') && userText.includes('pending')
        ? { name: 'listPendingKycActions', input: {} }
        : userText.includes('provide') && userText.includes('readable')
          ? {
              name: 'submitKycInformation',
              input: {
                responseOption: 'CORRECTED_APPLICATION',
                applicationCorrections: { expirationDate: '2030-01-01' },
              },
            }
          : scenarioId !== null
            ? { name: 'startKycApplication', input: { scenarioId } }
            : null;
  const tool = options.tools?.find(candidate => candidate.type === 'function' && candidate.name === requested?.name);
  if (requested === null || tool?.type !== 'function') {
    return {
      content: [
        {
          type: 'text',
          text: 'Only the documented bundled synthetic onboarding scenarios and their pending actions are supported.',
        },
      ],
      finishReason: 'stop',
      usage,
      warnings: [],
    };
  }

  return {
    content: [
      {
        type: 'tool-call',
        toolCallId: 'fixture-low-risk-tool-call-v1',
        toolName: tool.name,
        input: JSON.stringify(requested.input),
      },
    ],
    finishReason: 'tool-calls',
    usage,
    warnings: [],
  };
};

const streamFixtureResponse = (response: GenerateResult): StreamResult => ({
  stream: new ReadableStream({
    start(controller) {
      controller.enqueue({ type: 'stream-start', warnings: [] });
      for (const content of response.content) {
        if (content.type === 'text') {
          controller.enqueue({ type: 'text-start', id: 'fixture-text-v1' });
          controller.enqueue({ type: 'text-delta', id: 'fixture-text-v1', delta: content.text });
          controller.enqueue({ type: 'text-end', id: 'fixture-text-v1' });
        } else if (content.type === 'tool-call') {
          controller.enqueue(content);
        }
      }
      controller.enqueue({
        type: 'finish',
        finishReason: response.finishReason,
        usage: response.usage,
      });
      controller.close();
    },
  }),
});

const fixtureLanguageModel = {
  specificationVersion: 'v2',
  provider: 'fixture',
  modelId: 'kyc-onboarding-fixture-v1',
  supportedUrls: {},
  doGenerate: options => Promise.resolve(generateFixtureResponse(options)),
  doStream: options => Promise.resolve(streamFixtureResponse(generateFixtureResponse(options))),
} satisfies FixtureLanguageModel;

export const fixtureKycOnboardingModel: MastraModelConfig = fixtureLanguageModel;
