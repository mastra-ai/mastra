import { PlatformClient, type PlatformClientOptions } from './client.js';

export type JsonPrimitive = null | boolean | number | string;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type SandboxTemplateMethod =
  | 'cpuCount'
  | 'memoryMB'
  | 'runCmd'
  | 'setWorkdir'
  | 'setEnvs'
  | 'aptInstall'
  | 'pipInstall'
  | 'npmInstall';

export interface SandboxTemplateOperation {
  method: SandboxTemplateMethod;
  args: JsonValue[];
}

export interface SerializedSandboxTemplate {
  schemaVersion: 1;
  operations: SandboxTemplateOperation[];
  /**
   * Optional caller-supplied family key that groups successive builds of
   * the "same thing" — e.g. the same repository+workdir across commits,
   * the same recipe across parameter tweaks. For E2B, Platform MAY boot
   * from a prior member with matching effective CPU and memory while the
   * exact template builds in the background. Railway doesn't use family
   * fallback. The server strips this key from exact content identity, so
   * definitions differing only by family share one cache slot; different
   * operations still produce distinct exact builds. Family drives stale
   * lookup separately. Set by builders like `createRepoTemplate`; clients
   * rarely set it directly.
   */
  family?: string;
}

export interface AptInstallOptions {
  noInstallRecommends?: boolean;
  fixMissing?: boolean;
}

export interface PipInstallOptions {
  g?: boolean;
}

export interface NpmInstallOptions {
  g?: boolean;
  dev?: boolean;
}

export interface SetEnvsOptions {
  /**
   * Keep these values outside the serialized definition, content identity,
   * and persistent template record. They are supplied only to the live
   * provider build request.
   */
  ephemeral?: boolean;
}

export interface SandboxTemplateBuildOptions extends PlatformClientOptions {
  environmentId?: string;
}

export interface SandboxTemplateBuildResult {
  status: 'ready' | 'pending' | 'failed';
  templateId: string;
  retryAfterMs?: number;
  error?: string;
}

export interface SandboxTemplateBuilder {
  /**
   * Set the E2B template's CPU count. Defaults to 2. Railway ignores this
   * setting because its sandbox template API doesn't expose resource limits.
   */
  cpuCount(count: number): SandboxTemplateBuilder;
  /**
   * Set the E2B template's memory in megabytes. Defaults to 1,024. Railway
   * ignores this setting because its sandbox template API doesn't expose
   * resource limits.
   */
  memoryMB(memoryMB: number): SandboxTemplateBuilder;
  /** Start or reuse this template's provider build without provisioning a sandbox. */
  build(options?: SandboxTemplateBuildOptions): Promise<SandboxTemplateBuildResult>;
  runCmd(command: string | string[]): SandboxTemplateBuilder;
  setWorkdir(path: string): SandboxTemplateBuilder;
  /**
   * Set build environment values. Ephemeral values are sent outside the
   * serialized definition, are unavailable at runtime, and override serialized
   * values with the same key.
   */
  setEnvs(envs: Record<string, string>, options?: SetEnvsOptions): SandboxTemplateBuilder;
  aptInstall(packages: string | string[], options?: AptInstallOptions): SandboxTemplateBuilder;
  pipInstall(packages?: string | string[], options?: PipInstallOptions): SandboxTemplateBuilder;
  npmInstall(packages?: string | string[], options?: NpmInstallOptions): SandboxTemplateBuilder;
  /**
   * Attach a family key that groups successive builds of the same
   * underlying thing (e.g. a repository+workdir across commits). For E2B,
   * Platform can boot from a prior build with matching effective CPU and
   * memory while the exact template builds. Railway doesn't use family
   * fallback. Excluded from exact content identity — definitions differing
   * only by family share one cache slot, while different operations remain
   * distinct exact builds. Family drives stale lookup separately.
   */
  withFamily(family: string): SandboxTemplateBuilder;
}

const SERIALIZE_TEMPLATE = Symbol('serializeTemplate');
const GET_TEMPLATE_BUILD_ENVS = Symbol('getTemplateBuildEnvs');
const MAX_OPERATIONS = 256;
const MAX_SERIALIZED_BYTES = 256 * 1024;
const MAX_STRING_LENGTH = 32 * 1024;
const MAX_COLLECTION_ITEMS = 512;

const MAX_FAMILY_LENGTH = 200;

class SerializableSandboxTemplateBuilder implements SandboxTemplateBuilder {
  readonly #operations: readonly SandboxTemplateOperation[];
  readonly #family: string | undefined;
  readonly #buildEnvs: Readonly<Record<string, string>>;

