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

#include "duration_parser.hxx"

namespace couchbase::core::utils
{
namespace
{
/**
 * leading_int consumes the leading [0-9]* from s.
 */
auto
leading_int(std::string& s, std::int64_t& v) -> bool
{
  v = 0;
  std::size_t i = 0;
  for (; i < s.size(); ++i) {
    auto c = s[i];

    if (c < '0' || c > '9') {
      break;
    }

    if (v > static_cast<std::int64_t>((1LLU << 63U) - 1LLU) / 10) {
      return false;
    }

    v = v * 10 + static_cast<std::int64_t>(c) - '0';

    if (v < 0) {
      return false;
    }
  }
  s = s.substr(i);
  return true;
}

/**
 * leading_fraction consumes the leading [0-9]* from s.
 *
 * It is used only for fractions, so does not return an error on overflow,
 * it just stops accumulating precision.
 */
void
leading_fraction(std::string& s, std::int64_t& x, std::uint32_t& scale)
{
  std::size_t i = 0;
  scale = 1;

  bool overflow = false;

  for (; i < s.size(); ++i) {
    auto c = s[i];

    if (c < '0' || c > '9') {
      break;
    }

    if (overflow) {
      continue;
    }

    if (x > static_cast<std::int64_t>((1LLU << 63LLU) - 1LLU) / 10) {
      // It's possible for overflow to give a positive number, so take care.
      overflow = true;
      continue;
    }

    auto y = (x * 10) + static_cast<std::int64_t>(c) - '0';
    if (y < 0) {
      overflow = true;
      continue;
    }

    x = y;
    scale *= 10;
  }

  s = s.substr(i);
}
} // namespace

auto
parse_duration(const std::string& text) -> std::chrono::nanoseconds
{
  // [-+]?([0-9]*(\.[0-9]*)?[a-z]+)+
  std::string s = text;
  std::chrono::nanoseconds d{ 0 };
  bool neg{ false };

  // Consume [-+]?
  if (!s.empty()) {
    auto c = s[0];

    if (c == '-' || c == '+') {
      neg = c == '-';
      s = s.substr(1);
    }
  }
  if (neg) {
    throw duration_parse_error("negative durations are not supported: " + text);
  }

  // Special case: if all that is left is "0", this is zero.
  if (s == "0") {
    return std::chrono::nanoseconds::zero();
  }

  if (s.empty()) {
    throw duration_parse_error("invalid duration: " + text);
  }

  while (!s.empty()) {
    // The next character must be [0-9.]
    if (s[0] != '.' && ('0' > s[0] || s[0] > '9')) {
      throw duration_parse_error("invalid duration: " + text);
    }

    // Consume [0-9]*
    auto pl = s.size();

    std::int64_t v{ 0 }; // integer before decimal point
    if (!leading_int(s, v)) {
      throw duration_parse_error("invalid duration (leading_int overflow): " + text);
    }

    const bool pre = pl != s.size(); // whether we consumed anything before a period

    std::int64_t f{ 0 };      // integer after decimal point
    std::uint32_t scale{ 1 }; // value = v + f/scale

    // Consume (\.[0-9]*)?
    bool post = false;
    if (!s.empty() && s[0] == '.') {
      s = s.substr(1);
      pl = s.size();
      leading_fraction(s, f, scale);
      post = pl != s.size();
    }

    if (!pre && !post) {
      // no digits (e.g. ".s" or "-.s")
      throw duration_parse_error("invalid duration: " + text);
    }

    // Consume unit.
    std::size_t i = 0;
    for (; i < s.size(); ++i) {
      auto c = s[i];
      if (c == '.' || ('0' <= c && c <= '9')) {
        break;
      }
    }
    if (i == 0) {
      throw duration_parse_error("missing unit in duration: " + text);
    }

    auto u = s.substr(0, i);
    s = s.substr(i);

    if (u == "ns") {
      d += std::chrono::nanoseconds(v); /* no sub-nanoseconds, ignore 'f' */
    } else if (u == "us" || u == "µs" /* U+00B5 = micro symbol */ ||
               u == "μs" /* U+03BC = Greek letter mu */) {
      d +=
        std::chrono::microseconds(v) +
        std::chrono::duration_cast<std::chrono::nanoseconds>(std::chrono::microseconds(f)) / scale;
    } else if (u == "ms") {
      d +=
        std::chrono::milliseconds(v) +
        std::chrono::duration_cast<std::chrono::nanoseconds>(std::chrono::milliseconds(f)) / scale;
    } else if (u == "s") {
      d += std::chrono::seconds(v) +
           std::chrono::duration_cast<std::chrono::nanoseconds>(std::chrono::seconds(f)) / scale;
    } else if (u == "m") {
      d += std::chrono::minutes(v) +
           std::chrono::duration_cast<std::chrono::nanoseconds>(std::chrono::minutes(f)) / scale;
    } else if (u == "h") {
      d += std::chrono::hours(v) +
           std::chrono::duration_cast<std::chrono::nanoseconds>(std::chrono::hours(f)) / scale;
    } else {
      throw duration_parse_error(
        std::string("unknown unit ").append(u).append(" in duration ").append(text));
    }
  }

  return d;
}
} // namespace couchbase::core::utils
