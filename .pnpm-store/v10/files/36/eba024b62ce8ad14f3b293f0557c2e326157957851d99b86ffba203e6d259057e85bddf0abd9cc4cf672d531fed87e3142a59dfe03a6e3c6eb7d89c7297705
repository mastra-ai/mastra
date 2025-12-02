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

#include <cinttypes>
#include <string>

namespace couchbase::core::impl::subdoc
{
/**
 * @since 1.0.0
 * @internal
 */
enum class opcode : std::uint8_t {
  get_doc = 0x00,
  set_doc = 0x01,
  remove_doc = 0x04,
  get = 0xc5,
  exists = 0xc6,
  dict_add = 0xc7,
  dict_upsert = 0xc8,
  remove = 0xc9,
  replace = 0xca,
  array_push_last = 0xcb,
  array_push_first = 0xcc,
  array_insert = 0xcd,
  array_add_unique = 0xce,
  counter = 0xcf,
  get_count = 0xd2,
  replace_body_with_xattr = 0xd3,
};
} // namespace couchbase::core::impl::subdoc
