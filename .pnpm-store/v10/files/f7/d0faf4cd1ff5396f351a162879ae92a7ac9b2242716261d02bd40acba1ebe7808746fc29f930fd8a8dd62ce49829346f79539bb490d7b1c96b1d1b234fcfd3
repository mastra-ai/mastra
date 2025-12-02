var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _FileState_importer;
import babelTraverse, { NodePath } from '@babel/traverse';
import babelParse from './babelParser.js';
// Workaround while babel is not a proper ES module
const traverse = babelTraverse.default ?? babelTraverse;
class FileState {
    constructor(options, { code, ast, importer }) {
        _FileState_importer.set(this, void 0);
        this.hub = {
            // keep it for the usage in babel-core, ex: path.hub.file.opts.filename
            file: this,
            parse: this.parse.bind(this),
            import: this.import.bind(this),
            getCode: () => this.code,
            getScope: () => this.scope,
            addHelper: () => undefined,
            buildError: (node, msg, Error) => {
                const err = new Error(msg);
                err.node = node;
                return err;
            },
        };
        this.opts = options;
        this.code = code;
        this.ast = ast;
        __classPrivateFieldSet(this, _FileState_importer, importer, "f");
        this.path = NodePath.get({
            hub: this.hub,
            parentPath: null,
            parent: this.ast,
            container: this.ast,
            key: 'program',
        }).setContext();
        this.scope = this.path.scope;
    }
    /**
     * Try to resolve and import the ImportPath with the `name`
     */
    import(path, name) {
        return __classPrivateFieldGet(this, _FileState_importer, "f").call(this, path, name, this);
    }
    /**
     * Parse the content of a new file
     * The `filename` is required so that potential imports inside the content can be correctly resolved and
     * the correct babel config file could be loaded. `filename` needs to be an absolute path.
     */
    parse(code, filename) {
        const newOptions = { ...this.opts, filename };
        // We need to build a new parser, because there might be a new
        // babel config file in effect, so we need to load it
        const ast = babelParse(code, newOptions);
        return new FileState(newOptions, {
            ast,
            code,
            importer: __classPrivateFieldGet(this, _FileState_importer, "f"),
        });
    }
    /**
     * Traverse the current file
     */
    traverse(visitors, state) {
        traverse(this.ast, visitors, this.scope, state);
    }
}
_FileState_importer = new WeakMap();
export default FileState;
