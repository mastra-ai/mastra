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

#include <couchbase/retry_reason.hxx>

#include <cstdint>
#include <optional>
#include <set>
#include <string>
#include <system_error>

namespace couchbase::core::error_context
{

struct http {
  std::error_code ec{};
  std::string client_context_id{};

  std::string method{};
  std::string path{};
  std::uint32_t http_status{};
  std::string http_body{};
  std::string hostname{};
  std::uint16_t port{};

  std::optional<std::string> last_dispatched_to{};
  std::optional<std::string> last_dispatched_from{};
  std::size_t retry_attempts{ 0 };
  std::set<retry_reason> retry_reasons{};
};

} // namespace couchbase::core::error_context
