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

#include "get_multi_orchestrator.hxx"

#include "active_transaction_record.hxx"
#include "attempt_context_impl.hxx"
#include "core/document_id.hxx"
#include "core/transactions/error_class.hxx"
#include "core/transactions/exceptions.hxx"
#include "forward_compat.hxx"

#include <algorithm>
#include <chrono>
#include <exception>
#include <queue>
#include <vector>

namespace couchbase::core::transactions
{
enum class get_multi_mode : std::uint8_t {
  prioritise_latency,
  disable_read_skew_detection,
  prioritise_read_skew_detection,
};

namespace
{
auto
convert_mode(transaction_get_multi_mode mode) -> get_multi_mode
{
  switch (mode) {
    case transaction_get_multi_mode::prioritise_latency:
      return get_multi_mode::prioritise_latency;
    case transaction_get_multi_mode::disable_read_skew_detection:
      return get_multi_mode::disable_read_skew_detection;
    case transaction_get_multi_mode::prioritise_read_skew_detection:
      return get_multi_mode::prioritise_read_skew_detection;
  }
  return get_multi_mode::prioritise_latency;
}

auto
convert_mode(transaction_get_multi_replicas_from_preferred_server_group_mode mode) -> get_multi_mode
{
  switch (mode) {
    case transaction_get_multi_replicas_from_preferred_server_group_mode::prioritise_latency:
      return get_multi_mode::prioritise_latency;
    case transaction_get_multi_replicas_from_preferred_server_group_mode::
      disable_read_skew_detection:
      return get_multi_mode::disable_read_skew_detection;
    case transaction_get_multi_replicas_from_preferred_server_group_mode::
      prioritise_read_skew_detection:
      return get_multi_mode::prioritise_read_skew_detection;
  }
  return get_multi_mode::prioritise_latency;
}
} // namespace

enum class get_multi_phase : std::uint8_t {
  first_doc_fetch,
  subsequent_to_first_doc_fetch,
  discovered_docs_in_t1,
  resolving_t1_atr_entry_missing,
};

struct get_multi_spec {
  std::size_t index{};
  core::document_id id{};
};

// TODO(SA): I believe it should be accessible as an object directly
struct transaction_id {
  std::string transaction;
  std::string attempt;
  std::string operation;

  auto operator==(const transaction_id& other) const -> bool
  {
    return transaction == other.transaction && attempt == other.attempt &&
           operation == other.operation;
  }
  auto operator<(const transaction_id& other) const -> bool
  {
    if (transaction != other.transaction) {
      return transaction < other.transaction;
    }

    if (attempt != other.attempt) {
      return attempt < other.attempt;
    }

    return operation < other.operation;
  }
};

struct get_multi_result {
  get_multi_spec spec;
  std::optional<transaction_get_result> get_result{};
  std::exception_ptr error{ nullptr };

  [[nodiscard]] auto doc_exists() const -> bool
  {
    return get_result.has_value();
  }

  [[nodiscard]] auto has_transactional_metadata() const -> bool
  {
    if (const auto& result = get_result; result) {
      return result->links().atr_id().has_value();
    }
    return false;
  }

  [[nodiscard]] auto extract_transaction_id() const -> std::optional<transaction_id>
  {
    if (const auto& result = get_result; result) {
      auto txn = result->links().staged_transaction_id();
      auto atmpt = result->links().staged_attempt_id();
      auto op = result->links().staged_operation_id();

      if (txn && atmpt && op) {
        return transaction_id{
          txn.value(),
          atmpt.value(),
          op.value(),
        };
      }
    }
    return {};
  }

  void copy_content_from_staged_operation_into_result()
  {
    if (auto& result = get_result; result) {
      result->content(result->links().staged_content_json_or_binary());
    }
  }

