import { createContext } from 'react';
import type { Dispatch, SetStateAction } from 'react';

import type { OutgoingFile } from '../services/transcript';

export interface PendingImage extends OutgoingFile {
  id: string;
}

export interface ComposerImagesApi {
  images: PendingImage[];
  setImages: Dispatch<SetStateAction<PendingImage[]>>;
}

export const ComposerImagesContext = createContext<ComposerImagesApi | null>(null);
