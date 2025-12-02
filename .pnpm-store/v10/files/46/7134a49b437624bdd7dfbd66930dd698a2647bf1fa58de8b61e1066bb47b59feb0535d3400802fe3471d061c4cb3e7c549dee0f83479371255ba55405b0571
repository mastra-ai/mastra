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

struct query_error_category : std::error_category {
  [[nodiscard]] auto name() const noexcept -> const char* override
  {
    return "couchbase.query";
  }

  [[nodiscard]] auto message(int ev) const noexcept -> std::string override
  {
    switch (static_cast<errc::query>(ev)) {
      case errc::query::planning_failure:
        return "planning_failure (201)";
      case errc::query::index_failure:
        return "index_failure (202)";
      case errc::query::prepared_statement_failure:
        return "prepared_statement_failure (203)";
      case errc::query::dml_failure:
        return "dml_failure (204)";
    }
    return "FIXME: unknown error code (recompile with newer library): couchbase.query." +
           std::to_string(ev);
  }
};

const inline static query_error_category query_category_instance;

auto
query_category() noexcept -> const std::error_category&
{
  return query_category_instance;
}

} // namespace couchbase::core::impl
