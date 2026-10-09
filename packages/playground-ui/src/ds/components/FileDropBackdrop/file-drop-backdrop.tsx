import { CloudUploadIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { EmptyState } from '../EmptyState';

// Matches `--duration-normal` so the fade-out finishes before the backdrop unmounts.
const EXIT_DURATION_MS = 200;

export interface FileDropBackdropProps {
  /** Called with the dropped files that match `accept`. Not called when none match. */
  onFilesDrop: (files: File[]) => void;
  label?: ReactNode;
  /** Explains what happens on release, shown under the label. */
  description?: ReactNode;
  /** Same format as the HTML `accept` attribute, e.g. `image/*,.pdf`. */
  accept?: string;
  disabled?: boolean;
  children?: ReactNode;
}

const matchesAccept = (file: File, accept?: string) => {
  if (!accept) return true;

  const fileName = file.name.toLowerCase();
  const fileType = file.type.toLowerCase();

  return accept
    .split(',')
    .map(token => token.trim().toLowerCase())
    .filter(Boolean)
    .some(token => {
      if (token.startsWith('.')) return fileName.endsWith(token);
      if (token.endsWith('/*')) return fileType.startsWith(token.slice(0, -1));
      return fileType === token;
    });
};

const hasFiles = (event: DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes('Files');

export function FileDropBackdrop({
  onFilesDrop,
  label = 'Drop to upload',
  description = 'Release to attach your files.',
  accept,
  disabled = false,
  children,
}: FileDropBackdropProps) {
  const [isDragging, setIsDragging] = useState(false);
  const dragDepth = useRef(0);
  const onFilesDropRef = useRef(onFilesDrop);
  onFilesDropRef.current = onFilesDrop;
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    if (isDragging) {
      setIsMounted(true);
      return;
    }
    const timeout = setTimeout(() => setIsMounted(false), EXIT_DURATION_MS);
    return () => clearTimeout(timeout);
  }, [isDragging]);

  useEffect(() => {
    if (disabled) return;

    const reset = () => {
      dragDepth.current = 0;
      setIsDragging(false);
    };

    const handleDragEnter = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      dragDepth.current += 1;
      setIsDragging(true);
    };

    const handleDragOver = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
    };

    const handleDragLeave = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setIsDragging(false);
    };

    const handleDrop = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      reset();

      const files = Array.from(event.dataTransfer?.files ?? []).filter(file => matchesAccept(file, accept));
      if (files.length > 0) onFilesDropRef.current(files);
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('drop', handleDrop);
      reset();
    };
  }, [accept, disabled]);

  return (
    <>
      {children}
      {isMounted &&
        createPortal(
          <div
            role="status"
            aria-live="polite"
            aria-hidden={!isDragging}
            data-slot="file-drop-backdrop"
            data-state={isDragging ? 'open' : 'closed'}
            className="pointer-events-none fixed inset-0 z-50 animate-in bg-background/80 backdrop-blur-md fade-in-0 [--tw-animation-duration:var(--duration-normal)] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:fill-mode-forwards"
          >
            <EmptyState variant="fill" iconSlot={<CloudUploadIcon />} titleSlot={label} descriptionSlot={description} />
          </div>,
          document.body,
        )}
    </>
  );
}
