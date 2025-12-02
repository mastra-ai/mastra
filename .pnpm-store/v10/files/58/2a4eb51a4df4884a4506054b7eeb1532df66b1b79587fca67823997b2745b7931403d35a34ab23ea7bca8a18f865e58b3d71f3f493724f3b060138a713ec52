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

#pragma once

#include <couchbase/common_options.hxx>
#include <couchbase/error.hxx>
#include <couchbase/highlight_style.hxx>
#include <couchbase/mutation_state.hxx>
#include <couchbase/search_facet.hxx>
#include <couchbase/search_result.hxx>
#include <couchbase/search_scan_consistency.hxx>
#include <couchbase/search_sort.hxx>

#include <chrono>
#include <functional>
#include <memory>
#include <optional>

namespace couchbase
{
namespace codec
{
class tao_json_serializer;
}

/**
 * Options for @ref cluster#search() and @ref scope#search().
 *
 * @since 1.0.0
 * @committed
 */
struct search_options : public common_options<search_options> {
  /**
   * Immutable value object representing consistent options.
   *
   * @since 1.0.0
   * @internal
   */
  struct built : public common_options<search_options>::built {
    std::optional<std::string> client_context_id{};
    bool include_locations{ false };
    bool disable_scoring{ false };
    std::optional<bool> explain{};
    std::optional<std::uint32_t> limit{};
    std::optional<std::uint32_t> skip{};
    std::vector<std::string> collections{};
    std::vector<std::string> fields{};
    std::vector<std::string> highlight_fields{};
    std::optional<couchbase::highlight_style> highlight_style{};
    std::optional<search_scan_consistency> scan_consistency{};
    std::vector<mutation_token> mutation_state{};
    std::map<std::string, codec::binary, std::less<>> raw{};
    std::map<std::string, std::shared_ptr<search_facet>, std::less<>> facets{};
    std::vector<std::shared_ptr<search_sort>> sort{};
    std::vector<std::string> sort_string{};
  };

  /**
   * Validates options and returns them as an immutable value.
   *
   * @return consistent options as an immutable value
   *
   * @exception std::system_error with code errc::common::invalid_argument if the options are not
   * valid
   *
   * @since 1.0.0
   * @internal
   */
  [[nodiscard]] auto build() const -> built
  {
    return {
      build_common_options(),
      client_context_id_,
      include_locations_,
      disable_scoring_,
      explain_,
      limit_,
      skip_,
      collections_,
      fields_,
      highlight_fields_,
      highlight_style_,
      scan_consistency_,
      mutation_state_,
      raw_,
      facets_,
      sort_,
      sort_string_,
    };
  }

