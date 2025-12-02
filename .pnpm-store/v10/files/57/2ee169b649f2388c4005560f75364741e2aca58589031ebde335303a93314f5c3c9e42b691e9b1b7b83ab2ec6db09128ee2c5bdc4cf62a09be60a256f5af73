"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FGA = void 0;
const interfaces_1 = require("./interfaces");
const serializers_1 = require("./serializers");
const interface_check_1 = require("./utils/interface-check");
const pagination_1 = require("../common/utils/pagination");
const fetch_and_deserialize_1 = require("../common/utils/fetch-and-deserialize");
const fga_paginatable_1 = require("./utils/fga-paginatable");
const fetch_and_deserialize_list_1 = require("./utils/fetch-and-deserialize-list");
class FGA {
    constructor(workos) {
        this.workos = workos;
    }
    check(checkOptions, options = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            const { data } = yield this.workos.post(`/fga/v1/check`, (0, serializers_1.serializeCheckOptions)(checkOptions), options);
            return new interfaces_1.CheckResult(data);
        });
    }
    checkBatch(checkOptions, options = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            const { data } = yield this.workos.post(`/fga/v1/check`, (0, serializers_1.serializeCheckBatchOptions)(checkOptions), options);
            return data.map((checkResult) => new interfaces_1.CheckResult(checkResult));
        });
    }
    createResource(resource) {
        return __awaiter(this, void 0, void 0, function* () {
            const { data } = yield this.workos.post('/fga/v1/resources', (0, serializers_1.serializeCreateResourceOptions)(resource));
            return (0, serializers_1.deserializeResource)(data);
        });
    }
    getResource(resource) {
        return __awaiter(this, void 0, void 0, function* () {
            const resourceType = (0, interface_check_1.isResourceInterface)(resource)
                ? resource.getResourceType()
                : resource.resourceType;
            const resourceId = (0, interface_check_1.isResourceInterface)(resource)
                ? resource.getResourceId()
                : resource.resourceId;
            const { data } = yield this.workos.get(`/fga/v1/resources/${resourceType}/${resourceId}`);
            return (0, serializers_1.deserializeResource)(data);
        });
    }
    listResources(options) {
        return __awaiter(this, void 0, void 0, function* () {
            return new pagination_1.AutoPaginatable(yield (0, fetch_and_deserialize_1.fetchAndDeserialize)(this.workos, '/fga/v1/resources', serializers_1.deserializeResource, options ? (0, serializers_1.serializeListResourceOptions)(options) : undefined), (params) => (0, fetch_and_deserialize_1.fetchAndDeserialize)(this.workos, '/fga/v1/resources', serializers_1.deserializeResource, params), options ? (0, serializers_1.serializeListResourceOptions)(options) : undefined);
        });
    }
    updateResource(options) {
        return __awaiter(this, void 0, void 0, function* () {
            const resourceType = (0, interface_check_1.isResourceInterface)(options.resource)
                ? options.resource.getResourceType()
                : options.resource.resourceType;
            const resourceId = (0, interface_check_1.isResourceInterface)(options.resource)
                ? options.resource.getResourceId()
                : options.resource.resourceId;
            const { data } = yield this.workos.put(`/fga/v1/resources/${resourceType}/${resourceId}`, {
                meta: options.meta,
            });
            return (0, serializers_1.deserializeResource)(data);
        });
    }
    deleteResource(resource) {
        return __awaiter(this, void 0, void 0, function* () {
            const resourceType = (0, interface_check_1.isResourceInterface)(resource)
                ? resource.getResourceType()
                : resource.resourceType;
            const resourceId = (0, interface_check_1.isResourceInterface)(resource)
                ? resource.getResourceId()
                : resource.resourceId;
            yield this.workos.delete(`/fga/v1/resources/${resourceType}/${resourceId}`);
        });
    }
    batchWriteResources(options) {
        return __awaiter(this, void 0, void 0, function* () {
            const { data } = yield this.workos.post('/fga/v1/resources/batch', (0, serializers_1.serializeBatchWriteResourcesOptions)(options));
            return (0, serializers_1.deserializeBatchWriteResourcesResponse)(data);
        });
    }
    writeWarrant(options) {
        return __awaiter(this, void 0, void 0, function* () {
            const { data } = yield this.workos.post('/fga/v1/warrants', (0, serializers_1.serializeWriteWarrantOptions)(options));
            return (0, serializers_1.deserializeWarrantToken)(data);
        });
    }
    batchWriteWarrants(options) {
        return __awaiter(this, void 0, void 0, function* () {
            const { data: warrantToken } = yield this.workos.post('/fga/v1/warrants', options.map(serializers_1.serializeWriteWarrantOptions));
            return (0, serializers_1.deserializeWarrantToken)(warrantToken);
        });
    }
    listWarrants(options, requestOptions) {
        return __awaiter(this, void 0, void 0, function* () {
            return new pagination_1.AutoPaginatable(yield (0, fetch_and_deserialize_1.fetchAndDeserialize)(this.workos, '/fga/v1/warrants', serializers_1.deserializeWarrant, options ? (0, serializers_1.serializeListWarrantsOptions)(options) : undefined, requestOptions), (params) => (0, fetch_and_deserialize_1.fetchAndDeserialize)(this.workos, '/fga/v1/warrants', serializers_1.deserializeWarrant, params, requestOptions), options ? (0, serializers_1.serializeListWarrantsOptions)(options) : undefined);
        });
    }
    query(options, requestOptions = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            return new fga_paginatable_1.FgaPaginatable(yield (0, fetch_and_deserialize_list_1.fetchAndDeserializeFGAList)(this.workos, '/fga/v1/query', serializers_1.deserializeQueryResult, (0, serializers_1.serializeQueryOptions)(options), requestOptions), (params) => (0, fetch_and_deserialize_list_1.fetchAndDeserializeFGAList)(this.workos, '/fga/v1/query', serializers_1.deserializeQueryResult, params, requestOptions), (0, serializers_1.serializeQueryOptions)(options));
        });
    }
}
exports.FGA = FGA;
