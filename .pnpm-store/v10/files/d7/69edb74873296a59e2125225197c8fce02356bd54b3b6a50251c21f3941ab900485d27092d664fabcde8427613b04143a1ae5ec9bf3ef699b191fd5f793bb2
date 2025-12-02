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

#include <couchbase/analytics_result.hxx>
#include <couchbase/analytics_scan_consistency.hxx>
#include <couchbase/common_options.hxx>
#include <couchbase/error.hxx>
#include <couchbase/mutation_state.hxx>

#include <chrono>
#include <functional>
#include <map>
#include <optional>

namespace couchbase
{

namespace codec
{
class tao_json_serializer;
} // namespace codec

/**
 * Options for cluster#analytics_query() and scope#analytics_query().
 *
 * @since 1.0.0
 * @committed
 */
struct analytics_options : public common_options<analytics_options> {
  /**
   * Immutable value object representing consistent options.
   *
   * @since 1.0.0
   * @internal
   */
  struct built : public common_options<analytics_options>::built {
    std::optional<std::string> client_context_id;
    const bool priority;
    const bool readonly;
    std::optional<analytics_scan_consistency> scan_consistency;
    std::optional<std::chrono::milliseconds> scan_wait;
    std::vector<mutation_token> mutation_state;
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
      client_context_id_,
      priority_,
      readonly_,
      scan_consistency_,
      scan_wait_,
      mutation_state_,
      positional_parameters_,
      named_parameters_,
      raw_,
    };
  }

  /**
   * Allows to give certain requests higher priority than others.
   *
   * @param prioritized if set to true this query will be treated with a higher priority by the
   * service.
   * @return this options builder for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  auto priority(bool prioritized) -> analytics_options&
  {
    priority_ = prioritized;
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
   * @param readonly true if readonly should be set, false is the default and will use the server
   * side default.
   * @return this options builder for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  auto readonly(bool readonly) -> analytics_options&
  {
    readonly_ = readonly;
    return self();
  }

  /**
   * Allows customizing how long the query engine is willing to wait until the index catches up to
   * whatever scan consistency is asked for in this query.
   *
   * @note that if {@link analytics_scan_consistency::not_bounded} is used, this method doesn't do
   * anything at all. If no value is provided to this method, the server default is used.
   *
   * @param wait the maximum duration the query engine is willing to wait before failing.
   * @return this options builder for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  auto scan_wait(std::chrono::milliseconds wait) -> analytics_options&
  {
    if (scan_consistency_ == analytics_scan_consistency::not_bounded) {
      scan_wait_.reset();
    } else {
      scan_wait_ = wait;
    }
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
  auto client_context_id(std::string client_context_id) -> analytics_options&
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
   * {@link analytics_scan_consistency::not_bounded} is used, which means that the server returns
   * the data it has in the index right away. This is fast, but might not include the most recent
   * mutations. If you want to include all the mutations up to the point of the query, use {@link
   * analytics_scan_consistency::request_plus}.
   *
   * Note that you cannot use this method and {@link #consistent_with(const mutation_state&)} at the
   * same time, since they are mutually exclusive. As a rule of thumb, if you only care to be
   * consistent with the mutation you just wrote on the same thread/app, use
   * {@link #consistent_with(const mutation_state&)}. If you need "global" scan consistency, use
   * {@link analytics_scan_consistency::request_plus} on this method.
   *
   * @param scan_consistency the index scan consistency to be used for this query
   * @return this options builder for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  auto scan_consistency(analytics_scan_consistency scan_consistency) -> analytics_options&
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
   * Note that you cannot use this method and {@link #scan_consistency(analytics_scan_consistency)}
   * at the same time, since they are mutually exclusive. As a rule of thumb, if you only care to be
   * consistent with the mutation you just wrote on the same thread/app, use this method. If you
   * need "global" scan consistency, use
   * {@link analytics_scan_consistency#request_plus} on {@link
   * #scan_consistency(analytics_scan_consistency)}.
   *
   * @param state the mutation state containing the mutation tokens.
   * @return this options builder for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  auto consistent_with(const mutation_state& state) -> analytics_options&
  {
    mutation_state_ = state.tokens();
    scan_consistency_.reset();
    return self();
  }

  /**
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
  auto raw(std::string name, const Value& value) -> analytics_options&
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
  auto positional_parameters(const Parameters&... parameters) -> analytics_options&
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
  auto named_parameters(const Parameters&... parameters) -> analytics_options&
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
  auto add_positional_parameter(const Parameter& parameter) -> analytics_options&
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
  auto add_named_parameter(const std::string& name, const Value& value) -> analytics_options&
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
  auto clear_positional_parameters() -> analytics_options&
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
  auto clear_named_parameters() -> analytics_options&
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
    -> analytics_options&
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
  auto encoded_positional_parameters(std::vector<codec::binary> parameters) -> analytics_options&
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
    -> analytics_options&
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
      std::move(Serializer::template serialize<Parameter>(parameter)));
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

  bool priority_{ true };
  bool readonly_{ false };
  std::optional<std::string> client_context_id_{};
  std::optional<std::chrono::milliseconds> scan_wait_{};
  std::optional<analytics_scan_consistency> scan_consistency_{};
  std::vector<mutation_token> mutation_state_{};
  std::vector<codec::binary> positional_parameters_{};
  std::map<std::string, codec::binary, std::less<>> raw_{};
  std::map<std::string, codec::binary, std::less<>> named_parameters_{};
};

/**
 * The signature for the handler of the @ref cluster#analytics_query() and @ref
 * scope#analytics_query() operations
 *
 * @since 1.0.0
 * @uncommitted
 */
using analytics_handler = std::function<void(error, analytics_result)>;
} // namespace couchbase
