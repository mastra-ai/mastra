import { useComposerRuntime } from '@assistant-ui/react';
import { useState, useEffect } from 'react';

export const useHasAttachments = () => {
  const composer = useComposerRuntime();
  const [hasAttachments, setHasAttachments] = useState(false);

  useEffect(() => {
    composer.subscribe(() => {
      const attachments = composer.getState().attachments;
      setHasAttachments(attachments.length > 0);
    });
  }, [composer]);

  return hasAttachments;
};
