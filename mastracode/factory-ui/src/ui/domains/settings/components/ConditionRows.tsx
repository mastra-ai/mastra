import type { RuleGroup } from '@mastra/factory/rules/rule-group';
import {
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxRoot,
  ComboboxSearch,
  ComboboxTrigger,
} from '@mastra/playground-ui/components/Combobox';
import type { FilterBarField, FilterBarOption } from '@mastra/playground-ui/components/FilterBar';
import { Input } from '@mastra/playground-ui/components/Input';
import {
  RuleAddButton,
  RuleLine,
  RuleLineContent,
  RuleLineGroup,
  RuleLineGroupRemove,
  RuleLineHint,
  RuleLineKeyword,
  RuleLineLogic,
  RuleLineRemove,
  RuleLines,
} from '@mastra/playground-ui/components/RuleLines';
import { SegmentedControl, SegmentedControlItem } from '@mastra/playground-ui/components/SegmentedControl';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@mastra/playground-ui/components/Select';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import {
  CircleCheck,
  CircleDot,
  Columns3,
  FolderGit2,
  GitMerge,
  GitPullRequest,
  Hash,
  ListPlus,
  Plug,
  Plus,
  ShieldCheck,
  Tag,
  Type,
  User,
  Users,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';

import { andLimits, repositoryHint } from '../services/rules';
import { CONDITION_OPERATORS, VALUE_PLACEHOLDERS, conditionFields } from './conditionFields';
import type { Facts } from './conditionFields';
import { MANY, VALUELESS, canNest, emptyRow, fromRule, isGroup, newKey, toRule, valueFor } from './conditionTree';
import type { Group, Item, Row } from './conditionTree';
import { narrowSuggestions } from './sourceSuggestions';

const FIELD_ICONS: Record<string, LucideIcon> = {
  'item.labels': Tag,
  'item.title': Type,
  'item.author': User,
  'item.key': Hash,
  'item.state': CircleDot,
  'item.assignees': Users,
  'item.pullRequest': GitPullRequest,
  'author.trusted': ShieldCheck,
  'source.kind': GitPullRequest,
  'source.integration': Plug,
  'source.provider': Plug,
  'source.repository': FolderGit2,
  'pullRequest.closesIssue': GitMerge,
  'closedIssue.phase': Columns3,
  'closedIssue.hasPullRequest': GitPullRequest,
  'event.type': Zap,
  'event.reason': CircleCheck,
};

function operatorLabel(field: FilterBarField | undefined, operator: string): string {
  return (
    field?.operatorLabels?.[operator] ??
    CONDITION_OPERATORS.find(candidate => candidate.id === operator)?.label ??
    operator
  );
}

function optionsOf(field: FilterBarField | undefined): FilterBarOption[] | undefined {
  // Nothing to pick from (a project with no repositories yet) reads as no list: the value is typed.
  return Array.isArray(field?.suggestions) && field.suggestions.length > 0 ? field.suggestions : undefined;
}

/**
 * A rule as lines a person reads and edits in place: "Where Integration is GitHub, and Author is trusted".
 * Groups are boxed lines with their own and/or, nested as deep as the server accepts.
 * Every change reports the rule so far and whether a line is still unfinished; unfinished lines are left out.
 * The lines are read from `rule` once: give the editor a new `key` to load a rule changed elsewhere.
 */
