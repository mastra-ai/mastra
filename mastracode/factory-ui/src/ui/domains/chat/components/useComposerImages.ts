import { useRef, useState } from 'react';
import type { ChangeEvent, ClipboardEvent, DragEvent } from 'react';

import { useChatTranscript } from '../context/useChatTranscript';

export interface PendingImage {
  id: string;
  data: string;
  mediaType: string;
  filename?: string;
}

let pendingImageSequence = 0;

// base64 inflates ~33% and attachments travel in a JSON POST body
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_IMAGE_BYTES = 20 * 1024 * 1024;

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export function useComposerImages(onUserDraft: boolean) {
  const { pushNotice } = useChatTranscript();
  const [images, setImages] = useState<PendingImage[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addImageFiles = async (fileList: Iterable<File>) => {
    if (onUserDraft) {
      pushNotice('Images can be attached once the session is ready.');
      return;
    }
    const imageFiles = Array.from(fileList).filter(
      file => file.type.startsWith('image/') && file.size <= MAX_IMAGE_BYTES,
    );
    if (imageFiles.length === 0) return;

    let budget = MAX_TOTAL_IMAGE_BYTES - images.reduce((sum, image) => sum + Math.floor(image.data.length * 0.75), 0);
    const accepted = imageFiles.filter(file => {
      if (file.size > budget) return false;
      budget -= file.size;
      return true;
    });
    if (accepted.length === 0) return;

    const additions = await Promise.all(
      accepted.map(
        async (file): Promise<PendingImage> => ({
          id: `pending-image-${pendingImageSequence++}`,
          data: await readFileAsBase64(file),
          mediaType: file.type,
          filename: file.name || undefined,
        }),
      ),
    );
    setImages(current => [...current, ...additions]);
  };

  const removeImage = (id: string) => {
    setImages(current => current.filter(image => image.id !== id));
  };

  const onPaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(event.clipboardData?.files ?? []).filter(file => file.type.startsWith('image/'));
    if (files.length === 0) return;
    event.preventDefault();
    void addImageFiles(files);
  };

  const onDrop = (event: DragEvent<HTMLFormElement>) => {
    event.preventDefault();
    const files = Array.from(event.dataTransfer?.files ?? []).filter(file => file.type.startsWith('image/'));
    if (files.length === 0) return;
    void addImageFiles(files);
  };

  const onFileInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    void addImageFiles(event.target.files ?? []);
    event.target.value = '';
  };

  return { images, setImages, fileInputRef, removeImage, onPaste, onDrop, onFileInputChange };
}
