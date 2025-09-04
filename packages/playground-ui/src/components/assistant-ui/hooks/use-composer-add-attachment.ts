/**
 * Overrides https://github.com/assistant-ui/assistant-ui/blob/4832e53c1531ba931539caf38ca9bb123a5df032/packages/react/src/primitives/composer/ComposerAddAttachment.tsx
 * to have a handler on the onChange event
 */

import { useComposer, useComposerRuntime } from '@assistant-ui/react';
import { useCallback } from 'react';

export const useComposerAddAttachment = ({
  multiple = true,
  onChange,
}: {
  /** allow selecting multiple files */
  multiple?: boolean | undefined;
  onChange?: (files: File[]) => void;
} = {}) => {
  const disabled = useComposer(c => !c.isEditing);

  const composerRuntime = useComposerRuntime();
  const callback = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = multiple;
    input.hidden = true;

    const attachmentAccept = composerRuntime.getAttachmentAccept();
    if (attachmentAccept !== '*') {
      input.accept = attachmentAccept;
    }

    document.body.appendChild(input);

    input.onchange = e => {
      const fileList = (e.target as HTMLInputElement).files;
      if (!fileList) return;
      for (const file of fileList) {
        composerRuntime.addAttachment(file);
        onChange?.(Array.from(fileList));
      }

      document.body.removeChild(input);
    };

    input.oncancel = () => {
      if (!input.files || input.files.length === 0) {
        document.body.removeChild(input);
      }
    };

    input.click();
  }, [composerRuntime, multiple]);

  if (disabled) return undefined;
  return callback;
};
