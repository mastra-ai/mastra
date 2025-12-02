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

#include "seed_config.hxx"

#include <spdlog/fmt/bundled/core.h>
#include <spdlog/fmt/bundled/ranges.h>

namespace couchbase::core
{
auto
dns_srv_record::to_string() const -> std::string
{
  return fmt::format(R"(#<dns_srv_record:{} protocol="{}", scheme="{}", hostname="{}">)",
                     static_cast<const void*>(this),
                     protocol,
                     scheme,
                     hostname);
}

auto
seed_config::to_string() const -> std::string
{
  return fmt::format(R"(#<seed_config:{} mcpb_addresses={}, http_addresses={}, dns_srv_record={}>)",
                     static_cast<const void*>(this),
                     mcbp_addresses,
                     http_addresses,
                     srv_record ? srv_record->to_string() : "(none)");
}
} // namespace couchbase::core
