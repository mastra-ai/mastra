import { Button } from '@mastra/playground-ui/components/Button';
import { Input } from '@mastra/playground-ui/components/Input';
import { Plus } from 'lucide-react';
import { useState } from 'react';

import { BoardPicker } from '../IntakeSourceRouting';
import { RoutingNote } from './RoutingNote';
import { parseLabels } from './routing';
import type { Factory } from './routing';

/** `labels` empty: the factory takes all issues. */
export type NewJiraRoute = { factoryProjectId: string; board: string; labels: string[] };

/** The board and labels a factory starts with; Add waits for a board so the factory picks up issues at once. */
export function NewJiraFactoryFields({
  project,
  factory,
  anotherTakesAll,
  error,
  saving,
  onAdd,
}: {
  project: string;
  factory: Factory;
  anotherTakesAll: boolean;
  error?: string;
  saving: boolean;
  onAdd: (route: NewJiraRoute) => void;
}) {
  const [board, setBoard] = useState<string>();
  const [labelsText, setLabelsText] = useState('');
  const [submitted, setSubmitted] = useState<string>();
  const parsed = parseLabels(labelsText);
  const labelsError = 'error' in parsed ? parsed.error : undefined;
  const labels = 'labels' in parsed ? parsed.labels : [];
  const labelsReady = labelsError === undefined && (labels.length > 0 || !anotherTakesAll);
  const attempt = `${board ?? ''}\n${labelsText}`;
  const refusal = submitted === attempt ? error : undefined;
  const hint = anotherTakesAll
    ? 'Another factory takes all issues, so name the labels this factory should take.'
    : 'Leave labels empty to take all issues.';

  const add = () => {
    if (board === undefined) return;
    setSubmitted(attempt);
    onAdd({ factoryProjectId: factory.id, board, labels });
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <BoardPicker
          name={`${project} in ${factory.name}`}
          factoryProjectId={factory.id}
          board={board ?? null}
          disabled={saving}
          onChange={next => setBoard(next ?? undefined)}
        />
        <Input
          size="sm"
          aria-label={`Labels for ${factory.name}`}
          aria-invalid={labelsError ? true : undefined}
          placeholder="Labels, e.g. payments, billing"
          value={labelsText}
          onChange={event => setLabelsText(event.target.value)}
          className="w-56 max-w-full"
        />
        <Button size="sm" icon={<Plus />} disabled={saving || board === undefined || !labelsReady} onClick={add}>
          Add
        </Button>
      </div>
      <RoutingNote error={labelsError ?? refusal} hint={hint} />
    </div>
  );
}
