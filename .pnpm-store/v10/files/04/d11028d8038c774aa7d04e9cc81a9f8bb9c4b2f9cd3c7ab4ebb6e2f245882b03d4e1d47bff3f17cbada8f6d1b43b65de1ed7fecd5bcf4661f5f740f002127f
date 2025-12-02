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
#include "core/impl/subdoc/command.hxx"
#include "core/io/mcbp_message.hxx"
#include "status.hxx"

#include <couchbase/durability_level.hxx>
#include <couchbase/mutation_token.hxx>
#include <couchbase/store_semantics.hxx>

#include <gsl/assert>

#include <cstddef>

namespace couchbase::core::protocol
{

class mutate_in_response_body
{
public:
  static const inline client_opcode opcode = client_opcode::subdoc_multi_mutation;

  struct mutate_in_field {
    std::uint8_t index{};
    key_value_status_code status{};
    std::string value{};
  };

private:
  std::vector<mutate_in_field> fields_;
  mutation_token token_;

public:
  [[nodiscard]] auto fields() const -> const std::vector<mutate_in_field>&
  {
    return fields_;
  }

  [[nodiscard]] auto token() const -> const mutation_token&
  {
    return token_;
  }

  auto parse(key_value_status_code status,
             const header_buffer& header,
             std::uint8_t framing_extras_size,
             std::uint16_t key_size,
             std::uint8_t extras_size,
             const std::vector<std::byte>& body,
             const cmd_info& /* info */) -> bool;
};

class mutate_in_request_body
{
public:
  using response_body_type = mutate_in_response_body;
  static const inline client_opcode opcode = client_opcode::subdoc_multi_mutation;

  /**
   * Create the document if it does not exist. Implies
   * `path_flag_create_parents`. and `upsert` mutation semantics. Not valid with
   * `insert`.
   */
  static constexpr std::byte doc_flag_mkdoc{ 0b0000'0001U };

  /**
   * Add the document only if it does not exist. Implies
   * `path_flag_create_parents`. Not valid with `doc_flag_mkdoc`.
   */
  static constexpr std::byte doc_flag_add{ 0b0000'0010U };

  /**
   * Allow access to XATTRs for deleted documents (instead of returning
   * KEY_ENOENT).
   */
  static constexpr std::byte doc_flag_access_deleted{ 0b0000'0100U };

  /**
   * Used with `doc_flag_mkdoc` / `doc_flag_add`; if the document does not exist
   * then create it in the "Deleted" state, instead of the normal "Alive" state.
   * Not valid unless `doc_flag_mkdoc` or `doc_flag_add` specified.
   */
  static constexpr std::byte doc_flag_create_as_deleted{ 0b0000'1000U };

  /**
   * If the document exists and isn't deleted the operation will fail with .
   * If the input document _is_ deleted the result of the operation will store
   * the document as a "live" document instead of a deleted document.
   */
  static constexpr std::byte doc_flag_revive_document{ 0b0001'0000U };

private:
  std::vector<std::byte> key_;
  std::vector<std::byte> extras_{};
  std::vector<std::byte> value_{};

  std::optional<std::uint32_t> user_flags_{};
  std::uint32_t expiry_{ 0 };
  std::byte flags_{ 0 };
  std::vector<couchbase::core::impl::subdoc::command> specs_;
  std::vector<std::byte> framing_extras_{};

public:
  void id(const document_id& id);

  void user_flags(std::uint32_t value)
  {
    user_flags_ = value;
  }

  void expiry(std::uint32_t value)
  {
    expiry_ = value;
  }

  void access_deleted(bool value)
  {
    if (value) {
      flags_ |= doc_flag_access_deleted;
    } else {
      flags_ &= ~doc_flag_access_deleted;
    }
  }

  void create_as_deleted(bool value)
  {
    if (value) {
      flags_ |= doc_flag_create_as_deleted;
    } else {
      flags_ &= ~doc_flag_create_as_deleted;
    }
  }

  void revive_document(bool value)
  {
    if (value) {
      flags_ |= doc_flag_revive_document;
    } else {
      flags_ &= ~doc_flag_revive_document;
    }
  }

  void store_semantics(couchbase::store_semantics semantics)
  {
    flags_ &= std::byte{ 0b1111'1100U }; /* reset first two bits */
    switch (semantics) {
      case couchbase::store_semantics::replace:
        /* leave bits as zeros */
        break;
      case couchbase::store_semantics::upsert:
        flags_ |= doc_flag_mkdoc;
        break;
      case couchbase::store_semantics::insert:
        flags_ |= doc_flag_add;
        break;
      case store_semantics::revive:
        break;
    }
  }

  void specs(std::vector<couchbase::core::impl::subdoc::command> specs)
  {
    specs_ = std::move(specs);
  }

  void durability(durability_level level, std::optional<std::uint16_t> timeout);

  void preserve_expiry();

  [[nodiscard]] auto key() const -> const auto&
  {
    return key_;
  }

  [[nodiscard]] auto framing_extras() const -> const auto&
  {
    return framing_extras_;
  }

  [[nodiscard]] auto extras() -> const auto&
  {
    if (extras_.empty()) {
      fill_extras();
    }
    return extras_;
  }

  [[nodiscard]] auto value() -> const auto&
  {
    if (value_.empty()) {
      fill_value();
    }
    return value_;
  }

  [[nodiscard]] auto size() -> std::size_t
  {
    if (extras_.empty()) {
      fill_extras();
    }
    if (value_.empty()) {
      fill_value();
    }
    return framing_extras_.size() + extras_.size() + key_.size() + value_.size();
  }

private:
  void fill_extras();

  void fill_value();
};

} // namespace couchbase::core::protocol
