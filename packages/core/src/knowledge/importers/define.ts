import type { JSONSchema7 } from 'json-schema';
import { standardSchemaToJSONSchema, toStandardSchema } from '../../schema';
import type { InferPublicSchema, PublicSchema, StandardSchemaWithJSON } from '../../schema';
import { createStandardSchemaIssuesError } from '../../tools/validation';
import { EMPTY_KNOWLEDGE_IMPORTER_SETTINGS_SCHEMA, jsonSchemaRefs } from './manifest';
import type { KnowledgeImporterManifest } from './manifest';
import type { KnowledgeImportDeclaration, KnowledgeImportItem } from './types';

/** @experimental */
export interface KnowledgeImporterCredentialSlot {
  description: string;
  /** Default true: the host never shows or logs the value. */
  secret?: boolean;
}

/**
 * Buffered writes. They reach Knowledge in the next flush: when the buffer fills, when
 * `state.set` is called, and when `sync` returns. Await them, so a full buffer can flush.
 */
export interface KnowledgeImporterItems {
  upsert(item: KnowledgeImportItem): Promise<void>;
  declare(item: KnowledgeImportDeclaration): Promise<void>;
  /** Only on a positive signal from the source (archived, trashed), never because an item was missing. */
  remove(sourceId: string): Promise<void>;
}

/** The importer's cursor store. Values are strings; keep them small. */
export interface KnowledgeImporterStateStore {
  get(key: string): Promise<string | undefined>;
  /**
   * Flushes the buffered items together with this value, so a saved cursor never covers items that
   * didn't land. Refused once the run is canceled.
   */
  set(key: string, value: string): Promise<void>;
}

/** @experimental */
export interface KnowledgeImporterContext<TSettings = unknown, TSlot extends string = string> {
  /** Fires on cancel and at the hard deadline. Stop reading the source when it does. */
  signal: AbortSignal;
  binding: { id: string; target: string };
  settings: TSettings;
  /** Values for the definition's slots, supplied by the host at run start. */
  credentials: Readonly<Record<TSlot, string>>;
  /**
   * The host's fetch: the platform fetch with retries on 429/5xx (`Retry-After` honoured) in a
   * local app, a relay on hosts that keep the credentials. A source's error status comes back as a
   * response; throw `KnowledgeImporterSourceError` to fail the run with it. A host failure throws
   * `KnowledgeImporterHostError`, which never means the source item is gone.
   */
  fetch: (input: string | URL, init?: RequestInit) => Promise<Response>;
  state: KnowledgeImporterStateStore;
  items: KnowledgeImporterItems;
  /**
   * This pass stopped at its own cap with more to read (its cursor is saved). The runner calls
   * `sync` again while the run has time, and the host may chain another run when it doesn't.
   */
  reportBacklog(): void;
}

type SettingsOf<TSchema> = TSchema extends PublicSchema<any, any> ? InferPublicSchema<TSchema> : Record<string, never>;

/** @experimental */
export interface KnowledgeImporterDefinitionInput<TSchema, TSlot extends string> {
  /** Stable key: bindings and run history name the importer by it. Lowercase letters, digits, `-` and `_`. */
  id: string;
  label: string;
  description?: string;
  /** An http(s) URL or a `data:image/` URI. */
  iconUrl?: string;
  settings?: TSchema;
  credentials?: Record<TSlot, KnowledgeImporterCredentialSlot>;
  /** A UTC cron expression for hosts that schedule runs. Core itself doesn't schedule. */
  defaultSchedule?: string;
  sync(ctx: KnowledgeImporterContext<SettingsOf<TSchema>, TSlot>): Promise<void>;
}

/** @experimental */
export interface KnowledgeImporterDefinition<TSettings = unknown, TSlot extends string = string> {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
  readonly iconUrl?: string;
  readonly defaultSchedule?: string;
  readonly credentials: Readonly<Record<TSlot, Required<KnowledgeImporterCredentialSlot>>>;
  /** Validates a binding's settings against the definition's schema. */
  parseSettings(value: unknown): Promise<TSettings>;
  /** Checks a binding supplies exactly the declared slots, each a non-empty string. */
  checkCredentials(values: Record<string, unknown> | undefined): Readonly<Record<TSlot, string>>;
  sync(ctx: KnowledgeImporterContext<TSettings, TSlot>): Promise<void>;
  toManifest(): KnowledgeImporterManifest;
}

