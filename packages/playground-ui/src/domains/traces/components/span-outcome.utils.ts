import { SpanType, describeProcessorPipeline, describeSpanError } from '@mastra/core/observability';
import type { ProcessorPipelineDescription } from '@mastra/core/observability';
import type { SpanRecord } from '../types';
import { getInputPreview } from '../utils/span-utils';
import { getRequestedToolCalls } from './format-trace-thread-messages';
import { asCoreSpan } from './span-payload/span-payload-registry';
import { isHiddenTool } from '@/domains/chat/tools/tool-card-kind';
import { pluralize } from '@/lib/string';

export type SpanOutcomeTone = 'neutral' | 'success' | 'change' | 'warning' | 'error';

/** What a span did, in the words a reader looks for first, ahead of its raw payloads. */
export interface SpanOutcome {
  headline: string;
  /** One line quoting what the span produced (a reply, a result, an error message). */
  detail?: string;
  tone: SpanOutcomeTone;
  /** The section that proves the outcome, which the panel shows first. */
  evidence?: SpanOutcomeEvidence;
}

export type SpanOutcomeEvidence = 'output' | 'changes' | 'toolCalls' | 'error';

const MODEL_TYPES: ReadonlySet<string> = new Set([
  SpanType.MODEL_GENERATION,
  SpanType.MODEL_STEP,
  SpanType.MODEL_INFERENCE,
]);
const TOOL_TYPES: ReadonlySet<string> = new Set([SpanType.TOOL_CALL, SpanType.MCP_TOOL_CALL]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asText = (value: unknown) => (typeof value === 'string' && value.trim() !== '' ? value : undefined);

const isPrimitive = (value: unknown): value is string | number | boolean =>
  typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';

/** The first non-empty line of a text, trimmed to fit a single row. */
function firstLine(text: string | undefined, max = 160): string | undefined {
  const line = text
    ?.split('\n')
    .map(part => part.trim())
    .find(Boolean);
  if (!line) return undefined;
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}

/** `key: value` of an object's first scalar fields, as one line. */
function scalarPreview(value: unknown, limit: number): string | undefined {
  if (!isRecord(value)) return undefined;
  const fields = Object.entries(value)
    .filter(entry => isPrimitive(entry[1]))
    .slice(0, limit)
    .map(([label, field]) => `${label}: ${String(field)}`);
  return fields.length > 0 ? fields.join(' · ') : undefined;
}

/** Get the outcome of a span, or `undefined` for spans that have nothing to lead with. */
export function getSpanOutcome(span: SpanRecord): SpanOutcome | undefined {
  const outcome = describeOutcome(span);
  const error = describeSpanError(asCoreSpan(span));
  if (!error) return outcome;
  return {
    ...outcome,
    // The error itself sits under the headline, with its details.
    headline: `${failedSubject(span)} failed`,
    detail: undefined,
    tone: 'error',
    evidence: 'error',
  };
}

function failedSubject(span: SpanRecord): string {
  const model = isRecord(span.attributes) ? asText(span.attributes.model) : undefined;
  return (MODEL_TYPES.has(span.spanType ?? '') ? model : undefined) ?? actorOf(span, asText(span.name) ?? 'The span');
}

function describeOutcome(span: SpanRecord): SpanOutcome | undefined {
  const type = span.spanType ?? '';
  const pipeline = describeProcessorPipeline(asCoreSpan(span));
  if (pipeline) return describePipeline(span, pipeline);
  if (MODEL_TYPES.has(type)) {
    // The calls a model made are what it did; the answer it wrote after them stays in the output.
    const calledTools = getRequestedToolCalls(span).some(call => !isHiddenTool(call.toolName));
    return { ...describeModel(span), evidence: calledTools ? 'toolCalls' : 'output' };
  }
  const outcome = TOOL_TYPES.has(type)
    ? describeTool(span)
    : type === SpanType.AGENT_RUN
      ? describeAgentRun(span)
      : type === SpanType.MODEL_CHUNK
        ? describeChunk(span)
        : undefined;
  // What a model, tool, agent or chunk produced is the proof of its outcome.
  return outcome && { ...outcome, evidence: 'output' };
}

// --- Pipeline spans: processors, memory, workspace and skills ------------------------------

interface MutationTally {
  added: number;
  addedSystem: number;
  removed: number;
}

function tallyMutations(mutations: ProcessorPipelineDescription['messageListMutations']): MutationTally {
  const tally: MutationTally = { added: 0, addedSystem: 0, removed: 0 };
  for (const mutation of mutations ?? []) {
    // The log is only checked to be an array: skip an entry we cannot read, the Changes section shows it as JSON.
    if (typeof mutation !== 'object' || mutation === null) continue;
    const amount = mutation.count ?? mutation.ids?.length ?? 1;
    if (mutation.type === 'add') tally.added += amount;
    else if (mutation.type === 'addSystem') tally.addedSystem += amount;
    else if (mutation.type === 'clear' || mutation.type === 'removeByIds') tally.removed += amount;
  }
  return tally;
}

/** "added 2 messages to the conversation, removed 1 message from the conversation", or `undefined` when nothing changed. */
function describeTally({ added, addedSystem, removed }: MutationTally): string | undefined {
  const parts = [
    added > 0 && `added ${pluralize(added, 'message')} to the conversation`,
    addedSystem > 0 && `added ${pluralize(addedSystem, 'message')} to the system prompt`,
    removed > 0 && `removed ${pluralize(removed, 'message')} from the conversation`,
  ].filter((part): part is string => typeof part === 'string');
  return parts.length > 0 ? parts.join(', ') : undefined;
}

export interface SystemPromptChanges {
  added: unknown[];
  removed: unknown[];
}

/** `from` entries with no equal entry left in `against`, matching each entry at most once. */
function unmatched(from: unknown[], against: unknown[]): unknown[] {
  const pool = against.map(message => JSON.stringify(message));
  return from.filter(message => {
    const index = pool.indexOf(JSON.stringify(message));
    if (index === -1) return true;
    pool.splice(index, 1);
    return false;
  });
}

/**
 * The system messages a pipeline span added to or dropped from the prompt, found by comparing
 * the `systemMessages` it received with the ones it returned. A processor that rewrites the
 * system prompt directly records no message-list mutation, so this is the only trace of it.
 */
export function getSystemPromptChanges(span: SpanRecord): SystemPromptChanges {
  const after = isRecord(span.output) ? span.output.systemMessages : undefined;
  if (!Array.isArray(after)) return { added: [], removed: [] };
  const before = isRecord(span.input) && Array.isArray(span.input.systemMessages) ? span.input.systemMessages : [];
  return { added: unmatched(after, before), removed: unmatched(before, after) };
}

/** "added 1 message to the system prompt", or `undefined` when the prompt is unchanged. */
function describeSystemPromptChanges({ added, removed }: SystemPromptChanges): string | undefined {
  const parts = [
    added.length > 0 && `added ${pluralize(added.length, 'message')} to the system prompt`,
    removed.length > 0 && `removed ${pluralize(removed.length, 'message')} from the system prompt`,
  ].filter((part): part is string => typeof part === 'string');
  return parts.length > 0 ? parts.join(', ') : undefined;
}

type PipelineMutation = NonNullable<ProcessorPipelineDescription['messageListMutations']>[number];

/**
 * What a pipeline span changed in the message list. Recorded mutations win; a processor that
 * rewrote the system prompt directly records none, so its changes come from diffing input and output.
 */
export function getSpanChanges(span: SpanRecord): PipelineMutation[] {
  const recorded = describeProcessorPipeline(asCoreSpan(span))?.messageListMutations ?? [];
  if (recorded.length > 0) return recorded;
  const prompt = getSystemPromptChanges(span);
  return [
    ...prompt.removed.map(message => ({ type: 'removeByIds' as const, source: 'system', count: 1, message })),
    ...prompt.added.map(message => ({ type: 'addSystem' as const, message })),
  ];
}

const CHANGED_LABELS: Record<string, string> = { systemMessages: 'the system prompt', messages: 'the conversation' };

/** What every pipeline span that changed nothing says, so "no change" always reads the same. */
const UNCHANGED = 'left the system prompt and the conversation unchanged';

/** Output keys whose value differs from the same key in the input, ignoring a no-op `shortCircuited`. */
function changedKeys(input: unknown, output: unknown): string[] {
  if (!isRecord(output)) return [];
  const before = isRecord(input) ? input : {};
  return Object.keys(output).filter(key => {
    if (key === 'shortCircuited') return false;
    return JSON.stringify(output[key]) !== JSON.stringify(before[key]);
  });
}

/** Who ran the span (an agent, tool or processor name), so a headline reads on its own. */
const actorOf = (span: SpanRecord, fallback: string) => asText(span.entityName) ?? asText(span.entityId) ?? fallback;

/** Who to name when a pipeline span records no entity, so its sentence still has a subject. */
const PIPELINE_ACTORS: Partial<Record<SpanType, string>> = {
  [SpanType.MEMORY_OPERATION]: 'Memory',
  [SpanType.WORKSPACE_ACTION]: 'The workspace',
  [SpanType.SKILL_ACTION]: 'The skills processor',
};

function describePipeline(span: SpanRecord, pipeline: ProcessorPipelineDescription): SpanOutcome {
  const attributes = isRecord(span.attributes) ? span.attributes : {};
  const output = isRecord(span.output) ? span.output : {};
  const tally = tallyMutations(pipeline.messageListMutations);
  const additions = tally.added + tally.addedSystem;
  const changed = additions > 0 || tally.removed > 0;
  const processor = actorOf(span, PIPELINE_ACTORS[span.spanType] ?? 'The processor');

  const base = {
    evidence: changed ? ('changes' as const) : undefined,
  };

  if (pipeline.tripwireAbort) {
    // The full reason, retry flag and metadata read in the processor facts right under the headline;
    // the changes keep their own section.
    return {
      ...base,
      evidence: undefined,
      headline: `${processor} stopped the run`,
      tone: 'error',
    };
  }

  if (span.spanType === SpanType.MEMORY_OPERATION) {
    if (attributes.operationType === 'save') {
      const saved = Array.isArray(output.messages) ? output.messages.length : 0;
      return saved > 0
        ? {
            ...base,
            headline: `${processor} saved ${pluralize(saved, 'message')} from this turn to memory`,
            tone: 'change',
            evidence: 'output',
          }
        : { ...base, headline: `${processor} saved no new messages to memory`, tone: 'neutral' };
    }
    return additions > 0
      ? {
          ...base,
          headline: `${processor} loaded ${pluralize(additions, 'earlier message')} from memory into the conversation`,
          tone: 'change',
        }
      : {
          ...base,
          headline: `${processor} loaded no earlier messages from memory into the conversation`,
          tone: 'neutral',
        };
  }

  if (span.spanType === SpanType.WORKSPACE_ACTION && changed) {
    const name = asText(attributes.workspaceName);
    return {
      ...base,
      headline: `${processor} added the ${name ? `${name} ` : ''}workspace instructions to the system prompt`,
      tone: 'change',
    };
  }

  if (span.spanType === SpanType.SKILL_ACTION && changed) {
    const skills = typeof attributes.skillCount === 'number' ? attributes.skillCount : undefined;
    return {
      ...base,
      headline: `${processor} added the list of ${skills === undefined ? 'available skills' : pluralize(skills, 'available skill')} to the system prompt`,
      tone: 'change',
    };
  }

  const mutationSentence = describeTally(tally);
  if (mutationSentence) return { ...base, headline: `${processor} ${mutationSentence}`, tone: 'change' };

  if (output.shortCircuited === true) {
    return {
      ...base,
      headline: `${processor} returned a response itself, so the model was not called`,
      tone: 'warning',
    };
  }

  const promptSentence = describeSystemPromptChanges(getSystemPromptChanges(span));
  if (promptSentence) {
    return { ...base, headline: `${processor} ${promptSentence}`, tone: 'change', evidence: 'changes' };
  }

  const changedFields = changedKeys(span.input, span.output);
  const changedMessages = changedFields.filter(key => key in CHANGED_LABELS);
  if (changedMessages.length > 0) {
    return {
      ...base,
      headline: `${processor} rewrote ${changedMessages.map(key => CHANGED_LABELS[key]).join(' and ')}`,
      tone: 'change',
      evidence: 'output',
    };
  }
  if (changedFields.length > 0) {
    return {
      ...base,
      headline: `${processor} returned a result and ${UNCHANGED}`,
      tone: 'neutral',
      evidence: 'output',
    };
  }

  return { ...base, headline: `${processor} ${UNCHANGED}`, tone: 'neutral' };
}

// --- Model, tool, agent and chunk spans -------------------------------------------------------

// Hidden tools (task list, working memory) stay out of the count, as they do out of the Tool calls list.
const toolNamesOf = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.flatMap(call => {
        const name = isRecord(call) ? asText(call.toolName) : undefined;
        return name && !isHiddenTool(name) ? [name] : [];
      })
    : [];

// A generation spans every step, so its output lists every call: name them while that stays readable, count otherwise.
function describeToolCalls(names: string[]): string | undefined {
  if (names.length === 0) return undefined;
  const distinct = [...new Set(names)];
  if (distinct.length === 1) {
    return names.length === 1 ? distinct[0] : `${distinct[0]} ${names.length} times`;
  }
  if (distinct.length === 2 && names.length === 2) return `${distinct[0]} and ${distinct[1]}`;
  return pluralize(names.length, 'tool');
}

function describeModel(span: SpanRecord): SpanOutcome {
  const attributes = isRecord(span.attributes) ? span.attributes : {};
  const output = isRecord(span.output) ? span.output : {};
  const model = asText(attributes.model) ?? 'The model';
  const finishReason = asText(attributes.finishReason);
  const reply = firstLine(asText(output.text));
  const calls = describeToolCalls(toolNamesOf(output.toolCalls));

  if (finishReason === 'length') {
    return {
      headline: `${model} hit its output token limit, so the answer is cut off`,
      detail: reply,
      tone: 'warning',
    };
  }
  if (finishReason === 'content-filter') {
    return { headline: `The provider's content filter blocked ${model}'s answer`, detail: reply, tone: 'warning' };
  }
  // Tool calls lead to the answer, so the answer is the outcome.
  if (reply) {
    return {
      headline: calls ? `${model} called ${calls}, then wrote the answer` : `${model} wrote the answer`,
      detail: reply,
      tone: 'success',
    };
  }
  // Without an answer yet, the model asked for tools; the tool spans run them.
  if (calls) return { headline: `${model} asked to call ${calls}`, tone: 'success' };
  return { headline: `${model} returned no text and no tool calls`, tone: 'neutral' };
}

function describeTool(span: SpanRecord): SpanOutcome {
  const attributes = isRecord(span.attributes) ? span.attributes : {};
  const tool = actorOf(span, 'The tool');
  if (attributes.success === false) return { headline: `${tool} failed`, tone: 'error' };
  const args = scalarPreview(span.input, 2);
  const detail = scalarPreview(span.output, 4) ?? firstLine(asText(span.output));
  return {
    headline: args ? `${tool} ran with ${args} and returned a result` : `${tool} ran and returned a result`,
    detail,
    tone: 'success',
  };
}

function describeAgentRun(span: SpanRecord): SpanOutcome {
  const output = isRecord(span.output) ? span.output : {};
  const agent = actorOf(span, 'the agent');
  const Agent = agent === 'the agent' ? 'The agent' : agent;
  const reply = firstLine(asText(output.text));
  const tripwire = isRecord(output.tripwire) ? output.tripwire : undefined;
  if (tripwire) {
    const by = asText(tripwire.processorId);
    return {
      headline: `${by ?? 'A processor'} blocked the run before ${agent} could answer`,
      detail: firstLine(asText(tripwire.reason)),
      tone: 'error',
    };
  }
  if (output.status === 'aborted' || output.status === 'interrupted') {
    return {
      headline: `The run was ${output.status} before ${agent} finished`,
      detail: firstLine(asText(output.reason)),
      tone: 'warning',
    };
  }
  const question = firstLine(getInputPreview(span.input, 60) || undefined);
  if (reply) {
    return {
      headline: question ? `${Agent} answered “${question}”` : `${Agent} answered the user`,
      detail: reply,
      tone: 'success',
    };
  }
  return { headline: `${Agent} finished without a text answer`, tone: 'neutral' };
}

const CHUNK_HEADLINES: Record<string, string> = {
  text: 'Streamed part of the answer',
  reasoning: "Streamed the model's reasoning",
  'tool-result': 'Streamed a tool result back to the model',
};

function describeChunk(span: SpanRecord): SpanOutcome {
  const attributes = isRecord(span.attributes) ? span.attributes : {};
  const chunkType = asText(attributes.chunkType) ?? 'chunk';
  const output = isRecord(span.output) ? span.output : {};
  const tool = asText(output.toolName);
  const text = firstLine(asText(output.text));
  if (tool) return { headline: `Streamed the request to call ${tool}`, tone: 'neutral' };
  const headline = CHUNK_HEADLINES[chunkType] ?? `Streamed a ${chunkType} chunk`;
  return { headline, detail: text ?? 'No readable content', tone: 'neutral' };
}
