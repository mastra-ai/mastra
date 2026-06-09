const toolCall = (toolCallId: string, toolName: string, input: Record<string, unknown>) => [
  { type: 'tool-input-start', id: toolCallId, toolName },
  { type: 'tool-input-delta', id: toolCallId, delta: JSON.stringify(input) },
  { type: 'tool-input-end', id: toolCallId },
  { type: 'tool-call', toolCallId, toolName, input: JSON.stringify(input), providerMetadata: {} },
];

const toolCallTurn = (calls: Array<[string, string, Record<string, unknown>]>) => [
  { type: 'stream-start', warnings: [] },
  {
    type: 'response-metadata',
    id: 'agent-builder-tool-turn',
    modelId: 'agent-builder-fixture',
    timestamp: new Date(0),
  },
  ...calls.flatMap(([toolCallId, toolName, input]) => toolCall(toolCallId, toolName, input)),
  {
    type: 'finish',
    finishReason: 'tool-calls',
    usage: { inputTokens: 1000, outputTokens: 100, totalTokens: 1100, reasoningTokens: 0, cachedInputTokens: 0 },
  },
];

const stopTurn = (text: string) => [
  { type: 'stream-start', warnings: [] },
  {
    type: 'response-metadata',
    id: 'agent-builder-stop-turn',
    modelId: 'agent-builder-fixture',
    timestamp: new Date(0),
  },
  { type: 'text-start', id: 'done-text' },
  { type: 'text-delta', id: 'done-text', delta: text },
  { type: 'text-end', id: 'done-text' },
  {
    type: 'finish',
    finishReason: 'stop',
    usage: { inputTokens: 1200, outputTokens: 50, totalTokens: 1250, reasoningTokens: 0, cachedInputTokens: 512 },
  },
];

const conciseInstructions = (name: string, focus: string) =>
  `${name} helps users by ${focus}. Follow the user's requested workflow, identify missing details, and produce a concise final answer. Use available tools only when they are directly relevant. If a requested capability is unavailable, explain the limitation and provide the best manual next step. Complete the task when the user has a clear recommendation, draft, or summary they can act on.`;

export const agentBuilderSupportFixture = [
  toolCallTurn([
    ['support-name', 'set-agent-name', { name: 'Email Support Triager' }],
    [
      'support-description',
      'set-agent-description',
      {
        description:
          'Triages inbound customer support emails by urgency and team, then drafts a polite first response requesting any missing details.',
      },
    ],
    [
      'support-instructions',
      'set-agent-instructions',
      {
        instructions: conciseInstructions(
          'Email Support Triager',
          'classifying support emails by urgency, routing them, and drafting first replies',
        ),
      },
    ],
  ]),
  stopTurn('Done — I configured Email Support Triager.'),
];

export const agentBuilderStandupFixture = [
  toolCallTurn([
    ['standup-name', 'set-agent-name', { name: 'Async Standup Coordinator' }],
    [
      'standup-description',
      'set-agent-description',
      { description: 'Collects daily standup updates and posts a concise summary for the team.' },
    ],
    [
      'standup-instructions',
      'set-agent-instructions',
      {
        instructions: conciseInstructions(
          'Async Standup Coordinator',
          'collecting yesterday/today/blocker updates and summarizing them for a team channel',
        ),
      },
    ],
  ]),
  stopTurn('Done — I configured Async Standup Coordinator.'),
];

export const agentBuilderPrReviewerFixture = [
  toolCallTurn([
    ['pr-name', 'set-agent-name', { name: 'TypeScript PR Reviewer' }],
    [
      'pr-description',
      'set-agent-description',
      { description: 'Reviews TypeScript pull requests for correctness, risk, and test coverage.' },
    ],
    [
      'pr-instructions',
      'set-agent-instructions',
      {
        instructions: conciseInstructions(
          'TypeScript PR Reviewer',
          'reviewing pull requests for behavior changes, bugs, tests, and maintainability risks',
        ),
      },
    ],
  ]),
  stopTurn('Done — I configured TypeScript PR Reviewer.'),
];

export const agentBuilderOnboardingFixture = [
  toolCallTurn([
    ['onboarding-name', 'set-agent-name', { name: 'Codebase Onboarding Guide' }],
    [
      'onboarding-description',
      'set-agent-description',
      { description: 'Guides new engineers through a codebase with focused explanations and next steps.' },
    ],
    [
      'onboarding-instructions',
      'set-agent-instructions',
      {
        instructions: conciseInstructions(
          'Codebase Onboarding Guide',
          'explaining codebase structure, important files, and safe first tasks for new engineers',
        ),
      },
    ],
  ]),
  stopTurn('Done — I configured Codebase Onboarding Guide.'),
];

export const agentBuilderComplexFixture = [
  toolCallTurn([
    ['complex-name', 'set-agent-name', { name: 'Vuln Triage Sentinel' }],
    [
      'complex-description',
      'set-agent-description',
      {
        description:
          'Triage security reports by severity, exploitability, customer impact, and required escalation path.',
      },
    ],
    [
      'complex-instructions',
      'set-agent-instructions',
      {
        instructions: conciseInstructions(
          'Vuln Triage Sentinel',
          'prioritizing vulnerability reports, asking for missing evidence, and preparing escalation-ready summaries',
        ),
      },
    ],
  ]),
  stopTurn('Done — I configured Vuln Triage Sentinel.'),
];
