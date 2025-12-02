/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *   Copyright 2020-2023 Couchbase, Inc.
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

#include "crud_component.hxx"

#include "collections_component.hxx"
#include "core/error_context/key_value_status_code.hxx"
#include "core/mcbp/buffer_writer.hxx"
#include "core/pending_operation.hxx"
#include "core/protocol/client_opcode.hxx"
#include "core/protocol/datatype.hxx"
#include "core/protocol/magic.hxx"
#include "core/range_scan_options.hxx"
#include "core/utils/binary.hxx"
#include "core/utils/unsigned_leb128.hxx"
#include "mcbp/big_endian.hxx"
#include "mcbp/queue_request.hxx"
#include "mcbp/queue_response.hxx"
#include "platform/base64.h"
#include "timeout_defaults.hxx"
#include "utils/json.hxx"

#include <couchbase/error_codes.hxx>

#include <asio/error.hpp>
#include <asio/io_context.hpp>
#include <asio/steady_timer.hpp>
#include <gsl/span>
#include <gsl/span_ext>
#include <gsl/util>
#include <snappy.h>
#include <spdlog/fmt/bundled/core.h>
#include <tao/json/value.hpp>
#include <tl/expected.hpp>

#include <chrono>
#include <cstddef>
#include <cstdint>
#include <memory>
#include <random>
#include <string>
#include <system_error>
#include <utility>
#include <variant>
#include <vector>

