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

#include "attempt_context_impl.hxx"

#include "active_transaction_record.hxx"
#include "atr_ids.hxx"
#include "attempt_context_testing_hooks.hxx"
#include "attempt_state.hxx"
#include "core/cluster.hxx"
#include "core/error_context/transaction_error_context.hxx"
#include "core/error_context/transaction_op_error_context.hxx"
#include "core/impl/error.hxx"
#include "core/operations.hxx"
#include "core/transactions/error_class.hxx"
#include "core/transactions/transaction_get_multi_mode.hxx"
#include "couchbase/error_codes.hxx"
#include "durability_level.hxx"
#include "exceptions.hxx"
#include "exceptions_fmt.hxx"
#include "forward_compat.hxx"
#include "get_multi_orchestrator.hxx"
#include "internal/exceptions_internal.hxx"
#include "internal/exceptions_internal_fmt.hxx"
#include "internal/logging.hxx"
#include "internal/transaction_attempt.hxx"
#include "internal/transaction_context.hxx"
#include "internal/transactions_cleanup.hxx"
#include "internal/utils.hxx"
#include "staged_mutation.hxx"

#include <optional>

namespace couchbase::core::transactions
{

namespace
{
// statement constants for queries
constexpr auto BEGIN_WORK{ "BEGIN WORK" };
constexpr auto COMMIT{ "COMMIT" };
constexpr auto ROLLBACK{ "ROLLBACK" };
constexpr auto KV_GET{ "EXECUTE __get" };
constexpr auto KV_INSERT{ "EXECUTE __insert" };
constexpr auto KV_REPLACE{ "EXECUTE __update" };
constexpr auto KV_REMOVE{ "EXECUTE __delete" };

// TODO(CXXCBC-549): remove inline clang-tidy directive below
//
// the config may have nullptr for attempt context hooks, so we use the noop
// here in that case
attempt_context_testing_hooks noop_hooks = {}; // NOLINT(cert-err58-cpp)

void
wrap_err_callback_for_async_api(const std::exception_ptr& err,
                                std::function<void(couchbase::error)>&& cb)
{
  if (err) {
    try {
      std::rethrow_exception(err);
    } catch (const transaction_operation_failed& e) {
      return cb(core::impl::make_error(e));
    } catch (...) {
      return cb({ errc::transaction_op::generic });
    }
  }
  return cb({});
}

auto
wrap_void_call_for_public_api(std::function<void()>&& handler) -> couchbase::error
{
  try {
    handler();
    return {};
  } catch (const transaction_operation_failed& e) {
    return core::impl::make_error(e);
  } catch (...) {
    // the handler should catch everything else, but just in case...
    return { errc::transaction_op::generic };
  }
}

auto
wrap_call_for_public_api(std::function<transaction_get_result()>&& handler)
  -> std::pair<couchbase::error, couchbase::transactions::transaction_get_result>
{
  try {
    return { {}, handler().to_public_result() };
  } catch (const transaction_operation_failed& e) {
    return { core::impl::make_error(e), {} };
  } catch (const op_exception& ex) {
    return { core::impl::make_error(ex), {} };
  } catch (...) {
    // the handler should catch everything else, but just in case...
    return { { errc::transaction_op::generic }, {} };
  }
}

void
wrap_callback_for_async_public_api(
  const std::exception_ptr& err,
  std::optional<transaction_get_result> res,
  std::function<void(couchbase::error, couchbase::transactions::transaction_get_result)>&& cb)
{
  if (res) {
    return cb({}, res->to_public_result());
  }
  if (err) {
    try {
      std::rethrow_exception(err);
    } catch (const op_exception& e) {
      return cb(core::impl::make_error(e), {});
    } catch (const transaction_operation_failed& e) {
      return cb(core::impl::make_error(e), {});
    } catch (...) {
      return cb({ errc::transaction_op::generic }, {});
    }
  }
  return cb({ errc::transaction_op::generic }, {});
}

} // namespace

auto
attempt_context_impl::cluster_ref() const -> const core::cluster&
{
  return overall()->cluster_ref();
}

attempt_context_impl::attempt_context_impl(
  const std::shared_ptr<transaction_context>& transaction_ctx)
  : overall_{ transaction_ctx }
  , staged_mutations_(std::make_unique<staged_mutation_queue>())
  , hooks_(transaction_ctx->config().attempt_context_hooks
             ? *transaction_ctx->config().attempt_context_hooks
             : noop_hooks)
{
  // put a new transaction_attempt in the context...
  overall()->add_attempt();
  CB_ATTEMPT_CTX_LOG_TRACE(
    this,
    "added new attempt, state {}, expiration in {}ms",
    attempt_state_name(state()),
    std::chrono::duration_cast<std::chrono::milliseconds>(overall()->remaining()).count());
}

attempt_context_impl::~attempt_context_impl() = default;

auto
attempt_context_impl::create(const std::shared_ptr<transaction_context>& transaction_ctx)
  -> std::shared_ptr<attempt_context_impl>
{
  class attempt_context_impl_wrapper : public attempt_context_impl
  {
  public:
    explicit attempt_context_impl_wrapper(
      const std::shared_ptr<transaction_context>& transaction_ctx)
      : attempt_context_impl(transaction_ctx)
    {
    }
  };
  return std::make_shared<attempt_context_impl_wrapper>(transaction_ctx);
}

void
attempt_context_impl::check_and_handle_blocking_transactions(
  const transaction_get_result& doc,
  forward_compat_stage stage,
  std::function<void(std::optional<transaction_operation_failed>)>&& cb)
{
  // The main reason to require doc to be fetched inside the transaction is we
  // can detect this on the client side
  if (doc.links().has_staged_write()) {
    // Check not just writing the same doc twice in the same transaction
    // NOTE: we check the transaction rather than attempt id. This is to handle
    // [RETRY-ERR-AMBIG-REPLACE].
    if (auto tx_id = doc.links().staged_transaction_id();
        tx_id.has_value() && tx_id.value() == transaction_id()) {
      CB_ATTEMPT_CTX_LOG_DEBUG(
        this, "doc {} has been written by this transaction, ok to continue", doc.id());
      return cb(std::nullopt);
    }
    if (doc.links().atr_id() && doc.links().atr_bucket_name() && doc.links().staged_attempt_id()) {
      CB_ATTEMPT_CTX_LOG_DEBUG(this, "doc {} in another txn, checking ATR...", doc.id());
      auto err = check_forward_compat(stage, doc.links().forward_compat());
      if (err) {
        return cb(err);
      }
      return check_atr_entry_for_blocking_document(doc,
                                                   exp_delay(std::chrono::milliseconds(50),
                                                             std::chrono::milliseconds(500),
                                                             std::chrono::seconds(1)),
                                                   std::move(cb));
    }
    CB_ATTEMPT_CTX_LOG_DEBUG(this,
                             "doc \"{}\" is in another transaction {}, but doesn't have enough "
                             "info to check the ATR. Probably a bug, proceeding to overwrite",
                             doc.id(),
                             doc.links().staged_attempt_id().value_or("<missing-attempt-id>"));
  }
  return cb(std::nullopt);
}

auto
attempt_context_impl::get(const core::document_id& id) -> transaction_get_result
{
  auto barrier = std::make_shared<std::promise<transaction_get_result>>();
  auto f = barrier->get_future();
  get(id, [barrier](const std::exception_ptr& err, std::optional<transaction_get_result> res) {
    if (err) {
      barrier->set_exception(err);
    } else {
      barrier->set_value(std::move(*res));
    }
  });
  return f.get();
}

void
attempt_context_impl::get(const core::document_id& id, Callback&& cb)
{
  if (op_list_.get_mode().is_query()) {
    return get_with_query(id, false, std::move(cb));
  }
  cache_error_async(cb, [self = shared_from_this(), id, cb]() mutable {
    self->check_if_done(cb);
    self->do_get(
      id,
      false,
      std::nullopt,
      [self, id, cb = std::move(cb)](std::optional<error_class> ec,
                                     std::optional<external_exception> cause,
                                     const std::optional<std::string>& err_message,
                                     std::optional<transaction_get_result> res) mutable {
        auto handler = [self, id, cause, err_message, res = std::move(res), cb = std::move(cb)](
                         std::optional<error_class> ec) mutable {
          if (ec) {
            switch (*ec) {
              case FAIL_EXPIRY:
                return self->op_completed_with_error(
                  std::move(cb),
                  transaction_operation_failed(*ec, "transaction expired during get").expired());
              case FAIL_DOC_NOT_FOUND:
                return self->op_completed_with_error(
                  std::move(cb),
                  transaction_operation_failed(
                    *ec, fmt::format("document not found {}", err_message.value_or("")))
                    .cause(external_exception::DOCUMENT_NOT_FOUND_EXCEPTION));
              case FAIL_TRANSIENT:
                return self->op_completed_with_error(
                  std::move(cb),
                  transaction_operation_failed(
                    *ec, fmt::format("transient failure in get {}", err_message.value_or("")))
                    .retry());
              case FAIL_HARD:
                return self->op_completed_with_error(
                  std::move(cb),
                  transaction_operation_failed(
                    *ec, fmt::format("fail hard in get {}", err_message.value_or("")))
                    .no_rollback());
              default: {
                auto msg = fmt::format("got error \"{}\" (ec={}) while getting doc {}",
                                       err_message.value_or(""),
                                       *ec,
                                       id.key());
                return self->op_completed_with_error(
                  std::move(cb), transaction_operation_failed(FAIL_OTHER, cause, msg));
              }
            }
          } else {
            if (!res) {
              return self->op_completed_with_error(
                std::move(cb), transaction_operation_failed(*ec, "document not found"));
            }
            auto err =
              check_forward_compat(forward_compat_stage::GETS, res->links().forward_compat());
            if (err) {
              return self->op_completed_with_error(std::move(cb), *err);
            }
            return self->op_completed_with_callback(std::move(cb), res);
          }
        };

        if (!ec) {
          return self->hooks_.after_get_complete(self, id.key(), std::move(handler));
        }
        return handler(ec);
      });
  });
}

auto
attempt_context_impl::get_optional(const core::document_id& id)
  -> std::optional<transaction_get_result>
{
  auto barrier = std::make_shared<std::promise<std::optional<transaction_get_result>>>();
  auto f = barrier->get_future();
  get_optional(id,
               [barrier](const std::exception_ptr& err, std::optional<transaction_get_result> res) {
                 if (err) {
                   return barrier->set_exception(err);
                 }
                 return barrier->set_value(std::move(res));
               });
  return f.get();
}

void
attempt_context_impl::get_optional(const core::document_id& id, Callback&& cb)
{

  if (op_list_.get_mode().is_query()) {
    return get_with_query(id, true, std::move(cb));
  }
  cache_error_async(cb, [self = shared_from_this(), id, cb]() mutable {
    self->ensure_open_bucket(
      id.bucket(), [self, id, cb = std::move(cb)](std::error_code ec) mutable {
        if (ec) {
          return self->op_completed_with_error(
            std::move(cb), transaction_operation_failed(FAIL_OTHER, ec.message()));
        }
        self->check_if_done(cb);
        self->do_get(
          id,
          false,
          std::nullopt,
          [self, id, cb = std::move(cb)](std::optional<error_class> ec,
                                         std::optional<external_exception> cause,
                                         const std::optional<std::string>& err_message,
                                         std::optional<transaction_get_result> res) mutable {
            auto handler = [self, id, cause, err_message, res, cb = std::move(cb)](
                             std::optional<error_class> ec) mutable {
              if (ec) {
                switch (*ec) {
                  case FAIL_EXPIRY:
                    return self->op_completed_with_error(
                      std::move(cb),
                      transaction_operation_failed(
                        *ec,
                        cause,
                        fmt::format("transaction expired during get {}", err_message.value_or("")))
                        .expired());
                  case FAIL_DOC_NOT_FOUND:
                    return self->op_completed_with_callback(
                      std::move(cb), std::optional<transaction_get_result>());
                  case FAIL_TRANSIENT:
                    return self->op_completed_with_error(
                      std::move(cb),
                      transaction_operation_failed(
                        *ec,
                        cause,
                        fmt::format("transient failure in get {}", err_message.value_or("")))
                        .retry());
                  case FAIL_HARD:
                    return self->op_completed_with_error(
                      std::move(cb),
                      transaction_operation_failed(
                        *ec, cause, fmt::format("fail hard in get {}", err_message.value_or("")))
                        .no_rollback());
                  default: {
                    return self->op_completed_with_error(
                      std::move(cb),
                      transaction_operation_failed(
                        FAIL_OTHER,
                        cause,
                        fmt::format("error getting {} {}", id.key(), err_message.value_or(""))));
                  }
                }
              } else {
                if (res) {
                  auto err =
                    check_forward_compat(forward_compat_stage::GETS, res->links().forward_compat());
                  if (err) {
                    return self->op_completed_with_error(std::move(cb), *err);
                  }
                }
                return self->op_completed_with_callback(std::move(cb), res);
              }
            };

            if (!ec) {
              return self->hooks_.after_get_complete(self, id.key(), std::move(handler));
            }
            return handler(ec);
          });
      });
  });
}

void
attempt_context_impl::get_replica_from_preferred_server_group(
  const core::document_id& id,
  std::function<void(std::exception_ptr, std::optional<transaction_get_result>)>&& cb)
{
  cache_error_async(cb, [self = shared_from_this(), id, cb]() mutable {
    if (self->op_list_.get_mode().is_query()) {
      return self->op_completed_with_error(
        std::move(cb),
        transaction_operation_failed(FAIL_OTHER,
                                     FEATURE_NOT_AVAILABLE_EXCEPTION,
                                     "Get Replica is not supported in Query Mode"));
    }
    self->check_if_done(cb);
    self->do_get(
      id,
      true,
      std::nullopt,
      [self, id, cb = std::move(cb)](std::optional<error_class> ec,
                                     std::optional<external_exception> cause,
                                     const std::optional<std::string>& err_message,
                                     std::optional<transaction_get_result> res) mutable {
        auto handler = [self, id, cause, err_message, res = std::move(res), cb = std::move(cb)](
                         std::optional<error_class> ec) mutable {
          if (ec) {
            switch (*ec) {
              case FAIL_EXPIRY:
                return self->op_completed_with_error(
                  std::move(cb),
                  transaction_operation_failed(*ec, cause, "transaction expired during get")
                    .expired());
              case FAIL_DOC_NOT_FOUND:
                return self->op_completed_with_callback(std::move(cb),
                                                        std::optional<transaction_get_result>());
              case FAIL_TRANSIENT:
                return self->op_completed_with_error(
                  std::move(cb),
                  transaction_operation_failed(
                    *ec,
                    cause,
                    fmt::format("transient failure in get {}", err_message.value_or("")))
                    .retry());
              case FAIL_HARD:
                return self->op_completed_with_error(
                  std::move(cb),
                  transaction_operation_failed(
                    *ec, cause, fmt::format("fail hard in get {}", err_message.value_or("")))
                    .no_rollback());
              case FAIL_OTHER:
                if (cause == DOCUMENT_UNRETRIEVABLE_EXCEPTION) {
                  return self->op_completed_with_error(
                    std::move(cb), document_unretrievable("failed to retrieve document"));
                }
                [[fallthrough]];
              default: {
                auto msg = fmt::format("got error \"{}\" (ec={}) while getting replica for doc {}",
                                       err_message.value_or(""),
                                       *ec,
                                       id.key());
                return self->op_completed_with_error(
                  std::move(cb), transaction_operation_failed(FAIL_OTHER, cause, msg));
              }
            }
          } else {
            if (!res) {
              return self->op_completed_with_error(
                std::move(cb),
                transaction_operation_failed(
                  *ec, external_exception::DOCUMENT_NOT_FOUND_EXCEPTION, "document not found"));
            }
            auto err =
              check_forward_compat(forward_compat_stage::GETS, res->links().forward_compat());
            if (err) {
              return self->op_completed_with_error(std::move(cb), *err);
            }
            return self->op_completed_with_callback(std::move(cb), res);
          }
        };

        if (!ec) {
          return self->hooks_.after_get_complete(self, id.key(), std::move(handler));
        }
        return handler(ec);
      });
  });
}

auto
attempt_context_impl::get_replica_from_preferred_server_group(const core::document_id& id)
  -> std::optional<transaction_get_result>
{
  auto barrier = std::make_shared<std::promise<std::optional<transaction_get_result>>>();
  auto f = barrier->get_future();
  get_replica_from_preferred_server_group(
    id, [barrier](const std::exception_ptr& err, std::optional<transaction_get_result> res) {
      if (err) {
        return barrier->set_exception(err);
      }
      return barrier->set_value(std::move(res));
    });
  return f.get();
}

auto
attempt_context_impl::get_replica_from_preferred_server_group(const couchbase::collection& coll,
                                                              const std::string& id)
  -> std::pair<couchbase::error, couchbase::transactions::transaction_get_result>
{
  auto [ctx, res] = wrap_call_for_public_api(
    [self = shared_from_this(), coll, id]() mutable -> transaction_get_result {
      auto ret = self->get_replica_from_preferred_server_group(
        { coll.bucket_name(), coll.scope_name(), coll.name(), id });
      if (ret) {
        return ret.value();
      }
      return {};
    });
  if (!ctx.ec() && res.cas().empty()) {
    return { { errc::transaction_op::document_not_found }, res };
  }
  return { ctx, res };
}

void
attempt_context_impl::get_replica_from_preferred_server_group(
  const couchbase::collection& coll,
  const std::string& id,
  couchbase::transactions::async_result_handler&& handler)
{
  get_replica_from_preferred_server_group(
    { coll.bucket_name(), coll.scope_name(), coll.name(), id },
    [handler = std::move(handler)](const std::exception_ptr& err,
                                   std::optional<transaction_get_result> res) mutable {
      if (!res) {
        return handler({ errc::transaction_op::document_not_found }, {});
      }
      return wrap_callback_for_async_public_api(err, std::move(res), std::move(handler));
    });
}

namespace
{
// FIXME(SA): do not use Public API in the core
auto
from_public_api(couchbase::transactions::transaction_get_multi_mode mode)
  -> transaction_get_multi_mode
{
  switch (mode) {
    case couchbase::transactions::transaction_get_multi_mode::prioritise_latency:
      return transaction_get_multi_mode::prioritise_latency;
    case couchbase::transactions::transaction_get_multi_mode::disable_read_skew_detection:
      return transaction_get_multi_mode::disable_read_skew_detection;
    case couchbase::transactions::transaction_get_multi_mode::prioritise_read_skew_detection:
      return transaction_get_multi_mode::prioritise_read_skew_detection;
  }
  return transaction_get_multi_mode::prioritise_latency;
}

auto
from_public_api(
  couchbase::transactions::transaction_get_multi_replicas_from_preferred_server_group_mode mode)
  -> transaction_get_multi_replicas_from_preferred_server_group_mode
{
  switch (mode) {
    case couchbase::transactions::transaction_get_multi_replicas_from_preferred_server_group_mode::
      prioritise_latency:
      return transaction_get_multi_replicas_from_preferred_server_group_mode::prioritise_latency;
    case couchbase::transactions::transaction_get_multi_replicas_from_preferred_server_group_mode::
      disable_read_skew_detection:
      return transaction_get_multi_replicas_from_preferred_server_group_mode::
        disable_read_skew_detection;
    case couchbase::transactions::transaction_get_multi_replicas_from_preferred_server_group_mode::
      prioritise_read_skew_detection:
      return transaction_get_multi_replicas_from_preferred_server_group_mode::
        prioritise_read_skew_detection;
      break;
  }
  return transaction_get_multi_replicas_from_preferred_server_group_mode::prioritise_latency;
}
} // namespace

void
attempt_context_impl::get_multi(
  const std::vector<core::document_id>& ids,
  transaction_get_multi_mode mode,
  std::function<void(std::exception_ptr, std::optional<transaction_get_multi_result>)>&& cb)
{
  if (op_list_.get_mode().is_query()) {
    return cb(std::make_exception_ptr(op_exception({ errc::transaction_op::feature_not_available },
                                                   "Get Multi is not supported in Query Mode",
                                                   FEATURE_NOT_AVAILABLE_EXCEPTION)),
              {});
  }
  cache_error_async(cb, [self = shared_from_this(), ids, mode, cb]() mutable {
    self->check_if_done(cb);
    const auto manager = std::make_shared<get_multi_orchestrator>(self, ids);
    manager->get_multi(
      mode,
      [self, cb = std::move(cb)](std::exception_ptr err,
                                 std::optional<transaction_get_multi_result> res) mutable {
        if (err) {
          self->op_completed_with_error(std::move(cb), std::move(err));
          return;
        }
        self->op_completed_with_callback(std::move(cb), std::move(res));
      });
  });
}

auto
attempt_context_impl::get_multi(const std::vector<core::document_id>& ids,
                                transaction_get_multi_mode mode) -> transaction_get_multi_result
{
  auto barrier = std::make_shared<std::promise<transaction_get_multi_result>>();
  auto f = barrier->get_future();
  get_multi(
    ids, mode, [barrier](std::exception_ptr err, std::optional<transaction_get_multi_result> res) {
      if (err) {
        return barrier->set_exception(std::move(err));
      }
      if (res) {
        return barrier->set_value(std::move(*res));
      }
      return barrier->set_exception(std::make_exception_ptr(
        transaction_operation_failed(FAIL_OTHER, "get_multi: either error or result must be set")));
    });
  return f.get();
}

void
attempt_context_impl::get_multi(
  const std::vector<couchbase::transactions::transaction_get_multi_spec>& specs,
  const couchbase::transactions::transaction_get_multi_options& options,
  std::function<void(error, std::optional<couchbase::transactions::transaction_get_multi_result>)>&&
    cb)
{
  std::vector<core::document_id> ids;
  ids.reserve(specs.size());
  for (const auto& spec : specs) {
    ids.emplace_back(spec.bucket_, spec.scope_, spec.collection_, spec.id_);
  }

  get_multi(ids, from_public_api(options.mode_), [cb = std::move(cb)](const auto& err, auto res) {
    if (err) {
      try {
        std::rethrow_exception(err);
      } catch (const op_exception& e) {
        return cb(core::impl::make_error(e), {});
      } catch (const transaction_operation_failed& e) {
        return cb(core::impl::make_error(e), {});
      } catch (...) {
        return cb({ errc::transaction_op::generic }, {});
      }
    }
    if (res) {
      return cb({}, couchbase::transactions::transaction_get_multi_result{ res->content() });
    }
    return cb({ errc::transaction_op::generic }, {});
  });
}

auto
attempt_context_impl::get_multi(
  const std::vector<couchbase::transactions::transaction_get_multi_spec>& specs,
  const couchbase::transactions::transaction_get_multi_options& options)
  -> std::pair<error, std::optional<couchbase::transactions::transaction_get_multi_result>>
{
  auto barrier = std::make_shared<std::promise<
    std::pair<error, std::optional<couchbase::transactions::transaction_get_multi_result>>>>();
  auto f = barrier->get_future();
  get_multi(
    specs,
    options,
    [barrier](error err, std::optional<couchbase::transactions::transaction_get_multi_result> res) {
      return barrier->set_value(std::make_pair(std::move(err), std::move(res)));
    });
  return f.get();
}

void
attempt_context_impl::get_multi_replicas_from_preferred_server_group(
  const std::vector<core::document_id>& ids,
  transaction_get_multi_replicas_from_preferred_server_group_mode mode,
  std::function<
    void(std::exception_ptr,
         std::optional<transaction_get_multi_replicas_from_preferred_server_group_result>)>&& cb)
{
  if (op_list_.get_mode().is_query()) {
    return cb(
      std::make_exception_ptr(op_exception({ errc::transaction_op::feature_not_available },
                                           "Get Multi Replica is not supported in Query Mode",
                                           FEATURE_NOT_AVAILABLE_EXCEPTION)),
      {});
  }

  cache_error_async(cb, [self = shared_from_this(), ids, mode, cb]() mutable {
    self->check_if_done(cb);
    const auto manager = std::make_shared<get_multi_orchestrator>(self, ids);
    manager->get_multi_replicas_from_preferred_server_group(
      mode,
      [self, cb = std::move(cb)](
        std::exception_ptr err,
        std::optional<transaction_get_multi_replicas_from_preferred_server_group_result>
          res) mutable {
        if (err) {
          self->op_completed_with_error(std::move(cb), std::move(err));
          return;
        }
        self->op_completed_with_callback(std::move(cb), std::move(res));
      });
  });
}

auto
attempt_context_impl::get_multi_replicas_from_preferred_server_group(
  const std::vector<core::document_id>& ids,
  transaction_get_multi_replicas_from_preferred_server_group_mode mode)
  -> transaction_get_multi_replicas_from_preferred_server_group_result
{
  auto barrier = std::make_shared<
    std::promise<transaction_get_multi_replicas_from_preferred_server_group_result>>();
  auto f = barrier->get_future();
  get_multi_replicas_from_preferred_server_group(
    ids,
    mode,
    [barrier](
      std::exception_ptr err,
      std::optional<transaction_get_multi_replicas_from_preferred_server_group_result> res) {
      if (err) {
        return barrier->set_exception(std::move(err));
      }
      if (res) {
        return barrier->set_value(std::move(*res));
      }
      return barrier->set_exception(std::make_exception_ptr(
        transaction_operation_failed(FAIL_OTHER, "get_multi: either error or result must be set")));
    });
  return f.get();
}

void
attempt_context_impl::get_multi_replicas_from_preferred_server_group(
  const std::vector<
    couchbase::transactions::transaction_get_multi_replicas_from_preferred_server_group_spec>&
    specs,
  const couchbase::transactions::transaction_get_multi_replicas_from_preferred_server_group_options&
    options,
  std::function<
    void(error,
         std::optional<couchbase::transactions::
                         transaction_get_multi_replicas_from_preferred_server_group_result>)>&& cb)
{
  std::vector<core::document_id> ids;
  ids.reserve(specs.size());
  for (const auto& spec : specs) {
    ids.emplace_back(spec.bucket_, spec.scope_, spec.collection_, spec.id_);
  }

  get_multi_replicas_from_preferred_server_group(
    ids, from_public_api(options.mode_), [cb = std::move(cb)](const auto& err, auto res) {
      if (err) {
        try {
          std::rethrow_exception(err);
        } catch (const op_exception& e) {
          return cb(core::impl::make_error(e), {});
        } catch (const transaction_operation_failed& e) {
          return cb(core::impl::make_error(e), {});
        } catch (...) {
          return cb({ errc::transaction_op::generic }, {});
        }
      }
      if (res) {
        return cb(
          {},
          couchbase::transactions::
            transaction_get_multi_replicas_from_preferred_server_group_result{ res->content() });
      }
      return cb({ errc::transaction_op::generic }, {});
    });
}

auto
attempt_context_impl::get_multi_replicas_from_preferred_server_group(
  const std::vector<
    couchbase::transactions::transaction_get_multi_replicas_from_preferred_server_group_spec>&
    specs,
  const couchbase::transactions::transaction_get_multi_replicas_from_preferred_server_group_options&
    options)
  -> std::pair<
    error,
    std::optional<
      couchbase::transactions::transaction_get_multi_replicas_from_preferred_server_group_result>>
{
  auto barrier = std::make_shared<std::promise<std::pair<
    error,
    std::optional<couchbase::transactions::
                    transaction_get_multi_replicas_from_preferred_server_group_result>>>>();
  auto f = barrier->get_future();
  get_multi_replicas_from_preferred_server_group(
    specs,
    options,
    [barrier](
      error err,
      std::optional<
        couchbase::transactions::transaction_get_multi_replicas_from_preferred_server_group_result>
        res) {
      return barrier->set_value(std::make_pair(std::move(err), std::move(res)));
    });
  return f.get();
}

auto
attempt_context_impl::create_document_metadata(
  const std::string& operation_type,
  const std::string& operation_id,
  const std::optional<document_metadata>& document_metadata,
  std::uint32_t user_flags_to_stage) -> tao::json::value
{
  tao::json::value txn;
  const bool binary = codec::codec_flags::has_common_flags(user_flags_to_stage,
                                                           codec::codec_flags::binary_common_flags);

  txn["op"] = {
    { "type", operation_type },
  };
  txn["aux"] = {
    { "uf", user_flags_to_stage },
  };
  txn["id"] = {
    { "txn", transaction_id() },
    { "atmpt", id() },
    { "op", operation_id },
  };
  txn["atr"] = {
    { "id", atr_id() },
  };
  // FIXME(SA): Why atr_id_ is an optional field?
  if (const auto& id = atr_id_; id.has_value()) {
    txn["atr"]["bkt"] = atr_id_->bucket();
    txn["atr"]["scp"] = atr_id_->scope();
    txn["atr"]["coll"] = atr_id_->collection();
  }

  if (document_metadata) {
    tao::json::value restore = tao::json::empty_object;
    if (auto cas = document_metadata->cas(); cas.has_value()) {
      restore["CAS"] = cas.value();
    }
    if (auto revid = document_metadata->revid(); revid.has_value()) {
      restore["revid"] = revid.value();
    }
    if (auto exptime = document_metadata->exptime(); exptime.has_value()) {
      restore["exptime"] = exptime.value();
    }
    if (!restore.get_object().empty()) {
      txn["restore"] = restore;
    }
  }

  if (binary && (operation_type == "replace" || operation_type == "insert")) {
    tao::json::value fc_check = tao::json::value::array({
      tao::json::value::object({
        { "e", "BS" },
        { "b", "f" },
      }),
    });
    txn["fc"] = {
      { to_string(forward_compat_stage::WRITE_WRITE_CONFLICT_INSERTING), fc_check },
      { to_string(forward_compat_stage::WRITE_WRITE_CONFLICT_INSERTING_GET), fc_check },
      { to_string(forward_compat_stage::GETS), fc_check },
      { to_string(forward_compat_stage::CLEANUP_ENTRY), fc_check },
    };
  }

  return txn;
}

void
attempt_context_impl::replace(const transaction_get_result& document,
                              codec::encoded_value content,
                              Callback&& cb)
{

  if (op_list_.get_mode().is_query()) {
    return replace_raw_with_query(document, std::move(content), std::move(cb));
  }
  return cache_error_async(
    cb, [self = shared_from_this(), cb, document, content = std::move(content)]() mutable {
      self->ensure_open_bucket(
        document.bucket(),
        [self, cb = std::move(cb), document, content = std::move(content)](
          std::error_code ec) mutable {
          if (ec) {
            return self->op_completed_with_error(
              std::move(cb), transaction_operation_failed(FAIL_OTHER, ec.message()));
          }
          try {
            auto op_id = uid_generator::next();
            // a get can return a 'empty' doc, so check for that and short-circuit
            // the eventual error that will occur...
            if (document.key().empty() || document.bucket().empty()) {
              return self->op_completed_with_error(
                std::move(cb),
                transaction_operation_failed(FAIL_DOC_NOT_FOUND, "can't replace empty doc")
                  .cause(external_exception::DOCUMENT_NOT_FOUND_EXCEPTION));
            }
            CB_ATTEMPT_CTX_LOG_TRACE(
              self, "replacing {} with {}", document, utils::to_string(content.data));
            self->check_if_done(cb);
            staged_mutation* existing_sm = self->staged_mutations_->find_any(document.id());
            if (existing_sm != nullptr && existing_sm->type() == staged_mutation_type::REMOVE) {
              CB_ATTEMPT_CTX_LOG_DEBUG(
                self, "found existing REMOVE of {} while replacing", document);
              return self->op_completed_with_error(
                std::move(cb),
                transaction_operation_failed(FAIL_DOC_NOT_FOUND,
                                             "cannot replace a document that has been "
                                             "removed in the same transaction")
                  .cause(external_exception::DOCUMENT_NOT_FOUND_EXCEPTION));
            }
            if (self->check_expiry_pre_commit(STAGE_REPLACE, document.id().key())) {
              return self->op_completed_with_error(
                std::move(cb),
                transaction_operation_failed(FAIL_EXPIRY, "transaction expired").expired());
            }

            self->check_and_handle_blocking_transactions(
              document,
              forward_compat_stage::WRITE_WRITE_CONFLICT_REPLACING,
              [self,
               existing_sm,
               document,
               cb = std::move(cb),
               op_id,
               content =
                 std::move(content)](std::optional<transaction_operation_failed> e1) mutable {
                if (e1) {
                  return self->op_completed_with_error(std::move(cb), *e1);
                }
                auto tmp_doc = document_id{ document.id().bucket(),
                                            document.id().scope(),
                                            document.id().collection(),
                                            document.id().key() };
                self->select_atr_if_needed_unlocked(
                  tmp_doc,
                  [self,
                   existing_sm,
                   document,
                   cb = std::move(cb),
                   op_id,
                   content =
                     std::move(content)](std::optional<transaction_operation_failed> e2) mutable {
                    if (e2) {
                      return self->op_completed_with_error(std::move(cb), *e2);
                    }
                    if (existing_sm != nullptr &&
                        existing_sm->type() == staged_mutation_type::INSERT) {
                      CB_ATTEMPT_CTX_LOG_DEBUG(
                        self, "found existing INSERT of {} while replacing", document);
                      self->create_staged_insert(document.id(),
                                                 std::move(content),
                                                 document.cas().value(),
                                                 exp_delay(std::chrono::milliseconds(5),
                                                           std::chrono::milliseconds(300),
                                                           self->overall()->config().timeout),
                                                 op_id,
                                                 std::move(cb));
                      return;
                    }
                    self->create_staged_replace(document.id(),
                                                std::move(content),
                                                document.content().flags,
                                                document.cas(),
                                                op_id,
                                                document.metadata(),
                                                std::move(cb));
                  });
              });
          } catch (const client_error& e) {
            const error_class errc = e.ec();
            switch (errc) {
              case FAIL_EXPIRY:
                self->expiry_overtime_mode_ = true;
                throw transaction_operation_failed(errc, e.what()).expired();
              default:
                throw transaction_operation_failed(errc, e.what());
            }
          }
        });
    });
}

namespace
{
template<typename Response>
auto
external_exception_from_response(const Response& resp) -> external_exception
{
  if (resp.ctx.ec() == errc::key_value::document_irretrievable) {
    return DOCUMENT_UNRETRIEVABLE_EXCEPTION;
  }
  if (const auto error_index = resp.ctx.first_error_index(); error_index) {
    const auto status = resp.fields.at(error_index.value()).status;
    const auto path = resp.fields.at(error_index.value()).path;
    if (status == key_value_status_code::subdoc_value_cannot_insert && path == "txn.op.bin") {
      return FEATURE_NOT_AVAILABLE_EXCEPTION;
    }
  }
  return UNKNOWN;
}
} // namespace

template<typename Handler>
void
attempt_context_impl::create_staged_replace(
  const document_id& id,
  codec::encoded_value content,
  std::uint32_t original_flags,
  const couchbase::cas& cas,
  const std::string& op_id,
  const std::optional<document_metadata>& document_metadata,
  Handler&& cb)
{
  operations::mutate_in_request req{ id };
  const bool binary =
    codec::codec_flags::has_common_flags(content.flags, codec::codec_flags::binary_common_flags);
  auto txn = create_document_metadata("replace", op_id, document_metadata, content.flags);
  req.specs =
    mutate_in_specs{
      mutate_in_specs::upsert_raw("txn", utils::to_binary(jsonify(txn))).xattr().create_path(),
      mutate_in_specs::upsert_raw(binary ? "txn.op.bin" : "txn.op.stgd", content.data)
        .xattr()
        .binary(binary),
      mutate_in_specs::upsert("txn.op.crc32", subdoc::mutate_in_macro::value_crc32c)
        .xattr()
        .create_path(),
    }
      .specs();
  req.durability_level = overall()->config().level;
  req.cas = cas;
  req.flags = original_flags;
  req.access_deleted = true;
  auto error_handler = [self = shared_from_this()](error_class ec,
                                                   external_exception cause,
                                                   const std::string& msg,
                                                   Handler&& cb) {
    transaction_operation_failed err(ec, msg);
    err.cause(cause);
    switch (ec) {
      case FAIL_DOC_NOT_FOUND:
      case FAIL_DOC_ALREADY_EXISTS:
      case FAIL_CAS_MISMATCH:
      case FAIL_TRANSIENT:
      case FAIL_AMBIGUOUS:
        return self->op_completed_with_error(std::forward<Handler>(cb), err.retry());
      case FAIL_HARD:
        return self->op_completed_with_error(std::forward<Handler>(cb), err.no_rollback());
      default:
        return self->op_completed_with_error(std::forward<Handler>(cb), err);
    }
  };
  auto ec = wait_for_hook([self = shared_from_this(), key = id.key()](auto handler) mutable {
    return self->hooks_.before_staged_replace(self, key, std::move(handler));
  });
  if (ec) {
    return error_handler(
      *ec, UNKNOWN, "before_staged_replace hook raised error", std::forward<Handler>(cb));
  }
  CB_ATTEMPT_CTX_LOG_TRACE(this,
                           "about to replace doc {} with cas {} in txn {}",
                           id,
                           cas.value(),
                           overall()->transaction_id());
  overall()->cluster_ref().execute(
    req,
    [self = shared_from_this(),
     op_id,
     id,
     document_metadata,
     content = std::move(content),
     original_flags,
     cb = std::forward<Handler>(cb),
     error_handler = std::move(error_handler)](core::operations::mutate_in_response resp) mutable {
      if (auto ec2 = error_class_from_response(resp); ec2) {
        return error_handler(
          *ec2,
          external_exception_from_response(resp),
          fmt::format("unable to create staged replace ec=\"{}\"", resp.ctx.ec().message()),
          std::forward<Handler>(cb));
      }
      return self->hooks_.after_staged_replace_complete(
        self,
        id.key(),
        [self,
         op_id,
         id,
         document_metadata,
         content = std::move(content),
         original_flags,
         error_handler = std::move(error_handler),
         cb = std::forward<Handler>(cb),
         resp = std::move(resp)](auto ec) mutable {
          if (ec) {
            return error_handler(*ec,
                                 UNKNOWN,
                                 "after_staged_replace_commit hook returned error",
                                 std::forward<Handler>(cb));
          }

          std::optional<codec::encoded_value> staged_content_json{};
          std::optional<codec::encoded_value> staged_content_binary{};
          if (codec::codec_flags::has_common_flags(content.flags,
                                                   codec::codec_flags::json_common_flags)) {
            staged_content_json = content;
          } else if (codec::codec_flags::has_common_flags(
                       content.flags, codec::codec_flags::binary_common_flags)) {
            staged_content_binary = content;
          }
          transaction_get_result out{
            id,
            content,
            resp.cas.value(),
            transaction_links{
              self->atr_id_->key(),
              id.bucket(),
              id.scope(),
              id.collection(),
              self->overall()->transaction_id(),
              self->id(),
              op_id,
              std::move(staged_content_json),
              std::move(staged_content_binary),
              std::nullopt,
              std::nullopt,
              std::nullopt,
              std::nullopt,
              "replace",
              std::nullopt,
              false,
            },
            document_metadata,
          };

          CB_ATTEMPT_CTX_LOG_TRACE(self, "replace staged content, result {}", out);

          self->supports_replace_body_with_xattr(
            id.bucket(),
            [self,
             out = std::move(out),
             error_handler = std::move(error_handler),
             original_flags,
             cb = std::forward<Handler>(cb)](auto ec, bool supports) mutable {
              if (ec) {
                return error_handler(
                  FAIL_OTHER,
                  UNKNOWN,
                  "failed to check whether replace_body_with_xattr is supported: " + ec.message(),
                  std::forward<Handler>(cb));
              }

              auto [staged_content, staged_flags] = out.links().staged_content_json_or_binary();

              self->staged_mutations_->add(staged_mutation{
                staged_mutation_type::REPLACE,
                out.id(),
                out.cas(),
                supports ? std::nullopt
                         : std::make_optional(staged_content), // We don't store the staged contents
                                                               // if the cluster supports
                                                               // replace_body_with_xattr
                staged_flags,
                original_flags,
                out.metadata(),
              });
              return self->op_completed_with_callback(std::forward<Handler>(cb),
                                                      std::optional(out));
            });
        });
    });
}

auto
attempt_context_impl::replace(const transaction_get_result& document, codec::encoded_value content)
  -> transaction_get_result
{
  auto barrier = std::make_shared<std::promise<transaction_get_result>>();
  auto f = barrier->get_future();
  replace(document,
          std::move(content),
          [barrier](const std::exception_ptr& err, std::optional<transaction_get_result> res) {
            if (err) {
              return barrier->set_exception(err);
            }
            barrier->set_value(std::move(*res));
          });
  return f.get();
}

void
attempt_context_impl::replace_raw(couchbase::transactions::transaction_get_result doc,
                                  codec::encoded_value content,
                                  couchbase::transactions::async_result_handler&& handler)
{
  replace(core::transactions::transaction_get_result(doc),
          std::move(content),
          [handler = std::move(handler)](const std::exception_ptr& err,
                                         std::optional<transaction_get_result> res) mutable {
            wrap_callback_for_async_public_api(err, std::move(res), std::move(handler));
          });
}

auto
attempt_context_impl::replace_raw(const couchbase::transactions::transaction_get_result& doc,
                                  codec::encoded_value content)
  -> std::pair<couchbase::error, couchbase::transactions::transaction_get_result>
{
  return wrap_call_for_public_api(
    [self = shared_from_this(), doc, content = std::move(content)]() -> transaction_get_result {
      return self->replace(transaction_get_result(doc), content);
    });
}

auto
attempt_context_impl::insert_raw(const collection& coll,
                                 const std::string& id,
                                 codec::encoded_value content)
  -> std::pair<couchbase::error, couchbase::transactions::transaction_get_result>
{
  return wrap_call_for_public_api(
    [self = shared_from_this(), coll, &id, content = std::move(content)]() mutable {
      return self->insert({ coll.bucket_name(), coll.scope_name(), coll.name(), id },
                          std::move(content));
    });
}

void
attempt_context_impl::insert_raw(const collection& coll,
                                 std::string id,
                                 codec::encoded_value content,
                                 couchbase::transactions::async_result_handler&& handler)
{
  insert({ coll.bucket_name(), coll.scope_name(), coll.name(), std::move(id) },
         std::move(content),
         [handler = std::move(handler)](const std::exception_ptr& err,
                                        std::optional<transaction_get_result> res) mutable {
           wrap_callback_for_async_public_api(err, std::move(res), std::move(handler));
         });
}

auto
attempt_context_impl::insert(const core::document_id& id, codec::encoded_value content)
  -> transaction_get_result
{
  auto barrier = std::make_shared<std::promise<transaction_get_result>>();
  auto f = barrier->get_future();
  insert(id,
         std::move(content),
         [barrier](const std::exception_ptr& err, std::optional<transaction_get_result> res) {
           if (err) {
             return barrier->set_exception(err);
           }
           barrier->set_value(std::move(*res));
         });
  return f.get();
}

void
attempt_context_impl::insert(const core::document_id& id,
                             codec::encoded_value content,
                             Callback&& cb)
{
  if (op_list_.get_mode().is_query()) {
    return insert_raw_with_query(id, std::move(content), std::move(cb));
  }
  return cache_error_async(
    cb, [self = shared_from_this(), id, cb, content = std::move(content)]() mutable {
      self->ensure_open_bucket(
        id.bucket(),
        [self, id, content = std::move(content), cb = std::move(cb)](std::error_code ec) mutable {
          if (ec) {
            return self->op_completed_with_error(
              std::move(cb), transaction_operation_failed(FAIL_OTHER, ec.message()));
          }
          try {
            self->check_if_done(cb);
            auto op_id = uid_generator::next();
            staged_mutation* existing_sm = self->staged_mutations_->find_any(id);
            if ((existing_sm != nullptr) &&
                (existing_sm->type() == staged_mutation_type::INSERT ||
                 existing_sm->type() == staged_mutation_type::REPLACE)) {
              CB_ATTEMPT_CTX_LOG_DEBUG(
                self, "found existing insert or replace of {} while inserting", id);
              return self->op_completed_with_error(
                std::move(cb),
                document_exists("found existing insert or replace of same document"));
            }
            if (self->check_expiry_pre_commit(STAGE_INSERT, id.key())) {
              return self->op_completed_with_error(
                std::move(cb),
                transaction_operation_failed(FAIL_EXPIRY, "transaction expired").expired());
            }
            self->select_atr_if_needed_unlocked(
              id,
              [self, existing_sm, cb = std::move(cb), id, op_id, content = std::move(content)](
                std::optional<transaction_operation_failed> err) mutable {
                if (err) {
                  return self->op_completed_with_error(std::move(cb), *err);
                }
                if (existing_sm != nullptr && existing_sm->type() == staged_mutation_type::REMOVE) {
                  CB_ATTEMPT_CTX_LOG_DEBUG(self, "found existing remove of {} while inserting", id);
                  return self->create_staged_replace(existing_sm->id(),
                                                     std::move(content),
                                                     existing_sm->current_user_flags(),
                                                     existing_sm->cas(),
                                                     op_id,
                                                     existing_sm->doc_metadata(),
                                                     std::move(cb));
                }
                const std::uint64_t cas = 0;
                self->create_staged_insert(id,
                                           std::move(content),
                                           cas,
                                           exp_delay(std::chrono::milliseconds(5),
                                                     std::chrono::milliseconds(300),
                                                     self->overall()->config().timeout),
                                           op_id,
                                           std::move(cb));
              });
          } catch (const std::exception& e) {
            return self->op_completed_with_error(
              std::move(cb), transaction_operation_failed(FAIL_OTHER, e.what()));
          }
        });
    });
}

void
attempt_context_impl::select_atr_if_needed_unlocked(
  const core::document_id& id,
  std::function<void(std::optional<transaction_operation_failed>)>&& cb)
{
  try {
    std::unique_lock<std::mutex> lock(mutex_);
    if (atr_id_) {
      CB_ATTEMPT_CTX_LOG_TRACE(this, "atr exists, moving on");
      return cb(std::nullopt);
    }
    std::size_t vbucket_id = 0;
    std::optional<const std::string> hook_atr =
      hooks_.random_atr_id_for_vbucket(shared_from_this());
    if (hook_atr) {
      atr_id_ = atr_id_from_bucket_and_key(overall()->config(), id.bucket(), hook_atr.value());
    } else {
      vbucket_id = atr_ids::vbucket_for_key(id.key());
      atr_id_ = atr_id_from_bucket_and_key(
        overall()->config(), id.bucket(), atr_ids::atr_id_for_vbucket(vbucket_id));
    }
    // TODO(SA): cleanup the transaction_context - this should be set (threadsafe)
    // from the above calls
    overall()->atr_collection(collection_spec_from_id(id));
    overall()->atr_id(atr_id_->key());
    state(attempt_state::NOT_STARTED);
    CB_ATTEMPT_CTX_LOG_TRACE(
      this,
      R"(first mutated doc in transaction is "{}" on vbucket {}, so using atr "{}")",
      id,
      vbucket_id,
      atr_id_.value());
    overall()->cleanup().add_collection(
      { atr_id_->bucket(), atr_id_->scope(), atr_id_->collection() });
    set_atr_pending_locked(id, std::move(lock), std::move(cb));
  } catch (const std::exception& e) {
    CB_ATTEMPT_CTX_LOG_ERROR(this, "unexpected error \"{}\" during select atr if needed", e.what());
  }
}
template<typename Handler, typename Delay>
void
attempt_context_impl::check_atr_entry_for_blocking_document(const transaction_get_result& doc,
                                                            Delay delay,
                                                            Handler&& cb)
{
  try {
    delay();
    return hooks_.before_check_atr_entry_for_blocking_doc(
      shared_from_this(),
      doc.id().key(),
      [self = shared_from_this(), delay = std::move(delay), cb = std::forward<Handler>(cb), doc](
        auto ec) mutable {
        if (ec) {
          return cb(transaction_operation_failed(FAIL_WRITE_WRITE_CONFLICT,
                                                 "document is in another transaction")
                      .retry());
        }

        const core::document_id atr_id(doc.links().atr_bucket_name().value(),
                                       doc.links().atr_scope_name().value(),
                                       doc.links().atr_collection_name().value(),
                                       doc.links().atr_id().value());
        return active_transaction_record::get_atr(
          self->cluster_ref(),
          atr_id,
          [self, delay = std::move(delay), cb = std::move(cb), doc](
            std::error_code err, std::optional<active_transaction_record> atr) mutable {
            if (!err) {
              if (atr) {
                auto entries = atr->entries();
                auto it = std::find_if(entries.begin(), entries.end(), [&doc](const atr_entry& e) {
                  return e.attempt_id() == doc.links().staged_attempt_id();
                });
                if (it != entries.end()) {
                  auto fwd_err = check_forward_compat(
                    forward_compat_stage::WRITE_WRITE_CONFLICT_READING_ATR, it->forward_compat());
                  if (fwd_err) {
                    return cb(fwd_err);
                  }
                  switch (it->state()) {
                    case attempt_state::COMPLETED:
                    case attempt_state::ROLLED_BACK:
                      CB_ATTEMPT_CTX_LOG_DEBUG(self,
                                               "existing atr entry can be ignored due to state {}",
                                               attempt_state_name(it->state()));
                      return cb(std::nullopt);
                    default:
                      CB_ATTEMPT_CTX_LOG_DEBUG(self,
                                               "existing atr entry found in state {}, retrying",
                                               attempt_state_name(it->state()));
                  }
                  return self->check_atr_entry_for_blocking_document(doc, delay, std::move(cb));
                }
              }
              CB_ATTEMPT_CTX_LOG_DEBUG(self, "no blocking atr entry");
              return cb(std::nullopt);
            }
            // if we are here, there is still a write-write conflict
            return cb(transaction_operation_failed(FAIL_WRITE_WRITE_CONFLICT,
                                                   "document is in another transaction")
                        .retry());
          });
      });
  } catch (const retry_operation_timeout&) {
    return cb(
      transaction_operation_failed(FAIL_WRITE_WRITE_CONFLICT, "document is in another transaction")
        .retry());
  }
}
void
attempt_context_impl::remove(const transaction_get_result& document, VoidCallback&& cb)
{

  if (op_list_.get_mode().is_query()) {
    return remove_with_query(document, std::move(cb));
  }
  return cache_error_async(cb, [self = shared_from_this(), document, cb]() mutable {
    self->check_if_done(cb);
    self->ensure_open_bucket(
      document.bucket(), [self, document, cb = std::move(cb)](std::error_code ec) mutable {
        if (ec) {
          return self->op_completed_with_error(
            std::move(cb), transaction_operation_failed(FAIL_OTHER, ec.message()));
        }
        const staged_mutation* existing_sm = self->staged_mutations_->find_any(document.id());
        auto error_handler =
          [self](error_class ec, const std::string& msg, VoidCallback&& cb) mutable {
            transaction_operation_failed err(ec, msg);
            switch (ec) {
              case FAIL_EXPIRY:
                self->expiry_overtime_mode_ = true;
                return self->op_completed_with_error(std::move(cb), err.expired());
              case FAIL_DOC_NOT_FOUND:
              case FAIL_DOC_ALREADY_EXISTS:
              case FAIL_CAS_MISMATCH:
              case FAIL_TRANSIENT:
              case FAIL_AMBIGUOUS:
                return self->op_completed_with_error(std::move(cb), err.retry());
              case FAIL_HARD:
                return self->op_completed_with_error(std::move(cb), err.no_rollback());
              default:
                return self->op_completed_with_error(std::move(cb), err);
            }
          };
        if (self->check_expiry_pre_commit(STAGE_REMOVE, document.id().key())) {
          return error_handler(FAIL_EXPIRY, "transaction expired", std::move(cb));
        }
        CB_ATTEMPT_CTX_LOG_DEBUG(self, "removing {}", document);
        auto op_id = uid_generator::next();
        if (existing_sm != nullptr) {
          if (existing_sm->type() == staged_mutation_type::REMOVE) {
            CB_ATTEMPT_CTX_LOG_DEBUG(self, "found existing REMOVE of {} while removing", document);
            return self->op_completed_with_error(
              std::move(cb),
              transaction_operation_failed(FAIL_DOC_NOT_FOUND,
                                           "cannot remove a document that has been "
                                           "removed in the same transaction")
                .cause(external_exception::DOCUMENT_NOT_FOUND_EXCEPTION));
          }
          if (existing_sm->type() == staged_mutation_type::INSERT) {
            self->remove_staged_insert(document.id(), std::move(cb));
            return;
          }
        }
        return self->check_and_handle_blocking_transactions(
          document,
          forward_compat_stage::WRITE_WRITE_CONFLICT_REMOVING,
          [self, document, cb = std::move(cb), op_id, error_handler = std::move(error_handler)](
            std::optional<transaction_operation_failed> err1) mutable {
            if (err1) {
              return self->op_completed_with_error(std::move(cb), *err1);
            }
            auto tmp_doc = document_id{ document.id().bucket(),
                                        document.id().scope(),
                                        document.id().collection(),
                                        document.id().key() };
            return self->select_atr_if_needed_unlocked(
              tmp_doc,
              [self,
               document = document,
               cb = std::move(cb),
               op_id,
               error_handler = std::move(error_handler)](
                std::optional<transaction_operation_failed> err2) mutable {
                if (err2) {
                  return self->op_completed_with_error(std::move(cb), *err2);
                }
                auto key = document.id().key();
                return self->hooks_.before_staged_remove(
                  self,
                  key,
                  [self,
                   document = std::move(document),
                   cb = std::move(cb),
                   op_id,
                   error_handler = std::move(error_handler)](auto ec) mutable {
                    if (ec) {
                      return error_handler(
                        *ec, "before_staged_remove hook raised error", std::move(cb));
                    }
                    CB_ATTEMPT_CTX_LOG_TRACE(self,
                                             "about to remove doc {} with cas {}",
                                             document.id(),
                                             document.cas().value());
                    core::operations::mutate_in_request req{ document.id() };
                    auto txn =
                      self->create_document_metadata("remove", op_id, document.metadata(), 0);
                    req.specs =
                      mutate_in_specs{
                        mutate_in_specs::upsert_raw("txn", core::utils::to_binary(jsonify(txn)))
                          .xattr()
                          .create_path(),
                        mutate_in_specs::upsert("txn.op.crc32",
                                                subdoc::mutate_in_macro::value_crc32c)
                          .xattr()
                          .create_path(),
                      }
                        .specs();
                    req.durability_level = self->overall()->config().level;
                    req.cas = document.cas();
                    req.access_deleted = document.links().is_deleted();
                    return self->overall()->cluster_ref().execute(
                      req,
                      [self,
                       document = std::move(document),
                       cb = std::move(cb),
                       error_handler = std::move(error_handler)](
                        core::operations::mutate_in_response resp) mutable {
                        auto ec = error_class_from_response(resp);
                        if (ec) {
                          return error_handler(*ec, resp.ctx.ec().message(), std::move(cb));
                        }
                        auto key = document.id().key();
                        return self->hooks_.after_staged_remove_complete(
                          self,
                          key,
                          [self,
                           document = std::move(document),
                           cb = std::move(cb),
                           error_handler = std::move(error_handler),
                           resp = std::move(resp)](auto ec) mutable {
                            if (ec) {
                              return error_handler(*ec, resp.ctx.ec().message(), std::move(cb));
                            }

                            CB_ATTEMPT_CTX_LOG_TRACE(self,
                                                     "removed doc {} CAS={}, rc={}",
                                                     document.id(),
                                                     resp.cas.value(),
                                                     resp.ctx.ec().message());

                            self->staged_mutations_->add(staged_mutation{
                              staged_mutation_type::REMOVE,
                              document.id(),
                              resp.cas,
                              {},
                              document.content().flags,
                              document.content().flags,
                              document.metadata(),
                            });
                            return self->op_completed_with_callback(cb);
                          });
                      });
                  });
              });
          });
      });
  });
}

void
attempt_context_impl::remove_staged_insert(const core::document_id& id, VoidCallback&& cb)
{
  if (auto ec = error_if_expired_and_not_in_overtime(STAGE_REMOVE_STAGED_INSERT, id.key()); ec) {
    return op_completed_with_error(
      std::move(cb),
      transaction_operation_failed(FAIL_EXPIRY, std::string("expired in remove_staged_insert"))
        .no_rollback()
        .expired());
  }

  auto error_handler =
    [self = shared_from_this()](error_class ec, const std::string& msg, VoidCallback&& cb) mutable {
      transaction_operation_failed err(ec, msg);
      switch (ec) {
        case FAIL_HARD:
          return self->op_completed_with_error(std::move(cb), err.no_rollback());
        default:
          return self->op_completed_with_error(std::move(cb), err.retry());
      }
    };
  CB_ATTEMPT_CTX_LOG_DEBUG(this, "removing staged insert {}", id);

  return hooks_.before_remove_staged_insert(
    shared_from_this(),
    id.key(),
    [self = shared_from_this(), id, cb = std::move(cb), error_handler = std::move(error_handler)](
      auto ec) mutable {
      if (ec) {
        return error_handler(*ec, "before_remove_staged_insert hook returned error", std::move(cb));
      }
      core::operations::mutate_in_request req{ id };
      req.specs =
        couchbase::mutate_in_specs{
          couchbase::mutate_in_specs::remove("txn").xattr(),
        }
          .specs();
      wrap_durable_request(req, self->overall()->config());
      req.access_deleted = true;

      return self->overall()->cluster_ref().execute(
        req,
        [self, id, cb = std::move(cb), error_handler = std::move(error_handler)](
          const core::operations::mutate_in_response& resp) mutable {
          auto ec = error_class_from_response(resp);
          if (ec) {
            CB_ATTEMPT_CTX_LOG_DEBUG(self, "remove_staged_insert got error {}", *ec);
            return error_handler(*ec, resp.ctx.ec().message(), std::move(cb));
          }
          return self->hooks_.after_remove_staged_insert(
            self,
            id.key(),
            [self, id, cb = std::move(cb), error_handler = std::move(error_handler)](
              auto ec) mutable {
              if (ec) {
                return error_handler(
                  *ec, "after_remove_staged_insert hook returned error", std::move(cb));
              }
              self->staged_mutations_->remove_any(id);
              return self->op_completed_with_callback(std::move(cb));
            });
        });
    });
}

void
attempt_context_impl::remove(const transaction_get_result& document)
{
  auto barrier = std::make_shared<std::promise<void>>();
  auto f = barrier->get_future();
  remove(document, [barrier](const std::exception_ptr& err) {
    if (err) {
      return barrier->set_exception(err);
    }
    barrier->set_value();
  });
  f.get();
}

namespace
{
auto
wrap_query_request(const couchbase::transactions::transaction_query_options& opts,
                   const std::shared_ptr<transaction_context>& txn_context)
  -> core::operations::query_request
{
  // build what we can directly from the options:
  auto req = core::impl::build_transaction_query_request(opts.get_query_options().build());
  // set timeout to remaining time plus some extra time, so we don't time out
  // right at expiry.
  auto extra = core::timeout_defaults::key_value_durable_timeout;
  if (!req.scan_consistency) {
    req.scan_consistency = txn_context->config().query_config.scan_consistency;
  }
  auto remaining = std::chrono::duration_cast<std::chrono::milliseconds>(txn_context->remaining());
  // FIXME(SA): is this assignment necessary? cppcheck complains about redundant
  // assignment below
  req.timeout =
    remaining + extra +
    std::chrono::milliseconds(1000); // match java with 1 second over the kv durable timeout.
  req.raw["txtimeout"] = fmt::format("\"{}ms\"", remaining.count());
  req.timeout = // cppcheck-suppress redundantAssignment
    std::chrono::duration_cast<std::chrono::milliseconds>(txn_context->remaining()) + extra;
  return req;
}
} // namespace

void
attempt_context_impl::query_begin_work(const std::optional<std::string>& query_context,
                                       VoidCallback&& cb)
{
  // construct the txn_data and query options for the existing transaction
  couchbase::transactions::transaction_query_options opts;
  tao::json::value txdata;
  txdata["id"] = tao::json::empty_object;
  txdata["id"]["atmpt"] = id();
  txdata["id"]["txn"] = transaction_id();
  txdata["state"] = tao::json::empty_object;
  txdata["state"]["timeLeftMs"] = overall()->remaining().count() / 1000000;
  txdata["config"] = tao::json::empty_object;
  auto [ec, origin] = overall()->cluster_ref().origin();
  txdata["config"]["kvTimeoutMs"] = (ec) ? core::timeout_defaults::key_value_durable_timeout.count()
                                         : origin.options().key_value_durable_timeout.count();
  txdata["config"]["numAtrs"] = 1024;
  opts.raw("numatrs", jsonify(1024));
  txdata["config"]["durabilityLevel"] = durability_level_to_string(overall()->config().level);
  opts.raw("durability_level", durability_level_to_string_for_query(overall()->config().level));
  if (atr_id_) {
    txdata["atr"] = tao::json::empty_object;
    txdata["atr"]["scp"] = atr_id_->scope();
    txdata["atr"]["coll"] = atr_id_->collection();
    txdata["atr"]["bkt"] = atr_id_->bucket();
    txdata["atr"]["id"] = atr_id_->key();
  } else if (overall()->config().metadata_collection) {
    auto id = atr_id_from_bucket_and_key(overall()->config(), "", "");
    txdata["atr"] = tao::json::empty_object;
    txdata["atr"]["scp"] = id.scope();
    txdata["atr"]["coll"] = id.collection();
    txdata["atr"]["bkt"] = id.bucket();
    opts.raw("atrcollection",
             fmt::format("\"`{}`.`{}`.`{}`\"", id.bucket(), id.scope(), id.collection()));
  }
  tao::json::value mutations = tao::json::empty_array;
  if (!staged_mutations_->empty()) {
    staged_mutations_->iterate([&mutations](staged_mutation& mut) {
      mutations.push_back(tao::json::value{
        { "scp", mut.id().scope() },
        { "coll", mut.id().collection() },
        { "bkt", mut.id().bucket() },
        { "id", mut.id().key() },
        { "cas", std::to_string(mut.cas().value()) },
        { "type", mut.type_as_string() },
      });
    });
  }
  txdata["mutations"] = mutations;
  CB_ATTEMPT_CTX_LOG_TRACE(
    this, "begin_work using txdata: {}", core::utils::json::generate(txdata));
  wrap_query(
    BEGIN_WORK,
    opts,
    {},
    txdata,
    STAGE_QUERY_BEGIN_WORK,
    false,
    query_context,
    [self = shared_from_this(), cb = std::move(cb)](const std::exception_ptr& err,
                                                    core::operations::query_response resp) mutable {
      if (resp.served_by_node.empty()) {
        CB_ATTEMPT_CTX_LOG_TRACE(self,
                                 "begin_work didn't reach a query node, resetting mode to kv");
        self->op_list_.reset_query_mode();
      } else {
        CB_ATTEMPT_CTX_LOG_TRACE(self, "begin_work setting query node to {}", resp.served_by_node);
        self->op_list_.set_query_node(resp.served_by_node);
      }
      // we check for expiry _after_ this call, so we always set the query
      // node if we can.
      if (self->has_expired_client_side(STAGE_QUERY_BEGIN_WORK, {})) {
        return cb(
          std::make_exception_ptr(transaction_operation_failed(FAIL_EXPIRY, "expired in BEGIN WORK")
                                    .no_rollback()
                                    .expired()));
      }
      return cb(err);
    });
}

auto
choose_error(std::vector<tao::json::value>& errors) -> tao::json::value
{
  auto chosen_error = errors.front();
  if (errors.size() > 1) {
    // if there's one with a "reason":{"cause", ...} field, choose it
    for (const auto& e : errors) {
      const auto* reason = e.find("reason");
      const auto* cause = e.find("cause");
      if (reason != nullptr && !reason->is_null() && cause != nullptr && !cause->is_null()) {
        return e;
      }
    }
    // ok, so now lets see if we have one with code in the range 17000-18000 and
    // return that.
    for (const auto& e : errors) {
      auto code = e.at("code").as<std::uint64_t>();
      if (code >= 17000 && code <= 18000) {
        return e;
      }
    }
  }
  // then, just the first one.
  return chosen_error;
}

auto
attempt_context_impl::handle_query_error(const core::operations::query_response& resp) const
  -> std::exception_ptr
{
  if (!resp.ctx.ec && !resp.meta.errors) {
    return {};
  }
  auto [tx_err, query_result] = couchbase::core::impl::build_transaction_query_result(resp);
  // TODO(SA): look at ambiguous and unambiguous timeout errors vs the codes, etc...
  CB_ATTEMPT_CTX_LOG_TRACE(this,
                           "handling query error {}, {} errors in meta_data",
                           resp.ctx.ec.message(),
                           resp.meta.errors ? "has" : "no");
  if (resp.ctx.ec == couchbase::errc::common::ambiguous_timeout ||
      resp.ctx.ec == couchbase::errc::common::unambiguous_timeout) {
    return std::make_exception_ptr(query_attempt_expired(tx_err));
  }
  if (resp.ctx.ec == couchbase::errc::common::parsing_failure) {
    return std::make_exception_ptr(query_parsing_failure(tx_err));
  }
  if (!resp.meta.errors) {
    // can't choose an error, map using the ec...
    const external_exception cause = (resp.ctx.ec == couchbase::errc::common::service_not_available
                                        ? SERVICE_NOT_AVAILABLE_EXCEPTION
                                        : COUCHBASE_EXCEPTION);
    return std::make_exception_ptr(
      transaction_operation_failed(FAIL_OTHER, resp.ctx.ec.message()).cause(cause));
  }
  // TODO(SA): we should have all the fields in these transactional query errors in
  // the errors object. For now, lets
  //   parse the body, get the serialized info to decide which error to choose.
  auto errors = core::utils::json::parse(resp.ctx.http_body)["errors"].get_array();

  // just chose first one, to start with...
  auto chosen_error = choose_error(errors);
  CB_ATTEMPT_CTX_LOG_TRACE(this, "chosen query error: {}", jsonify(chosen_error));
  auto code = chosen_error.at("code").as<std::uint64_t>();

  // we have a fixed strategy for these errors...
  switch (code) {
    case 1065:
      return std::make_exception_ptr(
        transaction_operation_failed(FAIL_OTHER,
                                     "N1QL Queries in transactions are supported in "
                                     "couchbase server 7.0 and later")
          .cause(FEATURE_NOT_AVAILABLE_EXCEPTION));
    case 1197:
      return std::make_exception_ptr(
        transaction_operation_failed(FAIL_OTHER,
                                     "This couchbase server requires all queries use a scope.")
          .cause(FEATURE_NOT_AVAILABLE_EXCEPTION));
    case 17004:
      return std::make_exception_ptr(query_attempt_not_found(tx_err));
    case 1080:
    case 17010:
      return std::make_exception_ptr(
        transaction_operation_failed(FAIL_EXPIRY, "transaction expired").expired());
    case 17012:
      return std::make_exception_ptr(document_exists(tx_err));
    case 17014:
      return std::make_exception_ptr(document_not_found(tx_err));
    case 17015:
      return std::make_exception_ptr(query_cas_mismatch(tx_err));
    default:
      break;
  }

  // For these errors, we will create a transaction_operation_failed from the
  // info in it.
  if (code >= 17000 && code <= 18000) {
    // the assumption below is there's always a top-level msg.
    // TODO(SA): when we parse the errors more thoroughly in the client, we should
    // be able to add a lot of info on the underlying
    //   cause of the error here (in addition to perhaps a more granular
    //   message).
    transaction_operation_failed err(FAIL_OTHER, chosen_error.at("msg").as<std::string>());
    // parse the body for now, get the serialized info to create a
    // transaction_operation_failed:
    if (const auto* cause = chosen_error.find("cause"); cause != nullptr) {
      if (const auto* retry = cause->find("retry"); retry != nullptr && retry->get_boolean()) {
        err.retry();
      }
      if (const auto* rollback = cause->find("rollback");
          rollback == nullptr || !rollback->get_boolean()) {
        err.no_rollback();
      }
      if (const auto* raise = cause->find("raise"); raise != nullptr) {
        if (const auto exception_to_raise = raise->get_string();
            exception_to_raise == std::string("expired")) {
          err.expired();
        } else if (exception_to_raise == std::string("commit_ambiguous")) {
          err.ambiguous();
        } else if (exception_to_raise == std::string("failed_post_commit")) {
          err.failed_post_commit();
        } else if (exception_to_raise != std::string("failed")) {
          CB_ATTEMPT_CTX_LOG_TRACE(
            this, "unknown value in raise field: {}, raising failed", exception_to_raise);
        }
      }
      return std::make_exception_ptr(err);
    }
  }

  return { std::make_exception_ptr(op_exception(tx_err)) };
}

void
attempt_context_impl::do_query(const std::string& statement,
                               const couchbase::transactions::transaction_query_options& opts,
                               const std::optional<std::string>& query_context,
                               QueryCallback&& cb)
{
  const tao::json::value txdata;
  CB_ATTEMPT_CTX_LOG_TRACE(this, "do_query called with statement {}", statement);
  wrap_query(statement,
             opts,
             {},
             txdata,
             STAGE_QUERY,
             true,
             query_context,
             [self = shared_from_this(), cb = std::move(cb)](
               std::exception_ptr err, core::operations::query_response resp) mutable {
               if (err) {
                 return self->op_completed_with_error(std::move(cb), std::move(err));
               }
               self->op_completed_with_callback(
                 std::move(cb), std::optional<core::operations::query_response>(resp));
             });
}
auto
dump_request(const core::operations::query_request& req) -> std::string
{
  std::string raw = "{";
  for (const auto& x : req.raw) {
    raw += x.first;
    raw += ":";
    raw += x.second.str();
    raw += ",";
  }
  raw += "}";
  std::string params;
  for (const auto& x : req.positional_parameters) {
    params.append(x.str());
  }
  return fmt::format("request: {}, {}, {}", req.statement, params, raw);
}

void
attempt_context_impl::wrap_query(
  const std::string& statement,
  const couchbase::transactions::transaction_query_options& opts,
  std::vector<core::json_string> params,
  const tao::json::value& txdata,
  const std::string& hook_point,
  bool check_expiry,
  const std::optional<std::string>& query_context,
  std::function<void(std::exception_ptr, core::operations::query_response)>&& cb)
{
  bool has_staged_binary{ false };
  staged_mutations_->iterate([&has_staged_binary](auto& mutation) {
    if (mutation.is_staged_binary()) {
      has_staged_binary = true;
    }
  });

  if (has_staged_binary) {
    return cb(std::make_exception_ptr(
                transaction_operation_failed(
                  FAIL_OTHER, "Binary documents are only supported in a KV-only transaction")
                  .cause(FEATURE_NOT_AVAILABLE_EXCEPTION)),
              {});
  }

  auto req = wrap_query_request(opts, overall());
  if (statement != BEGIN_WORK) {
    auto mode = op_list_.get_mode();
    assert(mode.is_query());
    if (!op_list_.get_mode().query_node.empty()) {
      req.send_to_node = op_list_.get_mode().query_node;
    }
  }
  // set the query_context, if one has been set, unless this query already has
  // one
  if (!query_context && !query_context_.empty()) {
    req.query_context = query_context_;
  } else if (query_context) {
    req.query_context = query_context;
  }

  if (check_expiry) {
    if (has_expired_client_side(hook_point, std::nullopt)) {
      auto err = std::make_exception_ptr(
        transaction_operation_failed(FAIL_EXPIRY,
                                     fmt::format("{} expired in stage {}", statement, hook_point))
          .no_rollback()
          .expired());
      return cb(err, {});
    }
  }

  if (!params.empty()) {
    req.positional_parameters = std::move(params);
  }
  if (statement != BEGIN_WORK) {
    req.raw["txid"] = jsonify(id());
  }
  if (txdata.is_object() && !txdata.get_object().empty()) {
    req.raw["txdata"] = core::utils::json::generate(txdata);
  }
  req.statement = statement;
  return hooks_.before_query(
    shared_from_this(),
    statement,
    [self = shared_from_this(), statement, req, cb = std::move(cb)](auto ec) mutable {
      if (ec) {
        auto err = std::make_exception_ptr(
          transaction_operation_failed(*ec, "before_query hook raised error"));
        if (statement == BEGIN_WORK) {
          return cb(
            std::make_exception_ptr(
              transaction_operation_failed(*ec, "before_query hook raised error").no_rollback()),
            {});
        }
        return cb(std::make_exception_ptr(
                    transaction_operation_failed(*ec, "before_query hook raised error")),
                  {});
      }

      CB_ATTEMPT_CTX_LOG_TRACE(self, "http request: {}", dump_request(req));
      return self->overall()->cluster_ref().execute(
        req, [self, req, cb = std::move(cb)](core::operations::query_response resp) mutable {
          CB_ATTEMPT_CTX_LOG_TRACE(
            self, "response: {} status: {}", resp.ctx.http_body, resp.meta.status);
          const auto stmt = resp.ctx.statement;
          return self->hooks_.after_query(
            self, stmt, [self, resp = std::move(resp), cb = std::move(cb)](auto ec) mutable {
              if (ec) {
                auto err = std::make_exception_ptr(
                  transaction_operation_failed(*ec, "after_query hook raised error"));
                return cb(err, {});
              }
              return cb(self->handle_query_error(resp), resp);
            });
        });
    });
}

void
attempt_context_impl::query(const std::string& statement,
                            const couchbase::transactions::transaction_query_options& options,
                            std::optional<std::string> query_context,
                            QueryCallback&& cb)
{
  return cache_error_async(
    cb,
    [self = shared_from_this(),
     statement,
     options,
     cb,
     query_context = std::move(query_context)]() mutable {
      self->check_if_done(cb);
      // decrement in_flight, as we just incremented it in cache_error_async.
      self->op_list_.set_query_mode(
        [self, statement, options, query_context, cb]() mutable {
          // set query context if set
          if (query_context) {
            self->query_context_ = query_context.value();
          }
          self->query_begin_work(
            query_context,
            [self, statement, query_context, options, cb = std::move(cb)](
              std::exception_ptr err) mutable {
              if (err) {
                return self->op_completed_with_error(std::move(cb), std::move(err));
              }
              return self->do_query(statement, options, query_context, std::move(cb));
            });
        },
        [self, statement, options, query_context, cb]() mutable {
          return self->do_query(statement, options, query_context, std::move(cb));
        });
    });
}

auto
attempt_context_impl::do_core_query(
  const std::string& statement,
  const couchbase::transactions::transaction_query_options& options,
  std::optional<std::string> query_context) -> core::operations::query_response
{
  auto barrier = std::make_shared<std::promise<core::operations::query_response>>();
  auto f = barrier->get_future();
  query(
    statement,
    options,
    query_context,
    [barrier](const std::exception_ptr& err, std::optional<core::operations::query_response> resp) {
      if (err) {
        return barrier->set_exception(err);
      }
      barrier->set_value(*resp);
    });
  return f.get();
}

auto
attempt_context_impl::do_public_query(
  const std::string& statement,
  const couchbase::transactions::transaction_query_options& opts,
  std::optional<std::string> query_context)
  -> std::pair<couchbase::error, couchbase::transactions::transaction_query_result>
{
  try {
    auto result = do_core_query(statement, opts, query_context);
    auto [ctx, res] = core::impl::build_transaction_query_result(result);
    if (ctx.ec()) {
      // This should have already been converted to an exception by handle_query_error, which we
      // handle above. Let's return an error here just in case
      std::string msg = "Txns query error occured that should have been handled further upstream, "
                        "which might indicate a bug.";
      if (std::holds_alternative<query_error_context>(ctx.cause())) {
        return { { ctx.ec(),
                   std::move(msg),
                   {},
                   impl::make_error(std::get<query_error_context>(ctx.cause())) },
                 {} };
      }
      return { { ctx.ec(), std::move(msg) }, {} };
    }
    return { {}, res };
  } catch (const transaction_operation_failed& e) {
    return { core::impl::make_error(e), {} };
  } catch (const op_exception& qe) {
    return { core::impl::make_error(qe), {} };
  } catch (...) {
    // should not be necessary, but just in case...
    return { { couchbase::errc::transaction_op::generic }, {} };
  }
}

auto
make_params(const core::document_id& id, std::optional<codec::encoded_value> content)
  -> std::vector<core::json_string>
{
  if (content && !codec::codec_flags::has_common_flags(content->flags,
                                                       codec::codec_flags::json_common_flags)) {
    throw transaction_operation_failed(
      FAIL_OTHER, "Binary documents are only supported in a KV-only transaction")
      .cause(FEATURE_NOT_AVAILABLE_EXCEPTION);
  }

  std::vector<core::json_string> retval;
  auto keyspace = fmt::format("default:`{}`.`{}`.`{}`", id.bucket(), id.scope(), id.collection());
  retval.emplace_back(jsonify(keyspace));
  if (!id.key().empty()) {
    retval.emplace_back(jsonify(id.key()));
  }
  if (content) {
    retval.emplace_back(
      std::string(reinterpret_cast<const char*>(content->data.data()), content->data.size()));
    retval.emplace_back(core::utils::json::generate(tao::json::empty_object));
  }
  return retval;
}

auto
make_kv_txdata(std::optional<transaction_get_result> doc = std::nullopt) -> tao::json::value
{
  tao::json::value retval{ { "kv", true } };
  if (doc) {
    retval["scas"] = fmt::format("{}", doc->cas().value());
    doc->links().append_to_json(retval);
  }
  return retval;
}

void
attempt_context_impl::get_with_query(const core::document_id& id, bool optional, Callback&& cb)
{
  cache_error_async(cb, [self = shared_from_this(), id, optional, cb]() mutable {
    couchbase::transactions::transaction_query_options opts;
    opts.readonly(true);
    return self->wrap_query(
      KV_GET,
      opts,
      make_params(id, {}),
      make_kv_txdata(),
      STAGE_QUERY_KV_GET,
      true,
      {},
      [self, id, optional, cb = std::move(cb)](std::exception_ptr err,
                                               core::operations::query_response resp) mutable {
        if (resp.ctx.ec == couchbase::errc::key_value::document_not_found) {
          return self->op_completed_with_callback(std::move(cb),
                                                  std::optional<transaction_get_result>());
        }
        if (!err) {
          // make a transaction_get_result from the row...
          try {
            if (resp.rows.empty()) {
              if (optional) {
                return self->op_completed_with_callback(std::move(cb),
                                                        std::optional<transaction_get_result>());
              }
              return self->op_completed_with_error(
                std::move(cb),
                transaction_operation_failed(FAIL_DOC_NOT_FOUND, "document not found"));
            }
            CB_ATTEMPT_CTX_LOG_TRACE(self, "get_with_query got: {}", resp.rows.front());
            transaction_get_result doc(id, core::utils::json::parse(resp.rows.front()));
            return self->op_completed_with_callback(std::move(cb),
                                                    std::optional<transaction_get_result>(doc));
          } catch (const std::exception& e) {
            // TODO(SA): unsure what to do here, but this is pretty fatal, so
            return self->op_completed_with_error(
              std::move(cb), transaction_operation_failed(FAIL_OTHER, e.what()));
          }
        }
        // for get_optional.   <sigh>
        if (optional) {
          try {
            std::rethrow_exception(err);
          } catch (const document_not_found&) {
            return self->op_completed_with_callback(std::move(cb),
                                                    std::optional<transaction_get_result>());
          } catch (...) {
            return self->op_completed_with_error(std::move(cb), std::current_exception());
          }
        }
        return self->op_completed_with_error(std::move(cb), std::move(err));
      });
  });
}

void
attempt_context_impl::insert_raw_with_query(const core::document_id& id,
                                            codec::encoded_value content,
                                            Callback&& cb)
{
  cache_error_async(
    cb, [self = shared_from_this(), id, content = std::move(content), cb]() mutable {
      const couchbase::transactions::transaction_query_options opts;
      return self->wrap_query(
        KV_INSERT,
        opts,
        make_params(id, std::move(content)),
        make_kv_txdata(),
        STAGE_QUERY_KV_INSERT,
        true,
        {},
        [self, id, cb = std::move(cb)](const std::exception_ptr& err,
                                       core::operations::query_response resp) mutable {
          if (err) {
            try {
              std::rethrow_exception(err);
            } catch (const transaction_operation_failed& e) {
              return self->op_completed_with_error(std::move(cb), e);
            } catch (const op_exception& ex) {
              return self->op_completed_with_error(std::move(cb), ex);
            } catch (const std::exception& e) {
              return self->op_completed_with_error(
                std::move(cb), transaction_operation_failed(FAIL_OTHER, e.what()));
            } catch (...) {
              return self->op_completed_with_error(
                std::move(cb), transaction_operation_failed(FAIL_OTHER, "unexpected error"));
            }
          }
          // make a transaction_get_result from the row...
          try {
            CB_ATTEMPT_CTX_LOG_TRACE(self, "insert_raw_with_query got: {}", resp.rows.front());
            transaction_get_result doc(id, core::utils::json::parse(resp.rows.front()));
            return self->op_completed_with_callback(std::move(cb),
                                                    std::optional<transaction_get_result>(doc));
          } catch (const std::exception& e) {
            // TODO(SA): unsure what to do here, but this is pretty fatal, so
            return self->op_completed_with_error(
              std::move(cb), transaction_operation_failed(FAIL_OTHER, e.what()));
          }
        });
    });
}

void
attempt_context_impl::replace_raw_with_query(const transaction_get_result& document,
                                             codec::encoded_value content,
                                             Callback&& cb)
{
  cache_error_async(
    cb, [self = shared_from_this(), document, content = std::move(content), cb]() mutable {
      const couchbase::transactions::transaction_query_options opts;
      return self->wrap_query(
        KV_REPLACE,
        opts,
        make_params(document.id(), std::move(content)),
        make_kv_txdata(document),
        STAGE_QUERY_KV_REPLACE,
        true,
        {},
        [self, id = document.id(), cb = std::move(cb)](
          const std::exception_ptr& err, core::operations::query_response resp) mutable {
          if (err) {
            try {
              std::rethrow_exception(err);
            } catch (const query_cas_mismatch& e) {
              return self->op_completed_with_error(
                std::move(cb), transaction_operation_failed(FAIL_CAS_MISMATCH, e.what()).retry());
            } catch (const document_not_found& e) {
              return self->op_completed_with_error(
                std::move(cb), transaction_operation_failed(FAIL_DOC_NOT_FOUND, e.what()).retry());
            } catch (const transaction_operation_failed& e) {
              return self->op_completed_with_error(std::move(cb), e);
            } catch (std::exception& e) {
              return self->op_completed_with_error(
                std::move(cb), transaction_operation_failed(FAIL_OTHER, e.what()));
            } catch (...) {
              return self->op_completed_with_error(
                std::move(cb), transaction_operation_failed(FAIL_OTHER, "unexpected exception"));
            }
          }
          // make a transaction_get_result from the row...
          try {
            CB_ATTEMPT_CTX_LOG_TRACE(self, "replace_raw_with_query got: {}", resp.rows.front());
            transaction_get_result doc(id, core::utils::json::parse(resp.rows.front()));
            return self->op_completed_with_callback(std::move(cb),
                                                    std::optional<transaction_get_result>(doc));
          } catch (const std::exception& e) {
            // TODO(SA): unsure what to do here, but this is pretty fatal, so
            return self->op_completed_with_error(
              std::move(cb), transaction_operation_failed(FAIL_OTHER, e.what()));
          }
        });
    });
}

void
attempt_context_impl::remove_with_query(const transaction_get_result& document, VoidCallback&& cb)
{
  cache_error_async(cb, [self = shared_from_this(), document, cb]() {
    const couchbase::transactions::transaction_query_options opts;
    return self->wrap_query(
      KV_REMOVE,
      opts,
      make_params(document.id(), {}),
      make_kv_txdata(document),
      STAGE_QUERY_KV_REMOVE,
      true,
      {},
      [self, id = document.id(), cb](const std::exception_ptr& err,
                                     const core::operations::query_response& /* resp */) mutable {
        if (err) {
          try {
            std::rethrow_exception(err);
          } catch (const transaction_operation_failed& e) {
            return self->op_completed_with_error(std::move(cb), e);
          } catch (const document_not_found& e) {
            return self->op_completed_with_error(
              std::move(cb), transaction_operation_failed(FAIL_DOC_NOT_FOUND, e.what()).retry());
          } catch (const query_cas_mismatch& e) {
            return self->op_completed_with_error(
              std::move(cb), transaction_operation_failed(FAIL_CAS_MISMATCH, e.what()).retry());
          } catch (const std::exception& e) {
            return self->op_completed_with_error(
              std::move(cb), transaction_operation_failed(FAIL_OTHER, e.what()));
          } catch (...) {
            return self->op_completed_with_error(
              std::move(cb), transaction_operation_failed(FAIL_OTHER, "unexpected exception"));
          }
        }
        // make a transaction_get_result from the row...
        return self->op_completed_with_callback(std::move(cb));
      });
  });
}

void
attempt_context_impl::commit_with_query(VoidCallback&& cb)
{
  const core::operations::query_request req;
  CB_ATTEMPT_CTX_LOG_TRACE(this, "commit_with_query called");
  const couchbase::transactions::transaction_query_options opts;
  wrap_query(
    COMMIT,
    opts,
    {},
    make_kv_txdata(std::nullopt),
    STAGE_QUERY_COMMIT,
    true,
    {},
    [self = shared_from_this(), cb](const std::exception_ptr& err,
                                    const core::operations::query_response& /* resp */) mutable {
      self->is_done_ = true;
      if (err) {
        try {
          std::rethrow_exception(err);
        } catch (const transaction_operation_failed&) {
          return cb(std::current_exception());
        } catch (const query_attempt_expired& e) {
          return cb(std::make_exception_ptr(
            transaction_operation_failed(FAIL_EXPIRY, e.what()).ambiguous().no_rollback()));
        } catch (const document_not_found& e) {
          return cb(std::make_exception_ptr(
            transaction_operation_failed(FAIL_DOC_NOT_FOUND, e.what()).no_rollback()));
        } catch (const document_exists& e) {
          return cb(std::make_exception_ptr(
            transaction_operation_failed(FAIL_DOC_ALREADY_EXISTS, e.what()).no_rollback()));
        } catch (const query_cas_mismatch& e) {
          return cb(std::make_exception_ptr(
            transaction_operation_failed(FAIL_CAS_MISMATCH, e.what()).no_rollback()));
        } catch (const std::exception& e) {
          return cb(std::make_exception_ptr(
            transaction_operation_failed(FAIL_OTHER, e.what()).no_rollback()));
        }
      }
      self->state(attempt_state::COMPLETED);
      return cb({});
    });
}
void
attempt_context_impl::rollback_with_query(VoidCallback&& cb)
{
  const core::operations::query_request req;
  CB_ATTEMPT_CTX_LOG_TRACE(this, "rollback_with_query called");
  const couchbase::transactions::transaction_query_options opts;
  wrap_query(
    ROLLBACK,
    opts,
    {},
    make_kv_txdata(std::nullopt),
    STAGE_QUERY_ROLLBACK,
    true,
    {},
    [self = shared_from_this(), cb](const std::exception_ptr& err,
                                    const core::operations::query_response& /* resp */) mutable {
      self->is_done_ = true;
      if (err) {
        try {
          std::rethrow_exception(err);
        } catch (const transaction_operation_failed&) {
          return cb(std::current_exception());
        } catch (const query_attempt_not_found& e) {
          CB_ATTEMPT_CTX_LOG_DEBUG(self,
                                   "got query_attempt_not_found, assuming query was "
                                   "already rolled back successfullly: {}",
                                   e.what());
        } catch (const std::exception& e) {
          return cb(std::make_exception_ptr(
            transaction_operation_failed(FAIL_OTHER, e.what()).no_rollback()));
        }
      }
      self->state(attempt_state::ROLLED_BACK);
      CB_ATTEMPT_CTX_LOG_TRACE(self, "rollback successful");
      return cb({});
    });
}
void
attempt_context_impl::atr_commit(bool ambiguity_resolution_mode)
{
  retry_op<void>([self = shared_from_this(), &ambiguity_resolution_mode]() {
    try {
      const std::string prefix(ATR_FIELD_ATTEMPTS + "." + self->id() + ".");
      core::operations::mutate_in_request req{ self->atr_id_.value() };
      req.specs =
        couchbase::mutate_in_specs{
          couchbase::mutate_in_specs::upsert(prefix + ATR_FIELD_STATUS,
                                             attempt_state_name(attempt_state::COMMITTED))
            .xattr(),
          couchbase::mutate_in_specs::upsert(prefix + ATR_FIELD_START_COMMIT,
                                             subdoc::mutate_in_macro::cas)
            .xattr(),
          couchbase::mutate_in_specs::insert(prefix + ATR_FIELD_PREVENT_COLLLISION, 0).xattr(),
        }
          .specs();
      wrap_durable_request(req, self->overall()->config());
      auto ec = self->error_if_expired_and_not_in_overtime(STAGE_ATR_COMMIT, {});
      if (ec) {
        throw client_error(
          *ec, fmt::format("atr_commit check for expiry threw error, error_class={}", ec.value()));
      }
      ec = wait_for_hook([self](auto handler) mutable {
        return self->hooks_.before_atr_commit(self, std::move(handler));
      });
      if (ec) {
        // for now, throw.  Later, if this is async, we will use error handler
        // no doubt.
        throw client_error(
          *ec, fmt::format("before_atr_commit hook raised error, error_class={}", ec.value()));
      }
      self->staged_mutations_->extract_to(prefix, req);
      auto barrier = std::make_shared<std::promise<result>>();
      auto f = barrier->get_future();
      CB_ATTEMPT_CTX_LOG_TRACE(self,
                               "updating atr {}, setting to {}",
                               req.id,
                               attempt_state_name(attempt_state::COMMITTED));
      self->overall()->cluster_ref().execute(
        req, [barrier](const core::operations::mutate_in_response& resp) {
          barrier->set_value(result::create_from_subdoc_response(resp));
        });
      auto res = wrap_operation_future(f, false);
      ec = wait_for_hook([self](auto handler) mutable {
        return self->hooks_.after_atr_commit(self, std::move(handler));
      });
      if (ec) {
        throw client_error(*ec, "after_atr_commit hook raised error");
      }
      self->state(attempt_state::COMMITTED);
    } catch (const client_error& e) {
      const error_class ec = e.ec();
      switch (ec) {
        case FAIL_EXPIRY: {
          self->expiry_overtime_mode_ = true;
          auto out = transaction_operation_failed(ec, e.what()).no_rollback();
          if (ambiguity_resolution_mode) {
            out.ambiguous();
          } else {
            out.expired();
          }
          throw out;
        }
        case FAIL_AMBIGUOUS:
          CB_ATTEMPT_CTX_LOG_DEBUG(self, "atr_commit got FAIL_AMBIGUOUS, resolving ambiguity...");
          ambiguity_resolution_mode = true;
          throw retry_operation(e.what());
        case FAIL_TRANSIENT:
          if (ambiguity_resolution_mode) {
            throw retry_operation(e.what());
          }
          throw transaction_operation_failed(ec, e.what()).retry();

        case FAIL_PATH_ALREADY_EXISTS:
          // Need retry_op as atr_commit_ambiguity_resolution can throw
          // retry_operation
          return retry_op<void>([self]() {
            return self->atr_commit_ambiguity_resolution();
          });
        case FAIL_HARD: {
          auto out = transaction_operation_failed(ec, e.what()).no_rollback();
          if (ambiguity_resolution_mode) {
            out.ambiguous();
          }
          throw out;
        }
        case FAIL_DOC_NOT_FOUND: {
          auto out = transaction_operation_failed(ec, e.what())
                       .cause(external_exception::ACTIVE_TRANSACTION_RECORD_NOT_FOUND)
                       .no_rollback();
          if (ambiguity_resolution_mode) {
            out.ambiguous();
          }
          throw out;
        }
        case FAIL_PATH_NOT_FOUND: {
          auto out = transaction_operation_failed(ec, e.what())
                       .cause(external_exception::ACTIVE_TRANSACTION_RECORD_ENTRY_NOT_FOUND)
                       .no_rollback();
          if (ambiguity_resolution_mode) {
            out.ambiguous();
          }
          throw out;
        }
        case FAIL_ATR_FULL: {
          auto out = transaction_operation_failed(ec, e.what())
                       .cause(external_exception::ACTIVE_TRANSACTION_RECORD_FULL)
                       .no_rollback();
          if (ambiguity_resolution_mode) {
            out.ambiguous();
          }
          throw out;
        }
        default: {
          CB_ATTEMPT_CTX_LOG_ERROR(self,
                                   "failed to commit transaction {}, attempt {}, "
                                   "ambiguity_resolution_mode {}, with error {}",
                                   self->transaction_id(),
                                   self->id(),
                                   ambiguity_resolution_mode,
                                   e.what());
          auto out = transaction_operation_failed(ec, e.what());
          if (ambiguity_resolution_mode) {
            out.no_rollback().ambiguous();
          }
          throw out;
        }
      }
    }
  });
}

void
attempt_context_impl::atr_commit_ambiguity_resolution()
{
  try {
    auto ec = error_if_expired_and_not_in_overtime(STAGE_ATR_COMMIT_AMBIGUITY_RESOLUTION, {});
    if (ec) {
      throw client_error(*ec, "atr_commit_ambiguity_resolution raised error");
    }
    ec = wait_for_hook([self = shared_from_this()](auto handler) mutable {
      return self->hooks_.before_atr_commit_ambiguity_resolution(self, std::move(handler));
    });
    if (ec) {
      throw client_error(*ec, "before_atr_commit_ambiguity_resolution hook threw error");
    }
    const std::string prefix(ATR_FIELD_ATTEMPTS + "." + id() + ".");
    // FIXME(CXXCBC-549): if atr_id_ is optional, we should report an error somehow
    // NOLINTNEXTLINE(bugprone-unchecked-optional-access)
    core::operations::lookup_in_request req{ atr_id_.value() };
    req.specs = lookup_in_specs{ lookup_in_specs::get(prefix + ATR_FIELD_STATUS).xattr() }.specs();
    auto barrier = std::make_shared<std::promise<result>>();
    auto f = barrier->get_future();
    overall()->cluster_ref().execute(
      req, [barrier](const core::operations::lookup_in_response& resp) {
        barrier->set_value(result::create_from_subdoc_response(resp));
      });
    auto res = wrap_operation_future(f);
    auto atr_status_raw = res.values[0].content_as<std::string>();
    CB_ATTEMPT_CTX_LOG_DEBUG(
      this, "atr_commit_ambiguity_resolution read atr state {}", atr_status_raw);
    auto atr_status = attempt_state_value(atr_status_raw);
    switch (atr_status) {
      case attempt_state::COMMITTED:
        return;
      case attempt_state::ABORTED:
        // aborted by another process?
        throw transaction_operation_failed(FAIL_OTHER, "transaction aborted externally").retry();
      default:
        throw transaction_operation_failed(FAIL_OTHER,
                                           "unexpected state found on ATR ambiguity resolution")
          .cause(ILLEGAL_STATE_EXCEPTION)
          .no_rollback();
    }
  } catch (const client_error& e) {
    const error_class ec = e.ec();
    switch (ec) {
      case FAIL_EXPIRY:
      case FAIL_HARD:
        throw transaction_operation_failed(ec, e.what()).no_rollback().ambiguous();
      case FAIL_TRANSIENT:
      case FAIL_OTHER:
        throw retry_operation(e.what());
      case FAIL_PATH_NOT_FOUND:
        throw transaction_operation_failed(ec, e.what())
          .cause(ACTIVE_TRANSACTION_RECORD_ENTRY_NOT_FOUND)
          .no_rollback()
          .ambiguous();
      case FAIL_DOC_NOT_FOUND:
        throw transaction_operation_failed(ec, e.what())
          .cause(ACTIVE_TRANSACTION_RECORD_NOT_FOUND)
          .no_rollback()
          .ambiguous();
      default:
        throw transaction_operation_failed(ec, e.what()).no_rollback().ambiguous();
    }
  }
}

void
attempt_context_impl::atr_complete()
{
  try {
    const result atr_res;
    auto ec = wait_for_hook([self = shared_from_this()](auto handler) mutable {
      return self->hooks_.before_atr_complete(self, std::move(handler));
    });
    if (ec) {
      throw client_error(*ec, "before_atr_complete hook threw error");
    }
    // if we have expired (and not in overtime mode), just raise the final
    // error.
    ec = error_if_expired_and_not_in_overtime(STAGE_ATR_COMPLETE, {});
    if (ec) {
      throw client_error(*ec, "atr_complete threw error");
    }
    // FIXME(CXXCBC-549): if atr_id_ is optional, we should report an error somehow
    // NOLINTBEGIN(bugprone-unchecked-optional-access)
    CB_ATTEMPT_CTX_LOG_DEBUG(this, "removing attempt {} from atr", atr_id_.value());
    const std::string prefix(ATR_FIELD_ATTEMPTS + "." + id());
    core::operations::mutate_in_request req{ atr_id_.value() };
    // NOLINTEND(bugprone-unchecked-optional-access)
    req.specs =
      couchbase::mutate_in_specs{
        couchbase::mutate_in_specs::remove(prefix).xattr(),
      }
        .specs();
    wrap_durable_request(req, overall()->config());
    auto barrier = std::make_shared<std::promise<result>>();
    auto f = barrier->get_future();
    overall()->cluster_ref().execute(
      req, [barrier](const core::operations::mutate_in_response& resp) {
        barrier->set_value(result::create_from_subdoc_response(resp));
      });
    wrap_operation_future(f);
    ec = wait_for_hook([self = shared_from_this()](auto handler) mutable {
      return self->hooks_.after_atr_complete(self, std::move(handler));
    });
    if (ec) {
      throw client_error(*ec, "after_atr_complete hook threw error");
    }
    state(attempt_state::COMPLETED);
  } catch (const client_error& er) {
    switch (const error_class ec = er.ec(); ec) {
      case FAIL_HARD:
        throw transaction_operation_failed(ec, er.what()).no_rollback().failed_post_commit();
      default:
        CB_ATTEMPT_CTX_LOG_INFO(this, "ignoring error in atr_complete {}", er.what());
    }
  }
}

void
attempt_context_impl::commit(VoidCallback&& cb)
{
  // for now, lets keep the blocking implementation
  std::thread([cb = std::move(cb), self = shared_from_this()]() mutable {
    try {
      self->commit();
      return cb({});
    } catch (const transaction_operation_failed&) {
      return cb(std::current_exception());
    } catch (const std::exception& e) {
      return cb(std::make_exception_ptr(transaction_operation_failed(FAIL_OTHER, e.what())));
    }
  }).detach();
}

void
attempt_context_impl::commit()
{
  CB_ATTEMPT_CTX_LOG_DEBUG(this, "waiting on ops to finish...");
  op_list_.wait_and_block_ops();
  existing_error(false);
  CB_ATTEMPT_CTX_LOG_DEBUG(this, "commit {}", id());
  if (op_list_.get_mode().is_query()) {
    auto barrier = std::make_shared<std::promise<void>>();
    auto f = barrier->get_future();
    commit_with_query([barrier](const std::exception_ptr& err) {
      if (err) {
        barrier->set_exception(err);
      } else {
        barrier->set_value();
      }
    });
    f.get();
  } else {
    if (check_expiry_pre_commit(STAGE_BEFORE_COMMIT, {})) {
      throw transaction_operation_failed(FAIL_EXPIRY, "transaction expired").expired();
    }
    if (atr_id_ && !atr_id_->key().empty() && !is_done_) {
      retry_op_exp<void>([self = shared_from_this()]() {
        self->atr_commit(false);
      });
      staged_mutations_->commit(shared_from_this());
      atr_complete();
      is_done_ = true;
    } else {
      // no mutation, no need to commit
      if (!is_done_) {
        CB_ATTEMPT_CTX_LOG_DEBUG(this,
                                 "calling commit on attempt that has got no mutations, skipping");
        is_done_ = true;
        return;
      } // do not rollback or retry
      throw transaction_operation_failed(FAIL_OTHER,
                                         "calling commit on attempt that is already completed")
        .no_rollback();
    }
  }
}

void
attempt_context_impl::atr_abort()
{
  try {
    auto ec = error_if_expired_and_not_in_overtime(STAGE_ATR_ABORT, {});
    if (ec) {
      throw client_error(*ec, "atr_abort check for expiry threw error");
    }
    ec = wait_for_hook([self = shared_from_this()](auto handler) mutable {
      return self->hooks_.before_atr_aborted(self, std::move(handler));
    });
    if (ec) {
      throw client_error(*ec, "before_atr_aborted hook threw error");
    }
    const std::string prefix(ATR_FIELD_ATTEMPTS + "." + id() + ".");
    // FIXME(CXXCBC-549): if atr_id_ is optional, we should report an error somehow
    // NOLINTNEXTLINE(bugprone-unchecked-optional-access)
    core::operations::mutate_in_request req{ atr_id_.value() };
    req.specs =
      couchbase::mutate_in_specs{
        couchbase::mutate_in_specs::upsert(prefix + ATR_FIELD_STATUS,
                                           attempt_state_name(attempt_state::ABORTED))
          .xattr()
          .create_path(),
        couchbase::mutate_in_specs::upsert(prefix + ATR_FIELD_TIMESTAMP_ROLLBACK_START,
                                           subdoc::mutate_in_macro::cas)
          .xattr()
          .create_path(),
      }
        .specs();
    staged_mutations_->extract_to(prefix, req);
    wrap_durable_request(req, overall()->config());
    auto barrier = std::make_shared<std::promise<result>>();
    auto f = barrier->get_future();
    overall()->cluster_ref().execute(
      req, [barrier](const core::operations::mutate_in_response& resp) {
        barrier->set_value(result::create_from_subdoc_response(resp));
      });
    wrap_operation_future(f);
    state(attempt_state::ABORTED);

    ec = wait_for_hook([self = shared_from_this()](auto handler) mutable {
      return self->hooks_.after_atr_aborted(self, std::move(handler));
    });
    if (ec) {
      throw client_error(*ec, "after_atr_aborted hook threw error");
    }
    CB_ATTEMPT_CTX_LOG_DEBUG(this, "rollback completed atr abort phase");
  } catch (const client_error& e) {
    auto ec = e.ec();
    CB_ATTEMPT_CTX_LOG_TRACE(this, "atr_abort got {} {}", ec, e.what());
    if (expiry_overtime_mode_.load()) {
      CB_ATTEMPT_CTX_LOG_DEBUG(this, "atr_abort got error \"{}\" while in overtime mode", e.what());
      throw transaction_operation_failed(FAIL_EXPIRY,
                                         std::string("expired in atr_abort with {} ") + e.what())
        .no_rollback()
        .expired();
    }
    CB_ATTEMPT_CTX_LOG_DEBUG(this, "atr_abort got error {}", ec);
    switch (ec) {
      case FAIL_EXPIRY:
        expiry_overtime_mode_ = true;
        throw retry_operation("expired, setting overtime mode and retry atr_abort");
      case FAIL_PATH_NOT_FOUND:
        throw transaction_operation_failed(ec, e.what())
          .no_rollback()
          .cause(ACTIVE_TRANSACTION_RECORD_ENTRY_NOT_FOUND);
      case FAIL_DOC_NOT_FOUND:
        throw transaction_operation_failed(ec, e.what())
          .no_rollback()
          .cause(ACTIVE_TRANSACTION_RECORD_NOT_FOUND);
      case FAIL_ATR_FULL:
        throw transaction_operation_failed(ec, e.what())
          .no_rollback()
          .cause(ACTIVE_TRANSACTION_RECORD_FULL);
      case FAIL_HARD:
        throw transaction_operation_failed(ec, e.what()).no_rollback();
      default:
        throw retry_operation("retry atr_abort");
    }
  }
}

void
attempt_context_impl::atr_rollback_complete()
{
  try {
    auto ec = error_if_expired_and_not_in_overtime(STAGE_ATR_ROLLBACK_COMPLETE, std::nullopt);
    if (ec) {
      throw client_error(*ec, "atr_rollback_complete raised error");
    }

    ec = wait_for_hook([self = shared_from_this()](auto handler) mutable {
      return self->hooks_.before_atr_rolled_back(self, std::move(handler));
    });
    if (ec) {
      throw client_error(*ec, "before_atr_rolled_back hook threw error");
    }
    const std::string prefix(ATR_FIELD_ATTEMPTS + "." + id());
    // FIXME(CXXCBC-549): if atr_id_ is optional, we should report an error somehow
    // NOLINTNEXTLINE(bugprone-unchecked-optional-access)
    core::operations::mutate_in_request req{ atr_id_.value() };
    req.specs =
      couchbase::mutate_in_specs{
        couchbase::mutate_in_specs::remove(prefix).xattr(),
      }
        .specs();
    wrap_durable_request(req, overall()->config());
    auto barrier = std::make_shared<std::promise<result>>();
    auto f = barrier->get_future();
    overall()->cluster_ref().execute(
      req, [barrier](const core::operations::mutate_in_response& resp) {
        barrier->set_value(result::create_from_subdoc_response(resp));
      });
    wrap_operation_future(f);
    state(attempt_state::ROLLED_BACK);
    ec = wait_for_hook([self = shared_from_this()](auto handler) mutable {
      return self->hooks_.after_atr_rolled_back(self, std::move(handler));
    });
    if (ec) {
      throw client_error(*ec, "after_atr_rolled_back hook threw error");
    }
    is_done_ = true;

  } catch (const client_error& e) {
    auto ec = e.ec();
    if (expiry_overtime_mode_.load()) {
      CB_ATTEMPT_CTX_LOG_DEBUG(
        this, "atr_rollback_complete error while in overtime mode {}", e.what());
      throw transaction_operation_failed(
        FAIL_EXPIRY, std::string("expired in atr_rollback_complete with {} ") + e.what())
        .no_rollback()
        .expired();
    }
    CB_ATTEMPT_CTX_LOG_DEBUG(this, "atr_rollback_complete got error {}", ec);
    // FIXME(SA): if atr_id_ is optional, we should report an error somehow
    // TODO(CXXCBC-549)
    // NOLINTBEGIN(bugprone-unchecked-optional-access)
    switch (ec) {
      case FAIL_DOC_NOT_FOUND:
      case FAIL_PATH_NOT_FOUND:
        CB_ATTEMPT_CTX_LOG_DEBUG(this, "atr {} not found, ignoring", atr_id_->key());
        is_done_ = true;
        break;
      case FAIL_ATR_FULL:
        CB_ATTEMPT_CTX_LOG_DEBUG(this, "atr {} full!", atr_id_->key());
        throw retry_operation(e.what());
      case FAIL_HARD:
        throw transaction_operation_failed(ec, e.what()).no_rollback();
      case FAIL_EXPIRY:
        CB_ATTEMPT_CTX_LOG_DEBUG(this, "timed out writing atr {}", atr_id_->key());
        throw transaction_operation_failed(ec, e.what()).no_rollback().expired();
      default:
        CB_ATTEMPT_CTX_LOG_DEBUG(this, "retrying atr_rollback_complete");
        throw retry_operation(e.what());
    }
    // NOLINTEND(bugprone-unchecked-optional-access)
  }
}
void
attempt_context_impl::rollback(VoidCallback&& cb)
{
  // for now, lets keep the blocking implementation
  std::thread([cb = std::move(cb), this]() mutable {
    if (op_list_.get_mode().is_query()) {
      return rollback_with_query(std::move(cb));
    }
    try {
      rollback();
      return cb({});
    } catch (const transaction_operation_failed&) {
      return cb(std::current_exception());
    } catch (const std::exception& e) {
      return cb(
        std::make_exception_ptr(transaction_operation_failed(FAIL_OTHER, e.what()).no_rollback()));
    } catch (...) {
      return cb(std::make_exception_ptr(
        transaction_operation_failed(FAIL_OTHER, "unexpected exception during rollback")));
    }
  }).detach();
}

void
attempt_context_impl::rollback()
{
  op_list_.wait_and_block_ops();
  CB_ATTEMPT_CTX_LOG_DEBUG(this, "rolling back {}", id());
  if (op_list_.get_mode().is_query()) {
    auto barrier = std::make_shared<std::promise<void>>();
    auto f = barrier->get_future();
    rollback_with_query([barrier](const std::exception_ptr& err) {
      if (err) {
        barrier->set_exception(err);
      } else {
        barrier->set_value();
      }
    });
    return f.get();
  }
  // check for expiry
  check_expiry_during_commit_or_rollback(STAGE_ROLLBACK, std::nullopt);
  if (!atr_id_ || atr_id_->key().empty() || state() == attempt_state::NOT_STARTED) {
    // TODO(SA): check this, but if we try to rollback an empty txn, we should
    // prevent a subsequent commit
    CB_ATTEMPT_CTX_LOG_DEBUG(this, "rollback called on txn with no mutations");
    is_done_ = true;
    return;
  }
  if (is_done()) {
    std::string msg("Transaction already done, cannot rollback");
    CB_ATTEMPT_CTX_LOG_ERROR(this, "{}", msg);
    // need to raise a FAIL_OTHER which is not retryable or rollback-able
    throw transaction_operation_failed(FAIL_OTHER, msg).no_rollback();
  }
  try {
    // (1) atr_abort
    retry_op_exp<void>([self = shared_from_this()]() {
      self->atr_abort();
    });
    // (2) rollback staged mutations
    staged_mutations_->rollback(shared_from_this());
    CB_ATTEMPT_CTX_LOG_DEBUG(this, "rollback completed unstaging docs");

    // (3) atr_rollback
    retry_op_exp<void>([self = shared_from_this()]() {
      self->atr_rollback_complete();
    });
  } catch (const client_error& e) {
    const error_class ec = e.ec();
    CB_ATTEMPT_CTX_LOG_ERROR(this,
                             "rollback transaction {}, attempt {} fail with error {}",
                             transaction_id(),
                             id(),
                             e.what());
    if (ec == FAIL_HARD) {
      throw transaction_operation_failed(ec, e.what()).no_rollback();
    }
  }
}

auto
attempt_context_impl::has_expired_client_side(std::string place,
                                              std::optional<const std::string> doc_id) -> bool
{
  const bool over = overall()->has_expired_client_side();
  const bool hook = hooks_.has_expired_client_side(shared_from_this(), place, std::move(doc_id));
  if (over) {
    CB_ATTEMPT_CTX_LOG_DEBUG(this, "{} expired in {}", id(), place);
  }
  if (hook) {
    CB_ATTEMPT_CTX_LOG_DEBUG(this, "{} fake expiry in {}", id(), place);
  }
  return over || hook;
}

auto
attempt_context_impl::check_expiry_pre_commit(std::string stage,
                                              std::optional<const std::string> doc_id) -> bool
{
  if (has_expired_client_side(stage, std::move(doc_id))) {
    CB_ATTEMPT_CTX_LOG_DEBUG(this,
                             "{} has expired in stage {}, entering expiry-overtime mode - will "
                             "make one attempt to rollback",
                             id(),
                             stage);

    // [EXP-ROLLBACK] Combo of setting this mode and throwing AttemptExpired
    // will result in an attempt to rollback, which will ignore expiry, and bail
    // out if anything fails
    expiry_overtime_mode_ = true;
    return true;
  }
  return false;
}

auto
attempt_context_impl::error_if_expired_and_not_in_overtime(const std::string& stage,
                                                           std::optional<const std::string> doc_id)
  -> std::optional<error_class>
{
  if (expiry_overtime_mode_.load()) {
    CB_ATTEMPT_CTX_LOG_DEBUG(
      this, "not doing expired check in {} as already in expiry-overtime", stage);
    return {};
  }
  if (has_expired_client_side(stage, std::move(doc_id))) {
    CB_ATTEMPT_CTX_LOG_DEBUG(this, "expired in {}", stage);
    return FAIL_EXPIRY;
  }
  return {};
}

void
attempt_context_impl::check_expiry_during_commit_or_rollback(
  const std::string& stage,
  std::optional<const std::string> doc_id)
{
  // [EXP-COMMIT-OVERTIME]
  if (!expiry_overtime_mode_.load()) {
    if (has_expired_client_side(stage, std::move(doc_id))) {
      CB_ATTEMPT_CTX_LOG_DEBUG(this,
                               "{} has expired in stage {}, entering expiry-overtime mode (one "
                               "attempt to complete commit)",
                               id(),
                               stage);
      expiry_overtime_mode_ = true;
    }
  } else {
    CB_ATTEMPT_CTX_LOG_DEBUG(
      this, "{} ignoring expiry in stage {}  as in expiry-overtime mode", id(), stage);
  }
}

void
attempt_context_impl::set_atr_pending_locked(
  const core::document_id& id,
  std::unique_lock<std::mutex>&& lock,
  std::function<void(std::optional<transaction_operation_failed>)>&& fn)
{
  try {
    if (staged_mutations_->empty()) {
      const std::string prefix(ATR_FIELD_ATTEMPTS + "." + this->id() + ".");
      if (!atr_id_) {
        return fn(
          transaction_operation_failed(FAIL_OTHER, std::string("ATR ID is not initialized")));
      }
      if (auto ec = error_if_expired_and_not_in_overtime(STAGE_ATR_PENDING, {})) {
        return fn(transaction_operation_failed(*ec, "transaction expired setting ATR").expired());
      }
      auto error_handler =
        [self = shared_from_this(),
         &lock](error_class ec,
                const std::string& message,
                const core::document_id& doc_id,
                std::function<void(std::optional<transaction_operation_failed>)>&& fn) mutable {
          transaction_operation_failed err(ec, message);
          CB_ATTEMPT_CTX_LOG_TRACE(self, "got {} trying to set atr to pending", message);
          if (self->expiry_overtime_mode_.load()) {
            return fn(err.no_rollback().expired());
          }
          switch (ec) {
            case FAIL_EXPIRY:
              self->expiry_overtime_mode_ = true;
              // this should trigger rollback (unlike the above when already in
              // overtime mode)
              return fn(err.expired());
            case FAIL_ATR_FULL:
              return fn(err);
            case FAIL_PATH_ALREADY_EXISTS:
              // assuming this got resolved, moving on as if ok
              return fn(std::nullopt);
            case FAIL_AMBIGUOUS:
              // Retry just this
              CB_ATTEMPT_CTX_LOG_DEBUG(self, "got FAIL_AMBIGUOUS, retrying set atr pending", ec);
              return self->overall()->after_delay(
                std::chrono::milliseconds(1), [self, doc_id, &lock, fn = std::move(fn)]() mutable {
                  self->set_atr_pending_locked(doc_id, std::move(lock), std::move(fn));
                });
            case FAIL_TRANSIENT:
              // Retry txn
              return fn(err.retry());
            case FAIL_HARD:
              return fn(err.no_rollback());
            default:
              return fn(err);
          }
        };
      return hooks_.before_atr_pending(
        shared_from_this(),
        [self = shared_from_this(),
         id,
         prefix,
         fn = std::move(fn),
         error_handler = std::move(error_handler)](auto ec) mutable {
          if (ec) {
            return error_handler(*ec, "before_atr_pending hook raised error", id, std::move(fn));
          }

          CB_ATTEMPT_CTX_LOG_DEBUG(self, "updating atr {}", self->atr_id_.value());

          const std::chrono::nanoseconds remaining = self->overall()->remaining();
          // This bounds the value to [0-timeout].  It should always be in this
          // range, this is just to protect against the application clock
          // changing.
          const long remaining_bounded_nanos =
            std::max(std::min(remaining.count(), self->overall()->config().timeout.count()),
                     static_cast<std::chrono::nanoseconds::rep>(0));
          const long remaining_bounded_msecs = remaining_bounded_nanos / 1'000'000;

          core::operations::mutate_in_request req{ self->atr_id_.value() };

          req.specs =
            couchbase::mutate_in_specs{
              couchbase::mutate_in_specs::insert(prefix + ATR_FIELD_TRANSACTION_ID,
                                                 self->overall()->transaction_id())
                .xattr()
                .create_path(),
              couchbase::mutate_in_specs::insert(prefix + ATR_FIELD_STATUS,
                                                 attempt_state_name(attempt_state::PENDING))
                .xattr()
                .create_path(),
              couchbase::mutate_in_specs::insert(prefix + ATR_FIELD_START_TIMESTAMP,
                                                 subdoc::mutate_in_macro::cas)
                .xattr()
                .create_path(),
              couchbase::mutate_in_specs::insert(prefix + ATR_FIELD_EXPIRES_AFTER_MSECS,
                                                 remaining_bounded_msecs)
                .xattr()
                .create_path(),
              // ExtStoreDurability
              couchbase::mutate_in_specs::insert(
                prefix + ATR_FIELD_DURABILITY_LEVEL,
                store_durability_level_to_string(self->overall()->config().level))
                .xattr()
                .create_path(),
              // subdoc::opcode::set_doc used in replace w/ empty path
              // ExtBinaryMetadata
              couchbase::mutate_in_specs::replace_raw({},
                                                      std::vector<std::byte>{ std::byte{ 0x00 } }),
            }
              .specs();
          req.store_semantics = couchbase::store_semantics::upsert;

          wrap_durable_request(req, self->overall()->config());
          return self->overall()->cluster_ref().execute(
            req,
            [self, fn = std::move(fn), error_handler = std::move(error_handler)](
              core::operations::mutate_in_response resp) mutable {
              auto ec = error_class_from_response(resp);
              if (ec) {
                return error_handler(
                  *ec,
                  resp.ctx.ec().message(),
                  { resp.ctx.bucket(), resp.ctx.scope(), resp.ctx.collection(), resp.ctx.id() },
                  std::move(fn));
              }
              return self->hooks_.after_atr_pending(
                self,
                [self,
                 fn = std::move(fn),
                 error_handler = std::move(error_handler),
                 resp = std::move(resp)](auto ec) mutable {
                  if (ec) {
                    return error_handler(
                      *ec,
                      fmt::format("after_atr_pending returned hook raised {}", *ec),
                      { resp.ctx.bucket(), resp.ctx.scope(), resp.ctx.collection(), resp.ctx.id() },
                      std::move(fn));
                  }

                  self->state(attempt_state::PENDING);
                  CB_ATTEMPT_CTX_LOG_DEBUG(self,
                                           "set ATR {} to Pending, got CAS (start time) {}",
                                           self->atr_id_.value(),
                                           resp.cas.value());
                  return fn(std::nullopt);
                });
            });
        });
    }
  } catch (const std::exception& e) {
    CB_ATTEMPT_CTX_LOG_ERROR(this, "unexpected error setting atr pending {}", e.what());
    return fn(transaction_operation_failed(FAIL_OTHER, "unexpected error setting atr pending"));
  }
}

auto
attempt_context_impl::check_for_own_write(const core::document_id& id) -> staged_mutation*
{
  staged_mutation* own_replace = staged_mutations_->find_replace(id);
  if (own_replace != nullptr) {
    return own_replace;
  }
  staged_mutation* own_insert = staged_mutations_->find_insert(id);
  if (own_insert != nullptr) {
    return own_insert;
  }
  return nullptr;
}

template<typename Handler>
void
attempt_context_impl::check_if_done(Handler& cb)
{
  if (is_done_) {
    return op_completed_with_error(
      std::forward<Handler>(cb),
      transaction_operation_failed(FAIL_OTHER,
                                   "Cannot perform operations after transaction has been "
                                   "committed or rolled back")
        .no_rollback());
  }
}

template<typename Handler>
void
attempt_context_impl::do_get(const core::document_id& id,
                             bool allow_replica,
                             std::optional<std::string> resolving_missing_atr_entry,
                             Handler&& cb)
{
  try {
    if (check_expiry_pre_commit(STAGE_GET, id.key())) {
      return cb(FAIL_EXPIRY, std::nullopt, "expired in do_get", std::nullopt);
    }

    // Check if we already have a staged insert/replace for this document AND we have the content
    // for it (i.e. the cluster does not support replace body_with_xattr)
    if (const staged_mutation* own_write = check_for_own_write(id); own_write != nullptr) {
      const auto own_write_content = own_write->staged_content();
      if (own_write_content.has_value()) {
        CB_ATTEMPT_CTX_LOG_DEBUG(this, "found own-write of mutated doc {}", id);
        return cb(std::nullopt,
                  std::nullopt,
                  std::nullopt,
                  transaction_get_result{
                    own_write->id(),
                    codec::encoded_value{ own_write_content.value(), own_write->staged_flags() },
                    own_write->cas().value(),
                    {},
                    {},
                  });
      }
    }
    if (const staged_mutation* own_remove = staged_mutations_->find_remove(id);
        own_remove != nullptr) {
      auto msg = fmt::format("found own-write of removed doc {}", id);
      CB_ATTEMPT_CTX_LOG_DEBUG(this, "{}", msg);
      return cb(FAIL_DOC_NOT_FOUND, std::nullopt, msg, std::nullopt);
    }

    return hooks_.before_doc_get(
      shared_from_this(),
      id.key(),
      [self = shared_from_this(),
       id,
       allow_replica,
       resolving_missing_atr_entry = std::move(resolving_missing_atr_entry),
       cb = std::forward<Handler>(cb)](auto ec) mutable {
        if (ec) {
          return cb(ec, std::nullopt, "before_doc_get hook raised error", std::nullopt);
        }

        return self->get_doc(
          id,
          allow_replica,
          [self,
           id,
           allow_replica,
           resolving_missing_atr_entry = std::move(resolving_missing_atr_entry),
           cb = std::move(cb)](std::optional<error_class> ec,
                               std::optional<external_exception> cause,
                               const std::optional<std::string>& err_message,
                               std::optional<transaction_get_result> doc) mutable {
            if (!ec && !doc) {
              // it just isn't there.
              return cb(std::nullopt, std::nullopt, std::nullopt, std::nullopt);
            }

            if (ec) {
              return cb(ec, cause, err_message, std::nullopt);
            }

            if (!doc->links().is_document_in_transaction()) {
              if (doc->links().is_deleted()) {
                CB_ATTEMPT_CTX_LOG_DEBUG(self,
                                         "doc not in txn, and is_deleted, so not returning it.");
                // doc has been deleted, not in txn, so don't return it
                return cb(std::nullopt, std::nullopt, std::nullopt, std::nullopt);
              }
              return cb(std::nullopt, std::nullopt, std::nullopt, doc);
            }

            if (doc->links().staged_attempt_id() == self->id()) {
              // This is a RYOW, and we can optimise here by not looking up the document's ATR.

              if (doc->links().is_document_being_removed()) {
                // The document is being removed by this attempt, return empty.
                return cb(std::nullopt, std::nullopt, std::nullopt, std::nullopt);
              }

              // Return the post-transaction version.
              return cb(std::nullopt,
                        std::nullopt,
                        std::nullopt,
                        transaction_get_result::create_from(
                          *doc, doc->links().staged_content_json_or_binary()));
            }

            CB_ATTEMPT_CTX_LOG_DEBUG(self,
                                     "doc {} in transaction, resolving_missing_atr_entry={}",
                                     *doc,
                                     resolving_missing_atr_entry.value_or("-"));

            if (resolving_missing_atr_entry.has_value() &&
                resolving_missing_atr_entry.value() == doc->links().staged_attempt_id()) {
              CB_ATTEMPT_CTX_LOG_DEBUG(self, "doc is in lost pending transaction");

              if (doc->links().is_document_being_inserted()) {
                // this document is being inserted, so should not be visible
                // yet
                return cb(std::nullopt, std::nullopt, std::nullopt, std::nullopt);
              }

              return cb(std::nullopt, std::nullopt, std::nullopt, doc);
            }

            const core::document_id doc_atr_id{ doc->links().atr_bucket_name().value(),
                                                doc->links().atr_scope_name().value(),
                                                doc->links().atr_collection_name().value(),
                                                doc->links().atr_id().value() };
            active_transaction_record::get_atr(
              self->cluster_ref(),
              doc_atr_id,
              [self, id, allow_replica, doc, cb = std::move(cb)](
                std::error_code ec2, std::optional<active_transaction_record> atr) mutable {
                if (!ec2 && atr) {
                  const active_transaction_record& atr_doc = atr.value();
                  std::optional<atr_entry> entry;
                  for (const auto& e : atr_doc.entries()) {
                    if (doc->links().staged_attempt_id().value() == e.attempt_id()) {
                      entry.emplace(e);
                      break;
                    }
                  }
                  bool ignore_doc = false;
                  auto content = doc->content();
                  if (entry) {
                    if (doc->links().staged_attempt_id() && entry->attempt_id() == self->id()) {
                      // Attempt is reading its own writes
                      // This is here as backup, it should be returned
                      // from the in-memory cache instead
                      content = doc->links().staged_content_json_or_binary();
                    } else {
                      auto err = check_forward_compat(forward_compat_stage::GETS_READING_ATR,
                                                      entry->forward_compat());
                      if (err) {
                        return cb(FAIL_OTHER, err->cause(), err->what(), std::nullopt);
                      }
                      switch (entry->state()) {
                        case attempt_state::COMPLETED:
                        case attempt_state::COMMITTED:
                          if (doc->links().is_document_being_removed()) {
                            ignore_doc = true;
                          } else {
                            content = doc->links().staged_content_json_or_binary();
                          }
                          break;
                        default:
                          if (doc->links().is_document_being_inserted()) {
                            // This document is being inserted, so should
                            // not be visible yet
                            ignore_doc = true;
                          }
                          break;
                      }
                    }
                  } else {
                    // failed to get the ATR entry
                    CB_ATTEMPT_CTX_LOG_DEBUG(self,
                                             "could not get ATR entry, checking again with {}",
                                             doc->links().staged_attempt_id().value_or("-"));
                    return self->do_get(id, allow_replica, doc->links().staged_attempt_id(), cb);
                  }
                  if (ignore_doc) {
                    return cb(std::nullopt, std::nullopt, std::nullopt, std::nullopt);
                  }
                  return cb(std::nullopt,
                            std::nullopt,
                            std::nullopt,
                            transaction_get_result::create_from(*doc, content));
                }
                // failed to get the ATR
                CB_ATTEMPT_CTX_LOG_DEBUG(self,
                                         "could not get ATR, checking again with {}",
                                         doc->links().staged_attempt_id().value_or("-"));
                return self->do_get(id, allow_replica, doc->links().staged_attempt_id(), cb);
              });
          });
      });
  } catch (const transaction_operation_failed&) {
    throw;
  } catch (const std::exception& ex) {
    std::ostringstream stream;
    stream << "got error while getting doc " << id.key() << ": " << ex.what();
    throw transaction_operation_failed(FAIL_OTHER, ex.what());
  }
}

namespace
{
template<typename LookupInRequest, typename Callback>
void
execute_lookup(attempt_context_impl* ctx, LookupInRequest& req, Callback&& cb)
{
  ctx->overall()->cluster_ref().execute(
    req, [ctx, cb = std::forward<Callback>(cb)](const auto& resp) {
      auto ec = error_class_from_response(resp);
      if (ec) {
        CB_ATTEMPT_CTX_LOG_TRACE(ctx, "get_doc got error {} : {}", resp.ctx.ec().message(), *ec);
        switch (*ec) {
          case FAIL_PATH_NOT_FOUND:
            return cb(ec,
                      external_exception_from_response(resp),
                      resp.ctx.ec().message(),
                      transaction_get_result::create_from(resp));
          default:
            return cb(
              ec, external_exception_from_response(resp), resp.ctx.ec().message(), std::nullopt);
        }
      } else {
        return cb(
          std::nullopt, std::nullopt, std::nullopt, transaction_get_result::create_from(resp));
      }
    });
}
} // namespace

void
attempt_context_impl::get_doc(const core::document_id& id,
                              bool allow_replica,
                              std::function<void(std::optional<error_class>,
                                                 std::optional<external_exception>,
                                                 std::optional<std::string>,
                                                 std::optional<transaction_get_result>)>&& cb)
{
  const auto specs =
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

  try {
    if (allow_replica) {
      cluster_ref().with_bucket_configuration(
        id.bucket(),
        [this, id, specs, cb = std::move(cb)](
          std::error_code ec, const std::shared_ptr<topology::configuration>& config) {
          if (ec) {
            cb(FAIL_OTHER,
               std::nullopt,
               "failed to check whether access_deleted is supported: " + ec.message(),
               std::nullopt);
            return;
          }
          core::operations::lookup_in_any_replica_request req{ id };
          req.read_preference = couchbase::read_preference::selected_server_group_or_all_available;
          req.specs = specs;
          req.access_deleted = config->capabilities.supports_subdoc_access_deleted();
          execute_lookup(this, req, cb);
        });
    } else {
      core::operations::lookup_in_request req{ id };
      req.access_deleted = true;
      req.specs = specs;
      execute_lookup(this, req, cb);
    }
  } catch (const std::exception& e) {
    return cb(FAIL_OTHER, std::nullopt, e.what(), std::nullopt);
  }
}

template<typename Handler, typename Delay>
void
attempt_context_impl::create_staged_insert_error_handler(const core::document_id& id,
                                                         const codec::encoded_value& content,
                                                         std::uint64_t cas,
                                                         Delay&& delay,
                                                         const std::string& op_id,
                                                         Handler&& cb,
                                                         error_class ec,
                                                         external_exception cause,
                                                         const std::string& message)
{
  CB_ATTEMPT_CTX_LOG_TRACE(this, "create_staged_insert got error class {}: {}", ec, message);
  if (expiry_overtime_mode_.load()) {
    return op_completed_with_error(
      std::forward<Handler>(cb),
      transaction_operation_failed(FAIL_EXPIRY, "attempt timed out").expired());
  }
  switch (ec) {
    case FAIL_EXPIRY:
      expiry_overtime_mode_ = true;
      return op_completed_with_error(
        std::forward<Handler>(cb), transaction_operation_failed(ec, "attempt timed-out").expired());
    case FAIL_TRANSIENT:
      return op_completed_with_error(
        std::forward<Handler>(cb),
        transaction_operation_failed(ec, "transient error in insert").retry());
    case FAIL_AMBIGUOUS:
      CB_ATTEMPT_CTX_LOG_DEBUG(this, "FAIL_AMBIGUOUS in create_staged_insert, retrying");
      delay();
      return create_staged_insert(id, content, cas, delay, op_id, std::forward<Handler>(cb));
    case FAIL_OTHER:
      return op_completed_with_error(
        std::forward<Handler>(cb),
        transaction_operation_failed(ec, "error in create_staged_insert").cause(cause));
    case FAIL_HARD:
      return op_completed_with_error(
        std::forward<Handler>(cb),
        transaction_operation_failed(ec, "error in create_staged_insert").no_rollback());
    case FAIL_DOC_ALREADY_EXISTS:
    case FAIL_CAS_MISMATCH: {
      // special handling for doc already existing
      CB_ATTEMPT_CTX_LOG_DEBUG(this, "found existing doc {}, may still be able to insert", id);
      auto error_handler =
        [self = shared_from_this(), id, op_id, content](
          error_class ec2, const std::string& err_message, Handler&& cb) mutable {
          CB_ATTEMPT_CTX_LOG_TRACE(self,
                                   "after a CAS_MISMATCH or DOC_ALREADY_EXISTS, "
                                   "then got error {} in create_staged_insert",
                                   ec2);
          if (self->expiry_overtime_mode_.load()) {
            return self->op_completed_with_error(
              std::move(cb),
              transaction_operation_failed(FAIL_EXPIRY, "attempt timed out").expired());
          }
          switch (ec2) {
            case FAIL_DOC_NOT_FOUND:
            case FAIL_TRANSIENT:
              return self->op_completed_with_error(
                std::move(cb),
                transaction_operation_failed(
                  ec2, fmt::format("error {} while handling existing doc in insert", err_message))
                  .retry());
            default:
              return self->op_completed_with_error(
                std::move(cb),
                transaction_operation_failed(
                  ec2,
                  fmt::format("failed getting doc in create_staged_insert with {}", err_message)));
          }
        };
      return hooks_.before_get_doc_in_exists_during_staged_insert(
        shared_from_this(),
        id.key(),
        [self = shared_from_this(),
         id,
         content,
         op_id,
         cb = std::forward<Handler>(cb),
         error_handler,
         delay](auto ec) mutable {
          if (ec) {
            return error_handler(*ec,
                                 fmt::format("before_get_doc_in_exists_during_"
                                             "staged_insert hook raised {}",
                                             *ec),
                                 std::forward<Handler>(cb));
          }
          return self->get_doc(
            id,
            false,
            [self, id, content, op_id, cb = std::forward<Handler>(cb), error_handler, delay](
              std::optional<error_class> ec3,
              std::optional<external_exception> /* cause */,
              std::optional<std::string> err_message,
              std::optional<transaction_get_result> doc) mutable {
              if (!ec3) {
                if (doc) {
                  CB_ATTEMPT_CTX_LOG_DEBUG(
                    self,
                    "document {} exists, is_in_transaction {}, is_deleted {} ",
                    doc->id(),
                    doc->links().is_document_in_transaction(),
                    doc->links().is_deleted());

                  if (auto err = check_forward_compat(
                        forward_compat_stage::WRITE_WRITE_CONFLICT_INSERTING_GET,
                        doc->links().forward_compat());
                      err) {
                    return self->op_completed_with_error(std::forward<Handler>(cb), *err);
                  }
                  if (!doc->links().is_document_in_transaction() && doc->links().is_deleted()) {
                    // it is just a deleted doc, so we are ok.  Let's try again,
                    // but with the cas
                    CB_ATTEMPT_CTX_LOG_DEBUG(self,
                                             "create staged insert found existing deleted doc, "
                                             "retrying with cas {}",
                                             doc->cas().value());
                    delay();
                    return self->create_staged_insert(
                      id, content, doc->cas().value(), delay, op_id, std::forward<Handler>(cb));
                  }
                  if (!doc->links().is_document_in_transaction()) {
                    // doc was inserted outside txn elsewhere
                    CB_ATTEMPT_CTX_LOG_TRACE(
                      self, "doc {} not in txn - was inserted outside txn", id);
                    return self->op_completed_with_error(
                      std::forward<Handler>(cb),
                      document_exists({ couchbase::errc::transaction_op::document_exists,
                                        key_value_error_context() }));
                  }
                  if (doc->links().staged_attempt_id() == self->id()) {
                    if (doc->links().staged_operation_id() == op_id) {
                      // this is us dealing with resolving an ambiguity.  So, lets
                      // just update the staged_mutation with the correct cas and
                      // continue...
                      self->staged_mutations_->add(staged_mutation{
                        staged_mutation_type::INSERT,
                        doc->id(),
                        doc->cas(),
                        content.data,
                        content.flags,
                        doc->content().flags,
                        doc->metadata(),
                      });
                      return self->op_completed_with_callback(std::forward<Handler>(cb), doc);
                    }
                    return self->op_completed_with_error(
                      std::forward<Handler>(cb),
                      transaction_operation_failed(
                        FAIL_OTHER, "concurrent operations on a document are not allowed")
                        .cause(CONCURRENT_OPERATIONS_DETECTED_ON_SAME_DOCUMENT));
                  }
                  // CBD-3787 - Only a staged insert is ok to overwrite
                  if (doc->links().op() && *doc->links().op() != "insert") {
                    return self->op_completed_with_error(
                      std::forward<Handler>(cb),
                      document_exists("doc exists, not a staged insert"));
                  }
                  self->check_and_handle_blocking_transactions(
                    *doc,
                    forward_compat_stage::WRITE_WRITE_CONFLICT_INSERTING,
                    [self, id, op_id, content, doc, cb = std::forward<Handler>(cb), delay](
                      std::optional<transaction_operation_failed> err) mutable {
                      if (err) {
                        return self->op_completed_with_error(std::move(cb), *err);
                      }
                      CB_ATTEMPT_CTX_LOG_DEBUG(self,
                                               "doc ok to overwrite, retrying create_staged_insert "
                                               "with cas {}",
                                               doc->cas().value());
                      delay();
                      return self->create_staged_insert(
                        id, content, doc->cas().value(), delay, op_id, std::forward<Handler>(cb));
                    });
                } else {
                  // no doc now, just retry entire txn
                  CB_ATTEMPT_CTX_LOG_TRACE(
                    self, "got {} from get_doc in exists during staged insert", *ec3);
                  return self->op_completed_with_error(
                    std::move(cb),
                    transaction_operation_failed(FAIL_DOC_NOT_FOUND,
                                                 "insert failed as the doc existed, "
                                                 "but now seems to not exist")
                      .retry());
                }
              } else {
                return error_handler(*ec3, *err_message, std::forward<Handler>(cb));
              }
            });
        });
    }
    default:
      return op_completed_with_error(
        std::forward<Handler>(cb),
        transaction_operation_failed(ec, "failed in create_staged_insert").retry());
  }
}

template<typename Handler, typename Delay>
void
attempt_context_impl::create_staged_insert(const core::document_id& id,
                                           codec::encoded_value content,
                                           std::uint64_t cas,
                                           Delay&& delay,
                                           const std::string& op_id,
                                           Handler&& cb)
{
  if (auto ec = error_if_expired_and_not_in_overtime(STAGE_CREATE_STAGED_INSERT, id.key()); ec) {
    return create_staged_insert_error_handler(id,
                                              std::move(content),
                                              cas,
                                              std::forward<Delay>(delay),
                                              op_id,
                                              std::forward<Handler>(cb),
                                              *ec,
                                              UNKNOWN,
                                              "create_staged_insert expired and not in overtime");
  }

  auto ec = wait_for_hook([self = shared_from_this(), key = id.key()](auto handler) mutable {
    return self->hooks_.before_staged_insert(self, key, std::move(handler));
  });
  if (ec) {
    return create_staged_insert_error_handler(id,
                                              std::move(content),
                                              cas,
                                              std::forward<Delay>(delay),
                                              op_id,
                                              std::forward<Handler>(cb),
                                              *ec,
                                              UNKNOWN,
                                              "before_staged_insert hook threw error");
  }
  CB_ATTEMPT_CTX_LOG_DEBUG(this, "about to insert staged doc {} with cas {}", id, cas);
  core::operations::mutate_in_request req{ id };
  const bool binary =
    codec::codec_flags::has_common_flags(content.flags, codec::codec_flags::binary_common_flags);
  auto txn = create_document_metadata("insert", op_id, {}, content.flags);
  req.specs =
    mutate_in_specs{
      mutate_in_specs::upsert_raw("txn", core::utils::to_binary(jsonify(txn)))
        .xattr()
        .create_path(),
      mutate_in_specs::upsert_raw(binary ? "txn.op.bin" : "txn.op.stgd", content.data)
        .xattr()
        .binary(binary),
      mutate_in_specs::upsert("txn.op.crc32", subdoc::mutate_in_macro::value_crc32c)
        .xattr()
        .create_path(),
    }
      .specs();
  req.durability_level = overall()->config().level;
  req.access_deleted = true;
  req.create_as_deleted = true;
  req.flags = content.flags;
  req.cas = couchbase::cas(cas);
  req.store_semantics =
    cas == 0 ? couchbase::store_semantics::insert : couchbase::store_semantics::replace;
  wrap_durable_request(req, overall()->config());
  overall()->cluster_ref().execute(
    req,
    [self = shared_from_this(),
     id,
     content = std::move(content),
     cas,
     op_id,
     cb = std::forward<Handler>(cb),
     delay = std::forward<Delay>(delay)](core::operations::mutate_in_response resp) mutable {
      if (auto ec = error_class_from_response(resp); ec) {
        return self->create_staged_insert_error_handler(id,
                                                        std::move(content),
                                                        cas,
                                                        std::forward<Delay>(delay),
                                                        op_id,
                                                        std::forward<Handler>(cb),
                                                        *ec,
                                                        external_exception_from_response(resp),
                                                        resp.ctx.ec().message());
      }
      return self->hooks_.after_staged_insert_complete(
        self,
        id.key(),
        [self,
         id,
         content = std::move(content),
         cas,
         op_id,
         cb = std::forward<Handler>(cb),
         delay = std::forward<Delay>(delay),
         resp = std::move(resp)](auto ec) mutable {
          if (ec) {
            auto msg =
              (resp.ctx.ec() ? resp.ctx.ec().message() : "after_staged_insert hook threw error");
            return self->create_staged_insert_error_handler(id,
                                                            std::move(content),
                                                            cas,
                                                            std::forward<Delay>(delay),
                                                            op_id,
                                                            std::forward<Handler>(cb),
                                                            *ec,
                                                            external_exception_from_response(resp),
                                                            msg);
          }

          CB_ATTEMPT_CTX_LOG_DEBUG(
            self, "inserted doc {} CAS={}, {}", id, resp.cas.value(), resp.ctx.ec().message());

          self->supports_replace_body_with_xattr(
            id.bucket(),
            [self,
             id,
             content = std::move(content),
             cas,
             op_id,
             delay = std::forward<Delay>(delay),
             resp = std::move(resp),
             cb = std::forward<Handler>(cb)](auto ec, bool supports) mutable {
              if (ec) {
                return self->create_staged_insert_error_handler(
                  id,
                  std::move(content),
                  cas,
                  std::forward<Delay>(delay),
                  op_id,
                  std::forward<Handler>(cb),
                  FAIL_OTHER,
                  UNKNOWN,
                  "failed to check whether replace_body_with_xattr is supported: " + ec.message());
              }

              std::optional<codec::encoded_value> staged_content_json{};
              std::optional<codec::encoded_value> staged_content_binary{};
              if (codec::codec_flags::has_common_flags(content.flags,
                                                       codec::codec_flags::json_common_flags)) {
                staged_content_json = content;
              } else if (codec::codec_flags::has_common_flags(
                           content.flags, codec::codec_flags::binary_common_flags)) {
                staged_content_binary = content;
              }

              transaction_get_result out{
                id,
                content,
                resp.cas.value(),
                transaction_links{
                  self->atr_id_->key(),
                  id.bucket(),
                  id.scope(),
                  id.collection(),
                  self->overall()->transaction_id(),
                  self->id(),
                  op_id,
                  std::move(staged_content_json),
                  std::move(staged_content_binary),
                  std::nullopt,
                  std::nullopt,
                  std::nullopt,
                  std::nullopt,
                  "insert",
                  std::nullopt,
                  true,
                },
                std::nullopt,
              };

              auto [staged_content, staged_flags] = out.links().staged_content_json_or_binary();

              self->staged_mutations_->add(staged_mutation{
                staged_mutation_type::INSERT,
                id,
                resp.cas,
                supports ? std::nullopt
                         : std::make_optional(staged_content), // We don't store the staged contents
                                                               // if the cluster supports
                                                               // replace_body_with_xattr
                staged_flags,
                staged_flags,
                out.metadata(),
              });
              return self->op_completed_with_callback(std::forward<Handler>(cb),
                                                      std::optional{ std::move(out) });
            });
        });
    });
}

void
attempt_context_impl::ensure_open_bucket(const std::string& bucket_name,
                                         std::function<void(std::error_code)>&& handler) const
{
  if (bucket_name.empty()) {
    CB_LOG_DEBUG("ensure_open_bucket called with empty bucket_name");
    return handler(couchbase::errc::common::bucket_not_found);
  }
  cluster_ref().open_bucket(bucket_name, [handler = std::move(handler)](std::error_code ec) {
    handler(ec);
  });
}

void
attempt_context_impl::supports_replace_body_with_xattr(
  const std::string& bucket_name,
  std::function<void(std::error_code, bool)>&& handler) const
{
  cluster_ref().with_bucket_configuration(
    bucket_name,
    [handler = std::move(handler)](std::error_code ec,
                                   const std::shared_ptr<topology::configuration>& config) {
      if (ec) {
        handler(ec, {});
        return;
      }

      // We use subdoc_revive_document instead of subdoc_replace_body_with_xattr.
      // The version where subdoc_replace_body_with_xattr was released (7.0) contained a significant
      // bug.
      // (https://github.com/couchbaselabs/couchbase-transactions-specs/blob/master/transactions-stages.md#supportsreplacebodywithxattr)
      handler(
        {}, config->capabilities.has_bucket_capability(bucket_capability::subdoc_revive_document));
    });
}

void
attempt_context_impl::remove(couchbase::transactions::transaction_get_result doc,
                             couchbase::transactions::async_err_handler&& handler)
{
  remove(transaction_get_result(doc),
         [handler = std::move(handler)](const std::exception_ptr& e) mutable {
           wrap_err_callback_for_async_api(e, std::move(handler));
         });
}

auto
attempt_context_impl::remove(const couchbase::transactions::transaction_get_result& doc)
  -> couchbase::error
{
  return wrap_void_call_for_public_api([self = shared_from_this(), doc]() {
    self->remove(transaction_get_result(doc));
  });
}

auto
attempt_context_impl::get(const couchbase::collection& coll, const std::string& id)
  -> std::pair<couchbase::error, couchbase::transactions::transaction_get_result>
{
  auto [ctx, res] = wrap_call_for_public_api(
    [self = shared_from_this(), coll, id]() mutable -> transaction_get_result {
      auto ret = self->get_optional({ coll.bucket_name(), coll.scope_name(), coll.name(), id });
      if (ret) {
        return ret.value();
      }
      return {};
    });
  if (!ctx.ec() && res.cas().empty()) {
    return { { errc::transaction_op::document_not_found }, res };
  }
  return { ctx, res };
}
void
attempt_context_impl::get(const couchbase::collection& coll,
                          std::string id,
                          couchbase::transactions::async_result_handler&& handler)
{
  get_optional({ coll.bucket_name(), coll.scope_name(), coll.name(), std::move(id) },
               [handler = std::move(handler)](const std::exception_ptr& err,
                                              std::optional<transaction_get_result> res) mutable {
                 if (!res) {
                   return handler({ errc::transaction_op::document_not_found }, {});
                 }
                 return wrap_callback_for_async_public_api(err, std::move(res), std::move(handler));
               });
}
void
attempt_context_impl::query(std::string statement,
                            couchbase::transactions::transaction_query_options opts,
                            std::optional<std::string> query_context,
                            couchbase::transactions::async_query_handler&& handler)
{
  query(statement,
        opts,
        query_context,
        [handler = std::move(handler)](const std::exception_ptr& err,
                                       std::optional<core::operations::query_response> resp) {
          if (err) {
            try {
              std::rethrow_exception(err);
            } catch (const transaction_operation_failed& e) {
              return handler(core::impl::make_error(e), {});
            } catch (const op_exception& ex) {
              return handler(core::impl::make_error(ex), {});
            } catch (...) {
              // just in case...
              return handler({ couchbase::errc::transaction_op::generic }, {});
            }
          }
          auto [ctx, res] = core::impl::build_transaction_query_result(*resp);
          if (ctx.ec()) {
            // This should have already been converted to an exception by handle_query_error,
            // which we handle above. Let's return an error here just in case
            std::string msg = "Txns query error occured that should have been handled further "
                              "upstream, which might indicate a bug.";
            if (std::holds_alternative<query_error_context>(ctx.cause())) {
              return handler({ ctx.ec(),
                               std::move(msg),
                               {},
                               impl::make_error(std::get<query_error_context>(ctx.cause())) },
                             {});
            }
            return handler({ ctx.ec(), std::move(msg) }, {});
          }
          return handler({}, res);
        });
}

void
attempt_context_impl::existing_error(bool prev_op_failed)
{
  if (!errors_.empty()) {
    errors_.do_throw(
      (prev_op_failed ? std::make_optional(PREVIOUS_OPERATION_FAILED) : std::nullopt));
  }
}

void
attempt_context_impl::handle_err_from_callback(const std::exception_ptr& e)
{
  try {
    std::rethrow_exception(e);
  } catch (const transaction_operation_failed& ex) {
    CB_ATTEMPT_CTX_LOG_ERROR(
      this, "op callback called a txn operation that threw exception {}", ex.what());
    op_list_.decrement_ops();
    // presumably that op called op_completed_with_error already, so
    // don't do anything here but swallow it.
  } catch (const async_operation_conflict& op_ex) {
    // the count isn't changed when this is thrown, so just swallow it and log
    CB_ATTEMPT_CTX_LOG_ERROR(
      this, "op callback called a txn operation that threw exception {}", op_ex.what());
  } catch (const op_exception& op_ex) {
    CB_ATTEMPT_CTX_LOG_WARNING(this,
                               "op callback called a txn operation that "
                               "threw (and didn't handle) a op_exception {}",
                               op_ex.what());
    errors_.push_back(
      transaction_operation_failed(error_class_from_external_exception(op_ex.cause()), op_ex.what())
        .cause(op_ex.cause()));
    op_list_.decrement_ops();
  } catch (const std::exception& std_ex) {
    // if the callback throws something which wasn't handled
    // we just want to handle as a rollback
    CB_ATTEMPT_CTX_LOG_ERROR(this, "op callback threw exception {}", std_ex.what());
    errors_.push_back(transaction_operation_failed(FAIL_OTHER, std_ex.what()));
    op_list_.decrement_ops();
  } catch (...) {
    // could be something really arbitrary, still...
    CB_ATTEMPT_CTX_LOG_ERROR(this, "op callback threw unexpected exception");
    errors_.push_back(transaction_operation_failed(FAIL_OTHER, "unexpected error"));
    op_list_.decrement_ops();
  }
}

void
attempt_context_impl::op_completed_with_error(const VoidCallback& cb, const std::exception_ptr& err)
{
  try {
    std::rethrow_exception(err);
  } catch (const transaction_operation_failed& e) {
    // if this is a transaction_operation_failed, we need to cache it before
    // moving on...
    errors_.push_back(e);
    try {
      op_list_.decrement_in_flight();
      cb(std::current_exception());
      op_list_.decrement_ops();
    } catch (...) {
      handle_err_from_callback(std::current_exception());
    }
  } catch (...) {
    try {
      op_list_.decrement_in_flight();
      cb(std::current_exception());
      op_list_.decrement_ops();
    } catch (...) {
      handle_err_from_callback(std::current_exception());
    }
  }
}

auto
attempt_context_impl::is_done() const -> bool
{
  return is_done_;
}

auto
attempt_context_impl::overall() const -> std::shared_ptr<transaction_context>
{
  return overall_.lock();
}

auto
attempt_context_impl::transaction_id() const -> const std::string&
{
  return overall()->transaction_id();
}

auto
attempt_context_impl::id() const -> const std::string&
{
  return overall()->current_attempt().id;
}

auto
attempt_context_impl::state() const -> attempt_state
{
  return overall()->current_attempt().state;
}

void
attempt_context_impl::state(attempt_state s) const
{
  overall()->current_attempt_state(s);
}

auto
attempt_context_impl::atr_id() const -> const std::string&
{
  return overall()->atr_id();
}

void
attempt_context_impl::atr_id(const std::string& atr_id) const
{
  overall()->atr_id(atr_id);
}

auto
attempt_context_impl::atr_collection() const -> const std::string&
{
  return overall()->atr_collection();
}

void
attempt_context_impl::atr_collection_name(const std::string& coll) const
{
  overall()->atr_collection(coll);
}

auto
attempt_context_impl::expiry_time() const -> std::chrono::steady_clock::time_point
{
  return overall()->expiry_time();
}
} // namespace couchbase::core::transactions
