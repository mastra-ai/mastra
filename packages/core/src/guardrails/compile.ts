import type { ProviderOptions } from '../llm/model/provider-options';
import type { Mastra } from '../mastra';
import type { ProcessorPhase } from '../processor-provider/types';
import type { InputProcessorOrWorkflow, OutputProcessorOrWorkflow, Processor, ProcessorViolation } from '../processors';
import { ProcessorStepSchema } from '../processors/index';
import {
  BatchPartsProcessor,
  CostGuardProcessor,
  ModerationProcessor,
  PIIDetector,
  PromptInjectionDetector,
  RegexFilterProcessor,
  SystemPromptScrubber,
  TokenLimiterProcessor,
  UnicodeNormalizer,
} from '../processors/processors';
import { BATCH_PARTS_GUARDRAIL_CONTEXT_KEY } from '../processors/processors/batch-parts';
import { createWorkflow } from '../workflows/create';
import { createStep } from '../workflows/workflow';
import type {
  BaseGuardrailCheckOptions,
  ContentGuardrailGroup,
  CostGuardrailGroup,
  GuardrailAction,
  GuardrailGroupName,
  GuardrailPhase,
  GuardrailPolicyDefinition,
  GuardrailSensitivity,
  GuardrailStreamingOptions,
  GuardrailsConfig,
  ModerationGuardrailOptions,
  PIIGuardrailOptions,
  PrivacyGuardrailGroup,
  PromptInjectionGuardrailOptions,
  RegexGuardrailOptions,
  SecurityGuardrailGroup,
  SystemPromptLeakGuardrailOptions,
  TokenLimitGuardrailOptions,
} from './types';

export interface CompiledGuardrails {
  inputProcessors: InputProcessorOrWorkflow[];
  outputProcessors: OutputProcessorOrWorkflow[];
}

export interface CompileGuardrailsOptions {
  defaultModel?: GuardrailPolicyDefinition['model'];
}

type CheckOptions = BaseGuardrailCheckOptions | RegexGuardrailOptions | TokenLimitGuardrailOptions;
export type SensitivityBackedCheck = 'promptInjection' | 'moderation' | 'pii';

const DEFAULT_SENSITIVITY: GuardrailSensitivity = 'medium';
export const GUARDRAIL_SENSITIVITY_THRESHOLDS: Record<SensitivityBackedCheck, Record<GuardrailSensitivity, number>> = {
  promptInjection: { low: 0.85, medium: 0.7, high: 0.5 },
  moderation: { low: 0.75, medium: 0.5, high: 0.35 },
  pii: { low: 0.8, medium: 0.6, high: 0.4 },
};

const providerOptions = (options: Record<string, unknown> | undefined): ProviderOptions | undefined =>
  options as ProviderOptions | undefined;

function resolveStreamingOptions(streaming: GuardrailStreamingOptions | undefined) {
  return {
    checkEvery: streaming?.checkEvery ?? 'sentence',
    lookback: streaming?.lookback ?? 'medium',
  } as const;
}

type GuardrailProcessorMetadata = {
  policyName?: string;
  group: GuardrailGroupName;
  phase: GuardrailPhase;
  check: string;
  action: GuardrailAction;
};

type GuardrailProcessorWithMetadata = Processor & {
  readonly guardrailMetadata?: GuardrailProcessorMetadata;
};

class GuardrailProcessor<TId extends string = string> implements Processor<TId> {
  readonly id: TId;
  readonly name?: string;
  readonly description?: string;
  readonly guardrailMetadata: GuardrailProcessorMetadata;
  processorIndex?: number;
  readonly onViolation?: (violation: ProcessorViolation) => void | Promise<void>;

  readonly #inner: Processor<TId>;

