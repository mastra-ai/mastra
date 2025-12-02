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

#include "core/service_type_fmt.hxx"
#include "core/utils/join_strings.hxx"

#include <spdlog/fmt/bundled/core.h>

template<>
struct fmt::formatter<couchbase::core::topology::configuration::node> {
  template<typename ParseContext>
  constexpr auto parse(ParseContext& ctx)
  {
    return ctx.begin();
  }

  template<typename FormatContext>
  auto format(const couchbase::core::topology::configuration::node& node, FormatContext& ctx) const
  {
    std::vector<std::string> plain;
    if (node.services_plain.key_value) {
      plain.push_back(fmt::format("kv={}", *node.services_plain.key_value));
    }
    if (node.services_plain.management) {
      plain.push_back(fmt::format("mgmt={}", *node.services_plain.management));
    }
    if (node.services_plain.analytics) {
      plain.push_back(fmt::format("cbas={}", *node.services_plain.analytics));
    }
    if (node.services_plain.search) {
      plain.push_back(fmt::format("fts={}", *node.services_plain.search));
    }
    if (node.services_plain.query) {
      plain.push_back(fmt::format("n1ql={}", *node.services_plain.query));
    }
    if (node.services_plain.views) {
      plain.push_back(fmt::format("capi={}", *node.services_plain.views));
    }
    std::vector<std::string> tls;
    if (node.services_tls.key_value) {
      tls.push_back(fmt::format("kv={}", *node.services_tls.key_value));
    }
    if (node.services_tls.management) {
      tls.push_back(fmt::format("mgmt={}", *node.services_tls.management));
    }
    if (node.services_tls.analytics) {
      tls.push_back(fmt::format("cbas={}", *node.services_tls.analytics));
    }
    if (node.services_tls.search) {
      tls.push_back(fmt::format("fts={}", *node.services_tls.search));
    }
    if (node.services_tls.query) {
      tls.push_back(fmt::format("n1ql={}", *node.services_tls.query));
    }
    if (node.services_tls.views) {
      tls.push_back(fmt::format("capi={}", *node.services_tls.views));
    }
    std::vector<std::string> alternate_addresses{};
    if (!node.alt.empty()) {
      alternate_addresses.reserve(node.alt.size());
      for (const auto& entry : node.alt) {
        std::string network =
          fmt::format(R"(name="{}", host="{}")", entry.second.name, entry.second.hostname);
        {
          std::vector<std::string> ports;
          if (entry.second.services_plain.key_value) {
            ports.push_back(fmt::format("kv={}", *entry.second.services_plain.key_value));
          }
          if (entry.second.services_plain.management) {
            ports.push_back(fmt::format("mgmt={}", *entry.second.services_plain.management));
          }
          if (entry.second.services_plain.analytics) {
            ports.push_back(fmt::format("cbas={}", *entry.second.services_plain.analytics));
          }
          if (entry.second.services_plain.search) {
            ports.push_back(fmt::format("fts={}", *entry.second.services_plain.search));
          }
          if (entry.second.services_plain.query) {
            ports.push_back(fmt::format("n1ql={}", *entry.second.services_plain.query));
          }
          if (entry.second.services_plain.views) {
            ports.push_back(fmt::format("capi={}", *entry.second.services_plain.views));
          }
          if (!ports.empty()) {
            network +=
              fmt::format(", plain=({})", couchbase::core::utils::join_strings(ports, ","));
          }
        }
        {
          std::vector<std::string> ports;
          if (entry.second.services_tls.key_value) {
            ports.push_back(fmt::format("kv={}", *entry.second.services_tls.key_value));
          }
          if (entry.second.services_tls.management) {
            ports.push_back(fmt::format("mgmt={}", *entry.second.services_tls.management));
          }
          if (entry.second.services_tls.analytics) {
            ports.push_back(fmt::format("cbas={}", *entry.second.services_tls.analytics));
          }
          if (entry.second.services_tls.search) {
            ports.push_back(fmt::format("fts={}", *entry.second.services_tls.search));
          }
          if (entry.second.services_tls.query) {
            ports.push_back(fmt::format("n1ql={}", *entry.second.services_tls.query));
          }
          if (entry.second.services_tls.views) {
            ports.push_back(fmt::format("capi={}", *entry.second.services_tls.views));
          }
          if (!ports.empty()) {
            network += fmt::format(", tls=({})", couchbase::core::utils::join_strings(ports, ","));
          }
        }
        alternate_addresses.emplace_back(network);
      }
    }
    return format_to(ctx.out(),
                     R"(#<node:{} hostname="{}", plain=({}), tls=({}), alt=[{}]>)",
                     node.index,
                     node.hostname,
                     couchbase::core::utils::join_strings(plain, ", "),
                     couchbase::core::utils::join_strings(tls, ", "),
                     couchbase::core::utils::join_strings(alternate_addresses, ", "));
  }
};

template<>
struct fmt::formatter<couchbase::core::topology::configuration> {
  template<typename ParseContext>
  constexpr auto parse(ParseContext& ctx)
  {
    return ctx.begin();
  }

  template<typename FormatContext>
  auto format(const couchbase::core::topology::configuration& config, FormatContext& ctx) const
  {
    return format_to(
      ctx.out(),
      R"(#<config:{} rev={}{}{}{}{}, nodes({})=[{}], bucket_caps=[{}], cluster_caps=[{}]>)",
      couchbase::core::uuid::to_string(config.id),
      config.rev_str(),
      config.uuid ? fmt::format(", uuid={}", *config.uuid) : "",
      config.bucket ? fmt::format(", bucket={}", *config.bucket) : "",
      config.num_replicas ? fmt::format(", replicas={}", *config.num_replicas) : "",
      config.vbmap.has_value() ? fmt::format(", partitions={}", config.vbmap->size()) : "",
      config.nodes.size(),
      couchbase::core::utils::join_strings_fmt(config.nodes, ", "),
      couchbase::core::utils::join_strings_fmt(config.capabilities.bucket, ", "),
      couchbase::core::utils::join_strings_fmt(config.capabilities.cluster, ", "));
  }
};
