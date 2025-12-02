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

#include "mcbp_message.hxx"

#include <iterator>

namespace couchbase::core::io
{
struct mcbp_parser {
  enum class result {
    ok,
    need_data,
    failure
  };

  template<typename Iterator>
  void feed(Iterator begin, Iterator end)
  {
    buf.reserve(buf.size() + static_cast<std::size_t>(std::distance(begin, end)));
    buf.insert(buf.end(), begin, end);
  }

  void reset()
  {
    buf.clear();
  }

  auto next(mcbp_message& msg) -> result;

  std::vector<std::byte> buf;
};
} // namespace couchbase::core::io
