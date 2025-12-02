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

import "google/api/annotations.proto";
import "google/api/client.proto";
import "google/api/field_behavior.proto";
import "google/firestore/v1/aggregation_result.proto";
import "google/firestore/v1/common.proto";
import "google/firestore/v1/document.proto";
import "google/firestore/v1/query.proto";
import "google/firestore/v1/query_profile.proto";
import "google/firestore/v1/write.proto";
import "google/protobuf/empty.proto";
import "google/protobuf/timestamp.proto";
import "google/protobuf/wrappers.proto";
import "google/rpc/status.proto";

option csharp_namespace = "Google.Cloud.Firestore.V1";
option go_package = "cloud.google.com/go/firestore/apiv1/firestorepb;firestorepb";
option java_multiple_files = true;
option java_outer_classname = "FirestoreProto";
option java_package = "com.google.firestore.v1";
option php_namespace = "Google\\Cloud\\Firestore\\V1";
option ruby_package = "Google::Cloud::Firestore::V1";

// Specification of the Firestore API.

// The Cloud Firestore service.
//
// Cloud Firestore is a fast, fully managed, serverless, cloud-native NoSQL
// document database that simplifies storing, syncing, and querying data for
// your mobile, web, and IoT apps at global scale. Its client libraries provide
// live synchronization and offline support, while its security features and
// integrations with Firebase and Google Cloud Platform accelerate building
// truly serverless apps.
service Firestore {
  option (google.api.default_host) = "firestore.googleapis.com";
  option (google.api.oauth_scopes) =
      "https://www.googleapis.com/auth/cloud-platform,"
      "https://www.googleapis.com/auth/datastore";

  // Gets a single document.
  rpc GetDocument(GetDocumentRequest) returns (Document) {
    option (google.api.http) = {
      get: "/v1/{name=projects/*/databases/*/documents/*/**}"
    };
  }

  // Lists documents.
  rpc ListDocuments(ListDocumentsRequest) returns (ListDocumentsResponse) {
    option (google.api.http) = {
      get: "/v1/{parent=projects/*/databases/*/documents/*/**}/{collection_id}"
      additional_bindings {
        get: "/v1/{parent=projects/*/databases/*/documents}/{collection_id}"
      }
    };
  }

  // Updates or inserts a document.
  rpc UpdateDocument(UpdateDocumentRequest) returns (Document) {
    option (google.api.http) = {
      patch: "/v1/{document.name=projects/*/databases/*/documents/*/**}"
      body: "document"
    };
    option (google.api.method_signature) = "document,update_mask";
  }

  // Deletes a document.
  rpc DeleteDocument(DeleteDocumentRequest) returns (google.protobuf.Empty) {
    option (google.api.http) = {
      delete: "/v1/{name=projects/*/databases/*/documents/*/**}"
    };
    option (google.api.method_signature) = "name";
  }

  // Gets multiple documents.
  //
  // Documents returned by this method are not guaranteed to be returned in the
  // same order that they were requested.
  rpc BatchGetDocuments(BatchGetDocumentsRequest)
      returns (stream BatchGetDocumentsResponse) {
    option (google.api.http) = {
      post: "/v1/{database=projects/*/databases/*}/documents:batchGet"
      body: "*"
    };
  }

  // Starts a new transaction.
  rpc BeginTransaction(BeginTransactionRequest)
      returns (BeginTransactionResponse) {
    option (google.api.http) = {
      post: "/v1/{database=projects/*/databases/*}/documents:beginTransaction"
      body: "*"
    };
    option (google.api.method_signature) = "database";
  }

  // Commits a transaction, while optionally updating documents.
  rpc Commit(CommitRequest) returns (CommitResponse) {
    option (google.api.http) = {
      post: "/v1/{database=projects/*/databases/*}/documents:commit"
      body: "*"
    };
    option (google.api.method_signature) = "database,writes";
  }

  // Rolls back a transaction.
  rpc Rollback(RollbackRequest) returns (google.protobuf.Empty) {
    option (google.api.http) = {
      post: "/v1/{database=projects/*/databases/*}/documents:rollback"
      body: "*"
    };
    option (google.api.method_signature) = "database,transaction";
  }

  // Runs a query.
  rpc RunQuery(RunQueryRequest) returns (stream RunQueryResponse) {
    option (google.api.http) = {
      post: "/v1/{parent=projects/*/databases/*/documents}:runQuery"
      body: "*"
      additional_bindings {
        post: "/v1/{parent=projects/*/databases/*/documents/*/**}:runQuery"
        body: "*"
      }
    };
  }

  // Runs an aggregation query.
  //
  // Rather than producing [Document][google.firestore.v1.Document] results like
  // [Firestore.RunQuery][google.firestore.v1.Firestore.RunQuery], this API
  // allows running an aggregation to produce a series of
  // [AggregationResult][google.firestore.v1.AggregationResult] server-side.
  //
  // High-Level Example:
  //
  // ```
  // -- Return the number of documents in table given a filter.
  // SELECT COUNT(*) FROM ( SELECT * FROM k where a = true );
  // ```
  rpc RunAggregationQuery(RunAggregationQueryRequest)
      returns (stream RunAggregationQueryResponse) {
    option (google.api.http) = {
      post: "/v1/{parent=projects/*/databases/*/documents}:runAggregationQuery"
      body: "*"
      additional_bindings {
        post: "/v1/{parent=projects/*/databases/*/documents/*/**}:runAggregationQuery"
        body: "*"
      }
    };
  }

  // Partitions a query by returning partition cursors that can be used to run
  // the query in parallel. The returned partition cursors are split points that
  // can be used by RunQuery as starting/end points for the query results.
  rpc PartitionQuery(PartitionQueryRequest) returns (PartitionQueryResponse) {
    option (google.api.http) = {
      post: "/v1/{parent=projects/*/databases/*/documents}:partitionQuery"
      body: "*"
      additional_bindings {
        post: "/v1/{parent=projects/*/databases/*/documents/*/**}:partitionQuery"
        body: "*"
      }
    };
  }

  // Streams batches of document updates and deletes, in order. This method is
  // only available via gRPC or WebChannel (not REST).
  rpc Write(stream WriteRequest) returns (stream WriteResponse) {
    option (google.api.http) = {
      post: "/v1/{database=projects/*/databases/*}/documents:write"
      body: "*"
    };
  }

  // Listens to changes. This method is only available via gRPC or WebChannel
  // (not REST).
  rpc Listen(stream ListenRequest) returns (stream ListenResponse) {
    option (google.api.http) = {
      post: "/v1/{database=projects/*/databases/*}/documents:listen"
      body: "*"
    };
  }

  // Lists all the collection IDs underneath a document.
  rpc ListCollectionIds(ListCollectionIdsRequest)
      returns (ListCollectionIdsResponse) {
    option (google.api.http) = {
      post: "/v1/{parent=projects/*/databases/*/documents}:listCollectionIds"
      body: "*"
      additional_bindings {
        post: "/v1/{parent=projects/*/databases/*/documents/*/**}:listCollectionIds"
        body: "*"
      }
    };
    option (google.api.method_signature) = "parent";
  }

  // Applies a batch of write operations.
  //
  // The BatchWrite method does not apply the write operations atomically
  // and can apply them out of order. Method does not allow more than one write
  // per document. Each write succeeds or fails independently. See the
  // [BatchWriteResponse][google.firestore.v1.BatchWriteResponse] for the
  // success status of each write.
  //
  // If you require an atomically applied set of writes, use
  // [Commit][google.firestore.v1.Firestore.Commit] instead.
  rpc BatchWrite(BatchWriteRequest) returns (BatchWriteResponse) {
    option (google.api.http) = {
      post: "/v1/{database=projects/*/databases/*}/documents:batchWrite"
      body: "*"
    };
  }

  // Creates a new document.
  rpc CreateDocument(CreateDocumentRequest) returns (Document) {
    option (google.api.http) = {
      post: "/v1/{parent=projects/*/databases/*/documents/**}/{collection_id}"
      body: "document"
    };
  }
}

