import { useState } from 'react';
import type { ReactNode } from 'react';

import { ComposerImagesContext } from './ComposerImagesContext';
import type { PendingImage } from './ComposerImagesContext';

/** Owns composer attachments above the Composer so a failed first-prompt handoff can restore them. */
export function ComposerImagesProvider({
  children,
  initialImages = [],
}: {
  children: ReactNode;
  initialImages?: PendingImage[];
}) {
  const [images, setImages] = useState(initialImages);
  return <ComposerImagesContext.Provider value={{ images, setImages }}>{children}</ComposerImagesContext.Provider>;
}