  [[nodiscard]] auto extract_atr_document_id() const -> std::optional<core::document_id>
  {
    if (const auto& result = get_result; result) {
      auto id = result->links().atr_id();
      auto bucket = result->links().atr_bucket_name();
      auto scope = result->links().atr_scope_name();
      auto collection = result->links().atr_collection_name();

      if (id && bucket && scope && collection) {
        return core::document_id{
          bucket.value(),
          scope.value(),
          collection.value(),
          id.value(),
        };
      }
    }
    return {};
  }
};

struct classified_error {
  core::transactions::error_class error_class;
  core::transactions::external_exception cause;
};

auto
classify_error(const std::exception_ptr& err) -> classified_error
{
  try {
    std::rethrow_exception(err);
  } catch (const op_exception& e) {
    return classified_error{ error_class_from_external_exception(e.cause()), e.cause() };
  } catch (const transaction_operation_failed& e) {
    return classified_error{ e.ec(), e.cause() };
  } catch (...) {
    return classified_error{ error_class::FAIL_OTHER, external_exception::UNKNOWN };
  }
  return classified_error{ error_class::FAIL_OTHER, external_exception::UNKNOWN };
}

auto
contains_mutation(const std::optional<std::vector<doc_record>>& mutated_ids,
                  const core::document_id& id) -> bool
{
  if (!mutated_ids) {
    return false;
  }
  return std::any_of(mutated_ids->begin(), mutated_ids->end(), [&id](const auto& mutation) {
    return mutation == id;
  });
}

class get_multi_operation : public std::enable_shared_from_this<get_multi_operation>
{
public:
  static constexpr std::size_t default_number_of_concurrent_requests{ 100 };

  ~get_multi_operation() = default;
  get_multi_operation(const get_multi_operation&) = delete;
  get_multi_operation(get_multi_operation&&) = delete;
  auto operator=(const get_multi_operation&) -> get_multi_operation& = delete;
  auto operator=(get_multi_operation&&) -> get_multi_operation& = delete;

  get_multi_operation(
    std::shared_ptr<attempt_context_impl> attempt,
    const std::vector<core::document_id>& ids,
    get_multi_mode mode,
    std::size_t number_of_concurrent_requests,
    bool use_replicas,
    utils::movable_function<void(std::exception_ptr, std::vector<get_multi_result>)> callback)
    : attempt_{ std::move(attempt) }
    , responses_left_{ ids.size() }
    , mode_{ mode }
    , number_of_concurrent_requests_{ number_of_concurrent_requests }
    , use_replicas_{ use_replicas } // TODO(SA): weird warning
                                    // NOLINTNEXTLINE(bugprone-throw-keyword-missing)
    , callback_{ std::move(callback) }
  {
    results_.resize(ids.size());
    for (std::size_t index = 0; index < ids.size(); ++index) {
      specs_.emplace_back(get_multi_spec{ index, ids[index] });
      to_fetch_.emplace(get_multi_spec{ index, ids[index] });
    }
  }

  void handle_individual_document_error(get_multi_spec spec, const std::exception_ptr& err)
  {
    auto index = spec.index;

    if (err == nullptr) {
      results_[index] = { std::move(spec), {}, {} };
    } else {
      auto [ec, cause] = classify_error(err);

      if (cause == DOCUMENT_UNRETRIEVABLE_EXCEPTION || cause == DOCUMENT_NOT_FOUND_EXCEPTION) {
        results_[index] = { std::move(spec), {}, {} };
      } else {
        results_[index] = { std::move(spec), {}, err };
      }
    }

    --responses_left_;
  }

  void handle_individual_document_success(get_multi_spec spec,
                                          std::optional<transaction_get_result> res)
  {
    auto index = spec.index;
    results_[index] = { std::move(spec), std::move(res), {} };
    --responses_left_;
  }

  auto pop_next_spec() -> std::optional<get_multi_spec>
  {
    if (to_fetch_.empty()) {
      return {};
    }
    auto spec = to_fetch_.front();
    to_fetch_.pop();
    return spec;
  }

  void invoke_callback(std::exception_ptr error = nullptr)
  {
    if (auto callback = std::move(callback_); callback) {
      callback(std::move(error), std::move(results_));
    }
  }

  void retry(std::queue<get_multi_spec> specs)
  {
    to_fetch_ = std::move(specs);
    responses_left_ = to_fetch_.size();
    fetch_multiple_documents();
  }

  void reset_and_retry()
  {
    std::queue<get_multi_spec> to_fetch;
    for (const auto& spec : specs_) {
      to_fetch.emplace(spec);
    }
    results_.clear();
    if (phase_ != get_multi_phase::first_doc_fetch) {
      phase_ = get_multi_phase::subsequent_to_first_doc_fetch;
    }
    retry(std::move(to_fetch));
  }

  void completed()
  {
    invoke_callback();
  }

