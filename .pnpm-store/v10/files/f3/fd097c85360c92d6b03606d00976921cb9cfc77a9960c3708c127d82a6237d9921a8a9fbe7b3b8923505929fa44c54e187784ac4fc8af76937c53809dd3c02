'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var MagicString = require('magic-string');
var mlly = require('mlly');

const CJSyntaxRegex = /__filename|__dirname|require\(|require\.resolve\(/;
const ESMShim = `
// -- Shims --
import cjsUrl from 'node:url';
import cjsPath from 'node:path';
import cjsModule from 'node:module';
const __filename = cjsUrl.fileURLToPath(import.meta.url);
const __dirname = cjsPath.dirname(__filename);
const require = cjsModule.createRequire(import.meta.url);
`;

// Shim __dirname, __filename and require
function provideCJSSyntax(code) {
    if (code.includes(ESMShim) || !CJSyntaxRegex.test(code)) {
        return null;
    }
    const lastESMImport = mlly.findStaticImports(code).pop();
    const indexToAppend = lastESMImport ? lastESMImport.end : 0;
    const s = new MagicString(code);
    s.appendRight(indexToAppend, ESMShim);
    const sourceMap = s.generateMap({
        includeContent: true
    });
    let sourcesContent;
    if (Array.isArray(sourceMap.sourcesContent)) {
        sourcesContent = [];
        for (let i = 0; i < sourceMap.sourcesContent.length; i++) {
            const content = sourceMap.sourcesContent[i];
            if (typeof content === 'string') {
                sourcesContent.push(content);
            }
        }
    }
    return {
        code: s.toString(),
        map: {
            ...sourceMap,
            sourcesContent
        }
    };
}

function esmShim() {
    return {
        name: 'esm-shim',
        renderChunk(code, _chunk, opts) {
            if (opts.format === 'es') {
                return provideCJSSyntax(code);
            }
            return null;
        }
    };
}

/*
 * Copyright (c) 2023.
 * The core of this plugin was conceived by pi0 and is taken from the following repository:
 * https://github.com/unjs/unbuild/blob/main/src/builders/rollup/plugins/cjs.ts
 */

exports.default = esmShim;
exports.esmShim = esmShim;
exports.provideCJSSyntax = provideCJSSyntax;
module.exports = Object.assign(exports.default, exports);
//# sourceMappingURL=index.js.map
