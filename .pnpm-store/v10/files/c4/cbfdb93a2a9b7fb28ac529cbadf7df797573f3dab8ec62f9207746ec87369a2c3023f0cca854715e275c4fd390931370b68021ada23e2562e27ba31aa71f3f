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

#include "http_parser.hxx"

#include <llhttp.h>
#include <spdlog/fmt/bundled/core.h>

#include <algorithm>

namespace
{
inline auto
static_on_status(llhttp_t* parser, const char* at, std::size_t length) -> int
{
  auto* wrapper = static_cast<couchbase::core::io::http_parser*>(parser->data);
  wrapper->response.status_message.assign(at, length);
  wrapper->response.status_code = parser->status_code;
  return 0;
}

inline auto
static_on_header_field(llhttp_t* parser, const char* at, std::size_t length) -> int
{
  auto* wrapper = static_cast<couchbase::core::io::http_parser*>(parser->data);
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
  auto* wrapper = static_cast<couchbase::core::io::http_parser*>(parser->data);
  wrapper->response.headers[wrapper->header_field] = std::string(at, length);
  return 0;
}

inline auto
static_on_body(llhttp_t* parser, const char* at, std::size_t length) -> int
{
  auto* wrapper = static_cast<couchbase::core::io::http_parser*>(parser->data);
  wrapper->response.body.append(std::string_view{ at, length });
  return 0;
}

inline auto
static_on_message_complete(llhttp_t* parser) -> int
{
  auto* wrapper = static_cast<couchbase::core::io::http_parser*>(parser->data);
  wrapper->complete = true;
  return 0;
}
} // namespace

namespace couchbase::core::io
{
struct http_parser_state {
  llhttp_settings_t settings_{};
  llhttp_t parser_{};
};

http_parser::http_parser()
{
  state_ = std::make_shared<http_parser_state>();
  llhttp_settings_init(&state_->settings_);
  state_->settings_.on_status = static_on_status;
  state_->settings_.on_header_field = static_on_header_field;
  state_->settings_.on_header_value = static_on_header_value;
  state_->settings_.on_body = static_on_body;
  state_->settings_.on_message_complete = static_on_message_complete;
  llhttp_init(&state_->parser_, HTTP_RESPONSE, &state_->settings_);
  state_->parser_.data = this;
}

http_parser::http_parser(http_parser&& other) noexcept
  : response(std::move(other.response))
  , header_field(std::move(other.header_field))
  , complete(other.complete)
  , state_(std::move(other.state_))
{
  if (state_) {
    state_->parser_.data = this;
  }
}

auto
http_parser::operator=(http_parser&& other) noexcept -> http_parser&
{
  response = std::move(other.response);
  header_field = std::move(other.header_field);
  complete = other.complete;
  state_ = std::move(other.state_);
  if (state_) {
    state_->parser_.data = this;
  }
  return *this;
}
void
http_parser::reset()
{
  complete = false;
  response = {};
  header_field = {};
  llhttp_init(&state_->parser_, HTTP_RESPONSE, &state_->settings_);
}

auto
http_parser::error_message() const -> const char*
{
  return llhttp_errno_name(llhttp_get_errno(&state_->parser_));
}

auto
http_parser::feed(const char* data, size_t data_len) const -> http_parser::feeding_result
{
  auto error = llhttp_execute(&state_->parser_, data, data_len);
  if (error != HPE_OK) {
    return { true, complete, error_message() };
  }
  return { false, complete };
}
} // namespace couchbase::core::io
