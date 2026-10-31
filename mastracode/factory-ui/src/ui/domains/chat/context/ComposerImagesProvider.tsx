import { useState } from 'react';
import type { ReactNode, SetStateAction } from 'react';

import { readComposerImages, saveComposerImages } from '../services/composerDrafts';
import { ComposerImagesContext } from './ComposerImagesContext';
import type { PendingImage } from './ComposerImagesContext';

/**
 * Owns composer attachments above the Composer so a failed first-prompt handoff can restore them.
 * `draftScope` names the chat whose unsent images are remembered across page changes.
 */
export function ComposerImagesProvider({ children, draftScope }: { children: ReactNode; draftScope?: string }) {
  const [images, setState] = useState<PendingImage[]>(() => (draftScope ? readComposerImages(draftScope) : []));
  const setImages = (action: SetStateAction<PendingImage[]>) =>
    setState(current => {
      const next = typeof action === 'function' ? action(current) : action;
      // Idempotent, so a repeated updater call (StrictMode) stores the same list.
      if (draftScope) saveComposerImages(draftScope, next);
      return next;
    });
  return <ComposerImagesContext.Provider value={{ images, setImages }}>{children}</ComposerImagesContext.Provider>;
}
