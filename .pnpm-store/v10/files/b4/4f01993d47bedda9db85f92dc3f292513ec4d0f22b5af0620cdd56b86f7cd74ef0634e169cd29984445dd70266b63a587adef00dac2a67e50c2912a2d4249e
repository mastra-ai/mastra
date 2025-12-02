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

#include "analytics_link_couchbase_remote.hxx"

#include "core/utils/url_codec.hxx"

#include <couchbase/error_codes.hxx>

#include <algorithm>

namespace couchbase::core::management::analytics
{
auto
couchbase_remote_link::validate() const -> std::error_code
{
  if (dataverse.empty() || link_name.empty() || hostname.empty()) {
    return errc::common::invalid_argument;
  }
  switch (encryption.level) {
    case couchbase_link_encryption_level::none:
    case couchbase_link_encryption_level::half:
      if (/* username and password must be provided */ username.has_value() &&
          password.has_value() &&
          /* and client certificate and key must be empty */
          (!encryption.client_certificate.has_value() && !encryption.client_key.has_value())) {

        return {};
      }
      return errc::common::invalid_argument;

    case couchbase_link_encryption_level::full:
      if (/* certificate must be provided and */ encryption.certificate.has_value() &&
          (/* either username/password must be set */ (
             username.has_value() && password.has_value() &&
             !encryption.client_certificate.has_value() && !encryption.client_key.has_value()) ||
           /* or client certificate/key must be set */ (
             !username.has_value() && !password.has_value() &&
             encryption.client_certificate.has_value() && encryption.client_key.has_value()))) {
        return {};
      }
      return errc::common::invalid_argument;
  }
  return {};
}

auto
couchbase_remote_link::encode() const -> std::string
{
  std::map<std::string, std::string> values{
    { "type", "couchbase" },
    { "hostname", hostname },
    { "encryption", to_string(encryption.level) },
  };
  if (std::count(dataverse.begin(), dataverse.end(), '/') == 0) {
    values["dataverse"] = dataverse;
    values["name"] = link_name;
  }
  if (username) {
    values["username"] = username.value();
  }
  if (password) {
    values["password"] = password.value();
  }
  if (encryption.certificate) {
    values["certificate"] = encryption.certificate.value();
  }
  if (encryption.client_certificate) {
    values["clientCertificate"] = encryption.client_certificate.value();
  }
  if (encryption.client_key) {
    values["clientKey"] = encryption.client_key.value();
  }
  return utils::string_codec::v2::form_encode(values);
}

auto
to_string(couchbase_link_encryption_level level) -> std::string
{
  switch (level) {
    case couchbase_link_encryption_level::none:
      return "none";

    case couchbase_link_encryption_level::half:
      return "half";

    case couchbase_link_encryption_level::full:
      return "full";
  }
  return "none";
}
} // namespace couchbase::core::management::analytics
