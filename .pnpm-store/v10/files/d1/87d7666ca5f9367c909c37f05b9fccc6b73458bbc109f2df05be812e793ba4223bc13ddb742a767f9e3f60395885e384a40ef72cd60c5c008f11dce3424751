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

#include "core/cluster_options.hxx"

#include <map>
#include <optional>
#include <string>
#include <vector>

namespace couchbase::core::utils
{

struct connection_string {
  enum class bootstrap_mode {
    unspecified,
    gcccp,
    http,
  };

  enum class address_type {
    ipv4,
    ipv6,
    dns,
  };

  struct node {
    std::string address;
    std::uint16_t port;
    address_type type;
    bootstrap_mode mode{ bootstrap_mode::unspecified };

    auto operator==(const node& rhs) const -> bool
    {
      return address == rhs.address && port == rhs.port && type == rhs.type && mode == rhs.mode;
    }

    auto operator!=(const node& rhs) const -> bool
    {
      return !(rhs == *this);
    }
  };

  std::string input;
  std::string scheme{ "couchbase" };
  bool tls{ false };
  std::map<std::string, std::string> params{};
  cluster_options options{};

  std::vector<node> bootstrap_nodes{};

  std::optional<std::string> default_bucket_name{};
  bootstrap_mode default_mode{ connection_string::bootstrap_mode::gcccp };
  std::uint16_t default_port{ 11210 };

  std::vector<std::string> warnings{};
  std::optional<std::string> error{};
};

auto
parse_connection_string(const std::string& input,
                        cluster_options options = {}) -> connection_string;
} // namespace couchbase::core::utils
