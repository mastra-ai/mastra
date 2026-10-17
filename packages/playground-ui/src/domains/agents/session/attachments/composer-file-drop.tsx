import type { ReactNode } from 'react';

import { useComposerAttachments } from './composer-attachments';
import { FileDropBackdrop } from '@/ds/components/FileDropBackdrop';

/** Lets files dragged anywhere over the page be dropped into the composer's attachments. */
export const ComposerFileDrop = ({ disabled, children }: { disabled?: boolean; children: ReactNode }) => {
  const { addFiles } = useComposerAttachments();

  return (
    <FileDropBackdrop
      onFilesDrop={files => void addFiles(files)}
      label="Drop to attach"
      description="Release to add your files to the message."
      disabled={disabled}
    >
      {children}
    </FileDropBackdrop>
  );
};
