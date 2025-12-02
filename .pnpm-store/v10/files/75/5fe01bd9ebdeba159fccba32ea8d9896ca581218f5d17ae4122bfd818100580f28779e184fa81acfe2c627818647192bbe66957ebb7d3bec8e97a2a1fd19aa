/* eslint-disable @typescript-eslint/naming-convention, @typescript-eslint/no-unsafe-return */
import { isDeepStrictEqual } from 'node:util';
import process from 'node:process';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert';
import { getProperty, hasProperty, setProperty, deleteProperty, } from 'dot-prop';
import envPaths from 'env-paths';
import { writeFileSync as atomicWriteFileSync } from 'atomically';
import { Ajv2020 as Ajv } from 'ajv/dist/2020.js';
import ajvFormatsModule from 'ajv-formats';
import debounceFn from 'debounce-fn';
import semver from 'semver';
import { concatUint8Arrays, stringToUint8Array, uint8ArrayToString, } from 'uint8array-extras';
// FIXME: https://github.com/ajv-validator/ajv/issues/2047
const ajvFormats = ajvFormatsModule.default;
const encryptionAlgorithm = 'aes-256-cbc';
const createPlainObject = () => Object.create(null);
const isExist = (data) => data !== undefined && data !== null;
const checkValueType = (key, value) => {
    const nonJsonTypes = new Set([
        'undefined',
        'symbol',
        'function',
    ]);
    const type = typeof value;
    if (nonJsonTypes.has(type)) {
        throw new TypeError(`Setting a value of type \`${type}\` for key \`${key}\` is not allowed as it's not supported by JSON`);
    }
};
const INTERNAL_KEY = '__internal__';
const MIGRATION_KEY = `${INTERNAL_KEY}.migrations.version`;
export default class Conf {
    path;
    events;
    #validator;
    #encryptionKey;
    #options;
    #defaultValues = {};
    constructor(partialOptions = {}) {
        const options = {
            configName: 'config',
            fileExtension: 'json',
            projectSuffix: 'nodejs',
            clearInvalidConfig: false,
            accessPropertiesByDotNotation: true,
            configFileMode: 0o666,
            ...partialOptions,
        };
        if (!options.cwd) {
            if (!options.projectName) {
                throw new Error('Please specify the `projectName` option.');
            }
            options.cwd = envPaths(options.projectName, { suffix: options.projectSuffix }).config;
        }
        this.#options = options;
        if (options.schema ?? options.ajvOptions ?? options.rootSchema) {
            if (options.schema && typeof options.schema !== 'object') {
                throw new TypeError('The `schema` option must be an object.');
            }
            const ajv = new Ajv({
                allErrors: true,
                useDefaults: true,
                ...options.ajvOptions,
            });
            ajvFormats(ajv);
            const schema = {
                ...options.rootSchema,
                type: 'object',
                properties: options.schema,
            };
            this.#validator = ajv.compile(schema);
            for (const [key, value] of Object.entries(options.schema ?? {})) { // TODO: Remove the `as any`.
                if (value?.default) {
                    this.#defaultValues[key] = value.default; // eslint-disable-line @typescript-eslint/no-unsafe-assignment
                }
            }
        }
        if (options.defaults) {
            this.#defaultValues = {
                ...this.#defaultValues,
                ...options.defaults,
            };
        }
        if (options.serialize) {
            this._serialize = options.serialize;
        }
        if (options.deserialize) {
            this._deserialize = options.deserialize;
        }
        this.events = new EventTarget();
        this.#encryptionKey = options.encryptionKey;
        const fileExtension = options.fileExtension ? `.${options.fileExtension}` : '';
        this.path = path.resolve(options.cwd, `${options.configName ?? 'config'}${fileExtension}`);
        const fileStore = this.store;
        const store = Object.assign(createPlainObject(), options.defaults, fileStore);
        if (options.migrations) {
            if (!options.projectVersion) {
                throw new Error('Please specify the `projectVersion` option.');
            }
            this._migrate(options.migrations, options.projectVersion, options.beforeEachMigration);
        }
        // We defer validation until after migrations are applied so that the store can be updated to the current schema.
        this._validate(store);
        try {
            assert.deepEqual(fileStore, store);
        }
        catch {
            this.store = store;
        }
        if (options.watch) {
            this._watch();
        }
    }
    get(key, defaultValue) {
        if (this.#options.accessPropertiesByDotNotation) {
            return this._get(key, defaultValue);
        }
        const { store } = this;
        return key in store ? store[key] : defaultValue;
    }
    set(key, value) {
        if (typeof key !== 'string' && typeof key !== 'object') {
            throw new TypeError(`Expected \`key\` to be of type \`string\` or \`object\`, got ${typeof key}`);
        }
        if (typeof key !== 'object' && value === undefined) {
            throw new TypeError('Use `delete()` to clear values');
        }
        if (this._containsReservedKey(key)) {
            throw new TypeError(`Please don't use the ${INTERNAL_KEY} key, as it's used to manage this module internal operations.`);
        }
        const { store } = this;
        const set = (key, value) => {
            checkValueType(key, value);
            if (this.#options.accessPropertiesByDotNotation) {
                setProperty(store, key, value);
            }
            else {
                store[key] = value;
            }
        };
        if (typeof key === 'object') {
            const object = key;
            for (const [key, value] of Object.entries(object)) {
                set(key, value);
            }
        }
        else {
            set(key, value);
        }
        this.store = store;
    }
    /**
    Check if an item exists.

    @param key - The key of the item to check.
    */
    has(key) {
        if (this.#options.accessPropertiesByDotNotation) {
            return hasProperty(this.store, key);
        }
        return key in this.store;
    }
    /**
    Reset items to their default values, as defined by the `defaults` or `schema` option.

    @see `clear()` to reset all items.

    @param keys - The keys of the items to reset.
    */
    reset(...keys) {
        for (const key of keys) {
            if (isExist(this.#defaultValues[key])) {
                this.set(key, this.#defaultValues[key]);
            }
        }
    }
    delete(key) {
        const { store } = this;
        if (this.#options.accessPropertiesByDotNotation) {
            deleteProperty(store, key);
        }
        else {
            // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
            delete store[key];
        }
        this.store = store;
    }
    /**
    Delete all items.

    This resets known items to their default values, if defined by the `defaults` or `schema` option.
    */
    clear() {
        this.store = createPlainObject();
        for (const key of Object.keys(this.#defaultValues)) {
            this.reset(key);
        }
    }
    /**
    Watches the given `key`, calling `callback` on any changes.

    @param key - The key to watch.
    @param callback - A callback function that is called on any changes. When a `key` is first set `oldValue` will be `undefined`, and when a key is deleted `newValue` will be `undefined`.
    @returns A function, that when called, will unsubscribe.
    */
    onDidChange(key, callback) {
        if (typeof key !== 'string') {
            throw new TypeError(`Expected \`key\` to be of type \`string\`, got ${typeof key}`);
        }
        if (typeof callback !== 'function') {
            throw new TypeError(`Expected \`callback\` to be of type \`function\`, got ${typeof callback}`);
        }
        return this._handleChange(() => this.get(key), callback);
    }
    /**
    Watches the whole config object, calling `callback` on any changes.

    @param callback - A callback function that is called on any changes. When a `key` is first set `oldValue` will be `undefined`, and when a key is deleted `newValue` will be `undefined`.
    @returns A function, that when called, will unsubscribe.
    */
    onDidAnyChange(callback) {
        if (typeof callback !== 'function') {
            throw new TypeError(`Expected \`callback\` to be of type \`function\`, got ${typeof callback}`);
        }
        return this._handleChange(() => this.store, callback);
    }
    get size() {
        return Object.keys(this.store).length;
    }
    get store() {
        try {
            const data = fs.readFileSync(this.path, this.#encryptionKey ? null : 'utf8');
            const dataString = this._encryptData(data);
            const deserializedData = this._deserialize(dataString);
            this._validate(deserializedData);
            return Object.assign(createPlainObject(), deserializedData);
        }
        catch (error) {
            if (error?.code === 'ENOENT') {
                this._ensureDirectory();
                return createPlainObject();
            }
            if (this.#options.clearInvalidConfig && error.name === 'SyntaxError') {
                return createPlainObject();
            }
            throw error;
        }
    }
    set store(value) {
        this._ensureDirectory();
        this._validate(value);
        this._write(value);
        this.events.dispatchEvent(new Event('change'));
    }
    *[Symbol.iterator]() {
        for (const [key, value] of Object.entries(this.store)) {
            yield [key, value];
        }
    }
    _encryptData(data) {
        if (!this.#encryptionKey) {
            return typeof data === 'string' ? data : uint8ArrayToString(data);
        }
        // Check if an initialization vector has been used to encrypt the data.
        try {
            const initializationVector = data.slice(0, 16);
            const password = crypto.pbkdf2Sync(this.#encryptionKey, initializationVector.toString(), 10_000, 32, 'sha512');
            const decipher = crypto.createDecipheriv(encryptionAlgorithm, password, initializationVector);
            const slice = data.slice(17);
            const dataUpdate = typeof slice === 'string' ? stringToUint8Array(slice) : slice;
            return uint8ArrayToString(concatUint8Arrays([decipher.update(dataUpdate), decipher.final()]));
        }
        catch { }
        return data.toString();
    }
    _handleChange(getter, callback) {
        let currentValue = getter();
        const onChange = () => {
            const oldValue = currentValue;
            const newValue = getter();
            if (isDeepStrictEqual(newValue, oldValue)) {
                return;
            }
            currentValue = newValue;
            callback.call(this, newValue, oldValue);
        };
        this.events.addEventListener('change', onChange);
        return () => {
            this.events.removeEventListener('change', onChange);
        };
    }
    _deserialize = value => JSON.parse(value);
    _serialize = value => JSON.stringify(value, undefined, '\t');
    _validate(data) {
        if (!this.#validator) {
            return;
        }
        const valid = this.#validator(data);
        if (valid || !this.#validator.errors) {
            return;
        }
        const errors = this.#validator.errors
            .map(({ instancePath, message = '' }) => `\`${instancePath.slice(1)}\` ${message}`);
        throw new Error('Config schema violation: ' + errors.join('; '));
    }
    _ensureDirectory() {
        // Ensure the directory exists as it could have been deleted in the meantime.
        fs.mkdirSync(path.dirname(this.path), { recursive: true });
    }
    _write(value) {
        let data = this._serialize(value);
        if (this.#encryptionKey) {
            const initializationVector = crypto.randomBytes(16);
            const password = crypto.pbkdf2Sync(this.#encryptionKey, initializationVector.toString(), 10_000, 32, 'sha512');
            const cipher = crypto.createCipheriv(encryptionAlgorithm, password, initializationVector);
            data = concatUint8Arrays([initializationVector, stringToUint8Array(':'), cipher.update(stringToUint8Array(data)), cipher.final()]);
        }
        // Temporary workaround for Conf being packaged in a Ubuntu Snap app.
        // See https://github.com/sindresorhus/conf/pull/82
        if (process.env.SNAP) {
            fs.writeFileSync(this.path, data, { mode: this.#options.configFileMode });
        }
        else {
            try {
                atomicWriteFileSync(this.path, data, { mode: this.#options.configFileMode });
            }
            catch (error) {
                // Fix for https://github.com/sindresorhus/electron-store/issues/106
                // Sometimes on Windows, we will get an EXDEV error when atomic writing
                // (even though to the same directory), so we fall back to non atomic write
                if (error?.code === 'EXDEV') {
                    fs.writeFileSync(this.path, data, { mode: this.#options.configFileMode });
                    return;
                }
                throw error;
            }
        }
    }
    _watch() {
        this._ensureDirectory();
        if (!fs.existsSync(this.path)) {
            this._write(createPlainObject());
        }
        if (process.platform === 'win32') {
            fs.watch(this.path, { persistent: false }, debounceFn(() => {
                // On Linux and Windows, writing to the config file emits a `rename` event, so we skip checking the event type.
                this.events.dispatchEvent(new Event('change'));
            }, { wait: 100 }));
        }
        else {
            fs.watchFile(this.path, { persistent: false }, debounceFn(() => {
                this.events.dispatchEvent(new Event('change'));
            }, { wait: 5000 }));
        }
    }
    _migrate(migrations, versionToMigrate, beforeEachMigration) {
        let previousMigratedVersion = this._get(MIGRATION_KEY, '0.0.0');
        const newerVersions = Object.keys(migrations)
            .filter(candidateVersion => this._shouldPerformMigration(candidateVersion, previousMigratedVersion, versionToMigrate));
        let storeBackup = { ...this.store };
        for (const version of newerVersions) {
            try {
                if (beforeEachMigration) {
                    beforeEachMigration(this, {
                        fromVersion: previousMigratedVersion,
                        toVersion: version,
                        finalVersion: versionToMigrate,
                        versions: newerVersions,
                    });
                }
                const migration = migrations[version];
                migration?.(this);
                this._set(MIGRATION_KEY, version);
                previousMigratedVersion = version;
                storeBackup = { ...this.store };
            }
            catch (error) {
                this.store = storeBackup;
                throw new Error(`Something went wrong during the migration! Changes applied to the store until this failed migration will be restored. ${error}`);
            }
        }
        if (this._isVersionInRangeFormat(previousMigratedVersion) || !semver.eq(previousMigratedVersion, versionToMigrate)) {
            this._set(MIGRATION_KEY, versionToMigrate);
        }
    }
    _containsReservedKey(key) {
        if (typeof key === 'object') {
            const firsKey = Object.keys(key)[0];
            if (firsKey === INTERNAL_KEY) {
                return true;
            }
        }
        if (typeof key !== 'string') {
            return false;
        }
        if (this.#options.accessPropertiesByDotNotation) {
            if (key.startsWith(`${INTERNAL_KEY}.`)) {
                return true;
            }
            return false;
        }
        return false;
    }
    _isVersionInRangeFormat(version) {
        return semver.clean(version) === null;
    }
    _shouldPerformMigration(candidateVersion, previousMigratedVersion, versionToMigrate) {
        if (this._isVersionInRangeFormat(candidateVersion)) {
            if (previousMigratedVersion !== '0.0.0' && semver.satisfies(previousMigratedVersion, candidateVersion)) {
                return false;
            }
            return semver.satisfies(versionToMigrate, candidateVersion);
        }
        if (semver.lte(candidateVersion, previousMigratedVersion)) {
            return false;
        }
        if (semver.gt(candidateVersion, versionToMigrate)) {
            return false;
        }
        return true;
    }
    _get(key, defaultValue) {
        return getProperty(this.store, key, defaultValue);
    }
    _set(key, value) {
        const { store } = this;
        setProperty(store, key, value);
        this.store = store;
    }
}
