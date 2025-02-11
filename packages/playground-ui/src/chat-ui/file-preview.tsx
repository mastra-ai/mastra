import { FileIcon, X } from 'lucide-react';
import React, { useEffect } from 'react';

import { motion } from 'motion/react';

interface FilePreviewProps {
  file: File;
  onRemove?: () => void;
}

export const FilePreview = React.forwardRef<HTMLDivElement, FilePreviewProps>((props, ref) => {
  if (props.file.type.startsWith('image/')) {
    return <ImageFilePreview {...props} ref={ref} />;
  }

  if (props.file.type.startsWith('text/') || props.file.name.endsWith('.txt') || props.file.name.endsWith('.md')) {
    return <TextFilePreview {...props} ref={ref} />;
  }

  return <GenericFilePreview {...props} ref={ref} />;
});
FilePreview.displayName = 'FilePreview';

const ImageFilePreview = React.forwardRef<HTMLDivElement, FilePreviewProps>(({ file, onRemove }, ref) => {
  return (
    <motion.div
      ref={ref}
      className="relative flex max-w-[200px] rounded-md border p-1.5 pr-2 text-xs"
      layout
      initial={{ opacity: 0, y: '100%' }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: '100%' }}
    >
      <div className="flex w-full items-center space-x-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt={`Attachment ${file.name}`}
          className="bg-muted grid h-10 w-10 shrink-0 place-items-center rounded-sm border object-cover"
          src={URL.createObjectURL(file)}
        />
        <span className="text-muted-foreground w-full truncate">{file.name}</span>
      </div>

      {onRemove ? (
        <button
          className="bg-background absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full border"
          type="button"
          onClick={onRemove}
          aria-label="Remove attachment"
        >
          <X className="h-2.5 w-2.5" />
        </button>
      ) : null}
    </motion.div>
  );
});
ImageFilePreview.displayName = 'ImageFilePreview';

const TextFilePreview = React.forwardRef<HTMLDivElement, FilePreviewProps>(({ file, onRemove }, ref) => {
  const [preview, setPreview] = React.useState<string>('');

  useEffect(() => {
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target?.result as string;
      setPreview(text.slice(0, 50) + (text.length > 50 ? '...' : ''));
    };
    reader.readAsText(file);
  }, [file]);

  return (
    <motion.div
      ref={ref}
      className="relative flex max-w-[200px] rounded-md border p-1.5 pr-2 text-xs"
      layout
      initial={{ opacity: 0, y: '100%' }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: '100%' }}
    >
      <div className="flex w-full items-center space-x-2">
        <div className="bg-muted grid h-10 w-10 shrink-0 place-items-center rounded-sm border p-0.5">
          <div className="text-muted-foreground h-full w-full overflow-hidden text-[6px] leading-none">
            {preview || 'Loading...'}
          </div>
        </div>
        <span className="text-muted-foreground w-full truncate">{file.name}</span>
      </div>

      {onRemove ? (
        <button
          className="bg-background absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full border"
          type="button"
          onClick={onRemove}
          aria-label="Remove attachment"
        >
          <X className="h-2.5 w-2.5" />
        </button>
      ) : null}
    </motion.div>
  );
});
TextFilePreview.displayName = 'TextFilePreview';

const GenericFilePreview = React.forwardRef<HTMLDivElement, FilePreviewProps>(({ file, onRemove }, ref) => {
  return (
    <motion.div
      ref={ref}
      className="relative flex max-w-[200px] rounded-md border p-1.5 pr-2 text-xs"
      layout
      initial={{ opacity: 0, y: '100%' }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: '100%' }}
    >
      <div className="flex w-full items-center space-x-2">
        <div className="bg-muted grid h-10 w-10 shrink-0 place-items-center rounded-sm border">
          <FileIcon className="text-foreground h-6 w-6" />
        </div>
        <span className="text-muted-foreground w-full truncate">{file.name}</span>
      </div>

      {onRemove ? (
        <button
          className="bg-background absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full border"
          type="button"
          onClick={onRemove}
          aria-label="Remove attachment"
        >
          <X className="h-2.5 w-2.5" />
        </button>
      ) : null}
    </motion.div>
  );
});
GenericFilePreview.displayName = 'GenericFilePreview';
