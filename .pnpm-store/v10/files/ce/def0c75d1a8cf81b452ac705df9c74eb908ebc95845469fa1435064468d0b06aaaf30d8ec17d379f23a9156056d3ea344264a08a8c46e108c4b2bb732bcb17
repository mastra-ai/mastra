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

#pragma once

#include <couchbase/application_telemetry_options.hxx>
#include <couchbase/behavior_options.hxx>
#include <couchbase/certificate_authenticator.hxx>
#include <couchbase/compression_options.hxx>
#include <couchbase/configuration_profiles_registry.hxx>
#include <couchbase/dns_options.hxx>
#include <couchbase/error.hxx>
#include <couchbase/metrics_options.hxx>
#include <couchbase/network_options.hxx>
#include <couchbase/password_authenticator.hxx>
#include <couchbase/retry_strategy.hxx>
#include <couchbase/security_options.hxx>
#include <couchbase/timeout_options.hxx>
#include <couchbase/tracing_options.hxx>
#include <couchbase/transactions/transactions_config.hxx>

#include <functional>
#include <stdexcept>
#include <string>
#include <system_error>
#include <vector>

namespace couchbase
{
#ifndef COUCHBASE_CXX_CLIENT_DOXYGEN
namespace crypto
{
class manager;
} // namespace crypto
#endif
class cluster_options
{
public:
  /**
   *
   * @param username
   * @param password
   *
   * @since 1.0.0
   * @committed
   */
  cluster_options(std::string username, std::string password)
    : username_{ std::move(username) }
    , password_{ std::move(password) }
  {
  }

  /**
   *
   * @param authenticator
   *
   * @since 1.0.0
   * @committed
   */
  explicit cluster_options(password_authenticator authenticator)
    : username_{ std::move(authenticator.username_) }
    , password_{ std::move(authenticator.password_) }
  {
    if (authenticator.ldap_compatible_) {
      sasl_mechanisms_ = { { "PLAIN" } };
    }
  }

  /**
   *
   * @param authenticator
   *
   * @since 1.0.0
   * @committed
   */
  explicit cluster_options(certificate_authenticator authenticator)
    : certificate_path_{ std::move(authenticator.certificate_path_) }
    , key_path_{ std::move(authenticator.key_path_) }
  {
  }

  /**
   * Apply settings profile by name.
   *
   * At the moment the only one profile is defined: "wan_development".
   *
   * @param profile_name  name of the registered profile
   *
   * @see configuration_profile_registry
   * @see wan_development_configuration_profile
   *
   * @since 1.0.0
   * @volatile
   */
  void apply_profile(const std::string& profile_name)
  {
    configuration_profiles_registry::apply_profile(profile_name, *this);
  }

  /**
   * Returns compression options.
   *
   * @return compression options
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto compression() -> compression_options&
  {
    return compression_;
  }

  /**
   * Returns various timeout options.
   *
   * @return timeout options
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto timeouts() -> timeout_options&
  {
    return timeouts_;
  }

  /**
   * Returns options for DNS-SRV bootstrap.
   *
   * @return DNS options
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto dns() -> dns_options&
  {
    return dns_;
  }

  /**
   * Returns security options (including TLS)
   *
   * @return security options
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto security() -> security_options&
  {
    return security_;
  }

  /**
   * Returns network options
   *
   * @return network options
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto network() -> network_options&
  {
    return network_;
  }

  /**
   * Returns metrics and observability options
   *
   * @return metrics options
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto metrics() -> metrics_options&
  {
    return metrics_;
  }

  /**
   * Returns tracing options
   *
   * @return tracing options
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto tracing() -> tracing_options&
  {
    return tracing_;
  }

  /**
   * Returns misc options that affects cluster behavior.
   *
   * @return misc options.
   *
   * @since 1.0.0
   * @volatile
   */
  [[nodiscard]] auto behavior() -> behavior_options&
  {
    return behavior_;
  }

  /**
   * Returns the transactions options which effect the transactions behavior.
   *
   * @return  transactions configuration.
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto transactions() -> transactions::transactions_config&
  {
    return transactions_;
  }

  /**
   * Returns the Application Telemetry options.
   *
   * @return application telemetry options.
   *
   * @since 1.1.0
   * @committed
   */
  [[nodiscard]] auto application_telemetry() -> application_telemetry_options&
  {
    return application_telemetry_;
  }

  /**
   * Override default retry strategy
   *
   * @return cluster options object for chaining
   *
   * @since 1.0.0
   * @committed
   */
  auto default_retry_strategy(std::shared_ptr<retry_strategy> strategy) -> cluster_options&
  {
    if (strategy == nullptr) {
      throw std::invalid_argument("retry strategy cannot be null");
    }
    default_retry_strategy_ = std::move(strategy);
    return *this;
  }

  auto crypto_manager(std::shared_ptr<crypto::manager> crypto_manager) -> cluster_options&
  {
    if (crypto_manager == nullptr) {
      throw std::invalid_argument("crypto manager cannot be null");
    }
    crypto_manager_ = std::move(crypto_manager);
    return *this;
  }

  struct built {
    std::string username;
    std::string password;
    std::string certificate_path;
    std::string key_path;
    std::optional<std::vector<std::string>> allowed_sasl_mechanisms;
    compression_options::built compression;
    timeout_options::built timeouts;
    dns_options::built dns;
    security_options::built security;
    network_options::built network;
    metrics_options::built metrics;
    tracing_options::built tracing;
    behavior_options::built behavior;
    transactions::transactions_config::built transactions;
    std::shared_ptr<retry_strategy> default_retry_strategy;
    application_telemetry_options::built application_telemetry;
    std::shared_ptr<crypto::manager> crypto_manager;
  };

  [[nodiscard]] auto build() const -> built
  {
    return {
      username_,
      password_,
      certificate_path_,
      key_path_,
      sasl_mechanisms_,
      compression_.build(),
      timeouts_.build(),
      dns_.build(),
      security_.build(),
      network_.build(),
      metrics_.build(),
      tracing_.build(),
      behavior_.build(),
      transactions_.build(),
      default_retry_strategy_,
      application_telemetry_.build(),
      crypto_manager_,
    };
  }

private:
  std::string username_{};
  std::string password_{};
  std::string certificate_path_{};
  std::string key_path_{};
  std::optional<std::vector<std::string>> sasl_mechanisms_{};

  compression_options compression_{};
  timeout_options timeouts_{};
  dns_options dns_{};
  security_options security_{};
  network_options network_{};
  metrics_options metrics_{};
  tracing_options tracing_{};
  behavior_options behavior_{};
  transactions::transactions_config transactions_{};
  std::shared_ptr<retry_strategy> default_retry_strategy_{ nullptr };
  application_telemetry_options application_telemetry_{};
  std::shared_ptr<crypto::manager> crypto_manager_{};
};

#ifndef COUCHBASE_CXX_CLIENT_DOXYGEN
class cluster;
#endif

/**
 * The signature for the handler of the @ref cluster::connect()
 *
 * @since 1.0.0
 * @uncommitted
 */
using cluster_connect_handler = std::function<void(error, cluster)>;
} // namespace couchbase
