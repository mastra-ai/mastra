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
#include <couchbase/expiry.hxx>

#include <spdlog/fmt/bundled/chrono.h>
#include <spdlog/fmt/bundled/core.h>

#include <chrono>
#include <cstdint>
#include <limits>

namespace couchbase::core::impl
{
namespace
{
// Durations longer than this must be converted to an epoch second before being passed to the
// server.
constexpr std::chrono::seconds relative_expiry_cutoff_seconds{ 30 * 24 * 60 * 60 };

// Avoid ambiguity duration longer than 50 years this by disallowing such durations.
constexpr std::chrono::seconds latest_valid_expiry_duration{ 50 * 365 * 24 * 60 * 60 };

// Any time_point earlier than this is almost certainly the result of a programming error.
// The selected value is > 30 days, so we don't need to worry about instant's epoch second being
// misinterpreted as a number of seconds from the current time.
constexpr std::chrono::system_clock::time_point earliest_valid_expiry_time_point{
  std::chrono::seconds{ 31 * 24 * 60 * 60 }
};

// The server interprets the 32-bit expiry field as an unsigned integer. This means the maximum
// value is 4294967295 seconds, which corresponds to 2106-02-07T06:28:15Z.
constexpr std::chrono::system_clock::time_point latest_valid_expiry_time_point{
  std::chrono::seconds{ std::numeric_limits<std::uint32_t>::max() }
};
} // namespace

auto
expiry_none() -> std::uint32_t
{
  return 0;
}

auto
expiry_relative(std::chrono::seconds expiry) -> std::uint32_t
{
  if (expiry == std::chrono::seconds::zero()) {
    return expiry_none();
  }

  if (expiry > latest_valid_expiry_duration) {
    throw std::system_error(
      errc::common::invalid_argument,
      fmt::format(
        "When specifying expiry as a duration, it must not be longer than {} seconds, but got {}. "
        "If you truly require a longer expiry, please specify it as an time_point instead.",
        latest_valid_expiry_duration.count(),
        expiry.count()));
  }

  if (expiry < relative_expiry_cutoff_seconds) {
    return static_cast<std::uint32_t>(expiry.count());
  }

  auto expiry_time_point = std::chrono::system_clock::now() + expiry;
  if (expiry_time_point > latest_valid_expiry_time_point) {
    throw std::system_error(
      errc::common::invalid_argument,
      fmt::format(
        "Document would expire sooner than requested, since the end of duration {}  is after {}",
        expiry,
        latest_valid_expiry_time_point));
  }

  auto seconds =
    std::chrono::duration_cast<std::chrono::seconds>(expiry_time_point.time_since_epoch());
  return static_cast<std::uint32_t>(seconds.count());
}

auto
expiry_absolute(std::chrono::system_clock::time_point expiry) -> std::uint32_t
{
  // Basic sanity check, prevent instant from being interpreted as a relative duration.
  // Allow EPOCH (zero instant) because that is how "get with expiry" represents "no expiry"
  if (expiry < earliest_valid_expiry_time_point &&
      expiry != std::chrono::system_clock::time_point::min()) {
    throw std::system_error(
      errc::common::invalid_argument,
      fmt::format("Expiry time_point must be zero (for no expiry) or later than {}, but got {}",
                  earliest_valid_expiry_time_point,
                  expiry));
  }

  if (expiry > latest_valid_expiry_time_point) {
    // Anything after this would roll over when converted to an unsigned 32-bit value
    // and cause the document to expire sooner than expected.
    throw std::system_error(errc::common::invalid_argument,
                            fmt::format("Expiry instant must be no later than {}, but got {}",
                                        latest_valid_expiry_time_point,
                                        expiry));
  }
  auto seconds = std::chrono::duration_cast<std::chrono::seconds>(expiry.time_since_epoch());
  return static_cast<std::uint32_t>(seconds.count());
}
} // namespace couchbase::core::impl
