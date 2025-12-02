"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.trimFileName = void 0;
var path = require("path");
var slashRegex = /[\\/]/g;
var fileNameCache = new Map();
function trimFileName(fileName, cwd, platform) {
    var _a;
    if (cwd === void 0) { cwd = process.cwd(); }
    if (fileNameCache.has(fileName))
        return fileNameCache.get(fileName);
    // This allows tests to run regardless of current platform
    var pathLib = platform ? path[platform] : path;
    // Typescript formats Windows paths with forward slashes. For easier use of
    // the path utilities, normalize to platform-standard slashes, then restore
    // the original slashes when returning the result.
    var originalSep = ((_a = fileName.match(slashRegex)) === null || _a === void 0 ? void 0 : _a[0]) || pathLib.sep;
    var normalizedFileName = pathLib.normalize(fileName);
    var root = pathLib.parse(cwd).root;
    // Walk up paths from the current directory until we find a common ancestor,
    // and return the path relative to that. This will work in either a single-
    // package repo or a monorepo (where dependencies may be installed at the
    // root, but commands may be run in a package folder).
    var parent = cwd;
    do {
        if (normalizedFileName.startsWith(parent)) {
            var finalPathName = pathLib
                // Preserve the parent directory name to match existing behavior
                .relative(pathLib.dirname(parent), normalizedFileName)
                // Restore original type of slashes
                .replace(slashRegex, originalSep);
            fileNameCache.set(fileName, finalPathName);
            return finalPathName;
        }
        parent = pathLib.dirname(parent);
    } while (parent !== root);
    fileNameCache.set(fileName, fileName);
    // No common ancestor, so return the path as-is
    return fileName;
}
exports.trimFileName = trimFileName;
//# sourceMappingURL=trimFileName.js.map