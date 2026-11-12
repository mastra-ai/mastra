import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';

import { INTAKE_SOURCE_LABELS, INTAKE_SOURCES } from './intakeMap';
import type { IntakeSource } from './intakeMap';
import { SourceIcon } from './SourceIcon';

/** The event that sends cards down the routes, and the sources those cards come from; picking one traces it. */
export function ArrivalLane({
  label,
  selected,
  onSelect,
}: {
  label: string;
  selected: IntakeSource | undefined;
  onSelect: (source: IntakeSource) => void;
}) {
  return (
    <section aria-label={label} className="flex flex-col gap-2">
      <Txt as="h3" variant="label">
        {label} from
      </Txt>
      <ul aria-label="Sources" className="flex flex-wrap gap-1">
        {INTAKE_SOURCES.map(source => (
          <li key={source}>
            <Button
              size="sm"
              variant={selected === source ? 'subtle' : 'ghost'}
              aria-pressed={selected === source}
              icon={<SourceIcon source={source} />}
              onClick={() => onSelect(source)}
            >
              {INTAKE_SOURCE_LABELS[source]}
            </Button>
          </li>
        ))}
      </ul>
      <Txt as="p" variant="meta" tone="muted">
        Pick a source to trace the routes its cards can take. Each card takes the first route that matches.
      </Txt>
    </section>
  );
}
