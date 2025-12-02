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

#include "core/transactions/error_class.hxx"
#include "core/utils/movable_function.hxx"

#include <functional>
#include <optional>
#include <string>

namespace couchbase::core::transactions
{
using error_func3 =
  std::function<void(const std::string&,
                     core::utils::movable_function<void(std::optional<error_class>)>&&)>;
using error_func4 =
  std::function<void(core::utils::movable_function<void(std::optional<error_class>)>&&)>;

/**
 * Hooks purely for testing purposes.  If you're an end-user looking at these for any reason, then
 * please contact us first about your use-case: we are always open to adding good ideas into the
 * transactions library.
 */
struct cleanup_testing_hooks {
  error_func3 before_commit_doc;
  error_func3 before_doc_get;
  error_func3 before_remove_doc_staged_for_removal;
  error_func3 before_remove_doc;
  error_func3 before_atr_get;
  error_func3 before_remove_links;

  error_func4 before_atr_remove;

  error_func4 on_cleanup_docs_completed;
  error_func4 on_cleanup_completed;

  error_func3 client_record_before_create;
  error_func3 client_record_before_get;
  error_func3 client_record_before_update;
  error_func3 client_record_before_remove_client;

  cleanup_testing_hooks();
  // needed for unique_ptr<cleanup_testing_hooks> in transaction_config, with a forward declaration.
  ~cleanup_testing_hooks() = default;
};
} // namespace couchbase::core::transactions
