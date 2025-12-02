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
#include <couchbase/error_codes.hxx>

#include <functional>
#include <optional>
#include <string>

namespace couchbase
{
class disconnect_link_analytics_options : public common_options<disconnect_link_analytics_options>
{
public:
  /**
   * The name of the dataverse to connect to.
   *
   * defaults to `Default`
   *
   * @param dataverse_name
   * @return reference to this object, for use in chaining
   *
   * @since 1.0.0
   * @committed
   */
  auto dataverse_name(std::string dataverse_name) -> disconnect_link_analytics_options&
  {
    dataverse_name_ = std::move(dataverse_name);
    return self();
  }

  /**
   * The name of the link
   *
   * defaults to `Local`
   *
   * @param link_name
   * @return reference to this object, for use in chaining
   *
   * @since 1.0.0
   * @committed
   */
  auto link_name(std::string link_name) -> disconnect_link_analytics_options&
  {
    link_name_ = std::move(link_name);
    return self();
  }

  /**
   * Immutable value object representing consistent options.
   *
   * @since 1.0.0
   * @internal
   */
  struct built : public common_options<disconnect_link_analytics_options>::built {
    std::optional<std::string> dataverse_name{};
    std::optional<std::string> link_name{};
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
    return { build_common_options(), dataverse_name_, link_name_ };
  }

private:
  std::optional<std::string> dataverse_name_{};
  std::optional<std::string> link_name_{};
};

/**
 * The signature for the handler of the @ref analytics_index_manager#disconnect_link() operation
 *
 * @since 1.0.0
 * @uncommitted
 */
using disconnect_link_analytics_handler = std::function<void(error)>;
} // namespace couchbase
