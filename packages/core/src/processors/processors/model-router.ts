import type { SharedV4ProviderOptions } from '@ai-sdk/provider-v7';
import type { MastraDBMessage } from '../../agent/message-list';
import type { Classifier, ClassifierAnswers, ClassifierQuestions, ClassifierResult } from '../../classifier';
import { MastraError, ErrorDomain, ErrorCategory } from '../../error';
import type { Mastra } from '../../mastra';
import { resolveObservabilityContext } from '../../observability';
import { executeWithContext } from '../../observability/utils';
import type { Processor, ProcessInputArgs, ProcessInputStepArgs, ProcessInputStepResult } from '../index';

/** A model the router may switch to, matching what a step may override. */
export type RoutableModel = NonNullable<ProcessInputStepResult['model']>;

/**
 * Chooses a model from the classifier's answers.
 *
 * Return `undefined` to abstain, which leaves the agent's configured model in place.
 * Abstaining is always safe; it is the behaviour on low confidence and on classifier failure.
 */
export type ModelRouterSelect<Q extends ClassifierQuestions> = (
  answers: ClassifierAnswers<Q>,
  context: { result: ClassifierResult<Q> },
) => RoutableModel | undefined | Promise<RoutableModel | undefined>;

interface ModelRouterBaseOptions {
  /** Identifier used in errors and logs. Defaults to `model-router`. */
  id?: string;
  /** A configured Classifier, or the id of one registered with Mastra. */
  classifier: Classifier<any> | string;
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

/**
 * Route on a single choice question by mapping every criterion to a model.
 */
export interface ModelRouterMapOptions<Q extends ClassifierQuestions> extends ModelRouterBaseOptions {
  /** The configured choice question to route on. */
  question: keyof Q & string;
  /** Exhaustive map from each criterion of `question` to the model to use. */
  models: Record<string, RoutableModel>;
  /**
   * Minimum probability required to apply the mapped model.
   *
   * Omit this to route on the selected choice alone. Set it to require calibrated
   * evidence: the router then abstains both when the probability is below the
   * threshold and when the model returns no probability at all, because a threshold
   * that cannot be evaluated must not silently pass.
   *
   * Not every evaluation model returns a probability distribution for choice
   * questions. Verify yours does before relying on this.
   */
  minProbability?: number;
  select?: never;
}

/**
 * Route on arbitrary policy across every configured question.
 */
export interface ModelRouterSelectOptions<Q extends ClassifierQuestions> extends ModelRouterBaseOptions {
  /** Receives all typed answers from a single evaluation and returns a model, or `undefined` to abstain. */
  select: ModelRouterSelect<Q>;
  question?: never;
  models?: never;
  minProbability?: never;
}

export type ModelRouterProcessorOptions<Q extends ClassifierQuestions = ClassifierQuestions> =
  | ModelRouterMapOptions<Q>
  | ModelRouterSelectOptions<Q>;

const STATE_KEY = '__modelRouter';

type RouterState = { decided: boolean; model?: RoutableModel };

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
 * Do not attach two model routers to the same agent. Both would return a model for the same
 * step and the last processor in the chain would silently win.
 */
export class ModelRouterProcessor<Q extends ClassifierQuestions = ClassifierQuestions> implements Processor {
  readonly name = 'model-router';

  readonly id: string;
  private classifierOrId: Classifier<any> | string;
  private resolvedClassifier?: Classifier<any>;
  private providerOptions?: SharedV4ProviderOptions;
  private question?: string;
  private models?: Record<string, RoutableModel>;
  private minProbability?: number;
  private scope: 'run' | 'first-step';
  private select?: ModelRouterSelect<Q>;
  private mastra?: Mastra;

  constructor(options: ModelRouterProcessorOptions<Q>) {
    this.id = options.id ?? 'model-router';
    this.classifierOrId = options.classifier;
    this.providerOptions = options.providerOptions;
    this.scope = options.scope ?? 'run';

    if (options.select) {
      this.select = options.select;
    } else {
      this.question = options.question;
      this.models = options.models;
      this.minProbability = options.minProbability;

      if (!this.question || !this.models) {
        throw new MastraError({
          id: 'MODEL_ROUTER_INVALID_OPTIONS',
          domain: ErrorDomain.MASTRA,
          category: ErrorCategory.USER,
          text: `ModelRouterProcessor '${this.id}' requires either 'select', or both 'question' and 'models'.`,
        });
      }

      if (Object.keys(this.models).length === 0) {
        throw new MastraError({
          id: 'MODEL_ROUTER_EMPTY_MODEL_MAP',
          domain: ErrorDomain.MASTRA,
          category: ErrorCategory.USER,
          text: `ModelRouterProcessor '${this.id}' was given an empty 'models' map.`,
        });
      }
    }

    if (typeof this.classifierOrId !== 'string') {
      this.assertConfiguredQuestions(this.classifierOrId, this.classifierOrId.id);
      this.assertQuestionAndModels(this.classifierOrId);
    }
  }

