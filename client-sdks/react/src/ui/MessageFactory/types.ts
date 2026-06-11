import type { MastraDBMessage, AIV5Type } from '@mastra/core/agent/message-list';
import type { IsTaskCompletePayload } from '@mastra/core/stream';
import type { ReactNode } from 'react';
import type { AccumulatorPart, MastraReasoningPart, MastraTextPart, TripwireMetadata } from '../../lib/mastra-db';

/**
 * Extract the concrete part shape for a given discriminant from the runtime
 * accumulator union. Deriving from the already-concrete `AccumulatorPart`
 * (rather than the deeply-generic v4/v5 types) keeps these helpers cheap and
 * avoids TS2589 ("type instantiation is excessively deep") at the call sites.
 */
export type PartByType<T extends string> = Extract<AccumulatorPart, { type: T }>;

type TextRuntimeExtensions = Partial<Pick<MastraTextPart, 'textId' | 'state' | 'providerMetadata' | 'createdAt'>>;
type ReasoningRuntimeExtensions = Partial<
  Pick<MastraReasoningPart, 'reasoningId' | 'state' | 'redacted' | 'providerMetadata' | 'createdAt'>
>;

/** Narrowed part shape passed to the `Text` renderer. */
export type TextPart = Omit<PartByType<'text'>, keyof TextRuntimeExtensions> & TextRuntimeExtensions;
/** Narrowed part shape passed to the `Reasoning` renderer. */
export type ReasoningPart = Omit<PartByType<'reasoning'>, keyof ReasoningRuntimeExtensions> & ReasoningRuntimeExtensions;
/** Narrowed part shape passed to the `File` renderer. */
export type FilePart = PartByType<'file'>;
/** Narrowed part shape passed to the `StepStart` renderer. */
export type StepStartPart = PartByType<'step-start'>;
/** Narrowed part shape passed to the `ToolInvocation` renderer. */
export type ToolInvocationPart = PartByType<'tool-invocation'>;
/** Narrowed part shape passed to the `SourceDocument` renderer. */
export type SourceDocumentPart = PartByType<'source-document'>;
/**
 * Flat `source-url` citation shape passed to the `SourceUrl` renderer. Both the
 * runtime `type: 'source-url'` part and the legacy persisted `type: 'source'`
 * part (normalized) are dispatched with this shape.
 */
export type SourceUrlPart = AIV5Type.SourceUrlUIPart;

/**
 * The `data-${string}` member of the accumulator union (e.g. `data-signal`,
 * `data-om-observation`). Matched at runtime via `type.startsWith('data-')`.
 */
export type DataPart = Extract<AccumulatorPart, { type: `data-${string}` }>;

/**
 * Runtime-only tool part shape. `dynamic-tool` and the AI SDK v5 `tool-${string}`
 * streaming variant are NOT members of the typed `MastraMessagePart` /
 * `AccumulatorPart` union — the accumulator stores them via a boundary cast
 * during network/agent-execution and OM (observational memory) flows
 * (`src/lib/mastra-db/accumulator.ts`). They share the same structural fields
 * and are treated identically by the agent-builder playground, so a single
 * `DynamicTool` renderer covers both. Declared here explicitly because
 * `Extract<AccumulatorPart, { type: 'dynamic-tool' }>` resolves to `never`.
 */
export type DynamicToolPart = {
  type: 'dynamic-tool' | `tool-${string}`;
  toolName?: string;
  toolCallId?: string;
  state?: string;
  input?: unknown;
  output?: unknown;
};

/**
 * Every part shape `MessageFactory` can dispatch at runtime: the typed
 * accumulator union plus the boundary-cast `dynamic-tool` / `tool-${string}`
 * parts. This is the single source of truth for the factory's internal
 * `RuntimePart` and the precise union consumers (e.g. Storybook) should type
 * part arrays against instead of `unknown[]`.
 */
export type MessageFactoryPart = AccumulatorPart | DynamicToolPart;

/**
 * Optional, per-part-type render functions. Each renderer receives the exact
 * narrowed part shape for its discriminant, so destructuring is fully
 * type-checked and only the renderer matching a part's `type` is ever invoked.
 */