  constructor(inner: Processor<TId>, phases: ProcessorPhase[], metadata: GuardrailProcessorMetadata, index: number) {
    this.#inner = inner;
    this.guardrailMetadata = metadata;
    this.id =
      `guardrail:${metadata.policyName ?? 'policy'}:${metadata.group}:${metadata.check}:${metadata.phase}:${index}` as TId;
    this.name = inner.name;
    this.description = inner.description;

    if (phases.includes('processInput') && inner.processInput) {
      this.processInput = inner.processInput.bind(inner) as Processor<TId>['processInput'];
    }
    if (phases.includes('processInputStep') && inner.processInputStep) {
      this.processInputStep = inner.processInputStep.bind(inner) as Processor<TId>['processInputStep'];
    }
    if (phases.includes('processOutputStream') && inner.processOutputStream) {
      this.processOutputStream = (async args => {
        const part = args.part;
        if (
          part.type !== 'text-delta' ||
          this.guardrailMetadata.action === 'redact' ||
          this.guardrailMetadata.action === 'rewrite' ||
          typeof (part as { [BATCH_PARTS_GUARDRAIL_CONTEXT_KEY]?: string })[BATCH_PARTS_GUARDRAIL_CONTEXT_KEY] !==
            'string'
        ) {
          return inner.processOutputStream!(args as Parameters<NonNullable<Processor<TId>['processOutputStream']>>[0]);
        }

        const guardrailPart = {
          ...part,
          payload: {
            ...part.payload,
            text: (part as { [BATCH_PARTS_GUARDRAIL_CONTEXT_KEY]?: string })[
              BATCH_PARTS_GUARDRAIL_CONTEXT_KEY
            ] as string,
          },
        };
        const streamParts =
          args.streamParts.length > 0 ? [...args.streamParts.slice(0, -1), guardrailPart] : [guardrailPart];
        const result = await inner.processOutputStream!({
          ...args,
          part: guardrailPart,
          streamParts,
        } as Parameters<NonNullable<Processor<TId>['processOutputStream']>>[0]);

        if (result?.type === 'text-delta' && result.payload.text === guardrailPart.payload.text) {
          return part;
        }
        return result;
      }) as Processor<TId>['processOutputStream'];
    }
    if (phases.includes('processOutputResult') && inner.processOutputResult) {
      this.processOutputResult = inner.processOutputResult.bind(inner) as Processor<TId>['processOutputResult'];
    }
    if (phases.includes('processOutputStep') && inner.processOutputStep) {
      this.processOutputStep = inner.processOutputStep.bind(inner) as Processor<TId>['processOutputStep'];
    }

    const handler = (inner as Processor).onViolation;
    if (handler) {
      this.onViolation = async violation => {
        await handler({
          processorId: this.id,
          message: violation.message,
          detail: {
            ...this.guardrailMetadata,
            processorId: violation.processorId,
            detail: violation.detail,
          },
        });
      };
    }
  }

  processInput?: Processor<TId>['processInput'];
  processInputStep?: Processor<TId>['processInputStep'];
  processOutputStream?: Processor<TId>['processOutputStream'];
  processOutputResult?: Processor<TId>['processOutputResult'];
  processOutputStep?: Processor<TId>['processOutputStep'];

  __registerMastra(mastra: Mastra<any, any, any, any, any, any, any, any, any, any>): void {
    this.#inner.__registerMastra?.(mastra);
  }
}

export function compileGuardrails(
  config: GuardrailsConfig | undefined,
  options: CompileGuardrailsOptions = {},
): CompiledGuardrails {
  const inputProcessors: InputProcessorOrWorkflow[] = [];
  const outputProcessors: OutputProcessorOrWorkflow[] = [];

  if (!config) return { inputProcessors, outputProcessors };

  let index = 0;
  for (const policy of normalizePolicies(config)) {
    const policyInput: InputProcessorOrWorkflow[] = [];
    const policyOutput: OutputProcessorOrWorkflow[] = [];
    const model = policy.model ?? options.defaultModel;

    compileSecurity(policy, model, policyInput, policyOutput, () => index++);
    compilePrivacy(policy, model, policyInput, policyOutput, () => index++);
    compileContent(policy, model, policyInput, policyOutput, () => index++);
    compileCost(policy, policyInput, () => index++);

    const optimizedInput = groupParallelBlockers(policyInput, 'input', policy.name);
    const optimizedOutput = groupParallelBlockers(policyOutput, 'output', policy.name);

    if (policyInput.some(isLlmBackedInputProcessor)) {
      inputProcessors.push(new UnicodeNormalizer());
    }
    inputProcessors.push(...optimizedInput);

    if (policyOutput.some(isLlmBackedOutputProcessor)) {
      outputProcessors.push(new BatchPartsProcessor(resolveStreamingOptions(policy.streaming)));
    }
    outputProcessors.push(...optimizedOutput);
  }

  return { inputProcessors, outputProcessors };
}

