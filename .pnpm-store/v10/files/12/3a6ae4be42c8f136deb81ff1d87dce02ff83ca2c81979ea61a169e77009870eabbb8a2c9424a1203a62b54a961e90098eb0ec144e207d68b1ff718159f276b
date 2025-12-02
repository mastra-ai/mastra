import { loadPartialConfig, parseSync } from '@babel/core';
import { extname } from 'path';
const TYPESCRIPT_EXTS = new Set(['.cts', '.mts', '.ts', '.tsx']);
function getDefaultPlugins(options) {
    return [
        'jsx',
        options.filename && TYPESCRIPT_EXTS.has(extname(options.filename))
            ? 'typescript'
            : 'flow',
        'asyncDoExpressions',
        'decimal',
        ['decorators', { decoratorsBeforeExport: false }],
        'decoratorAutoAccessors',
        'destructuringPrivate',
        'doExpressions',
        'exportDefaultFrom',
        'functionBind',
        'importAssertions',
        'moduleBlocks',
        'partialApplication',
        ['pipelineOperator', { proposal: 'minimal' }],
        ['recordAndTuple', { syntaxType: 'bar' }],
        'regexpUnicodeSets',
        'throwExpressions',
    ];
}
function buildPluginList(options) {
    let plugins = [];
    if (options.parserOpts?.plugins) {
        plugins = [...options.parserOpts.plugins];
    }
    // Let's check if babel finds a config file for this source file
    // If babel does find a config file we do not apply our defaults
    const partialConfig = loadPartialConfig(options);
    if (plugins.length === 0 &&
        partialConfig &&
        !partialConfig.hasFilesystemConfig()) {
        plugins = getDefaultPlugins(options);
    }
    // Ensure that the estree plugin is never active
    // TODO add test
    return plugins.filter((plugin) => plugin !== 'estree');
}
function buildParserOptions(options) {
    const plugins = buildPluginList(options);
    return {
        sourceType: 'unambiguous',
        ...(options.parserOpts || {}),
        plugins,
        tokens: false,
    };
}
export default function babelParser(src, options = {}) {
    const parserOpts = buildParserOptions(options);
    const opts = {
        ...options,
        parserOpts,
    };
    const ast = parseSync(src, opts);
    if (!ast) {
        throw new Error('Unable to parse source code.');
    }
    return ast;
}
