import { toast } from '@mastra/playground-ui';
import { useEffect, useRef } from 'react';
import { useDebouncedCallback } from 'use-debounce';

import { useUpdateConnection } from '../hooks/use-update-connection';

const LABEL_SAVE_DEBOUNCE_MS = 400;

const normalizeLabel = (label: string) => {
  const trimmed = label.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const useDebouncedConnectionRename = ({
  providerId,
  connectionId,
  initialLabel,
}: {
  providerId: string;
  connectionId: string;
  initialLabel: string;
}) => {
  const updateConnection = useUpdateConnection();
  const savedLabelRef = useRef(normalizeLabel(initialLabel));

  const debouncedRename = useDebouncedCallback((label: string | null) => {
    if (label === savedLabelRef.current) return;
    updateConnection.mutate(
      { providerId, connectionId, label },
      {
        onSuccess: () => {
          savedLabelRef.current = label;
          toast.success('Connection renamed');
        },
      },
    );
  }, LABEL_SAVE_DEBOUNCE_MS);

  useEffect(() => {
    return () => {
      debouncedRename.flush();
    };
  }, [debouncedRename]);

  const scheduleRename = (nextLabel: string) => {
    const normalized = normalizeLabel(nextLabel);
    if (normalized === savedLabelRef.current) {
      debouncedRename.cancel();
      return;
    }
    debouncedRename(normalized);
  };

  return { scheduleRename, isPending: updateConnection.isPending, error: updateConnection.error };
};