  __registerMastra(mastra: Mastra): void {
    this.mastra = mastra;
  }

  async processInput(args: ProcessInputArgs): Promise<MastraDBMessage[]> {
    const { messages, state, ...rest } = args;
    const routerState = (state[STATE_KEY] ??= { decided: false }) as RouterState;

    // Route once per request, before the first model step.
    if (routerState.decided) {
      return messages;
    }
    routerState.decided = true;

    const text = latestUserText(messages);
    if (!text) {
      return messages;
    }

    try {
      const classifier = this.resolveClassifier();
      this.assertQuestionAndModels(classifier);

      const observabilityContext = resolveObservabilityContext(rest);
      const result = (await executeWithContext({
        span: observabilityContext.tracing.currentSpan,
        fn: () => classifier.evaluate({ state: { request: text }, providerOptions: this.providerOptions }),
      })) as ClassifierResult<Q>;

      routerState.model = await this.decide(result);
    } catch (error) {
      // Fail open: routing is an optimisation, so a router failure must not fail the request.
      // The agent's configured model is used instead.
      console.warn(
        `[ModelRouterProcessor:${this.id}] Classifier evaluation failed, using the configured model:`,
        error instanceof Error ? error.message : error,
      );
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

    const routerState = args.state[STATE_KEY] as RouterState | undefined;
    if (!routerState?.model) {
      return {};
    }

    return { model: routerState.model };
  }

  private async decide(result: ClassifierResult<Q>): Promise<RoutableModel | undefined> {
    if (this.select) {
      return await this.select(result.answers, { result });
    }

    const answer = (result.answers as Record<string, any>)[this.question!];
    if (!answer || typeof answer.choice !== 'string') {
      return undefined;
    }

    if (this.minProbability !== undefined) {
      // Fail closed. A threshold that cannot be evaluated, because the model returned
      // no probability, must abstain rather than quietly route on no evidence.
      if (typeof answer.probability !== 'number' || answer.probability < this.minProbability) {
        return undefined;
      }
    }

    return this.models![answer.choice];
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
        id: 'MODEL_ROUTER_MASTRA_NOT_REGISTERED',
        domain: ErrorDomain.MASTRA,
        category: ErrorCategory.USER,
        text: `ModelRouterProcessor '${this.id}' references classifier '${id}' by id, but the processor is not attached to a Mastra instance. Pass a Classifier instance, or register the classifier with Mastra.`,
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
        id: 'MODEL_ROUTER_QUESTIONS_REQUIRED',
        domain: ErrorDomain.MASTRA,
        category: ErrorCategory.USER,
        text: `ModelRouterProcessor '${this.id}' requires classifier '${id}' to have questions configured in its constructor.`,
      });
    }
  }

  /** In the map form, every criterion must map to a model so there is no silent fallthrough. */
  private assertQuestionAndModels(classifier: Classifier<any>): void {
    if (!this.question || !this.models) {
      return;
    }

    const questions = classifier.questions as Record<string, any> | undefined;
    if (!questions) {
      return;
    }

    const question = questions[this.question];
    if (!question) {
      throw new MastraError({
        id: 'MODEL_ROUTER_UNKNOWN_QUESTION',
        domain: ErrorDomain.MASTRA,
        category: ErrorCategory.USER,
        text: `ModelRouterProcessor '${this.id}' routes on question '${this.question}', which classifier '${classifier.id}' does not define. Available questions: ${Object.keys(questions).join(', ')}.`,
      });
    }

    if (question.type !== 'choice') {
      throw new MastraError({
        id: 'MODEL_ROUTER_QUESTION_NOT_CHOICE',
        domain: ErrorDomain.MASTRA,
        category: ErrorCategory.USER,
        text: `ModelRouterProcessor '${this.id}' routes on question '${this.question}', which is a '${question.type}' question. The 'question' and 'models' form requires a choice question. Use 'select' for score or boolean questions.`,
      });
    }

    const criteria = Object.keys(question.criteria ?? {});
    const missing = criteria.filter(criterion => !(criterion in this.models!));
    if (missing.length > 0) {
      throw new MastraError({
        id: 'MODEL_ROUTER_INCOMPLETE_MODEL_MAP',
        domain: ErrorDomain.MASTRA,
        category: ErrorCategory.USER,
        text: `ModelRouterProcessor '${this.id}' is missing a model for criteria: ${missing.join(', ')}. Map every criterion of '${this.question}' so no request falls through silently.`,
      });
    }

    const unknown = Object.keys(this.models).filter(name => !criteria.includes(name));
    if (unknown.length > 0) {
      throw new MastraError({
        id: 'MODEL_ROUTER_UNKNOWN_CRITERIA',
        domain: ErrorDomain.MASTRA,
        category: ErrorCategory.USER,
        text: `ModelRouterProcessor '${this.id}' maps models for criteria that '${this.question}' does not define: ${unknown.join(', ')}.`,
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
