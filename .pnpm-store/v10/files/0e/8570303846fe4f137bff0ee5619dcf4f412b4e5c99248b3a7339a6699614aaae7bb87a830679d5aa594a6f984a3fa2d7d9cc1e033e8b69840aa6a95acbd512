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

struct network_error_category : std::error_category {
  [[nodiscard]] auto name() const noexcept -> const char* override
  {
    return "couchbase.network";
  }

  [[nodiscard]] auto message(int ev) const noexcept -> std::string override
  {
    switch (static_cast<errc::network>(ev)) {
      case errc::network::resolve_failure:
        return "resolve_failure (1001)";
      case errc::network::no_endpoints_left:
        return "no_endpoints_left (1002)";
      case errc::network::handshake_failure:
        return "handshake_failure (1003)";
      case errc::network::protocol_error:
        return "protocol_error (1004)";
      case errc::network::configuration_not_available:
        return "configuration_not_available (1005)";
      case errc::network::cluster_closed:
        return "cluster_closed (1006)";
      case errc::network::end_of_stream:
        return "end_of_stream (1007)";
      case errc::network::need_more_data:
        return "need_more_data (1008)";
      case errc::network::operation_queue_closed:
        return "operation_queue_closed (1009)";
      case errc::network::operation_queue_full:
        return "operation_queue_full (1010)";
      case errc::network::request_already_queued:
        return "request_already_queued (1011)";
      case errc::network::request_cancelled:
        return "request_cancelled (1012)";
      case errc::network::bucket_closed:
        return "bucket_closed (1013)";
    }
    return "FIXME: unknown error code (recompile with newer library): couchbase.network." +
           std::to_string(ev);
  }
};

const inline static network_error_category network_category_instance;

auto
network_category() noexcept -> const std::error_category&
{
  return network_category_instance;
}

} // namespace couchbase::core::impl
