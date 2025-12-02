/** Error thrown by the client. */
export class LibsqlError extends Error {
    /** Machine-readable error code. */
    code;
    /** Raw numeric error code */
    rawCode;
    constructor(message, code, rawCode, cause) {
        if (code !== undefined) {
            message = `${code}: ${message}`;
        }
        super(message, { cause });
        this.code = code;
        this.rawCode = rawCode;
        this.name = "LibsqlError";
    }
}
