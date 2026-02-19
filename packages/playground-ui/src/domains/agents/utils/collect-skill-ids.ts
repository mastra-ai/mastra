import type { MastraClient } from '@mastra/client-js';

import type { SkillFormValue } from '../components/agent-edit-page/utils/form-validation';
import { extractSkillInstructions, extractSkillLicense } from '../components/agent-cms-pages/skill-file-tree';

export async function collectSkillIds(skills: SkillFormValue[], client: MastraClient): Promise<string[]> {
  const ids = await Promise.all(
    skills.map(skill =>
      client
        .createStoredSkill({
          name: skill.name,
          description: skill.description,
          instructions: extractSkillInstructions(skill.files),
          license: extractSkillLicense(skill.files),
          files: skill.files,
        })
        .then(r => r.id),
    ),
  );
  return ids;
}
