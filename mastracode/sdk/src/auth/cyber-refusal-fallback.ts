import type { AgentControllerRequestContext } from '@mastra/core/agent-controller';
import { CyberRefusalHandler } from '@mastra/core/processors';
import type {
  CyberRefusalFallbackContext,
  CyberRefusalFallbackModel,
  ProcessInputStepArgs,
  ProcessInputStepResult,
} from '@mastra/core/processors';
import type { RequestContext } from '@mastra/core/request-context';
import { resolveRequestModelRoute } from '../agents/model.js';
import { MODEL_FALLBACK_PART_TYPE, modelFallbackNoticeText } from './account-rotation-processor.js';
import type { ModelFallbackPartData } from './account-rotation-processor.js';

type RouteEntry = { id?: unknown; label?: unknown; modelId?: unknown };
type RouteState = {
  modelRoute?: { entries?: RouteEntry[]; cyberFallback?: RouteEntry };
  mastracodePendingModelFallback?: { toEntryId?: unknown; toModelId?: unknown; threadId?: unknown } | null;
};
type FallbackTarget = { id: string; label: string; modelId: string };

function toTarget(entry: RouteEntry | undefined): FallbackTarget | undefined {
  if (!entry) return undefined;
  const { id, label, modelId } = entry;
  if (typeof id !== 'string' || typeof modelId !== 'string' || !id || !modelId) return undefined;
  return { id, modelId, label: typeof label === 'string' && label ? label : modelId };
}

export interface MastraCodeCyberRefusalHandlerOptions {
  /** Resolve a model id the way the agent's own model is resolved for this request. */
  resolveModel: (modelId: string, requestContext: RequestContext) => Promise<CyberRefusalFallbackModel>;
}

/**
 * Picks where a cyber refusal goes once the `continue` nudge fails: the active
 * pack's cyber fallback when one is set (tried once), otherwise the next pack in
 * its fallback chain. The switch lasts for the rest of the run only, and the
 * transcript gets the same "Switched model pack" notice as an outage hop.
 */
export class MastraCodeCyberRefusalHandler extends CyberRefusalHandler {
  readonly #notices = new WeakMap<RequestContext, ModelFallbackPartData>();
  readonly #lastTarget = new WeakMap<RequestContext, FallbackTarget>();

  constructor({ resolveModel }: MastraCodeCyberRefusalHandlerOptions) {
    super({
      fallbackModels: context => this.#pickFallback(context, resolveModel),
    });
  }

  override async processInputStep(args: ProcessInputStepArgs): Promise<ProcessInputStepResult | undefined> {
    const notice = args.requestContext ? this.#notices.get(args.requestContext) : undefined;
    if (notice && args.requestContext) {
      this.#notices.delete(args.requestContext);
      await args.writer?.custom({ type: MODEL_FALLBACK_PART_TYPE, data: notice });
      const controller = args.requestContext.get('controller') as
        | { emitEvent?: (event: { type: 'info'; message: string }) => void }
        | undefined;
      controller?.emitEvent?.({ type: 'info', message: modelFallbackNoticeText(notice) });
    }
    return super.processInputStep(args);
  }

  async #pickFallback(
    { attempt, requestContext }: CyberRefusalFallbackContext,
    resolveModel: MastraCodeCyberRefusalHandlerOptions['resolveModel'],
  ): Promise<CyberRefusalFallbackModel | undefined> {
    if (!requestContext) return undefined;
    const controller = requestContext.get('controller') as AgentControllerRequestContext<any> | undefined;
    const state = controller?.getState?.() as RouteState | undefined;
    const { modelId, route, startIndex } = resolveRequestModelRoute(
      state,
      controller?.threadId,
      controller?.session?.modelId,
    );

    const cyberFallback = toTarget(state?.modelRoute?.cyberFallback);
    const target = cyberFallback
      ? attempt === 0
        ? cyberFallback
        : undefined
      : startIndex === undefined
        ? undefined
        : toTarget(route?.[startIndex + 1 + attempt]);
    if (!target) return undefined;

    const current =
      this.#lastTarget.get(requestContext) ??
      toTarget(startIndex === undefined ? route?.find(entry => entry.modelId === modelId) : route?.[startIndex]) ??
      (modelId ? { id: modelId, label: modelId, modelId } : undefined);
    if (!current) return undefined;

    let model: CyberRefusalFallbackModel;
    try {
      model = await resolveModel(target.modelId, requestContext);
    } catch {
      return undefined;
    }
    this.#lastTarget.set(requestContext, target);
    this.#notices.set(requestContext, {
      from: { entryId: current.id, label: current.label },
      to: { entryId: target.id, label: target.label },
      reason: 'refusal',
      at: new Date().toISOString(),
    });
    return model;
  }
}
