"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.serializeCreateResourceOptions = void 0;
const interface_check_1 = require("../utils/interface-check");
const serializeCreateResourceOptions = (options) => ({
    resource_type: (0, interface_check_1.isResourceInterface)(options.resource)
        ? options.resource.getResourceType()
        : options.resource.resourceType,
    resource_id: (0, interface_check_1.isResourceInterface)(options.resource)
        ? options.resource.getResourceId()
        : options.resource.resourceId
            ? options.resource.resourceId
            : '',
    meta: options.meta,
});
exports.serializeCreateResourceOptions = serializeCreateResourceOptions;
