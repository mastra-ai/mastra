import { join, isAbsolute } from 'path';
import fs from 'fs-extra';
import * as p from '@clack/prompts';
import pc from 'picocolors';
// @ts-ignore - Importing from workspace package
import { loadSkill, SKILL_FILE_NAME } from '@mastra/core/skills';

export async function listSkillsCommand(dir?: string) {
    const cwd = process.cwd();
    // Default to .mastra/skills if not provided
    const targetDir = dir
        ? (isAbsolute(dir) ? dir : join(cwd, dir))
        : join(cwd, '.mastra/skills');

    const s = p.spinner();
    s.start(`Scanning for skills in ${targetDir}...`);

    try {
        if (!fs.existsSync(targetDir)) {
            s.stop(`Directory not found: ${targetDir}`);

            if (!dir) {
                // If default directory doesn't exist, this is expected for new projects
                p.log.info('No skills found. Create one with `mastra skill create`.');
            }
            return;
        }

        const entries = await fs.readdir(targetDir, { withFileTypes: true });
        const skillDirs = entries
            .filter(entry => entry.isDirectory())
            .map(entry => join(targetDir, entry.name));

        const validSkills: any[] = [];
        const invalidSkills: string[] = [];

        for (const skillDir of skillDirs) {
            try {
                if (fs.existsSync(join(skillDir, SKILL_FILE_NAME))) {
                    const skill = await loadSkill(skillDir, { validate: false });
                    validSkills.push(skill);
                }
            } catch (e) {
                invalidSkills.push(skillDir);
            }
        }

        s.stop(`Found ${validSkills.length} skills.`);

        if (validSkills.length === 0) {
            p.log.info('No valid skills found in directory.');
            return;
        }

        console.log('');
        console.log(pc.bold('Available Skills:'));
        console.log('');

        validSkills.forEach(skill => {
            const name = skill.content.frontmatter.name;
            const desc = skill.content.frontmatter.description || 'No description';
            const version = skill.content.frontmatter.version ? `v${skill.content.frontmatter.version}` : '';

            console.log(`${pc.cyan(pc.bold(name))} ${pc.gray(version)}`);
            console.log(`  ${desc}`);
            console.log('');
        });

    } catch (error: any) {
        s.stop(pc.red('Failed to list skills'));
        console.error(pc.red(error.message));
        process.exit(1);
    }
}
