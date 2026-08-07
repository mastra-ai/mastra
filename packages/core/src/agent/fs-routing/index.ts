import { MastraError, ErrorDomain, ErrorCategory } from '../../error';
import type { MastraScorer, MastraScorerEntry, MastraScorers } from '../../evals';
import type { MastraMemory } from '../../memory/memory';
import type { InputProcessorOrWorkflow, OutputProcessorOrWorkflow } from '../../processors';
import { assertValidScheduleDefinition } from '../../schedules/define';
import type { AgentScheduleDefinition, DeclaredAgentSchedule } from '../../schedules/define';
import type { InlineSkill, SkillInput } from '../../skills/types';
import type { DynamicArgument } from '../../types';
import { Workspace, LocalFilesystem, LocalSandbox } from '../../workspace';
import type { AnyWorkspace } from '../../workspace';
import { Agent } from '../agent';
import type { AgentConfig, AgentInstructions, ToolsInput } from '../types';

/**
 * Identity helper for a file-system routed agent config. Returns the provided
 * partial config unchanged — its only purpose is to give authors editor types
 * for `agents/<name>/config.ts` while letting `instructions`/`model`/`tools` be
 * supplied by sibling files (`instructions.md`/`instructions.ts`, `tools/*.ts`).
 *
 * @example
 * ```ts
 * // src/mastra/agents/weather/config.ts
 * import { agentConfig } from '@mastra/core/agent';
 *
 * export default agentConfig({
 *   model: 'openai/gpt-4o',
 *   // instructions omitted -> taken from instructions.md
 *   // tools omitted -> taken from tools/*.ts
 * });
 * ```
 */
export type FsAgentConfig = Partial<Omit<AgentConfig, 'id' | 'name'>> & {
  id?: string;
  name?: string;
};

export function agentConfig(config: FsAgentConfig): FsAgentConfig {
  return config;
}

/**
 * Identity helper for a file-system routed agent's `instructions.ts`. Returns
 * the provided value unchanged — its only purpose is to give authors editor
 * types for `agents/<name>/instructions.ts`, which is the code counterpart to
 * `instructions.md`: use it when the prompt is computed, composed from shared
 * constants, or resolved per request.
 *
 * @example
 * ```ts
 * // src/mastra/agents/support/instructions.ts
 * import { agentInstructions } from '@mastra/core/agent';
 *
 * export default agentInstructions(({ requestContext }) => {
 *   const tier = requestContext.get('tier') ?? 'standard';
 *   return `You are a support agent. Treat this as a ${tier}-tier customer.`;
 * });
 * ```
 */
export function agentInstructions<TRequestContext extends Record<string, any> | unknown = unknown>(
  instructions: DynamicArgument<AgentInstructions, TRequestContext>,
): DynamicArgument<AgentInstructions, TRequestContext> {
  return instructions;
}

// Re-exported so authoring a file-based agent needs one import path: schedules
// live next to `config.ts` in the same directory, so `defineSchedule` should be
// reachable from the same module as `agentConfig`. `@mastra/core/schedules`
// remains the canonical home.
export { defineSchedule } from '../../schedules/define';
export type { AgentScheduleDefinition, AgentScheduleHandler, DeclaredAgentSchedule } from '../../schedules/define';

/**
 * A single tool discovered under `agents/<name>/tools/`. `key` defaults to the
 * filename slug; `tool` is the default export of that module.
 */
export interface FsAgentToolEntry {
  key: string;
  tool: ToolsInput[string];
}

/**
 * A single scorer discovered under `agents/<name>/scorers/`. `key` defaults to
 * the filename slug. `scorer` is the module's default export, which may be a
 * bare `MastraScorer` (it is wrapped into `{ scorer }`) or an explicit
 * `{ scorer, sampling }` entry.
 */
export interface FsAgentScorerEntry {
  key: string;
  scorer: MastraScorer<any, any, any, any> | MastraScorerEntry;
}

/**
 * A single schedule discovered under `agents/<name>/schedules/`. `key` is the
 * file's path relative to `schedules/` with the extension stripped, so nested
 * files keep a stable identity (`billing/sweep.ts` → `billing/sweep`).
 * `schedule` is the default export of a `.ts` module or the parsed form of a
 * `.md` file (cron frontmatter + body as the prompt).
 */
