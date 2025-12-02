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
#include <couchbase/mutation_state.hxx>
#include <couchbase/query_profile.hxx>
#include <couchbase/query_result.hxx>
#include <couchbase/query_scan_consistency.hxx>

#include <chrono>
#include <functional>
#include <map>
#include <optional>
#include <vector>

namespace couchbase
{
namespace codec
{
class tao_json_serializer;
} // namespace codec

/**
 * Options for cluster#query() and scope#query().
 *
 * @since 1.0.0
 * @committed
 */
struct query_options : public common_options<query_options> {
  /**
   * Immutable value object representing consistent options.
   *
   * @since 1.0.0
   * @internal
   */
  struct built : public common_options<query_options>::built {
    const bool adhoc;
    const bool metrics;
    const bool readonly;
    const bool flex_index;
    const bool preserve_expiry;
    std::optional<bool> use_replica;
    std::optional<std::uint64_t> max_parallelism;
    std::optional<std::uint64_t> scan_cap;
    std::optional<std::chrono::milliseconds> scan_wait;
    std::optional<std::uint64_t> pipeline_batch;
    std::optional<std::uint64_t> pipeline_cap;
    std::optional<std::string> client_context_id;
    std::optional<query_scan_consistency> scan_consistency;
    std::vector<mutation_token> mutation_state;
    std::optional<query_profile> profile;
    std::vector<codec::binary> positional_parameters;
    std::map<std::string, codec::binary, std::less<>> named_parameters;
    std::map<std::string, codec::binary, std::less<>> raw;
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
      adhoc_,
      metrics_,
      readonly_,
      flex_index_,
      preserve_expiry_,
      use_replica_,
      max_parallelism_,
      scan_cap_,
      scan_wait_,
      pipeline_batch_,
      pipeline_cap_,
      client_context_id_,
      scan_consistency_,
      mutation_state_,
      profile_,
      positional_parameters_,
      named_parameters_,
      raw_,
    };
  }

