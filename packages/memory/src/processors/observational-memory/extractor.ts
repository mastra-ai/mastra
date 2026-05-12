import type { Agent } from '@mastra/core/agent';
import { z } from 'zod';

/**
 * How the extracted value should be reused on subsequent observer calls.
 *
 * - `'carry-forward'`: Inject the last extracted value back into the next
 *   observer prompt as a "prior" hint so the model has continuity.
 * - `'none'`: Do not carry the previous value forward.
 *
 * Additional behaviour modes may be added in future releases.
 *
 * @experimental
 */
export type ExtractorInjectionBehaviour = 'carry-forward' | 'none';

/**
 * Context passed to an extractor's `onExtracted` lifecycle hook every time
 * the observer emits a value for it.
 *
 * @experimental
 */
export interface ExtractorOnExtractedContext<T> {
  /**
   * The extracted value, or `undefined` if the observer didn't emit a value
   * for this extractor in the current cycle.
   */
  extracted: T | undefined;

  /** The extractor configuration that produced this value. */
  extractor: Extractor<T>;

  /** The thread this extraction belongs to. */
  threadId: string;

  /** The resource ID, when this thread belongs to one. */
  resourceId?: string;

  /**
   * The agent whose run triggered this observation cycle, when available.
   *
   * Use this to send signals back into the main agent's stream, e.g.
   * `mainAgent.sendSignal({ type: 'system-reminder', contents: '…' }, { threadId })`.
   *
   * Note: `mainAgent` is best-effort — in some execution paths (e.g. running
   * the OM engine directly outside of an agent loop) it will be `undefined`.
   * Capture your agent in a closure if you need a guaranteed reference.
   */
  mainAgent?: Agent;

  /** The runId of the agent execution that triggered this OM cycle, when available. */
  runId?: string;
}

/**
 * Configuration options for an `Extractor`.
 *
 * @experimental
 */
export interface ExtractorConfig<T = string> {
  /**
   * Unique, human-readable name for this extractor.
   *
   * The name is slugified to produce the XML tag the observer emits
   * (e.g. `"Follows Policy"` → `<follows-policy>`). Names must be unique
   * within a single `observer.extract` (or `reflector.extract`) array.
   */
  name: string;

  /**
   * Instructions describing what the observer should put inside this
   * extractor's XML section. Inserted into the observer's output-format
   * specification verbatim, so write it as direct guidance to the model.
   */
  instructions: string;

  /**
   * Zod schema describing the shape of the extracted value.
   *
   * Only string schemas are supported in this initial release — the value
   * is captured as the textual content of the extractor's XML tag. Object
   * schemas are reserved for a future "promote to a separate LLM call"
   * mode.
   *
   * @default z.string()
   */
  schema?: z.ZodType<T>;

  /**
   * How the previous extracted value is reused on subsequent observer
   * calls.
   *
   * @default 'none'
   */
  injectionBehaviour?: ExtractorInjectionBehaviour;

  /**
   * Lifecycle hook invoked whenever the observer produces a new value for
   * this extractor. Use this to drive side effects — for example, calling
   * `mainAgent.sendSignal(...)` to inject a runtime signal back into the
   * main agent based on what was observed.
   *
   * Errors thrown from this callback are caught and logged — they do not
   * fail the observation cycle.
   */
  onExtracted?: (ctx: ExtractorOnExtractedContext<T>) => void | Promise<void>;
}

/**
 * Built-in extractor slugs used by ObservationalMemory's default extraction
 * pipeline. These slugs are reserved — custom extractors should not collide
 * with them.
 *
 * @internal
 */
export const BUILT_IN_EXTRACTOR_SLUGS = {
  threadTitle: 'thread-title',
  currentTask: 'current-task',
  suggestedResponse: 'suggested-response',
} as const;

export type BuiltInExtractorSlug = (typeof BUILT_IN_EXTRACTOR_SLUGS)[keyof typeof BUILT_IN_EXTRACTOR_SLUGS];

const BUILT_IN_SLUG_SET = new Set<string>(Object.values(BUILT_IN_EXTRACTOR_SLUGS));

/**
 * Slugify a human-readable name into a kebab-case XML-safe slug.
 *
 * @internal
 */
export function slugifyExtractorName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function isBuiltInExtractorSlug(slug: string): slug is BuiltInExtractorSlug {
  return BUILT_IN_SLUG_SET.has(slug);
}

