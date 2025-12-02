/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *   Copyright 2023-present Couchbase, Inc.
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

#include <chrono>
#include <cstdint>
#include <optional>
#include <string>

#include <couchbase/service_type.hxx>

namespace couchbase
{
enum class ping_state {
  /**
   * Indicates that the ping operation was successful.
   *
   * @since 1.0.0
   * @committed
   */
  ok,

  /**
   * Indicates that the ping operation timed out.
   *
   * @since 1.0.0
   * @committed
   */
  timeout,

  /**
   * Indicates that the ping operation failed.
   *
   * @since 1.0.0
   * @committed
   */
  error,
};

class endpoint_ping_report
{
public:
  /**
   * @since 1.0.0
   * @internal
   */
  endpoint_ping_report() = default;

  /**
   * @since 1.0.0
   * @internal
   */
  endpoint_ping_report(service_type type,
                       std::string id,
                       std::string local,
                       std::string remote,
                       ping_state state,
                       std::optional<std::string> error,
                       std::optional<std::string> endpoint_namespace,
                       std::chrono::microseconds latency)
    : type_{ type }
    , id_{ std::move(id) }
    , local_{ std::move(local) }
    , remote_{ std::move(remote) }
    , state_{ state }
    , error_{ std::move(error) }
    , namespace_{ std::move(endpoint_namespace) }
    , latency_{ latency }
  {
  }

  /**
   * Returns the service type for this endpoint.
   *
   * @return the service type.
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto type() const -> service_type
  {
    return type_;
  }

  /**
   * Returns the ID for this endpoint.
   *
   * @return the endpoint ID.
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto id() const -> std::string
  {
    return id_;
  }

  /**
   * Returns the local socket address for this endpoint.
   *
   * @return the local socket address.
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto local() const -> std::string
  {
    return local_;
  }

  /**
   * Returns the remote socket address for this endpoint.
   *
   * @return the remote socket address.
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto remote() const -> std::string
  {
    return remote_;
  }

  /**
   * Returns the state of this ping when assembling the report.
   *
   * @return the ping state.
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto state() const -> ping_state
  {
    return state_;
  }

  /**
   * Returns the reason this ping did not succeed, if applicable.
   *
   * @return error description.
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto error() const -> std::optional<std::string>
  {
    return error_;
  }

  /**
   * Returns the namespace of this endpoint (likely the bucket name if present).
   *
   * @return the namespace.
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto endpoint_namespace() const -> std::optional<std::string>
  {
    return namespace_;
  }

  /**
   * Returns the latency of this ping.
   *
   * @return the latency in microseconds.
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto latency() const -> std::chrono::microseconds
  {
    return latency_;
  }

private:
  service_type type_{};
  std::string id_;
  std::string local_;
  std::string remote_;
  ping_state state_{};
  std::optional<std::string> error_{};
  std::optional<std::string> namespace_{};
  std::chrono::microseconds latency_{};
};

} // namespace couchbase
