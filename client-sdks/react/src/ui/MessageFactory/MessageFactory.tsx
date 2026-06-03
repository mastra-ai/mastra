import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import type { ReactNode } from 'react';
import { memo } from 'react';
import type { AccumulatorPart } from '../../lib/mastra-db';
import type {
  DataPart,
  DynamicToolPart,
  MessageRenderers,
  MessageRoleRendererProps,
  MessageRoleRenderers,
} from './types';

export interface MessageFactoryProps extends MessageRenderers {
  /** The message whose `content.parts` are rendered. */
  message: MastraDBMessage;
  /** Optional wrappers keyed off `message.role`. */
  roles?: MessageRoleRenderers;
  /** Rendered for any part that has no matching renderer. Defaults to `null`. */
  fallback?: (part: AccumulatorPart | DynamicToolPart) => ReactNode;
}

/** A part as it actually appears at runtime, including boundary-cast tool parts. */
type RuntimePart = AccumulatorPart | DynamicToolPart;

const isDynamicToolPart = (part: RuntimePart): part is DynamicToolPart =>
  // `tool-invocation` is the v4 typed discriminant and must NOT be treated as a
  // v5 `tool-${string}` streaming part, even though it shares the `tool-` prefix.
  part.type === 'dynamic-tool' || (part.type.startsWith('tool-') && part.type !== 'tool-invocation');

const isDataPart = (part: RuntimePart): part is DataPart => part.type.startsWith('data-');

/**
 * Resolve a stable key for a part so unchanged parts keep their identity across
 * streaming updates (and don't needlessly re-render).
 */
const getPartKey = (part: RuntimePart, index: number): string => {
  if (isDynamicToolPart(part)) {
    return part.toolCallId ?? `${part.type}-${index}`;
  }
  switch (part.type) {
    case 'text':
      return (part as { textId?: string }).textId ?? `text-${index}`;
    case 'reasoning':
      return (part as { reasoningId?: string }).reasoningId ?? `reasoning-${index}`;
    case 'tool-invocation':
      return part.toolInvocation.toolCallId ?? `tool-invocation-${index}`;
    default:
      break;
  }
  const id = (part as { id?: string }).id;
  return id ?? `${part.type}-${index}`;
};

/**
 * Dispatch a single part to the one matching renderer. Only the renderer whose
 * discriminant matches `part.type` is invoked, so unrelated renderers never run
 * for a given part. Returns `fallback?.(part) ?? null` when no renderer matches.
 */
const renderPart = (
  part: RuntimePart,
  renderers: MessageRenderers,
  fallback?: MessageFactoryProps['fallback'],
): ReactNode => {
  // Runtime-only tool parts (`dynamic-tool` / `tool-${string}`) are not in the
  // typed union, so they are dispatched explicitly before the typed switch.
  if (isDynamicToolPart(part)) {
    return renderers.DynamicTool?.(part) ?? fallback?.(part) ?? null;
  }

  // `data-${string}` cannot be a `case` label, so match it by prefix first.
  if (isDataPart(part)) {
    return renderers.Data?.(part) ?? fallback?.(part) ?? null;
  }

  switch (part.type) {
    case 'text':
      return renderers.Text?.(part) ?? fallback?.(part) ?? null;
    case 'reasoning':
      return renderers.Reasoning?.(part) ?? fallback?.(part) ?? null;
    case 'file':
      return renderers.File?.(part) ?? fallback?.(part) ?? null;
    case 'step-start':
      return renderers.StepStart?.(part) ?? fallback?.(part) ?? null;
    case 'tool-invocation':
      return renderers.ToolInvocation?.(part) ?? fallback?.(part) ?? null;
    case 'source':
      return renderers.SourceUrl?.(part) ?? fallback?.(part) ?? null;
    case 'source-document':
      return renderers.SourceDocument?.(part) ?? fallback?.(part) ?? null;
    default: {
      // Compile-time exhaustiveness: if a new TYPED part discriminant is added
      // to the union and not handled above, this assignment fails to compile.
      const _exhaustive: never = part;
      void _exhaustive;
      // Runtime-only / unrecognized parts degrade gracefully.
      return fallback?.(part) ?? null;
    }
  }
};

interface PartRendererProps {
  part: RuntimePart;
  renderers: MessageRenderers;
  fallback?: MessageFactoryProps['fallback'];
}

/**
 * Memoized per-part renderer. Keeping each part isolated means a streaming
 * update to one part does not re-render the completed parts around it.
 */
const PartRenderer = memo(({ part, renderers, fallback }: PartRendererProps) => (
  <>{renderPart(part, renderers, fallback)}</>
));
PartRenderer.displayName = 'PartRenderer';

const roleRendererFor = (
  role: MastraDBMessage['role'],
  roles?: MessageRoleRenderers,
): ((props: MessageRoleRendererProps) => ReactNode) | undefined => {
  switch (role) {
    case 'user':
      return roles?.User;
    case 'assistant':
      return roles?.Assistant;
    case 'system':
      return roles?.System;
    case 'signal':
      return roles?.Signal;
    default:
      return undefined;
  }
};

const MessageFactoryComponent = ({ message, roles, fallback, ...renderers }: MessageFactoryProps) => {
  const parts = (message.content.parts ?? []) as RuntimePart[];

  const content = (
    <>
      {parts.map((part, index) => (
        <PartRenderer key={getPartKey(part, index)} part={part} renderers={renderers} fallback={fallback} />
      ))}
    </>
  );

  const RoleWrapper = roleRendererFor(message.role, roles);
  if (RoleWrapper) {
    return <>{RoleWrapper({ message, children: content })}</>;
  }

  return content;
};

/**
 * Renders a single {@link MastraDBMessage} by dispatching each part in
 * `content.parts` to an optional, type-safe, per-part-type render function.
 * Only the renderer matching a part's `type` is invoked, and each renderer
 * receives fully narrowed props.
 */
export const MessageFactory = memo(MessageFactoryComponent);
MessageFactory.displayName = 'MessageFactory';
