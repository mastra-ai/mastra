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

#include "command.hxx"

#include <cinttypes>
#include <cstddef>
#include <string>

namespace couchbase::core::impl::subdoc
{
/**
 * Should non-existent intermediate paths be created
 */
constexpr std::byte path_flag_create_parents{ 0b0000'0001U };

/**
 * If set, the path refers to an Extended Attribute (XATTR).
 * If clear, the path refers to a path inside the document body.
 */
constexpr std::byte path_flag_xattr{ 0b0000'0100U };

/**
 * Expand macro values inside extended attributes. The request is
 * invalid if this flag is set without `path_flag_create_parents` being set.
 */
constexpr std::byte path_flag_expand_macros{ 0b0001'0000U };

/**
 * The value is binary, and not JSON or text.
 */
constexpr std::byte path_flag_binary_value{ 0b0010'0000U };

constexpr std::byte
build_mutate_in_path_flags(bool xattr, bool create_path, bool expand_macro, bool binary)
{
  std::byte flags{ 0 };
  if (xattr) {
    flags |= path_flag_xattr;
    if (binary) {
      flags |= path_flag_binary_value;
    }
  }
  if (create_path) {
    flags |= path_flag_create_parents;
  }
  if (expand_macro) {
    flags |= path_flag_expand_macros;
  }
  return flags;
}

constexpr std::byte
build_lookup_in_path_flags(bool xattr, bool binary)
{
  std::byte flags{ 0U };
  if (xattr) {
    flags |= path_flag_xattr;
    if (binary) {
      flags |= path_flag_binary_value;
    }
  }
  return flags;
}

constexpr bool
has_xattr_path_flag(std::byte flags)
{
  return (flags & path_flag_xattr) == path_flag_xattr;
}

constexpr bool
has_binary_value_path_flag(std::byte flags)
{
  return (flags & path_flag_binary_value) == path_flag_binary_value;
}

constexpr void
reset_binary_value_path_flag(std::byte& flags)
{
  flags &= ~path_flag_binary_value;
}

} // namespace couchbase::core::impl::subdoc
