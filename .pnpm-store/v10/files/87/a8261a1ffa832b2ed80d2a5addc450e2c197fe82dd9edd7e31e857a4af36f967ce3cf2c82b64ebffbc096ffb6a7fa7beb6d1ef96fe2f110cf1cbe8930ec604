import spawn from 'cross-spawn';
import process from 'node:process';
import { PassThrough } from 'node:stream';
import { ReadBuffer, serializeMessage } from '../shared/stdio.js';
/**
 * Environment variables to inherit by default, if an environment is not explicitly given.
 */
export const DEFAULT_INHERITED_ENV_VARS = process.platform === 'win32'
    ? [
        'APPDATA',
        'HOMEDRIVE',
        'HOMEPATH',
        'LOCALAPPDATA',
        'PATH',
        'PROCESSOR_ARCHITECTURE',
        'SYSTEMDRIVE',
        'SYSTEMROOT',
        'TEMP',
        'USERNAME',
        'USERPROFILE',
        'PROGRAMFILES'
    ]
    : /* list inspired by the default env inheritance of sudo */
        ['HOME', 'LOGNAME', 'PATH', 'SHELL', 'TERM', 'USER'];
/**
 * Returns a default environment object including only environment variables deemed safe to inherit.
 */
export function getDefaultEnvironment() {
    const env = {};
    for (const key of DEFAULT_INHERITED_ENV_VARS) {
        const value = process.env[key];
        if (value === undefined) {
            continue;
        }
        if (value.startsWith('()')) {
            // Skip functions, which are a security risk.
            continue;
        }
        env[key] = value;
    }
    return env;
}
/**
 * Client transport for stdio: this will connect to a server by spawning a process and communicating with it over stdin/stdout.
 *
 * This transport is only available in Node.js environments.
 */
export class StdioClientTransport {
    constructor(server) {
        this._abortController = new AbortController();
        this._readBuffer = new ReadBuffer();
        this._stderrStream = null;
        this._serverParams = server;
        if (server.stderr === 'pipe' || server.stderr === 'overlapped') {
            this._stderrStream = new PassThrough();
        }
    }
    /**
     * Starts the server process and prepares to communicate with it.
     */
    async start() {
        if (this._process) {
            throw new Error('StdioClientTransport already started! If using Client class, note that connect() calls start() automatically.');
        }
        return new Promise((resolve, reject) => {
            var _a, _b, _c, _d, _e;
            this._process = spawn(this._serverParams.command, (_a = this._serverParams.args) !== null && _a !== void 0 ? _a : [], {
                // merge default env with server env because mcp server needs some env vars
                env: {
                    ...getDefaultEnvironment(),
                    ...this._serverParams.env
                },
                stdio: ['pipe', 'pipe', (_b = this._serverParams.stderr) !== null && _b !== void 0 ? _b : 'inherit'],
                shell: false,
                signal: this._abortController.signal,
                windowsHide: process.platform === 'win32' && isElectron(),
                cwd: this._serverParams.cwd
            });
            this._process.on('error', error => {
                var _a, _b;
                if (error.name === 'AbortError') {
                    // Expected when close() is called.
                    (_a = this.onclose) === null || _a === void 0 ? void 0 : _a.call(this);
                    return;
                }
                reject(error);
                (_b = this.onerror) === null || _b === void 0 ? void 0 : _b.call(this, error);
            });
            this._process.on('spawn', () => {
                resolve();
            });
            this._process.on('close', _code => {
                var _a;
                this._process = undefined;
                (_a = this.onclose) === null || _a === void 0 ? void 0 : _a.call(this);
            });
            (_c = this._process.stdin) === null || _c === void 0 ? void 0 : _c.on('error', error => {
                var _a;
                (_a = this.onerror) === null || _a === void 0 ? void 0 : _a.call(this, error);
            });
            (_d = this._process.stdout) === null || _d === void 0 ? void 0 : _d.on('data', chunk => {
                this._readBuffer.append(chunk);
                this.processReadBuffer();
            });
            (_e = this._process.stdout) === null || _e === void 0 ? void 0 : _e.on('error', error => {
                var _a;
                (_a = this.onerror) === null || _a === void 0 ? void 0 : _a.call(this, error);
            });
            if (this._stderrStream && this._process.stderr) {
                this._process.stderr.pipe(this._stderrStream);
            }
        });
    }
    /**
     * The stderr stream of the child process, if `StdioServerParameters.stderr` was set to "pipe" or "overlapped".
     *
     * If stderr piping was requested, a PassThrough stream is returned _immediately_, allowing callers to
     * attach listeners before the start method is invoked. This prevents loss of any early
     * error output emitted by the child process.
     */
    get stderr() {
        var _a, _b;
        if (this._stderrStream) {
            return this._stderrStream;
        }
        return (_b = (_a = this._process) === null || _a === void 0 ? void 0 : _a.stderr) !== null && _b !== void 0 ? _b : null;
    }
    /**
     * The child process pid spawned by this transport.
     *
     * This is only available after the transport has been started.
     */
    get pid() {
        var _a, _b;
        return (_b = (_a = this._process) === null || _a === void 0 ? void 0 : _a.pid) !== null && _b !== void 0 ? _b : null;
    }
    processReadBuffer() {
        var _a, _b;
        while (true) {
            try {
                const message = this._readBuffer.readMessage();
                if (message === null) {
                    break;
                }
                (_a = this.onmessage) === null || _a === void 0 ? void 0 : _a.call(this, message);
            }
            catch (error) {
                (_b = this.onerror) === null || _b === void 0 ? void 0 : _b.call(this, error);
            }
        }
    }
    async close() {
        this._abortController.abort();
        this._process = undefined;
        this._readBuffer.clear();
    }
    send(message) {
        return new Promise(resolve => {
            var _a;
            if (!((_a = this._process) === null || _a === void 0 ? void 0 : _a.stdin)) {
                throw new Error('Not connected');
            }
            const json = serializeMessage(message);
            if (this._process.stdin.write(json)) {
                resolve();
            }
            else {
                this._process.stdin.once('drain', resolve);
            }
        });
    }
}
function isElectron() {
    return 'type' in process;
}
//# sourceMappingURL=stdio.js.map