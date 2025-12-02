import { List } from '../common/interfaces';
import { PaginationOptions } from '../index.worker';
import type { WorkOS } from '../workos';
import { CreateDataKeyOptions, CreateObjectOptions, DataKey, DataKeyPair, DecryptDataKeyOptions, DeleteObjectOptions, KeyContext, ObjectDigest, ObjectMetadata, ObjectVersion, ReadObjectOptions, UpdateObjectOptions, VaultObject } from './interfaces';
export declare class Vault {
    private readonly workos;
    private cryptoProvider;
    constructor(workos: WorkOS);
    private decode;
    createObject(options: CreateObjectOptions): Promise<ObjectMetadata>;
    listObjects(options?: PaginationOptions | undefined): Promise<List<ObjectDigest>>;
    listObjectVersions(options: ReadObjectOptions): Promise<ObjectVersion[]>;
    readObject(options: ReadObjectOptions): Promise<VaultObject>;
    describeObject(options: ReadObjectOptions): Promise<VaultObject>;
    updateObject(options: UpdateObjectOptions): Promise<VaultObject>;
    deleteObject(options: DeleteObjectOptions): Promise<void>;
    createDataKey(options: CreateDataKeyOptions): Promise<DataKeyPair>;
    decryptDataKey(options: DecryptDataKeyOptions): Promise<DataKey>;
    encrypt(data: string, context: KeyContext, associatedData?: string): Promise<string>;
    decrypt(encryptedData: string, associatedData?: string): Promise<string>;
    createSecret: (options: CreateObjectOptions) => Promise<ObjectMetadata>;
    listSecrets: (options?: PaginationOptions | undefined) => Promise<List<ObjectDigest>>;
    listSecretVersions: (options: ReadObjectOptions) => Promise<ObjectVersion[]>;
    readSecret: (options: ReadObjectOptions) => Promise<VaultObject>;
    describeSecret: (options: ReadObjectOptions) => Promise<VaultObject>;
    updateSecret: (options: UpdateObjectOptions) => Promise<VaultObject>;
    deleteSecret: (options: DeleteObjectOptions) => Promise<void>;
}
