/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 * Copyright 2022-Present Couchbase, Inc.
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

#include <optional>
#include <string>
#include <vector>

namespace couchbase::core
{
struct dns_srv_record {
  std::string protocol{};
  std::string scheme{};
  std::string hostname{};

  [[nodiscard]] auto to_string() const -> std::string;
};

struct seed_config {
  std::vector<std::string> mcbp_addresses{};
  std::vector<std::string> http_addresses{};
  std::optional<dns_srv_record> srv_record{};

  [[nodiscard]] auto to_string() const -> std::string;
};
} // namespace couchbase::core
