import type { MastraCodeState } from '@mastra/code-sdk/schema';
import type { SendAgentSignalResult } from '@mastra/core/agent';
import type { AgentController } from '@mastra/core/agent-controller';
import type { RequestContext } from '@mastra/core/request-context';
import { formatSkillActivation } from '@mastra/core/workspace';
import type { Workspace } from '@mastra/core/workspace';

import { REVIEW_ONLY_FACTORY_SKILLS, rescanFactorySkills } from '../workspace.js';

export interface SkillInvocationInput {
  sessionId: string;
  name: string;
  arguments?: string;
}

export interface SkillSession {
  getWorkspace(): Workspace;
  sendMessage(input: { content: string; requestContext?: RequestContext }): Promise<unknown>;
  sendNotificationSignal(
    input: {
      source: string;
      kind: string;
      summary: string;
      priority?: 'low' | 'medium' | 'high' | 'urgent';
      payload?: unknown;
      dedupeKey?: string;
      sourceId?: string;
    },
    options?: {
      ifActive?: { behavior?: 'deliver' | 'persist' };
      ifIdle?: { behavior?: 'persist' | 'wake' };
      requestContext?: RequestContext;
    },
  ): Promise<Pick<SendAgentSignalResult, 'persisted' | 'accepted'>>;
}

export class SkillInvocationError extends Error {
  readonly code: 'session_not_found' | 'skill_not_found';

  constructor(code: SkillInvocationError['code'], message: string) {
    super(message);
    this.name = 'SkillInvocationError';
    this.code = code;
  }
}

async function findSkill(session: SkillSession, name: string) {
  const skills = session.getWorkspace().skills;
  if (!skills) return undefined;
  await skills.maybeRefresh();
  const skill = await skills.get(name);
  if (skill || !REVIEW_ONLY_FACTORY_SKILLS.has(name)) return skill;
  // The cache may predate the review binding this run was just given.
  try {
    await rescanFactorySkills(skills);
  } catch {
    return undefined;
  }
  return skills.get(name);
}

/** Wraps skill contents in the `<skill>` envelope a human-invoked skill sends as its own message. */
export function formatSkillMessage(name: string, contents: string): string {
  return `<skill name="${name}">\n${contents.replaceAll('</skill>', '&lt;/skill&gt;')}\n</skill>`;
}

/** Kicks a run off from a plain prompt, for runs that activate no skill. */
export async function resolvePromptInvocation(
  controller: Pick<AgentController<MastraCodeState>, 'getSession'>,
  input: { sessionId: string; prompt: string },
): Promise<{ session: SkillSession; skillName?: undefined; contents: string }> {
  const session = (await controller.getSession(input.sessionId)) as SkillSession | undefined;
  if (!session) throw new SkillInvocationError('session_not_found', 'Agent controller session not found.');
  return { session, contents: input.prompt };
}

export async function resolveSkillInvocation(
  controller: Pick<AgentController<MastraCodeState>, 'getSession'>,
  input: SkillInvocationInput,
): Promise<{ session: SkillSession; skillName: string; contents: string }> {
  const session = (await controller.getSession(input.sessionId)) as SkillSession | undefined;
  if (!session) throw new SkillInvocationError('session_not_found', 'Agent controller session not found.');

  const skill = await findSkill(session, input.name);
  if (!skill || skill['user-invocable'] === false) {
    throw new SkillInvocationError('skill_not_found', `Skill not found: ${input.name}.`);
  }

  const args = input.arguments?.trim();
  const contents = `${formatSkillActivation(skill)}${args ? `\n\nARGUMENTS: ${args}` : ''}`.trim();
  return { session, skillName: skill.name, contents };
}

/**
 * Same-stage re-entry: the skill is already active in the card's live session.
 * Resolve a compact continuation that references the skill by name and carries
 * only the fresh arguments, instead of re-pasting the whole skill document. If
 * the skill body was compacted out of context, the agent can re-open it with the
 * skill tool.
 */
export async function resolveSkillResumeInvocation(
  controller: Pick<AgentController<MastraCodeState>, 'getSession'>,
  input: SkillInvocationInput,
): Promise<{ session: SkillSession; skillName: string; contents: string }> {
  const session = (await controller.getSession(input.sessionId)) as SkillSession | undefined;
  if (!session) throw new SkillInvocationError('session_not_found', 'Agent controller session not found.');

  const skill = await findSkill(session, input.name);
  if (!skill || skill['user-invocable'] === false) {
    throw new SkillInvocationError('skill_not_found', `Skill not found: ${input.name}.`);
  }

  const args = input.arguments?.trim();
  const contents = [
    `Resume the active ${skill.name} session — it is already open in this thread; continue it rather than restarting.`,
    `Re-open the ${skill.name} skill with the skill tool if its instructions are no longer in context.`,
    ...(args ? [`ARGUMENTS: ${args}`] : []),
  ].join('\n');
  return { session, skillName: skill.name, contents };
}
