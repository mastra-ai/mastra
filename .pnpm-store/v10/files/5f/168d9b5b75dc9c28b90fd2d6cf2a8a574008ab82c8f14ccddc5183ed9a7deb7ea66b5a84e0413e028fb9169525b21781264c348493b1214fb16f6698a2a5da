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

#include "active_transaction_record.hxx"
#include "attempt_context_impl.hxx"
#include "cleanup_testing_hooks.hxx"
#include "durability_level.hxx"
#include "forward_compat.hxx"

#include "core/operations.hxx"
#include "core/transactions.hxx"
#include "internal/atr_cleanup_entry.hxx"
#include "internal/doc_record_fmt.hxx"
#include "internal/exceptions_internal.hxx"
#include "internal/exceptions_internal_fmt.hxx"
#include "internal/logging.hxx"
#include "internal/transaction_context.hxx"
#include "internal/transactions_cleanup.hxx"
#include "internal/utils.hxx"
#include "result.hxx"
#include "result_fmt.hxx"

#include <optional>
#include <utility>

namespace couchbase::core::transactions
{

// NOTE: priority queue outputs largest to smallest - since we want the least
// recent statr time first, this returns true if lhs > rhs
auto
compare_atr_entries::operator()(atr_cleanup_entry& lhs, atr_cleanup_entry& rhs) -> bool
{
  return lhs.min_start_time_ > rhs.min_start_time_;
}
// wait a bit after an attempt is expired before cleaning it.
const uint32_t atr_cleanup_entry::safety_margin_ms_ = 1500;

atr_cleanup_entry::atr_cleanup_entry(core::document_id atr_id,
                                     std::string attempt_id,
                                     const transactions_cleanup& cleanup)
  : atr_id_(std::move(atr_id))
  , attempt_id_(std::move(attempt_id))
  , check_if_expired_(false)
  , cleanup_(&cleanup)
  , atr_entry_(nullptr)
{
}

atr_cleanup_entry::atr_cleanup_entry(const atr_entry& entry,
                                     core::document_id atr_id,
                                     const transactions_cleanup& cleanup,
                                     bool check_if_expired)
  : atr_id_(std::move(atr_id))
  , attempt_id_(entry.attempt_id())
  , check_if_expired_(check_if_expired)
  , cleanup_(&cleanup)
  , atr_entry_(&entry)
{
}

atr_cleanup_entry::atr_cleanup_entry(const std::shared_ptr<attempt_context>& ctx)
  : min_start_time_(std::chrono::steady_clock::now())
  , check_if_expired_(false)
  , atr_entry_(nullptr)
{
  // NOTE: we create these entries externally, in fit_performer tests, hence the
  // use of attempt_context rather than attempt_context_impl
  auto ctx_impl = std::dynamic_pointer_cast<attempt_context_impl>(ctx);
  Expects(ctx_impl != nullptr);
  if (auto atr_id = ctx_impl->atr_id_; atr_id.has_value()) {
    atr_id_ = {
      atr_id->bucket(),
      atr_id->scope(),
      atr_id->collection(),
      atr_id->key(),
    };
  }
  attempt_id_ = ctx_impl->id();
  cleanup_ = &ctx_impl->overall()->cleanup();
}

void
atr_cleanup_entry::clean(transactions_cleanup_attempt* result)
{
  CB_ATTEMPT_CLEANUP_LOG_TRACE("cleaning {}", *this);
  // get atr entry if needed
  const atr_entry entry;
  if (nullptr == atr_entry_) {
    auto atr = active_transaction_record::get_atr(cleanup_->cluster_ref(), atr_id_);
    if (atr) {
      // now get the specific attempt
      auto it = std::find_if(atr->entries().begin(), atr->entries().end(), [&](const atr_entry& e) {
        return e.attempt_id() == attempt_id_;
      });
      if (it != atr->entries().end()) {
        atr_entry_ = &(*it);
        return check_atr_and_cleanup(result);
      }
      CB_ATTEMPT_CLEANUP_LOG_TRACE("could not find attempt {}, nothing to clean", attempt_id_);
      return;
    }
    CB_ATTEMPT_CLEANUP_LOG_TRACE("could not find atr {}, nothing to clean", atr_id_);
    return;
  }
  check_atr_and_cleanup(result);
}

void
atr_cleanup_entry::check_atr_and_cleanup(transactions_cleanup_attempt* result)
{
  // ExtStoreDurability: this is the first point where we're guaranteed to have the ATR entry
  auto durability_level_raw = atr_entry_->durability_level();
  auto durability_level = cleanup_->config().level;
  if (durability_level_raw.has_value()) {
    durability_level = store_string_to_durability_level(durability_level_raw.value());
  }
  if (check_if_expired_ && !atr_entry_->has_expired(safety_margin_ms_)) {
    CB_ATTEMPT_CLEANUP_LOG_TRACE("not expired, nothing to clean");
    return;
  }
  if (result != nullptr) {
    result->state(atr_entry_->state());
  }
  auto err =
    check_forward_compat(forward_compat_stage::CLEANUP_ENTRY, atr_entry_->forward_compat());
  if (err) {
    throw *err;
  }
  cleanup_docs(durability_level);
  auto ec = wait_for_hook([this](auto handler) {
    return cleanup_->config().cleanup_hooks->on_cleanup_docs_completed(std::move(handler));
  });
  if (ec) {
    throw client_error(*ec, "on_cleanup_docs_completed hook threw error");
  }
  cleanup_entry(durability_level);
  ec = wait_for_hook([this](auto handler) {
    return cleanup_->config().cleanup_hooks->on_cleanup_completed(std::move(handler));
  });
  if (ec) {
    throw client_error(*ec, "on_cleanup_completed hook threw error");
  }
}

void
atr_cleanup_entry::cleanup_docs(durability_level dl)
{
  switch (atr_entry_->state()) {
    case attempt_state::COMMITTED:
      commit_docs(atr_entry_->inserted_ids(), dl);
      commit_docs(atr_entry_->replaced_ids(), dl);
      remove_docs_staged_for_removal(atr_entry_->removed_ids(), dl);
      break;
    // half-finished commit
    case attempt_state::ABORTED:
      // half finished rollback
      remove_docs(atr_entry_->inserted_ids(), dl);
      remove_txn_links(atr_entry_->replaced_ids(), dl);
      remove_txn_links(atr_entry_->removed_ids(), dl);
      break;
    default:
      CB_ATTEMPT_CLEANUP_LOG_TRACE("attempt in {}, nothing to do in cleanup_docs",
                                   attempt_state_name(atr_entry_->state()));
  }
}

void
atr_cleanup_entry::do_per_doc(const std::vector<doc_record>& docs,
                              bool require_crc_to_match,
                              const std::function<void(transaction_get_result&, bool)>& call)
{
  for (const auto& dr : docs) {
    try {
      core::operations::lookup_in_request req{ dr.document_id() };
      req.specs =
        lookup_in_specs{
          lookup_in_specs::get("txn.id").xattr(),
          lookup_in_specs::get("txn.atr").xattr(),
          lookup_in_specs::get("txn.op.type").xattr(),
          lookup_in_specs::get("txn.op.stgd").xattr(),
          lookup_in_specs::get("txn.op.crc32").xattr(),
          lookup_in_specs::get("txn.restore").xattr(),
          lookup_in_specs::get("txn.fc").xattr(),
          lookup_in_specs::get(subdoc::lookup_in_macro::document).xattr(),
          lookup_in_specs::get("txn.op.bin").xattr().binary(),
          lookup_in_specs::get("txn.aux").xattr(),
          lookup_in_specs::get(""),
        }
          .specs();
      req.access_deleted = true;
      // now a blocking lookup_in...
      auto barrier = std::make_shared<std::promise<core::operations::lookup_in_response>>();
      cleanup_->cluster_ref().execute(req, [barrier](core::operations::lookup_in_response resp) {
        barrier->set_value(std::move(resp));
      });
      auto f = barrier->get_future();
      auto res = f.get();

      if (res.ctx.ec() || res.fields.empty()) {
        CB_ATTEMPT_CLEANUP_LOG_TRACE("cannot create a transaction document for {}, ec={}, ignoring",
                                     dr.document_id(),
                                     res.ctx.ec().message());
        continue;
      }
      auto doc = transaction_get_result::create_from(res);
      // now let's decide if we call the function or not
      if (!doc.links().is_document_in_transaction() || !doc.links().has_staged_write()) {
        CB_ATTEMPT_CLEANUP_LOG_TRACE("document {} has no staged content - assuming it was "
                                     "committed and skipping",
                                     dr.id());
        continue;
      }
      if (doc.links().staged_attempt_id() != attempt_id_) {
        CB_ATTEMPT_CLEANUP_LOG_TRACE("document {} staged for different attempt {}, skipping",
                                     dr.id(),
                                     doc.links().staged_attempt_id().value_or("<none>)"));
        continue;
      }
      if (require_crc_to_match) {
        if (const auto& metadata = doc.metadata(); metadata.has_value()) {
          if (!metadata->crc32() || !doc.links().crc32_of_staging() ||
              doc.links().crc32_of_staging() != metadata->crc32()) {
            CB_ATTEMPT_CLEANUP_LOG_TRACE(
              "document {} crc32 {} doesn't match staged value {}, skipping",
              dr.id(),
              metadata->crc32().value_or("<none>"),
              doc.links().crc32_of_staging().value_or("<none>"));
            continue;
          }
        }
      }
      call(doc, res.deleted);
    } catch (const client_error& e) {
      const error_class ec = e.ec();
      switch (ec) {
        case FAIL_DOC_NOT_FOUND:
          CB_ATTEMPT_CLEANUP_LOG_ERROR("document {} not found - ignoring ", dr);
          break;
        default:
          CB_ATTEMPT_CLEANUP_LOG_ERROR("got error \"{}\", not ignoring this", e.what());
          throw;
      }
    }
  }
}

void
atr_cleanup_entry::commit_docs(std::optional<std::vector<doc_record>> docs, durability_level dl)
{
  if (docs) {
    do_per_doc(*docs, true, [&](transaction_get_result& doc, bool) {
      if (doc.links().has_staged_content()) {
        auto content = doc.links().staged_content_json_or_binary();
        auto ec = wait_for_hook([this, key = doc.id().key()](auto handler) {
          return cleanup_->config().cleanup_hooks->before_commit_doc(key, std::move(handler));
        });
        if (ec) {
          throw client_error(*ec, "before_commit_doc hook threw error");
        }
        if (doc.links().is_deleted()) {
          core::operations::insert_request req{ doc.id(), content.data };
          req.flags = content.flags;
          auto barrier = std::make_shared<std::promise<result>>();
          auto f = barrier->get_future();
          cleanup_->cluster_ref().execute(wrap_durable_request(req, dl),
                                          [barrier](const core::operations::insert_response& resp) {
                                            barrier->set_value(
                                              result::create_from_mutation_response(resp));
                                          });
          wrap_operation_future(f);
        } else {
          core::operations::mutate_in_request req{ doc.id() };
          req.specs =
            couchbase::mutate_in_specs{
              couchbase::mutate_in_specs::remove(TRANSACTION_INTERFACE_PREFIX_ONLY).xattr(),
              couchbase::mutate_in_specs::replace_raw({}, content.data),
            }
              .specs();
          req.cas = doc.cas();
          req.store_semantics = couchbase::store_semantics::replace;
          req.flags = content.flags;
          wrap_durable_request(req, dl);
          auto barrier = std::make_shared<std::promise<result>>();
          auto f = barrier->get_future();
          cleanup_->cluster_ref().execute(
            req, [barrier](const core::operations::mutate_in_response& resp) {
              barrier->set_value(result::create_from_subdoc_response(resp));
            });
          wrap_operation_future(f);
        }
        CB_ATTEMPT_CLEANUP_LOG_TRACE("commit_docs replaced content of doc {} with {}",
                                     doc.id(),
                                     utils::to_string(content.data));
      } else {
        CB_ATTEMPT_CLEANUP_LOG_TRACE("commit_docs skipping document {}, no staged content",
                                     doc.id());
      }
    });
  }
}
void
atr_cleanup_entry::remove_docs(std::optional<std::vector<doc_record>> docs, durability_level dl)
{
  if (docs) {
    do_per_doc(*docs, true, [&](transaction_get_result& doc, bool is_deleted) {
      auto ec = wait_for_hook([this, key = doc.id().key()](auto handler) mutable {
        return cleanup_->config().cleanup_hooks->before_remove_doc(key, std::move(handler));
      });
      if (ec) {
        throw client_error(*ec, "before_remove_doc hook threw error");
      }
      if (is_deleted) {
        core::operations::mutate_in_request req{ doc.id() };
        req.specs =
          couchbase::mutate_in_specs{
            couchbase::mutate_in_specs::remove(TRANSACTION_INTERFACE_PREFIX_ONLY).xattr(),
          }
            .specs();
        req.cas = doc.cas();
        req.flags = doc.content().flags;
        req.access_deleted = true;
        wrap_durable_request(req, dl);
        auto barrier = std::make_shared<std::promise<result>>();
        auto f = barrier->get_future();
        cleanup_->cluster_ref().execute(
          req, [barrier](const core::operations::mutate_in_response& resp) {
            barrier->set_value(result::create_from_subdoc_response(resp));
          });
        wrap_operation_future(f);
      } else {
        core::operations::remove_request req{ doc.id() };
        req.cas = doc.cas();
        wrap_durable_request(req, dl);
        auto barrier = std::make_shared<std::promise<result>>();
        auto f = barrier->get_future();
        cleanup_->cluster_ref().execute(
          req, [barrier](const core::operations::remove_response& resp) {
            barrier->set_value(result::create_from_mutation_response(resp));
          });
        wrap_operation_future(f);
      }
      CB_ATTEMPT_CLEANUP_LOG_TRACE("remove_docs removed doc {}", doc.id());
    });
  }
}

void
atr_cleanup_entry::remove_docs_staged_for_removal(std::optional<std::vector<doc_record>> docs,
                                                  durability_level dl)
{
  if (docs) {
    do_per_doc(*docs, true, [&](transaction_get_result& doc, bool) {
      if (doc.links().is_document_being_removed()) {
        auto ec = wait_for_hook([this, key = doc.id().key()](auto handler) mutable {
          return cleanup_->config().cleanup_hooks->before_remove_doc_staged_for_removal(
            key, std::move(handler));
        });
        if (ec) {
          throw client_error(*ec, "before_remove_doc_staged_for_removal hook threw error");
        }
        core::operations::remove_request req{ doc.id() };
        req.cas = doc.cas();
        wrap_durable_request(req, dl);
        auto barrier = std::make_shared<std::promise<result>>();
        auto f = barrier->get_future();
        cleanup_->cluster_ref().execute(
          req, [barrier](const core::operations::remove_response& resp) {
            barrier->set_value(result::create_from_mutation_response(resp));
          });
        wrap_operation_future(f);
        CB_ATTEMPT_CLEANUP_LOG_TRACE("remove_docs_staged_for_removal removed doc {}", doc.id());
      } else {
        CB_ATTEMPT_CLEANUP_LOG_TRACE("remove_docs_staged_for_removal found document {} not "
                                     "marked for removal, skipping",
                                     doc.id());
      }
    });
  }
}

void
atr_cleanup_entry::remove_txn_links(std::optional<std::vector<doc_record>> docs,
                                    durability_level dl)
{
  if (docs) {
    do_per_doc(*docs, false, [&](transaction_get_result& doc, bool) {
      auto ec = wait_for_hook([this, key = doc.id().key()](auto handler) mutable {
        return cleanup_->config().cleanup_hooks->before_remove_links(key, std::move(handler));
      });
      if (ec) {
        throw client_error(*ec, "before_remove_links hook threw error");
      }
      core::operations::mutate_in_request req{ doc.id() };
      req.specs =
        couchbase::mutate_in_specs{
          couchbase::mutate_in_specs::remove(TRANSACTION_INTERFACE_PREFIX_ONLY).xattr(),
        }
          .specs();
      req.access_deleted = true;
      req.cas = doc.cas();
      req.flags = doc.content().flags;
      wrap_durable_request(req, dl);
      auto barrier = std::make_shared<std::promise<result>>();
      auto f = barrier->get_future();
      cleanup_->cluster_ref().execute(
        req, [barrier](const core::operations::mutate_in_response& resp) {
          barrier->set_value(result::create_from_subdoc_response(resp));
        });
      wrap_operation_future(f);
      CB_ATTEMPT_CLEANUP_LOG_TRACE("remove_txn_links removed links for doc {}", doc.id());
    });
  }
}

void
atr_cleanup_entry::cleanup_entry(durability_level dl)
{
  try {
    auto ec = wait_for_hook([this](auto handler) {
      return cleanup_->config().cleanup_hooks->before_atr_remove(std::move(handler));
    });
    if (ec) {
      throw client_error(*ec, "before_atr_remove hook threw error");
    }
    core::operations::mutate_in_request req{ atr_id_ };
    couchbase::mutate_in_specs mut_specs;
    if (atr_entry_->state() == attempt_state::PENDING) {
      mut_specs.push_back(couchbase::mutate_in_specs::insert(
                            "attempts." + atr_entry_->attempt_id() + ".p", tao::json::empty_object)
                            .xattr());
    }
    mut_specs.push_back(
      couchbase::mutate_in_specs::remove("attempts." + atr_entry_->attempt_id()).xattr());
    req.specs = mut_specs.specs();
    wrap_durable_request(req, dl);
    auto barrier = std::make_shared<std::promise<result>>();
    auto f = barrier->get_future();
    cleanup_->cluster_ref().execute(req,
                                    [barrier](const core::operations::mutate_in_response& resp) {
                                      barrier->set_value(result::create_from_subdoc_response(resp));
                                    });
    wrap_operation_future(f);
    CB_ATTEMPT_CLEANUP_LOG_TRACE("successfully removed attempt {}", attempt_id_);
  } catch (const client_error& e) {
    error_class ec = e.ec();
    switch (ec) {
      case FAIL_PATH_NOT_FOUND:
        CB_ATTEMPT_CLEANUP_LOG_TRACE(
          "found attempt {} has also inserted 'p' field indicating collision with main algo",
          attempt_id_);
        return;
      default:
        CB_ATTEMPT_CLEANUP_LOG_ERROR(
          "cleanup couldn't remove attempt {} due to {} {}", attempt_id_, ec, e.what());
        throw;
    }
  }
}

auto
atr_cleanup_entry::ready() const -> bool
{
  return std::chrono::steady_clock::now() > min_start_time_;
}

auto
atr_cleanup_queue::pop(bool check_time) -> std::optional<atr_cleanup_entry>
{
  const std::unique_lock<std::mutex> lock(mutex_);
  if (!queue_.empty()) {
    if (!check_time || queue_.top().ready()) {
      // copy it
      atr_cleanup_entry top = queue_.top();
      // pop it
      queue_.pop();
      return { top };
    }
  }
  return {};
}

auto
atr_cleanup_queue::size() const -> std::size_t
{
  const std::unique_lock<std::mutex> lock(mutex_);
  return queue_.size();
}

void
atr_cleanup_queue::push(const std::shared_ptr<attempt_context>& ctx)
{
  const std::unique_lock<std::mutex> lock(mutex_);
  queue_.emplace(ctx);
}
} // namespace couchbase::core::transactions
