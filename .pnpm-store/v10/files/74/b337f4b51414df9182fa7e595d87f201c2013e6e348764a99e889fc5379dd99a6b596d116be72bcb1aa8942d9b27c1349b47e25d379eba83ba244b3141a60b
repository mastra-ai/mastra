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

#include "origin.hxx"
#include <couchbase/build_config.hxx>

#include "core/utils/connection_string.hxx"
#include "topology/configuration.hxx"

#include <spdlog/fmt/bundled/chrono.h>
#include <spdlog/fmt/bundled/core.h>

#include <tao/json.hpp>

#include <random>
#include <utility>

namespace tao::json
{

template<>
struct traits<std::chrono::milliseconds> {
  template<template<typename...> class Traits>
  static void assign(tao::json::basic_value<Traits>& v, const std::chrono::milliseconds& o)
  {
    v = fmt::format("{}", o);
  }
};

template<>
struct traits<std::chrono::nanoseconds> {
  template<template<typename...> class Traits>
  static void assign(tao::json::basic_value<Traits>& v, const std::chrono::nanoseconds& o)
  {
    v = fmt::format("{}", o);
  }
};

template<>
struct traits<couchbase::core::tls_verify_mode> {
  template<template<typename...> class Traits>
  static void assign(tao::json::basic_value<Traits>& v, const couchbase::core::tls_verify_mode& o)
  {
    switch (o) {
      case couchbase::core::tls_verify_mode::none:
        v = "none";
        break;
      case couchbase::core::tls_verify_mode::peer:
        v = "peer";
        break;
    }
  }
};

template<>
struct traits<couchbase::core::io::ip_protocol> {
  template<template<typename...> class Traits>
  static void assign(tao::json::basic_value<Traits>& v, const couchbase::core::io::ip_protocol& o)
  {
    switch (o) {
      case couchbase::core::io::ip_protocol::any:
        v = "any";
        break;
      case couchbase::core::io::ip_protocol::force_ipv4:
        v = "force_ipv4";
        break;
      case couchbase::core::io::ip_protocol::force_ipv6:
        v = "force_ipv6";
        break;
    }
  }
};

template<>
struct traits<couchbase::core::io::dns::dns_config> {
  template<template<typename...> class Traits>
  static void assign(tao::json::basic_value<Traits>& v,
                     const couchbase::core::io::dns::dns_config& o)
  {
    v = {
      { "port", o.port() },
      { "nameserver", o.nameserver() },
      { "timeout", o.timeout() },
    };
  }
};

template<>
struct traits<couchbase::core::tracing::threshold_logging_options> {
  template<template<typename...> class Traits>
  static void assign(tao::json::basic_value<Traits>& v,
                     const couchbase::core::tracing::threshold_logging_options& o)
  {
    v = {
      { "orphaned_emit_interval", o.orphaned_emit_interval },
      { "orphaned_sample_size", o.orphaned_sample_size },
      { "threshold_emit_interval", o.threshold_emit_interval },
      { "threshold_sample_size", o.threshold_sample_size },
      { "key_value_threshold", o.key_value_threshold },
      { "query_threshold", o.query_threshold },
      { "view_threshold", o.view_threshold },
      { "search_threshold", o.search_threshold },
      { "analytics_threshold", o.analytics_threshold },
      { "management_threshold", o.management_threshold },
    };
  }
};

template<>
struct traits<couchbase::core::metrics::logging_meter_options> {
  template<template<typename...> class Traits>
  static void assign(tao::json::basic_value<Traits>& v,
                     const couchbase::core::metrics::logging_meter_options& o)
  {
    v = {
      { "emit_interval", o.emit_interval },
    };
  }
};

template<>
struct traits<couchbase::durability_level> {
  template<template<typename...> class Traits>
  static void assign(tao::json::basic_value<Traits>& v, const couchbase::durability_level& o)
  {
    switch (o) {
      case couchbase::durability_level::none:
        v = "none";
        break;
      case couchbase::durability_level::majority:
        v = "majority";
        break;
      case couchbase::durability_level::majority_and_persist_to_active:
        v = "majority_and_persist_to_active";
        break;
      case couchbase::durability_level::persist_to_majority:
        v = "persist_to_majority";
        break;
    }
  }
};

template<>
struct traits<couchbase::query_scan_consistency> {
  template<template<typename...> class Traits>
  static void assign(tao::json::basic_value<Traits>& v, const couchbase::query_scan_consistency& o)
  {
    switch (o) {
      case couchbase::query_scan_consistency::not_bounded:
        v = "not_bounded";
        break;
      case couchbase::query_scan_consistency::request_plus:
        v = "request_plus";
        break;
    }
  }
};

template<>
struct traits<couchbase::transactions::transactions_config::built> {
  template<template<typename...> class Traits>
  static void assign(tao::json::basic_value<Traits>& v,
                     const couchbase::transactions::transactions_config::built& o)
  {
    v = {
      { "timeout", o.timeout },
      { "durability_level", o.level },
      {
        "query_config",
        {
          { "scan_consistency", o.query_config.scan_consistency },
        },
      },
      {
        "cleanup_config",
        {
          { "cleanup_lost_attempts", o.cleanup_config.cleanup_lost_attempts },
          { "cleanup_client_attempts", o.cleanup_config.cleanup_client_attempts },
          { "cleanup_window", o.cleanup_config.cleanup_window },
          { "collections", tao::json::empty_array },
        },
      },
    };
    if (const auto& p = o.metadata_collection; p.has_value()) {
      v["metadata_collection"] = {
        { "bucket", p.value().bucket },
        { "scope", p.value().scope },
        { "collection", p.value().collection },
      };
    }
    for (const auto& c : o.cleanup_config.collections) {
      v["cleanup_config"]["collections"].emplace_back(tao::json::value{
        { "bucket", c.bucket },
        { "scope", c.scope },
        { "collection", c.collection },
      });
    }
  }
};

template<>
struct traits<couchbase::core::columnar::security_options> {
  template<template<typename...> class Traits>
  static void assign(tao::json::basic_value<Traits>& v,
                     const couchbase::core::columnar::security_options& o)
  {
    v = {
      { "trust_only_capella", o.trust_only_capella },
      { "trust_only_pem_file", o.trust_only_pem_file },
      { "trust_only_pem_string", o.trust_only_pem_string },
      { "trust_only_platform", o.trust_only_platform },
      { "trust_only_certificates", o.trust_only_certificates.size() },
      // TODO(JC): add if/when we support the cipher_suites option
      // { "cipher_suites", utils::join_strings(o.cipher_suites, ":") },
    };
  }
};

} // namespace tao::json

