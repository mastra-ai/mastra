import path from 'node:path';
function matches(pattern, importee) {
    if (pattern instanceof RegExp) {
        return pattern.test(importee);
    }
    if (importee.length < pattern.length) {
        return false;
    }
    if (importee === pattern) {
        return true;
    }
    // eslint-disable-next-line prefer-template
    return importee.startsWith(pattern + '/');
}
function getEntries({ entries, customResolver }) {
    if (!entries) {
        return [];
    }
    const resolverFunctionFromOptions = resolveCustomResolver(customResolver);
    if (Array.isArray(entries)) {
        return entries.map((entry) => {
            return {
                find: entry.find,
                replacement: entry.replacement,
                resolverFunction: resolveCustomResolver(entry.customResolver) || resolverFunctionFromOptions
            };
        });
    }
    return Object.entries(entries).map(([key, value]) => {
        return { find: key, replacement: value, resolverFunction: resolverFunctionFromOptions };
    });
}
function getHookFunction(hook) {
    if (typeof hook === 'function') {
        return hook;
    }
    if (hook && 'handler' in hook && typeof hook.handler === 'function') {
        return hook.handler;
    }
    return null;
}
function resolveCustomResolver(customResolver) {
    if (typeof customResolver === 'function') {
        return customResolver;
    }
    if (customResolver) {
        return getHookFunction(customResolver.resolveId);
    }
    return null;
}
export default function alias(options = {}) {
    const entries = getEntries(options);
    if (entries.length === 0) {
        return {
            name: 'alias',
            resolveId: () => null
        };
    }
    return {
        name: 'alias',
        async buildStart(inputOptions) {
            await Promise.all([...(Array.isArray(options.entries) ? options.entries : []), options].map(({ customResolver }) => customResolver && getHookFunction(customResolver.buildStart)?.call(this, inputOptions)));
        },
        resolveId(importee, importer, resolveOptions) {
            // First match is supposed to be the correct one
            const matchedEntry = entries.find((entry) => matches(entry.find, importee));
            if (!matchedEntry) {
                return null;
            }
            const updatedId = importee.replace(matchedEntry.find, matchedEntry.replacement);
            if (matchedEntry.resolverFunction) {
                return matchedEntry.resolverFunction.call(this, updatedId, importer, resolveOptions);
            }
            return this.resolve(updatedId, importer, Object.assign({ skipSelf: true }, resolveOptions)).then((resolved) => {
                if (resolved)
                    return resolved;
                if (!path.isAbsolute(updatedId)) {
                    this.warn(`rewrote ${importee} to ${updatedId} but was not an absolute path and was not handled by other plugins. ` +
                        `This will lead to duplicated modules for the same path. ` +
                        `To avoid duplicating modules, you should resolve to an absolute path.`);
                }
                return { id: updatedId };
            });
        }
    };
}
//# sourceMappingURL=index.js.map