/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *   Copyright 2023-present Couchbase, Inc.
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

namespace couchbase::management
{

enum analytics_link_type {
  /**
   * S3 external analytics link. Corresponds to a @ref s3_external_analytics_link
   */
  s3_external,

  /**
   * Azure external analytics link. Corresponds to a @ref azure_blob_external_analytics_link
   */
  azure_external,

  /**
   * A remote analytics link that uses a Couchbase data service that is not part of the same cluster
   * as the Analytics service. Corresponds to a @ref couchbase_remote_analytics_link
   */
  couchbase_remote,
};

enum analytics_encryption_level {
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
  full
};

struct analytics_link {
  std::string name;
  std::string dataverse_name;

  virtual ~analytics_link() = default;

  /**
   * Returns the type of this analytics link
   *
   * @return the link type
   */
  [[nodiscard]] virtual auto link_type() const -> analytics_link_type = 0;

  analytics_link() = default;
  analytics_link(std::string name, std::string dataverse_name);
};

struct couchbase_analytics_encryption_settings {
  /**
   * Specifies what level of encryption should be applied
   */
  analytics_encryption_level encryption_level{ analytics_encryption_level::none };

  /**
   * The certificate to use for encryption when the encryption level is set to 'full'.
   */
  std::optional<std::string> certificate{};

  /**
   * The certificate to use for authenticating when the encryption level is set to 'full'. Cannot be
   * set if a username and password are provided
   */
  std::optional<std::string> client_certificate{};

  /**
   * The client key to use for authenticating when the encryption level is set to 'full'.  Cannot be
   * set if a username and password are provided
   */
  std::optional<std::string> client_key{};
};

struct couchbase_remote_analytics_link : analytics_link {
  std::string hostname;
  couchbase_analytics_encryption_settings encryption{};
  std::optional<std::string> username{};
  std::optional<std::string> password{};

  [[nodiscard]] auto link_type() const -> analytics_link_type override
  {
    return analytics_link_type::couchbase_remote;
  }

  /**
   * Constructs an empty remote Couchbase analytics link.
   *
   * @since 1.0.0
   * @committed
   */
  couchbase_remote_analytics_link() = default;

  /**
   * Constructs and initializes a remote Couchbase analytics link with the given parameters. A
   * remote analytics link uses a Couchbase data service that is not part of the same cluster as the
   * Analytics service.
   *
   * @param name the name of the link
   * @param dataverse_name the dataverse that the link belongs to. Its format can be one part
   * `dataversename` or two parts `bucket_name/scope_name`
   * @param hostname the hostname of the target Couchbase cluster
   * @param encryption the encryption settings for the link
   * @param username the username to use for authentication with the remote cluster. Optional if
   * client certificate authentication is being used
   * @param password the password to use for authentication with the remote cluster. Optional if
   * client-certificate authentication is being used
   *
   * @since 1.0.0
   * @committed
   */
  couchbase_remote_analytics_link(std::string name,
                                  std::string dataverse_name,
                                  std::string hostname,
                                  couchbase_analytics_encryption_settings encryption = {},
                                  std::optional<std::string> username = {},
                                  std::optional<std::string> password = {});
};

struct s3_external_analytics_link : analytics_link {
  std::string access_key_id;
  std::string secret_access_key;
  std::string region;
  std::optional<std::string> session_token{};
  std::optional<std::string> service_endpoint{};

  [[nodiscard]] auto link_type() const -> analytics_link_type override
  {
    return analytics_link_type::s3_external;
  }

  /**
   * Constructs an empty external S3 analytics link
   *
   * @committed
   * @since 1.0.0
   */
  s3_external_analytics_link() = default;

  /**
   * Constructs and initializes an external S3 analytics link with the given parameters.
   *
   * @param name the name of the link
   * @param dataverse_name the name of the dataverse the link belongs to
   * @param access_key_id the AWS S3 access key
   * @param secret_access_key the AWS S3 secret key
   * @param region the AWS S3 region
   * @param session_token the AWS S3 token if temporary credentials are provided
   * @param service_endpoint the AWS S3 service endpoint
   *
   * @committed
   * @since 1.0.0
   */
  s3_external_analytics_link(std::string name,
                             std::string dataverse_name,
                             std::string access_key_id,
                             std::string secret_access_key,
                             std::string region,
                             std::optional<std::string> session_token = {},
                             std::optional<std::string> service_endpoint = {});
};

struct azure_blob_external_analytics_link : analytics_link {
  std::optional<std::string> connection_string{};
  std::optional<std::string> account_name{};
  std::optional<std::string> account_key{};
  std::optional<std::string> shared_access_signature{};
  std::optional<std::string> blob_endpoint{};
  std::optional<std::string> endpoint_suffix{};

  [[nodiscard]] auto link_type() const -> analytics_link_type override
  {
    return analytics_link_type::azure_external;
  }

  /**
   * Constructs an empty external Azure blob analytics link.
   *
   * @committed
   * @since 1.0.0
   */
  azure_blob_external_analytics_link() = default;

  /**
   * Constructs and initializes an external Azure blob analytics link.
   *
   * @param name the name of the link
   * @param dataverse_name the name of the dataverse the link belongs to
   * @param connection_string the connection string that can be used as an authentication method. It
   * contains other authentication methods embedded inside the string. Only a single authentication
   * method can be used (e.g. "AccountName=myAccountName;AccountKey=myAccountKey").
   * @param account_name the Azure blob storage account name
   * @param account_key the Azure blob storage account key
   * @param shared_access_signature token that can be used for authentication
   * @param blob_endpoint the Azure blob storage endpoint
   * @param endpoint_suffix the Azure blob endpoint suffix
   *
   * @committed
   * @since 1.0.0
   */
  azure_blob_external_analytics_link(std::string name,
                                     std::string dataverse_name,
                                     std::optional<std::string> connection_string = {},
                                     std::optional<std::string> account_name = {},
                                     std::optional<std::string> account_key = {},
                                     std::optional<std::string> shared_access_signature = {},
                                     std::optional<std::string> blob_endpoint = {},
                                     std::optional<std::string> endpoint_suffix = {});
};

} // namespace couchbase::management