function normalizePolicies(config: GuardrailsConfig): GuardrailPolicyDefinition[] {
  if (config === true) return [{ security: true, privacy: true, content: true }];
  if (config === false) return [];
  return Array.isArray(config) ? config : [config];
}

function compileSecurity(
  policy: GuardrailPolicyDefinition,
  policyModel: GuardrailPolicyDefinition['model'],
  inputProcessors: InputProcessorOrWorkflow[],
  outputProcessors: OutputProcessorOrWorkflow[],
  nextIndex: () => number,
): void {
  const group = policy.security;
  if (!group) return;
  const config: SecurityGuardrailGroup = group === true ? { promptInjection: true, systemPromptLeak: true } : group;
  const model = config.model ?? policyModel;

  if (isEnabled(config.promptInjection)) {
    const check = normalizeCheck<PromptInjectionGuardrailOptions>(config.promptInjection);
    const action = allowedAction(
      check.action ?? config.action ?? policy.action,
      ['block', 'warn', 'filter', 'rewrite'],
      'block',
      'security.promptInjection',
    );
    const processor = new PromptInjectionDetector({
      model: resolveModel(check.model ?? model, policy.name, 'security.promptInjection'),
      detectionTypes: check.detectionTypes,
      threshold: resolveGuardrailSensitivityThreshold(
        'promptInjection',
        check.threshold,
        check.sensitivity ?? config.sensitivity ?? policy.sensitivity,
      ),
      strategy: action,
      instructions: check.instructions,
      includeScores: check.includeScores,
      providerOptions: providerOptions(check.providerOptions ?? policy.providerOptions),
    });
    attachViolationHandler(processor, policy, 'security', 'promptInjection', 'input', action, check);
    inputProcessors.push(
      wrapInput(processor, ['processInput'], policy, 'security', 'promptInjection', 'input', action, nextIndex()),
    );
  }

  if (isEnabled(config.systemPromptLeak)) {
    const check = normalizeCheck<SystemPromptLeakGuardrailOptions>(config.systemPromptLeak);
    const action = allowedAction(
      check.action ?? config.action ?? policy.action,
      ['block', 'warn', 'redact', 'filter'],
      'block',
      'security.systemPromptLeak',
    );
    const processor = new SystemPromptScrubber({
      model: resolveModel(check.model ?? model, policy.name, 'security.systemPromptLeak'),
      strategy: action,
      customPatterns: check.patterns,
      instructions: check.instructions,
    });
    attachViolationHandler(processor, policy, 'security', 'systemPromptLeak', 'output', action, check);
    outputProcessors.push(
      wrapOutput(
        processor,
        ['processOutputStream', 'processOutputResult'],
        policy,
        'security',
        'systemPromptLeak',
        'output',
        action,
        nextIndex(),
      ),
    );
  }
}

