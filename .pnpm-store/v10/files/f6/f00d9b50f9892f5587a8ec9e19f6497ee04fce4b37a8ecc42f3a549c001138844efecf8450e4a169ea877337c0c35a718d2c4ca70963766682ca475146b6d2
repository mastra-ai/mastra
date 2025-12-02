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

#include <couchbase/analytics_metrics.hxx>
#include <couchbase/analytics_status.hxx>
#include <couchbase/analytics_warning.hxx>
#include <couchbase/codec/encoded_value.hxx>

#include <cinttypes>
#include <optional>
#include <string>
#include <vector>

namespace couchbase
{

/**
 * Stores any non-rows results related to the execution of a particular Analytics query.
 *
 * @since 1.0.0
 * @committed
 */
class analytics_meta_data
{
public:
  /**
   * @since 1.0.0
   * @internal
   */
  analytics_meta_data() = default;

  /**
   * @since 1.0.0
   * @volatile
   */
  analytics_meta_data(std::string request_id,
                      std::string client_context_id,
                      analytics_status status,
                      std::vector<analytics_warning> warnings,
                      analytics_metrics metrics,
                      std::optional<codec::binary> signature)
    : request_id_{ std::move(request_id) }
    , client_context_id_{ std::move(client_context_id) }
    , status_{ status }
    , warnings_{ std::move(warnings) }
    , metrics_{ std::move(metrics) }
    , signature_{ std::move(signature) }
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
  [[nodiscard]] auto status() const -> analytics_status
  {
    return status_;
  }

  /**
   * Returns any warnings returned by the analytics engine.
   *
   * It returns an empty vector if no warnings were returned.
   *
   * @return vector of the reported warnings.
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto warnings() const -> const std::vector<analytics_warning>&
  {
    return warnings_;
  }

  /**
   * Returns the {@link analytics_metrics} as returned by the analytics engine if enabled.
   *
   * @return metrics
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto metrics() const -> const analytics_metrics&
  {
    return metrics_;
  }

  /**
   * Returns the signature as returned by the analytics engine.
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

private:
  std::string request_id_{};
  std::string client_context_id_{};
  analytics_status status_{};
  std::vector<analytics_warning> warnings_{};
  analytics_metrics metrics_{};
  std::optional<codec::binary> signature_{};
};

} // namespace couchbase
