import { isPrimitive } from "../../utils/index.mjs";
class PrimitiveCoercer {
    match(candidate) {
        return isPrimitive(candidate);
    }
    coerce(value, ctx) {
        return {
            type: 'Error',
            value: `Primitive value captured as exception: ${String(value)}`,
            stack: ctx.syntheticException?.stack,
            synthetic: true
        };
    }
}
export { PrimitiveCoercer };
