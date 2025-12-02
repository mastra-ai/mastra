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

#include <set>

#include "core/cluster_options.hxx"

namespace couchbase::core
{
enum class bucket_capability {
  couchapi,
  xattr,
  dcp,
  cbhello,
  touch,
  cccp,
  xdcr_checkpointing,
  nodes_ext,
  collections,
  durable_write,
  tombstoned_user_xattrs,
  range_scan,
  non_deduped_history,
  subdoc_replace_body_with_xattr,
  subdoc_document_macro_support,
  subdoc_revive_document,
  dcp_ignore_purged_tombstones,
  preserve_expiry,
  query_system_collection,
  mobile_system_collection,
  subdoc_replica_read,
  subdoc_access_deleted,
};

enum class cluster_capability {
  n1ql_cost_based_optimizer,
  n1ql_index_advisor,
  n1ql_javascript_functions,
  n1ql_inline_functions,
  n1ql_enhanced_prepared_statements,
  n1ql_read_from_replica,
  search_vector_search,
  search_scoped_search_index,
};

struct configuration_capabilities {
  std::set<bucket_capability> bucket{};
  std::set<cluster_capability> cluster{};
  std::optional<std::string> prod{};

  [[nodiscard]] auto has_cluster_capability(cluster_capability cap) const -> bool
  {
    return cluster.find(cap) != cluster.end();
  }

  [[nodiscard]] auto has_bucket_capability(bucket_capability cap) const -> bool
  {
    return bucket.find(cap) != bucket.end();
  }

  [[nodiscard]] auto supports_enhanced_prepared_statements() const -> bool
  {
    return has_cluster_capability(cluster_capability::n1ql_enhanced_prepared_statements);
  }

  [[nodiscard]] auto supports_read_from_replica() const -> bool
  {
    return has_cluster_capability(cluster_capability::n1ql_read_from_replica);
  }

  [[nodiscard]] auto supports_range_scan() const -> bool
  {
    return has_bucket_capability(bucket_capability::range_scan);
  }

  [[nodiscard]] auto ephemeral() const -> bool
  {
    // Use bucket capabilities to identify if couchapi is missing (then its ephemeral). If its null
    // then we are running an old version of couchbase which doesn't have ephemeral buckets at all.
    return has_bucket_capability(bucket_capability::couchapi);
  }

  [[nodiscard]] auto supports_subdoc_read_replica() const -> bool
  {
    return has_bucket_capability(bucket_capability::subdoc_replica_read);
  }

  [[nodiscard]] auto supports_subdoc_access_deleted() const -> bool
  {
    return has_bucket_capability(bucket_capability::subdoc_access_deleted);
  }

  [[nodiscard]] auto supports_non_deduped_history() const -> bool
  {
    return has_bucket_capability(bucket_capability::non_deduped_history);
  }

  [[nodiscard]] auto supports_scoped_search_indexes() const -> bool
  {
    return has_cluster_capability(cluster_capability::search_scoped_search_index);
  }

  [[nodiscard]] auto supports_vector_search() const -> bool
  {
    return has_cluster_capability(cluster_capability::search_vector_search);
  }

  [[nodiscard]] auto is_analytics_cluster(const cluster_options& options) const -> bool;
};

} // namespace couchbase::core
