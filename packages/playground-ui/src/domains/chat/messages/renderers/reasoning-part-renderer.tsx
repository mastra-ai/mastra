import type { ReasoningPart } from '@mastra/react';

import { Reasoning } from '../reasoning';
import { getReasoningContent } from '../reasoning-content';

export interface ReasoningPartRendererProps {
  part: ReasoningPart;
}

export const ReasoningPartRenderer = ({ part }: ReasoningPartRendererProps) => {
  const content = getReasoningContent(part);
  return content ? <Reasoning {...content} /> : null;
};
