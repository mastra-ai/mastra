import {
  SPEC_DATA_PART_TYPE,
  applySpecPatch,
  diffToPatches,
  formatSpecIssues,
  getByPath,
  parseSpecStreamLine,
  resolveElementProps,
  resolveRepeatItemStatePath,
  resolveRepeatStatePath,
  validateSpec,
} from '@json-render/core';
import type { Catalog, PropResolutionContext, Spec, SpecDataPart } from '@json-render/core';
import type { MastraDBMessage } from '@mastra/core/agent';
import { REPROCESS_PART_KEY } from '@mastra/core/processors';
import type {
  ProcessLLMRequestArgs,
  ProcessLLMRequestResult,
  ProcessOutputStepArgs,
  ProcessOutputStreamArgs,
  Processor,
  ProcessorContext,
} from '@mastra/core/processors';
import type { ChunkType } from '@mastra/core/stream';
import type { z } from 'zod';

const FENCE_OPEN = '```spec';
const FENCE_CLOSE = '```';
/** Where a patch can write in a spec. Outside a ```spec block, only patches here are taken as interface edits. */
const SPEC_PATH = /^\/(root|elements|state)(\/|$)/;

export interface JsonRenderProcessorOptions {
  /** The catalog the model composes interfaces from. */
  catalog: Catalog;
}

/** An open code block: its fence (three or more backticks or tildes), and whether it is a ```spec block. */
interface Fence {
  marker: string;
  spec: boolean;
}

/** Where the text stream is: lines that may be a patch or a fence are held until they end. */
interface Split {
  line: string;
  holding: boolean;
  /** Whether the line has prose before this point, so a fence or patch can no longer start it. */
  midLine: boolean;
  /** The code block the stream is in: a ```spec block, or any other, whose lines stay prose. */
  fence?: Fence;
  /** Whether the open fence has had its first patch, which decides if it starts a new spec or edits the last one. */
  started: boolean;
}

/** The interface the current message has streamed so far, and the patches held back from it. */
interface Live {
  spec?: Spec;
  rejected: string[];
}

/** A part that empties an interface the client has already rendered. */
const CLEARED: SpecDataPart = { type: 'flat', spec: { root: '', elements: {} } };

/** The code block a line opens, as CommonMark reads it. */
function fenceOpenedBy(line: string): Fence | undefined {
  const [, marker, info] = /^(`{3,}|~{3,})(.*)$/.exec(line) ?? [];
  if (!marker || (marker.startsWith('`') && info!.includes('`'))) return;
  return { marker, spec: info!.trim().split(/\s/)[0] === 'spec' };
}

/** Whether a line closes a code block: the fence's character, at least as many times, and nothing else. */
function closes(fence: Fence, line: string) {
  const [, marker] = /^(`+|~+)$/.exec(line) ?? [];
  return !!marker && marker[0] === fence.marker[0] && marker.length >= fence.marker.length;
}

/**
 * Whether a line held back may still turn out to be a code fence or a patch
 * (`{"op": …}`). Lines that cannot are released as prose right away, so
 * only a reply cut off inside a patch line ends with text held back.
 */
function couldOpenSpecLine(line: string) {
  if (line.startsWith('`') || line.startsWith('~')) {
    const fence = line[0]!.repeat(3);
    return fence.startsWith(line) || line.startsWith(fence);
  }
  return /^\{\s*("|$)/.test(line);
}

function uiStateIn(requestContext: ProcessorContext['requestContext']) {
  return requestContext?.get(JSON_RENDER_STATE) as Spec['state'];
}

/** The spec the latest message with one builds, which a block not starting at `/root` edits. */
function latestSpec(messages: ReadonlyArray<MastraDBMessage>): Spec | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const spec = specOf(messages[i]!.content.parts ?? []);
    if (spec) return spec;
  }
}

/** The `requestContext` key a client sends the state its interface holds under, so the model can see it. */
export const JSON_RENDER_STATE = 'jsonRender.state';

