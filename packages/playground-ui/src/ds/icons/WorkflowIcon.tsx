import { createLucideIcon } from 'lucide-react';
import type { LucideProps } from 'lucide-react';

// Drawn on lucide's grid so its line weight follows `--icon-stroke-width` like every lucide icon.
const Glyph = createLucideIcon('mastra-workflow', [
  ['circle', { cx: '12', cy: '5', r: '3', key: 'root' }],
  ['circle', { cx: '6', cy: '19', r: '3', key: 'left' }],
  ['circle', { cx: '18', cy: '19', r: '3', key: 'right' }],
  ['path', { d: 'M12 8v4', key: 'stem' }],
  ['path', { d: 'M6 16v-2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2', key: 'branches' }],
]);

export const WorkflowIcon = (props: LucideProps) => <Glyph size={16} {...props} />;
