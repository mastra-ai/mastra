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

#include <optional>
#include <string>
#include <system_error>

namespace couchbase::core::management::analytics
{
/**
 * An external analytics link which uses the Microsoft Azure Blob Storage service.
 * Only available as of 7.0 Developer Preview.
 */
struct azure_blob_external_link {
  /**
   * The name of this link.
   */
  std::string link_name{};

  /**
   * The dataverse that this link belongs to.
   */
  std::string dataverse{};

  /**
   * The connection string can be used as an authentication method, connectionString contains other
   * authentication methods embedded inside the string. Only a single authentication method can be
   * used. (e.g. "AccountName=myAccountName;AccountKey=myAccountKey").
   */
  std::optional<std::string> connection_string{};

  /**
   * Azure blob storage account name
   */
  std::optional<std::string> account_name{};

  /**
   * Azure blob storage account key
   */
  std::optional<std::string> account_key{};

  /**
   * Token that can be used for authentication
   */
  std::optional<std::string> shared_access_signature{};

  /**
   * Azure blob storage endpoint
   */
  std::optional<std::string> blob_endpoint{};

  /**
   * Azure blob endpoint suffix
   */
  std::optional<std::string> endpoint_suffix{};

  [[nodiscard]] auto validate() const -> std::error_code;

  [[nodiscard]] auto encode() const -> std::string;
};
} // namespace couchbase::core::management::analytics
