import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import type { ReactNode } from 'react';
import type { AccumulatorPart } from '../../lib/mastra-db';

/**
 * Extract the concrete part shape for a given discriminant from the runtime
 * accumulator union. Deriving from the already-concrete `AccumulatorPart`
 * (rather than the deeply-generic v4/v5 types) keeps these helpers cheap and
 * avoids TS2589 ("type instantiation is excessively deep") at the call sites.
 */
export type PartByType<T extends string> = Extract<AccumulatorPart, { type: T }>;

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
 * Optional, per-part-type render functions. Each renderer receives the exact
 * narrowed part shape for its discriminant, so destructuring is fully
 * type-checked and only the renderer matching a part's `type` is ever invoked.
 */
export type MessageRenderers = {
  Text?: (part: PartByType<'text'>) => ReactNode;
  Reasoning?: (part: PartByType<'reasoning'>) => ReactNode;
  File?: (part: PartByType<'file'>) => ReactNode;
  StepStart?: (part: PartByType<'step-start'>) => ReactNode;
  ToolInvocation?: (part: PartByType<'tool-invocation'>) => ReactNode;
  SourceUrl?: (part: PartByType<'source'>) => ReactNode;
  SourceDocument?: (part: PartByType<'source-document'>) => ReactNode;
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
