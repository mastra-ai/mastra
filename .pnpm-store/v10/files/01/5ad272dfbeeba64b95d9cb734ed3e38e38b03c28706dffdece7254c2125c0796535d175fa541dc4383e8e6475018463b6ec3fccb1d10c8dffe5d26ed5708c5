/*!
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as $protobuf from "protobufjs";
/** Namespace google. */
export namespace google {

    /** Namespace firestore. */
    namespace firestore {

        /** Namespace admin. */
        namespace admin {

            /** Namespace v1. */
            namespace v1 {

                /** Properties of a Backup. */
                interface IBackup {

                    /** Backup name */
                    name?: (string|null);

                    /** Backup database */
                    database?: (string|null);

                    /** Backup databaseUid */
                    databaseUid?: (string|null);

                    /** Backup snapshotTime */
                    snapshotTime?: (google.protobuf.ITimestamp|null);

                    /** Backup expireTime */
                    expireTime?: (google.protobuf.ITimestamp|null);

                    /** Backup stats */
                    stats?: (google.firestore.admin.v1.Backup.IStats|null);

                    /** Backup state */
                    state?: (google.firestore.admin.v1.Backup.State|null);
                }

                /** Represents a Backup. */
                class Backup implements IBackup {

                    /**
                     * Constructs a new Backup.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.firestore.admin.v1.IBackup);

                    /** Backup name. */
                    public name: string;

                    /** Backup database. */
                    public database: string;

                    /** Backup databaseUid. */
                    public databaseUid: string;

                    /** Backup snapshotTime. */
                    public snapshotTime?: (google.protobuf.ITimestamp|null);

                    /** Backup expireTime. */
                    public expireTime?: (google.protobuf.ITimestamp|null);

                    /** Backup stats. */
                    public stats?: (google.firestore.admin.v1.Backup.IStats|null);

                    /** Backup state. */
                    public state: google.firestore.admin.v1.Backup.State;

                    /**
                     * Creates a Backup message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns Backup
                     */
                    public static fromObject(object: { [k: string]: any }): google.firestore.admin.v1.Backup;

                    /**
                     * Creates a plain object from a Backup message. Also converts values to other types if specified.
                     * @param message Backup
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.firestore.admin.v1.Backup, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this Backup to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for Backup
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                namespace Backup {

                    /** Properties of a Stats. */
                    interface IStats {

                        /** Stats sizeBytes */
                        sizeBytes?: (number|string|null);

                        /** Stats documentCount */
                        documentCount?: (number|string|null);

                        /** Stats indexCount */
                        indexCount?: (number|string|null);
                    }

                    /** Represents a Stats. */
                    class Stats implements IStats {

                        /**
                         * Constructs a new Stats.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: google.firestore.admin.v1.Backup.IStats);

                        /** Stats sizeBytes. */
                        public sizeBytes: (number|string);

                        /** Stats documentCount. */
                        public documentCount: (number|string);

                        /** Stats indexCount. */
                        public indexCount: (number|string);

                        /**
                         * Creates a Stats message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns Stats
                         */
                        public static fromObject(object: { [k: string]: any }): google.firestore.admin.v1.Backup.Stats;

                        /**
                         * Creates a plain object from a Stats message. Also converts values to other types if specified.
                         * @param message Stats
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        public static toObject(message: google.firestore.admin.v1.Backup.Stats, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this Stats to JSON.
                         * @returns JSON object
                         */
                        public toJSON(): { [k: string]: any };

                        /**
                         * Gets the default type url for Stats
                         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                         * @returns The default type url
                         */
                        public static getTypeUrl(typeUrlPrefix?: string): string;
                    }

                    /** State enum. */
                    type State =
                        "STATE_UNSPECIFIED"| "CREATING"| "READY"| "NOT_AVAILABLE";
                }

                /** Properties of a Database. */
                interface IDatabase {

                    /** Database name */
                    name?: (string|null);

                    /** Database uid */
                    uid?: (string|null);

                    /** Database createTime */
                    createTime?: (google.protobuf.ITimestamp|null);

                    /** Database updateTime */
                    updateTime?: (google.protobuf.ITimestamp|null);

                    /** Database deleteTime */
                    deleteTime?: (google.protobuf.ITimestamp|null);

                    /** Database locationId */
                    locationId?: (string|null);

                    /** Database type */
                    type?: (google.firestore.admin.v1.Database.DatabaseType|null);

                    /** Database concurrencyMode */
                    concurrencyMode?: (google.firestore.admin.v1.Database.ConcurrencyMode|null);

                    /** Database versionRetentionPeriod */
                    versionRetentionPeriod?: (google.protobuf.IDuration|null);

                    /** Database earliestVersionTime */
                    earliestVersionTime?: (google.protobuf.ITimestamp|null);

                    /** Database pointInTimeRecoveryEnablement */
                    pointInTimeRecoveryEnablement?: (google.firestore.admin.v1.Database.PointInTimeRecoveryEnablement|null);

                    /** Database appEngineIntegrationMode */
                    appEngineIntegrationMode?: (google.firestore.admin.v1.Database.AppEngineIntegrationMode|null);

                    /** Database keyPrefix */
                    keyPrefix?: (string|null);

                    /** Database deleteProtectionState */
                    deleteProtectionState?: (google.firestore.admin.v1.Database.DeleteProtectionState|null);

                    /** Database cmekConfig */
                    cmekConfig?: (google.firestore.admin.v1.Database.ICmekConfig|null);

                    /** Database previousId */
                    previousId?: (string|null);

                    /** Database sourceInfo */
                    sourceInfo?: (google.firestore.admin.v1.Database.ISourceInfo|null);

                    /** Database etag */
                    etag?: (string|null);
                }

                /** Represents a Database. */
                class Database implements IDatabase {

                    /**
                     * Constructs a new Database.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.firestore.admin.v1.IDatabase);

                    /** Database name. */
                    public name: string;

                    /** Database uid. */
                    public uid: string;

                    /** Database createTime. */
                    public createTime?: (google.protobuf.ITimestamp|null);

                    /** Database updateTime. */
                    public updateTime?: (google.protobuf.ITimestamp|null);

                    /** Database deleteTime. */
                    public deleteTime?: (google.protobuf.ITimestamp|null);

                    /** Database locationId. */
                    public locationId: string;

                    /** Database type. */
                    public type: google.firestore.admin.v1.Database.DatabaseType;

                    /** Database concurrencyMode. */
                    public concurrencyMode: google.firestore.admin.v1.Database.ConcurrencyMode;

                    /** Database versionRetentionPeriod. */
                    public versionRetentionPeriod?: (google.protobuf.IDuration|null);

                    /** Database earliestVersionTime. */
                    public earliestVersionTime?: (google.protobuf.ITimestamp|null);

                    /** Database pointInTimeRecoveryEnablement. */
                    public pointInTimeRecoveryEnablement: google.firestore.admin.v1.Database.PointInTimeRecoveryEnablement;

                    /** Database appEngineIntegrationMode. */
                    public appEngineIntegrationMode: google.firestore.admin.v1.Database.AppEngineIntegrationMode;

                    /** Database keyPrefix. */
                    public keyPrefix: string;

                    /** Database deleteProtectionState. */
                    public deleteProtectionState: google.firestore.admin.v1.Database.DeleteProtectionState;

                    /** Database cmekConfig. */
                    public cmekConfig?: (google.firestore.admin.v1.Database.ICmekConfig|null);

                    /** Database previousId. */
                    public previousId: string;

                    /** Database sourceInfo. */
                    public sourceInfo?: (google.firestore.admin.v1.Database.ISourceInfo|null);

                    /** Database etag. */
                    public etag: string;

                    /**
                     * Creates a Database message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns Database
                     */
                    public static fromObject(object: { [k: string]: any }): google.firestore.admin.v1.Database;

                    /**
                     * Creates a plain object from a Database message. Also converts values to other types if specified.
                     * @param message Database
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.firestore.admin.v1.Database, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this Database to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for Database
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                namespace Database {

                    /** DatabaseType enum. */
                    type DatabaseType =
                        "DATABASE_TYPE_UNSPECIFIED"| "FIRESTORE_NATIVE"| "DATASTORE_MODE";

                    /** ConcurrencyMode enum. */
                    type ConcurrencyMode =
                        "CONCURRENCY_MODE_UNSPECIFIED"| "OPTIMISTIC"| "PESSIMISTIC"| "OPTIMISTIC_WITH_ENTITY_GROUPS";

                    /** PointInTimeRecoveryEnablement enum. */
                    type PointInTimeRecoveryEnablement =
                        "POINT_IN_TIME_RECOVERY_ENABLEMENT_UNSPECIFIED"| "POINT_IN_TIME_RECOVERY_ENABLED"| "POINT_IN_TIME_RECOVERY_DISABLED";

                    /** AppEngineIntegrationMode enum. */
                    type AppEngineIntegrationMode =
                        "APP_ENGINE_INTEGRATION_MODE_UNSPECIFIED"| "ENABLED"| "DISABLED";

                    /** DeleteProtectionState enum. */
                    type DeleteProtectionState =
                        "DELETE_PROTECTION_STATE_UNSPECIFIED"| "DELETE_PROTECTION_DISABLED"| "DELETE_PROTECTION_ENABLED";

                    /** Properties of a CmekConfig. */
                    interface ICmekConfig {

                        /** CmekConfig kmsKeyName */
                        kmsKeyName?: (string|null);

                        /** CmekConfig activeKeyVersion */
                        activeKeyVersion?: (string[]|null);
                    }

                    /** Represents a CmekConfig. */
                    class CmekConfig implements ICmekConfig {

                        /**
                         * Constructs a new CmekConfig.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: google.firestore.admin.v1.Database.ICmekConfig);

                        /** CmekConfig kmsKeyName. */
                        public kmsKeyName: string;

                        /** CmekConfig activeKeyVersion. */
                        public activeKeyVersion: string[];

                        /**
                         * Creates a CmekConfig message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns CmekConfig
                         */
                        public static fromObject(object: { [k: string]: any }): google.firestore.admin.v1.Database.CmekConfig;

                        /**
                         * Creates a plain object from a CmekConfig message. Also converts values to other types if specified.
                         * @param message CmekConfig
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        public static toObject(message: google.firestore.admin.v1.Database.CmekConfig, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this CmekConfig to JSON.
                         * @returns JSON object
                         */
                        public toJSON(): { [k: string]: any };

                        /**
                         * Gets the default type url for CmekConfig
                         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                         * @returns The default type url
                         */
                        public static getTypeUrl(typeUrlPrefix?: string): string;
                    }

                    /** Properties of a SourceInfo. */
                    interface ISourceInfo {

                        /** SourceInfo backup */
                        backup?: (google.firestore.admin.v1.Database.SourceInfo.IBackupSource|null);

                        /** SourceInfo operation */
                        operation?: (string|null);
                    }

                    /** Represents a SourceInfo. */
                    class SourceInfo implements ISourceInfo {

                        /**
                         * Constructs a new SourceInfo.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: google.firestore.admin.v1.Database.ISourceInfo);

                        /** SourceInfo backup. */
                        public backup?: (google.firestore.admin.v1.Database.SourceInfo.IBackupSource|null);

                        /** SourceInfo operation. */
                        public operation: string;

                        /** SourceInfo source. */
                        public source?: "backup";

                        /**
                         * Creates a SourceInfo message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns SourceInfo
                         */
                        public static fromObject(object: { [k: string]: any }): google.firestore.admin.v1.Database.SourceInfo;

                        /**
                         * Creates a plain object from a SourceInfo message. Also converts values to other types if specified.
                         * @param message SourceInfo
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        public static toObject(message: google.firestore.admin.v1.Database.SourceInfo, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this SourceInfo to JSON.
                         * @returns JSON object
                         */
                        public toJSON(): { [k: string]: any };

                        /**
                         * Gets the default type url for SourceInfo
                         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                         * @returns The default type url
                         */
                        public static getTypeUrl(typeUrlPrefix?: string): string;
                    }

                    namespace SourceInfo {

                        /** Properties of a BackupSource. */
                        interface IBackupSource {

                            /** BackupSource backup */
                            backup?: (string|null);
                        }

                        /** Represents a BackupSource. */
                        class BackupSource implements IBackupSource {

                            /**
                             * Constructs a new BackupSource.
                             * @param [properties] Properties to set
                             */
                            constructor(properties?: google.firestore.admin.v1.Database.SourceInfo.IBackupSource);

                            /** BackupSource backup. */
                            public backup: string;

                            /**
                             * Creates a BackupSource message from a plain object. Also converts values to their respective internal types.
                             * @param object Plain object
                             * @returns BackupSource
                             */
                            public static fromObject(object: { [k: string]: any }): google.firestore.admin.v1.Database.SourceInfo.BackupSource;

                            /**
                             * Creates a plain object from a BackupSource message. Also converts values to other types if specified.
                             * @param message BackupSource
                             * @param [options] Conversion options
                             * @returns Plain object
                             */
                            public static toObject(message: google.firestore.admin.v1.Database.SourceInfo.BackupSource, options?: $protobuf.IConversionOptions): { [k: string]: any };

                            /**
                             * Converts this BackupSource to JSON.
                             * @returns JSON object
                             */
                            public toJSON(): { [k: string]: any };

                            /**
                             * Gets the default type url for BackupSource
                             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                             * @returns The default type url
                             */
                            public static getTypeUrl(typeUrlPrefix?: string): string;
                        }
                    }

                    /** Properties of an EncryptionConfig. */
                    interface IEncryptionConfig {

                        /** EncryptionConfig googleDefaultEncryption */
                        googleDefaultEncryption?: (google.firestore.admin.v1.Database.EncryptionConfig.IGoogleDefaultEncryptionOptions|null);

                        /** EncryptionConfig useSourceEncryption */
                        useSourceEncryption?: (google.firestore.admin.v1.Database.EncryptionConfig.ISourceEncryptionOptions|null);

                        /** EncryptionConfig customerManagedEncryption */
                        customerManagedEncryption?: (google.firestore.admin.v1.Database.EncryptionConfig.ICustomerManagedEncryptionOptions|null);
                    }

                    /** Represents an EncryptionConfig. */
                    class EncryptionConfig implements IEncryptionConfig {

                        /**
                         * Constructs a new EncryptionConfig.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: google.firestore.admin.v1.Database.IEncryptionConfig);

                        /** EncryptionConfig googleDefaultEncryption. */
                        public googleDefaultEncryption?: (google.firestore.admin.v1.Database.EncryptionConfig.IGoogleDefaultEncryptionOptions|null);

                        /** EncryptionConfig useSourceEncryption. */
                        public useSourceEncryption?: (google.firestore.admin.v1.Database.EncryptionConfig.ISourceEncryptionOptions|null);

                        /** EncryptionConfig customerManagedEncryption. */
                        public customerManagedEncryption?: (google.firestore.admin.v1.Database.EncryptionConfig.ICustomerManagedEncryptionOptions|null);

                        /** EncryptionConfig encryptionType. */
                        public encryptionType?: ("googleDefaultEncryption"|"useSourceEncryption"|"customerManagedEncryption");

                        /**
                         * Creates an EncryptionConfig message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns EncryptionConfig
                         */
                        public static fromObject(object: { [k: string]: any }): google.firestore.admin.v1.Database.EncryptionConfig;

                        /**
                         * Creates a plain object from an EncryptionConfig message. Also converts values to other types if specified.
                         * @param message EncryptionConfig
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        public static toObject(message: google.firestore.admin.v1.Database.EncryptionConfig, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this EncryptionConfig to JSON.
                         * @returns JSON object
                         */
                        public toJSON(): { [k: string]: any };

                        /**
                         * Gets the default type url for EncryptionConfig
                         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                         * @returns The default type url
                         */
                        public static getTypeUrl(typeUrlPrefix?: string): string;
                    }

                    namespace EncryptionConfig {

                        /** Properties of a GoogleDefaultEncryptionOptions. */
                        interface IGoogleDefaultEncryptionOptions {
                        }

                        /** Represents a GoogleDefaultEncryptionOptions. */
                        class GoogleDefaultEncryptionOptions implements IGoogleDefaultEncryptionOptions {

                            /**
                             * Constructs a new GoogleDefaultEncryptionOptions.
                             * @param [properties] Properties to set
                             */
                            constructor(properties?: google.firestore.admin.v1.Database.EncryptionConfig.IGoogleDefaultEncryptionOptions);

                            /**
                             * Creates a GoogleDefaultEncryptionOptions message from a plain object. Also converts values to their respective internal types.
                             * @param object Plain object
                             * @returns GoogleDefaultEncryptionOptions
                             */
                            public static fromObject(object: { [k: string]: any }): google.firestore.admin.v1.Database.EncryptionConfig.GoogleDefaultEncryptionOptions;

                            /**
                             * Creates a plain object from a GoogleDefaultEncryptionOptions message. Also converts values to other types if specified.
                             * @param message GoogleDefaultEncryptionOptions
                             * @param [options] Conversion options
                             * @returns Plain object
                             */
                            public static toObject(message: google.firestore.admin.v1.Database.EncryptionConfig.GoogleDefaultEncryptionOptions, options?: $protobuf.IConversionOptions): { [k: string]: any };

                            /**
                             * Converts this GoogleDefaultEncryptionOptions to JSON.
                             * @returns JSON object
                             */
                            public toJSON(): { [k: string]: any };

                            /**
                             * Gets the default type url for GoogleDefaultEncryptionOptions
                             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                             * @returns The default type url
                             */
                            public static getTypeUrl(typeUrlPrefix?: string): string;
                        }

                        /** Properties of a SourceEncryptionOptions. */
                        interface ISourceEncryptionOptions {
                        }

                        /** Represents a SourceEncryptionOptions. */
                        class SourceEncryptionOptions implements ISourceEncryptionOptions {

                            /**
                             * Constructs a new SourceEncryptionOptions.
                             * @param [properties] Properties to set
                             */
                            constructor(properties?: google.firestore.admin.v1.Database.EncryptionConfig.ISourceEncryptionOptions);

                            /**
                             * Creates a SourceEncryptionOptions message from a plain object. Also converts values to their respective internal types.
                             * @param object Plain object
                             * @returns SourceEncryptionOptions
                             */
                            public static fromObject(object: { [k: string]: any }): google.firestore.admin.v1.Database.EncryptionConfig.SourceEncryptionOptions;

                            /**
                             * Creates a plain object from a SourceEncryptionOptions message. Also converts values to other types if specified.
                             * @param message SourceEncryptionOptions
                             * @param [options] Conversion options
                             * @returns Plain object
                             */
                            public static toObject(message: google.firestore.admin.v1.Database.EncryptionConfig.SourceEncryptionOptions, options?: $protobuf.IConversionOptions): { [k: string]: any };

                            /**
                             * Converts this SourceEncryptionOptions to JSON.
                             * @returns JSON object
                             */
                            public toJSON(): { [k: string]: any };

                            /**
                             * Gets the default type url for SourceEncryptionOptions
                             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                             * @returns The default type url
                             */
                            public static getTypeUrl(typeUrlPrefix?: string): string;
                        }

                        /** Properties of a CustomerManagedEncryptionOptions. */
                        interface ICustomerManagedEncryptionOptions {

                            /** CustomerManagedEncryptionOptions kmsKeyName */
                            kmsKeyName?: (string|null);
                        }

                        /** Represents a CustomerManagedEncryptionOptions. */
                        class CustomerManagedEncryptionOptions implements ICustomerManagedEncryptionOptions {

                            /**
                             * Constructs a new CustomerManagedEncryptionOptions.
                             * @param [properties] Properties to set
                             */
                            constructor(properties?: google.firestore.admin.v1.Database.EncryptionConfig.ICustomerManagedEncryptionOptions);

                            /** CustomerManagedEncryptionOptions kmsKeyName. */
                            public kmsKeyName: string;

                            /**
                             * Creates a CustomerManagedEncryptionOptions message from a plain object. Also converts values to their respective internal types.
                             * @param object Plain object
                             * @returns CustomerManagedEncryptionOptions
                             */
                            public static fromObject(object: { [k: string]: any }): google.firestore.admin.v1.Database.EncryptionConfig.CustomerManagedEncryptionOptions;

                            /**
                             * Creates a plain object from a CustomerManagedEncryptionOptions message. Also converts values to other types if specified.
                             * @param message CustomerManagedEncryptionOptions
                             * @param [options] Conversion options
                             * @returns Plain object
                             */
                            public static toObject(message: google.firestore.admin.v1.Database.EncryptionConfig.CustomerManagedEncryptionOptions, options?: $protobuf.IConversionOptions): { [k: string]: any };

                            /**
                             * Converts this CustomerManagedEncryptionOptions to JSON.
                             * @returns JSON object
                             */
                            public toJSON(): { [k: string]: any };

                            /**
                             * Gets the default type url for CustomerManagedEncryptionOptions
                             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                             * @returns The default type url
                             */
                            public static getTypeUrl(typeUrlPrefix?: string): string;
                        }
                    }
                }

                /** Properties of a Field. */
                interface IField {

                    /** Field name */
                    name?: (string|null);

                    /** Field indexConfig */
                    indexConfig?: (google.firestore.admin.v1.Field.IIndexConfig|null);

                    /** Field ttlConfig */
                    ttlConfig?: (google.firestore.admin.v1.Field.ITtlConfig|null);
                }

                /** Represents a Field. */
                class Field implements IField {

                    /**
                     * Constructs a new Field.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.firestore.admin.v1.IField);

                    /** Field name. */
                    public name: string;

                    /** Field indexConfig. */
                    public indexConfig?: (google.firestore.admin.v1.Field.IIndexConfig|null);

                    /** Field ttlConfig. */
                    public ttlConfig?: (google.firestore.admin.v1.Field.ITtlConfig|null);

                    /**
                     * Creates a Field message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns Field
                     */
                    public static fromObject(object: { [k: string]: any }): google.firestore.admin.v1.Field;

                    /**
                     * Creates a plain object from a Field message. Also converts values to other types if specified.
                     * @param message Field
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.firestore.admin.v1.Field, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this Field to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for Field
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                namespace Field {

                    /** Properties of an IndexConfig. */
                    interface IIndexConfig {

                        /** IndexConfig indexes */
                        indexes?: (google.firestore.admin.v1.IIndex[]|null);

                        /** IndexConfig usesAncestorConfig */
                        usesAncestorConfig?: (boolean|null);

                        /** IndexConfig ancestorField */
                        ancestorField?: (string|null);

                        /** IndexConfig reverting */
                        reverting?: (boolean|null);
                    }

                    /** Represents an IndexConfig. */
                    class IndexConfig implements IIndexConfig {

                        /**
                         * Constructs a new IndexConfig.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: google.firestore.admin.v1.Field.IIndexConfig);

                        /** IndexConfig indexes. */
                        public indexes: google.firestore.admin.v1.IIndex[];

                        /** IndexConfig usesAncestorConfig. */
                        public usesAncestorConfig: boolean;

                        /** IndexConfig ancestorField. */
                        public ancestorField: string;

                        /** IndexConfig reverting. */
                        public reverting: boolean;

                        /**
                         * Creates an IndexConfig message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns IndexConfig
                         */
                        public static fromObject(object: { [k: string]: any }): google.firestore.admin.v1.Field.IndexConfig;

                        /**
                         * Creates a plain object from an IndexConfig message. Also converts values to other types if specified.
                         * @param message IndexConfig
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        public static toObject(message: google.firestore.admin.v1.Field.IndexConfig, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this IndexConfig to JSON.
                         * @returns JSON object
                         */
                        public toJSON(): { [k: string]: any };

                        /**
                         * Gets the default type url for IndexConfig
                         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                         * @returns The default type url
                         */
                        public static getTypeUrl(typeUrlPrefix?: string): string;
                    }

                    /** Properties of a TtlConfig. */
                    interface ITtlConfig {

                        /** TtlConfig state */
                        state?: (google.firestore.admin.v1.Field.TtlConfig.State|null);
                    }

                    /** Represents a TtlConfig. */
                    class TtlConfig implements ITtlConfig {

                        /**
                         * Constructs a new TtlConfig.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: google.firestore.admin.v1.Field.ITtlConfig);

                        /** TtlConfig state. */
                        public state: google.firestore.admin.v1.Field.TtlConfig.State;

                        /**
                         * Creates a TtlConfig message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns TtlConfig
                         */
                        public static fromObject(object: { [k: string]: any }): google.firestore.admin.v1.Field.TtlConfig;

                        /**
                         * Creates a plain object from a TtlConfig message. Also converts values to other types if specified.
                         * @param message TtlConfig
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        public static toObject(message: google.firestore.admin.v1.Field.TtlConfig, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this TtlConfig to JSON.
                         * @returns JSON object
                         */
                        public toJSON(): { [k: string]: any };

                        /**
                         * Gets the default type url for TtlConfig
                         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                         * @returns The default type url
                         */
                        public static getTypeUrl(typeUrlPrefix?: string): string;
                    }

                    namespace TtlConfig {

                        /** State enum. */
                        type State =
                            "STATE_UNSPECIFIED"| "CREATING"| "ACTIVE"| "NEEDS_REPAIR";
                    }
                }

                /** Properties of an Index. */
                interface IIndex {

                    /** Index name */
                    name?: (string|null);

                    /** Index queryScope */
                    queryScope?: (google.firestore.admin.v1.Index.QueryScope|null);

                    /** Index apiScope */
                    apiScope?: (google.firestore.admin.v1.Index.ApiScope|null);

                    /** Index fields */
                    fields?: (google.firestore.admin.v1.Index.IIndexField[]|null);

                    /** Index state */
                    state?: (google.firestore.admin.v1.Index.State|null);
                }

                /** Represents an Index. */
                class Index implements IIndex {

                    /**
                     * Constructs a new Index.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.firestore.admin.v1.IIndex);

                    /** Index name. */
                    public name: string;

                    /** Index queryScope. */
                    public queryScope: google.firestore.admin.v1.Index.QueryScope;

                    /** Index apiScope. */
                    public apiScope: google.firestore.admin.v1.Index.ApiScope;

                    /** Index fields. */
                    public fields: google.firestore.admin.v1.Index.IIndexField[];

                    /** Index state. */
                    public state: google.firestore.admin.v1.Index.State;

                    /**
                     * Creates an Index message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns Index
                     */
                    public static fromObject(object: { [k: string]: any }): google.firestore.admin.v1.Index;

                    /**
                     * Creates a plain object from an Index message. Also converts values to other types if specified.
                     * @param message Index
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.firestore.admin.v1.Index, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this Index to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for Index
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                namespace Index {

                    /** QueryScope enum. */
                    type QueryScope =
                        "QUERY_SCOPE_UNSPECIFIED"| "COLLECTION"| "COLLECTION_GROUP"| "COLLECTION_RECURSIVE";

                    /** ApiScope enum. */
                    type ApiScope =
                        "ANY_API"| "DATASTORE_MODE_API";

                    /** Properties of an IndexField. */
                    interface IIndexField {

                        /** IndexField fieldPath */
                        fieldPath?: (string|null);

                        /** IndexField order */
                        order?: (google.firestore.admin.v1.Index.IndexField.Order|null);

                        /** IndexField arrayConfig */
                        arrayConfig?: (google.firestore.admin.v1.Index.IndexField.ArrayConfig|null);

                        /** IndexField vectorConfig */
                        vectorConfig?: (google.firestore.admin.v1.Index.IndexField.IVectorConfig|null);
                    }

                    /** Represents an IndexField. */
                    class IndexField implements IIndexField {

                        /**
                         * Constructs a new IndexField.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: google.firestore.admin.v1.Index.IIndexField);

                        /** IndexField fieldPath. */
                        public fieldPath: string;

                        /** IndexField order. */
                        public order?: (google.firestore.admin.v1.Index.IndexField.Order|null);

                        /** IndexField arrayConfig. */
                        public arrayConfig?: (google.firestore.admin.v1.Index.IndexField.ArrayConfig|null);

                        /** IndexField vectorConfig. */
                        public vectorConfig?: (google.firestore.admin.v1.Index.IndexField.IVectorConfig|null);

                        /** IndexField valueMode. */
                        public valueMode?: ("order"|"arrayConfig"|"vectorConfig");

                        /**
                         * Creates an IndexField message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns IndexField
                         */
                        public static fromObject(object: { [k: string]: any }): google.firestore.admin.v1.Index.IndexField;

                        /**
                         * Creates a plain object from an IndexField message. Also converts values to other types if specified.
                         * @param message IndexField
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        public static toObject(message: google.firestore.admin.v1.Index.IndexField, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this IndexField to JSON.
                         * @returns JSON object
                         */
                        public toJSON(): { [k: string]: any };

                        /**
                         * Gets the default type url for IndexField
                         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                         * @returns The default type url
                         */
                        public static getTypeUrl(typeUrlPrefix?: string): string;
                    }

                    namespace IndexField {

                        /** Order enum. */
                        type Order =
                            "ORDER_UNSPECIFIED"| "ASCENDING"| "DESCENDING";

                        /** ArrayConfig enum. */
                        type ArrayConfig =
                            "ARRAY_CONFIG_UNSPECIFIED"| "CONTAINS";

                        /** Properties of a VectorConfig. */
                        interface IVectorConfig {

