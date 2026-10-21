import { Select, SelectContent, SelectItem, SelectTrigger } from '@mastra/playground-ui/components/Select';
import { Switch } from '@mastra/playground-ui/components/Switch';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { SettingsRow } from '@mastra/playground-ui/new/settings';

import type { FactoryEnvironmentPayload } from '../../../workspaces/services/environment';
import { toast } from '@mastra/playground-ui/components/Toaster';

import { CommittedInput } from './CommittedInput';
import type { SaveEnvironment } from './CommittedInput';

/** The JSON Schema subset the settings renderer reads; anything else renders as unsupported. */
interface SettingSchema {
  type?: string | string[];
  title?: string;
  description?: string;
  default?: unknown;
  minimum?: number;
  maximum?: number;
  enum?: unknown[];
  oneOf?: Array<{ const?: unknown; title?: string }>;
}

interface Choice {
  value: unknown;
  label: string;
}

/** Select options from `enum`, or from a `oneOf` of `const` members whose `title` is the label. */
function schemaChoices(schema: SettingSchema): Choice[] | undefined {
  if (schema.enum) return schema.enum.map(value => ({ value, label: String(value) }));
  if (schema.oneOf?.length && schema.oneOf.every(member => 'const' in member)) {
    return schema.oneOf.map(member => ({ value: member.const, label: member.title ?? String(member.const) }));
  }
  return undefined;
}

const PROVIDER_LABELS: Record<string, string> = {
  platform: 'the Mastra platform',
  e2b: 'E2B',
  docker: 'Docker',
  local: 'the local machine',
  custom: 'a custom sandbox',
  none: 'no sandbox',
};

/** "Sandboxes run on E2B" for a known provider id, the raw id otherwise. */
export function providerLine(provider: string): string {
  return `Sandboxes run on ${PROVIDER_LABELS[provider] ?? provider}.`;
}

function schemaProperties(schema: Record<string, unknown>): Array<[string, SettingSchema]> {
  const properties = schema.properties;
  if (!properties || typeof properties !== 'object') return [];
  return Object.entries(properties as Record<string, SettingSchema>);
}

/**
 * The provider's own sandbox settings, one row per property of the schema the
 * route serves, rendered inside the caller's container. Each row commits its
 * own PATCH; an empty field means the provider default (the placeholder),
 * never a value factory stores on the user's behalf.
 */
export function SandboxBlock({
  environment,
  disabled,
  onSave,
}: {
  environment: FactoryEnvironmentPayload;
  disabled: boolean;
  onSave: SaveEnvironment;
}) {
  const saveSetting = (key: string, value: unknown | null) => onSave({ settings: { [key]: value } });
  return schemaProperties(environment.sandbox.settingsSchema).map(([key, schema]) => (
    <SettingRow
      key={key}
      name={key}
      schema={schema}
      value={environment.settings[key]}
      disabled={disabled}
      onCommit={value => saveSetting(key, value)}
    />
  ));
}

function SettingRow({
  name,
  schema,
  value,
  disabled,
  onCommit,
}: {
  name: string;
  schema: SettingSchema;
  value: unknown;
  disabled: boolean;
  onCommit: (value: unknown | null) => Promise<boolean>;
}) {
  const label = schema.title ?? name;
  const type = Array.isArray(schema.type) ? schema.type.find(t => t !== 'null') : schema.type;
  const placeholder = schema.default === undefined ? undefined : String(schema.default);
  const choices = schemaChoices(schema);
  let control: React.ReactNode;
  if (choices) {
    // A default that is one of the choices is marked on that choice, and picking it clears the setting;
    // otherwise a separate "Default" item does.
    const defaultIsChoice = choices.some(choice => String(choice.value) === placeholder);
    const unsetKey = defaultIsChoice ? placeholder! : UNSET;
    const labelOf = (key: string) => {
      const choiceLabel = choices.find(choice => String(choice.value) === key)?.label ?? key;
      return defaultIsChoice && key === placeholder ? `${choiceLabel} (default)` : choiceLabel;
    };
    const current = value === undefined ? unsetKey : String(value);
    control = (
      <Select
        value={current}
        disabled={disabled}
        onValueChange={next => void onCommit(next === unsetKey ? null : coerceChoice(choices, next))}
      >
        <SelectTrigger size="sm" aria-label={label} className="w-auto">
          <Txt as="span" variant="caption">
            {current === UNSET ? (placeholder ? `Default (${placeholder})` : 'Default') : labelOf(current)}
          </Txt>
        </SelectTrigger>
        <SelectContent>
          {!defaultIsChoice && (
            <SelectItem value={UNSET}>{placeholder ? `Default (${placeholder})` : 'Default'}</SelectItem>
          )}
          {choices.map(choice => (
            <SelectItem key={String(choice.value)} value={String(choice.value)}>
              {labelOf(String(choice.value))}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  } else if (type === 'boolean') {
    control = (
      <Switch
        aria-label={label}
        checked={value === undefined ? schema.default === true : value === true}
        disabled={disabled}
        onCheckedChange={next => void onCommit(next)}
      />
    );
  } else if (type === 'integer' || type === 'number') {
    control = (
      <div className="w-full lg:max-w-40">
        <CommittedInput
          label={label}
          type="number"
          min={schema.minimum}
          max={schema.maximum}
          step={type === 'integer' ? 1 : 'any'}
          placeholder={placeholder}
          value={value === undefined ? '' : String(value)}
          disabled={disabled}
          onCommit={raw => {
            if (raw === '') return onCommit(null);
            const parsed = numberInRange(raw, schema, type === 'integer');
            return parsed === undefined ? Promise.reject(new Error('invalid')) : onCommit(parsed);
          }}
        />
      </div>
    );
  } else if (type === 'string') {
    control = (
      <div className="w-full lg:max-w-96">
        <CommittedInput
          label={label}
          placeholder={placeholder}
          value={value === undefined ? '' : String(value)}
          disabled={disabled}
          onCommit={raw => onCommit(raw === '' ? null : raw)}
        />
      </div>
    );
  } else {
    control = (
      <Txt as="span" variant="meta" tone="faint">
        Unsupported setting type
      </Txt>
    );
  }
  return (
    <SettingsRow label={label} description={schema.description}>
      {control}
    </SettingsRow>
  );
}

const UNSET = '__default__';

/**
 * The parsed number when it satisfies the schema's type and bounds, otherwise
 * undefined after telling the user why the value was not saved. `Number()`
 * rejects "12abc" where parseInt would have silently truncated it.
 */
function numberInRange(raw: string, schema: SettingSchema, integer: boolean): number | undefined {
  const value = Number(raw);
  const typed = integer ? Number.isInteger(value) : Number.isFinite(value);
  const min = schema.minimum ?? -Infinity;
  const max = schema.maximum ?? Infinity;
  if (typed && value >= min && value <= max) return value;
  const kind = integer ? 'a whole number' : 'a number';
  const range =
    schema.minimum !== undefined && schema.maximum !== undefined
      ? ` between ${schema.minimum} and ${schema.maximum}`
      : schema.minimum !== undefined
        ? ` of at least ${schema.minimum}`
        : schema.maximum !== undefined
          ? ` of at most ${schema.maximum}`
          : '';
  toast.error(`Enter ${kind}${range}`);
  return undefined;
}

/** The choice whose string form the select handed back, keeping its original type. */
function coerceChoice(choices: Choice[], picked: string): unknown {
  return choices.find(choice => String(choice.value) === picked)?.value ?? picked;
}
