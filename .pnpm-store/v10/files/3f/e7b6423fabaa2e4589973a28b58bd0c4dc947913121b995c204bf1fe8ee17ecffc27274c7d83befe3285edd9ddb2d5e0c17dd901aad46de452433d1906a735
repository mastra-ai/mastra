/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *   Copyright 2020-Present Couchbase, Inc.
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

#include "core/cluster.hxx"
#include "core/operations/document_search.hxx"
#include "core/utils/json.hxx"
#include "encoded_search_facet.hxx"
#include "encoded_search_query.hxx"
#include "encoded_search_sort.hxx"
#include "internal_date_range_facet_result.hxx"
#include "internal_numeric_range_facet_result.hxx"
#include "internal_term_facet_result.hxx"

#include <couchbase/cluster.hxx>
#include <couchbase/match_none_query.hxx>
#include <utility>

#include <spdlog/fmt/bundled/core.h>

namespace couchbase::core::impl
{
namespace
{
auto
map_highlight_style(const std::optional<couchbase::highlight_style>& style)
  -> std::optional<core::search_highlight_style>
{
  if (style) {
    switch (style.value()) {
      case highlight_style::html:
        return core::search_highlight_style::html;
      case highlight_style::ansi:
        return core::search_highlight_style::ansi;
    }
  }
  return {};
}

auto
map_scan_consistency(const std::optional<couchbase::search_scan_consistency>& scan_consistency)
  -> std::optional<core::search_scan_consistency>
{
  if (scan_consistency == couchbase::search_scan_consistency::not_bounded) {
    return core::search_scan_consistency::not_bounded;
  }
  return {};
}

auto
map_sort(const std::vector<std::shared_ptr<search_sort>>& sort,
         const std::vector<std::string>& sort_string) -> std::vector<std::string>
{
  std::vector<std::string> sort_specs{};
  sort_specs.reserve(sort.size() + sort_string.size());

  for (const auto& s : sort) {
    auto encoded = s->encode();
    if (encoded.ec) {
      throw std::system_error(encoded.ec, "unable to encode search sort object");
    }
    sort_specs.emplace_back(core::utils::json::generate(encoded.sort));
  }

  for (const auto& s : sort_string) {
    sort_specs.emplace_back(core::utils::json::generate(s));
  }

  return sort_specs;
}

auto
map_facets(const std::map<std::string, std::shared_ptr<search_facet>, std::less<>>& facets)
  -> std::map<std::string, std::string>
{
  std::map<std::string, std::string> core_facets{};

  for (const auto& [name, f] : facets) {
    auto encoded = f->encode();
    if (encoded.ec) {
      throw std::system_error(encoded.ec, "unable to encode search facet object in request");
    }
    core_facets[name] = core::utils::json::generate(encoded.facet);
  }

  return core_facets;
}

auto
map_raw(std::map<std::string, codec::binary, std::less<>>& raw)
  -> std::map<std::string, couchbase::core::json_string>
{
  std::map<std::string, couchbase::core::json_string> core_raw{};
  for (const auto& [name, value] : raw) {
    core_raw[name] = value;
  }
  return core_raw;
}

auto
map_vector_query_combination(const std::optional<couchbase::vector_query_combination>& combination)
  -> std::optional<core::vector_query_combination>
{
  if (combination) {
    switch (combination.value()) {
      case couchbase::vector_query_combination::combination_and:
        return core::vector_query_combination::combination_and;
      case couchbase::vector_query_combination::combination_or:
        return core::vector_query_combination::combination_or;
    }
  }
  return {};
}

} // namespace

auto
build_search_request(std::string index_name,
                     const search_query& query,
                     search_options::built options,
                     std::optional<std::string> bucket_name,
                     std::optional<std::string> scope_name) -> core::operations::search_request
{
  auto encoded = query.encode();
  if (encoded.ec) {
    throw std::system_error(
      encoded.ec, fmt::format("unable to encode search query for index \"{}\"", index_name));
  }
  core::operations::search_request request{
    std::move(index_name),
    core::utils::json::generate_binary(encoded.query),
    std::move(bucket_name),
    std::move(scope_name),
    {},
    {},
    {},
    options.limit,
    options.skip,
    options.explain,
    options.disable_scoring,
    options.include_locations,
    map_highlight_style(options.highlight_style),
    options.highlight_fields,
    options.fields,
    options.collections,
    map_scan_consistency(options.scan_consistency),
    options.mutation_state,
    map_sort(options.sort, options.sort_string),
    map_facets(options.facets),
    map_raw(options.raw),
    {},
    options.client_context_id,
    options.timeout,
  };
  request.parent_span = options.parent_span;
  return request;
}

auto
build_search_request(std::string index_name,
                     couchbase::search_request request,
                     search_options::built options,
                     std::optional<std::string> bucket_name,
                     std::optional<std::string> scope_name) -> core::operations::search_request
{
  if (!request.search_query().has_value()) {
    request.search_query(couchbase::match_none_query{});
  }

  core::operations::search_request core_request{
    std::move(index_name),
    // TODO(CXXCBC-549) Already assigned to match_none_query above
    // NOLINTNEXTLINE(bugprone-unchecked-optional-access)
    core::utils::json::generate_binary(request.search_query()->query),
    std::move(bucket_name),
    std::move(scope_name),
    false,
    {},
    {},
    options.limit,
    options.skip,
    options.explain,
    options.disable_scoring,
    options.include_locations,
    map_highlight_style(options.highlight_style),
    options.highlight_fields,
    options.fields,
    options.collections,
    map_scan_consistency(options.scan_consistency),
    options.mutation_state,
    map_sort(options.sort, options.sort_string),
    map_facets(options.facets),
    map_raw(options.raw),
    {},
    options.client_context_id,
    options.timeout,
  };
  core_request.parent_span = options.parent_span;

  if (auto vector_search = request.vector_search(); vector_search.has_value()) {
    core_request.vector_search = core::utils::json::generate_binary(vector_search->query);

    if (auto vector_search_options = request.vector_options(); vector_search_options.has_value()) {
      core_request.vector_query_combination =
        map_vector_query_combination(vector_search_options->combination);
    }
  }

  return core_request;
}
} // namespace couchbase::core::impl
