"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deserializeAction = void 0;
const organization_serializer_1 = require("../../organizations/serializers/organization.serializer");
const serializers_1 = require("../../user-management/serializers");
const organization_membership_serializer_1 = require("../../user-management/serializers/organization-membership.serializer");
const deserializeUserData = (userData) => {
    return {
        object: userData.object,
        email: userData.email,
        firstName: userData.first_name,
        lastName: userData.last_name,
    };
};
const deserializeAction = (actionPayload) => {
    switch (actionPayload.object) {
        case 'user_registration_action_context':
            return {
                id: actionPayload.id,
                object: actionPayload.object,
                userData: deserializeUserData(actionPayload.user_data),
                invitation: actionPayload.invitation
                    ? (0, serializers_1.deserializeInvitation)(actionPayload.invitation)
                    : undefined,
                ipAddress: actionPayload.ip_address,
                userAgent: actionPayload.user_agent,
                deviceFingerprint: actionPayload.device_fingerprint,
            };
        case 'authentication_action_context':
            return {
                id: actionPayload.id,
                object: actionPayload.object,
                user: (0, serializers_1.deserializeUser)(actionPayload.user),
                organization: actionPayload.organization
                    ? (0, organization_serializer_1.deserializeOrganization)(actionPayload.organization)
                    : undefined,
                organizationMembership: actionPayload.organization_membership
                    ? (0, organization_membership_serializer_1.deserializeOrganizationMembership)(actionPayload.organization_membership)
                    : undefined,
                ipAddress: actionPayload.ip_address,
                userAgent: actionPayload.user_agent,
                deviceFingerprint: actionPayload.device_fingerprint,
                issuer: actionPayload.issuer,
            };
    }
};
exports.deserializeAction = deserializeAction;
