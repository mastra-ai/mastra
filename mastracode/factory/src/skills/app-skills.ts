import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { isInlineSkill } from '@mastra/core/skills';
import type { InlineSkill } from '@mastra/core/skills';

import type { BoardRegistry } from '../boards/index.js';
import { FACTORY_SKILL_NAMES, resolveLocalFactorySkillsPath, REVIEW_ONLY_FACTORY_SKILLS } from '../workspace.js';

/** Check `MastraFactory({ skills })`: each entry must come from `createSkill()` and names must be unique. */
export function assertFactorySkills(skills: unknown): readonly InlineSkill[] {
  if (skills === undefined) return [];
  if (!Array.isArray(skills)) {
    throw new Error("MastraFactory: 'skills' must be an array of createSkill() results.");
  }
  const names = new Set<string>();
  for (const skill of skills) {
    if (!isInlineSkill(skill)) {
      throw new Error(
        "MastraFactory: every entry in 'skills' must be created with createSkill() from '@mastra/core/skills'.",
      );
    }
    if (names.has(skill.name)) {
      throw new Error(`MastraFactory: duplicate skill name '${skill.name}' in 'skills'.`);
    }
    names.add(skill.name);
  }
  return Object.freeze([...skills]);
}

/**
 * Problems with the skills board phases name in `runner.skill`, found at
 * startup instead of when a card first enters the phase. A skill is found when
 * it is a code skill, a folder skill in the app's `factory-skills/`, or bundled.
 */
export function findBoardSkillProblems(
  boards: BoardRegistry,
  codeSkills: readonly InlineSkill[],
  localSkillsPath: string | undefined = resolveLocalFactorySkillsPath(),
): string[] {
  const codeNames = new Set(codeSkills.map(skill => skill.name));
  const problems: string[] = [];
  for (const [boardId, board] of boards) {
    for (const [phaseId, phase] of Object.entries(board.phases)) {
      if (phase.kind !== 'working' || !phase.runner.skill) continue;
      const { skill, context } = phase.runner;
      const where = `Board '${boardId}' phase '${phaseId}'`;
      const found =
        codeNames.has(skill) ||
        FACTORY_SKILL_NAMES.has(skill) ||
        (localSkillsPath !== undefined && existsSync(join(localSkillsPath, skill, 'SKILL.md')));
      if (!found) {
        problems.push(
          `${where} runs skill '${skill}', but no such skill exists. Pass it in MastraFactory({ skills }) or add factory-skills/${skill}/SKILL.md.`,
        );
      } else if (REVIEW_ONLY_FACTORY_SKILLS.has(skill) && context !== 'review') {
        problems.push(
          `${where} runs review skill '${skill}' in the '${context}' context; review skills only load in the 'review' context.`,
        );
      }
    }
  }
  return problems;
}
