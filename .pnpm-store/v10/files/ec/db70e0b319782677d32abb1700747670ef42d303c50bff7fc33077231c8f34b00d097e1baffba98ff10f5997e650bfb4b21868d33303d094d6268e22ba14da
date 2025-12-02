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

#include <couchbase/error_codes.hxx>

#include <string>
namespace couchbase::core::impl
{

struct transaction_error_category : std::error_category {
  [[nodiscard]] auto name() const noexcept -> const char* override
  {
    return "couchbase.transaction";
  }

  [[nodiscard]] auto message(int ev) const noexcept -> std::string override
  {
    switch (static_cast<errc::transaction>(ev)) {
      case errc::transaction::failed:
        return "transaction failed (1200)";
      case errc::transaction::expired:
        return "transaction expired (1201)";
      case errc::transaction::failed_post_commit:
        return "transaction failed post-commit (1202)";
      case errc::transaction::ambiguous:
        return "transaction commit ambiguous (1203)";
    }
    return "FIXME: unknown error code (recompile with newer library): couchbase.transaction." +
           std::to_string(ev);
  }
};

const inline static transaction_error_category transaction_category_instance;

auto
transaction_category() noexcept -> const std::error_category&
{
  return transaction_category_instance;
}

} // namespace couchbase::core::impl
