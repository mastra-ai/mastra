import type { MastraCodeState } from '@mastra/code-sdk/schema';
import type { AgentController } from '@mastra/core/agent-controller';
import { formatSkillActivation } from '@mastra/core/workspace';
import type { Workspace } from '@mastra/core/workspace';

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
    options?: { ifActive?: { behavior?: 'deliver' }; ifIdle?: { behavior?: 'wake' } },
  ): Promise<{ persisted?: Promise<unknown>; accepted?: Promise<unknown> }>;
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

export async function resolveSkillInvocation(
  controller: Pick<AgentController<MastraCodeState>, 'getSessionByResource'>,
  input: SkillInvocationInput,
): Promise<{ session: SkillSession; skillName: string; message: string }> {
  const session = (await controller.getSessionByResource(input.resourceId, input.scope)) as SkillSession | undefined;
  if (!session) throw new SkillInvocationError('session_not_found', 'Agent controller session not found.');

  const skills = session.getWorkspace().skills;
  await skills?.maybeRefresh();
  const skill = await skills?.get(input.name);
  if (!skill || skill['user-invocable'] === false) {
    throw new SkillInvocationError('skill_not_found', `Skill not found: ${input.name}.`);
  }

  const args = input.arguments?.trim();
  const content = `${formatSkillActivation(skill)}${args ? `\n\nARGUMENTS: ${args}` : ''}`.trim();
  return {
    session,
    skillName: skill.name,
    message: `<skill name="${skill.name}">\n${escapeSkillBoundary(content)}\n</skill>`,
  };
}

export async function dispatchSkillInvocation(
  controller: Pick<AgentController<MastraCodeState>, 'getSessionByResource'>,
  input: SkillInvocationInput,
): Promise<{ skillName: string; message: string }> {
  const resolved = await resolveSkillInvocation(controller, input);
  await resolved.session.sendMessage({ content: resolved.message });
  return { skillName: resolved.skillName, message: resolved.message };
}