function compilePrivacy(
  policy: GuardrailPolicyDefinition,
  policyModel: GuardrailPolicyDefinition['model'],
  inputProcessors: InputProcessorOrWorkflow[],
  outputProcessors: OutputProcessorOrWorkflow[],
  nextIndex: () => number,
): void {
  const group = policy.privacy;
  if (!group) return;
  const config: PrivacyGuardrailGroup = group === true ? { pii: true, secrets: true } : group;
  const model = config.model ?? policyModel;

  if (isEnabled(config.pii)) {
    const check = normalizeCheck<PIIGuardrailOptions>(config.pii);
    const action = allowedAction(
      check.action ?? config.action ?? policy.action,
      ['block', 'warn', 'filter', 'redact'],
      'redact',
      'privacy.pii',
    );
    const phases = phasesFor(check.applyTo, ['input', 'output'], 'privacy.pii');
    for (const phase of phases) {
      const processor = new PIIDetector({
        model: resolveModel(check.model ?? model, policy.name, 'privacy.pii'),
        detectionTypes: check.detectionTypes,
        threshold: resolveGuardrailSensitivityThreshold(
          'pii',
          check.threshold,
          check.sensitivity ?? config.sensitivity ?? policy.sensitivity,
        ),
        strategy: action,
        redactionMethod: check.redactionMethod,
        instructions: check.instructions,
        includeDetections: check.includeDetections,
        preserveFormat: check.preserveFormat,
        providerOptions: providerOptions(check.providerOptions ?? policy.providerOptions),
        bufferSize: check.bufferSize,
      });
      attachViolationHandler(processor, policy, 'privacy', 'pii', phase, action, check);
      pushPhase(processor, policy, 'privacy', 'pii', phase, action, inputProcessors, outputProcessors, nextIndex());
    }
  }

  if (isEnabled(config.secrets)) {
    const check = normalizeCheck<RegexGuardrailOptions>(config.secrets);
    const action = allowedAction(
      check.action ?? config.action ?? policy.action,
      ['block', 'warn', 'redact', 'filter'],
      'redact',
      'privacy.secrets',
    );
    const phases = phasesFor(check.applyTo, ['input', 'output'], 'privacy.secrets');
    for (const phase of phases) {
      const processor = new RegexFilterProcessor({
        presets: check.pattern ? undefined : ['secrets'],
        rules: check.pattern
          ? [{ name: check.name ?? 'secret', pattern: toRegExp(check.pattern), replacement: check.replacement }]
          : undefined,
        strategy: regexStrategy(action),
        phase,
      });
      attachViolationHandler(processor, policy, 'privacy', 'secrets', phase, action, check);
      pushPhase(processor, policy, 'privacy', 'secrets', phase, action, inputProcessors, outputProcessors, nextIndex());
    }
  }
}

function compileContent(
  policy: GuardrailPolicyDefinition,
  policyModel: GuardrailPolicyDefinition['model'],
  inputProcessors: InputProcessorOrWorkflow[],
  outputProcessors: OutputProcessorOrWorkflow[],
  nextIndex: () => number,
): void {
  const group = policy.content;
  if (!group) return;
  const config: ContentGuardrailGroup = group === true ? { moderation: true } : group;
  const model = config.model ?? policyModel;

  if (isEnabled(config.moderation)) {
    const check = normalizeCheck<ModerationGuardrailOptions>(config.moderation);
    const action = allowedAction(
      check.action ?? config.action ?? policy.action,
      ['block', 'warn', 'filter'],
      'block',
      'content.moderation',
    );
    const phases = phasesFor(check.applyTo, ['input', 'output'], 'content.moderation');
    for (const phase of phases) {
      const processor = new ModerationProcessor({
        model: resolveModel(check.model ?? model, policy.name, 'content.moderation'),
        categories: check.categories,
        threshold: resolveGuardrailSensitivityThreshold(
          'moderation',
          check.threshold,
          check.sensitivity ?? config.sensitivity ?? policy.sensitivity,
        ),
        strategy: action,
        instructions: check.instructions,
        includeScores: check.includeScores,
        chunkWindow: check.chunkWindow,
        providerOptions: providerOptions(check.providerOptions ?? policy.providerOptions),
      });
      attachViolationHandler(processor, policy, 'content', 'moderation', phase, action, check);
      pushPhase(
        processor,
        policy,
        'content',
        'moderation',
        phase,
        action,
        inputProcessors,
        outputProcessors,
        nextIndex(),
      );
    }
  }
}

