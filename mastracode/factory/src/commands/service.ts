import { DEFAULT_CONFIG_DIR } from '@mastra/code-sdk/constants';
import type { MastraCodeState } from '@mastra/code-sdk/schema';
import {
  WorkspaceCommandLimitExceededError,
  loadCommandDirectories,
  loadGlobalCustomCommands,
  loadWorkspaceCustomCommands,
  type SlashCommandMetadata,
} from '@mastra/code-sdk/utils/slash-command-loader';
import {
  createWorkspaceSlashCommandProcessingContext,
  formatSlashCommandActivation,
  processSlashCommandWithContext,
} from '@mastra/code-sdk/utils/slash-command-processor';
import type { AgentController } from '@mastra/core/agent-controller';
import type { Workspace, WorkspaceFilesystem } from '@mastra/core/workspace';

import {
  CUSTOM_COMMAND_NAME_RE,
  SKILL_COMMAND_NAME_RE,
  type SessionCommandDescriptor,
  type SessionCommandDiscoveryResponse,
  type SessionCommandPrepareRequest,
  type SessionCommandPrepareResponse,
} from '../routes/session-command-contract.js';
import { resolveSkillInvocation, SkillInvocationError } from '../skills/service.js';

export class SessionCommandError extends Error {
  constructor(
    readonly code:
      | 'session_not_found'
      | 'command_not_found'
      | 'command_unavailable'
      | 'command_expansion_failed'
      | 'command_discovery_failed',
    message: string,
  ) {
    super(message);
  }
}

/**
 * Server-owned snapshot of active runtime plugin asset directories. Populated
 * by `MastraFactory.prepare()` from `loadedPlugins`; client-writable session
 * state (`pluginCommandPaths`/`pluginSkillPaths`) is never trusted here.
 */
export interface TrustedPluginPaths {
  getCommandPaths(): string[];
  getSkillPaths(): string[];
}

export interface SessionCommandServiceDeps {
  controller: Pick<AgentController<MastraCodeState>, 'getSessionByResource'>;
  resourceId: string;
  scope?: string;
  pluginPaths: TrustedPluginPaths;
  /** User-global runtime directories are only exposed on auth-disabled deploys. */
  includeRuntimeGlobals: boolean;
}

interface CommandSession {
  state: { get(): Partial<MastraCodeState> };
  getWorkspace(): Workspace | undefined;
}

function customToken(name: string): string {
  return `//${name}`;
}

function goalToken(name: string): string {
  return `/goal/${name}`;
}

function skillToken(name: string): string {
  return `/skill/${name}`;
}

async function resolveLiveSession(deps: SessionCommandServiceDeps): Promise<CommandSession> {
  const session = (await deps.controller.getSessionByResource(deps.resourceId, deps.scope)) as
    | CommandSession
    | undefined;
  if (!session) {
    throw new SessionCommandError('session_not_found', 'Agent controller session not found.');
  }
  return session;
}

/**
 * Merged custom commands with discovery-limit overruns mapped onto the
 * redacted route contract.
 */
async function loadWorkspaceCommandsGuarded(
  deps: SessionCommandServiceDeps,
  filesystem: WorkspaceFilesystem,
  configDir: string,
): Promise<Map<string, SlashCommandMetadata>> {
  try {
    return await loadMergedCustomCommands(deps, filesystem, configDir);
  } catch (error) {
    if (error instanceof WorkspaceCommandLimitExceededError) {
      throw new SessionCommandError('command_discovery_failed', error.message);
    }
    throw error;
  }
}

/** Custom commands merged in TUI precedence order: globals < workspace < plugins. */
async function loadMergedCustomCommands(
  deps: SessionCommandServiceDeps,
  filesystem: WorkspaceFilesystem,
  configDir: string,
): Promise<Map<string, SlashCommandMetadata>> {
  const [globalCommands, workspaceCommands, pluginCommands] = await Promise.all([
    deps.includeRuntimeGlobals ? loadGlobalCustomCommands(configDir) : Promise.resolve([]),
    loadWorkspaceCustomCommands(filesystem, configDir),
    loadCommandDirectories(deps.pluginPaths.getCommandPaths()),
  ]);

  const merged = new Map<string, SlashCommandMetadata>();
  for (const command of [...globalCommands, ...workspaceCommands, ...pluginCommands]) {
    if (!CUSTOM_COMMAND_NAME_RE.test(command.name)) continue;
    merged.set(command.name, command);
  }
  return merged;
}