// The request for
// [Firestore.GetDocument][google.firestore.v1.Firestore.GetDocument].
message GetDocumentRequest {
  // Required. The resource name of the Document to get. In the format:
  // `projects/{project_id}/databases/{database_id}/documents/{document_path}`.
  string name = 1 [(google.api.field_behavior) = REQUIRED];

  // The fields to return. If not set, returns all fields.
  //
  // If the document has a field that is not present in this mask, that field
  // will not be returned in the response.
  DocumentMask mask = 2;

  // The consistency mode for this transaction.
  // If not set, defaults to strong consistency.
  oneof consistency_selector {
    // Reads the document in a transaction.
    bytes transaction = 3;

    // Reads the version of the document at the given time.
    //
    // This must be a microsecond precision timestamp within the past one hour,
    // or if Point-in-Time Recovery is enabled, can additionally be a whole
    // minute timestamp within the past 7 days.
    google.protobuf.Timestamp read_time = 5;
  }
}

// The request for
// [Firestore.ListDocuments][google.firestore.v1.Firestore.ListDocuments].
message ListDocumentsRequest {
  // Required. The parent resource name. In the format:
  // `projects/{project_id}/databases/{database_id}/documents` or
  // `projects/{project_id}/databases/{database_id}/documents/{document_path}`.
  //
  // For example:
  // `projects/my-project/databases/my-database/documents` or
  // `projects/my-project/databases/my-database/documents/chatrooms/my-chatroom`
  string parent = 1 [(google.api.field_behavior) = REQUIRED];

  // Optional. The collection ID, relative to `parent`, to list.
  //
  // For example: `chatrooms` or `messages`.
  //
  // This is optional, and when not provided, Firestore will list documents
  // from all collections under the provided `parent`.
  string collection_id = 2 [(google.api.field_behavior) = OPTIONAL];

  // Optional. The maximum number of documents to return in a single response.
  //
  // Firestore may return fewer than this value.
  int32 page_size = 3 [(google.api.field_behavior) = OPTIONAL];

  // Optional. A page token, received from a previous `ListDocuments` response.
  //
  // Provide this to retrieve the subsequent page. When paginating, all other
  // parameters (with the exception of `page_size`) must match the values set
  // in the request that generated the page token.
  string page_token = 4 [(google.api.field_behavior) = OPTIONAL];

  // Optional. The optional ordering of the documents to return.
  //
  // For example: `priority desc, __name__ desc`.
  //
  // This mirrors the [`ORDER BY`][google.firestore.v1.StructuredQuery.order_by]
  // used in Firestore queries but in a string representation. When absent,
  // documents are ordered based on `__name__ ASC`.
  string order_by = 6 [(google.api.field_behavior) = OPTIONAL];

  // Optional. The fields to return. If not set, returns all fields.
  //
  // If a document has a field that is not present in this mask, that field
  // will not be returned in the response.
  DocumentMask mask = 7 [(google.api.field_behavior) = OPTIONAL];

  // The consistency mode for this transaction.
  // If not set, defaults to strong consistency.
  oneof consistency_selector {
    // Perform the read as part of an already active transaction.
    bytes transaction = 8;

    // Perform the read at the provided time.
    //
    // This must be a microsecond precision timestamp within the past one hour,
    // or if Point-in-Time Recovery is enabled, can additionally be a whole
    // minute timestamp within the past 7 days.
    google.protobuf.Timestamp read_time = 10;
  }

  // If the list should show missing documents.
  //
  // A document is missing if it does not exist, but there are sub-documents
  // nested underneath it. When true, such missing documents will be returned
  // with a key but will not have fields,
  // [`create_time`][google.firestore.v1.Document.create_time], or
  // [`update_time`][google.firestore.v1.Document.update_time] set.
  //
  // Requests with `show_missing` may not specify `where` or `order_by`.
  bool show_missing = 12;
}