export interface FsAgentScheduleEntry {
  key: string;
  schedule: AgentScheduleDefinition;
}

export interface FsAgentEntry {
  /** Agent directory name. Used as the default `id`/`name`. */
  name: string;
  /**
   * Default export of `config.ts`, if present. Either an `agentConfig(...)`
   * partial or a fully code-defined `Agent` instance (`new Agent({...})`).
   */
  config?: FsAgentConfig | Agent;
  /**
   * Default export of `agents/<name>/instructions.ts`, if present. Either an
   * `AgentInstructions` value or a function resolved per request. Unlike
   * `instructionsMd` this is a live module value, so it can be computed. Set the
   * key only when the file exists: assembly reads presence from the key, so an
   * `undefined` value is a broken module rather than an absent one.
   */
  instructions?: DynamicArgument<AgentInstructions>;
  /** Raw contents of `instructions.md`, if present. */
  instructionsMd?: string;
  /** Tools discovered under `tools/`, already loaded. */
  tools?: FsAgentToolEntry[];
  /**
   * Skills discovered under `skills/`, already loaded as inline skills
   * (the codegen layer inlines each `SKILL.md` + references via `createSkill`).
   */
  skills?: InlineSkill[];
  /**
   * Default export of `agents/<name>/workspace.ts`, if present. A `Workspace`
   * instance that overrides the convention default.
   */
  workspace?: AnyWorkspace;
  /**
   * Default export of `agents/<name>/memory.ts`, if present. A `MastraMemory`
   * instance wired into the assembled agent as its `memory`. `config.memory`
   * (from `config.ts`) takes precedence on conflict.
   */
  memory?: MastraMemory;
  /**
   * Base path for the convention default workspace. When provided and neither
   * `config.workspace` nor `workspace.ts` supplies one, an FS agent gets a
   * default `Workspace` (a contained `LocalFilesystem` rooted here plus a
   * `LocalSandbox`), giving file-based agents file/shell tools automatically.
   * Callers (the deployer codegen layer) pass a per-agent directory here.
   */
  defaultWorkspaceBasePath?: string;
  /**
   * Input processors discovered under `processors/input/`, already loaded.
   * Merged with `config.inputProcessors`; config takes precedence on collision.
   */
  inputProcessors?: InputProcessorOrWorkflow[];
  /**
   * Output processors discovered under `processors/output/`, already loaded.
   * Merged with `config.outputProcessors`; config takes precedence on collision.
   */
  outputProcessors?: OutputProcessorOrWorkflow[];
  /**
   * Scorers discovered under `agents/<name>/scorers/`, already loaded. Each
   * entry's `scorer` is either a bare `MastraScorer` (the default export of the
   * scorer module) or a `{ scorer, sampling }` entry. Merged into
   * `config.scorers`; config takes precedence on key collision.
   */
  scorers?: FsAgentScorerEntry[];
  /**
   * Schedules discovered under `agents/<name>/schedules/`, in stable
   * (path-sorted) order. Attached to the assembled agent and synced into
   * schedule storage by Mastra at boot. Only root agents may declare
   * schedules — a schedule on a subagent is a build error, because subagents
   * are wired into their parent's `agents` map rather than registered on the
   * Mastra instance, so the scheduler could never resolve their `agentId`.
   */
  schedules?: FsAgentScheduleEntry[];
  /**
   * Declared subagents discovered under `agents/<name>/subagents/<childId>/`.
   * Each entry is assembled into its own `Agent` and wired into the parent's
   * `agents` map under its directory name, becoming a model-visible delegation
   * tool. Subagents may declare their own `subagents`, up to
   * `MAX_FS_SUBAGENT_DEPTH` levels below the top-level agent; deeper entries
   * are ignored with a warning.
   */
  subagents?: FsAgentEntry[];
}

/**
 * Maximum nesting depth for declared subagents. A top-level agent is depth 0;
 * its subagents are depth 1, and so on. Subagents declared deeper than this
 * are ignored with a warning. The cap keeps delegation trees a sane size and
 * guards `assembleAgentFromFsEntry` against cyclic entry objects.
 */
export const MAX_FS_SUBAGENT_DEPTH = 3;

