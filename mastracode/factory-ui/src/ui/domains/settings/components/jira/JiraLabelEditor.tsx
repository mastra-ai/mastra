import { Badge } from '@mastra/playground-ui/components/Badge';
import { Input } from '@mastra/playground-ui/components/Input';
import { X } from 'lucide-react';
import { useState } from 'react';

import { RoutingNote } from './RoutingNote';
import { newLabels, parseLabels } from './routing';

/** A labelled factory's labels as chips, plus a field adding more. */
export function JiraLabelEditor({
  factory,
  labels,
  saving,
  onChange,
}: {
  factory: string;
  labels: string[];
  saving: boolean;
  onChange: (labels: string[]) => void;
}) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string>();

  const commitDraft = () => {
    if (saving) return;
    const parsed = parseLabels(draft);
    if ('error' in parsed) {
      setError(parsed.error);
      return;
    }
    setDraft('');
    const added = newLabels(labels, parsed.labels);
    if (added.length > 0) onChange([...labels, ...added]);
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-1">
        {labels.map(label => (
          <Badge key={label} size="sm" variant="neutral">
            <span className="flex items-center gap-1">
              {label}
              <button
                type="button"
                aria-label={`Remove label ${label}`}
                disabled={saving || labels.length === 1}
                onClick={() => onChange(labels.filter(existing => existing !== label))}
                className="disabled:opacity-40"
              >
                <X className="size-3" aria-hidden />
              </button>
            </span>
          </Badge>
        ))}
        <Input
          size="sm"
          aria-label={`Add label for ${factory}`}
          aria-invalid={error ? true : undefined}
          placeholder="Add label"
          value={draft}
          onChange={event => {
            setDraft(event.target.value);
            setError(undefined);
          }}
          onKeyDown={event => {
            if (saving || event.nativeEvent.isComposing) return;
            if (event.key !== 'Enter' && event.key !== ',') return;
            event.preventDefault();
            commitDraft();
          }}
          onBlur={commitDraft}
          className="w-28"
        />
      </div>
      <RoutingNote error={error} />
    </div>
  );
}
