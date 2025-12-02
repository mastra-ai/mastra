"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var ExtendableError = /** @class */ (function (_super) {
    __extends(ExtendableError, _super);
    function ExtendableError(message) {
        var _newTarget = this.constructor;
        if (message === void 0) { message = ''; }
        var _this = _super.call(this, message) || this;
        _this.message = message;
        Object.setPrototypeOf(_this, _newTarget.prototype);
        delete _this.stack;
        _this.name = _newTarget.name;
        _this._error = new Error();
        return _this;
    }
    Object.defineProperty(ExtendableError.prototype, "stack", {
        get: function () {
            if (this._stack) {
                return this._stack;
            }
            var prototype = Object.getPrototypeOf(this);
            var depth = 1;
            loop: while (prototype) {
                switch (prototype) {
                    case ExtendableError.prototype:
                        break loop;
                    case Object.prototype:
                        depth = 1;
                        break loop;
                    default:
                        depth++;
                        break;
                }
                prototype = Object.getPrototypeOf(prototype);
            }
            var stackLines = (this._error.stack || '').match(/.+/g) || [];
            var nameLine = this.name;
            if (this.message) {
                nameLine += ": " + this.message;
            }
            stackLines.splice(0, depth + 1, nameLine);
            return this._stack = stackLines.join('\n');
        },
        enumerable: true,
        configurable: true
    });
    return ExtendableError;
}(Error));
exports.ExtendableError = ExtendableError;
exports.default = ExtendableError;
//# sourceMappingURL=index.js.map