// The response for
// [Firestore.ListDocuments][google.firestore.v1.Firestore.ListDocuments].
message ListDocumentsResponse {
  // The Documents found.
  repeated Document documents = 1;

  // A token to retrieve the next page of documents.
  //
  // If this field is omitted, there are no subsequent pages.
  string next_page_token = 2;
}

// The request for
// [Firestore.CreateDocument][google.firestore.v1.Firestore.CreateDocument].
message CreateDocumentRequest {
  // Required. The parent resource. For example:
  // `projects/{project_id}/databases/{database_id}/documents` or
  // `projects/{project_id}/databases/{database_id}/documents/chatrooms/{chatroom_id}`
  string parent = 1 [(google.api.field_behavior) = REQUIRED];

  // Required. The collection ID, relative to `parent`, to list. For example:
  // `chatrooms`.
  string collection_id = 2 [(google.api.field_behavior) = REQUIRED];

  // The client-assigned document ID to use for this document.
  //
  // Optional. If not specified, an ID will be assigned by the service.
  string document_id = 3;

  // Required. The document to create. `name` must not be set.
  Document document = 4 [(google.api.field_behavior) = REQUIRED];

  // The fields to return. If not set, returns all fields.
  //
  // If the document has a field that is not present in this mask, that field
  // will not be returned in the response.
  DocumentMask mask = 5;
}

// The request for
// [Firestore.UpdateDocument][google.firestore.v1.Firestore.UpdateDocument].
message UpdateDocumentRequest {
  // Required. The updated document.
  // Creates the document if it does not already exist.
  Document document = 1 [(google.api.field_behavior) = REQUIRED];

  // The fields to update.
  // None of the field paths in the mask may contain a reserved name.
  //
  // If the document exists on the server and has fields not referenced in the
  // mask, they are left unchanged.
  // Fields referenced in the mask, but not present in the input document, are
  // deleted from the document on the server.
  DocumentMask update_mask = 2;

  // The fields to return. If not set, returns all fields.
  //
  // If the document has a field that is not present in this mask, that field
  // will not be returned in the response.
  DocumentMask mask = 3;

  // An optional precondition on the document.
  // The request will fail if this is set and not met by the target document.
  Precondition current_document = 4;
}

// The request for
// [Firestore.DeleteDocument][google.firestore.v1.Firestore.DeleteDocument].
message DeleteDocumentRequest {
  // Required. The resource name of the Document to delete. In the format:
  // `projects/{project_id}/databases/{database_id}/documents/{document_path}`.
  string name = 1 [(google.api.field_behavior) = REQUIRED];

  // An optional precondition on the document.
  // The request will fail if this is set and not met by the target document.
  Precondition current_document = 2;
}

