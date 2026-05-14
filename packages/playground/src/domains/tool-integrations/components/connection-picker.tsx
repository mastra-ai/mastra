import { Button, Input, Txt, cn } from '@mastra/playground-ui';
import { Trash2, Plus, RefreshCw, AlertCircle } from 'lucide-react';
import { useMemo } from 'react';

import { useAuthorize } from '../hooks/use-authorize';

/**
 * A single saved connection (provider-agnostic). Mirrors the shape that
 * Phase 7 persists to `toolIntegrations[providerId].connections[]`.
 */
export interface PickerConnection {
  connectionId: string;
  toolService: string;
  label: string;
}

export interface ConnectionPickerProps {
  integrationId: string;
  toolService: string;
  /** From `useToolIntegrations()[i].capabilities`. */
  multipleAllowed: boolean;
  /** Controlled value. */
  connections: PickerConnection[];
  /** Controlled change. */
  onChange: (next: PickerConnection[]) => void;
  /** Disable inputs while parent form is busy. */
  disabled?: boolean;
}

const LABEL_RE = /^[A-Za-z0-9 _-]+$/;
const MAX_LABEL = 32;

interface LabelError {
  index: number;
  message: string;
}

const validateLabels = (connections: PickerConnection[]): LabelError[] => {
  const errors: LabelError[] = [];
  const seen = new Map<string, number>();

  connections.forEach((conn, index) => {
    const raw = conn.label ?? '';
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      errors.push({ index, message: 'Label is required' });
      return;
    }
    if (trimmed.length > MAX_LABEL) {
      errors.push({ index, message: `Label must be ≤${MAX_LABEL} characters` });
      return;
    }
    if (!LABEL_RE.test(trimmed)) {
      errors.push({ index, message: 'Use letters, numbers, spaces, _ or -' });
      return;
    }
    const key = trimmed.toLowerCase();
    const priorIndex = seen.get(key);
    if (priorIndex !== undefined) {
      errors.push({ index, message: 'Duplicate label' });
    } else {
      seen.set(key, index);
    }
  });

  return errors;
};

export const ConnectionPicker = ({
  integrationId,
  toolService,
  multipleAllowed,
  connections,
  onChange,
  disabled,
}: ConnectionPickerProps) => {
  const authorize = useAuthorize();

  const errorsByIndex = useMemo(() => {
    const map = new Map<number, string>();
    for (const err of validateLabels(connections)) {
      if (!map.has(err.index)) map.set(err.index, err.message);
    }
    return map;
  }, [connections]);

  const handleAdd = async () => {
    const result = await authorize.mutateAsync({ integrationId, toolService });
    if (result.status !== 'completed') return;
    onChange([...connections, { connectionId: result.connectionId, toolService, label: '' }]);
  };

  const handleReauthorize = async (index: number) => {
    const existing = connections[index];
    if (!existing) return;
    const result = await authorize.mutateAsync({
      integrationId,
      toolService,
      connectionId: existing.connectionId,
    });
    if (result.status !== 'completed') return;
    const next = [...connections];
    next[index] = { ...existing, connectionId: result.connectionId };
    onChange(next);
  };

  const handleRemove = (index: number) => {
    onChange(connections.filter((_, i) => i !== index));
  };

  const handleLabelChange = (index: number, label: string) => {
    const next = [...connections];
    const current = next[index];
    if (!current) return;
    next[index] = { ...current, label };
    onChange(next);
  };

  const canAddMore = multipleAllowed || connections.length === 0;
  const showAddButton = multipleAllowed;

  return (
    <div className="flex flex-col gap-2" data-testid={`connection-picker-${toolService}`}>
      {connections.length === 0 ? (
        <div
          className="flex items-center gap-2 rounded-md border border-dashed border-warning/40 bg-warning/5 px-3 py-2"
          data-testid={`connection-picker-${toolService}-empty`}
        >
          <AlertCircle className="size-4 shrink-0 text-warning" />
          <Txt as="span" variant="ui-sm" className="text-warning">
            No connections yet — add one to enable these tools.
          </Txt>
          {canAddMore && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleAdd}
              disabled={disabled || authorize.isPending}
              className="ml-auto"
            >
              <Plus className="size-3" />
              Connect
            </Button>
          )}
        </div>
      ) : (
        connections.map((conn, index) => {
          const error = errorsByIndex.get(index);
          return (
            <div
              key={conn.connectionId}
              className="flex items-center gap-2"
              data-testid={`connection-row-${toolService}-${index}`}
            >
              <div className="flex-1">
                <Input
                  size="sm"
                  value={conn.label}
                  placeholder={multipleAllowed ? 'Label (e.g. Work, Personal)' : 'Label'}
                  onChange={e => handleLabelChange(index, e.target.value)}
                  disabled={disabled}
                  error={Boolean(error)}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? `connection-row-${toolService}-${index}-error` : undefined}
                  data-testid={`connection-label-${toolService}-${index}`}
                />
                {error && (
                  <p id={`connection-row-${toolService}-${index}-error`} className="text-error text-ui-xs mt-1 block">
                    {error}
                  </p>
                )}
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleReauthorize(index)}
                disabled={disabled || authorize.isPending}
                aria-label="Reauthorize"
                data-testid={`connection-reauthorize-${toolService}-${index}`}
              >
                <RefreshCw className="size-3" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleRemove(index)}
                disabled={disabled}
                aria-label="Remove connection"
                data-testid={`connection-remove-${toolService}-${index}`}
              >
                <Trash2 className="size-3" />
              </Button>
            </div>
          );
        })
      )}

      {showAddButton && connections.length > 0 && (
        <Button
          size="sm"
          variant="ghost"
          onClick={handleAdd}
          disabled={disabled || authorize.isPending}
          className={cn('self-start')}
          data-testid={`connection-add-${toolService}`}
        >
          <Plus className="size-3" />
          Add connection
        </Button>
      )}
    </div>
  );
};
