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

#include "internal/atr_entry.hxx"

#include <cstdint>
#include <functional>
#include <optional>

namespace couchbase::core
{
class cluster;
namespace transactions
{
class active_transaction_record
{
public:
  static void get_atr(
    const core::cluster& cluster,
    const core::document_id& atr_id,
    std::function<void(std::error_code, std::optional<active_transaction_record>)>&& cb);

  static auto get_atr(const core::cluster& cluster,
                      const core::document_id& atr_id) -> std::optional<active_transaction_record>;

  active_transaction_record(core::document_id id, std::uint64_t, std::vector<atr_entry> entries)
    : id_(std::move(id))
    , entries_(std::move(entries))
  {
  }

  [[nodiscard]] auto entries() const -> const std::vector<atr_entry>&
  {
    return entries_;
  }

private:
  core::document_id id_;
  std::vector<atr_entry> entries_;
};

} // namespace transactions
} // namespace couchbase::core
