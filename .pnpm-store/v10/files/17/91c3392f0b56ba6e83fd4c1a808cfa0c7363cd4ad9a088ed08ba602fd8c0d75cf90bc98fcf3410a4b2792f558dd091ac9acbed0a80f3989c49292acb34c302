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
enum class couchbase_link_encryption_level {
  /**
   * Connect to the remote Couchbase cluster using an unsecured channel. Send the password in
   * plaintext.
   */
  none,

  /**
   * Connect to the remote Couchbase cluster using an unsecured channel. Send the password securely
   * using SASL.
   */
  half,

  /**
   * Connect to the remote Couchbase cluster using a channel secured by TLS. If a password is used,
   * it is sent over the secure channel.
   *
   * Requires specifying the certificate to trust.
   */
  full,
};

auto
to_string(couchbase_link_encryption_level level) -> std::string;

struct couchbase_link_encryption_settings {
  /**
   * Specifies what level of encryption should be used.
   */
  couchbase_link_encryption_level level{ couchbase_link_encryption_level::none };

  /**
   * Provides a certificate to use for connecting when encryption level is set to 'full'.  Required
   * when 'encryption_level' is set to 'full'.
   */
  std::optional<std::string> certificate{};

  /**
   * Provides a client certificate to use for connecting when encryption level is set to 'full'.
   * Cannot be set if a username/password are used.
   */
  std::optional<std::string> client_certificate{};

  /**
   * Provides a client key to use for connecting when encryption level is set to 'full'.  Cannot be
   * set if a username/password are used.
   */
  std::optional<std::string> client_key{};
};

/**
 * A remote analytics link which uses a Couchbase data service that is not part of the same cluster
 * as the Analytics Service.
 */
struct couchbase_remote_link {
  /**
   * The name of this link.
   */
  std::string link_name{};

  /**
   * The dataverse that this link belongs to.
   */
  std::string dataverse{};

  /**
   * The hostname of the target Couchbase cluster.
   */
  std::string hostname{};

  /**
   * The username to use for authentication with the remote cluster. Optional if client-certificate
   * authentication is being used.
   */
  std::optional<std::string> username{};

  /**
   * The password to use for authentication with the remote cluster. Optional if client-certificate
   * authentication is being used.
   */
  std::optional<std::string> password{};

  couchbase_link_encryption_settings encryption{};

  [[nodiscard]] auto validate() const -> std::error_code;

  [[nodiscard]] auto encode() const -> std::string;
};
} // namespace couchbase::core::management::analytics
