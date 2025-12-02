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

#include <couchbase/common_options.hxx>

#include <cstdint>
#include <functional>
#include <optional>

namespace couchbase
{
struct create_collection_options : public common_options<create_collection_options> {
public:
  /**
   * Immutable value object representing consistent options.
   *
   * @since 1.0.0
   * @internal
   */
  struct built : public common_options<create_collection_options>::built {
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
    return { build_common_options() };
  }
};

/**
 * The settings to use when creating the collection
 */
struct create_collection_settings {
  /**
   * The maximum expiry, in seconds, for documents in this collection. Values greater than or equal
   * to -1 are valid. Value of 0 sets max_expiry to the bucket-level setting and value of -1 to set
   * it as no-expiry.
   */
  std::optional<std::int32_t> max_expiry{};

  /**
   * Whether history retention should be enabled. If unset, the bucket-level setting is used.
   */
  std::optional<bool> history{};
};

using create_collection_handler = std::function<void(error)>;
} // namespace couchbase
