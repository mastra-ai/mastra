import { createLucideIcon } from 'lucide-react';
import type { LucideProps } from 'lucide-react';

// Drawn on lucide's grid so its line weight follows `--icon-stroke-width` like every lucide icon.
const Glyph = createLucideIcon('mastra-mcp-server', [
  ['path', { d: 'm3 11.5 7.4-7.4a3 3 0 0 1 4.3 4.3L8.5 14.6', key: 'hook' }],
  ['path', { d: 'm8.5 14.6 6.2-6.2a3 3 0 0 1 4.3 4.3l-6.3 6.3a1.4 1.4 0 0 0 0 2l1.4 1.4', key: 'link' }],
]);

export const McpServerIcon = (props: LucideProps) => <Glyph size={16} {...props} />;
