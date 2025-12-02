import { isPlainError } from "../../utils/index.mjs";
class ErrorCoercer {
    match(err) {
        return isPlainError(err);
    }
    coerce(err, ctx) {
        return {
            type: this.getType(err),
            value: this.getMessage(err, ctx),
            stack: this.getStack(err),
            cause: err.cause ? ctx.next(err.cause) : void 0,
            synthetic: false
        };
    }
    getType(err) {
        return err.name || err.constructor.name;
    }
    getMessage(err, _ctx) {
        const message = err.message;
        if (message.error && 'string' == typeof message.error.message) return String(message.error.message);
        return String(message);
    }
    getStack(err) {
        return err.stacktrace || err.stack || void 0;
    }
}
export { ErrorCoercer };
