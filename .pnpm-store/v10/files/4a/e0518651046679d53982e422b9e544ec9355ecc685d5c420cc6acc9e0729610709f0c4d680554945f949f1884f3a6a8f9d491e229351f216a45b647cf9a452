"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateClientString = void 0;
/**
 * @internal
 */
function generateClientString() {
    // Grab the various versions.  Note that we need to trim them
    // off as some Node.js versions insert strange characters into
    // the version identifiers (mainly newlines and such).
    /* eslint-disable-next-line @typescript-eslint/no-var-requires */
    const nodeVer = process.versions.node.trim();
    const v8Ver = process.versions.v8.trim();
    const sslVer = process.versions.openssl.trim();
    return `node/${nodeVer}; v8/${v8Ver}; ssl/${sslVer}`;
}
exports.generateClientString = generateClientString;
