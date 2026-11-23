import { CommittedInput } from '@/ds/components/CommittedInput';
import { Notice } from '@/ds/components/Notice';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/ds/components/Select';
import { Switch } from '@/ds/components/Switch';
import { toast } from '@/ds/components/Toaster';
import { Txt } from '@/ds/components/Txt';
import { SettingsRow } from '@/ds/new/settings';

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

function schemaProperties(schema: Record<string, unknown>): Array<[string, SettingSchema]> {
  const properties = schema.properties;
  if (!properties || typeof properties !== 'object') return [];
  return Object.entries(properties as Record<string, SettingSchema>);
}

export interface SandboxSettingsProps {
  /** JSON Schema of the provider's settings; one row per property. */
  schema: Record<string, unknown>;
  /** Stored values; a missing key means the provider default. */
  values: Record<string, unknown>;
  disabled?: boolean;
  /** Persists one setting; `null` clears it back to the default. */
  onCommit: (key: string, value: unknown | null) => Promise<unknown>;
}

/**
 * The provider's own sandbox settings, one row per property of its schema,
 * rendered inside the caller's container. Each row commits on its own; an
 * empty field means the provider default (the placeholder).
 */
export function SandboxSettings({ schema, values, disabled = false, onCommit }: SandboxSettingsProps) {
  const properties = schemaProperties(schema);
  const effective = (key: string) => values[key] ?? properties.find(([name]) => name === key)?.[1].default;
  const memoryMb = effective('memoryMb');
  const dockerLowMemory =
    effective('docker') === true && typeof memoryMb === 'number' && memoryMb < DOCKER_MIN_MEMORY_MB;
  return (
    <>
      {properties.map(([key, property]) => (
        <SettingRow
          key={key}
          name={key}
          schema={property}
          value={values[key]}
          disabled={disabled}
          onCommit={value => onCommit(key, value)}
        />
      ))}
      {dockerLowMemory && (
        <Notice variant="warning">
          Docker is on with {memoryMb} MB of memory. We recommend at least 2 GB for Docker; with less, containers may
          run out of memory.
        </Notice>
      )}
    </>
  );
}

export interface WorkspaceSetupSettingsProps {
  workingDirectory: string | null;
  workingDirectoryPlaceholder?: string;
  setupCommand: string | null;
  disabled?: boolean;
  onWorkingDirectoryCommit: (value: string | null) => Promise<unknown>;
  onSetupCommandCommit: (value: string | null) => Promise<unknown>;
}

/** Where repositories are cloned and the one command that runs there after every repository is set up. */
export function WorkspaceSetupSettings({
  workingDirectory,
  workingDirectoryPlaceholder = '/workspace',
  setupCommand,
  disabled = false,
  onWorkingDirectoryCommit,
  onSetupCommandCommit,
}: WorkspaceSetupSettingsProps) {
  return (
    <>
      <SettingsRow label="Working directory" description="Absolute path where repositories are cloned.">
        <CommittedInput
          label="Working directory"
          placeholder={workingDirectoryPlaceholder}
          value={workingDirectory ?? ''}
          disabled={disabled}
          onCommit={raw => onWorkingDirectoryCommit(raw || null)}
        />
      </SettingsRow>
      <SettingsRow label="Setup command" description="Runs from the working directory once every repository is cloned.">
        <CommittedInput
          label="Setup command"
          value={setupCommand ?? ''}
          placeholder="e.g. ./scripts/bootstrap.sh"
          disabled={disabled}
          onCommit={raw => onSetupCommandCommit(raw || null)}
        />
      </SettingsRow>
    </>
  );
}

/** Recommended minimum memory for sandboxes that run Docker. */
const DOCKER_MIN_MEMORY_MB = 2048;

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
  onCommit: (value: unknown | null) => Promise<unknown>;
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
    const unsetKey = defaultIsChoice && placeholder !== undefined ? placeholder : UNSET;
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
        <SelectTrigger size="sm" aria-label={label}>
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
    );
  } else if (type === 'string') {
    control = (
      <CommittedInput
        label={label}
        placeholder={placeholder}
        value={value === undefined ? '' : String(value)}
        disabled={disabled}
        onCommit={raw => onCommit(raw === '' ? null : raw)}
      />
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