export function ConditionRows({
  label,
  rule,
  facts,
  options,
  emptyHint,
  onChange,
}: {
  label: string;
  rule: RuleGroup | null | undefined;
  facts: Facts;
  /** Values to pick from per field, such as a board's phases. */
  options?: Record<string, FilterBarOption[]>;
  /** Said beside "Add condition" while there is none: what an empty rule means here. */
  emptyHint?: string;
  onChange: (rule: RuleGroup | null, incomplete: boolean) => void;
}) {
  const fields = conditionFields(facts, options);
  const [root, setRoot] = useState(() => fromRule(rule));
  const { rule: current, incomplete } = toRule(root);
  const hint = repositoryHint(current);

  const update = (next: Group) => {
    setRoot(next);
    const { rule: nextRule, incomplete } = toRule(next);
    onChange(nextRule, incomplete);
  };

  return (
    <div className="flex flex-col gap-2">
      <GroupLines
        role="group"
        aria-label={label}
        group={root}
        depth={0}
        fields={fields}
        emptyHint={emptyHint}
        onChange={update}
      />
      {incomplete && (
        <Txt as="p" variant="caption" tone="muted">
          Finish or remove unfinished conditions to save.
        </Txt>
      )}
      {hint && (
        <Txt as="p" variant="caption" tone="muted">
          {hint}
        </Txt>
      )}
    </div>
  );
}

function GroupLines({
  role,
  'aria-label': label,
  group,
  depth,
  fields,
  limits = [],
  emptyHint,
  onChange,
  onRemove,
}: {
  role?: 'group';
  'aria-label'?: string;
  group: Group;
  depth: number;
  fields: FilterBarField[];
  /** Conditions every card this group tests also meets: those of the AND groups around it. */
  limits?: Row[];
  /** Only the top group can be empty: a group left empty is removed. */
  emptyHint?: string;
  onChange: (group: Group) => void;
  /** Given for nested groups: removes the whole group, from the end of its add line. */
  onRemove?: () => void;
}) {
  const replace = (index: number, item: Item | undefined) =>
    onChange({
      ...group,
      items: item === undefined ? group.items.filter((_, at) => at !== index) : group.items.with(index, item),
    });
  const add = (item: Item) => onChange({ ...group, items: [...group.items, item] });

  const actions = (
    <>
      <RuleAddButton icon={<Plus />} onClick={() => add(emptyRow())}>
        Add condition
      </RuleAddButton>
      {canNest(depth) && (
        <RuleAddButton
          icon={<ListPlus />}
          onClick={() => add({ key: newKey(), logic: group.logic === 'AND' ? 'OR' : 'AND', items: [emptyRow()] })}
        >
          Add group
        </RuleAddButton>
      )}
      {onRemove && <RuleLineGroupRemove onClick={onRemove}>Remove group</RuleLineGroupRemove>}
    </>
  );

  if (group.items.length === 0) {
    // No condition yet: "Where" leads straight into the way to add one, and says what that means meanwhile.
    return (
      <RuleLines role={role} aria-label={label}>
        <RuleLine>
          <RuleLineKeyword>Where</RuleLineKeyword>
          <RuleLineContent>
            {actions}
            {emptyHint && <RuleLineHint>{emptyHint}</RuleLineHint>}
          </RuleLineContent>
        </RuleLine>
      </RuleLines>
    );
  }

  const joiner = group.logic === 'AND' ? 'and' : 'or';
  // In an AND group, each row also holds for the others; an OR group's rows say nothing about each other.
  const here = andLimits(
    group.logic,
    limits,
    group.items.filter((item): item is Row => !isGroup(item)),
  );
  return (
    <RuleLines role={role} aria-label={label}>
      {group.items.map((item, index) => (
        <RuleLine key={item.key}>
          {index === 1 ? (
            <RuleLineLogic value={group.logic} onValueChange={logic => onChange({ ...group, logic })} />
          ) : (
            <RuleLineKeyword>{index === 0 ? 'Where' : joiner}</RuleLineKeyword>
          )}
          {isGroup(item) ? (
            <RuleLineGroup depth={depth} aria-label={item.logic === 'AND' ? 'All of these' : 'Any of these'}>
              <GroupLines
                group={item}
                depth={depth + 1}
                fields={fields}
                limits={here}
                onChange={next => replace(index, next.items.length > 0 ? next : undefined)}
                onRemove={() => replace(index, undefined)}
              />
            </RuleLineGroup>
          ) : (
            <ConditionLine
              row={item}
              fields={fields}
              limits={here.filter(limit => limit !== item)}
              onChange={next => replace(index, next)}
              onRemove={() => replace(index, undefined)}
            />
          )}
        </RuleLine>
      ))}
      {/* Under the pickers, past the keyword column, so it reads as the next line of the list. */}
      <RuleLine>
        <RuleLineKeyword />
        <RuleLineContent>{actions}</RuleLineContent>
      </RuleLine>
    </RuleLines>
  );
}

