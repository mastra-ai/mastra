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
#include <couchbase/error.hxx>
#include <couchbase/get_result.hxx>

#include <chrono>
#include <functional>
#include <memory>
#include <optional>

namespace couchbase
{
/**
 * Options for collection#get().
 *
 * @since 1.0.0
 * @committed
 */
struct get_options : public common_options<get_options> {
  /**
   * Immutable value object representing consistent options.
   *
   * @since 1.0.0
   * @internal
   */
  struct built : public common_options<get_options>::built {
    const bool with_expiry;
    const std::vector<std::string> projections;
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
    return { build_common_options(), with_expiry_, projections_ };
  }

  /**
   * If set to true, the get will fetch the expiry for the document as well and return it as part of
   * the {@link get_result}.
   *
   * @param return_expiry true if it should be fetched.
   * @return this options builder for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  auto with_expiry(bool return_expiry) -> get_options&
  {
    with_expiry_ = return_expiry;
    return self();
  }

  /**
   * Allows to specify a custom list paths to fetch from the document instead of the whole.
   *
   * @note that a maximum of 16 individual paths can be projected at a time due to a server
   * limitation. If you need more than that, think about fetching less-generic paths or the full
   * document straight away.
   *
   * @param field_paths a list of paths that should be loaded if present.
   * @return this options builder for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  auto project(std::vector<std::string> field_paths) -> get_options&
  {
    projections_ = std::move(field_paths);
    return self();
  }

private:
  bool with_expiry_{ false };
  std::vector<std::string> projections_{};
};

/**
 * The signature for the handler of the @ref collection#get() operation
 *
 * @since 1.0.0
 * @uncommitted
 */
using get_handler = std::function<void(error, get_result)>;
} // namespace couchbase
