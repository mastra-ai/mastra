import { List, ListResponse } from '../../common/interfaces';
import { ReadObjectMetadataResponse, ReadObjectResponse, UpdateObjectOptions, UpdateObjectEntity, ObjectMetadata, VaultObject, ObjectVersion, CreateObjectOptions, CreateObjectEntity, ObjectDigestResponse, ObjectDigest, ListObjectVersionsResponse } from '../interfaces';
export declare const deserializeObjectMetadata: (metadata: ReadObjectMetadataResponse) => ObjectMetadata;
export declare const deserializeObject: (object: ReadObjectResponse) => VaultObject;
export declare const deserializeListObjects: (list: ListResponse<ObjectDigestResponse>) => List<ObjectDigest>;
export declare const desrializeListObjectVersions: (list: ListObjectVersionsResponse) => ObjectVersion[];
export declare const serializeCreateObjectEntity: (options: CreateObjectOptions) => CreateObjectEntity;
export declare const serializeUpdateObjectEntity: (options: UpdateObjectOptions) => UpdateObjectEntity;
