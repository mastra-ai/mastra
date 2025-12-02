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

#include "core/document_id.hxx"
#include "core/utils/movable_function.hxx"
#include "transaction_get_multi_mode.hxx"
#include "transaction_get_multi_replicas_from_preferred_server_group_mode.hxx"
#include "transaction_get_multi_replicas_from_preferred_server_group_result.hxx"
#include "transaction_get_multi_result.hxx"

#include <memory>
#include <vector>

namespace couchbase::core::transactions
{
class attempt_context_impl;
class get_multi_operation;

class get_multi_orchestrator : public std::enable_shared_from_this<get_multi_orchestrator>
{
public:
  get_multi_orchestrator(std::shared_ptr<attempt_context_impl> attempt,
                         std::vector<core::document_id> ids);
  get_multi_orchestrator(const get_multi_orchestrator&) = default;
  get_multi_orchestrator(get_multi_orchestrator&&) = default;
  ~get_multi_orchestrator() = default;
  auto operator=(const get_multi_orchestrator&) -> get_multi_orchestrator& = default;
  auto operator=(get_multi_orchestrator&&) -> get_multi_orchestrator& = default;

  void get_multi(transaction_get_multi_mode mode,
                 utils::movable_function<void(std::exception_ptr,
                                              std::optional<transaction_get_multi_result>)>&& cb);

  void get_multi_replicas_from_preferred_server_group(
    transaction_get_multi_replicas_from_preferred_server_group_mode mode,
    utils::movable_function<
      void(std::exception_ptr,
           std::optional<transaction_get_multi_replicas_from_preferred_server_group_result>)>&& cb);

private:
  std::shared_ptr<attempt_context_impl> attempt_;
  std::vector<core::document_id> ids_;

  std::shared_ptr<get_multi_operation> operation_{ nullptr };
};

} // namespace couchbase::core::transactions