async function listInvocableSkills(
  workspace: Workspace,
): Promise<Array<{ name: string; description: string; goal: boolean }>> {
  await workspace.skills?.maybeRefresh();
  const skills = (await workspace.skills?.list()) ?? [];
  return skills
    .filter(skill => skill['user-invocable'] !== false && SKILL_COMMAND_NAME_RE.test(skill.name))
    .map(skill => ({
      name: skill.name,
      description: skill.description,
      goal: skill.metadata?.goal === true,
    }));
}

/**
 * Discover the custom commands and invocable skills of the addressed live
 * session. Only exact composer tokens are advertised — never templates, source
 * paths, skill instructions, or filesystem locations.
 */
export async function discoverSessionCommands(
  deps: SessionCommandServiceDeps,
): Promise<SessionCommandDiscoveryResponse> {
  const session = await resolveLiveSession(deps);
  const configDir = session.state.get()?.configDir ?? DEFAULT_CONFIG_DIR;
  const workspace = session.getWorkspace();

  const capabilities: SessionCommandDiscoveryResponse['capabilities'] = {
    customCommands: workspace?.filesystem ? 'supported' : 'unsupported',
    skills: workspace?.skills ? 'supported' : 'unsupported',
  };

  // Keyed by exact composer token so goal-name collisions deduplicate with
  // custom-command precedence (customs are inserted first).
  const commands = new Map<string, SessionCommandDescriptor>();
  const filesystem = workspace?.filesystem;

  if (filesystem) {
    const merged = await loadMergedCustomCommands(deps, filesystem, configDir);
    for (const command of merged.values()) {
      const goal = command.goal === true;
      commands.set(customToken(command.name), {
        command: customToken(command.name),
        source: 'custom',
        name: command.name,
        description: command.description,
        goal,
      });
      if (goal) {
        commands.set(goalToken(command.name), {
          command: goalToken(command.name),
          source: 'custom',
          name: command.name,
          description: command.description,
          goal: true,
        });
      }
    }
  }

  if (capabilities.skills === 'supported' && workspace) {
    for (const skill of await listInvocableSkills(workspace)) {
      if (!commands.has(skillToken(skill.name))) {
        commands.set(skillToken(skill.name), {
          command: skillToken(skill.name),
          source: 'skill',
          name: skill.name,
          description: skill.description,
          goal: skill.goal,
        });
      }
      if (skill.goal && !commands.has(goalToken(skill.name))) {
        commands.set(goalToken(skill.name), {
          command: goalToken(skill.name),
          source: 'skill',
          name: skill.name,
          description: skill.description,
          goal: true,
        });
      }
    }
  }

  return { capabilities, commands: [...commands.values()] };
}

function splitCustomArguments(argumentsText: string | undefined): string[] {
  const trimmed = argumentsText?.trim() ?? '';
  return trimmed ? trimmed.split(/\s+/) : [];
}

/**
 * Expand a custom command template inside the session workspace. Discovery
 * limit overruns surface as the redacted `command_discovery_failed` contract.
 */
async function expandCustomCommandTemplate(
  filesystem: WorkspaceFilesystem,
  sandbox: Workspace['sandbox'],
  template: SlashCommandMetadata,
  argumentsText: string | undefined,
): Promise<string> {
  try {
    return (
      await processSlashCommandWithContext(
        template,
        splitCustomArguments(argumentsText),
        createWorkspaceSlashCommandProcessingContext({ filesystem, sandbox }),
      )
    ).trim();
  } catch (error) {
    if (error instanceof WorkspaceCommandLimitExceededError) {
      throw new SessionCommandError('command_discovery_failed', error.message);
    }
    throw new SessionCommandError('command_expansion_failed', 'The command could not be expanded.');
  }
}

/**
 * Re-discover the addressed session's commands and expand the exact token.
 * A stale browser-side descriptor is never trusted: the token must exist in
 * fresh discovery before any template runs or an envelope is built.
 */
