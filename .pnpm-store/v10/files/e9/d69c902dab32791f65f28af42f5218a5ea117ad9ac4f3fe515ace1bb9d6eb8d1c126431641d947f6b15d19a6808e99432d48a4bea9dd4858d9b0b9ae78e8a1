"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.serializeUpdateObjectEntity = exports.serializeCreateObjectEntity = exports.desrializeListObjectVersions = exports.deserializeListObjects = exports.deserializeObject = exports.deserializeObjectMetadata = void 0;
const deserializeObjectMetadata = (metadata) => ({
    context: metadata.context,
    environmentId: metadata.environment_id,
    id: metadata.id,
    keyId: metadata.key_id,
    updatedAt: new Date(Date.parse(metadata.updated_at)),
    updatedBy: metadata.updated_by,
    versionId: metadata.version_id,
});
exports.deserializeObjectMetadata = deserializeObjectMetadata;
const deserializeObject = (object) => ({
    id: object.id,
    name: object.name,
    value: object.value,
    metadata: (0, exports.deserializeObjectMetadata)(object.metadata),
});
exports.deserializeObject = deserializeObject;
const deserializeObjectDigest = (digest) => ({
    id: digest.id,
    name: digest.name,
    updatedAt: new Date(Date.parse(digest.updated_at)),
});
const deserializeListObjects = (list) => {
    var _a, _b;
    return ({
        object: 'list',
        data: list.data.map(deserializeObjectDigest),
        listMetadata: {
            after: (_a = list.list_metadata.after) !== null && _a !== void 0 ? _a : undefined,
            before: (_b = list.list_metadata.before) !== null && _b !== void 0 ? _b : undefined,
        },
    });
};
exports.deserializeListObjects = deserializeListObjects;
const desrializeListObjectVersions = (list) => list.data.map(deserializeObjectVersion);
exports.desrializeListObjectVersions = desrializeListObjectVersions;
const deserializeObjectVersion = (version) => ({
    createdAt: new Date(Date.parse(version.created_at)),
    currentVersion: version.current_version,
    id: version.id,
});
const serializeCreateObjectEntity = (options) => ({
    name: options.name,
    value: options.value,
    key_context: options.context,
});
exports.serializeCreateObjectEntity = serializeCreateObjectEntity;
const serializeUpdateObjectEntity = (options) => ({
    value: options.value,
    version_check: options.versionCheck,
});
exports.serializeUpdateObjectEntity = serializeUpdateObjectEntity;