namespace couchbase::core
{
auto
origin::to_json() const -> std::string
{
  tao::json::value json = {
    {
      "options",
      {
        { "bootstrap_timeout", options_.bootstrap_timeout },
        { "resolve_timeout", options_.resolve_timeout },
        { "connect_timeout", options_.connect_timeout },
        { "query_timeout", options_.query_timeout },
        { "management_timeout", options_.management_timeout },
        { "trust_certificate", options_.trust_certificate },
        { "use_ip_protocol", options_.use_ip_protocol },
        { "enable_dns_srv", options_.enable_dns_srv },
        { "dns_config", options_.dns_config },
        { "enable_clustermap_notification", options_.enable_clustermap_notification },
        { "config_poll_interval", options_.config_poll_interval },
        { "config_poll_floor", options_.config_poll_floor },
        { "user_agent_extra", options_.user_agent_extra },
        { "dump_configuration", options_.dump_configuration },
        { "disable_mozilla_ca_certificates", options_.disable_mozilla_ca_certificates },
        { "network", options_.network },
        { "tls_verify", options_.tls_verify },
#ifdef COUCHBASE_CXX_CLIENT_COLUMNAR
        { "dispatch_timeout", options_.dispatch_timeout },
        { "security_options", options_.security_options },
#else
        { "key_value_timeout", options_.key_value_timeout },
        { "key_value_durable_timeout", options_.key_value_durable_timeout },
        { "view_timeout", options_.view_timeout },
        { "analytics_timeout", options_.analytics_timeout },
        { "search_timeout", options_.search_timeout },
        { "enable_tls", options_.enable_tls },
        { "enable_mutation_tokens", options_.enable_mutation_tokens },
        { "enable_tcp_keep_alive", options_.enable_tcp_keep_alive },
        { "show_queries", options_.show_queries },
        { "enable_unordered_execution", options_.enable_unordered_execution },
        { "enable_compression", options_.enable_compression },
        { "enable_tracing", options_.enable_tracing },
        { "enable_metrics", options_.enable_metrics },
        { "tcp_keep_alive_interval", options_.tcp_keep_alive_interval },
        { "config_idle_redial_timeout", options_.config_idle_redial_timeout },
        { "max_http_connections", options_.max_http_connections },
        { "idle_http_connection_timeout", options_.idle_http_connection_timeout },
        { "metrics_options", options_.metrics_options },
        { "tracing_options", options_.tracing_options },
        { "transactions_options", options_.transactions },
        { "server_group", options_.server_group },
#endif
      },
    },
  };
  {
    tao::json::value nodes = tao::json::empty_array;
    for (const auto& [hostname, port] : nodes_) {
      nodes.emplace_back(tao::json::value{
        { "hostname", hostname },
        { "port", port },
      });
    }
    json["bootstrap_nodes"] = nodes;
  }
  return tao::json::to_string(json);
}

} // namespace couchbase::core

couchbase::core::origin::origin(const couchbase::core::origin& other)
  : options_(other.options_)
  , credentials_(other.credentials_)
  , nodes_(other.nodes_)
  , next_node_(nodes_.begin())
{
}

couchbase::core::origin::origin(origin other, const topology::configuration& config)
  : origin(std::move(other))
{
  set_nodes_from_config(config);
}

