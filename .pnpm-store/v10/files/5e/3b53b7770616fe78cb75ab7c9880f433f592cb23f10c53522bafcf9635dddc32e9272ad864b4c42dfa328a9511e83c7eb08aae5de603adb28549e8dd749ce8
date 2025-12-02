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

#include "http_streaming_parser.hxx"

#include <llhttp.h>

#include <algorithm>
#include <cctype>
#include <memory>
#include <utility>

namespace
{
inline auto
static_on_status(llhttp_t* parser, const char* at, std::size_t length) -> int
{
  auto* wrapper = static_cast<couchbase::core::io::http_streaming_parser*>(parser->data);
  wrapper->status_message.assign(at, length);
  wrapper->status_code = parser->status_code;
  return 0;
}

inline auto
static_on_header_field(llhttp_t* parser, const char* at, std::size_t length) -> int
{
  auto* wrapper = static_cast<couchbase::core::io::http_streaming_parser*>(parser->data);
  wrapper->header_field.assign(at, length);
  std::transform(wrapper->header_field.begin(),
                 wrapper->header_field.end(),
                 wrapper->header_field.begin(),
                 [](unsigned char c) {
                   return std::tolower(c);
                 });
  return 0;
}

inline auto
static_on_header_value(llhttp_t* parser, const char* at, std::size_t length) -> int
{
  auto* wrapper = static_cast<couchbase::core::io::http_streaming_parser*>(parser->data);
  wrapper->headers[wrapper->header_field] = std::string(at, length);
  return 0;
}

inline auto
static_on_headers_complete(llhttp_t* parser) -> int
{
  auto* wrapper = static_cast<couchbase::core::io::http_streaming_parser*>(parser->data);
  wrapper->headers_complete = true;
  return 0;
}

inline auto
static_on_body(llhttp_t* parser, const char* at, std::size_t length) -> int
{
  auto* wrapper = static_cast<couchbase::core::io::http_streaming_parser*>(parser->data);
  wrapper->body_chunk.append(std::string_view{ at, length });
  return 0;
}

inline auto
static_on_message_complete(llhttp_t* parser) -> int
{
  auto* wrapper = static_cast<couchbase::core::io::http_streaming_parser*>(parser->data);
  wrapper->complete = true;
  return 0;
}
} // namespace

namespace couchbase::core::io
{
struct http_streaming_parser_state {
  llhttp_settings_t settings{};
  llhttp_t parser{};
};

http_streaming_parser::http_streaming_parser()
{
  state_ = std::make_shared<http_streaming_parser_state>();
  llhttp_settings_init(&state_->settings);
  state_->settings.on_status = static_on_status;
  state_->settings.on_header_field = static_on_header_field;
  state_->settings.on_header_value = static_on_header_value;
  state_->settings.on_headers_complete = static_on_headers_complete;
  state_->settings.on_body = static_on_body;
  state_->settings.on_message_complete = static_on_message_complete;
  llhttp_init(&state_->parser, HTTP_RESPONSE, &state_->settings);
  state_->parser.data = this;
}

http_streaming_parser::http_streaming_parser(http_streaming_parser&& other) noexcept
  : status_code{ other.status_code }
  , status_message{ std::move(other.status_message) }
  , headers{ std::move(other.headers) }
  , body_chunk{ std::move(other.body_chunk) }
  , header_field{ std::move(other.header_field) }
  , headers_complete{ other.headers_complete }
  , complete{ other.complete }
{
  if (state_) {
    state_->parser.data = this;
  }
}

auto
http_streaming_parser::operator=(couchbase::core::io::http_streaming_parser&& other) noexcept
  -> http_streaming_parser&
{
  status_code = other.status_code;
  status_message = std::move(other.status_message);
  headers = std::move(other.headers);
  body_chunk = std::move(other.body_chunk);
  header_field = std::move(other.header_field);
  headers_complete = other.headers_complete;
  complete = other.complete;
  if (state_) {
    state_->parser.data = this;
  }
  return *this;
}

void
http_streaming_parser::reset()
{
  status_code = {};
  status_message = {};
  headers = {};
  body_chunk = {};
  header_field = {};
  headers_complete = false;
  complete = false;
  llhttp_init(&state_->parser, HTTP_RESPONSE, &state_->settings);
}

auto
http_streaming_parser::error_message() const -> const char*
{
  return llhttp_errno_name(llhttp_get_errno(&state_->parser));
}

auto
http_streaming_parser::feed(const char* data,
                            std::size_t data_len) const -> http_streaming_parser::feeding_result
{
  auto error = llhttp_execute(&state_->parser, data, data_len);
  if (error != HPE_OK) {
    return { true, complete, headers_complete, error_message() };
  }
  return { false, complete, headers_complete };
}
} // namespace couchbase::core::io
