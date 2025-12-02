import type { NodePath } from '@babel/traverse';
import type { ExportAllDeclaration, ExportNamedDeclaration, ImportDeclaration } from '@babel/types';
import type FileState from '../FileState.js';
import ignoreImporter from './ignoreImporter.js';
import fsImporter from './fsImporter.js';
import makeFsImporter from './makeFsImporter.js';
export type ImportPath = NodePath<ExportAllDeclaration | ExportNamedDeclaration | ImportDeclaration>;
export type Importer = (path: ImportPath, name: string, file: FileState) => NodePath | null;
export { fsImporter, ignoreImporter, makeFsImporter };
