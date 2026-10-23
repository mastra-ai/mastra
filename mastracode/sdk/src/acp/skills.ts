import { RequestError } from '@agentclientprotocol/sdk';
import type { AvailableCommand } from '@agentclientprotocol/sdk';
import { formatSkillActivation } from '@mastra/core/workspace';
import type { SkillMetadata, WorkspaceSkills } from '@mastra/core/workspace';

export type AcpSkills = Pick<WorkspaceSkills, 'list' | 'get' | 'maybeRefresh'>;

async function invokableSkills(skills: AcpSkills): Promise<SkillMetadata[]> {
  const selected = new Map<string, SkillMetadata>();
  for (const skill of await skills.list()) {
    if (skill['user-invocable'] !== false && !selected.has(skill.name)) selected.set(skill.name, skill);
  }
  return [...selected.values()];
}

export async function listSkillCommands(skills?: AcpSkills): Promise<AvailableCommand[]> {
  if (!skills) return [];
  await skills.maybeRefresh();
  return (await invokableSkills(skills)).map(skill => ({
    name: `skill/${skill.name}`,
    description: skill.description,
    input: { hint: 'Additional instructions' },
  }));
}

export async function expandSkillCommand(
  content: string,
  skills: AcpSkills | undefined,
  commands: AvailableCommand[],
): Promise<string> {
  const match = /^\/skill\/([^\s]*)(?:\s+([\s\S]*))?$/.exec(content.trimStart());
  if (!match) return content;
  const name = match[1]!;
  // Resolve only advertised names. The workspace also accepts paths, which are
  // not part of the slash-command interface.
  if (!skills || !commands.some(command => command.name === `skill/${name}`)) {
    throw RequestError.invalidParams(undefined, `Skill is unavailable: ${name || '(missing name)'}`);
  }
  // Name-only lookup rejects copied skills in multiple compatibility roots.
  // Use the first visible entry in workspace catalog order, as in discovery.
  const metadata = (await invokableSkills(skills)).find(skill => skill.name === name);
  const skill = metadata ? await skills.get(metadata.path) : null;
  if (!skill || skill['user-invocable'] === false) {
    throw RequestError.invalidParams(undefined, `Skill is unavailable: ${name}`);
  }
  const args = match[2]?.trim();
  const activation = `${formatSkillActivation(skill)}${args ? `\n\nARGUMENTS: ${args}` : ''}`;
  // Match the terminal activation format, including its closing-tag escaping.
  return `<skill name="${skill.name}">\n${activation.replaceAll('</skill>', '&lt;/skill&gt;')}\n</skill>`;
}
