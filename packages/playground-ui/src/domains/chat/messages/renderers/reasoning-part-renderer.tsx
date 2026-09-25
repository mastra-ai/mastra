import type { ReasoningPart } from '@mastra/react/ui';

import { Reasoning } from '../reasoning';
import { getReasoningContent } from '../reasoning-content';

export interface ReasoningPartRendererProps {
  part: ReasoningPart;
  /** Whether the passage starts expanded. Defaults to `true`. */
  defaultOpen?: boolean;
}

export const ReasoningPartRenderer = ({ part, defaultOpen }: ReasoningPartRendererProps) => {
  const content = getReasoningContent(part);
  return content ? <Reasoning {...content} defaultOpen={defaultOpen} /> : null;
};
