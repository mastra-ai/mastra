import { formatSkillActivation } from '@mastra/core/workspace';
import { SlashCommandComponent } from '../components/slash-command.js';
import { isCurrentThreadActive, sendSlashCommandMessage } from './send-slash-command-message.js';
import { isUserInvocable } from './skill-filters.js';
import type { SlashCommandContext } from './types.js';

// Keep the renderer's non-greedy `<skill>...</skill>` regex from terminating
// on a literal closing tag inside the body. Other characters pass through.
function escapeSkillBoundary(value: string): string {
  return value.replaceAll('</skill>', '&lt;/skill&gt;');
}

async function resolveWorkspace(ctx: SlashCommandContext) {
  let workspace = ctx.getResolvedWorkspace();
  if (!workspace && ctx.harness.hasWorkspace()) {
    workspace = await ctx.harness.resolveWorkspace();
  }
  return workspace;
}

export async function handleSkillsCommand(ctx: SlashCommandContext): Promise<void> {
  // Eagerly resolve workspace if not yet cached (e.g. /skills called before first message)
  let workspace;
  try {
    workspace = await resolveWorkspace(ctx);
  } catch (error) {
    ctx.showError(`Failed to resolve workspace: ${error instanceof Error ? error.message : String(error)}`);
    return;
  }

  if (!workspace?.skills) {
    ctx.showInfo(
      'No skills configured.\n\n' +
        'Add skills to any of these locations:\n' +
        '  .mastracode/skills/   (project-local)\n' +
        '  .claude/skills/       (project-local)\n' +
        '  .agents/skills/       (project-local)\n' +
        '  ~/.mastracode/skills/ (global)\n' +
        '  ~/.claude/skills/     (global)\n' +
        '  ~/.agents/skills/     (global)\n\n' +
        'Each skill is a folder with a SKILL.md file.\n' +
        'Install skills: npx add-skill <github-url>',
    );
    return;
  }

  try {
    const allSkills = await workspace.skills!.list();
    const skills = allSkills.filter(isUserInvocable);

    if (skills.length === 0) {
      ctx.showInfo(
        'No user-invokable skills found in configured directories.\n\n' +
          'Each skill needs a SKILL.md file with YAML frontmatter.\n' +
          'Skills with `user-invocable: false` are hidden from this list.\n' +
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

export async function handleSkillCommand(ctx: SlashCommandContext, skillName: string, args: string[]): Promise<void> {
  const normalizedSkillName = skillName.trim();
  if (!normalizedSkillName) {
    ctx.showError('Usage: /skill/<name>');
    return;
  }

  let workspace;
  try {
    workspace = await resolveWorkspace(ctx);
  } catch (error) {
    ctx.showError(`Failed to resolve workspace: ${error instanceof Error ? error.message : String(error)}`);
    return;
  }

  if (!workspace?.skills) {
    ctx.showError('No skills configured.');
    return;
  }

  try {
    const skill = await workspace.skills.get(normalizedSkillName);
    if (!skill || !isUserInvocable(skill)) {
      const skills = (await workspace.skills.list()).filter(isUserInvocable);
      const available = skills.length ? ` Available skills: ${skills.map(s => s.name).join(', ')}` : '';
      ctx.showError(`Skill not found: ${normalizedSkillName}.${available}`);
      return;
    }

    const trimmedArgs = args.join(' ').trim();
    const content = `${formatSkillActivation(skill)}${trimmedArgs ? `\n\nARGUMENTS: ${trimmedArgs}` : ''}`.trim();
    if (!content) {
      ctx.showInfo(`Activated /skill/${skill.name} (no instructions)`);
      return;
    }

    if (!isCurrentThreadActive(ctx)) {
      const component = new SlashCommandComponent(`skill/${skill.name}`, content);
      ctx.state.allSlashCommandComponents.push(component);
      ctx.state.chatContainer.addChild(component);
      ctx.state.ui.requestRender();
    }

    const displayText = `/skill/${skill.name}${trimmedArgs ? ` ${trimmedArgs}` : ''}`;
    await sendSlashCommandMessage(
      ctx,
      displayText,
      `<skill name="${skill.name}">\n${escapeSkillBoundary(content)}\n</skill>`,
      {
        renderIdleUserMessage: false,
      },
    );
  } catch (error) {
    ctx.showError(
      `Error executing /skill/${normalizedSkillName}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
