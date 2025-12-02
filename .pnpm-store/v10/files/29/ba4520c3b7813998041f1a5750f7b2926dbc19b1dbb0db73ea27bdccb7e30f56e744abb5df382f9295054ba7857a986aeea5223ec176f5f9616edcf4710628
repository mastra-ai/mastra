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

#include "dns_client.hxx"

#include "core/logger/logger.hxx"
#include "core/utils/join_strings.hxx"
#include "dns_codec.hxx"
#include "dns_config.hxx"

#include <couchbase/error_codes.hxx>

#include <asio/ip/tcp.hpp>
#include <asio/read.hpp>
#include <asio/write.hpp>
#include <spdlog/fmt/bin_to_hex.h>
#include <spdlog/fmt/bundled/chrono.h>

#include <chrono>
#include <memory>
#include <sstream>
#include <utility>

namespace couchbase::core::io::dns
{
class dns_srv_command : public std::enable_shared_from_this<dns_srv_command>
{
public:
  dns_srv_command(
    asio::io_context& ctx,
    const std::string& name,
    const std::string& service,
    asio::ip::address address,
    std::uint16_t port,
    utils::movable_function<void(couchbase::core::io::dns::dns_srv_response&& resp)> handler)
    : deadline_(ctx)
    , udp_deadline_(ctx)
    , udp_(ctx)
    , tcp_(ctx)
    , address_(std::move(address))
    , port_(port)
    , handler_(std::move(handler))
  {
    static const std::string protocol{ "_tcp" };
    dns_message request{};
    question_record qr;
    qr.klass = resource_class::in;
    qr.type = resource_type::srv;
    qr.name.labels.push_back(service);
    qr.name.labels.push_back(protocol);
    std::string label;
    std::istringstream name_stream(name);
    while (std::getline(name_stream, label, '.')) {
      qr.name.labels.push_back(label);
    }
    request.questions.emplace_back(qr);
    send_buf_ = dns_codec::encode(request);
  }

