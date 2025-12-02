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

#include "mcbp_session.hxx"

#include <couchbase/build_config.hxx>

#ifdef COUCHBASE_CXX_CLIENT_COLUMNAR
#include "core/columnar/background_bootstrap_listener.hxx"
#endif
#include "core/config_listener.hxx"
#include "core/diagnostics.hxx"
#include "core/impl/bootstrap_error.hxx"
#include "core/impl/bootstrap_state_listener.hxx"
#include "core/logger/logger.hxx"
#include "core/mcbp/codec.hxx"
#include "core/mcbp/queue_request.hxx"
#include "core/meta/version.hxx"
#include "core/operation_map.hxx"
#include "core/origin.hxx"
#include "core/ping_reporter.hxx"
#include "core/protocol/client_request.hxx"
#include "core/protocol/cmd_cluster_map_change_notification.hxx"
#include "core/protocol/cmd_get.hxx"
#include "core/protocol/cmd_get_cluster_config.hxx"
#include "core/protocol/cmd_get_error_map.hxx"
#include "core/protocol/cmd_hello.hxx"
#include "core/protocol/cmd_noop.hxx"
#include "core/protocol/cmd_sasl_auth.hxx"
#include "core/protocol/cmd_sasl_list_mechs.hxx"
#include "core/protocol/cmd_sasl_step.hxx"
#include "core/protocol/cmd_select_bucket.hxx"
#include "core/protocol/hello_feature_fmt.hxx"
#include "core/protocol/server_request.hxx"
#include "core/sasl/client.h"
#include "core/sasl/error_fmt.h"
#include "core/topology/capabilities_fmt.hxx"
#include "core/topology/configuration_fmt.hxx"
#include "mcbp_context.hxx"
#include "mcbp_message.hxx"
#include "mcbp_parser.hxx"
#include "retry_orchestrator.hxx"
#include "streams.hxx"

#include <couchbase/error_codes.hxx>
#include <couchbase/fmt/retry_reason.hxx>

#include <asio.hpp>
#include <asio/ssl/error.hpp>
#include <spdlog/fmt/bin_to_hex.h>
#include <spdlog/fmt/chrono.h>

#include <cstring>
#include <utility>

namespace
{
template<typename Container>
struct mcbp_header_view {
  const Container& buf_;

  explicit mcbp_header_view(const Container& buf)
    : buf_{ buf }
  {
  }
};

struct mcbp_header_layout {
  std::uint8_t magic;
  std::uint8_t opcode;
  union {
    std::uint16_t normal;
    struct {
      std::uint8_t framing_extras;
      std::uint8_t key;
    } alt;
  } keylen;
  std::uint8_t extlen;
  std::uint8_t datatype;
  std::uint16_t specific;
  std::uint32_t bodylen;
  std::uint32_t opaque;
  std::uint64_t cas;

  [[nodiscard]] constexpr auto specific_name() const -> std::string_view
  {
    if (magic == 0x18 || magic == 0x81) {
      return "status";
    }
    return "vbucket";
  }

  [[nodiscard]] constexpr auto key_length() const -> std::uint16_t
  {
    if (magic == 0x18 || magic == 0x08) {
      return keylen.alt.key;
    }
    return couchbase::core::utils::byte_swap(keylen.normal);
  }

  [[nodiscard]] constexpr auto framing_extras_length() const -> std::uint8_t
  {
    if (magic == 0x18 || magic == 0x08) {
      return keylen.alt.framing_extras;
    }
    return 0;
  }
};
} // namespace

template<typename Container>
struct fmt::formatter<mcbp_header_view<Container>> {
  template<typename ParseContext>
  constexpr auto parse(ParseContext& ctx)
  {
    return ctx.begin();
  }

  template<typename FormatContext>
  auto format(const mcbp_header_view<Container>& view, FormatContext& ctx) const
  {
    if (view.buf_.size() < sizeof(couchbase::core::io::binary_header)) {
      return format_to(ctx.out(), "{:n}", spdlog::to_hex(view.buf_));
    }

    const auto* header = reinterpret_cast<const mcbp_header_layout*>(view.buf_.data());
    return format_to(ctx.out(),
                     "{{magic=0x{:x}, opcode=0x{:x}, fextlen={}, keylen={}, extlen={}, "
                     "datatype={}, {}={}, bodylen={}, "
                     "opaque={}, cas={}}}",
                     header->magic,
                     header->opcode,
                     header->framing_extras_length(),
                     header->key_length(),
                     header->extlen,
                     header->datatype,
                     header->specific_name(),
                     couchbase::core::utils::byte_swap(header->specific),
                     couchbase::core::utils::byte_swap(header->bodylen),
                     couchbase::core::utils::byte_swap(header->opaque),
                     couchbase::core::utils::byte_swap(header->cas));
  }
};

namespace couchbase::core::io
{
struct connection_endpoints {
  connection_endpoints(asio::ip::tcp::endpoint remote_endpoint,
                       asio::ip::tcp::endpoint local_endpoint)
    : remote{ std::move(remote_endpoint) }
    , remote_address{ remote.address().to_string() }
    , remote_address_with_port{ remote.protocol() == asio::ip::tcp::v6()
                                  ? fmt::format("[{}]:{}", remote_address, remote.port())
                                  : fmt::format("{}:{}", remote_address, remote.port()) }
    , local{ std::move(local_endpoint) }
    , local_address{ local.address().to_string() }
    , local_address_with_port{ local.protocol() == asio::ip::tcp::v6()
                                 ? fmt::format("[{}]:{}", local_address, local.port())
                                 : fmt::format("{}:{}", local_address, local.port()) }
  {
  }

  asio::ip::tcp::endpoint remote;
  std::string remote_address{};
  std::string remote_address_with_port{};

  asio::ip::tcp::endpoint local;
  std::string local_address{};
  std::string local_address_with_port{};
};

class collection_cache
{
private:
  std::map<std::string, std::uint32_t> cid_map_{ { "_default._default", 0 } };

public:
  [[nodiscard]] auto get(const std::string& path) -> std::optional<std::uint32_t>
  {
    Expects(!path.empty());
    if (auto ptr = cid_map_.find(path); ptr != cid_map_.end()) {
      return ptr->second;
    }
    return std::nullopt;
  }

  void update(const std::string& path, std::uint32_t id)
  {
    Expects(!path.empty());
    cid_map_[path] = id;
  }