const DEFAULT_THREAD_TITLE_INSTRUCTIONS = [
  'A short, noun-phrase title for this conversation (2-5 words). Examples:',
  '  - "Auth bug fix"',
  '  - "Memory config refactor"',
  '  - "RAG pipeline setup"',
  'Avoid verbs/sentences ("Fixing the auth bug"), filler ("Working on stuff"),',
  'and generic labels ("Code review"). Only change it from the prior title if',
  'the topic meaningfully shifted.',
].join('\n');

const DEFAULT_CURRENT_TASK_INSTRUCTIONS = [
  'State the current task(s) explicitly:',
  '- Primary: What the agent is currently working on',
  '- Secondary: Other pending tasks (mark as "waiting for user" if appropriate)',
].join('\n');

const DEFAULT_SUGGESTED_RESPONSE_INSTRUCTIONS = [
  "Hint for the agent's immediate next message. Examples:",
  '- "I\'ve updated the navigation model. Let me walk you through the changes..."',
  '- "The assistant should wait for the user to respond before continuing."',
  '- Call the view tool on src/example.ts to continue debugging.',
].join('\n');

/**
 * Declarative configuration for a single piece of information you want the
 * Observer (or Reflector) to extract from the recent conversation history.
 *
 * Extractors are emitted by the Observer as XML-tagged sections inside its
 * structured output. Each extractor's value is parsed back out, optionally
 * carried forward into the next observer call as a "prior" hint, and
 * surfaced to a lifecycle hook (`onExtracted`) where you can react — for
 * example, by calling `mainAgent.sendSignal(...)` to push a runtime signal
 * back into the main agent.
 *
 * @example Custom extractor that signals the main agent on policy violations
 * ```ts
 * import { Extractor } from '@mastra/memory/processors';
 * import { z } from 'zod';
 *
 * new Extractor({
 *   name: 'follows-policy',
 *   instructions: 'Output "ok" or describe the policy violation.',
 *   schema: z.string(),
 *   injectionBehaviour: 'carry-forward',
 *   onExtracted: ({ mainAgent, extracted, threadId }) => {
 *     if (mainAgent && extracted && extracted !== 'ok') {
 *       mainAgent.sendSignal(
 *         { type: 'system-reminder', contents: `POLICY: ${extracted}` },
 *         { threadId, ifIdle: { behavior: 'discard' } },
 *       );
 *     }
 *   },
 * });
 * ```
 *
 * Built-in factories are provided for the common cases shipped with
 * ObservationalMemory:
 *
 * ```ts
 * new ObservationalMemory({
 *   storage,
 *   observation: {
 *     extract: [
 *       Extractor.currentTask(),
 *       Extractor.suggestedResponse(),
 *       Extractor.threadTitle(),
 *     ],
 *   },
 * });
 * ```
 *
 * @experimental
 */
export class Extractor<T = string> {
  /** Human-readable name as passed in by the caller (trimmed). */
  readonly name: string;
  /** Slug derived from `name`, used as the XML tag and storage key. */
  readonly slug: string;
  /** Instructions placed inside the observer's output-format spec. */
  readonly instructions: string;
  /** Zod schema describing the extracted value. */
  readonly schema: z.ZodType<T>;
  /** How the previous extracted value is reused on subsequent observer calls. */
  readonly injectionBehaviour: ExtractorInjectionBehaviour;
  /** Optional lifecycle hook invoked after each successful extraction. */
  readonly onExtracted?: (ctx: ExtractorOnExtractedContext<T>) => void | Promise<void>;

  constructor(config: ExtractorConfig<T>) {
    if (!config.name || !config.name.trim()) {
      throw new Error('Extractor.name is required');
    }

    const slug = slugifyExtractorName(config.name);
    if (!slug) {
      throw new Error(
        `Extractor.name "${config.name}" slugifies to an empty string — pick a name with at least one alphanumeric character`,
      );
    }

    if (!config.instructions || !config.instructions.trim()) {
      throw new Error(`Extractor "${config.name}" requires non-empty instructions`);
    }

    this.name = config.name.trim();
    this.slug = slug;
    this.instructions = config.instructions;
    this.schema = config.schema ?? (z.string() as unknown as z.ZodType<T>);
    this.injectionBehaviour = config.injectionBehaviour ?? 'none';
    this.onExtracted = config.onExtracted;
  }

  /**
   * Built-in extractor that asks the Observer to suggest a short thread
   * title (2-5 words). The resulting value is mirrored to both
   * `thread.title` and `thread.metadata.mastra.om.threadTitle`, and carried
   * forward as a prior hint on subsequent observer calls.
   */
  static threadTitle(
    overrides: Partial<Pick<ExtractorConfig<string>, 'instructions' | 'onExtracted'>> = {},
  ): Extractor<string> {
    return new Extractor<string>({
      name: BUILT_IN_EXTRACTOR_SLUGS.threadTitle,
      instructions: overrides.instructions ?? DEFAULT_THREAD_TITLE_INSTRUCTIONS,
      schema: z.string(),
      injectionBehaviour: 'carry-forward',
      onExtracted: overrides.onExtracted,
    });
  }

