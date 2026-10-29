import type { KnowledgeImporterOptionField, KnowledgeImporterOptionValue } from '@mastra/client-js';
import { Button } from '@mastra/playground-ui/components/Button';
import { Field, FieldContent, FieldDescription, FieldLabel } from '@mastra/playground-ui/components/Field';
import { Input } from '@mastra/playground-ui/components/Input';
import { Switch } from '@mastra/playground-ui/components/Switch';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { X } from 'lucide-react';
import { useId, useState } from 'react';
import { describeAllowlist } from '../settings';

export interface OptionFieldsProps {
  schema: KnowledgeImporterOptionField[];
  values: Record<string, KnowledgeImporterOptionValue>;
  disabled?: boolean;
  onChange: (values: Record<string, KnowledgeImporterOptionValue>) => void;
}

export function OptionFields({ schema, values, disabled, onChange }: OptionFieldsProps) {
  const set = (key: string, value: KnowledgeImporterOptionValue | undefined) => {
    const { [key]: _previous, ...rest } = values;
    onChange(value === undefined ? rest : { ...rest, [key]: value });
  };

  return (
    <div className="flex flex-col gap-4">
      {schema.map(field => (
        <OptionField key={field.key} field={field} value={values[field.key]} disabled={disabled} onChange={set} />
      ))}
    </div>
  );
}

interface OptionFieldProps {
  field: KnowledgeImporterOptionField;
  value: KnowledgeImporterOptionValue | undefined;
  disabled?: boolean;
  onChange: (key: string, value: KnowledgeImporterOptionValue | undefined) => void;
}

function OptionField({ field, value, disabled, onChange }: OptionFieldProps) {
  const envHint = field.envVar ? `Defaults to the ${field.envVar} environment variable when not saved.` : undefined;

  switch (field.type) {
    case 'boolean':
      return (
        <Field orientation="horizontal">
          <FieldContent className="gap-0.5">
            <FieldLabel>{field.label}</FieldLabel>
            <FieldHelp help={field.help} envHint={envHint} />
          </FieldContent>
          <Switch
            aria-label={field.label}
            checked={value === true}
            disabled={disabled}
            onCheckedChange={checked => onChange(field.key, checked)}
          />
        </Field>
      );
    case 'list':
      return (
        <ListOptionField
          field={field}
          values={Array.isArray(value) ? value : []}
          disabled={disabled}
          envHint={envHint}
          onChange={next => onChange(field.key, next)}
        />
      );
    case 'number':
      return (
        <Field>
          <FieldLabel>{field.label}</FieldLabel>
          <Input
            type="number"
            aria-label={field.label}
            disabled={disabled}
            value={typeof value === 'number' ? String(value) : ''}
            onChange={event => {
              const raw = event.target.value;
              onChange(field.key, raw === '' || Number.isNaN(Number(raw)) ? undefined : Number(raw));
            }}
          />
          <FieldHelp help={field.help} envHint={envHint} />
        </Field>
      );
    case 'string':
      return (
        <Field>
          <FieldLabel>{field.label}</FieldLabel>
          <Input
            aria-label={field.label}
            disabled={disabled}
            value={typeof value === 'string' ? value : ''}
            onChange={event => onChange(field.key, event.target.value === '' ? undefined : event.target.value)}
          />
          <FieldHelp help={field.help} envHint={envHint} />
        </Field>
      );
  }
}

function FieldHelp({ help, envHint }: { help?: string; envHint?: string }) {
  if (!help && !envHint) return null;
  return (
    <FieldDescription className="mt-0">
      {help}
      {help && envHint ? ' ' : null}
      {envHint}
    </FieldDescription>
  );
}

const splitEntries = (text: string) =>
  text
    .split(/[\n,]/)
    .map(entry => entry.trim())
    .filter(entry => entry !== '');

interface ListOptionFieldProps {
  field: KnowledgeImporterOptionField;
  values: string[];
  disabled?: boolean;
  envHint?: string;
  onChange: (values: string[]) => void;
}

/** Allowlist editor: Enter or comma adds an entry; pasted lists are split on newlines and commas. */
function ListOptionField({ field, values, disabled, envHint, onChange }: ListOptionFieldProps) {
  const [pending, setPending] = useState('');
  const summaryId = useId();

  const add = (text: string) => {
    const entries = splitEntries(text).filter(entry => !values.includes(entry));
    if (entries.length > 0) onChange([...values, ...entries]);
    setPending('');
  };

  return (
    <Field>
      <FieldLabel>{field.label}</FieldLabel>
      {values.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5" aria-label={`${field.label} entries`}>
          {values.map(entry => (
            <li key={entry} className="bg-surface4 flex items-center gap-1 rounded-full py-0.5 pr-1 pl-2.5">
              <Txt as="span" variant="body-sm" font="mono">
                {entry}
              </Txt>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={`Remove ${entry}`}
                disabled={disabled}
                onClick={() => onChange(values.filter(value => value !== entry))}
              >
                <X />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      <Input
        aria-label={`Add to ${field.label}`}
        aria-describedby={summaryId}
        placeholder="Type and press Enter, or paste a list"
        disabled={disabled}
        value={pending}
        onChange={event => setPending(event.target.value)}
        onKeyDown={event => {
          if (event.key === 'Enter' || event.key === ',') {
            event.preventDefault();
            add(pending);
          }
        }}
        onPaste={event => {
          const text = event.clipboardData.getData('text');
          if (/[\n,]/.test(text)) {
            event.preventDefault();
            add(`${pending},${text}`);
          }
        }}
        onBlur={() => add(pending)}
      />
      <Txt id={summaryId} variant="caption" tone={values.length === 0 ? 'ink' : 'muted'}>
        {describeAllowlist(values)}
      </Txt>
      <FieldHelp help={field.help} envHint={envHint} />
    </Field>
  );
}
