import type { HubInterface, Scope, Visitor } from '@babel/traverse';
import { NodePath } from '@babel/traverse';
import type { File, Program } from '@babel/types';
import type { Importer, ImportPath } from './importer/index.js';
import type { TransformOptions } from '@babel/core';
export default class FileState {
    #private;
    opts: TransformOptions;
    path: NodePath<Program>;
    ast: File;
    scope: Scope;
    code: string;
    hub: HubInterface;
    constructor(options: TransformOptions, { code, ast, importer }: {
        code: string;
        ast: File;
        importer: Importer;
    });
    /**
     * Try to resolve and import the ImportPath with the `name`
     */
    import(path: ImportPath, name: string): NodePath | null;
    /**
     * Parse the content of a new file
     * The `filename` is required so that potential imports inside the content can be correctly resolved and
     * the correct babel config file could be loaded. `filename` needs to be an absolute path.
     */
    parse(code: string, filename: string): FileState;
    traverse<S>(visitors: Visitor<S>, state?: S): void;
    traverse(visitors: Visitor): void;
}
