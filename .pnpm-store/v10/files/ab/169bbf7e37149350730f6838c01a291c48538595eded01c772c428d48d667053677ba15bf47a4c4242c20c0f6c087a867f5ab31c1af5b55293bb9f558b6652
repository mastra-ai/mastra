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

#include "row_streamer.hxx"

#include <couchbase/error_codes.hxx>

#include "free_form_http_request.hxx"
#include "logger/logger.hxx"
#include "utils/json.hxx"
#include "utils/json_stream_control.hxx"
#include "utils/json_streaming_lexer.hxx"
#include "utils/movable_function.hxx"

#include <asio/experimental/channel_error.hpp>
#include <asio/experimental/concurrent_channel.hpp>
#include <asio/io_context.hpp>

#include <atomic>
#include <memory>
#include <mutex>
#include <string>
#include <system_error>
#include <utility>
#include <variant>

namespace couchbase::core
{
struct row_stream_end_signal {
  std::error_code ec{};
  std::string metadata{};
};

class row_streamer_impl : public std::enable_shared_from_this<row_streamer_impl>
{
public:
  static constexpr std::size_t ROW_BUFFER_SIZE{ 100 };
  static constexpr std::size_t ROW_BUFFER_FEED_THRESHOLD{ ROW_BUFFER_SIZE * 3 / 4 };
  static constexpr std::uint32_t LEXER_DEPTH{ 4 };

  row_streamer_impl(asio::io_context& io,
                    http_response_body body,
                    const std::string& pointer_expression)
    : io_{ io }
    , body_{ std::move(body) }
    , rows_{ io_, ROW_BUFFER_SIZE }
    , lexer_{ pointer_expression, LEXER_DEPTH }
  {
  }

  void start(utils::movable_function<void(std::string, std::error_code)>&& handler)
  {
    lexer_.on_metadata_header_complete(
      [handler = std::move(handler)](auto ec, auto meta_header) mutable {
        // Trim any whitespace from the end
        meta_header.erase(meta_header.find_last_not_of(" \t\f\v\n\r") + 1);

        // The metadata header can end with an open `[` (opening bracket for pointer expression
        // array). If that's the case, close the array and the response object
        if (meta_header[meta_header.length() - 1] == '[') {
          meta_header.append("]}");
        }
        handler(meta_header, ec);
      });
    lexer_.on_row([self = shared_from_this()](std::string&& row) -> utils::json::stream_control {
      self->rows_.async_send({}, std::move(row), [self](auto ec) {
        self->buffered_row_count_++;
        if (ec) {
          if (ec != asio::experimental::error::channel_closed &&
              ec != asio::experimental::error::channel_cancelled) {
            CB_LOG_WARNING(
              "unexpected error while sending to row channel: {} ({})", ec.value(), ec.message());
          }
          return;
        }
      });
      return utils::json::stream_control::next_row;
    });
    lexer_.on_complete([self = shared_from_this()](
                         std::error_code ec, std::size_t /*number_of_rows*/, std::string&& meta) {
      row_stream_end_signal signal{ ec, std::move(meta) };
      self->rows_.async_send({}, std::move(signal), [self](auto ec) {
        if (ec) {
          if (ec != asio::experimental::error::channel_closed &&
              ec != asio::experimental::error::channel_cancelled) {
            CB_LOG_WARNING(
              "unexpected error while sending to row channel: {} ({})", ec.value(), ec.message());
          }
          return;
        }
      });
    });
    maybe_feed_lexer();
  }

  void next_row(utils::movable_function<void(std::string, std::error_code)>&& handler)
  {
    if (!rows_.is_open()) {
      handler({}, errc::common::request_canceled);
      return;
    }
    rows_.async_receive(
      [self = shared_from_this(), handler = std::move(handler)](auto ec, auto row) mutable {
        self->buffered_row_count_--;
        if (ec) {
          if (ec == asio::experimental::error::channel_closed ||
              ec == asio::experimental::error::channel_cancelled) {
            return handler({}, errc::common::request_canceled);
          }
          return handler({}, ec);
        }
        if (std::holds_alternative<row_stream_end_signal>(row)) {
          auto signal = std::get<row_stream_end_signal>(row);
          if (!signal.metadata.empty()) {
            std::lock_guard<std::mutex> const lock{ self->metadata_mutex_ };
            self->metadata_ = std::move(signal.metadata);
          }
          return handler({}, signal.ec);
        }
        auto row_content = std::get<std::string>(row);
        handler(std::move(row_content), {});

        // After receiving a row check if more data needs to be fed into the lexer
        self->maybe_feed_lexer();
        return;
      });
  }

  void cancel()
  {
    body_.cancel();
    rows_.cancel();
    rows_.close();
  }

  auto metadata() -> std::optional<std::string>
  {
    std::lock_guard<std::mutex> const lock{ metadata_mutex_ };
    return metadata_;
  }

private:
  void maybe_feed_lexer()
  {
    if (feeding_ || received_all_data_ || buffered_row_count_ > ROW_BUFFER_FEED_THRESHOLD) {
      return;
    }

    feeding_ = true;

    body_.next([self = shared_from_this()](const auto& data, auto ec) mutable {
      if (ec) {
        self->received_all_data_ = true;
        auto signal = row_stream_end_signal{ ec };
        return self->rows_.async_send({}, std::move(signal), [self](auto ec) {
          if (!ec || ec == asio::experimental::error::channel_cancelled ||
              ec == asio::experimental::error::channel_closed) {
            return;
          }
          CB_LOG_WARNING("unexpected error while sending row stream end signal: {} ({})",
                         ec.value(),
                         ec.message());
        });
      }
      if (data.empty()) {
        self->received_all_data_ = true;
        return;
      }
      {
        const std::lock_guard<std::mutex> lock{ self->data_feed_mutex_ };
        self->lexer_.feed(data);
      }

      self->feeding_ = false;

      return self->maybe_feed_lexer();
    });
  }

  asio::io_context& io_;
  http_response_body body_;
  asio::experimental::concurrent_channel<void(std::error_code,
                                              std::variant<std::string, row_stream_end_signal>)>
    rows_;
  std::atomic_size_t buffered_row_count_{ 0 };
  std::atomic_bool received_all_data_{ false };
  std::atomic_bool feeding_{ false };
  std::optional<std::string> metadata_header_;
  std::optional<std::string> metadata_;
  utils::json::streaming_lexer lexer_;
  std::mutex data_feed_mutex_{};
  std::mutex metadata_mutex_{};
};

row_streamer::row_streamer(asio::io_context& io,
                           couchbase::core::http_response_body body,
                           const std::string& pointer_expression)
  : impl_{ std::make_shared<row_streamer_impl>(io, std::move(body), pointer_expression) }
{
}

void
row_streamer::start(utils::movable_function<void(std::string, std::error_code)>&& handler)
{
  impl_->start(std::move(handler));
}

void
row_streamer::next_row(utils::movable_function<void(std::string, std::error_code)>&& handler)
{
  impl_->next_row(std::move(handler));
}

void
row_streamer::cancel()
{
  impl_->cancel();
}

auto
row_streamer::metadata() -> std::optional<std::string>
{
  return impl_->metadata();
}
} // namespace couchbase::core
