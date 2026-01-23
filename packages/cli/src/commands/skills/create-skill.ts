import { join } from 'path';
import fs from 'fs-extra';
import * as p from '@clack/prompts';
import pc from 'picocolors';

export async function createSkill(name?: string, dir?: string) {
  let skillName = name;

  if (!skillName) {
    const namePrompt = await p.text({
      message: 'What is the name of your skill?',
      placeholder: 'my-custom-skill',
      validate: value => {
        if (!value) return 'Please enter a name.';
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
          return 'Skill name must be lowercase alphanumeric with hyphens (e.g., code-review)';
        }
      },
    });

    if (p.isCancel(namePrompt)) {
      p.cancel('Operation cancelled.');
      process.exit(0);
    }

    skillName = namePrompt as string;
  }

  // Determine target directory
  const cwd = process.cwd();
  const targetDir = dir ? join(cwd, dir) : join(cwd, '.mastra/skills');
  const skillDir = join(targetDir, skillName);

  if (fs.existsSync(skillDir)) {
    p.log.error(`Directory ${skillDir} already exists.`);
    process.exit(1);
  }

  const s = p.spinner();
  s.start(`Creating skill ${skillName}...`);

  try {
    // Create directory structure
    await fs.ensureDir(skillDir);
    await fs.ensureDir(join(skillDir, 'examples'));
    await fs.ensureDir(join(skillDir, 'resources'));

    // Create SKILL.md
    const skillContent = `---
name: ${skillName}
description: TODO: Add a clear description of what this skill does
version: 1.0.0
tags:
  - example
---

# ${skillName
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')}

TODO: Add detailed instructions for the agent here.

## Examples

TODO: Add examples of how to use this skill.

## Resources

TODO: Add any reference material.
`;

    await fs.writeFile(join(skillDir, 'SKILL.md'), skillContent);

    s.stop(`Skill ${skillName} created successfully!`);

    p.note(
      `Location: ${skillDir}\n` +
        `\n` +
        `Next steps:\n` +
        `1. Edit ${skillName}/SKILL.md to add instructions\n` +
        `2. Add this skill to your agent config in mastra.config.ts`,
      'Skill Created',
    );
  } catch (error) {
    s.stop('Failed to create skill.');
    console.error(error);
    process.exit(1);
  }
}
