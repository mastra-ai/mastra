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

#include "base_error_context.hxx"
#include "transaction_op_error_context.hxx"

namespace couchbase::core
{
class transaction_error_context
{
public:
  transaction_error_context() = default;
  transaction_error_context(std::error_code ec, std::error_code cause)
    : ec_(ec)
    , cause_(cause)
  {
  }

  [[nodiscard]] std::error_code ec() const
  {
    return ec_;
  }

  [[nodiscard]] std::error_code cause() const
  {
    return cause_;
  }

private:
  std::error_code ec_{};    // a transaction error_code
  std::error_code cause_{}; // a transaction_op error_code
};
} // namespace couchbase::core
