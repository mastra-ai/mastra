import type { StoredSkillResponse } from '@mastra/client-js';
import { SkillsDetail } from '../details/skills-detail';

export interface SkillsProps {
  availableSkills: StoredSkillResponse[];
  editable?: boolean;
  /** Disables interaction (e.g. while a stream is running). */
  disabled?: boolean;
}

export const Skills = ({ availableSkills, editable = true, disabled = false }: SkillsProps) => {
  return <SkillsDetail editable={editable && !disabled} availableSkills={availableSkills} />;
};
