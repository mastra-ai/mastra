import type { SharedV4ProviderOptions } from '@ai-sdk/provider-v7';
import type { MastraDBMessage } from '../../agent/message-list';
import { Classifier } from '../../classifier';
import type { ClassifierAnswers, ClassifierQuestions, ClassifierResult } from '../../classifier';
import { MastraError, ErrorDomain, ErrorCategory } from '../../error';
import type { Mastra } from '../../mastra';
import { resolveObservabilityContext } from '../../observability';
import { executeWithContext } from '../../observability/utils';
import type { Processor, ProcessInputArgs, ProcessInputStepArgs, ProcessInputStepResult } from '../index';

/** A model the router may switch to, matching what a step may override. */
export type SelectableModel = NonNullable<ProcessInputStepResult['model']>;

/**
 * Chooses a model from the classifier's answers.
 *
 * Return `undefined` to abstain, which leaves the agent's configured model in place.
 * Abstaining is always safe; it is the behaviour on low confidence and on classifier failure.
 */
export type ModelSelectionSelect<Q extends ClassifierQuestions> = (
  answers: ClassifierAnswers<Q>,
  context: { result: ClassifierResult<Q> },
) => SelectableModel | undefined | Promise<SelectableModel | undefined>;

/** One routable model, declared together with the criteria that should select it. */
export interface ModelChoice {
  /** The model to use when this choice is selected. */
  model: SelectableModel;
  /** What kind of request this model should handle. This is the text the classifier judges against. */
  criteria: string;
  /**
   * Name for this choice in traces and in {@link ModelSelectionBaseOptions.onDecision}.
   * Defaults to the model id, so it only needs setting when the same model appears twice.
   */
  name?: string;
}

/** The decision the router reached for a request. */
export interface ModelSelectionDecision {
  /** The model that will be used, or `undefined` when the router abstained. */
  model?: SelectableModel;
  /** The selected choice name, or `undefined` when the router abstained. */
  choice?: string;
  /** Confidence in the selected choice, when the evaluation model returned a distribution. */
  probability?: number;
  /** Why the router abstained, when it did. */
  abstained?: 'below-threshold' | 'no-text' | 'error' | 'no-model-for-choice';
}

interface ModelSelectionCommonOptions {
  /** Identifier used in errors and logs. Defaults to `model-router`. */
  id?: string;
  /**
   * Called once per request with the decision, including when the router abstains.
   *
   * The router is otherwise silent, so this is how a routing decision becomes visible to
   * logs and metrics. It must not throw; errors from it are swallowed so that logging
   * cannot fail a request.
   */
  onDecision?: (decision: ModelSelectionDecision) => void | Promise<void>;
  /** Provider options forwarded to `Classifier.evaluate()`. */
  providerOptions?: SharedV4ProviderOptions;
  /**
   * Which model calls the routing decision applies to. Defaults to `run`.
   *
   * - `run` routes every step of the run.
   * - `first-step` routes only the opening call, leaving later steps on the agent's
   *   configured model.
   *
   * `first-step` sounds like the safer choice but captures very little. Context
   * accumulates as a run proceeds, so on a multi-step tool-calling run the opening
   * call is the cheapest one: measured over four-step support runs it held 14% of the
   * input tokens, and routing it alone captured 9% of the saving available from
   * routing the whole run. Prefer `first-step` only when you specifically want later
   * steps to escape a wrong decision, and accept that it saves comparatively little.
   */
  scope?: 'run' | 'first-step';
}

interface ModelSelectionBaseOptions extends ModelSelectionCommonOptions {
  /** A configured Classifier, or the id of one registered with Mastra. */
  classifier: Classifier<any> | string;
}

/**
 * The default objective given to the classifier built by the `choices` form.
 *
 * Criteria describe what each model is for, but without an objective the classifier has no
 * instruction to prefer a cheaper one, so this states the economic goal explicitly.
 */
const DEFAULT_ROUTING_INSTRUCTIONS =
  'Choose the least capable model that can handle this request correctly and safely. ' +
  'Prefer a cheaper model when the request is straightforward, and only choose a more ' +
  'capable model when the request genuinely requires it.';

