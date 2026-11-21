import { Button } from '@mastra/playground-ui/components/Button';
import { Input } from '@mastra/playground-ui/components/Input';
import { useState } from 'react';

import { RoutingNote } from './RoutingNote';
import { parseLabels } from './routing';
import type { Factory } from './routing';
import { useRoutingTerms } from './terms';
import { IconPlusMedium } from '@mastra/playground-ui/icons/central/IconPlusMedium';

/** `labels` empty: the factory takes all items. */
export type NewRoute = { factoryProjectId: string; labels: string[] };

/** The labels a factory starts with; none means it takes all items. */
export function NewFactoryFields({
  factory,
  anotherTakesAll,
  error,
  adding,
  onAdd,
}: {
  factory: Factory;
  anotherTakesAll: boolean;
  error?: string;
  adding: boolean;
  onAdd: (route: NewRoute) => void;
}) {
  const terms = useRoutingTerms();
  const [labelsText, setLabelsText] = useState('');
  const [submitted, setSubmitted] = useState<string>();
  const parsed = parseLabels(labelsText, terms);
  const labelsError = 'error' in parsed ? parsed.error : undefined;
  const labels = 'labels' in parsed ? parsed.labels : [];
  const labelsReady = labelsError === undefined && (labels.length > 0 || !anotherTakesAll);
  const attempt = labelsText;
  const refusal = submitted === attempt ? error : undefined;
  const hint = anotherTakesAll
    ? `Another factory takes all ${terms.items}, so name the labels this factory should take.`
    : `Leave labels empty to take all ${terms.items}.`;

  const add = () => {
    setSubmitted(attempt);
    onAdd({ factoryProjectId: factory.id, labels });
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          size="sm"
          aria-label={`Labels for ${factory.name}`}
          aria-invalid={labelsError ? true : undefined}
          placeholder="Labels, e.g. payments, billing"
          value={labelsText}
          onChange={event => setLabelsText(event.target.value)}
          disabled={adding}
          className="w-56 max-w-full"
        />
        <Button size="sm" icon={<IconPlusMedium />} disabled={adding || !labelsReady} onClick={add}>
          {adding ? 'Adding…' : 'Add'}
        </Button>
      </div>
      <RoutingNote error={labelsError ?? refusal} hint={hint} />
    </div>
  );
}
