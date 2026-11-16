import { useEffect, useEffectEvent } from 'react';

import { useChatCommands } from '../context/ChatCommandsProvider';

export function usePromptButton(prompt: string) {
  const { showComposerPreview, clearComposerPreview, submitComposer } = useChatCommands();
  const clearOwnPreview = useEffectEvent(() => clearComposerPreview(prompt));
  // Unmounting under the pointer or focus fires no pointerleave/blur.
  useEffect(() => () => clearOwnPreview(), []);
  return {
    onPointerEnter: () => showComposerPreview(prompt),
    onPointerLeave: () => clearComposerPreview(prompt),
    onFocus: () => showComposerPreview(prompt),
    onBlur: () => clearComposerPreview(prompt),
    onClick: () => submitComposer(prompt),
  };
}
