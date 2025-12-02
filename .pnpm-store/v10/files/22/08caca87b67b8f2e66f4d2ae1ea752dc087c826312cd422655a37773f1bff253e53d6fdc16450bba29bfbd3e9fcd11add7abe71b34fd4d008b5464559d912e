/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *   Copyright 2023-Present Couchbase, Inc.
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

#include "internal_search_meta_data.hxx"

#include "core/operations/document_search.hxx"

#include <couchbase/search_metrics.hxx>

#include <map>

namespace couchbase
{
namespace
{
auto
map_metrics(const core::operations::search_response::search_metrics& metrics)
  -> couchbase::search_metrics
{
  return {
    metrics.took,
    metrics.total_rows,
    metrics.success_partition_count,
    metrics.error_partition_count,
    metrics.success_partition_count + metrics.error_partition_count,
    metrics.max_score,
  };
}
} // namespace

internal_search_meta_data::internal_search_meta_data(
  const core::operations::search_response::search_meta_data& meta)
  : client_context_id_{ meta.client_context_id }
  , metrics_{ map_metrics(meta.metrics) }
  , errors_{ meta.errors }
{
}

auto
internal_search_meta_data::client_context_id() const -> const std::string&
{
  return client_context_id_;
}

auto
internal_search_meta_data::errors() const -> const std::map<std::string, std::string>&
{
  return errors_;
}

auto
internal_search_meta_data::metrics() const -> const couchbase::search_metrics&
{
  return metrics_;
}

} // namespace couchbase
