/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *   Copyright 2022-Present Couchbase, Inc.
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

#include "../protocol/hello_feature.hxx"
#include "packet.hxx"

#include <gsl/span>

#include <tl/expected.hpp>

#include <array>
#include <set>
#include <system_error>
#include <utility>
#include <vector>

namespace couchbase::core::mcbp
{

class codec
{
public:
  explicit codec(std::set<protocol::hello_feature> enabled_features);

  auto encode_packet(const packet& packet) const
    -> tl::expected<std::vector<std::byte>, std::error_code>;
  auto decode_packet(gsl::span<std::byte> input) const
    -> std::tuple<packet, std::size_t, std::error_code>;
  auto decode_packet(gsl::span<std::byte> header, gsl::span<std::byte> body) const
    -> std::tuple<packet, std::size_t, std::error_code>;
  void enable_feature(protocol::hello_feature feature);
  [[nodiscard]] auto is_feature_enabled(protocol::hello_feature feature) const -> bool;

private:
  std::set<protocol::hello_feature> enabled_features_{};
  bool collections_enabled_{ false };
};

} // namespace couchbase::core::mcbp
