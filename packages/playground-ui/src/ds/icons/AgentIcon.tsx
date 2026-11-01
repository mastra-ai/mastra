import { createLucideIcon } from 'lucide-react';
import type { LucideProps } from 'lucide-react';

// Drawn on lucide's grid so its line weight follows `--icon-stroke-width` like every lucide icon.
const Glyph = createLucideIcon('mastra-agent', [
  ['circle', { cx: '12', cy: '5', r: '2.5', key: 'head' }],
  ['path', { d: 'M4 10.5 12 14l8-3.5', key: 'arms' }],
  ['path', { d: 'M7 20.5 12 14l5 6.5', key: 'legs' }],
]);

export const AgentIcon = (props: LucideProps) => <Glyph size={16} {...props} />;
