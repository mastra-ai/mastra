import { isErrorEvent } from "../../utils/index.mjs";
class ErrorEventCoercer {
    constructor(){}
    match(err) {
        return isErrorEvent(err) && void 0 != err.error;
    }
    coerce(err, ctx) {
        const exceptionLike = ctx.apply(err.error);
        if (!exceptionLike) return {
            type: 'ErrorEvent',
            value: err.message,
            stack: ctx.syntheticException?.stack,
            synthetic: true
        };
        return exceptionLike;
    }
}
export { ErrorEventCoercer };
