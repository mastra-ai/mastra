import { Button } from '@mastra/playground-ui/components/Button';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@mastra/playground-ui/components/Select';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { X } from 'lucide-react';
import { useState } from 'react';

import type { IntakeSourceBinding } from '../../../factory/services/intake';
import { BoardPicker } from '../IntakeSourceRouting';
import { JiraLabelEditor } from './JiraLabelEditor';
import { RoutingNote } from './RoutingNote';
import { routingGap } from './routing';

const ALL_ISSUES = 'all';
const LABELLED = 'labelled';
const LABELLED_TEXT = 'Only issues labelled…';

/** One factory a Jira project feeds: its board, which issues it takes, and removing it. */
export function JiraBindingRow({
  project,
  factory,
  binding,
  othersTakeLabels,
  error,
  saving,
  onBoardChange,
  onLabelsChange,
  onTakeAllIssues,
  onRemove,
}: {
  project: string;
  factory: string;
  binding: IntakeSourceBinding;
  othersTakeLabels: boolean;
  error?: string;
  saving: boolean;
  onBoardChange: (board: string | null) => void;
  onLabelsChange: (labels: string[]) => void;
  onTakeAllIssues: () => void;
  onRemove: () => void;
}) {
  const labels = binding.labels ?? [];
  // Picking "Only issues labelled…" saves nothing until the first label: an empty filter is not a binding.
  const [picked, setPicked] = useState(labels.length > 0);
  const labelled = picked || labels.length > 0;
  const allIssuesText = othersTakeLabels ? 'All other issues' : 'All issues';

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
        <BoardPicker
          name={`${project} in ${factory}`}
          factoryProjectId={binding.factoryProjectId}
          board={binding.board}
          disabled={saving}
          onChange={onBoardChange}
        />
        <Select value={labelled ? LABELLED : ALL_ISSUES} disabled={saving} onValueChange={pickFilter}>
          <SelectTrigger
            size="sm"
            aria-label={`Issues from ${project} for ${factory}`}
            className="w-auto max-w-full min-w-0"
          >
            <Txt as="span" variant="caption">
              {labelled ? LABELLED_TEXT : allIssuesText}
            </Txt>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_ISSUES}>{allIssuesText}</SelectItem>
            <SelectItem value={LABELLED}>{LABELLED_TEXT}</SelectItem>
          </SelectContent>
        </Select>
        <Button
          size="icon-sm"
          variant="ghost"
          tooltip={`Remove ${factory}`}
          aria-label={`Remove ${factory} from ${project}`}
          disabled={saving}
          onClick={onRemove}
          className="ml-auto"
        >
          <X />
        </Button>
      </div>
      {labelled && <JiraLabelEditor factory={factory} labels={labels} saving={saving} onChange={onLabelsChange} />}
      <RoutingNote error={error} hint={routingGap({ board: binding.board, labelled, labels })} />
    </li>
  );
}
