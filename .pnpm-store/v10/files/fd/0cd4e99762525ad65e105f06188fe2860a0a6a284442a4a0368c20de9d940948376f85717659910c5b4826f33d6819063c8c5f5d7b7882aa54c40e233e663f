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
#include <couchbase/error.hxx>
#include <couchbase/error_codes.hxx>

#include <functional>
#include <optional>
#include <string>

namespace couchbase
{
class connect_link_analytics_options : public common_options<connect_link_analytics_options>
{
public:
  /**
   * The name of the dataverse in which the link should be disconnected.
   *
   * defaults to `Default`
   *
   * @param dataverse_name
   * @return reference to this object, for use in chaining
   *
   * @since 1.0.0
   * @committed
   */
  auto dataverse_name(std::string dataverse_name) -> connect_link_analytics_options&
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
  auto link_name(std::string link_name) -> connect_link_analytics_options&
  {
    link_name_ = std::move(link_name);
    return self();
  }

  /**
   * Whether to force link creation even if the bucket UUID changed, for example, due to the bucket
   * being deleted and recreated.
   */
  auto force(bool force) -> connect_link_analytics_options&
  {
    force_ = force;
    return self();
  }

  /**
   * Immutable value object representing consistent options.
   *
   * @since 1.0.0
   * @internal
   */
  struct built : public common_options<connect_link_analytics_options>::built {
    std::optional<std::string> dataverse_name{};
    std::optional<std::string> link_name{};
    bool force{ false };
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
    return { build_common_options(), dataverse_name_, link_name_, force_ };
  }

private:
  bool force_{ false };
  std::optional<std::string> dataverse_name_{};
  std::optional<std::string> link_name_{};
};

/**
 * The signature for the handler of the @ref analytics_index_manager#connect_link() operation
 *
 * @since 1.0.0
 * @uncommitted
 */
using connect_link_analytics_handler = std::function<void(error)>;
} // namespace couchbase
