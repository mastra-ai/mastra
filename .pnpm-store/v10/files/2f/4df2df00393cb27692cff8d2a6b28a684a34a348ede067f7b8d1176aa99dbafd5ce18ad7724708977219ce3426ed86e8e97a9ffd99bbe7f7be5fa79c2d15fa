/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *   Copyright 2023-Present Couchbase, Inc.
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

#include "internal_search_error_context.hxx"

#include "core/operations/document_search.hxx"

#include <couchbase/retry_reason.hxx>

#include <cstddef>
#include <cstdint>
#include <optional>
#include <set>
#include <system_error>
#include <utility>

namespace couchbase
{
internal_search_error_context::internal_search_error_context(
  internal_search_error_context&& other) noexcept = default;

auto
internal_search_error_context::operator=(internal_search_error_context&& other) noexcept
  -> internal_search_error_context& = default;

internal_search_error_context::internal_search_error_context(
  core::operations::search_response& resp)
  : ctx_{ std::move(resp.ctx) }
  , status_{ resp.status }
  , error_{ resp.error }
{
}

auto
internal_search_error_context::ec() const -> std::error_code
{
  return ctx_.ec;
}

auto
internal_search_error_context::last_dispatched_to() const -> const std::optional<std::string>&
{
  return ctx_.last_dispatched_to;
}

auto
internal_search_error_context::last_dispatched_from() const -> const std::optional<std::string>&
{
  return ctx_.last_dispatched_from;
}

auto
internal_search_error_context::retry_attempts() const -> std::size_t
{
  return ctx_.retry_attempts;
}

auto
internal_search_error_context::retry_reasons() const -> const std::set<retry_reason>&
{
  return ctx_.retry_reasons;
}

auto
internal_search_error_context::retried_because_of(retry_reason reason) const -> bool
{
  return ctx_.retry_reasons.count(reason) > 0;
}

auto
internal_search_error_context::index_name() const -> const std::string&
{
  return ctx_.index_name;
}

auto
internal_search_error_context::client_context_id() const -> const std::string&
{
  return ctx_.client_context_id;
}

auto
internal_search_error_context::query() const -> const std::string&
{
  return ctx_.query;
}

auto
internal_search_error_context::parameters() const -> const std::optional<std::string>&
{
  return ctx_.parameters;
}

auto
internal_search_error_context::method() const -> const std::string&
{
  return ctx_.method;
}

auto
internal_search_error_context::path() const -> const std::string&
{
  return ctx_.path;
}

auto
internal_search_error_context::http_status() const -> std::uint32_t
{
  return ctx_.http_status;
}

auto
internal_search_error_context::http_body() const -> const std::string&
{
  return ctx_.http_body;
}

auto
internal_search_error_context::hostname() const -> const std::string&
{
  return ctx_.hostname;
}

auto
internal_search_error_context::port() const -> std::uint16_t
{
  return ctx_.port;
}

auto
internal_search_error_context::error() const -> const std::string&
{
  return error_;
}

auto
internal_search_error_context::status() const -> const std::string&
{
  return status_;
}
} // namespace couchbase
