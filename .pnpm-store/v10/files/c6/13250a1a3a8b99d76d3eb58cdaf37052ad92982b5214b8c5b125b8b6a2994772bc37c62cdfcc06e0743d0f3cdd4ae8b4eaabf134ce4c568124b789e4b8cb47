"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deserializeOrganization = void 0;
const organization_domain_serializer_1 = require("../../organization-domains/serializers/organization-domain.serializer");
const deserializeOrganization = (organization) => {
    var _a, _b;
    return (Object.assign(Object.assign({ object: organization.object, id: organization.id, name: organization.name, allowProfilesOutsideOrganization: organization.allow_profiles_outside_organization, domains: organization.domains.map(organization_domain_serializer_1.deserializeOrganizationDomain) }, (typeof organization.stripe_customer_id === 'undefined'
        ? undefined
        : { stripeCustomerId: organization.stripe_customer_id })), { createdAt: organization.created_at, updatedAt: organization.updated_at, externalId: (_a = organization.external_id) !== null && _a !== void 0 ? _a : null, metadata: (_b = organization.metadata) !== null && _b !== void 0 ? _b : {} }));
};
exports.deserializeOrganization = deserializeOrganization;