namespace couchbase::core
{
namespace
{
auto
serialize_range_scan_create_options(const range_scan_create_options& options)
  -> std::pair<std::vector<std::byte>, std::error_code>
{
  tao::json::value body{};
  if (options.ids_only) {
    body["key_only"] = true;
  }

  if (options.collection_id != 0) {
    body["collection"] = fmt::format("{:x}", options.collection_id);
  }

  if (std::holds_alternative<range_scan>(options.scan_type) ||
      std::holds_alternative<prefix_scan>(options.scan_type)) {
    const auto& range = (std::holds_alternative<range_scan>(options.scan_type))
                          ? std::get<range_scan>(options.scan_type)
                          : std::get<prefix_scan>(options.scan_type).to_range_scan();

    const auto& from = range.from.value_or(scan_term{ "" });
    const auto& to = range.to.value_or(scan_term{ "\xf4\x8f\xfb\xfb" });

    body["range"] = {
      { from.exclusive ? "excl_start" : "start", base64::encode(from.term) },
      { to.exclusive ? "excl_end" : "end", base64::encode(to.term) },
    };
  } else if (std::holds_alternative<sampling_scan>(options.scan_type)) {
    const auto& sampling = std::get<sampling_scan>(options.scan_type);

    // The limit in sampling scan is required to be greater than 0
    if (sampling.limit <= 0) {
      return { {}, errc::common::invalid_argument };
    }

    std::uint64_t seed{};
    if (sampling.seed.has_value()) {
      seed = sampling.seed.value();
    } else {
      // Generate random uint64 as seed
      std::random_device rd;
      std::mt19937_64 gen(rd());
      std::uniform_int_distribution<std::uint64_t> dis;
      seed = dis(gen);
    }

    body["sampling"] = {
      { "samples", sampling.limit },
      { "seed", seed },
    };
  } else {
    return { {}, errc::common::invalid_argument };
  }

  if (options.snapshot_requirements) {
    const auto& snapshot = options.snapshot_requirements.value();
    tao::json::value requirements = {
      { "vb_uuid", std::to_string(snapshot.vbucket_uuid) },
      { "seqno", snapshot.sequence_number },
      { "timeout_ms",
        (options.timeout == std::chrono::milliseconds::zero())
          ? timeout_defaults::key_value_scan_timeout.count()
          : options.timeout.count() },
    };
    if (snapshot.sequence_number_exists) {
      requirements["seqno_exists"] = true;
    }
    body["snapshot_requirements"] = requirements;
  }

  return { utils::json::generate_binary(body), {} };
}

auto
parse_range_scan_keys(gsl::span<std::byte> data,
                      const std::shared_ptr<mcbp::queue_request>& request,
                      range_scan_item_callback&& item_callback) -> std::error_code
{
  do {
    if (data.empty() || request->is_cancelled()) {
      return {};
    }
    auto [key_length, remaining] =
      utils::decode_unsigned_leb128<std::size_t>(data, core::utils::leb_128_no_throw{});
    if (remaining.size() < key_length) {
      return errc::network::protocol_error;
    }
    item_callback(
      range_scan_item{ { reinterpret_cast<const char*>(remaining.data()), key_length } });
    if (remaining.size() == key_length) {
      return {};
    }
    data = gsl::make_span(remaining.data() + key_length, remaining.size() - key_length);
  } while (!data.empty());
  return {};
}

auto
parse_range_scan_documents(gsl::span<std::byte> data,
                           const std::shared_ptr<mcbp::queue_request>& request,
                           range_scan_item_callback&& item_callback) -> std::error_code
{
  do {
    if (data.empty() || request->is_cancelled()) {
      return {};
    }

    range_scan_item_body body{};
    static constexpr std::size_t header_offset = sizeof(body.flags) + sizeof(body.expiry) +
                                                 sizeof(body.sequence_number) + sizeof(body.cas) +
                                                 sizeof(body.datatype);

    if (data.size() < header_offset) {
      return errc::network::protocol_error;
    }

    body.flags = mcbp::big_endian::read_uint32(data, 0);
    body.expiry = mcbp::big_endian::read_uint32(data, 4);
    body.sequence_number = mcbp::big_endian::read_uint64(data, 8);
    body.cas = couchbase::cas{ mcbp::big_endian::read_uint64(data, 16) };
    body.datatype = data[24];
    data = gsl::make_span(data.data() + header_offset, data.size() - header_offset);

    std::string key{};
    {
      auto [key_length, remaining] =
        utils::decode_unsigned_leb128<std::size_t>(data, core::utils::leb_128_no_throw{});
      if (remaining.size() < key_length) {
        return errc::network::protocol_error;
      }
      key = { reinterpret_cast<const char*>(remaining.data()), key_length };
      data = gsl::make_span(remaining.data() + key_length, remaining.size() - key_length);
    }

    {
      auto [value_length, remaining] =
        utils::decode_unsigned_leb128<std::size_t>(data, core::utils::leb_128_no_throw{});
      if (remaining.size() < value_length) {
        return errc::network::protocol_error;
      }
      body.value = { remaining.begin(),
                     remaining.begin() + static_cast<std::ptrdiff_t>(value_length) };
      if ((body.datatype & static_cast<std::byte>(protocol::datatype::snappy)) != std::byte{ 0 }) {
        std::string uncompressed;
        if (snappy::Uncompress(
              reinterpret_cast<const char*>(body.value.data()), body.value.size(), &uncompressed)) {
          body.value = core::utils::to_binary(uncompressed);
          body.datatype &= ~static_cast<std::byte>(protocol::datatype::snappy);
        }
      }
      data = gsl::make_span(remaining.data() + value_length, remaining.size() - value_length);
    }

    item_callback(range_scan_item{ std::move(key), std::move(body) });
  } while (!data.empty());
  return {};
}

auto
parse_range_scan_data(gsl::span<std::byte> payload,
                      const std::shared_ptr<mcbp::queue_request>& request,
                      range_scan_item_callback&& items,
                      bool keys_only) -> std::error_code
{
  if (keys_only) {
    return parse_range_scan_keys(payload, request, std::move(items));
  }
  return parse_range_scan_documents(payload, request, std::move(items));
}
} // namespace

class crud_component_impl
{
public:
  crud_component_impl(asio::io_context& io,
                      collections_component collections,
                      std::shared_ptr<retry_strategy> default_retry_strategy)
    : io_{ io }
    , collections_{ std::move(collections) }
    , default_retry_strategy_{ std::move(default_retry_strategy) }
  {
    (void)io_;
  }

