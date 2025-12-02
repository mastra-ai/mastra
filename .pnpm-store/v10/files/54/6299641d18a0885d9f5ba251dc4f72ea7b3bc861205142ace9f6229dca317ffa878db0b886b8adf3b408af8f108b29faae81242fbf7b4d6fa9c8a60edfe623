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

#include <cstdint>

namespace couchbase
{
/**
 * CAS is a special type that represented in protocol using unsigned 64-bit integer, but only
 * equality checks allowed.
 *
 * The user should not interpret the integer value of the CAS.
 *
 * @since 1.0.0
 * @committed
 */
class cas
{
public:
  /**
   * Constructs empty CAS value.
   *
   * @since 1.0.0
   * @committed
   */
  cas() = default;

  /**
   * Constructs CAS value using its integer representation that typically comes from protocol level.
   *
   * @param value numeric CAS representation
   *
   * @since 1.0.0
   * @committed
   */
  explicit cas(std::uint64_t value)
    : value_{ value }
  {
  }

  /**
   * Checks if CAS instances represent the same value
   *
   * @param other
   * @return true if CAS values represent the same value
   *
   * @since 1.0.0
   * @committed
   */
  auto operator==(const cas& other) const -> bool
  {
    return this->value_ == other.value_;
  }

  /**
   * Checks if CAS instances represent the same value
   *
   * @param other another CAS
   * @return true if CAS values don't represent the same value
   *
   * @since 1.0.0
   * @committed
   */
  auto operator!=(const cas& other) const -> bool
  {
    return !(*this == other);
  }

  /**
   * Checks if CAS contains meaningful value.
   *
   * @return true if CAS is empty
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto empty() const -> bool
  {
    return value_ == 0;
  }

  /**
   * Returns internal representation of the CAS value.
   *
   * @return raw CAS value
   *
   * @since 1.0.0
   * @internal
   */
  [[nodiscard]] auto value() const -> std::uint64_t
  {
    return value_;
  }

private:
  std::uint64_t value_{ 0 };
};
} // namespace couchbase
