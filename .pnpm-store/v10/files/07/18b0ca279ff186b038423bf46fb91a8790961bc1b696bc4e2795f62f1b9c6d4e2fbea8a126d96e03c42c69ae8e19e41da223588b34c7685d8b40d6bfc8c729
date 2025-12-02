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

#include "http_streaming_response.hxx"

#include "core/utils/movable_function.hxx"
#include "http_session.hxx"

#include <couchbase/error_codes.hxx>

#include <cstdint>
#include <map>
#include <memory>
#include <string>
#include <system_error>
#include <utility>

namespace couchbase::core::io
{
class http_streaming_response_body_impl
  : public std::enable_shared_from_this<http_streaming_response_body_impl>
{
public:
  http_streaming_response_body_impl(asio::io_context& io,
                                    std::shared_ptr<http_session> session,
                                    std::string cached_data,
                                    bool reading_complete)
    : session_{ std::move(session) }
    , cached_data_{ std::move(cached_data) }
    , deadline_{ io }
    , reading_complete_{ reading_complete }
  {
  }

  auto close(std::error_code ec)
  {
    if (session_) {
      session_->stop();
    }
    session_ = nullptr;
    final_ec_ = ec;
  }

  void next(utils::movable_function<void(std::string, std::error_code)>&& callback)
  {
    if (!cached_data_.empty()) {
      // Return the cached data & clear the cache
      std::string data;
      std::swap(data, cached_data_);
      callback(std::move(data), {});
      return;
    }
    if (reading_complete_) {
      callback({}, {});
      return;
    }
    if (session_) {
      session_->read_some([self = shared_from_this(), cb = std::move(callback)](
                            std::string data, bool has_more, std::error_code ec) mutable {
        if (!has_more || ec) {
          self->close({});
          if (!ec) {
            self->reading_complete_ = true;
          }
        }
        cb(std::move(data), ec);
      });
      return;
    }
    callback({}, final_ec_);
  }

  void set_deadline(std::chrono::time_point<std::chrono::steady_clock> deadline_tp)
  {
    deadline_.expires_at(deadline_tp);
    deadline_.async_wait([self = shared_from_this()](auto ec) {
      if (ec == asio::error::operation_aborted) {
        return;
      }
      self->close(errc::common::ambiguous_timeout);
    });
  }

private:
  std::shared_ptr<http_session> session_;
  std::string cached_data_;
  std::error_code final_ec_;
  asio::steady_timer deadline_;
  std::atomic_bool reading_complete_{ false };
};

http_streaming_response_body::http_streaming_response_body(asio::io_context& io,
                                                           std::shared_ptr<http_session> session,
                                                           std::string cached_data,
                                                           bool reading_complete)
  : impl_{ std::make_shared<http_streaming_response_body_impl>(io,
                                                               std::move(session),
                                                               std::move(cached_data),
                                                               reading_complete) }
{
}

void
http_streaming_response_body::next(
  utils::movable_function<void(std::string, std::error_code)>&& callback)
{
  impl_->next(std::move(callback));
}

void
http_streaming_response_body::close(std::error_code ec)
{
  impl_->close(ec);
}

void
http_streaming_response_body::set_deadline(
  std::chrono::time_point<std::chrono::steady_clock> deadline_tp)
{
  impl_->set_deadline(deadline_tp);
}

class http_streaming_response_impl
{
public:
  http_streaming_response_impl(std::uint32_t status_code,
                               std::string status_message,
                               std::map<std::string, std::string> headers,
                               http_streaming_response_body body)
    : status_code_{ status_code }
    , status_message_{ std::move(status_message) }
    , headers_{ std::move(headers) }
    , body_{ std::move(body) }
  {
  }

  [[nodiscard]] auto status_code() const -> const std::uint32_t&
  {
    return status_code_;
  }

  [[nodiscard]] auto status_message() const -> const std::string&
  {
    return status_message_;
  }

  [[nodiscard]] auto headers() const -> const std::map<std::string, std::string>&
  {
    return headers_;
  }

  [[nodiscard]] auto body() -> http_streaming_response_body&
  {
    return body_;
  }

  [[nodiscard]] auto must_close_connection() const -> bool
  {
    if (const auto it = headers_.find("connection"); it != headers_.end()) {
      return it->second == "close";
    }
    return false;
  }

private:
  std::uint32_t status_code_;
  std::string status_message_;
  std::map<std::string, std::string> headers_;
  http_streaming_response_body body_;
};

http_streaming_response::http_streaming_response(
  asio::io_context& io,
  const couchbase::core::io::http_streaming_parser& parser,
  std::shared_ptr<http_session> session)
  : impl_{ std::make_shared<http_streaming_response_impl>(
      parser.status_code,
      parser.status_message,
      parser.headers,
      http_streaming_response_body{ io, std::move(session), parser.body_chunk, parser.complete }) }
{
}

auto
http_streaming_response::status_code() const -> const std::uint32_t&
{
  return impl_->status_code();
}

auto
http_streaming_response::status_message() const -> const std::string&
{
  return impl_->status_message();
}

auto
http_streaming_response::headers() const -> const std::map<std::string, std::string>&
{
  return impl_->headers();
}

auto
http_streaming_response::body() -> http_streaming_response_body&
{
  return impl_->body();
}

auto
http_streaming_response::must_close_connection() const -> bool
{
  return impl_->must_close_connection();
}
} // namespace couchbase::core::io