/**
 * Declare each model together with the requests it should handle, and let the processor
 * build the classifier for you.
 *
 * This is the form to reach for first. Use the `select` form to reuse an existing classifier or combine several questions.
 */
export interface ModelSelectionChoicesOptions extends ModelSelectionCommonOptions {
  /** The evaluation model used to make the routing decision. */
  model: ConstructorParameters<typeof Classifier>[0]['model'];
  /**
   * The models to route between, each with the criteria that should select it.
   *
   * Order is not significant, and there is no implicit ranking: the classifier chooses
   * purely on the criteria text, so make each one describe a distinguishable kind of request.
   */
  choices: ModelChoice[];
  /** Overrides the default objective given to the classifier. */
  instructions?: string;
  /**
   * Minimum confidence in the selected choice before its model is applied.
   *
   * Omit this to route on the selected choice alone. Set it and the router abstains when
   * confidence is below the threshold, and also when the evaluation model returns no
   * distribution at all, because a threshold that cannot be evaluated must not silently pass.
   */
  minProbability?: number;
  classifier?: never;
  select?: never;
}

/**
 * Route on arbitrary policy across every configured question.
 */
export interface ModelSelectionSelectOptions<Q extends ClassifierQuestions> extends ModelSelectionBaseOptions {
  /** Receives all typed answers from a single evaluation and returns a model, or `undefined` to abstain. */
  select: ModelSelectionSelect<Q>;
  minProbability?: never;
}

export type ModelSelectionProcessorOptions<Q extends ClassifierQuestions = ClassifierQuestions> =
  | ModelSelectionChoicesOptions
  | ModelSelectionSelectOptions<Q>;

/** The question name used by the classifier built from `choices`. */
const CHOICES_QUESTION = 'model';

function isChoicesForm(options: ModelSelectionProcessorOptions<any>): options is ModelSelectionChoicesOptions {
  return Array.isArray((options as ModelSelectionChoicesOptions).choices);
}

function modelLabel(model: SelectableModel): string {
  if (typeof model === 'string') return model;
  return (model as any)?.modelId ?? 'model';
}

const STATE_KEY = '__modelSelection';

type SelectionState = {
  decided: boolean;
  model?: SelectableModel;
  /** The configured model the runner passed on the first routed step. */
  primary?: unknown;
  /** Set once the runner moves to a fallback model; selection then stays off for the run. */
  fellBack?: boolean;
};

/**
 * Selects the model for a request by classifying the latest user message before the first
 * model step.
 *
 * The router classifies once in `processInput()` and applies the result in
 * `processInputStep()`, by default for every step of the run. Messages are never rewritten.
 *
 * Routing is a swap rather than an addition: unlike tool preselection, a wrong choice has no
 * in-band recovery, because the request simply runs on the wrong model. The safe direction is
 * therefore to downgrade only when confident, and to abstain otherwise. Abstaining leaves the
 * agent's configured model in place, so that model should be the capable one.
 *
 * Do not attach two model selection processors to the same agent. Both would return a model for the same
 * step and the last processor in the chain would silently win.
 */
export class ModelSelectionProcessor<Q extends ClassifierQuestions = ClassifierQuestions> implements Processor {
  readonly name = 'model-selection';

  readonly id: string;
  private classifierOrId!: Classifier<any> | string;
  private onDecision?: (decision: ModelSelectionDecision) => void | Promise<void>;
  private resolvedClassifier?: Classifier<any>;
  private providerOptions?: SharedV4ProviderOptions;
  private question?: string;
  private models?: Record<string, SelectableModel>;
  private minProbability?: number;
  private scope: 'run' | 'first-step';
  private select?: ModelSelectionSelect<Q>;
  private mastra?: Mastra;

