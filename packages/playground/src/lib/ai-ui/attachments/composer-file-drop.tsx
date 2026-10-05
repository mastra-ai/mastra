import { FileDropBackdrop } from '@mastra/playground-ui/components/FileDropBackdrop';
import { useState } from 'react';
import type { ReactNode } from 'react';

import { useComposerAttachments } from './composer-attachments';
import { unreadableFilesMessage } from './unreadable-files-message';

/** Lets files dragged anywhere over the page be dropped into the composer's attachments. */
export const ComposerFileDrop = ({ disabled, children }: { disabled?: boolean; children: ReactNode }) => {
  const { addFiles } = useComposerAttachments();
  const [error, setError] = useState('');

  const handleFilesDrop = async (files: File[]) => {
    const rejected = await addFiles(files);
    setError(rejected.length > 0 ? unreadableFilesMessage(rejected) : '');
  };

  return (
    <FileDropBackdrop
      onFilesDrop={files => void handleFilesDrop(files)}
      label="Drop to attach"
      description="Release to add your files to the message."
      disabled={disabled}
    >
      {error && (
        <p role="alert" className="text-caption">
          {error}
        </p>
      )}
      {children}
    </FileDropBackdrop>
  );
};