/**
 * Turns the ```spec blocks a model writes (json-render's text format) into
 * `data-spec` parts, so the interface streams to the client and is saved with
 * the message while the text keeps only the prose.
 *
 * A block that does not start by setting `/root` edits the latest interface in
 * the thread: the reply saves that spec first, then the patches, so every
 * message rebuilds its own interface and earlier ones stay as they were.
 */
export class JsonRenderProcessor implements Processor<'json-render'> {
  readonly id = 'json-render';
  readonly name = 'json-render';

  constructor(readonly options: JsonRenderProcessorOptions) {}

  /**
   * Shows the model the latest interface it wrote, which Mastra leaves out of the
   * prompt with every `data-*` part: the ```spec block goes back into the reply
   * that wrote it, as the spec is now, holding the state the user set in it.
   * Only this call's prompt changes, not the thread.
   */
  async processLLMRequest({
    prompt,
    messageList,
    requestContext,
  }: ProcessLLMRequestArgs): Promise<ProcessLLMRequestResult> {
    const messages = messageList?.get.all.db() ?? [];
    const reply = messages.findLast(message => specOf(message.content.parts ?? []));
    if (!reply) return;
    const spec = specOf(reply.content.parts)!;
    const uiState = uiStateIn(requestContext);
    const text = specBlock(uiState ? { ...spec, state: uiState } : spec);

    // The prompt does not say which message each one comes from, but its parts keep the time they were written.
    // Parts can share a millisecond with the next user message, so only the model's own messages are matched.
    const written = new Set(reply.content.parts.map(part => (part as { createdAt?: number }).createdAt));
    const wrote = (message: (typeof prompt)[number] | undefined) =>
      !!message && message.role !== 'user' && writtenAt(message).some(createdAt => written.has(createdAt));
    let at = prompt.findIndex(wrote);
    if (at < 0) {
      // A reply with no text or tool calls has no message in the prompt: the block goes before what came next.
      const last = Math.max(...[...written].map(createdAt => createdAt ?? -Infinity));
      const after = prompt.findIndex(message => writtenAt(message).some(createdAt => createdAt > last));
      if (after < 0) return;
      return { prompt: prompt.toSpliced(after, 0, { role: 'assistant', content: [{ type: 'text', text }] }) };
    }
    // A reply that calls tools spans several prompt messages; the block goes after its last one.
    while (wrote(prompt[at + 1])) at++;
    const message = prompt[at]!;
    if (message.role === 'assistant' && !message.content.some(part => part.type === 'tool-call')) {
      const prose = message.content.findLast(part => part.type === 'text')?.text ?? '';
      const block = { type: 'text' as const, text: prose && !prose.endsWith('\n') ? `\n${text}` : text };
      return { prompt: prompt.with(at, { ...message, content: [...message.content, block] }) };
    }
    return { prompt: prompt.toSpliced(at + 1, 0, { role: 'assistant', content: [{ type: 'text', text }] }) };
  }