                            /** VectorConfig dimension */
                            dimension?: (number|null);

                            /** VectorConfig flat */
                            flat?: (google.firestore.admin.v1.Index.IndexField.VectorConfig.IFlatIndex|null);
                        }

                        /** Represents a VectorConfig. */
                        class VectorConfig implements IVectorConfig {

                            /**
                             * Constructs a new VectorConfig.
                             * @param [properties] Properties to set
                             */
                            constructor(properties?: google.firestore.admin.v1.Index.IndexField.IVectorConfig);

                            /** VectorConfig dimension. */
                            public dimension: number;

                            /** VectorConfig flat. */
                            public flat?: (google.firestore.admin.v1.Index.IndexField.VectorConfig.IFlatIndex|null);

                            /** VectorConfig type. */
                            public type?: "flat";

                            /**
                             * Creates a VectorConfig message from a plain object. Also converts values to their respective internal types.
                             * @param object Plain object
                             * @returns VectorConfig
                             */
                            public static fromObject(object: { [k: string]: any }): google.firestore.admin.v1.Index.IndexField.VectorConfig;

                            /**
                             * Creates a plain object from a VectorConfig message. Also converts values to other types if specified.
                             * @param message VectorConfig
                             * @param [options] Conversion options
                             * @returns Plain object
                             */
                            public static toObject(message: google.firestore.admin.v1.Index.IndexField.VectorConfig, options?: $protobuf.IConversionOptions): { [k: string]: any };

                            /**
                             * Converts this VectorConfig to JSON.
                             * @returns JSON object
                             */
                            public toJSON(): { [k: string]: any };

                            /**
                             * Gets the default type url for VectorConfig
                             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                             * @returns The default type url
                             */
                            public static getTypeUrl(typeUrlPrefix?: string): string;
                        }

                        namespace VectorConfig {

                            /** Properties of a FlatIndex. */
                            interface IFlatIndex {
                            }

                            /** Represents a FlatIndex. */
                            class FlatIndex implements IFlatIndex {

                                /**
                                 * Constructs a new FlatIndex.
                                 * @param [properties] Properties to set
                                 */
                                constructor(properties?: google.firestore.admin.v1.Index.IndexField.VectorConfig.IFlatIndex);

                                /**
                                 * Creates a FlatIndex message from a plain object. Also converts values to their respective internal types.
                                 * @param object Plain object
                                 * @returns FlatIndex
                                 */
                                public static fromObject(object: { [k: string]: any }): google.firestore.admin.v1.Index.IndexField.VectorConfig.FlatIndex;

                                /**
                                 * Creates a plain object from a FlatIndex message. Also converts values to other types if specified.
                                 * @param message FlatIndex
                                 * @param [options] Conversion options
                                 * @returns Plain object
                                 */
                                public static toObject(message: google.firestore.admin.v1.Index.IndexField.VectorConfig.FlatIndex, options?: $protobuf.IConversionOptions): { [k: string]: any };

                                /**
                                 * Converts this FlatIndex to JSON.
                                 * @returns JSON object
                                 */
                                public toJSON(): { [k: string]: any };

                                /**
                                 * Gets the default type url for FlatIndex
                                 * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                                 * @returns The default type url
                                 */
                                public static getTypeUrl(typeUrlPrefix?: string): string;
                            }
                        }
                    }

                    /** State enum. */
                    type State =
                        "STATE_UNSPECIFIED"| "CREATING"| "READY"| "NEEDS_REPAIR";
                }

                /** Represents a FirestoreAdmin */
                class FirestoreAdmin extends $protobuf.rpc.Service {

                    /**
                     * Constructs a new FirestoreAdmin service.
                     * @param rpcImpl RPC implementation
                     * @param [requestDelimited=false] Whether requests are length-delimited
                     * @param [responseDelimited=false] Whether responses are length-delimited
                     */
                    constructor(rpcImpl: $protobuf.RPCImpl, requestDelimited?: boolean, responseDelimited?: boolean);

                    /**
                     * Calls CreateIndex.
                     * @param request CreateIndexRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and Operation
                     */
                    public createIndex(request: google.firestore.admin.v1.ICreateIndexRequest, callback: google.firestore.admin.v1.FirestoreAdmin.CreateIndexCallback): void;

                    /**
                     * Calls CreateIndex.
                     * @param request CreateIndexRequest message or plain object
                     * @returns Promise
                     */
                    public createIndex(request: google.firestore.admin.v1.ICreateIndexRequest): Promise<google.longrunning.Operation>;

                    /**
                     * Calls ListIndexes.
                     * @param request ListIndexesRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and ListIndexesResponse
                     */
                    public listIndexes(request: google.firestore.admin.v1.IListIndexesRequest, callback: google.firestore.admin.v1.FirestoreAdmin.ListIndexesCallback): void;

                    /**
                     * Calls ListIndexes.
                     * @param request ListIndexesRequest message or plain object
                     * @returns Promise
                     */
                    public listIndexes(request: google.firestore.admin.v1.IListIndexesRequest): Promise<google.firestore.admin.v1.ListIndexesResponse>;

                    /**
                     * Calls GetIndex.
                     * @param request GetIndexRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and Index
                     */
                    public getIndex(request: google.firestore.admin.v1.IGetIndexRequest, callback: google.firestore.admin.v1.FirestoreAdmin.GetIndexCallback): void;

                    /**
                     * Calls GetIndex.
                     * @param request GetIndexRequest message or plain object
                     * @returns Promise
                     */
                    public getIndex(request: google.firestore.admin.v1.IGetIndexRequest): Promise<google.firestore.admin.v1.Index>;

                    /**
                     * Calls DeleteIndex.
                     * @param request DeleteIndexRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and Empty
                     */
                    public deleteIndex(request: google.firestore.admin.v1.IDeleteIndexRequest, callback: google.firestore.admin.v1.FirestoreAdmin.DeleteIndexCallback): void;

                    /**
                     * Calls DeleteIndex.
                     * @param request DeleteIndexRequest message or plain object
                     * @returns Promise
                     */
                    public deleteIndex(request: google.firestore.admin.v1.IDeleteIndexRequest): Promise<google.protobuf.Empty>;

                    /**
                     * Calls GetField.
                     * @param request GetFieldRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and Field
                     */
                    public getField(request: google.firestore.admin.v1.IGetFieldRequest, callback: google.firestore.admin.v1.FirestoreAdmin.GetFieldCallback): void;

                    /**
                     * Calls GetField.
                     * @param request GetFieldRequest message or plain object
                     * @returns Promise
                     */
                    public getField(request: google.firestore.admin.v1.IGetFieldRequest): Promise<google.firestore.admin.v1.Field>;

                    /**
                     * Calls UpdateField.
                     * @param request UpdateFieldRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and Operation
                     */
                    public updateField(request: google.firestore.admin.v1.IUpdateFieldRequest, callback: google.firestore.admin.v1.FirestoreAdmin.UpdateFieldCallback): void;

                    /**
                     * Calls UpdateField.
                     * @param request UpdateFieldRequest message or plain object
                     * @returns Promise
                     */
                    public updateField(request: google.firestore.admin.v1.IUpdateFieldRequest): Promise<google.longrunning.Operation>;

                    /**
                     * Calls ListFields.
                     * @param request ListFieldsRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and ListFieldsResponse
                     */
                    public listFields(request: google.firestore.admin.v1.IListFieldsRequest, callback: google.firestore.admin.v1.FirestoreAdmin.ListFieldsCallback): void;

                    /**
                     * Calls ListFields.
                     * @param request ListFieldsRequest message or plain object
                     * @returns Promise
                     */
                    public listFields(request: google.firestore.admin.v1.IListFieldsRequest): Promise<google.firestore.admin.v1.ListFieldsResponse>;

                    /**
                     * Calls ExportDocuments.
                     * @param request ExportDocumentsRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and Operation
                     */
                    public exportDocuments(request: google.firestore.admin.v1.IExportDocumentsRequest, callback: google.firestore.admin.v1.FirestoreAdmin.ExportDocumentsCallback): void;

                    /**
                     * Calls ExportDocuments.
                     * @param request ExportDocumentsRequest message or plain object
                     * @returns Promise
                     */
                    public exportDocuments(request: google.firestore.admin.v1.IExportDocumentsRequest): Promise<google.longrunning.Operation>;

                    /**
                     * Calls ImportDocuments.
                     * @param request ImportDocumentsRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and Operation
                     */
                    public importDocuments(request: google.firestore.admin.v1.IImportDocumentsRequest, callback: google.firestore.admin.v1.FirestoreAdmin.ImportDocumentsCallback): void;

                    /**
                     * Calls ImportDocuments.
                     * @param request ImportDocumentsRequest message or plain object
                     * @returns Promise
                     */
                    public importDocuments(request: google.firestore.admin.v1.IImportDocumentsRequest): Promise<google.longrunning.Operation>;

                    /**
                     * Calls BulkDeleteDocuments.
                     * @param request BulkDeleteDocumentsRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and Operation
                     */
                    public bulkDeleteDocuments(request: google.firestore.admin.v1.IBulkDeleteDocumentsRequest, callback: google.firestore.admin.v1.FirestoreAdmin.BulkDeleteDocumentsCallback): void;

                    /**
                     * Calls BulkDeleteDocuments.
                     * @param request BulkDeleteDocumentsRequest message or plain object
                     * @returns Promise
                     */
                    public bulkDeleteDocuments(request: google.firestore.admin.v1.IBulkDeleteDocumentsRequest): Promise<google.longrunning.Operation>;

                    /**
                     * Calls CreateDatabase.
                     * @param request CreateDatabaseRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and Operation
                     */
                    public createDatabase(request: google.firestore.admin.v1.ICreateDatabaseRequest, callback: google.firestore.admin.v1.FirestoreAdmin.CreateDatabaseCallback): void;

                    /**
                     * Calls CreateDatabase.
                     * @param request CreateDatabaseRequest message or plain object
                     * @returns Promise
                     */
                    public createDatabase(request: google.firestore.admin.v1.ICreateDatabaseRequest): Promise<google.longrunning.Operation>;

                    /**
                     * Calls GetDatabase.
                     * @param request GetDatabaseRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and Database
                     */
                    public getDatabase(request: google.firestore.admin.v1.IGetDatabaseRequest, callback: google.firestore.admin.v1.FirestoreAdmin.GetDatabaseCallback): void;

                    /**
                     * Calls GetDatabase.
                     * @param request GetDatabaseRequest message or plain object
                     * @returns Promise
                     */
                    public getDatabase(request: google.firestore.admin.v1.IGetDatabaseRequest): Promise<google.firestore.admin.v1.Database>;

                    /**
                     * Calls ListDatabases.
                     * @param request ListDatabasesRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and ListDatabasesResponse
                     */
                    public listDatabases(request: google.firestore.admin.v1.IListDatabasesRequest, callback: google.firestore.admin.v1.FirestoreAdmin.ListDatabasesCallback): void;

                    /**
                     * Calls ListDatabases.
                     * @param request ListDatabasesRequest message or plain object
                     * @returns Promise
                     */
                    public listDatabases(request: google.firestore.admin.v1.IListDatabasesRequest): Promise<google.firestore.admin.v1.ListDatabasesResponse>;

                    /**
                     * Calls UpdateDatabase.
                     * @param request UpdateDatabaseRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and Operation
                     */
                    public updateDatabase(request: google.firestore.admin.v1.IUpdateDatabaseRequest, callback: google.firestore.admin.v1.FirestoreAdmin.UpdateDatabaseCallback): void;

                    /**
                     * Calls UpdateDatabase.
                     * @param request UpdateDatabaseRequest message or plain object
                     * @returns Promise
                     */
                    public updateDatabase(request: google.firestore.admin.v1.IUpdateDatabaseRequest): Promise<google.longrunning.Operation>;

                    /**
                     * Calls DeleteDatabase.
                     * @param request DeleteDatabaseRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and Operation
                     */
                    public deleteDatabase(request: google.firestore.admin.v1.IDeleteDatabaseRequest, callback: google.firestore.admin.v1.FirestoreAdmin.DeleteDatabaseCallback): void;

                    /**
                     * Calls DeleteDatabase.
                     * @param request DeleteDatabaseRequest message or plain object
                     * @returns Promise
                     */
                    public deleteDatabase(request: google.firestore.admin.v1.IDeleteDatabaseRequest): Promise<google.longrunning.Operation>;

                    /**
                     * Calls GetBackup.
                     * @param request GetBackupRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and Backup
                     */
                    public getBackup(request: google.firestore.admin.v1.IGetBackupRequest, callback: google.firestore.admin.v1.FirestoreAdmin.GetBackupCallback): void;

                    /**
                     * Calls GetBackup.
                     * @param request GetBackupRequest message or plain object
                     * @returns Promise
                     */
                    public getBackup(request: google.firestore.admin.v1.IGetBackupRequest): Promise<google.firestore.admin.v1.Backup>;

                    /**
                     * Calls ListBackups.
                     * @param request ListBackupsRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and ListBackupsResponse
                     */
                    public listBackups(request: google.firestore.admin.v1.IListBackupsRequest, callback: google.firestore.admin.v1.FirestoreAdmin.ListBackupsCallback): void;

                    /**
                     * Calls ListBackups.
                     * @param request ListBackupsRequest message or plain object
                     * @returns Promise
                     */
                    public listBackups(request: google.firestore.admin.v1.IListBackupsRequest): Promise<google.firestore.admin.v1.ListBackupsResponse>;

                    /**
                     * Calls DeleteBackup.
                     * @param request DeleteBackupRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and Empty
                     */
                    public deleteBackup(request: google.firestore.admin.v1.IDeleteBackupRequest, callback: google.firestore.admin.v1.FirestoreAdmin.DeleteBackupCallback): void;

                    /**
                     * Calls DeleteBackup.
                     * @param request DeleteBackupRequest message or plain object
                     * @returns Promise
                     */
                    public deleteBackup(request: google.firestore.admin.v1.IDeleteBackupRequest): Promise<google.protobuf.Empty>;

                    /**
                     * Calls RestoreDatabase.
                     * @param request RestoreDatabaseRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and Operation
                     */
                    public restoreDatabase(request: google.firestore.admin.v1.IRestoreDatabaseRequest, callback: google.firestore.admin.v1.FirestoreAdmin.RestoreDatabaseCallback): void;

                    /**
                     * Calls RestoreDatabase.
                     * @param request RestoreDatabaseRequest message or plain object
                     * @returns Promise
                     */
                    public restoreDatabase(request: google.firestore.admin.v1.IRestoreDatabaseRequest): Promise<google.longrunning.Operation>;

                    /**
                     * Calls CreateBackupSchedule.
                     * @param request CreateBackupScheduleRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and BackupSchedule
                     */
                    public createBackupSchedule(request: google.firestore.admin.v1.ICreateBackupScheduleRequest, callback: google.firestore.admin.v1.FirestoreAdmin.CreateBackupScheduleCallback): void;

                    /**
                     * Calls CreateBackupSchedule.
                     * @param request CreateBackupScheduleRequest message or plain object
                     * @returns Promise
                     */
                    public createBackupSchedule(request: google.firestore.admin.v1.ICreateBackupScheduleRequest): Promise<google.firestore.admin.v1.BackupSchedule>;

                    /**
                     * Calls GetBackupSchedule.
                     * @param request GetBackupScheduleRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and BackupSchedule
                     */
                    public getBackupSchedule(request: google.firestore.admin.v1.IGetBackupScheduleRequest, callback: google.firestore.admin.v1.FirestoreAdmin.GetBackupScheduleCallback): void;

                    /**
                     * Calls GetBackupSchedule.
                     * @param request GetBackupScheduleRequest message or plain object
                     * @returns Promise
                     */
                    public getBackupSchedule(request: google.firestore.admin.v1.IGetBackupScheduleRequest): Promise<google.firestore.admin.v1.BackupSchedule>;

                    /**
                     * Calls ListBackupSchedules.
                     * @param request ListBackupSchedulesRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and ListBackupSchedulesResponse
                     */
                    public listBackupSchedules(request: google.firestore.admin.v1.IListBackupSchedulesRequest, callback: google.firestore.admin.v1.FirestoreAdmin.ListBackupSchedulesCallback): void;

                    /**
                     * Calls ListBackupSchedules.
                     * @param request ListBackupSchedulesRequest message or plain object
                     * @returns Promise
                     */
                    public listBackupSchedules(request: google.firestore.admin.v1.IListBackupSchedulesRequest): Promise<google.firestore.admin.v1.ListBackupSchedulesResponse>;

                    /**
                     * Calls UpdateBackupSchedule.
                     * @param request UpdateBackupScheduleRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and BackupSchedule
                     */
                    public updateBackupSchedule(request: google.firestore.admin.v1.IUpdateBackupScheduleRequest, callback: google.firestore.admin.v1.FirestoreAdmin.UpdateBackupScheduleCallback): void;

                    /**
                     * Calls UpdateBackupSchedule.
                     * @param request UpdateBackupScheduleRequest message or plain object
                     * @returns Promise
                     */
                    public updateBackupSchedule(request: google.firestore.admin.v1.IUpdateBackupScheduleRequest): Promise<google.firestore.admin.v1.BackupSchedule>;

                    /**
                     * Calls DeleteBackupSchedule.
                     * @param request DeleteBackupScheduleRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and Empty
                     */
                    public deleteBackupSchedule(request: google.firestore.admin.v1.IDeleteBackupScheduleRequest, callback: google.firestore.admin.v1.FirestoreAdmin.DeleteBackupScheduleCallback): void;

                    /**
                     * Calls DeleteBackupSchedule.
                     * @param request DeleteBackupScheduleRequest message or plain object
                     * @returns Promise
                     */
                    public deleteBackupSchedule(request: google.firestore.admin.v1.IDeleteBackupScheduleRequest): Promise<google.protobuf.Empty>;
                }

                namespace FirestoreAdmin {

                    /**
                     * Callback as used by {@link google.firestore.admin.v1.FirestoreAdmin#createIndex}.
                     * @param error Error, if any
                     * @param [response] Operation
                     */
                    type CreateIndexCallback = (error: (Error|null), response?: google.longrunning.Operation) => void;

                    /**
                     * Callback as used by {@link google.firestore.admin.v1.FirestoreAdmin#listIndexes}.
                     * @param error Error, if any
                     * @param [response] ListIndexesResponse
                     */
                    type ListIndexesCallback = (error: (Error|null), response?: google.firestore.admin.v1.ListIndexesResponse) => void;

                    /**
                     * Callback as used by {@link google.firestore.admin.v1.FirestoreAdmin#getIndex}.
                     * @param error Error, if any
                     * @param [response] Index
                     */
                    type GetIndexCallback = (error: (Error|null), response?: google.firestore.admin.v1.Index) => void;

                    /**
                     * Callback as used by {@link google.firestore.admin.v1.FirestoreAdmin#deleteIndex}.
                     * @param error Error, if any
                     * @param [response] Empty
                     */
                    type DeleteIndexCallback = (error: (Error|null), response?: google.protobuf.Empty) => void;

                    /**
                     * Callback as used by {@link google.firestore.admin.v1.FirestoreAdmin#getField}.
                     * @param error Error, if any
                     * @param [response] Field
                     */
                    type GetFieldCallback = (error: (Error|null), response?: google.firestore.admin.v1.Field) => void;

                    /**
                     * Callback as used by {@link google.firestore.admin.v1.FirestoreAdmin#updateField}.
                     * @param error Error, if any
                     * @param [response] Operation
                     */
                    type UpdateFieldCallback = (error: (Error|null), response?: google.longrunning.Operation) => void;

                    /**
                     * Callback as used by {@link google.firestore.admin.v1.FirestoreAdmin#listFields}.
                     * @param error Error, if any
                     * @param [response] ListFieldsResponse
                     */
                    type ListFieldsCallback = (error: (Error|null), response?: google.firestore.admin.v1.ListFieldsResponse) => void;

                    /**
                     * Callback as used by {@link google.firestore.admin.v1.FirestoreAdmin#exportDocuments}.
                     * @param error Error, if any
                     * @param [response] Operation
                     */
                    type ExportDocumentsCallback = (error: (Error|null), response?: google.longrunning.Operation) => void;

                    /**
                     * Callback as used by {@link google.firestore.admin.v1.FirestoreAdmin#importDocuments}.
                     * @param error Error, if any
                     * @param [response] Operation
                     */
                    type ImportDocumentsCallback = (error: (Error|null), response?: google.longrunning.Operation) => void;

                    /**
                     * Callback as used by {@link google.firestore.admin.v1.FirestoreAdmin#bulkDeleteDocuments}.
                     * @param error Error, if any
                     * @param [response] Operation
                     */
                    type BulkDeleteDocumentsCallback = (error: (Error|null), response?: google.longrunning.Operation) => void;

                    /**
                     * Callback as used by {@link google.firestore.admin.v1.FirestoreAdmin#createDatabase}.
                     * @param error Error, if any
                     * @param [response] Operation
                     */
                    type CreateDatabaseCallback = (error: (Error|null), response?: google.longrunning.Operation) => void;

                    /**
                     * Callback as used by {@link google.firestore.admin.v1.FirestoreAdmin#getDatabase}.
                     * @param error Error, if any
                     * @param [response] Database
                     */
                    type GetDatabaseCallback = (error: (Error|null), response?: google.firestore.admin.v1.Database) => void;

                    /**
                     * Callback as used by {@link google.firestore.admin.v1.FirestoreAdmin#listDatabases}.
                     * @param error Error, if any
                     * @param [response] ListDatabasesResponse
                     */
                    type ListDatabasesCallback = (error: (Error|null), response?: google.firestore.admin.v1.ListDatabasesResponse) => void;

                    /**
                     * Callback as used by {@link google.firestore.admin.v1.FirestoreAdmin#updateDatabase}.
                     * @param error Error, if any
                     * @param [response] Operation
                     */
                    type UpdateDatabaseCallback = (error: (Error|null), response?: google.longrunning.Operation) => void;

                    /**
                     * Callback as used by {@link google.firestore.admin.v1.FirestoreAdmin#deleteDatabase}.
                     * @param error Error, if any
                     * @param [response] Operation
                     */
                    type DeleteDatabaseCallback = (error: (Error|null), response?: google.longrunning.Operation) => void;

                    /**
                     * Callback as used by {@link google.firestore.admin.v1.FirestoreAdmin#getBackup}.
                     * @param error Error, if any
                     * @param [response] Backup
                     */
                    type GetBackupCallback = (error: (Error|null), response?: google.firestore.admin.v1.Backup) => void;

                    /**
                     * Callback as used by {@link google.firestore.admin.v1.FirestoreAdmin#listBackups}.
                     * @param error Error, if any
                     * @param [response] ListBackupsResponse
                     */
                    type ListBackupsCallback = (error: (Error|null), response?: google.firestore.admin.v1.ListBackupsResponse) => void;

                    /**
                     * Callback as used by {@link google.firestore.admin.v1.FirestoreAdmin#deleteBackup}.
                     * @param error Error, if any
                     * @param [response] Empty
                     */
                    type DeleteBackupCallback = (error: (Error|null), response?: google.protobuf.Empty) => void;

                    /**
                     * Callback as used by {@link google.firestore.admin.v1.FirestoreAdmin#restoreDatabase}.
                     * @param error Error, if any
                     * @param [response] Operation
                     */
                    type RestoreDatabaseCallback = (error: (Error|null), response?: google.longrunning.Operation) => void;

                    /**
                     * Callback as used by {@link google.firestore.admin.v1.FirestoreAdmin#createBackupSchedule}.
                     * @param error Error, if any
                     * @param [response] BackupSchedule
                     */
                    type CreateBackupScheduleCallback = (error: (Error|null), response?: google.firestore.admin.v1.BackupSchedule) => void;

                    /**
                     * Callback as used by {@link google.firestore.admin.v1.FirestoreAdmin#getBackupSchedule}.
                     * @param error Error, if any
                     * @param [response] BackupSchedule
                     */
                    type GetBackupScheduleCallback = (error: (Error|null), response?: google.firestore.admin.v1.BackupSchedule) => void;

                    /**
                     * Callback as used by {@link google.firestore.admin.v1.FirestoreAdmin#listBackupSchedules}.
                     * @param error Error, if any
                     * @param [response] ListBackupSchedulesResponse
                     */
                    type ListBackupSchedulesCallback = (error: (Error|null), response?: google.firestore.admin.v1.ListBackupSchedulesResponse) => void;

                    /**
                     * Callback as used by {@link google.firestore.admin.v1.FirestoreAdmin#updateBackupSchedule}.
                     * @param error Error, if any
                     * @param [response] BackupSchedule
                     */
                    type UpdateBackupScheduleCallback = (error: (Error|null), response?: google.firestore.admin.v1.BackupSchedule) => void;

                    /**
                     * Callback as used by {@link google.firestore.admin.v1.FirestoreAdmin#deleteBackupSchedule}.
                     * @param error Error, if any
                     * @param [response] Empty
                     */
                    type DeleteBackupScheduleCallback = (error: (Error|null), response?: google.protobuf.Empty) => void;
                }

                /** Properties of a ListDatabasesRequest. */
                interface IListDatabasesRequest {

                    /** ListDatabasesRequest parent */
                    parent?: (string|null);

                    /** ListDatabasesRequest showDeleted */
                    showDeleted?: (boolean|null);
                }

                /** Represents a ListDatabasesRequest. */
                class ListDatabasesRequest implements IListDatabasesRequest {

                    /**
                     * Constructs a new ListDatabasesRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.firestore.admin.v1.IListDatabasesRequest);

                    /** ListDatabasesRequest parent. */
                    public parent: string;

                    /** ListDatabasesRequest showDeleted. */
                    public showDeleted: boolean;

                    /**
                     * Creates a ListDatabasesRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns ListDatabasesRequest
                     */
                    public static fromObject(object: { [k: string]: any }): google.firestore.admin.v1.ListDatabasesRequest;

                    /**
                     * Creates a plain object from a ListDatabasesRequest message. Also converts values to other types if specified.
                     * @param message ListDatabasesRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.firestore.admin.v1.ListDatabasesRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this ListDatabasesRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for ListDatabasesRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a CreateDatabaseRequest. */
                interface ICreateDatabaseRequest {

                    /** CreateDatabaseRequest parent */
                    parent?: (string|null);

                    /** CreateDatabaseRequest database */
                    database?: (google.firestore.admin.v1.IDatabase|null);

                    /** CreateDatabaseRequest databaseId */
                    databaseId?: (string|null);
                }

                /** Represents a CreateDatabaseRequest. */
                class CreateDatabaseRequest implements ICreateDatabaseRequest {

                    /**
                     * Constructs a new CreateDatabaseRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.firestore.admin.v1.ICreateDatabaseRequest);

                    /** CreateDatabaseRequest parent. */
                    public parent: string;

                    /** CreateDatabaseRequest database. */
                    public database?: (google.firestore.admin.v1.IDatabase|null);

                    /** CreateDatabaseRequest databaseId. */
                    public databaseId: string;

                    /**
                     * Creates a CreateDatabaseRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns CreateDatabaseRequest
                     */
                    public static fromObject(object: { [k: string]: any }): google.firestore.admin.v1.CreateDatabaseRequest;

                    /**
                     * Creates a plain object from a CreateDatabaseRequest message. Also converts values to other types if specified.
                     * @param message CreateDatabaseRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.firestore.admin.v1.CreateDatabaseRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this CreateDatabaseRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for CreateDatabaseRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a CreateDatabaseMetadata. */
                interface ICreateDatabaseMetadata {
                }

                /** Represents a CreateDatabaseMetadata. */
                class CreateDatabaseMetadata implements ICreateDatabaseMetadata {

                    /**
                     * Constructs a new CreateDatabaseMetadata.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.firestore.admin.v1.ICreateDatabaseMetadata);

                    /**
                     * Creates a CreateDatabaseMetadata message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns CreateDatabaseMetadata
                     */
                    public static fromObject(object: { [k: string]: any }): google.firestore.admin.v1.CreateDatabaseMetadata;

                    /**
                     * Creates a plain object from a CreateDatabaseMetadata message. Also converts values to other types if specified.
                     * @param message CreateDatabaseMetadata
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.firestore.admin.v1.CreateDatabaseMetadata, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this CreateDatabaseMetadata to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for CreateDatabaseMetadata
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a ListDatabasesResponse. */
                interface IListDatabasesResponse {

                    /** ListDatabasesResponse databases */
                    databases?: (google.firestore.admin.v1.IDatabase[]|null);

                    /** ListDatabasesResponse unreachable */
                    unreachable?: (string[]|null);
                }

                /** Represents a ListDatabasesResponse. */
                class ListDatabasesResponse implements IListDatabasesResponse {

                    /**
                     * Constructs a new ListDatabasesResponse.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.firestore.admin.v1.IListDatabasesResponse);

                    /** ListDatabasesResponse databases. */
                    public databases: google.firestore.admin.v1.IDatabase[];

                    /** ListDatabasesResponse unreachable. */
                    public unreachable: string[];

                    /**
                     * Creates a ListDatabasesResponse message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns ListDatabasesResponse
                     */
                    public static fromObject(object: { [k: string]: any }): google.firestore.admin.v1.ListDatabasesResponse;