  constructor(options: ModelSelectionProcessorOptions<Q>) {
    this.id = options.id ?? 'model-selection';
    this.providerOptions = options.providerOptions;
    this.scope = options.scope ?? 'run';
    this.onDecision = options.onDecision;

    if (isChoicesForm(options)) {
      const { classifier, models } = this.buildFromChoices(options);
      this.classifierOrId = classifier;
      this.question = CHOICES_QUESTION;
      this.models = models;
      this.minProbability = options.minProbability;
      return;
    }

    this.classifierOrId = options.classifier;
    this.select = options.select;

    if (typeof this.classifierOrId !== 'string') {
      this.assertConfiguredQuestions(this.classifierOrId, this.classifierOrId.id);
    }
  }

  __registerMastra(mastra: Mastra): void {
    this.mastra = mastra;
  }

  /**
   * Turns co-located choices into the classifier and criterion-to-model map that the
   * rest of the processor already works in terms of.
   */
  private buildFromChoices(options: ModelSelectionChoicesOptions): {
    classifier: Classifier<any>;
    models: Record<string, SelectableModel>;
  } {
    if (!options.choices || options.choices.length < 2) {
      throw new MastraError({
        id: 'MODEL_SELECTION_INSUFFICIENT_CHOICES',
        domain: ErrorDomain.MASTRA,
        category: ErrorCategory.USER,
        text: `ModelSelectionProcessor '${this.id}' needs at least two choices to route between, got ${options.choices?.length ?? 0}.`,
      });
    }

    const criteria: Record<string, string> = {};
    const models: Record<string, SelectableModel> = {};

    for (const choice of options.choices) {
      const name = choice.name ?? modelLabel(choice.model);

      if (models[name]) {
        throw new MastraError({
          id: 'MODEL_SELECTION_DUPLICATE_CHOICE',
          domain: ErrorDomain.MASTRA,
          category: ErrorCategory.USER,
          text: `ModelSelectionProcessor '${this.id}' has two choices named '${name}'. Choices are named after their model, so give one of them an explicit 'name' to tell them apart.`,
        });
      }

      if (!choice.criteria?.trim()) {
        throw new MastraError({
          id: 'MODEL_SELECTION_MISSING_CRITERIA',
          domain: ErrorDomain.MASTRA,
          category: ErrorCategory.USER,
          text: `ModelSelectionProcessor '${this.id}' choice '${name}' has no criteria. The classifier selects purely on this text, so it cannot be empty.`,
        });
      }

      criteria[name] = choice.criteria;
      models[name] = choice.model;
    }

    const classifier = new Classifier({
      id: `${this.id}-classifier`,
      model: options.model,
      questions: {
        [CHOICES_QUESTION]: {
          type: 'choice',
          instructions: options.instructions ?? DEFAULT_ROUTING_INSTRUCTIONS,
          criteria,
        },
      },
    });

    return { classifier, models };
  }

