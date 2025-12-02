import { isBuiltin, isPrimitive } from "../../utils/index.mjs";
class PromiseRejectionEventCoercer {
    match(err) {
        return isBuiltin(err, 'PromiseRejectionEvent');
    }
    coerce(err, ctx) {
        const reason = this.getUnhandledRejectionReason(err);
        if (isPrimitive(reason)) return {
            type: 'UnhandledRejection',
            value: `Non-Error promise rejection captured with value: ${String(reason)}`,
            stack: ctx.syntheticException?.stack,
            synthetic: true
        };
        return ctx.apply(reason);
    }
    getUnhandledRejectionReason(error) {
        if (isPrimitive(error)) return error;
        try {
            if ('reason' in error) return error.reason;
            if ('detail' in error && 'reason' in error.detail) return error.detail.reason;
        } catch  {}
        return error;
    }
}
export { PromiseRejectionEventCoercer };
