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

#include "analytics_link_s3_external.hxx"

#include <tao/json/forward.hpp>

namespace tao::json
{
template<>
struct traits<couchbase::core::management::analytics::s3_external_link> {
  template<template<typename...> class Traits>
  static auto as(const tao::json::basic_value<Traits>& v)
    -> couchbase::core::management::analytics::s3_external_link
  {
    couchbase::core::management::analytics::s3_external_link result{};

    result.link_name = v.at("name").get_string();
    if (const auto* dataverse = v.find("dataverse"); dataverse != nullptr) {
      result.dataverse = dataverse->get_string();
    } else {
      result.dataverse = v.at("scope").get_string();
    }
    result.access_key_id = v.at("accessKeyId").get_string();
    result.region = v.at("region").get_string();
    if (const auto* service_endpoint = v.find("serviceEndpoint");
        service_endpoint != nullptr && service_endpoint->is_string()) {
      result.service_endpoint.emplace(service_endpoint->get_string());
    }
    return result;
  }
};
} // namespace tao::json