// The request for
// [Firestore.BatchGetDocuments][google.firestore.v1.Firestore.BatchGetDocuments].
message BatchGetDocumentsRequest {
  // Required. The database name. In the format:
  // `projects/{project_id}/databases/{database_id}`.
  string database = 1 [(google.api.field_behavior) = REQUIRED];

  // The names of the documents to retrieve. In the format:
  // `projects/{project_id}/databases/{database_id}/documents/{document_path}`.
  // The request will fail if any of the document is not a child resource of the
  // given `database`. Duplicate names will be elided.
  repeated string documents = 2;

  // The fields to return. If not set, returns all fields.
  //
  // If a document has a field that is not present in this mask, that field will
  // not be returned in the response.
  DocumentMask mask = 3;

  // The consistency mode for this transaction.
  // If not set, defaults to strong consistency.
  oneof consistency_selector {
    // Reads documents in a transaction.
    bytes transaction = 4;

    // Starts a new transaction and reads the documents.
    // Defaults to a read-only transaction.
    // The new transaction ID will be returned as the first response in the
    // stream.
    TransactionOptions new_transaction = 5;

    // Reads documents as they were at the given time.
    //
    // This must be a microsecond precision timestamp within the past one hour,
    // or if Point-in-Time Recovery is enabled, can additionally be a whole
    // minute timestamp within the past 7 days.
    google.protobuf.Timestamp read_time = 7;
  }
}

// The streamed response for
// [Firestore.BatchGetDocuments][google.firestore.v1.Firestore.BatchGetDocuments].
message BatchGetDocumentsResponse {
  // A single result.
  // This can be empty if the server is just returning a transaction.
  oneof result {
    // A document that was requested.
    Document found = 1;

    // A document name that was requested but does not exist. In the format:
    // `projects/{project_id}/databases/{database_id}/documents/{document_path}`.
    string missing = 2;
  }

  // The transaction that was started as part of this request.
  // Will only be set in the first response, and only if
  // [BatchGetDocumentsRequest.new_transaction][google.firestore.v1.BatchGetDocumentsRequest.new_transaction]
  // was set in the request.
  bytes transaction = 3;

  // The time at which the document was read.
  // This may be monotically increasing, in this case the previous documents in
  // the result stream are guaranteed not to have changed between their
  // read_time and this one.
  google.protobuf.Timestamp read_time = 4;
}

// The request for
// [Firestore.BeginTransaction][google.firestore.v1.Firestore.BeginTransaction].
message BeginTransactionRequest {
  // Required. The database name. In the format:
  // `projects/{project_id}/databases/{database_id}`.
  string database = 1 [(google.api.field_behavior) = REQUIRED];

  // The options for the transaction.
  // Defaults to a read-write transaction.
  TransactionOptions options = 2;
}

// The response for
// [Firestore.BeginTransaction][google.firestore.v1.Firestore.BeginTransaction].
message BeginTransactionResponse {
  // The transaction that was started.
  bytes transaction = 1;
}

// The request for [Firestore.Commit][google.firestore.v1.Firestore.Commit].
message CommitRequest {
  // Required. The database name. In the format:
  // `projects/{project_id}/databases/{database_id}`.
  string database = 1 [(google.api.field_behavior) = REQUIRED];

  // The writes to apply.
  //
  // Always executed atomically and in order.
  repeated Write writes = 2;

  // If set, applies all writes in this transaction, and commits it.
  bytes transaction = 3;
}

// The response for [Firestore.Commit][google.firestore.v1.Firestore.Commit].
message CommitResponse {
  // The result of applying the writes.
  //
  // This i-th write result corresponds to the i-th write in the
  // request.
  repeated WriteResult write_results = 1;

  // The time at which the commit occurred. Any read with an equal or greater
  // `read_time` is guaranteed to see the effects of the commit.
  google.protobuf.Timestamp commit_time = 2;
}

// The request for [Firestore.Rollback][google.firestore.v1.Firestore.Rollback].
message RollbackRequest {
  // Required. The database name. In the format:
  // `projects/{project_id}/databases/{database_id}`.
  string database = 1 [(google.api.field_behavior) = REQUIRED];

  // Required. The transaction to roll back.
  bytes transaction = 2 [(google.api.field_behavior) = REQUIRED];
}

