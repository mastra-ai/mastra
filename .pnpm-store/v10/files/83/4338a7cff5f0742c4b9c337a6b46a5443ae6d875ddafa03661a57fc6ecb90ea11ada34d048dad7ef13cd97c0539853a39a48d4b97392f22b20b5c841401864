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

#include <cstdint>
#include <optional>
#include <string>
#include <utility>

namespace couchbase::core::transactions
{
/**
 * @brief Stores some $document metadata from when the document is fetched
 */
class document_metadata
{
public:
  /**
   *  @internal
   *  @brief Create document metadata, given results of a kv operation
   *
   *  We expect this constructor to become private soon.
   */
  document_metadata(std::optional<std::string> cas,
                    std::optional<std::string> revid,
                    std::optional<std::uint32_t> exptime,
                    std::optional<std::string> crc32)
    : cas_(std::move(cas))
    , revid_(std::move(revid))
    , exptime_(exptime)
    , crc32_(std::move(crc32))
  {
  }

  /** @internal
   * @brief Create document metadata, used in responses from query server.
   *
   * @param cas string representation of document cas.
   */
  explicit document_metadata(std::string cas)
    : cas_(std::move(cas))
  {
  }

  /**
   * @brief Get CAS for the document
   *
   * @return the CAS of the document, as a string.
   */
  [[nodiscard]] auto cas() const -> std::optional<std::string>
  {
    return cas_;
  }

  /**
   * @brief Get revid for the document
   *
   * @return the revid of the document, as a string.
   */
  [[nodiscard]] auto revid() const -> std::optional<std::string>
  {
    return revid_;
  }

  /**
   * @brief Get the expiry of the document, if set
   *
   * @return the expiry of the document, if one was set, and the request
   *         specified it.
   */
  [[nodiscard]] auto exptime() const -> std::optional<std::uint32_t>
  {
    return exptime_;
  }

  /**
   * @brief Get the crc for the document
   *
   * @return the crc-32 for the document, as a string
   */
  [[nodiscard]] auto crc32() const -> std::optional<std::string>
  {
    return crc32_;
  }

private:
  std::optional<std::string> cas_;
  std::optional<std::string> revid_;
  std::optional<std::uint32_t> exptime_;
  std::optional<std::string> crc32_;
};
} // namespace couchbase::core::transactions
