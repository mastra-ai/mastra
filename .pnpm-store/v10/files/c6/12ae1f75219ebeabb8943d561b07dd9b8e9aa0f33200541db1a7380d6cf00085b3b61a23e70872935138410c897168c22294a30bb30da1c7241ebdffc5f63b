/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *   Copyright 2020-Present Couchbase, Inc.
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

#include "dns_srv_tracker.hxx"

#include "core/config_listener.hxx"
#include "core/io/dns_client.hxx"
#include "core/io/dns_config.hxx"
#include "core/logger/logger.hxx"
#include "core/origin.hxx"
#include "core/topology/configuration.hxx"
#include "core/utils/join_strings.hxx"
#include "core/utils/movable_function.hxx"

#include <couchbase/error_codes.hxx>

#include <asio/bind_executor.hpp>
#include <asio/io_context.hpp>
#include <asio/post.hpp>
#include <spdlog/fmt/bundled/core.h>

#include <functional>
#include <memory>
#include <mutex>
#include <set>
#include <string>
#include <system_error>
#include <utility>
#include <vector>

namespace couchbase::core::impl
{
dns_srv_tracker::dns_srv_tracker(asio::io_context& ctx,
                                 std::string address,
                                 io::dns::dns_config config,
                                 bool use_tls)
  : ctx_{ ctx }
  , dns_client_{ ctx_ }
  , address_{ std::move(address) }
  , config_{ std::move(config) }
  , use_tls_{ use_tls }
  , service_{ use_tls_ ? "_couchbases" : "_couchbase" }
{
}

void
dns_srv_tracker::get_srv_nodes(
  utils::movable_function<void(origin::node_list, std::error_code)> callback)
{
  CB_LOG_DEBUG("Query DNS-SRV: address=\"{}\", service=\"{}\", nameserver=\"{}:{}\"",
               address_,
               service_,
               config_.nameserver(),
               config_.port());
  dns_client_.query_srv(address_,
                        service_,
                        config_,
                        [self = shared_from_this(), callback = std::move(callback)](
                          couchbase::core::io::dns::dns_srv_response&& resp) mutable {
                          origin::node_list nodes;
                          if (resp.ec) {
                            CB_LOG_WARNING("failed to fetch DNS SRV records for \"{}\" ({}), "
                                           "assuming that cluster is listening this address",
                                           self->address_,
                                           resp.ec.message());
                          } else if (resp.targets.empty() && self->address_ != "localhost") {
                            CB_LOG_WARNING("DNS SRV query returned 0 records for \"{}\", assuming "
                                           "that cluster is listening this address",
                                           self->address_);
                          } else {
                            nodes.reserve(resp.targets.size());
                            for (const auto& address : resp.targets) {
                              origin::node_entry node;
                              node.first = address.hostname;
                              node.second = std::to_string(address.port);
                              nodes.emplace_back(node);
                            }
                          }
                          return callback(nodes, resp.ec);
                        });
}

void
dns_srv_tracker::do_dns_refresh()
{
  get_srv_nodes(
    [self = shared_from_this()](const origin::node_list& nodes, std::error_code dns_ec) mutable {
      bool expected_state{ true };
      if (dns_ec || nodes.empty()) {
        if (dns_ec) {
          CB_LOG_WARNING("unable to perform DNS-SRV refresh: {}", dns_ec.message());
        }
        self->refresh_in_progress_.compare_exchange_strong(expected_state, false);
        return;
      }
      std::set<std::shared_ptr<config_listener>> listeners;
      {
        const std::scoped_lock lock(self->config_listeners_mutex_);
        listeners = self->config_listeners_;
      }

      if (!listeners.empty()) {
        auto config = topology::make_blank_configuration(nodes, self->use_tls_, true);
        std::vector<std::string> endpoints;
        endpoints.reserve(nodes.size());
        for (const auto& [host, port] : nodes) {
          endpoints.emplace_back(fmt::format("\"{}:{}\"", host, port));
        }
        CB_LOG_DEBUG("generated configuration from DNS-SRV response \"{}\": [{}]",
                     self->address_,
                     utils::join_strings(endpoints, ", "));
        for (const auto& listener : listeners) {
          listener->update_config(config);
        }
      }
      self->refresh_in_progress_.compare_exchange_strong(expected_state, false);
    });
}

void
dns_srv_tracker::report_bootstrap_error(const std::string& endpoint, std::error_code ec)
{
  bool trigger_dns_srv_refresh = false;

  if (ec && ec != errc::common::request_canceled) {
    const std::scoped_lock lock(known_endpoints_mutex_);
    known_endpoints_.erase(endpoint);
    if (known_endpoints_.empty()) {
      trigger_dns_srv_refresh = true;
    }
  } else {
    return;
  }

  bool expected_state{ false };
  if (trigger_dns_srv_refresh &&
      refresh_in_progress_.compare_exchange_strong(expected_state, true)) {
    CB_LOG_DEBUG(
      "all nodes failed to bootstrap, triggering DNS-SRV refresh, ec={}, last endpoint=\"{}\"",
      ec.message(),
      endpoint);
    return asio::post(asio::bind_executor(ctx_, [self = shared_from_this()]() mutable {
      self->do_dns_refresh();
    }));
  }
}

void
dns_srv_tracker::report_bootstrap_success(const std::vector<std::string>& endpoints)
{
  std::set<std::string, std::less<>> known_endpoints{ endpoints.begin(), endpoints.end() };
  const std::scoped_lock lock(known_endpoints_mutex_);
  std::swap(known_endpoints_, known_endpoints);
}

void
dns_srv_tracker::register_config_listener(std::shared_ptr<config_listener> listener)
{
  const std::scoped_lock lock(config_listeners_mutex_);
  config_listeners_.insert(listener);
}

void
dns_srv_tracker::unregister_config_listener(std::shared_ptr<config_listener> listener)
{
  const std::scoped_lock lock(config_listeners_mutex_);
  config_listeners_.erase(listener);
}
} // namespace couchbase::core::impl