  constructor(
    operations: readonly SandboxTemplateOperation[] = [],
    family?: string,
    buildEnvs: Readonly<Record<string, string>> = {},
  ) {
    this.#operations = operations;
    this.#family = family;
    this.#buildEnvs = buildEnvs;
  }

  cpuCount(count: number): SandboxTemplateBuilder {
    return this.#append('cpuCount', [validateResourceValue(count, 'count')]);
  }

  memoryMB(memoryMB: number): SandboxTemplateBuilder {
    return this.#append('memoryMB', [validateResourceValue(memoryMB, 'memoryMB')]);
  }

  async build(options: SandboxTemplateBuildOptions = {}): Promise<SandboxTemplateBuildResult> {
    return buildSandboxTemplate(this, options);
  }

  runCmd(command: string | string[]): SandboxTemplateBuilder {
    return this.#append('runCmd', [validateStringOrStrings(command, 'command')]);
  }

  setWorkdir(path: string): SandboxTemplateBuilder {
    return this.#append('setWorkdir', [validateString(path, 'path')]);
  }

  setEnvs(envs: Record<string, string>, options?: SetEnvsOptions): SandboxTemplateBuilder {
    const copy = validateStringRecord(envs, 'envs', 'environment variable');
    const validatedOptions = options === undefined ? undefined : validateBooleanOptions(options, ['ephemeral']);
    if (validatedOptions?.ephemeral === true) {
      return new SerializableSandboxTemplateBuilder(this.#operations, this.#family, {
        ...this.#buildEnvs,
        ...copy,
      });
    }
    return this.#append('setEnvs', [copy]);
  }

  aptInstall(packages: string | string[], options?: AptInstallOptions): SandboxTemplateBuilder {
    const args: JsonValue[] = [validateStringOrStrings(packages, 'packages')];
    if (options !== undefined) args.push(validateBooleanOptions(options, ['noInstallRecommends', 'fixMissing']));
    return this.#append('aptInstall', args);
  }

  pipInstall(packages?: string | string[], options?: PipInstallOptions): SandboxTemplateBuilder {
    return this.#appendOptionalInstall('pipInstall', packages, options, ['g']);
  }

  npmInstall(packages?: string | string[], options?: NpmInstallOptions): SandboxTemplateBuilder {
    return this.#appendOptionalInstall('npmInstall', packages, options, ['g', 'dev']);
  }

  withFamily(family: string): SandboxTemplateBuilder {
    if (typeof family !== 'string' || family.length === 0) {
      throw new TypeError('family must be a non-empty string');
    }
    if (family.length > MAX_FAMILY_LENGTH) {
      throw new RangeError(`family cannot exceed ${MAX_FAMILY_LENGTH} characters`);
    }
    assertSerializedSize(this.#operations, family);
    return new SerializableSandboxTemplateBuilder(this.#operations, family, this.#buildEnvs);
  }

  [GET_TEMPLATE_BUILD_ENVS](): Record<string, string> | undefined {
    return Object.keys(this.#buildEnvs).length > 0 ? { ...this.#buildEnvs } : undefined;
  }

  [SERIALIZE_TEMPLATE](): SerializedSandboxTemplate {
    return {
      schemaVersion: 1,
      operations: this.#operations.map(operation => ({
        method: operation.method,
        args: cloneJson(operation.args),
      })),
      ...(this.#family !== undefined && { family: this.#family }),
    };
  }

  #appendOptionalInstall(
    method: 'pipInstall' | 'npmInstall',
    packages: string | string[] | undefined,
    options: PipInstallOptions | NpmInstallOptions | undefined,
    optionKeys: readonly string[],
  ): SandboxTemplateBuilder {
    const args: JsonValue[] = [];
    if (packages !== undefined) args.push(validateStringOrStrings(packages, 'packages'));
    if (options !== undefined) {
      if (packages === undefined) args.push(null);
      args.push(validateBooleanOptions(options, optionKeys));
    }
    return this.#append(method, args);
  }

  #append(method: SandboxTemplateMethod, args: JsonValue[]): SandboxTemplateBuilder {
    if (this.#operations.length >= MAX_OPERATIONS) {
      throw new RangeError(`Sandbox template cannot contain more than ${MAX_OPERATIONS} operations`);
    }

    const operation = { method, args: cloneJson(args) } satisfies SandboxTemplateOperation;
    const operations = [...this.#operations, operation];
    assertSerializedSize(operations, this.#family);

    return new SerializableSandboxTemplateBuilder(operations, this.#family, this.#buildEnvs);
  }
}

function assertSerializedSize(operations: readonly SandboxTemplateOperation[], family: string | undefined): void {
  const serialized = JSON.stringify({
    schemaVersion: 1,
    operations,
    ...(family !== undefined && { family }),
  });
  if (new TextEncoder().encode(serialized).byteLength > MAX_SERIALIZED_BYTES) {
    throw new RangeError(`Serialized sandbox template cannot exceed ${MAX_SERIALIZED_BYTES} bytes`);
  }
}

export function Template(): SandboxTemplateBuilder {
  return new SerializableSandboxTemplateBuilder();
}

function isSandboxTemplateBuilder(value: unknown): value is SerializableSandboxTemplateBuilder {
  return value instanceof SerializableSandboxTemplateBuilder;
}

export function serializeSandboxTemplate(template: SandboxTemplateBuilder): SerializedSandboxTemplate {
  if (!isSandboxTemplateBuilder(template)) throw new TypeError('template must be created with Template()');
  return template[SERIALIZE_TEMPLATE]();
}

export function getSandboxTemplateBuildEnvs(template: SandboxTemplateBuilder): Record<string, string> | undefined {
  if (!isSandboxTemplateBuilder(template)) throw new TypeError('template must be created with Template()');
  return template[GET_TEMPLATE_BUILD_ENVS]();
}

async function buildSandboxTemplate(
  template: SandboxTemplateBuilder,
  options: SandboxTemplateBuildOptions,
): Promise<SandboxTemplateBuildResult> {
  const environmentId = options.environmentId ?? process.env.MASTRA_ENVIRONMENT_ID;
  if (!environmentId) {
    throw new Error('environmentId is required. Pass it or set MASTRA_ENVIRONMENT_ID.');
  }

  const client = new PlatformClient(options);
  const templateBuildEnvs = getSandboxTemplateBuildEnvs(template);
  const response = await client.requestProvider('/sandbox/templates/builds', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      environmentId,
      templateDefinition: serializeSandboxTemplate(template),
      ...(templateBuildEnvs !== undefined && { templateBuildEnvs }),
    }),
  });
  return (await response.json()) as SandboxTemplateBuildResult;
}