  async processOutputStream({
    part,
    state,
    writer,
    messageList,
    requestContext,
  }: ProcessOutputStreamArgs): Promise<ChunkType | null> {
    if (part.type !== 'text-delta' && part.type !== 'text-end') return part;
    const split = ((state.split as Split | undefined) ??= {
      line: '',
      holding: false,
      midLine: false,
      started: false,
    });
    const live = ((state.live as Live | undefined) ??= { rejected: [] });
    const parts: SpecDataPart[] = [];
    let text = '';

    /** `last`: the text block ended on this line, so no newline follows it. */
    const endLine = (last = false) => {
      const line = split.line;
      const trimmed = line.trim();
      split.line = '';
      split.holding = false;
      const keep = () => void (text += last ? line : `${line}\n`);
      const fence = split.fence;
      if (fence && closes(fence, trimmed)) {
        split.fence = undefined;
        return fence.spec ? undefined : keep();
      }
      if (fence && !fence.spec) return keep();
      const opened = !fence && fenceOpenedBy(trimmed);
      if (opened) {
        split.fence = opened;
        split.started = false;
        return opened.spec ? undefined : keep();
      }
      const parsed = parseSpecStreamLine(trimmed);
      // The edit prompt asks for the patch lines alone, so they count outside a block too, when they write to a spec.
      const patch = parsed && (fence || SPEC_PATH.test(parsed.path)) ? parsed : null;
      if (!patch) return void (!fence && keep());
      if (!split.started) {
        split.started = true;
        const latest = patch.path !== '/root' && messageList && latestSpec(messageList.get.all.db());
        const uiState = uiStateIn(requestContext);
        const edited = latest && (uiState ? { ...latest, state: uiState } : latest);
        if (edited) {
          live.spec = structuredClone(edited);
          parts.push({ type: 'flat', spec: edited });
        }
      }
      // The client applies each patch as it arrives, so one that cannot apply is held back and sent to the model instead.
      try {
        applyPatch((live.spec ??= { root: '', elements: {} }), patch);
        parts.push({ type: 'patch', patch });
      } catch (error) {
        live.rejected.push((error as Error).message);
      }
    };

    if (part.type === 'text-end') {
      if (split.holding) endLine(true);
      state.split = undefined;
    } else {
      for (const char of part.payload.text) {
        const inSpec = !!split.fence?.spec;
        if (char === '\n') {
          if (split.holding) endLine();
          else if (!inSpec) text += char;
          split.midLine = false;
        } else if (split.holding) {
          split.line += char;
          if (!inSpec && !couldOpenSpecLine(split.line)) {
            text += split.line;
            split.line = '';
            split.holding = false;
            split.midLine = true;
          }
        } else if (inSpec || (!split.midLine && (char === '{' || char === '`' || char === '~'))) {
          split.holding = true;
          split.line = char;
        } else {
          text += char;
          if (!/\s/.test(char)) split.midLine = true;
        }
      }
    }

    for (const data of parts) await writer?.custom({ type: SPEC_DATA_PART_TYPE, data });
    if (part.type !== 'text-end') return text ? { ...part, payload: { ...part.payload, text } } : null;
    if (!text) return part;
    // Text held to the end of the block goes out before the block closes. Only one
    // part can be returned, so the runner sends the text-end after it.
    state[REPROCESS_PART_KEY] = part;
    return { type: 'text-delta', runId: part.runId, from: part.from, payload: { id: part.payload.id, text } };
  }

  /** Sends a reply whose interface cannot render back to the model, with what is wrong. */
  async processOutputStep({
    messages,
    abort,
    state,
    writer,
  }: ProcessOutputStepArgs): Promise<ProcessOutputStepArgs['messages']> {
    const live = state.live as Live | undefined;
    const rejected = live?.rejected.splice(0) ?? [];
    const reply = messages.at(-1);
    if (reply?.role !== 'assistant') return messages;
    let problems = rejected.join('\n') || undefined;
    try {
      const spec = buildSpec(reply.content.parts);
      problems ??= spec && problemsIn(spec, this.options.catalog);
    } catch (error) {
      problems ??= (error as Error).message;
    }
    if (problems) {
      // The retry writes a new message; this one stays on the client until it reloads, so its interface is cleared.
      // Transient: the rejected message is not saved, and nothing else should be.
      if (live?.spec) {
        live.spec = undefined;
        await writer?.custom({ type: SPEC_DATA_PART_TYPE, data: CLEARED, transient: true });
      }
      abort(
        `The interface in your \`\`\`spec block cannot be shown. Write it again without these problems:\n${problems}`,
        {
          retry: true,
        },
      );
    }
    return messages;
  }
}

/** The ```spec block json-render's prompt asks for, writing `spec` from nothing. */
function specBlock({ root, state, elements }: Spec) {
  const patches = diffToPatches({ elements: {} }, { root, ...(state && { state }), elements });
  return [FENCE_OPEN, ...patches.map(patch => JSON.stringify(patch)), FENCE_CLOSE].join('\n');
}

/** When the parts of a prompt message were written, as Mastra records it on each part. */
function writtenAt(message: ProcessLLMRequestArgs['prompt'][number]): number[] {
  if (typeof message.content === 'string') return [];
  return message.content.flatMap(part => {
    const at = part.providerOptions?.mastra?.createdAt;
    return typeof at === 'number' ? [at] : [];
  });
}