                    /**
                     * Creates a plain object from a ListDatabasesResponse message. Also converts values to other types if specified.
                     * @param message ListDatabasesResponse
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.firestore.admin.v1.ListDatabasesResponse, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this ListDatabasesResponse to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for ListDatabasesResponse
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a GetDatabaseRequest. */
                interface IGetDatabaseRequest {

                    /** GetDatabaseRequest name */
                    name?: (string|null);
                }

                /** Represents a GetDatabaseRequest. */
                class GetDatabaseRequest implements IGetDatabaseRequest {

                    /**
                     * Constructs a new GetDatabaseRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.firestore.admin.v1.IGetDatabaseRequest);

                    /** GetDatabaseRequest name. */
                    public name: string;

                    /**
                     * Creates a GetDatabaseRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns GetDatabaseRequest
                     */
                    public static fromObject(object: { [k: string]: any }): google.firestore.admin.v1.GetDatabaseRequest;

                    /**
                     * Creates a plain object from a GetDatabaseRequest message. Also converts values to other types if specified.
                     * @param message GetDatabaseRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.firestore.admin.v1.GetDatabaseRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this GetDatabaseRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for GetDatabaseRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of an UpdateDatabaseRequest. */
                interface IUpdateDatabaseRequest {

                    /** UpdateDatabaseRequest database */
                    database?: (google.firestore.admin.v1.IDatabase|null);

                    /** UpdateDatabaseRequest updateMask */
                    updateMask?: (google.protobuf.IFieldMask|null);
                }

                /** Represents an UpdateDatabaseRequest. */
                class UpdateDatabaseRequest implements IUpdateDatabaseRequest {

                    /**
                     * Constructs a new UpdateDatabaseRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.firestore.admin.v1.IUpdateDatabaseRequest);

                    /** UpdateDatabaseRequest database. */
                    public database?: (google.firestore.admin.v1.IDatabase|null);

                    /** UpdateDatabaseRequest updateMask. */
                    public updateMask?: (google.protobuf.IFieldMask|null);

                    /**
                     * Creates an UpdateDatabaseRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns UpdateDatabaseRequest
                     */
                    public static fromObject(object: { [k: string]: any }): google.firestore.admin.v1.UpdateDatabaseRequest;

                    /**
                     * Creates a plain object from an UpdateDatabaseRequest message. Also converts values to other types if specified.
                     * @param message UpdateDatabaseRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.firestore.admin.v1.UpdateDatabaseRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this UpdateDatabaseRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for UpdateDatabaseRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of an UpdateDatabaseMetadata. */
                interface IUpdateDatabaseMetadata {
                }

                /** Represents an UpdateDatabaseMetadata. */
                class UpdateDatabaseMetadata implements IUpdateDatabaseMetadata {

                    /**
                     * Constructs a new UpdateDatabaseMetadata.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.firestore.admin.v1.IUpdateDatabaseMetadata);

                    /**
                     * Creates an UpdateDatabaseMetadata message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns UpdateDatabaseMetadata
                     */
                    public static fromObject(object: { [k: string]: any }): google.firestore.admin.v1.UpdateDatabaseMetadata;

                    /**
                     * Creates a plain object from an UpdateDatabaseMetadata message. Also converts values to other types if specified.
                     * @param message UpdateDatabaseMetadata
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.firestore.admin.v1.UpdateDatabaseMetadata, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this UpdateDatabaseMetadata to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for UpdateDatabaseMetadata
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a DeleteDatabaseRequest. */
                interface IDeleteDatabaseRequest {

                    /** DeleteDatabaseRequest name */
                    name?: (string|null);

                    /** DeleteDatabaseRequest etag */
                    etag?: (string|null);
                }

                /** Represents a DeleteDatabaseRequest. */
                class DeleteDatabaseRequest implements IDeleteDatabaseRequest {

                    /**
                     * Constructs a new DeleteDatabaseRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.firestore.admin.v1.IDeleteDatabaseRequest);

                    /** DeleteDatabaseRequest name. */
                    public name: string;

                    /** DeleteDatabaseRequest etag. */
                    public etag: string;

                    /**
                     * Creates a DeleteDatabaseRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns DeleteDatabaseRequest
                     */
                    public static fromObject(object: { [k: string]: any }): google.firestore.admin.v1.DeleteDatabaseRequest;

                    /**
                     * Creates a plain object from a DeleteDatabaseRequest message. Also converts values to other types if specified.
                     * @param message DeleteDatabaseRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.firestore.admin.v1.DeleteDatabaseRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this DeleteDatabaseRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for DeleteDatabaseRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a DeleteDatabaseMetadata. */
                interface IDeleteDatabaseMetadata {
                }

                /** Represents a DeleteDatabaseMetadata. */
                class DeleteDatabaseMetadata implements IDeleteDatabaseMetadata {

                    /**
                     * Constructs a new DeleteDatabaseMetadata.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.firestore.admin.v1.IDeleteDatabaseMetadata);

                    /**
                     * Creates a DeleteDatabaseMetadata message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns DeleteDatabaseMetadata
                     */
                    public static fromObject(object: { [k: string]: any }): google.firestore.admin.v1.DeleteDatabaseMetadata;

                    /**
                     * Creates a plain object from a DeleteDatabaseMetadata message. Also converts values to other types if specified.
                     * @param message DeleteDatabaseMetadata
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.firestore.admin.v1.DeleteDatabaseMetadata, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this DeleteDatabaseMetadata to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for DeleteDatabaseMetadata
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a CreateBackupScheduleRequest. */
                interface ICreateBackupScheduleRequest {

                    /** CreateBackupScheduleRequest parent */
                    parent?: (string|null);

                    /** CreateBackupScheduleRequest backupSchedule */
                    backupSchedule?: (google.firestore.admin.v1.IBackupSchedule|null);
                }

                /** Represents a CreateBackupScheduleRequest. */
                class CreateBackupScheduleRequest implements ICreateBackupScheduleRequest {

                    /**
                     * Constructs a new CreateBackupScheduleRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.firestore.admin.v1.ICreateBackupScheduleRequest);

                    /** CreateBackupScheduleRequest parent. */
                    public parent: string;

                    /** CreateBackupScheduleRequest backupSchedule. */
                    public backupSchedule?: (google.firestore.admin.v1.IBackupSchedule|null);

                    /**
                     * Creates a CreateBackupScheduleRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns CreateBackupScheduleRequest
                     */
                    public static fromObject(object: { [k: string]: any }): google.firestore.admin.v1.CreateBackupScheduleRequest;

                    /**
                     * Creates a plain object from a CreateBackupScheduleRequest message. Also converts values to other types if specified.
                     * @param message CreateBackupScheduleRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.firestore.admin.v1.CreateBackupScheduleRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this CreateBackupScheduleRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for CreateBackupScheduleRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a GetBackupScheduleRequest. */
                interface IGetBackupScheduleRequest {

                    /** GetBackupScheduleRequest name */
                    name?: (string|null);
                }

                /** Represents a GetBackupScheduleRequest. */
                class GetBackupScheduleRequest implements IGetBackupScheduleRequest {

                    /**
                     * Constructs a new GetBackupScheduleRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.firestore.admin.v1.IGetBackupScheduleRequest);

                    /** GetBackupScheduleRequest name. */
                    public name: string;

                    /**
                     * Creates a GetBackupScheduleRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns GetBackupScheduleRequest
                     */
                    public static fromObject(object: { [k: string]: any }): google.firestore.admin.v1.GetBackupScheduleRequest;

                    /**
                     * Creates a plain object from a GetBackupScheduleRequest message. Also converts values to other types if specified.
                     * @param message GetBackupScheduleRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.firestore.admin.v1.GetBackupScheduleRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this GetBackupScheduleRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for GetBackupScheduleRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of an UpdateBackupScheduleRequest. */
                interface IUpdateBackupScheduleRequest {

                    /** UpdateBackupScheduleRequest backupSchedule */
                    backupSchedule?: (google.firestore.admin.v1.IBackupSchedule|null);

                    /** UpdateBackupScheduleRequest updateMask */
                    updateMask?: (google.protobuf.IFieldMask|null);
                }

                /** Represents an UpdateBackupScheduleRequest. */
                class UpdateBackupScheduleRequest implements IUpdateBackupScheduleRequest {

                    /**
                     * Constructs a new UpdateBackupScheduleRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.firestore.admin.v1.IUpdateBackupScheduleRequest);

                    /** UpdateBackupScheduleRequest backupSchedule. */
                    public backupSchedule?: (google.firestore.admin.v1.IBackupSchedule|null);

                    /** UpdateBackupScheduleRequest updateMask. */
                    public updateMask?: (google.protobuf.IFieldMask|null);

                    /**
                     * Creates an UpdateBackupScheduleRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns UpdateBackupScheduleRequest
                     */
                    public static fromObject(object: { [k: string]: any }): google.firestore.admin.v1.UpdateBackupScheduleRequest;

                    /**
                     * Creates a plain object from an UpdateBackupScheduleRequest message. Also converts values to other types if specified.
                     * @param message UpdateBackupScheduleRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.firestore.admin.v1.UpdateBackupScheduleRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this UpdateBackupScheduleRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for UpdateBackupScheduleRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a ListBackupSchedulesRequest. */
                interface IListBackupSchedulesRequest {

                    /** ListBackupSchedulesRequest parent */
                    parent?: (string|null);
                }

                /** Represents a ListBackupSchedulesRequest. */
                class ListBackupSchedulesRequest implements IListBackupSchedulesRequest {

                    /**
                     * Constructs a new ListBackupSchedulesRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.firestore.admin.v1.IListBackupSchedulesRequest);

                    /** ListBackupSchedulesRequest parent. */
                    public parent: string;

                    /**
                     * Creates a ListBackupSchedulesRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns ListBackupSchedulesRequest
                     */
                    public static fromObject(object: { [k: string]: any }): google.firestore.admin.v1.ListBackupSchedulesRequest;

                    /**
                     * Creates a plain object from a ListBackupSchedulesRequest message. Also converts values to other types if specified.
                     * @param message ListBackupSchedulesRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.firestore.admin.v1.ListBackupSchedulesRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this ListBackupSchedulesRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for ListBackupSchedulesRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a ListBackupSchedulesResponse. */
                interface IListBackupSchedulesResponse {

                    /** ListBackupSchedulesResponse backupSchedules */
                    backupSchedules?: (google.firestore.admin.v1.IBackupSchedule[]|null);
                }

                /** Represents a ListBackupSchedulesResponse. */
                class ListBackupSchedulesResponse implements IListBackupSchedulesResponse {

                    /**
                     * Constructs a new ListBackupSchedulesResponse.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.firestore.admin.v1.IListBackupSchedulesResponse);

                    /** ListBackupSchedulesResponse backupSchedules. */
                    public backupSchedules: google.firestore.admin.v1.IBackupSchedule[];

                    /**
                     * Creates a ListBackupSchedulesResponse message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns ListBackupSchedulesResponse
                     */
                    public static fromObject(object: { [k: string]: any }): google.firestore.admin.v1.ListBackupSchedulesResponse;

                    /**
                     * Creates a plain object from a ListBackupSchedulesResponse message. Also converts values to other types if specified.
                     * @param message ListBackupSchedulesResponse
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.firestore.admin.v1.ListBackupSchedulesResponse, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this ListBackupSchedulesResponse to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for ListBackupSchedulesResponse
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a DeleteBackupScheduleRequest. */
                interface IDeleteBackupScheduleRequest {

                    /** DeleteBackupScheduleRequest name */
                    name?: (string|null);
                }

                /** Represents a DeleteBackupScheduleRequest. */
                class DeleteBackupScheduleRequest implements IDeleteBackupScheduleRequest {

                    /**
                     * Constructs a new DeleteBackupScheduleRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.firestore.admin.v1.IDeleteBackupScheduleRequest);

                    /** DeleteBackupScheduleRequest name. */
                    public name: string;

                    /**
                     * Creates a DeleteBackupScheduleRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns DeleteBackupScheduleRequest
                     */
                    public static fromObject(object: { [k: string]: any }): google.firestore.admin.v1.DeleteBackupScheduleRequest;

                    /**
                     * Creates a plain object from a DeleteBackupScheduleRequest message. Also converts values to other types if specified.
                     * @param message DeleteBackupScheduleRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.firestore.admin.v1.DeleteBackupScheduleRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this DeleteBackupScheduleRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for DeleteBackupScheduleRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a CreateIndexRequest. */
                interface ICreateIndexRequest {

                    /** CreateIndexRequest parent */
                    parent?: (string|null);

                    /** CreateIndexRequest index */
                    index?: (google.firestore.admin.v1.IIndex|null);
                }

                /** Represents a CreateIndexRequest. */
                class CreateIndexRequest implements ICreateIndexRequest {

                    /**
                     * Constructs a new CreateIndexRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.firestore.admin.v1.ICreateIndexRequest);

                    /** CreateIndexRequest parent. */
                    public parent: string;

                    /** CreateIndexRequest index. */
                    public index?: (google.firestore.admin.v1.IIndex|null);

                    /**
                     * Creates a CreateIndexRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns CreateIndexRequest
                     */
                    public static fromObject(object: { [k: string]: any }): google.firestore.admin.v1.CreateIndexRequest;

                    /**
                     * Creates a plain object from a CreateIndexRequest message. Also converts values to other types if specified.
                     * @param message CreateIndexRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.firestore.admin.v1.CreateIndexRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this CreateIndexRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for CreateIndexRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a ListIndexesRequest. */
                interface IListIndexesRequest {

                    /** ListIndexesRequest parent */
                    parent?: (string|null);

                    /** ListIndexesRequest filter */
                    filter?: (string|null);

                    /** ListIndexesRequest pageSize */
                    pageSize?: (number|null);

                    /** ListIndexesRequest pageToken */
                    pageToken?: (string|null);
                }

                /** Represents a ListIndexesRequest. */
                class ListIndexesRequest implements IListIndexesRequest {

                    /**
                     * Constructs a new ListIndexesRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.firestore.admin.v1.IListIndexesRequest);

                    /** ListIndexesRequest parent. */
                    public parent: string;

                    /** ListIndexesRequest filter. */
                    public filter: string;

                    /** ListIndexesRequest pageSize. */
                    public pageSize: number;

                    /** ListIndexesRequest pageToken. */
                    public pageToken: string;

                    /**
                     * Creates a ListIndexesRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns ListIndexesRequest
                     */
                    public static fromObject(object: { [k: string]: any }): google.firestore.admin.v1.ListIndexesRequest;

                    /**
                     * Creates a plain object from a ListIndexesRequest message. Also converts values to other types if specified.
                     * @param message ListIndexesRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.firestore.admin.v1.ListIndexesRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this ListIndexesRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for ListIndexesRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a ListIndexesResponse. */
                interface IListIndexesResponse {

                    /** ListIndexesResponse indexes */
                    indexes?: (google.firestore.admin.v1.IIndex[]|null);

                    /** ListIndexesResponse nextPageToken */
                    nextPageToken?: (string|null);
                }

                /** Represents a ListIndexesResponse. */
                class ListIndexesResponse implements IListIndexesResponse {

                    /**
                     * Constructs a new ListIndexesResponse.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.firestore.admin.v1.IListIndexesResponse);

                    /** ListIndexesResponse indexes. */
                    public indexes: google.firestore.admin.v1.IIndex[];

                    /** ListIndexesResponse nextPageToken. */
                    public nextPageToken: string;

                    /**
                     * Creates a ListIndexesResponse message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns ListIndexesResponse
                     */
                    public static fromObject(object: { [k: string]: any }): google.firestore.admin.v1.ListIndexesResponse;

                    /**
                     * Creates a plain object from a ListIndexesResponse message. Also converts values to other types if specified.
                     * @param message ListIndexesResponse
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.firestore.admin.v1.ListIndexesResponse, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this ListIndexesResponse to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for ListIndexesResponse
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a GetIndexRequest. */
                interface IGetIndexRequest {

                    /** GetIndexRequest name */
                    name?: (string|null);
                }

                /** Represents a GetIndexRequest. */
                class GetIndexRequest implements IGetIndexRequest {

                    /**
                     * Constructs a new GetIndexRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.firestore.admin.v1.IGetIndexRequest);

                    /** GetIndexRequest name. */
                    public name: string;

                    /**
                     * Creates a GetIndexRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns GetIndexRequest
                     */
                    public static fromObject(object: { [k: string]: any }): google.firestore.admin.v1.GetIndexRequest;

                    /**
                     * Creates a plain object from a GetIndexRequest message. Also converts values to other types if specified.
                     * @param message GetIndexRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.firestore.admin.v1.GetIndexRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this GetIndexRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for GetIndexRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a DeleteIndexRequest. */
                interface IDeleteIndexRequest {

                    /** DeleteIndexRequest name */
                    name?: (string|null);
                }

                /** Represents a DeleteIndexRequest. */
                class DeleteIndexRequest implements IDeleteIndexRequest {

                    /**
                     * Constructs a new DeleteIndexRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.firestore.admin.v1.IDeleteIndexRequest);

                    /** DeleteIndexRequest name. */
                    public name: string;

                    /**
                     * Creates a DeleteIndexRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns DeleteIndexRequest
                     */
                    public static fromObject(object: { [k: string]: any }): google.firestore.admin.v1.DeleteIndexRequest;

                    /**
                     * Creates a plain object from a DeleteIndexRequest message. Also converts values to other types if specified.
                     * @param message DeleteIndexRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.firestore.admin.v1.DeleteIndexRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this DeleteIndexRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for DeleteIndexRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of an UpdateFieldRequest. */
                interface IUpdateFieldRequest {

                    /** UpdateFieldRequest field */
                    field?: (google.firestore.admin.v1.IField|null);

                    /** UpdateFieldRequest updateMask */
                    updateMask?: (google.protobuf.IFieldMask|null);
                }

                /** Represents an UpdateFieldRequest. */
                class UpdateFieldRequest implements IUpdateFieldRequest {

                    /**
                     * Constructs a new UpdateFieldRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.firestore.admin.v1.IUpdateFieldRequest);

                    /** UpdateFieldRequest field. */
                    public field?: (google.firestore.admin.v1.IField|null);

                    /** UpdateFieldRequest updateMask. */
                    public updateMask?: (google.protobuf.IFieldMask|null);

                    /**
                     * Creates an UpdateFieldRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns UpdateFieldRequest
                     */
                    public static fromObject(object: { [k: string]: any }): google.firestore.admin.v1.UpdateFieldRequest;

                    /**
                     * Creates a plain object from an UpdateFieldRequest message. Also converts values to other types if specified.
                     * @param message UpdateFieldRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.firestore.admin.v1.UpdateFieldRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this UpdateFieldRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for UpdateFieldRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a GetFieldRequest. */
                interface IGetFieldRequest {

                    /** GetFieldRequest name */
                    name?: (string|null);
                }

                /** Represents a GetFieldRequest. */
                class GetFieldRequest implements IGetFieldRequest {

                    /**
                     * Constructs a new GetFieldRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.firestore.admin.v1.IGetFieldRequest);

                    /** GetFieldRequest name. */
                    public name: string;

                    /**
                     * Creates a GetFieldRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns GetFieldRequest
                     */
                    public static fromObject(object: { [k: string]: any }): google.firestore.admin.v1.GetFieldRequest;

                    /**
                     * Creates a plain object from a GetFieldRequest message. Also converts values to other types if specified.
                     * @param message GetFieldRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.firestore.admin.v1.GetFieldRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this GetFieldRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for GetFieldRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a ListFieldsRequest. */
                interface IListFieldsRequest {

                    /** ListFieldsRequest parent */
                    parent?: (string|null);

                    /** ListFieldsRequest filter */
                    filter?: (string|null);

                    /** ListFieldsRequest pageSize */
                    pageSize?: (number|null);

                    /** ListFieldsRequest pageToken */
                    pageToken?: (string|null);
                }

                /** Represents a ListFieldsRequest. */
                class ListFieldsRequest implements IListFieldsRequest {

                    /**
                     * Constructs a new ListFieldsRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.firestore.admin.v1.IListFieldsRequest);

                    /** ListFieldsRequest parent. */
                    public parent: string;

                    /** ListFieldsRequest filter. */
                    public filter: string;

                    /** ListFieldsRequest pageSize. */
                    public pageSize: number;

                    /** ListFieldsRequest pageToken. */
                    public pageToken: string;

                    /**
                     * Creates a ListFieldsRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns ListFieldsRequest
                     */
                    public static fromObject(object: { [k: string]: any }): google.firestore.admin.v1.ListFieldsRequest;

                    /**
                     * Creates a plain object from a ListFieldsRequest message. Also converts values to other types if specified.
                     * @param message ListFieldsRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.firestore.admin.v1.ListFieldsRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this ListFieldsRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for ListFieldsRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a ListFieldsResponse. */
                interface IListFieldsResponse {

                    /** ListFieldsResponse fields */
                    fields?: (google.firestore.admin.v1.IField[]|null);

                    /** ListFieldsResponse nextPageToken */
                    nextPageToken?: (string|null);
                }

                /** Represents a ListFieldsResponse. */
                class ListFieldsResponse implements IListFieldsResponse {

                    /**
                     * Constructs a new ListFieldsResponse.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.firestore.admin.v1.IListFieldsResponse);

                    /** ListFieldsResponse fields. */
                    public fields: google.firestore.admin.v1.IField[];

                    /** ListFieldsResponse nextPageToken. */
                    public nextPageToken: string;

                    /**
                     * Creates a ListFieldsResponse message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns ListFieldsResponse
                     */
                    public static fromObject(object: { [k: string]: any }): google.firestore.admin.v1.ListFieldsResponse;

                    /**
                     * Creates a plain object from a ListFieldsResponse message. Also converts values to other types if specified.
                     * @param message ListFieldsResponse
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.firestore.admin.v1.ListFieldsResponse, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this ListFieldsResponse to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for ListFieldsResponse
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of an ExportDocumentsRequest. */
                interface IExportDocumentsRequest {

                    /** ExportDocumentsRequest name */
                    name?: (string|null);

                    /** ExportDocumentsRequest collectionIds */
                    collectionIds?: (string[]|null);

                    /** ExportDocumentsRequest outputUriPrefix */
                    outputUriPrefix?: (string|null);

                    /** ExportDocumentsRequest namespaceIds */
                    namespaceIds?: (string[]|null);

                    /** ExportDocumentsRequest snapshotTime */
                    snapshotTime?: (google.protobuf.ITimestamp|null);
                }

                /** Represents an ExportDocumentsRequest. */
                class ExportDocumentsRequest implements IExportDocumentsRequest {

                    /**
                     * Constructs a new ExportDocumentsRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.firestore.admin.v1.IExportDocumentsRequest);

                    /** ExportDocumentsRequest name. */
                    public name: string;

                    /** ExportDocumentsRequest collectionIds. */
                    public collectionIds: string[];

                    /** ExportDocumentsRequest outputUriPrefix. */
                    public outputUriPrefix: string;

                    /** ExportDocumentsRequest namespaceIds. */
                    public namespaceIds: string[];

                    /** ExportDocumentsRequest snapshotTime. */
                    public snapshotTime?: (google.protobuf.ITimestamp|null);

                    /**
                     * Creates an ExportDocumentsRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns ExportDocumentsRequest
                     */
                    public static fromObject(object: { [k: string]: any }): google.firestore.admin.v1.ExportDocumentsRequest;

                    /**
                     * Creates a plain object from an ExportDocumentsRequest message. Also converts values to other types if specified.
                     * @param message ExportDocumentsRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.firestore.admin.v1.ExportDocumentsRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this ExportDocumentsRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for ExportDocumentsRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of an ImportDocumentsRequest. */
                interface IImportDocumentsRequest {

                    /** ImportDocumentsRequest name */
                    name?: (string|null);

                    /** ImportDocumentsRequest collectionIds */
                    collectionIds?: (string[]|null);

                    /** ImportDocumentsRequest inputUriPrefix */
                    inputUriPrefix?: (string|null);

                    /** ImportDocumentsRequest namespaceIds */
                    namespaceIds?: (string[]|null);
                }

                /** Represents an ImportDocumentsRequest. */
                class ImportDocumentsRequest implements IImportDocumentsRequest {

                    /**
                     * Constructs a new ImportDocumentsRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.firestore.admin.v1.IImportDocumentsRequest);

                    /** ImportDocumentsRequest name. */
                    public name: string;

                    /** ImportDocumentsRequest collectionIds. */
                    public collectionIds: string[];

                    /** ImportDocumentsRequest inputUriPrefix. */
                    public inputUriPrefix: string;

                    /** ImportDocumentsRequest namespaceIds. */
                    public namespaceIds: string[];

                    /**
                     * Creates an ImportDocumentsRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns ImportDocumentsRequest
                     */
                    public static fromObject(object: { [k: string]: any }): google.firestore.admin.v1.ImportDocumentsRequest;

                    /**
                     * Creates a plain object from an ImportDocumentsRequest message. Also converts values to other types if specified.
                     * @param message ImportDocumentsRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.firestore.admin.v1.ImportDocumentsRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this ImportDocumentsRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for ImportDocumentsRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a BulkDeleteDocumentsRequest. */
                interface IBulkDeleteDocumentsRequest {

                    /** BulkDeleteDocumentsRequest name */
                    name?: (string|null);

                    /** BulkDeleteDocumentsRequest collectionIds */
                    collectionIds?: (string[]|null);

                    /** BulkDeleteDocumentsRequest namespaceIds */
                    namespaceIds?: (string[]|null);
                }

                /** Represents a BulkDeleteDocumentsRequest. */
                class BulkDeleteDocumentsRequest implements IBulkDeleteDocumentsRequest {

                    /**
                     * Constructs a new BulkDeleteDocumentsRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.firestore.admin.v1.IBulkDeleteDocumentsRequest);

                    /** BulkDeleteDocumentsRequest name. */
                    public name: string;

                    /** BulkDeleteDocumentsRequest collectionIds. */
                    public collectionIds: string[];

                    /** BulkDeleteDocumentsRequest namespaceIds. */
                    public namespaceIds: string[];

                    /**
                     * Creates a BulkDeleteDocumentsRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns BulkDeleteDocumentsRequest
                     */
                    public static fromObject(object: { [k: string]: any }): google.firestore.admin.v1.BulkDeleteDocumentsRequest;

                    /**
                     * Creates a plain object from a BulkDeleteDocumentsRequest message. Also converts values to other types if specified.
                     * @param message BulkDeleteDocumentsRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.firestore.admin.v1.BulkDeleteDocumentsRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this BulkDeleteDocumentsRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for BulkDeleteDocumentsRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a BulkDeleteDocumentsResponse. */
                interface IBulkDeleteDocumentsResponse {
                }

                /** Represents a BulkDeleteDocumentsResponse. */
                class BulkDeleteDocumentsResponse implements IBulkDeleteDocumentsResponse {

                    /**
                     * Constructs a new BulkDeleteDocumentsResponse.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.firestore.admin.v1.IBulkDeleteDocumentsResponse);

                    /**
                     * Creates a BulkDeleteDocumentsResponse message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns BulkDeleteDocumentsResponse
                     */
                    public static fromObject(object: { [k: string]: any }): google.firestore.admin.v1.BulkDeleteDocumentsResponse;

                    /**
                     * Creates a plain object from a BulkDeleteDocumentsResponse message. Also converts values to other types if specified.
                     * @param message BulkDeleteDocumentsResponse
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.firestore.admin.v1.BulkDeleteDocumentsResponse, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this BulkDeleteDocumentsResponse to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for BulkDeleteDocumentsResponse
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a GetBackupRequest. */
                interface IGetBackupRequest {

                    /** GetBackupRequest name */
                    name?: (string|null);
                }

                /** Represents a GetBackupRequest. */
                class GetBackupRequest implements IGetBackupRequest {

                    /**
                     * Constructs a new GetBackupRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.firestore.admin.v1.IGetBackupRequest);

                    /** GetBackupRequest name. */
                    public name: string;

                    /**
                     * Creates a GetBackupRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns GetBackupRequest
                     */
                    public static fromObject(object: { [k: string]: any }): google.firestore.admin.v1.GetBackupRequest;

                    /**
                     * Creates a plain object from a GetBackupRequest message. Also converts values to other types if specified.
                     * @param message GetBackupRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.firestore.admin.v1.GetBackupRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this GetBackupRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for GetBackupRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a ListBackupsRequest. */
                interface IListBackupsRequest {

                    /** ListBackupsRequest parent */
                    parent?: (string|null);

                    /** ListBackupsRequest filter */
                    filter?: (string|null);
                }

                /** Represents a ListBackupsRequest. */
                class ListBackupsRequest implements IListBackupsRequest {

                    /**
                     * Constructs a new ListBackupsRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.firestore.admin.v1.IListBackupsRequest);

                    /** ListBackupsRequest parent. */
                    public parent: string;

                    /** ListBackupsRequest filter. */
                    public filter: string;

                    /**
                     * Creates a ListBackupsRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns ListBackupsRequest
                     */
                    public static fromObject(object: { [k: string]: any }): google.firestore.admin.v1.ListBackupsRequest;

