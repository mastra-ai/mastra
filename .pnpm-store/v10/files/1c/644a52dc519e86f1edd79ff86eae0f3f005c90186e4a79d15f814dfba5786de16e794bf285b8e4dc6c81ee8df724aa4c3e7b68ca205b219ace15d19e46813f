import path from 'node:path';
import fs from 'node:fs/promises';
import cp from 'node:child_process';
import { createRequire, isBuiltin } from 'node:module';
const { name, version } = createRequire(import.meta.url)('#package.json');
const workspaceRootFiles = [
    'pnpm-workspace.yaml',
    'lerna.json',
    'rush.json',
];
const defaults = {
    builtins: true,
    builtinsPrefix: 'add',
    packagePath: [],
    deps: true,
    devDeps: false,
    peerDeps: true,
    optDeps: true,
    include: [],
    exclude: []
};
const isString = (str) => typeof str === 'string' && str.length > 0;
function nodeExternals(options = {}) {
    const config = { ...defaults, ...options };
    let include = [], exclude = [];
    const isIncluded = (id) => include.length > 0 && include.some(rx => rx.test(id)), isExcluded = (id) => exclude.length > 0 && exclude.some(rx => rx.test(id));
    const gitTopLevel = new Promise(resolve => {
        cp.execFile('git', ['rev-parse', '--show-toplevel'], (error, stdout) => {
            return resolve(error ? null : path.normalize(stdout.trim()));
        });
    });
    return {
        name: name.replace(/^rollup-plugin-/, ''),
        version,
        apply: 'build',
        enforce: 'pre',
        async buildStart() {
            [include, exclude] = ['include', 'exclude'].map(option => []
                .concat(config[option])
                .reduce((result, entry, index) => {
                if (entry instanceof RegExp)
                    result.push(entry);
                else if (isString(entry))
                    result.push(new RegExp('^' + entry.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'));
                else if (entry)
                    this.warn(`Ignoring wrong entry type #${index} in '${option}' option: ${JSON.stringify(entry)}`);
                return result;
            }, []));
            const packagePaths = []
                .concat(config.packagePath)
                .filter(isString)
                .map(packagePath => path.resolve(packagePath));
            if (packagePaths.length === 0) {
                search: for (let current = process.cwd(), previous = ''; previous !== current; previous = current, current = path.dirname(current)) {
                    let name = path.join(current, 'package.json');
                    if (await fs.stat(name).then(stat => stat.isFile()).catch(() => false))
                        packagePaths.push(name);
                    if (current === await gitTopLevel)
                        break;
                    for (name of workspaceRootFiles) {
                        if (await fs.stat(path.join(current, name)).then(stat => stat.isFile()).catch(() => false))
                            break search;
                    }
                }
            }
            const dependencies = {};
            for (const packagePath of packagePaths) {
                const buffer = await fs.readFile(packagePath).catch((err) => err);
                if (buffer instanceof Error) {
                    return this.error({
                        message: `Cannot read file ${packagePath}, error: ${buffer.code}.`,
                        stack: undefined
                    });
                }
                try {
                    const pkg = JSON.parse(buffer.toString());
                    Object.assign(dependencies, config.deps ? pkg.dependencies : undefined, config.devDeps ? pkg.devDependencies : undefined, config.peerDeps ? pkg.peerDependencies : undefined, config.optDeps ? pkg.optionalDependencies : undefined);
                    this.addWatchFile(packagePath);
                    if (Array.isArray(pkg.workspaces))
                        break;
                }
                catch {
                    this.error({
                        message: `File ${JSON.stringify(packagePath)} does not look like a valid package.json file.`,
                        stack: undefined
                    });
                }
            }
            const names = Object.keys(dependencies);
            if (names.length > 0)
                include.push(new RegExp('^(?:' + names.join('|') + ')(?:/.+)?$'));
        },
        resolveId(specifier, _, { isEntry }) {
            if (isEntry
                || /^(?:\0|\.{1,2}\/)/.test(specifier)
                || path.isAbsolute(specifier)) {
                return null;
            }
            if (isBuiltin(specifier)) {
                const stripped = specifier.replace(/^node:/, '');
                return {
                    id: config.builtinsPrefix === 'ignore'
                        ? specifier
                        : config.builtinsPrefix === 'add' || !isBuiltin(stripped)
                            ? 'node:' + stripped
                            : stripped,
                    external: (config.builtins || isIncluded(specifier)) && !isExcluded(specifier),
                    moduleSideEffects: false
                };
            }
            return isIncluded(specifier) && !isExcluded(specifier)
                ? false
                : null;
        }
    };
}
export default nodeExternals;
export { nodeExternals };
//# sourceMappingURL=index.js.map