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

#include "core/utils/movable_function.hxx"
#include "dns_config.hxx"

#include <asio/io_context.hpp>

#include <cinttypes>
#include <string>
#include <vector>

namespace couchbase::core::io::dns
{
struct dns_srv_response {
  struct address {
    std::string hostname;
    std::uint16_t port;
  };
  std::error_code ec;
  std::vector<address> targets{};
};

class dns_client
{
public:
  explicit dns_client(asio::io_context& ctx)
    : ctx_(ctx)
  {
  }

  void query_srv(
    const std::string& name,
    const std::string& service,
    const dns_config& config,
    utils::movable_function<void(couchbase::core::io::dns::dns_srv_response&& resp)>&& handler);

  asio::io_context& ctx_;
};
} // namespace couchbase::core::io::dns
