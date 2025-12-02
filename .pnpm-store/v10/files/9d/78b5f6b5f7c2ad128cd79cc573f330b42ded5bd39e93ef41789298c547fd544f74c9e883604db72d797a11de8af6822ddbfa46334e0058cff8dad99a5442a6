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

#include "attempt_context_testing_hooks.hxx"
#include "core/utils/movable_function.hxx"

namespace couchbase::core::transactions
{
namespace
{
// TODO(CXXCBC-549)
// NOLINTBEGIN(performance-unnecessary-value-param)
inline void
noop1(std::shared_ptr<attempt_context> /* ctx */,
      utils::movable_function<void(std::optional<error_class>)>&& handler)
{
  return handler({});
}

inline void
noop2(std::shared_ptr<attempt_context> /* ctx */,
      const std::string& /* param */,
      utils::movable_function<void(std::optional<error_class>)>&& handler)
{
  return handler({});
}

inline auto
noop3(std::shared_ptr<attempt_context> /* ctx */) -> std::optional<const std::string>
{
  return {};
}

inline auto
noop4(std::shared_ptr<attempt_context> /* ctx */,
      const std::string& /* param1 */,
      std::optional<const std::string> /* param2 */) -> bool
{
  return false;
}
// NOLINTEND(performance-unnecessary-value-param)
} // namespace

attempt_context_testing_hooks::attempt_context_testing_hooks()
  : before_atr_commit{ noop1 }
  , before_atr_commit_ambiguity_resolution{ noop1 }
  , after_atr_commit{ noop1 }
  , before_doc_committed{ noop2 }
  , before_removing_doc_during_staged_insert{ noop2 }
  , before_rollback_delete_inserted{ noop2 }
  , after_doc_committed_before_saving_cas{ noop2 }
  , after_doc_committed{ noop2 }
  , before_staged_insert{ noop2 }
  , before_staged_remove{ noop2 }
  , before_staged_replace{ noop2 }
  , before_doc_removed{ noop2 }
  , before_doc_rolled_back{ noop2 }
  , after_doc_removed_pre_retry{ noop2 }
  , after_doc_removed_post_retry{ noop2 }
  , after_get_complete{ noop2 }
  , after_staged_replace_complete_before_cas_saved{ noop2 }
  , after_staged_replace_complete{ noop2 }
  , after_staged_remove_complete{ noop2 }
  , after_staged_insert_complete{ noop2 }
  , after_rollback_replace_or_remove{ noop2 }
  , after_rollback_delete_inserted{ noop2 }
  , before_check_atr_entry_for_blocking_doc{ noop2 }
  , before_doc_get{ noop2 }
  , before_get_doc_in_exists_during_staged_insert{ noop2 }
  , before_query{ noop2 }
  , after_query{ noop2 }
  , before_remove_staged_insert{ noop2 }
  , after_remove_staged_insert{ noop2 }
  , after_docs_committed{ noop1 }
  , after_docs_removed{ noop1 }
  , after_atr_pending{ noop1 }
  , before_atr_pending{ noop1 }
  , before_atr_complete{ noop1 }
  , before_atr_rolled_back{ noop1 }
  , after_atr_complete{ noop1 }
  , before_get_atr_for_abort{ noop1 }
  , before_atr_aborted{ noop1 }
  , after_atr_aborted{ noop1 }
  , after_atr_rolled_back{ noop1 }
  , random_atr_id_for_vbucket{ noop3 }
  , has_expired_client_side{ noop4 }
{
}
} // namespace couchbase::core::transactions