  /**
   * Built-in extractor that asks the Observer to describe what the agent
   * is currently working on. Stored in thread metadata and injected into
   * the main agent's context as a `<current-task>` system message on
   * subsequent turns.
   */
  static currentTask(
    overrides: Partial<Pick<ExtractorConfig<string>, 'instructions' | 'onExtracted'>> = {},
  ): Extractor<string> {
    return new Extractor<string>({
      name: BUILT_IN_EXTRACTOR_SLUGS.currentTask,
      instructions: overrides.instructions ?? DEFAULT_CURRENT_TASK_INSTRUCTIONS,
      schema: z.string(),
      injectionBehaviour: 'carry-forward',
      onExtracted: overrides.onExtracted,
    });
  }

  /**
   * Built-in extractor that asks the Observer to suggest the agent's next
   * response. Stored in thread metadata and injected into the main agent's
   * context as a `<suggested-response>` system message on subsequent turns.
   */
  static suggestedResponse(
    overrides: Partial<Pick<ExtractorConfig<string>, 'instructions' | 'onExtracted'>> = {},
  ): Extractor<string> {
    return new Extractor<string>({
      name: BUILT_IN_EXTRACTOR_SLUGS.suggestedResponse,
      instructions: overrides.instructions ?? DEFAULT_SUGGESTED_RESPONSE_INSTRUCTIONS,
      schema: z.string(),
      injectionBehaviour: 'carry-forward',
      onExtracted: overrides.onExtracted,
    });
  }
}

/**
 * XML tags reserved by the observer/reflector pipeline itself. Custom
 * extractor names must not slugify to any of these.
 *
 * @internal
 */
const RESERVED_XML_TAGS = new Set<string>(['observations', 'thread', ...Object.values(BUILT_IN_EXTRACTOR_SLUGS)]);

/**
 * Validate a user-supplied extractor list, checking for slug uniqueness
 * and conflicts with reserved tags.
 *
 * @internal
 */
export function validateExtractorList(
  extractors: ReadonlyArray<Extractor<unknown>>,
  context: 'observer.extract' | 'reflector.extract',
): void {
  const seen = new Map<string, string>();
  for (const extractor of extractors) {
    const existing = seen.get(extractor.slug);
    if (existing) {
      throw new Error(
        `${context}: extractors "${existing}" and "${extractor.name}" both slugify to "${extractor.slug}" — names must produce unique slugs`,
      );
    }
    seen.set(extractor.slug, extractor.name);

    // Reserved-tag check applies only to non-built-in slugs. The built-in
    // factories (Extractor.threadTitle, etc.) intentionally use reserved
    // slugs because they are wired into the observer's hardcoded sections.
    if (!isBuiltInExtractorSlug(extractor.slug) && RESERVED_XML_TAGS.has(extractor.slug)) {
      throw new Error(
        `${context}: extractor name "${extractor.name}" slugifies to reserved XML tag "<${extractor.slug}>" — pick a different name`,
      );
    }
  }
}

/**
 * Build the XML section instructions appended to the observer's output
 * format spec for each non-built-in extractor.
 *
 * @internal
 */
export function buildCustomExtractorOutputSections(extractors: ReadonlyArray<Extractor<unknown>>): string {
  if (extractors.length === 0) {
    return '';
  }
  const sections: string[] = [];
  for (const extractor of extractors) {
    sections.push(`<${extractor.slug}>\n${extractor.instructions.trim()}\n</${extractor.slug}>`);
  }
  return `\n\n${sections.join('\n\n')}`;
}

/**
 * Stringify an extracted value for use as a "prior" hint in the next
 * observer call. Falls back to JSON for non-string values.
 *
 * @internal
 */
