"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.serializeBatchWriteResourcesOptions = void 0;
const interfaces_1 = require("../interfaces");
const create_resource_options_serializer_1 = require("./create-resource-options.serializer");
const delete_resource_options_serializer_1 = require("./delete-resource-options.serializer");
const serializeBatchWriteResourcesOptions = (options) => {
    let serializedResources = [];
    if (options.op === interfaces_1.ResourceOp.Create) {
        const resources = options.resources;
        serializedResources = resources.map((options) => (0, create_resource_options_serializer_1.serializeCreateResourceOptions)(options));
    }
    else if (options.op === interfaces_1.ResourceOp.Delete) {
        const resources = options.resources;
        serializedResources = resources.map((options) => (0, delete_resource_options_serializer_1.serializeDeleteResourceOptions)(options));
    }
    return {
        op: options.op,
        resources: serializedResources,
    };
};
exports.serializeBatchWriteResourcesOptions = serializeBatchWriteResourcesOptions;