  void reset()
  {
    cid_map_.clear();
    cid_map_["_default._default"] = 0;
  }
};

class mcbp_session_impl
  : public std::enable_shared_from_this<mcbp_session_impl>
  , public operation_map
{
  class bootstrap_handler : public std::enable_shared_from_this<bootstrap_handler>
  {
  private:
    std::shared_ptr<mcbp_session_impl> session_;
    sasl::ClientContext sasl_;
    std::atomic_bool stopped_{ false };
    impl::bootstrap_error last_bootstrap_error_;

  public:
    bootstrap_handler(const bootstrap_handler&) = delete;
    auto operator=(const bootstrap_handler&) -> bootstrap_handler& = delete;
    bootstrap_handler(bootstrap_handler&&) = delete;
    auto operator=(bootstrap_handler&&) -> bootstrap_handler& = delete;

    ~bootstrap_handler()
    {
      stop();
    }

    void stop()
    {
      bool expected_state{ false };
      stopped_.compare_exchange_strong(expected_state, true);
    }

    static auto sasl_mechanisms(const std::shared_ptr<mcbp_session_impl>& session)
      -> std::vector<std::string>
    {
      if (const auto user_mechanisms = session->origin_.credentials().allowed_sasl_mechanisms;
          user_mechanisms.has_value()) {
        return user_mechanisms.value();
      }
      if (session->is_tls_) {
        return { "PLAIN" };
      }
      return { "SCRAM-SHA512", "SCRAM-SHA256", "SCRAM-SHA1" };
    }

    auto last_bootstrap_error() && -> impl::bootstrap_error
    {
      return std::move(last_bootstrap_error_);
    }

    [[nodiscard]] auto last_bootstrap_error() const& -> const impl::bootstrap_error&
    {
      return last_bootstrap_error_;
    }

    explicit bootstrap_handler(std::shared_ptr<mcbp_session_impl> session)
      : session_(std::move(session))
      , sasl_(
          [origin = session_->origin_]() {
            return origin.username();
          },
          [origin = session_->origin_]() {
            return origin.password();
          },
          sasl_mechanisms(session_))
    {
      protocol::client_request<protocol::hello_request_body> hello_req;
      if (session_->origin_.options().enable_unordered_execution) {
        hello_req.body().enable_unordered_execution();
      }
      if (session_->origin_.options().enable_clustermap_notification) {
        hello_req.body().enable_clustermap_change_notification();
        hello_req.body().enable_deduplicate_not_my_vbucket_clustermap();
      }
      if (session_->origin_.options().enable_compression) {
        hello_req.body().enable_compression();
      }
      if (session_->origin_.options().enable_mutation_tokens) {
        hello_req.body().enable_mutation_tokens();
      }
      hello_req.opaque(session_->next_opaque());
      auto user_agent = meta::user_agent_for_mcbp(
        session_->client_id_, session_->id_, session_->origin_.options().user_agent_extra, 250);
      hello_req.body().user_agent(user_agent);
      CB_LOG_DEBUG("{} user_agent={}, requested_features=[{}]",
                   session_->log_prefix_,
                   user_agent,
                   utils::join_strings_fmt(hello_req.body().features(), ", "));
      session_->write(hello_req.data());

      if (!session_->origin_.credentials().uses_certificate()) {
        protocol::client_request<protocol::sasl_list_mechs_request_body> list_req;
        list_req.opaque(session_->next_opaque());
        session_->write(list_req.data());

        protocol::client_request<protocol::sasl_auth_request_body> auth_req;
        auto [sasl_code, sasl_payload] = sasl_.start();
        auth_req.opaque(session_->next_opaque());
        auth_req.body().mechanism(sasl_.get_name());
        auth_req.body().sasl_data(sasl_payload);
        session_->write(auth_req.data());
      }

      session_->flush();
    }

    void complete(std::error_code ec)
    {
      if (bool expected_state{ false }; stopped_.compare_exchange_strong(expected_state, true)) {
        session_->invoke_bootstrap_handler(ec);
      }
    }

    void auth_success()
    {
      session_->authenticated_ = true;
      if (session_->supports_feature(protocol::hello_feature::xerror)) {
        protocol::client_request<protocol::get_error_map_request_body> errmap_req;
        errmap_req.opaque(session_->next_opaque());
        session_->write(errmap_req.data());
      }
      if (auto val = session_->bucket_name_; val) {
        protocol::client_request<protocol::select_bucket_request_body> sb_req;
        sb_req.opaque(session_->next_opaque());
        sb_req.body().bucket_name(val.value());
        session_->write(sb_req.data());
      }
      protocol::client_request<protocol::get_cluster_config_request_body> cfg_req;
      cfg_req.opaque(session_->next_opaque());
      session_->write(cfg_req.data());
      session_->flush();
    }

    void handle(mcbp_message&& msg)
    {
      if (stopped_ || !session_) {
        return;
      }
      Expects(protocol::is_valid_magic(msg.header.magic));
      switch (auto magic = static_cast<protocol::magic>(msg.header.magic)) {
        case protocol::magic::client_response:
        case protocol::magic::alt_client_response:
          Expects(protocol::is_valid_client_opcode(msg.header.opcode));
          switch (auto status = static_cast<key_value_status_code>(msg.header.status())) {
            case key_value_status_code::rate_limited_max_commands:
            case key_value_status_code::rate_limited_max_connections:
            case key_value_status_code::rate_limited_network_egress:
            case key_value_status_code::rate_limited_network_ingress: {
              auto error_msg =
                fmt::format("unable to bootstrap MCBP session (bucket={}, opcode={}, status={}), "
                            "the user has reached rate limit",
                            session_->bucket_name_.value_or(""),
                            protocol::client_opcode(msg.header.opcode),
                            status);
              last_bootstrap_error_ = { errc::common::rate_limited,
                                        std::move(error_msg),
                                        session_->bootstrap_hostname(),
                                        session_->bootstrap_port() };
              CB_LOG_DEBUG("{} {}", session_->log_prefix_, last_bootstrap_error_.error_message);
              return complete(errc::common::rate_limited);
            }
            case key_value_status_code::scope_size_limit_exceeded: {
              auto error_msg =
                fmt::format("unable to bootstrap MCBP session (bucket={}, opcode={}, status={}), "
                            "the user has reached quota limit",
                            session_->bucket_name_.value_or(""),
                            protocol::client_opcode(msg.header.opcode),
                            status);
              last_bootstrap_error_ = { errc::common::quota_limited,
                                        std::move(error_msg),
                                        session_->bootstrap_hostname(),
                                        session_->bootstrap_port() };
              CB_LOG_DEBUG("{} {}", session_->log_prefix_, last_bootstrap_error_.error_message);
              return complete(errc::common::quota_limited);
            }
            default:
              break;
          }
          switch (auto opcode = static_cast<protocol::client_opcode>(msg.header.opcode)) {
            case protocol::client_opcode::hello: {
              protocol::client_response<protocol::hello_response_body> resp(std::move(msg));
              if (resp.status() == key_value_status_code::success) {
                session_->supported_features_ = resp.body().supported_features();
                CB_LOG_DEBUG("{} supported_features=[{}]",
                             session_->log_prefix_,
                             utils::join_strings_fmt(session_->supported_features_, ", "));
                if (session_->origin_.credentials().uses_certificate()) {
                  CB_LOG_DEBUG("{} skip SASL authentication, because TLS certificate was specified",
                               session_->log_prefix_);
                  return auth_success();
                }
              } else {
                auto error_msg =
                  fmt::format("unexpected message status during bootstrap: {} (opaque={})",
                              resp.error_message(),
                              resp.opaque());
                last_bootstrap_error_ = { errc::network::handshake_failure,
                                          std::move(error_msg),
                                          session_->bootstrap_hostname(),
                                          session_->bootstrap_port() };
                CB_LOG_WARNING("{} {}", session_->log_prefix_, last_bootstrap_error_.error_message);
                return complete(errc::network::handshake_failure);
              }
            } break;
            case protocol::client_opcode::sasl_list_mechs: {
              const protocol::client_response<protocol::sasl_list_mechs_response_body> resp(
                std::move(msg));
              if (resp.status() != key_value_status_code::success) {
                auto error_msg = fmt::format(
                  "unexpected message status during bootstrap: {} (opaque={}, context={})",
                  resp.error_message(),
                  resp.opaque(),
                  resp.error_info() ? resp.error_info()->context() : "");
                last_bootstrap_error_ = { errc::common::authentication_failure,
                                          std::move(error_msg),
                                          session_->bootstrap_hostname(),
                                          session_->bootstrap_port() };
                CB_LOG_WARNING("{} {}", session_->log_prefix_, last_bootstrap_error_.error_message);
                return complete(errc::common::authentication_failure);
              }
            } break;
            case protocol::client_opcode::sasl_auth: {
              protocol::client_response<protocol::sasl_auth_response_body> resp(std::move(msg));
              if (resp.status() == key_value_status_code::success) {
                return auth_success();
              }
              if (resp.status() == key_value_status_code::auth_continue) {
                auto [sasl_code, sasl_payload] = sasl_.step(resp.body().value());
                if (sasl_code == sasl::error::OK) {
                  return auth_success();
                }
                if (sasl_code == sasl::error::CONTINUE) {
                  protocol::client_request<protocol::sasl_step_request_body> req;
                  req.opaque(session_->next_opaque());
                  req.body().mechanism(sasl_.get_name());
                  req.body().sasl_data(sasl_payload);
                  session_->write_and_flush(req.data());
                } else {
                  auto error_msg =
                    fmt::format("unable to authenticate: (sasl_code={}, opaque={}, context={})",
                                sasl_code,
                                resp.opaque(),
                                resp.error_info() ? resp.error_info()->context() : "");
                  last_bootstrap_error_ = { errc::common::authentication_failure,
                                            std::move(error_msg),
                                            session_->bootstrap_hostname(),
                                            session_->bootstrap_port() };
                  CB_LOG_ERROR("{} {}", session_->log_prefix_, last_bootstrap_error_.error_message);
                  return complete(errc::common::authentication_failure);
                }
              } else {
                auto error_msg = fmt::format(
                  "{} unexpected message status during bootstrap: {} (opaque={}, context={})",
                  session_->log_prefix_,
                  resp.error_message(),
                  resp.opaque(),
                  resp.error_info() ? resp.error_info()->context() : "");
                last_bootstrap_error_ = { errc::common::authentication_failure,
                                          std::move(error_msg),
                                          session_->bootstrap_hostname(),
                                          session_->bootstrap_port() };
                CB_LOG_WARNING("{} {}", session_->log_prefix_, last_bootstrap_error_.error_message);
                return complete(errc::common::authentication_failure);
              }
            } break;
            case protocol::client_opcode::sasl_step: {
              const protocol::client_response<protocol::sasl_step_response_body> resp(
                std::move(msg));
              if (resp.status() == key_value_status_code::success) {
                return auth_success();
              }
              auto error_msg =
                fmt::format("unable to authenticate (opcode={}, status={}, opaque={}, context={})",
                            opcode,
                            resp.status(),
                            resp.opaque(),
                            resp.error_info() ? resp.error_info()->context() : "");
              last_bootstrap_error_ = { errc::common::authentication_failure,
                                        std::move(error_msg),
                                        session_->bootstrap_hostname(),
                                        session_->bootstrap_port() };
              CB_LOG_ERROR("{} {}", session_->log_prefix_, last_bootstrap_error_.error_message);
              return complete(errc::common::authentication_failure);
            }
            case protocol::client_opcode::get_error_map: {
              protocol::client_response<protocol::get_error_map_response_body> resp(std::move(msg));
              if (resp.status() == key_value_status_code::success) {
                session_->error_map_.emplace(resp.body().errmap());
              } else {
                auto error_msg =
                  fmt::format("unexpected message status during bootstrap: {} (opaque={}, {:n})",
                              resp.error_message(),
                              resp.opaque(),
                              spdlog::to_hex(resp.header()));
                last_bootstrap_error_ = { errc::network::protocol_error,
                                          std::move(error_msg),
                                          session_->bootstrap_hostname(),
                                          session_->bootstrap_port() };
                CB_LOG_WARNING("{} {}", session_->log_prefix_, last_bootstrap_error_.error_message);
                return complete(errc::network::protocol_error);
              }
            } break;
            case protocol::client_opcode::select_bucket: {
              protocol::client_response<protocol::select_bucket_response_body> resp(std::move(msg));
              if (resp.status() == key_value_status_code::success) {
                CB_LOG_DEBUG("{} selected bucket: {}",
                             session_->log_prefix_,
                             session_->bucket_name_.value_or(""));
                session_->bucket_selected_ = true;
              } else if (resp.status() == key_value_status_code::not_found) {
                auto error_msg =
                  fmt::format("kv_engine node does not have configuration propagated yet "
                              "(opcode={}, status={}, opaque={})",
                              opcode,
                              resp.status(),
                              resp.opaque());
                last_bootstrap_error_ = { errc::network::configuration_not_available,
                                          std::move(error_msg),
                                          session_->bootstrap_hostname(),
                                          session_->bootstrap_port() };
                CB_LOG_DEBUG("{} {}", session_->log_prefix_, last_bootstrap_error_.error_message);
                return complete(errc::network::configuration_not_available);
              } else if (resp.status() == key_value_status_code::no_access) {
                auto error_msg =
                  fmt::format("unable to select bucket: {}, probably the bucket does not exist",
                              session_->bucket_name_.value_or(""));
                last_bootstrap_error_ = { errc::common::bucket_not_found,
                                          std::move(error_msg),
                                          session_->bootstrap_hostname(),
                                          session_->bootstrap_port() };
                CB_LOG_DEBUG("{} {}", session_->log_prefix_, last_bootstrap_error_.error_message);
                session_->bucket_selected_ = false;
                return complete(errc::common::bucket_not_found);
              } else {
                auto error_msg =
                  fmt::format("unexpected message status during bootstrap: {} (opaque={}, {:n})",
                              resp.error_message(),
                              resp.opaque(),
                              spdlog::to_hex(resp.header()));
                last_bootstrap_error_ = { errc::common::bucket_not_found,
                                          std::move(error_msg),
                                          session_->bootstrap_hostname(),
                                          session_->bootstrap_port() };
                CB_LOG_WARNING("{} {}", session_->log_prefix_, last_bootstrap_error_.error_message);
                return complete(errc::common::bucket_not_found);
              }
            } break;
            case protocol::client_opcode::get_cluster_config: {
              protocol::cmd_info info{ session_->connection_endpoints_.remote_address,
                                       session_->connection_endpoints_.remote.port() };
              protocol::client_response<protocol::get_cluster_config_response_body> resp(
                std::move(msg), info);
              if (session_->origin_.options().dump_configuration) {
                if (const auto& text = resp.body().config_text(); text.has_value()) {
                  CB_LOG_TRACE("{} configuration from get_cluster_config request (bootstrap, "
                               "size={}, endpoint=\"{}:{}\"), {}",
                               session_->log_prefix_,
                               text.value().size(),
                               info.endpoint_address,
                               info.endpoint_port,
                               text.value());
                }
              }
              if (resp.status() == key_value_status_code::success) {
                // MB-60405 fixes this for 7.6.2, but for earlier versions we need to protect
                // against using a config that has an empty vbucket map.  Ideally we don't timeout
                // if we retry here, but a timeout would be more acceptable than a crash and if we
                // do timeout, we have a clear indication of the problem (i.e. it is a server bug
                // and we cannot use a config w/ an empty vbucket map).
                if (const auto vbmap = resp.body().config().vbmap;
                    vbmap.has_value() && vbmap->empty()) {
                  CB_LOG_WARNING("{} received a configuration with an empty vbucket map, retrying",
                                 session_->log_prefix_);
                  return complete(errc::network::configuration_not_available);
                }
                session_->update_configuration(resp.body().config());
                complete({});
              } else if (resp.status() == key_value_status_code::not_found) {
                auto error_msg =
                  fmt::format("kv_engine node does not have configuration propagated yet "
                              "(opcode={}, status={}, opaque={})",
                              opcode,
                              resp.status(),
                              resp.opaque());
                last_bootstrap_error_ = { errc::network::configuration_not_available,
                                          std::move(error_msg),
                                          session_->bootstrap_hostname(),
                                          session_->bootstrap_port() };
                CB_LOG_DEBUG("{} {}", session_->log_prefix_, last_bootstrap_error_.error_message);
                return complete(errc::network::configuration_not_available);
              } else if (resp.status() == key_value_status_code::no_bucket &&
                         !session_->bucket_name_) {
                // bucket-less session, but the server wants bucket
                session_->supports_gcccp_ = false;
                CB_LOG_WARNING("{} this server does not support GCCCP, open bucket before making "
                               "any cluster-level command",
                               session_->log_prefix_);
                session_->update_configuration(
                  topology::make_blank_configuration(session_->connection_endpoints_.remote_address,
                                                     session_->connection_endpoints_.remote.port(),
                                                     0));
                complete({});
              } else {
                auto error_msg =
                  fmt::format("unexpected message status during bootstrap: {} (opaque={}, {:n})",
                              resp.error_message(),
                              resp.opaque(),
                              spdlog::to_hex(resp.header()));
                last_bootstrap_error_ = { errc::network::protocol_error,
                                          std::move(error_msg),
                                          session_->bootstrap_hostname(),
                                          session_->bootstrap_port() };
                CB_LOG_WARNING("{} {}", session_->log_prefix_, last_bootstrap_error_.error_message);
                return complete(errc::network::protocol_error);
              }
            } break;
            default:
              auto error_msg = fmt::format("unexpected message during bootstrap: {}", opcode);
              last_bootstrap_error_ = { errc::network::protocol_error,
                                        std::move(error_msg),
                                        session_->bootstrap_hostname(),
                                        session_->bootstrap_port() };
              CB_LOG_WARNING("{} {}", session_->log_prefix_, last_bootstrap_error_.error_message);
              return complete(errc::network::protocol_error);
          }
          break;
        case protocol::magic::server_request:
          Expects(protocol::is_valid_server_request_opcode(msg.header.opcode));
          switch (static_cast<protocol::server_opcode>(msg.header.opcode)) {
            case protocol::server_opcode::cluster_map_change_notification: {
              protocol::cmd_info info{ session_->bootstrap_hostname_,
                                       session_->bootstrap_port_number_ };
              protocol::server_request<protocol::cluster_map_change_notification_request_body> req(
                std::move(msg), info);
              if (session_->origin_.options().dump_configuration) {
                if (const auto& text = req.body().config_text(); text.has_value()) {
                  CB_LOG_TRACE("{} configuration from cluster_map_change_notification request "
                               "(size={}, endpoint=\"{}:{}\"), {}",
                               session_->log_prefix_,
                               text.value().size(),
                               info.endpoint_address,
                               info.endpoint_port,
                               text.value());
                }
              }
              std::optional<topology::configuration> config = req.body().config();
              if (session_ && config.has_value()) {
                if ((!config->bucket.has_value() && req.body().bucket().empty()) ||
                    (session_->bucket_name_.has_value() && !req.body().bucket().empty() &&
                     // TODO(CXXCBC-549)
                     // NOLINTNEXTLINE(bugprone-unchecked-optional-access)
                     session_->bucket_name_.value() == req.body().bucket())) {
                  session_->update_configuration(std::move(config.value()));
                }
              }
            } break;
            default:
              CB_LOG_WARNING("{} unexpected server request: opcode={:x}, opaque={}{:a}{:a}",
                             session_->log_prefix_,
                             msg.header.opcode,
                             utils::byte_swap(msg.header.opaque),
                             spdlog::to_hex(msg.header_data()),
                             spdlog::to_hex(msg.body));
          }
          break;
        case protocol::magic::client_request:
        case protocol::magic::alt_client_request:
        case protocol::magic::server_response:
          CB_LOG_WARNING("{} unexpected magic: {} (opcode={:x}, opaque={}){:a}{:a}",
                         session_->log_prefix_,
                         magic,
                         msg.header.opcode,
                         utils::byte_swap(msg.header.opaque),
                         spdlog::to_hex(msg.header_data()),
                         spdlog::to_hex(msg.body));
          break;
      }
    }
  };

  class message_handler : public std::enable_shared_from_this<message_handler>
  {
  private:
    std::shared_ptr<mcbp_session_impl> session_;
    std::atomic_bool stopped_{ false };

  public:
    explicit message_handler(std::shared_ptr<mcbp_session_impl> session)
      : session_(std::move(session))
    {
    }

    message_handler(const message_handler&) = delete;
    auto operator=(const message_handler&) -> message_handler& = delete;
    message_handler(message_handler&&) = delete;
    auto operator=(message_handler&&) -> message_handler& = delete;

    ~message_handler()
    {
      stop();
    }

    void start()
    {
    }

    void stop()
    {
    }

    void handle(mcbp_message&& msg)
    {
      if (stopped_ || !session_) {
        return;
      }
      Expects(protocol::is_valid_magic(msg.header.magic));
      switch (auto magic = static_cast<protocol::magic>(msg.header.magic)) {
        case protocol::magic::client_response:
        case protocol::magic::alt_client_response:
          Expects(protocol::is_valid_client_opcode(msg.header.opcode));
          switch (auto opcode = static_cast<protocol::client_opcode>(msg.header.opcode)) {
            case protocol::client_opcode::get_cluster_config: {
              protocol::cmd_info info{ session_->bootstrap_hostname_,
                                       session_->bootstrap_port_number_ };
              protocol::client_response<protocol::get_cluster_config_response_body> resp(
                std::move(msg), info);
              if (session_->origin_.options().dump_configuration) {
                if (const auto& text = resp.body().config_text(); text.has_value()) {
                  CB_LOG_TRACE("{} configuration from get_cluster_config response (size={}, "
                               "endpoint=\"{}:{}\"), {}",
                               session_->log_prefix_,
                               text.value().size(),
                               info.endpoint_address,
                               info.endpoint_port,
                               text.value());
                }
              }
              if (resp.status() == key_value_status_code::success) {
                if (session_) {
                  session_->update_configuration(resp.body().config());
                }
              } else {
                CB_LOG_WARNING("{} unexpected message status: {} (opaque={})",
                               session_->log_prefix_,
                               resp.error_message(),
                               resp.opaque());
              }
            } break;
            case protocol::client_opcode::noop:
            case protocol::client_opcode::get_collections_manifest:
            case protocol::client_opcode::get_collection_id:
            case protocol::client_opcode::get:
            case protocol::client_opcode::get_and_lock:
            case protocol::client_opcode::get_and_touch:
            case protocol::client_opcode::get_meta:
            case protocol::client_opcode::get_replica:
            case protocol::client_opcode::touch:
            case protocol::client_opcode::insert:
            case protocol::client_opcode::replace:
            case protocol::client_opcode::upsert:
            case protocol::client_opcode::append:
            case protocol::client_opcode::prepend:
            case protocol::client_opcode::remove:
            case protocol::client_opcode::observe_seqno:
            case protocol::client_opcode::unlock:
            case protocol::client_opcode::increment:
            case protocol::client_opcode::range_scan_create:
            case protocol::client_opcode::range_scan_continue:
            case protocol::client_opcode::range_scan_cancel:
            case protocol::client_opcode::decrement:
            case protocol::client_opcode::subdoc_multi_lookup:
            case protocol::client_opcode::subdoc_multi_mutation: {
              const std::uint16_t status = utils::byte_swap(msg.header.specific);
              if (status == static_cast<std::uint16_t>(key_value_status_code::not_my_vbucket)) {
                session_->handle_not_my_vbucket(msg);
              }

              std::uint32_t opaque = utils::byte_swap(msg.header.opaque);
              if (session_->handle_request(opcode, status, opaque, std::move(msg))) {
                CB_LOG_TRACE("{} MCBP invoked operation handler: opcode={}, opaque={}, status={}",
                             session_->log_prefix_,
                             opcode,
                             opaque,
                             protocol::status_to_string(status));
              } else {
                CB_LOG_DEBUG("{} unexpected orphan response: opcode={}, opaque={}, status={}",
                             session_->log_prefix_,
                             opcode,
                             opaque,
                             protocol::status_to_string(status));
              }
            } break;
            default:
              CB_LOG_WARNING("{} unexpected client response: opcode={}, opaque={}{:a}{:a})",
                             session_->log_prefix_,
                             opcode,
                             msg.header.opaque,
                             spdlog::to_hex(msg.header_data()),
                             spdlog::to_hex(msg.body));
          }
          break;
        case protocol::magic::server_request:
          Expects(protocol::is_valid_server_request_opcode(msg.header.opcode));
          switch (static_cast<protocol::server_opcode>(msg.header.opcode)) {
            case protocol::server_opcode::cluster_map_change_notification: {
              protocol::cmd_info info{ session_->bootstrap_hostname_,
                                       session_->bootstrap_port_number_ };
              protocol::server_request<protocol::cluster_map_change_notification_request_body> req(
                std::move(msg), info);
              if (session_->origin_.options().dump_configuration) {
                if (const auto& text = req.body().config_text(); text.has_value()) {
                  CB_LOG_TRACE("{} configuration from cluster_map_change_notification request "
                               "(size={}, endpoint=\"{}:{}\"), {}",
                               session_->log_prefix_,
                               text.value().size(),
                               info.endpoint_address,
                               info.endpoint_port,
                               text.value());
                }
              }
              std::optional<topology::configuration> config = req.body().config();
              if (session_ && config.has_value()) {
                if ((!config->bucket.has_value() && req.body().bucket().empty()) ||
                    (session_->bucket_name_.has_value() && !req.body().bucket().empty() &&
                     // TODO(CXXCBC-549)
                     // NOLINTNEXTLINE(bugprone-unchecked-optional-access)
                     session_->bucket_name_.value() == req.body().bucket())) {
                  session_->update_configuration(std::move(config.value()));
                }
              }
            } break;
            default:
              CB_LOG_WARNING("{} unexpected server request: opcode={:x}, opaque={}{:a}{:a}",
                             session_->log_prefix_,
                             msg.header.opcode,
                             msg.header.opaque,
                             spdlog::to_hex(msg.header_data()),
                             spdlog::to_hex(msg.body));
          }
          break;
        case protocol::magic::client_request:
        case protocol::magic::alt_client_request:
        case protocol::magic::server_response:
          CB_LOG_WARNING("{} unexpected magic: {} (opcode={:x}, opaque={}){:a}{:a}",
                         session_->log_prefix_,
                         magic,
                         msg.header.opcode,
                         msg.header.opaque,
                         spdlog::to_hex(msg.header_data()),
                         spdlog::to_hex(msg.body));
          break;
      }
    }
  };

public:
  mcbp_session_impl() = delete;
  mcbp_session_impl(std::string_view client_id,
                    std::string_view node_uuid,
                    asio::io_context& ctx,
                    couchbase::core::origin origin,
                    std::shared_ptr<impl::bootstrap_state_listener> state_listener,
                    std::optional<std::string> bucket_name = {},
                    std::vector<protocol::hello_feature> known_features = {})
    : client_id_(client_id)
    , node_uuid_(node_uuid)
    , ctx_(ctx)
    , resolver_(ctx_)
    , stream_(std::make_unique<plain_stream_impl>(ctx_))
    , bootstrap_deadline_(ctx_)
    , resolve_deadline_(ctx_)
    , connection_deadline_(ctx_)
    , retry_backoff_(ctx_)
    , ping_timeout_(ctx_)
    , origin_{ std::move(origin) }
    , bucket_name_{ std::move(bucket_name) }
    , supported_features_{ std::move(known_features) }
    , is_tls_{ false }
    , state_listener_{ std::move(state_listener) }
    , codec_{ { supported_features_.begin(), supported_features_.end() } }
  {
    log_prefix_ = fmt::format(
      "[{}/{}/{}/{}]", client_id_, id_, stream_->log_prefix(), bucket_name_.value_or("-"));
  }

  mcbp_session_impl(std::string_view client_id,
                    std::string_view node_uuid,
                    asio::io_context& ctx,
                    asio::ssl::context& tls,
                    couchbase::core::origin origin,
                    std::shared_ptr<impl::bootstrap_state_listener> state_listener,
                    std::optional<std::string> bucket_name = {},
                    std::vector<protocol::hello_feature> known_features = {})
    : client_id_(client_id)
    , node_uuid_(node_uuid)
    , ctx_(ctx)
    , resolver_(ctx_)
    , stream_(std::make_unique<tls_stream_impl>(ctx_, tls))
    , bootstrap_deadline_(ctx_)
    , resolve_deadline_(ctx_)
    , connection_deadline_(ctx_)
    , retry_backoff_(ctx_)
    , ping_timeout_(ctx_)
    , origin_(std::move(origin))
    , bucket_name_(std::move(bucket_name))
    , supported_features_(std::move(known_features))
    , is_tls_{ true }
    , state_listener_{ std::move(state_listener) }
    , codec_{ { supported_features_.begin(), supported_features_.end() } }
  {
    log_prefix_ = fmt::format(
      "[{}/{}/{}/{}]", client_id_, id_, stream_->log_prefix(), bucket_name_.value_or("-"));
  }

  mcbp_session_impl(const mcbp_session_impl&) = delete;
  auto operator=(const mcbp_session_impl&) -> mcbp_session_impl& = delete;
  mcbp_session_impl(mcbp_session_impl&&) = delete;
  auto operator=(mcbp_session_impl&&) -> mcbp_session_impl& = delete;

  ~mcbp_session_impl() override
  {
    CB_LOG_DEBUG("{} destroy MCBP connection", log_prefix_);
    stop(retry_reason::do_not_retry);
  }

  [[nodiscard]] auto log_prefix() const -> const std::string&
  {
    return log_prefix_;
  }

  auto remote_address() const -> std::string
  {
    return connection_endpoints_.remote_address_with_port;
  }

  auto local_address() const -> std::string
  {
    return connection_endpoints_.local_address_with_port;
  }

  [[nodiscard]] auto diag_info() const -> diag::endpoint_diag_info
  {
    return { service_type::key_value,
             id_,
             last_active_.time_since_epoch().count() == 0
               ? std::nullopt
               : std::make_optional(std::chrono::duration_cast<std::chrono::microseconds>(
                   std::chrono::steady_clock::now() - last_active_)),
             remote_address(),
             local_address(),
             state_,
             bucket_name_ };
  }

  void ping(const std::shared_ptr<diag::ping_reporter>& handler,
            std::optional<std::chrono::milliseconds> timeout)
  {
    if (!bootstrapped_) {
      handler->report({
        service_type::key_value,
        id_,
        std::chrono::microseconds(0),
        remote_address(),
        local_address(),
        diag::ping_state::error,
        bucket_name_,
        last_bootstrap_error_.has_value() ? last_bootstrap_error_.value().error_message
                                          : "Bootstrap incomplete, cannot perform ping.",
      });
      return;
    }
    protocol::client_request<protocol::mcbp_noop_request_body> req;
    req.opaque(next_opaque());
    write_and_subscribe(
      req.opaque(),
      req.data(false),
      [start = std::chrono::steady_clock::now(), self = shared_from_this(), handler](
        std::error_code ec,
        retry_reason reason,
        io::mcbp_message&& /* msg */,
        const std::optional<key_value_error_map_info>& /* error_info */) {
        diag::ping_state state = diag::ping_state::ok;
        std::optional<std::string> error{};
        if (ec) {
          if (ec == errc::common::unambiguous_timeout || ec == errc::common::ambiguous_timeout) {
            state = diag::ping_state::timeout;
          } else {
            state = diag::ping_state::error;
          }
          error.emplace(
            fmt::format("code={}, message={}, reason={}", ec.value(), ec.message(), reason));
        }
        handler->report({
          service_type::key_value,
          self->id_,
          std::chrono::duration_cast<std::chrono::microseconds>(std::chrono::steady_clock::now() -
                                                                start),
          self->remote_address(),
          self->local_address(),
          state,
          self->bucket_name_,
          error,
        });
      });
    ping_timeout_.expires_after(timeout.value_or(origin_.options().key_value_timeout));
    ping_timeout_.async_wait(
      [self = this->shared_from_this(), opaque = req.opaque()](std::error_code ec) {
        if (ec == asio::error::operation_aborted) {
          return;
        }
        static_cast<void>(
          self->cancel(opaque, errc::common::unambiguous_timeout, retry_reason::do_not_retry));
      });
  }

  [[nodiscard]] auto context() const -> mcbp_context
  {
    return { config_, supported_features_ };
  }

  void bootstrap(utils::movable_function<void(std::error_code, topology::configuration)>&& callback,
                 bool retry_on_bucket_not_found = false)
  {
    retry_bootstrap_on_bucket_not_found_ = retry_on_bucket_not_found;
    bootstrap_callback_ = std::move(callback);
    bootstrap_deadline_.expires_after(origin_.options().bootstrap_timeout);
    bootstrap_deadline_.async_wait(
      [self = shared_from_this(),
       bootstrap_timeout = origin_.options().bootstrap_timeout](std::error_code ec) {
        if (ec == asio::error::operation_aborted || self->stopped_) {
          return;
        }
        if (self->state_listener_) {
          self->state_listener_->report_bootstrap_error(
            fmt::format("{}:{}", self->bootstrap_hostname_, self->bootstrap_port_), ec);
        }
#ifdef COUCHBASE_CXX_CLIENT_COLUMNAR
        // an existing background bootstrap listener means we want to infinitely
        // attempt to connect.
        if (self->background_bootstrap_listener_) {
          if (self->last_bootstrap_error_.has_value()) {
            self->background_bootstrap_listener_->notify_bootstrap_error(
              self->last_bootstrap_error_.value());
          } else {
            self->background_bootstrap_listener_->notify_bootstrap_error(
              { make_error_code(errc::common::unambiguous_timeout),
                "Unable to connect in time.",
                self->bootstrap_hostname_,
                self->bootstrap_port_ });
          }
          auto backoff = std::chrono::milliseconds(500);
          CB_LOG_DEBUG("{} unable to connect in time, waiting for {}ms before retry",
                       self->log_prefix_,
                       backoff.count());
          self->retry_backoff_.expires_after(backoff);
          self->retry_backoff_.async_wait([self](std::error_code ec) mutable {
            if (ec == asio::error::operation_aborted || self->stopped_) {
              return;
            }
            self->origin_.restart();
            self->initiate_bootstrap();
          });
        } else {
          if (!ec) {
            ec = errc::common::unambiguous_timeout;
          }
          CB_LOG_WARNING("{} unable to bootstrap in time, bootstrap_timeout: {}",
                         self->log_prefix_,
                         bootstrap_timeout);
          if (auto h = std::move(self->bootstrap_callback_); h) {
            h(ec, {});
          }
          self->stop(retry_reason::do_not_retry);
        }
#else
        if (!ec) {
          ec = errc::common::unambiguous_timeout;
        }
        CB_LOG_WARNING("{} unable to bootstrap in time, bootstrap_timeout: {}",
                       self->log_prefix_,
                       bootstrap_timeout);
        if (auto h = std::move(self->bootstrap_callback_); h) {
          h(ec, {});
        }
        self->stop(retry_reason::do_not_retry);
#endif
      });
    initiate_bootstrap();
  }

  void initiate_bootstrap()
  {
    if (stopped_) {
      return;
    }
    bootstrapped_ = false;
    if (auto handler = std::move(bootstrap_handler_); handler) {
      last_bootstrap_error_ = handler->last_bootstrap_error();
    }
    state_ = diag::endpoint_state::connecting;
    if (stream_->is_open()) {
      return stream_->close([self = shared_from_this(), old_id = stream_->id()](std::error_code) {
        CB_LOG_DEBUG(R"({} reopened socket connection "{}" -> "{}", host="{}", port={})",
                     self->log_prefix_,
                     old_id,
                     self->stream_->id(),
                     self->bootstrap_hostname_,
                     self->bootstrap_port_);
        return self->initiate_bootstrap();
      });
    }
    if (origin_.exhausted()) {
#ifdef COUCHBASE_CXX_CLIENT_COLUMNAR
      if (background_bootstrap_listener_) {
        if (last_bootstrap_error_.has_value()) {
          background_bootstrap_listener_->notify_bootstrap_error(last_bootstrap_error_.value());
        } else {
          background_bootstrap_listener_->notify_bootstrap_error(
            { errc::network::no_endpoints_left,
              "Reached end of list of bootstrap nodes.",
              bootstrap_hostname_,
              bootstrap_port_ });
        }
      }
#endif
      auto backoff = std::chrono::milliseconds(500);
      CB_LOG_DEBUG("{} reached the end of list of bootstrap nodes, waiting for {}ms before restart",
                   log_prefix_,
                   backoff.count());
      retry_backoff_.expires_after(backoff);
      retry_backoff_.async_wait([self = shared_from_this()](std::error_code ec) mutable {
        if (ec == asio::error::operation_aborted || self->stopped_) {
          return;
        }
        self->origin_.restart();
        self->initiate_bootstrap();
      });
      return;
    }
    std::tie(bootstrap_hostname_, bootstrap_port_) = origin_.next_address();
    bootstrap_port_number_ =
      gsl::narrow_cast<std::uint16_t>(std::stoul(bootstrap_port_, nullptr, 10));
    bootstrap_address_ = fmt::format("{}:{}", bootstrap_hostname_, bootstrap_port_);
    log_prefix_ = fmt::format("[{}/{}/{}/{}] <{}>",
                              client_id_,
                              id_,
                              stream_->log_prefix(),
                              bucket_name_.value_or("-"),
                              bootstrap_address_);
    CB_LOG_DEBUG("{} attempt to establish MCBP connection", log_prefix_);

    resolve_deadline_.expires_after(origin_.options().resolve_timeout);
    resolve_deadline_.async_wait([self = shared_from_this()](const auto ec) {
      if (ec == asio::error::operation_aborted || self->stopped_) {
        return;
      }
      self->initiate_bootstrap();
    });
    async_resolve(origin_.options().use_ip_protocol,
                  resolver_,
                  bootstrap_hostname_,
                  bootstrap_port_,
                  [self = shared_from_this()](auto ec, auto& endpoints) {
                    self->on_resolve(ec, endpoints);
                  });
  }

  [[nodiscard]] auto id() const -> const std::string&
  {
    return id_;
  }

  [[nodiscard]] auto node_uuid() const -> const std::string&
  {
    return node_uuid_;
  }

  [[nodiscard]] auto is_stopped() const -> bool
  {
    return stopped_;
  }

  [[nodiscard]] auto is_bootstrapped() const -> bool
  {
    return bootstrapped_;
  }

  void on_stop(utils::movable_function<void()> handler)
  {
    on_stop_handler_ = std::move(handler);
  }

  void stop(retry_reason reason)
  {
    if (stopped_) {
      return;
    }

    if (reason == retry_reason::socket_closed_while_in_flight && !bootstrapped_) {
      return stream_->close([self = shared_from_this(), old_id = stream_->id()](std::error_code) {
        CB_LOG_DEBUG(
          R"({} reopened socket connection due to IO error, "{}" -> "{}", host="{}", port={})",
          self->log_prefix_,
          old_id,
          self->stream_->id(),
          self->bootstrap_hostname_,
          self->bootstrap_port_);
        return self->initiate_bootstrap();
      });
    }

    state_ = diag::endpoint_state::disconnecting;
    CB_LOG_DEBUG("{} stop MCBP connection, reason={}", log_prefix_, reason);
    stopped_ = true;
    bootstrap_deadline_.cancel();
    resolve_deadline_.cancel();
    connection_deadline_.cancel();
    retry_backoff_.cancel();
    ping_timeout_.cancel();
    resolver_.cancel();
    stream_->close([](std::error_code) {
    });
    if (auto h = std::move(bootstrap_handler_); h) {
      h->stop();
    }
    if (auto h = std::move(handler_); h) {
      h->stop();
    }
    const std::error_code ec = errc::common::request_canceled;
    if (!bootstrapped_) {
      if (auto h = std::move(bootstrap_callback_); h) {
        h(ec, {});
      }
    }
    {
      const std::scoped_lock lock(command_handlers_mutex_);
      for (auto& [opaque, handler] : command_handlers_) {
        if (handler) {
          CB_LOG_DEBUG("{} MCBP cancel operation during session close, opaque={}, ec={}",
                       log_prefix_,
                       opaque,
                       ec.message());
          auto fun = std::move(handler);
          fun(ec, reason, {}, {});
        }
      }
      command_handlers_.clear();
    }
    {
      const std::scoped_lock lock(operations_mutex_);
      auto operations = std::move(operations_);
      for (auto& [opaque, operation] : operations) {
        auto& [request, handler] = operation;
        if (handler) {
          CB_LOG_DEBUG("{} MCBP cancel operation during session close, opaque={}, ec={}",
                       log_prefix_,
                       opaque,
                       ec.message());
          handler->handle_response(std::move(request), {}, reason, {}, {});
        }
      }
      operations_.clear();
    }
    config_listeners_.clear();
    state_ = diag::endpoint_state::disconnected;
    if (auto on_stop = std::move(on_stop_handler_); on_stop) {
      on_stop();
    }
#ifdef COUCHBASE_CXX_CLIENT_COLUMNAR
    if (background_bootstrap_listener_) {
      background_bootstrap_listener_ = nullptr;
    }
#endif
  }

  void write(std::vector<std::byte>&& buf)
  {
    if (stopped_) {
      return;
    }
    CB_LOG_TRACE("{} MCBP send {}", log_prefix_, mcbp_header_view(buf));
    const std::scoped_lock lock(output_buffer_mutex_);
    output_buffer_.emplace_back(std::move(buf));
  }

  void flush()
  {
    if (stopped_) {
      return;
    }
    asio::post(asio::bind_executor(ctx_, [self = shared_from_this()]() {
      self->do_write();
    }));
  }

  void write_and_flush(std::vector<std::byte>&& buf)
  {
    if (stopped_) {
      return;
    }
    write(std::move(buf));
    flush();
  }

  void remove_request(std::shared_ptr<mcbp::queue_request> request) override
  {
    const std::scoped_lock lock(operations_mutex_);
    if (auto iter = operations_.find(request->opaque_); iter != operations_.end()) {
      operations_.erase(iter);
    }
  }

  void enqueue_request(std::uint32_t opaque,
                       const std::shared_ptr<mcbp::queue_request>& request,
                       const std::shared_ptr<response_handler>& handler)
  {
    const std::scoped_lock lock(operations_mutex_);
    request->waiting_in_ = this;
    operations_.try_emplace(opaque, request, handler);
  }

  auto handle_request(protocol::client_opcode opcode,
                      std::uint16_t status,
                      std::uint32_t opaque,
                      mcbp_message&& msg) -> bool
  {
    // handle request old style
    command_handler fun{};
    {
      const std::scoped_lock lock(command_handlers_mutex_);
      if (auto handler = command_handlers_.find(opaque);
          handler != command_handlers_.end() && handler->second) {
        fun = std::move(handler->second);
        command_handlers_.erase(handler);
      }
    }

    auto reason = status == static_cast<std::uint16_t>(key_value_status_code::not_my_vbucket)
                    ? retry_reason::key_value_not_my_vbucket
                    : retry_reason::do_not_retry;
    if (fun) {
      fun(protocol::map_status_code(opcode, status),
          reason,
          std::move(msg),
          decode_error_code(status));
      return true;
    }

    // handle request new style
    std::shared_ptr<mcbp::queue_request> request{};
    std::shared_ptr<response_handler> handler{};
    {
      const std::scoped_lock lock(operations_mutex_);
      if (auto pair = operations_.find(opaque); pair != operations_.end() && pair->second.first) {
        request = pair->second.first;
        handler = pair->second.second;
        if (!request->persistent_) {
          operations_.erase(pair);
        }
      }
    }
    if (request) {
      handler->handle_response(std::move(request),
                               protocol::map_status_code(opcode, status),
                               reason,
                               std::move(msg),
                               decode_error_code(status));
      return true;
    }
    return false;
  }

  void write_and_subscribe(const std::shared_ptr<mcbp::queue_request>& request,
                           const std::shared_ptr<response_handler>& handler)
  {
    auto opaque = request->opaque_;
    auto data = codec_.encode_packet(*request);
    if (!data) {
      CB_LOG_DEBUG("unable to encode packet. opaque={}, ec={}", opaque, data.error().message());
      request->try_callback({}, data.error());
      return;
    }

    if (stopped_) {
      CB_LOG_WARNING("cancel operation while trying to write to closed mcbp session, opaque={}",
                     opaque);
      handler->handle_response(request,
                               errc::common::request_canceled,
                               retry_reason::socket_closed_while_in_flight,
                               {},
                               {});
      return;
    }
    enqueue_request(opaque, request, handler);
    if (bootstrapped_ && stream_->is_open()) {
      write_and_flush(std::move(data.value()));
    } else {
      CB_LOG_DEBUG("{} the stream is not ready yet, put the message into pending buffer, opaque={}",
                   log_prefix_,
                   opaque);
      const std::scoped_lock lock(pending_buffer_mutex_);
      if (bootstrapped_ && stream_->is_open()) {
        write_and_flush(std::move(data.value()));
      } else {
        pending_buffer_.emplace_back(data.value());
      }
    }
  }

  void write_and_subscribe(std::uint32_t opaque,
                           std::vector<std::byte>&& data,
                           command_handler&& handler)
  {
    if (stopped_) {
      CB_LOG_WARNING("{} MCBP cancel operation, while trying to write to closed session, opaque={}",
                     log_prefix_,
                     opaque);
      handler(errc::common::request_canceled, retry_reason::socket_closed_while_in_flight, {}, {});
      return;
    }
    {
      const std::scoped_lock lock(command_handlers_mutex_);
      command_handlers_.try_emplace(opaque, std::move(handler));
    }
    if (bootstrapped_ && stream_->is_open()) {
      write_and_flush(std::move(data));
    } else {
      CB_LOG_DEBUG("{} the stream is not ready yet, put the message into pending buffer, opaque={}",
                   log_prefix_,
                   opaque);
      const std::scoped_lock lock(pending_buffer_mutex_);
      if (bootstrapped_ && stream_->is_open()) {
        write_and_flush(std::move(data));
      } else {
        pending_buffer_.emplace_back(data);
      }
    }
  }

  [[nodiscard]] auto cancel(std::uint32_t opaque, std::error_code ec, retry_reason reason) -> bool
  {
    if (stopped_) {
      return false;
    }
    command_handlers_mutex_.lock();
    if (auto handler = command_handlers_.find(opaque); handler != command_handlers_.end()) {
      CB_LOG_DEBUG("{} MCBP cancel operation, opaque={}, ec={} ({})",
                   log_prefix_,
                   opaque,
                   ec.value(),
                   ec.message());
      if (handler->second) {
        auto fun = std::move(handler->second);
        command_handlers_.erase(handler);
        command_handlers_mutex_.unlock();
        fun(ec, reason, {}, {});
        return true;
      }
    }
    command_handlers_mutex_.unlock();
    return false;
  }

  [[nodiscard]] auto supports_feature(protocol::hello_feature feature) -> bool
  {
    return std::find(supported_features_.begin(), supported_features_.end(), feature) !=
           supported_features_.end();
  }

  [[nodiscard]] auto supported_features() const -> std::vector<protocol::hello_feature>
  {
    return supported_features_;
  }

  [[nodiscard]] auto supports_gcccp() const -> bool
  {
    return supports_gcccp_;
  }

  auto config() const -> std::optional<topology::configuration>
  {
    return config_;
  }

  [[nodiscard]] auto has_config() const -> bool
  {
    return configured_;
  }

  [[nodiscard]] auto config() -> topology::configuration
  {
    const std::scoped_lock lock(config_mutex_);
    if (config_) {
      return config_.value();
    }
    return {};
  }

  [[nodiscard]] auto index() const -> std::size_t
  {
    const std::scoped_lock lock(config_mutex_);
    Expects(config_.has_value());
    return config_->index_for_this_node();
  }

  [[nodiscard]] auto bootstrap_address() const -> const std::string&
  {
    return bootstrap_address_;
  }

  [[nodiscard]] auto bootstrap_hostname() const -> const std::string&
  {
    return bootstrap_hostname_;
  }

  [[nodiscard]] auto bootstrap_port() const -> const std::string&
  {
    return bootstrap_port_;
  }

  [[nodiscard]] auto bootstrap_port_number() const -> std::uint16_t
  {
    return bootstrap_port_number_;
  }

  [[nodiscard]] auto next_opaque() -> std::uint32_t
  {
    return ++opaque_;
  }

  [[nodiscard]] auto last_bootstrap_error() && -> std::optional<impl::bootstrap_error>
  {
    return std::move(last_bootstrap_error_);
  }

  [[nodiscard]] auto last_bootstrap_error() const& -> const std::optional<impl::bootstrap_error>&
  {
    return last_bootstrap_error_;
  }

  auto decode_error_code(std::uint16_t code) -> std::optional<key_value_error_map_info>
  {
    if (error_map_) {
      auto info = error_map_->errors.find(code);
      if (info != error_map_->errors.end()) {
        return info->second;
      }
    }
    return {};
  }

  void on_configuration_update(std::shared_ptr<config_listener> handler)
  {
    config_listeners_.emplace_back(std::move(handler));
  }

  void update_configuration(topology::configuration config)
  {
    if (stopped_) {
      return;
    }
    const std::scoped_lock lock(config_mutex_);
    // MB-60405 fixes this for 7.6.2, but for earlier versions we need to protect against using a
    // config that has an empty vbucket map.  We should be okay to ignore at this point b/c we
    // should already have a config w/ a non-empty vbucket map (bootstrap will not complete
    // successfully unless we have a config w/ a non-empty vbucket map).
    if (config.vbmap && config.vbmap->empty()) {
      CB_LOG_DEBUG("{} received a configuration with an empty vbucket map, ignoring", log_prefix_);
      return;
    }
    if (config_) {
      if (config_->vbmap && config.vbmap && config_->vbmap->size() != config.vbmap->size()) {
        CB_LOG_DEBUG("{} received a configuration with a different number of vbuckets, ignoring",
                     log_prefix_);
        return;
      }
      if (config == config_) {
        CB_LOG_TRACE(
          "{} received a configuration with identical revision (new={}, old={}), ignoring",
          log_prefix_,
          config.rev_str(),
          config_->rev_str());
        return;
      }
      if (config < config_) {
        CB_LOG_DEBUG("{} received a configuration with older revision (new={}, old={}), ignoring",
                     log_prefix_,
                     config.rev_str(),
                     config_->rev_str());
        return;
      }
    }
    bool this_node_found = false;
    for (auto& node : config.nodes) {
      if (node.hostname.empty()) {
        node.hostname = bootstrap_hostname_;
      }
      if (node.this_node) {
        this_node_found = true;
      }
    }
    if (!this_node_found) {
      for (auto& node : config.nodes) {
        if (node.hostname == bootstrap_hostname_) {
          if ((node.services_plain.key_value &&
               std::to_string(node.services_plain.key_value.value()) == bootstrap_port_) ||
              (node.services_tls.key_value &&
               std::to_string(node.services_tls.key_value.value()) == bootstrap_port_)) {
            node.this_node = true;
          }
        }
      }
    }
    config_.reset();
    config_.emplace(std::move(config));
    configured_ = true;
    for (const auto& listener : config_listeners_) {
      asio::post(asio::bind_executor(ctx_, [listener, c = config_.value()]() mutable {
        return listener->update_config(std::move(c));
      }));
    }
  }

  void handle_not_my_vbucket(const io::mcbp_message& msg)
  {
    if (stopped_) {
      return;
    }
    Expects(msg.header.magic == static_cast<std::uint8_t>(protocol::magic::alt_client_response) ||
            msg.header.magic == static_cast<std::uint8_t>(protocol::magic::client_response));
    if (protocol::has_json_datatype(msg.header.datatype)) {
      auto magic = static_cast<protocol::magic>(msg.header.magic);
      const std::uint8_t extras_size = msg.header.extlen;
      std::uint8_t framing_extras_size = 0;
      std::uint16_t key_size = utils::byte_swap(msg.header.keylen);
      if (magic == protocol::magic::alt_client_response) {
        framing_extras_size = static_cast<std::uint8_t>(msg.header.keylen >> 8U);
        key_size = msg.header.keylen & 0xffU;
      }

      const std::vector<std::uint8_t>::difference_type offset =
        framing_extras_size + key_size + extras_size;
      if (utils::byte_swap(msg.header.bodylen) - offset > 0) {
        std::string_view config_text{ reinterpret_cast<const char*>(msg.body.data()) + offset,
                                      msg.body.size() - static_cast<std::size_t>(offset) };
        if (origin_.options().dump_configuration) {
          CB_LOG_TRACE(
            "{} configuration from not_my_vbucket response (size={}, endpoint=\"{}:{}\"), {}",
            log_prefix_,
            config_text.size(),
            bootstrap_hostname_,
            bootstrap_port_number_,
            config_text);
        }
        auto config =
          protocol::parse_config(config_text, bootstrap_hostname_, bootstrap_port_number_);
        CB_LOG_DEBUG(
          "{} received not_my_vbucket status for {}, opaque={} with config rev={} in the payload",
          log_prefix_,
          protocol::client_opcode(msg.header.opcode),
          utils::byte_swap(msg.header.opaque),
          config.rev_str());
        update_configuration(std::move(config));
      }
    }
  }

  auto get_collection_uid(const std::string& collection_path) -> std::optional<std::uint32_t>
  {
    return collection_cache_.get(collection_path);
  }

  void update_collection_uid(const std::string& path, std::uint32_t uid)
  {
    if (stopped_) {
      return;
    }
    collection_cache_.update(path, uid);
  }

#ifdef COUCHBASE_CXX_CLIENT_COLUMNAR
  void add_background_bootstrap_listener(
    std::shared_ptr<columnar::background_bootstrap_listener> listener)
  {
    background_bootstrap_listener_ = std::move(listener);
  }
#endif

private:
  void invoke_bootstrap_handler(std::error_code ec)
  {
    connection_deadline_.cancel();
    retry_backoff_.cancel();

    if (ec && state_listener_) {
      state_listener_->report_bootstrap_error(
        fmt::format("{}:{}", bootstrap_hostname_, bootstrap_port_), ec);
    }
    if (ec == errc::network::configuration_not_available) {
      return initiate_bootstrap();
    }
    if (retry_bootstrap_on_bucket_not_found_ && ec == errc::common::bucket_not_found) {
      CB_LOG_DEBUG(R"({} server returned {} ({}), it must be transient condition, retrying)",
                   log_prefix_,
                   ec.value(),
                   ec.message());
      return initiate_bootstrap();
    }
    if (!origin_.exhausted() && ec == errc::common::authentication_failure) {
      CB_LOG_DEBUG(
        R"({} server returned authentication_failure, but the bootstrap list is not exhausted yet. It must be transient condition, retrying)",
        log_prefix_);
      return initiate_bootstrap();
    }

    if (!bootstrapped_ && bootstrap_callback_) {
      bootstrap_deadline_.cancel();
      if (config_ && state_listener_) {
        std::vector<std::string> endpoints;
        endpoints.reserve(config_.value().nodes.size());
        for (const auto& node : config_.value().nodes) {
          if (auto endpoint =
                node.endpoint(origin_.options().network, service_type::key_value, is_tls_);
              endpoint) {
            endpoints.push_back(endpoint.value());
          }
        }
        state_listener_->report_bootstrap_success(endpoints);
      }
      auto h = std::move(bootstrap_callback_);
      h(ec, config_.value_or(topology::configuration{}));
    }
    if (ec) {
      return stop(retry_reason::node_not_available);
    }
    if (node_uuid_.empty() && config_.has_value()) {
      for (const auto& node : config_.value().nodes) {
        if (node.this_node) {
          node_uuid_ = node.node_uuid;
        }
      }
    }
    state_ = diag::endpoint_state::connected;
    const std::scoped_lock lock(pending_buffer_mutex_);
    bootstrapped_ = true;
    bootstrap_handler_->stop();
    handler_ = std::make_shared<message_handler>(shared_from_this());
    handler_->start();
    if (!pending_buffer_.empty()) {
      for (auto& buf : pending_buffer_) {
        write(std::move(buf));
      }
      pending_buffer_.clear();
      flush();
    }
  }

  void on_resolve(const std::error_code& ec, const asio::ip::tcp::resolver::results_type& endpoints)
  {
    if (ec == asio::error::operation_aborted || stopped_) {
      return;
    }
    resolve_deadline_.cancel();
    last_active_ = std::chrono::steady_clock::now();
    if (ec) {
      CB_LOG_ERROR("{} error on resolve: {} ({})", log_prefix_, ec.value(), ec.message());
      last_bootstrap_error_ = { ec, ec.message(), bootstrap_hostname_, bootstrap_port_ };
      return initiate_bootstrap();
    }
    endpoints_ = endpoints;
    CB_LOG_TRACE("{} resolved \"{}:{}\" to {} endpoint(s)",
                 log_prefix_,
                 bootstrap_hostname_,
                 bootstrap_port_,
                 endpoints_.size());
    do_connect(endpoints_.begin());
  }

  void do_connect(const asio::ip::tcp::resolver::results_type::iterator& it)
  {
    if (stopped_) {
      return;
    }
    last_active_ = std::chrono::steady_clock::now();
    if (it != endpoints_.end()) {
      auto hostname = it->endpoint().address().to_string();
      auto port = it->endpoint().port();
      CB_LOG_DEBUG("{} connecting to {}:{} (\"{}:{}\"), timeout={}ms",
                   log_prefix_,
                   hostname,
                   port,
                   bootstrap_hostname_,
                   bootstrap_port_,
                   origin_.options().connect_timeout.count());
      connection_deadline_.expires_after(origin_.options().connect_timeout);
      connection_deadline_.async_wait(
        [self = shared_from_this(), hostname, port](const auto timer_ec) {
          if (timer_ec == asio::error::operation_aborted || self->stopped_) {
            return;
          }
          CB_LOG_DEBUG("{} unable to connect to {}:{} (\"{}:{}\") in time, reconnecting",
                       self->log_prefix_,
                       hostname,
                       port,
                       self->bootstrap_hostname_,
                       self->bootstrap_port_);
          self->initiate_bootstrap();
        });
      stream_->async_connect(it->endpoint(), [capture0 = shared_from_this(), it](auto&& PH1) {
        capture0->on_connect(std::forward<decltype(PH1)>(PH1), it);
      });
    } else {
      auto error_msg =
        fmt::format("no more endpoints left to connect to \"{}:{}\", will try another address",
                    bootstrap_hostname_,
                    bootstrap_port_);
      last_bootstrap_error_ = {
        errc::network::no_endpoints_left, std::move(error_msg), bootstrap_hostname_, bootstrap_port_
      };
      CB_LOG_ERROR("{} {}", log_prefix_, last_bootstrap_error_.value().error_message);
      if (state_listener_) {
        state_listener_->report_bootstrap_error(
          fmt::format("{}:{}", bootstrap_hostname_, bootstrap_port_),
          errc::network::no_endpoints_left);
      }
      return initiate_bootstrap();
    }
  }

  void on_connect(const std::error_code& ec, asio::ip::tcp::resolver::results_type::iterator it)
  {
    if (ec == asio::error::operation_aborted || stopped_) {
      return;
    }
    connection_deadline_.cancel();
    last_active_ = std::chrono::steady_clock::now();
    if (!stream_->is_open() || ec) {
#ifdef COUCHBASE_CXX_CLIENT_STATIC_BORINGSSL
      auto error_message = (ec.category() == asio::error::ssl_category)
                             ? ERR_error_string(static_cast<std::uint32_t>(ec.value()), nullptr)
                             : ec.message();
#else
      auto error_message = (ec.category() == asio::error::ssl_category)
                             ? ERR_error_string(static_cast<unsigned long>(ec.value()), nullptr)
                             : ec.message();
#endif
      CB_LOG_WARNING("{} unable to connect to {}:{}: {} ({}){}. is_open={}",
                     log_prefix_,
                     it->endpoint().address().to_string(),
                     it->endpoint().port(),
                     ec.value(),
                     error_message,
                     (ec == asio::error::connection_refused)
                       ? ", check server ports and cluster encryption setting"
                       : "",
                     stream_->is_open());
      if (stream_->is_open()) {
        stream_->close([self = shared_from_this(), next_address = ++it](std::error_code ec) {
          if (ec) {
            CB_LOG_WARNING(
              "{} unable to close socket, but continue connecting attempt to {}:{}: {}",
              self->log_prefix_,
              next_address->endpoint().address().to_string(),
              next_address->endpoint().port(),
              ec.value());
          }
          self->do_connect(next_address);
        });
      } else {
        do_connect(++it);
      }
    } else {
      stream_->set_options();
      connection_endpoints_ = { it->endpoint(), stream_->local_endpoint() };
      CB_LOG_DEBUG("{} connected to {}:{}:{}",
                   log_prefix_,
                   connection_endpoints_.local.port(),
                   connection_endpoints_.remote_address,
                   connection_endpoints_.remote.port());
      log_prefix_ = fmt::format("[{}/{}/{}/{}] <{}:{}/{}:{}>",
                                client_id_,
                                id_,
                                stream_->log_prefix(),
                                bucket_name_.value_or("-"),
                                connection_endpoints_.local.port(),
                                bootstrap_hostname_,
                                connection_endpoints_.remote_address,
                                connection_endpoints_.remote.port());
      parser_.reset();
      {
        const std::scoped_lock lock(output_buffer_mutex_);
        output_buffer_.clear();
      }
      bootstrap_handler_ = std::make_shared<bootstrap_handler>(shared_from_this());

      connection_deadline_.expires_after(origin_.options().key_value_timeout);
      connection_deadline_.async_wait([self = shared_from_this()](const auto timer_ec) {
        if (timer_ec == asio::error::operation_aborted || self->stopped_) {
          return;
        }
        CB_LOG_DEBUG(
          "{} unable to boostrap single node at {}:{}:{} (\"{}:{}\") in time, reconnecting",
          self->log_prefix_,
          self->connection_endpoints_.local.port(),
          self->connection_endpoints_.remote_address,
          self->connection_endpoints_.remote.port(),
          self->bootstrap_hostname_,
          self->bootstrap_port_);
        return self->initiate_bootstrap();
      });
    }
  }

  void do_read()
  {
    if (stopped_ || reading_ || !stream_->is_open()) {
      return;
    }
    reading_ = true;
    stream_->async_read_some(
      asio::buffer(input_buffer_),
      [self = shared_from_this(), stream_id = stream_->id()](std::error_code ec,
                                                             std::size_t bytes_transferred) {
        if (ec == asio::error::operation_aborted || self->stopped_) {
          self->reading_ = false;
          CB_LOG_PROTOCOL("[MCBP, IN] host=\"{}\", sport={}, dport={}, rc={}, bytes_received={}",
                          self->connection_endpoints_.remote_address,
                          self->connection_endpoints_.local.port(),
                          self->connection_endpoints_.remote.port(),
                          ec ? ec.message() : "ok",
                          bytes_transferred);
          return;
        }
        CB_LOG_PROTOCOL("[MCBP, IN] host=\"{}\", sport={}, dport={}, rc={}, bytes_received={}{:a}",
                        self->connection_endpoints_.remote_address,
                        self->connection_endpoints_.local.port(),
                        self->connection_endpoints_.remote.port(),
                        ec ? ec.message() : "ok",
                        bytes_transferred,
                        spdlog::to_hex(self->input_buffer_.data(),
                                       self->input_buffer_.data() +
                                         static_cast<std::ptrdiff_t>(bytes_transferred)));

        self->last_active_ = std::chrono::steady_clock::now();
        if (ec) {
          self->reading_ = false;
          if (stream_id != self->stream_->id()) {
            CB_LOG_ERROR(
              R"({} ignore IO error while reading from the socket: {} ({}), old_id="{}", new_id="{}")",
              self->log_prefix_,
              ec.value(),
              ec.message(),
              stream_id,
              self->stream_->id());
            return;
          }
          CB_LOG_ERROR(R"({} IO error while reading from the socket("{}"): {} ({}))",
                       self->log_prefix_,
                       self->stream_->id(),
                       ec.value(),
                       ec.message());
          return self->stop(retry_reason::socket_closed_while_in_flight);
        }
        self->parser_.feed(self->input_buffer_.data(),
                           self->input_buffer_.data() +
                             static_cast<std::ptrdiff_t>(bytes_transferred));

        for (;;) {
          mcbp_message msg{};
          switch (self->parser_.next(msg)) {
            case mcbp_parser::result::ok: {
              if (self->stopped_) {
                return;
              }
              CB_LOG_TRACE(
                "{} MCBP recv {}", self->log_prefix_, mcbp_header_view(msg.header_data()));
              if (self->bootstrapped_) {
                self->handler_->handle(std::move(msg));
              } else if (self->bootstrap_handler_) {
                self->bootstrap_handler_->handle(std::move(msg));
              }
              if (self->stopped_) {
                return;
              }
            } break;
            case mcbp_parser::result::need_data:
              self->reading_ = false;
              if (!self->stopped_ && self->stream_->is_open()) {
                self->do_read();
              }
              return;
            case mcbp_parser::result::failure:
              return self->stop(retry_reason::key_value_temporary_failure);
          }
        }
      });
  }

  void do_write()
  {
    if (stopped_ || !stream_->is_open()) {
      return;
    }
    const std::scoped_lock lock(writing_buffer_mutex_, output_buffer_mutex_);
    if (!writing_buffer_.empty() || output_buffer_.empty()) {
      return;
    }
    std::swap(writing_buffer_, output_buffer_);
    std::vector<asio::const_buffer> buffers;
    buffers.reserve(writing_buffer_.size());
    for (auto& buf : writing_buffer_) {
      CB_LOG_PROTOCOL("[MCBP, OUT] host=\"{}\", sport={}, dport={}, buffer_size={}{:a}",
                      connection_endpoints_.remote_address,
                      connection_endpoints_.local.port(),
                      connection_endpoints_.remote.port(),
                      buf.size(),
                      spdlog::to_hex(buf));
      buffers.emplace_back(asio::buffer(buf));
    }
    stream_->async_write(
      buffers, [self = shared_from_this()](std::error_code ec, std::size_t bytes_transferred) {
        CB_LOG_PROTOCOL("[MCBP, OUT] host=\"{}\", sport={}, dport={}, rc={}, bytes_sent={}",
                        self->connection_endpoints_.remote_address,
                        self->connection_endpoints_.local.port(),
                        self->connection_endpoints_.remote.port(),
                        ec ? ec.message() : "ok",
                        bytes_transferred);
        if (ec == asio::error::operation_aborted || self->stopped_) {
          return;
        }
        self->last_active_ = std::chrono::steady_clock::now();

        if (ec) {
          CB_LOG_ERROR(R"({} IO error while writing to the socket("{}"): {} ({}))",
                       self->log_prefix_,
                       self->stream_->id(),
                       ec.value(),
                       ec.message());
          return self->stop(retry_reason::socket_closed_while_in_flight);
        }
        {
          const std::scoped_lock inner_lock(self->writing_buffer_mutex_);
          self->writing_buffer_.clear();
        }
        asio::post(asio::bind_executor(self->ctx_, [self]() {
          self->do_write();
          self->do_read();
        }));
      });
  }

  const std::string client_id_;
  std::string node_uuid_;
  const std::string id_{ uuid::to_string(uuid::random()) };
  asio::io_context& ctx_;
  asio::ip::tcp::resolver resolver_;
  std::unique_ptr<stream_impl> stream_;
  asio::steady_timer bootstrap_deadline_;
  asio::steady_timer resolve_deadline_;
  asio::steady_timer connection_deadline_;
  asio::steady_timer retry_backoff_;
  asio::steady_timer ping_timeout_;
  couchbase::core::origin origin_;
  std::optional<std::string> bucket_name_;
  mcbp_parser parser_;
  std::shared_ptr<bootstrap_handler> bootstrap_handler_{ nullptr };
  std::optional<impl::bootstrap_error> last_bootstrap_error_;
  std::shared_ptr<message_handler> handler_{ nullptr };
  utils::movable_function<void(std::error_code, const topology::configuration&)>
    bootstrap_callback_{};
  std::mutex command_handlers_mutex_{};
  std::map<std::uint32_t, command_handler> command_handlers_{};
  std::vector<std::shared_ptr<config_listener>> config_listeners_{};
  utils::movable_function<void()> on_stop_handler_{};

  std::atomic_bool bootstrapped_{ false };
  std::atomic_bool stopped_{ false };
  bool authenticated_{ false };
  bool bucket_selected_{ false };
  bool supports_gcccp_{ true };
  bool retry_bootstrap_on_bucket_not_found_{ false };

  std::atomic<std::uint32_t> opaque_{ 0 };

  std::array<std::byte, 16384> input_buffer_{};
  std::vector<std::vector<std::byte>> output_buffer_{};
  std::vector<std::vector<std::byte>> pending_buffer_{};
  std::vector<std::vector<std::byte>> writing_buffer_{};
  std::mutex output_buffer_mutex_{};
  std::mutex pending_buffer_mutex_{};
  std::mutex writing_buffer_mutex_{};
  std::string bootstrap_hostname_{};
  std::string bootstrap_port_{};
  std::string bootstrap_address_{};
  std::uint16_t bootstrap_port_number_{};
  connection_endpoints connection_endpoints_{ {}, {} };
  asio::ip::tcp::resolver::results_type endpoints_;
  std::vector<protocol::hello_feature> supported_features_;
  std::optional<topology::configuration> config_;
  mutable std::mutex config_mutex_{};
  std::atomic_bool configured_{ false };
  std::optional<error_map> error_map_;
  collection_cache collection_cache_;

  const bool is_tls_;
  std::shared_ptr<impl::bootstrap_state_listener> state_listener_{ nullptr };

  mcbp::codec codec_;
  std::recursive_mutex operations_mutex_{};
  std::map<std::uint32_t,
           std::pair<std::shared_ptr<mcbp::queue_request>, std::shared_ptr<response_handler>>>
    operations_{};

  std::atomic_bool reading_{ false };

  std::string log_prefix_{};
  std::chrono::time_point<std::chrono::steady_clock> last_active_{};
  std::atomic<diag::endpoint_state> state_{ diag::endpoint_state::disconnected };
#ifdef COUCHBASE_CXX_CLIENT_COLUMNAR
  std::shared_ptr<columnar::background_bootstrap_listener> background_bootstrap_listener_{
    nullptr
  };
#endif
};

mcbp_session::mcbp_session(const std::string& client_id,
                           const std::string& node_uuid,
                           asio::io_context& ctx,
                           core::origin origin,
                           std::shared_ptr<impl::bootstrap_state_listener> state_listener,
                           std::optional<std::string> bucket_name,
                           std::vector<protocol::hello_feature> known_features)
  : impl_{ std::make_shared<mcbp_session_impl>(client_id,
                                               node_uuid,
                                               ctx,
                                               std::move(origin),
                                               std::move(state_listener),
                                               std::move(bucket_name),
                                               std::move(known_features)) }
{
}

mcbp_session::mcbp_session(const std::string& client_id,
                           const std::string& node_uuid,
                           asio::io_context& ctx,
                           asio::ssl::context& tls,
                           core::origin origin,
                           std::shared_ptr<impl::bootstrap_state_listener> state_listener,
                           std::optional<std::string> bucket_name,
                           std::vector<protocol::hello_feature> known_features)
  : impl_{ std::make_shared<mcbp_session_impl>(client_id,
                                               node_uuid,
                                               ctx,
                                               tls,
                                               std::move(origin),
                                               std::move(state_listener),
                                               std::move(bucket_name),
                                               std::move(known_features)) }
{
}

auto
mcbp_session::log_prefix() const -> const std::string&
{
  return impl_->log_prefix();
}

auto
mcbp_session::cancel(std::uint32_t opaque, std::error_code ec, retry_reason reason) -> bool
{
  return impl_->cancel(opaque, ec, reason);
}

auto
mcbp_session::is_stopped() const -> bool
{
  return impl_->is_stopped();
}

auto
mcbp_session::is_bootstrapped() const -> bool
{
  return impl_->is_bootstrapped();
}

auto
mcbp_session::next_opaque() -> std::uint32_t
{
  return impl_->next_opaque();
}

auto
mcbp_session::get_collection_uid(const std::string& collection_path) -> std::optional<std::uint32_t>
{
  return impl_->get_collection_uid(collection_path);
}

auto
mcbp_session::context() const -> mcbp_context
{
  return impl_->context();
}

auto
mcbp_session::supports_feature(protocol::hello_feature feature) -> bool
{
  return impl_->supports_feature(feature);
}

auto
mcbp_session::id() const -> const std::string&
{
  return impl_->id();
}

auto
mcbp_session::node_uuid() const -> const std::string&
{
  return impl_->node_uuid();
}

auto
mcbp_session::bootstrap_address() const -> const std::string&
{
  return impl_->bootstrap_address();
}

auto
mcbp_session::remote_address() const -> std::string
{
  return impl_->remote_address();
}

auto
mcbp_session::local_address() const -> std::string
{
  return impl_->local_address();
}

auto
mcbp_session::bootstrap_hostname() const -> const std::string&
{
  return impl_->bootstrap_hostname();
}

auto
mcbp_session::bootstrap_port() const -> const std::string&
{
  return impl_->bootstrap_port();
}

auto
mcbp_session::bootstrap_port_number() const -> std::uint16_t
{
  return impl_->bootstrap_port_number();
}

auto
mcbp_session::last_bootstrap_error() && -> std::optional<impl::bootstrap_error>
{
  return std::move(impl_)->last_bootstrap_error();
}

auto
mcbp_session::last_bootstrap_error() const& -> const std::optional<impl::bootstrap_error>&
{
  return impl_->last_bootstrap_error();
}

void
mcbp_session::write_and_subscribe(std::uint32_t opaque,
                                  std::vector<std::byte>&& data,
                                  command_handler&& handler)
{
  return impl_->write_and_subscribe(opaque, std::move(data), std::move(handler));
}

void
mcbp_session::bootstrap(
  utils::movable_function<void(std::error_code, topology::configuration)>&& handler,
  bool retry_on_bucket_not_found)
{
  return impl_->bootstrap(std::move(handler), retry_on_bucket_not_found);
}

void
mcbp_session::on_stop(utils::movable_function<void()> handler)
{
  return impl_->on_stop(std::move(handler));
}

void
mcbp_session::stop(retry_reason reason)
{
  return impl_->stop(reason);
}

auto
mcbp_session::index() const -> std::size_t
{
  return impl_->index();
}

auto
mcbp_session::config() const -> std::optional<topology::configuration>
{
  return impl_->config();
}

auto
mcbp_session::has_config() const -> bool
{
  return impl_->has_config();
}

auto
mcbp_session::diag_info() const -> diag::endpoint_diag_info
{
  return impl_->diag_info();
}

void
mcbp_session::on_configuration_update(std::shared_ptr<config_listener> handler)
{
  return impl_->on_configuration_update(std::move(handler));
}

auto
mcbp_session::supported_features() const -> std::vector<protocol::hello_feature>
{
  return impl_->supported_features();
}

void
mcbp_session::ping(const std::shared_ptr<diag::ping_reporter>& handler,
                   std::optional<std::chrono::milliseconds> timeout) const
{
  return impl_->ping(handler, timeout);
}

auto
mcbp_session::supports_gcccp() const -> bool
{
  return impl_->supports_gcccp();
}

auto
mcbp_session::decode_error_code(std::uint16_t code) -> std::optional<key_value_error_map_info>
{
  return impl_->decode_error_code(code);
}

void
mcbp_session::handle_not_my_vbucket(const mcbp_message& msg) const
{
  return impl_->handle_not_my_vbucket(msg);
}

void
mcbp_session::update_collection_uid(const std::string& path, std::uint32_t uid)
{
  return impl_->update_collection_uid(path, uid);
}

void
mcbp_session::write_and_subscribe(const std::shared_ptr<mcbp::queue_request>& request,
                                  const std::shared_ptr<response_handler>& handler)
{
  return impl_->write_and_subscribe(request, handler);
}

void
mcbp_session::write_and_flush(std::vector<std::byte>&& buffer)
{
  return impl_->write_and_flush(std::move(buffer));
}

#ifdef COUCHBASE_CXX_CLIENT_COLUMNAR
void
mcbp_session::add_background_bootstrap_listener(
  std::shared_ptr<columnar::background_bootstrap_listener> listener)
{
  return impl_->add_background_bootstrap_listener(std::move(listener));
}
#endif

} // namespace couchbase::core::io