function stringifyExtractedValue(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/**
 * Build prior-value markdown lines for extractors with `carry-forward`
 * injection behaviour. Returns an empty array when no extractors should
 * carry forward or when no prior values are available.
 *
 * @internal
 */
export function buildCustomExtractorPriorLines(
  extractors: ReadonlyArray<Extractor<unknown>>,
  priorValues: Readonly<Record<string, unknown>> | undefined,
): string[] {
  if (!priorValues || extractors.length === 0) {
    return [];
  }
  const lines: string[] = [];
  for (const extractor of extractors) {
    if (extractor.injectionBehaviour !== 'carry-forward') continue;
    const value = priorValues[extractor.slug];
    if (value === undefined || value === null || value === '') continue;
    lines.push(`- prior ${extractor.slug}: ${stringifyExtractedValue(value)}`);
  }
  return lines;
}

/**
 * Escape a regex special character in a slug. The slug only contains
 * `[a-z0-9-]` so this is mostly defensive.
 */
function escapeSlugForRegex(slug: string): string {
  return slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Parse custom-extractor XML sections from a body of observer/thread
 * output text. Returns a map of `slug -> trimmed string content` for
 * every extractor whose tag was found. Tags must appear at the start of
 * a line (after optional whitespace) to mirror the parsing convention
 * used for built-in observer sections.
 *
 * @internal
 */
export function parseCustomExtractorValues(
  content: string,
  extractors: ReadonlyArray<Extractor<unknown>>,
): Record<string, string> {
  const result: Record<string, string> = {};
  if (!content || extractors.length === 0) return result;

  for (const extractor of extractors) {
    const slug = escapeSlugForRegex(extractor.slug);
    // Opening tag must be at the start of a line so inline mentions of
    // `<slug>` in observation prose don't get captured.
    const re = new RegExp(`^[ \\t]*<${slug}>([\\s\\S]*?)</${slug}>`, 'im');
    const match = content.match(re);
    if (match?.[1] !== undefined) {
      const value = match[1].trim();
      if (value) {
        result[extractor.slug] = value;
      }
    }
  }

  return result;
}

/**
 * Strip the textual XML sections for custom extractors out of a chunk of
 * observer output. Used by the observer parser so the leftover
 * `observations` block doesn't end up containing the custom tags.
 *
 * @internal
 */
export function stripCustomExtractorSections(content: string, extractors: ReadonlyArray<Extractor<unknown>>): string {
  if (!content || extractors.length === 0) return content;
  let result = content;
  for (const extractor of extractors) {
    const slug = escapeSlugForRegex(extractor.slug);
    const re = new RegExp(`<${slug}>[\\s\\S]*?</${slug}>`, 'gi');
    result = result.replace(re, '');
  }
  return result;
}

/**
 * Resolve the extracted value for a single extractor from an observation
 * cycle's per-extractor results. Built-in slugs are mapped to the
 * dedicated fields on `ObserverOutput`; everything else is looked up in
 * `customExtractorValues` by slug.
 *
 * @internal
 */
export function getExtractedValueForExtractor(
  extractor: Extractor<unknown>,
  values: {
    currentTask?: string;
    suggestedContinuation?: string;
    threadTitle?: string;
    customExtractorValues?: Readonly<Record<string, unknown>>;
  },
): unknown {
  switch (extractor.slug) {
    case BUILT_IN_EXTRACTOR_SLUGS.threadTitle:
      return values.threadTitle;
    case BUILT_IN_EXTRACTOR_SLUGS.currentTask:
      return values.currentTask;
    case BUILT_IN_EXTRACTOR_SLUGS.suggestedResponse:
      return values.suggestedContinuation;
    default:
      return values.customExtractorValues?.[extractor.slug];
  }
}

/**
 * Invoke the `onExtracted` lifecycle hook for every extractor in the list
 * that has one configured. Errors thrown by user-supplied hooks are caught
 * and reported via the optional `onError` callback so a single bad hook
 * never breaks the observation cycle for the other extractors.
 *
 * @internal
 */
export async function invokeExtractorHooks(
  extractors: ReadonlyArray<Extractor<unknown>>,
  values: {
    currentTask?: string;
    suggestedContinuation?: string;
    threadTitle?: string;
    customExtractorValues?: Readonly<Record<string, unknown>>;
  },
  ctx: {
    threadId: string;
    resourceId?: string;
    mainAgent?: Agent;
    runId?: string;
  },
  onError?: (extractor: Extractor<unknown>, error: unknown) => void,
): Promise<void> {
  if (extractors.length === 0) return;
  await Promise.all(
    extractors.map(async extractor => {
      if (!extractor.onExtracted) return;
      const extracted = getExtractedValueForExtractor(extractor, values);
      if (extracted === undefined || extracted === null || extracted === '') {
        // Don't fire the hook for empty values — the observer didn't emit
        // a value for this extractor in the current cycle.
        return;
      }
      try {
        await extractor.onExtracted({
          extracted,
          extractor: extractor as Extractor<unknown>,
          threadId: ctx.threadId,
          resourceId: ctx.resourceId,
          mainAgent: ctx.mainAgent,
          runId: ctx.runId,
        });
      } catch (err) {
        onError?.(extractor, err);
      }
    }),
  );
}
