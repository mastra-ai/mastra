import { ChatSkill } from '@mastra/playground-ui/components/ai/chat-event';
import type { SkillActivation } from './skill-activation';

export type { SkillActivation } from './skill-activation';
export { parseSkillActivation } from './skill-activation';

export function SkillMessage({ activation }: { activation: SkillActivation }) {
  return <ChatSkill name={activation.name} arguments={activation.arguments} instructions={activation.instructions} />;
}
