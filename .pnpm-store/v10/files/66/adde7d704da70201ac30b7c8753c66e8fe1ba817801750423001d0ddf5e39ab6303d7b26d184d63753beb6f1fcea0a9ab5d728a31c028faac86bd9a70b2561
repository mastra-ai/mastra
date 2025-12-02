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

import "google/firestore/v1/document.proto";

option csharp_namespace = "Google.Cloud.Firestore.V1";
option go_package = "cloud.google.com/go/firestore/apiv1/firestorepb;firestorepb";
option java_multiple_files = true;
option java_outer_classname = "AggregationResultProto";
option java_package = "com.google.firestore.v1";
option objc_class_prefix = "GCFS";
option php_namespace = "Google\\Cloud\\Firestore\\V1";
option ruby_package = "Google::Cloud::Firestore::V1";

// The result of a single bucket from a Firestore aggregation query.
//
// The keys of `aggregate_fields` are the same for all results in an aggregation
// query, unlike document queries which can have different fields present for
// each result.
message AggregationResult {
  // The result of the aggregation functions, ex: `COUNT(*) AS total_docs`.
  //
  // The key is the
  // [alias][google.firestore.v1.StructuredAggregationQuery.Aggregation.alias]
  // assigned to the aggregation function on input and the size of this map
  // equals the number of aggregation functions in the query.
  map<string, Value> aggregate_fields = 2;
}
