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
exports.OrganizationDomains = void 0;
const create_organization_domain_options_serializer_1 = require("./serializers/create-organization-domain-options.serializer");
const organization_domain_serializer_1 = require("./serializers/organization-domain.serializer");
class OrganizationDomains {
    constructor(workos) {
        this.workos = workos;
    }
    get(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const { data } = yield this.workos.get(`/organization_domains/${id}`);
            return (0, organization_domain_serializer_1.deserializeOrganizationDomain)(data);
        });
    }
    verify(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const { data } = yield this.workos.post(`/organization_domains/${id}/verify`, {});
            return (0, organization_domain_serializer_1.deserializeOrganizationDomain)(data);
        });
    }
    create(payload) {
        return __awaiter(this, void 0, void 0, function* () {
            const { data } = yield this.workos.post(`/organization_domains`, (0, create_organization_domain_options_serializer_1.serializeCreateOrganizationDomainOptions)(payload));
            return (0, organization_domain_serializer_1.deserializeOrganizationDomain)(data);
        });
    }
    delete(id) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.workos.delete(`/organization_domains/${id}`);
        });
    }
}
exports.OrganizationDomains = OrganizationDomains;
