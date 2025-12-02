/*
 *     Copyright 2021-Present Couchbase, Inc.
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

#include "durability_level.hxx"

#include <string_view>

namespace couchbase::core::transactions
{
constexpr auto
durability_level_to_string(durability_level level) -> std::string_view
{
  switch (level) {
    case durability_level::none:
      return "NONE";
    case durability_level::majority:
      return "MAJORITY";
    case durability_level::majority_and_persist_to_active:
      return "MAJORITY_AND_PERSIST_TO_ACTIVE";
    case durability_level::persist_to_majority:
      return "PERSIST_TO_MAJORITY";
  }
  return "MAJORITY";
}

constexpr auto
durability_level_to_string_for_query(durability_level level) -> std::string_view
{
  switch (level) {
    case durability_level::none:
      return "none";
    case durability_level::majority:
      return "majority";
    case durability_level::majority_and_persist_to_active:
      return "majorityAndPersistActive";
    case durability_level::persist_to_majority:
      return "persistToMajority";
  }
  return "majority";
}

constexpr auto
store_durability_level_to_string(durability_level level) -> std::string_view
{
  switch (level) {
    case durability_level::none:
      return "n";
    case durability_level::majority:
      return "m";
    case durability_level::majority_and_persist_to_active:
      return "pa";
    case durability_level::persist_to_majority:
      return "pm";
    default:
      return "m";
  }
}

constexpr durability_level
store_string_to_durability_level(std::string_view input)
{
  if (input == "m") {
    return durability_level::majority;
  }
  if (input == "pa") {
    return durability_level::majority_and_persist_to_active;
  }
  if (input == "pm") {
    return durability_level::persist_to_majority;
  }
  if (input == "n") {
    return durability_level::none;
  }
  // Default to a something sensible if we don't understand the code
  return durability_level::majority;
}
} // namespace couchbase::core::transactions
