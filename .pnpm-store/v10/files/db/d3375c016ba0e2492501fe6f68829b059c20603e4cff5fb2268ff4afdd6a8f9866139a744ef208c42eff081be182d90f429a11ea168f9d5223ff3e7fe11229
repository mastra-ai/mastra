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

#pragma once

#include "http_message.hxx"

#include <map>
#include <memory>
#include <string>

namespace couchbase::core::io
{
struct http_streaming_parser_state;

struct http_streaming_parser {
  struct feeding_result {
    bool failure{ false };
    bool complete{ false };
    bool headers_complete{ false };
    std::string error{};
  };

  std::uint32_t status_code{};
  std::string status_message{};
  std::map<std::string, std::string> headers{};
  std::string body_chunk{};

  std::string header_field{};
  bool headers_complete{ false };
  bool complete{ false };

  http_streaming_parser();
  http_streaming_parser(http_streaming_parser&& other) noexcept;
  http_streaming_parser& operator=(http_streaming_parser&& other) noexcept;
  http_streaming_parser(const http_streaming_parser& other) = delete;
  http_streaming_parser& operator=(const http_streaming_parser& other) = delete;

  void reset();

  [[nodiscard]] const char* error_message() const;

  feeding_result feed(const char* data, std::size_t data_len) const;

private:
  std::shared_ptr<http_streaming_parser_state> state_{};
};
} // namespace couchbase::core::io
