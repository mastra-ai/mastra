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

#include <couchbase/error_codes.hxx>
#include <couchbase/subdoc/mutate_in_macro.hxx>

#include <cstdint>
#include <string>

namespace couchbase::subdoc
{
auto
to_mutate_in_macro(std::string_view input) -> std::optional<couchbase::subdoc::mutate_in_macro>
{
  if (input == "\"${Mutation.CAS}\"") {
    return couchbase::subdoc::mutate_in_macro::cas;
  }
  if (input == "\"${Mutation.seqno}\"") {
    return couchbase::subdoc::mutate_in_macro::sequence_number;
  }
  if (input == "\"${Mutation.value_crc32c}\"") {
    return couchbase::subdoc::mutate_in_macro::value_crc32c;
  }
  return {};
}

auto
to_binary(couchbase::subdoc::mutate_in_macro value) -> std::vector<std::byte>
{
  // echo -n '"${Mutation.CAS}"' | ruby -e 'puts ARGF.read.chars.map{|c| format("std::byte{0x%02x}",
  // c.ord)}.join(", ")'
  static const std::vector cas_bytes{
    std::byte{ 0x22 }, std::byte{ 0x24 }, std::byte{ 0x7b }, std::byte{ 0x4d }, std::byte{ 0x75 },
    std::byte{ 0x74 }, std::byte{ 0x61 }, std::byte{ 0x74 }, std::byte{ 0x69 }, std::byte{ 0x6f },
    std::byte{ 0x6e }, std::byte{ 0x2e }, std::byte{ 0x43 }, std::byte{ 0x41 }, std::byte{ 0x53 },
    std::byte{ 0x7d }, std::byte{ 0x22 },
  };

  // echo -n '"${Mutation.seqno}"' | ruby -e 'puts ARGF.read.chars.map{|c|
  // format("std::byte{0x%02x}", c.ord)}.join(",
  // ")'
  static const std::vector seqno_bytes{
    std::byte{ 0x22 }, std::byte{ 0x24 }, std::byte{ 0x7b }, std::byte{ 0x4d }, std::byte{ 0x75 },
    std::byte{ 0x74 }, std::byte{ 0x61 }, std::byte{ 0x74 }, std::byte{ 0x69 }, std::byte{ 0x6f },
    std::byte{ 0x6e }, std::byte{ 0x2e }, std::byte{ 0x73 }, std::byte{ 0x65 }, std::byte{ 0x71 },
    std::byte{ 0x6e }, std::byte{ 0x6f }, std::byte{ 0x7d }, std::byte{ 0x22 },
  };

  // echo -n '"${Mutation.value_crc32c}"' | ruby -e 'puts ARGF.read.chars.map{|c|
  // format("std::byte{0x%02x}", c.ord)}.join(", ")'
  static const std::vector crc32_bytes{
    std::byte{ 0x22 }, std::byte{ 0x24 }, std::byte{ 0x7b }, std::byte{ 0x4d }, std::byte{ 0x75 },
    std::byte{ 0x74 }, std::byte{ 0x61 }, std::byte{ 0x74 }, std::byte{ 0x69 }, std::byte{ 0x6f },
    std::byte{ 0x6e }, std::byte{ 0x2e }, std::byte{ 0x76 }, std::byte{ 0x61 }, std::byte{ 0x6c },
    std::byte{ 0x75 }, std::byte{ 0x65 }, std::byte{ 0x5f }, std::byte{ 0x63 }, std::byte{ 0x72 },
    std::byte{ 0x63 }, std::byte{ 0x33 }, std::byte{ 0x32 }, std::byte{ 0x63 }, std::byte{ 0x7d },
    std::byte{ 0x22 },
  };

  switch (value) {
    case couchbase::subdoc::mutate_in_macro::cas:
      return cas_bytes;
    case couchbase::subdoc::mutate_in_macro::sequence_number:
      return seqno_bytes;
    case couchbase::subdoc::mutate_in_macro::value_crc32c:
      return crc32_bytes;
  }
  throw std::system_error(errc::common::invalid_argument,
                          "Unexpected mutate_in macro: " +
                            std::to_string(static_cast<std::uint32_t>(value)));
}
} // namespace couchbase::subdoc
