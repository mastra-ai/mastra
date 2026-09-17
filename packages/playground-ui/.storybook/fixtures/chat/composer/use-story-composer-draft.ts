import { useEffect, useRef, useState, type KeyboardEvent, type FormEvent, type ChangeEvent } from 'react';
import type { ChatFile } from '../data';

export interface DraftFile {
  id: string;
  filename: string;
  part?: ChatFile;
  error?: string;
}

export function useStoryComposerDraft({
  disabled,
  onSend,
}: {
  disabled: boolean;
  onSend: (text: string, files: ChatFile[]) => void;
}) {
  const [text, setText] = useState('');
  const [files, setFiles] = useState<DraftFile[]>([]);
  const [sentCount, setSentCount] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const messageInput = useRef<HTMLTextAreaElement>(null);
  const readers = useRef(new Map<string, FileReader>());
  const reading = files.some(file => !file.part && !file.error);
  const readyFiles = files.flatMap(file => (file.part ? [file.part] : []));
  const hasContent = text.trim().length > 0 || readyFiles.length > 0;
  const attachmentsReady = files.every(file => file.part);
  const canSend = !disabled && attachmentsReady && hasContent;

  useEffect(() => {
    const pending = readers.current;
    return () => {
      pending.forEach(reader => reader.abort());
      pending.clear();
    };
  }, []);

  function addFiles(selected: FileList | null) {
    for (const file of Array.from(selected ?? [])) {
      const id = crypto.randomUUID();
      const reader = new FileReader();
      readers.current.set(id, reader);
      setFiles(current => [...current, { id, filename: file.name }]);
      reader.onload = () => {
        readers.current.delete(id);
        const data = reader.result;
        if (typeof data !== 'string') return;
        const part: ChatFile = {
          type: 'file',
          filename: file.name,
          mimeType: file.type || 'application/octet-stream',
          data,
        };
        setFiles(current => current.map(item => (item.id === id ? { ...item, part } : item)));
      };
      reader.onerror = () => {
        readers.current.delete(id);
        setFiles(current =>
          current.map(item =>
            item.id === id ? { ...item, error: 'Could not read this file. Remove it and try again.' } : item,
          ),
        );
      };
      reader.readAsDataURL(file);
    }
  }

  function removeFile(id: string) {
    readers.current.get(id)?.abort();
    readers.current.delete(id);
    setFiles(current => current.filter(file => file.id !== id));
  }

  function submitMessage(message = text) {
    if (!canSend) return;
    onSend(message, readyFiles);
    setText('');
    setFiles([]);
    setSentCount(current => current + 1);
    messageInput.current?.focus();
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.defaultPrevented) return;
    const composing = event.nativeEvent.isComposing || event.keyCode === 229;
    const shouldSend = event.key === 'Enter' && !event.shiftKey && !composing;
    if (shouldSend) {
      event.preventDefault();
      submitMessage();
    }
  }

  return {
    text,
    setText,
    files,
    reading,
    canSend,
    sentCount,
    addFiles,
    removeFile,
    fileInput,
    messageInput,
    submitMessage,
    onSubmit: (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      submitMessage();
    },
    inputProps: {
      value: text,
      onChange: (event: ChangeEvent<HTMLTextAreaElement>) => setText(event.target.value),
      onKeyDown: handleComposerKeyDown,
      ref: messageInput,
    },
  };
}
