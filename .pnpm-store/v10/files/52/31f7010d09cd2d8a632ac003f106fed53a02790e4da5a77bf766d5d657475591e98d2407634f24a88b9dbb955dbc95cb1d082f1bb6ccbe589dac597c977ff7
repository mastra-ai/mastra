/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *   Copyright 2024. Couchbase, Inc.
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

#include "error.hxx"

#include "core/error_context/analytics.hxx"
#include "core/error_context/analytics_json.hxx"
#include "core/error_context/http.hxx"
#include "core/error_context/http_json.hxx"
#include "core/error_context/internal_tof_metadata_json.hxx"
#include "core/error_context/key_value_error_context.hxx"
#include "core/error_context/query.hxx"
#include "core/error_context/query_error_context.hxx"
#include "core/error_context/query_json.hxx"
#include "core/error_context/query_public_json.hxx"
#include "core/error_context/search.hxx"
#include "core/error_context/search_json.hxx"
#include "core/error_context/subdocument_error_context.hxx"
#include "core/error_context/subdocument_json.hxx"
#include "core/error_context/transaction_error_context.hxx"
#include "core/error_context/transaction_op_error_context.hxx"
#include "core/impl/internal_error_context.hxx"
#include "core/transactions/exceptions.hxx"
#include "core/transactions/exceptions_fmt.hxx"
#include "core/transactions/internal/exceptions_internal.hxx"

#include <couchbase/error.hxx>
#include <couchbase/error_codes.hxx>
#include <couchbase/error_context.hxx>

#include <spdlog/fmt/bundled/core.h>
#include <tao/json/value.hpp>

#include "core/transactions/internal/exceptions_internal_fmt.hxx"

#include <memory>
#include <optional>
#include <string>
#include <system_error>
#include <utility>
#include <variant>

namespace couchbase
{
error::error(std::error_code ec, std::string message, couchbase::error_context ctx)
  : ec_{ ec }
  , message_{ std::move(message) }
  , ctx_{ std::move(ctx) }
{
}

error::error(std::error_code ec,
             std::string message,
             couchbase::error_context ctx,
             couchbase::error cause)
  : ec_{ ec }
  , message_{ std::move(message) }
  , ctx_{ std::move(ctx) }
  , cause_{ std::make_shared<error>(std::move(cause)) }
{
}

auto
error::ec() const -> std::error_code
{
  return ec_;
}

auto
error::message() const -> const std::string&
{
  return message_;
}

auto
error::ctx() const -> const error_context&
{
  return ctx_;
}

auto
error::cause() const -> std::optional<error>
{
  if (!cause_) {
    return {};
  }

  return *cause_;
}

error::operator bool() const
{
  return ec_.value() != 0;
}

auto
error::operator==(const couchbase::error& other) const -> bool
{
  return ec() == other.ec() && message() == other.message();
}

namespace core::impl
{
auto
make_error(const core::error_context::query& core_ctx) -> error
{
  if (!core_ctx.ec) {
    return {};
  }
  return { core_ctx.ec, {}, internal_error_context::build_error_context(core_ctx) };
}

auto
make_error(const query_error_context& core_ctx) -> error
{
  if (!core_ctx.ec()) {
    return {};
  }
  return { core_ctx.ec(), {}, internal_error_context::build_error_context(core_ctx) };
}

auto
make_error(const core::error_context::search& core_ctx) -> error
{
  if (!core_ctx.ec) {
    return {};
  }
  return { core_ctx.ec, {}, internal_error_context::build_error_context(core_ctx) };
}

auto
make_error(const core::error_context::analytics& core_ctx) -> error
{
  if (!core_ctx.ec) {
    return {};
  }
  return { core_ctx.ec, {}, internal_error_context::build_error_context(core_ctx) };
}

auto
make_error(const core::error_context::http& core_ctx) -> error
{
  if (!core_ctx.ec) {
    return {};
  }
  return { core_ctx.ec, {}, internal_error_context::build_error_context(core_ctx) };
}

auto
make_error(const couchbase::core::key_value_error_context& core_ctx) -> error
{
  if (!core_ctx.ec()) {
    return {};
  }
  return { core_ctx.ec(), {}, internal_error_context::build_error_context(core_ctx) };
}

auto
make_error(const couchbase::core::subdocument_error_context& core_ctx) -> error
{
  if (!core_ctx.ec()) {
    return {};
  }
  return { core_ctx.ec(), {}, internal_error_context::build_error_context(core_ctx) };
}

auto
make_error(const couchbase::core::transaction_error_context& ctx) -> error
{
  return { ctx.ec(), {}, {}, { ctx.cause() } };
}

auto
make_error(const core::transactions::op_exception& exc) -> error
{
  std::optional<error> cause;
  if (std::holds_alternative<key_value_error_context>(exc.ctx().cause())) {
    cause = make_error(std::get<key_value_error_context>(exc.ctx().cause()));
  }
  if (std::holds_alternative<query_error_context>(exc.ctx().cause())) {
    cause = make_error(std::get<query_error_context>(exc.ctx().cause()));
  }

  if (cause.has_value()) {
    return error{
      transaction_op_errc_from_external_exception(exc.cause()),
      exc.what(),
      {},
      cause.value(),
    };
  }

  return error{
    transaction_op_errc_from_external_exception(exc.cause()),
    exc.what(),
    {},
  };
}

auto
make_error(const couchbase::core::transactions::transaction_operation_failed& core_tof)
  -> couchbase::error
{
  return { couchbase::errc::transaction_op::transaction_op_failed,
           core_tof.what(),
           internal_error_context::build_error_context(tao::json::empty_object, core_tof),
           error(transaction_op_errc_from_external_exception(core_tof.cause())) };
}
} // namespace core::impl
} // namespace couchbase
