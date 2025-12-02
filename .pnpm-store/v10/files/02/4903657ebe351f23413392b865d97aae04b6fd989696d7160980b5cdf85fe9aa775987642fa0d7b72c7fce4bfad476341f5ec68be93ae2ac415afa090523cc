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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Organizations = void 0;
const pagination_1 = require("../common/utils/pagination");
const serializers_1 = require("./serializers");
const fetch_and_deserialize_1 = require("../common/utils/fetch-and-deserialize");
const role_serializer_1 = require("../roles/serializers/role.serializer");
const feature_flag_serializer_1 = require("../feature-flags/serializers/feature-flag.serializer");
class Organizations {
    constructor(workos) {
        this.workos = workos;
    }
    listOrganizations(options) {
        return __awaiter(this, void 0, void 0, function* () {
            return new pagination_1.AutoPaginatable(yield (0, fetch_and_deserialize_1.fetchAndDeserialize)(this.workos, '/organizations', serializers_1.deserializeOrganization, options), (params) => (0, fetch_and_deserialize_1.fetchAndDeserialize)(this.workos, '/organizations', serializers_1.deserializeOrganization, params), options);
        });
    }
    createOrganization(payload, requestOptions = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            const { data } = yield this.workos.post('/organizations', (0, serializers_1.serializeCreateOrganizationOptions)(payload), requestOptions);
            return (0, serializers_1.deserializeOrganization)(data);
        });
    }
    deleteOrganization(id) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.workos.delete(`/organizations/${id}`);
        });
    }
    getOrganization(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const { data } = yield this.workos.get(`/organizations/${id}`);
            return (0, serializers_1.deserializeOrganization)(data);
        });
    }
    getOrganizationByExternalId(externalId) {
        return __awaiter(this, void 0, void 0, function* () {
            const { data } = yield this.workos.get(`/organizations/external_id/${externalId}`);
            return (0, serializers_1.deserializeOrganization)(data);
        });
    }
    updateOrganization(options) {
        return __awaiter(this, void 0, void 0, function* () {
            const { organization: organizationId } = options, payload = __rest(options, ["organization"]);
            const { data } = yield this.workos.put(`/organizations/${organizationId}`, (0, serializers_1.serializeUpdateOrganizationOptions)(payload));
            return (0, serializers_1.deserializeOrganization)(data);
        });
    }
    listOrganizationRoles(options) {
        return __awaiter(this, void 0, void 0, function* () {
            const { organizationId } = options;
            const { data: response } = yield this.workos.get(`/organizations/${organizationId}/roles`);
            return {
                object: 'list',
                data: response.data.map((role) => (0, role_serializer_1.deserializeRole)(role)),
            };
        });
    }
    listOrganizationFeatureFlags(options) {
        return __awaiter(this, void 0, void 0, function* () {
            const { organizationId } = options, paginationOptions = __rest(options, ["organizationId"]);
            return new pagination_1.AutoPaginatable(yield (0, fetch_and_deserialize_1.fetchAndDeserialize)(this.workos, `/organizations/${organizationId}/feature-flags`, feature_flag_serializer_1.deserializeFeatureFlag, paginationOptions), (params) => (0, fetch_and_deserialize_1.fetchAndDeserialize)(this.workos, `/organizations/${organizationId}/feature-flags`, feature_flag_serializer_1.deserializeFeatureFlag, params), paginationOptions);
        });
    }
}
exports.Organizations = Organizations;
