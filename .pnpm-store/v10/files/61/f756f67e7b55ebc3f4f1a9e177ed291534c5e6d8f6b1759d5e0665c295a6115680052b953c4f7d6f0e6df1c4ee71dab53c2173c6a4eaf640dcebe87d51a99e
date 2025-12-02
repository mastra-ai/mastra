// Copyright 2020 Google LLC.
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
//

// This file defines the format of Firestore bundle file/stream. It is not a part of the
// Firestore API, only a specification used by Server and Client SDK to write and read
// bundles.

syntax = "proto3";

package firestore;

import "google/firestore/v1/document.proto";
import "google/firestore/v1/query.proto";
import "google/protobuf/timestamp.proto";

option csharp_namespace = "Firestore.Proto";
option go_package = "google.golang.org/genproto/firestore/proto;firestore";
option java_multiple_files = true;
option java_outer_classname = "BundleProto";
option java_package = "com.google.firestore.proto";
option objc_class_prefix = "FSTPB";
option php_namespace = "Firestore\\Proto";

// Encodes a query saved in the bundle.
message BundledQuery {
  // The parent resource name.
  string parent = 1;

  // The query to run.
  oneof query_type {
    // A structured query.
    google.firestore.v1.StructuredQuery structured_query = 2;
  }

  // If the query is a limit query, should the limit be applied to the beginning or
  // the end of results.
  enum LimitType {
    FIRST = 0;
    LAST = 1;
  }
  LimitType limit_type = 3;
}

// A Query associated with a name, created as part of the bundle file, and can be read
// by client SDKs once the bundle containing them is loaded.
message NamedQuery {
  // Name of the query, such that client can use the name to load this query
  // from bundle, and resume from when the query results are materialized
  // into this bundle.
  string name = 1;

  // The query saved in the bundle.
  BundledQuery bundled_query = 2;

  // The read time of the query, when it is used to build the bundle. This is useful to
  // resume the query from the bundle, once it is loaded by client SDKs.
  google.protobuf.Timestamp read_time = 3;
}

// Metadata describing a Firestore document saved in the bundle.
message BundledDocumentMetadata {
  // The document key of a bundled document.
  string name = 1;

  // The snapshot version of the document data bundled.
  google.protobuf.Timestamp read_time = 2;

  // Whether the document exists.
  bool exists = 3;

  // The names of the queries in this bundle that this document matches to.
  repeated string queries = 4;
}

// Metadata describing the bundle file/stream.
message BundleMetadata {
  // The ID of the bundle.
  string id = 1;

  // Time at which the documents snapshot is taken for this bundle.
  google.protobuf.Timestamp create_time = 2;

  // The schema version of the bundle.
  uint32 version = 3;

  // The number of documents in the bundle.
  uint32 total_documents = 4;

  // The size of the bundle in bytes, excluding this `BundleMetadata`.
  uint64 total_bytes = 5;
}

// A Firestore bundle is a length-prefixed stream of JSON representations of 
// `BundleElement`.
// Only one `BundleMetadata` is expected, and it should be the first element.
// The named queries follow after `metadata`. Every `document_metadata` is
// immediately followed by a `document`.
message BundleElement {
  oneof element_type {
    BundleMetadata metadata = 1;

    NamedQuery named_query = 2;

    BundledDocumentMetadata document_metadata = 3;

    google.firestore.v1.Document document = 4;
  }
}
