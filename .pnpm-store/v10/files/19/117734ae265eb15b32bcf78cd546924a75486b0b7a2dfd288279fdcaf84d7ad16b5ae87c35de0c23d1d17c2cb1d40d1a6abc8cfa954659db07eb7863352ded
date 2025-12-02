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

#include "configuration.hxx"

#include <tao/json/forward.hpp>

#include <limits>

namespace tao::json
{
template<>
struct traits<couchbase::core::topology::configuration> {
  template<template<typename...> class Traits>
  static auto as(const tao::json::basic_value<Traits>& v)
    -> couchbase::core::topology::configuration
  {
    couchbase::core::topology::configuration result;
    result.id = couchbase::core::uuid::random();
    result.epoch = v.template optional<std::int64_t>("revEpoch");
    result.rev = v.template optional<std::int64_t>("rev");

    if (auto* node_locator = v.find("nodeLocator");
        node_locator != nullptr && node_locator->is_string()) {
      if (node_locator->get_string() == "ketama") {
        result.node_locator = couchbase::core::topology::configuration::node_locator_type::ketama;
      } else {
        result.node_locator = couchbase::core::topology::configuration::node_locator_type::vbucket;
      }
    }

    if (auto* nodes_ext = v.find("nodesExt"); nodes_ext != nullptr) {
      size_t index = 0;
      for (const auto& j : nodes_ext->get_array()) {
        couchbase::core::topology::configuration::node n;
        n.index = index++;
        const auto& o = j.get_object();
        if (const auto& this_node = o.find("thisNode");
            this_node != o.end() && this_node->second.get_boolean()) {
          n.this_node = true;
        }
        if (const auto& hostname = o.find("hostname"); hostname != o.end()) {
          n.hostname = hostname->second.get_string();
        }
        if (const auto& group = o.find("serverGroup"); group != o.end()) {
          n.server_group = group->second.get_string();
        }
        if (const auto& path = o.find("appTelemetryPath"); path != o.end()) {
          n.app_telemetry_path = path->second.get_string();
        }
        if (const auto& uuid = o.find("nodeUUID"); uuid != o.end()) {
          n.node_uuid = uuid->second.get_string();
        }
        const auto& s = o.at("services");
        n.services_plain.key_value = s.template optional<std::uint16_t>("kv");
        n.services_plain.management = s.template optional<std::uint16_t>("mgmt");
        n.services_plain.search = s.template optional<std::uint16_t>("fts");
        n.services_plain.analytics = s.template optional<std::uint16_t>("cbas");
        n.services_plain.query = s.template optional<std::uint16_t>("n1ql");
        n.services_plain.views = s.template optional<std::uint16_t>("capi");
        n.services_plain.eventing = s.template optional<std::uint16_t>("eventingAdminPort");
        n.services_tls.key_value = s.template optional<std::uint16_t>("kvSSL");
        n.services_tls.management = s.template optional<std::uint16_t>("mgmtSSL");
        n.services_tls.search = s.template optional<std::uint16_t>("ftsSSL");
        n.services_tls.analytics = s.template optional<std::uint16_t>("cbasSSL");
        n.services_tls.query = s.template optional<std::uint16_t>("n1qlSSL");
        n.services_tls.views = s.template optional<std::uint16_t>("capiSSL");
        n.services_tls.eventing = s.template optional<std::uint16_t>("eventingSSL");
        {
          const auto& alt = o.find("alternateAddresses");
          if (alt != o.end()) {
            for (const auto& entry : alt->second.get_object()) {
              couchbase::core::topology::configuration::alternate_address addr;
              addr.name = entry.first;
              addr.hostname = entry.second.at("hostname").get_string();
              const auto& ports = entry.second.find("ports");
              addr.services_plain.key_value = ports->template optional<std::uint16_t>("kv");
              addr.services_plain.management = ports->template optional<std::uint16_t>("mgmt");
              addr.services_plain.search = ports->template optional<std::uint16_t>("fts");
              addr.services_plain.analytics = ports->template optional<std::uint16_t>("cbas");
              addr.services_plain.query = ports->template optional<std::uint16_t>("n1ql");
              addr.services_plain.views = ports->template optional<std::uint16_t>("capi");
              addr.services_plain.eventing =
                ports->template optional<std::uint16_t>("eventingAdminPort");
              addr.services_tls.key_value = ports->template optional<std::uint16_t>("kvSSL");
              addr.services_tls.management = ports->template optional<std::uint16_t>("mgmtSSL");
              addr.services_tls.search = ports->template optional<std::uint16_t>("ftsSSL");
              addr.services_tls.analytics = ports->template optional<std::uint16_t>("cbasSSL");
              addr.services_tls.query = ports->template optional<std::uint16_t>("n1qlSSL");
              addr.services_tls.views = ports->template optional<std::uint16_t>("capiSSL");
              addr.services_tls.eventing = ports->template optional<std::uint16_t>("eventingSSL");
              n.alt.emplace(entry.first, addr);
            }
          }
        }
        result.nodes.emplace_back(n);
      }
    } else {
      if (result.node_locator ==
          couchbase::core::topology::configuration::node_locator_type::vbucket) {
        const auto* m = v.find("vBucketServerMap");
        const auto& nodes = v.at("nodes").get_array();
        if (m != nullptr) {
          if (const auto* s = m->find("serverList"); s != nullptr && s->is_array()) {
            std::size_t index = 0;
            for (const auto& j : s->get_array()) {
              couchbase::core::topology::configuration::node n;
              n.index = index++;
              const auto& address = j.get_string();
              n.hostname = address.substr(0, address.rfind(':'));
              n.services_plain.key_value =
                static_cast<std::uint16_t>(std::stoul(address.substr(address.rfind(':') + 1)));
              if (n.index >= nodes.size()) {
                continue;
              }
              if (const auto& np = nodes[n.index]; np.is_object()) {
                const auto& o = np.get_object();

                if (const auto& this_node = o.find("thisNode");
                    this_node != o.end() && this_node->second.get_boolean()) {
                  n.this_node = true;
                }
                const auto& p = o.at("ports");
                if (auto https_views = p.template optional<std::int64_t>("httpsCAPI");
                    https_views && https_views.value() > 0 &&
                    https_views.value() < std::numeric_limits<std::uint16_t>::max()) {
                  n.services_tls.views = static_cast<std::uint16_t>(https_views.value());
                }
                if (auto https_mgmt = p.template optional<std::int64_t>("httpsMgmt");
                    https_mgmt && https_mgmt.value() > 0 &&
                    https_mgmt.value() < std::numeric_limits<std::uint16_t>::max()) {
                  n.services_tls.management = static_cast<std::uint16_t>(https_mgmt.value());
                }
                const auto& h = o.at("hostname").get_string();
                n.services_plain.management =
                  static_cast<std::uint16_t>(std::stoul(h.substr(h.rfind(':') + 1)));
                std::string capi = o.at("couchApiBase").get_string();
                auto slash = capi.rfind('/');
                auto colon = capi.rfind(':', slash);
                n.services_plain.views =
                  static_cast<std::uint16_t>(std::stoul(capi.substr(colon + 1, slash)));
              }
              result.nodes.emplace_back(n);
            }
          }
        }
      } else {
        std::size_t index = 0;
        for (const auto& node : v.at("nodes").get_array()) {
          couchbase::core::topology::configuration::node n;
          n.index = index++;
          const auto& o = node.get_object();

          if (const auto& this_node = o.find("thisNode");
              this_node != o.end() && this_node->second.get_boolean()) {
            n.this_node = true;
          }
          const auto& p = o.at("ports");
          if (auto direct = p.template optional<std::int64_t>("direct");
              direct && direct.value() > 0 &&
              direct.value() < std::numeric_limits<std::uint16_t>::max()) {
            n.services_plain.key_value = static_cast<std::uint16_t>(direct.value());
          }
          if (auto https_views = p.template optional<std::int64_t>("httpsCAPI");
              https_views && https_views.value() > 0 &&
              https_views.value() < std::numeric_limits<std::uint16_t>::max()) {
            n.services_tls.views = static_cast<std::uint16_t>(https_views.value());
          }

          if (auto https_mgmt = p.template optional<std::int64_t>("httpsMgmt");
              https_mgmt && https_mgmt.value() > 0 &&
              https_mgmt.value() < std::numeric_limits<std::uint16_t>::max()) {
            n.services_tls.management = static_cast<std::uint16_t>(https_mgmt.value());
          }
          const auto& h = o.at("hostname").get_string();
          auto colon = h.rfind(':');
          n.hostname = h.substr(0, colon);
          n.services_plain.management = static_cast<std::uint16_t>(std::stoul(h.substr(colon + 1)));

          std::string capi = o.at("couchApiBase").get_string();
          auto slash = capi.rfind('/');
          colon = capi.rfind(':', slash);
          n.services_plain.views =
            static_cast<std::uint16_t>(std::stoul(capi.substr(colon + 1, slash)));

          result.nodes.emplace_back(n);
        }
      }
    }
    if (const auto m = v.find("uuid"); m != nullptr) {
      result.uuid = m->get_string();
    }
    if (const auto m = v.find("collectionsManifestUid"); m != nullptr) {
      result.collections_manifest_uid = std::stoull(m->get_string(), nullptr, 16);
    }
    if (const auto m = v.find("name"); m != nullptr) {
      result.bucket = m->get_string();
    }

    if (const auto m = v.find("vBucketServerMap"); m != nullptr) {
      const auto& o = m->get_object();
      if (const auto f = o.find("numReplicas"); f != o.end()) {
        result.num_replicas = f->second.template as<std::uint32_t>();
      }
      if (const auto f = o.find("vBucketMap"); f != o.end()) {
        const auto& vb = f->second.get_array();
        couchbase::core::topology::configuration::vbucket_map vbmap;
        vbmap.resize(vb.size());
        for (size_t i = 0; i < vb.size(); i++) {
          const auto& p = vb[i].get_array();
          vbmap[i].resize(p.size());
          for (size_t n = 0; n < p.size(); n++) {
            vbmap[i][n] = p[n].template as<std::int16_t>();
          }
        }
        result.vbmap = vbmap;
      }
    }
    if (const auto m = v.find("bucketCapabilities"); m != nullptr && m->is_array()) {
      for (const auto& entry : m->get_array()) {
        const auto& name = entry.get_string();
        if (name == "couchapi") {
          result.capabilities.bucket.insert(couchbase::core::bucket_capability::couchapi);
        } else if (name == "collections") {
          result.capabilities.bucket.insert(couchbase::core::bucket_capability::collections);
        } else if (name == "durableWrite") {
          result.capabilities.bucket.insert(couchbase::core::bucket_capability::durable_write);
        } else if (name == "tombstonedUserXAttrs") {
          result.capabilities.bucket.insert(
            couchbase::core::bucket_capability::tombstoned_user_xattrs);
        } else if (name == "dcp") {
          result.capabilities.bucket.insert(couchbase::core::bucket_capability::dcp);
        } else if (name == "cbhello") {
          result.capabilities.bucket.insert(couchbase::core::bucket_capability::cbhello);
        } else if (name == "touch") {
          result.capabilities.bucket.insert(couchbase::core::bucket_capability::touch);
        } else if (name == "cccp") {
          result.capabilities.bucket.insert(couchbase::core::bucket_capability::cccp);
        } else if (name == "xdcrCheckpointing") {
          result.capabilities.bucket.insert(couchbase::core::bucket_capability::xdcr_checkpointing);
        } else if (name == "nodesExt") {
          result.capabilities.bucket.insert(couchbase::core::bucket_capability::nodes_ext);
        } else if (name == "xattr") {
          result.capabilities.bucket.insert(couchbase::core::bucket_capability::xattr);
        } else if (name == "rangeScan") {
          result.capabilities.bucket.insert(couchbase::core::bucket_capability::range_scan);
        } else if (name == "subdoc.ReplicaRead") {
          result.capabilities.bucket.insert(
            couchbase::core::bucket_capability::subdoc_replica_read);
        } else if (name == "subdoc.AccessDeleted") {
          result.capabilities.bucket.insert(
            couchbase::core::bucket_capability::subdoc_access_deleted);
        } else if (name == "nonDedupedHistory") {
          result.capabilities.bucket.insert(
            couchbase::core::bucket_capability::non_deduped_history);
        } else if (name == "subdoc.ReplaceBodyWithXattr") {
          result.capabilities.bucket.insert(
            couchbase::core::bucket_capability::subdoc_replace_body_with_xattr);
        } else if (name == "subdoc.DocumentMacroSupport") {
          result.capabilities.bucket.insert(
            couchbase::core::bucket_capability::subdoc_document_macro_support);
        } else if (name == "subdoc.ReviveDocument") {
          result.capabilities.bucket.insert(
            couchbase::core::bucket_capability::subdoc_revive_document);
        } else if (name == "dcp.IgnorePurgedTombstones") {
          result.capabilities.bucket.insert(
            couchbase::core::bucket_capability::dcp_ignore_purged_tombstones);
        } else if (name == "preserve_expiry") {
          result.capabilities.bucket.insert(couchbase::core::bucket_capability::preserve_expiry);
        } else if (name == "querySystemCollection") {
          result.capabilities.bucket.insert(
            couchbase::core::bucket_capability::query_system_collection);
        } else if (name == "mobileSystemCollection") {
          result.capabilities.bucket.insert(
            couchbase::core::bucket_capability::mobile_system_collection);
        }
      }
    }
    if (const auto m = v.find("clusterCapabilities"); m != nullptr && m->is_object()) {
      if (const auto nc = m->find("n1ql"); nc != nullptr && nc->is_array()) {
        for (const auto& entry : nc->get_array()) {
          if (const auto& name = entry.get_string(); name == "costBasedOptimizer") {
            result.capabilities.cluster.insert(
              couchbase::core::cluster_capability::n1ql_cost_based_optimizer);
          } else if (name == "indexAdvisor") {
            result.capabilities.cluster.insert(
              couchbase::core::cluster_capability::n1ql_index_advisor);
          } else if (name == "javaScriptFunctions") {
            result.capabilities.cluster.insert(
              couchbase::core::cluster_capability::n1ql_javascript_functions);
          } else if (name == "inlineFunctions") {
            result.capabilities.cluster.insert(
              couchbase::core::cluster_capability::n1ql_inline_functions);
          } else if (name == "enhancedPreparedStatements") {
            result.capabilities.cluster.insert(
              couchbase::core::cluster_capability::n1ql_enhanced_prepared_statements);
          } else if (name == "readFromReplica") {
            result.capabilities.cluster.insert(
              couchbase::core::cluster_capability::n1ql_read_from_replica);
          }
        }
      }
      if (const auto sc = m->find("search"); sc != nullptr && sc->is_array()) {
        for (const auto& entry : sc->get_array()) {
          if (const auto& name = entry.get_string(); name == "vectorSearch") {
            result.capabilities.cluster.insert(
              couchbase::core::cluster_capability::search_vector_search);
          } else if (name == "scopedSearchIndex") {
            result.capabilities.cluster.insert(
              couchbase::core::cluster_capability::search_scoped_search_index);
          }
        }
      }
    }

    if (const auto n = v.find("clusterName"); n != nullptr) {
      result.cluster_name = n->get_string();
    }
    if (const auto u = v.find("clusterUUID"); u != nullptr) {
      result.cluster_uuid = u->get_string();
    }
    if (const auto n = v.find("prod"); n != nullptr) {
      result.prod = n->get_string();
      result.capabilities.prod = result.prod;
    }

    return result;
  }
};
} // namespace tao::json