  /**
   * Supports providing a custom client context ID for this query.
   *
   * If no client context ID is provided by the user, a UUID is generated and sent automatically so
   * by default it is always possible to identify a query when debugging.
   *
   * @param client_context_id the client context ID
   * @return this options builder for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  auto client_context_id(std::string client_context_id) -> search_options&
  {
    if (client_context_id.empty()) {
      client_context_id_.reset();
    } else {
      client_context_id_ = std::move(client_context_id);
    }
    return self();
  }

  /**
   * Customizes the consistency guarantees for this query.
   *
   * Tuning the scan consistency allows to trade data "freshness" for latency and vice versa. By
   * default
   * {@link search_scan_consistency::not_bounded} is used, which means that the server returns the
   * data it has in the index right away. This is fast, but might not include the most recent
   * mutations.
   *
   * Note that you cannot use this method and {@link #consistent_with(const mutation_state&)} at the
   * same time, since they are mutually exclusive. As a rule of thumb, if you only care to be
   * consistent with the mutation you just wrote on the same thread/app, use
   * {@link #consistent_with(const mutation_state&)}.
   *
   * @param scan_consistency the index scan consistency to be used for this query
   * @return this options builder for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  auto scan_consistency(search_scan_consistency scan_consistency) -> search_options&
  {
    scan_consistency_ = scan_consistency;
    mutation_state_.clear();
    return self();
  }

  /**
   * Sets the {@link mutation_token}s this query should be consistent with.
   *
   * These mutation tokens are returned from mutations (i.e. as part of a {@link mutation_result})
   * and if you want your N1QL query to include those you need to pass the mutation tokens into a
   * {@link mutation_state}.
   *
   * Note that you cannot use this method and {@link #scan_consistency(search_scan_consistency)} at
   * the same time, since they are mutually exclusive. As a rule of thumb, if you only care to be
   * consistent with the mutation you just wrote on the same thread/app, use this method.
   *
   * @param state the mutation state containing the mutation tokens.
   * @return this options builder for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  auto consistent_with(const mutation_state& state) -> search_options&
  {
    mutation_state_ = state.tokens();
    scan_consistency_.reset();
    return self();
  }

  /**
   *
   * @tparam Value
   * @param name
   * @param value
   * @return this options builder for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  template<typename Value,
           typename Serializer = codec::tao_json_serializer,
           std::enable_if_t<codec::is_serializer_v<Serializer>, bool> = true>
  auto raw(std::string name, const Value& value) -> search_options&
  {
    raw_[std::move(name)] = std::move(Serializer::template serialize<Value>(value));
    return self();
  }

  /**
   * Set the number of rows to skip (eg. for pagination).
   *
   * @param skip
   * @return this options builder for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  auto skip(std::uint32_t skip) -> search_options&
  {
    skip_ = skip;
    return self();
  }

  /**
   *
   * Add a limit to the query on the number of rows it can return.
   *
   * @param limit
   * @return this options builder for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  auto limit(std::uint32_t limit) -> search_options&
  {
    limit_ = limit;
    return self();
  }

  /**
   * Activates or deactivates the explanation of each result hit in the response, according to the
   * parameter.
   *
   * @param explain
   * @return this options builder for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  auto explain(bool explain) -> search_options&
  {
    explain_ = explain;
    return self();
  }

  /**
   * If set to true, thee server will not perform any scoring on the hits.
   *
   * @param disable
   * @return this options builder for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  auto disable_scoring(bool disable) -> search_options&
  {
    disable_scoring_ = disable;
    return self();
  }

  /**
   * If set to true, will include the @ref search_row#locations().
   *
   * @param include
   * @return this options builder for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  auto include_locations(bool include) -> search_options&
  {
    include_locations_ = include;
    return self();
  }

  /**
   * Allows to limit the search query to a specific list of collection names.
   *
   * @note this is only supported with server 7.0 and later.
   *
   * @param collections
   * @return this options builder for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  auto collections(std::vector<std::string> collections) -> search_options&
  {
    collections_ = std::move(collections);
    return self();
  }

  /**
   * Configures the list of fields for which the whole value should be included in the response. If
   * empty, no field values are included.
   *
   * This drives the inclusion of the fields in each @ref search_row hit.
   *
   * @note to be highlighted, the fields must be stored in the FTS index.
   *
   * @param fields
   * @return this options builder for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  auto fields(std::vector<std::string> fields) -> search_options&
  {
    fields_ = std::move(fields);
    return self();
  }

  /**
   * Configures the highlighting of matches in the response.
   *
   * This drives the inclusion of the @ref search_row#fragments() fragments in each @ref search_row
   * hit.
   *
   * @note to be highlighted, the fields must be stored in the FTS index.
   *
   * @param style
   * @param fields
   * @return this options builder for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  auto highlight(highlight_style style = highlight_style::html,
                 std::vector<std::string> fields = {}) -> search_options&
  {
    highlight_style_ = style;
    highlight_fields_ = std::move(fields);
    return self();
  }

  /**
   * Configures the highlighting of matches in the response for all fields, using the server's
   * default highlighting style.
   *
   * This drives the inclusion of the @ref search_row#fragments() fragments in each @ref search_row
   * hit.
   *
   * @note to be highlighted, the fields must be stored in the FTS index.
   *
   * @param fields
   * @return this options builder for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  auto highlight(std::vector<std::string> fields) -> search_options&
  {
    highlight_style_ = highlight_style::html;
    highlight_fields_ = std::move(fields);
    return self();
  }

  /**
   * Configures the list of fields (including special fields) which are used for sorting purposes.
   * If empty, the default sorting (descending by score) is used by the server.
   *
   * The list of sort fields can include actual fields (like "firstname" but then they must be
   * stored in the index, configured in the server side mapping). Fields provided first are
   * considered first and in a "tie" case the next sort field is considered. So sorting by
   * "firstname" and then "lastname" will first sort ascending by the firstname and if the names are
   * equal then sort ascending by lastname. Special fields like "_id" and "_score" can also be used.
   * If prefixed with "-" the sort order is set to descending.
   *
   * If no sort is provided, it is equal to `sort("-_score")`, since the server will sort it by
   * score in descending order.
   *
   * @param sort_expressions
   * @return this options builder for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  auto sort(std::vector<std::string> sort_expressions) -> search_options&
  {
    sort_string_ = std::move(sort_expressions);
    return self();
  }

  /**
   * Configures the list of @ref search_sort instances which are used for sorting purposes. If
   * empty, the default sorting (descending by score) is used by the server.
   *
   * If no sort is provided, it is equal to `sort("-_score")`, since the server will sort it by
   * score in descending order.
   *
   * @param sort_objects
   * @return this options builder for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  auto sort(std::vector<std::shared_ptr<search_sort>> sort_objects) -> search_options&
  {
    sort_ = std::move(sort_objects);
    return self();
  }

  /**
   * Sets list of @ref search_facet to the query.
   *
   * This drives the inclusion of the facets in the @ref search_result.
   *
   * @note to be faceted, a field's value must be stored in the FTS index.
   *
   * @param facets
   * @return this options builder for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  auto facets(std::map<std::string, std::shared_ptr<search_facet>> facets) -> search_options&
  {
    facets_.clear();
    for (auto& [name, facet] : facets) {
      facets_[name] = std::move(facet);
    }
    return self();
  }

  /**
   * Sets list of @ref search_facet to the query.
   *
   * This drives the inclusion of the facets in the @ref search_result.
   *
   * @note to be faceted, a field's value must be stored in the FTS index.
   *
   * @param facets pairs of std::string name and value derived from @ref search_facet
   * @return this options builder for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  template<typename... Facets>
  auto facets(const Facets&... facets) -> search_options&
  {
    facets_.clear();
    encode_facet(facets...);
    return self();
  }

  /**
   * Adds one @ref search_facet to the query.
   *
   * This is an additive operation (the given facets are added to any facet previously requested),
   * but if an existing facet has the same name it will be replaced.
   *
   * This drives the inclusion of the facets in the @ref search_result.
   *
   * @note to be faceted, a field's value must be stored in the FTS index.
   *
   * @param name
   * @param facet
   * @return this options builder for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  auto facet(std::string name, std::shared_ptr<search_facet> facet) -> search_options&
  {
    facets_[std::move(name)] = std::move(facet);
    return self();
  }

  /**
   * Adds one @ref search_facet to the query.
   *
   * This is an additive operation (the given facets are added to any facet previously requested),
   * but if an existing facet has the same name it will be replaced.
   *
   * This drives the inclusion of the facets in the @ref search_result.
   *
   * @note to be faceted, a field's value must be stored in the FTS index.
   *
   * @tparam Facet type of the facet, that derived from the @ref search_facet
   * @param name
   * @param facet
   * @return this options builder for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  template<typename Facet>
  auto facet(std::string name, Facet facet) -> search_options&
  {
    facets_[std::move(name)] = std::make_shared<Facet>(std::move(facet));
    return self();
  }

private:
  template<typename Name, typename Facet, typename... Rest>
  void encode_facet(const std::pair<Name, Facet>& facet, Rest... args)
  {
    facets_[std::move(facet.first)] = std::make_shared<Facet>(std::move(facet.second));
    if constexpr (sizeof...(args) > 0) {
      encode_facet(args...);
    }
  }

  std::optional<std::string> client_context_id_{};
  bool include_locations_{ false };
  bool disable_scoring_{ false };
  std::optional<bool> explain_{};
  std::optional<std::uint32_t> limit_{};
  std::optional<std::uint32_t> skip_{};
  std::vector<std::string> collections_{};
  std::vector<std::string> fields_{};
  std::vector<std::string> highlight_fields_{};
  std::optional<highlight_style> highlight_style_{};
  std::optional<search_scan_consistency> scan_consistency_{};
  std::vector<mutation_token> mutation_state_{};
  std::map<std::string, codec::binary, std::less<>> raw_{};
  std::map<std::string, std::shared_ptr<search_facet>, std::less<>> facets_{};
  std::vector<std::shared_ptr<search_sort>> sort_{};
  std::vector<std::string> sort_string_{};
};

/**
 * The signature for the handler of the @ref cluster#search() and @ref scope#search() operations
 *
 * @since 1.0.0
 * @uncommitted
 */
using search_handler = std::function<void(error, search_result)>;
} // namespace couchbase
