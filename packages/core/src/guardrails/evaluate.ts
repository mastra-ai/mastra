import { MessageList } from '../agent/message-list';
import { TripWire } from '../agent/trip-wire';
import type { IMastraLogger } from '../logger';
import type { MastraDBMessage } from '../memory';
import { ProcessorRunner } from '../processors/runner';
import { compileGuardrails } from './compile';
import type {
  GuardrailAction,
  GuardrailGroupName,
  GuardrailPhase,
  GuardrailPolicyDefinition,
  GuardrailsConfig,
} from './types';

export interface GuardrailEvaluationViolation {
  policyName?: string;
  group?: GuardrailGroupName;
  phase?: GuardrailPhase;
  check: string;
  action: GuardrailAction;
  processorId?: string;
  message: string;
  detail?: unknown;
}

export interface GuardrailEvaluationSkippedCheck {
  policyName?: string;
  group: GuardrailGroupName;
  check: string;
  reason: string;
}

export interface GuardrailEvaluationReport {
  /** Whether any check matched or transformed the sample content. */
  matched: boolean;
  /** Whether a blocking guardrail stopped evaluation with a tripwire. */
  blocked: boolean;
  /** @deprecated Use matched or blocked for clearer evaluation semantics. */
  triggered: boolean;
  violations: GuardrailEvaluationViolation[];
  skipped: GuardrailEvaluationSkippedCheck[];
  transformed: {
    input?: string;
    output?: string;
  };
}

export interface EvaluateGuardrailPolicyOptions {
  input?: string;
  output?: string;
  model?: GuardrailPolicyDefinition['model'];
}

const evaluationLogger: IMastraLogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  trackException: () => {},
  getTransports: () => [],
  listLogs: () => [],
  listLogsByRunId: () => [],
} as unknown as IMastraLogger;

export async function evaluateGuardrailPolicy(
  policy: GuardrailsConfig,
  options: EvaluateGuardrailPolicyOptions = {},
): Promise<GuardrailEvaluationReport> {
  if (options.input === undefined && options.output === undefined) {
    throw new Error('evaluateGuardrailPolicy requires input, output, or both.');
  }

  const skipped = collectSkippedChecks(policy);
  const messageList = new MessageList({ threadId: 'guardrail-evaluation' });
  const violations: GuardrailEvaluationViolation[] = [];
  const config = addEvaluationHandlers(omitSkippedRuntimeChecks(policy), violations);
  const compiled = compileGuardrails(config, { defaultModel: options.model });

  if (options.input !== undefined) {
    messageList.add([createMessage(options.input, 'user')], 'user');
  }
  if (options.output !== undefined) {
    messageList.add([createMessage(options.output, 'assistant')], 'response');
  }

  const runner = new ProcessorRunner({
    inputProcessors: compiled.inputProcessors,
    outputProcessors: compiled.outputProcessors,
    logger: evaluationLogger,
    agentName: 'guardrail-evaluation',
  });

  if (options.input !== undefined) {
    await runAndCollect(() => runner.runInputProcessors(messageList), violations);
  }
  if (options.output !== undefined) {
    await runAndCollect(() => runner.runOutputProcessors(messageList), violations);
  }

  const transformed: GuardrailEvaluationReport['transformed'] = {};
  if (options.input !== undefined) {
    transformed.input = extractText(messageList.get.input.db());
  }
  if (options.output !== undefined) {
    transformed.output = extractText(messageList.get.response.db());
  }

  const transformedInput = options.input !== undefined && transformed.input !== options.input;
  const transformedOutput = options.output !== undefined && transformed.output !== options.output;
  const blocked = violations.some(violation => violation.action === 'block');
  const matched = blocked || violations.length > 0 || transformedInput || transformedOutput;

  return {
    matched,
    blocked,
    triggered: matched,
    violations,
    skipped,
    transformed,
  };
}

async function runAndCollect(run: () => Promise<unknown>, violations: GuardrailEvaluationViolation[]): Promise<void> {
  const previousViolationCount = violations.length;
  try {
    await run();
  } catch (error) {
    if (!(error instanceof TripWire)) {
      throw error;
    }

    if (violations.length === previousViolationCount) {
      violations.push(toEvaluationViolation(error));
    }
  }
}

