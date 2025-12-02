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

#include <couchbase/codec/json_transcoder.hxx>
#include <couchbase/query_metrics.hxx>
#include <couchbase/query_status.hxx>
#include <couchbase/query_warning.hxx>

#include <cinttypes>
#include <optional>
#include <vector>

namespace couchbase
{

/**
 * Stores any non-rows results related to the execution of a particular N1QL query.
 *
 * @since 1.0.0
 * @committed
 */
class query_meta_data
{
public:
  /**
   * @since 1.0.0
   * @internal
   */
  query_meta_data() = default;

  /**
   * @since 1.0.0
   * @volatile
   */
  query_meta_data(std::string request_id,
                  std::string client_context_id,
                  query_status status,
                  std::vector<query_warning> warnings,
                  std::optional<query_metrics> metrics,
                  std::optional<codec::binary> signature,
                  std::optional<codec::binary> profile)
    : request_id_{ std::move(request_id) }
    , client_context_id_{ std::move(client_context_id) }
    , status_{ status }
    , warnings_{ std::move(warnings) }
    , metrics_{ std::move(metrics) }
    , signature_{ std::move(signature) }
    , profile_{ std::move(profile) }
  {
  }

  /**
   * Returns the request identifier string of the query request
   *
   * @return The request identifier string
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto request_id() const -> const std::string&
  {
    return request_id_;
  }

  /**
   * Returns the client context identifier string set on the query request.
   *
   * @return client context identifier
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto client_context_id() const -> const std::string&
  {
    return client_context_id_;
  }

  /**
   * Returns the raw query execution status as returned by the query engine
   *
   * @return query execution status
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto status() const -> query_status
  {
    return status_;
  }

  /**
   * Returns any warnings returned by the query engine.
   *
   * It returns an empty vector if no warnings were returned.
   *
   * @return vector of the reported warnings.
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto warnings() const -> const std::vector<query_warning>&
  {
    return warnings_;
  }

  /**
   * Returns the {@link query_metrics} as returned by the query engine if enabled.
   *
   * @return metrics
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto metrics() const -> const std::optional<query_metrics>&
  {
    return metrics_;
  }

  /**
   * Returns the signature as returned by the query engine.
   *
   * @return optional byte string containing JSON encoded signature
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto signature() const -> const std::optional<codec::binary>&
  {
    return signature_;
  }

  /**
   * Returns the profiling information returned by the query engine.
   *
   * @return optional byte string containing JSON encoded profile
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto profile() const -> const std::optional<codec::binary>&
  {
    return profile_;
  }

private:
  std::string request_id_{};
  std::string client_context_id_{};
  query_status status_{};
  std::vector<query_warning> warnings_{};
  std::optional<query_metrics> metrics_{};
  std::optional<codec::binary> signature_{};
  std::optional<codec::binary> profile_{};
};

} // namespace couchbase