// The request for [Firestore.RunQuery][google.firestore.v1.Firestore.RunQuery].
message RunQueryRequest {
  // Required. The parent resource name. In the format:
  // `projects/{project_id}/databases/{database_id}/documents` or
  // `projects/{project_id}/databases/{database_id}/documents/{document_path}`.
  // For example:
  // `projects/my-project/databases/my-database/documents` or
  // `projects/my-project/databases/my-database/documents/chatrooms/my-chatroom`
  string parent = 1 [(google.api.field_behavior) = REQUIRED];

  // The query to run.
  oneof query_type {
    // A structured query.
    StructuredQuery structured_query = 2;
  }

  // The consistency mode for this transaction.
  // If not set, defaults to strong consistency.
  oneof consistency_selector {
    // Run the query within an already active transaction.
    //
    // The value here is the opaque transaction ID to execute the query in.
    bytes transaction = 5;

    // Starts a new transaction and reads the documents.
    // Defaults to a read-only transaction.
    // The new transaction ID will be returned as the first response in the
    // stream.
    TransactionOptions new_transaction = 6;

    // Reads documents as they were at the given time.
    //
    // This must be a microsecond precision timestamp within the past one hour,
    // or if Point-in-Time Recovery is enabled, can additionally be a whole
    // minute timestamp within the past 7 days.
    google.protobuf.Timestamp read_time = 7;
  }

  // Optional. Explain options for the query. If set, additional query
  // statistics will be returned. If not, only query results will be returned.
  ExplainOptions explain_options = 10 [(google.api.field_behavior) = OPTIONAL];
}

// The response for
// [Firestore.RunQuery][google.firestore.v1.Firestore.RunQuery].
message RunQueryResponse {
  // The transaction that was started as part of this request.
  // Can only be set in the first response, and only if
  // [RunQueryRequest.new_transaction][google.firestore.v1.RunQueryRequest.new_transaction]
  // was set in the request. If set, no other fields will be set in this
  // response.
  bytes transaction = 2;

  // A query result, not set when reporting partial progress.
  Document document = 1;

  // The time at which the document was read. This may be monotonically
  // increasing; in this case, the previous documents in the result stream are
  // guaranteed not to have changed between their `read_time` and this one.
  //
  // If the query returns no results, a response with `read_time` and no
  // `document` will be sent, and this represents the time at which the query
  // was run.
  google.protobuf.Timestamp read_time = 3;

  // The number of results that have been skipped due to an offset between
  // the last response and the current response.
  int32 skipped_results = 4;

  // The continuation mode for the query. If present, it indicates the current
  // query response stream has finished. This can be set with or without a
  // `document` present, but when set, no more results are returned.
  oneof continuation_selector {
    // If present, Firestore has completely finished the request and no more
    // documents will be returned.
    bool done = 6;
  }

  // Query explain metrics. This is only present when the
  // [RunQueryRequest.explain_options][google.firestore.v1.RunQueryRequest.explain_options]
  // is provided, and it is sent only once with the last response in the stream.
  ExplainMetrics explain_metrics = 11;
}

// The request for
// [Firestore.RunAggregationQuery][google.firestore.v1.Firestore.RunAggregationQuery].
message RunAggregationQueryRequest {
  // Required. The parent resource name. In the format:
  // `projects/{project_id}/databases/{database_id}/documents` or
  // `projects/{project_id}/databases/{database_id}/documents/{document_path}`.
  // For example:
  // `projects/my-project/databases/my-database/documents` or
  // `projects/my-project/databases/my-database/documents/chatrooms/my-chatroom`
  string parent = 1 [(google.api.field_behavior) = REQUIRED];

  // The query to run.
  oneof query_type {
    // An aggregation query.
    StructuredAggregationQuery structured_aggregation_query = 2;
  }

  // The consistency mode for the query, defaults to strong consistency.
  oneof consistency_selector {
    // Run the aggregation within an already active transaction.
    //
    // The value here is the opaque transaction ID to execute the query in.
    bytes transaction = 4;

    // Starts a new transaction as part of the query, defaulting to read-only.
    //
    // The new transaction ID will be returned as the first response in the
    // stream.
    TransactionOptions new_transaction = 5;

    // Executes the query at the given timestamp.
    //
    // This must be a microsecond precision timestamp within the past one hour,
    // or if Point-in-Time Recovery is enabled, can additionally be a whole
    // minute timestamp within the past 7 days.
    google.protobuf.Timestamp read_time = 6;
  }

  // Optional. Explain options for the query. If set, additional query
  // statistics will be returned. If not, only query results will be returned.
  ExplainOptions explain_options = 8 [(google.api.field_behavior) = OPTIONAL];
}

// The response for
// [Firestore.RunAggregationQuery][google.firestore.v1.Firestore.RunAggregationQuery].
message RunAggregationQueryResponse {
  // A single aggregation result.
  //
  // Not present when reporting partial progress.
  AggregationResult result = 1;

  // The transaction that was started as part of this request.
  //
  // Only present on the first response when the request requested to start
  // a new transaction.
  bytes transaction = 2;

  // The time at which the aggregate result was computed. This is always
  // monotonically increasing; in this case, the previous AggregationResult in
  // the result stream are guaranteed not to have changed between their
  // `read_time` and this one.
  //
  // If the query returns no results, a response with `read_time` and no
  // `result` will be sent, and this represents the time at which the query
  // was run.
  google.protobuf.Timestamp read_time = 3;

  // Query explain metrics. This is only present when the
  // [RunAggregationQueryRequest.explain_options][google.firestore.v1.RunAggregationQueryRequest.explain_options]
  // is provided, and it is sent only once with the last response in the stream.
  ExplainMetrics explain_metrics = 10;
}