/**
 * Assemble a single `Agent` from already-loaded file-system entries for one
 * `agents/<name>/` directory. Performs no filesystem access — callers load the
 * modules and pass them in, keeping this unit-testable and runtime-portable.
 *
 * Precedence rules:
 * - `id`/`name` default to the directory name when omitted in config.
 * - `instructions`: a dynamic (function) `config.instructions` wins over both
 *   instructions files; otherwise `instructions.ts` wins over `instructions.md`,
 *   which wins over a static `config.instructions`. Missing all of them is an
 *   error.
 * - `model` is required (from config); missing is an error.
 * - `tools`: discovered `tools/*.ts` are merged with `config.tools`; on key
 *   collision `config.tools` wins (a warning is surfaced via `onWarn`).
 * - `skills`: discovered `skills/*` are merged with `config.skills`; on name
 *   collision `config.skills` wins (a warning is surfaced via `onWarn`). A
 *   dynamic (function) `config.skills` wins wholesale and discovered skills are
 *   ignored with a warning.
 * - `memory`: `memory.ts`'s default export is used unless `config.memory` is
 *   set, in which case `config.memory` wins (a warning is surfaced via
 *   `onWarn`). Missing both leaves the agent without memory.
 *
 * If `config` is already an `Agent` instance (the author wrote
 * `export default new Agent({...})` in `config.ts`), it is used as-is — no
 * partial-config assembly is performed. This lets a folder under `agents/`
 * hold either an `agentConfig(...)` partial or a fully code-defined
 * `new Agent(...)` without the loader trying to re-wrap the latter.
 */
export function assembleAgentFromFsEntry(entry: FsAgentEntry, options?: { onWarn?: (message: string) => void }): Agent {
  return assembleAtDepth(entry, 0, options);
}

