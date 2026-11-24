import type { JSONSchema7 } from 'json-schema';
import { standardSchemaToJSONSchema, toStandardSchema } from '../../schema';
import type { InferPublicSchema, PublicSchema, StandardSchemaWithJSON } from '../../schema';
import { createStandardSchemaIssuesError } from '../../tools/validation';
import type { KnowledgeImporterRunBinding } from './host';
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
 * `state.set` is called, and when `import` returns. Await them, so a full buffer can flush.
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
   * The source fetch, bound to `signal`: the runner's `fetch` option, else the platform fetch. A
   * signal passed in `init` is combined with `signal`, so either one aborts the fetch. It
   * doesn't retry; on hosts that keep the credentials it may be a relay. A source's error status
   * comes back as a response; throw `KnowledgeImporterSourceError` to fail the run with it.
   */
  fetch: (input: string | URL, init?: RequestInit) => Promise<Response>;
  state: KnowledgeImporterStateStore;
  items: KnowledgeImporterItems;
  /**
   * This pass stopped at its own cap with more to read (its cursor is saved). The runner calls
   * `import` again while the run has time, and the host may chain another run when it doesn't.
   */
  reportBacklog(): void;
}

type SettingsOf<TSchema> = TSchema extends PublicSchema<any, any> ? InferPublicSchema<TSchema> : Record<string, never>;

/** The settings as a binding supplies them: the schema's input side, before defaults. */
type SettingsInputOf<TSchema> = TSchema extends { _input: infer Input }
  ? Input
  : TSchema extends { '~standard': { types?: infer Types } }
    ? NonNullable<Types> extends { input: infer Input }
      ? Input
      : SettingsOf<TSchema>
    : SettingsOf<TSchema>;

/** What the class declares: `KnowledgeImporter({ ... })`. @experimental */
export interface KnowledgeImporterDefinitionInput<TSchema, TSlot extends string> {
  /** Stable key: bindings and run history name the importer by it. Lowercase letters, digits, `-` and `_`. */
  id: string;
  label: string;
  description?: string;
  /** An http(s) URL or a `data:image/` URI. */
  iconUrl?: string;
  settings?: TSchema;
  credentials?: Record<TSlot, KnowledgeImporterCredentialSlot>;
}

/** The checked definition an importer class carries, read without constructing it. @experimental */
export interface KnowledgeImporterDefinition<TSettings = unknown, TSlot extends string = string> {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
  readonly iconUrl?: string;
  readonly credentials: Readonly<Record<TSlot, Required<KnowledgeImporterCredentialSlot>>>;
  /** Validates a binding's settings against the definition's schema. */
  parseSettings(value: unknown): Promise<TSettings>;
  /** Checks a binding supplies exactly the declared slots, each a non-empty string. */
  checkCredentials(values: Record<string, unknown> | undefined): Readonly<Record<TSlot, string>>;
  toManifest(): KnowledgeImporterManifest;
}

/**
 * One configured source: where the importer writes and with what. Settings are checked against the
 * schema when a run starts; credentials when the instance is constructed.
 *
 * @experimental
 */
export type KnowledgeImporterBindingInput<TInput = unknown, TSlot extends string = string> = {
  /** Stable binding id: run history and page ownership key on it. Keep it when you edit the binding. */
  id: string;
  /** Where the pages go, `<scope>#<path>`. */
  target: string;
} & ({} extends TInput ? { settings?: TInput } : { settings: TInput }) &
  ([TSlot] extends [never] ? { credentials?: Record<string, never> } : { credentials: Record<TSlot, string> });

/**
 * The base every importer extends through {@link KnowledgeImporter}. An instance is one binding;
 * `import` is called once per pass of a run.
 *
 * @experimental
 */
export abstract class KnowledgeImporterBase<TSettings = any, TSlot extends string = any, TInput = TSettings> {
  /** What the instance was constructed with, as the host sees a binding. */
  readonly binding: Readonly<KnowledgeImporterRunBinding>;

  constructor(binding: KnowledgeImporterBindingInput<TInput, TSlot>) {
    const definition = (new.target as Partial<KnowledgeImporterClass>).definition;
    if (!definition) {
      throw new KnowledgeImporterDefinitionError('Importer classes extend KnowledgeImporter({ ... }).');
    }
    const input = binding as {
      id?: unknown;
      target?: unknown;
      settings?: unknown;
      credentials?: Record<string, unknown>;
    };
    if (typeof input?.id !== 'string' || !input.id.trim()) {
      throw new KnowledgeImporterDefinitionError(`A "${definition.id}" importer binding needs an id.`);
    }
    if (typeof input.target !== 'string' || !input.target.trim()) {
      throw new KnowledgeImporterDefinitionError(`Importer binding "${input.id}" needs a target ("<scope>#<path>").`);
    }
    this.binding = Object.freeze({
      id: input.id,
      importer: definition.id,
      target: input.target,
      settings: input.settings ?? {},
      credentials: { ...definition.checkCredentials(input.credentials) },
    });
  }

