/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *   Copyright 2020-2021 Couchbase, Inc.
 *
 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 */

#pragma once

#include "hello_feature.hxx"

#include <spdlog/fmt/bundled/core.h>

template<>
struct fmt::formatter<couchbase::core::protocol::hello_feature> {
  template<typename ParseContext>
  constexpr auto parse(ParseContext& ctx)
  {
    return ctx.begin();
  }

  template<typename FormatContext>
  auto format(couchbase::core::protocol::hello_feature feature, FormatContext& ctx) const
  {
    string_view name = "unknown";
    switch (feature) {
      case couchbase::core::protocol::hello_feature::tls:
        name = "tls";
        break;
      case couchbase::core::protocol::hello_feature::tcp_nodelay:
        name = "tcp_nodelay";
        break;
      case couchbase::core::protocol::hello_feature::mutation_seqno:
        name = "mutation_seqno";
        break;
      case couchbase::core::protocol::hello_feature::xattr:
        name = "xattr";
        break;
      case couchbase::core::protocol::hello_feature::xerror:
        name = "xerror";
        break;
      case couchbase::core::protocol::hello_feature::select_bucket:
        name = "select_bucket";
        break;
      case couchbase::core::protocol::hello_feature::snappy:
        name = "snappy";
        break;
      case couchbase::core::protocol::hello_feature::json:
        name = "json";
        break;
      case couchbase::core::protocol::hello_feature::duplex:
        name = "duplex";
        break;
      case couchbase::core::protocol::hello_feature::clustermap_change_notification:
        name = "clustermap_change_notification";
        break;
      case couchbase::core::protocol::hello_feature::unordered_execution:
        name = "unordered_execution";
        break;
      case couchbase::core::protocol::hello_feature::alt_request_support:
        name = "alt_request_support";
        break;
      case couchbase::core::protocol::hello_feature::sync_replication:
        name = "sync_replication";
        break;
      case couchbase::core::protocol::hello_feature::vattr:
        name = "vattr";
        break;
      case couchbase::core::protocol::hello_feature::collections:
        name = "collections";
        break;
      case couchbase::core::protocol::hello_feature::open_tracing:
        name = "open_tracing";
        break;
      case couchbase::core::protocol::hello_feature::preserve_ttl:
        name = "preserve_ttl";
        break;
      case couchbase::core::protocol::hello_feature::point_in_time_recovery:
        name = "point_in_time_recovery";
        break;
      case couchbase::core::protocol::hello_feature::tcp_delay:
        name = "tcp_delay";
        break;
      case couchbase::core::protocol::hello_feature::tracing:
        name = "tracing";
        break;
      case couchbase::core::protocol::hello_feature::subdoc_create_as_deleted:
        name = "subdoc_create_as_deleted";
        break;
      case couchbase::core::protocol::hello_feature::subdoc_document_macro_support:
        name = "subdoc_document_macro_support";
        break;
      case couchbase::core::protocol::hello_feature::replace_body_with_xattr:
        name = "replace_body_with_xattr";
        break;
      case couchbase::core::protocol::hello_feature::resource_units:
        name = "resource_units";
        break;
      case couchbase::core::protocol::hello_feature::subdoc_replica_read:
        name = "subdoc_replica_read";
        break;
      case couchbase::core::protocol::hello_feature::deduplicate_not_my_vbucket_clustermap:
        name = "deduplicate_not_my_vbucket_clustermap";
        break;
      case couchbase::core::protocol::hello_feature::subdoc_binary_xattr:
        name = "subdoc_binary_xattr";
        break;
    }
    return format_to(ctx.out(), "{}", name);
  }
};
