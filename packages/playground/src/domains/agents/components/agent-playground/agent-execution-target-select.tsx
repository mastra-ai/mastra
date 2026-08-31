import type { AgentVersionLabel, ListAgentVersionsResponse } from '@mastra/client-js';
import { Label } from '@mastra/playground-ui/components/Label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@mastra/playground-ui/components/Select';
import { Txt } from '@mastra/playground-ui/components/Txt';

import {
  buildAgentExecutionTargetGroups,
  decodeAgentExecutionTarget,
  encodeAgentExecutionTarget,
} from './agent-execution-target';
import type { AgentExecutionTarget } from './agent-execution-target';

interface AgentExecutionTargetSelectProps {
  target: AgentExecutionTarget;
  labels: AgentVersionLabel[];
  versions: ListAgentVersionsResponse['versions'];
  isAvailable: boolean;
  isLoading?: boolean;
  onTargetChange: (target: AgentExecutionTarget) => void;
}

const GROUP_LABEL_CLASS = 'px-2 pt-2 pb-1 text-ui-xs font-medium text-neutral2';

export function AgentExecutionTargetSelect({
  target,
  labels,
  versions,
  isAvailable,
  isLoading = false,
  onTargetChange,
}: AgentExecutionTargetSelectProps) {
  const groups = buildAgentExecutionTargetGroups(labels, versions);
  const selectedValue = encodeAgentExecutionTarget(target);
  let selectItems = [...groups.labels, ...groups.versions].map(option => ({
    value: option.value,
    label: option.label,
  }));
  const knownSelectedItem = selectItems.find(item => item.value === selectedValue);
  const unavailableLabel =
    knownSelectedItem?.label ?? (target.kind === 'label' ? target.label : `Exact version ${target.versionId}`);
  if (!isAvailable) {
    selectItems = [
      ...selectItems.filter(item => item.value !== selectedValue),
      {
        value: selectedValue,
        label: `${unavailableLabel} · unavailable`,
      },
    ];
  }
  const errorId = 'agent-execution-target-error';

  const handleValueChange = (value: string) => {
    const nextTarget = decodeAgentExecutionTarget(value);
    if (nextTarget) onTargetChange(nextTarget);
  };

  return (
    <div className="flex min-w-48 flex-col gap-1">
      <Label htmlFor="agent-execution-target" className="sr-only">
        Run target
      </Label>
      <Select items={selectItems} value={selectedValue} onValueChange={handleValueChange} disabled={isLoading}>
        <SelectTrigger
          id="agent-execution-target"
          size="sm"
          aria-invalid={!isAvailable}
          aria-describedby={isAvailable ? undefined : errorId}
          className="max-w-64"
        >
          <SelectValue placeholder={isLoading ? 'Loading run targets…' : 'Choose run target'} />
        </SelectTrigger>
        <SelectContent>
          {!isAvailable ? (
            <SelectGroup aria-label="Unavailable run target">
              <div className={GROUP_LABEL_CLASS}>Unavailable run target</div>
              <SelectItem value={selectedValue} disabled>
                {unavailableLabel} · unavailable
              </SelectItem>
            </SelectGroup>
          ) : null}
          {groups.labels.length > 0 ? (
            <SelectGroup aria-label="Release labels">
              <div className={GROUP_LABEL_CLASS}>Release labels</div>
              {groups.labels
                .filter(option => isAvailable || option.value !== selectedValue)
                .map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
            </SelectGroup>
          ) : null}
          <SelectGroup aria-label="Exact versions">
            <div className={GROUP_LABEL_CLASS}>Exact versions</div>
            {groups.versions
              .filter(option => isAvailable || option.value !== selectedValue)
              .map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      {!isAvailable ? (
        <Txt id={errorId} role="status" variant="ui-xs" className="text-error">
          This run target is no longer available. Choose another target before running.
        </Txt>
      ) : null}
    </div>
  );
}
