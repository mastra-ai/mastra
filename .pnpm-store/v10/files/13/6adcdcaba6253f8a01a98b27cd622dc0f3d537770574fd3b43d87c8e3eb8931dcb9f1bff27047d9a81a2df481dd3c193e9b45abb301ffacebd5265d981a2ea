"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deserializeUpdatedEventDirectoryGroup = exports.deserializeDirectoryGroup = void 0;
const deserializeDirectoryGroup = (directoryGroup) => ({
    id: directoryGroup.id,
    idpId: directoryGroup.idp_id,
    directoryId: directoryGroup.directory_id,
    organizationId: directoryGroup.organization_id,
    name: directoryGroup.name,
    createdAt: directoryGroup.created_at,
    updatedAt: directoryGroup.updated_at,
    rawAttributes: directoryGroup.raw_attributes,
});
exports.deserializeDirectoryGroup = deserializeDirectoryGroup;
const deserializeUpdatedEventDirectoryGroup = (directoryGroup) => ({
    id: directoryGroup.id,
    idpId: directoryGroup.idp_id,
    directoryId: directoryGroup.directory_id,
    organizationId: directoryGroup.organization_id,
    name: directoryGroup.name,
    createdAt: directoryGroup.created_at,
    updatedAt: directoryGroup.updated_at,
    rawAttributes: directoryGroup.raw_attributes,
    previousAttributes: directoryGroup.previous_attributes,
});
exports.deserializeUpdatedEventDirectoryGroup = deserializeUpdatedEventDirectoryGroup;
