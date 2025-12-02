"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isResourceInterface = exports.isSubject = void 0;
function isSubject(resource) {
    return (Object.prototype.hasOwnProperty.call(resource, 'resourceType') &&
        Object.prototype.hasOwnProperty.call(resource, 'resourceId'));
}
exports.isSubject = isSubject;
function isResourceInterface(resource) {
    return (!!resource &&
        typeof resource === 'object' &&
        'getResouceType' in resource &&
        'getResourceId' in resource);
}
exports.isResourceInterface = isResourceInterface;