  void execute(std::chrono::milliseconds total_timeout, std::chrono::milliseconds udp_timeout)
  {
    CB_LOG_TRACE("Query DNS-SRV (UDP) address=\"{}:{}\", udp_timeout={}, total_timeout={}",
                 address_.to_string(),
                 port_,
                 udp_timeout,
                 total_timeout);
    const asio::ip::udp::endpoint endpoint(address_, port_);
    udp_.open(endpoint.protocol());
    CB_LOG_PROTOCOL("[DNS, UDP, OUT] host=\"{}\", port={}, buffer_size={}{:a}",
                    address_.to_string(),
                    port_,
                    send_buf_.size(),
                    spdlog::to_hex(send_buf_));
    udp_.async_send_to(
      asio::buffer(send_buf_),
      endpoint,
      [self = shared_from_this()](std::error_code ec1, std::size_t bytes_transferred1) mutable {
        CB_LOG_PROTOCOL("[DNS, UDP, OUT] host=\"{}\", port={}, rc={}, bytes_sent={}",
                        self->address_.to_string(),
                        self->port_,
                        ec1 ? ec1.message() : "ok",
                        bytes_transferred1);
        if (ec1) {
          self->udp_deadline_.cancel();
          if (ec1 == asio::error::operation_aborted) {
            return;
          }
          CB_LOG_DEBUG(
            "DNS UDP write operation has got error, retrying with TCP, address=\"{}:{}\", ec={}",
            self->address_.to_string(),
            self->port_,
            ec1.message());
          return self->retry_with_tcp();
        }

        self->recv_buf_.resize(512);
        self->udp_.async_receive_from(
          asio::buffer(self->recv_buf_),
          self->udp_sender_,
          [self](std::error_code ec2, std::size_t bytes_transferred) mutable {
            CB_LOG_PROTOCOL(
              "[DNS, UDP, IN] host=\"{}\", port={}, rc={}, bytes_received={}{:a}",
              self->address_.to_string(),
              self->port_,
              ec2 ? ec2.message() : "ok",
              bytes_transferred,
              spdlog::to_hex(self->recv_buf_.data(), self->recv_buf_.data() + bytes_transferred));

            self->udp_deadline_.cancel();
            if (ec2) {
              if (ec2 == asio::error::operation_aborted) {
                return;
              }
              CB_LOG_DEBUG(
                "DNS UDP read operation has got error, retrying with TCP, address=\"{}:{}\", ec={}",
                self->address_.to_string(),
                self->port_,
                ec2.message());
              return self->retry_with_tcp();
            }
            self->recv_buf_.resize(bytes_transferred);
            const dns_message message = dns_codec::decode(self->recv_buf_);
            if (message.header.flags.tc == truncation::yes) {
              self->udp_.close();
              CB_LOG_DEBUG("DNS UDP read operation returned truncated response, retrying with TCP");
              return self->retry_with_tcp();
            }
            self->deadline_.cancel();
            dns_srv_response resp{ ec2 };
            resp.targets.reserve(message.answers.size());
            for (const auto& answer : message.answers) {
              resp.targets.emplace_back(dns_srv_response::address{
                utils::join_strings(answer.target.labels, "."), answer.port });
            }
            CB_LOG_DEBUG("DNS UDP returned {} records", resp.targets.size());
            return self->handler_(std::move(resp));
          });
      });
    udp_deadline_.expires_after(udp_timeout);
    udp_deadline_.async_wait([self = shared_from_this()](std::error_code ec) {
      if (ec == asio::error::operation_aborted) {
        return;
      }
      self->udp_.cancel();
      CB_LOG_DEBUG("DNS UDP deadline has been reached, cancelling UDP operation and fall back to "
                   "TCP, address=\"{}:{}\"",
                   self->address_.to_string(),
                   self->port_);
      return self->retry_with_tcp();
    });

    deadline_.expires_after(total_timeout);
    deadline_.async_wait([self = shared_from_this()](std::error_code ec) {
      if (ec == asio::error::operation_aborted) {
        return;
      }
      CB_LOG_DEBUG("DNS deadline has been reached, cancelling in-flight operations "
                   "(tcp.is_open={}, address=\"{}:{}\")",
                   self->tcp_.is_open(),
                   self->address_.to_string(),
                   self->port_);
      self->udp_.cancel();
      if (self->tcp_.is_open()) {
        self->tcp_.cancel();
      }
      return self->handler_({ errc::common::unambiguous_timeout });
    });
  }

private:
  void retry_with_tcp()
  {
    if (bool expected_state{ false };
        !retrying_with_tcp_.compare_exchange_strong(expected_state, true)) {
      return;
    }

    CB_LOG_TRACE("Query DNS-SRV (TCP) address=\"{}:{}\", time_left={}",
                 address_.to_string(),
                 port_,
                 std::chrono::duration_cast<std::chrono::milliseconds>(
                   deadline_.expiry() - std::chrono::steady_clock::now()));

    const asio::ip::tcp::no_delay no_delay(true);
    std::error_code ignore_ec;
    tcp_.set_option(no_delay, ignore_ec);
    const asio::ip::tcp::endpoint endpoint(address_, port_);
    tcp_.async_connect(endpoint, [self = shared_from_this()](std::error_code ec1) mutable {
      if (ec1) {
        if (ec1 == asio::error::operation_aborted) {
          return;
        }
        self->deadline_.cancel();
        CB_LOG_DEBUG("DNS TCP connection has been aborted, address=\"{}:{}\", ec={}",
                     self->address_.to_string(),
                     self->port_,
                     ec1.message());
        return self->handler_({ ec1 });
      }
      auto send_size = static_cast<std::uint16_t>(self->send_buf_.size());
      self->send_buf_.insert(self->send_buf_.begin(), static_cast<std::uint8_t>(send_size & 0xffU));
      self->send_buf_.insert(self->send_buf_.begin(), static_cast<std::uint8_t>(send_size >> 8U));
      CB_LOG_PROTOCOL("[DNS, TCP, OUT] host=\"{}\", port={}, buffer_size={}{:a}",
                      self->address_.to_string(),
                      self->port_,
                      self->send_buf_.size(),
                      spdlog::to_hex(self->send_buf_));
      asio::async_write(
        self->tcp_,
        asio::buffer(self->send_buf_),
        [self](std::error_code ec2, std::size_t bytes_transferred2) mutable {
          CB_LOG_PROTOCOL("[DNS, TCP, OUT] host=\"{}\", port={}, rc={}, bytes_sent={}",
                          self->address_.to_string(),
                          self->port_,
                          ec2 ? ec2.message() : "ok",
                          bytes_transferred2);
          if (ec2) {
            if (ec2 == asio::error::operation_aborted) {
              return;
            }
            CB_LOG_DEBUG("DNS TCP write operation has been aborted, address=\"{}:{}\", ec={}",
                         self->address_.to_string(),
                         self->port_,
                         ec2.message());
            self->deadline_.cancel();
            return self->handler_({ ec2 });
          }
          asio::async_read(
            self->tcp_,
            asio::buffer(&self->recv_buf_size_, sizeof(std::uint16_t)),
            [self](std::error_code ec3, std::size_t bytes_transferred3) mutable {
              CB_LOG_PROTOCOL(
                "[DNS, TCP, IN] host=\"{}\", port={}, rc={}, bytes_received={}{:a}",
                self->address_.to_string(),
                self->port_,
                ec3 ? ec3.message() : "ok",
                bytes_transferred3,
                spdlog::to_hex(reinterpret_cast<std::uint8_t*>(&self->recv_buf_size_),
                               reinterpret_cast<std::uint8_t*>(&self->recv_buf_size_) +
                                 bytes_transferred3));
              if (ec3) {
                if (ec3 == asio::error::operation_aborted) {
                  return;
                }
                CB_LOG_DEBUG(
                  "DNS TCP buf size read operation has been aborted, address=\"{}:{}\", ec={}",
                  self->address_.to_string(),
                  self->port_,
                  ec3.message());
                self->deadline_.cancel();
                return self->handler_({ ec3 });
              }
              self->recv_buf_size_ = utils::byte_swap(self->recv_buf_size_);
              self->recv_buf_.resize(self->recv_buf_size_);
              CB_LOG_DEBUG("DNS TCP schedule read of {} bytes", self->recv_buf_size_);
              asio::async_read(
                self->tcp_,
                asio::buffer(self->recv_buf_),
                [self](std::error_code ec4, std::size_t bytes_transferred4) mutable {
                  CB_LOG_PROTOCOL(
                    "[DNS, TCP, IN] host=\"{}\", port={}, rc={}, bytes_received={}{:a}",
                    self->address_.to_string(),
                    self->port_,
                    ec4 ? ec4.message() : "ok",
                    bytes_transferred4,
                    spdlog::to_hex(self->recv_buf_.data(),
                                   self->recv_buf_.data() + bytes_transferred4));

                  if (ec4 == asio::error::operation_aborted) {
                    return;
                  }
                  self->deadline_.cancel();
                  if (ec4) {
                    CB_LOG_DEBUG(
                      "DNS TCP read operation has been aborted, address=\"{}:{}\", ec={}",
                      self->address_.to_string(),
                      self->port_,
                      ec4.message());
                    return self->handler_({ ec4 });
                  }
                  self->recv_buf_.resize(bytes_transferred4);
                  const dns_message message = dns_codec::decode(self->recv_buf_);
                  dns_srv_response resp{ ec4 };
                  resp.targets.reserve(message.answers.size());
                  for (const auto& answer : message.answers) {
                    resp.targets.emplace_back(dns_srv_response::address{
                      utils::join_strings(answer.target.labels, "."), answer.port });
                  }
                  CB_LOG_DEBUG("DNS TCP returned {} records", resp.targets.size());
                  return self->handler_(std::move(resp));
                });
            });
        });
    });
  }

  asio::steady_timer deadline_;
  asio::steady_timer udp_deadline_;
  asio::ip::udp::socket udp_;
  asio::ip::udp::endpoint udp_sender_{};
  asio::ip::tcp::socket tcp_;

  asio::ip::address address_;
  std::uint16_t port_;
  utils::movable_function<void(couchbase::core::io::dns::dns_srv_response&& resp)> handler_;

  std::vector<std::uint8_t> send_buf_{};
  std::uint16_t recv_buf_size_{ 0 };
  std::vector<std::uint8_t> recv_buf_{};

  std::atomic_bool retrying_with_tcp_{ false };
};

void
dns_client::query_srv(const std::string& name,
                      const std::string& service,
                      const dns_config& config,
                      utils::movable_function<void(dns_srv_response&&)>&& handler)
{
  if (config.nameserver().empty()) {
    return handler({ {} });
  }

  std::error_code ec;
  auto address = asio::ip::make_address(config.nameserver(), ec);
  if (ec) {
    return handler({ ec });
  }
  auto cmd = std::make_shared<dns_srv_command>(
    ctx_, name, service, address, config.port(), std::move(handler));
  return cmd->execute(config.timeout(), config.timeout() / 2);
}
} // namespace couchbase::core::io::dns
