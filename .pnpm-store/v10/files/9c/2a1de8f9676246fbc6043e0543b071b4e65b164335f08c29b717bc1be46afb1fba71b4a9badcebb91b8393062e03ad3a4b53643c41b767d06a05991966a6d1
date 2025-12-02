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

package google.firestore.v1;

import "google/api/field_behavior.proto";
import "google/protobuf/duration.proto";
import "google/protobuf/struct.proto";

option csharp_namespace = "Google.Cloud.Firestore.V1";
option go_package = "cloud.google.com/go/firestore/apiv1/firestorepb;firestorepb";
option java_multiple_files = true;
option java_outer_classname = "QueryProfileProto";
option java_package = "com.google.firestore.v1";
option objc_class_prefix = "GCFS";
option php_namespace = "Google\\Cloud\\Firestore\\V1";
option ruby_package = "Google::Cloud::Firestore::V1";

// Specification of the Firestore Query Profile fields.

// Explain options for the query.
message ExplainOptions {
  // Optional. Whether to execute this query.
  //
  // When false (the default), the query will be planned, returning only
  // metrics from the planning stages.
  //
  // When true, the query will be planned and executed, returning the full
  // query results along with both planning and execution stage metrics.
  bool analyze = 1 [(google.api.field_behavior) = OPTIONAL];
}

// Explain metrics for the query.
message ExplainMetrics {
  // Planning phase information for the query.
  PlanSummary plan_summary = 1;

  // Aggregated stats from the execution of the query. Only present when
  // [ExplainOptions.analyze][google.firestore.v1.ExplainOptions.analyze] is set
  // to true.
  ExecutionStats execution_stats = 2;
}

// Planning phase information for the query.
message PlanSummary {
  // The indexes selected for the query. For example:
  //  [
  //    {"query_scope": "Collection", "properties": "(foo ASC, __name__ ASC)"},
  //    {"query_scope": "Collection", "properties": "(bar ASC, __name__ ASC)"}
  //  ]
  repeated google.protobuf.Struct indexes_used = 1;
}

// Execution statistics for the query.
message ExecutionStats {
  // Total number of results returned, including documents, projections,
  // aggregation results, keys.
  int64 results_returned = 1;

  // Total time to execute the query in the backend.
  google.protobuf.Duration execution_duration = 3;

  // Total billable read operations.
  int64 read_operations = 4;

  // Debugging statistics from the execution of the query. Note that the
  // debugging stats are subject to change as Firestore evolves. It could
  // include:
  //  {
  //    "indexes_entries_scanned": "1000",
  //    "documents_scanned": "20",
  //    "billing_details" : {
  //       "documents_billable": "20",
  //       "index_entries_billable": "1000",
  //       "min_query_cost": "0"
  //    }
  //  }
  google.protobuf.Struct debug_stats = 5;
}
