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
class attempt_context;

using error_func1 =
  std::function<void(std::shared_ptr<attempt_context>,
                     core::utils::movable_function<void(std::optional<error_class>)>&&)>;
using error_func2 =
  std::function<void(std::shared_ptr<attempt_context>,
                     const std::string&,
                     core::utils::movable_function<void(std::optional<error_class>)>&&)>;

static const std::string STAGE_ROLLBACK = "rollback";
static const std::string STAGE_GET = "get";
static const std::string STAGE_INSERT = "insert";
static const std::string STAGE_REPLACE = "replace";
static const std::string STAGE_REMOVE = "remove";
static const std::string STAGE_BEFORE_COMMIT = "commit";
static const std::string STAGE_ABORT_GET_ATR = "abortGetAtr";
static const std::string STAGE_ROLLBACK_DOC = "rollbackDoc";
static const std::string STAGE_DELETE_INSERTED = "deleteInserted";
static const std::string STAGE_CREATE_STAGED_INSERT = "createdStagedInsert";
static const std::string STAGE_REMOVE_DOC = "removeDoc";
static const std::string STAGE_COMMIT_DOC = "commitDoc";
static const std::string STAGE_BEFORE_RETRY = "beforeRetry";
static const std::string STAGE_REMOVE_STAGED_INSERT = "removeStagedInsert";

static const std::string STAGE_ATR_COMMIT = "atrCommit";
static const std::string STAGE_ATR_COMMIT_AMBIGUITY_RESOLUTION = "atrCommitAmbiguityResolution";
static const std::string STAGE_ATR_ABORT = "atrAbort";
static const std::string STAGE_ATR_ROLLBACK_COMPLETE = "atrRollbackComplete";
static const std::string STAGE_ATR_PENDING = "atrPending";
static const std::string STAGE_ATR_COMPLETE = "atrComplete";

static const std::string STAGE_QUERY = "query";
static const std::string STAGE_QUERY_BEGIN_WORK = "queryBeginWork";
static const std::string STAGE_QUERY_COMMIT = "queryCommit";
static const std::string STAGE_QUERY_ROLLBACK = "queryRollback";
static const std::string STAGE_QUERY_KV_GET = "queryKvGet";
static const std::string STAGE_QUERY_KV_REPLACE = "queryKvReplace";
static const std::string STAGE_QUERY_KV_REMOVE = "queryKvRemove";
static const std::string STAGE_QUERY_KV_INSERT = "queryKvInsert";

/**
 * Hooks purely for testing purposes.  If you're an end-user looking at these for any reason, then
 * please contact us first about your use-case: we are always open to adding good ideas into the
 * transactions library.
 */
struct attempt_context_testing_hooks {
  error_func1 before_atr_commit;
  error_func1 before_atr_commit_ambiguity_resolution;
  error_func1 after_atr_commit;
  error_func2 before_doc_committed;
  error_func2 before_removing_doc_during_staged_insert;
  error_func2 before_rollback_delete_inserted;
  error_func2 after_doc_committed_before_saving_cas;
  error_func2 after_doc_committed;
  error_func2 before_staged_insert;
  error_func2 before_staged_remove;
  error_func2 before_staged_replace;
  error_func2 before_doc_removed;
  error_func2 before_doc_rolled_back;
  error_func2 after_doc_removed_pre_retry;
  error_func2 after_doc_removed_post_retry;
  error_func2 after_get_complete;
  error_func2 after_staged_replace_complete_before_cas_saved;
  error_func2 after_staged_replace_complete;
  error_func2 after_staged_remove_complete;
  error_func2 after_staged_insert_complete;
  error_func2 after_rollback_replace_or_remove;
  error_func2 after_rollback_delete_inserted;
  error_func2 before_check_atr_entry_for_blocking_doc;
  error_func2 before_doc_get;
  error_func2 before_get_doc_in_exists_during_staged_insert;
  error_func2 before_query;
  error_func2 after_query;
  error_func2 before_remove_staged_insert;
  error_func2 after_remove_staged_insert;

  error_func1 after_docs_committed;
  error_func1 after_docs_removed;
  error_func1 after_atr_pending;
  error_func1 before_atr_pending;
  error_func1 before_atr_complete;
  error_func1 before_atr_rolled_back;
  error_func1 after_atr_complete;
  error_func1 before_get_atr_for_abort;
  error_func1 before_atr_aborted;
  error_func1 after_atr_aborted;
  error_func1 after_atr_rolled_back;

  std::function<std::optional<const std::string>(std::shared_ptr<attempt_context>)>
    random_atr_id_for_vbucket;

  std::function<
    bool(std::shared_ptr<attempt_context>, const std::string&, std::optional<const std::string>)>
    has_expired_client_side;

  attempt_context_testing_hooks();

  // needed for unique_ptr<attempt_context_testing_hooks> in transaction_config, with a forward
  // declaration.
  ~attempt_context_testing_hooks() = default;
};
} // namespace couchbase::core::transactions
