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

#include "attempt_context_impl.hxx"
#include "internal/utils.hxx"
#include "transaction_get_result.hxx"
#include "uid_generator.hxx"

#include <couchbase/codec/encoded_value.hxx>

#include <mutex>
#include <string>
#include <vector>

namespace couchbase::core::transactions
{
enum class staged_mutation_type {
  INSERT,
  REMOVE,
  REPLACE
};

class staged_mutation
{
public:
  staged_mutation(staged_mutation_type type,
                  document_id doc_id,
                  cas cas,
                  std::optional<codec::binary> staged_content,
                  std::uint32_t staged_flags,
                  std::uint32_t current_user_flags,
                  std::optional<document_metadata> doc_metadata,
                  std::string operation_id = uid_generator::next());

  ~staged_mutation() = default;
  staged_mutation(const staged_mutation&) = delete;
  staged_mutation(staged_mutation&&) = default;
  auto operator=(const staged_mutation&) -> staged_mutation& = delete;
  auto operator=(staged_mutation&&) -> staged_mutation& = default;

  [[nodiscard]] auto id() const -> const document_id&;
  [[nodiscard]] auto cas() const -> const couchbase::cas&;
  [[nodiscard]] auto type() const -> const staged_mutation_type&;
  [[nodiscard]] auto is_staged_binary() const -> bool;
  [[nodiscard]] auto staged_content() const -> const std::optional<codec::binary>&;
  [[nodiscard]] auto staged_flags() const -> std::uint32_t;
  [[nodiscard]] auto current_user_flags() const -> std::uint32_t;
  [[nodiscard]] auto doc_metadata() const -> const std::optional<document_metadata>&;
  [[nodiscard]] auto operation_id() const -> const std::string&;
  [[nodiscard]] auto type_as_string() const -> std::string;

  void cas(couchbase::cas cas);

private:
  staged_mutation_type type_;
  document_id doc_id_;
  couchbase::cas cas_;
  std::optional<codec::binary> staged_content_;
  std::uint32_t staged_flags_;
  std::uint32_t current_user_flags_;
  std::optional<document_metadata> doc_metadata_;
  std::string operation_id_;
};

struct unstaging_state {
  static constexpr std::size_t MAX_PARALLELISM{ 1000 };

  std::shared_ptr<attempt_context_impl> ctx_;
  std::mutex mutex_{};
  std::condition_variable cv_{};
  std::atomic_size_t in_flight_count_{ 0 };
  bool abort_{ false };

  auto wait_until_unstage_possible() -> bool;
  void notify_unstage_complete();
  void notify_unstage_error();
};

class staged_mutation_queue
{
private:
  std::mutex mutex_;
  std::vector<staged_mutation> queue_;

  using client_error_handler = utils::movable_function<void(const std::optional<client_error>&)>;

  static void validate_rollback_remove_or_replace_result(
    const std::shared_ptr<attempt_context_impl>& ctx,
    result& res,
    const staged_mutation& item,
    client_error_handler&& handler);
  static void validate_rollback_insert_result(const std::shared_ptr<attempt_context_impl>& ctx,
                                              result& res,
                                              const staged_mutation& item,
                                              client_error_handler&& handler);
  static void validate_commit_doc_result(const std::shared_ptr<attempt_context_impl>& ctx,
                                         result& res,
                                         staged_mutation& item,
                                         client_error_handler&& handler);
  static void validate_remove_doc_result(const std::shared_ptr<attempt_context_impl>& ctx,
                                         result& res,
                                         const staged_mutation& item,
                                         client_error_handler&& handler);

  void handle_commit_doc_error(const client_error& e,
                               const std::shared_ptr<attempt_context_impl>& ctx,
                               staged_mutation& item,
                               async_constant_delay& delay,
                               bool ambiguity_resolution_mode,
                               bool cas_zero_mode,
                               utils::movable_function<void(std::exception_ptr)> callback);
  void handle_remove_doc_error(const client_error& e,
                               const std::shared_ptr<attempt_context_impl>& ctx,
                               const staged_mutation& item,
                               async_constant_delay& delay,
                               utils::movable_function<void(std::exception_ptr)> callback);
  void handle_rollback_insert_error(const client_error& e,
                                    const std::shared_ptr<attempt_context_impl>& ctx,
                                    const staged_mutation& item,
                                    async_exp_delay& delay,
                                    utils::movable_function<void(std::exception_ptr)> callback);
  void handle_rollback_remove_or_replace_error(
    const client_error& e,
    const std::shared_ptr<attempt_context_impl>& ctx,
    const staged_mutation& item,
    async_exp_delay& delay,
    utils::movable_function<void(std::exception_ptr)> callback);

  void commit_doc(const std::shared_ptr<attempt_context_impl>& ctx,
                  staged_mutation& item,
                  async_constant_delay& delay,
                  utils::movable_function<void(std::exception_ptr)> callback,
                  bool ambiguity_resolution_mode = false,
                  bool cas_zero_mode = false);
  void remove_doc(const std::shared_ptr<attempt_context_impl>& ctx,
                  const staged_mutation& item,
                  async_constant_delay& delay,
                  utils::movable_function<void(std::exception_ptr)> callback);
  void rollback_insert(const std::shared_ptr<attempt_context_impl>& ctx,
                       const staged_mutation& item,
                       async_exp_delay& delay,
                       utils::movable_function<void(std::exception_ptr)> callback);
  void rollback_remove_or_replace(const std::shared_ptr<attempt_context_impl>& ctx,
                                  const staged_mutation& item,
                                  async_exp_delay& delay,
                                  utils::movable_function<void(std::exception_ptr)> callback);

public:
  auto empty() -> bool;
  void add(staged_mutation&& mutation);
  void extract_to(const std::string& prefix, core::operations::mutate_in_request& req);
  void commit(const std::shared_ptr<attempt_context_impl>& ctx);
  void rollback(const std::shared_ptr<attempt_context_impl>& ctx);
  void iterate(const std::function<void(staged_mutation&)>&);
  void remove_any(const core::document_id&);

  auto find_any(const core::document_id& id) -> staged_mutation*;
  auto find_replace(const core::document_id& id) -> staged_mutation*;
  auto find_insert(const core::document_id& id) -> staged_mutation*;
  auto find_remove(const core::document_id& id) -> staged_mutation*;
};
} // namespace couchbase::core::transactions