export async function prepareSessionCommand(
  deps: SessionCommandServiceDeps,
  input: Pick<SessionCommandPrepareRequest, 'command' | 'arguments'>,
): Promise<SessionCommandPrepareResponse> {
  const token = input.command;

  if (token.startsWith('/skill/')) {
    return prepareSkillMessage(deps, token.slice('/skill/'.length), input.arguments);
  }

  if (token.startsWith('//')) {
    return prepareCustomMessage(deps, token.slice(2), input.arguments);
  }

  if (token.startsWith('/goal/')) {
    const name = token.slice('/goal/'.length);
    if (!CUSTOM_COMMAND_NAME_RE.test(name) && !SKILL_COMMAND_NAME_RE.test(name)) {
      throw new SessionCommandError('command_not_found', `Unknown command: ${token}`);
    }
    const session = await resolveLiveSession(deps);
    const configDir = session.state.get()?.configDir ?? DEFAULT_CONFIG_DIR;
    const workspace = session.getWorkspace();
    const filesystem = workspace?.filesystem;
    if (!filesystem) {
      throw new SessionCommandError('command_unavailable', 'This session cannot run custom commands.');
    }
    // Custom commands keep /goal/<name> precedence over same-name skills.
    const custom = (await loadWorkspaceCommandsGuarded(deps, filesystem, configDir)).get(name);
    if (custom?.goal === true) {
      const expanded = await expandCustomCommandTemplate(filesystem, workspace!.sandbox, custom, input.arguments);
      if (!expanded) {
        return { action: 'none', notice: `${token} produced no output.` };
      }
      return { action: 'goal', objective: expanded };
    }

    const objective = await buildGoalSkillObjective(session, name, input.arguments);
    if (objective === undefined) {
      throw new SessionCommandError('command_not_found', `Unknown command: ${token}`);
    }
    return { action: 'goal', objective };
  }

  throw new SessionCommandError('command_not_found', `Unknown command: ${token}`);
}

/** Expand a custom command into the `<slash-command>` activation envelope. */
async function prepareCustomMessage(
  deps: SessionCommandServiceDeps,
  name: string,
  argumentsText: string | undefined,
): Promise<SessionCommandPrepareResponse> {
  const token = customToken(name);
  if (!CUSTOM_COMMAND_NAME_RE.test(name)) {
    throw new SessionCommandError('command_not_found', `Unknown command: ${token}`);
  }
  const session = await resolveLiveSession(deps);
  const configDir = session.state.get()?.configDir ?? DEFAULT_CONFIG_DIR;
  const workspace = session.getWorkspace();
  const filesystem = workspace?.filesystem;
  if (!filesystem) {
    throw new SessionCommandError('command_unavailable', 'This session cannot run custom commands.');
  }
  const template = (await loadWorkspaceCommandsGuarded(deps, filesystem, configDir)).get(name);
  if (!template) {
    throw new SessionCommandError('command_not_found', `Unknown command: ${token}`);
  }

  const expanded = await expandCustomCommandTemplate(filesystem, workspace!.sandbox, template, argumentsText);
  if (!expanded) {
    return { action: 'none', notice: `${token} produced no output.` };
  }
  return { action: 'message', content: formatSlashCommandActivation(name, expanded) };
}

/** Resolve an invocable skill through the published Factory skill formatter. */
async function prepareSkillMessage(
  deps: SessionCommandServiceDeps,
  name: string,
  argumentsText: string | undefined,
): Promise<SessionCommandPrepareResponse> {
  if (!SKILL_COMMAND_NAME_RE.test(name)) {
    throw new SessionCommandError('command_not_found', `Unknown command: ${skillToken(name)}`);
  }
  try {
    const resolved = await resolveSkillInvocation(deps.controller, {
      resourceId: deps.resourceId,
      scope: deps.scope,
      name,
      ...(argumentsText !== undefined ? { arguments: argumentsText } : {}),
    });
    return { action: 'message', content: resolved.message };
  } catch (error) {
    if (error instanceof SkillInvocationError) {
      if (error.code === 'session_not_found') {
        throw new SessionCommandError('session_not_found', error.message);
      }
      throw new SessionCommandError('command_not_found', `Unknown command: ${skillToken(name)}`);
    }
    throw error;
  }
}

/** Goal-capable skills produce a `# Skill goal:` objective, mirroring the TUI. */
async function buildGoalSkillObjective(
  session: CommandSession,
  name: string,
  argumentsText: string | undefined,
): Promise<string | undefined> {
  const workspace = session.getWorkspace();
  const skill = (await workspace?.skills?.get(name)) ?? null;
  if (!skill || skill['user-invocable'] === false || skill.metadata?.goal !== true) {
    return undefined;
  }
  const args = argumentsText?.trim();
  return `# Skill goal: ${skill.name}\n\n${skill.instructions}${args ? `\n\nARGUMENTS: ${args}` : ''}`;
}
