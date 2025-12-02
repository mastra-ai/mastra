// Copyright 2024 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

syntax = "proto3";

package google.firestore.admin.v1;

import "google/api/field_behavior.proto";
import "google/api/resource.proto";
import "google/protobuf/duration.proto";
import "google/protobuf/timestamp.proto";

option csharp_namespace = "Google.Cloud.Firestore.Admin.V1";
option go_package = "cloud.google.com/go/firestore/apiv1/admin/adminpb;adminpb";
option java_multiple_files = true;
option java_outer_classname = "DatabaseProto";
option java_package = "com.google.firestore.admin.v1";
option objc_class_prefix = "GCFS";
option php_namespace = "Google\\Cloud\\Firestore\\Admin\\V1";
option ruby_package = "Google::Cloud::Firestore::Admin::V1";
option (google.api.resource_definition) = {
  type: "firestore.googleapis.com/Operation"
  pattern: "projects/{project}/databases/{database}/operations/{operation}"
};

// A Cloud Firestore Database.
message Database {
  option (google.api.resource) = {
    type: "firestore.googleapis.com/Database"
    pattern: "projects/{project}/databases/{database}"
    style: DECLARATIVE_FRIENDLY
  };

  // The type of the database.
  // See https://cloud.google.com/datastore/docs/firestore-or-datastore for
  // information about how to choose.
  //
  // Mode changes are only allowed if the database is empty.
  enum DatabaseType {
    // Not used.
    DATABASE_TYPE_UNSPECIFIED = 0;

    // Firestore Native Mode
    FIRESTORE_NATIVE = 1;

    // Firestore in Datastore Mode.
    DATASTORE_MODE = 2;
  }

  // The type of concurrency control mode for transactions.
  enum ConcurrencyMode {
    // Not used.
    CONCURRENCY_MODE_UNSPECIFIED = 0;

    // Use optimistic concurrency control by default. This mode is available
    // for Cloud Firestore databases.
    OPTIMISTIC = 1;

    // Use pessimistic concurrency control by default. This mode is available
    // for Cloud Firestore databases.
    //
    // This is the default setting for Cloud Firestore.
    PESSIMISTIC = 2;

    // Use optimistic concurrency control with entity groups by default.
    //
    // This is the only available mode for Cloud Datastore.
    //
    // This mode is also available for Cloud Firestore with Datastore Mode but
    // is not recommended.
    OPTIMISTIC_WITH_ENTITY_GROUPS = 3;
  }

  // Point In Time Recovery feature enablement.
  enum PointInTimeRecoveryEnablement {
    // Not used.
    POINT_IN_TIME_RECOVERY_ENABLEMENT_UNSPECIFIED = 0;

    // Reads are supported on selected versions of the data from within the past
    // 7 days:
    //
    // * Reads against any timestamp within the past hour
    // * Reads against 1-minute snapshots beyond 1 hour and within 7 days
    //
    // `version_retention_period` and `earliest_version_time` can be
    // used to determine the supported versions.
    POINT_IN_TIME_RECOVERY_ENABLED = 1;

    // Reads are supported on any version of the data from within the past 1
    // hour.
    POINT_IN_TIME_RECOVERY_DISABLED = 2;
  }

  // The type of App Engine integration mode.
  enum AppEngineIntegrationMode {
    // Not used.
    APP_ENGINE_INTEGRATION_MODE_UNSPECIFIED = 0;

    // If an App Engine application exists in the same region as this database,
    // App Engine configuration will impact this database. This includes
    // disabling of the application & database, as well as disabling writes to
    // the database.
    ENABLED = 1;

    // App Engine has no effect on the ability of this database to serve
    // requests.
    //
    // This is the default setting for databases created with the Firestore API.
    DISABLED = 2;
  }

  // The delete protection state of the database.
  enum DeleteProtectionState {
    // The default value. Delete protection type is not specified
    DELETE_PROTECTION_STATE_UNSPECIFIED = 0;

    // Delete protection is disabled
    DELETE_PROTECTION_DISABLED = 1;

    // Delete protection is enabled
    DELETE_PROTECTION_ENABLED = 2;
  }

  // The CMEK (Customer Managed Encryption Key) configuration for a Firestore
  // database. If not present, the database is secured by the default Google
  // encryption key.
  message CmekConfig {
    // Required. Only keys in the same location as this database are allowed to
    // be used for encryption.
    //
    // For Firestore's nam5 multi-region, this corresponds to Cloud KMS
    // multi-region us. For Firestore's eur3 multi-region, this corresponds to
    // Cloud KMS multi-region europe. See
    // https://cloud.google.com/kms/docs/locations.
    //
    // The expected format is
    // `projects/{project_id}/locations/{kms_location}/keyRings/{key_ring}/cryptoKeys/{crypto_key}`.
    string kms_key_name = 1 [(google.api.field_behavior) = REQUIRED];

    // Output only. Currently in-use [KMS key
    // versions](https://cloud.google.com/kms/docs/resource-hierarchy#key_versions).
    // During [key rotation](https://cloud.google.com/kms/docs/key-rotation),
    // there can be multiple in-use key versions.
    //
    // The expected format is
    // `projects/{project_id}/locations/{kms_location}/keyRings/{key_ring}/cryptoKeys/{crypto_key}/cryptoKeyVersions/{key_version}`.
    repeated string active_key_version = 2
        [(google.api.field_behavior) = OUTPUT_ONLY];
  }

  // Information about the provenance of this database.
  message SourceInfo {
    // Information about a backup that was used to restore a database.
    message BackupSource {
      // The resource name of the backup that was used to restore this
      // database. Format:
      // `projects/{project}/locations/{location}/backups/{backup}`.
      string backup = 1 [(google.api.resource_reference) = {
        type: "firestore.googleapis.com/Backup"
      }];
    }

    // The source from which this database is derived.
    oneof source {
      // If set, this database was restored from the specified backup (or a
      // snapshot thereof).
      BackupSource backup = 1;
    }

    // The associated long-running operation. This field may not be set after
    // the operation has completed. Format:
    // `projects/{project}/databases/{database}/operations/{operation}`.
    string operation = 3 [(google.api.resource_reference) = {
      type: "firestore.googleapis.com/Operation"
    }];
  }

  // Encryption configuration for a new database being created from another
  // source.
  //
  // The source could be a [Backup][google.firestore.admin.v1.Backup] .
  message EncryptionConfig {
    // The configuration options for using Google default encryption.
    message GoogleDefaultEncryptionOptions {}

    // The configuration options for using the same encryption method as the
    // source.
    message SourceEncryptionOptions {}

    // The configuration options for using CMEK (Customer Managed Encryption
    // Key) encryption.
    message CustomerManagedEncryptionOptions {
      // Required. Only keys in the same location as the database are allowed to
      // be used for encryption.
      //
      // For Firestore's nam5 multi-region, this corresponds to Cloud KMS
      // multi-region us. For Firestore's eur3 multi-region, this corresponds to
      // Cloud KMS multi-region europe. See
      // https://cloud.google.com/kms/docs/locations.
      //
      // The expected format is
      // `projects/{project_id}/locations/{kms_location}/keyRings/{key_ring}/cryptoKeys/{crypto_key}`.
      string kms_key_name = 1 [(google.api.field_behavior) = REQUIRED];
    }

    // The method for encrypting the database.
    oneof encryption_type {
      // Use Google default encryption.
      GoogleDefaultEncryptionOptions google_default_encryption = 1;

      // The database will use the same encryption configuration as the source.
      SourceEncryptionOptions use_source_encryption = 2;

      // Use Customer Managed Encryption Keys (CMEK) for encryption.
      CustomerManagedEncryptionOptions customer_managed_encryption = 3;
    }
  }

  // The resource name of the Database.
  // Format: `projects/{project}/databases/{database}`
  string name = 1;

  // Output only. The system-generated UUID4 for this Database.
  string uid = 3 [(google.api.field_behavior) = OUTPUT_ONLY];

  // Output only. The timestamp at which this database was created. Databases
  // created before 2016 do not populate create_time.
  google.protobuf.Timestamp create_time = 5
      [(google.api.field_behavior) = OUTPUT_ONLY];

  // Output only. The timestamp at which this database was most recently
  // updated. Note this only includes updates to the database resource and not
  // data contained by the database.
  google.protobuf.Timestamp update_time = 6
      [(google.api.field_behavior) = OUTPUT_ONLY];

  // Output only. The timestamp at which this database was deleted. Only set if
  // the database has been deleted.
  google.protobuf.Timestamp delete_time = 7
      [(google.api.field_behavior) = OUTPUT_ONLY];

  // The location of the database. Available locations are listed at
  // https://cloud.google.com/firestore/docs/locations.
  string location_id = 9;

  // The type of the database.
  // See https://cloud.google.com/datastore/docs/firestore-or-datastore for
  // information about how to choose.
  DatabaseType type = 10;

  // The concurrency control mode to use for this database.
  ConcurrencyMode concurrency_mode = 15;

  // Output only. The period during which past versions of data are retained in
  // the database.
  //
  // Any [read][google.firestore.v1.GetDocumentRequest.read_time]
  // or [query][google.firestore.v1.ListDocumentsRequest.read_time] can specify
  // a `read_time` within this window, and will read the state of the database
  // at that time.
  //
  // If the PITR feature is enabled, the retention period is 7 days. Otherwise,
  // the retention period is 1 hour.
  google.protobuf.Duration version_retention_period = 17
      [(google.api.field_behavior) = OUTPUT_ONLY];

  // Output only. The earliest timestamp at which older versions of the data can
  // be read from the database. See [version_retention_period] above; this field
  // is populated with `now - version_retention_period`.
  //
  // This value is continuously updated, and becomes stale the moment it is
  // queried. If you are using this value to recover data, make sure to account
  // for the time from the moment when the value is queried to the moment when
  // you initiate the recovery.
  google.protobuf.Timestamp earliest_version_time = 18
      [(google.api.field_behavior) = OUTPUT_ONLY];

  // Whether to enable the PITR feature on this database.
  PointInTimeRecoveryEnablement point_in_time_recovery_enablement = 21;

  // The App Engine integration mode to use for this database.
  AppEngineIntegrationMode app_engine_integration_mode = 19;

  // Output only. The key_prefix for this database. This key_prefix is used, in
  // combination with the project ID ("<key prefix>~<project id>") to construct
  // the application ID that is returned from the Cloud Datastore APIs in Google
  // App Engine first generation runtimes.
  //
  // This value may be empty in which case the appid to use for URL-encoded keys
  // is the project_id (eg: foo instead of v~foo).
  string key_prefix = 20 [(google.api.field_behavior) = OUTPUT_ONLY];

  // State of delete protection for the database.
  DeleteProtectionState delete_protection_state = 22;

  // Optional. Presence indicates CMEK is enabled for this database.
  CmekConfig cmek_config = 23 [(google.api.field_behavior) = OPTIONAL];

  // Output only. The database resource's prior database ID. This field is only
  // populated for deleted databases.
  string previous_id = 25 [(google.api.field_behavior) = OUTPUT_ONLY];

  // Output only. Information about the provenance of this database.
  SourceInfo source_info = 26 [(google.api.field_behavior) = OUTPUT_ONLY];

  // This checksum is computed by the server based on the value of other
  // fields, and may be sent on update and delete requests to ensure the
  // client has an up-to-date value before proceeding.
  string etag = 99;
}
