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

#include "cleanup_testing_hooks.hxx"

namespace couchbase::core::transactions
{
namespace
{
inline void
noop1(const std::string& /*unused*/,
      utils::movable_function<void(std::optional<error_class>)>&& handler)
{
  return handler({});
}

inline void
noop2(utils::movable_function<void(std::optional<error_class>)>&& handler)
{
  return handler({});
}
} // namespace

cleanup_testing_hooks::cleanup_testing_hooks()
  : before_commit_doc{ noop1 }
  , before_doc_get{ noop1 }
  , before_remove_doc_staged_for_removal{ noop1 }
  , before_remove_doc{ noop1 }
  , before_atr_get{ noop1 }
  , before_remove_links{ noop1 }
  , before_atr_remove{ noop2 }
  , on_cleanup_docs_completed{ noop2 }
  , on_cleanup_completed{ noop2 }
  , client_record_before_create{ noop1 }
  , client_record_before_get{ noop1 }
  , client_record_before_update{ noop1 }
  , client_record_before_remove_client{ noop1 }
{
}
} // namespace couchbase::core::transactions
