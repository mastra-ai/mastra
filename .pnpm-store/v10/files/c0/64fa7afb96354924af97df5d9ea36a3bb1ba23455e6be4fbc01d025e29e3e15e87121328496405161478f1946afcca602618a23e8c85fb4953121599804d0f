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

#include <cstdint>

namespace couchbase::core::protocol
{
enum class datatype : std::uint8_t {
  raw = 0x00,
  json = 0x01,
  snappy = 0x02,
  xattr = 0x04,
};

constexpr auto
is_valid_datatype(std::uint8_t code) -> bool
{
  switch (static_cast<datatype>(code)) {
    case datatype::raw:
    case datatype::json:
    case datatype::snappy:
    case datatype::xattr:
      return true;
  }
  return false;
}

constexpr auto
has_json_datatype(std::uint8_t code) -> bool
{
  return (code & static_cast<std::uint8_t>(datatype::json)) != 0;
}
} // namespace couchbase::core::protocol
