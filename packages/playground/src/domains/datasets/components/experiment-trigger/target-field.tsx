import {
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
  ComboboxRoot,
  ComboboxSeparator,
} from '@mastra/playground-ui/components/Combobox';
import { Field, FieldLabel } from '@mastra/playground-ui/components/Field';
import { sameValue } from './experiment-trigger-options';
import type { FieldPopupContainer, TargetOption } from './experiment-trigger-options';

const TARGET_GROUPS: { type: TargetOption['type']; label: string }[] = [
  { type: 'agent', label: 'Agents' },
  { type: 'workflow', label: 'Workflows' },
  { type: 'scorer', label: 'Scorers' },
];

type TargetGroup = { value: string; items: TargetOption[] };

/** The options grouped by kind, leaving out kinds with nothing to run. */
function groupTargets(options: TargetOption[]): TargetGroup[] {
  return TARGET_GROUPS.map(group => ({
    value: group.label,
    items: options.filter(option => option.type === group.type),
  })).filter(group => group.items.length > 0);
}

export interface TargetFieldProps {
  options: TargetOption[];
  isLoading: boolean;
  target?: TargetOption;
  onTargetValueChange: (targetValue: string) => void;
  container: FieldPopupContainer;
  className?: string;
}

export function TargetField({
  options,
  isLoading,
  target,
  onTargetValueChange,
  container,
  className,
}: TargetFieldProps) {
  return (
    <Field className={className}>
      <FieldLabel required info="What runs on each item: an agent, a workflow, or a scorer you want to test.">
        Target
      </FieldLabel>
      <ComboboxRoot
        items={groupTargets(options)}
        value={target ?? null}
        onValueChange={(next: TargetOption | null) => onTargetValueChange(next?.value ?? '')}
        isItemEqualToValue={sameValue}
        disabled={isLoading}
        autoHighlight
      >
        <ComboboxInput placeholder="Pick an agent, workflow or scorer" />
        <ComboboxContent container={container}>
          <ComboboxEmpty>Nothing to run</ComboboxEmpty>
          <ComboboxList>
            {(group: TargetGroup, index: number) => (
              <ComboboxGroup key={group.value} items={group.items}>
                {index > 0 ? <ComboboxSeparator /> : null}
                <ComboboxLabel>{group.value}</ComboboxLabel>
                <ComboboxCollection>
                  {(item: TargetOption) => (
                    <ComboboxItem key={item.value} value={item}>
                      {item.label}
                    </ComboboxItem>
                  )}
                </ComboboxCollection>
              </ComboboxGroup>
            )}
          </ComboboxList>
        </ComboboxContent>
      </ComboboxRoot>
    </Field>
  );
}
