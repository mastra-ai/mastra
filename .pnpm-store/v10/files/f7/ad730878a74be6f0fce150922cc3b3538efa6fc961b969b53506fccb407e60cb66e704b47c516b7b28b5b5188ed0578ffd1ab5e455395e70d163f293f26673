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

#include <couchbase/transactions/transaction_get_result.hxx>

#include <core/transactions/transaction_get_result.hxx>
#include <couchbase/codec/encoded_value.hxx>

namespace couchbase::transactions
{

transaction_get_result::transaction_get_result()
  : base_(std::make_shared<couchbase::core::transactions::transaction_get_result>())
{
}

auto
transaction_get_result::content() const -> const codec::encoded_value&
{
  return base_->content();
}

auto
transaction_get_result::id() const -> const std::string&
{
  return base_->key();
}

// FIXME(SA): cppcheck complains about returning temporary strings in the
// functions below, but it is not clear where does it see temporary here,
// as all calls go down to the member fields of the base_.
//
// Curiously it does not complain about the base_->key()

auto
transaction_get_result::bucket() const -> const std::string&
{
  return base_->bucket(); // cppcheck-suppress returnTempReference
}

auto
transaction_get_result::scope() const -> const std::string&
{
  return base_->scope(); // cppcheck-suppress returnTempReference
}

auto
transaction_get_result::collection() const -> const std::string&
{
  return base_->collection(); // cppcheck-suppress returnTempReference
}

auto
transaction_get_result::cas() const -> couchbase::cas
{
  return base_->cas();
}
} // namespace couchbase::transactions