function assembleAtDepth(entry: FsAgentEntry, depth: number, options?: { onWarn?: (message: string) => void }): Agent {
  const {
    name,
    config = {},
    instructions: instructionsModule,
    instructionsMd,
    tools = [],
    skills = [],
    inputProcessors = [],
    outputProcessors = [],
    scorers = [],
    schedules = [],
    workspace,
    memory,
    defaultWorkspaceBasePath,
    subagents = [],
  } = entry;
  const onWarn = options?.onWarn ?? (() => {});

  // A code-defined agent (`export default new Agent({...})`) is used verbatim.
  if (config instanceof Agent) {
    if (instructionsModule !== undefined) {
      onWarn(`Agent "${name}": config.ts exports a new Agent(), so agents/${name}/instructions.ts is ignored.`);
    }
    if (instructionsMd !== undefined) {
      onWarn(`Agent "${name}": config.ts exports a new Agent(), so agents/${name}/instructions.md is ignored.`);
    }
    if (tools.length > 0) {
      onWarn(
        `Agent "${name}": config.ts exports a new Agent(), so discovered tools under agents/${name}/tools/ are ignored.`,
      );
    }
    if (skills.length > 0) {
      onWarn(
        `Agent "${name}": config.ts exports a new Agent(), so discovered skills under agents/${name}/skills/ are ignored.`,
      );
    }
    if (workspace !== undefined) {
      onWarn(
        `Agent "${name}": config.ts exports a new Agent(), so agents/${name}/workspace.ts is ignored. Set the workspace in the Agent config instead.`,
      );
    }
    if (memory !== undefined) {
      onWarn(
        `Agent "${name}": config.ts exports a new Agent(), so agents/${name}/memory.ts is ignored. Set the memory in the Agent config instead.`,
      );
    }
    if (inputProcessors.length > 0) {
      onWarn(
        `Agent "${name}": config.ts exports a new Agent(), so discovered input processors under agents/${name}/processors/input/ are ignored.`,
      );
    }
    if (outputProcessors.length > 0) {
      onWarn(
        `Agent "${name}": config.ts exports a new Agent(), so discovered output processors under agents/${name}/processors/output/ are ignored.`,
      );
    }
    if (scorers.length > 0) {
      onWarn(
        `Agent "${name}": config.ts exports a new Agent(), so discovered scorers under agents/${name}/scorers/ are ignored.`,
      );
    }
    if (subagents.length > 0) {
      onWarn(
        `Agent "${name}": config.ts exports a new Agent(), so discovered subagents under agents/${name}/subagents/ are ignored. Set 'agents' in the Agent config instead.`,
      );
    }
    if (schedules.length > 0) {
      // A code-defined agent is used verbatim, so attaching declared schedules
      // here would be surprising: the author owns the whole Agent and can call
      // `mastra.schedules.create(...)` instead.
      onWarn(
        `Agent "${name}": config.ts exports a new Agent(), so discovered schedules under agents/${name}/schedules/ are ignored. Create them with mastra.schedules.create(...) instead.`,
      );
    }
    return config;
  }

  // Presence is the key being set, not the value being defined: codegen emits
  // `instructions` only when the file exists, so a module that default-exports
  // `undefined` has to read as a broken file rather than as no file at all.
  // Own key only: an inherited one never came from a discovered file.
  const instructions = resolveInstructions(
    name,
    config.instructions,
    instructionsModule,
    Object.hasOwn(entry, 'instructions'),
    instructionsMd,
    onWarn,
  );

  if (!config.model) {
    throw new MastraError({
      id: 'AGENT_FS_ROUTING_MODEL_REQUIRED',
      domain: ErrorDomain.AGENT,
      category: ErrorCategory.USER,
      details: { agentName: name },
      text: `Agent "${name}": missing model in config.ts and no default. Provide a 'model' in agents/${name}/config.ts.`,
    });
  }

  const mergedTools = mergeTools(name, tools, config.tools, onWarn);
  const mergedSkills = mergeSkills(name, skills, config.skills, onWarn);
  const mergedWorkspace = mergeWorkspace(name, workspace, config.workspace, defaultWorkspaceBasePath, onWarn);
  const mergedMemory = mergeMemory(name, memory, config.memory, onWarn);
  const mergedAgents = mergeSubAgents(name, subagents, config.agents, mergedTools, depth, options);
  const mergedInputProcessors = mergeProcessors(name, 'input', inputProcessors, config.inputProcessors, onWarn);
  const mergedOutputProcessors = mergeProcessors(name, 'output', outputProcessors, config.outputProcessors, onWarn);
  const mergedScorers = mergeScorers(name, scorers, config.scorers, onWarn);

  const assembled = {
    ...config,
    id: config.id ?? name,
    name: config.name ?? name,
    instructions,
    ...(mergedTools !== undefined ? { tools: mergedTools } : {}),
    ...(mergedSkills !== undefined ? { skills: mergedSkills } : {}),
    ...(mergedWorkspace !== undefined ? { workspace: mergedWorkspace } : {}),
    ...(mergedMemory !== undefined ? { memory: mergedMemory } : {}),
    ...(mergedAgents !== undefined ? { agents: mergedAgents } : {}),
    ...(mergedInputProcessors !== undefined ? { inputProcessors: mergedInputProcessors } : {}),
    ...(mergedOutputProcessors !== undefined ? { outputProcessors: mergedOutputProcessors } : {}),
    ...(mergedScorers !== undefined ? { scorers: mergedScorers } : {}),
  } as AgentConfig;

  const agent = new Agent(assembled);
  agent.__setDeclaredSchedules(resolveSchedules(name, schedules, depth));
  return agent;
}

/**
 * Validate discovered schedules and pair each with its path-derived key.
 *
 * Only root agents may declare schedules. A schedule row targets an agent by
 * id and the worker resolves it with `mastra.getAgentById(...)`; subagents live
 * in their parent's `agents` map and are never registered on the Mastra
 * instance, so a subagent schedule would fire forever against a missing agent.
 * Failing the build is the only honest outcome.
 */
function resolveSchedules(name: string, schedules: FsAgentScheduleEntry[], depth: number): DeclaredAgentSchedule[] {
  if (schedules.length === 0) return [];

  if (depth > 0) {
    throw new MastraError({
      id: 'AGENT_FS_ROUTING_SUBAGENT_SCHEDULES_UNSUPPORTED',
      domain: ErrorDomain.AGENT,
      category: ErrorCategory.USER,
      details: { agentName: name },
      text: `Agent "${name}": schedules are only supported on root agents, but agents/.../subagents/${name}/schedules/ declares ${schedules.length}. Move them to the root agent's schedules/ directory.`,
    });
  }

  const seen = new Set<string>();
  const resolved: DeclaredAgentSchedule[] = [];
  for (const { key, schedule } of schedules) {
    if (seen.has(key)) {
      throw new MastraError({
        id: 'AGENT_FS_ROUTING_SCHEDULE_NAME_COLLISION',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        details: { agentName: name, scheduleKey: key },
        text: `Agent "${name}": duplicate schedule "${key}" under agents/${name}/schedules/. Two files resolve to the same schedule id; rename one.`,
      });
    }
    seen.add(key);
    assertValidScheduleDefinition(schedule, `agents/${name}/schedules/${key}`);
    resolved.push({ key, definition: schedule });
  }
  return resolved;
}

