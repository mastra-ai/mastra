export class DeepgramError extends Error {
    constructor(message) {
        super(message);
        this.__dgError = true;
        this.name = "DeepgramError";
    }
}
export function isDeepgramError(error) {
    return typeof error === "object" && error !== null && "__dgError" in error;
}
export class DeepgramApiError extends DeepgramError {
    constructor(message, status) {
        super(message);
        this.name = "DeepgramApiError";
        this.status = status;
    }
    toJSON() {
        return {
            name: this.name,
            message: this.message,
            status: this.status,
        };
    }
}
export class DeepgramUnknownError extends DeepgramError {
    constructor(message, originalError) {
        super(message);
        this.name = "DeepgramUnknownError";
        this.originalError = originalError;
    }
}
export class DeepgramVersionError extends DeepgramError {
    constructor() {
        super(`You are attempting to use an old format for a newer SDK version. Read more here: https://dpgr.am/js-v3`);
        this.name = "DeepgramVersionError";
    }
}
//# sourceMappingURL=errors.js.map