  auto range_scan_create(std::uint16_t vbucket_id,
                         const range_scan_create_options& options,
                         range_scan_create_callback&& callback)
    -> tl::expected<std::shared_ptr<pending_operation>, std::error_code>
  {
    auto handler = [cb = std::move(callback),
                    options](const std::shared_ptr<mcbp::queue_response>& response,
                             const std::shared_ptr<mcbp::queue_request>& /* request */,
                             std::error_code error) {
      if (error) {
        return cb({}, error);
      }
      return cb(range_scan_create_result{ response->value_, options.ids_only }, {});
    };

    auto req = std::make_shared<mcbp::queue_request>(protocol::magic::client_request,
                                                     protocol::client_opcode::range_scan_create,
                                                     std::move(handler));

    req->retry_strategy_ =
      options.retry_strategy ? options.retry_strategy : default_retry_strategy_;
    req->datatype_ = static_cast<std::byte>(protocol::datatype::json);
    req->vbucket_ = vbucket_id;
    req->scope_name_ = options.scope_name;
    req->collection_name_ = options.collection_name;
    if (auto [value, ec] = serialize_range_scan_create_options(options); !ec) {
      req->value_ = std::move(value);
    } else {
      return tl::unexpected(ec);
    }

    auto op = collections_.dispatch(req);
    if (!op) {
      return op;
    }

    if (options.timeout != std::chrono::milliseconds::zero()) {
      auto timer = std::make_shared<asio::steady_timer>(io_);
      timer->expires_after(options.timeout);
      timer->async_wait([req](auto error) {
        if (error == asio::error::operation_aborted) {
          return;
        }
        req->cancel(couchbase::errc::common::unambiguous_timeout);
      });
      req->set_deadline(timer);
    }

    return op;
  }

  auto range_scan_continue(const std::vector<std::byte>& scan_uuid,
                           std::uint16_t vbucket_id,
                           const range_scan_continue_options& options,
                           range_scan_item_callback&& item_callback,
                           range_scan_continue_callback&& callback)
    -> tl::expected<std::shared_ptr<pending_operation>, std::error_code>
  {
    if (scan_uuid.size() != 16) {
      return tl::unexpected(errc::common::invalid_argument);
    }
    auto handler = [item_cb = std::move(item_callback), cb = std::move(callback), options](
                     const std::shared_ptr<mcbp::queue_response>& response,
                     const std::shared_ptr<mcbp::queue_request>& request,
                     std::error_code error) mutable {
      if (error) {
        // in case or error code, the request will be automatically canceled
        return cb({}, error);
      }
      if (response->extras_.size() != 4) {
        if (request->internal_cancel()) {
          cb({}, errc::network::protocol_error);
        }
        return;
      }
      const bool ids_only = mcbp::big_endian::read_uint32(response->extras_, 0) == 0;

      if (auto ec = parse_range_scan_data(response->value_, request, std::move(item_cb), ids_only);
          ec) {
        if (request->internal_cancel()) {
          cb({}, ec);
        }
        return;
      }

      const range_scan_continue_result res{
        response->status_code_ == key_value_status_code::range_scan_more,
        response->status_code_ == key_value_status_code::range_scan_complete,
        ids_only,
      };

      if ((res.more || res.complete) && request->internal_cancel()) {
        cb(res, {});
      }
    };

    auto req = std::make_shared<mcbp::queue_request>(protocol::magic::client_request,
                                                     protocol::client_opcode::range_scan_continue,
                                                     std::move(handler));

    req->persistent_ = true;
    req->vbucket_ = vbucket_id;

    if (options.timeout != std::chrono::milliseconds::zero()) {
      auto timer = std::make_shared<asio::steady_timer>(io_);
      timer->expires_after(options.timeout);
      timer->async_wait([req](auto error) {
        if (error == asio::error::operation_aborted) {
          return;
        }
        req->cancel(couchbase::errc::common::unambiguous_timeout);
      });
      req->set_deadline(timer);
    }

    mcbp::buffer_writer buf{ scan_uuid.size() + (sizeof(std::uint32_t) * 3) };
    buf.write(scan_uuid);
    buf.write_uint32(options.batch_item_limit);
    buf.write_uint32(gsl::narrow_cast<std::uint32_t>(options.batch_time_limit.count()));
    buf.write_uint32(options.batch_byte_limit);
    req->extras_ = std::move(buf.store_);

    return collections_.dispatch(req);
  }

