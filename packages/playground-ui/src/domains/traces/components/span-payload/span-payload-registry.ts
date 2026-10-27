import { SpanType, describeProcessorPipeline, describeSpanInput } from '@mastra/core/observability';
import type { ProcessorRunInputByPhase, ProcessorSpanPayload } from '@mastra/core/observability';
import type { ComponentType } from 'react';
import type { SpanRecord } from '../../types';
import { getSpanSignal } from '@/domains/traces/utils/span-signal';
import type { LinkComponentPaths } from '@/lib/framework';

type CoreSpanRecord = Parameters<typeof describeSpanInput>[0];

type Described = { type: string; value: unknown };

/** A component per description tag, typed against the value that tag carries. */
export type PayloadRegistry<D extends Described> = {
  [T in D['type']]: ComponentType<{ value: Extract<D, { type: T }>['value'] }>;
};

/**
 * Picks the registry entry for `description.type`. The registry is exhaustive by type,
 * so the entry always exists; the cast only erases the per-tag prop refinement TS cannot
 * carry through an indexed lookup.
 */
export function pickRenderer<D extends Described>(
  registry: PayloadRegistry<D>,
  description: D,
): ComponentType<{ value: D['value'] }> {
  return registry[description.type as D['type']] as ComponentType<{ value: D['value'] }>;
}

/**
 * The client-js span (API response: ISO-string dates, string-literal enums) is the core
 * span over the wire. `describeSpan*` only read `spanType`, `metadata`, `input`, `output`
 * and `error`, which are identical in both, so this is the one place the two types meet.
 */
export function asCoreSpan(span: SpanRecord): CoreSpanRecord {
  // oxlint-disable-next-line typescript/no-unnecessary-type-assertion -- Generated SDK and core span types differ once workspace declarations are built.
  return span as unknown as CoreSpanRecord;
}

export const hasItems = (value: unknown): value is unknown[] => Array.isArray(value) && value.length > 0;

/** Whether a span's input has a rendered preview, rather than only its raw JSON. */
export function hasSpanInputPreview(span: SpanRecord): boolean {
  return getSpanSignal(span) !== undefined || describeSpanInput(asCoreSpan(span))?.type !== 'json';
}

const isEmptyObject = (value: unknown) =>
  typeof value === 'object' && value !== null && !Array.isArray(value) && Object.keys(value).length === 0;

/**
 * Whether a processor ran the span. A processor can retype its span (memory
 * recall is a `memory_operation`), so the recorded phase counts as well as the type.
 */
const isProcessorSpan = (span: SpanRecord) =>
  span.spanType === SpanType.PROCESSOR_RUN || describeProcessorPipeline(asCoreSpan(span)) !== undefined;

/**
 * The output to show, or `undefined` when `{}` only means "nothing": a processor
 * that returned nothing, or a chunk that streamed no content (e.g. encrypted reasoning).
 */
export function getSpanOutputPayload(span: SpanRecord): unknown {
  if (isEmptyObject(span.output) && (span.spanType === SpanType.MODEL_CHUNK || isProcessorSpan(span))) {
    return undefined;
  }
  return span.output;
}

const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

export interface ProcessorRunContext {
  stepNumber?: number;
  retryCount?: number;
  /** The assistant message the step is producing, not the user message that started the run. */
  messageId?: string;
}

/**
 * Where in the generation the hook ran. The runner hands these values to every
 * hook, so they are recorded in `input`, but they describe the run rather than
 * what the processor read: Attributes shows them and the input preview skips them.
 * A key is present only when it holds a well-formed value, so a malformed one stays in the input.
 */
export function getProcessorRunContext(input: ProcessorSpanPayload<ProcessorRunInputByPhase>): ProcessorRunContext {
  const { data } = input;
  const stepNumber = 'stepNumber' in data ? data.stepNumber : undefined;
  const retryCount = 'retryCount' in data ? data.retryCount : undefined;
  const messageId = 'messageId' in data ? data.messageId : undefined;
  return {
    ...(isCount(stepNumber) ? { stepNumber } : {}),
    ...(isCount(retryCount) ? { retryCount } : {}),
    ...(typeof messageId === 'string' && messageId.length > 0 ? { messageId } : {}),
  };
}

/** A tool offered to the model, with the id the tool registry knows it by. */
/** Who a tool hands the work to when an agent exposes a workflow or sub-agent as a tool. */
export interface DelegatedTool {
  kind: 'workflow' | 'agent';
  /** The key the agent registered it under, which the workflow and agent pages resolve. */
  key: string;
}

const DELEGATED_TOOL = /^(workflow|agent)-(.+)$/;

/**
 * The workflow or sub-agent behind a tool name, if it is one. Agents expose each
 * workflow they own as `workflow-<key>` and each sub-agent as `agent-<key>`.
 */
export function getDelegatedTool(toolName: string): DelegatedTool | undefined {
  const match = DELEGATED_TOOL.exec(toolName);
  if (!match?.[2]) return undefined;
  return { kind: match[1] === 'workflow' ? 'workflow' : 'agent', key: match[2] };
}

/** The page of the workflow or sub-agent behind a tool name, or `''` when it is neither. */
export function getDelegatedToolHref(paths: LinkComponentPaths, toolName: string): string {
  const delegated = getDelegatedTool(toolName);
  if (!delegated) return '';
  return delegated.kind === 'workflow' ? paths.workflowLink(delegated.key) : paths.agentLink(delegated.key);
}

export interface SpanTool {
  id: string;
  description?: string;
}

export interface SpanTools {
  tools: SpanTool[];
  /** The stored values the list was read from, for the JSON view. */
  raw: { tools: unknown; toolChoice?: unknown };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const textOf = (value: unknown) => (typeof value === 'string' && value.length > 0 ? value : undefined);

/** Processor spans record `{ id, name }`, model spans `{ name }`, agent runs bare names. */
function toTool(value: unknown): SpanTool | undefined {
  if (typeof value === 'string') return value ? { id: value } : undefined;
  if (!isRecord(value)) return undefined;
  const id = textOf(value.id) ?? textOf(value.name);
  if (!id) return undefined;
  const description = textOf(value.description);
  return description ? { id, description } : { id };
}

/**
 * The tools a span offered the model. A processor span records them in its
 * input; model spans record definitions in attributes, agent runs only names.
 */
export function getSpanTools(span: SpanRecord): SpanTools | undefined {
  const input = describeSpanInput(asCoreSpan(span));
  const data: Record<string, unknown> = input?.type === 'processor' ? input.value.data : {};
  const attributes = span.attributes ?? {};
  const [tools, toolChoice] = hasItems(data.tools)
    ? [data.tools, data.toolChoice]
    : hasItems(attributes.tools)
      ? [attributes.tools, attributes.toolChoice]
      : [attributes.availableTools, attributes.toolChoice];
  if (!hasItems(tools)) return undefined;

  const list = tools.map(toTool).filter((tool): tool is SpanTool => tool !== undefined);
  if (list.length === 0) return undefined;
  return { tools: list, raw: toolChoice === undefined ? { tools } : { tools, toolChoice } };
}
