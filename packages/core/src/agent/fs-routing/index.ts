import { MastraError, ErrorDomain, ErrorCategory } from '../../error';
import type { InlineSkill, SkillInput } from '../../skills/types';
import { Workspace, LocalFilesystem, LocalSandbox } from '../../workspace';
import type { AnyWorkspace } from '../../workspace';
import { Agent } from '../agent';
import type { AgentConfig, AgentInstructions, ToolsInput } from '../types';

/**
 * Identity helper for a file-system routed agent config. Returns the provided
 * partial config unchanged — its only purpose is to give authors editor types
 * for `agents/<name>/config.ts` while letting `instructions`/`model`/`tools` be
 * supplied by sibling files (`instructions.md`, `tools/*.ts`).
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
 * A single tool discovered under `agents/<name>/tools/`. `key` defaults to the
 * filename slug; `tool` is the default export of that module.
 */
export interface FsAgentToolEntry {
  key: string;
  tool: ToolsInput[string];
}

export interface FsAgentEntry {
  /** Agent directory name. Used as the default `id`/`name`. */
  name: string;
  /**
   * Default export of `config.ts`, if present. Either an `agentConfig(...)`
   * partial or a fully code-defined `Agent` instance (`new Agent({...})`).
   */
  config?: FsAgentConfig | Agent;
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
   * Base path for the convention default workspace. When provided and neither
   * `config.workspace` nor `workspace.ts` supplies one, an FS agent gets a
   * default `Workspace` (a contained `LocalFilesystem` rooted here plus a
   * `LocalSandbox`), giving file-based agents file/shell tools automatically.
   * Callers (the deployer codegen layer) pass a per-agent directory here.
   */
  defaultWorkspaceBasePath?: string;
}

/**
 * Assemble a single `Agent` from already-loaded file-system entries for one
 * `agents/<name>/` directory. Performs no filesystem access — callers load the
 * modules and pass them in, keeping this unit-testable and runtime-portable.
 *
 * Precedence rules:
 * - `id`/`name` default to the directory name when omitted in config.
 * - `instructions`: a dynamic (function) `config.instructions` wins over
 *   `instructions.md`; otherwise `instructions.md` wins over a static
 *   `config.instructions`. Missing both is an error.
 * - `model` is required (from config); missing is an error.
 * - `tools`: discovered `tools/*.ts` are merged with `config.tools`; on key
 *   collision `config.tools` wins (a warning is surfaced via `onWarn`).
 * - `skills`: discovered `skills/*` are merged with `config.skills`; on name
 *   collision `config.skills` wins (a warning is surfaced via `onWarn`). A
 *   dynamic (function) `config.skills` wins wholesale and discovered skills are
 *   ignored with a warning.
 *
 * If `config` is already an `Agent` instance (the author wrote
 * `export default new Agent({...})` in `config.ts`), it is used as-is — no
 * partial-config assembly is performed. This lets a folder under `agents/`
 * hold either an `agentConfig(...)` partial or a fully code-defined
 * `new Agent(...)` without the loader trying to re-wrap the latter.
 */
export function assembleAgentFromFsEntry(entry: FsAgentEntry, options?: { onWarn?: (message: string) => void }): Agent {
  const { name, config = {}, instructionsMd, tools = [], skills = [], workspace, defaultWorkspaceBasePath } = entry;
  const onWarn = options?.onWarn ?? (() => {});

  // A code-defined agent (`export default new Agent({...})`) is used verbatim.
  if (config instanceof Agent) {
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
    return config;
  }

  const instructions = resolveInstructions(name, config.instructions, instructionsMd);

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

  const assembled = {
    ...config,
    id: config.id ?? name,
    name: config.name ?? name,
    instructions,
    ...(mergedTools !== undefined ? { tools: mergedTools } : {}),
    ...(mergedSkills !== undefined ? { skills: mergedSkills } : {}),
    ...(mergedWorkspace !== undefined ? { workspace: mergedWorkspace } : {}),
  } as AgentConfig;

  return new Agent(assembled);
}

function resolveInstructions(
  name: string,
  configInstructions: FsAgentConfig['instructions'],
  instructionsMd: string | undefined,
): FsAgentConfig['instructions'] {
  const hasConfigInstructions = configInstructions !== undefined && configInstructions !== null;
  const hasMd = instructionsMd !== undefined;

  if (hasConfigInstructions && typeof configInstructions === 'function') {
    // Dynamic instructions can't be overridden by static markdown.
    return configInstructions;
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
    text: `Agent "${name}": missing instructions. Provide agents/${name}/instructions.md or an 'instructions' field in config.ts.`,
  });
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
