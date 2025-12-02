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

#include "core/document_id.hxx"
#include "core/operations_fwd.hxx"
#include "core/utils/json.hxx"
#include "document_metadata.hxx"
#include "transaction_links.hxx"

#include <couchbase/codec/encoded_value.hxx>
#include <couchbase/fmt/cas.hxx>
#include <couchbase/transactions/transaction_get_result.hxx>

#include <utility>

namespace couchbase::core::transactions
{
struct result;
/**
 * @brief Encapsulates results of an individual transaction operation
 *
 */
class transaction_get_result
{
private:
  couchbase::cas cas_{};
  core::document_id document_id_{};
  transaction_links links_{};
  codec::encoded_value content_{};

  /** This is needed for provide {BACKUP-FIELDS}.  It is only needed from the
   * get to the staged mutation, hence Optional. */
  std::optional<document_metadata> metadata_{};

public:
  /**
  workaround for MSVC standard library deficiency
  @internal
  */
  transaction_get_result() = default;
  ~transaction_get_result() = default;

  /** @internal */
  transaction_get_result(const transaction_get_result& doc) = default;
  transaction_get_result(transaction_get_result&& doc) noexcept = default;
  auto operator=(const transaction_get_result&) -> transaction_get_result& = delete;
  auto operator=(transaction_get_result&&) -> transaction_get_result& = default;

  /*
  transaction_get_result(const transaction_op_error_context& ctx)
    : couchbase::transactions::transaction_get_result(ctx)
  {
  }*/

  /** @internal */
  transaction_get_result(core::document_id id,
                         codec::encoded_value content,
                         std::uint64_t cas,
                         transaction_links links,
                         std::optional<document_metadata> metadata)
    : cas_(cas)
    , document_id_(std::move(id))
    , links_(std::move(links))
    , content_(std::move(content))
    , metadata_(std::move(metadata))
  {
  }

  explicit transaction_get_result(const couchbase::transactions::transaction_get_result& res)
    : cas_(res.cas())
    , document_id_(res.bucket(), res.scope(), res.collection(), res.id())
    , links_(res.base_->links())
    , content_(res.content())
    , metadata_(res.base_->metadata_)
  {
  }

  auto to_public_result() -> couchbase::transactions::transaction_get_result
  {
    return couchbase::transactions::transaction_get_result(std::make_shared<transaction_get_result>(
      document_id_, std::move(content_), cas_.value(), links_, metadata_));
  }

  transaction_get_result(core::document_id id, const tao::json::value& json)
    : document_id_(std::move(id))
    , links_(json)
    , metadata_(json.optional<std::string>("scas").value_or(""))
  {
    if (const auto* cas = json.find("cas"); cas != nullptr && cas->is_number()) {
      cas_ = couchbase::cas(cas->as<std::uint64_t>());
    }
    if (const auto* cas = json.find("scas");
        cas != nullptr && cas->is_string() && cas_.value() == 0U) {
      cas_ = couchbase::cas(stoull(cas->as<std::string>()));
    }
    if (const auto* doc = json.find("doc"); doc != nullptr) {
      content_ = { core::utils::json::generate_binary(doc->get_object()),
                   codec::codec_flags::json_common_flags };
    }
  }

  /** @internal */
  static auto create_from(const transaction_get_result& document,
                          codec::encoded_value content) -> transaction_get_result;

  /** @internal */
  static auto create_from(const core::operations::lookup_in_response& resp)
    -> transaction_get_result;
  static auto create_from(const core::operations::lookup_in_any_replica_response& resp)
    -> transaction_get_result;

  /**
   * @brief Get document id.
   *
   * @return the id of this document.
   */
  [[nodiscard]] auto id() const -> const core::document_id&
  {
    return document_id_;
  }

  [[nodiscard]] auto bucket() const -> const std::string&
  {
    return document_id_.bucket();
  }

  [[nodiscard]] auto key() const -> const std::string&
  {
    return document_id_.key();
  }

  [[nodiscard]] auto scope() const -> const std::string&
  {
    return document_id_.scope();
  }

  [[nodiscard]] auto collection() const -> const std::string&
  {
    return document_id_.collection();
  }

  /** @internal */
  [[nodiscard]] auto links() const -> transaction_links
  {
    return links_;
  }

  /**
   * @brief Set document CAS.
   *
   * @param cas desired CAS for document.
   */
  void cas(std::uint64_t cas)
  {
    cas_ = couchbase::cas(cas);
  }

  /**
   * @brief Get document metadata.
   *
   * @return metadata for this document.
   */
  [[nodiscard]] auto metadata() const -> const std::optional<document_metadata>&
  {
    return metadata_;
  }

  /**
   * @brief Get document CAS.
   *
   * @return the CAS for this document.
   */
  [[nodiscard]] auto cas() const -> couchbase::cas
  {
    return cas_;
  }

  /** @internal */
  template<typename OStream>
  friend auto operator<<(OStream& os, const transaction_get_result document) -> OStream&
  {
    os << "transaction_get_result{id: " << document.id().key() << ", cas: " << document.cas_.value()
       << ", links_: " << document.links_ << "}";
    return os;
  }

  /**
   * Content of the document as raw byte vector
   *
   * @return content
   */
  [[nodiscard]] auto content() const -> const codec::encoded_value&
  {
    return content_;
  }
  /**
   * Copy content into document
   * @param content
   */
  void content(const codec::encoded_value& content)
  {
    content_ = content;
  }
  /**
   * Move content into document
   *
   * @param content
   */
  void content(codec::encoded_value&& content)
  {
    content_ = std::move(content);
  }
};
} // namespace couchbase::core::transactions

template<>
struct fmt::formatter<couchbase::core::transactions::transaction_get_result> {
public:
  template<typename ParseContext>
  constexpr auto parse(ParseContext& ctx)
  {
    return ctx.begin();
  }

  template<typename FormatContext>
  constexpr auto format(const couchbase::core::transactions::transaction_get_result& r,
                        FormatContext& ctx) const
  {
    return format_to(ctx.out(),
                     "transaction_get_result:{{ id: {}, cas: {}, links: }}",
                     r.id(),
                     r.cas(),
                     r.links());
  }
};