  /** Reports the decision without letting a logging failure break the request. */
  private async report(decision: ModelSelectionDecision): Promise<void> {
    if (!this.onDecision) return;
    try {
      await this.onDecision(decision);
    } catch (error) {
      console.warn(
        `[ModelSelectionProcessor:${this.id}] onDecision callback threw, ignoring:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  async processInput(args: ProcessInputArgs): Promise<MastraDBMessage[]> {
    const { messages, state, ...rest } = args;
    const routerState = (state[STATE_KEY] ??= { decided: false }) as SelectionState;

    // Route once per request, before the first model step.
    if (routerState.decided) {
      return messages;
    }
    routerState.decided = true;

    const text = latestUserText(messages);
    if (!text) {
      await this.report({ abstained: 'no-text' });
      return messages;
    }

    try {
      const classifier = this.resolveClassifier();

      const observabilityContext = resolveObservabilityContext(rest);
      const result = (await executeWithContext({
        span: observabilityContext.tracing.currentSpan,
        fn: () => classifier.evaluate({ state: { request: text }, providerOptions: this.providerOptions }),
      })) as ClassifierResult<Q>;

      const decision = await this.decide(result);
      routerState.model = decision.model;
      await this.report(decision);
    } catch (error) {
      // Fail open: routing is an optimisation, so a router failure must not fail the request.
      // The agent's configured model is used instead.
      console.warn(
        `[ModelSelectionProcessor:${this.id}] Classifier evaluation failed, using the configured model:`,
        error instanceof Error ? error.message : error,
      );
      await this.report({ abstained: 'error' });
    }

    return messages;
  }

  processInputStep(args: ProcessInputStepArgs): ProcessInputStepResult {
    // With scope 'first-step' only the opening call is routed. That captures very little
    // on multi-step runs, because context accumulates and the later steps carry most of
    // the tokens, so 'run' is the default.
    if (this.scope === 'first-step' && args.stepNumber !== 0) {
      return {};
    }

    const routerState = args.state[STATE_KEY] as SelectionState | undefined;
    if (!routerState?.model || routerState.fellBack) {
      return {};
    }

    // Fallback attempts rerun this hook with the next configured model. Overriding it again
    // would retry the selected model and bypass the agent's fallbacks, so once the runner has
    // moved off the primary model the selected model is dropped for the rest of the run.
    routerState.primary ??= args.model;
    if (args.model !== routerState.primary) {
      routerState.fellBack = true;
      return {};
    }

    return { model: routerState.model };
  }

  private async decide(result: ClassifierResult<Q>): Promise<ModelSelectionDecision> {
    if (this.select) {
      return { model: await this.select(result.answers, { result }) };
    }

    const answer = (result.answers as Record<string, any>)[this.question!];
    if (!answer || typeof answer.choice !== 'string') {
      return { abstained: 'error' };
    }

    // A choice answer carries a distribution over the criteria, so the confidence in
    // this decision is the mass on the criterion that was actually selected.
    const probability = answer.probabilities?.[answer.choice];

    if (this.minProbability !== undefined) {
      // Fail closed. A threshold that cannot be evaluated, because the model returned
      // no distribution, must abstain rather than quietly route on no evidence.
      if (typeof probability !== 'number' || probability < this.minProbability) {
        return { choice: answer.choice, probability, abstained: 'below-threshold' };
      }
    }

    const model = this.models![answer.choice];
    if (!model) {
      return { choice: answer.choice, probability, abstained: 'no-model-for-choice' };
    }

    return { model, choice: answer.choice, probability };
  }

  private resolveClassifier(): Classifier<any> {
    if (this.resolvedClassifier) {
      return this.resolvedClassifier;
    }

    if (typeof this.classifierOrId !== 'string') {
      this.resolvedClassifier = this.classifierOrId;
      return this.resolvedClassifier;
    }

    const id = this.classifierOrId;
    if (!this.mastra) {
      throw new MastraError({
        id: 'MODEL_SELECTION_MASTRA_NOT_REGISTERED',
        domain: ErrorDomain.MASTRA,
        category: ErrorCategory.USER,
        text: `ModelSelectionProcessor '${this.id}' references classifier '${id}' by id, but the processor is not attached to a Mastra instance. Pass a Classifier instance, or register the classifier with Mastra.`,
      });
    }

    const classifier = this.mastra.getClassifierById(id);
    this.assertConfiguredQuestions(classifier, id);
    this.resolvedClassifier = classifier;
    return classifier;
  }

  private assertConfiguredQuestions(classifier: Classifier<any>, id: string): void {
    if (classifier.questions === undefined) {
      throw new MastraError({
        id: 'MODEL_SELECTION_QUESTIONS_REQUIRED',
        domain: ErrorDomain.MASTRA,
        category: ErrorCategory.USER,
        text: `ModelSelectionProcessor '${this.id}' requires classifier '${id}' to have questions configured in its constructor.`,
      });
    }
  }
}

function latestUserText(messages: MastraDBMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (!message || message.role !== 'user') {
      continue;
    }

    let text = '';
    if (message.content.parts) {
      for (const part of message.content.parts) {
        if (part.type === 'text' && 'text' in part && typeof part.text === 'string') {
          text += part.text + ' ';
        }
      }
    }
    if (!text.trim() && typeof message.content.content === 'string') {
      text = message.content.content;
    }

    return text.trim();
  }

  return '';
}
