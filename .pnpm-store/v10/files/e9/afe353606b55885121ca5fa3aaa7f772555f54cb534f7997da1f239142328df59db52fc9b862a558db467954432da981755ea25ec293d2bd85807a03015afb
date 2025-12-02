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

#include <couchbase/common_options.hxx>
#include <couchbase/ping_result.hxx>
#include <couchbase/service_type.hxx>

#include <functional>
#include <memory>
#include <optional>
#include <set>
#include <string>

namespace couchbase
{
struct ping_options : public common_options<ping_options> {
  /**
   * Sets a custom report ID that will be used in the report. If no report ID is provided, the
   * client will generate a unique one.
   *
   * @param report_id the report ID that should be used.
   * @return reference to this object, for use in chaining.
   *
   * @since 1.0.0
   * @committed
   */
  auto report_id(std::string report_id) -> ping_options&
  {
    report_id_ = std::move(report_id);
    return self();
  }

  /**
   * Customizes the set of services to ping.
   *
   * @param service_types the services to ping.
   * @return reference to this object, for use in chaining.
   */
  auto service_types(std::set<service_type> service_types) -> ping_options&
  {
    service_types_ = std::move(service_types);
    return self();
  }

  /**
   * Immutable value object representing consistent options.
   *
   * @since 1.0.0
   * @internal
   */
  struct built : public common_options<ping_options>::built {
    std::optional<std::string> report_id;
    std::set<service_type> service_types;
  };

  /**
   * Validates the options and returns them as an immutable value.
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
    return { build_common_options(), report_id_, service_types_ };
  }

private:
  std::optional<std::string> report_id_{};
  std::set<service_type> service_types_{};
};

using ping_handler = std::function<void(error, ping_result)>;
} // namespace couchbase