  /**
   * Allows turning this request into a prepared statement query.
   *
   * If set to `false`, the SDK will transparently perform "prepare and execute" logic the first
   * time this query is seen and then subsequently reuse the prepared statement name when sending it
   * to the server. If a query is executed frequently, this is a good way to speed it up since it
   * will save the server the task of re-parsing and analyzing the query.
   *
   * If you are using prepared statements, make sure that if certain parts of the query string
   * change you are using #named_parameters() or #positional_parameters(). If the statement string
   * itself changes it cannot be cached.
   *
   * @param adhoc if set to false this query will be turned into a prepared statement query.
   * @return this options builder for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  auto adhoc(bool adhoc) -> query_options&
  {
    adhoc_ = adhoc;
    return self();
  }

  /**
   * Enables per-request metrics in the trailing section of the query.
   *
   * If this method is set to true, the server will send metrics back to the client which are
   * available through the
   * {@link query_meta_data#metrics()} section. As opposed to {@link #profile(query_profile)},
   * returning metrics is rather cheap and can also be enabled in production if needed.
   *
   * @param metrics set to true if the server should return simple query metrics.
   * @return this options builder for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  auto metrics(bool metrics) -> query_options&
  {
    metrics_ = metrics;
    return self();
  }

  /**
   * Customizes the server profiling level for this query.
   *
   * @note that you only want to tune this if you want to gather profiling/performance metrics for
   * debugging. Turning this on in production (depending on the level) will likely have performance
   * impact on the server query engine as a whole and on this query in particular!
   *
   * This is an Enterprise Edition feature. On Community Edition the parameter will be accepted, but
   * no profiling information returned.
   *
   * @param profile the custom query profile level for this query.
   * @return this options builder for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  auto profile(query_profile profile) -> query_options&
  {
    profile_ = profile;
    return self();
  }

  /**
   * Allows explicitly marking a query as being readonly and not mutating and documents on the
   * server side.
   *
   * In addition to providing some security in that you are not accidentally modifying data, setting
   * this flag to true also helps the client to more proactively retry and re-dispatch a query since
   * then it can be sure it is idempotent. As a result, if your query is readonly then it is a good
   * idea to set this flag.
   *
   * If set to true, then (at least) the following statements are not allowed:
   * <ol>
   *  <li>CREATE INDEX</li>
   *  <li>DROP INDEX</li>
   *  <li>INSERT</li>
   *  <li>MERGE</li>
   *  <li>UPDATE</li>
   *  <li>UPSERT</li>
   *  <li>DELETE</li>
   * </ol>
   *
   * @param readonly true if readonly should be set, false is the default and will use the server
   * side default.
   * @return this options builder for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  auto readonly(bool readonly) -> query_options&
  {
    readonly_ = readonly;
    return self();
  }

  /**
   * Tells the query engine to use a flex index (utilizing the search service).
   *
   * @param flex_index if a flex index should be used, false is the default.
   * @return this options builder for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  auto flex_index(bool flex_index) -> query_options&
  {
    flex_index_ = flex_index;
    return self();
  }

  /**
   * Tells the query engine to preserve expiration values set on any documents modified by this
   * query.
   *
   * This feature works from Couchbase Server 7.1.0 onwards.
   *
   * @param preserve_expiry whether expiration values should be preserved, the default is false.
   * @return this options builder for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  auto preserve_expiry(bool preserve_expiry) -> query_options&
  {
    preserve_expiry_ = preserve_expiry;
    return self();
  }

  /**
   * Specifies that the query engine should use replica nodes for KV fetches if the active node is
   * down.
   *
   * @param use_replica whether replica nodes should be used if the active node is down. If not
   * provided, the server default will be used.
   * @return the options builder for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  auto use_replica(bool use_replica) -> query_options&
  {
    use_replica_ = use_replica;
    return self();
  }

  /**
   * Allows overriding the default maximum parallelism for the query execution on the server side.
   *
   * If 0 value is set, the parallelism is disabled. If not provided, the server default will be
   * used.
   *
   * @param max_parallelism the maximum parallelism for this query, 0 value disable it.
   * @return this options builder for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  auto max_parallelism(std::uint64_t max_parallelism) -> query_options&
  {
    max_parallelism_ = max_parallelism;
    return self();
  }

  /**
   * Supports customizing the maximum buffered channel size between the indexer and the query
   * service.
   *
   * This is an advanced API and should only be tuned with care. Use 0 to disable.
   *
   * @param scan_cap the scan cap size, use 0 value to disable.
   * @return this options builder for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  auto scan_cap(std::uint64_t scan_cap) -> query_options&
  {
    scan_cap_ = scan_cap;
    return self();
  }

  /**
   * Allows customizing how long the query engine is willing to wait until the index catches up to
   * whatever scan consistency is asked for in this query.
   *
   * @note that if {@link query_scan_consistency::not_bounded} is used, this method doesn't do
   * anything at all. If no value is provided to this method, the server default is used.
   *
   * @param wait the maximum duration the query engine is willing to wait before failing.
   * @return this options builder for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  auto scan_wait(std::chrono::milliseconds wait) -> query_options&
  {
    if (scan_consistency_ == query_scan_consistency::not_bounded) {
      scan_wait_.reset();
    } else {
      scan_wait_ = wait;
    }
    return self();
  }

  /**
   * Supports customizing the number of items execution operators can batch for fetch from the KV
   * layer on the server.
   *
   * This is an advanced API and should only be tuned with care.
   *
   * @param pipeline_batch the pipeline batch size.
   * @return this options builder for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  auto pipeline_batch(std::uint64_t pipeline_batch) -> query_options&
  {
    pipeline_batch_ = pipeline_batch;
    return self();
  }

  /**
   *
   * Allows customizing the maximum number of items each execution operator can buffer between
   * various operators on the server.
   *
   * This is an advanced API and should only be tuned with care.
   *
   * @param pipeline_cap the pipeline cap size.
   * @return this options builder for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  auto pipeline_cap(std::uint64_t pipeline_cap) -> query_options&
  {
    pipeline_cap_ = pipeline_cap;
    return self();
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
  auto client_context_id(std::string client_context_id) -> query_options&
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
   * {@link query_scan_consistency::not_bounded} is used, which means that the server returns the
   * data it has in the index right away. This is fast, but might not include the most recent
   * mutations. If you want to include all the mutations up to the point of the query, use {@link
   * query_scan_consistency::request_plus}.
   *
   * Note that you cannot use this method and {@link #consistent_with(const mutation_state&)} at the
   * same time, since they are mutually exclusive. As a rule of thumb, if you only care to be
   * consistent with the mutation you just wrote on the same thread/app, use
   * {@link #consistent_with(const mutation_state&)}. If you need "global" scan consistency, use
   * {@link query_scan_consistency::request_plus} on this method.
   *
   * @param scan_consistency the index scan consistency to be used for this query
   * @return this options builder for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  auto scan_consistency(query_scan_consistency scan_consistency) -> query_options&
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
   * Note that you cannot use this method and {@link #scan_consistency(query_scan_consistency)} at
   * the same time, since they are mutually exclusive. As a rule of thumb, if you only care to be
   * consistent with the mutation you just wrote on the same thread/app, use this method. If you
   * need "global" scan consistency, use
   * {@link query_scan_consistency#request_plus} on {@link
   * #scan_consistency(query_scan_consistency)}.
   *
   * @param state the mutation state containing the mutation tokens.
   * @return this options builder for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  auto consistent_with(const mutation_state& state) -> query_options&
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
  template<typename Serializer = codec::tao_json_serializer,
           typename Value,
           std::enable_if_t<codec::is_serializer_v<Serializer>, bool> = true>
  auto raw(std::string name, const Value& value) -> query_options&
  {
    raw_[std::move(name)] = std::move(Serializer::template serialize<const Value&>(value));
    return self();
  }

  /**
   * Set list of positional parameters for a query. Any existing positional parameters will be
   * overridden.
   *
   * @tparam Parameters types for the parameters
   * @param parameters the sequence of positional parameters. Each entry will be encoded into JSON.
   * @return this options builder for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  template<typename Serializer = codec::tao_json_serializer,
           typename... Parameters,
           std::enable_if_t<codec::is_serializer_v<Serializer>, bool> = true>
  auto positional_parameters(const Parameters&... parameters) -> query_options&
  {
    positional_parameters_.clear();
    encode_positional_parameters<Serializer>(parameters...);
    return self();
  }

  /**
   * Set list of named parameters for a query. Any existing named parameters will be overridden.
   *
   * @tparam Parameters types for the parameter pairs
   * @param parameters the sequence of name-value pairs. Each value will be encoded into JSON.
   * @return this options builder for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  template<typename Serializer = codec::tao_json_serializer,
           typename... Parameters,
           std::enable_if_t<codec::is_serializer_v<Serializer>, bool> = true>
  auto named_parameters(const Parameters&... parameters) -> query_options&
  {
    named_parameters_.clear();
    encode_named_parameters<Serializer>(parameters...);
    return self();
  }

  /**
   * Adds a positional parameter to the current list of positional parameters.
   *
   * @tparam Parameter type for the parameter.
   * @param parameter the positional parameter. It will be encoded into JSON.
   * @return this options builder for chaining purposes.
   *
   * @since 1.1.0
   * @committed
   */
  template<typename Serializer = codec::tao_json_serializer,
           typename Parameter,
           std::enable_if_t<codec::is_serializer_v<Serializer>, bool> = true>
  auto add_positional_parameter(const Parameter& parameter) -> query_options&
  {
    encode_positional_parameters<Serializer>(parameter);
    return self();
  }

