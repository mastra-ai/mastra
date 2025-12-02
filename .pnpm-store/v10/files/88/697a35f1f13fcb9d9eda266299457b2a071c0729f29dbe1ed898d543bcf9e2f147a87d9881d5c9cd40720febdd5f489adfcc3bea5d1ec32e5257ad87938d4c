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

#include "client_opcode.hxx"
#include "cmd_info.hxx"
#include "core/document_id.hxx"
#include "core/io/mcbp_message.hxx"
#include "status.hxx"

#include <couchbase/cas.hxx>

namespace couchbase::core::protocol
{

class observe_seqno_response_body
{
public:
  static const inline client_opcode opcode = client_opcode::observe_seqno;

private:
  std::uint16_t partition_id_{};
  std::uint64_t partition_uuid_{};
  std::uint64_t last_persisted_sequence_number_{};
  std::uint64_t current_sequence_number_{};
  std::optional<std::uint64_t> old_partition_uuid_{};
  std::optional<std::uint64_t> last_received_sequence_number_{};

public:
  [[nodiscard]] auto partition_id() const -> std::uint16_t
  {
    return partition_id_;
  }

  [[nodiscard]] auto partition_uuid() const -> std::uint64_t
  {
    return partition_uuid_;
  }

  [[nodiscard]] auto last_persisted_sequence_number() const -> std::uint64_t
  {
    return last_persisted_sequence_number_;
  }

  [[nodiscard]] auto current_sequence_number() const -> std::uint64_t
  {
    return current_sequence_number_;
  }

  [[nodiscard]] auto old_partition_uuid() const -> const std::optional<std::uint64_t>&
  {
    return old_partition_uuid_;
  }

  [[nodiscard]] auto last_received_sequence_number() const -> const std::optional<std::uint64_t>&
  {
    return last_received_sequence_number_;
  }

  auto parse(key_value_status_code status,
             const header_buffer& header,
             std::uint8_t framing_extras_size,
             std::uint16_t key_size,
             std::uint8_t extras_size,
             const std::vector<std::byte>& body,
             const cmd_info& info) -> bool;
};

class observe_seqno_request_body
{
public:
  using response_body_type = observe_seqno_response_body;
  static const inline client_opcode opcode = client_opcode::observe_seqno;

private:
  std::uint64_t partition_uuid_{};
  std::vector<std::byte> value_{};

public:
  void partition_uuid(const std::uint64_t& uuid);

  [[nodiscard]] auto key() const -> const auto&
  {
    return empty_buffer;
  }

  [[nodiscard]] auto framing_extras() const -> const auto&
  {
    return empty_buffer;
  }

  [[nodiscard]] auto extras() const -> const auto&
  {
    return empty_buffer;
  }

  [[nodiscard]] auto value() -> const auto&
  {
    if (value_.empty()) {
      fill_body();
    }
    return value_;
  }

  [[nodiscard]] auto size() -> std::size_t
  {
    if (value_.empty()) {
      fill_body();
    }
    return value_.size();
  }

private:
  void fill_body();
};

} // namespace couchbase::core::protocol
