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

#include <couchbase/codec/default_json_transcoder.hxx>
#include <couchbase/result.hxx>

#include <vector>

namespace couchbase
{
#ifndef COUCHBASE_CXX_CLIENT_DOXYGEN
namespace crypto
{
class manager;
} // namespace crypto
#endif

/**
 * Represents result of @ref collection#get_any_replica operations, also returned by @ref
 * collection#get_all_replicas.
 *
 * @since 1.0.0
 * @committed
 */
class get_replica_result : public result
{
public:
  /**
   * @since 1.0.0
   * @internal
   */
  get_replica_result() = default;

  /**
   * Constructs result for get_any_replica operation, or an entry for get_all_replicas operation.
   *
   * @param cas
   * @param is_replica true if the document originates from replica node
   * @param value raw document contents along with flags describing its structure
   *
   * @since 1.0.0
   * @committed
   */
  get_replica_result(couchbase::cas cas,
                     bool is_replica,
                     codec::encoded_value value,
                     std::shared_ptr<crypto::manager> crypto_manager = {})
    : result{ cas }
    , is_replica_{ is_replica }
    , value_{ std::move(value) }
    , crypto_manager_{ std::move(crypto_manager) }
  {
  }

  /**
   *
   * @return true if the document came from replica, false for active node.
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto is_replica() const -> bool
  {
    return is_replica_;
  }

  /**
   * Decodes content of the document using given transcoder.
   *
   * @tparam Transcoder type that has static function `decode` that takes codec::encoded_value and
   * returns `Transcoder::document_type`
   * @return decoded document content
   *
   * @par Get flags and value as they are stored in the result
   *  Here is an example of custom transcoder, that just extracts value and flags as they are stored
   * in the result.
   * @snippet{trimleft} test_integration_read_replica.cxx smuggling-transcoder
   *  Usage
   * @snippet{trimleft} test_integration_read_replica.cxx smuggling-transcoder-usage
   *
   * @since 1.0.0
   * @committed
   */
  template<typename Transcoder, std::enable_if_t<codec::is_transcoder_v<Transcoder>, bool> = true>
  [[nodiscard]] auto content_as() const -> typename Transcoder::document_type
  {
    if constexpr (codec::is_crypto_transcoder_v<Transcoder>) {
      return Transcoder::decode(value_, crypto_manager_);
    } else {
      return Transcoder::decode(value_);
    }
  }

  /**
   * Decodes content of the document using given codec.
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
    if constexpr (codec::is_crypto_transcoder_v<Transcoder>) {
      return Transcoder::template decode<Document>(value_, crypto_manager_);
    } else {
      return Transcoder::template decode<Document>(value_);
    }
  }

private:
  bool is_replica_{ false };
  codec::encoded_value value_{};
  std::shared_ptr<crypto::manager> crypto_manager_{};
};

} // namespace couchbase