function compileCost(
  policy: GuardrailPolicyDefinition,
  inputProcessors: InputProcessorOrWorkflow[],
  nextIndex: () => number,
): void {
  const group = policy.cost as CostGuardrailGroup | boolean | undefined;
  if (!group) return;
  if (group === true) {
    throw new Error(
      'Guardrail cost requires maxCost or tokenLimit. Use cost: { maxCost: 1 } or cost: { tokenLimit: 4000 }.',
    );
  }
  const config: CostGuardrailGroup = group;
  if (config.maxCost === undefined && config.tokenLimit === undefined) {
    throw new Error(
      'Guardrail cost requires maxCost or tokenLimit. Use cost: { maxCost: 1 } or cost: { tokenLimit: 4000 }.',
    );
  }
  const action = allowedAction(config.action ?? policy.action, ['block', 'warn'], 'block', 'cost');

  if (config.maxCost !== undefined) {
    const processor = new CostGuardProcessor({
      maxCost: config.maxCost,
      scope: config.scope,
      window: config.window,
      strategy: action,
    });
    attachViolationHandler(processor, policy, 'cost', 'maxCost', 'input', action, config);
    inputProcessors.push(
      wrapInput(processor, ['processInputStep'], policy, 'cost', 'maxCost', 'input', action, nextIndex()),
    );
  }

  if (config.tokenLimit !== undefined) {
    const tokenLimit = typeof config.tokenLimit === 'number' ? { limit: config.tokenLimit } : config.tokenLimit;
    if (tokenLimit.enabled === false) return;

    const tokenAction = allowedAction(tokenLimit.action ?? action, ['block'], 'block', 'cost.tokenLimit');
    const processor = new TokenLimiterProcessor({
      limit: tokenLimit.limit,
      encoding: tokenLimit.encoding,
      strategy: 'abort',
    });
    attachViolationHandler(processor, policy, 'cost', 'tokenLimit', 'input', tokenAction, {
      onViolation: tokenLimit.onViolation ?? config.onViolation,
    });
    inputProcessors.push(
      wrapInput(processor, ['processInputStep'], policy, 'cost', 'tokenLimit', 'input', tokenAction, nextIndex()),
    );
  }
}

function groupParallelBlockers<T extends InputProcessorOrWorkflow | OutputProcessorOrWorkflow>(
  processors: T[],
  phase: GuardrailPhase,
  policyName: string | undefined,
): T[] {
  const optimized: T[] = [];
  let parallelBlock: T[] = [];

  const flushParallelBlock = () => {
    if (parallelBlock.length > 1) {
      optimized.push(createParallelWorkflow(parallelBlock, phase, policyName) as T);
    } else {
      optimized.push(...parallelBlock);
    }
    parallelBlock = [];
  };

  for (const processor of processors) {
    if (isParallelSafeBlocker(processor)) {
      parallelBlock.push(processor);
      continue;
    }
    flushParallelBlock();
    optimized.push(processor);
  }

  flushParallelBlock();
  return optimized;
}

function createParallelWorkflow<T extends InputProcessorOrWorkflow | OutputProcessorOrWorkflow>(
  processors: T[],
  phase: GuardrailPhase,
  policyName: string | undefined,
): T {
  const workflow = createWorkflow({
    id: `guardrail-parallel-${phase}-${policyName ?? 'policy'}`,
    inputSchema: ProcessorStepSchema,
    outputSchema: ProcessorStepSchema,
    type: 'processor',
    options: {
      validateInputs: false,
      shouldPersistSnapshot: () => false,
    },
  })
    .parallel(processors.map(processor => createStep(processor as unknown as Parameters<typeof createStep>[0])) as any)
    .map(({ inputData }) => {
      const firstStepId = `processor:${processors[0]?.id}`;
      return inputData[firstStepId] ?? Object.values(inputData)[0] ?? {};
    })
    .commit();

  return workflow as T;
}

function isParallelSafeBlocker(processor: InputProcessorOrWorkflow | OutputProcessorOrWorkflow): boolean {
  const metadata = (processor as GuardrailProcessorWithMetadata).guardrailMetadata;
  return metadata?.action === 'block';
}

function pushPhase(
  processor: Processor,
  policy: GuardrailPolicyDefinition,
  group: GuardrailGroupName,
  check: string,
  phase: GuardrailPhase,
  action: GuardrailAction,
  inputProcessors: InputProcessorOrWorkflow[],
  outputProcessors: OutputProcessorOrWorkflow[],
  index: number,
): void {
  if (phase === 'input') {
    inputProcessors.push(wrapInput(processor, ['processInput'], policy, group, check, phase, action, index));
  } else {
    outputProcessors.push(
      wrapOutput(processor, ['processOutputStream', 'processOutputResult'], policy, group, check, phase, action, index),
    );
  }
}

function wrap(
  processor: Processor,
  phases: ProcessorPhase[],
  policy: GuardrailPolicyDefinition,
  group: GuardrailGroupName,
  check: string,
  phase: GuardrailPhase,
  action: GuardrailAction,
  index: number,
): Processor {
  return new GuardrailProcessor(processor, phases, { policyName: policy.name, group, check, phase, action }, index);
}

