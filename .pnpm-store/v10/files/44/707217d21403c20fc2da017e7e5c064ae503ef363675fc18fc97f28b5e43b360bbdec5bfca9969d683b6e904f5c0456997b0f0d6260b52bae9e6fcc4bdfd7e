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

#include <chrono>
#include <cstdint>
#include <optional>
#include <string>

namespace couchbase
{
class dns_options
{
public:
  static constexpr std::chrono::milliseconds default_timeout{ 500 };

  auto timeout(std::chrono::milliseconds duration) -> dns_options&
  {
    timeout_ = duration;
    return *this;
  }

  auto nameserver(std::string hostname, std::uint16_t port = 53) -> dns_options&
  {
    nameserver_ = hostname;
    port_ = port;
    return *this;
  }

  struct built {
    std::chrono::milliseconds timeout;
    std::optional<std::string> nameserver;
    std::optional<std::uint16_t> port;
  };

  [[nodiscard]] auto build() const -> built
  {
    return {
      timeout_,
      nameserver_,
      port_,
    };
  }

private:
  std::chrono::milliseconds timeout_{ default_timeout };
  std::optional<std::string> nameserver_{};
  std::optional<std::uint16_t> port_{};
};
} // namespace couchbase
