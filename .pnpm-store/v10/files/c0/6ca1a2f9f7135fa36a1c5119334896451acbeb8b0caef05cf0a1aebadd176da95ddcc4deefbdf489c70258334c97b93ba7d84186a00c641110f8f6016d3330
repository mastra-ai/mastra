/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *   Copyright 2020-2021 Couchbase, Inc.
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

#include "http_message.hxx"

#include <algorithm>
#include <memory>
#include <string>
#include <string_view>

namespace couchbase::core::io
{
struct http_parser_state;

struct http_parser {
  struct feeding_result {
    bool failure{ false };
    bool complete{ false };
    std::string error{};
  };

  http_response response;
  std::string header_field;
  bool complete{ false };

  http_parser();
  http_parser(http_parser&& other) noexcept;
  auto operator=(http_parser&& other) noexcept -> http_parser&;
  http_parser(const http_parser& other) = delete;
  auto operator=(const http_parser& other) -> http_parser& = delete;

  void reset();

  [[nodiscard]] auto error_message() const -> const char*;

  auto feed(const char* data, size_t data_len) const -> feeding_result;

private:
  std::shared_ptr<http_parser_state> state_{};
};
} // namespace couchbase::core::io
