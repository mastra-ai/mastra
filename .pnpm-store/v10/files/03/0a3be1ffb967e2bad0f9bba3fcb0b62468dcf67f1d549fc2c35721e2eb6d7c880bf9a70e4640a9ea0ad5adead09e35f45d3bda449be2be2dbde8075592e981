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

#include "key_value_error_map_attribute.hxx"

#include <cstdint>
#include <set>
#include <string>

namespace couchbase::core
{
/**
 * Entry of the ErrorMap.
 *
 * The ErrorMap contains mappings from errors to their attributes, negotiated between the client and
 * the server.
 *
 * @since 1.0.0
 * @committed
 */
class key_value_error_map_info
{
public:
  /**
   * Constructs empty error map entry
   *
   * @since 1.0.0
   * @committed
   */
  key_value_error_map_info() = default;

  /**
   * Constructs and initializes error map entry with given parameters.
   *
   * @param code
   * @param name
   * @param description
   * @param attributes
   *
   * @since 1.0.0
   * @internal
   */
  key_value_error_map_info(std::uint16_t code,
                           std::string name,
                           std::string description,
                           std::set<key_value_error_map_attribute> attributes)
    : code_{ code }
    , name_{ std::move(name) }
    , description_{ std::move(description) }
    , attributes_{ std::move(attributes) }
  {
  }

  /**
   * Returns numeric error code.
   *
   * @return error code
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto code() const -> std::uint16_t
  {
    return code_;
  }

  /**
   * Returns symbolic name of the error code.
   *
   * @return error name
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto name() const -> const std::string&
  {
    return name_;
  }

  /**
   * Returns human readable description of the error code.
   *
   * @return error description
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto description() const -> const std::string&
  {
    return description_;
  }

  /**
   * Returns set of the attributes associated with error code.
   *
   * @return set of the associated attributes
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto attributes() const -> const std::set<key_value_error_map_attribute>&
  {
    return attributes_;
  }

  /**
   * @return true if error map info contains retry attribute
   *
   * @since 1.0.0
   * @internal
   */
  [[nodiscard]] bool has_retry_attribute() const
  {
    return attributes_.count(key_value_error_map_attribute::retry_now) > 0;
  }

private:
  std::uint16_t code_{};
  std::string name_{};
  std::string description_{};
  std::set<key_value_error_map_attribute> attributes_{};
};
} // namespace couchbase::core