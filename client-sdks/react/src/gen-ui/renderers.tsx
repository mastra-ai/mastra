import { JSONUIProvider } from '@json-render/react';
import type { EventHandle } from '@json-render/react';
import { GENUI_DATA_PART_TYPE, parsePartialJSON } from '@mastra/client-js/gen-ui';
import type { GenUISurface, JSONObject, JSONValue } from '@mastra/client-js/gen-ui';
import { useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import type { z } from 'zod/v4';
import type { DataPart, DynamicToolPart, MessageRenderers, ToolInvocationPart } from '../ui/MessageFactory/types';
import { GenUIProvider, GenUIToolCallScope, useGenUIController, useGenUIToolApproval } from './context';
import type { GenUIController } from './controller';
import type { GenUIToolCallProps, GenUIToolPhase } from './registry';
import { GenUIErrorBoundary, SurfaceFrame, resolveFallbacks } from './surface';
import { normalizeToolPart } from './tool-parts';
import type { NormalizedToolCall } from './tool-parts';
import { validate, validateModelInput } from './validate';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function isJSONValue(value: unknown): value is JSONValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJSONValue);
  return isJSONObject(value);
}

function isJSONObject(value: unknown): value is JSONObject {
  return isRecord(value) && Object.values(value).every(isJSONValue);
}

function partialArgsOf(call: NormalizedToolCall): JSONObject | undefined {
  const value =
    call.phase === 'input-streaming' && call.argsText !== undefined ? parsePartialJSON(call.argsText).value : call.args;
  return isJSONObject(value) ? value : undefined;
}

/**
 * Inline anchor for a `data-gen-ui` part: draws the surface this event created, nothing otherwise.
 * `preview` stands in until the controller has that surface.
 */
function SurfaceAnchor({ eventId, envelope, preview }: { eventId: string; envelope?: object; preview?: GenUISurface }) {
  const controller = useGenUIController();
  // A reconnect may replay an event in a later message; only its first part draws the surface.
  const isAnchor = () => !envelope || controller.isAnchor(eventId, envelope);
  const getSurfaceId = () => {
    if (!isAnchor()) return undefined;
    const state = controller.getState();
    return state.surfaceOrder.find(id => state.surfaces[id]?.anchorEventId === eventId);
  };
  const getRejection = () =>
    isAnchor() ? controller.getState().diagnostics.find(d => d.eventId === eventId)?.message : undefined;
  const getPlacement = () => {
    const id = getSurfaceId();
    return id ? controller.getState().surfaces[id]?.placement : undefined;
  };
  const surfaceId = useSyncExternalStore(controller.subscribe, getSurfaceId, getSurfaceId);
  const rejection = useSyncExternalStore(controller.subscribe, getRejection, getRejection);
  const placement = useSyncExternalStore(controller.subscribe, getPlacement, getPlacement);
  const { Fallback } = resolveFallbacks(controller.registry.fallbacks);
  if (surfaceId) return placement === 'inline' ? <SurfaceFrame surfaceId={surfaceId} /> : null;
  if (preview) return <SurfaceFrame surfaceId={preview.id} preview={preview} />;
  if (rejection)
    return <Fallback kind="invalid-surface" reason={`This interface could not be displayed: ${rejection}`} />;
  return null;
}

function resolvePhase(call: NormalizedToolCall, approvalKind: 'approval' | 'suspended' | undefined): GenUIToolPhase {
  // A finished call wins over approval metadata that may linger in hydrated history.
  if (call.phase === 'output-available' || call.phase === 'output-error' || call.phase === 'output-denied') {
    return call.phase;
  }
  if (approvalKind === 'approval') return 'awaiting-approval';
  if (approvalKind === 'suspended') return 'suspended';
  return call.phase;
}

function validateOptional(schema: z.ZodType | undefined, value: unknown, fromModel = false) {
  if (value === undefined) return { value: undefined };
  if (!schema) return { value };
  const result = fromModel ? validateModelInput(schema, value) : validate(schema, value);
  return result.ok ? { value: result.value } : { value: undefined, error: result.error };
}

/** Custom UI for an existing backend tool. */
function BackendToolView({ call }: { call: NormalizedToolCall }) {
  const controller = useGenUIController();
  const definition = controller.registry.tools[call.toolName]!;
  const approval = useGenUIToolApproval(call.toolCallId);
  const phase = resolvePhase(call, approval?.kind);
  const partialArgs = partialArgsOf(call);
  const args =
    phase === 'input-streaming' ? { value: undefined } : validateOptional(definition.argsSchema, call.args, true);
  const output =
    phase === 'output-available' ? validateOptional(definition.outputSchema, call.output) : { value: undefined };
  const validationError = args.error
    ? `invalid arguments: ${args.error}`
    : output.error
      ? `invalid output: ${output.error}`
      : undefined;
  const props: GenUIToolCallProps<unknown, unknown> = {
    toolCallId: call.toolCallId,
    toolName: call.toolName,
    phase,
    partialArgs,
    args: args.value,
    output: output.value,
    ...(call.errorText ? { errorText: call.errorText } : {}),
    ...(validationError ? { validationError } : {}),
    ...(approval && phase !== 'output-available' && phase !== 'output-error' && phase !== 'output-denied'
      ? { approval }
      : {}),
  };
  const Rendered = definition.component;
  return <Rendered {...props} />;
}