  /**
   * Adds a named parameter to the current list of named parameters.
   *
   * @tparam Value type for the named parameter's value.
   * @param name the named parameter's name
   * @param value the named parameter's value. It will be encoded into JSON.
   * @return this options builder for chaining purposes.
   *
   * @since 1.1.0
   * @committed
   */
  template<typename Serializer = codec::tao_json_serializer,
           typename Value,
           std::enable_if_t<codec::is_serializer_v<Serializer>, bool> = true>
  auto add_named_parameter(const std::string& name, const Value& value) -> query_options&
  {
    encode_named_parameters<Serializer>(std::make_pair(name, value));
    return self();
  }

  /**
   * Clears the list of positional parameters.
   *
   * @return this options builder for chaining purposes.
   *
   * @since 1.1.0
   * @committed
   */
  auto clear_positional_parameters() -> query_options&
  {
    positional_parameters_.clear();
    return self();
  }

  /**
   * Clears the list of named parameters.
   *
   * @return this options builder for chaining purposes.
   *
   * @since 1.1.0
   * @committed
   */
  auto clear_named_parameters() -> query_options&
  {
    named_parameters_.clear();
    return self();
  }

  /**
   * Set map of raw options for a query.
   *
   * This function expects that all parameters encoded into pairs containing mapping names of the
   * parameter to valid JSON values encoded as string.
   *
   * @note This function is low-level, and instead @ref raw() should be considered.
   *
   * @param options mapping of pairs, where each entry contains string with valid JSON value.
   * @return this options builder for chaining purposes.
   *
   * @since 1.0.0
   * @uncommitted
   */
  auto encoded_raw_options(std::map<std::string, codec::binary, std::less<>> options)
    -> query_options&
  {
    raw_ = std::move(options);
    return self();
  }

