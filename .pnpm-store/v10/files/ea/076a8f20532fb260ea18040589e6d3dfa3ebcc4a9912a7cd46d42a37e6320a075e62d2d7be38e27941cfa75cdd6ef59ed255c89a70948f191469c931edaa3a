"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.serializeDeleteResourceOptions = void 0;
const interface_check_1 = require("../utils/interface-check");
const serializeDeleteResourceOptions = (options) => ({
    resource_type: (0, interface_check_1.isResourceInterface)(options)
        ? options.getResourceType()
        : options.resourceType,
    resource_id: (0, interface_check_1.isResourceInterface)(options)
        ? options.getResourceId()
        : options.resourceId
            ? options.resourceId
            : '',
});
exports.serializeDeleteResourceOptions = serializeDeleteResourceOptions;
