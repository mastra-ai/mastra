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

#include "analytics_link_azure_blob_external.hxx"

#include <tao/json/forward.hpp>

namespace tao::json
{
template<>
struct traits<couchbase::core::management::analytics::azure_blob_external_link> {
  template<template<typename...> class Traits>
  static auto as(const tao::json::basic_value<Traits>& v)
    -> couchbase::core::management::analytics::azure_blob_external_link
  {
    couchbase::core::management::analytics::azure_blob_external_link result{};

    result.link_name = v.at("name").get_string();
    if (const auto* dataverse = v.find("dataverse"); dataverse != nullptr) {
      result.dataverse = dataverse->get_string();
    } else {
      result.dataverse = v.at("scope").get_string();
    }

    if (const auto* account_name = v.find("accountName");
        account_name != nullptr && account_name->is_string()) {
      result.account_name.emplace(account_name->get_string());
    }
    if (const auto* blob_endpoint = v.find("blobEndpoint");
        blob_endpoint != nullptr && blob_endpoint->is_string()) {
      result.blob_endpoint.emplace(blob_endpoint->get_string());
    }
    if (const auto* endpoint_suffix = v.find("endpointSuffix");
        endpoint_suffix != nullptr && endpoint_suffix->is_string()) {
      result.endpoint_suffix.emplace(endpoint_suffix->get_string());
    }
    return result;
  }
};
} // namespace tao::json
