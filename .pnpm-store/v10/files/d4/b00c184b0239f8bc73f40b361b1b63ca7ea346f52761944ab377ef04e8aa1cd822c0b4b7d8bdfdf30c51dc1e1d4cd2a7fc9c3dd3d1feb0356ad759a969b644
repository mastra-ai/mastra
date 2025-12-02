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
#include "core/io/mcbp_message.hxx"
#include "hello_feature.hxx"
#include "status.hxx"

namespace couchbase::core::protocol
{

class hello_response_body
{
public:
  static const inline client_opcode opcode = client_opcode::hello;

private:
  std::vector<hello_feature> supported_features_;

public:
  [[nodiscard]] auto supported_features() const -> const std::vector<hello_feature>&
  {
    return supported_features_;
  }

  auto parse(key_value_status_code status,
             const header_buffer& header,
             std::uint8_t framing_extras_size,
             std::uint16_t key_size,
             std::uint8_t extras_size,
             const std::vector<std::byte>& body,
             const cmd_info& info) -> bool;
};

class hello_request_body
{
public:
  using response_body_type = hello_response_body;
  static const inline client_opcode opcode = client_opcode::hello;

private:
  std::vector<std::byte> key_;
  std::vector<hello_feature> features_{
    hello_feature::tcp_nodelay,
    hello_feature::xattr,
    hello_feature::xerror,
    hello_feature::select_bucket,
    hello_feature::json,
    hello_feature::duplex,
    hello_feature::alt_request_support,
    hello_feature::tracing,
    hello_feature::sync_replication,
    hello_feature::vattr,
    hello_feature::collections,
    hello_feature::subdoc_create_as_deleted,
    hello_feature::preserve_ttl,
    hello_feature::subdoc_replica_read,
    hello_feature::subdoc_binary_xattr,
  };
  std::vector<std::byte> value_;

public:
  void user_agent(std::string_view val);

  void enable_unordered_execution()
  {
    features_.emplace_back(hello_feature::unordered_execution);
  }

  void enable_clustermap_change_notification()
  {
    features_.emplace_back(hello_feature::clustermap_change_notification);
  }

  void enable_deduplicate_not_my_vbucket_clustermap()
  {
    features_.emplace_back(hello_feature::deduplicate_not_my_vbucket_clustermap);
  }

  void enable_compression()
  {
    features_.emplace_back(hello_feature::snappy);
  }

  void enable_mutation_tokens()
  {
    features_.emplace_back(hello_feature::mutation_seqno);
  }

  [[nodiscard]] auto features() const -> const std::vector<hello_feature>&
  {
    return features_;
  }

  [[nodiscard]] auto key() const -> const auto&
  {
    return key_;
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
    return key_.size() + value_.size();
  }

private:
  void fill_body();
};

} // namespace couchbase::core::protocol