  /**
   * Reads the source and writes items through `ctx.items`, saving a cursor with `ctx.state.set`.
   * A full import and an incremental one are the same method: read the cursor, carry on from it.
   */
  abstract import(ctx: KnowledgeImporterContext<TSettings, TSlot>): Promise<void>;
}

/** An importer class: what a host registers and constructs from a stored binding. @experimental */
export interface KnowledgeImporterClass<TSettings = any, TSlot extends string = any, TInput = any> {
  new (binding: KnowledgeImporterBindingInput<TInput, TSlot>): KnowledgeImporterBase<TSettings, TSlot, TInput>;
  readonly id: string;
  readonly definition: KnowledgeImporterDefinition<TSettings, TSlot>;
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

/**
 * The host failed, not the source: a fetch proxy or relay, or a remote host's flush, heartbeat or
 * finish. Never a sign an item is gone. `status` is the HTTP status when there was a response;
 * absent for a network error. @experimental
 */
export class KnowledgeImporterHostError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
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
 * The base class of an importer: code that reads a source and writes it into Knowledge as items.
 * The class declares what it is (id, label, settings schema, credential slots); each instance is
 * one binding (where it writes, with which settings and credentials).
 *
 * ```ts
 * class HelpSpotImporter extends KnowledgeImporter({
 *   id: 'helpspot',
 *   label: 'HelpSpot',
 *   settings: z.object({ baseUrl: z.url() }),
 *   credentials: { apiKey: { description: 'HelpSpot API token' } },
 * }) {
 *   async import(ctx) {
 *     // read ctx.state.get('cursor'), ctx.items.upsert(...), ctx.state.set('cursor', ...)
 *   }
 * }
 *
 * new HelpSpotImporter({ id: 'support', target: 'docs#support', settings: { baseUrl }, credentials: { apiKey } });
 * ```
 *
 * Invalid declarations throw `KnowledgeImporterDefinitionError` here, not at the first run.
 *
 * @experimental
 */
export function KnowledgeImporter<
  TSchema extends PublicSchema<any, any> | undefined = undefined,
  TSlot extends string = never,
>(
  input: KnowledgeImporterDefinitionInput<TSchema, TSlot>,
): (abstract new (
  binding: KnowledgeImporterBindingInput<SettingsInputOf<TSchema>, TSlot>,
) => KnowledgeImporterBase<SettingsOf<TSchema>, TSlot, SettingsInputOf<TSchema>>) & {
  readonly id: string;
  readonly definition: KnowledgeImporterDefinition<SettingsOf<TSchema>, TSlot>;
  toManifest(): KnowledgeImporterManifest;
} {
  const definition = defineImporter<TSchema, TSlot>(input);
  abstract class Importer extends KnowledgeImporterBase<SettingsOf<TSchema>, TSlot, SettingsInputOf<TSchema>> {
    static readonly id = definition.id;
    static readonly definition = definition;
    static toManifest(): KnowledgeImporterManifest {
      return definition.toManifest();
    }
  }
  return Importer;
}

function defineImporter<TSchema extends PublicSchema<any, any> | undefined, TSlot extends string>(
  input: KnowledgeImporterDefinitionInput<TSchema, TSlot>,
): KnowledgeImporterDefinition<SettingsOf<TSchema>, TSlot> {
  const { id, label, description, iconUrl } = input ?? ({} as typeof input);
  if (typeof id !== 'string' || !IMPORTER_ID.test(id)) {
    throw new KnowledgeImporterDefinitionError(
      `Importer id "${String(id)}" must be 1-64 lowercase letters, digits, "-" or "_", starting with a letter.`,
    );
  }
  if (typeof label !== 'string' || !label.trim()) {
    throw new KnowledgeImporterDefinitionError(`Importer "${id}" needs a label.`);
  }
  if (iconUrl !== undefined) checkIconUrl(id, iconUrl);

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
  };

  return Object.freeze({
    id,
    label,
    description,
    iconUrl,
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
    toManifest: () => structuredClone(manifest),
  });
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Indexes importer classes by id, refusing two different classes with the same id. A host uses it
 * to construct the instance a stored binding names.
 *
 * @experimental
 */
export function knowledgeImporterRegistry(
  importers: readonly KnowledgeImporterClass[],
): ReadonlyMap<string, KnowledgeImporterClass> {
  const registry = new Map<string, KnowledgeImporterClass>();
  for (const importer of importers) {
    const known = registry.get(importer.id);
    if (known && known !== importer) {
      throw new KnowledgeImporterDefinitionError(`Two importer classes have the id "${importer.id}".`);
    }
    registry.set(importer.id, importer);
  }
  return registry;
}
