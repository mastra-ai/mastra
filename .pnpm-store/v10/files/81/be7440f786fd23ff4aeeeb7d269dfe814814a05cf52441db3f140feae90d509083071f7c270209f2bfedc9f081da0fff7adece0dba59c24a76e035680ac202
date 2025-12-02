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

#include "analytics_link_couchbase_remote.hxx"

#include <tao/json/forward.hpp>

namespace tao::json
{
template<>
struct traits<couchbase::core::management::analytics::couchbase_remote_link> {
  template<template<typename...> class Traits>
  static auto as(const tao::json::basic_value<Traits>& v)
    -> couchbase::core::management::analytics::couchbase_remote_link
  {
    couchbase::core::management::analytics::couchbase_remote_link result{};

    result.link_name = v.at("name").get_string();
    if (const auto* dataverse = v.find("dataverse"); dataverse != nullptr) {
      result.dataverse = dataverse->get_string();
    } else {
      result.dataverse = v.at("scope").get_string();
    }
    result.hostname = v.at("activeHostname").get_string();
    if (const auto* encryption = v.find("encryption");
        encryption != nullptr && encryption->is_string()) {
      const auto& level = encryption->get_string();
      if (level == "none") {
        result.encryption.level =
          couchbase::core::management::analytics::couchbase_link_encryption_level::none;
      } else if (level == "half") {
        result.encryption.level =
          couchbase::core::management::analytics::couchbase_link_encryption_level::half;
      } else if (level == "full") {
        result.encryption.level =
          couchbase::core::management::analytics::couchbase_link_encryption_level::full;
      }
    }
    if (const auto* username = v.find("username"); username != nullptr && username->is_string()) {
      result.username.emplace(username->get_string());
    }
    if (const auto* certificate = v.find("certificate");
        certificate != nullptr && certificate->is_string()) {
      result.encryption.certificate.emplace(certificate->get_string());
    }
    if (const auto* client_certificate = v.find("clientCertificate");
        client_certificate != nullptr && client_certificate->is_string()) {
      result.encryption.client_certificate.emplace(client_certificate->get_string());
    }
    return result;
  }
};
} // namespace tao::json
