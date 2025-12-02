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
#include <couchbase/diagnostics_result.hxx>

#include <optional>
#include <utility>

namespace couchbase
{
struct diagnostics_options : public common_options<diagnostics_options> {
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
  auto report_id(std::string report_id) -> diagnostics_options&
  {
    report_id_ = std::move(report_id);
    return self();
  }

  /**
   * Immutable value object representing consistent options.
   *
   * @since 1.0.0
   * @internal
   */
  struct built : public common_options<diagnostics_options>::built {
    std::optional<std::string> report_id;
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
    return { build_common_options(), report_id_ };
  }

private:
  std::optional<std::string> report_id_{};
};

using diagnostics_handler = std::function<void(error, diagnostics_result)>;
} // namespace couchbase