                    /**
                     * Creates a plain object from a ListBackupsRequest message. Also converts values to other types if specified.
                     * @param message ListBackupsRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.firestore.admin.v1.ListBackupsRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this ListBackupsRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for ListBackupsRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a ListBackupsResponse. */
                interface IListBackupsResponse {

                    /** ListBackupsResponse backups */
                    backups?: (google.firestore.admin.v1.IBackup[]|null);

                    /** ListBackupsResponse unreachable */
                    unreachable?: (string[]|null);
                }

                /** Represents a ListBackupsResponse. */
                class ListBackupsResponse implements IListBackupsResponse {

                    /**
                     * Constructs a new ListBackupsResponse.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.firestore.admin.v1.IListBackupsResponse);

                    /** ListBackupsResponse backups. */
                    public backups: google.firestore.admin.v1.IBackup[];

                    /** ListBackupsResponse unreachable. */
                    public unreachable: string[];

                    /**
                     * Creates a ListBackupsResponse message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns ListBackupsResponse
                     */
                    public static fromObject(object: { [k: string]: any }): google.firestore.admin.v1.ListBackupsResponse;

                    /**
                     * Creates a plain object from a ListBackupsResponse message. Also converts values to other types if specified.
                     * @param message ListBackupsResponse
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.firestore.admin.v1.ListBackupsResponse, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this ListBackupsResponse to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for ListBackupsResponse
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a DeleteBackupRequest. */
                interface IDeleteBackupRequest {

                    /** DeleteBackupRequest name */
                    name?: (string|null);
                }

                /** Represents a DeleteBackupRequest. */
                class DeleteBackupRequest implements IDeleteBackupRequest {

                    /**
                     * Constructs a new DeleteBackupRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.firestore.admin.v1.IDeleteBackupRequest);

                    /** DeleteBackupRequest name. */
                    public name: string;

                    /**
                     * Creates a DeleteBackupRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns DeleteBackupRequest
                     */
                    public static fromObject(object: { [k: string]: any }): google.firestore.admin.v1.DeleteBackupRequest;

                    /**
                     * Creates a plain object from a DeleteBackupRequest message. Also converts values to other types if specified.
                     * @param message DeleteBackupRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.firestore.admin.v1.DeleteBackupRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this DeleteBackupRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for DeleteBackupRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a RestoreDatabaseRequest. */
                interface IRestoreDatabaseRequest {

                    /** RestoreDatabaseRequest parent */
                    parent?: (string|null);

                    /** RestoreDatabaseRequest databaseId */
                    databaseId?: (string|null);

                    /** RestoreDatabaseRequest backup */
                    backup?: (string|null);

                    /** RestoreDatabaseRequest encryptionConfig */
                    encryptionConfig?: (google.firestore.admin.v1.Database.IEncryptionConfig|null);
                }

                /** Represents a RestoreDatabaseRequest. */
                class RestoreDatabaseRequest implements IRestoreDatabaseRequest {

                    /**
                     * Constructs a new RestoreDatabaseRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.firestore.admin.v1.IRestoreDatabaseRequest);

                    /** RestoreDatabaseRequest parent. */
                    public parent: string;

                    /** RestoreDatabaseRequest databaseId. */
                    public databaseId: string;

                    /** RestoreDatabaseRequest backup. */
                    public backup: string;

                    /** RestoreDatabaseRequest encryptionConfig. */
                    public encryptionConfig?: (google.firestore.admin.v1.Database.IEncryptionConfig|null);

                    /**
                     * Creates a RestoreDatabaseRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns RestoreDatabaseRequest
                     */
                    public static fromObject(object: { [k: string]: any }): google.firestore.admin.v1.RestoreDatabaseRequest;

                    /**
                     * Creates a plain object from a RestoreDatabaseRequest message. Also converts values to other types if specified.
                     * @param message RestoreDatabaseRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.firestore.admin.v1.RestoreDatabaseRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this RestoreDatabaseRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for RestoreDatabaseRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of an IndexOperationMetadata. */
                interface IIndexOperationMetadata {

                    /** IndexOperationMetadata startTime */
                    startTime?: (google.protobuf.ITimestamp|null);

                    /** IndexOperationMetadata endTime */
                    endTime?: (google.protobuf.ITimestamp|null);

                    /** IndexOperationMetadata index */
                    index?: (string|null);

                    /** IndexOperationMetadata state */
                    state?: (google.firestore.admin.v1.OperationState|null);

                    /** IndexOperationMetadata progressDocuments */
                    progressDocuments?: (google.firestore.admin.v1.IProgress|null);

                    /** IndexOperationMetadata progressBytes */
                    progressBytes?: (google.firestore.admin.v1.IProgress|null);
                }

                /** Represents an IndexOperationMetadata. */
                class IndexOperationMetadata implements IIndexOperationMetadata {

                    /**
                     * Constructs a new IndexOperationMetadata.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.firestore.admin.v1.IIndexOperationMetadata);

                    /** IndexOperationMetadata startTime. */
                    public startTime?: (google.protobuf.ITimestamp|null);

                    /** IndexOperationMetadata endTime. */
                    public endTime?: (google.protobuf.ITimestamp|null);

                    /** IndexOperationMetadata index. */
                    public index: string;

                    /** IndexOperationMetadata state. */
                    public state: google.firestore.admin.v1.OperationState;

                    /** IndexOperationMetadata progressDocuments. */
                    public progressDocuments?: (google.firestore.admin.v1.IProgress|null);

                    /** IndexOperationMetadata progressBytes. */
                    public progressBytes?: (google.firestore.admin.v1.IProgress|null);

                    /**
                     * Creates an IndexOperationMetadata message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns IndexOperationMetadata
                     */
                    public static fromObject(object: { [k: string]: any }): google.firestore.admin.v1.IndexOperationMetadata;

                    /**
                     * Creates a plain object from an IndexOperationMetadata message. Also converts values to other types if specified.
                     * @param message IndexOperationMetadata
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.firestore.admin.v1.IndexOperationMetadata, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this IndexOperationMetadata to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for IndexOperationMetadata
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a FieldOperationMetadata. */
                interface IFieldOperationMetadata {

                    /** FieldOperationMetadata startTime */
                    startTime?: (google.protobuf.ITimestamp|null);

                    /** FieldOperationMetadata endTime */
                    endTime?: (google.protobuf.ITimestamp|null);

                    /** FieldOperationMetadata field */
                    field?: (string|null);

                    /** FieldOperationMetadata indexConfigDeltas */
                    indexConfigDeltas?: (google.firestore.admin.v1.FieldOperationMetadata.IIndexConfigDelta[]|null);

                    /** FieldOperationMetadata state */
                    state?: (google.firestore.admin.v1.OperationState|null);

                    /** FieldOperationMetadata progressDocuments */
                    progressDocuments?: (google.firestore.admin.v1.IProgress|null);

                    /** FieldOperationMetadata progressBytes */
                    progressBytes?: (google.firestore.admin.v1.IProgress|null);

                    /** FieldOperationMetadata ttlConfigDelta */
                    ttlConfigDelta?: (google.firestore.admin.v1.FieldOperationMetadata.ITtlConfigDelta|null);
                }

                /** Represents a FieldOperationMetadata. */
                class FieldOperationMetadata implements IFieldOperationMetadata {

                    /**
                     * Constructs a new FieldOperationMetadata.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.firestore.admin.v1.IFieldOperationMetadata);

                    /** FieldOperationMetadata startTime. */
                    public startTime?: (google.protobuf.ITimestamp|null);

                    /** FieldOperationMetadata endTime. */
                    public endTime?: (google.protobuf.ITimestamp|null);

                    /** FieldOperationMetadata field. */
                    public field: string;

                    /** FieldOperationMetadata indexConfigDeltas. */
                    public indexConfigDeltas: google.firestore.admin.v1.FieldOperationMetadata.IIndexConfigDelta[];

                    /** FieldOperationMetadata state. */
                    public state: google.firestore.admin.v1.OperationState;

                    /** FieldOperationMetadata progressDocuments. */
                    public progressDocuments?: (google.firestore.admin.v1.IProgress|null);

                    /** FieldOperationMetadata progressBytes. */
                    public progressBytes?: (google.firestore.admin.v1.IProgress|null);

                    /** FieldOperationMetadata ttlConfigDelta. */
                    public ttlConfigDelta?: (google.firestore.admin.v1.FieldOperationMetadata.ITtlConfigDelta|null);

                    /**
                     * Creates a FieldOperationMetadata message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns FieldOperationMetadata
                     */
                    public static fromObject(object: { [k: string]: any }): google.firestore.admin.v1.FieldOperationMetadata;

                    /**
                     * Creates a plain object from a FieldOperationMetadata message. Also converts values to other types if specified.
                     * @param message FieldOperationMetadata
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.firestore.admin.v1.FieldOperationMetadata, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this FieldOperationMetadata to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for FieldOperationMetadata
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                namespace FieldOperationMetadata {

                    /** Properties of an IndexConfigDelta. */
                    interface IIndexConfigDelta {

                        /** IndexConfigDelta changeType */
                        changeType?: (google.firestore.admin.v1.FieldOperationMetadata.IndexConfigDelta.ChangeType|null);

                        /** IndexConfigDelta index */
                        index?: (google.firestore.admin.v1.IIndex|null);
                    }

                    /** Represents an IndexConfigDelta. */
                    class IndexConfigDelta implements IIndexConfigDelta {

                        /**
                         * Constructs a new IndexConfigDelta.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: google.firestore.admin.v1.FieldOperationMetadata.IIndexConfigDelta);

                        /** IndexConfigDelta changeType. */
                        public changeType: google.firestore.admin.v1.FieldOperationMetadata.IndexConfigDelta.ChangeType;

                        /** IndexConfigDelta index. */
                        public index?: (google.firestore.admin.v1.IIndex|null);

                        /**
                         * Creates an IndexConfigDelta message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns IndexConfigDelta
                         */
                        public static fromObject(object: { [k: string]: any }): google.firestore.admin.v1.FieldOperationMetadata.IndexConfigDelta;

                        /**
                         * Creates a plain object from an IndexConfigDelta message. Also converts values to other types if specified.
                         * @param message IndexConfigDelta
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        public static toObject(message: google.firestore.admin.v1.FieldOperationMetadata.IndexConfigDelta, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this IndexConfigDelta to JSON.
                         * @returns JSON object
                         */
                        public toJSON(): { [k: string]: any };

                        /**
                         * Gets the default type url for IndexConfigDelta
                         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                         * @returns The default type url
                         */
                        public static getTypeUrl(typeUrlPrefix?: string): string;
                    }

                    namespace IndexConfigDelta {

                        /** ChangeType enum. */
                        type ChangeType =
                            "CHANGE_TYPE_UNSPECIFIED"| "ADD"| "REMOVE";
                    }

                    /** Properties of a TtlConfigDelta. */
                    interface ITtlConfigDelta {

                        /** TtlConfigDelta changeType */
                        changeType?: (google.firestore.admin.v1.FieldOperationMetadata.TtlConfigDelta.ChangeType|null);
                    }

                    /** Represents a TtlConfigDelta. */
                    class TtlConfigDelta implements ITtlConfigDelta {

                        /**
                         * Constructs a new TtlConfigDelta.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: google.firestore.admin.v1.FieldOperationMetadata.ITtlConfigDelta);

                        /** TtlConfigDelta changeType. */
                        public changeType: google.firestore.admin.v1.FieldOperationMetadata.TtlConfigDelta.ChangeType;

                        /**
                         * Creates a TtlConfigDelta message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns TtlConfigDelta
                         */
                        public static fromObject(object: { [k: string]: any }): google.firestore.admin.v1.FieldOperationMetadata.TtlConfigDelta;

                        /**
                         * Creates a plain object from a TtlConfigDelta message. Also converts values to other types if specified.
                         * @param message TtlConfigDelta
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        public static toObject(message: google.firestore.admin.v1.FieldOperationMetadata.TtlConfigDelta, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this TtlConfigDelta to JSON.
                         * @returns JSON object
                         */
                        public toJSON(): { [k: string]: any };

                        /**
                         * Gets the default type url for TtlConfigDelta
                         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                         * @returns The default type url
                         */
                        public static getTypeUrl(typeUrlPrefix?: string): string;
                    }

                    namespace TtlConfigDelta {

                        /** ChangeType enum. */
                        type ChangeType =
                            "CHANGE_TYPE_UNSPECIFIED"| "ADD"| "REMOVE";
                    }
                }

                /** Properties of an ExportDocumentsMetadata. */
                interface IExportDocumentsMetadata {

                    /** ExportDocumentsMetadata startTime */
                    startTime?: (google.protobuf.ITimestamp|null);

                    /** ExportDocumentsMetadata endTime */
                    endTime?: (google.protobuf.ITimestamp|null);

                    /** ExportDocumentsMetadata operationState */
                    operationState?: (google.firestore.admin.v1.OperationState|null);

                    /** ExportDocumentsMetadata progressDocuments */
                    progressDocuments?: (google.firestore.admin.v1.IProgress|null);

                    /** ExportDocumentsMetadata progressBytes */
                    progressBytes?: (google.firestore.admin.v1.IProgress|null);

                    /** ExportDocumentsMetadata collectionIds */
                    collectionIds?: (string[]|null);

                    /** ExportDocumentsMetadata outputUriPrefix */
                    outputUriPrefix?: (string|null);

                    /** ExportDocumentsMetadata namespaceIds */
                    namespaceIds?: (string[]|null);

                    /** ExportDocumentsMetadata snapshotTime */
                    snapshotTime?: (google.protobuf.ITimestamp|null);
                }

                /** Represents an ExportDocumentsMetadata. */
                class ExportDocumentsMetadata implements IExportDocumentsMetadata {

                    /**
                     * Constructs a new ExportDocumentsMetadata.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.firestore.admin.v1.IExportDocumentsMetadata);

                    /** ExportDocumentsMetadata startTime. */
                    public startTime?: (google.protobuf.ITimestamp|null);

                    /** ExportDocumentsMetadata endTime. */
                    public endTime?: (google.protobuf.ITimestamp|null);

                    /** ExportDocumentsMetadata operationState. */
                    public operationState: google.firestore.admin.v1.OperationState;

                    /** ExportDocumentsMetadata progressDocuments. */
                    public progressDocuments?: (google.firestore.admin.v1.IProgress|null);

                    /** ExportDocumentsMetadata progressBytes. */
                    public progressBytes?: (google.firestore.admin.v1.IProgress|null);

                    /** ExportDocumentsMetadata collectionIds. */
                    public collectionIds: string[];

                    /** ExportDocumentsMetadata outputUriPrefix. */
                    public outputUriPrefix: string;

                    /** ExportDocumentsMetadata namespaceIds. */
                    public namespaceIds: string[];

                    /** ExportDocumentsMetadata snapshotTime. */
                    public snapshotTime?: (google.protobuf.ITimestamp|null);

                    /**
                     * Creates an ExportDocumentsMetadata message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns ExportDocumentsMetadata
                     */
                    public static fromObject(object: { [k: string]: any }): google.firestore.admin.v1.ExportDocumentsMetadata;

                    /**
                     * Creates a plain object from an ExportDocumentsMetadata message. Also converts values to other types if specified.
                     * @param message ExportDocumentsMetadata
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.firestore.admin.v1.ExportDocumentsMetadata, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this ExportDocumentsMetadata to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for ExportDocumentsMetadata
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of an ImportDocumentsMetadata. */
                interface IImportDocumentsMetadata {

                    /** ImportDocumentsMetadata startTime */
                    startTime?: (google.protobuf.ITimestamp|null);

                    /** ImportDocumentsMetadata endTime */
                    endTime?: (google.protobuf.ITimestamp|null);

                    /** ImportDocumentsMetadata operationState */
                    operationState?: (google.firestore.admin.v1.OperationState|null);

                    /** ImportDocumentsMetadata progressDocuments */
                    progressDocuments?: (google.firestore.admin.v1.IProgress|null);

                    /** ImportDocumentsMetadata progressBytes */
                    progressBytes?: (google.firestore.admin.v1.IProgress|null);

                    /** ImportDocumentsMetadata collectionIds */
                    collectionIds?: (string[]|null);

                    /** ImportDocumentsMetadata inputUriPrefix */
                    inputUriPrefix?: (string|null);

                    /** ImportDocumentsMetadata namespaceIds */
                    namespaceIds?: (string[]|null);
                }

                /** Represents an ImportDocumentsMetadata. */
                class ImportDocumentsMetadata implements IImportDocumentsMetadata {

                    /**
                     * Constructs a new ImportDocumentsMetadata.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.firestore.admin.v1.IImportDocumentsMetadata);

                    /** ImportDocumentsMetadata startTime. */
                    public startTime?: (google.protobuf.ITimestamp|null);

                    /** ImportDocumentsMetadata endTime. */
                    public endTime?: (google.protobuf.ITimestamp|null);

                    /** ImportDocumentsMetadata operationState. */
                    public operationState: google.firestore.admin.v1.OperationState;

                    /** ImportDocumentsMetadata progressDocuments. */
                    public progressDocuments?: (google.firestore.admin.v1.IProgress|null);

                    /** ImportDocumentsMetadata progressBytes. */
                    public progressBytes?: (google.firestore.admin.v1.IProgress|null);

                    /** ImportDocumentsMetadata collectionIds. */
                    public collectionIds: string[];

                    /** ImportDocumentsMetadata inputUriPrefix. */
                    public inputUriPrefix: string;

                    /** ImportDocumentsMetadata namespaceIds. */
                    public namespaceIds: string[];

                    /**
                     * Creates an ImportDocumentsMetadata message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns ImportDocumentsMetadata
                     */
                    public static fromObject(object: { [k: string]: any }): google.firestore.admin.v1.ImportDocumentsMetadata;

                    /**
                     * Creates a plain object from an ImportDocumentsMetadata message. Also converts values to other types if specified.
                     * @param message ImportDocumentsMetadata
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.firestore.admin.v1.ImportDocumentsMetadata, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this ImportDocumentsMetadata to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for ImportDocumentsMetadata
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a BulkDeleteDocumentsMetadata. */
                interface IBulkDeleteDocumentsMetadata {

                    /** BulkDeleteDocumentsMetadata startTime */
                    startTime?: (google.protobuf.ITimestamp|null);

                    /** BulkDeleteDocumentsMetadata endTime */
                    endTime?: (google.protobuf.ITimestamp|null);

                    /** BulkDeleteDocumentsMetadata operationState */
                    operationState?: (google.firestore.admin.v1.OperationState|null);

                    /** BulkDeleteDocumentsMetadata progressDocuments */
                    progressDocuments?: (google.firestore.admin.v1.IProgress|null);

                    /** BulkDeleteDocumentsMetadata progressBytes */
                    progressBytes?: (google.firestore.admin.v1.IProgress|null);

                    /** BulkDeleteDocumentsMetadata collectionIds */
                    collectionIds?: (string[]|null);

                    /** BulkDeleteDocumentsMetadata namespaceIds */
                    namespaceIds?: (string[]|null);

                    /** BulkDeleteDocumentsMetadata snapshotTime */
                    snapshotTime?: (google.protobuf.ITimestamp|null);
                }

                /** Represents a BulkDeleteDocumentsMetadata. */
                class BulkDeleteDocumentsMetadata implements IBulkDeleteDocumentsMetadata {

                    /**
                     * Constructs a new BulkDeleteDocumentsMetadata.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.firestore.admin.v1.IBulkDeleteDocumentsMetadata);

                    /** BulkDeleteDocumentsMetadata startTime. */
                    public startTime?: (google.protobuf.ITimestamp|null);

                    /** BulkDeleteDocumentsMetadata endTime. */
                    public endTime?: (google.protobuf.ITimestamp|null);

                    /** BulkDeleteDocumentsMetadata operationState. */
                    public operationState: google.firestore.admin.v1.OperationState;

                    /** BulkDeleteDocumentsMetadata progressDocuments. */
                    public progressDocuments?: (google.firestore.admin.v1.IProgress|null);

                    /** BulkDeleteDocumentsMetadata progressBytes. */
                    public progressBytes?: (google.firestore.admin.v1.IProgress|null);

                    /** BulkDeleteDocumentsMetadata collectionIds. */
                    public collectionIds: string[];

                    /** BulkDeleteDocumentsMetadata namespaceIds. */
                    public namespaceIds: string[];

                    /** BulkDeleteDocumentsMetadata snapshotTime. */
                    public snapshotTime?: (google.protobuf.ITimestamp|null);

                    /**
                     * Creates a BulkDeleteDocumentsMetadata message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns BulkDeleteDocumentsMetadata
                     */
                    public static fromObject(object: { [k: string]: any }): google.firestore.admin.v1.BulkDeleteDocumentsMetadata;

                    /**
                     * Creates a plain object from a BulkDeleteDocumentsMetadata message. Also converts values to other types if specified.
                     * @param message BulkDeleteDocumentsMetadata
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.firestore.admin.v1.BulkDeleteDocumentsMetadata, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this BulkDeleteDocumentsMetadata to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for BulkDeleteDocumentsMetadata
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of an ExportDocumentsResponse. */
                interface IExportDocumentsResponse {

                    /** ExportDocumentsResponse outputUriPrefix */
                    outputUriPrefix?: (string|null);
                }

                /** Represents an ExportDocumentsResponse. */
                class ExportDocumentsResponse implements IExportDocumentsResponse {

                    /**
                     * Constructs a new ExportDocumentsResponse.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.firestore.admin.v1.IExportDocumentsResponse);

                    /** ExportDocumentsResponse outputUriPrefix. */
                    public outputUriPrefix: string;

                    /**
                     * Creates an ExportDocumentsResponse message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns ExportDocumentsResponse
                     */
                    public static fromObject(object: { [k: string]: any }): google.firestore.admin.v1.ExportDocumentsResponse;

                    /**
                     * Creates a plain object from an ExportDocumentsResponse message. Also converts values to other types if specified.
                     * @param message ExportDocumentsResponse
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.firestore.admin.v1.ExportDocumentsResponse, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this ExportDocumentsResponse to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for ExportDocumentsResponse
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a RestoreDatabaseMetadata. */
                interface IRestoreDatabaseMetadata {

                    /** RestoreDatabaseMetadata startTime */
                    startTime?: (google.protobuf.ITimestamp|null);

                    /** RestoreDatabaseMetadata endTime */
                    endTime?: (google.protobuf.ITimestamp|null);

                    /** RestoreDatabaseMetadata operationState */
                    operationState?: (google.firestore.admin.v1.OperationState|null);

                    /** RestoreDatabaseMetadata database */
                    database?: (string|null);

                    /** RestoreDatabaseMetadata backup */
                    backup?: (string|null);

                    /** RestoreDatabaseMetadata progressPercentage */
                    progressPercentage?: (google.firestore.admin.v1.IProgress|null);
                }

                /** Represents a RestoreDatabaseMetadata. */
                class RestoreDatabaseMetadata implements IRestoreDatabaseMetadata {

                    /**
                     * Constructs a new RestoreDatabaseMetadata.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.firestore.admin.v1.IRestoreDatabaseMetadata);

                    /** RestoreDatabaseMetadata startTime. */
                    public startTime?: (google.protobuf.ITimestamp|null);

                    /** RestoreDatabaseMetadata endTime. */
                    public endTime?: (google.protobuf.ITimestamp|null);

                    /** RestoreDatabaseMetadata operationState. */
                    public operationState: google.firestore.admin.v1.OperationState;

                    /** RestoreDatabaseMetadata database. */
                    public database: string;

                    /** RestoreDatabaseMetadata backup. */
                    public backup: string;

                    /** RestoreDatabaseMetadata progressPercentage. */
                    public progressPercentage?: (google.firestore.admin.v1.IProgress|null);

                    /**
                     * Creates a RestoreDatabaseMetadata message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns RestoreDatabaseMetadata
                     */
                    public static fromObject(object: { [k: string]: any }): google.firestore.admin.v1.RestoreDatabaseMetadata;

                    /**
                     * Creates a plain object from a RestoreDatabaseMetadata message. Also converts values to other types if specified.
                     * @param message RestoreDatabaseMetadata
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.firestore.admin.v1.RestoreDatabaseMetadata, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this RestoreDatabaseMetadata to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for RestoreDatabaseMetadata
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a Progress. */
                interface IProgress {

                    /** Progress estimatedWork */
                    estimatedWork?: (number|string|null);

                    /** Progress completedWork */
                    completedWork?: (number|string|null);
                }

                /** Represents a Progress. */
                class Progress implements IProgress {

                    /**
                     * Constructs a new Progress.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.firestore.admin.v1.IProgress);

                    /** Progress estimatedWork. */
                    public estimatedWork: (number|string);

                    /** Progress completedWork. */
                    public completedWork: (number|string);

                    /**
                     * Creates a Progress message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns Progress
                     */
                    public static fromObject(object: { [k: string]: any }): google.firestore.admin.v1.Progress;

                    /**
                     * Creates a plain object from a Progress message. Also converts values to other types if specified.
                     * @param message Progress
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.firestore.admin.v1.Progress, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this Progress to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for Progress
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** OperationState enum. */
                type OperationState =
                    "OPERATION_STATE_UNSPECIFIED"| "INITIALIZING"| "PROCESSING"| "CANCELLING"| "FINALIZING"| "SUCCESSFUL"| "FAILED"| "CANCELLED";

                /** Properties of a BackupSchedule. */
                interface IBackupSchedule {

                    /** BackupSchedule name */
                    name?: (string|null);

                    /** BackupSchedule createTime */
                    createTime?: (google.protobuf.ITimestamp|null);

                    /** BackupSchedule updateTime */
                    updateTime?: (google.protobuf.ITimestamp|null);

                    /** BackupSchedule retention */
                    retention?: (google.protobuf.IDuration|null);

                    /** BackupSchedule dailyRecurrence */
                    dailyRecurrence?: (google.firestore.admin.v1.IDailyRecurrence|null);

                    /** BackupSchedule weeklyRecurrence */
                    weeklyRecurrence?: (google.firestore.admin.v1.IWeeklyRecurrence|null);
                }

                /** Represents a BackupSchedule. */
                class BackupSchedule implements IBackupSchedule {

                    /**
                     * Constructs a new BackupSchedule.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.firestore.admin.v1.IBackupSchedule);

                    /** BackupSchedule name. */
                    public name: string;

                    /** BackupSchedule createTime. */
                    public createTime?: (google.protobuf.ITimestamp|null);

                    /** BackupSchedule updateTime. */
                    public updateTime?: (google.protobuf.ITimestamp|null);

                    /** BackupSchedule retention. */
                    public retention?: (google.protobuf.IDuration|null);

                    /** BackupSchedule dailyRecurrence. */
                    public dailyRecurrence?: (google.firestore.admin.v1.IDailyRecurrence|null);

                    /** BackupSchedule weeklyRecurrence. */
                    public weeklyRecurrence?: (google.firestore.admin.v1.IWeeklyRecurrence|null);

                    /** BackupSchedule recurrence. */
                    public recurrence?: ("dailyRecurrence"|"weeklyRecurrence");

                    /**
                     * Creates a BackupSchedule message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns BackupSchedule
                     */
                    public static fromObject(object: { [k: string]: any }): google.firestore.admin.v1.BackupSchedule;

                    /**
                     * Creates a plain object from a BackupSchedule message. Also converts values to other types if specified.
                     * @param message BackupSchedule
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.firestore.admin.v1.BackupSchedule, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this BackupSchedule to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for BackupSchedule
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a DailyRecurrence. */
                interface IDailyRecurrence {
                }

                /** Represents a DailyRecurrence. */
                class DailyRecurrence implements IDailyRecurrence {

                    /**
                     * Constructs a new DailyRecurrence.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.firestore.admin.v1.IDailyRecurrence);

                    /**
                     * Creates a DailyRecurrence message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns DailyRecurrence
                     */
                    public static fromObject(object: { [k: string]: any }): google.firestore.admin.v1.DailyRecurrence;

                    /**
                     * Creates a plain object from a DailyRecurrence message. Also converts values to other types if specified.
                     * @param message DailyRecurrence
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.firestore.admin.v1.DailyRecurrence, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this DailyRecurrence to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for DailyRecurrence
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a WeeklyRecurrence. */
                interface IWeeklyRecurrence {

                    /** WeeklyRecurrence day */
                    day?: (google.type.DayOfWeek|null);
                }

                /** Represents a WeeklyRecurrence. */
                class WeeklyRecurrence implements IWeeklyRecurrence {

                    /**
                     * Constructs a new WeeklyRecurrence.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.firestore.admin.v1.IWeeklyRecurrence);

                    /** WeeklyRecurrence day. */
                    public day: google.type.DayOfWeek;

                    /**
                     * Creates a WeeklyRecurrence message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns WeeklyRecurrence
                     */
                    public static fromObject(object: { [k: string]: any }): google.firestore.admin.v1.WeeklyRecurrence;

                    /**
                     * Creates a plain object from a WeeklyRecurrence message. Also converts values to other types if specified.
                     * @param message WeeklyRecurrence
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.firestore.admin.v1.WeeklyRecurrence, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this WeeklyRecurrence to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for WeeklyRecurrence
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a LocationMetadata. */
                interface ILocationMetadata {
                }