export type MessageRenderers = {
  Text?: (part: TextPart) => ReactNode;
  Reasoning?: (part: ReasoningPart) => ReactNode;
  File?: (part: FilePart) => ReactNode;
  StepStart?: (part: StepStartPart) => ReactNode;
  ToolInvocation?: (part: ToolInvocationPart) => ReactNode;
  /**
   * Receives the flat `source-url` citation shape ({@link AIV5Type.SourceUrlUIPart}).
   * Both the runtime `type: 'source-url'` part and the legacy persisted
   * `type: 'source'` part (whose nested `source` is normalized to this shape)
   * are dispatched here, so the renderer always gets `sourceId`/`url`/`title`.
   */
  SourceUrl?: (part: SourceUrlPart) => ReactNode;
  SourceDocument?: (part: SourceDocumentPart) => ReactNode;
  Data?: (part: DataPart) => ReactNode;
  /** Covers runtime-only `dynamic-tool` and AI SDK v5 `tool-${string}` parts. */
  DynamicTool?: (part: DynamicToolPart) => ReactNode;
};

/**
 * Props passed to an optional role-level wrapper. `children` is the rendered
 * list of parts; the wrapper decides how to frame them for the message role.
 */
export type MessageRoleRendererProps = {
  message: MastraDBMessage;
  children: ReactNode;
};

/**
 * Optional wrappers keyed off `message.role`. When omitted, parts render
 * unwrapped (inside a fragment).
 */
export type MessageRoleRenderers = {
  User?: (props: MessageRoleRendererProps) => ReactNode;
  Assistant?: (props: MessageRoleRendererProps) => ReactNode;
  System?: (props: MessageRoleRendererProps) => ReactNode;
  Signal?: (props: MessageRoleRendererProps) => ReactNode;
};

/**
 * Props passed to the `Tripwire` status slot. Rendered *instead of* the parts
 * walk when `message.content.metadata.status === 'tripwire'`. `text` is the
 * message's joined text body (the reason a notice would display).
 */
export type TripwireRendererProps = {
  text: string;
  tripwire?: TripwireMetadata;
  message: MastraDBMessage;
};

/**
 * Props passed to the `Warning` status slot. Rendered *instead of* the parts
 * walk when `message.content.metadata.status === 'warning'`.
 */
export type WarningRendererProps = {
  text: string;
  message: MastraDBMessage;
};

/**
 * Props passed to the `Error` status slot. Rendered *instead of* the parts
 * walk when `message.content.metadata.status === 'error'`.
 */
export type ErrorRendererProps = {
  text: string;
  message: MastraDBMessage;
};

/**
 * Props passed to the `Task` status slot. Rendered *alongside* (after) the
 * parts walk when a task-completion verdict exists on the message metadata
 * (`completionResult ?? isTaskCompleteResult`).
 *
 * Shaped as the persisted subset of {@link IsTaskCompletePayload}: only
 * `passed` and `suppressFeedback` survive persistence (the accumulator writes
 * `completionResult: { passed }`). The richer payload fields (`iteration`,
 * `results`, `duration`, `reason`, ...) are not available from stored metadata.
 */
export type TaskRendererProps = Pick<IsTaskCompletePayload, 'passed'> &
  Partial<Pick<IsTaskCompletePayload, 'suppressFeedback'>> & {
    text: string;
    message: MastraDBMessage;
  };

/**
 * Props passed to the `Pending` status slot. Rendered *wrapping* the parts walk
 * when `message.content.metadata.status === 'pending'`, so the optimistic user
 * bubble still renders inline while the consumer applies a "sending" style.
 */
export type PendingRendererProps = {
  children: ReactNode;
  text: string;
  message: MastraDBMessage;
};

/**
 * Optional message-level slots dispatched off `message.content.metadata`.
 *
 * - `Tripwire` / `Warning` / `Error` are *replacement* slots: when
 *   `metadata.status` matches, the slot renders instead of the parts walk.
 * - `Pending` is a *wrapping* slot: when `metadata.status === 'pending'` the
 *   slot wraps the parts walk so the optimistic bubble renders with a
 *   "sending" style.
 * - `Task` is an *adjacent* slot: when a completion verdict exists it renders
 *   alongside the parts.
 *
 * The factory only reads metadata and forwards it; it never filters (e.g. it
 * still invokes `Task` when `suppressFeedback` is true). The consumer decides
 * what to render or skip.
 */
export type MessageStatusRenderers = {
  Tripwire?: (props: TripwireRendererProps) => ReactNode;
  Warning?: (props: WarningRendererProps) => ReactNode;
  Error?: (props: ErrorRendererProps) => ReactNode;
  Pending?: (props: PendingRendererProps) => ReactNode;
  Task?: (props: TaskRendererProps) => ReactNode;
};