/**
 * The spec a message's `data-spec` parts build, the way the client renders it,
 * leaving the parts as they are. Throws when a patch cannot be applied, naming it.
 */
function buildSpec(parts: ReadonlyArray<{ type: string }>): Spec | undefined {
  let spec: Spec | undefined;
  for (const part of parts) {
    if (part.type !== SPEC_DATA_PART_TYPE) continue;
    const data = (part as unknown as { data: SpecDataPart }).data;
    if (data.type === 'flat') spec = structuredClone(data.spec);
    else if (data.type === 'patch') applyPatch((spec ??= { root: '', elements: {} }), data.patch);
  }
  return spec;
}

/**
 * Applies a copy of `patch` to `spec`: `applySpecPatch` inserts the values a
 * patch holds, so applying the patch itself would let later patches change it.
 * Throws when it cannot be applied, naming it.
 */
function applyPatch(spec: Spec, patch: Extract<SpecDataPart, { type: 'patch' }>['patch']) {
  try {
    if (typeof patch.path !== 'string') throw new Error('its path is not a string');
    applySpecPatch(spec, structuredClone(patch));
  } catch (error) {
    throw new Error(`- ${JSON.stringify(patch)} cannot be applied: ${(error as Error).message}`);
  }
}

/** The spec a message's `data-spec` parts build, or none when they cannot build one. */
function specOf(parts: ReadonlyArray<{ type: string }>): Spec | undefined {
  try {
    return buildSpec(parts);
  } catch {
    return undefined;
  }
}

/** What keeps a spec from rendering: broken structure, unknown components, or props a component does not take. */
function problemsIn(spec: Spec, catalog: Catalog): string | undefined {
  const problems = validateSpec(spec).issues.filter(issue => issue.severity === 'error');
  const lines = problems.length ? [formatSpecIssues(problems)] : [];
  const components = (catalog.data as { components?: Record<string, { props: z.ZodType }> }).components ?? {};
  const stateModel = spec.state ?? {};
  const seen = new Set<string>();
  const report = (line: string) => {
    if (seen.has(line)) return;
    seen.add(line);
    lines.push(line);
  };

  // Walks the tree the way the renderer does, so props bound to `$item` are checked against each item they render for.
  const visit = (key: string, scope: Omit<PropResolutionContext, 'stateModel'>, path: ReadonlySet<string>) => {
    const element = spec.elements[key];
    if (!element || path.has(key)) return;
    const component = components[element.type];
    if (!component) report(`- "${key}" uses "${element.type}", which is not in the catalog`);
    else {
      const result = component.props.safeParse(resolveElementProps(element.props ?? {}, { stateModel, ...scope }));
      for (const issue of result.success ? [] : result.error.issues) {
        report(`- "${key}" (${element.type}) prop "${issue.path.join('.')}": ${issue.message}`);
      }
    }
    const inner = new Set(path).add(key);
    const children = [...(element.children ?? []), ...Object.values(element.slots ?? {}).flat()];
    if (!element.repeat) return children.forEach(child => visit(child, scope, inner));
    const statePath = resolveRepeatStatePath(element.repeat.statePath, scope.repeatBasePath);
    const items = statePath === undefined ? [] : getByPath(stateModel, statePath);
    if (!Array.isArray(items)) return;
    const keyField = element.repeat.key;
    if (keyField) {
      const keys = items.map((item, index) => String((item as Record<string, unknown> | null)?.[keyField] ?? index));
      const repeated = keys.find((itemKey, index) => keys.indexOf(itemKey) !== index);
      if (repeated !== undefined) {
        report(
          `- "${key}" repeats ${statePath} keyed by "${keyField}", but "${repeated}" appears more than once; each item needs its own key`,
        );
      }
    }
    items.forEach((repeatItem, repeatIndex) => {
      const itemScope = {
        repeatItem,
        repeatIndex,
        repeatBasePath: resolveRepeatItemStatePath(statePath!, repeatIndex),
      };
      children.forEach(child => visit(child, itemScope, inner));
    });
  };
  visit(spec.root, {}, new Set());
  return lines.length ? lines.join('\n') : undefined;
}
