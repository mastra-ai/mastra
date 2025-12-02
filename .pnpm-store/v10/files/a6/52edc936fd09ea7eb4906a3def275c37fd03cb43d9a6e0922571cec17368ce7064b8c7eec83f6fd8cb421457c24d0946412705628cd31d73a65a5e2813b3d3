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
#include <string>

namespace couchbase
{
/**
 * Value object to contain partition details and sequence number.
 *
 * @since 1.0.0
 * @committed
 */
class mutation_token
{
public:
  /**
   * @since 1.0.0
   * @committed
   */
  mutation_token() = default;

  /**
   * @param partition_uuid
   * @param sequence_number
   * @param partition_id
   * @param bucket_name
   *
   * @since 1.0.0
   * @committed
   */
  explicit mutation_token(std::uint64_t partition_uuid,
                          std::uint64_t sequence_number,
                          std::uint16_t partition_id,
                          std::string bucket_name)
    : partition_uuid_{ partition_uuid }
    , sequence_number_{ sequence_number }
    , partition_id_{ partition_id }
    , bucket_name_{ std::move(bucket_name) }
  {
  }

  /**
   * UUID of partition.
   *
   * @return
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto partition_uuid() const -> std::uint64_t
  {
    return partition_uuid_;
  }

  /**
   * Sequence number associated with the document.
   *
   * @return
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto sequence_number() const -> std::uint64_t
  {
    return sequence_number_;
  }

  /**
   * ID of partition (also known as vBucket).
   *
   * @return
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto partition_id() const -> std::uint16_t
  {
    return partition_id_;
  }

  /**
   * Name of the bucket.
   *
   * @return
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto bucket_name() const -> std::string
  {
    return bucket_name_;
  }

private:
  std::uint64_t partition_uuid_{ 0 };
  std::uint64_t sequence_number_{ 0 };
  std::uint16_t partition_id_{ 0 };
  std::string bucket_name_{};
};
} // namespace couchbase
