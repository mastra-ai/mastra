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
import "google/protobuf/timestamp.proto";

option csharp_namespace = "Google.Cloud.Firestore.Admin.V1";
option go_package = "cloud.google.com/go/firestore/apiv1/admin/adminpb;adminpb";
option java_multiple_files = true;
option java_outer_classname = "BackupProto";
option java_package = "com.google.firestore.admin.v1";
option objc_class_prefix = "GCFS";
option php_namespace = "Google\\Cloud\\Firestore\\Admin\\V1";
option ruby_package = "Google::Cloud::Firestore::Admin::V1";

// A Backup of a Cloud Firestore Database.
//
// The backup contains all documents and index configurations for the given
// database at a specific point in time.
message Backup {
  option (google.api.resource) = {
    type: "firestore.googleapis.com/Backup"
    pattern: "projects/{project}/locations/{location}/backups/{backup}"
  };

  // Backup specific statistics.
  message Stats {
    // Output only. Summation of the size of all documents and index entries in
    // the backup, measured in bytes.
    int64 size_bytes = 1 [(google.api.field_behavior) = OUTPUT_ONLY];

    // Output only. The total number of documents contained in the backup.
    int64 document_count = 2 [(google.api.field_behavior) = OUTPUT_ONLY];

    // Output only. The total number of index entries contained in the backup.
    int64 index_count = 3 [(google.api.field_behavior) = OUTPUT_ONLY];
  }

  // Indicate the current state of the backup.
  enum State {
    // The state is unspecified.
    STATE_UNSPECIFIED = 0;

    // The pending backup is still being created. Operations on the
    // backup will be rejected in this state.
    CREATING = 1;

    // The backup is complete and ready to use.
    READY = 2;

    // The backup is not available at this moment.
    NOT_AVAILABLE = 3;
  }

  // Output only. The unique resource name of the Backup.
  //
  // Format is `projects/{project}/locations/{location}/backups/{backup}`.
  string name = 1 [(google.api.field_behavior) = OUTPUT_ONLY];

  // Output only. Name of the Firestore database that the backup is from.
  //
  // Format is `projects/{project}/databases/{database}`.
  string database = 2 [
    (google.api.field_behavior) = OUTPUT_ONLY,
    (google.api.resource_reference) = {
      type: "firestore.googleapis.com/Database"
    }
  ];

  // Output only. The system-generated UUID4 for the Firestore database that the
  // backup is from.
  string database_uid = 7 [(google.api.field_behavior) = OUTPUT_ONLY];

  // Output only. The backup contains an externally consistent copy of the
  // database at this time.
  google.protobuf.Timestamp snapshot_time = 3
      [(google.api.field_behavior) = OUTPUT_ONLY];

  // Output only. The timestamp at which this backup expires.
  google.protobuf.Timestamp expire_time = 4
      [(google.api.field_behavior) = OUTPUT_ONLY];

  // Output only. Statistics about the backup.
  //
  // This data only becomes available after the backup is fully materialized to
  // secondary storage. This field will be empty till then.
  Stats stats = 6 [(google.api.field_behavior) = OUTPUT_ONLY];

  // Output only. The current state of the backup.
  State state = 8 [(google.api.field_behavior) = OUTPUT_ONLY];
}
