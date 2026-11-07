import { JSONUIProvider } from '@json-render/react';
import type { EventHandle } from '@json-render/react';
import type { ReactNode } from 'react';
import type { z } from 'zod/v4';
import type { DynamicToolPart, MessageRenderers, ToolInvocationPart } from '../ui/MessageFactory/types';
import { GenUIProvider, GenUIToolCallScope, useGenUIController, useGenUIToolApproval } from './context';
import type { GenUIController } from './controller';
import type { GenUIToolCallProps, GenUIToolPhase } from './registry';
import { GenUIErrorBoundary, GenUISpecView, resolveFallbacks } from './spec-view';
import { normalizeToolPart, partialArgsOf } from './tool-parts';
import type { NormalizedToolCall } from './tool-parts';
import { validate, validateModelInput } from './validate';

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
  // Catalog components may use json-render hooks, which need a provider even outside a spec.
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

/** Component tools have no spec to bind actions in, so their events go nowhere. */
const ignoreEvent = () => {};
const UNBOUND: EventHandle = Object.freeze({ emit: ignoreEvent, shouldPreventDefault: false, bound: false });
const unboundEvent = () => UNBOUND;

function renderToolCall(controller: GenUIController, call: NormalizedToolCall): ReactNode | undefined {
  const { registry } = controller;
  let view: ReactNode;
  if (registry.specTool?.name === call.toolName) view = <GenUISpecView call={call} />;
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
): Required<Pick<MessageRenderers, 'ToolInvocation' | 'DynamicTool'>> {
  return {
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
