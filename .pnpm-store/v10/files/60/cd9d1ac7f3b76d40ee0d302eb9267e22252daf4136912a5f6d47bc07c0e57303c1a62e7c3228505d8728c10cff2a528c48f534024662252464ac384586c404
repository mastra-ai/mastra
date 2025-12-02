/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 * Copyright 2024-Present Couchbase, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file
 * except in compliance with the License. You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF
 * ANY KIND, either express or implied. See the License for the specific language governing
 * permissions and limitations under the License.
 */

#pragma once

#include <gsl/span>

#include <cstddef>
#include <memory>
#include <string>
#include <string_view>
#include <vector>

namespace couchbase::core
{
class websocket_codec;
class websocket_handler;

class websocket_callbacks
{
public:
  websocket_callbacks() = default;
  websocket_callbacks(const websocket_callbacks&) = default;
  websocket_callbacks(websocket_callbacks&&) noexcept = default;
  auto operator=(const websocket_callbacks&) -> websocket_callbacks& = default;
  auto operator=(websocket_callbacks&&) noexcept -> websocket_callbacks& = default;
  virtual ~websocket_callbacks() = default;

  virtual void on_text(const websocket_codec& ws, gsl::span<std::byte> payload) = 0;
  virtual void on_binary(const websocket_codec& ws, gsl::span<std::byte> payload) = 0;
  virtual void on_ping(const websocket_codec& ws, gsl::span<std::byte> payload) = 0;
  virtual void on_pong(const websocket_codec& ws, gsl::span<std::byte> payload) = 0;
  virtual void on_close(const websocket_codec& ws, gsl::span<std::byte> payload) = 0;

  virtual void on_ready(const websocket_codec& ws) = 0;
  virtual void on_error(const websocket_codec& ws, const std::string& message) = 0;
};

class websocket_codec
{
public:
  explicit websocket_codec(websocket_callbacks* callbacks);
  websocket_codec(const websocket_codec&) = delete;
  websocket_codec(websocket_codec&&) = delete;
  auto operator=(const websocket_codec&) -> websocket_codec& = delete;
  auto operator=(websocket_codec&&) noexcept -> websocket_codec& = delete;
  ~websocket_codec();

  [[nodiscard]] auto session_key() const -> const std::string&;

  void feed(gsl::span<std::byte> chunk);
  void feed(std::string_view chunk);

  [[nodiscard]] auto text(std::string_view message) const -> std::vector<std::byte>;
  [[nodiscard]] auto binary(gsl::span<std::byte> message) const -> std::vector<std::byte>;
  [[nodiscard]] auto ping(gsl::span<std::byte> message = {}) const -> std::vector<std::byte>;
  [[nodiscard]] auto pong(gsl::span<std::byte> message = {}) const -> std::vector<std::byte>;
  [[nodiscard]] auto close(gsl::span<std::byte> message) const -> std::vector<std::byte>;

private:
  std::string session_key_;
  websocket_callbacks* callbacks_;
  std::unique_ptr<websocket_handler> handler_;
};
} // namespace couchbase::core