  void resolve_read_skew()
  {
    std::string other_attempt_id;
    document_id atr_document_id{};

    for (const auto& result : results_) {
      if (!result.doc_exists()) {
        continue;
      }

      auto txn_id = result.extract_transaction_id();
      if (!txn_id) {
        continue;
      }
      if (other_attempt_id.empty()) {
        auto atr_id = result.extract_atr_document_id();
        if (!atr_id) {
          continue;
        }

        other_attempt_id = txn_id->attempt;
        atr_document_id = atr_id.value();

      } else if (other_attempt_id != txn_id->attempt) {
        return reset_and_retry();
      }
    }

    if (other_attempt_id.empty()) {
      return reset_and_retry();
    }

    active_transaction_record::get_atr(
      attempt_->cluster_ref(),
      atr_document_id,
      [other_attempt_id, self = shared_from_this()](std::error_code ec,
                                                    std::optional<active_transaction_record> atr) {
        if (ec) {
          return self->reset_and_retry();
        }

        std::vector<get_multi_result*> fetched_in_t1;
        for (auto& result : self->results_) {
          if (result.doc_exists()) {
            auto txn_id = result.extract_transaction_id();
            if (txn_id && txn_id->attempt == other_attempt_id) {
              fetched_in_t1.push_back(&result);
            }
          }
        }

        if (atr) {
          std::optional<atr_entry> attempt{};
          for (const auto& entry : atr->entries()) {
            if (entry.attempt_id() == other_attempt_id) {
              attempt = entry;
            }
          }
          if (attempt) {
            auto state = attempt->state();

            if (state == attempt_state::PENDING || state == attempt_state::ABORTED) {
              return self->completed();
            }

            if (state == attempt_state::COMMITTED) {
              if (self->phase_ == get_multi_phase::subsequent_to_first_doc_fetch) {
                std::vector<get_multi_result> were_in_t1;
                for (auto& result : self->results_) {
                  if (result.has_transactional_metadata() &&
                      (contains_mutation(attempt->inserted_ids(), result.spec.id) ||
                       contains_mutation(attempt->replaced_ids(), result.spec.id) ||
                       contains_mutation(attempt->removed_ids(), result.spec.id))) {
                    were_in_t1.emplace_back(result);
                  }
                }

                if (were_in_t1.empty()) {
                  for (auto& result : fetched_in_t1) {
                    result->copy_content_from_staged_operation_into_result();
                  }
                  return self->completed();
                }

                self->phase_ = get_multi_phase::discovered_docs_in_t1;

                std::queue<get_multi_spec> to_fetch;
                for (const auto& result : were_in_t1) {
                  to_fetch.emplace(result.spec);
                }
                return self->retry(std::move(to_fetch));
              }
              if (self->phase_ == get_multi_phase::discovered_docs_in_t1) {
                for (auto& result : fetched_in_t1) {
                  result->copy_content_from_staged_operation_into_result();
                }
                return self->completed();
              }
            }

            return self->reset_and_retry();
          }

          // T1's ATR entry is missing
          if (self->phase_ == get_multi_phase::resolving_t1_atr_entry_missing) {
            if (fetched_in_t1.empty()) {
              return self->reset_and_retry();
            }
            return self->completed();
          }
          self->phase_ = get_multi_phase::resolving_t1_atr_entry_missing;
          std::queue<get_multi_spec> to_fetch;
          for (const auto& result : fetched_in_t1) {
            to_fetch.emplace(result->spec);
          }
          return self->retry(std::move(to_fetch));
        }
      });
  }

  void disambiguate_results()
  {
    if (std::chrono::steady_clock::now() >= deadline_) {
      return invoke_callback(std::make_exception_ptr(
        transaction_operation_failed(error_class::FAIL_EXPIRY,
                                     "timeout while fetching multiple documents")
          .expired()));
    }

    std::set<transaction_id> transaction_ids{};

    for (const auto& result : results_) {
      if (const auto& id = result.extract_transaction_id(); id) {
        transaction_ids.insert(id.value());
      }
    }

    switch (transaction_ids.size()) {
      case 0:
        // no read skew
        return completed();

      case 1:
        // one other transaction is involved, maybe we can resolve
        return resolve_read_skew();

      default:
        // several transactions, too complex to resolve
        return reset_and_retry();
    }
  }