function validateResourceValue(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError(`${name} must be a positive safe integer`);
  }
  return value;
}

function validateString(value: unknown, name: string, allowEmpty = false): string {
  if (typeof value !== 'string') throw new TypeError(`${name} must be a string`);
  if (!allowEmpty && value.length === 0) throw new TypeError(`${name} must not be empty`);
  if (value.length > MAX_STRING_LENGTH) {
    throw new RangeError(`${name} cannot exceed ${MAX_STRING_LENGTH} characters`);
  }
  return value;
}

function validateStringOrStrings(value: unknown, name: string): string | string[] {
  if (typeof value === 'string') return validateString(value, name);
  if (!Array.isArray(value)) throw new TypeError(`${name} must be a string or an array of strings`);
  assertCollectionSize(value.length, name);
  if (value.length === 0) throw new TypeError(`${name} must not be empty`);
  return Array.from(value, (item, index) => validateString(item, `${name}[${index}]`));
}

function validateStringRecord(value: unknown, name: string, entryName: string): Record<string, string> {
  assertPlainObject(value, name);
  const entries = Object.entries(value);
  assertCollectionSize(entries.length, name);
  return Object.fromEntries(
    entries.map(([key, item]) => [
      validateString(key, `${entryName} name`),
      validateString(item, `${entryName} ${key}`, true),
    ]),
  );
}

function validateBooleanOptions(value: unknown, keys: readonly string[]): Record<string, boolean> {
  assertPlainObject(value, 'options');
  const options = value as Record<string, unknown>;
  const unknownKey = Object.keys(options).find(key => !keys.includes(key));
  if (unknownKey) throw new TypeError(`Unsupported option: ${unknownKey}`);

  const copy: Record<string, boolean> = {};
  for (const key of keys) {
    const option = options[key];
    if (option === undefined) continue;
    if (typeof option !== 'boolean') throw new TypeError(`${key} must be a boolean`);
    copy[key] = option;
  }
  return copy;
}

function assertPlainObject(value: unknown, name: string): asserts value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`${name} must be a plain object`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError(`${name} must be a plain object`);
  }
}

function assertCollectionSize(size: number, name: string): void {
  if (size > MAX_COLLECTION_ITEMS) {
    throw new RangeError(`${name} cannot contain more than ${MAX_COLLECTION_ITEMS} items`);
  }
}

function cloneJson<T extends JsonValue>(value: T): T {
  if (Array.isArray(value)) return value.map(item => cloneJson(item)) as T;
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneJson(item)])) as T;
  }
  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw new TypeError('Sandbox template values must contain only finite numbers');
  }
  return value;
}
