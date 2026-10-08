import { Select, SelectContent, SelectItem, SelectTrigger } from '@mastra/playground-ui/components/Select';
import { Switch } from '@mastra/playground-ui/components/Switch';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { SettingsContainer, SettingsRow } from '@mastra/playground-ui/new/settings';

import type { FactoryEnvironmentPayload } from '../../../workspaces/services/environment';
import { toast } from '@mastra/playground-ui/components/Toaster';

import { CommittedInput, type SaveEnvironment } from './CommittedInput';

/** The JSON Schema subset the settings renderer reads; anything else renders as unsupported. */
interface SettingSchema {
  type?: string | string[];
  title?: string;
  description?: string;
  default?: unknown;
  minimum?: number;
  maximum?: number;
  enum?: unknown[];
}

const PROVIDER_LABELS: Record<string, string> = {
  platform: 'the Mastra platform',
  e2b: 'E2B',
  docker: 'Docker',
  local: 'the local machine',
  custom: 'a custom sandbox',
  none: 'no sandbox',
};

/** "Sessions run on E2B" for a known provider id, the raw id otherwise. */
export function providerLine(provider: string): string {
  return `Sessions run on ${PROVIDER_LABELS[provider] ?? provider}.`;
}

function schemaProperties(schema: Record<string, unknown>): Array<[string, SettingSchema]> {
  const properties = schema.properties;
  if (!properties || typeof properties !== 'object') return [];
  return Object.entries(properties as Record<string, SettingSchema>);
}

/**
 * The sandbox every session boots: its working directory plus the provider's
 * own settings, one row per property of the schema the route serves. Each row
 * commits its own PATCH; an empty field means the provider default (the
 * placeholder), never a value factory stores on the user's behalf.
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
  return (
    <div className="flex flex-col gap-2">
      <Txt as="h3" variant="label">
        Sandbox
      </Txt>
      <SettingsContainer>
        <SettingsRow label="Working directory" description="Absolute path the repositories are cloned under.">
          <div className="w-full lg:max-w-96">
            <CommittedInput
              label="Working directory"
              placeholder="/workspace"
              value={environment.sandboxWorkdir ?? ''}
              disabled={disabled}
              onCommit={raw => onSave({ sandboxWorkdir: raw || null })}
            />
          </div>
        </SettingsRow>
        {schemaProperties(environment.sandbox.settingsSchema).map(([key, schema]) => (
          <SettingRow
            key={key}
            name={key}
            schema={schema}
            value={environment.settings[key]}
            disabled={disabled}
            onCommit={value => saveSetting(key, value)}
          />
        ))}
      </SettingsContainer>
    </div>
  );
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
  let control: React.ReactNode;
  if (schema.enum) {
    const options = schema.enum.map(String);
    const current = value === undefined ? UNSET : String(value);
    control = (
      <Select
        value={current}
        disabled={disabled}
        onValueChange={next => void onCommit(next === UNSET ? null : coerceEnum(schema.enum!, next))}
      >
        <SelectTrigger size="sm" aria-label={label} className="w-auto">
          <Txt as="span" variant="caption">
            {current === UNSET ? (placeholder ? `Default (${placeholder})` : 'Default') : current}
          </Txt>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={UNSET}>{placeholder ? `Default (${placeholder})` : 'Default'}</SelectItem>
          {options.map(option => (
            <SelectItem key={option} value={option}>
              {option}
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

/** The enum member whose string form the select handed back, keeping its original type. */
function coerceEnum(members: unknown[], picked: string): unknown {
  return members.find(member => String(member) === picked) ?? picked;
}
