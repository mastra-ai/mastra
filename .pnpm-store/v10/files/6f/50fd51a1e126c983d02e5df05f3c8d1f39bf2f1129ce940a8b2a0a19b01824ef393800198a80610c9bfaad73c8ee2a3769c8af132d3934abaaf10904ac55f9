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

import "google/api/resource.proto";
import "google/firestore/admin/v1/index.proto";
import "google/protobuf/timestamp.proto";

option csharp_namespace = "Google.Cloud.Firestore.Admin.V1";
option go_package = "cloud.google.com/go/firestore/apiv1/admin/adminpb;adminpb";
option java_multiple_files = true;
option java_outer_classname = "OperationProto";
option java_package = "com.google.firestore.admin.v1";
option objc_class_prefix = "GCFS";
option php_namespace = "Google\\Cloud\\Firestore\\Admin\\V1";
option ruby_package = "Google::Cloud::Firestore::Admin::V1";

// Metadata for [google.longrunning.Operation][google.longrunning.Operation]
// results from
// [FirestoreAdmin.CreateIndex][google.firestore.admin.v1.FirestoreAdmin.CreateIndex].
message IndexOperationMetadata {
  // The time this operation started.
  google.protobuf.Timestamp start_time = 1;

  // The time this operation completed. Will be unset if operation still in
  // progress.
  google.protobuf.Timestamp end_time = 2;

  // The index resource that this operation is acting on. For example:
  // `projects/{project_id}/databases/{database_id}/collectionGroups/{collection_id}/indexes/{index_id}`
  string index = 3;

  // The state of the operation.
  OperationState state = 4;

  // The progress, in documents, of this operation.
  Progress progress_documents = 5;

  // The progress, in bytes, of this operation.
  Progress progress_bytes = 6;
}

// Metadata for [google.longrunning.Operation][google.longrunning.Operation]
// results from
// [FirestoreAdmin.UpdateField][google.firestore.admin.v1.FirestoreAdmin.UpdateField].
message FieldOperationMetadata {
  // Information about an index configuration change.
  message IndexConfigDelta {
    // Specifies how the index is changing.
    enum ChangeType {
      // The type of change is not specified or known.
      CHANGE_TYPE_UNSPECIFIED = 0;

      // The single field index is being added.
      ADD = 1;

      // The single field index is being removed.
      REMOVE = 2;
    }

    // Specifies how the index is changing.
    ChangeType change_type = 1;

    // The index being changed.
    Index index = 2;
  }

  // Information about a TTL configuration change.
  message TtlConfigDelta {
    // Specifies how the TTL config is changing.
    enum ChangeType {
      // The type of change is not specified or known.
      CHANGE_TYPE_UNSPECIFIED = 0;

      // The TTL config is being added.
      ADD = 1;

      // The TTL config is being removed.
      REMOVE = 2;
    }

    // Specifies how the TTL configuration is changing.
    ChangeType change_type = 1;
  }

  // The time this operation started.
  google.protobuf.Timestamp start_time = 1;

  // The time this operation completed. Will be unset if operation still in
  // progress.
  google.protobuf.Timestamp end_time = 2;

  // The field resource that this operation is acting on. For example:
  // `projects/{project_id}/databases/{database_id}/collectionGroups/{collection_id}/fields/{field_path}`
  string field = 3;

  // A list of
  // [IndexConfigDelta][google.firestore.admin.v1.FieldOperationMetadata.IndexConfigDelta],
  // which describe the intent of this operation.
  repeated IndexConfigDelta index_config_deltas = 4;

  // The state of the operation.
  OperationState state = 5;

  // The progress, in documents, of this operation.
  Progress progress_documents = 6;

  // The progress, in bytes, of this operation.
  Progress progress_bytes = 7;

  // Describes the deltas of TTL configuration.
  TtlConfigDelta ttl_config_delta = 8;
}

// Metadata for [google.longrunning.Operation][google.longrunning.Operation]
// results from
// [FirestoreAdmin.ExportDocuments][google.firestore.admin.v1.FirestoreAdmin.ExportDocuments].
message ExportDocumentsMetadata {
  // The time this operation started.
  google.protobuf.Timestamp start_time = 1;

  // The time this operation completed. Will be unset if operation still in
  // progress.
  google.protobuf.Timestamp end_time = 2;

  // The state of the export operation.
  OperationState operation_state = 3;

  // The progress, in documents, of this operation.
  Progress progress_documents = 4;

  // The progress, in bytes, of this operation.
  Progress progress_bytes = 5;

  // Which collection IDs are being exported.
  repeated string collection_ids = 6;

  // Where the documents are being exported to.
  string output_uri_prefix = 7;

  // Which namespace IDs are being exported.
  repeated string namespace_ids = 8;

  // The timestamp that corresponds to the version of the database that is being
  // exported. If unspecified, there are no guarantees about the consistency of
  // the documents being exported.
  google.protobuf.Timestamp snapshot_time = 9;
}