                /** Represents a LocationMetadata. */
                class LocationMetadata implements ILocationMetadata {

                    /**
                     * Constructs a new LocationMetadata.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.firestore.admin.v1.ILocationMetadata);

                    /**
                     * Creates a LocationMetadata message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns LocationMetadata
                     */
                    public static fromObject(object: { [k: string]: any }): google.firestore.admin.v1.LocationMetadata;

                    /**
                     * Creates a plain object from a LocationMetadata message. Also converts values to other types if specified.
                     * @param message LocationMetadata
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.firestore.admin.v1.LocationMetadata, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this LocationMetadata to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for LocationMetadata
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }
            }
        }
    }

    /** Namespace api. */
    namespace api {

        /** FieldBehavior enum. */
        type FieldBehavior =
            "FIELD_BEHAVIOR_UNSPECIFIED"| "OPTIONAL"| "REQUIRED"| "OUTPUT_ONLY"| "INPUT_ONLY"| "IMMUTABLE"| "UNORDERED_LIST"| "NON_EMPTY_DEFAULT"| "IDENTIFIER";

        /** Properties of a ResourceDescriptor. */
        interface IResourceDescriptor {

            /** ResourceDescriptor type */
            type?: (string|null);

            /** ResourceDescriptor pattern */
            pattern?: (string[]|null);

            /** ResourceDescriptor nameField */
            nameField?: (string|null);

            /** ResourceDescriptor history */
            history?: (google.api.ResourceDescriptor.History|null);

            /** ResourceDescriptor plural */
            plural?: (string|null);

            /** ResourceDescriptor singular */
            singular?: (string|null);

            /** ResourceDescriptor style */
            style?: (google.api.ResourceDescriptor.Style[]|null);
        }

        /** Represents a ResourceDescriptor. */
        class ResourceDescriptor implements IResourceDescriptor {

            /**
             * Constructs a new ResourceDescriptor.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.api.IResourceDescriptor);

            /** ResourceDescriptor type. */
            public type: string;

            /** ResourceDescriptor pattern. */
            public pattern: string[];

            /** ResourceDescriptor nameField. */
            public nameField: string;

            /** ResourceDescriptor history. */
            public history: google.api.ResourceDescriptor.History;

            /** ResourceDescriptor plural. */
            public plural: string;

            /** ResourceDescriptor singular. */
            public singular: string;

            /** ResourceDescriptor style. */
            public style: google.api.ResourceDescriptor.Style[];

            /**
             * Creates a ResourceDescriptor message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns ResourceDescriptor
             */
            public static fromObject(object: { [k: string]: any }): google.api.ResourceDescriptor;

            /**
             * Creates a plain object from a ResourceDescriptor message. Also converts values to other types if specified.
             * @param message ResourceDescriptor
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.api.ResourceDescriptor, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this ResourceDescriptor to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for ResourceDescriptor
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        namespace ResourceDescriptor {

            /** History enum. */
            type History =
                "HISTORY_UNSPECIFIED"| "ORIGINALLY_SINGLE_PATTERN"| "FUTURE_MULTI_PATTERN";

            /** Style enum. */
            type Style =
                "STYLE_UNSPECIFIED"| "DECLARATIVE_FRIENDLY";
        }

        /** Properties of a ResourceReference. */
        interface IResourceReference {

            /** ResourceReference type */
            type?: (string|null);

            /** ResourceReference childType */
            childType?: (string|null);
        }

        /** Represents a ResourceReference. */
        class ResourceReference implements IResourceReference {

            /**
             * Constructs a new ResourceReference.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.api.IResourceReference);

            /** ResourceReference type. */
            public type: string;

            /** ResourceReference childType. */
            public childType: string;

            /**
             * Creates a ResourceReference message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns ResourceReference
             */
            public static fromObject(object: { [k: string]: any }): google.api.ResourceReference;

            /**
             * Creates a plain object from a ResourceReference message. Also converts values to other types if specified.
             * @param message ResourceReference
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.api.ResourceReference, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this ResourceReference to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for ResourceReference
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of a Http. */
        interface IHttp {

            /** Http rules */
            rules?: (google.api.IHttpRule[]|null);

            /** Http fullyDecodeReservedExpansion */
            fullyDecodeReservedExpansion?: (boolean|null);
        }

        /** Represents a Http. */
        class Http implements IHttp {

            /**
             * Constructs a new Http.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.api.IHttp);

            /** Http rules. */
            public rules: google.api.IHttpRule[];

            /** Http fullyDecodeReservedExpansion. */
            public fullyDecodeReservedExpansion: boolean;

            /**
             * Creates a Http message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns Http
             */
            public static fromObject(object: { [k: string]: any }): google.api.Http;

            /**
             * Creates a plain object from a Http message. Also converts values to other types if specified.
             * @param message Http
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.api.Http, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this Http to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for Http
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of a HttpRule. */
        interface IHttpRule {

            /** HttpRule selector */
            selector?: (string|null);

            /** HttpRule get */
            get?: (string|null);

            /** HttpRule put */
            put?: (string|null);

            /** HttpRule post */
            post?: (string|null);

            /** HttpRule delete */
            "delete"?: (string|null);

            /** HttpRule patch */
            patch?: (string|null);

            /** HttpRule custom */
            custom?: (google.api.ICustomHttpPattern|null);

            /** HttpRule body */
            body?: (string|null);

            /** HttpRule responseBody */
            responseBody?: (string|null);

            /** HttpRule additionalBindings */
            additionalBindings?: (google.api.IHttpRule[]|null);
        }

        /** Represents a HttpRule. */
        class HttpRule implements IHttpRule {

            /**
             * Constructs a new HttpRule.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.api.IHttpRule);

            /** HttpRule selector. */
            public selector: string;

            /** HttpRule get. */
            public get?: (string|null);

            /** HttpRule put. */
            public put?: (string|null);

            /** HttpRule post. */
            public post?: (string|null);

            /** HttpRule delete. */
            public delete?: (string|null);

            /** HttpRule patch. */
            public patch?: (string|null);

            /** HttpRule custom. */
            public custom?: (google.api.ICustomHttpPattern|null);

            /** HttpRule body. */
            public body: string;

            /** HttpRule responseBody. */
            public responseBody: string;

            /** HttpRule additionalBindings. */
            public additionalBindings: google.api.IHttpRule[];

            /** HttpRule pattern. */
            public pattern?: ("get"|"put"|"post"|"delete"|"patch"|"custom");

            /**
             * Creates a HttpRule message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns HttpRule
             */
            public static fromObject(object: { [k: string]: any }): google.api.HttpRule;

            /**
             * Creates a plain object from a HttpRule message. Also converts values to other types if specified.
             * @param message HttpRule
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.api.HttpRule, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this HttpRule to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for HttpRule
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of a CustomHttpPattern. */
        interface ICustomHttpPattern {

            /** CustomHttpPattern kind */
            kind?: (string|null);

            /** CustomHttpPattern path */
            path?: (string|null);
        }

        /** Represents a CustomHttpPattern. */
        class CustomHttpPattern implements ICustomHttpPattern {

            /**
             * Constructs a new CustomHttpPattern.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.api.ICustomHttpPattern);

            /** CustomHttpPattern kind. */
            public kind: string;

            /** CustomHttpPattern path. */
            public path: string;

            /**
             * Creates a CustomHttpPattern message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns CustomHttpPattern
             */
            public static fromObject(object: { [k: string]: any }): google.api.CustomHttpPattern;

            /**
             * Creates a plain object from a CustomHttpPattern message. Also converts values to other types if specified.
             * @param message CustomHttpPattern
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.api.CustomHttpPattern, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this CustomHttpPattern to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for CustomHttpPattern
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of a CommonLanguageSettings. */
        interface ICommonLanguageSettings {

            /** CommonLanguageSettings referenceDocsUri */
            referenceDocsUri?: (string|null);

            /** CommonLanguageSettings destinations */
            destinations?: (google.api.ClientLibraryDestination[]|null);

            /** CommonLanguageSettings selectiveGapicGeneration */
            selectiveGapicGeneration?: (google.api.ISelectiveGapicGeneration|null);
        }

        /** Represents a CommonLanguageSettings. */
        class CommonLanguageSettings implements ICommonLanguageSettings {

            /**
             * Constructs a new CommonLanguageSettings.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.api.ICommonLanguageSettings);

            /** CommonLanguageSettings referenceDocsUri. */
            public referenceDocsUri: string;

            /** CommonLanguageSettings destinations. */
            public destinations: google.api.ClientLibraryDestination[];

            /** CommonLanguageSettings selectiveGapicGeneration. */
            public selectiveGapicGeneration?: (google.api.ISelectiveGapicGeneration|null);

            /**
             * Creates a CommonLanguageSettings message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns CommonLanguageSettings
             */
            public static fromObject(object: { [k: string]: any }): google.api.CommonLanguageSettings;

            /**
             * Creates a plain object from a CommonLanguageSettings message. Also converts values to other types if specified.
             * @param message CommonLanguageSettings
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.api.CommonLanguageSettings, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this CommonLanguageSettings to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for CommonLanguageSettings
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of a ClientLibrarySettings. */
        interface IClientLibrarySettings {

            /** ClientLibrarySettings version */
            version?: (string|null);

            /** ClientLibrarySettings launchStage */
            launchStage?: (google.api.LaunchStage|null);

            /** ClientLibrarySettings restNumericEnums */
            restNumericEnums?: (boolean|null);

            /** ClientLibrarySettings javaSettings */
            javaSettings?: (google.api.IJavaSettings|null);

            /** ClientLibrarySettings cppSettings */
            cppSettings?: (google.api.ICppSettings|null);

            /** ClientLibrarySettings phpSettings */
            phpSettings?: (google.api.IPhpSettings|null);

            /** ClientLibrarySettings pythonSettings */
            pythonSettings?: (google.api.IPythonSettings|null);

            /** ClientLibrarySettings nodeSettings */
            nodeSettings?: (google.api.INodeSettings|null);

            /** ClientLibrarySettings dotnetSettings */
            dotnetSettings?: (google.api.IDotnetSettings|null);

            /** ClientLibrarySettings rubySettings */
            rubySettings?: (google.api.IRubySettings|null);

            /** ClientLibrarySettings goSettings */
            goSettings?: (google.api.IGoSettings|null);
        }

        /** Represents a ClientLibrarySettings. */
        class ClientLibrarySettings implements IClientLibrarySettings {

            /**
             * Constructs a new ClientLibrarySettings.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.api.IClientLibrarySettings);

            /** ClientLibrarySettings version. */
            public version: string;

            /** ClientLibrarySettings launchStage. */
            public launchStage: google.api.LaunchStage;

            /** ClientLibrarySettings restNumericEnums. */
            public restNumericEnums: boolean;

            /** ClientLibrarySettings javaSettings. */
            public javaSettings?: (google.api.IJavaSettings|null);

            /** ClientLibrarySettings cppSettings. */
            public cppSettings?: (google.api.ICppSettings|null);

            /** ClientLibrarySettings phpSettings. */
            public phpSettings?: (google.api.IPhpSettings|null);

            /** ClientLibrarySettings pythonSettings. */
            public pythonSettings?: (google.api.IPythonSettings|null);

            /** ClientLibrarySettings nodeSettings. */
            public nodeSettings?: (google.api.INodeSettings|null);

            /** ClientLibrarySettings dotnetSettings. */
            public dotnetSettings?: (google.api.IDotnetSettings|null);

            /** ClientLibrarySettings rubySettings. */
            public rubySettings?: (google.api.IRubySettings|null);

            /** ClientLibrarySettings goSettings. */
            public goSettings?: (google.api.IGoSettings|null);

            /**
             * Creates a ClientLibrarySettings message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns ClientLibrarySettings
             */
            public static fromObject(object: { [k: string]: any }): google.api.ClientLibrarySettings;

            /**
             * Creates a plain object from a ClientLibrarySettings message. Also converts values to other types if specified.
             * @param message ClientLibrarySettings
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.api.ClientLibrarySettings, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this ClientLibrarySettings to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for ClientLibrarySettings
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of a Publishing. */
        interface IPublishing {

            /** Publishing methodSettings */
            methodSettings?: (google.api.IMethodSettings[]|null);

            /** Publishing newIssueUri */
            newIssueUri?: (string|null);

            /** Publishing documentationUri */
            documentationUri?: (string|null);

            /** Publishing apiShortName */
            apiShortName?: (string|null);

            /** Publishing githubLabel */
            githubLabel?: (string|null);

            /** Publishing codeownerGithubTeams */
            codeownerGithubTeams?: (string[]|null);

            /** Publishing docTagPrefix */
            docTagPrefix?: (string|null);

            /** Publishing organization */
            organization?: (google.api.ClientLibraryOrganization|null);

            /** Publishing librarySettings */
            librarySettings?: (google.api.IClientLibrarySettings[]|null);

            /** Publishing protoReferenceDocumentationUri */
            protoReferenceDocumentationUri?: (string|null);

            /** Publishing restReferenceDocumentationUri */
            restReferenceDocumentationUri?: (string|null);
        }

        /** Represents a Publishing. */
        class Publishing implements IPublishing {

            /**
             * Constructs a new Publishing.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.api.IPublishing);

            /** Publishing methodSettings. */
            public methodSettings: google.api.IMethodSettings[];

            /** Publishing newIssueUri. */
            public newIssueUri: string;

            /** Publishing documentationUri. */
            public documentationUri: string;

            /** Publishing apiShortName. */
            public apiShortName: string;

            /** Publishing githubLabel. */
            public githubLabel: string;

            /** Publishing codeownerGithubTeams. */
            public codeownerGithubTeams: string[];

            /** Publishing docTagPrefix. */
            public docTagPrefix: string;

            /** Publishing organization. */
            public organization: google.api.ClientLibraryOrganization;

            /** Publishing librarySettings. */
            public librarySettings: google.api.IClientLibrarySettings[];

            /** Publishing protoReferenceDocumentationUri. */
            public protoReferenceDocumentationUri: string;

            /** Publishing restReferenceDocumentationUri. */
            public restReferenceDocumentationUri: string;

            /**
             * Creates a Publishing message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns Publishing
             */
            public static fromObject(object: { [k: string]: any }): google.api.Publishing;

            /**
             * Creates a plain object from a Publishing message. Also converts values to other types if specified.
             * @param message Publishing
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.api.Publishing, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this Publishing to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for Publishing
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of a JavaSettings. */
        interface IJavaSettings {

            /** JavaSettings libraryPackage */
            libraryPackage?: (string|null);

            /** JavaSettings serviceClassNames */
            serviceClassNames?: ({ [k: string]: string }|null);

            /** JavaSettings common */
            common?: (google.api.ICommonLanguageSettings|null);
        }

        /** Represents a JavaSettings. */
        class JavaSettings implements IJavaSettings {

            /**
             * Constructs a new JavaSettings.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.api.IJavaSettings);

            /** JavaSettings libraryPackage. */
            public libraryPackage: string;

            /** JavaSettings serviceClassNames. */
            public serviceClassNames: { [k: string]: string };

            /** JavaSettings common. */
            public common?: (google.api.ICommonLanguageSettings|null);

            /**
             * Creates a JavaSettings message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns JavaSettings
             */
            public static fromObject(object: { [k: string]: any }): google.api.JavaSettings;

            /**
             * Creates a plain object from a JavaSettings message. Also converts values to other types if specified.
             * @param message JavaSettings
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.api.JavaSettings, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this JavaSettings to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for JavaSettings
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of a CppSettings. */
        interface ICppSettings {

            /** CppSettings common */
            common?: (google.api.ICommonLanguageSettings|null);
        }

        /** Represents a CppSettings. */
        class CppSettings implements ICppSettings {

            /**
             * Constructs a new CppSettings.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.api.ICppSettings);

            /** CppSettings common. */
            public common?: (google.api.ICommonLanguageSettings|null);

            /**
             * Creates a CppSettings message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns CppSettings
             */
            public static fromObject(object: { [k: string]: any }): google.api.CppSettings;

            /**
             * Creates a plain object from a CppSettings message. Also converts values to other types if specified.
             * @param message CppSettings
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.api.CppSettings, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this CppSettings to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for CppSettings
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of a PhpSettings. */
        interface IPhpSettings {

            /** PhpSettings common */
            common?: (google.api.ICommonLanguageSettings|null);
        }

        /** Represents a PhpSettings. */
        class PhpSettings implements IPhpSettings {

            /**
             * Constructs a new PhpSettings.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.api.IPhpSettings);

            /** PhpSettings common. */
            public common?: (google.api.ICommonLanguageSettings|null);

            /**
             * Creates a PhpSettings message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns PhpSettings
             */
            public static fromObject(object: { [k: string]: any }): google.api.PhpSettings;

            /**
             * Creates a plain object from a PhpSettings message. Also converts values to other types if specified.
             * @param message PhpSettings
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.api.PhpSettings, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this PhpSettings to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for PhpSettings
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of a PythonSettings. */
        interface IPythonSettings {

            /** PythonSettings common */
            common?: (google.api.ICommonLanguageSettings|null);

            /** PythonSettings experimentalFeatures */
            experimentalFeatures?: (google.api.PythonSettings.IExperimentalFeatures|null);
        }

        /** Represents a PythonSettings. */
        class PythonSettings implements IPythonSettings {

            /**
             * Constructs a new PythonSettings.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.api.IPythonSettings);

            /** PythonSettings common. */
            public common?: (google.api.ICommonLanguageSettings|null);

            /** PythonSettings experimentalFeatures. */
            public experimentalFeatures?: (google.api.PythonSettings.IExperimentalFeatures|null);

            /**
             * Creates a PythonSettings message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns PythonSettings
             */
            public static fromObject(object: { [k: string]: any }): google.api.PythonSettings;

            /**
             * Creates a plain object from a PythonSettings message. Also converts values to other types if specified.
             * @param message PythonSettings
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.api.PythonSettings, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this PythonSettings to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for PythonSettings
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        namespace PythonSettings {

            /** Properties of an ExperimentalFeatures. */
            interface IExperimentalFeatures {

                /** ExperimentalFeatures restAsyncIoEnabled */
                restAsyncIoEnabled?: (boolean|null);

                /** ExperimentalFeatures protobufPythonicTypesEnabled */
                protobufPythonicTypesEnabled?: (boolean|null);
            }

            /** Represents an ExperimentalFeatures. */
            class ExperimentalFeatures implements IExperimentalFeatures {

                /**
                 * Constructs a new ExperimentalFeatures.
                 * @param [properties] Properties to set
                 */
                constructor(properties?: google.api.PythonSettings.IExperimentalFeatures);

                /** ExperimentalFeatures restAsyncIoEnabled. */
                public restAsyncIoEnabled: boolean;

                /** ExperimentalFeatures protobufPythonicTypesEnabled. */
                public protobufPythonicTypesEnabled: boolean;

                /**
                 * Creates an ExperimentalFeatures message from a plain object. Also converts values to their respective internal types.
                 * @param object Plain object
                 * @returns ExperimentalFeatures
                 */
                public static fromObject(object: { [k: string]: any }): google.api.PythonSettings.ExperimentalFeatures;

                /**
                 * Creates a plain object from an ExperimentalFeatures message. Also converts values to other types if specified.
                 * @param message ExperimentalFeatures
                 * @param [options] Conversion options
                 * @returns Plain object
                 */
                public static toObject(message: google.api.PythonSettings.ExperimentalFeatures, options?: $protobuf.IConversionOptions): { [k: string]: any };

                /**
                 * Converts this ExperimentalFeatures to JSON.
                 * @returns JSON object
                 */
                public toJSON(): { [k: string]: any };

                /**
                 * Gets the default type url for ExperimentalFeatures
                 * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                 * @returns The default type url
                 */
                public static getTypeUrl(typeUrlPrefix?: string): string;
            }
        }

        /** Properties of a NodeSettings. */
        interface INodeSettings {

            /** NodeSettings common */
            common?: (google.api.ICommonLanguageSettings|null);
        }

        /** Represents a NodeSettings. */
        class NodeSettings implements INodeSettings {

            /**
             * Constructs a new NodeSettings.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.api.INodeSettings);

            /** NodeSettings common. */
            public common?: (google.api.ICommonLanguageSettings|null);

            /**
             * Creates a NodeSettings message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns NodeSettings
             */
            public static fromObject(object: { [k: string]: any }): google.api.NodeSettings;

            /**
             * Creates a plain object from a NodeSettings message. Also converts values to other types if specified.
             * @param message NodeSettings
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.api.NodeSettings, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this NodeSettings to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for NodeSettings
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of a DotnetSettings. */
        interface IDotnetSettings {

            /** DotnetSettings common */
            common?: (google.api.ICommonLanguageSettings|null);

            /** DotnetSettings renamedServices */
            renamedServices?: ({ [k: string]: string }|null);

            /** DotnetSettings renamedResources */
            renamedResources?: ({ [k: string]: string }|null);

            /** DotnetSettings ignoredResources */
            ignoredResources?: (string[]|null);

            /** DotnetSettings forcedNamespaceAliases */
            forcedNamespaceAliases?: (string[]|null);

            /** DotnetSettings handwrittenSignatures */
            handwrittenSignatures?: (string[]|null);
        }

        /** Represents a DotnetSettings. */
        class DotnetSettings implements IDotnetSettings {

            /**
             * Constructs a new DotnetSettings.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.api.IDotnetSettings);

            /** DotnetSettings common. */
            public common?: (google.api.ICommonLanguageSettings|null);

            /** DotnetSettings renamedServices. */
            public renamedServices: { [k: string]: string };

            /** DotnetSettings renamedResources. */
            public renamedResources: { [k: string]: string };

            /** DotnetSettings ignoredResources. */
            public ignoredResources: string[];

            /** DotnetSettings forcedNamespaceAliases. */
            public forcedNamespaceAliases: string[];

            /** DotnetSettings handwrittenSignatures. */
            public handwrittenSignatures: string[];

            /**
             * Creates a DotnetSettings message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns DotnetSettings
             */
            public static fromObject(object: { [k: string]: any }): google.api.DotnetSettings;

            /**
             * Creates a plain object from a DotnetSettings message. Also converts values to other types if specified.
             * @param message DotnetSettings
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.api.DotnetSettings, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this DotnetSettings to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for DotnetSettings
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of a RubySettings. */
        interface IRubySettings {

            /** RubySettings common */
            common?: (google.api.ICommonLanguageSettings|null);
        }

        /** Represents a RubySettings. */
        class RubySettings implements IRubySettings {

            /**
             * Constructs a new RubySettings.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.api.IRubySettings);

            /** RubySettings common. */
            public common?: (google.api.ICommonLanguageSettings|null);

            /**
             * Creates a RubySettings message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns RubySettings
             */
            public static fromObject(object: { [k: string]: any }): google.api.RubySettings;

            /**
             * Creates a plain object from a RubySettings message. Also converts values to other types if specified.
             * @param message RubySettings
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.api.RubySettings, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this RubySettings to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for RubySettings
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of a GoSettings. */
        interface IGoSettings {

            /** GoSettings common */
            common?: (google.api.ICommonLanguageSettings|null);

            /** GoSettings renamedServices */
            renamedServices?: ({ [k: string]: string }|null);
        }

        /** Represents a GoSettings. */
        class GoSettings implements IGoSettings {

            /**
             * Constructs a new GoSettings.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.api.IGoSettings);

            /** GoSettings common. */
            public common?: (google.api.ICommonLanguageSettings|null);

            /** GoSettings renamedServices. */
            public renamedServices: { [k: string]: string };

            /**
             * Creates a GoSettings message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns GoSettings
             */
            public static fromObject(object: { [k: string]: any }): google.api.GoSettings;

            /**
             * Creates a plain object from a GoSettings message. Also converts values to other types if specified.
             * @param message GoSettings
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.api.GoSettings, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this GoSettings to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for GoSettings
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of a MethodSettings. */
        interface IMethodSettings {

            /** MethodSettings selector */
            selector?: (string|null);

            /** MethodSettings longRunning */
            longRunning?: (google.api.MethodSettings.ILongRunning|null);

            /** MethodSettings autoPopulatedFields */
            autoPopulatedFields?: (string[]|null);
        }

        /** Represents a MethodSettings. */
        class MethodSettings implements IMethodSettings {

            /**
             * Constructs a new MethodSettings.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.api.IMethodSettings);

            /** MethodSettings selector. */
            public selector: string;

            /** MethodSettings longRunning. */
            public longRunning?: (google.api.MethodSettings.ILongRunning|null);

            /** MethodSettings autoPopulatedFields. */
            public autoPopulatedFields: string[];

            /**
             * Creates a MethodSettings message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns MethodSettings
             */
            public static fromObject(object: { [k: string]: any }): google.api.MethodSettings;

            /**
             * Creates a plain object from a MethodSettings message. Also converts values to other types if specified.
             * @param message MethodSettings
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.api.MethodSettings, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this MethodSettings to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for MethodSettings
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        namespace MethodSettings {

            /** Properties of a LongRunning. */
            interface ILongRunning {

                /** LongRunning initialPollDelay */
                initialPollDelay?: (google.protobuf.IDuration|null);

                /** LongRunning pollDelayMultiplier */
                pollDelayMultiplier?: (number|null);

                /** LongRunning maxPollDelay */
                maxPollDelay?: (google.protobuf.IDuration|null);

                /** LongRunning totalPollTimeout */
                totalPollTimeout?: (google.protobuf.IDuration|null);
            }

            /** Represents a LongRunning. */
            class LongRunning implements ILongRunning {

                /**
                 * Constructs a new LongRunning.
                 * @param [properties] Properties to set
                 */
                constructor(properties?: google.api.MethodSettings.ILongRunning);

                /** LongRunning initialPollDelay. */
                public initialPollDelay?: (google.protobuf.IDuration|null);

                /** LongRunning pollDelayMultiplier. */
                public pollDelayMultiplier: number;

                /** LongRunning maxPollDelay. */
                public maxPollDelay?: (google.protobuf.IDuration|null);

                /** LongRunning totalPollTimeout. */
                public totalPollTimeout?: (google.protobuf.IDuration|null);

                /**
                 * Creates a LongRunning message from a plain object. Also converts values to their respective internal types.
                 * @param object Plain object
                 * @returns LongRunning
                 */
                public static fromObject(object: { [k: string]: any }): google.api.MethodSettings.LongRunning;

                /**
                 * Creates a plain object from a LongRunning message. Also converts values to other types if specified.
                 * @param message LongRunning
                 * @param [options] Conversion options
                 * @returns Plain object
                 */
                public static toObject(message: google.api.MethodSettings.LongRunning, options?: $protobuf.IConversionOptions): { [k: string]: any };

                /**
                 * Converts this LongRunning to JSON.
                 * @returns JSON object
                 */
                public toJSON(): { [k: string]: any };

                /**
                 * Gets the default type url for LongRunning
                 * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                 * @returns The default type url
                 */
                public static getTypeUrl(typeUrlPrefix?: string): string;
            }
        }

        /** ClientLibraryOrganization enum. */
        type ClientLibraryOrganization =
            "CLIENT_LIBRARY_ORGANIZATION_UNSPECIFIED"| "CLOUD"| "ADS"| "PHOTOS"| "STREET_VIEW"| "SHOPPING"| "GEO"| "GENERATIVE_AI";

        /** ClientLibraryDestination enum. */
        type ClientLibraryDestination =
            "CLIENT_LIBRARY_DESTINATION_UNSPECIFIED"| "GITHUB"| "PACKAGE_MANAGER";

        /** Properties of a SelectiveGapicGeneration. */
        interface ISelectiveGapicGeneration {

            /** SelectiveGapicGeneration methods */
            methods?: (string[]|null);

            /** SelectiveGapicGeneration generateOmittedAsInternal */
            generateOmittedAsInternal?: (boolean|null);
        }

        /** Represents a SelectiveGapicGeneration. */
        class SelectiveGapicGeneration implements ISelectiveGapicGeneration {

            /**
             * Constructs a new SelectiveGapicGeneration.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.api.ISelectiveGapicGeneration);

            /** SelectiveGapicGeneration methods. */
            public methods: string[];

            /** SelectiveGapicGeneration generateOmittedAsInternal. */
            public generateOmittedAsInternal: boolean;

            /**
             * Creates a SelectiveGapicGeneration message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns SelectiveGapicGeneration
             */
            public static fromObject(object: { [k: string]: any }): google.api.SelectiveGapicGeneration;

            /**
             * Creates a plain object from a SelectiveGapicGeneration message. Also converts values to other types if specified.
             * @param message SelectiveGapicGeneration
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.api.SelectiveGapicGeneration, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this SelectiveGapicGeneration to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for SelectiveGapicGeneration
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** LaunchStage enum. */
        type LaunchStage =
            "LAUNCH_STAGE_UNSPECIFIED"| "UNIMPLEMENTED"| "PRELAUNCH"| "EARLY_ACCESS"| "ALPHA"| "BETA"| "GA"| "DEPRECATED";
    }

    /** Namespace protobuf. */
    namespace protobuf {

        /** Properties of a FileDescriptorSet. */
        interface IFileDescriptorSet {

            /** FileDescriptorSet file */
            file?: (google.protobuf.IFileDescriptorProto[]|null);
        }