/**
 * Resolve the instructions for a file-based agent from the three sources that
 * can supply them, in this order:
 *
 * 1. A dynamic (function) `config.instructions` — it can't be expressed by
 *    static markdown, and it stays ahead of `instructions.ts` so adding the file
 *    never silently overrides a config already resolving per request.
 * 2. `instructions.ts` — the code counterpart to the markdown file, so it wins
 *    over it (with a warning when both exist).
 * 3. `instructions.md`, then a static `config.instructions`.
 *
 * Missing all of them is a build error naming the agent directory.
 */
function resolveInstructions(
  name: string,
  configInstructions: FsAgentConfig['instructions'],
  instructionsModule: DynamicArgument<AgentInstructions> | undefined,
  hasModule: boolean,
  instructionsMd: string | undefined,
  onWarn: (message: string) => void,
): FsAgentConfig['instructions'] {
  const hasConfigInstructions = configInstructions !== undefined && configInstructions !== null;
  const hasMd = instructionsMd !== undefined;

  if (hasConfigInstructions && typeof configInstructions === 'function') {
    // A config already resolving per request stays authoritative, so adding
    // either file later can't silently take the agent's prompt over.
    const overridden = [hasModule ? 'instructions.ts' : undefined, hasMd ? 'instructions.md' : undefined].filter(
      (file): file is string => file !== undefined,
    );
    if (overridden.length > 0) {
      const sources =
        overridden.length === 1 ? `both config.ts and ${overridden[0]}` : `config.ts, ${overridden.join(', and ')}`;
      onWarn(`Agent "${name}": instructions defined in ${sources}; config.instructions is a function, so it wins.`);
    }
    return configInstructions;
  }

  if (hasModule) {
    assertValidInstructionsModule(name, instructionsModule);
    if (hasMd) {
      onWarn(
        `Agent "${name}": instructions defined in both instructions.ts and instructions.md; instructions.ts wins.`,
      );
    }
    return instructionsModule;
  }

  if (hasMd) {
    return instructionsMd as AgentInstructions;
  }

  if (hasConfigInstructions) {
    return configInstructions;
  }

  throw new MastraError({
    id: 'AGENT_FS_ROUTING_INSTRUCTIONS_REQUIRED',
    domain: ErrorDomain.AGENT,
    category: ErrorCategory.USER,
    details: { agentName: name },
    text: `Agent "${name}": missing instructions. Provide agents/${name}/instructions.md, agents/${name}/instructions.ts, or an 'instructions' field in config.ts.`,
  });
}

/**
 * Reject an `instructions.ts` whose default export isn't a usable instructions
 * value. Anything outside the `AgentInstructions` shapes is silently coerced to
 * an empty prompt downstream, so without this an author who exported the wrong
 * thing gets a mute agent and no clue which file caused it — the error has to
 * name the file while assembly still knows it. `null` and `undefined` are
 * rejected the same way rather than reading as "no file here" — the caller
 * decides presence from the file existing, not from the value. (A module with
 * no default export at all never reaches here; the bundler fails first, naming
 * the same file.)
 */
function assertValidInstructionsModule(
  name: string,
  instructions: unknown,
): asserts instructions is DynamicArgument<AgentInstructions> {
  const isUsable =
    typeof instructions === 'function' ||
    (Array.isArray(instructions)
      ? instructions.length > 0 && instructions.every(isUsableSystemMessage)
      : isUsableSystemMessage(instructions));

  if (isUsable) {
    return;
  }

  const received = describeInstructionsExport(instructions);
  throw new MastraError({
    id: 'AGENT_FS_ROUTING_INSTRUCTIONS_INVALID',
    domain: ErrorDomain.AGENT,
    category: ErrorCategory.USER,
    details: { agentName: name, received },
    text: `Agent "${name}": agents/${name}/instructions.ts must default-export a string, a system message, an array of either, or a function returning one, but got ${received}.`,
  });
}

