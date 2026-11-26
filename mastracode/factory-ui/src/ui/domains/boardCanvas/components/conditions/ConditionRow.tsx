import type { FilterBarField } from '@mastra/playground-ui/components/FilterBar';
import { Button } from '@mastra/playground-ui/components/Button';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@mastra/playground-ui/components/Select';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { CircleDotIcon } from '@mastra/playground-ui/icons/CircleDotIcon';
import { TrashIcon } from '@mastra/playground-ui/icons/TrashIcon';
import { IconPlusMedium } from '@mastra/playground-ui/icons/central/IconPlusMedium';

import { BooleanValue, FIELD_ICONS, PresenceValue, ValueControl, operatorLabel } from './conditionControls';
import { isPresenceField, legacyConditionFields } from '../../../settings/components/conditionFields';
import { VALUELESS, valueFor } from '../../../settings/components/conditionTree';
import type { Row } from '../../../settings/components/conditionTree';
import { narrowSuggestions } from '../../../settings/components/sourceSuggestions';
import { summarize, valueInline } from './cellModel';
import { ValueChip } from './flowParts';

const LEGACY_FIELDS = legacyConditionFields();

function FieldIcon({ id }: { id: string }) {
  const Icon = FIELD_ICONS[id] ?? CircleDotIcon;
  return <Icon aria-hidden="true" className="text-muted-foreground size-icon-xs shrink-0" />;
}

/** The fields a row can pick, with a stored field the picker no longer offers kept so it can be changed away from. */
function rowFields(row: Row, fields: FilterBarField[], limits: Row[]) {
  const legacy = LEGACY_FIELDS.find(candidate => candidate.id === row.field);
  const shown = legacy && !fields.some(candidate => candidate.id === legacy.id) ? [legacy, ...fields] : fields;
  const listed = shown.find(candidate => candidate.id === row.field);
  return { shown, field: listed && narrowSuggestions(listed, limits) };
}

/** A condition as one sentence, for its cell's accessible name: "Labels has bug, documentation". */
export function rowText(row: Row, fields: FilterBarField[]): string {
  const { field } = rowFields(row, fields, []);
  const { operator, values } = summarize(row, field);
  return [field?.label ?? (row.field || 'Choose a field'), operator, values.join(', ')].filter(Boolean).join(' ');
}

/** A condition read at a glance: its field on the left, the test on the right, the values as chips. */
export function RowSummary({ row, fields }: { row: Row; fields: FilterBarField[] }) {
  const { field } = rowFields(row, fields, []);
  const label = field?.label ?? (row.field || 'Choose a field');
  const { operator, values } = summarize(row, field);
  const inline = valueInline(label, operator, values);

  return (
    <span className="flex min-w-0 flex-col gap-1.5">
      <span className="text-body-sm flex min-w-0 items-center gap-2">
        {row.field && <FieldIcon id={row.field} />}
        <span className="text-muted-foreground min-w-0 flex-1 truncate">{label}</span>
        {operator && <span className="text-muted-foreground shrink-0">{operator}</span>}
        {inline && <ValueChip>{values[0]}</ValueChip>}
      </span>
      {!inline && values.length > 0 && (
        <span className="flex flex-wrap gap-1.5">
          {values.map(value => (
            <ValueChip key={value}>{value}</ValueChip>
          ))}
        </span>
      )}
    </span>
  );
}

/** A condition being changed in its cell: field, test and value, with a way to remove it or add an alternative. */
export function RowEditor({
  row,
  fields,
  limits,
  onChange,
  onRemove,
  onAlternative,
}: {
  row: Row;
  fields: FilterBarField[];
  /** The other conditions a card must meet with this one, which can narrow its suggestions. */
  limits: Row[];
  onChange: (row: Row) => void;
  onRemove: () => void;
  onAlternative: () => void;
}) {
  const { shown, field } = rowFields(row, fields, limits);
  // A stored comparison on a presence field (say, a pull request number) keeps its regular controls.
  const presence =
    !!field &&
    isPresenceField(field.id) &&
    (!row.operator || row.operator === 'exists' || row.operator === 'not_exists');

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex min-w-0 items-center gap-1">
        <Select
          value={row.field || null}
          onValueChange={id => {
            const next = shown.find(candidate => candidate.id === id);
            if (!next || next.id === row.field) return;
            const operator = next.operators?.[0] ?? 'equals';
            onChange({ ...row, field: next.id, operator, value: valueFor(next, operator, undefined) });
          }}
        >
          <SelectTrigger size="sm" variant="ghost" aria-label="Field" className="max-w-full min-w-0">
            <span className="flex min-w-0 items-center gap-1.5">
              {field && <FieldIcon id={field.id} />}
              <Txt as="span" variant="body-sm" tone={row.field ? undefined : 'muted'} className="truncate">
                {field?.label ?? (row.field || 'Choose a field')}
              </Txt>
            </span>
          </SelectTrigger>
          <SelectContent>
            {shown.map(candidate => (
              <SelectItem key={candidate.id} value={candidate.id}>
                <span className="flex items-center gap-2">
                  <FieldIcon id={candidate.id} />
                  {candidate.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Remove condition"
          tooltip="Remove condition"
          className="ml-auto shrink-0"
          onClick={onRemove}
        >
          <TrashIcon />
        </Button>
      </div>

      {field && (
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {field.type === 'boolean' && <BooleanValue row={row} field={field} onChange={onChange} />}
          {presence && <PresenceValue row={row} field={field} onChange={onChange} />}
          {field.type !== 'boolean' && !presence && (
            <>
              <Select
                value={row.operator}
                onValueChange={operator =>
                  operator &&
                  operator !== row.operator &&
                  onChange({ ...row, operator, value: valueFor(field, operator, row.value) })
                }
              >
                <SelectTrigger size="sm" variant="ghost" aria-label="Operator" className="w-fit">
                  <Txt as="span" variant="body-sm">
                    {operatorLabel(field, row.operator)}
                  </Txt>
                </SelectTrigger>
                <SelectContent>
                  {(field.operators ?? []).map(operator => (
                    <SelectItem key={operator} value={operator}>
                      {operatorLabel(field, operator)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!VALUELESS.has(row.operator) && <ValueControl row={row} field={field} onChange={onChange} />}
            </>
          )}
        </div>
      )}

      {row.field && (
        <Button variant="ghost" size="sm" className="self-start" icon={<IconPlusMedium />} onClick={onAlternative}>
          Or
        </Button>
      )}
    </div>
  );
}
