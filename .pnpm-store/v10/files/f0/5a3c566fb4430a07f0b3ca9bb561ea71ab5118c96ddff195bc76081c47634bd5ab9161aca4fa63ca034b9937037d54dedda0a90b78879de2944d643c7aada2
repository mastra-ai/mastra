"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deserializeBatchWriteResourcesResponse = exports.deserializeResource = void 0;
const deserializeResource = (response) => ({
    resourceType: response.resource_type,
    resourceId: response.resource_id,
    meta: response.meta,
});
exports.deserializeResource = deserializeResource;
const deserializeBatchWriteResourcesResponse = (response) => {
    return response.data.map((resource) => (0, exports.deserializeResource)(resource));
};
exports.deserializeBatchWriteResourcesResponse = deserializeBatchWriteResourcesResponse;
