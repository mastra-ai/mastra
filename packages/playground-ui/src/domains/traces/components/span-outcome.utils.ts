import { SpanType, describeProcessorPipeline, describeSpanError } from '@mastra/core/observability';
import type { ProcessorPipelineDescription } from '@mastra/core/observability';
import type { SpanRecord } from '../types';
import { getInputPreview } from '../utils/span-utils';
import { asCoreSpan } from './span-payload/span-payload-registry';
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

export type SpanOutcomeEvidence = 'output' | 'changes' | 'error';

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
    // The Error section right below quotes the message with its details.
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
  const outcome = MODEL_TYPES.has(type)
    ? describeModel(span)
    : TOOL_TYPES.has(type)
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
    const amount = mutation.count ?? mutation.ids?.length ?? 1;
    if (mutation.type === 'add') tally.added += amount;
    else if (mutation.type === 'addSystem') tally.addedSystem += amount;
    else if (mutation.type === 'clear' || mutation.type === 'removeByIds') tally.removed += amount;
  }
  return tally;
}

/** "added 2 messages to the conversation, removed 1 message", or `undefined` when nothing changed. */
function describeTally({ added, addedSystem, removed }: MutationTally): string | undefined {
  const parts = [
    added > 0 && `added ${pluralize(added, 'message')} to the conversation`,
    addedSystem > 0 && `added ${pluralize(addedSystem, 'system message')} to the prompt`,
    removed > 0 && `removed ${pluralize(removed, 'message')} from the conversation`,
  ].filter((part): part is string => typeof part === 'string');
  return parts.length > 0 ? parts.join(', ') : undefined;
}

const CHANGED_LABELS: Record<string, string> = { messages: 'messages', systemMessages: 'system messages' };

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

function describePipeline(span: SpanRecord, pipeline: ProcessorPipelineDescription): SpanOutcome {
  const attributes = isRecord(span.attributes) ? span.attributes : {};
  const output = isRecord(span.output) ? span.output : {};
  const tally = tallyMutations(pipeline.messageListMutations);
  const additions = tally.added + tally.addedSystem;
  const changed = additions > 0 || tally.removed > 0;
  const processor = actorOf(span, 'The processor');

  // Phase, step, retries and hook time already lead the Attributes section right below.
  const base = {
    evidence: changed ? ('changes' as const) : undefined,
  };

  if (pipeline.tripwireAbort) {
    // The tripwire notice leads the Attributes section right below.
    return {
      ...base,
      evidence: undefined,
      headline: `${processor} stopped the run`,
      detail: firstLine(pipeline.tripwireAbort.reason),
      tone: 'error',
    };
  }

  if (span.spanType === SpanType.MEMORY_OPERATION) {
    if (attributes.operationType === 'save') {
      const saved = Array.isArray(output.messages) ? output.messages.length : 0;
      return saved > 0
        ? {
            ...base,
            headline: `Saved ${pluralize(saved, 'message')} from this turn to memory`,
            tone: 'change',
            evidence: 'output',
          }
        : { ...base, headline: 'Nothing new to save to memory', tone: 'neutral' };
    }
    return additions > 0
      ? {
          ...base,
          headline: `Loaded ${pluralize(additions, 'earlier message')} from memory into the conversation`,
          tone: 'change',
        }
      : { ...base, headline: 'Found no earlier messages in memory', tone: 'neutral' };
  }

  if (span.spanType === SpanType.WORKSPACE_ACTION && changed) {
    const name = asText(attributes.workspaceName);
    return {
      ...base,
      headline: `Added the ${name ? `${name} ` : ''}workspace instructions to the system prompt`,
      tone: 'change',
    };
  }

  if (span.spanType === SpanType.SKILL_ACTION && changed) {
    const skills = typeof attributes.skillCount === 'number' ? attributes.skillCount : undefined;
    return {
      ...base,
      headline: `Listed ${skills === undefined ? 'the available skills' : pluralize(skills, 'available skill')} in the system prompt`,
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

  const changedFields = changedKeys(span.input, span.output);
  const changedMessages = changedFields.filter(key => key in CHANGED_LABELS);
  if (changedMessages.length > 0) {
    return {
      ...base,
      headline: `${processor} rewrote the ${changedMessages.map(key => CHANGED_LABELS[key]).join(' and ')}`,
      tone: 'change',
      evidence: 'output',
    };
  }
  if (changedFields.length > 0) {
    return {
      ...base,
      headline: `${processor} returned a result and left the messages unchanged`,
      tone: 'neutral',
      evidence: 'output',
    };
  }

  return { ...base, headline: `${processor} ran and left the messages unchanged`, tone: 'neutral' };
}

// --- Model, tool, agent and chunk spans -------------------------------------------------------

const toolNamesOf = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.flatMap(call => {
        const name = isRecord(call) ? asText(call.toolName) : undefined;
        return name ? [name] : [];
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
