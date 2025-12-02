/*
 *     Copyright 2021-Present Couchbase, Inc.
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

#include <couchbase/transactions/transaction_get_multi_mode.hxx>

namespace couchbase
{
namespace core::transactions
{
class attempt_context_impl;
} // namespace core::transactions

namespace transactions
{
class transaction_get_multi_options
{
public:
  auto mode(transaction_get_multi_mode mode) -> transaction_get_multi_options&
  {
    mode_ = mode;
    return *this;
  }

private:
  friend class core::transactions::attempt_context_impl;

  transaction_get_multi_mode mode_{ transaction_get_multi_mode::prioritise_latency };
};
} // namespace transactions
} // namespace couchbase
