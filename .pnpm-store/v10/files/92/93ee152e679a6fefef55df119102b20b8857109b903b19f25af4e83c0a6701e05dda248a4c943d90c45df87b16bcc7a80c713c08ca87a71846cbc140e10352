"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deserializeEvent = void 0;
const serializers_1 = require("../../directory-sync/serializers");
const serializers_2 = require("../../organizations/serializers");
const serializers_3 = require("../../sso/serializers");
const serializers_4 = require("../../user-management/serializers");
const organization_domain_serializer_1 = require("../../organization-domains/serializers/organization-domain.serializer");
const organization_membership_serializer_1 = require("../../user-management/serializers/organization-membership.serializer");
const role_serializer_1 = require("../../user-management/serializers/role.serializer");
const session_serializer_1 = require("../../user-management/serializers/session.serializer");
const authentication_radar_risk_event_serializer_1 = require("../../user-management/serializers/authentication-radar-risk-event-serializer");
const deserializeEvent = (event) => {
    const eventBase = {
        id: event.id,
        createdAt: event.created_at,
    };
    switch (event.event) {
        case 'authentication.email_verification_succeeded':
        case 'authentication.magic_auth_failed':
        case 'authentication.magic_auth_succeeded':
        case 'authentication.mfa_succeeded':
        case 'authentication.oauth_failed':
        case 'authentication.oauth_succeeded':
        case 'authentication.password_failed':
        case 'authentication.password_succeeded':
        case 'authentication.sso_failed':
        case 'authentication.sso_succeeded':
            return Object.assign(Object.assign({}, eventBase), { event: event.event, data: (0, serializers_4.deserializeAuthenticationEvent)(event.data) });
        case 'authentication.radar_risk_detected':
            return Object.assign(Object.assign({}, eventBase), { event: event.event, data: (0, authentication_radar_risk_event_serializer_1.deserializeAuthenticationRadarRiskDetectedEvent)(event.data) });
        case 'connection.activated':
        case 'connection.deactivated':
        case 'connection.deleted':
            return Object.assign(Object.assign({}, eventBase), { event: event.event, data: (0, serializers_3.deserializeConnection)(event.data) });
        case 'dsync.activated':
        case 'dsync.deactivated':
            return Object.assign(Object.assign({}, eventBase), { event: event.event, data: (0, serializers_1.deserializeEventDirectory)(event.data) });
        case 'dsync.deleted':
            return Object.assign(Object.assign({}, eventBase), { event: event.event, data: (0, serializers_1.deserializeDeletedEventDirectory)(event.data) });
        case 'dsync.group.created':
        case 'dsync.group.deleted':
            return Object.assign(Object.assign({}, eventBase), { event: event.event, data: (0, serializers_1.deserializeDirectoryGroup)(event.data) });
        case 'dsync.group.updated':
            return Object.assign(Object.assign({}, eventBase), { event: event.event, data: (0, serializers_1.deserializeUpdatedEventDirectoryGroup)(event.data) });
        case 'dsync.group.user_added':
        case 'dsync.group.user_removed':
            return Object.assign(Object.assign({}, eventBase), { event: event.event, data: {
                    directoryId: event.data.directory_id,
                    user: (0, serializers_1.deserializeDirectoryUser)(event.data.user),
                    group: (0, serializers_1.deserializeDirectoryGroup)(event.data.group),
                } });
        case 'dsync.user.created':
        case 'dsync.user.deleted':
            return Object.assign(Object.assign({}, eventBase), { event: event.event, data: (0, serializers_1.deserializeDirectoryUser)(event.data) });
        case 'dsync.user.updated':
            return Object.assign(Object.assign({}, eventBase), { event: event.event, data: (0, serializers_1.deserializeUpdatedEventDirectoryUser)(event.data) });
        case 'email_verification.created':
            return Object.assign(Object.assign({}, eventBase), { event: event.event, data: (0, serializers_4.deserializeEmailVerificationEvent)(event.data) });
        case 'invitation.accepted':
        case 'invitation.created':
        case 'invitation.revoked':
            return Object.assign(Object.assign({}, eventBase), { event: event.event, data: (0, serializers_4.deserializeInvitationEvent)(event.data) });
        case 'magic_auth.created':
            return Object.assign(Object.assign({}, eventBase), { event: event.event, data: (0, serializers_4.deserializeMagicAuthEvent)(event.data) });
        case 'password_reset.created':
        case 'password_reset.succeeded':
            return Object.assign(Object.assign({}, eventBase), { event: event.event, data: (0, serializers_4.deserializePasswordResetEvent)(event.data) });
        case 'user.created':
        case 'user.updated':
        case 'user.deleted':
            return Object.assign(Object.assign({}, eventBase), { event: event.event, data: (0, serializers_4.deserializeUser)(event.data) });
        case 'organization_membership.added':
        case 'organization_membership.created':
        case 'organization_membership.deleted':
        case 'organization_membership.updated':
        case 'organization_membership.removed':
            return Object.assign(Object.assign({}, eventBase), { event: event.event, data: (0, organization_membership_serializer_1.deserializeOrganizationMembership)(event.data) });
        case 'role.created':
        case 'role.deleted':
        case 'role.updated':
            return Object.assign(Object.assign({}, eventBase), { event: event.event, data: (0, role_serializer_1.deserializeRoleEvent)(event.data) });
        case 'session.created':
        case 'session.revoked':
            return Object.assign(Object.assign({}, eventBase), { event: event.event, data: (0, session_serializer_1.deserializeSession)(event.data) });
        case 'organization.created':
        case 'organization.updated':
        case 'organization.deleted':
            return Object.assign(Object.assign({}, eventBase), { event: event.event, data: (0, serializers_2.deserializeOrganization)(event.data) });
        case 'organization_domain.verified':
        case 'organization_domain.verification_failed':
        case 'organization_domain.created':
        case 'organization_domain.updated':
        case 'organization_domain.deleted':
            return Object.assign(Object.assign({}, eventBase), { event: event.event, data: (0, organization_domain_serializer_1.deserializeOrganizationDomain)(event.data) });
    }
};
exports.deserializeEvent = deserializeEvent;
