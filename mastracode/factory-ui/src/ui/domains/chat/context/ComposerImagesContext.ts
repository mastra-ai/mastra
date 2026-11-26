import { createContext } from 'react';
import type { Dispatch, SetStateAction } from 'react';

import type { PendingImage } from '@mastra/playground-ui/domains/chat/transcript';

export type { PendingImage };

export interface ComposerImagesApi {
  images: PendingImage[];
  setImages: Dispatch<SetStateAction<PendingImage[]>>;
}

export const ComposerImagesContext = createContext<ComposerImagesApi | null>(null);
