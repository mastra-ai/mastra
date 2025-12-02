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

#include "client_request.hxx"
#include "core/utils/binary.hxx"

#include <snappy.h>

namespace couchbase::core::protocol
{
auto
compress_value(const std::vector<std::byte>& value,
               std::vector<std::byte>::iterator& output) -> std::pair<bool, std::uint32_t>
{
  static const double min_ratio = 0.83;

  std::string compressed;
  const std::size_t compressed_size =
    snappy::Compress(reinterpret_cast<const char*>(value.data()), value.size(), &compressed);
  if (gsl::narrow_cast<double>(compressed_size) / gsl::narrow_cast<double>(value.size()) <
      min_ratio) {
    utils::to_binary(compressed, output);
    return { true, gsl::narrow_cast<std::uint32_t>(compressed_size) };
  }
  return { false, 0 };
}
} // namespace couchbase::core::protocol
