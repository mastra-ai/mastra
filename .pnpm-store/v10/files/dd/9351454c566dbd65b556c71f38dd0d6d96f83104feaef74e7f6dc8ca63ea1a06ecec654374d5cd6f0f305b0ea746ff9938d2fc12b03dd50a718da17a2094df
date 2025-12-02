import { isEvent } from "../../utils/index.mjs";
import { extractExceptionKeysForMessage } from "./utils.mjs";
class EventCoercer {
    match(err) {
        return isEvent(err);
    }
    coerce(evt, ctx) {
        const constructorName = evt.constructor.name;
        return {
            type: constructorName,
            value: `${constructorName} captured as exception with keys: ${extractExceptionKeysForMessage(evt)}`,
            stack: ctx.syntheticException?.stack,
            synthetic: true
        };
    }
}
export { EventCoercer };
