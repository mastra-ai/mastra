"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var chai_1 = require("chai");
var trimFileName_1 = require("../trimFileName");
describe('trimFileName', function () {
    describe('posix', function () {
        var cwd = '/home/user/projects/react-docgen-typescript';
        var platform = 'posix';
        it('works with simple path', function () {
            var input = cwd + "/src/__tests__/data/ExportsPropTypeImport.tsx";
            chai_1.assert.equal(trimFileName_1.trimFileName(input, cwd, platform), 'react-docgen-typescript/src/__tests__/data/ExportsPropTypeImport.tsx');
        });
        it('works with repeated path segments', function () {
            var input = cwd + "/react-docgen-typescript/src/__tests__/data/ExportsPropTypeImport.tsx";
            chai_1.assert.equal(trimFileName_1.trimFileName(input, cwd, platform), 'react-docgen-typescript/react-docgen-typescript/src/__tests__/data/ExportsPropTypeImport.tsx');
        });
        it('preserves package name from node_modules', function () {
            var input = cwd + "/node_modules/@types/react/index.d.ts";
            chai_1.assert.equal(trimFileName_1.trimFileName(input, cwd, platform), 'react-docgen-typescript/node_modules/@types/react/index.d.ts');
        });
        it('preserves package name from node_modules in monorepo', function () {
            // This simulates running docgen in an individual package in a monorepo
            var monorepoCwd = cwd + '/packages/foo';
            var input = cwd + "/node_modules/@types/react/index.d.ts";
            chai_1.assert.equal(trimFileName_1.trimFileName(input, monorepoCwd, platform), 'react-docgen-typescript/node_modules/@types/react/index.d.ts');
        });
        it('returns full path if there is no common root', function () {
            var input = '/somewhere/else/foo.d.ts';
            chai_1.assert.equal(trimFileName_1.trimFileName(input, cwd, platform), input);
        });
        it('works when run at the root directory', function () {
            // This is more of a theoretical edge case
            var input = "/src/__tests__/data/ExportsPropTypeImport.tsx";
            chai_1.assert.equal(trimFileName_1.trimFileName(input, '/', platform), 'src/__tests__/data/ExportsPropTypeImport.tsx');
        });
    });
    describe('windows', function () {
        var cwd = 'C:\\Users\\user\\projects\\react-docgen-typescript';
        // typescript uses forward slashes even in windows paths
        var cwdForwardSlash = cwd.replace(/\\/g, '/');
        var platform = 'win32';
        it('works with simple path', function () {
            var input = cwdForwardSlash + "/src/__tests__/data/ExportsPropTypeImport.tsx";
            chai_1.assert.equal(trimFileName_1.trimFileName(input, cwd, platform), 'react-docgen-typescript/src/__tests__/data/ExportsPropTypeImport.tsx');
        });
        it('works with repeated path segments', function () {
            var input = cwdForwardSlash + "/react-docgen-typescript/src/__tests__/data/ExportsPropTypeImport.tsx";
            chai_1.assert.equal(trimFileName_1.trimFileName(input, cwd, platform), 'react-docgen-typescript/react-docgen-typescript/src/__tests__/data/ExportsPropTypeImport.tsx');
        });
        it('preserves package name from node_modules', function () {
            var input = cwdForwardSlash + "/node_modules/@types/react/index.d.ts";
            chai_1.assert.equal(trimFileName_1.trimFileName(input, cwd, platform), 'react-docgen-typescript/node_modules/@types/react/index.d.ts');
        });
        it('preserves package name from node_modules in monorepo', function () {
            var monorepoCwd = cwd + '\\packages\\foo';
            var input = cwdForwardSlash + "/node_modules/@types/react/index.d.ts";
            chai_1.assert.equal(trimFileName_1.trimFileName(input, monorepoCwd, platform), 'react-docgen-typescript/node_modules/@types/react/index.d.ts');
        });
        it('returns full path if there is no common root', function () {
            var input = 'D:/somewhere/else/foo.d.ts';
            chai_1.assert.equal(trimFileName_1.trimFileName(input, cwd, platform), input);
        });
        it('works when run at the filesystem root', function () {
            var input = "C:/src/__tests__/data/ExportsPropTypeImport.tsx";
            chai_1.assert.equal(trimFileName_1.trimFileName(input, 'C:\\', platform), 'src/__tests__/data/ExportsPropTypeImport.tsx');
        });
        it('works with backslashes', function () {
            // typescript uses forward slashes in file paths, but test with backslashes too
            var input = cwd + "\\src\\__tests__\\data\\ExportsPropTypeImport.tsx";
            chai_1.assert.equal(trimFileName_1.trimFileName(input, cwd, platform), 'react-docgen-typescript\\src\\__tests__\\data\\ExportsPropTypeImport.tsx');
        });
    });
});
//# sourceMappingURL=trimFileName.js.map