  auto range_scan_cancel(std::vector<std::byte> scan_uuid,
                         std::uint16_t vbucket_id,
                         const range_scan_cancel_options& options,
                         range_scan_cancel_callback&& callback)
    -> tl::expected<std::shared_ptr<pending_operation>, std::error_code>
  {
    if (scan_uuid.size() != 16) {
      return tl::unexpected(errc::common::invalid_argument);
    }
    auto handler = [cb = std::move(callback),
                    options](const std::shared_ptr<mcbp::queue_response>& /* response */,
                             const std::shared_ptr<mcbp::queue_request>& /* request */,
                             std::error_code error) mutable {
      cb({}, error);
    };

    auto req = std::make_shared<mcbp::queue_request>(protocol::magic::client_request,
                                                     protocol::client_opcode::range_scan_cancel,
                                                     std::move(handler));

    req->vbucket_ = vbucket_id;
    req->extras_ = std::move(scan_uuid);

    auto op = collections_.dispatch(req);
    if (!op) {
      return op;
    }

    if (options.timeout != std::chrono::milliseconds::zero()) {
      auto timer = std::make_shared<asio::steady_timer>(io_);
      timer->expires_after(options.timeout);
      timer->async_wait([req](auto error) {
        if (error == asio::error::operation_aborted) {
          return;
        }
        req->cancel(couchbase::errc::common::unambiguous_timeout);
      });
      req->set_deadline(timer);
    }

    return op;
  }

private:
  asio::io_context& io_;
  collections_component collections_;
  std::shared_ptr<retry_strategy> default_retry_strategy_;
};

crud_component::crud_component(asio::io_context& io,
                               collections_component collections,
                               std::shared_ptr<retry_strategy> default_retry_strategy)
  : impl_{ std::make_shared<crud_component_impl>(io,
                                                 std::move(collections),
                                                 std::move(default_retry_strategy)) }
{
}

auto
crud_component::range_scan_create(std::uint16_t vbucket_id,
                                  const range_scan_create_options& options,
                                  range_scan_create_callback&& callback)
  -> tl::expected<std::shared_ptr<pending_operation>, std::error_code>
{
  return impl_->range_scan_create(vbucket_id, options, std::move(callback));
}

auto
crud_component::range_scan_continue(const std::vector<std::byte>& scan_uuid,
                                    std::uint16_t vbucket_id,
                                    const range_scan_continue_options& options,
                                    range_scan_item_callback&& item_callback,
                                    range_scan_continue_callback&& callback)
  -> tl::expected<std::shared_ptr<pending_operation>, std::error_code>
{
  return impl_->range_scan_continue(
    scan_uuid, vbucket_id, options, std::move(item_callback), std::move(callback));
}

auto
crud_component::range_scan_cancel(std::vector<std::byte> scan_uuid,
                                  std::uint16_t vbucket_id,
                                  const range_scan_cancel_options& options,
                                  range_scan_cancel_callback&& callback)
  -> tl::expected<std::shared_ptr<pending_operation>, std::error_code>
{
  return impl_->range_scan_cancel(std::move(scan_uuid), vbucket_id, options, std::move(callback));
}
} // namespace couchbase::core
