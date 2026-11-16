import { createContext } from 'react';

import type { PendingImage } from './ComposerImagesContext';

export interface DraftSessionStart {
  ready: boolean;
  start: (draft: { prompt: string; files: PendingImage[] }) => void;
}

export const DraftSessionStartContext = createContext<DraftSessionStart | null>(null);