function FieldIcon({ id }: { id: string }) {
  const Icon = FIELD_ICONS[id] ?? CircleDot;
  return <Icon aria-hidden="true" className="text-muted-foreground size-3.5 shrink-0" />;
}

function ConditionLine({
  row,
  fields,
  limits,
  onChange,
  onRemove,
}: {
  row: Row;
  fields: FilterBarField[];
  /** The other conditions a card must meet with this one, which can narrow its suggestions. */
  limits: Row[];
  onChange: (row: Row) => void;
  onRemove: () => void;
}) {
  const listed = fields.find(candidate => candidate.id === row.field);
  const field = listed && narrowSuggestions(listed, limits);

  return (
    <RuleLineContent>
      <Select
        value={row.field || null}
        onValueChange={id => {
          const next = fields.find(candidate => candidate.id === id);
          if (!next) return;
          const operator = next.operators?.[0] ?? 'equals';
          onChange({ ...row, field: next.id, operator, value: valueFor(next, operator, undefined) });
        }}
      >
        <SelectTrigger size="sm" aria-label="Field" className="w-fit max-w-full">
          <span className="flex min-w-0 items-center gap-1.5">
            {field && <FieldIcon id={field.id} />}
            <Txt as="span" variant="caption" className="truncate">
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

      {field?.type === 'boolean' && <BooleanValue row={row} field={field} onChange={onChange} />}
      {field && field.type !== 'boolean' && (
        <>
          <Select
            value={row.operator}
            onValueChange={operator =>
              operator && onChange({ ...row, operator, value: valueFor(field, operator, row.value) })
            }
          >
            <SelectTrigger size="sm" variant="ghost" aria-label="Operator" className="w-fit">
              <Txt as="span" variant="caption">
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

      <RuleLineRemove aria-label="Remove condition" onClick={onRemove} />
    </RuleLineContent>
  );
}

/** A yes/no fact reads as "Author trust is [Trusted | Outside author]", whichever way the rule states it. */
function BooleanValue({ row, field, onChange }: { row: Row; field: FilterBarField; onChange: (row: Row) => void }) {
  const options = optionsOf(field) ?? [
    { value: 'true', label: 'Yes' },
    { value: 'false', label: 'No' },
  ];
  const yes = (row.operator !== 'not_equals') === (row.value !== false);
  return (
    <>
      <Txt as="span" variant="caption" tone="muted">
        is
      </Txt>
      <SegmentedControl
        size="sm"
        aria-label={field.label}
        value={String(yes)}
        onValueChange={value => onChange({ ...row, operator: 'equals', value: value === 'true' })}
      >
        {options.map(option => (
          <SegmentedControlItem key={option.value} value={option.value}>
            {option.label}
          </SegmentedControlItem>
        ))}
      </SegmentedControl>
    </>
  );
}

function ValueControl({ row, field, onChange }: { row: Row; field: FilterBarField; onChange: (row: Row) => void }) {
  const options = optionsOf(field);
  const many = MANY.has(row.operator);
  const typed = CONDITION_OPERATORS.find(operator => operator.id === row.operator)?.freeText === true;
  // An open field keeps one control while its suggestions load, so a value being typed isn't lost.
  if (field.strict === false && !typed) {
    const values = Array.isArray(row.value)
      ? row.value.map(String)
      : row.value === undefined
        ? []
        : [String(row.value)];
    return (
      <OpenValues
        options={(options ?? []).map(option => ({ value: option.value, label: option.label ?? option.value }))}
        values={values}
        many={many}
        placeholder={VALUE_PLACEHOLDERS[field.id] ?? 'Search or type a value'}
        onChange={next => onChange({ ...row, value: many ? next : next[0] })}
      />
    );
  }
  if (options && many) {
    const values = Array.isArray(row.value) ? row.value.map(String) : [];
    return (
      <ManyValues
        options={options.map(option => ({ value: option.value, label: option.label ?? option.value }))}
        values={values}
        onChange={next => onChange({ ...row, value: next })}
      />
    );
  }
  if (options) {
    const current = options.find(option => option.value === String(row.value ?? ''));
    return (
      <Select
        value={row.value === undefined ? null : String(row.value)}
        onValueChange={value => value !== null && onChange({ ...row, value })}
      >
        <SelectTrigger size="sm" aria-label="Value" className="w-fit">
          <Txt as="span" variant="caption" className="font-medium">
            {current?.label ?? (row.value === undefined ? 'Choose a value' : String(row.value))}
          </Txt>
        </SelectTrigger>
        <SelectContent>
          {options.map(option => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
  return <TextValue row={row} field={field} many={many} onChange={onChange} />;
}

type Choice = { value: string; label: string };

/** Reads values as a list ("Bug, Feature or Chore"); past three, the first two and how many more. */
function listSummary(labels: string[]): string {
  if (labels.length === 0) return 'Choose values';
  if (labels.length > 3) return `${labels.slice(0, 2).join(', ')} +${labels.length - 2}`;
  if (labels.length === 1) return labels[0];
  return `${labels.slice(0, -1).join(', ')} or ${labels.at(-1)}`;
}

/** Picks several values; the trigger reads them as a list, not a count. */
function ManyValues({
  options,
  values,
  onChange,
}: {
  options: Choice[];
  values: string[];
  onChange: (values: string[]) => void;
}) {
  // A saved value the field no longer offers (a removed phase) still shows, and stays until unticked.
  const chosen = values.map(value => options.find(option => option.value === value) ?? { value, label: value });
  const items = [...options, ...chosen.filter(choice => !options.includes(choice))];
  const labels = chosen.map(option => option.label);
  return (
    <ComboboxRoot
      multiple
      autoHighlight
      items={items}
      value={chosen}
      itemToStringLabel={(option: Choice) => option.label}
      isItemEqualToValue={(option: Choice, value: Choice) => option.value === value.value}
      onValueChange={next => onChange(next.map(option => option.value))}
    >
      <ComboboxTrigger size="sm" aria-label="Values" title={labels.join(', ')} className="w-fit max-w-64">
        <Txt as="span" variant="caption" className={cn('font-medium', labels.length === 0 && 'text-muted-foreground')}>
          {listSummary(labels)}
        </Txt>
      </ComboboxTrigger>
      <ComboboxContent>
        <ComboboxSearch placeholder="Search" />
        <ComboboxEmpty>No option found.</ComboboxEmpty>
        <ComboboxList>
          {(option: Choice) => (
            <ComboboxItem key={option.value} value={option}>
              {option.label}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </ComboboxRoot>
  );
}

/**
 * Picks from suggestions or takes any typed value: "Use “acme/next”", listed after the suggestions it
 * matches, adds what was typed. One value, or
 * several for "is any of"; values the suggestions don't list still show, and stay until removed.
 */
function OpenValues({
  options,
  values,
  many,
  placeholder,
  onChange,
}: {
  options: Choice[];
  values: string[];
  many: boolean;
  placeholder: string;
  onChange: (values: string[]) => void;
}) {
  const [query, setQuery] = useState('');
  const typed = query.trim();
  const listed = (value: string) => options.some(option => option.value.toLowerCase() === value.toLowerCase());
  const chosen = values.map(value => options.find(option => option.value === value) ?? { value, label: value });
  // What was typed goes last, so Enter picks a suggestion it matches; alone, it's the only choice.
  const items = [
    ...options,
    ...chosen.filter(choice => !options.includes(choice)),
    ...(typed && !listed(typed) && !values.includes(typed) ? [{ value: typed, label: `Use “${typed}”` }] : []),
  ];
  const labels = chosen.map(choice => choice.value);
  const shared = {
    autoHighlight: true,
    items,
    inputValue: query,
    onInputValueChange: setQuery,
    itemToStringLabel: (option: Choice) => option.label,
    isItemEqualToValue: (option: Choice, value: Choice) => option.value === value.value,
  };
  const content = (
    <ComboboxContent>
      <ComboboxSearch placeholder={placeholder} />
      <ComboboxEmpty>Type a value to use it.</ComboboxEmpty>
      <ComboboxList>
        {(option: Choice) => (
          <ComboboxItem key={option.value} value={option}>
            {option.label}
          </ComboboxItem>
        )}
      </ComboboxList>
    </ComboboxContent>
  );
  const summary = (
    <Txt as="span" variant="caption" className={cn('font-medium', labels.length === 0 && 'text-muted-foreground')}>
      {labels.length === 0 ? placeholder : listSummary(labels)}
    </Txt>
  );
  if (many) {
    return (
      <ComboboxRoot
        {...shared}
        multiple
        value={chosen}
        onValueChange={next => onChange(next.map(option => option.value))}
      >
        <ComboboxTrigger size="sm" aria-label="Values" title={labels.join(', ')} className="w-fit max-w-64">
          {summary}
        </ComboboxTrigger>
        {content}
      </ComboboxRoot>
    );
  }
  return (
    <ComboboxRoot {...shared} value={chosen[0] ?? null} onValueChange={next => next && onChange([next.value])}>
      <ComboboxTrigger size="sm" aria-label="Value" title={labels[0]} className="w-fit max-w-64">
        {summary}
      </ComboboxTrigger>
      {content}
    </ComboboxRoot>
  );
}

function textOf(value: Row['value']): string {
  if (Array.isArray(value)) return value.join(', ');
  return value === undefined ? '' : String(value);
}

/** Typed values save on Enter or when the field loses focus; Escape puts back the saved value. */
function TextValue({
  row,
  field,
  many,
  onChange,
}: {
  row: Row;
  field: FilterBarField;
  many: boolean;
  onChange: (row: Row) => void;
}) {
  // What is being typed, until it is saved or put back; the saved value shows otherwise.
  const [draft, setDraft] = useState<string>();
  const text = draft ?? textOf(row.value);
  const commit = () => {
    if (draft === undefined) return;
    setDraft(undefined);
    if (draft === textOf(row.value)) return;
    if (many) {
      const parts = draft.split(',').map(part => part.trim());
      onChange({ ...row, value: parts.filter(part => part !== '') });
      return;
    }
    if (field.type !== 'number') {
      onChange({ ...row, value: draft.trim() });
      return;
    }
    // A number left empty or unreadable stays unfinished rather than saving 0 or NaN.
    const number = Number(draft.trim());
    onChange({ ...row, value: draft.trim() !== '' && Number.isFinite(number) ? number : undefined });
  };
  return (
    <Input
      size="sm"
      aria-label="Value"
      type={field.type === 'number' && !many ? 'number' : 'text'}
      placeholder={VALUE_PLACEHOLDERS[field.id] ?? (many ? 'Values, comma separated' : 'Value')}
      value={text}
      className="w-48"
      onChange={event => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={event => {
        if (event.key === 'Enter') {
          event.preventDefault();
          commit();
        } else if (event.key === 'Escape') {
          setDraft(undefined);
        }
      }}
    />
  );
}