// The request for
// [Firestore.PartitionQuery][google.firestore.v1.Firestore.PartitionQuery].
message PartitionQueryRequest {
  // Required. The parent resource name. In the format:
  // `projects/{project_id}/databases/{database_id}/documents`.
  // Document resource names are not supported; only database resource names
  // can be specified.
  string parent = 1 [(google.api.field_behavior) = REQUIRED];

  // The query to partition.
  oneof query_type {
    // A structured query.
    // Query must specify collection with all descendants and be ordered by name
    // ascending. Other filters, order bys, limits, offsets, and start/end
    // cursors are not supported.
    StructuredQuery structured_query = 2;
  }

  // The desired maximum number of partition points.
  // The partitions may be returned across multiple pages of results.
  // The number must be positive. The actual number of partitions
  // returned may be fewer.
  //
  // For example, this may be set to one fewer than the number of parallel
  // queries to be run, or in running a data pipeline job, one fewer than the
  // number of workers or compute instances available.
  int64 partition_count = 3;

  // The `next_page_token` value returned from a previous call to
  // PartitionQuery that may be used to get an additional set of results.
  // There are no ordering guarantees between sets of results. Thus, using
  // multiple sets of results will require merging the different result sets.
  //
  // For example, two subsequent calls using a page_token may return:
  //
  //  * cursor B, cursor M, cursor Q
  //  * cursor A, cursor U, cursor W
  //
  // To obtain a complete result set ordered with respect to the results of the
  // query supplied to PartitionQuery, the results sets should be merged:
  // cursor A, cursor B, cursor M, cursor Q, cursor U, cursor W
  string page_token = 4;

  // The maximum number of partitions to return in this call, subject to
  // `partition_count`.
  //
  // For example, if `partition_count` = 10 and `page_size` = 8, the first call
  // to PartitionQuery will return up to 8 partitions and a `next_page_token`
  // if more results exist. A second call to PartitionQuery will return up to
  // 2 partitions, to complete the total of 10 specified in `partition_count`.
  int32 page_size = 5;

  // The consistency mode for this request.
  // If not set, defaults to strong consistency.
  oneof consistency_selector {
    // Reads documents as they were at the given time.
    //
    // This must be a microsecond precision timestamp within the past one hour,
    // or if Point-in-Time Recovery is enabled, can additionally be a whole
    // minute timestamp within the past 7 days.
    google.protobuf.Timestamp read_time = 6;
  }
}

// The response for
// [Firestore.PartitionQuery][google.firestore.v1.Firestore.PartitionQuery].
message PartitionQueryResponse {
  // Partition results.
  // Each partition is a split point that can be used by RunQuery as a starting
  // or end point for the query results. The RunQuery requests must be made with
  // the same query supplied to this PartitionQuery request. The partition
  // cursors will be ordered according to same ordering as the results of the
  // query supplied to PartitionQuery.
  //
  // For example, if a PartitionQuery request returns partition cursors A and B,
  // running the following three queries will return the entire result set of
  // the original query:
  //
  //  * query, end_at A
  //  * query, start_at A, end_at B
  //  * query, start_at B
  //
  // An empty result may indicate that the query has too few results to be
  // partitioned, or that the query is not yet supported for partitioning.
  repeated Cursor partitions = 1;

  // A page token that may be used to request an additional set of results, up
  // to the number specified by `partition_count` in the PartitionQuery request.
  // If blank, there are no more results.
  string next_page_token = 2;
}

// The request for [Firestore.Write][google.firestore.v1.Firestore.Write].
//
// The first request creates a stream, or resumes an existing one from a token.
//
// When creating a new stream, the server replies with a response containing
// only an ID and a token, to use in the next request.
//
// When resuming a stream, the server first streams any responses later than the
// given token, then a response containing only an up-to-date token, to use in
// the next request.
message WriteRequest {
  // Required. The database name. In the format:
  // `projects/{project_id}/databases/{database_id}`.
  // This is only required in the first message.
  string database = 1 [(google.api.field_behavior) = REQUIRED];

  // The ID of the write stream to resume.
  // This may only be set in the first message. When left empty, a new write
  // stream will be created.
  string stream_id = 2;

  // The writes to apply.
  //
  // Always executed atomically and in order.
  // This must be empty on the first request.
  // This may be empty on the last request.
  // This must not be empty on all other requests.
  repeated Write writes = 3;

  // A stream token that was previously sent by the server.
  //
  // The client should set this field to the token from the most recent
  // [WriteResponse][google.firestore.v1.WriteResponse] it has received. This
  // acknowledges that the client has received responses up to this token. After
  // sending this token, earlier tokens may not be used anymore.
  //
  // The server may close the stream if there are too many unacknowledged
  // responses.
  //
  // Leave this field unset when creating a new stream. To resume a stream at
  // a specific point, set this field and the `stream_id` field.
  //
  // Leave this field unset when creating a new stream.
  bytes stream_token = 4;

  // Labels associated with this write request.
  map<string, string> labels = 5;
}

