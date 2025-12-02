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
#pragma once

#include <couchbase/codec/default_json_transcoder.hxx>

#include <gsl/assert>

#include <optional>
#include <vector>

namespace couchbase::core::transactions
{
class transaction_get_multi_result
{
public:
  transaction_get_multi_result() = default;
  ~transaction_get_multi_result() = default;
  transaction_get_multi_result(const transaction_get_multi_result&) = default;
  transaction_get_multi_result(transaction_get_multi_result&&) = default;
  auto operator=(const transaction_get_multi_result&) -> transaction_get_multi_result& = default;
  auto operator=(transaction_get_multi_result&&) -> transaction_get_multi_result& = default;

  explicit transaction_get_multi_result(std::vector<std::optional<codec::encoded_value>> content)
    : content_{ std::move(content) }
  {
  }

  [[nodiscard]] auto content(std::size_t spec_index) const -> const codec::encoded_value&
  {
    Expects(exists(spec_index));
    return content_[spec_index].value();
  }

  [[nodiscard]] auto exists(std::size_t spec_index) const -> bool
  {
    Expects(spec_index < content_.size());
    return content_[spec_index].has_value();
  }

  [[nodiscard]] auto content() const -> const std::vector<std::optional<codec::encoded_value>>&
  {
    return content_;
  }

  [[nodiscard]] auto content() -> std::vector<std::optional<codec::encoded_value>>&&
  {
    return std::move(content_);
  }

private:
  std::vector<std::optional<codec::encoded_value>> content_;
};
} // namespace couchbase::core::transactions
