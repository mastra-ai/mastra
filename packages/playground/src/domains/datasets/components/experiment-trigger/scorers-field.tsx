import {
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxList,
  ComboboxRoot,
  ComboboxValue,
} from '@mastra/playground-ui/components/Combobox';
import { Field, FieldDescription, FieldLabel } from '@mastra/playground-ui/components/Field';
import { sameValue } from './experiment-trigger-options';
import type { FieldPopupContainer, ScorerOption } from './experiment-trigger-options';
import { ScorerItem } from './scorer-item';
import { useScorerOptions } from './use-scorer-options';

/**
 * Every scorer that will be sent gets a chip, including ids the list doesn't offer (unregistered, or
 * still loading), so the field never hides what Run submits.
 */
function toPickedScorers(scorerIds: string[], options: ScorerOption[]): ScorerOption[] {
  return scorerIds.map(id => options.find(option => option.value === id) ?? { value: id, label: id });
}

export interface ScorersFieldProps {
  scorerIds: string[];
  usesDefaultScorers: boolean;
  onScorerIdsChange: (scorerIds: string[]) => void;
  container: FieldPopupContainer;
}

export function ScorersField({ scorerIds, usesDefaultScorers, onScorerIdsChange, container }: ScorersFieldProps) {
  const options = useScorerOptions();

  return (
    <Field>
      <FieldLabel info="Grade each output automatically. Outputs are saved either way, so you can always review them yourself.">
        Scorers
      </FieldLabel>
      <ComboboxRoot
        multiple
        items={options}
        value={toPickedScorers(scorerIds, options)}
        onValueChange={(next: ScorerOption[]) => onScorerIdsChange(next.map(option => option.value))}
        isItemEqualToValue={sameValue}
        autoHighlight
      >
        <ComboboxChips>
          <ComboboxValue>
            {(items: ScorerOption[]) => (
              <>
                {items.map(item => (
                  <ComboboxChip key={item.value}>{item.label}</ComboboxChip>
                ))}
                <ComboboxChipsInput
                  placeholder={items.length === 0 ? 'No scoring, read the outputs yourself' : undefined}
                />
              </>
            )}
          </ComboboxValue>
        </ComboboxChips>
        <ComboboxContent container={container}>
          <ComboboxEmpty>No scorers registered</ComboboxEmpty>
          <ComboboxList>{(item: ScorerOption) => <ScorerItem key={item.value} scorer={item} />}</ComboboxList>
        </ComboboxContent>
      </ComboboxRoot>
      {usesDefaultScorers && <FieldDescription>The dataset's default scorers.</FieldDescription>}
    </Field>
  );
}
