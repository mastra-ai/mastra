import { createLucideIcon } from 'lucide-react';
import type { LucideProps } from 'lucide-react';

// Drawn on lucide's grid so its line weight follows `--icon-stroke-width` like every lucide icon.
const Glyph = createLucideIcon('mastra-prompt', [
  [
    'path',
    {
      d: 'M12.4 17.5h6.3a3.3 3.3 0 0 0 3.3-3.3V5.8a3.3 3.3 0 0 0-3.3-3.3H5.3A3.3 3.3 0 0 0 2 5.8v8.4a3.3 3.3 0 0 0 3.3 3.3v3.7z',
      key: 'bubble',
    },
  ],
]);

export const PromptIcon = (props: LucideProps) => <Glyph size={16} {...props} />;