/** A definition, a registry or a binding's settings or credentials are invalid. @experimental */
export class KnowledgeImporterDefinitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KnowledgeImporterDefinitionError';
  }
}

/** A binding's settings don't match the importer's schema (run error code `settings_invalid`). @experimental */
export class KnowledgeImporterSettingsError extends KnowledgeImporterDefinitionError {
  constructor(
    message: string,
    readonly errors: { path: string[]; message: string }[],
  ) {
    super(message);
    this.name = 'KnowledgeImporterSettingsError';
  }
}

/** A binding is missing a credential or supplies an undeclared one (run error code `credential_missing`). @experimental */
export class KnowledgeImporterCredentialsError extends KnowledgeImporterDefinitionError {
  constructor(message: string) {
    super(message);
    this.name = 'KnowledgeImporterCredentialsError';
  }
}

/** The source answered with an error status. The runner maps the status to the run's error code. @experimental */
export class KnowledgeImporterSourceError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'KnowledgeImporterSourceError';
  }
}

/** The host (a proxy or relay) failed the request, not the source. Never a sign an item is gone. @experimental */
export class KnowledgeImporterHostError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KnowledgeImporterHostError';
  }
}

const IMPORTER_ID = /^[a-z][a-z0-9_-]{0,63}$/;
const SLOT_NAME = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;