        /** Represents a FileDescriptorSet. */
        class FileDescriptorSet implements IFileDescriptorSet {

            /**
             * Constructs a new FileDescriptorSet.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.protobuf.IFileDescriptorSet);

            /** FileDescriptorSet file. */
            public file: google.protobuf.IFileDescriptorProto[];

            /**
             * Creates a FileDescriptorSet message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns FileDescriptorSet
             */
            public static fromObject(object: { [k: string]: any }): google.protobuf.FileDescriptorSet;

            /**
             * Creates a plain object from a FileDescriptorSet message. Also converts values to other types if specified.
             * @param message FileDescriptorSet
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.protobuf.FileDescriptorSet, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this FileDescriptorSet to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for FileDescriptorSet
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Edition enum. */
        type Edition =
            "EDITION_UNKNOWN"| "EDITION_PROTO2"| "EDITION_PROTO3"| "EDITION_2023"| "EDITION_2024"| "EDITION_1_TEST_ONLY"| "EDITION_2_TEST_ONLY"| "EDITION_99997_TEST_ONLY"| "EDITION_99998_TEST_ONLY"| "EDITION_99999_TEST_ONLY"| "EDITION_MAX";

        /** Properties of a FileDescriptorProto. */
        interface IFileDescriptorProto {

            /** FileDescriptorProto name */
            name?: (string|null);

            /** FileDescriptorProto package */
            "package"?: (string|null);

            /** FileDescriptorProto dependency */
            dependency?: (string[]|null);

            /** FileDescriptorProto publicDependency */
            publicDependency?: (number[]|null);

            /** FileDescriptorProto weakDependency */
            weakDependency?: (number[]|null);

            /** FileDescriptorProto messageType */
            messageType?: (google.protobuf.IDescriptorProto[]|null);

            /** FileDescriptorProto enumType */
            enumType?: (google.protobuf.IEnumDescriptorProto[]|null);

            /** FileDescriptorProto service */
            service?: (google.protobuf.IServiceDescriptorProto[]|null);

            /** FileDescriptorProto extension */
            extension?: (google.protobuf.IFieldDescriptorProto[]|null);

            /** FileDescriptorProto options */
            options?: (google.protobuf.IFileOptions|null);

            /** FileDescriptorProto sourceCodeInfo */
            sourceCodeInfo?: (google.protobuf.ISourceCodeInfo|null);

            /** FileDescriptorProto syntax */
            syntax?: (string|null);

            /** FileDescriptorProto edition */
            edition?: (google.protobuf.Edition|null);
        }

        /** Represents a FileDescriptorProto. */
        class FileDescriptorProto implements IFileDescriptorProto {

            /**
             * Constructs a new FileDescriptorProto.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.protobuf.IFileDescriptorProto);

            /** FileDescriptorProto name. */
            public name: string;

            /** FileDescriptorProto package. */
            public package: string;

            /** FileDescriptorProto dependency. */
            public dependency: string[];

            /** FileDescriptorProto publicDependency. */
            public publicDependency: number[];

            /** FileDescriptorProto weakDependency. */
            public weakDependency: number[];

            /** FileDescriptorProto messageType. */
            public messageType: google.protobuf.IDescriptorProto[];

            /** FileDescriptorProto enumType. */
            public enumType: google.protobuf.IEnumDescriptorProto[];

            /** FileDescriptorProto service. */
            public service: google.protobuf.IServiceDescriptorProto[];

            /** FileDescriptorProto extension. */
            public extension: google.protobuf.IFieldDescriptorProto[];

            /** FileDescriptorProto options. */
            public options?: (google.protobuf.IFileOptions|null);

            /** FileDescriptorProto sourceCodeInfo. */
            public sourceCodeInfo?: (google.protobuf.ISourceCodeInfo|null);

            /** FileDescriptorProto syntax. */
            public syntax: string;

            /** FileDescriptorProto edition. */
            public edition: google.protobuf.Edition;

            /**
             * Creates a FileDescriptorProto message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns FileDescriptorProto
             */
            public static fromObject(object: { [k: string]: any }): google.protobuf.FileDescriptorProto;

            /**
             * Creates a plain object from a FileDescriptorProto message. Also converts values to other types if specified.
             * @param message FileDescriptorProto
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.protobuf.FileDescriptorProto, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this FileDescriptorProto to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for FileDescriptorProto
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of a DescriptorProto. */
        interface IDescriptorProto {

            /** DescriptorProto name */
            name?: (string|null);

            /** DescriptorProto field */
            field?: (google.protobuf.IFieldDescriptorProto[]|null);

            /** DescriptorProto extension */
            extension?: (google.protobuf.IFieldDescriptorProto[]|null);

            /** DescriptorProto nestedType */
            nestedType?: (google.protobuf.IDescriptorProto[]|null);

            /** DescriptorProto enumType */
            enumType?: (google.protobuf.IEnumDescriptorProto[]|null);

            /** DescriptorProto extensionRange */
            extensionRange?: (google.protobuf.DescriptorProto.IExtensionRange[]|null);

            /** DescriptorProto oneofDecl */
            oneofDecl?: (google.protobuf.IOneofDescriptorProto[]|null);

            /** DescriptorProto options */
            options?: (google.protobuf.IMessageOptions|null);

            /** DescriptorProto reservedRange */
            reservedRange?: (google.protobuf.DescriptorProto.IReservedRange[]|null);

            /** DescriptorProto reservedName */
            reservedName?: (string[]|null);
        }

        /** Represents a DescriptorProto. */
        class DescriptorProto implements IDescriptorProto {

            /**
             * Constructs a new DescriptorProto.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.protobuf.IDescriptorProto);

            /** DescriptorProto name. */
            public name: string;

            /** DescriptorProto field. */
            public field: google.protobuf.IFieldDescriptorProto[];

            /** DescriptorProto extension. */
            public extension: google.protobuf.IFieldDescriptorProto[];

            /** DescriptorProto nestedType. */
            public nestedType: google.protobuf.IDescriptorProto[];

            /** DescriptorProto enumType. */
            public enumType: google.protobuf.IEnumDescriptorProto[];

            /** DescriptorProto extensionRange. */
            public extensionRange: google.protobuf.DescriptorProto.IExtensionRange[];

            /** DescriptorProto oneofDecl. */
            public oneofDecl: google.protobuf.IOneofDescriptorProto[];

            /** DescriptorProto options. */
            public options?: (google.protobuf.IMessageOptions|null);

            /** DescriptorProto reservedRange. */
            public reservedRange: google.protobuf.DescriptorProto.IReservedRange[];

            /** DescriptorProto reservedName. */
            public reservedName: string[];

            /**
             * Creates a DescriptorProto message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns DescriptorProto
             */
            public static fromObject(object: { [k: string]: any }): google.protobuf.DescriptorProto;

            /**
             * Creates a plain object from a DescriptorProto message. Also converts values to other types if specified.
             * @param message DescriptorProto
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.protobuf.DescriptorProto, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this DescriptorProto to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for DescriptorProto
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        namespace DescriptorProto {

            /** Properties of an ExtensionRange. */
            interface IExtensionRange {

                /** ExtensionRange start */
                start?: (number|null);

                /** ExtensionRange end */
                end?: (number|null);

                /** ExtensionRange options */
                options?: (google.protobuf.IExtensionRangeOptions|null);
            }

            /** Represents an ExtensionRange. */
            class ExtensionRange implements IExtensionRange {

                /**
                 * Constructs a new ExtensionRange.
                 * @param [properties] Properties to set
                 */
                constructor(properties?: google.protobuf.DescriptorProto.IExtensionRange);

                /** ExtensionRange start. */
                public start: number;

                /** ExtensionRange end. */
                public end: number;

                /** ExtensionRange options. */
                public options?: (google.protobuf.IExtensionRangeOptions|null);

                /**
                 * Creates an ExtensionRange message from a plain object. Also converts values to their respective internal types.
                 * @param object Plain object
                 * @returns ExtensionRange
                 */
                public static fromObject(object: { [k: string]: any }): google.protobuf.DescriptorProto.ExtensionRange;

                /**
                 * Creates a plain object from an ExtensionRange message. Also converts values to other types if specified.
                 * @param message ExtensionRange
                 * @param [options] Conversion options
                 * @returns Plain object
                 */
                public static toObject(message: google.protobuf.DescriptorProto.ExtensionRange, options?: $protobuf.IConversionOptions): { [k: string]: any };

                /**
                 * Converts this ExtensionRange to JSON.
                 * @returns JSON object
                 */
                public toJSON(): { [k: string]: any };

                /**
                 * Gets the default type url for ExtensionRange
                 * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                 * @returns The default type url
                 */
                public static getTypeUrl(typeUrlPrefix?: string): string;
            }

            /** Properties of a ReservedRange. */
            interface IReservedRange {

                /** ReservedRange start */
                start?: (number|null);

                /** ReservedRange end */
                end?: (number|null);
            }

            /** Represents a ReservedRange. */
            class ReservedRange implements IReservedRange {

                /**
                 * Constructs a new ReservedRange.
                 * @param [properties] Properties to set
                 */
                constructor(properties?: google.protobuf.DescriptorProto.IReservedRange);

                /** ReservedRange start. */
                public start: number;

                /** ReservedRange end. */
                public end: number;

                /**
                 * Creates a ReservedRange message from a plain object. Also converts values to their respective internal types.
                 * @param object Plain object
                 * @returns ReservedRange
                 */
                public static fromObject(object: { [k: string]: any }): google.protobuf.DescriptorProto.ReservedRange;

                /**
                 * Creates a plain object from a ReservedRange message. Also converts values to other types if specified.
                 * @param message ReservedRange
                 * @param [options] Conversion options
                 * @returns Plain object
                 */
                public static toObject(message: google.protobuf.DescriptorProto.ReservedRange, options?: $protobuf.IConversionOptions): { [k: string]: any };

                /**
                 * Converts this ReservedRange to JSON.
                 * @returns JSON object
                 */
                public toJSON(): { [k: string]: any };

                /**
                 * Gets the default type url for ReservedRange
                 * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                 * @returns The default type url
                 */
                public static getTypeUrl(typeUrlPrefix?: string): string;
            }
        }

        /** Properties of an ExtensionRangeOptions. */
        interface IExtensionRangeOptions {

            /** ExtensionRangeOptions uninterpretedOption */
            uninterpretedOption?: (google.protobuf.IUninterpretedOption[]|null);

            /** ExtensionRangeOptions declaration */
            declaration?: (google.protobuf.ExtensionRangeOptions.IDeclaration[]|null);

            /** ExtensionRangeOptions features */
            features?: (google.protobuf.IFeatureSet|null);

            /** ExtensionRangeOptions verification */
            verification?: (google.protobuf.ExtensionRangeOptions.VerificationState|null);
        }

        /** Represents an ExtensionRangeOptions. */
        class ExtensionRangeOptions implements IExtensionRangeOptions {

            /**
             * Constructs a new ExtensionRangeOptions.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.protobuf.IExtensionRangeOptions);

            /** ExtensionRangeOptions uninterpretedOption. */
            public uninterpretedOption: google.protobuf.IUninterpretedOption[];

            /** ExtensionRangeOptions declaration. */
            public declaration: google.protobuf.ExtensionRangeOptions.IDeclaration[];

            /** ExtensionRangeOptions features. */
            public features?: (google.protobuf.IFeatureSet|null);

            /** ExtensionRangeOptions verification. */
            public verification: google.protobuf.ExtensionRangeOptions.VerificationState;

            /**
             * Creates an ExtensionRangeOptions message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns ExtensionRangeOptions
             */
            public static fromObject(object: { [k: string]: any }): google.protobuf.ExtensionRangeOptions;

            /**
             * Creates a plain object from an ExtensionRangeOptions message. Also converts values to other types if specified.
             * @param message ExtensionRangeOptions
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.protobuf.ExtensionRangeOptions, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this ExtensionRangeOptions to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for ExtensionRangeOptions
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        namespace ExtensionRangeOptions {

            /** Properties of a Declaration. */
            interface IDeclaration {

                /** Declaration number */
                number?: (number|null);

                /** Declaration fullName */
                fullName?: (string|null);

                /** Declaration type */
                type?: (string|null);

                /** Declaration reserved */
                reserved?: (boolean|null);

                /** Declaration repeated */
                repeated?: (boolean|null);
            }

            /** Represents a Declaration. */
            class Declaration implements IDeclaration {

                /**
                 * Constructs a new Declaration.
                 * @param [properties] Properties to set
                 */
                constructor(properties?: google.protobuf.ExtensionRangeOptions.IDeclaration);

                /** Declaration number. */
                public number: number;

                /** Declaration fullName. */
                public fullName: string;

                /** Declaration type. */
                public type: string;

                /** Declaration reserved. */
                public reserved: boolean;

                /** Declaration repeated. */
                public repeated: boolean;

                /**
                 * Creates a Declaration message from a plain object. Also converts values to their respective internal types.
                 * @param object Plain object
                 * @returns Declaration
                 */
                public static fromObject(object: { [k: string]: any }): google.protobuf.ExtensionRangeOptions.Declaration;

                /**
                 * Creates a plain object from a Declaration message. Also converts values to other types if specified.
                 * @param message Declaration
                 * @param [options] Conversion options
                 * @returns Plain object
                 */
                public static toObject(message: google.protobuf.ExtensionRangeOptions.Declaration, options?: $protobuf.IConversionOptions): { [k: string]: any };

                /**
                 * Converts this Declaration to JSON.
                 * @returns JSON object
                 */
                public toJSON(): { [k: string]: any };

                /**
                 * Gets the default type url for Declaration
                 * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                 * @returns The default type url
                 */
                public static getTypeUrl(typeUrlPrefix?: string): string;
            }

            /** VerificationState enum. */
            type VerificationState =
                "DECLARATION"| "UNVERIFIED";
        }

        /** Properties of a FieldDescriptorProto. */
        interface IFieldDescriptorProto {

            /** FieldDescriptorProto name */
            name?: (string|null);

            /** FieldDescriptorProto number */
            number?: (number|null);

            /** FieldDescriptorProto label */
            label?: (google.protobuf.FieldDescriptorProto.Label|null);

            /** FieldDescriptorProto type */
            type?: (google.protobuf.FieldDescriptorProto.Type|null);

            /** FieldDescriptorProto typeName */
            typeName?: (string|null);

            /** FieldDescriptorProto extendee */
            extendee?: (string|null);

            /** FieldDescriptorProto defaultValue */
            defaultValue?: (string|null);

            /** FieldDescriptorProto oneofIndex */
            oneofIndex?: (number|null);

            /** FieldDescriptorProto jsonName */
            jsonName?: (string|null);

            /** FieldDescriptorProto options */
            options?: (google.protobuf.IFieldOptions|null);

            /** FieldDescriptorProto proto3Optional */
            proto3Optional?: (boolean|null);
        }

        /** Represents a FieldDescriptorProto. */
        class FieldDescriptorProto implements IFieldDescriptorProto {

            /**
             * Constructs a new FieldDescriptorProto.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.protobuf.IFieldDescriptorProto);

            /** FieldDescriptorProto name. */
            public name: string;

            /** FieldDescriptorProto number. */
            public number: number;

            /** FieldDescriptorProto label. */
            public label: google.protobuf.FieldDescriptorProto.Label;

            /** FieldDescriptorProto type. */
            public type: google.protobuf.FieldDescriptorProto.Type;

            /** FieldDescriptorProto typeName. */
            public typeName: string;

            /** FieldDescriptorProto extendee. */
            public extendee: string;

            /** FieldDescriptorProto defaultValue. */
            public defaultValue: string;

            /** FieldDescriptorProto oneofIndex. */
            public oneofIndex: number;

            /** FieldDescriptorProto jsonName. */
            public jsonName: string;

            /** FieldDescriptorProto options. */
            public options?: (google.protobuf.IFieldOptions|null);

            /** FieldDescriptorProto proto3Optional. */
            public proto3Optional: boolean;

            /**
             * Creates a FieldDescriptorProto message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns FieldDescriptorProto
             */
            public static fromObject(object: { [k: string]: any }): google.protobuf.FieldDescriptorProto;

            /**
             * Creates a plain object from a FieldDescriptorProto message. Also converts values to other types if specified.
             * @param message FieldDescriptorProto
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.protobuf.FieldDescriptorProto, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this FieldDescriptorProto to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for FieldDescriptorProto
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        namespace FieldDescriptorProto {

            /** Type enum. */
            type Type =
                "TYPE_DOUBLE"| "TYPE_FLOAT"| "TYPE_INT64"| "TYPE_UINT64"| "TYPE_INT32"| "TYPE_FIXED64"| "TYPE_FIXED32"| "TYPE_BOOL"| "TYPE_STRING"| "TYPE_GROUP"| "TYPE_MESSAGE"| "TYPE_BYTES"| "TYPE_UINT32"| "TYPE_ENUM"| "TYPE_SFIXED32"| "TYPE_SFIXED64"| "TYPE_SINT32"| "TYPE_SINT64";

            /** Label enum. */
            type Label =
                "LABEL_OPTIONAL"| "LABEL_REPEATED"| "LABEL_REQUIRED";
        }

        /** Properties of an OneofDescriptorProto. */
        interface IOneofDescriptorProto {

            /** OneofDescriptorProto name */
            name?: (string|null);

            /** OneofDescriptorProto options */
            options?: (google.protobuf.IOneofOptions|null);
        }

        /** Represents an OneofDescriptorProto. */
        class OneofDescriptorProto implements IOneofDescriptorProto {

            /**
             * Constructs a new OneofDescriptorProto.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.protobuf.IOneofDescriptorProto);

            /** OneofDescriptorProto name. */
            public name: string;

            /** OneofDescriptorProto options. */
            public options?: (google.protobuf.IOneofOptions|null);

            /**
             * Creates an OneofDescriptorProto message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns OneofDescriptorProto
             */
            public static fromObject(object: { [k: string]: any }): google.protobuf.OneofDescriptorProto;

            /**
             * Creates a plain object from an OneofDescriptorProto message. Also converts values to other types if specified.
             * @param message OneofDescriptorProto
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.protobuf.OneofDescriptorProto, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this OneofDescriptorProto to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for OneofDescriptorProto
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of an EnumDescriptorProto. */
        interface IEnumDescriptorProto {

            /** EnumDescriptorProto name */
            name?: (string|null);

            /** EnumDescriptorProto value */
            value?: (google.protobuf.IEnumValueDescriptorProto[]|null);

            /** EnumDescriptorProto options */
            options?: (google.protobuf.IEnumOptions|null);

            /** EnumDescriptorProto reservedRange */
            reservedRange?: (google.protobuf.EnumDescriptorProto.IEnumReservedRange[]|null);

            /** EnumDescriptorProto reservedName */
            reservedName?: (string[]|null);
        }

        /** Represents an EnumDescriptorProto. */
        class EnumDescriptorProto implements IEnumDescriptorProto {

            /**
             * Constructs a new EnumDescriptorProto.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.protobuf.IEnumDescriptorProto);

            /** EnumDescriptorProto name. */
            public name: string;

            /** EnumDescriptorProto value. */
            public value: google.protobuf.IEnumValueDescriptorProto[];

            /** EnumDescriptorProto options. */
            public options?: (google.protobuf.IEnumOptions|null);

            /** EnumDescriptorProto reservedRange. */
            public reservedRange: google.protobuf.EnumDescriptorProto.IEnumReservedRange[];

            /** EnumDescriptorProto reservedName. */
            public reservedName: string[];

            /**
             * Creates an EnumDescriptorProto message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns EnumDescriptorProto
             */
            public static fromObject(object: { [k: string]: any }): google.protobuf.EnumDescriptorProto;

            /**
             * Creates a plain object from an EnumDescriptorProto message. Also converts values to other types if specified.
             * @param message EnumDescriptorProto
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.protobuf.EnumDescriptorProto, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this EnumDescriptorProto to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for EnumDescriptorProto
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        namespace EnumDescriptorProto {

            /** Properties of an EnumReservedRange. */
            interface IEnumReservedRange {

                /** EnumReservedRange start */
                start?: (number|null);

                /** EnumReservedRange end */
                end?: (number|null);
            }

            /** Represents an EnumReservedRange. */
            class EnumReservedRange implements IEnumReservedRange {

                /**
                 * Constructs a new EnumReservedRange.
                 * @param [properties] Properties to set
                 */
                constructor(properties?: google.protobuf.EnumDescriptorProto.IEnumReservedRange);

                /** EnumReservedRange start. */
                public start: number;

                /** EnumReservedRange end. */
                public end: number;

                /**
                 * Creates an EnumReservedRange message from a plain object. Also converts values to their respective internal types.
                 * @param object Plain object
                 * @returns EnumReservedRange
                 */
                public static fromObject(object: { [k: string]: any }): google.protobuf.EnumDescriptorProto.EnumReservedRange;

                /**
                 * Creates a plain object from an EnumReservedRange message. Also converts values to other types if specified.
                 * @param message EnumReservedRange
                 * @param [options] Conversion options
                 * @returns Plain object
                 */
                public static toObject(message: google.protobuf.EnumDescriptorProto.EnumReservedRange, options?: $protobuf.IConversionOptions): { [k: string]: any };

                /**
                 * Converts this EnumReservedRange to JSON.
                 * @returns JSON object
                 */
                public toJSON(): { [k: string]: any };

                /**
                 * Gets the default type url for EnumReservedRange
                 * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                 * @returns The default type url
                 */
                public static getTypeUrl(typeUrlPrefix?: string): string;
            }
        }

        /** Properties of an EnumValueDescriptorProto. */
        interface IEnumValueDescriptorProto {

            /** EnumValueDescriptorProto name */
            name?: (string|null);

            /** EnumValueDescriptorProto number */
            number?: (number|null);

            /** EnumValueDescriptorProto options */
            options?: (google.protobuf.IEnumValueOptions|null);
        }

        /** Represents an EnumValueDescriptorProto. */
        class EnumValueDescriptorProto implements IEnumValueDescriptorProto {

            /**
             * Constructs a new EnumValueDescriptorProto.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.protobuf.IEnumValueDescriptorProto);

            /** EnumValueDescriptorProto name. */
            public name: string;

            /** EnumValueDescriptorProto number. */
            public number: number;

            /** EnumValueDescriptorProto options. */
            public options?: (google.protobuf.IEnumValueOptions|null);

            /**
             * Creates an EnumValueDescriptorProto message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns EnumValueDescriptorProto
             */
            public static fromObject(object: { [k: string]: any }): google.protobuf.EnumValueDescriptorProto;

            /**
             * Creates a plain object from an EnumValueDescriptorProto message. Also converts values to other types if specified.
             * @param message EnumValueDescriptorProto
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.protobuf.EnumValueDescriptorProto, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this EnumValueDescriptorProto to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for EnumValueDescriptorProto
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of a ServiceDescriptorProto. */
        interface IServiceDescriptorProto {

            /** ServiceDescriptorProto name */
            name?: (string|null);

            /** ServiceDescriptorProto method */
            method?: (google.protobuf.IMethodDescriptorProto[]|null);

            /** ServiceDescriptorProto options */
            options?: (google.protobuf.IServiceOptions|null);
        }

        /** Represents a ServiceDescriptorProto. */
        class ServiceDescriptorProto implements IServiceDescriptorProto {

            /**
             * Constructs a new ServiceDescriptorProto.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.protobuf.IServiceDescriptorProto);

            /** ServiceDescriptorProto name. */
            public name: string;

            /** ServiceDescriptorProto method. */
            public method: google.protobuf.IMethodDescriptorProto[];

            /** ServiceDescriptorProto options. */
            public options?: (google.protobuf.IServiceOptions|null);

            /**
             * Creates a ServiceDescriptorProto message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns ServiceDescriptorProto
             */
            public static fromObject(object: { [k: string]: any }): google.protobuf.ServiceDescriptorProto;

            /**
             * Creates a plain object from a ServiceDescriptorProto message. Also converts values to other types if specified.
             * @param message ServiceDescriptorProto
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.protobuf.ServiceDescriptorProto, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this ServiceDescriptorProto to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for ServiceDescriptorProto
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of a MethodDescriptorProto. */
        interface IMethodDescriptorProto {

            /** MethodDescriptorProto name */
            name?: (string|null);

            /** MethodDescriptorProto inputType */
            inputType?: (string|null);

            /** MethodDescriptorProto outputType */
            outputType?: (string|null);

            /** MethodDescriptorProto options */
            options?: (google.protobuf.IMethodOptions|null);

            /** MethodDescriptorProto clientStreaming */
            clientStreaming?: (boolean|null);

            /** MethodDescriptorProto serverStreaming */
            serverStreaming?: (boolean|null);
        }

        /** Represents a MethodDescriptorProto. */
        class MethodDescriptorProto implements IMethodDescriptorProto {

            /**
             * Constructs a new MethodDescriptorProto.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.protobuf.IMethodDescriptorProto);

            /** MethodDescriptorProto name. */
            public name: string;

            /** MethodDescriptorProto inputType. */
            public inputType: string;

            /** MethodDescriptorProto outputType. */
            public outputType: string;

            /** MethodDescriptorProto options. */
            public options?: (google.protobuf.IMethodOptions|null);

            /** MethodDescriptorProto clientStreaming. */
            public clientStreaming: boolean;

            /** MethodDescriptorProto serverStreaming. */
            public serverStreaming: boolean;

            /**
             * Creates a MethodDescriptorProto message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns MethodDescriptorProto
             */
            public static fromObject(object: { [k: string]: any }): google.protobuf.MethodDescriptorProto;

            /**
             * Creates a plain object from a MethodDescriptorProto message. Also converts values to other types if specified.
             * @param message MethodDescriptorProto
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.protobuf.MethodDescriptorProto, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this MethodDescriptorProto to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for MethodDescriptorProto
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of a FileOptions. */
        interface IFileOptions {

            /** FileOptions javaPackage */
            javaPackage?: (string|null);

            /** FileOptions javaOuterClassname */
            javaOuterClassname?: (string|null);

            /** FileOptions javaMultipleFiles */
            javaMultipleFiles?: (boolean|null);

            /** FileOptions javaGenerateEqualsAndHash */
            javaGenerateEqualsAndHash?: (boolean|null);

            /** FileOptions javaStringCheckUtf8 */
            javaStringCheckUtf8?: (boolean|null);

            /** FileOptions optimizeFor */
            optimizeFor?: (google.protobuf.FileOptions.OptimizeMode|null);

            /** FileOptions goPackage */
            goPackage?: (string|null);

            /** FileOptions ccGenericServices */
            ccGenericServices?: (boolean|null);

            /** FileOptions javaGenericServices */
            javaGenericServices?: (boolean|null);

            /** FileOptions pyGenericServices */
            pyGenericServices?: (boolean|null);

            /** FileOptions deprecated */
            deprecated?: (boolean|null);

            /** FileOptions ccEnableArenas */
            ccEnableArenas?: (boolean|null);

            /** FileOptions objcClassPrefix */
            objcClassPrefix?: (string|null);

            /** FileOptions csharpNamespace */
            csharpNamespace?: (string|null);

            /** FileOptions swiftPrefix */
            swiftPrefix?: (string|null);

            /** FileOptions phpClassPrefix */
            phpClassPrefix?: (string|null);

            /** FileOptions phpNamespace */
            phpNamespace?: (string|null);

            /** FileOptions phpMetadataNamespace */
            phpMetadataNamespace?: (string|null);

            /** FileOptions rubyPackage */
            rubyPackage?: (string|null);

            /** FileOptions features */
            features?: (google.protobuf.IFeatureSet|null);

            /** FileOptions uninterpretedOption */
            uninterpretedOption?: (google.protobuf.IUninterpretedOption[]|null);

            /** FileOptions .google.api.resourceDefinition */
            ".google.api.resourceDefinition"?: (google.api.IResourceDescriptor[]|null);
        }

        /** Represents a FileOptions. */
        class FileOptions implements IFileOptions {

            /**
             * Constructs a new FileOptions.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.protobuf.IFileOptions);

            /** FileOptions javaPackage. */
            public javaPackage: string;

            /** FileOptions javaOuterClassname. */
            public javaOuterClassname: string;

            /** FileOptions javaMultipleFiles. */
            public javaMultipleFiles: boolean;

            /** FileOptions javaGenerateEqualsAndHash. */
            public javaGenerateEqualsAndHash: boolean;

            /** FileOptions javaStringCheckUtf8. */
            public javaStringCheckUtf8: boolean;

            /** FileOptions optimizeFor. */
            public optimizeFor: google.protobuf.FileOptions.OptimizeMode;

            /** FileOptions goPackage. */
            public goPackage: string;

            /** FileOptions ccGenericServices. */
            public ccGenericServices: boolean;

            /** FileOptions javaGenericServices. */
            public javaGenericServices: boolean;

            /** FileOptions pyGenericServices. */
            public pyGenericServices: boolean;

            /** FileOptions deprecated. */
            public deprecated: boolean;

            /** FileOptions ccEnableArenas. */
            public ccEnableArenas: boolean;

            /** FileOptions objcClassPrefix. */
            public objcClassPrefix: string;

            /** FileOptions csharpNamespace. */
            public csharpNamespace: string;

