import { join, isAbsolute } from 'path';
import fs from 'fs-extra';
import * as p from '@clack/prompts';
import pc from 'picocolors';
// @ts-ignore - Importing from workspace package
import { loadSkill, validateSkill, SKILL_FILE_NAME } from '@mastra/core/skills';

export async function validateSkillCommand(path?: string) {
  let skillPath = path;

  if (!skillPath) {
    const pathPrompt = await p.text({
      message: 'Enter the path to the skill directory:',
      placeholder: '.mastra/skills/my-skill',
      validate: value => {
        if (!value) return 'Please enter a path.';
      },
    });

    if (p.isCancel(pathPrompt)) {
      p.cancel('Operation cancelled.');
      process.exit(0);
    }

    skillPath = pathPrompt as string;
  }

  const cwd = process.cwd();
  const absolutePath = isAbsolute(skillPath!) ? skillPath! : join(cwd, skillPath!);

  const s = p.spinner();
  s.start(`Validating skill at ${skillPath}...`);

  try {
    if (!fs.existsSync(absolutePath)) {
      s.stop(`Directory not found: ${skillPath}`);
      return;
    }

    // Check if it's a directory
    const stats = await fs.stat(absolutePath);
    if (!stats.isDirectory()) {
      s.stop(`Path is not a directory: ${skillPath}`);
      return;
    }

    // Try to load the skill
    const skill = await loadSkill(absolutePath, { validate: false });
    const result = validateSkill(skill);

    if (result.valid) {
      s.stop(pc.green('Skill is VALID'));

      const tableInfo = [
        ['Name', skill.content.frontmatter.name],
        ['Description', skill.content.frontmatter.description],
        ['Version', skill.content.frontmatter.version || '-'],
        ['Tags', skill.content.frontmatter.tags?.join(', ') || '-'],
      ];

      console.log('');
      console.log(pc.bold('Skill Details:'));
      for (const [key, value] of tableInfo) {
        console.log(`${key.padEnd(15)}: ${value}`);
      }

      if (result.warnings.length > 0) {
        console.log('');
        console.log(pc.yellow(pc.bold('Warnings:')));
        result.warnings.forEach(w => {
          console.log(pc.yellow(`- ${w.message}`));
        });
      }
    } else {
      s.stop(pc.red('Skill is INVALID'));

      console.log('');
      console.log(pc.red(pc.bold('Errors:')));
      result.errors.forEach(e => {
        console.log(pc.red(`- ${e.message}`));
      });

      if (result.warnings.length > 0) {
        console.log('');
        console.log(pc.yellow(pc.bold('Warnings:')));
        result.warnings.forEach(w => {
          console.log(pc.yellow(`- ${w.message}`));
        });
      }

      process.exit(1);
    }
  } catch (error: any) {
    s.stop(pc.red('Validation failed'));
    console.error(pc.red(error.message));
    process.exit(1);
  }
}
