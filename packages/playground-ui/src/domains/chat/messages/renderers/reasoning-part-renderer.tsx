import type { ReasoningPart } from '@mastra/react/ui';

import { ReasoningActivity } from '../../../../ds/components/ai/activity';
import { getReasoningContent } from '../reasoning-content';

export interface ReasoningPartRendererProps {
  part: ReasoningPart;
  /** Whether the passage starts expanded. Defaults to `true`. */
  defaultOpen?: boolean;
}

export const ReasoningPartRenderer = ({ part, defaultOpen }: ReasoningPartRendererProps) => {
  const content = getReasoningContent(part);
  return content ? <ReasoningActivity {...content} defaultOpen={defaultOpen} /> : null;
};
