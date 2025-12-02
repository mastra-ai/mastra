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

package google.firestore.v1beta1;

import "google/protobuf/timestamp.proto";

option csharp_namespace = "Google.Cloud.Firestore.V1Beta1";
option go_package = "cloud.google.com/go/firestore/apiv1beta1/firestorepb;firestorepb";
option java_multiple_files = true;
option java_outer_classname = "UndeliverableFirstGenEventProto";
option java_package = "com.google.firestore.v1beta1";
option php_namespace = "Google\\Cloud\\Firestore\\V1beta1";
option ruby_package = "Google::Cloud::Firestore::V1beta1";

// A message signifying an event that cannot be delivered to Cloud Functions
// from Firestore using [Cloud Firestore triggers 1st
// gen](https://cloud.google.com/functions/docs/calling/cloud-firestore)
message UndeliverableFirstGenEvent {
  // Reason for events being undeliverable.
  enum Reason {
    // Unspecified.
    REASON_UNSPECIFIED = 0;

    // Exceeding maximum event size limit
    EXCEEDING_SIZE_LIMIT = 1;
  }

  // Document change type.
  enum DocumentChangeType {
    // Unspecified.
    DOCUMENT_CHANGE_TYPE_UNSPECIFIED = 0;

    // Represent creation operation.
    CREATE = 1;

    // Represent delete operation.
    DELETE = 2;

    // Represent update operation.
    UPDATE = 3;
  }

  // Error message for events being undeliverable.
  string message = 1;

  // Reason for events being undeliverable.
  Reason reason = 2;

  // The resource name of the changed document, in the format of
  // `projects/{projectId}/databases/{databaseId}/documents/{document_path}`.
  string document_name = 3;

  // The type of the document change.
  DocumentChangeType document_change_type = 4;

  // The names of the functions that were supposed to be triggered.
  repeated string function_name = 5;

  // The commit time of triggered write operation.
  google.protobuf.Timestamp triggered_time = 6;
}
