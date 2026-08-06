import type { MastraDBMessage, AIV5Type } from '@mastra/core/agent/message-list';
import type { ReactNode } from 'react';
import { memo } from 'react';
import type { AccumulatorPart, MastraDBMessageMetadata } from '../../lib/mastra-db';
import type {
  DataPart,
  DynamicToolPart,
  MessageFactoryPart,
  MessageRenderers,
  MessageRoleRendererProps,
  MessageRoleRenderers,
  MessageStatusRenderers,
  PartByType,
} from './types';

export interface MessageFactoryProps extends MessageRenderers {
  /** The message whose `content.parts` are rendered. */
  message: MastraDBMessage;
  /** Optional wrappers keyed off `message.role`. */
  roles?: MessageRoleRenderers;
  /** Optional message-level slots dispatched off `message.content.metadata`. */
  status?: MessageStatusRenderers;
  /** Rendered for any part that has no matching renderer. Defaults to `null`. */
  fallback?: (part: AccumulatorPart | DynamicToolPart) => ReactNode;
}

/** A part as it actually appears at runtime, including boundary-cast tool parts. */
type RuntimePart = MessageFactoryPart;

const isDynamicToolPart = (part: RuntimePart): part is DynamicToolPart =>
  // `tool-invocation` is the v4 typed discriminant and must NOT be treated as a
  // v5 `tool-${string}` streaming part, even though it shares the `tool-` prefix.
  part.type === 'dynamic-tool' || (part.type.startsWith('tool-') && part.type !== 'tool-invocation');

const isDataPart = (part: RuntimePart): part is DataPart => part.type.startsWith('data-');

/**
 * Normalize the legacy persisted `type: 'source'` part (nested
 * `source: { id, url, title }`) into the flat `AIV5Type.SourceUrlUIPart` shape
 * the runtime accumulator emits, so the `SourceUrl` renderer receives one
 * stable prop contract regardless of which discriminant produced the citation.
 */
const sourceToSourceUrl = (part: PartByType<'source'>): AIV5Type.SourceUrlUIPart => ({
  type: 'source-url',
  sourceId: part.source.id,
  url: part.source.url,
  title: part.source.title,
  providerMetadata: part.providerMetadata,
});

/**
 * Resolve a stable key for a part so unchanged parts keep their identity across
 * streaming updates (and don't needlessly re-render).
 */
