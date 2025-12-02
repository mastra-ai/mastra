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

#include <couchbase/build_config.hxx>

#include "connection_string.hxx"
#include "core/logger/logger.hxx"
#include "core/meta/version.hxx"
#include "duration_parser.hxx"
#include "url_codec.hxx"

#include <tao/pegtl.hpp>
#include <tao/pegtl/contrib/uri.hpp>

namespace couchbase::core::utils
{
namespace priv
{
using namespace tao::pegtl;

struct bucket_name : seq<uri::segment_nz> {
};
using param_key = star<sor<abnf::ALPHA, abnf::DIGIT, one<'_', '.'>>>;
using param_value = star<sor<minus<uri::pchar, one<'=', '&', '?'>>, one<'/'>>>;
struct param : seq<param_key, one<'='>, param_value> {
};

using sub_delims = minus<uri::sub_delims, one<',', '='>>; // host and mode separators
struct reg_name : star<sor<uri::unreserved, uri::pct_encoded, sub_delims>> {
};
struct host : sor<uri::IP_literal, uri::IPv4address, reg_name> {
};

struct mode
  : sor<istring<'c', 'c', 'c', 'p'>,
        istring<'g', 'c', 'c', 'c', 'p'>,
        istring<'h', 't', 't', 'p'>,
        istring<'m', 'c', 'd'>> {
};
using node = seq<host, opt<uri::colon, uri::port>, opt<one<'='>, mode>>;

using opt_bucket_name = opt_must<one<'/'>, bucket_name>;
using opt_params = opt_must<one<'?'>, list_must<param, one<'&'>>>;
using opt_nodes = seq<list_must<node, one<',', ';'>>, opt_bucket_name>;

struct scheme : seq<uri::scheme, one<':'>, uri::dslash> {
};
using opt_scheme = opt<scheme>;

using grammar = must<seq<opt_scheme, opt_nodes, opt_params, tao::pegtl::eof>>;

template<typename Rule>
struct action {
};

template<>
struct action<scheme> {
  template<typename ActionInput>
  static void apply(const ActionInput& in,
                    connection_string& cs,
                    connection_string::node& /* cur_node */)
  {
    cs.scheme = in.string().substr(0, in.string().rfind(':'));
    if (cs.scheme == "couchbase") {
      cs.default_port = 11210;
      cs.default_mode = connection_string::bootstrap_mode::gcccp;
      cs.tls = false;
    } else if (cs.scheme == "couchbases") {
      cs.default_port = 11207;
      cs.default_mode = connection_string::bootstrap_mode::gcccp;
      cs.tls = true;
    } else if (cs.scheme == "http") {
      cs.default_port = 8091;
      cs.default_mode = connection_string::bootstrap_mode::http;
      cs.tls = false;
    } else if (cs.scheme == "https") {
      cs.default_port = 18091;
      cs.default_mode = connection_string::bootstrap_mode::http;
      cs.tls = true;
    } else {
      cs.default_mode = connection_string::bootstrap_mode::unspecified;
      cs.default_port = 0;
    }
  }
};

template<>
struct action<param> {
  template<typename ActionInput>
  static void apply(const ActionInput& in,
                    connection_string& cs,
                    connection_string::node& /* cur_node */)
  {
    const auto& pair = in.string();
    auto eq = pair.find('=');
    const std::string key = pair.substr(0, eq);
    cs.params[key] = (eq == std::string::npos) ? "" : pair.substr(eq + 1);
  }
};

template<>
struct action<reg_name> {
  template<typename ActionInput>
  static void apply(const ActionInput& in,
                    connection_string& /* cs */,
                    connection_string::node& cur_node)
  {
    cur_node.type = connection_string::address_type::dns;
    cur_node.address = in.string_view();
  }
};

template<>
struct action<uri::IPv4address> {
  template<typename ActionInput>
  static void apply(const ActionInput& in,
                    connection_string& /* cs */,
                    connection_string::node& cur_node)
  {
    cur_node.type = connection_string::address_type::ipv4;
    cur_node.address = in.string_view();
  }
};

template<>
struct action<uri::IPv6address> {
  template<typename ActionInput>
  static void apply(const ActionInput& in,
                    connection_string& /* cs */,
                    connection_string::node& cur_node)
  {
    cur_node.type = connection_string::address_type::ipv6;
    cur_node.address = in.string_view();
  }
};

template<>
struct action<node> {
  template<typename ActionInput>
  static void apply(const ActionInput& /* in */,
                    connection_string& cs,
                    connection_string::node& cur_node)
  {
    if (!cur_node.address.empty()) {
      cs.bootstrap_nodes.push_back(cur_node);
    }
    cur_node = {};
  }
};

template<>
struct action<uri::port> {
  template<typename ActionInput>
  static void apply(const ActionInput& in,
                    connection_string& /* cs */,
                    connection_string::node& cur_node)
  {
    if (in.empty()) {
      return;
    }
    cur_node.port = static_cast<std::uint16_t>(std::stoul(in.string()));
  }
};

template<>
struct action<mode> {
  template<typename ActionInput>
  static void apply(const ActionInput& in,
                    connection_string& /* cs */,
                    connection_string::node& cur_node)
  {
    std::string mode = in.string();
    std::transform(mode.begin(), mode.end(), mode.begin(), [](unsigned char c) {
      return std::tolower(c);
    });
    if (mode == "mcd" || mode == "gcccp" || mode == "cccp") {
      cur_node.mode = connection_string::bootstrap_mode::gcccp;
    } else if (mode == "http") {
      cur_node.mode = connection_string::bootstrap_mode::http;
    }
  }
};

template<>
struct action<bucket_name> {
  template<typename ActionInput>
  static void apply(const ActionInput& in,
                    connection_string& cs,
                    connection_string::node& /* cur_node */)
  {
    cs.default_bucket_name = in.string();
  }
};
} // namespace priv

namespace
{
void
parse_option(std::string& receiver,
             const std::string& /* name */,
             const std::string& value,
             std::vector<std::string>& /* warnings */)
{
  receiver = string_codec::url_decode(value);
}

void
parse_option(bool& receiver,
             const std::string& name,
             const std::string& value,
             std::vector<std::string>& warnings)
{
  if (value == "true" || value == "yes" || value == "on") {
    receiver = true;
  } else if (value == "false" || value == "no" || value == "off") {
    receiver = false;
  } else {
    warnings.push_back(fmt::format(
      R"(unable to parse "{}" parameter in connection string (value "{}" cannot be interpreted as a boolean))",
      name,
      value));
  }
}

void
parse_option(io::ip_protocol& receiver,
             const std::string& name,
             const std::string& value,
             std::vector<std::string>& warnings)
{
  if (value == "any") {
    receiver = io::ip_protocol::any;
  } else if (value == "force_ipv4") {
    receiver = io::ip_protocol::force_ipv4;
  } else if (value == "force_ipv6") {
    receiver = io::ip_protocol::force_ipv6;
  } else {
    warnings.push_back(fmt::format(
      R"(unable to parse "{}" parameter in connection string (value "{}" is not a valid IP protocol preference))",
      name,
      value));
  }
}

#ifdef COUCHBASE_CXX_CLIENT_COLUMNAR
void
parse_option(std::chrono::milliseconds& receiver,
             const std::string& name,
             const std::string& value,
             std::vector<std::string>& warnings)
{
  try {
    receiver = std::chrono::duration_cast<std::chrono::milliseconds>(
      parse_duration(string_codec::url_decode(value)));
  } catch (const duration_parse_error& dpe) {
    warnings.push_back(
      fmt::format(R"(unable to parse "{}" parameter in connection string (value: "{}"): {})",
                  name,
                  value,
                  dpe.what()));
  } catch (const std::invalid_argument& ex1) {
    warnings.push_back(fmt::format(
      R"(unable to parse "{}" parameter in connection string (value "{}" is not a number): {})",
      name,
      value,
      ex1.what()));
  } catch (const std::out_of_range& ex2) {
    warnings.push_back(fmt::format(
      R"(unable to parse "{}" parameter in connection string (value "{}" is out of range): {})",
      name,
      value,
      ex2.what()));
  }
}
#else
void
parse_option(tls_verify_mode& receiver,
             const std::string& name,
             const std::string& value,
             std::vector<std::string>& warnings)
{
  if (value == "none") {
    receiver = tls_verify_mode::none;
  } else if (value == "peer") {
    receiver = tls_verify_mode::peer;
  } else {
    warnings.push_back(fmt::format(
      R"(unable to parse "{}" parameter in connection string (value "{}" is not a valid TLS verification mode))",
      name,
      value));
  }
}

void
parse_option(std::size_t& receiver,
             const std::string& name,
             const std::string& value,
             std::vector<std::string>& warnings)
{
  try {
    receiver = std::stoull(value, nullptr, 10);
  } catch (const std::invalid_argument& ex1) {
    warnings.push_back(fmt::format(
      R"(unable to parse "{}" parameter in connection string (value "{}" is not a number): {})",
      name,
      value,
      ex1.what()));
  } catch (const std::out_of_range& ex2) {
    warnings.push_back(fmt::format(
      R"(unable to parse "{}" parameter in connection string (value "{}" is out of range): {})",
      name,
      value,
      ex2.what()));
  }
}

void
parse_option(std::chrono::milliseconds& receiver,
             const std::string& name,
             const std::string& value,
             std::vector<std::string>& warnings)
{
  try {
    receiver = std::chrono::duration_cast<std::chrono::milliseconds>(parse_duration(value));
  } catch (const duration_parse_error&) {
    try {
      receiver = std::chrono::milliseconds(std::stoull(value, nullptr, 10));
    } catch (const std::invalid_argument& ex1) {
      warnings.push_back(fmt::format(
        R"(unable to parse "{}" parameter in connection string (value "{}" is not a number): {})",
        name,
        value,
        ex1.what()));
    } catch (const std::out_of_range& ex2) {
      warnings.push_back(fmt::format(
        R"(unable to parse "{}" parameter in connection string (value "{}" is out of range): {})",
        name,
        value,
        ex2.what()));
    }
  }
}
#endif

void
extract_options(connection_string& connstr)
{
  connstr.options.enable_tls = connstr.tls;
  if (connstr.bootstrap_nodes.size() != 1 ||
      connstr.bootstrap_nodes[0].type != connection_string::address_type::dns) {
    connstr.options.enable_dns_srv = false;
  }
  for (const auto& [name, value] : connstr.params) {
#ifdef COUCHBASE_CXX_CLIENT_COLUMNAR
    if (name == "security.trust_only_pem_file") {
      /**
       * Set the trust cert path
       */
      parse_option(connstr.options.trust_certificate, name, value, connstr.warnings);
    } else if (name == "security.disable_server_certificate_verification") {
      /**
       * Disable TLS server cert verification if set to true.
       */
      if (value == "true" || value == "yes" || value == "on" || value == "1") {
        connstr.options.tls_verify = tls_verify_mode::none;
      } else if (value == "false" || value == "no" || value == "off" || value == "0") {
        connstr.options.tls_verify = tls_verify_mode::peer;
      } else {
        connstr.warnings.push_back(fmt::format(
          R"(unable to parse "{}" parameter in connection string (value "{}" cannot be interpreted as a boolean))",
          name,
          value));
      }

    } else if (name == "timeout.connect_timeout") {
      /**
       * The period of time allocated to complete bootstrap
       */
      parse_option(connstr.options.bootstrap_timeout, name, value, connstr.warnings);
    } else if (name == "timeout.dispatch_timeout") {
      /**
       * Number of seconds to wait before timing out a Query or N1QL request by the client.
       */
      parse_option(connstr.options.dispatch_timeout, name, value, connstr.warnings);
    } else if (name == "timeout.query_timeout") {
      /**
       * Number of seconds to wait before timing out a Query or N1QL request by the client.
       */
      parse_option(connstr.options.query_timeout, name, value, connstr.warnings);
    } else if (name == "timeout.resolve_timeout") {
      /**
       * The period of time to resolve DNS name of the node to IP address
       */
      parse_option(connstr.options.resolve_timeout, name, value, connstr.warnings);
    } else if (name == "timeout.socket_connect_timeout") {
      /**
       * Number of seconds the client should wait while attempting to connect to a node’s KV service
       * via a socket. Initial connection, reconnecting, node added, etc.
       */
      parse_option(connstr.options.connect_timeout, name, value, connstr.warnings);
#else
    if (name == "kv_connect_timeout") {
      /**
       * Number of seconds the client should wait while attempting to connect to a node’s KV service
       * via a socket. Initial connection, reconnecting, node added, etc.
       */
      parse_option(connstr.options.connect_timeout, name, value, connstr.warnings);
    } else if (name == "kv_timeout" || name == "key_value_timeout") {
      /**
       * Number of milliseconds to wait before timing out a KV operation by the client.
       */
      parse_option(connstr.options.key_value_timeout, name, value, connstr.warnings);
    } else if (name == "kv_durable_timeout" || name == "key_value_durable_timeout") {
      /**
       * Number of milliseconds to wait before timing out a KV operation that is either using
       * synchronous durability or observe-based durability.
       */
      parse_option(connstr.options.key_value_durable_timeout, name, value, connstr.warnings);
    } else if (name == "view_timeout") {
      /**
       * Number of seconds to wait before timing out a View request  by the client..
       */
      parse_option(connstr.options.view_timeout, name, value, connstr.warnings);
    } else if (name == "query_timeout") {
      /**
       * Number of seconds to wait before timing out a Query or N1QL request by the client.
       */
      parse_option(connstr.options.query_timeout, name, value, connstr.warnings);
    } else if (name == "analytics_timeout") {
      /**
       * Number of seconds to wait before timing out an Analytics request by the client.
       */
      parse_option(connstr.options.analytics_timeout, name, value, connstr.warnings);
    } else if (name == "search_timeout") {
      /**
       * Number of seconds to wait before timing out a Search request by the client.
       */
      parse_option(connstr.options.search_timeout, name, value, connstr.warnings);
    } else if (name == "management_timeout") {
      /**
       * Number of seconds to wait before timing out a Management API request by the client.
       */
      parse_option(connstr.options.management_timeout, name, value, connstr.warnings);
    } else if (name == "trust_certificate") {
      parse_option(connstr.options.trust_certificate, name, value, connstr.warnings);
    } else if (name == "enable_mutation_tokens") {
      /**
       * Request mutation tokens at connection negotiation time. Turning this off will save 16 bytes
       * per operation response.
       */
      parse_option(connstr.options.enable_mutation_tokens, name, value, connstr.warnings);
    } else if (name == "enable_tcp_keep_alive") {
      /**
       * Gets or sets a value indicating whether enable TCP keep-alive.
       */
      parse_option(connstr.options.enable_tcp_keep_alive, name, value, connstr.warnings);
    } else if (name == "tcp_keep_alive_interval") {
      /**
       * Specifies the timeout, in milliseconds, with no activity until the first keep-alive packet
       * is sent. This applies to all services, but is advisory: if the underlying platform does not
       * support this on all connections, it will be applied only on those it can be.
       */
      parse_option(connstr.options.tcp_keep_alive_interval, name, value, connstr.warnings);
    } else if (name == "force_ipv4") {
      /**
       * Sets the SDK configuration to do IPv4 Name Resolution
       */
      bool force_ipv4 = false;
      parse_option(force_ipv4, name, value, connstr.warnings);
      if (force_ipv4) {
        connstr.options.use_ip_protocol = io::ip_protocol::force_ipv4;
      }
#endif
    } else if (name == "ip_protocol") {
      /**
       * Controls preference of IP protocol for name resolution
       */
      parse_option(connstr.options.use_ip_protocol, name, value, connstr.warnings);
    } else if (name == "config_poll_interval") {
      parse_option(connstr.options.config_poll_interval, name, value, connstr.warnings);
    } else if (name == "config_poll_floor") {
      parse_option(connstr.options.config_poll_floor, name, value, connstr.warnings);
    } else if (name == "enable_dns_srv") {
      if (connstr.bootstrap_nodes.size() == 1) {
        parse_option(connstr.options.enable_dns_srv, name, value, connstr.warnings);
      } else {
        connstr.warnings.push_back(fmt::format(
          R"(parameter "{}" requires single entry in bootstrap nodes list of the connection string, ignoring (value "{}"))",
          name,
          value));
      }
    } else if (name == "network") {
      connstr.options.network =
        value; /* current known values are "auto", "default" and "external" */
    } else if (name == "user_agent_extra") {
      /**
       * string, that will be appended to identification fields of the server protocols (key in HELO
       * packet for MCBP, "user-agent" header for HTTP)
       */
      parse_option(connstr.options.user_agent_extra, name, value, connstr.warnings);
    } else if (name == "dump_configuration") {
      /**
       * Whether to dump every new configuration on TRACE level
       */
      parse_option(connstr.options.dump_configuration, name, value, connstr.warnings);
    } else if (name == "enable_clustermap_notification") {
      /**
       * Allow the server to push configuration updates asynchronously.
       */
      parse_option(connstr.options.enable_clustermap_notification, name, value, connstr.warnings);
    } else if (name == "disable_mozilla_ca_certificates") {
      parse_option(connstr.options.disable_mozilla_ca_certificates, name, value, connstr.warnings);
#ifndef COUCHBASE_CXX_CLIENT_COLUMNAR
    } else if (name == "max_http_connections") {
      /**
       * The maximum number of HTTP connections allowed on a per-host and per-port basis.  0
       * indicates an unlimited number of connections are permitted.
       */
      parse_option(connstr.options.max_http_connections, name, value, connstr.warnings);
    } else if (name == "idle_http_connection_timeout") {
      /**
       * The period of time an HTTP connection can be idle before it is forcefully disconnected.
       */
      parse_option(connstr.options.idle_http_connection_timeout, name, value, connstr.warnings);
    } else if (name == "bootstrap_timeout") {
      /**
       * The period of time allocated to complete bootstrap
       */
      parse_option(connstr.options.bootstrap_timeout, name, value, connstr.warnings);
    } else if (name == "resolve_timeout") {
      /**
       * The period of time to resolve DNS name of the node to IP address
       */
      parse_option(connstr.options.resolve_timeout, name, value, connstr.warnings);
    } else if (name == "show_queries") {
      /**
       * Whether to display N1QL, Analytics, Search queries on info level (default false)
       */
      parse_option(connstr.options.show_queries, name, value, connstr.warnings);
    } else if (name == "enable_unordered_execution") {
      /**
       * Allow the server to reorder commands
       */
      parse_option(connstr.options.enable_unordered_execution, name, value, connstr.warnings);
    } else if (name == "enable_compression") {
      /**
       * Announce support of compression (snappy) to server
       */
      parse_option(connstr.options.enable_compression, name, value, connstr.warnings);
    } else if (name == "enable_tracing") {
      /**
       * true - use threshold_logging_tracer
       * false - use noop_tracer
       */
      parse_option(connstr.options.enable_tracing, name, value, connstr.warnings);
    } else if (name == "enable_metrics") {
      /**
       * true - use logging_meter
       * false - use noop_meter
       */
      parse_option(connstr.options.enable_metrics, name, value, connstr.warnings);
    } else if (name == "tls_verify") {
      parse_option(connstr.options.tls_verify, name, value, connstr.warnings);
    } else if (name == "tls_disable_deprecated_protocols") {
      parse_option(connstr.options.tls_disable_deprecated_protocols, name, value, connstr.warnings);
    } else if (name == "tls_disable_v1_2") {
      parse_option(connstr.options.tls_disable_v1_2, name, value, connstr.warnings);
    } else if (name == "server_group") {
      parse_option(connstr.options.server_group, name, value, connstr.warnings);
#endif
    } else if (name == "enable_app_telemetry") {
      parse_option(connstr.options.enable_app_telemetry, name, value, connstr.warnings);
    } else if (name == "app_telemetry_endpoint") {
      parse_option(connstr.options.app_telemetry_endpoint, name, value, connstr.warnings);
    } else if (name == "preserve_bootstrap_nodes_order") {
      parse_option(connstr.options.preserve_bootstrap_nodes_order, name, value, connstr.warnings);
    } else if (name == "allow_enterprise_analytics") {
      parse_option(connstr.options.allow_enterprise_analytics, name, value, connstr.warnings);
    } else {
      connstr.warnings.push_back(
        fmt::format(R"(unknown parameter "{}" in connection string (value "{}"))", name, value));
    }
  }
}
} // namespace

auto
parse_connection_string(const std::string& input, cluster_options options) -> connection_string
{
  connection_string res{};
  res.input = input;
  res.options = std::move(options);

  if (input.empty()) {
    res.error = "failed to parse connection string: empty input";
    return res;
  }

  auto in = tao::pegtl::memory_input(input, __FUNCTION__);
  try {
    connection_string::node node{};
    tao::pegtl::parse<priv::grammar, priv::action>(in, res, node);
  } catch (const tao::pegtl::parse_error& e) {
    for (const auto& position : e.positions()) {
      if (position.source == __FUNCTION__) {
        res.error = fmt::format("failed to parse connection string (column: {}, trailer: \"{}\")",
                                position.column,
                                input.substr(position.byte));
        break;
      }
    }
    if (!res.error) {
      res.error = e.what();
    }
  }
  extract_options(res);
  return res;
}
} // namespace couchbase::core::utils
