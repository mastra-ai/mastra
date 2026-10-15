import { useContext } from 'react';

import { ComposerImagesContext } from './ComposerImagesContext';
import type { ComposerImagesApi } from './ComposerImagesContext';

export function useComposerImagesState(): ComposerImagesApi {
  const ctx = useContext(ComposerImagesContext);
  if (!ctx) throw new Error('useComposerImagesState must be used within a ChatSessionProvider');
  return ctx;
}
