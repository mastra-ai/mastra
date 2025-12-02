/*
 *     Copyright 2021-Present Couchbase, Inc.
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

#include "result.hxx"

#include "core/operations/document_lookup_in.hxx"
#include "core/operations/document_mutate_in.hxx"

namespace couchbase::core::transactions
{
auto
result::strerror() const -> std::string
{
  static const std::string success("success");
  if (ec) {
    return ec.message();
  }
  return success;
}

auto
result::is_success() const -> bool
{
  return !ec;
}

auto
result::subdoc_status() const -> subdoc_result::status_type
{
  auto it = std::find_if(values.begin(), values.end(), [](const subdoc_result& res) {
    return res.status != subdoc_result::status_type::success;
  });
  if (it != values.end()) {
    return it->status;
  }
  return subdoc_result::status_type::success;
}

auto
result::create_from_subdoc_response(const core::operations::lookup_in_response& resp) -> result
{
  result res{};
  res.ec = resp.ctx.ec();
  res.cas = resp.cas.value();
  res.key = resp.ctx.id();
  res.is_deleted = resp.deleted;
  for (const auto& field : resp.fields) {
    res.values.emplace_back(field.value, static_cast<std::uint32_t>(field.status));
  }
  return res;
}

auto
result::create_from_subdoc_response(const core::operations::mutate_in_response& resp) -> result
{
  result res{};
  res.ec = resp.ctx.ec();
  res.cas = resp.cas.value();
  res.key = resp.ctx.id();
  res.is_deleted = resp.deleted;

  for (const auto& field : resp.fields) {
    res.values.emplace_back(field.value, static_cast<std::uint32_t>(field.status));
  }
  return res;
}
} // namespace couchbase::core::transactions