            /** FileOptions swiftPrefix. */
            public swiftPrefix: string;

            /** FileOptions phpClassPrefix. */
            public phpClassPrefix: string;

            /** FileOptions phpNamespace. */
            public phpNamespace: string;

            /** FileOptions phpMetadataNamespace. */
            public phpMetadataNamespace: string;

            /** FileOptions rubyPackage. */
            public rubyPackage: string;

            /** FileOptions features. */
            public features?: (google.protobuf.IFeatureSet|null);

            /** FileOptions uninterpretedOption. */
            public uninterpretedOption: google.protobuf.IUninterpretedOption[];

            /**
             * Creates a FileOptions message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns FileOptions
             */
            public static fromObject(object: { [k: string]: any }): google.protobuf.FileOptions;

            /**
             * Creates a plain object from a FileOptions message. Also converts values to other types if specified.
             * @param message FileOptions
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.protobuf.FileOptions, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this FileOptions to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for FileOptions
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        namespace FileOptions {

            /** OptimizeMode enum. */
            type OptimizeMode =
                "SPEED"| "CODE_SIZE"| "LITE_RUNTIME";
        }

        /** Properties of a MessageOptions. */
        interface IMessageOptions {

            /** MessageOptions messageSetWireFormat */
            messageSetWireFormat?: (boolean|null);

            /** MessageOptions noStandardDescriptorAccessor */
            noStandardDescriptorAccessor?: (boolean|null);

            /** MessageOptions deprecated */
            deprecated?: (boolean|null);

            /** MessageOptions mapEntry */
            mapEntry?: (boolean|null);

            /** MessageOptions deprecatedLegacyJsonFieldConflicts */
            deprecatedLegacyJsonFieldConflicts?: (boolean|null);

            /** MessageOptions features */
            features?: (google.protobuf.IFeatureSet|null);

            /** MessageOptions uninterpretedOption */
            uninterpretedOption?: (google.protobuf.IUninterpretedOption[]|null);

            /** MessageOptions .google.api.resource */
            ".google.api.resource"?: (google.api.IResourceDescriptor|null);
        }

        /** Represents a MessageOptions. */
        class MessageOptions implements IMessageOptions {

            /**
             * Constructs a new MessageOptions.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.protobuf.IMessageOptions);

            /** MessageOptions messageSetWireFormat. */
            public messageSetWireFormat: boolean;

            /** MessageOptions noStandardDescriptorAccessor. */
            public noStandardDescriptorAccessor: boolean;

            /** MessageOptions deprecated. */
            public deprecated: boolean;

            /** MessageOptions mapEntry. */
            public mapEntry: boolean;

            /** MessageOptions deprecatedLegacyJsonFieldConflicts. */
            public deprecatedLegacyJsonFieldConflicts: boolean;

            /** MessageOptions features. */
            public features?: (google.protobuf.IFeatureSet|null);

            /** MessageOptions uninterpretedOption. */
            public uninterpretedOption: google.protobuf.IUninterpretedOption[];

            /**
             * Creates a MessageOptions message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns MessageOptions
             */
            public static fromObject(object: { [k: string]: any }): google.protobuf.MessageOptions;

            /**
             * Creates a plain object from a MessageOptions message. Also converts values to other types if specified.
             * @param message MessageOptions
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.protobuf.MessageOptions, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this MessageOptions to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for MessageOptions
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of a FieldOptions. */
        interface IFieldOptions {

            /** FieldOptions ctype */
            ctype?: (google.protobuf.FieldOptions.CType|null);

            /** FieldOptions packed */
            packed?: (boolean|null);

            /** FieldOptions jstype */
            jstype?: (google.protobuf.FieldOptions.JSType|null);

            /** FieldOptions lazy */
            lazy?: (boolean|null);

            /** FieldOptions unverifiedLazy */
            unverifiedLazy?: (boolean|null);

            /** FieldOptions deprecated */
            deprecated?: (boolean|null);

            /** FieldOptions weak */
            weak?: (boolean|null);

            /** FieldOptions debugRedact */
            debugRedact?: (boolean|null);

            /** FieldOptions retention */
            retention?: (google.protobuf.FieldOptions.OptionRetention|null);

            /** FieldOptions targets */
            targets?: (google.protobuf.FieldOptions.OptionTargetType[]|null);

            /** FieldOptions editionDefaults */
            editionDefaults?: (google.protobuf.FieldOptions.IEditionDefault[]|null);

            /** FieldOptions features */
            features?: (google.protobuf.IFeatureSet|null);

            /** FieldOptions uninterpretedOption */
            uninterpretedOption?: (google.protobuf.IUninterpretedOption[]|null);

            /** FieldOptions .google.api.fieldBehavior */
            ".google.api.fieldBehavior"?: (google.api.FieldBehavior[]|null);

            /** FieldOptions .google.api.resourceReference */
            ".google.api.resourceReference"?: (google.api.IResourceReference|null);
        }

        /** Represents a FieldOptions. */
        class FieldOptions implements IFieldOptions {

            /**
             * Constructs a new FieldOptions.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.protobuf.IFieldOptions);

            /** FieldOptions ctype. */
            public ctype: google.protobuf.FieldOptions.CType;

            /** FieldOptions packed. */
            public packed: boolean;

            /** FieldOptions jstype. */
            public jstype: google.protobuf.FieldOptions.JSType;

            /** FieldOptions lazy. */
            public lazy: boolean;

            /** FieldOptions unverifiedLazy. */
            public unverifiedLazy: boolean;

            /** FieldOptions deprecated. */
            public deprecated: boolean;

            /** FieldOptions weak. */
            public weak: boolean;

            /** FieldOptions debugRedact. */
            public debugRedact: boolean;

            /** FieldOptions retention. */
            public retention: google.protobuf.FieldOptions.OptionRetention;

            /** FieldOptions targets. */
            public targets: google.protobuf.FieldOptions.OptionTargetType[];

            /** FieldOptions editionDefaults. */
            public editionDefaults: google.protobuf.FieldOptions.IEditionDefault[];

            /** FieldOptions features. */
            public features?: (google.protobuf.IFeatureSet|null);

            /** FieldOptions uninterpretedOption. */
            public uninterpretedOption: google.protobuf.IUninterpretedOption[];

            /**
             * Creates a FieldOptions message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns FieldOptions
             */
            public static fromObject(object: { [k: string]: any }): google.protobuf.FieldOptions;

            /**
             * Creates a plain object from a FieldOptions message. Also converts values to other types if specified.
             * @param message FieldOptions
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.protobuf.FieldOptions, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this FieldOptions to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for FieldOptions
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        namespace FieldOptions {

            /** CType enum. */
            type CType =
                "STRING"| "CORD"| "STRING_PIECE";

            /** JSType enum. */
            type JSType =
                "JS_NORMAL"| "JS_STRING"| "JS_NUMBER";

            /** OptionRetention enum. */
            type OptionRetention =
                "RETENTION_UNKNOWN"| "RETENTION_RUNTIME"| "RETENTION_SOURCE";

            /** OptionTargetType enum. */
            type OptionTargetType =
                "TARGET_TYPE_UNKNOWN"| "TARGET_TYPE_FILE"| "TARGET_TYPE_EXTENSION_RANGE"| "TARGET_TYPE_MESSAGE"| "TARGET_TYPE_FIELD"| "TARGET_TYPE_ONEOF"| "TARGET_TYPE_ENUM"| "TARGET_TYPE_ENUM_ENTRY"| "TARGET_TYPE_SERVICE"| "TARGET_TYPE_METHOD";

            /** Properties of an EditionDefault. */
            interface IEditionDefault {

                /** EditionDefault edition */
                edition?: (google.protobuf.Edition|null);

                /** EditionDefault value */
                value?: (string|null);
            }

            /** Represents an EditionDefault. */
            class EditionDefault implements IEditionDefault {

                /**
                 * Constructs a new EditionDefault.
                 * @param [properties] Properties to set
                 */
                constructor(properties?: google.protobuf.FieldOptions.IEditionDefault);

                /** EditionDefault edition. */
                public edition: google.protobuf.Edition;

                /** EditionDefault value. */
                public value: string;

                /**
                 * Creates an EditionDefault message from a plain object. Also converts values to their respective internal types.
                 * @param object Plain object
                 * @returns EditionDefault
                 */
                public static fromObject(object: { [k: string]: any }): google.protobuf.FieldOptions.EditionDefault;

                /**
                 * Creates a plain object from an EditionDefault message. Also converts values to other types if specified.
                 * @param message EditionDefault
                 * @param [options] Conversion options
                 * @returns Plain object
                 */
                public static toObject(message: google.protobuf.FieldOptions.EditionDefault, options?: $protobuf.IConversionOptions): { [k: string]: any };

                /**
                 * Converts this EditionDefault to JSON.
                 * @returns JSON object
                 */
                public toJSON(): { [k: string]: any };

                /**
                 * Gets the default type url for EditionDefault
                 * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                 * @returns The default type url
                 */
                public static getTypeUrl(typeUrlPrefix?: string): string;
            }
        }

        /** Properties of an OneofOptions. */
        interface IOneofOptions {

            /** OneofOptions features */
            features?: (google.protobuf.IFeatureSet|null);

            /** OneofOptions uninterpretedOption */
            uninterpretedOption?: (google.protobuf.IUninterpretedOption[]|null);
        }

        /** Represents an OneofOptions. */
        class OneofOptions implements IOneofOptions {

            /**
             * Constructs a new OneofOptions.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.protobuf.IOneofOptions);

            /** OneofOptions features. */
            public features?: (google.protobuf.IFeatureSet|null);

            /** OneofOptions uninterpretedOption. */
            public uninterpretedOption: google.protobuf.IUninterpretedOption[];

            /**
             * Creates an OneofOptions message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns OneofOptions
             */
            public static fromObject(object: { [k: string]: any }): google.protobuf.OneofOptions;

            /**
             * Creates a plain object from an OneofOptions message. Also converts values to other types if specified.
             * @param message OneofOptions
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.protobuf.OneofOptions, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this OneofOptions to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for OneofOptions
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of an EnumOptions. */
        interface IEnumOptions {

            /** EnumOptions allowAlias */
            allowAlias?: (boolean|null);

            /** EnumOptions deprecated */
            deprecated?: (boolean|null);

            /** EnumOptions deprecatedLegacyJsonFieldConflicts */
            deprecatedLegacyJsonFieldConflicts?: (boolean|null);

            /** EnumOptions features */
            features?: (google.protobuf.IFeatureSet|null);

            /** EnumOptions uninterpretedOption */
            uninterpretedOption?: (google.protobuf.IUninterpretedOption[]|null);
        }

        /** Represents an EnumOptions. */
        class EnumOptions implements IEnumOptions {

            /**
             * Constructs a new EnumOptions.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.protobuf.IEnumOptions);

            /** EnumOptions allowAlias. */
            public allowAlias: boolean;

            /** EnumOptions deprecated. */
            public deprecated: boolean;

            /** EnumOptions deprecatedLegacyJsonFieldConflicts. */
            public deprecatedLegacyJsonFieldConflicts: boolean;

            /** EnumOptions features. */
            public features?: (google.protobuf.IFeatureSet|null);

            /** EnumOptions uninterpretedOption. */
            public uninterpretedOption: google.protobuf.IUninterpretedOption[];

            /**
             * Creates an EnumOptions message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns EnumOptions
             */
            public static fromObject(object: { [k: string]: any }): google.protobuf.EnumOptions;

            /**
             * Creates a plain object from an EnumOptions message. Also converts values to other types if specified.
             * @param message EnumOptions
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.protobuf.EnumOptions, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this EnumOptions to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for EnumOptions
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of an EnumValueOptions. */
        interface IEnumValueOptions {

            /** EnumValueOptions deprecated */
            deprecated?: (boolean|null);

            /** EnumValueOptions features */
            features?: (google.protobuf.IFeatureSet|null);

            /** EnumValueOptions debugRedact */
            debugRedact?: (boolean|null);

            /** EnumValueOptions uninterpretedOption */
            uninterpretedOption?: (google.protobuf.IUninterpretedOption[]|null);
        }

        /** Represents an EnumValueOptions. */
        class EnumValueOptions implements IEnumValueOptions {

            /**
             * Constructs a new EnumValueOptions.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.protobuf.IEnumValueOptions);

            /** EnumValueOptions deprecated. */
            public deprecated: boolean;

            /** EnumValueOptions features. */
            public features?: (google.protobuf.IFeatureSet|null);

            /** EnumValueOptions debugRedact. */
            public debugRedact: boolean;

            /** EnumValueOptions uninterpretedOption. */
            public uninterpretedOption: google.protobuf.IUninterpretedOption[];

            /**
             * Creates an EnumValueOptions message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns EnumValueOptions
             */
            public static fromObject(object: { [k: string]: any }): google.protobuf.EnumValueOptions;

            /**
             * Creates a plain object from an EnumValueOptions message. Also converts values to other types if specified.
             * @param message EnumValueOptions
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.protobuf.EnumValueOptions, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this EnumValueOptions to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for EnumValueOptions
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of a ServiceOptions. */
        interface IServiceOptions {

            /** ServiceOptions features */
            features?: (google.protobuf.IFeatureSet|null);

            /** ServiceOptions deprecated */
            deprecated?: (boolean|null);

            /** ServiceOptions uninterpretedOption */
            uninterpretedOption?: (google.protobuf.IUninterpretedOption[]|null);

            /** ServiceOptions .google.api.defaultHost */
            ".google.api.defaultHost"?: (string|null);

            /** ServiceOptions .google.api.oauthScopes */
            ".google.api.oauthScopes"?: (string|null);

            /** ServiceOptions .google.api.apiVersion */
            ".google.api.apiVersion"?: (string|null);
        }

        /** Represents a ServiceOptions. */
        class ServiceOptions implements IServiceOptions {

            /**
             * Constructs a new ServiceOptions.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.protobuf.IServiceOptions);

            /** ServiceOptions features. */
            public features?: (google.protobuf.IFeatureSet|null);

            /** ServiceOptions deprecated. */
            public deprecated: boolean;

            /** ServiceOptions uninterpretedOption. */
            public uninterpretedOption: google.protobuf.IUninterpretedOption[];

            /**
             * Creates a ServiceOptions message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns ServiceOptions
             */
            public static fromObject(object: { [k: string]: any }): google.protobuf.ServiceOptions;

            /**
             * Creates a plain object from a ServiceOptions message. Also converts values to other types if specified.
             * @param message ServiceOptions
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.protobuf.ServiceOptions, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this ServiceOptions to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for ServiceOptions
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of a MethodOptions. */
        interface IMethodOptions {

            /** MethodOptions deprecated */
            deprecated?: (boolean|null);

            /** MethodOptions idempotencyLevel */
            idempotencyLevel?: (google.protobuf.MethodOptions.IdempotencyLevel|null);

            /** MethodOptions features */
            features?: (google.protobuf.IFeatureSet|null);

            /** MethodOptions uninterpretedOption */
            uninterpretedOption?: (google.protobuf.IUninterpretedOption[]|null);

            /** MethodOptions .google.api.http */
            ".google.api.http"?: (google.api.IHttpRule|null);

            /** MethodOptions .google.api.methodSignature */
            ".google.api.methodSignature"?: (string[]|null);

            /** MethodOptions .google.longrunning.operationInfo */
            ".google.longrunning.operationInfo"?: (google.longrunning.IOperationInfo|null);
        }

        /** Represents a MethodOptions. */
        class MethodOptions implements IMethodOptions {

            /**
             * Constructs a new MethodOptions.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.protobuf.IMethodOptions);

            /** MethodOptions deprecated. */
            public deprecated: boolean;

            /** MethodOptions idempotencyLevel. */
            public idempotencyLevel: google.protobuf.MethodOptions.IdempotencyLevel;

            /** MethodOptions features. */
            public features?: (google.protobuf.IFeatureSet|null);

            /** MethodOptions uninterpretedOption. */
            public uninterpretedOption: google.protobuf.IUninterpretedOption[];

            /**
             * Creates a MethodOptions message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns MethodOptions
             */
            public static fromObject(object: { [k: string]: any }): google.protobuf.MethodOptions;

            /**
             * Creates a plain object from a MethodOptions message. Also converts values to other types if specified.
             * @param message MethodOptions
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.protobuf.MethodOptions, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this MethodOptions to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for MethodOptions
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        namespace MethodOptions {

            /** IdempotencyLevel enum. */
            type IdempotencyLevel =
                "IDEMPOTENCY_UNKNOWN"| "NO_SIDE_EFFECTS"| "IDEMPOTENT";
        }

        /** Properties of an UninterpretedOption. */
        interface IUninterpretedOption {

            /** UninterpretedOption name */
            name?: (google.protobuf.UninterpretedOption.INamePart[]|null);

            /** UninterpretedOption identifierValue */
            identifierValue?: (string|null);

            /** UninterpretedOption positiveIntValue */
            positiveIntValue?: (number|string|null);

            /** UninterpretedOption negativeIntValue */
            negativeIntValue?: (number|string|null);

            /** UninterpretedOption doubleValue */
            doubleValue?: (number|null);

            /** UninterpretedOption stringValue */
            stringValue?: (Uint8Array|null);

            /** UninterpretedOption aggregateValue */
            aggregateValue?: (string|null);
        }

        /** Represents an UninterpretedOption. */
        class UninterpretedOption implements IUninterpretedOption {

            /**
             * Constructs a new UninterpretedOption.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.protobuf.IUninterpretedOption);

            /** UninterpretedOption name. */
            public name: google.protobuf.UninterpretedOption.INamePart[];

            /** UninterpretedOption identifierValue. */
            public identifierValue: string;

            /** UninterpretedOption positiveIntValue. */
            public positiveIntValue: (number|string);

            /** UninterpretedOption negativeIntValue. */
            public negativeIntValue: (number|string);

            /** UninterpretedOption doubleValue. */
            public doubleValue: number;

            /** UninterpretedOption stringValue. */
            public stringValue: Uint8Array;

            /** UninterpretedOption aggregateValue. */
            public aggregateValue: string;

            /**
             * Creates an UninterpretedOption message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns UninterpretedOption
             */
            public static fromObject(object: { [k: string]: any }): google.protobuf.UninterpretedOption;

            /**
             * Creates a plain object from an UninterpretedOption message. Also converts values to other types if specified.
             * @param message UninterpretedOption
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.protobuf.UninterpretedOption, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this UninterpretedOption to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for UninterpretedOption
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        namespace UninterpretedOption {

            /** Properties of a NamePart. */
            interface INamePart {

                /** NamePart namePart */
                namePart: string;

                /** NamePart isExtension */
                isExtension: boolean;
            }

            /** Represents a NamePart. */
            class NamePart implements INamePart {

                /**
                 * Constructs a new NamePart.
                 * @param [properties] Properties to set
                 */
                constructor(properties?: google.protobuf.UninterpretedOption.INamePart);

                /** NamePart namePart. */
                public namePart: string;

                /** NamePart isExtension. */
                public isExtension: boolean;

                /**
                 * Creates a NamePart message from a plain object. Also converts values to their respective internal types.
                 * @param object Plain object
                 * @returns NamePart
                 */
                public static fromObject(object: { [k: string]: any }): google.protobuf.UninterpretedOption.NamePart;

                /**
                 * Creates a plain object from a NamePart message. Also converts values to other types if specified.
                 * @param message NamePart
                 * @param [options] Conversion options
                 * @returns Plain object
                 */
                public static toObject(message: google.protobuf.UninterpretedOption.NamePart, options?: $protobuf.IConversionOptions): { [k: string]: any };

                /**
                 * Converts this NamePart to JSON.
                 * @returns JSON object
                 */
                public toJSON(): { [k: string]: any };

                /**
                 * Gets the default type url for NamePart
                 * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                 * @returns The default type url
                 */
                public static getTypeUrl(typeUrlPrefix?: string): string;
            }
        }

        /** Properties of a FeatureSet. */
        interface IFeatureSet {

            /** FeatureSet fieldPresence */
            fieldPresence?: (google.protobuf.FeatureSet.FieldPresence|null);

            /** FeatureSet enumType */
            enumType?: (google.protobuf.FeatureSet.EnumType|null);

            /** FeatureSet repeatedFieldEncoding */
            repeatedFieldEncoding?: (google.protobuf.FeatureSet.RepeatedFieldEncoding|null);

            /** FeatureSet utf8Validation */
            utf8Validation?: (google.protobuf.FeatureSet.Utf8Validation|null);

            /** FeatureSet messageEncoding */
            messageEncoding?: (google.protobuf.FeatureSet.MessageEncoding|null);

            /** FeatureSet jsonFormat */
            jsonFormat?: (google.protobuf.FeatureSet.JsonFormat|null);
        }

        /** Represents a FeatureSet. */
        class FeatureSet implements IFeatureSet {

            /**
             * Constructs a new FeatureSet.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.protobuf.IFeatureSet);

            /** FeatureSet fieldPresence. */
            public fieldPresence: google.protobuf.FeatureSet.FieldPresence;

            /** FeatureSet enumType. */
            public enumType: google.protobuf.FeatureSet.EnumType;

            /** FeatureSet repeatedFieldEncoding. */
            public repeatedFieldEncoding: google.protobuf.FeatureSet.RepeatedFieldEncoding;

            /** FeatureSet utf8Validation. */
            public utf8Validation: google.protobuf.FeatureSet.Utf8Validation;

            /** FeatureSet messageEncoding. */
            public messageEncoding: google.protobuf.FeatureSet.MessageEncoding;

            /** FeatureSet jsonFormat. */
            public jsonFormat: google.protobuf.FeatureSet.JsonFormat;

            /**
             * Creates a FeatureSet message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns FeatureSet
             */
            public static fromObject(object: { [k: string]: any }): google.protobuf.FeatureSet;

            /**
             * Creates a plain object from a FeatureSet message. Also converts values to other types if specified.
             * @param message FeatureSet
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.protobuf.FeatureSet, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this FeatureSet to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for FeatureSet
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        namespace FeatureSet {

            /** FieldPresence enum. */
            type FieldPresence =
                "FIELD_PRESENCE_UNKNOWN"| "EXPLICIT"| "IMPLICIT"| "LEGACY_REQUIRED";

            /** EnumType enum. */
            type EnumType =
                "ENUM_TYPE_UNKNOWN"| "OPEN"| "CLOSED";

            /** RepeatedFieldEncoding enum. */
            type RepeatedFieldEncoding =
                "REPEATED_FIELD_ENCODING_UNKNOWN"| "PACKED"| "EXPANDED";

            /** Utf8Validation enum. */
            type Utf8Validation =
                "UTF8_VALIDATION_UNKNOWN"| "VERIFY"| "NONE";

            /** MessageEncoding enum. */
            type MessageEncoding =
                "MESSAGE_ENCODING_UNKNOWN"| "LENGTH_PREFIXED"| "DELIMITED";

            /** JsonFormat enum. */
            type JsonFormat =
                "JSON_FORMAT_UNKNOWN"| "ALLOW"| "LEGACY_BEST_EFFORT";
        }

        /** Properties of a FeatureSetDefaults. */
        interface IFeatureSetDefaults {

            /** FeatureSetDefaults defaults */
            defaults?: (google.protobuf.FeatureSetDefaults.IFeatureSetEditionDefault[]|null);

            /** FeatureSetDefaults minimumEdition */
            minimumEdition?: (google.protobuf.Edition|null);

            /** FeatureSetDefaults maximumEdition */
            maximumEdition?: (google.protobuf.Edition|null);
        }

        /** Represents a FeatureSetDefaults. */
        class FeatureSetDefaults implements IFeatureSetDefaults {

            /**
             * Constructs a new FeatureSetDefaults.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.protobuf.IFeatureSetDefaults);

            /** FeatureSetDefaults defaults. */
            public defaults: google.protobuf.FeatureSetDefaults.IFeatureSetEditionDefault[];

            /** FeatureSetDefaults minimumEdition. */
            public minimumEdition: google.protobuf.Edition;

            /** FeatureSetDefaults maximumEdition. */
            public maximumEdition: google.protobuf.Edition;

            /**
             * Creates a FeatureSetDefaults message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns FeatureSetDefaults
             */
            public static fromObject(object: { [k: string]: any }): google.protobuf.FeatureSetDefaults;

            /**
             * Creates a plain object from a FeatureSetDefaults message. Also converts values to other types if specified.
             * @param message FeatureSetDefaults
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.protobuf.FeatureSetDefaults, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this FeatureSetDefaults to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for FeatureSetDefaults
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        namespace FeatureSetDefaults {

            /** Properties of a FeatureSetEditionDefault. */
            interface IFeatureSetEditionDefault {

                /** FeatureSetEditionDefault edition */
                edition?: (google.protobuf.Edition|null);

                /** FeatureSetEditionDefault features */
                features?: (google.protobuf.IFeatureSet|null);
            }

            /** Represents a FeatureSetEditionDefault. */
            class FeatureSetEditionDefault implements IFeatureSetEditionDefault {

                /**
                 * Constructs a new FeatureSetEditionDefault.
                 * @param [properties] Properties to set
                 */
                constructor(properties?: google.protobuf.FeatureSetDefaults.IFeatureSetEditionDefault);

                /** FeatureSetEditionDefault edition. */
                public edition: google.protobuf.Edition;

                /** FeatureSetEditionDefault features. */
                public features?: (google.protobuf.IFeatureSet|null);

                /**
                 * Creates a FeatureSetEditionDefault message from a plain object. Also converts values to their respective internal types.
                 * @param object Plain object
                 * @returns FeatureSetEditionDefault
                 */
                public static fromObject(object: { [k: string]: any }): google.protobuf.FeatureSetDefaults.FeatureSetEditionDefault;

                /**
                 * Creates a plain object from a FeatureSetEditionDefault message. Also converts values to other types if specified.
                 * @param message FeatureSetEditionDefault
                 * @param [options] Conversion options
                 * @returns Plain object
                 */
                public static toObject(message: google.protobuf.FeatureSetDefaults.FeatureSetEditionDefault, options?: $protobuf.IConversionOptions): { [k: string]: any };

                /**
                 * Converts this FeatureSetEditionDefault to JSON.
                 * @returns JSON object
                 */
                public toJSON(): { [k: string]: any };

                /**
                 * Gets the default type url for FeatureSetEditionDefault
                 * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                 * @returns The default type url
                 */
                public static getTypeUrl(typeUrlPrefix?: string): string;
            }
        }

        /** Properties of a SourceCodeInfo. */
        interface ISourceCodeInfo {

            /** SourceCodeInfo location */
            location?: (google.protobuf.SourceCodeInfo.ILocation[]|null);
        }

        /** Represents a SourceCodeInfo. */
        class SourceCodeInfo implements ISourceCodeInfo {

            /**
             * Constructs a new SourceCodeInfo.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.protobuf.ISourceCodeInfo);

            /** SourceCodeInfo location. */
            public location: google.protobuf.SourceCodeInfo.ILocation[];

            /**
             * Creates a SourceCodeInfo message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns SourceCodeInfo
             */
            public static fromObject(object: { [k: string]: any }): google.protobuf.SourceCodeInfo;

            /**
             * Creates a plain object from a SourceCodeInfo message. Also converts values to other types if specified.
             * @param message SourceCodeInfo
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.protobuf.SourceCodeInfo, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this SourceCodeInfo to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for SourceCodeInfo
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        namespace SourceCodeInfo {

            /** Properties of a Location. */
            interface ILocation {

                /** Location path */
                path?: (number[]|null);

                /** Location span */
                span?: (number[]|null);

                /** Location leadingComments */
                leadingComments?: (string|null);

                /** Location trailingComments */
                trailingComments?: (string|null);

                /** Location leadingDetachedComments */
                leadingDetachedComments?: (string[]|null);
            }

            /** Represents a Location. */
            class Location implements ILocation {

                /**
                 * Constructs a new Location.
                 * @param [properties] Properties to set
                 */
                constructor(properties?: google.protobuf.SourceCodeInfo.ILocation);

                /** Location path. */
                public path: number[];

                /** Location span. */
                public span: number[];

                /** Location leadingComments. */
                public leadingComments: string;

                /** Location trailingComments. */
                public trailingComments: string;

                /** Location leadingDetachedComments. */
                public leadingDetachedComments: string[];

                /**
                 * Creates a Location message from a plain object. Also converts values to their respective internal types.
                 * @param object Plain object
                 * @returns Location
                 */
                public static fromObject(object: { [k: string]: any }): google.protobuf.SourceCodeInfo.Location;

                /**
                 * Creates a plain object from a Location message. Also converts values to other types if specified.
                 * @param message Location
                 * @param [options] Conversion options
                 * @returns Plain object
                 */
                public static toObject(message: google.protobuf.SourceCodeInfo.Location, options?: $protobuf.IConversionOptions): { [k: string]: any };

                /**
                 * Converts this Location to JSON.
                 * @returns JSON object
                 */
                public toJSON(): { [k: string]: any };

                /**
                 * Gets the default type url for Location
                 * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                 * @returns The default type url
                 */
                public static getTypeUrl(typeUrlPrefix?: string): string;
            }
        }

        /** Properties of a GeneratedCodeInfo. */
        interface IGeneratedCodeInfo {