function wrapInput(
  processor: Processor,
  phases: ProcessorPhase[],
  policy: GuardrailPolicyDefinition,
  group: GuardrailGroupName,
  check: string,
  phase: GuardrailPhase,
  action: GuardrailAction,
  index: number,
): InputProcessorOrWorkflow {
  return wrap(processor, phases, policy, group, check, phase, action, index) as InputProcessorOrWorkflow;
}

function wrapOutput(
  processor: Processor,
  phases: ProcessorPhase[],
  policy: GuardrailPolicyDefinition,
  group: GuardrailGroupName,
  check: string,
  phase: GuardrailPhase,
  action: GuardrailAction,
  index: number,
): OutputProcessorOrWorkflow {
  return wrap(processor, phases, policy, group, check, phase, action, index) as OutputProcessorOrWorkflow;
}

function attachViolationHandler(
  processor: Processor,
  policy: GuardrailPolicyDefinition,
  group: GuardrailGroupName,
  check: string,
  phase: GuardrailPhase,
  action: GuardrailAction,
  options: CheckOptions,
): void {
  const handler = options.onViolation ?? policy.onViolation;
  if (!handler) return;
  processor.onViolation = violation =>
    handler({
      policyName: policy.name,
      group,
      phase,
      check,
      action,
      processorId: violation.processorId,
      message: violation.message,
      detail: violation.detail,
    });
}

function resolveModel(model: GuardrailPolicyDefinition['model'], policyName: string | undefined, check: string) {
  if (model) return model;
  throw new Error(
    `Guardrail ${policyName ? `policy "${policyName}" ` : ''}${check} requires a model. Configure a policy-level model, check-level model, or use an agent model as the guardrail default.`,
  );
}

export function resolveGuardrailSensitivityThreshold(
  check: SensitivityBackedCheck,
  threshold: number | undefined,
  sensitivity: GuardrailSensitivity | undefined,
): number {
  return threshold ?? GUARDRAIL_SENSITIVITY_THRESHOLDS[check][sensitivity ?? DEFAULT_SENSITIVITY];
}

function normalizeCheck<T extends object>(value: boolean | T | undefined): T {
  return value && typeof value === 'object' ? value : ({} as T);
}

function isEnabled(value: boolean | { enabled?: boolean } | undefined): boolean {
  if (value === undefined) return false;
  if (value === false) return false;
  return typeof value !== 'object' || value.enabled !== false;
}

function phasesFor(
  value: GuardrailPhase | GuardrailPhase[] | undefined,
  defaults: GuardrailPhase[],
  path: string,
): GuardrailPhase[] {
  if (!value) return defaults;
  const phases = Array.isArray(value) ? value : [value];
  if (phases.length === 0) {
    throw new Error(
      `Guardrail ${path} applyTo must include at least one phase. Use enabled: false to disable the check.`,
    );
  }
  return phases;
}

function toRegExp(pattern: string | RegExp): RegExp {
  return pattern instanceof RegExp ? pattern : new RegExp(pattern, 'g');
}

function regexStrategy(action: GuardrailAction): 'block' | 'redact' | 'warn' {
  if (action === 'warn') return 'warn';
  if (action === 'block') return 'block';
  return 'redact';
}

function allowedAction<T extends GuardrailAction>(
  action: GuardrailAction | undefined,
  allowed: readonly T[],
  fallback: T,
  path: string,
): T {
  if (!action) return fallback;
  if (allowed.includes(action as T)) return action as T;
  throw new Error(`Guardrail ${path} does not support action "${action}". Supported actions: ${allowed.join(', ')}.`);
}

function isLlmBackedInputProcessor(processor: InputProcessorOrWorkflow): boolean {
  return (
    'id' in processor &&
    String(processor.id).includes('guardrail:') &&
    !String(processor.id).includes(':cost:') &&
    !String(processor.id).includes(':secrets:')
  );
}

function isLlmBackedOutputProcessor(processor: OutputProcessorOrWorkflow): boolean {
  return (
    'id' in processor && String(processor.id).includes('guardrail:') && !String(processor.id).includes(':secrets:')
  );
}
