import { KeyContext } from './key.interface';
export interface ObjectDigest {
    id: string;
    name: string;
    updatedAt: Date;
}
export interface ObjectUpdateBy {
    id: string;
    name: string;
}
export interface ObjectMetadata {
    context: KeyContext;
    environmentId: string;
    id: string;
    keyId: string;
    updatedAt: Date;
    updatedBy: ObjectUpdateBy;
    versionId: string;
}
export interface VaultObject {
    id: string;
    metadata: ObjectMetadata;
    name: string;
    value?: string;
}
export interface ObjectVersion {
    createdAt: Date;
    currentVersion: boolean;
    id: string;
}
