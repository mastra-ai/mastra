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

#include <string>

namespace couchbase::core
{
/**
 * Represents extended error information returned by the server in some cases.
 *
 * For instance, it might contain unique identifier used by the server in its logs (reference), or
 * detailed explanation of the cause of the error (context).
 *
 * @since 1.0.0
 * @committed
 */
class key_value_extended_error_info
{
public:
  /**
   * Constructs empty error info.
   *
   * @since 1.0.0
   * @committed
   */
  key_value_extended_error_info() = default;

  /**
   * Constructs error info with given reference and context.
   *
   * @since 1.0.0
   * @committed
   */
  key_value_extended_error_info(std::string reference, std::string context)
    : reference_(std::move(reference))
    , context_(std::move(context))
  {
  }

  /**
   * Returns error reference, that could be used to match the operation in server logs.
   *
   * @return error reference, or empty string
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto reference() const -> const std::string&
  {
    return reference_;
  }

  /**
   * Returns error context, human readable message explaining cause of the error condition.
   *
   * @return error context, or empty string
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto context() const -> const std::string&
  {
    return context_;
  }

private:
  std::string reference_{};
  std::string context_{};
};
} // namespace couchbase::core