"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deserializeDeletedEventDirectory = exports.deserializeEventDirectory = exports.deserializeDirectoryState = exports.deserializeDirectory = void 0;
const deserializeDirectory = (directory) => ({
    object: directory.object,
    id: directory.id,
    domain: directory.domain,
    externalKey: directory.external_key,
    name: directory.name,
    organizationId: directory.organization_id,
    state: (0, exports.deserializeDirectoryState)(directory.state),
    type: directory.type,
    createdAt: directory.created_at,
    updatedAt: directory.updated_at,
});
exports.deserializeDirectory = deserializeDirectory;
const deserializeDirectoryState = (state) => {
    if (state === 'linked') {
        return 'active';
    }
    if (state === 'unlinked') {
        return 'inactive';
    }
    return state;
};
exports.deserializeDirectoryState = deserializeDirectoryState;
const deserializeEventDirectory = (directory) => ({
    object: directory.object,
    id: directory.id,
    externalKey: directory.external_key,
    type: directory.type,
    state: directory.state,
    name: directory.name,
    organizationId: directory.organization_id,
    domains: directory.domains,
    createdAt: directory.created_at,
    updatedAt: directory.updated_at,
});
exports.deserializeEventDirectory = deserializeEventDirectory;
const deserializeDeletedEventDirectory = (directory) => ({
    object: directory.object,
    id: directory.id,
    type: directory.type,
    state: directory.state,
    name: directory.name,
    organizationId: directory.organization_id,
    createdAt: directory.created_at,
    updatedAt: directory.updated_at,
});
exports.deserializeDeletedEventDirectory = deserializeDeletedEventDirectory;