  void fetch_individual_document(const get_multi_spec& spec)
  {
    auto handler = [spec, self = shared_from_this()](const std::exception_ptr& error,
                                                     std::optional<transaction_get_result> res) {
      if (res) {
        auto forward_compat_err =
          check_forward_compat(forward_compat_stage::GET_MULTI_GET, res->links().forward_compat());
        if (forward_compat_err) {
          self->invoke_callback(std::make_exception_ptr(forward_compat_err.value()));
          return;
        }
        self->handle_individual_document_success(spec, std::move(res));
      } else {
        self->handle_individual_document_error(spec, error);
      }
      if (auto next_spec = self->pop_next_spec(); next_spec) {
        return self->fetch_individual_document(next_spec.value());
      }
      if (self->responses_left_ == 0) {
        if (self->phase_ == get_multi_phase::first_doc_fetch) {
          self->phase_ = get_multi_phase::subsequent_to_first_doc_fetch;
        }

        switch (self->mode_) {
          case get_multi_mode::disable_read_skew_detection:
            return self->invoke_callback();
          case get_multi_mode::prioritise_latency:
            self->deadline_ = std::chrono::steady_clock::now() + std::chrono::milliseconds{ 100 };
            break;
          case get_multi_mode::prioritise_read_skew_detection:
            self->deadline_ = self->attempt_->expiry_time();
            break;
        }

        self->disambiguate_results();
      }
    };
    if (use_replicas_) {
      attempt_->get_replica_from_preferred_server_group(spec.id, std::move(handler));
    } else {
      attempt_->get_optional(spec.id, std::move(handler));
    }
  }

  void fetch_multiple_documents()
  {
    std::size_t requests_scheduled{ 0 };
    while (requests_scheduled < number_of_concurrent_requests_) {
      if (auto next_spec = pop_next_spec(); next_spec) {
        fetch_individual_document(next_spec.value());
        ++requests_scheduled;
      } else {
        break;
      }
    }
  }

private:
  std::shared_ptr<attempt_context_impl> attempt_;
  std::size_t responses_left_;
  get_multi_mode mode_;
  std::size_t number_of_concurrent_requests_;
  bool use_replicas_;
  utils::movable_function<void(std::exception_ptr, std::vector<get_multi_result>)> callback_;

  std::vector<get_multi_spec> specs_{};
  std::queue<get_multi_spec> to_fetch_{};
  std::vector<get_multi_result> results_{};

  std::chrono::steady_clock::time_point deadline_{};
  get_multi_phase phase_{ get_multi_phase::first_doc_fetch };
};

get_multi_orchestrator::get_multi_orchestrator(std::shared_ptr<attempt_context_impl> attempt,
                                               std::vector<core::document_id> ids)
  : attempt_{ std::move(attempt) }
  , ids_{ std::move(ids) }
{
}

void
get_multi_orchestrator::get_multi(
  transaction_get_multi_mode mode,
  utils::movable_function<void(std::exception_ptr, std::optional<transaction_get_multi_result>)>&&
    cb)
{
  auto operation = std::make_shared<get_multi_operation>(
    attempt_,
    ids_,
    convert_mode(mode),
    get_multi_operation::default_number_of_concurrent_requests,
    false,
    [cb = std::move(cb), self = shared_from_this()](std::exception_ptr error,
                                                    std::vector<get_multi_result> results) {
      if (error) {
        return cb(std::move(error), {});
      }

      std::vector<std::optional<codec::encoded_value>> content{};
      content.resize(results.size());
      std::exception_ptr first_error{ nullptr };
      for (auto& result : results) {
        if (auto& get = result.get_result; get) {
          content[result.spec.index] = get->content();
        }
        if (result.error && !first_error) {
          first_error = std::move(result.error);
        }
      }
      if (first_error) {
        return cb(first_error, transaction_get_multi_result{ content });
      }
      return cb(nullptr, transaction_get_multi_result{ content });
    });
  operation->fetch_multiple_documents();
}

void
get_multi_orchestrator::get_multi_replicas_from_preferred_server_group(
  transaction_get_multi_replicas_from_preferred_server_group_mode mode,
  utils::movable_function<
    void(std::exception_ptr,
         std::optional<transaction_get_multi_replicas_from_preferred_server_group_result>)>&& cb)
{
  auto operation = std::make_shared<get_multi_operation>(
    attempt_,
    ids_,
    convert_mode(mode),
    get_multi_operation::default_number_of_concurrent_requests,
    true,
    [cb = std::move(cb), self = shared_from_this()](std::exception_ptr error,
                                                    std::vector<get_multi_result> results) {
      if (error) {
        return cb(std::move(error), {});
      }

      std::vector<std::optional<codec::encoded_value>> content{};
      content.resize(results.size());
      std::exception_ptr first_error{ nullptr };
      for (auto& result : results) {
        if (auto& get = result.get_result; get) {
          content[result.spec.index] = get->content();
        }
        if (result.error && !first_error) {
          first_error = std::move(result.error);
        }
      }

      if (first_error) {
        return cb(first_error,
                  transaction_get_multi_replicas_from_preferred_server_group_result{ content });
      }

      return cb(nullptr,
                transaction_get_multi_replicas_from_preferred_server_group_result{ content });
    });
  operation->fetch_multiple_documents();
}
} // namespace couchbase::core::transactions
