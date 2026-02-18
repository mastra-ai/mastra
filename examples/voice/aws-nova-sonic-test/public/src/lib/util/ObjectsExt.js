export class ObjectExt {
    static exists(obj) {
        return obj !== undefined && obj !== null;
    }

    static checkArgument(condition, message) {
        if (!condition) {
            throw TypeError(message);
        }
    }

    static checkExists(obj, message) {
        if (ObjectExt.exists(obj)) {
            throw TypeError(message);
        }
    }
}

