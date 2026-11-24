import { Background, BackgroundVariant } from '@xyflow/react';
import { useId } from 'react';

export function GraphCanvasBackground() {
  return <Background id={useId()} variant={BackgroundVariant.Dots} gap={12} size={0.5} />;
}
