export var none = {
    isNone: function () {
        return true;
    },
    orElse: function (fallback) {
        return fallback;
    },
    orCall: function (getFallback) {
        return getFallback();
    },
    orNull: function () {
        return null;
    },
    orThrow: function (message) {
        if (message === void 0) { message = 'Unexpected null value'; }
        throw new TypeError(message);
    },
    map: function () {
        return none;
    },
    get: function () {
        return none;
    }
};
var Some = /** @class */ (function () {
    function Some(value) {
        this.value = value;
    }
    Some.prototype.isNone = function () {
        return false;
    };
    Some.prototype.orElse = function () {
        return this.value;
    };
    Some.prototype.orCall = function () {
        return this.value;
    };
    Some.prototype.orNull = function () {
        return this.value;
    };
    Some.prototype.orThrow = function () {
        return this.value;
    };
    Some.prototype.map = function (f) {
        return maybe(f(this.value));
    };
    Some.prototype.get = function (key) {
        return this.map(function (obj) { return obj[key]; });
    };
    return Some;
}());
export function isMaybe(value) {
    return value === none || value instanceof Some;
}
export function maybe(value) {
    if (isMaybe(value)) {
        return value;
    }
    if (value == null) {
        return none;
    }
    return some(value);
}
export function some(value) {
    if (value == null) {
        throw new TypeError('some() does not accept null or undefined');
    }
    return new Some(value);
}