            /** GeneratedCodeInfo annotation */
            annotation?: (google.protobuf.GeneratedCodeInfo.IAnnotation[]|null);
        }

        /** Represents a GeneratedCodeInfo. */
        class GeneratedCodeInfo implements IGeneratedCodeInfo {

            /**
             * Constructs a new GeneratedCodeInfo.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.protobuf.IGeneratedCodeInfo);

            /** GeneratedCodeInfo annotation. */
            public annotation: google.protobuf.GeneratedCodeInfo.IAnnotation[];

            /**
             * Creates a GeneratedCodeInfo message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns GeneratedCodeInfo
             */
            public static fromObject(object: { [k: string]: any }): google.protobuf.GeneratedCodeInfo;

            /**
             * Creates a plain object from a GeneratedCodeInfo message. Also converts values to other types if specified.
             * @param message GeneratedCodeInfo
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.protobuf.GeneratedCodeInfo, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this GeneratedCodeInfo to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for GeneratedCodeInfo
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        namespace GeneratedCodeInfo {

            /** Properties of an Annotation. */
            interface IAnnotation {

                /** Annotation path */
                path?: (number[]|null);

                /** Annotation sourceFile */
                sourceFile?: (string|null);

                /** Annotation begin */
                begin?: (number|null);

                /** Annotation end */
                end?: (number|null);

                /** Annotation semantic */
                semantic?: (google.protobuf.GeneratedCodeInfo.Annotation.Semantic|null);
            }

            /** Represents an Annotation. */
            class Annotation implements IAnnotation {

                /**
                 * Constructs a new Annotation.
                 * @param [properties] Properties to set
                 */
                constructor(properties?: google.protobuf.GeneratedCodeInfo.IAnnotation);

                /** Annotation path. */
                public path: number[];

                /** Annotation sourceFile. */
                public sourceFile: string;

                /** Annotation begin. */
                public begin: number;

                /** Annotation end. */
                public end: number;

                /** Annotation semantic. */
                public semantic: google.protobuf.GeneratedCodeInfo.Annotation.Semantic;

                /**
                 * Creates an Annotation message from a plain object. Also converts values to their respective internal types.
                 * @param object Plain object
                 * @returns Annotation
                 */
                public static fromObject(object: { [k: string]: any }): google.protobuf.GeneratedCodeInfo.Annotation;

                /**
                 * Creates a plain object from an Annotation message. Also converts values to other types if specified.
                 * @param message Annotation
                 * @param [options] Conversion options
                 * @returns Plain object
                 */
                public static toObject(message: google.protobuf.GeneratedCodeInfo.Annotation, options?: $protobuf.IConversionOptions): { [k: string]: any };

                /**
                 * Converts this Annotation to JSON.
                 * @returns JSON object
                 */
                public toJSON(): { [k: string]: any };

                /**
                 * Gets the default type url for Annotation
                 * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                 * @returns The default type url
                 */
                public static getTypeUrl(typeUrlPrefix?: string): string;
            }

            namespace Annotation {

                /** Semantic enum. */
                type Semantic =
                    "NONE"| "SET"| "ALIAS";
            }
        }

        /** Properties of a Timestamp. */
        interface ITimestamp {

            /** Timestamp seconds */
            seconds?: (number|string|null);

            /** Timestamp nanos */
            nanos?: (number|null);
        }

        /** Represents a Timestamp. */
        class Timestamp implements ITimestamp {

            /**
             * Constructs a new Timestamp.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.protobuf.ITimestamp);

            /** Timestamp seconds. */
            public seconds: (number|string);

            /** Timestamp nanos. */
            public nanos: number;

            /**
             * Creates a Timestamp message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns Timestamp
             */
            public static fromObject(object: { [k: string]: any }): google.protobuf.Timestamp;

            /**
             * Creates a plain object from a Timestamp message. Also converts values to other types if specified.
             * @param message Timestamp
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.protobuf.Timestamp, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this Timestamp to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for Timestamp
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of a Duration. */
        interface IDuration {

            /** Duration seconds */
            seconds?: (number|string|null);

            /** Duration nanos */
            nanos?: (number|null);
        }

        /** Represents a Duration. */
        class Duration implements IDuration {

            /**
             * Constructs a new Duration.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.protobuf.IDuration);

            /** Duration seconds. */
            public seconds: (number|string);

            /** Duration nanos. */
            public nanos: number;

            /**
             * Creates a Duration message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns Duration
             */
            public static fromObject(object: { [k: string]: any }): google.protobuf.Duration;

            /**
             * Creates a plain object from a Duration message. Also converts values to other types if specified.
             * @param message Duration
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.protobuf.Duration, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this Duration to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for Duration
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of an Any. */
        interface IAny {

            /** Any type_url */
            type_url?: (string|null);

            /** Any value */
            value?: (Uint8Array|null);
        }

        /** Represents an Any. */
        class Any implements IAny {

            /**
             * Constructs a new Any.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.protobuf.IAny);

            /** Any type_url. */
            public type_url: string;

            /** Any value. */
            public value: Uint8Array;

            /**
             * Creates an Any message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns Any
             */
            public static fromObject(object: { [k: string]: any }): google.protobuf.Any;

            /**
             * Creates a plain object from an Any message. Also converts values to other types if specified.
             * @param message Any
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.protobuf.Any, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this Any to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for Any
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of an Empty. */
        interface IEmpty {
        }

        /** Represents an Empty. */
        class Empty implements IEmpty {

            /**
             * Constructs a new Empty.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.protobuf.IEmpty);

            /**
             * Creates an Empty message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns Empty
             */
            public static fromObject(object: { [k: string]: any }): google.protobuf.Empty;

            /**
             * Creates a plain object from an Empty message. Also converts values to other types if specified.
             * @param message Empty
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.protobuf.Empty, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this Empty to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for Empty
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of a FieldMask. */
        interface IFieldMask {

            /** FieldMask paths */
            paths?: (string[]|null);
        }

        /** Represents a FieldMask. */
        class FieldMask implements IFieldMask {

            /**
             * Constructs a new FieldMask.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.protobuf.IFieldMask);

            /** FieldMask paths. */
            public paths: string[];

            /**
             * Creates a FieldMask message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns FieldMask
             */
            public static fromObject(object: { [k: string]: any }): google.protobuf.FieldMask;

            /**
             * Creates a plain object from a FieldMask message. Also converts values to other types if specified.
             * @param message FieldMask
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.protobuf.FieldMask, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this FieldMask to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for FieldMask
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of a Struct. */
        interface IStruct {

            /** Struct fields */
            fields?: ({ [k: string]: google.protobuf.IValue }|null);
        }

        /** Represents a Struct. */
        class Struct implements IStruct {

            /**
             * Constructs a new Struct.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.protobuf.IStruct);

            /** Struct fields. */
            public fields: { [k: string]: google.protobuf.IValue };

            /**
             * Creates a Struct message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns Struct
             */
            public static fromObject(object: { [k: string]: any }): google.protobuf.Struct;

            /**
             * Creates a plain object from a Struct message. Also converts values to other types if specified.
             * @param message Struct
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.protobuf.Struct, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this Struct to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for Struct
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of a Value. */
        interface IValue {

            /** Value nullValue */
            nullValue?: (google.protobuf.NullValue|null);

            /** Value numberValue */
            numberValue?: (number|null);

            /** Value stringValue */
            stringValue?: (string|null);

            /** Value boolValue */
            boolValue?: (boolean|null);

            /** Value structValue */
            structValue?: (google.protobuf.IStruct|null);

            /** Value listValue */
            listValue?: (google.protobuf.IListValue|null);
        }

        /** Represents a Value. */
        class Value implements IValue {

            /**
             * Constructs a new Value.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.protobuf.IValue);

            /** Value nullValue. */
            public nullValue?: (google.protobuf.NullValue|null);

            /** Value numberValue. */
            public numberValue?: (number|null);

            /** Value stringValue. */
            public stringValue?: (string|null);

            /** Value boolValue. */
            public boolValue?: (boolean|null);

            /** Value structValue. */
            public structValue?: (google.protobuf.IStruct|null);

            /** Value listValue. */
            public listValue?: (google.protobuf.IListValue|null);

            /** Value kind. */
            public kind?: ("nullValue"|"numberValue"|"stringValue"|"boolValue"|"structValue"|"listValue");

            /**
             * Creates a Value message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns Value
             */
            public static fromObject(object: { [k: string]: any }): google.protobuf.Value;

            /**
             * Creates a plain object from a Value message. Also converts values to other types if specified.
             * @param message Value
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.protobuf.Value, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this Value to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for Value
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** NullValue enum. */
        type NullValue =
            "NULL_VALUE";

        /** Properties of a ListValue. */
        interface IListValue {

            /** ListValue values */
            values?: (google.protobuf.IValue[]|null);
        }

        /** Represents a ListValue. */
        class ListValue implements IListValue {

            /**
             * Constructs a new ListValue.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.protobuf.IListValue);

            /** ListValue values. */
            public values: google.protobuf.IValue[];

            /**
             * Creates a ListValue message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns ListValue
             */
            public static fromObject(object: { [k: string]: any }): google.protobuf.ListValue;

            /**
             * Creates a plain object from a ListValue message. Also converts values to other types if specified.
             * @param message ListValue
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.protobuf.ListValue, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this ListValue to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for ListValue
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of a DoubleValue. */
        interface IDoubleValue {

            /** DoubleValue value */
            value?: (number|null);
        }

        /** Represents a DoubleValue. */
        class DoubleValue implements IDoubleValue {

            /**
             * Constructs a new DoubleValue.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.protobuf.IDoubleValue);

            /** DoubleValue value. */
            public value: number;

            /**
             * Creates a DoubleValue message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns DoubleValue
             */
            public static fromObject(object: { [k: string]: any }): google.protobuf.DoubleValue;

            /**
             * Creates a plain object from a DoubleValue message. Also converts values to other types if specified.
             * @param message DoubleValue
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.protobuf.DoubleValue, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this DoubleValue to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for DoubleValue
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of a FloatValue. */
        interface IFloatValue {

            /** FloatValue value */
            value?: (number|null);
        }

        /** Represents a FloatValue. */
        class FloatValue implements IFloatValue {

            /**
             * Constructs a new FloatValue.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.protobuf.IFloatValue);

            /** FloatValue value. */
            public value: number;

            /**
             * Creates a FloatValue message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns FloatValue
             */
            public static fromObject(object: { [k: string]: any }): google.protobuf.FloatValue;

            /**
             * Creates a plain object from a FloatValue message. Also converts values to other types if specified.
             * @param message FloatValue
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.protobuf.FloatValue, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this FloatValue to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for FloatValue
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of an Int64Value. */
        interface IInt64Value {

            /** Int64Value value */
            value?: (number|string|null);
        }

        /** Represents an Int64Value. */
        class Int64Value implements IInt64Value {

            /**
             * Constructs a new Int64Value.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.protobuf.IInt64Value);

            /** Int64Value value. */
            public value: (number|string);

            /**
             * Creates an Int64Value message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns Int64Value
             */
            public static fromObject(object: { [k: string]: any }): google.protobuf.Int64Value;

            /**
             * Creates a plain object from an Int64Value message. Also converts values to other types if specified.
             * @param message Int64Value
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.protobuf.Int64Value, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this Int64Value to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for Int64Value
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of a UInt64Value. */
        interface IUInt64Value {

            /** UInt64Value value */
            value?: (number|string|null);
        }

        /** Represents a UInt64Value. */
        class UInt64Value implements IUInt64Value {

            /**
             * Constructs a new UInt64Value.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.protobuf.IUInt64Value);

            /** UInt64Value value. */
            public value: (number|string);

            /**
             * Creates a UInt64Value message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns UInt64Value
             */
            public static fromObject(object: { [k: string]: any }): google.protobuf.UInt64Value;

            /**
             * Creates a plain object from a UInt64Value message. Also converts values to other types if specified.
             * @param message UInt64Value
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.protobuf.UInt64Value, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this UInt64Value to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for UInt64Value
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of an Int32Value. */
        interface IInt32Value {

            /** Int32Value value */
            value?: (number|null);
        }

        /** Represents an Int32Value. */
        class Int32Value implements IInt32Value {

            /**
             * Constructs a new Int32Value.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.protobuf.IInt32Value);

            /** Int32Value value. */
            public value: number;

            /**
             * Creates an Int32Value message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns Int32Value
             */
            public static fromObject(object: { [k: string]: any }): google.protobuf.Int32Value;

            /**
             * Creates a plain object from an Int32Value message. Also converts values to other types if specified.
             * @param message Int32Value
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.protobuf.Int32Value, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this Int32Value to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for Int32Value
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of a UInt32Value. */
        interface IUInt32Value {

            /** UInt32Value value */
            value?: (number|null);
        }

        /** Represents a UInt32Value. */
        class UInt32Value implements IUInt32Value {

            /**
             * Constructs a new UInt32Value.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.protobuf.IUInt32Value);

            /** UInt32Value value. */
            public value: number;

            /**
             * Creates a UInt32Value message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns UInt32Value
             */
            public static fromObject(object: { [k: string]: any }): google.protobuf.UInt32Value;

            /**
             * Creates a plain object from a UInt32Value message. Also converts values to other types if specified.
             * @param message UInt32Value
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.protobuf.UInt32Value, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this UInt32Value to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for UInt32Value
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of a BoolValue. */
        interface IBoolValue {

            /** BoolValue value */
            value?: (boolean|null);
        }

        /** Represents a BoolValue. */
        class BoolValue implements IBoolValue {

            /**
             * Constructs a new BoolValue.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.protobuf.IBoolValue);

            /** BoolValue value. */
            public value: boolean;

            /**
             * Creates a BoolValue message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns BoolValue
             */
            public static fromObject(object: { [k: string]: any }): google.protobuf.BoolValue;

            /**
             * Creates a plain object from a BoolValue message. Also converts values to other types if specified.
             * @param message BoolValue
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.protobuf.BoolValue, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this BoolValue to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for BoolValue
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of a StringValue. */
        interface IStringValue {

            /** StringValue value */
            value?: (string|null);
        }

        /** Represents a StringValue. */
        class StringValue implements IStringValue {

            /**
             * Constructs a new StringValue.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.protobuf.IStringValue);

            /** StringValue value. */
            public value: string;

            /**
             * Creates a StringValue message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns StringValue
             */
            public static fromObject(object: { [k: string]: any }): google.protobuf.StringValue;

            /**
             * Creates a plain object from a StringValue message. Also converts values to other types if specified.
             * @param message StringValue
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.protobuf.StringValue, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this StringValue to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for StringValue
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of a BytesValue. */
        interface IBytesValue {

            /** BytesValue value */
            value?: (Uint8Array|null);
        }

        /** Represents a BytesValue. */
        class BytesValue implements IBytesValue {

            /**
             * Constructs a new BytesValue.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.protobuf.IBytesValue);

            /** BytesValue value. */
            public value: Uint8Array;

            /**
             * Creates a BytesValue message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns BytesValue
             */
            public static fromObject(object: { [k: string]: any }): google.protobuf.BytesValue;

            /**
             * Creates a plain object from a BytesValue message. Also converts values to other types if specified.
             * @param message BytesValue
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.protobuf.BytesValue, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this BytesValue to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for BytesValue
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }
    }

    /** Namespace type. */
    namespace type {

        /** DayOfWeek enum. */
        type DayOfWeek =
            "DAY_OF_WEEK_UNSPECIFIED"| "MONDAY"| "TUESDAY"| "WEDNESDAY"| "THURSDAY"| "FRIDAY"| "SATURDAY"| "SUNDAY";

        /** Properties of a LatLng. */
        interface ILatLng {

            /** LatLng latitude */
            latitude?: (number|null);

            /** LatLng longitude */
            longitude?: (number|null);
        }

        /** Represents a LatLng. */
        class LatLng implements ILatLng {

            /**
             * Constructs a new LatLng.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.type.ILatLng);

            /** LatLng latitude. */
            public latitude: number;

            /** LatLng longitude. */
            public longitude: number;

            /**
             * Creates a LatLng message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns LatLng
             */
            public static fromObject(object: { [k: string]: any }): google.type.LatLng;

            /**
             * Creates a plain object from a LatLng message. Also converts values to other types if specified.
             * @param message LatLng
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.type.LatLng, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this LatLng to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for LatLng
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }
    }

    /** Namespace longrunning. */
    namespace longrunning {

        /** Represents an Operations */
        class Operations extends $protobuf.rpc.Service {

            /**
             * Constructs a new Operations service.
             * @param rpcImpl RPC implementation
             * @param [requestDelimited=false] Whether requests are length-delimited
             * @param [responseDelimited=false] Whether responses are length-delimited
             */
            constructor(rpcImpl: $protobuf.RPCImpl, requestDelimited?: boolean, responseDelimited?: boolean);

            /**
             * Calls ListOperations.
             * @param request ListOperationsRequest message or plain object
             * @param callback Node-style callback called with the error, if any, and ListOperationsResponse
             */
            public listOperations(request: google.longrunning.IListOperationsRequest, callback: google.longrunning.Operations.ListOperationsCallback): void;

            /**
             * Calls ListOperations.
             * @param request ListOperationsRequest message or plain object
             * @returns Promise
             */
            public listOperations(request: google.longrunning.IListOperationsRequest): Promise<google.longrunning.ListOperationsResponse>;

            /**
             * Calls GetOperation.
             * @param request GetOperationRequest message or plain object
             * @param callback Node-style callback called with the error, if any, and Operation
             */
            public getOperation(request: google.longrunning.IGetOperationRequest, callback: google.longrunning.Operations.GetOperationCallback): void;

            /**
             * Calls GetOperation.
             * @param request GetOperationRequest message or plain object
             * @returns Promise
             */
            public getOperation(request: google.longrunning.IGetOperationRequest): Promise<google.longrunning.Operation>;

            /**
             * Calls DeleteOperation.
             * @param request DeleteOperationRequest message or plain object
             * @param callback Node-style callback called with the error, if any, and Empty
             */
            public deleteOperation(request: google.longrunning.IDeleteOperationRequest, callback: google.longrunning.Operations.DeleteOperationCallback): void;

            /**
             * Calls DeleteOperation.
             * @param request DeleteOperationRequest message or plain object
             * @returns Promise
             */
            public deleteOperation(request: google.longrunning.IDeleteOperationRequest): Promise<google.protobuf.Empty>;

            /**
             * Calls CancelOperation.
             * @param request CancelOperationRequest message or plain object
             * @param callback Node-style callback called with the error, if any, and Empty
             */
            public cancelOperation(request: google.longrunning.ICancelOperationRequest, callback: google.longrunning.Operations.CancelOperationCallback): void;

            /**
             * Calls CancelOperation.
             * @param request CancelOperationRequest message or plain object
             * @returns Promise
             */
            public cancelOperation(request: google.longrunning.ICancelOperationRequest): Promise<google.protobuf.Empty>;

            /**
             * Calls WaitOperation.
             * @param request WaitOperationRequest message or plain object
             * @param callback Node-style callback called with the error, if any, and Operation
             */
            public waitOperation(request: google.longrunning.IWaitOperationRequest, callback: google.longrunning.Operations.WaitOperationCallback): void;

            /**
             * Calls WaitOperation.
             * @param request WaitOperationRequest message or plain object
             * @returns Promise
             */
            public waitOperation(request: google.longrunning.IWaitOperationRequest): Promise<google.longrunning.Operation>;
        }

        namespace Operations {

            /**
             * Callback as used by {@link google.longrunning.Operations#listOperations}.
             * @param error Error, if any
             * @param [response] ListOperationsResponse
             */
            type ListOperationsCallback = (error: (Error|null), response?: google.longrunning.ListOperationsResponse) => void;

            /**
             * Callback as used by {@link google.longrunning.Operations#getOperation}.
             * @param error Error, if any
             * @param [response] Operation
             */
            type GetOperationCallback = (error: (Error|null), response?: google.longrunning.Operation) => void;

            /**
             * Callback as used by {@link google.longrunning.Operations#deleteOperation}.
             * @param error Error, if any
             * @param [response] Empty
             */
            type DeleteOperationCallback = (error: (Error|null), response?: google.protobuf.Empty) => void;

            /**
             * Callback as used by {@link google.longrunning.Operations#cancelOperation}.
             * @param error Error, if any
             * @param [response] Empty
             */
            type CancelOperationCallback = (error: (Error|null), response?: google.protobuf.Empty) => void;

            /**
             * Callback as used by {@link google.longrunning.Operations#waitOperation}.
             * @param error Error, if any
             * @param [response] Operation
             */
            type WaitOperationCallback = (error: (Error|null), response?: google.longrunning.Operation) => void;
        }

        /** Properties of an Operation. */
        interface IOperation {

            /** Operation name */
            name?: (string|null);

            /** Operation metadata */
            metadata?: (google.protobuf.IAny|null);

            /** Operation done */
            done?: (boolean|null);

            /** Operation error */
            error?: (google.rpc.IStatus|null);

            /** Operation response */
            response?: (google.protobuf.IAny|null);
        }

        /** Represents an Operation. */
        class Operation implements IOperation {

            /**
             * Constructs a new Operation.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.longrunning.IOperation);

            /** Operation name. */
            public name: string;

            /** Operation metadata. */
            public metadata?: (google.protobuf.IAny|null);

            /** Operation done. */
            public done: boolean;

            /** Operation error. */
            public error?: (google.rpc.IStatus|null);

            /** Operation response. */
            public response?: (google.protobuf.IAny|null);

            /** Operation result. */
            public result?: ("error"|"response");

            /**
             * Creates an Operation message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns Operation
             */
            public static fromObject(object: { [k: string]: any }): google.longrunning.Operation;

            /**
             * Creates a plain object from an Operation message. Also converts values to other types if specified.
             * @param message Operation
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.longrunning.Operation, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this Operation to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for Operation
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of a GetOperationRequest. */
        interface IGetOperationRequest {

            /** GetOperationRequest name */
            name?: (string|null);
        }

        /** Represents a GetOperationRequest. */
        class GetOperationRequest implements IGetOperationRequest {

            /**
             * Constructs a new GetOperationRequest.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.longrunning.IGetOperationRequest);

            /** GetOperationRequest name. */
            public name: string;

            /**
             * Creates a GetOperationRequest message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns GetOperationRequest
             */
            public static fromObject(object: { [k: string]: any }): google.longrunning.GetOperationRequest;

            /**
             * Creates a plain object from a GetOperationRequest message. Also converts values to other types if specified.
             * @param message GetOperationRequest
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.longrunning.GetOperationRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this GetOperationRequest to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for GetOperationRequest
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of a ListOperationsRequest. */
        interface IListOperationsRequest {

            /** ListOperationsRequest name */
            name?: (string|null);

            /** ListOperationsRequest filter */
            filter?: (string|null);

            /** ListOperationsRequest pageSize */
            pageSize?: (number|null);

            /** ListOperationsRequest pageToken */
            pageToken?: (string|null);
        }

        /** Represents a ListOperationsRequest. */
        class ListOperationsRequest implements IListOperationsRequest {

            /**
             * Constructs a new ListOperationsRequest.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.longrunning.IListOperationsRequest);

            /** ListOperationsRequest name. */
            public name: string;

            /** ListOperationsRequest filter. */
            public filter: string;

            /** ListOperationsRequest pageSize. */
            public pageSize: number;

            /** ListOperationsRequest pageToken. */
            public pageToken: string;

            /**
             * Creates a ListOperationsRequest message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns ListOperationsRequest
             */
            public static fromObject(object: { [k: string]: any }): google.longrunning.ListOperationsRequest;

            /**
             * Creates a plain object from a ListOperationsRequest message. Also converts values to other types if specified.
             * @param message ListOperationsRequest
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.longrunning.ListOperationsRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this ListOperationsRequest to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for ListOperationsRequest
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of a ListOperationsResponse. */
        interface IListOperationsResponse {

            /** ListOperationsResponse operations */
            operations?: (google.longrunning.IOperation[]|null);

            /** ListOperationsResponse nextPageToken */
            nextPageToken?: (string|null);
        }

        /** Represents a ListOperationsResponse. */
        class ListOperationsResponse implements IListOperationsResponse {

            /**
             * Constructs a new ListOperationsResponse.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.longrunning.IListOperationsResponse);

            /** ListOperationsResponse operations. */
            public operations: google.longrunning.IOperation[];

            /** ListOperationsResponse nextPageToken. */
            public nextPageToken: string;

            /**
             * Creates a ListOperationsResponse message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns ListOperationsResponse
             */
            public static fromObject(object: { [k: string]: any }): google.longrunning.ListOperationsResponse;

            /**
             * Creates a plain object from a ListOperationsResponse message. Also converts values to other types if specified.
             * @param message ListOperationsResponse
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.longrunning.ListOperationsResponse, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this ListOperationsResponse to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for ListOperationsResponse
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of a CancelOperationRequest. */
        interface ICancelOperationRequest {

            /** CancelOperationRequest name */
            name?: (string|null);
        }

        /** Represents a CancelOperationRequest. */
        class CancelOperationRequest implements ICancelOperationRequest {

            /**
             * Constructs a new CancelOperationRequest.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.longrunning.ICancelOperationRequest);

            /** CancelOperationRequest name. */
            public name: string;

            /**
             * Creates a CancelOperationRequest message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns CancelOperationRequest
             */
            public static fromObject(object: { [k: string]: any }): google.longrunning.CancelOperationRequest;

            /**
             * Creates a plain object from a CancelOperationRequest message. Also converts values to other types if specified.
             * @param message CancelOperationRequest
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.longrunning.CancelOperationRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this CancelOperationRequest to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for CancelOperationRequest
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of a DeleteOperationRequest. */
        interface IDeleteOperationRequest {

            /** DeleteOperationRequest name */
            name?: (string|null);
        }

        /** Represents a DeleteOperationRequest. */
        class DeleteOperationRequest implements IDeleteOperationRequest {

            /**
             * Constructs a new DeleteOperationRequest.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.longrunning.IDeleteOperationRequest);

            /** DeleteOperationRequest name. */
            public name: string;

            /**
             * Creates a DeleteOperationRequest message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns DeleteOperationRequest
             */
            public static fromObject(object: { [k: string]: any }): google.longrunning.DeleteOperationRequest;

            /**
             * Creates a plain object from a DeleteOperationRequest message. Also converts values to other types if specified.
             * @param message DeleteOperationRequest
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.longrunning.DeleteOperationRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this DeleteOperationRequest to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for DeleteOperationRequest
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of a WaitOperationRequest. */
        interface IWaitOperationRequest {

            /** WaitOperationRequest name */
            name?: (string|null);

            /** WaitOperationRequest timeout */
            timeout?: (google.protobuf.IDuration|null);
        }

        /** Represents a WaitOperationRequest. */
        class WaitOperationRequest implements IWaitOperationRequest {

            /**
             * Constructs a new WaitOperationRequest.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.longrunning.IWaitOperationRequest);

            /** WaitOperationRequest name. */
            public name: string;

            /** WaitOperationRequest timeout. */
            public timeout?: (google.protobuf.IDuration|null);

            /**
             * Creates a WaitOperationRequest message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns WaitOperationRequest
             */
            public static fromObject(object: { [k: string]: any }): google.longrunning.WaitOperationRequest;

            /**
             * Creates a plain object from a WaitOperationRequest message. Also converts values to other types if specified.
             * @param message WaitOperationRequest
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.longrunning.WaitOperationRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this WaitOperationRequest to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for WaitOperationRequest
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of an OperationInfo. */
        interface IOperationInfo {

            /** OperationInfo responseType */
            responseType?: (string|null);

            /** OperationInfo metadataType */
            metadataType?: (string|null);
        }

        /** Represents an OperationInfo. */
        class OperationInfo implements IOperationInfo {

            /**
             * Constructs a new OperationInfo.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.longrunning.IOperationInfo);

            /** OperationInfo responseType. */
            public responseType: string;

            /** OperationInfo metadataType. */
            public metadataType: string;

            /**
             * Creates an OperationInfo message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns OperationInfo
             */
            public static fromObject(object: { [k: string]: any }): google.longrunning.OperationInfo;

            /**
             * Creates a plain object from an OperationInfo message. Also converts values to other types if specified.
             * @param message OperationInfo
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.longrunning.OperationInfo, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this OperationInfo to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for OperationInfo
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }
    }

    /** Namespace rpc. */
    namespace rpc {

        /** Properties of a Status. */
        interface IStatus {

            /** Status code */
            code?: (number|null);

            /** Status message */
            message?: (string|null);

            /** Status details */
            details?: (google.protobuf.IAny[]|null);
        }

        /** Represents a Status. */
        class Status implements IStatus {

            /**
             * Constructs a new Status.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.rpc.IStatus);

            /** Status code. */
            public code: number;

            /** Status message. */
            public message: string;

            /** Status details. */
            public details: google.protobuf.IAny[];

            /**
             * Creates a Status message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns Status
             */
            public static fromObject(object: { [k: string]: any }): google.rpc.Status;

            /**
             * Creates a plain object from a Status message. Also converts values to other types if specified.
             * @param message Status
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.rpc.Status, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this Status to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for Status
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }
    }
}
