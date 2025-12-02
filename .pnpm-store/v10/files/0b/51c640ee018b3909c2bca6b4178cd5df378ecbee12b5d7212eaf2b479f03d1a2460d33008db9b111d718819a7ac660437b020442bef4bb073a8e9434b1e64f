"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileMigrationProvider = void 0;
const object_utils_js_1 = require("../util/object-utils.js");
/**
 * Reads all migrations from a folder in node.js.
 *
 * ### Examples
 *
 * ```ts
 * import { promises as fs } from 'node:fs'
 * import path from 'node:path'
 *
 * new FileMigrationProvider({
 *   fs,
 *   path,
 *   migrationFolder: 'path/to/migrations/folder'
 * })
 * ```
 */
class FileMigrationProvider {
    #props;
    constructor(props) {
        this.#props = props;
    }
    async getMigrations() {
        const migrations = {};
        const files = await this.#props.fs.readdir(this.#props.migrationFolder);
        for (const fileName of files) {
            if (fileName.endsWith('.js') ||
                (fileName.endsWith('.ts') && !fileName.endsWith('.d.ts')) ||
                fileName.endsWith('.mjs') ||
                (fileName.endsWith('.mts') && !fileName.endsWith('.d.mts'))) {
                const migration = await Promise.resolve(`${
                /* webpackIgnore: true */ this.#props.path.join(this.#props.migrationFolder, fileName)}`).then(s => require(s));
                const migrationKey = fileName.substring(0, fileName.lastIndexOf('.'));
                // Handle esModuleInterop export's `default` prop...
                if (isMigration(migration?.default)) {
                    migrations[migrationKey] = migration.default;
                }
                else if (isMigration(migration)) {
                    migrations[migrationKey] = migration;
                }
            }
        }
        return migrations;
    }
}
exports.FileMigrationProvider = FileMigrationProvider;
function isMigration(obj) {
    return (0, object_utils_js_1.isObject)(obj) && (0, object_utils_js_1.isFunction)(obj.up);
}
