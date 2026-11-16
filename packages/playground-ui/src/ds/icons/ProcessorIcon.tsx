import { createLucideIcon } from 'lucide-react';
import type { LucideProps } from 'lucide-react';

// Drawn on lucide's grid so its line weight follows `--icon-stroke-width` like every lucide icon.
const Glyph = createLucideIcon('mastra-processor', [
  ['rect', { x: '6', y: '6', width: '12', height: '12', rx: '2', key: 'body' }],
  ['path', { d: 'M10 2v4M14 2v4M10 18v4M14 18v4M2 10h4M2 14h4M18 10h4M18 14h4', key: 'pins' }],
]);

export const ProcessorIcon = (props: LucideProps) => <Glyph size={16} {...props} />;
