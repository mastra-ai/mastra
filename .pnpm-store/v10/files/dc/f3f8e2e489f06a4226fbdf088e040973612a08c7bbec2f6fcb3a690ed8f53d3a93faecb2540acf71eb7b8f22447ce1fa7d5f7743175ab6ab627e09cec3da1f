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

#include "analytics_link_s3_external.hxx"

#include "core/utils/url_codec.hxx"

#include <couchbase/error_codes.hxx>

#include <algorithm>

namespace couchbase::core::management::analytics
{
auto
s3_external_link::validate() const -> std::error_code
{
  if (dataverse.empty() || link_name.empty() || access_key_id.empty() ||
      secret_access_key.empty() || region.empty()) {
    return errc::common::invalid_argument;
  }
  return {};
}

auto
s3_external_link::encode() const -> std::string
{
  std::map<std::string, std::string> values{
    { "type", "s3" },
    { "accessKeyId", access_key_id },
    { "secretAccessKey", secret_access_key },
    { "region", region },
  };
  if (std::count(dataverse.begin(), dataverse.end(), '/') == 0) {
    values["dataverse"] = dataverse;
    values["name"] = link_name;
  }
  if (session_token) {
    values["sessionToken"] = session_token.value();
  }
  if (service_endpoint) {
    values["serviceEndpoint"] = service_endpoint.value();
  }
  return utils::string_codec::v2::form_encode(values);
}
} // namespace couchbase::core::management::analytics
