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

#pragma once

#include "core/operations/document_search.hxx"

#include <couchbase/search_result.hxx>

namespace couchbase
{
class internal_search_error_context
{
public:
  explicit internal_search_error_context(core::operations::search_response& resp);
  internal_search_error_context(internal_search_error_context&& other) noexcept;
  auto operator=(internal_search_error_context&& other) noexcept -> internal_search_error_context&;
  internal_search_error_context(const internal_search_error_context& other) = delete;
  auto operator=(const internal_search_error_context& other) -> internal_search_error_context& =
                                                                  delete;

  [[nodiscard]] auto ec() const -> std::error_code;
  [[nodiscard]] auto last_dispatched_to() const -> const std::optional<std::string>&;
  [[nodiscard]] auto last_dispatched_from() const -> const std::optional<std::string>&;
  [[nodiscard]] auto retry_attempts() const -> std::size_t;
  [[nodiscard]] auto retry_reasons() const -> const std::set<retry_reason>&;
  [[nodiscard]] auto retried_because_of(retry_reason reason) const -> bool;

  [[nodiscard]] auto index_name() const -> const std::string&;
  [[nodiscard]] auto client_context_id() const -> const std::string&;
  [[nodiscard]] auto query() const -> const std::string&;
  [[nodiscard]] auto parameters() const -> const std::optional<std::string>&;
  [[nodiscard]] auto method() const -> const std::string&;
  [[nodiscard]] auto path() const -> const std::string&;
  [[nodiscard]] auto http_status() const -> std::uint32_t;
  [[nodiscard]] auto http_body() const -> const std::string&;
  [[nodiscard]] auto hostname() const -> const std::string&;
  [[nodiscard]] auto port() const -> std::uint16_t;
  [[nodiscard]] auto error() const -> const std::string&;
  [[nodiscard]] auto status() const -> const std::string&;

private:
  core::error_context::search ctx_;
  std::string status_{};
  std::string error_{};
};

} // namespace couchbase