/** A catalog component the model invoked as a frontend tool. */
function ComponentToolView({ call, componentName }: { call: NormalizedToolCall; componentName: string }) {
  const controller = useGenUIController();
  const entry = controller.registry.components[componentName]!;
  const Rendered = controller.registry.registry[componentName]!;
  const { Fallback, Loading } = resolveFallbacks(controller.registry.fallbacks);
  const partialArgs = partialArgsOf(call);
  const validation = call.phase === 'input-streaming' ? undefined : controller.validateProps(componentName, call.args);

  if (!validation) {
    const Streaming = entry.tool?.streaming;
    return Streaming && partialArgs ? <Streaming partialProps={partialArgs} /> : <Loading component={componentName} />;
  }
  if (!validation.ok) {
    return (
      <Fallback
        kind="invalid-props"
        component={componentName}
        reason={`"${componentName}" received invalid data: ${validation.error}`}
      />
    );
  }
  // Catalog components may use json-render hooks, which need a provider even without a surface.
  return (
    <JSONUIProvider registry={controller.registry.registry}>
      <Rendered
        element={{ type: componentName, props: validation.value as Record<string, unknown> }}
        emit={ignoreEvent}
        on={unboundEvent}
        loading={false}
      />
    </JSONUIProvider>
  );
}

/** Component tools have no surface to bind actions in, so their events go nowhere. */
const ignoreEvent = () => {};
const UNBOUND: EventHandle = Object.freeze({ emit: ignoreEvent, shouldPreventDefault: false, bound: false });
const unboundEvent = () => UNBOUND;

/** The surface created by a surface tool call, anchored at the call's position in the message. */
function SurfaceToolView({ call }: { call: NormalizedToolCall }) {
  const controller = useGenUIController();
  const { Loading } = resolveFallbacks(controller.registry.fallbacks);
  const preview = controller.previewSurface(call);
  // Surfaces placed outside the message show up in their outlet once complete.
  const inlinePreview = preview?.placement === 'inline' ? preview : undefined;
  if (call.phase === 'input-streaming' && !inlinePreview) return <Loading />;
  return <SurfaceAnchor eventId={`tool:${call.toolCallId}`} preview={inlinePreview} />;
}

function renderToolCall(controller: GenUIController, call: NormalizedToolCall): ReactNode | undefined {
  const { registry } = controller;
  let view: ReactNode;
  if (registry.surfaceTool?.name === call.toolName) view = <SurfaceToolView call={call} />;
  else if (registry.componentTools[call.toolName]) {
    view = <ComponentToolView call={call} componentName={registry.componentTools[call.toolName]!} />;
  } else if (registry.tools[call.toolName]) view = <BackendToolView call={call} />;
  else return undefined;

  const { Fallback } = resolveFallbacks(registry.fallbacks);
  return (
    <GenUIProvider controller={controller}>
      <GenUIToolCallScope toolCallId={call.toolCallId}>
        <GenUIErrorBoundary
          resetKey={call}
          fallback={() => (
            <Fallback
              kind="render-error"
              component={call.toolName}
              reason={`"${call.toolName}" could not be displayed.`}
            />
          )}
        >
          {view}
        </GenUIErrorBoundary>
      </GenUIToolCallScope>
    </GenUIProvider>
  );
}

/**
 * MessageFactory renderers for GenUI parts. Parts GenUI does not own are passed to `base`, and when
 * `base` has no renderer for them they fall through to MessageFactory's own `fallback` as before.
 *
 * @experimental Generative UI is in beta and may change without notice.
 */
export function createGenUIRenderers(
  controller: GenUIController,
  base: MessageRenderers = {},
): Required<Pick<MessageRenderers, 'Data' | 'ToolInvocation' | 'DynamicTool'>> {
  return {
    Data: (part: DataPart) => {
      if (part.type !== GENUI_DATA_PART_TYPE) return base.Data?.(part);
      const envelope = isRecord(part.data) ? part.data : undefined;
      // `false` renders nothing without falling through to MessageFactory's fallback.
      if (!envelope || typeof envelope.eventId !== 'string') return false;
      return (
        <GenUIProvider controller={controller}>
          <SurfaceAnchor eventId={envelope.eventId} envelope={envelope} />
        </GenUIProvider>
      );
    },
    ToolInvocation: (part: ToolInvocationPart) => {
      const call = normalizeToolPart(part);
      return (call && renderToolCall(controller, call)) ?? base.ToolInvocation?.(part);
    },
    DynamicTool: (part: DynamicToolPart) => {
      const call = normalizeToolPart(part);
      return (call && renderToolCall(controller, call)) ?? base.DynamicTool?.(part);
    },
  };
}
