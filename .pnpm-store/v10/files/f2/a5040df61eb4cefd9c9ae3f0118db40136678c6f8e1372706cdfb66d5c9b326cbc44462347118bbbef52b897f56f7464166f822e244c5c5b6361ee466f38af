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

#include "json_stream_control.hxx"

#include <couchbase/error_codes.hxx>

#include "movable_function.hxx"

#include <cstdint>
#include <functional>
#include <memory>
#include <string>

namespace couchbase::core::utils::json
{
namespace detail
{
struct streaming_lexer_impl;
} // namespace detail

/**
 * The streaming JSON lexer consumes chunks of data, and invokes given handler for each "row", and
 * "complete".
 *
 * It is guaranteed that on_complete callback will be invoked exactly once.
 */
class streaming_lexer
{
public:
  /**
   * @param pointer_expression expression that describes where the "row" objects are located.
   * @param depth stop emitting JSON events starting from this depth. Level 1 is root of the object.
   *
   * @throws std::invalid_argument if pointer cannot be created from the expression.
   */
  streaming_lexer(const std::string& pointer_expression, std::uint32_t depth);

  void feed(std::string_view data);

  void on_metadata_header_complete(
    utils::movable_function<void(std::error_code ec, std::string&& meta_header)> handler);
  void on_complete(
    std::function<void(std::error_code ec, std::size_t number_of_rows, std::string&& meta)>
      handler);
  void on_row(std::function<stream_control(std::string&& row)> handler);

private:
  std::shared_ptr<detail::streaming_lexer_impl> impl_{};
};
} // namespace couchbase::core::utils::json
