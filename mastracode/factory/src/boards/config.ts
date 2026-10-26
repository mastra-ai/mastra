import { projectBoardConfigInputSchema } from '../storage/domains/boards/validation.js';
import type { ProjectBoardConfigInput } from '../storage/domains/boards/validation.js';
import { FACTORY_AGENT_IDS } from './agents.js';
import { builtInRunners } from './runners.js';
import type { BoardRunner, BoardRunnerRegistry } from './runners.js';

/** The built-in runners plus the app's own; an id may appear once. */
export function createRunnerRegistry(runners: readonly BoardRunner[] = []): BoardRunnerRegistry {
  const registry = new Map(builtInRunners);
  for (const runner of runners) {
    if (registry.has(runner.id)) {
      throw new Error(
        builtInRunners.has(runner.id)
          ? `MastraFactory: runner '${runner.id}' is built in; give yours another id.`
          : `MastraFactory: duplicate runner id '${runner.id}' in 'runners'.`,
      );
    }
    const sameSkill = runner.skill && runnerForSkill(registry, runner.skill);
    if (sameSkill) {
      throw new Error(
        `MastraFactory: runner '${runner.id}' runs skill '${runner.skill}', which '${sameSkill.id}' already runs.`,
      );
    }
    registry.set(runner.id, runner);
  }
  return registry;
}

/** The code runner behind a skill: a phase that activates the skill runs that code. */
export function runnerForSkill(runners: BoardRunnerRegistry, skill: string): BoardRunner | undefined {
  for (const runner of runners.values()) if (runner.skill === skill) return runner;
  return undefined;
}

/** Agents and workflow runners the config names that do not exist, as `board.phase: message` lines. */
export function unknownRunnerIssues(config: ProjectBoardConfigInput, runners: BoardRunnerRegistry): string[] {
  const issues: string[] = [];
  for (const board of config.boards ?? []) {
    for (const phase of board.phases ?? []) {
      const runner = phase.runner;
      if (runner?.type === 'agent' && !FACTORY_AGENT_IDS.has(runner.agentId)) {
        const known = [...FACTORY_AGENT_IDS].map(id => `'${id}'`).join(', ');
        issues.push(
          `${board.key}.${phase.key}: No agent is called '${runner.agentId}'; Factory's agents are ${known}.`,
        );
      }
      if (runner?.type === 'workflow' && !runners.has(runner.workflowId)) {
        issues.push(`${board.key}.${phase.key}: No runner is called '${runner.workflowId}'.`);
      }
    }
  }
  return issues;
}

/** Checks the `boardConfig` option once at construction so a bad config fails at startup, not per project. */
export function checkBoardConfigOption(
  config: ProjectBoardConfigInput,
  runners: BoardRunnerRegistry,
  codeBoardIds: ReadonlySet<string>,
): ProjectBoardConfigInput {
  const parsed = projectBoardConfigInputSchema.safeParse(config);
  if (!parsed.success) {
    const issues = parsed.error.issues.map(issue =>
      issue.path.length ? `${issue.path.join('.')}: ${issue.message}` : issue.message,
    );
    throw new Error(`MastraFactory: 'boardConfig' is invalid. ${issues.slice(0, 5).join(' ')}`);
  }
  const issues = unknownRunnerIssues(config, runners);
  for (const board of config.boards ?? []) {
    if (codeBoardIds.has(board.key)) issues.push(`${board.key}: A board in 'boards' already uses this id.`);
  }
  if (issues.length) throw new Error(`MastraFactory: 'boardConfig' is invalid. ${issues.join(' ')}`);
  return config;
}
