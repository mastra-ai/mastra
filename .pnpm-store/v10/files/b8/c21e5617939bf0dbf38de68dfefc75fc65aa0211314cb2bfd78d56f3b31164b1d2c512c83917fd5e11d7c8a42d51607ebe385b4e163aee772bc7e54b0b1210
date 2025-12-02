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

struct search_error_category : std::error_category {
  [[nodiscard]] auto name() const noexcept -> const char* override
  {
    return "couchbase.search";
  }

  [[nodiscard]] auto message(int ev) const noexcept -> std::string override
  {
    switch (static_cast<errc::search>(ev)) {
      case errc::search::index_not_ready:
        return "index_not_ready (401)";
      case errc::search::consistency_mismatch:
        return "consistency_mismatch (402)";
    }
    return "FIXME: unknown error code (recompile with newer library): couchbase.search." +
           std::to_string(ev);
  }
};

const inline static search_error_category category_instance;

auto
search_category() noexcept -> const std::error_category&
{
  return category_instance;
}

} // namespace couchbase::core::impl
