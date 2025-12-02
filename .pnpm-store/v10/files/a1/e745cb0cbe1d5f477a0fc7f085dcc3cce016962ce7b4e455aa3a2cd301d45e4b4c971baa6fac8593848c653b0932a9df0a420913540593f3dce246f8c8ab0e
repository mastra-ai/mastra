"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.BasePineconeError = void 0;
var BasePineconeError = /** @class */ (function (_super) {
    __extends(BasePineconeError, _super);
    function BasePineconeError(message, cause) {
        var _newTarget = this.constructor;
        var _this = _super.call(this, message) || this;
        // Set the prototype explicitly to ensure instanceof works correctly
        Object.setPrototypeOf(_this, _newTarget.prototype);
        // Maintain a proper stack trace in V8 environments (Chrome and Node.js)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(_this, _newTarget);
        }
        _this.name = _this.constructor.name;
        _this.cause = cause;
        return _this;
    }
    return BasePineconeError;
}(Error));
exports.BasePineconeError = BasePineconeError;
//# sourceMappingURL=base.js.map