// The response for [Firestore.Write][google.firestore.v1.Firestore.Write].
message WriteResponse {
  // The ID of the stream.
  // Only set on the first message, when a new stream was created.
  string stream_id = 1;

  // A token that represents the position of this response in the stream.
  // This can be used by a client to resume the stream at this point.
  //
  // This field is always set.
  bytes stream_token = 2;

  // The result of applying the writes.
  //
  // This i-th write result corresponds to the i-th write in the
  // request.
  repeated WriteResult write_results = 3;

  // The time at which the commit occurred. Any read with an equal or greater
  // `read_time` is guaranteed to see the effects of the write.
  google.protobuf.Timestamp commit_time = 4;
}

// A request for [Firestore.Listen][google.firestore.v1.Firestore.Listen]
message ListenRequest {
  // Required. The database name. In the format:
  // `projects/{project_id}/databases/{database_id}`.
  string database = 1 [(google.api.field_behavior) = REQUIRED];

  // The supported target changes.
  oneof target_change {
    // A target to add to this stream.
    Target add_target = 2;

    // The ID of a target to remove from this stream.
    int32 remove_target = 3;
  }

  // Labels associated with this target change.
  map<string, string> labels = 4;
}

// The response for [Firestore.Listen][google.firestore.v1.Firestore.Listen].
message ListenResponse {
  // The supported responses.
  oneof response_type {
    // Targets have changed.
    TargetChange target_change = 2;

    // A [Document][google.firestore.v1.Document] has changed.
    DocumentChange document_change = 3;

    // A [Document][google.firestore.v1.Document] has been deleted.
    DocumentDelete document_delete = 4;

    // A [Document][google.firestore.v1.Document] has been removed from a target
    // (because it is no longer relevant to that target).
    DocumentRemove document_remove = 6;

    // A filter to apply to the set of documents previously returned for the
    // given target.
    //
    // Returned when documents may have been removed from the given target, but
    // the exact documents are unknown.
    ExistenceFilter filter = 5;
  }
}

// A specification of a set of documents to listen to.
message Target {
  // A target specified by a set of documents names.
  message DocumentsTarget {
    // The names of the documents to retrieve. In the format:
    // `projects/{project_id}/databases/{database_id}/documents/{document_path}`.
    // The request will fail if any of the document is not a child resource of
    // the given `database`. Duplicate names will be elided.
    repeated string documents = 2;
  }

  // A target specified by a query.
  message QueryTarget {
    // The parent resource name. In the format:
    // `projects/{project_id}/databases/{database_id}/documents` or
    // `projects/{project_id}/databases/{database_id}/documents/{document_path}`.
    // For example:
    // `projects/my-project/databases/my-database/documents` or
    // `projects/my-project/databases/my-database/documents/chatrooms/my-chatroom`
    string parent = 1;

    // The query to run.
    oneof query_type {
      // A structured query.
      StructuredQuery structured_query = 2;
    }
  }

  // The type of target to listen to.
  oneof target_type {
    // A target specified by a query.
    QueryTarget query = 2;

    // A target specified by a set of document names.
    DocumentsTarget documents = 3;
  }

  // When to start listening.
  //
  // If specified, only the matching Documents that have been updated AFTER the
  // `resume_token` or `read_time` will be returned. Otherwise, all matching
  // Documents are returned before any subsequent changes.
  oneof resume_type {
    // A resume token from a prior
    // [TargetChange][google.firestore.v1.TargetChange] for an identical target.
    //
    // Using a resume token with a different target is unsupported and may fail.
    bytes resume_token = 4;

    // Start listening after a specific `read_time`.
    //
    // The client must know the state of matching documents at this time.
    google.protobuf.Timestamp read_time = 11;
  }

  // The target ID that identifies the target on the stream. Must be a positive
  // number and non-zero.
  //
  // If `target_id` is 0 (or unspecified), the server will assign an ID for this
  // target and return that in a `TargetChange::ADD` event. Once a target with
  // `target_id=0` is added, all subsequent targets must also have
  // `target_id=0`. If an `AddTarget` request with `target_id != 0` is
  // sent to the server after a target with `target_id=0` is added, the server
  // will immediately send a response with a `TargetChange::Remove` event.
  //
  // Note that if the client sends multiple `AddTarget` requests
  // without an ID, the order of IDs returned in `TargetChage.target_ids` are
  // undefined. Therefore, clients should provide a target ID instead of relying
  // on the server to assign one.
  //
  // If `target_id` is non-zero, there must not be an existing active target on
  // this stream with the same ID.
  int32 target_id = 5;

  // If the target should be removed once it is current and consistent.
  bool once = 6;

  // The number of documents that last matched the query at the resume token or
  // read time.
  //
  // This value is only relevant when a `resume_type` is provided. This value
  // being present and greater than zero signals that the client wants
  // `ExistenceFilter.unchanged_names` to be included in the response.
  google.protobuf.Int32Value expected_count = 12;
}

