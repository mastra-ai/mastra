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

struct management_error_category : std::error_category {
  [[nodiscard]] auto name() const noexcept -> const char* override
  {
    return "couchbase.management";
  }

  [[nodiscard]] auto message(int ev) const noexcept -> std::string override
  {
    switch (static_cast<errc::management>(ev)) {
      case errc::management::collection_exists:
        return "collection_exists (601)";
      case errc::management::scope_exists:
        return "scope_exists (602)";
      case errc::management::user_not_found:
        return "user_not_found (603)";
      case errc::management::group_not_found:
        return "group_not_found (604)";
      case errc::management::user_exists:
        return "user_exists (606)";
      case errc::management::bucket_exists:
        return "bucket_exists (605)";
      case errc::management::bucket_not_flushable:
        return "bucket_not_flushable (607)";
      case errc::management::eventing_function_not_found:
        return "eventing_function_not_found (608)";
      case errc::management::eventing_function_not_deployed:
        return "eventing_function_not_deployed (609)";
      case errc::management::eventing_function_compilation_failure:
        return "eventing_function_compilation_failure (610)";
      case errc::management::eventing_function_identical_keyspace:
        return "eventing_function_identical_keyspace (611)";
      case errc::management::eventing_function_not_bootstrapped:
        return "eventing_function_not_bootstrapped (612)";
      case errc::management::eventing_function_deployed:
        return "eventing_function_deployed (613)";
      case errc::management::eventing_function_paused:
        return "eventing_function_paused (614)";
    }
    return "FIXME: unknown error code (recompile with newer library): couchbase.key_value." +
           std::to_string(ev);
  }
};

const inline static management_error_category category_instance;

auto
management_category() noexcept -> const std::error_category&
{
  return category_instance;
}

} // namespace couchbase::core::impl
