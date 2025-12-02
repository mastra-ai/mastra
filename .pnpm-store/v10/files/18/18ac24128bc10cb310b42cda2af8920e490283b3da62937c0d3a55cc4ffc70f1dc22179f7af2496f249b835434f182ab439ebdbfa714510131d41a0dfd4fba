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

#include "core/service_type.hxx"
#include "core/utils/json_streaming_lexer.hxx"
#include "core/utils/movable_function.hxx"

#include <chrono>
#include <map>
#include <optional>
#include <string>

namespace couchbase::core::io
{

struct streaming_settings {
  std::string pointer_expression;
  std::uint32_t depth;
  std::function<utils::json::stream_control(std::string&& row)> row_handler;
};

struct http_request {
  service_type type;
  std::string method{};
  std::string path;
  std::map<std::string, std::string> headers{};
  std::string body{};
  std::optional<streaming_settings> streaming{};
  std::string client_context_id{}; /* effective client context ID, random-generated or provided in
                                      user's request */
  std::chrono::milliseconds
    timeout{}; /* effective timeout, service default or provided in user's request */
  bool stream_response{};
};

class http_response_body
{
  struct storage {
    std::string data_{};
    std::error_code ec_{};
    std::size_t number_of_rows_{};
  };

public:
  http_response_body()
    : storage_(std::make_shared<storage>())
  {
  }

  void use_json_streaming(streaming_settings&& settings)
  {
    lexer_ =
      std::make_unique<utils::json::streaming_lexer>(settings.pointer_expression, settings.depth);
    lexer_->on_row(std::move(settings.row_handler));
    lexer_->on_complete(
      [storage = storage_](std::error_code ec, std::size_t number_of_rows, std::string&& meta) {
        storage->ec_ = ec;
        storage->number_of_rows_ = number_of_rows;
        storage->data_ = std::move(meta);
      });
  }

  void append(std::string_view chunk)
  {
    if (lexer_) {
      lexer_->feed(chunk);
    } else {
      storage_->data_.append(chunk);
    }
  }

  [[nodiscard]] auto data() const -> const std::string&
  {
    return storage_->data_;
  }

  [[nodiscard]] auto number_of_rows() const -> const std::size_t&
  {
    return storage_->number_of_rows_;
  }

  [[nodiscard]] auto ec() const -> const std::error_code&
  {
    return storage_->ec_;
  }

private:
  std::shared_ptr<storage> storage_{};
  std::unique_ptr<utils::json::streaming_lexer> lexer_{};
};

struct http_response {
  std::uint32_t status_code{ 0 };
  std::string status_message;
  std::map<std::string, std::string> headers;
  http_response_body body{};

  [[nodiscard]] auto must_close_connection() const -> bool
  {
    if (const auto it = headers.find("connection"); it != headers.end()) {
      return it->second == "close";
    }
    return false;
  }
};

} // namespace couchbase::core::io
