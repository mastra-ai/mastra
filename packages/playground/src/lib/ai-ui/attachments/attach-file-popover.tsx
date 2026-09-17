import { useState } from 'react';
import { AttachmentPicker } from './attachment-picker';
import { useComposerAttachments } from './composer-attachments';

export const AttachFilePopover = () => {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const { addFiles, addUrl } = useComposerAttachments();

  const openFilePicker = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.hidden = true;

    const cleanup = () => {
      window.removeEventListener('focus', onWindowFocus);
      input.remove();
    };

    // Defer cleanup so file change runs before the focus fallback for missing cancel events.
    const onWindowFocus = () => setTimeout(cleanup, 0);

    input.onchange = async () => {
      const fileList = input.files;
      if (fileList && fileList.length > 0) {
        const rejected = await addFiles(fileList);
        setError(
          rejected.length > 0
            ? `Cannot read these files in Studio: ${rejected.join(', ')}. Export spreadsheet data as CSV or upload a text file instead.`
            : '',
        );
        if (rejected.length === 0) setOpen(false);
      }
      cleanup();
    };

    document.body.appendChild(input);
    window.addEventListener('focus', onWindowFocus);
    input.click();
  };

  const handleSubmitUrl = async (url: string) => {
    try {
      await addUrl(url);
      setOpen(false);
    } catch {
      // addUrl reports the error; keep the picker open for retry.
    }
  };

  return (
    <AttachmentPicker
      open={open}
      onOpenChange={value => {
        setOpen(value);
        setError('');
      }}
      error={error}
      onSubmitUrl={url => {
        void handleSubmitUrl(url);
      }}
      onChooseFiles={openFilePicker}
    />
  );
};
