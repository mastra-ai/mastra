"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidateProperties = void 0;
var errors_1 = require("../errors");
function ValidateProperties(item, validProperties) {
    var itemKeys = Object.keys(item);
    // Check for any keys in `item` that are not in `validProperties`
    var invalidKeys = itemKeys.filter(function (key) { return !validProperties.includes(key); });
    if (invalidKeys.length > 0) {
        throw new errors_1.PineconeArgumentError("Object contained invalid properties: ".concat(invalidKeys.join(', '), ". Valid properties include ").concat(validProperties.join(', '), "."));
    }
}
exports.ValidateProperties = ValidateProperties;
//# sourceMappingURL=validateProperties.js.map