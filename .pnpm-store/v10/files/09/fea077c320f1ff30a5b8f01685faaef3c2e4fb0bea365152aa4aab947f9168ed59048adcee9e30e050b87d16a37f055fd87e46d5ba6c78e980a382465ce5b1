/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *   Copyright 2024. Couchbase, Inc.
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

#include "error_codes.hxx"

#include <string>
#include <system_error>

namespace couchbase::core::columnar
{
struct columnar_error_category : std::error_category {
  [[nodiscard]] auto name() const noexcept -> const char* override
  {
    return "couchbase.core.columnar.errc";
  }

  [[nodiscard]] auto message(int ev) const noexcept -> std::string override
  {
    switch (static_cast<errc>(ev)) {
      case errc::generic:
        return "generic_columnar_error";
      case errc::invalid_credential:
        return "invalid_credential";
      case errc::timeout:
        return "timeout";
      case errc::query_error:
        return "query_error";
    }
    return "FIXME: unknown error code (recompile with newer library): "
           "couchbase.core.columnar.errc." +
           std::to_string(ev);
  }
};

const inline static columnar_error_category columnar_category_instance;

auto
columnar_category() noexcept -> const std::error_category&
{
  return columnar_category_instance;
}

struct columnar_client_error_category : std::error_category {
  [[nodiscard]] auto name() const noexcept -> const char* override
  {
    return "couchbase.core.columnar.client_errc";
  }

  [[nodiscard]] auto message(int ev) const noexcept -> std::string override
  {
    switch (static_cast<client_errc>(ev)) {
      case client_errc::canceled:
        return "canceled";
      case client_errc::cluster_closed:
        return "cluster_closed";
      case client_errc::invalid_argument:
        return "invalid_argument";
    }
    return "FIXME: unknown error code (recompile with newer library): "
           "couchbase.core.columnar.client_errc" +
           std::to_string(ev);
  }
};

const inline static columnar_client_error_category columnar_client_category_instance;

auto
columnar_client_category() noexcept -> const std::error_category&
{
  return columnar_client_category_instance;
}

auto
maybe_convert_error_code(std::error_code e) -> std::error_code
{
  if (e == couchbase::errc::common::unambiguous_timeout ||
      e == couchbase::errc::common::ambiguous_timeout) {
    return errc::timeout;
  }
  if (e == couchbase::errc::common::request_canceled) {
    return client_errc::canceled;
  }
  if (e == couchbase::errc::network::cluster_closed) {
    return client_errc::cluster_closed;
  }
  if (e == couchbase::errc::common::invalid_argument) {
    return client_errc::invalid_argument;
  }
  return e;
}
} // namespace couchbase::core::columnar
