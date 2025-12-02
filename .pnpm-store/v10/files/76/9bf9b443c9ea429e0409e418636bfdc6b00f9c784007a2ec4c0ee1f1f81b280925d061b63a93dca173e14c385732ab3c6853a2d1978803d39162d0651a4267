import { isEmptyString, isError, isEvent, isString } from "../../utils/index.mjs";
import { severityLevels } from "../types.mjs";
import { extractExceptionKeysForMessage } from "./utils.mjs";
class ObjectCoercer {
    match(candidate) {
        return 'object' == typeof candidate && null !== candidate;
    }
    coerce(candidate, ctx) {
        const errorProperty = this.getErrorPropertyFromObject(candidate);
        if (errorProperty) return ctx.apply(errorProperty);
        return {
            type: this.getType(candidate),
            value: this.getValue(candidate),
            stack: ctx.syntheticException?.stack,
            level: this.isSeverityLevel(candidate.level) ? candidate.level : 'error',
            synthetic: true
        };
    }
    getType(err) {
        return isEvent(err) ? err.constructor.name : 'Error';
    }
    getValue(err) {
        if ('name' in err && 'string' == typeof err.name) {
            let message = `'${err.name}' captured as exception`;
            if ('message' in err && 'string' == typeof err.message) message += ` with message: '${err.message}'`;
            return message;
        }
        if ('message' in err && 'string' == typeof err.message) return err.message;
        const className = this.getObjectClassName(err);
        const keys = extractExceptionKeysForMessage(err);
        return `${className && 'Object' !== className ? `'${className}'` : 'Object'} captured as exception with keys: ${keys}`;
    }
    isSeverityLevel(x) {
        return isString(x) && !isEmptyString(x) && severityLevels.indexOf(x) >= 0;
    }
    getErrorPropertyFromObject(obj) {
        for(const prop in obj)if (Object.prototype.hasOwnProperty.call(obj, prop)) {
            const value = obj[prop];
            if (isError(value)) return value;
        }
    }
    getObjectClassName(obj) {
        try {
            const prototype = Object.getPrototypeOf(obj);
            return prototype ? prototype.constructor.name : void 0;
        } catch (e) {
            return;
        }
    }
}
export { ObjectCoercer };
