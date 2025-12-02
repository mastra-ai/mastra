"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPrimaryEmail = void 0;
function getPrimaryEmail(user) {
    var _a;
    const primaryEmail = (_a = user.emails) === null || _a === void 0 ? void 0 : _a.find((email) => email.primary);
    return primaryEmail === null || primaryEmail === void 0 ? void 0 : primaryEmail.value;
}
exports.getPrimaryEmail = getPrimaryEmail;
