import { Button } from '@mastra/playground-ui/components/Button';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@mastra/playground-ui/components/Select';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useState } from 'react';

import type { IntakeSourceBinding } from '../../../factory/services/intake';
import { LabelEditor } from './LabelEditor';
import { RoutingNote } from './RoutingNote';
import { routingGap } from './routing';
import { capitalized, useRoutingTerms } from './terms';
import { IconCrossMedium } from '@mastra/playground-ui/icons/central/IconCrossMedium';

const ALL_ITEMS = 'all';
const LABELLED = 'labelled';

/** One factory a source feeds: which of its items it takes, and removing it. */
export function BindingRow({
  source,
  factory,
  binding,
  othersTakeLabels,
  error,
  onLabelsChange,
  onTakeAllIssues,
  onRemove,
}: {
  source: string;
  factory: string;
  binding: IntakeSourceBinding;
  othersTakeLabels: boolean;
  error?: string;
  onLabelsChange: (labels: string[]) => void;
  onTakeAllIssues: () => void;
  onRemove: () => void;
}) {
  const terms = useRoutingTerms();
  const labels = binding.labels ?? [];
  // Picking "Only issues labelled…" saves nothing until the first label: an empty filter is not a binding.
  const [picked, setPicked] = useState(labels.length > 0);
  const labelled = picked || labels.length > 0;
  const allItemsText = othersTakeLabels ? `All other ${terms.items}` : `All ${terms.items}`;
  const labelledText = `Only ${terms.items} labelled…`;

  const pickFilter = (value: string) => {
    if (value === LABELLED) {
      setPicked(true);
      return;
    }
    setPicked(false);
    if (labels.length > 0) onTakeAllIssues();
  };

  return (
    <li className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <Txt as="span" variant="caption" className="min-w-24 wrap-anywhere">
          {factory}
        </Txt>
        <Select value={labelled ? LABELLED : ALL_ITEMS} onValueChange={pickFilter}>
          <SelectTrigger
            size="sm"
            aria-label={`${capitalized(terms.items)} from ${source} for ${factory}`}
            className="w-auto max-w-full min-w-0"
          >
            <Txt as="span" variant="caption">
              {labelled ? labelledText : allItemsText}
            </Txt>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_ITEMS}>{allItemsText}</SelectItem>
            <SelectItem value={LABELLED}>{labelledText}</SelectItem>
          </SelectContent>
        </Select>
        <Button
          size="icon-sm"
          variant="ghost"
          tooltip={`Remove ${factory}`}
          aria-label={`Remove ${factory} from ${source}`}
          onClick={onRemove}
          className="ml-auto"
        >
          <IconCrossMedium />
        </Button>
      </div>
      {labelled && <LabelEditor factory={factory} labels={labels} onChange={onLabelsChange} />}
      <RoutingNote error={error} hint={routingGap({ labelled, labels }, terms)} />
    </li>
  );
}
