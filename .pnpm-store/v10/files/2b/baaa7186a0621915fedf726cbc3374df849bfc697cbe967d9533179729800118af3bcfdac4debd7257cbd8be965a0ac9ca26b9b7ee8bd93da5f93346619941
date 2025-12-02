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

#include <couchbase/endpoint_ping_report.hxx>
#include <couchbase/service_type.hxx>

#include <cstdint>
#include <map>
#include <string>
#include <utility>
#include <vector>

namespace couchbase
{
class ping_result
{
public:
  /**
   * @since 1.0.0
   * @internal
   */
  ping_result() = default;

  /**
   * @since 1.0.0
   * @internal
   */
  ping_result(std::string id,
              std::uint16_t version,
              std::string sdk,
              std::map<service_type, std::vector<endpoint_ping_report>> endpoints)
    : id_{ std::move(id) }
    , version_{ version }
    , sdk_{ std::move(sdk) }
    , endpoints_{ std::move(endpoints) }
  {
  }

  /**
   * Returns the ID of this report.
   *
   * @return the report ID.
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto id() const -> std::string
  {
    return id_;
  }

  /**
   * Returns the version of this report (useful when exporting to JSON).
   *
   * @return the report version.
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto version() const -> std::uint16_t
  {
    return version_;
  }

  /**
   * Returns the identifier of this SDK (useful when exporting to JSON).
   *
   * @return the SDK identifier.
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto sdk() const -> std::string
  {
    return sdk_;
  }

  /**
   * Returns the ping reports for each individual endpoint, organised by service type.
   *
   * @return the service type to ping reports map.
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto endpoints() const -> std::map<service_type, std::vector<endpoint_ping_report>>
  {
    return endpoints_;
  }

  /**
   * Exports the ping report as JSON.
   *
   * @return the JSON report.
   */
  [[nodiscard]] auto as_json() const -> std::string;

private:
  std::string id_{};
  std::uint16_t version_{};
  std::string sdk_{};
  std::map<service_type, std::vector<endpoint_ping_report>> endpoints_{};
};
} // namespace couchbase