/**
 * One entry of an `AgentInstructions` value: a bare string, or a system message
 * whose `content` is a string. Anything else reaches the model as an empty
 * string, so the entries have to be checked rather than just the container —
 * `[123]` is exactly as mute as `123`.
 */
function isUsableSystemMessage(value: unknown): boolean {
  return (
    typeof value === 'string' ||
    (typeof value === 'object' && value !== null && typeof (value as { content?: unknown }).content === 'string')
  );
}

/** Name what an unusable default export actually was, for the error text. */
function describeInstructionsExport(value: unknown): string {
  if (value === null) {
    return 'null';
  }
  if (Array.isArray(value)) {
    return value.length === 0 ? 'an empty array' : 'an array holding something other than strings or system messages';
  }
  return typeof value;
}

function mergeTools(
  name: string,
  fsTools: FsAgentToolEntry[],
  configTools: FsAgentConfig['tools'],
  onWarn: (message: string) => void,
): ToolsInput | undefined {
  const fromFs: ToolsInput = {};
  for (const { key, tool } of fsTools) {
    fromFs[key] = tool;
  }

  // Dynamic config.tools (a function) can't be statically merged; it wins
  // wholesale and discovered tools are ignored with a warning.
  if (typeof configTools === 'function') {
    if (fsTools.length > 0) {
      onWarn(
        `Agent "${name}": config.tools is a function, so discovered tools under agents/${name}/tools/ are ignored.`,
      );
    }
    return configTools as unknown as ToolsInput;
  }

  const fromConfig = (configTools ?? {}) as ToolsInput;
  for (const key of Object.keys(fromConfig)) {
    if (key in fromFs) {
      onWarn(`Agent "${name}": tool "${key}" defined in both config.tools and tools/; config.tools wins.`);
    }
  }

  const merged: ToolsInput = { ...fromFs, ...fromConfig };
  return Object.keys(merged).length > 0 ? merged : undefined;
}

function mergeSkills(
  name: string,
  fsSkills: InlineSkill[],
  configSkills: FsAgentConfig['skills'],
  onWarn: (message: string) => void,
): SkillInput[] | undefined {
  // Dynamic config.skills (a function) can't be statically merged; it wins
  // wholesale and discovered skills are ignored with a warning.
  if (typeof configSkills === 'function') {
    if (fsSkills.length > 0) {
      onWarn(
        `Agent "${name}": config.skills is a function, so discovered skills under agents/${name}/skills/ are ignored.`,
      );
    }
    return undefined;
  }

  const fromConfig = (configSkills ?? []) as SkillInput[];
  const configNames = new Set(fromConfig.map(skill => (typeof skill === 'string' ? skill : skill.name)));

  // config.skills wins on name collision; drop the fs skill and warn.
  const fromFs = fsSkills.filter(skill => {
    if (configNames.has(skill.name)) {
      onWarn(`Agent "${name}": skill "${skill.name}" defined in both config.skills and skills/; config.skills wins.`);
      return false;
    }
    return true;
  });

  const merged: SkillInput[] = [...fromFs, ...fromConfig];
  return merged.length > 0 ? merged : undefined;
}

/**
 * Assemble discovered subagents and merge them into the parent's `agents` map.
 *
 * Each discovered subagent is assembled independently, recursing into its own
 * `subagents` up to `MAX_FS_SUBAGENT_DEPTH` levels below the top-level agent
 * (deeper entries are ignored with a warning). Rules:
 * - Each subagent's `config.ts` must resolve a non-empty `description`;
 *   otherwise a dir-scoped build error is thrown.
 * - A subagent id that collides with a resolved tool key on the same parent, or
 *   a duplicate subagent id, is a build error.
 * - `config.agents` takes precedence: a dynamic (function) `config.agents` wins
 *   wholesale and discovered subagents are ignored with a warning; a static
 *   `config.agents` wins per-key on id collision with a warning.
 */
