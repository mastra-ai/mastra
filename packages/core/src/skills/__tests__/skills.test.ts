import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { loadSkill, loadSkills, validateSkillDirectory } from '../loader';
import { validateSkill } from '../validator';
import { SkillsManager } from '../manager';
import { SkillError, SKILL_ERROR_CODES, SKILL_WARNING_CODES } from '../index';

describe('Skills Module', () => {
    let testDir: string;

    beforeEach(() => {
        // Create a temporary directory for test skills
        testDir = join(tmpdir(), `mastra-skills-test-${randomUUID()}`);
        mkdirSync(testDir, { recursive: true });
    });

    afterEach(() => {
        // Clean up test directory
        if (existsSync(testDir)) {
            rmSync(testDir, { recursive: true, force: true });
        }
    });

    describe('loadSkill', () => {
        it('should load a valid skill successfully', async () => {
            // Create a test skill
            const skillName = 'test-skill';
            const skillDir = join(testDir, skillName);
            mkdirSync(skillDir);

            const skil lMd = `---
name: test-skill
description: A test skill for validation
version: 1.0.0
tags:
  - testing
  - example
---

# Test Skill Instructions

This is a test skill with some instructions.

## Usage

Use this skill for testing purposes.
`;

            writeFileSync(join(skillDir, 'SKILL.md'), skillMd);

            const skill = await loadSkill(skillDir);

            expect(skill).toBeDefined();
            expect(skill.id).toBe('test-skill');
            expect(skill.content.frontmatter.name).toBe('test-skill');
            expect(skill.content.frontmatter.description).toBe('A test skill for validation');
            expect(skill.content.frontmatter.version).toBe('1.0.0');
            expect(skill.content.frontmatter.tags).toEqual(['testing', 'example']);
            expect(skill.content.instructions).toContain('Test Skill Instructions');
            expect(skill.metadata.loadedAt).toBeInstanceOf(Date);
        });

        it('should throw error for missing SKILL.md file', async () => {
            const skillDir = join(testDir, 'missing-skill');
            mkdirSync(skillDir);

            await expect(loadSkill(skillDir)).rejects.toThrow(SkillError);
            await expect(loadSkill(skillDir)).rejects.toThrow(/SKILL\.md not found/);
        });

        it('should throw error for missing directory', async () => {
            const nonExistentDir = join(testDir, 'non-existent');

            await expect(loadSkill(nonExistentDir)).rejects.toThrow(SkillError);
        });

        it('should throw error for invalid YAML frontmatter', async () => {
            const skillDir = join(testDir, 'invalid-yaml-skill');
            mkdirSync(skillDir);

            const invalidSkillMd = `---
name: test-skill
description: Missing closing dashes
# Instructions here
`;

            writeFileSync(join(skillDir, 'SKILL.md'), invalidSkillMd);

            await expect(loadSkill(skillDir)).rejects.toThrow();
        });

        it('should throw error for missing required frontmatter fields', async () => {
            const skillDir = join(testDir, 'missing-fields-skill');
            mkdirSync(skillDir);

            const missingFieldsSkillMd = `---
name: test-skill
---
# Instructions
`;

            writeFileSync(join(skillDir, 'SKILL.md'), missingFieldsSkillMd);

            await expect(loadSkill(skillDir)).rejects.toThrow(SkillError);
            await expect(loadSkill(skillDir)).rejects.toThrow(/description/);
        });

        it('should detect optional subdirectories', async () => {
            const skillDir = join(testDir, 'full-skill');
            mkdirSync(skillDir);
            mkdirSync(join(skillDir, 'scripts'));
            mkdirSync(join(skillDir, 'examples'));
            mkdirSync(join(skillDir, 'resources'));

            const skillMd = `---
name: full-skill
description: A skill with all optional folders
---
# Instructions
`;

            writeFileSync(join(skillDir, 'SKILL.md'), skillMd);

            const skill = await loadSkill(skillDir);

            expect(skill.metadata.scriptsPath).toBeDefined();
            expect(skill.metadata.examplesPath).toBeDefined();
            expect(skill.metadata.resourcesPath).toBeDefined();
        });

        it('should compute file hash when requested', async () => {
            const skillDir = join(testDir, 'hash-skill');
            mkdirSync(skillDir);

            const skillMd = `---
name: hash-skill
description: Test hash computation
---
# Instructions
`;

            writeFileSync(join(skillDir, 'SKILL.md'), skillMd);

            const skill = await loadSkill(skillDir, { computeHash:  });

            expect(skill.metadata.fileHash).toBeDefined();
            expect(skill.metadata.fileHash).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex
        });
    });

    describe('loadSkills', () => {
        it('should load multiple skills successfully', async () => {
            // Create two test skills
            const skill1Dir = join(testDir, 'skill1');
            const skill2Dir = join(testDir, 'skill2');
            mkdirSync(skill1Dir);
            mkdirSync(skill2Dir);

            writeFileSync(
                join(skill1Dir, 'SKILL.md'),
                `---
name: skill1
description: First skill
---
# Skill 1
`,
            );

            writeFileSync(
                join(skill2Dir, 'SKILL.md'),
                `---
name: skill2
description: Second skill
---
# Skill 2
`,
            );

            const skills = await loadSkills([skill1Dir, skill2Dir]);

            expect(skills.size).toBe(2);
            expect(skills.has('skill1')).toBe(true);
            expect(skills.has('skill2')).toBe(true);
        });

        it('should throw error if any skill fails to load', async () => {
            const skill1Dir = join(testDir, 'valid-skill');
            const skill2Dir = join(testDir, 'invalid-skill');
            mkdirSync(skill1Dir);
            mkdirSync(skill2Dir);

            writeFileSync(
                join(skill1Dir, 'SKILL.md'),
                `---
name: valid-skill
description: Valid skill
---
# Valid
`,
            );

            // Invalid skill (missing description)
            writeFileSync(
                join(skill2Dir, 'SKILL.md'),
                `---
name: invalid-skill
---
# Invalid
`,
            );

            await expect(loadSkills([skill1Dir, skill2Dir])).rejects.toThrow();
        });
    });

    describe('validateSkill', () => {
        it('should pass validation for valid skill', async () => {
            const skillDir = join(testDir, 'valid-skill');
            mkdirSync(skillDir);

            writeFileSync(
                join(skillDir, 'SKILL.md'),
                `---
name: valid-skill
description: A properly formatted skill
version: 1.0.0
tags: [test]
---
# Instructions
`,
            );

            const skill = await loadSkill(skillDir, { validate: false });
            const result = validateSkill(skill);

            expect(result.valid).toBe(true);
            expect(result.errors.length).toBe(0);
        });

        it('should fail validation for missing name', async () => {
            const skillDir = join(testDir, 'no-name-skill');
            mkdirSync(skillDir);

            writeFileSync(
                join(skillDir, 'SKILL.md'),
                `---
description: Missing name
---
# Instructions
`,
            );

            const skill = await loadSkill(skillDir, { validate: false });
            const result = validateSkill(skill);

            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.code === SKILL_ERROR_CODES.MISSING_NAME)).toBe(true);
        });

        it('should fail validation for invalid name format', async () => {
            const skillDir = join(testDir, 'bad-name-skill');
            mkdirSync(skillDir);

            writeFileSync(
                join(skillDir, 'SKILL.md'),
                `---
name: Bad_Skill Name!
description: Invalid name format
---
# Instructions
`,
            );

            const skill = await loadSkill(skillDir, { validate: false });
            const result = validateSkill(skill);

            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.code === SKILL_ERROR_CODES.INVALID_NAME_FORMAT)).toBe(true);
        });

        it('should warn about missing optional fields', async () => {
            const skillDir = join(testDir, 'minimal-skill');
            mkdirSync(skillDir);

            writeFileSync(
                join(skillDir, 'SKILL.md'),
                `---
name: minimal-skill
description: Only required fields
---
# Instructions
`,
            );

            const skill = await loadSkill(skillDir, { validate: false });
            const result = validateSkill(skill);

            expect(result.valid).toBe(true);
            expect(result.warnings.length).toBeGreaterThan(0);
            expect(result.warnings.some(w => w.code === SKILL_WARNING_CODES.MISSING_VERSION)).toBe(true);
            expect(result.warnings.some(w => w.code === SKILL_WARNING_CODES.MISSING_TAGS)).toBe(true);
        });
    });

    describe('SkillsManager', () => {
        let manager: SkillsManager;

        beforeEach(() => {
            manager = new SkillsManager();
        });

        it('should load and cache skills', async () => {
            const skillDir = join(testDir, 'managed-skill');
            mkdirSync(skillDir);

            writeFileSync(
                join(skillDir, 'SKILL.md'),
                `---
name: managed-skill
description: Managed by SkillsManager
---
# Instructions
`,
            );

            await manager.load([skillDir]);

            expect(manager.size()).toBe(1);
            expect(manager.has('managed-skill')).toBe(true);

            const skill = manager.get('managed-skill');
            expect(skill).toBeDefined();
            expect(skill!.id).toBe('managed-skill');
        });

        it('should reload a skill', async () => {
            const skillDir = join(testDir, 'reload-skill');
            mkdirSync(skillDir);

            const skillPath = join(skillDir, 'SKILL.md');
            writeFileSync(
                skillPath,
                `---
name: reload-skill
description: Original description
---
# Original
`,
            );

            await manager.load([skillDir]);
            const originalSkill = manager.get('reload-skill');
            expect(originalSkill!.content.frontmatter.description).toBe('Original description');

            // Modify skill file
            writeFileSync(
                skillPath,
                `---
name: reload-skill
description: Updated description
---
# Updated
`,
            );

            await manager.reload('reload-skill');
            const reloadedSkill = manager.get('reload-skill');
            expect(reloadedSkill!.content.frontmatter.description).toBe('Updated description');
        });

        it('should filter skills by tag', async () => {
            const skill1Dir = join(testDir, 'tagged-skill-1');
            const skill2Dir = join(testDir, 'tagged-skill-2');
            mkdirSync(skill1Dir);
            mkdirSync(skill2Dir);

            writeFileSync(
                join(skill1Dir, 'SKILL.md'),
                `---
name: tagged-skill-1
description: Skill with coding tag
tags: [coding, review]
---
# Skill 1
`,
            );

            writeFileSync(
                join(skill2Dir, 'SKILL.md'),
                `---
name: tagged-skill-2
description: Skill with documentation tag
tags: [documentation]
---
# Skill 2
`,
            );

            await manager.load([skill1Dir, skill2Dir]);

            const codingSkills = manager.filterByTag('coding');
            expect(codingSkills.length).toBe(1);
            expect(codingSkills[0]!.id).toBe('tagged-skill-1');
        });

        it('should search skills by keyword', async () => {
            const skillDir = join(testDir, 'searchable-skill');
            mkdirSync(skillDir);

            writeFileSync(
                join(skillDir, 'SKILL.md'),
                `---
name: searchable-skill
description: Helps with code review tasks
keywords: [code, review, quality]
---
# Code Review Instructions
This skill helps you review code quality.
`,
            );

            await manager.load([skillDir]);

            const results = manager.search('code review');
            expect(results.length).toBe(1);
            expect(results[0]!.id).toBe('searchable-skill');
        });

        it('should get combined instructions', async () => {
            const skill1Dir = join(testDir, 'skill-a');
            const skill2Dir = join(testDir, 'skill-b');
            mkdirSync(skill1Dir);
            mkdirSync(skill2Dir);

            writeFileSync(
                join(skill1Dir, 'SKILL.md'),
                `---
name: skill-a
description: First skill
---
# Instructions A
`,
            );

            writeFileSync(
                join(skill2Dir, 'SKILL.md'),
                `---
name: skill-b
description: Second skill
---
# Instructions B
`,
            );

            await manager.load([skill1Dir, skill2Dir]);

            const combined = manager.getCombinedInstructions();
            expect(combined).toContain('Skill: skill-a');
            expect(combined).toContain('Skill: skill-b');
            expect(combined).toContain('Instructions A');
            expect(combined).toContain('Instructions B');
        });

        it('should clear all skills', async () => {
            const skillDir = join(testDir, 'clear-test-skill');
            mkdirSync(skillDir);

            writeFileSync(
                join(skillDir, 'SKILL.md'),
                `---
name: clear-test-skill
description: Will be cleared
---
# Instructions
`,
            );

            await manager.load([skillDir]);
            expect(manager.size()).toBe(1);

            manager.clear();
            expect(manager.size()).toBe(0);
            expect(manager.has('clear-test-skill')).toBe(false);
        });
    });

    describe('validateSkillDirectory', () => {
        it('should return true for valid skill directory', async () => {
            const skillDir = join(testDir, 'valid-dir-skill');
            mkdirSync(skillDir);

            writeFileSync(
                join(skillDir, 'SKILL.md'),
                `---
name: valid-dir-skill
description: Valid directory structure
---
# Instructions
`,
            );

            const isValid = await validateSkillDirectory(skillDir);
            expect(isValid).toBe(true);
        });

        it('should return false for invalid skill directory', async () => {
            const skillDir = join(testDir, 'invalid-dir-skill');
            mkdirSync(skillDir);

            // No SKILL.md file

            const isValid = await validateSkillDirectory(skillDir);
            expect(isValid).toBe(false);
        });
    });
});
