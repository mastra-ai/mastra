"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deserializeUpdatedEventDirectoryUser = exports.deserializeDirectoryUserWithGroups = exports.deserializeDirectoryUser = void 0;
const directory_group_serializer_1 = require("./directory-group.serializer");
const deserializeDirectoryUser = (directoryUser) => ({
    object: directoryUser.object,
    id: directoryUser.id,
    directoryId: directoryUser.directory_id,
    organizationId: directoryUser.organization_id,
    rawAttributes: directoryUser.raw_attributes,
    customAttributes: directoryUser.custom_attributes,
    idpId: directoryUser.idp_id,
    firstName: directoryUser.first_name,
    email: directoryUser.email,
    emails: directoryUser.emails,
    username: directoryUser.username,
    lastName: directoryUser.last_name,
    jobTitle: directoryUser.job_title,
    state: directoryUser.state,
    role: directoryUser.role,
    createdAt: directoryUser.created_at,
    updatedAt: directoryUser.updated_at,
});
exports.deserializeDirectoryUser = deserializeDirectoryUser;
const deserializeDirectoryUserWithGroups = (directoryUserWithGroups) => (Object.assign(Object.assign({}, (0, exports.deserializeDirectoryUser)(directoryUserWithGroups)), { groups: directoryUserWithGroups.groups.map(directory_group_serializer_1.deserializeDirectoryGroup) }));
exports.deserializeDirectoryUserWithGroups = deserializeDirectoryUserWithGroups;
const deserializeUpdatedEventDirectoryUser = (directoryUser) => ({
    object: 'directory_user',
    id: directoryUser.id,
    directoryId: directoryUser.directory_id,
    organizationId: directoryUser.organization_id,
    rawAttributes: directoryUser.raw_attributes,
    customAttributes: directoryUser.custom_attributes,
    idpId: directoryUser.idp_id,
    firstName: directoryUser.first_name,
    email: directoryUser.email,
    emails: directoryUser.emails,
    username: directoryUser.username,
    lastName: directoryUser.last_name,
    jobTitle: directoryUser.job_title,
    state: directoryUser.state,
    role: directoryUser.role,
    createdAt: directoryUser.created_at,
    updatedAt: directoryUser.updated_at,
    previousAttributes: directoryUser.previous_attributes,
});
exports.deserializeUpdatedEventDirectoryUser = deserializeUpdatedEventDirectoryUser;
