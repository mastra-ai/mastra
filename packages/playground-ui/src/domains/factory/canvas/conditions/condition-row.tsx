import { ValueChip } from '../flow-parts';
import { BooleanValue, PresenceValue, ValueControl } from './condition-value-control';
import type { ConditionRowData } from './condition-value-control';
import { FIELD_ICONS } from './field-icons';
import { Button } from '@/ds/components/Button';
import type { FilterBarField } from '@/ds/components/FilterBar';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/ds/components/Select';
import { Txt } from '@/ds/components/Txt';
import { IconPlusMedium } from '@/ds/icons/central/IconPlusMedium';
import { CircleDotIcon } from '@/ds/icons/CircleDotIcon';
import { TrashIcon } from '@/ds/icons/TrashIcon';

function FieldIcon({ id }: { id: string }) {
  const Icon = FIELD_ICONS[id] ?? CircleDotIcon;
  return <Icon aria-hidden="true" className="size-icon-xs shrink-0 text-muted-foreground" />;
}

/** One short value fits after the operator; several, or a long one, go on their own line. */
function valueInline(fieldLabel: string, operator: string, values: readonly string[]): boolean {
  const [only] = values;
  return values.length === 1 && only !== undefined && fieldLabel.length + operator.length + only.length <= 34;
}

export interface ConditionRowSummaryProps {
  row: ConditionRowData;
  /** The row's field, when the picker knows it. */
  field: FilterBarField | undefined;
  /** The test in words: "has", "is any of", or empty before one is picked. */
  operator: string;
  /** The values tested for, as they read: "bug", "Outside author". */
  values: string[];
}

/** A condition read at a glance: its field on the left, the test on the right, the values as chips. */
export function ConditionRowSummary({ row, field, operator, values }: ConditionRowSummaryProps) {
  const label = field?.label ?? (row.field || 'Choose a field');
  const inline = valueInline(label, operator, values);

  return (
    <span className="flex min-w-0 flex-col gap-1.5">
      <span className="flex min-w-0 items-center gap-2 text-body-sm">
        {row.field && <FieldIcon id={row.field} />}
        <span className="min-w-0 flex-1 truncate text-muted-foreground">{label}</span>
        {operator && <span className="shrink-0 text-muted-foreground">{operator}</span>}
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

export interface ConditionRowEditorProps {
  row: ConditionRowData;
  /** The fields the row can pick. */
  fields: FilterBarField[];
  /** The row's field, its suggestions narrowed by the other conditions a card must meet with this one. */
  field: FilterBarField | undefined;
  /** The field is only tested for being there, so it reads as a yes or no. */
  presence: boolean;
  /** The test takes no value ("is set"). */
  valueless: boolean;
  /** The test takes several values ("is any of"). */
  many: boolean;
  /** The test matches typed text ("contains"). */
  freeText: boolean;
  /** What a value typed for the field looks like, shown until one is typed. */
  placeholder: string | undefined;
  /** A test in words for the row's field: "has", "is any of". */
  operatorLabel: (operator: string) => string;
  /** Another field was picked. */
  onFieldChange: (field: FilterBarField) => void;
  /** Another test was picked. */
  onOperatorChange: (operator: string) => void;
  onChange: (row: ConditionRowData) => void;
  onRemove: () => void;
  /** Adds a condition that must also hold; left out where one can't join this row that way. */
  onAnd?: () => void;
  /** Adds an alternative to this condition; left out where one can't join this row that way. */
  onOr?: () => void;
}

/** A condition being changed in its cell: field, test and value, with a way to remove it or join another to it. */
export function ConditionRowEditor({
  row,
  fields,
  field,
  presence,
  valueless,
  many,
  freeText,
  placeholder,
  operatorLabel,
  onFieldChange,
  onOperatorChange,
  onChange,
  onRemove,
  onAnd,
  onOr,
}: ConditionRowEditorProps) {
  return (
    <div className="flex min-w-0 flex-col gap-2 transition-opacity duration-fast ease-out-custom starting:opacity-0">
      <div className="flex min-w-0 items-center gap-1">
        <Select
          value={row.field || null}
          onValueChange={id => {
            const next = fields.find(candidate => candidate.id === id);
            if (!next || next.id === row.field) return;
            onFieldChange(next);
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
            {fields.map(candidate => (
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
                onValueChange={operator => operator && operator !== row.operator && onOperatorChange(operator)}
              >
                <SelectTrigger size="sm" variant="ghost" aria-label="Operator" className="w-fit">
                  <Txt as="span" variant="body-sm">
                    {operatorLabel(row.operator)}
                  </Txt>
                </SelectTrigger>
                <SelectContent>
                  {(field.operators ?? []).map(operator => (
                    <SelectItem key={operator} value={operator}>
                      {operatorLabel(operator)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!valueless && (
                <ValueControl
                  row={row}
                  field={field}
                  many={many}
                  freeText={freeText}
                  placeholder={placeholder}
                  onChange={onChange}
                />
              )}
            </>
          )}
        </div>
      )}

      {row.field && (onAnd || onOr) && (
        <div className="flex items-center gap-1">
          {onAnd && (
            <Button variant="ghost" size="sm" icon={<IconPlusMedium />} onClick={onAnd}>
              And
            </Button>
          )}
          {onOr && (
            <Button variant="ghost" size="sm" icon={<IconPlusMedium />} onClick={onOr}>
              Or
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
