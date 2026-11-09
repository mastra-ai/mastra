import { SPEC_DATA_PART_TYPE } from '@json-render/core';
import { JSONUIProvider } from '@json-render/react';
import type { EventHandle } from '@json-render/react';
import { normalizeToolPart, partialArgsOf, validate, validateModelInput } from '@mastra/client-js/gen-ui';
import type { NormalizedToolCall } from '@mastra/client-js/gen-ui';
import type { ReactNode } from 'react';
import type { z } from 'zod/v4';
import type { DataPart, DynamicToolPart, MessageRenderers, ToolInvocationPart } from '../ui/MessageFactory/types';
import { GenUIProvider, GenUIToolCallScope, useGenUIController, useGenUIToolApproval } from './context';
import type { GenUIController } from './controller';
import type { GenUIToolCallProps, GenUIToolPhase } from './registry';
import { GenUIDataSpecView, GenUIErrorBoundary, GenUISpecView, resolveFallbacks } from './spec-view';

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
    <JSONUIProvider
      registry={controller.registry.registry}
      validationFunctions={controller.registry.validationFunctions}
    >
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

/** GenUI's context and a boundary so a throwing component only takes down its own part. */
export function frame(controller: GenUIController, name: string, resetKey: unknown, view: ReactNode) {
  const { Fallback } = resolveFallbacks(controller.registry.fallbacks);
  return (
    <GenUIProvider controller={controller}>
      <GenUIErrorBoundary
        resetKey={resetKey}
        fallback={() => <Fallback kind="render-error" component={name} reason={`"${name}" could not be displayed.`} />}
      >
        {view}
      </GenUIErrorBoundary>
    </GenUIProvider>
  );
}

function renderToolCall(controller: GenUIController, call: NormalizedToolCall): ReactNode | undefined {
  const { registry } = controller;
  let view: ReactNode;
  if (registry.specTool?.name === call.toolName || registry.specTool?.edit?.name === call.toolName) {
    view = <GenUISpecView call={call} />;
  } else if (registry.componentTools[call.toolName]) {
    view = <ComponentToolView call={call} componentName={registry.componentTools[call.toolName]!} />;
  } else if (registry.tools[call.toolName]) view = <BackendToolView call={call} />;
  else return undefined;
  return frame(
    controller,
    call.toolName,
    call,
    <GenUIToolCallScope toolCallId={call.toolCallId}>{view}</GenUIToolCallScope>,
  );
}

/**
 * MessageFactory renderers for GenUI parts: GenUI tool calls and json-render `data-spec` parts. Parts GenUI
 * does not own are passed to `base`, and when `base` has no renderer for them they fall through to
 * MessageFactory's own `fallback` as before.
 *
 * @experimental Generative UI is in beta and may change without notice.
 */
export function createGenUIRenderers(
  controller: GenUIController,
  base: MessageRenderers = {},
): Required<Pick<MessageRenderers, 'ToolInvocation' | 'DynamicTool' | 'Data'>> {
  return {
    ToolInvocation: (part: ToolInvocationPart) => {
      const call = normalizeToolPart(part);
      return (call && renderToolCall(controller, call)) ?? base.ToolInvocation?.(part);
    },
    DynamicTool: (part: DynamicToolPart) => {
      const call = normalizeToolPart(part);
      return (call && renderToolCall(controller, call)) ?? base.DynamicTool?.(part);
    },
    Data: (part: DataPart) => {
      if (part.type !== SPEC_DATA_PART_TYPE) return base.Data?.(part);
      // Always mounted: the view finds its message once the controller has synced the part.
      return frame(controller, SPEC_DATA_PART_TYPE, part, <GenUIDataSpecView part={part} />);
    },
  };
}