const getPartKey = (part: RuntimePart, index: number): string => {
  if (isDynamicToolPart(part)) {
    return part.toolCallId ?? `${part.type}-${index}`;
  }
  switch (part.type) {
    case 'text': {
      // Intrinsic cast: the `'text'`-narrowed member is `(v4 text part) | MastraTextPart`;
      // only `MastraTextPart` carries `textId`, so this is an optional structural read.
      // Include index so two segments with the same textId (e.g. DeepSeek reuses txt-0)
      // get distinct keys after interleaved tool calls.
      // NOTE: mixing index into the key assumes parts are append-only during
      // streaming (they are today — the accumulator only pushes). If a part is
      // ever inserted ahead of a streaming text block, the trailing indices shift
      // and those text nodes remount. Revisit this key if insertion is added.
      const textId = (part as { textId?: string }).textId;
      return textId ? `${textId}-${index}` : `text-${index}`;
    }
    case 'reasoning':
      // Intrinsic cast: same as `textId` — only the Mastra reasoning member has `reasoningId`.
      return (part as { reasoningId?: string }).reasoningId ?? `reasoning-${index}`;
    case 'tool-invocation':
      return part.toolInvocation.toolCallId ?? `tool-invocation-${index}`;
    case 'source-url':
      return part.sourceId || `source-url-${index}`;
    case 'source':
      return part.source.id ?? `source-${index}`;
    default:
      break;
  }
  // Intrinsic cast: fallback key over a heterogeneous union whose members do not
  // share an `id` field; an optional structural read is the minimal honest form.
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
      // `step-start` is an internal step-framing marker with no user-facing
      // content. Absent an explicit opt-in renderer it renders nothing and is
      // intentionally NOT routed to `fallback`.
      return renderers.StepStart?.(part) ?? null;
    case 'tool-invocation':
      return renderers.ToolInvocation?.(part) ?? fallback?.(part) ?? null;
    case 'source':
      // Legacy nested `type: 'source'` part — normalize to the flat shape the
      // `SourceUrl` renderer expects so both discriminants share one contract.
      return renderers.SourceUrl?.(sourceToSourceUrl(part)) ?? fallback?.(part) ?? null;
    case 'source-url':
      // Flat runtime/V5 citation part emitted by the accumulator.
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

/**
 * Concatenate the text of every `text` part into a single string. Used as the
 * body forwarded to the replacement (`Tripwire`/`Warning`/`Error`) and adjacent
 * (`Task`) status slots, so consumers don't re-derive it from parts.
 */
const joinText = (parts: RuntimePart[]): string =>
  parts
    .filter((part): part is PartByType<'text'> => part.type === 'text')
    .map(part => part.text)
    .join('');

/**
 * Normalize the two task-completion metadata fields into one
 * `{ passed, suppressFeedback }` verdict, or `undefined` when neither is set.
 * `completionResult` (network mode) takes precedence; `isTaskCompleteResult`
 * (supervisor mode) is the fallback. Both share the same persisted shape.
 */
const resolveTaskVerdict = (
  metadata: MastraDBMessageMetadata | undefined,
): { passed: boolean; suppressFeedback?: boolean } | undefined => {
  const verdict = metadata?.completionResult ?? metadata?.isTaskCompleteResult;
  if (!verdict) return undefined;
  return { passed: !!verdict.passed, suppressFeedback: verdict.suppressFeedback };
};

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

const MessageFactoryComponent = ({ message, roles, status, fallback, ...renderers }: MessageFactoryProps) => {
  // `MastraMessagePart[]` widens into `RuntimePart[]` (`AccumulatorPart` is a
  // member of `MessageFactoryPart`), so no cast is needed here.
  const parts: RuntimePart[] = message.content.parts ?? [];
  // Intrinsic cast: core types `content.metadata` as `Record<string, unknown>`
  // (message-list/state/types.ts), so narrowing to the SDK's typed metadata
  // shape requires a cast. This matches the convention used across the accumulator.
  const metadata = message.content.metadata as MastraDBMessageMetadata | undefined;

  // Replacement status slots: when the message-level status matches and a slot
  // is provided, the slot renders *instead of* the parts walk. If the status
  // matches but no slot is provided, fall through to the normal parts walk.
  let content: ReactNode;
  if (metadata?.status === 'tripwire' && status?.Tripwire) {
    content = status.Tripwire({ text: joinText(parts), tripwire: metadata.tripwire, message });
  } else if (metadata?.status === 'warning' && status?.Warning) {
    content = status.Warning({ text: joinText(parts), message });
  } else if (metadata?.status === 'error' && status?.Error) {
    content = status.Error({ text: joinText(parts), message });
  } else {
    content = (
      <>
        {parts.map((part, index) => (
          <PartRenderer key={getPartKey(part, index)} part={part} renderers={renderers} fallback={fallback} />
        ))}
      </>
    );

    // Wrapping `Pending` slot: when the optimistic user bubble is still
    // "sending", wrap the parts walk so the consumer can apply a sending style
    // without the message disappearing from the list.
    if (metadata?.status === 'pending' && status?.Pending) {
      content = status.Pending({ children: content, text: joinText(parts), message });
    }

    // Adjacent `Task` slot: when a completion verdict exists it renders after
    // the parts. The factory always invokes `Task` when a verdict is present —
    // it does not filter on `suppressFeedback` (the consumer decides).
    const verdict = resolveTaskVerdict(metadata);
    if (verdict && status?.Task) {
      content = (
        <>
          {content}
          {status.Task({ ...verdict, text: joinText(parts), message })}
        </>
      );
    }
  }

  const RoleWrapper = roleRendererFor(message.role, roles);
  if (RoleWrapper) {
    return <>{RoleWrapper({ message, children: content })}</>;
  }

  return <>{content}</>;
};

/**
 * Renders a single {@link MastraDBMessage} by dispatching each part in
 * `content.parts` to an optional, type-safe, per-part-type render function.
 * Only the renderer matching a part's `type` is invoked, and each renderer
 * receives fully narrowed props.
 */
export const MessageFactory = memo(MessageFactoryComponent);
MessageFactory.displayName = 'MessageFactory';
