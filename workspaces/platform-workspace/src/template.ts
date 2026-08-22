import { createHash } from 'node:crypto';

export type JsonPrimitive = null | boolean | number | string;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type SandboxTemplateMethod = 'runCmd' | 'setWorkdir' | 'setEnvs' | 'aptInstall' | 'pipInstall' | 'npmInstall';

export interface SandboxTemplateOperation {
  method: SandboxTemplateMethod;
  args: JsonValue[];
}

export interface SandboxTemplateGitSource {
  type: 'git';
  familyId: string;
  commitSha: string;
  staleWhileRevalidate?: boolean;
}

export type SandboxTemplateSource = SandboxTemplateGitSource;

export interface SerializedSandboxTemplate {
  schemaVersion: 1;
  source?: SandboxTemplateSource;
  operations: SandboxTemplateOperation[];
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

export interface SandboxTemplateBuilder {
  id(): string;
  runCmd(command: string | string[]): SandboxTemplateBuilder;
  setWorkdir(path: string): SandboxTemplateBuilder;
  setEnvs(envs: Record<string, string>): SandboxTemplateBuilder;
  aptInstall(packages: string | string[], options?: AptInstallOptions): SandboxTemplateBuilder;
  pipInstall(packages?: string | string[], options?: PipInstallOptions): SandboxTemplateBuilder;
  npmInstall(packages?: string | string[], options?: NpmInstallOptions): SandboxTemplateBuilder;
}

const SERIALIZE_TEMPLATE = Symbol('serializeTemplate');
const MAX_OPERATIONS = 256;
const MAX_SERIALIZED_BYTES = 256 * 1024;
const MAX_STRING_LENGTH = 32 * 1024;
const MAX_COLLECTION_ITEMS = 512;

class SerializableSandboxTemplateBuilder implements SandboxTemplateBuilder {
  readonly #operations: readonly SandboxTemplateOperation[];
  readonly #source: SandboxTemplateSource | undefined;

  constructor(operations: readonly SandboxTemplateOperation[] = [], source?: SandboxTemplateSource) {
    this.#operations = operations;
    this.#source = source;
  }

  id(): string {
    return createHash('sha256')
      .update(canonicalizeJson(templateIdentityDefinition(this[SERIALIZE_TEMPLATE]())))
      .digest('hex');
  }

  runCmd(command: string | string[]): SandboxTemplateBuilder {
    return this.#append('runCmd', [validateStringOrStrings(command, 'command')]);
  }

  setWorkdir(path: string): SandboxTemplateBuilder {
    return this.#append('setWorkdir', [validateString(path, 'path')]);
  }

  setEnvs(envs: Record<string, string>): SandboxTemplateBuilder {
    assertPlainObject(envs, 'envs');
    const entries = Object.entries(envs);
    assertCollectionSize(entries.length, 'envs');

    const copy = Object.fromEntries(
      entries.map(([key, value]) => [
        validateString(key, 'environment variable name'),
        validateString(value, `environment variable ${key}`, true),
      ]),
    );
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

  [SERIALIZE_TEMPLATE](): SerializedSandboxTemplate {
    return {
      schemaVersion: 1,
      ...(this.#source ? { source: { ...this.#source } } : {}),
      operations: this.#operations.map(operation => ({
        method: operation.method,
        args: cloneJson(operation.args),
      })),
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
    const serialized = JSON.stringify({
      schemaVersion: 1,
      ...(this.#source ? { source: this.#source } : {}),
      operations,
    });
    if (new TextEncoder().encode(serialized).byteLength > MAX_SERIALIZED_BYTES) {
      throw new RangeError(`Serialized sandbox template cannot exceed ${MAX_SERIALIZED_BYTES} bytes`);
    }

    return new SerializableSandboxTemplateBuilder(operations, this.#source);
  }
}

export function Template(): SandboxTemplateBuilder {
  return new SerializableSandboxTemplateBuilder();
}

export function createSandboxTemplate(source: SandboxTemplateSource): SandboxTemplateBuilder {
  return new SerializableSandboxTemplateBuilder([], { ...source });
}

function isSandboxTemplateBuilder(value: unknown): value is SerializableSandboxTemplateBuilder {
  return value instanceof SerializableSandboxTemplateBuilder;
}

export function serializeSandboxTemplate(template: SandboxTemplateBuilder): SerializedSandboxTemplate {
  if (!isSandboxTemplateBuilder(template)) throw new TypeError('template must be created with Template()');
  return template[SERIALIZE_TEMPLATE]();
}

function templateIdentityDefinition(definition: SerializedSandboxTemplate): SerializedSandboxTemplate {
  const source = definition.source;
  if (source?.staleWhileRevalidate !== true) return definition;
  return {
    ...definition,
    source: {
      type: source.type,
      familyId: source.familyId,
      commitSha: source.commitSha,
    },
  };
}

function canonicalizeJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalizeJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value).sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
    return `{${entries.map(([key, nested]) => `${JSON.stringify(key)}:${canonicalizeJson(nested)}`).join(',')}}`;
  }
  const serialized = JSON.stringify(value);
  if (serialized === undefined) throw new TypeError('template contains a non-JSON value');
  return serialized;
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