  /**
   * Set list of positional parameters for a query.
   *
   * This function expects that all parameters encoded into byte strings containing valid JSON
   * values.
   *
   * @note This function is low-level, and instead @ref positional_parameters() should be
   * considered.
   *
   * @param parameters vector of binaries, where each entry contains string with valid JSON value.
   * @return this options builder for chaining purposes.
   *
   * @since 1.0.0
   * @uncommitted
   */
  auto encoded_positional_parameters(std::vector<codec::binary> parameters) -> query_options&
  {
    positional_parameters_ = std::move(parameters);
    return self();
  }

  /**
   * Set map of named parameters for a query.
   *
   * This function expects that all parameters encoded into pairs containing mapping names of the
   * parameter to valid JSON values encoded as string.
   *
   * @note This function is low-level, and instead @ref named_parameters() should be considered.
   *
   * @param parameters mapping of pairs, where each entry contains string with valid JSON value.
   * @return this options builder for chaining purposes.
   *
   * @since 1.0.0
   * @uncommitted
   */
  auto encoded_named_parameters(std::map<std::string, codec::binary, std::less<>> parameters)
    -> query_options&
  {
    named_parameters_ = std::move(parameters);
    return self();
  }

private:
  template<typename Serializer = codec::tao_json_serializer,
           typename Parameter,
           typename... Rest,
           std::enable_if_t<codec::is_serializer_v<Serializer>, bool> = true>
  void encode_positional_parameters(const Parameter& parameter, Rest... args)
  {
    positional_parameters_.emplace_back(
      std::move(Serializer::template serialize<const Parameter&>(parameter)));
    if constexpr (sizeof...(args) > 0) {
      encode_positional_parameters<Serializer>(args...);
    }
  }

  template<typename Serializer = codec::tao_json_serializer,
           typename Name,
           typename Parameter,
           typename... Rest,
           std::enable_if_t<codec::is_serializer_v<Serializer>, bool> = true>
  void encode_named_parameters(const std::pair<Name, Parameter>& parameter, Rest... args)
  {
    named_parameters_[parameter.first] =
      std::move(Serializer::template serialize<Parameter>(parameter.second));
    if constexpr (sizeof...(args) > 0) {
      encode_named_parameters<Serializer>(args...);
    }
  }

  bool adhoc_{ true };
  bool metrics_{ false };
  bool readonly_{ false };
  bool flex_index_{ false };
  bool preserve_expiry_{ false };
  std::optional<bool> use_replica_{};
  std::optional<std::uint64_t> max_parallelism_{};
  std::optional<std::uint64_t> scan_cap_{};
  std::optional<std::uint64_t> pipeline_batch_{};
  std::optional<std::uint64_t> pipeline_cap_{};
  std::optional<std::string> client_context_id_{};
  std::optional<std::chrono::milliseconds> scan_wait_{};
  std::optional<query_scan_consistency> scan_consistency_{};
  std::vector<mutation_token> mutation_state_{};
  std::optional<query_profile> profile_{};
  std::vector<codec::binary> positional_parameters_{};
  std::map<std::string, codec::binary, std::less<>> raw_{};
  std::map<std::string, codec::binary, std::less<>> named_parameters_{};
};

/**
 * The signature for the handler of the @ref cluster#query() and @ref scope#query() operations
 *
 * @since 1.0.0
 * @uncommitted
 */
using query_handler = std::function<void(error, query_result)>;
} // namespace couchbase
