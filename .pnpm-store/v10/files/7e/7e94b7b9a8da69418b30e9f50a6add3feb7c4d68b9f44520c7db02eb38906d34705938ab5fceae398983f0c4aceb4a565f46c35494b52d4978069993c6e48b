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
#include <system_error>

namespace couchbase::core::impl
{
struct common_error_category : std::error_category {
  [[nodiscard]] auto name() const noexcept -> const char* override
  {
    return "couchbase.common";
  }

  [[nodiscard]] auto message(int ev) const noexcept -> std::string override
  {
    switch (static_cast<errc::common>(ev)) {
      case errc::common::unambiguous_timeout:
        return "unambiguous_timeout (14)";
      case errc::common::ambiguous_timeout:
        return "ambiguous_timeout (13)";
      case errc::common::request_canceled:
        return "request_canceled (2)";
      case errc::common::invalid_argument:
        return "invalid_argument (3)";
      case errc::common::service_not_available:
        return "service_not_available (4)";
      case errc::common::internal_server_failure:
        return "internal_server_failure (5)";
      case errc::common::authentication_failure:
        return "authentication_failure (6)"
               ". Possible reasons: incorrect authentication configuration, bucket doesn't exist "
               "or bucket may be "
               "hibernated.";
      case errc::common::temporary_failure:
        return "temporary_failure (7)";
      case errc::common::parsing_failure:
        return "parsing_failure (8)";
      case errc::common::cas_mismatch:
        return "cas_mismatch (9)";
      case errc::common::bucket_not_found:
        return "bucket_not_found (10)";
      case errc::common::scope_not_found:
        return "scope_not_found (16)";
      case errc::common::collection_not_found:
        return "collection_not_found (11)";
      case errc::common::unsupported_operation:
        return "unsupported_operation (12)";
      case errc::common::feature_not_available:
        return "feature_not_available (15)";
      case errc::common::encoding_failure:
        return "encoding_failure (19)";
      case errc::common::decoding_failure:
        return "decoding_failure (20)";
      case errc::common::index_not_found:
        return "index_not_found (17)";
      case errc::common::index_exists:
        return "index_exists (18)";
      case errc::common::rate_limited:
        return "rate_limited (21)";
      case errc::common::quota_limited:
        return "quota_limited (22)";
    }
    return "FIXME: unknown error code (recompile with newer library): couchbase.common." +
           std::to_string(ev);
  }
};

const inline static common_error_category category_instance;

auto
common_category() noexcept -> const std::error_category&
{
  return category_instance;
}
} // namespace couchbase::core::impl
