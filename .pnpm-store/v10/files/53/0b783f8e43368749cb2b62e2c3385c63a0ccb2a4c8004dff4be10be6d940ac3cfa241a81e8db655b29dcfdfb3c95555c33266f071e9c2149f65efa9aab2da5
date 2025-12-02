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

#include "bucket_settings.hxx"

#include <tao/json/forward.hpp>

namespace tao::json
{
template<>
struct traits<couchbase::core::management::cluster::bucket_settings> {
  template<template<typename...> class Traits>
  static auto as(const tao::json::basic_value<Traits>& v)
    -> couchbase::core::management::cluster::bucket_settings
  {
    couchbase::core::management::cluster::bucket_settings result;
    result.name = v.at("name").get_string();
    result.uuid = v.at("uuid").get_string();
    const static std::uint64_t megabyte = 1024LLU * 1024LLU;
    result.ram_quota_mb = v.at("quota").at("rawRAM").get_unsigned() / megabyte;
    result.num_replicas = v.at("replicaNumber").template as<std::optional<std::uint32_t>>();

    if (auto* max_ttl = v.find("maxTTL"); max_ttl != nullptr) {
      result.max_expiry = max_ttl->template as<std::optional<std::uint32_t>>();
    }

    if (auto* history_retention_default = v.find("historyRetentionCollectionDefault");
        history_retention_default != nullptr) {
      result.history_retention_collection_default =
        history_retention_default->template as<std::optional<bool>>();
    }
    if (auto* history_retention_bytes = v.find("historyRetentionBytes");
        history_retention_bytes != nullptr) {
      result.history_retention_bytes =
        history_retention_bytes->template as<std::optional<std::uint32_t>>();
    }
    if (auto* history_retention_duration = v.find("historyRetentionSeconds");
        history_retention_duration != nullptr) {
      result.history_retention_duration =
        history_retention_duration->template as<std::optional<std::uint32_t>>();
    }

    if (auto* num_vbuckets = v.find("numVBuckets"); num_vbuckets != nullptr) {
      result.num_vbuckets = num_vbuckets->template as<std::optional<std::uint16_t>>();
    }

    if (auto& str = v.at("bucketType").get_string(); str == "couchbase" || str == "membase") {
      result.bucket_type = couchbase::core::management::cluster::bucket_type::couchbase;
    } else if (str == "ephemeral") {
      result.bucket_type = couchbase::core::management::cluster::bucket_type::ephemeral;
    } else if (str == "memcached") {
      result.bucket_type = couchbase::core::management::cluster::bucket_type::memcached;
    }

    if (auto* compression_mode = v.find("compressionMode");
        compression_mode != nullptr && compression_mode->is_string()) {
      if (auto& str = compression_mode->get_string(); str == "active") {
        result.compression_mode = couchbase::core::management::cluster::bucket_compression::active;
      } else if (str == "passive") {
        result.compression_mode = couchbase::core::management::cluster::bucket_compression::passive;
      } else if (str == "off") {
        result.compression_mode = couchbase::core::management::cluster::bucket_compression::off;
      }
    }

    if (auto& str = v.at("evictionPolicy").get_string(); str == "valueOnly") {
      result.eviction_policy =
        couchbase::core::management::cluster::bucket_eviction_policy::value_only;
    } else if (str == "fullEviction") {
      result.eviction_policy = couchbase::core::management::cluster::bucket_eviction_policy::full;
    } else if (str == "noEviction") {
      result.eviction_policy =
        couchbase::core::management::cluster::bucket_eviction_policy::no_eviction;
    } else if (str == "nruEviction") {
      result.eviction_policy =
        couchbase::core::management::cluster::bucket_eviction_policy::not_recently_used;
    }

    if (auto* storage_backend = v.find("storageBackend");
        storage_backend != nullptr && storage_backend->is_string()) {
      if (const auto& str = storage_backend->get_string(); str == "couchstore") {
        result.storage_backend =
          couchbase::core::management::cluster::bucket_storage_backend::couchstore;
      } else if (str == "magma") {
        result.storage_backend =
          couchbase::core::management::cluster::bucket_storage_backend::magma;
      }
    }

    if (auto* min_level = v.find("durabilityMinLevel"); min_level != nullptr) {
      if (auto& str = min_level->get_string(); str == "none") {
        result.minimum_durability_level = couchbase::durability_level::none;
      } else if (str == "majority") {
        result.minimum_durability_level = couchbase::durability_level::majority;
      } else if (str == "majorityAndPersistActive") {
        result.minimum_durability_level =
          couchbase::durability_level::majority_and_persist_to_active;
      } else if (str == "persistToMajority") {
        result.minimum_durability_level = couchbase::durability_level::persist_to_majority;
      }
    }

    if (auto& str = v.at("conflictResolutionType").get_string(); str == "lww") {
      result.conflict_resolution_type =
        couchbase::core::management::cluster::bucket_conflict_resolution::timestamp;
    } else if (str == "seqno") {
      result.conflict_resolution_type =
        couchbase::core::management::cluster::bucket_conflict_resolution::sequence_number;
    } else if (str == "custom") {
      result.conflict_resolution_type =
        couchbase::core::management::cluster::bucket_conflict_resolution::custom;
    }

    result.flush_enabled = v.at("controllers").find("flush") != nullptr;
    if (const auto replica_index = v.find("replicaIndex")) {
      result.replica_indexes = replica_index->get_boolean();
    }
    if (const auto caps = v.find("bucketCapabilities"); caps != nullptr) {
      for (auto& cap : caps->get_array()) {
        result.capabilities.emplace_back(cap.get_string());
      }
    }
    for (auto& n : v.at("nodes").get_array()) {
      couchbase::core::management::cluster::bucket_settings::node node;
      node.status = n.at("status").get_string();
      node.hostname = n.at("hostname").get_string();
      node.version = n.at("version").get_string();
      for (auto& s : n.at("services").get_array()) {
        node.services.emplace_back(s.get_string());
      }
      for (auto& p : n.at("ports").get_object()) {
        node.ports.emplace(p.first, p.second.template as<std::uint16_t>());
      }
      result.nodes.emplace_back(node);
    }
    return result;
  }
};
} // namespace tao::json
