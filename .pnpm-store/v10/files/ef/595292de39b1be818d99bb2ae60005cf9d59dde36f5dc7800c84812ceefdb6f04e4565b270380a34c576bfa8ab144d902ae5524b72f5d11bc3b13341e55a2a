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
 * An external analytics link which uses the AWS S3 service to access data.
 */
struct s3_external_link {
  /**
   * The name of this link.
   */
  std::string link_name{};

  /**
   * The dataverse that this link belongs to.
   */
  std::string dataverse{};

  /**
   * AWS S3 access key ID
   */
  std::string access_key_id{};

  /**
   * AWS S3 secret key
   */
  std::string secret_access_key{};

  /**
   * AWS S3 token if temporary credentials are provided. Only available in 7.0+
   */
  std::optional<std::string> session_token{};

  /**
   * AWS S3 region
   */
  std::string region{};

  /**
   * AWS S3 service endpoint
   */
  std::optional<std::string> service_endpoint{};

  [[nodiscard]] auto validate() const -> std::error_code;

  [[nodiscard]] auto encode() const -> std::string;
};
} // namespace couchbase::core::management::analytics
