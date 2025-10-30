import { useAttachment } from '@assistant-ui/react';
import { useShallow } from 'zustand/shallow';
import { useFileSrc } from './use-file-src';

export const useAttachmentSrc = () => {
  const { file, src } = useAttachment(
    useShallow((a): { file?: File; src?: string } => {
      if (a.file) {
        const isURL = a.file.name.startsWith('https://');

        return isURL ? { src: a.file.name } : { file: a.file };
      }

      const src = a.content?.filter(c => c.type === 'image')[0]?.image;
      if (!src) return {};
      return { src };
    }),
  );

  return useFileSrc(file) ?? src;
};
