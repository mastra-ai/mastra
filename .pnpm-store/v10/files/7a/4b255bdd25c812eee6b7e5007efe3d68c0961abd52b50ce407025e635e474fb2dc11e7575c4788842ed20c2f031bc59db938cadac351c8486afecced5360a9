import type { Importer } from './index.js';
import type FileState from '../FileState.js';
interface FsImporterCache {
    parseCache: Map<string, FileState>;
    resolveCache: Map<string, string | null>;
}
export default function makeFsImporter(lookupModule?: (filename: string, basedir: string) => string, { parseCache, resolveCache }?: FsImporterCache): Importer;
export {};