// Metadata for [google.longrunning.Operation][google.longrunning.Operation]
// results from
// [FirestoreAdmin.ImportDocuments][google.firestore.admin.v1.FirestoreAdmin.ImportDocuments].
message ImportDocumentsMetadata {
  // The time this operation started.
  google.protobuf.Timestamp start_time = 1;

  // The time this operation completed. Will be unset if operation still in
  // progress.
  google.protobuf.Timestamp end_time = 2;

  // The state of the import operation.
  OperationState operation_state = 3;

  // The progress, in documents, of this operation.
  Progress progress_documents = 4;

  // The progress, in bytes, of this operation.
  Progress progress_bytes = 5;

  // Which collection IDs are being imported.
  repeated string collection_ids = 6;

  // The location of the documents being imported.
  string input_uri_prefix = 7;

  // Which namespace IDs are being imported.
  repeated string namespace_ids = 8;
}

// Metadata for [google.longrunning.Operation][google.longrunning.Operation]
// results from
// [FirestoreAdmin.BulkDeleteDocuments][google.firestore.admin.v1.FirestoreAdmin.BulkDeleteDocuments].
message BulkDeleteDocumentsMetadata {
  // The time this operation started.
  google.protobuf.Timestamp start_time = 1;

  // The time this operation completed. Will be unset if operation still in
  // progress.
  google.protobuf.Timestamp end_time = 2;

  // The state of the operation.
  OperationState operation_state = 3;

  // The progress, in documents, of this operation.
  Progress progress_documents = 4;

  // The progress, in bytes, of this operation.
  Progress progress_bytes = 5;

  // The IDs of the collection groups that are being deleted.
  repeated string collection_ids = 6;

  // Which namespace IDs are being deleted.
  repeated string namespace_ids = 7;

  // The timestamp that corresponds to the version of the database that is being
  // read to get the list of documents to delete. This time can also be used as
  // the timestamp of PITR in case of disaster recovery (subject to PITR window
  // limit).
  google.protobuf.Timestamp snapshot_time = 8;
}

// Returned in the [google.longrunning.Operation][google.longrunning.Operation]
// response field.
message ExportDocumentsResponse {
  // Location of the output files. This can be used to begin an import
  // into Cloud Firestore (this project or another project) after the operation
  // completes successfully.
  string output_uri_prefix = 1;
}

// Metadata for the [long-running operation][google.longrunning.Operation] from
// the [RestoreDatabase][google.firestore.admin.v1.RestoreDatabase] request.
message RestoreDatabaseMetadata {
  // The time the restore was started.
  google.protobuf.Timestamp start_time = 1;

  // The time the restore finished, unset for ongoing restores.
  google.protobuf.Timestamp end_time = 2;

  // The operation state of the restore.
  OperationState operation_state = 3;

  // The name of the database being restored to.
  string database = 4 [(google.api.resource_reference) = {
    type: "firestore.googleapis.com/Database"
  }];

  // The name of the backup restoring from.
  string backup = 5 [(google.api.resource_reference) = {
    type: "firestore.googleapis.com/Backup"
  }];

  // How far along the restore is as an estimated percentage of remaining time.
  Progress progress_percentage = 8;
}

// Describes the progress of the operation.
// Unit of work is generic and must be interpreted based on where
// [Progress][google.firestore.admin.v1.Progress] is used.
message Progress {
  // The amount of work estimated.
  int64 estimated_work = 1;

  // The amount of work completed.
  int64 completed_work = 2;
}

// Describes the state of the operation.
enum OperationState {
  // Unspecified.
  OPERATION_STATE_UNSPECIFIED = 0;

  // Request is being prepared for processing.
  INITIALIZING = 1;

  // Request is actively being processed.
  PROCESSING = 2;

  // Request is in the process of being cancelled after user called
  // google.longrunning.Operations.CancelOperation on the operation.
  CANCELLING = 3;

  // Request has been processed and is in its finalization stage.
  FINALIZING = 4;

  // Request has completed successfully.
  SUCCESSFUL = 5;

  // Request has finished being processed, but encountered an error.
  FAILED = 6;

  // Request has finished being cancelled after user called
  // google.longrunning.Operations.CancelOperation.
  CANCELLED = 7;
}
