import { SkillActivity } from '@mastra/playground-ui/components/ai/activity';
import type { SkillActivation } from './skill-activation';

export type { SkillActivation } from './skill-activation';
export { parseSkillActivation } from './skill-activation';

export function SkillMessage({ activation }: { activation: SkillActivation }) {
  return (
    <SkillActivity name={activation.name} arguments={activation.arguments} instructions={activation.instructions} />
  );
}
