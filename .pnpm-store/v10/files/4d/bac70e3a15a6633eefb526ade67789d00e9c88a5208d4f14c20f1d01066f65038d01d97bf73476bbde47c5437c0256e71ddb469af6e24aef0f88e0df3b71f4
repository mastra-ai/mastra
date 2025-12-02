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

#pragma once

#include <couchbase/service_type.hxx>

#include <chrono>
#include <optional>
#include <string>
#include <utility>

namespace couchbase
{
enum class endpoint_state {
  /**
   * The endpoint is connected and ready.
   *
   * @since 1.0.0
   * @committed
   */
  connected,

  /**
   * The endpoint is disconnected but trying to connect right now.
   *
   * @since 1.0.0
   * @committed
   */
  connecting,

  /**
   * The endpoint is disconnected (not reachable) and not trying to connect.
   *
   * @since 1.0.0
   * @committed
   */
  disconnected,

  /**
   * The endpoint is currently disconnecting.
   *
   * @since 1.0.0
   * @committed
   */
  disconnecting,
};

class endpoint_diagnostics
{
public:
  endpoint_diagnostics() = default;

  /**
   * @since 1.0.0
   * @internal
   */
  endpoint_diagnostics(service_type type,
                       std::string id,
                       std::optional<std::chrono::microseconds> last_activity,
                       std::string local,
                       std::string remote,
                       std::optional<std::string> endpoint_namespace,
                       endpoint_state state,
                       std::optional<std::string> details)
    : type_{ type }
    , id_{ std::move(id) }
    , last_activity_{ last_activity }
    , local_{ std::move(local) }
    , remote_{ std::move(remote) }
    , namespace_{ std::move(endpoint_namespace) }
    , state_{ state }
    , details_{ std::move(details) }
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
   *
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
   * Returns the time since the last activity, if there has been one.
   *
   * @return the duration since the last activity.
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto last_activity() const -> std::optional<std::chrono::microseconds>
  {
    return last_activity_;
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
   * Returns the current state of the endpoint.
   *
   * @return the endpoint state.
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto state() const -> endpoint_state
  {
    return state_;
  }

  /**
   * Returns any additional details about the endpoint, if available.
   *
   * @return endpoint details.
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto details() const -> std::optional<std::string>
  {
    return details_;
  }

private:
  service_type type_{};
  std::string id_{};
  std::optional<std::chrono::microseconds> last_activity_{};
  std::string local_{};
  std::string remote_{};
  std::optional<std::string> namespace_{};
  endpoint_state state_{};
  std::optional<std::string> details_{};
};
} // namespace couchbase
