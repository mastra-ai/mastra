import type { SlashCommandContext } from './types.js';

export async function handleSkillsCommand(ctx: SlashCommandContext): Promise<void> {
  const workspace = ctx.getResolvedWorkspace();
  if (!workspace?.skills) {
    ctx.showInfo(
      'No skills configured.\n\n' +
        'Add skills to any of these locations:\n' +
        '  .mastracode/skills/   (project-local)\n' +
        '  .claude/skills/       (project-local)\n' +
        '  ~/.mastracode/skills/ (global)\n' +
        '  ~/.claude/skills/     (global)\n\n' +
        'Each skill is a folder with a SKILL.md file.\n' +
        'Install skills: npx add-skill <github-url>',
    );
    return;
  }

  try {
    const skills = await workspace.skills!.list();

    if (skills.length === 0) {
      ctx.showInfo(
        'No skills found in configured directories.\n\n' +
          'Each skill needs a SKILL.md file with YAML frontmatter.\n' +
          'Install skills: npx add-skill <github-url>',
      );
      return;
    }

    const skillLines = skills.map(skill => {
      const desc = skill.description
        ? ` - ${skill.description.length > 60 ? skill.description.slice(0, 57) + '...' : skill.description}`
        : '';
      return `  ${skill.name}${desc}`;
    });

    ctx.showInfo(
      `Skills (${skills.length}):\n${skillLines.join('\n')}\n\n` +
        'Skills are automatically activated by the agent when relevant.',
    );
  } catch (error) {
    ctx.showError(`Failed to list skills: ${error instanceof Error ? error.message : String(error)}`);
  }
}