function toEvaluationViolation(error: TripWire): GuardrailEvaluationViolation {
  const detail = error.options?.metadata;
  const metadata = isGuardrailMetadata(detail) ? detail : undefined;
  return {
    policyName: metadata?.policyName,
    group: metadata?.group,
    phase: metadata?.phase,
    check: metadata?.check ?? error.processorId ?? 'unknown',
    action: metadata?.action ?? 'block',
    processorId: error.processorId,
    message: error.message,
    detail,
  };
}

function isGuardrailMetadata(value: unknown): value is {
  policyName?: string;
  group?: GuardrailGroupName;
  phase?: GuardrailPhase;
  check?: string;
  action?: GuardrailAction;
} {
  return Boolean(value && typeof value === 'object' && ('group' in value || 'check' in value || 'action' in value));
}

function createMessage(content: string, role: 'user' | 'assistant'): MastraDBMessage {
  return {
    id: `guardrail-eval-${role}-${Math.random().toString(36).slice(2)}`,
    role,
    content: {
      format: 2,
      parts: [{ type: 'text', text: content }],
    },
    createdAt: new Date(),
    threadId: 'guardrail-evaluation',
  } as MastraDBMessage;
}

function extractText(messages: MastraDBMessage[]): string {
  return messages
    .flatMap(message => {
      if (typeof message.content === 'string') return [message.content];
      return message.content.parts.flatMap(part => (part.type === 'text' ? [part.text] : []));
    })
    .join('\n');
}

function addEvaluationHandlers(config: GuardrailsConfig, violations: GuardrailEvaluationViolation[]): GuardrailsConfig {
  const policies = normalizePolicyDefinitions(config).map(policy => wrapPolicyViolationHandlers(policy, violations));
  return (Array.isArray(config) ? policies : (policies[0] ?? false)) as GuardrailsConfig;
}

function wrapPolicyViolationHandlers(
  policy: GuardrailPolicyDefinition,
  violations: GuardrailEvaluationViolation[],
): GuardrailPolicyDefinition {
  const policyHandler = policy.onViolation;
  return {
    ...policy,
    onViolation: async violation => {
      violations.push(violation);
      await policyHandler?.(violation);
    },
    security: wrapGroupChecks(policy.security, violations, ['promptInjection', 'systemPromptLeak']),
    privacy: wrapGroupChecks(policy.privacy, violations, ['pii', 'secrets']),
    content: wrapGroupChecks(policy.content, violations, ['moderation']),
    cost: wrapGroupChecks(policy.cost, violations, ['tokenLimit']),
  };
}

function wrapGroupChecks<T>(group: T, violations: GuardrailEvaluationViolation[], checks: string[]): T {
  if (!group || group === true || typeof group !== 'object') return group;
  const wrapped = { ...group } as Record<string, unknown>;
  for (const check of checks) {
    const value = wrapped[check];
    if (!value || value === true || typeof value !== 'object') continue;
    const options = value as { onViolation?: (violation: GuardrailEvaluationViolation) => void | Promise<void> };
    const handler = options.onViolation;
    if (!handler) continue;
    wrapped[check] = {
      ...options,
      onViolation: async (violation: GuardrailEvaluationViolation) => {
        violations.push(violation);
        await handler(violation);
      },
    };
  }
  return wrapped as T;
}

function collectSkippedChecks(config: GuardrailsConfig): GuardrailEvaluationSkippedCheck[] {
  return normalizePolicyDefinitions(config).flatMap(policy => {
    const cost = policy.cost;
    if (!cost || cost.maxCost === undefined) return [];
    return [
      {
        policyName: policy.name,
        group: 'cost' as const,
        check: 'maxCost',
        reason: 'Cost guard evaluation requires observability storage, so maxCost is skipped outside an agent run.',
      },
    ];
  });
}

function omitSkippedRuntimeChecks(config: GuardrailsConfig): GuardrailsConfig {
  const policies = normalizePolicyDefinitions(config).map(policy => {
    if (!policy.cost || policy.cost.maxCost === undefined) return policy;
    const { maxCost, ...cost } = policy.cost;
    void maxCost;
    return { ...policy, cost: Object.keys(cost).length > 0 ? cost : undefined };
  });

  return (Array.isArray(config) ? policies : (policies[0] ?? false)) as GuardrailsConfig;
}

function normalizePolicyDefinitions(config: GuardrailsConfig): GuardrailPolicyDefinition[] {
  if (config === true) return [{ security: true, privacy: true, content: true }];
  if (config === false) return [];
  return Array.isArray(config) ? config : [config];
}