function checkIconUrl(id: string, iconUrl: string): void {
  if (/^data:image\//.test(iconUrl)) return;
  let protocol: string;
  try {
    protocol = new URL(iconUrl).protocol;
  } catch {
    protocol = '';
  }
  if (protocol !== 'https:' && protocol !== 'http:') {
    throw new KnowledgeImporterDefinitionError(`Importer "${id}" iconUrl must be an http(s) URL or a data:image/ URI.`);
  }
}

/**
 * Defines an importer: code that reads a source and writes it into Knowledge as items. A binding
 * (where it writes, with which settings and credentials) runs it. Invalid definitions throw
 * `KnowledgeImporterDefinitionError` here, not at the first run.
 *
 * @experimental
 */
export function defineKnowledgeImporter<
  TSchema extends PublicSchema<any, any> | undefined = undefined,
  TSlot extends string = never,
>(input: KnowledgeImporterDefinitionInput<TSchema, TSlot>): KnowledgeImporterDefinition<SettingsOf<TSchema>, TSlot> {
  const { id, label, description, iconUrl, defaultSchedule } = input;
  if (typeof id !== 'string' || !IMPORTER_ID.test(id)) {
    throw new KnowledgeImporterDefinitionError(
      `Importer id "${String(id)}" must be 1-64 lowercase letters, digits, "-" or "_", starting with a letter.`,
    );
  }
  if (typeof label !== 'string' || !label.trim()) {
    throw new KnowledgeImporterDefinitionError(`Importer "${id}" needs a label.`);
  }
  if (iconUrl !== undefined) checkIconUrl(id, iconUrl);
  if (defaultSchedule !== undefined && (typeof defaultSchedule !== 'string' || !defaultSchedule.trim())) {
    throw new KnowledgeImporterDefinitionError(`Importer "${id}" defaultSchedule must be a cron expression.`);
  }
  if (typeof input.sync !== 'function') {
    throw new KnowledgeImporterDefinitionError(`Importer "${id}" needs a sync function.`);
  }

  const credentials = {} as Record<TSlot, Required<KnowledgeImporterCredentialSlot>>;
  for (const [slot, declared] of Object.entries<KnowledgeImporterCredentialSlot>(input.credentials ?? {})) {
    if (!SLOT_NAME.test(slot)) {
      throw new KnowledgeImporterDefinitionError(
        `Importer "${id}" credential slot "${slot}" must be letters, digits and "_", starting with a letter.`,
      );
    }
    if (!declared || typeof declared.description !== 'string' || !declared.description.trim()) {
      throw new KnowledgeImporterDefinitionError(`Importer "${id}" credential slot "${slot}" needs a description.`);
    }
    credentials[slot as TSlot] = Object.freeze({ description: declared.description, secret: declared.secret ?? true });
  }
  Object.freeze(credentials);

  let settingsSchema: StandardSchemaWithJSON | undefined;
  let settingsJsonSchema: JSONSchema7 = EMPTY_KNOWLEDGE_IMPORTER_SETTINGS_SCHEMA;
  if (input.settings !== undefined) {
    try {
      settingsSchema = toStandardSchema(input.settings) as StandardSchemaWithJSON;
      settingsJsonSchema = standardSchemaToJSONSchema(settingsSchema, { io: 'input', target: 'draft-07' });
    } catch (error) {
      throw new KnowledgeImporterDefinitionError(
        `Importer "${id}" settings schema can't be turned into JSON Schema: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    const outside = jsonSchemaRefs(settingsJsonSchema).find(ref => !ref.startsWith('#'));
    if (outside) {
      throw new KnowledgeImporterDefinitionError(
        `Importer "${id}" settings schema refers outside itself ($ref "${outside}").`,
      );
    }
  }

  const manifest: KnowledgeImporterManifest = {
    id,
    label,
    ...(description !== undefined && { description }),
    ...(iconUrl !== undefined && { iconUrl }),
    settingsSchema: settingsJsonSchema,
    credentials: Object.fromEntries(
      Object.entries<Required<KnowledgeImporterCredentialSlot>>(credentials).map(([slot, declared]) => [
        slot,
        { ...declared },
      ]),
    ),
    ...(defaultSchedule !== undefined && { defaultSchedule }),
  };

  return Object.freeze({
    id,
    label,
    description,
    iconUrl,
    defaultSchedule,
    credentials,
    async parseSettings(value: unknown): Promise<SettingsOf<TSchema>> {
      if (!settingsSchema) {
        const empty = value === undefined || (isPlainObject(value) && Object.keys(value).length === 0);
        if (!empty) {
          throw new KnowledgeImporterSettingsError(`Importer "${id}" takes no settings.`, [
            { path: [], message: 'Importer takes no settings' },
          ]);
        }
        return {} as SettingsOf<TSchema>;
      }
      const result = await settingsSchema['~standard'].validate(value);
      if (result.issues) {
        const issues = createStandardSchemaIssuesError(result.issues);
        throw new KnowledgeImporterSettingsError(
          `Settings for importer "${id}" are invalid:\n${issues.message}`,
          issues.errors,
        );
      }
      return result.value as SettingsOf<TSchema>;
    },
    checkCredentials(values: Record<string, unknown> | undefined): Readonly<Record<TSlot, string>> {
      const supplied = values ?? {};
      const unknown = Object.keys(supplied).filter(slot => !Object.hasOwn(credentials, slot));
      if (unknown.length) {
        throw new KnowledgeImporterCredentialsError(
          `Importer "${id}" has no credential slot ${unknown.map(slot => `"${slot}"`).join(', ')}.`,
        );
      }
      const missing = Object.keys(credentials).filter(slot => {
        const value = supplied[slot];
        return typeof value !== 'string' || value.length === 0;
      });
      if (missing.length) {
        throw new KnowledgeImporterCredentialsError(
          `Importer "${id}" is missing credential ${missing.map(slot => `"${slot}"`).join(', ')}.`,
        );
      }
      return Object.freeze({ ...supplied }) as Readonly<Record<TSlot, string>>;
    },
    sync: input.sync,
    toManifest: () => structuredClone(manifest),
  });
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Indexes definitions by id, refusing two with the same id.
 *
 * @experimental
 */
export function knowledgeImporterRegistry(
  definitions: readonly KnowledgeImporterDefinition<any, any>[],
): ReadonlyMap<string, KnowledgeImporterDefinition<any, any>> {
  const registry = new Map<string, KnowledgeImporterDefinition<any, any>>();
  for (const definition of definitions) {
    if (registry.has(definition.id)) {
      throw new KnowledgeImporterDefinitionError(`Two importer definitions have the id "${definition.id}".`);
    }
    registry.set(definition.id, definition);
  }
  return registry;
}