function mergeSubAgents(
  name: string,
  fsSubAgents: FsAgentEntry[],
  configAgents: FsAgentConfig['agents'],
  mergedTools: ToolsInput | undefined,
  depth: number,
  options?: { onWarn?: (message: string) => void },
): FsAgentConfig['agents'] | undefined {
  const onWarn = options?.onWarn ?? (() => {});

  if (fsSubAgents.length > 0 && depth >= MAX_FS_SUBAGENT_DEPTH) {
    onWarn(
      `Agent "${name}": ignoring its subagents — subagents may only nest ${MAX_FS_SUBAGENT_DEPTH} levels below a top-level agent.`,
    );
    fsSubAgents = [];
  }

  // Dynamic config.agents (a function) can't be statically merged; it wins
  // wholesale and discovered subagents are ignored with a warning.
  if (typeof configAgents === 'function') {
    if (fsSubAgents.length > 0) {
      onWarn(
        `Agent "${name}": config.agents is a function, so discovered subagents under agents/${name}/subagents/ are ignored.`,
      );
    }
    return configAgents;
  }

  const fromConfig = (configAgents ?? {}) as Record<string, Agent>;
  const configKeys = new Set(Object.keys(fromConfig));
  const toolKeys = new Set(Object.keys(mergedTools ?? {}));

  const fromFs: Record<string, Agent> = {};
  for (const childEntry of fsSubAgents) {
    const childId = childEntry.name;

    if (childId in fromFs) {
      throw new MastraError({
        id: 'AGENT_FS_ROUTING_SUBAGENT_NAME_COLLISION',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        details: { agentName: name, subagentName: childId },
        text: `Agent "${name}": duplicate subagent "${childId}" under agents/${name}/subagents/.`,
      });
    }

    if (toolKeys.has(childId)) {
      throw new MastraError({
        id: 'AGENT_FS_ROUTING_SUBAGENT_NAME_COLLISION',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        details: { agentName: name, subagentName: childId },
        text: `Agent "${name}": subagent "${childId}" collides with a tool of the same name. Rename agents/${name}/subagents/${childId}/ or the tool.`,
      });
    }

    const child = assembleAtDepth(childEntry, depth + 1, options);

    const description = child.getDescription();
    if (!description || description.trim() === '') {
      throw new MastraError({
        id: 'AGENT_FS_ROUTING_SUBAGENT_DESCRIPTION_REQUIRED',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        details: { agentName: name, subagentName: childId },
        text: `Agent "${name}": subagent "${childId}" requires a non-empty 'description'. Set one in agents/${name}/subagents/${childId}/config.ts.`,
      });
    }

    if (configKeys.has(childId)) {
      onWarn(
        `Agent "${name}": subagent "${childId}" defined in both config.agents and subagents/; config.agents wins.`,
      );
      continue;
    }

    fromFs[childId] = child;
  }

  const merged = { ...fromFs, ...fromConfig };
  return Object.keys(merged).length > 0 ? (merged as FsAgentConfig['agents']) : undefined;
}

/**
 * Resolve the workspace for a file-based agent.
 *
 * Precedence (explicit > convention > default):
 * - `config.workspace` (from `config.ts`) wins over everything.
 * - `workspace.ts`'s default export wins over the convention default.
 * - Otherwise, when `defaultWorkspaceBasePath` is provided, a default
 *   `Workspace` (contained `LocalFilesystem` + `LocalSandbox`) is created so
 *   file-based agents get file/shell tools automatically (Eve sandbox parity).
 * - If none of the above apply, returns `undefined` (no workspace).
 */
function mergeWorkspace(
  name: string,
  fsWorkspace: AnyWorkspace | undefined,
  configWorkspace: FsAgentConfig['workspace'],
  defaultWorkspaceBasePath: string | undefined,
  onWarn: (message: string) => void,
): FsAgentConfig['workspace'] | undefined {
  if (configWorkspace !== undefined) {
    if (fsWorkspace !== undefined) {
      onWarn(`Agent "${name}": workspace defined in both config.ts and workspace.ts; config.workspace wins.`);
    }
    return configWorkspace;
  }

  if (fsWorkspace !== undefined) {
    return fsWorkspace;
  }

  if (defaultWorkspaceBasePath !== undefined) {
    return createDefaultWorkspace(name, defaultWorkspaceBasePath);
  }

  return undefined;
}

/**
 * Build the convention default workspace for a file-based agent: a contained
 * `LocalFilesystem` rooted at `basePath` paired with a `LocalSandbox` whose
 * working directory is the same path. No filesystem I/O happens here — the
 * directory is created lazily when the workspace is initialized at runtime.
 */
function createDefaultWorkspace(name: string, basePath: string): AnyWorkspace {
  return new Workspace({
    name: `${name}-workspace`,
    filesystem: new LocalFilesystem({ basePath }),
    sandbox: new LocalSandbox({ workingDirectory: basePath }),
  });
}