// Targets being watched have changed.
message TargetChange {
  // The type of change.
  enum TargetChangeType {
    // No change has occurred. Used only to send an updated `resume_token`.
    NO_CHANGE = 0;

    // The targets have been added.
    ADD = 1;

    // The targets have been removed.
    REMOVE = 2;

    // The targets reflect all changes committed before the targets were added
    // to the stream.
    //
    // This will be sent after or with a `read_time` that is greater than or
    // equal to the time at which the targets were added.
    //
    // Listeners can wait for this change if read-after-write semantics
    // are desired.
    CURRENT = 3;

    // The targets have been reset, and a new initial state for the targets
    // will be returned in subsequent changes.
    //
    // After the initial state is complete, `CURRENT` will be returned even
    // if the target was previously indicated to be `CURRENT`.
    RESET = 4;
  }

  // The type of change that occurred.
  TargetChangeType target_change_type = 1;

  // The target IDs of targets that have changed.
  //
  // If empty, the change applies to all targets.
  //
  // The order of the target IDs is not defined.
  repeated int32 target_ids = 2;

  // The error that resulted in this change, if applicable.
  google.rpc.Status cause = 3;

  // A token that can be used to resume the stream for the given `target_ids`,
  // or all targets if `target_ids` is empty.
  //
  // Not set on every target change.
  bytes resume_token = 4;

  // The consistent `read_time` for the given `target_ids` (omitted when the
  // target_ids are not at a consistent snapshot).
  //
  // The stream is guaranteed to send a `read_time` with `target_ids` empty
  // whenever the entire stream reaches a new consistent snapshot. ADD,
  // CURRENT, and RESET messages are guaranteed to (eventually) result in a
  // new consistent snapshot (while NO_CHANGE and REMOVE messages are not).
  //
  // For a given stream, `read_time` is guaranteed to be monotonically
  // increasing.
  google.protobuf.Timestamp read_time = 6;
}

// The request for
// [Firestore.ListCollectionIds][google.firestore.v1.Firestore.ListCollectionIds].
message ListCollectionIdsRequest {
  // Required. The parent document. In the format:
  // `projects/{project_id}/databases/{database_id}/documents/{document_path}`.
  // For example:
  // `projects/my-project/databases/my-database/documents/chatrooms/my-chatroom`
  string parent = 1 [(google.api.field_behavior) = REQUIRED];

  // The maximum number of results to return.
  int32 page_size = 2;

  // A page token. Must be a value from
  // [ListCollectionIdsResponse][google.firestore.v1.ListCollectionIdsResponse].
  string page_token = 3;

  // The consistency mode for this request.
  // If not set, defaults to strong consistency.
  oneof consistency_selector {
    // Reads documents as they were at the given time.
    //
    // This must be a microsecond precision timestamp within the past one hour,
    // or if Point-in-Time Recovery is enabled, can additionally be a whole
    // minute timestamp within the past 7 days.
    google.protobuf.Timestamp read_time = 4;
  }
}

// The response from
// [Firestore.ListCollectionIds][google.firestore.v1.Firestore.ListCollectionIds].
message ListCollectionIdsResponse {
  // The collection ids.
  repeated string collection_ids = 1;

  // A page token that may be used to continue the list.
  string next_page_token = 2;
}

// The request for
// [Firestore.BatchWrite][google.firestore.v1.Firestore.BatchWrite].
message BatchWriteRequest {
  // Required. The database name. In the format:
  // `projects/{project_id}/databases/{database_id}`.
  string database = 1 [(google.api.field_behavior) = REQUIRED];

  // The writes to apply.
  //
  // Method does not apply writes atomically and does not guarantee ordering.
  // Each write succeeds or fails independently. You cannot write to the same
  // document more than once per request.
  repeated Write writes = 2;

  // Labels associated with this batch write.
  map<string, string> labels = 3;
}

// The response from
// [Firestore.BatchWrite][google.firestore.v1.Firestore.BatchWrite].
message BatchWriteResponse {
  // The result of applying the writes.
  //
  // This i-th write result corresponds to the i-th write in the
  // request.
  repeated WriteResult write_results = 1;

  // The status of applying the writes.
  //
  // This i-th write status corresponds to the i-th write in the
  // request.
  repeated google.rpc.Status status = 2;
}
