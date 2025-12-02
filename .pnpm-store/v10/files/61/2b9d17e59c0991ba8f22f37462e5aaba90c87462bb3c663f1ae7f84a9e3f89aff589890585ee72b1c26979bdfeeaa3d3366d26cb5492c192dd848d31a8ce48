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
import "google/firestore/admin/v1/index.proto";

option csharp_namespace = "Google.Cloud.Firestore.Admin.V1";
option go_package = "cloud.google.com/go/firestore/apiv1/admin/adminpb;adminpb";
option java_multiple_files = true;
option java_outer_classname = "FieldProto";
option java_package = "com.google.firestore.admin.v1";
option objc_class_prefix = "GCFS";
option php_namespace = "Google\\Cloud\\Firestore\\Admin\\V1";
option ruby_package = "Google::Cloud::Firestore::Admin::V1";

// Represents a single field in the database.
//
// Fields are grouped by their "Collection Group", which represent all
// collections in the database with the same ID.
message Field {
  option (google.api.resource) = {
    type: "firestore.googleapis.com/Field"
    pattern: "projects/{project}/databases/{database}/collectionGroups/{collection}/fields/{field}"
  };

  // The index configuration for this field.
  message IndexConfig {
    // The indexes supported for this field.
    repeated Index indexes = 1;

    // Output only. When true, the `Field`'s index configuration is set from the
    // configuration specified by the `ancestor_field`.
    // When false, the `Field`'s index configuration is defined explicitly.
    bool uses_ancestor_config = 2;

    // Output only. Specifies the resource name of the `Field` from which this
    // field's index configuration is set (when `uses_ancestor_config` is true),
    // or from which it *would* be set if this field had no index configuration
    // (when `uses_ancestor_config` is false).
    string ancestor_field = 3;

    // Output only
    // When true, the `Field`'s index configuration is in the process of being
    // reverted. Once complete, the index config will transition to the same
    // state as the field specified by `ancestor_field`, at which point
    // `uses_ancestor_config` will be `true` and `reverting` will be `false`.
    bool reverting = 4;
  }

  // The TTL (time-to-live) configuration for documents that have this `Field`
  // set.
  //
  // Storing a timestamp value into a TTL-enabled field will be treated as
  // the document's absolute expiration time. Timestamp values in the past
  // indicate that the document is eligible for immediate expiration. Using any
  // other data type or leaving the field absent will disable expiration for the
  // individual document.
  message TtlConfig {
    // The state of applying the TTL configuration to all documents.
    enum State {
      // The state is unspecified or unknown.
      STATE_UNSPECIFIED = 0;

      // The TTL is being applied. There is an active long-running operation to
      // track the change. Newly written documents will have TTLs applied as
      // requested. Requested TTLs on existing documents are still being
      // processed. When TTLs on all existing documents have been processed, the
      // state will move to 'ACTIVE'.
      CREATING = 1;

      // The TTL is active for all documents.
      ACTIVE = 2;

      // The TTL configuration could not be enabled for all existing documents.
      // Newly written documents will continue to have their TTL applied.
      // The LRO returned when last attempting to enable TTL for this `Field`
      // has failed, and may have more details.
      NEEDS_REPAIR = 3;
    }

    // Output only. The state of the TTL configuration.
    State state = 1 [(google.api.field_behavior) = OUTPUT_ONLY];
  }

  // Required. A field name of the form:
  // `projects/{project_id}/databases/{database_id}/collectionGroups/{collection_id}/fields/{field_path}`
  //
  // A field path can be a simple field name, e.g. `address` or a path to fields
  // within `map_value` , e.g. `address.city`,
  // or a special field path. The only valid special field is `*`, which
  // represents any field.
  //
  // Field paths can be quoted using `` ` `` (backtick). The only character that
  // must be escaped within a quoted field path is the backtick character
  // itself, escaped using a backslash. Special characters in field paths that
  // must be quoted include: `*`, `.`,
  // `` ` `` (backtick), `[`, `]`, as well as any ascii symbolic characters.
  //
  // Examples:
  // `` `address.city` `` represents a field named `address.city`, not the map
  // key `city` in the field `address`. `` `*` `` represents a field named `*`,
  // not any field.
  //
  // A special `Field` contains the default indexing settings for all fields.
  // This field's resource name is:
  // `projects/{project_id}/databases/{database_id}/collectionGroups/__default__/fields/*`
  // Indexes defined on this `Field` will be applied to all fields which do not
  // have their own `Field` index configuration.
  string name = 1 [(google.api.field_behavior) = REQUIRED];

  // The index configuration for this field. If unset, field indexing will
  // revert to the configuration defined by the `ancestor_field`. To
  // explicitly remove all indexes for this field, specify an index config
  // with an empty list of indexes.
  IndexConfig index_config = 2;

  // The TTL configuration for this `Field`.
  // Setting or unsetting this will enable or disable the TTL for
  // documents that have this `Field`.
  TtlConfig ttl_config = 3;
}
