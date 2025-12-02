/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *   Copyright 2024. Couchbase, Inc.
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

#include <couchbase/cas.hxx>
#include <couchbase/codec/default_json_transcoder.hxx>
#include <couchbase/codec/encoded_value.hxx>
#include <couchbase/codec/transcoder_traits.hxx>
#include <couchbase/result.hxx>

#include <chrono>
#include <optional>
#include <string>
#include <type_traits>
#include <utility>

/**
 * Represents a single item from the result of @ref collection#scan()
 *
 * @since 1.0.0
 * @uncommitted
 */
namespace couchbase
{
#ifndef COUCHBASE_CXX_CLIENT_DOXYGEN
namespace crypto
{
class manager;
} // namespace crypto
#endif

class scan_result_item : public result
{
public:
  /**
   * Constructs an empty @ref scan_result_item.
   *
   * @since 1.0.0
   * @internal
   */
  scan_result_item() = default;

  /**
   * Constructs an instance representing a single item from the result of a scan operation.
   *
   * @param id the document ID
   * @param cas
   * @param value raw document contents along with flags describing its structure
   * @param expiry_time optional point in time when the document will expire
   *
   * @since 1.0.0
   * @internal
   */
  scan_result_item(std::string id,
                   couchbase::cas cas,
                   codec::encoded_value value,
                   std::optional<std::chrono::system_clock::time_point> expiry_time,
                   std::shared_ptr<crypto::manager> crypto_manager = {})
    : result{ cas }
    , id_{ std::move(id) }
    , id_only_{ false }
    , value_{ std::move(value) }
    , expiry_time_{ expiry_time }
    , crypto_manager_{ std::move(crypto_manager) }
  {
  }

  /**
   * Constructs an instance representing a single item from the result of an id-only scan operation.
   *
   * @param id the document ID
   *
   * @since 1.0.0
   * @internal
   */
  explicit scan_result_item(std::string id)
    : id_{ std::move(id) }
    , id_only_{ true }
  {
  }

  bool operator==(const scan_result_item& other) const
  {
    return id_ == other.id_ && cas() == other.cas();
  }

  /**
   * Returns the ID of the document
   *
   * @return document id
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto id() const -> const std::string&
  {
    return id_;
  }

  /**
   * Returns whether this scan result item only contains the document ID. If true, accessing the
   * content or CAS will return the default values.
   *
   * @return whether this item comes from an id-only scan.
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto id_only() const -> bool
  {
    return id_only_;
  }

  /**
   * Decodes the content of the document using given codec.
   *
   * @note This method always returns an empty `std::optional` unless
   * the {@link collection#scan()} request was made using {@link scan_options#ids_only()}
   * set to false.
   *
   * @tparam Document custom type that `Transcoder` returns
   * @tparam Transcoder type that has static function `decode` that takes codec::encoded_value and
   * returns `Document`
   * @return decoded document content
   *
   * @since 1.0.0
   * @committed
   */
  template<typename Document,
           typename Transcoder = codec::default_json_transcoder,
           std::enable_if_t<!codec::is_transcoder_v<Document>, bool> = true,
           std::enable_if_t<codec::is_transcoder_v<Transcoder>, bool> = true>
  [[nodiscard]] auto content_as() const -> Document
  {
    if (id_only_) {
      return {};
    }
    if constexpr (codec::is_crypto_transcoder_v<Transcoder>) {
      return Transcoder::template decode<Document>(value_, crypto_manager_);
    } else {
      return Transcoder::template decode<Document>(value_);
    }
  }

  /**
   * If the document has an expiry, returns the point in time when the loaded
   * document expires.
   *
   * @note This method always returns an empty `std::optional` unless
   * the {@link collection#scan()} request was made using {@link scan_options#ids_only()}
   * set to false.
   *
   * @return expiry time if present
   *
   * @since 1.0.0
   * @uncommitted
   */
  [[nodiscard]] auto expiry_time() const
    -> const std::optional<std::chrono::system_clock::time_point>&
  {
    return expiry_time_;
  }

private:
  std::string id_{};
  bool id_only_{};
  codec::encoded_value value_{};
  std::optional<std::chrono::system_clock::time_point> expiry_time_{};
  std::shared_ptr<crypto::manager> crypto_manager_{};
};
} // namespace couchbase