/**
 * Merge filesystem-discovered processors with config-defined ones.
 *
 * Precedence:
 * - A dynamic (function) `config.inputProcessors`/`config.outputProcessors`
 *   wins wholesale — discovered processors are ignored with a warning.
 * - Otherwise discovered processors are concatenated after config processors
 *   (config processors run first in the pipeline).
 * - If neither source provides processors, returns `undefined`.
 */
function mergeProcessors<T extends InputProcessorOrWorkflow | OutputProcessorOrWorkflow>(
  name: string,
  type: 'input' | 'output',
  fsProcessors: T[],
  configProcessors: DynamicArgument<T[]> | undefined,
  onWarn: (message: string) => void,
): DynamicArgument<T[]> | undefined {
  if (typeof configProcessors === 'function') {
    if (fsProcessors.length > 0) {
      onWarn(
        `Agent "${name}": config.ts defines dynamic ${type}Processors (function), so discovered ${type} processors under agents/${name}/processors/${type}/ are ignored.`,
      );
    }
    return configProcessors;
  }

  const fromConfig = Array.isArray(configProcessors) ? configProcessors : [];
  const merged = [...fromConfig, ...fsProcessors];
  return merged.length > 0 ? merged : undefined;
}

/**
 * Normalize a discovered scorer default export into a `MastraScorerEntry`. A
 * bare `MastraScorer` is wrapped into `{ scorer }`; an existing
 * `{ scorer, sampling }` entry is used as-is.
 */
function toScorerEntry(value: FsAgentScorerEntry['scorer']): MastraScorerEntry {
  return 'scorer' in value ? value : { scorer: value };
}

/**
 * Merge filesystem-discovered scorers with config-defined ones.
 *
 * Precedence:
 * - A dynamic (function) `config.scorers` wins wholesale — discovered scorers
 *   are ignored with a warning.
 * - Otherwise discovered scorers (keyed by filename slug) are merged with
 *   `config.scorers`; on key collision `config.scorers` wins with a warning.
 * - If neither source provides scorers, returns `undefined`.
 */
function mergeScorers(
  name: string,
  fsScorers: FsAgentScorerEntry[],
  configScorers: FsAgentConfig['scorers'],
  onWarn: (message: string) => void,
): DynamicArgument<MastraScorers> | undefined {
  // Dynamic config.scorers (a function) can't be statically merged; it wins
  // wholesale and discovered scorers are ignored with a warning.
  if (typeof configScorers === 'function') {
    if (fsScorers.length > 0) {
      onWarn(
        `Agent "${name}": config.scorers is a function, so discovered scorers under agents/${name}/scorers/ are ignored.`,
      );
    }
    return configScorers;
  }

  const fromFs: MastraScorers = {};
  for (const { key, scorer } of fsScorers) {
    fromFs[key] = toScorerEntry(scorer);
  }

  const fromConfig = (configScorers ?? {}) as MastraScorers;
  for (const key of Object.keys(fromConfig)) {
    if (key in fromFs) {
      onWarn(`Agent "${name}": scorer "${key}" defined in both config.scorers and scorers/; config.scorers wins.`);
    }
  }

  const merged: MastraScorers = { ...fromFs, ...fromConfig };
  return Object.keys(merged).length > 0 ? merged : undefined;
}

/**
 * Resolve the memory for a file-based agent.
 *
 * Precedence (explicit > convention):
 * - `config.memory` (from `config.ts`) wins over `memory.ts`. A function
 *   `config.memory` is carried through wholesale (it is an opaque value).
 * - Otherwise `memory.ts`'s default export is used.
 * - Otherwise returns `undefined` (no memory; current behavior).
 */
function mergeMemory(
  name: string,
  fsMemory: MastraMemory | undefined,
  configMemory: FsAgentConfig['memory'],
  onWarn: (message: string) => void,
): FsAgentConfig['memory'] | undefined {
  if (configMemory !== undefined) {
    if (fsMemory !== undefined) {
      onWarn(`Agent "${name}": memory defined in both config.ts and memory.ts; config.memory wins.`);
    }
    return configMemory;
  }

  if (fsMemory !== undefined) {
    return fsMemory;
  }

  return undefined;
}