couchbase::core::origin::origin(couchbase::core::cluster_credentials auth,
                                const std::string& hostname,
                                std::uint16_t port,
                                couchbase::core::cluster_options options)
  : options_(std::move(options))
  , credentials_(std::move(auth))
  , nodes_{ { hostname, std::to_string(port) } }
  , next_node_(nodes_.begin())
{
}
couchbase::core::origin::origin(couchbase::core::cluster_credentials auth,
                                const std::string& hostname,
                                const std::string& port,
                                couchbase::core::cluster_options options)
  : options_(std::move(options))
  , credentials_(std::move(auth))
  , nodes_{ { hostname, port } }
  , next_node_(nodes_.begin())
{
}
couchbase::core::origin::origin(couchbase::core::cluster_credentials auth,
                                const couchbase::core::utils::connection_string& connstr)
  : options_(connstr.options)
  , credentials_(std::move(auth))
  , connection_string_(connstr.input)
{
  nodes_.reserve(connstr.bootstrap_nodes.size());
  for (const auto& node : connstr.bootstrap_nodes) {
    nodes_.emplace_back(node.address,
                        node.port > 0 ? std::to_string(node.port)
                                      : std::to_string(connstr.default_port));
  }
  if (!options_.preserve_bootstrap_nodes_order) {
    shuffle_nodes();
  }
  next_node_ = nodes_.begin();
}
auto
couchbase::core::origin::operator=(const couchbase::core::origin& other) -> couchbase::core::origin&
{
  if (this != &other) {
    options_ = other.options_;
    credentials_ = other.credentials_;
    nodes_ = other.nodes_;
    next_node_ = nodes_.begin();
    exhausted_ = false;
  }
  return *this;
}
auto
couchbase::core::origin::connection_string() const -> const std::string&
{
  return connection_string_;
}
auto
couchbase::core::origin::username() const -> const std::string&
{
  return credentials_.username;
}
auto
couchbase::core::origin::password() const -> const std::string&
{
  return credentials_.password;
}
auto
couchbase::core::origin::certificate_path() const -> const std::string&
{
  return credentials_.certificate_path;
}
auto
couchbase::core::origin::key_path() const -> const std::string&
{
  return credentials_.key_path;
}
auto
couchbase::core::origin::get_hostnames() const -> std::vector<std::string>
{
  std::vector<std::string> res;
  res.reserve(nodes_.size());
  for (const auto& [hostname, _] : nodes_) {
    res.emplace_back(hostname);
  }
  return res;
}
auto
couchbase::core::origin::get_nodes() const -> std::vector<std::string>
{
  std::vector<std::string> res;
  res.reserve(nodes_.size());
  for (const auto& [hostname, port] : nodes_) {
    res.emplace_back(fmt::format("\"{}:{}\"", hostname, port));
  }
  return res;
}

void
couchbase::core::origin::shuffle_nodes()
{
  static thread_local std::default_random_engine gen{ std::random_device{}() };
  std::shuffle(nodes_.begin(), nodes_.end(), gen);
}

void
couchbase::core::origin::set_nodes(couchbase::core::origin::node_list nodes)
{
  nodes_ = std::move(nodes);
  if (!options_.preserve_bootstrap_nodes_order) {
    shuffle_nodes();
  }
  next_node_ = nodes_.begin();
  exhausted_ = false;
}
void
couchbase::core::origin::set_nodes_from_config(const topology::configuration& config)
{
  nodes_.clear();
  if (options_.network == "default") {
    for (const auto& node : config.nodes) {
      if (auto port =
            options_.enable_tls ? node.services_tls.key_value : node.services_plain.key_value;
          port.has_value()) {
        nodes_.emplace_back(node.hostname, std::to_string(port.value()));
      }
    }
  } else {
    for (const auto& node : config.nodes) {
      auto port = node.port_or(options_.network, service_type::key_value, options_.enable_tls, 0);
      if (port == 0) {
        continue;
      }
      nodes_.emplace_back(
        std::make_pair(node.hostname_for(options_.network), std::to_string(port)));
    }
  }
  if (!options_.preserve_bootstrap_nodes_order) {
    shuffle_nodes();
  }
  next_node_ = nodes_.begin();
}
auto
couchbase::core::origin::next_address() -> std::pair<std::string, std::string>
{
  if (exhausted_) {
    restart();
  }

  auto address = *next_node_;
  if (++next_node_ == nodes_.end()) {
    exhausted_ = true;
  }
  return address;
}
auto
couchbase::core::origin::exhausted() const -> bool
{
  return exhausted_;
}
void
couchbase::core::origin::restart()
{
  exhausted_ = false;
  next_node_ = nodes_.begin();
}
auto
couchbase::core::origin::options() const -> const couchbase::core::cluster_options&
{
  return options_;
}
auto
couchbase::core::origin::options() -> couchbase::core::cluster_options&
{
  return options_;
}
auto
couchbase::core::origin::credentials() const -> const couchbase::core::cluster_credentials&
{
  return credentials_;
}
