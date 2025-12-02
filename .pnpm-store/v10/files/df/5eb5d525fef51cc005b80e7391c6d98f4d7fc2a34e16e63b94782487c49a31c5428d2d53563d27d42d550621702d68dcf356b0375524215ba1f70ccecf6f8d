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

#include "core/error_context/key_value_error_context.hxx"
#include "core/error_context/query_error_context.hxx"

#include <variant>

namespace couchbase::core
{
class transaction_op_error_context
{
public:
  transaction_op_error_context() = default;

  transaction_op_error_context(std::error_code ec)
    : ec_(ec)
  {
  }

  transaction_op_error_context(std::error_code ec, key_value_error_context cause)
    : ec_(ec)
    , cause_(std::move(cause))
  {
  }

  transaction_op_error_context(std::error_code ec, query_error_context cause)
    : ec_(ec)
    , cause_(std::move(cause))
  {
  }

  /**
   * The error_code associated with this error context.
   *
   * Note that some query errors are not _transaction_ errors, so this error code will be 0, but
   * there will be a @ref cause() with a @ref query_error_context in it.  These errors do not
   * rollback a transaction.   If you want to roll it back, raise an exception.
   *
   * @return a error code, if any.
   */
  [[nodiscard]] std::error_code ec() const
  {
    return ec_;
  }

  /**
   * The underlying cause of this error.   This can be either a @ref key_value_error_context or a
   * @ref query_error_context.
   *
   * @return the error_context associated with the underlying cause of this error.
   */
  [[nodiscard]] std::variant<std::monostate, key_value_error_context, query_error_context> cause()
    const
  {
    return cause_;
  }

private:
  std::error_code ec_{}; // a transaction_op error_code
  std::variant<std::monostate, key_value_error_context, query_error_context> cause_{};
};
} // namespace couchbase::core
