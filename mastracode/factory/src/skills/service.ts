import type { MastraCodeState } from '@mastra/code-sdk/schema';
import type { SendAgentSignalResult } from '@mastra/core/agent';
import type { AgentController } from '@mastra/core/agent-controller';
import type { RequestContext } from '@mastra/core/request-context';
import type { Skill } from '@mastra/core/skills';
import { formatSkillActivation } from '@mastra/core/workspace';
import type { Workspace } from '@mastra/core/workspace';

import type { FactorySkillCatalog } from './catalog.js';

export interface SkillInvocationInput {
  resourceId: string;
  scope?: string;
  name: string;
  arguments?: string;
}

export interface SkillSession {
  getWorkspace(): Workspace;
  sendMessage(input: { content: string }): Promise<unknown>;
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

function escapeSkillBoundary(value: string): string {
  return value.replaceAll('</skill>', '&lt;/skill&gt;');
}

export function formatSkillInvocationMessage(skill: Skill, argumentsValue?: string): string {
  const args = argumentsValue?.trim();
  const content = `${formatSkillActivation(skill)}${args ? `\n\nARGUMENTS: ${args}` : ''}`.trim();
  return `<skill name="${skill.name}">\n${escapeSkillBoundary(content)}\n</skill>`;
}

/** Kicks a run off from a plain prompt, for runs that activate no skill. */
export async function resolvePromptInvocation(
  controller: Pick<AgentController<MastraCodeState>, 'getSessionByResource'>,
  input: { resourceId: string; scope?: SkillInvocationInput['scope']; prompt: string },
): Promise<{ session: SkillSession; message: string }> {
  const session = (await controller.getSessionByResource(input.resourceId, input.scope)) as SkillSession | undefined;
  if (!session) throw new SkillInvocationError('session_not_found', 'Agent controller session not found.');
  return { session, message: input.prompt };
}

export async function resolveSkillInvocation(
  controller: Pick<AgentController<MastraCodeState>, 'getSessionByResource'>,
  factorySkills: FactorySkillCatalog,
  input: SkillInvocationInput,
): Promise<{ session: SkillSession; skillName: string; message: string }> {
  const session = (await controller.getSessionByResource(input.resourceId, input.scope)) as SkillSession | undefined;
  if (!session) throw new SkillInvocationError('session_not_found', 'Agent controller session not found.');

  let skill: Skill | null | undefined = factorySkills.get(input.name);
  if (!skill) {
    const skills = session.getWorkspace().skills;
    await skills?.maybeRefresh();
    skill = await skills?.get(input.name);
  }
  if (!skill || skill['user-invocable'] === false) {
    throw new SkillInvocationError('skill_not_found', `Skill not found: ${input.name}.`);
  }

  return {
    session,
    skillName: skill.name,
    message: formatSkillInvocationMessage(skill, input.arguments),
  };
}

export async function dispatchSkillInvocation(
  controller: Pick<AgentController<MastraCodeState>, 'getSessionByResource'>,
  factorySkills: FactorySkillCatalog,
  input: SkillInvocationInput,
): Promise<{ skillName: string; message: string }> {
  const resolved = await resolveSkillInvocation(controller, factorySkills, input);
  await resolved.session.sendMessage({ content: resolved.message });
  return { skillName: resolved.skillName, message: resolved.message };
}
