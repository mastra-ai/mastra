/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *   Copyright 2020-2021 Couchbase, Inc.
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

#include "collections_component.hxx"

#include "collection_id_cache_entry.hxx"
#include "collections_component_unit_test_api.hxx"
#include "core/collections_options.hxx"
#include "core/logger/logger.hxx"
#include "core/mcbp/big_endian.hxx"
#include "core/pending_operation.hxx"
#include "core/protocol/client_opcode.hxx"
#include "core/protocol/client_opcode_fmt.hxx"
#include "core/protocol/magic.hxx"
#include "dispatcher.hxx"
#include "mcbp/operation_queue.hxx"
#include "mcbp/queue_request.hxx"
#include "mcbp/queue_response.hxx"
#include "retry_orchestrator.hxx"
#include "utils/binary.hxx"
#include "utils/json.hxx"

#include <couchbase/collection.hxx>
#include <couchbase/error_codes.hxx>
#include <couchbase/retry_reason.hxx>
#include <couchbase/scope.hxx>

#include <asio/error.hpp>
#include <asio/io_context.hpp>
#include <asio/steady_timer.hpp>
#include <spdlog/fmt/bundled/core.h>
#include <tao/json/value.hpp>
#include <tao/pegtl/parse_error.hpp>
#include <tl/expected.hpp>

#include <chrono>
#include <cstddef>
#include <cstdint>

#include <functional>
#include <map>
#include <memory>
#include <mutex>
#include <string>
#include <string_view>
#include <system_error>
#include <utility>

namespace couchbase::core
{
namespace
{
auto
build_key(std::string_view scope_name, std::string_view collection_name) -> std::string
{
  return fmt::format("{}.{}", scope_name, collection_name);
}
} // namespace

class collection_id_cache_entry_impl
  : public std::enable_shared_from_this<collection_id_cache_entry_impl>
  , public collection_id_cache_entry
{
public:
  collection_id_cache_entry_impl(std::weak_ptr<collections_component_impl> manager,
                                 std::string scope_name,
                                 std::string collection_name,
                                 std::size_t max_queue_size,
                                 std::uint32_t id)
    : manager_{ std::move(manager) }
    , scope_name_{ std::move(scope_name) }
    , collection_name_{ std::move(collection_name) }
    , max_queue_size_{ max_queue_size }
    , id_{ id }
  {
  }

  [[nodiscard]] auto dispatch(std::shared_ptr<mcbp::queue_request> req) -> std::error_code override;

  void reset_id() override
  {
    const std::scoped_lock lock(mutex_);
    if (id_ != unknown_collection_id && id_ != pending_collection_id) {
      id_ = unknown_collection_id;
    }
  }

  void set_id(std::uint32_t id)
  {
    const std::scoped_lock lock(mutex_);
    id_ = id;
  }

  [[nodiscard]] auto get_id() -> std::uint32_t
  {
    const std::scoped_lock lock(mutex_);
    return id_;
  }

  [[nodiscard]] auto assign_collection_id(const std::shared_ptr<mcbp::queue_request>& req)
    -> std::error_code
  {
    auto collection_id = get_id();
    if (req->command_ == protocol::client_opcode::range_scan_create) {
      tao::json::value body;
      try {
        body = utils::json::parse_binary(req->value_);
      } catch (const tao::pegtl::parse_error&) {
        return errc::common::parsing_failure;
      }
      body["collection"] = fmt::format("{:x}", collection_id);
      req->value_ = utils::json::generate_binary(body);
      return {};
    }
    req->collection_id_ = collection_id;
    return {};
  }

  [[nodiscard]] auto refresh_collection_id(const std::shared_ptr<mcbp::queue_request>& req)
    -> std::error_code;

  [[nodiscard]] auto swap_queue() -> std::unique_ptr<mcbp::operation_queue>
  {
    auto queue = std::make_unique<mcbp::operation_queue>();
    const std::scoped_lock lock(mutex_);
    std::swap(queue_, queue);
    return queue;
  }

private:
  // Using std::weak_ptr here as lifetime of the entry is bound to the lifetime
  // of the component, and we want to avoid memory leaks due to circular dependencies.
  const std::weak_ptr<collections_component_impl> manager_;
  const std::string scope_name_;
  const std::string collection_name_;
  const std::size_t max_queue_size_;
  std::uint32_t id_;
  mutable std::recursive_mutex mutex_{};
  std::unique_ptr<mcbp::operation_queue> queue_{ std::make_unique<mcbp::operation_queue>() };
};

class collections_component_impl : public std::enable_shared_from_this<collections_component_impl>
{
public:
  collections_component_impl(asio::io_context& io,
                             dispatcher dispatcher,
                             const collections_component_options& options)
    : io_{ io }
    , dispatcher_(std::move(dispatcher))
    , max_queue_size_{ options.max_queue_size }
    , default_retry_strategy_{ options.default_retry_strategy }
  {
  }

  auto get_and_maybe_insert(std::string scope_name, std::string collection_name, std::uint32_t id)
    -> std::shared_ptr<collection_id_cache_entry>
  {
    const std::scoped_lock lock(cache_mutex_);
    auto key = build_key(scope_name, collection_name);

    if (auto it = cache_.find(key); it != cache_.end()) {
      return it->second;
    }
    auto entry = std::make_shared<collection_id_cache_entry_impl>(
      shared_from_this(), std::move(scope_name), std::move(collection_name), max_queue_size_, id);
    cache_.try_emplace(key, entry);
    return entry;
  }

  void remove(std::string_view scope_name, std::string_view collection_name)
  {
    const std::scoped_lock lock(cache_mutex_);
    cache_.erase(build_key(scope_name, collection_name));
  }

  void upsert(std::string scope_name, std::string collection_name, std::uint32_t id)
  {
    const std::scoped_lock lock(cache_mutex_);

    auto key = build_key(scope_name, collection_name);

    if (auto it = cache_.find(key); it != cache_.end()) {
      it->second->set_id(id);
      return;
    }

    cache_.try_emplace(key,
                       std::make_shared<collection_id_cache_entry_impl>(shared_from_this(),
                                                                        std::move(scope_name),
                                                                        std::move(collection_name),
                                                                        max_queue_size_,
                                                                        id));
  }

  auto handle_collection_unknown(const std::shared_ptr<mcbp::queue_request>& request) -> bool
  {
    /*
     * We cannot retry requests with no collection information.
     * This also prevents the GetCollectionID requests from being automatically retried.
     */
    if (request->scope_name_.empty() || request->collection_name_.empty()) {
      return false;
    }

    auto action =
      retry_orchestrator::should_retry(request, retry_reason::key_value_collection_outdated);
    auto retried = action.need_to_retry();
    if (retried) {
      auto timer = std::make_shared<asio::steady_timer>(io_);
      timer->expires_after(action.duration());
      timer->async_wait([self = shared_from_this(), request](auto error) {
        if (error == asio::error::operation_aborted) {
          return;
        }
        self->re_queue(request);
      });
      request->set_retry_backoff(timer);
    }
    return retried;
  }

  void re_queue(const std::shared_ptr<mcbp::queue_request>& request)
  {
    auto cache_entry =
      get_and_maybe_insert(request->scope_name_, request->collection_name_, unknown_collection_id);

    cache_entry->reset_id();

    if (auto ec = cache_entry->dispatch(request); ec) {
      request->try_callback({}, ec);
    }
  }

  [[nodiscard]] auto get_collection_id(std::string scope_name,
                                       std::string collection_name,
                                       const get_collection_id_options& options,
                                       get_collection_id_callback&& callback)
    -> tl::expected<std::shared_ptr<pending_operation>, std::error_code>
  {
    auto handler = [self = shared_from_this(),
                    cb = std::move(callback)](const std::shared_ptr<mcbp::queue_response>& response,
                                              const std::shared_ptr<mcbp::queue_request>& request,
                                              std::error_code error) {
      if (error) {
        return cb(get_collection_id_result{}, error);
      }

      const std::uint64_t manifest_id = mcbp::big_endian::read_uint64(response->extras_, 0);
      const std::uint32_t collection_id = mcbp::big_endian::read_uint32(response->extras_, 8);

      self->upsert(request->scope_name_, request->collection_name_, collection_id);

      return cb(get_collection_id_result{ manifest_id, collection_id }, {});
    };

    auto req = std::make_shared<couchbase::core::mcbp::queue_request>(
      couchbase::core::protocol::magic::client_request,
      couchbase::core::protocol::client_opcode::get_collection_id,
      std::move(handler));
    req->scope_name_ = scope_name.empty() ? scope::default_name : std::move(scope_name);
    req->collection_name_ =
      collection_name.empty() ? collection::default_name : std::move(collection_name);
    req->value_ = utils::to_binary(fmt::format("{}.{}", req->scope_name_, req->collection_name_));
    req->retry_strategy_ =
      options.retry_strategy ? options.retry_strategy : default_retry_strategy_;

    if (auto ec = dispatcher_.direct_dispatch(req); ec) {
      return tl::unexpected(ec);
    }

    if (options.timeout != std::chrono::milliseconds::zero()) {
      auto timer = std::make_shared<asio::steady_timer>(io_);
      timer->expires_after(options.timeout);
      timer->async_wait([req](auto error) {
        if (error == asio::error::operation_aborted) {
          return;
        }
        req->cancel(errc::common::unambiguous_timeout);
      });
      req->set_deadline(timer);
    }

    return req;
  }

  auto direct_re_queue(std::shared_ptr<mcbp::queue_request> request, bool is_retry)
    -> std::error_code
  {
    return dispatcher_.direct_re_queue(std::move(request), is_retry);
  }

  auto direct_dispatch(std::shared_ptr<mcbp::queue_request> request) -> std::error_code
  {
    return dispatcher_.direct_dispatch(std::move(request));
  }

  auto dispatch(std::shared_ptr<mcbp::queue_request> request)
    -> tl::expected<std::shared_ptr<pending_operation>, std::error_code>
  {
    if ((request->collection_id_ > 0) // collection id present
        || (request->collection_name_.empty() && request->scope_name_.empty()) // no collection
        || (request->collection_name_ == collection::default_name &&
            request->scope_name_ == scope::default_name) // default collection
    ) {
      if (auto ec = dispatcher_.direct_dispatch(request); ec) {
        return tl::unexpected(ec);
      }
      return request;
    }

    auto cache_entry =
      get_and_maybe_insert(request->scope_name_, request->collection_name_, unknown_collection_id);
    if (auto ec = cache_entry->dispatch(request); ec) {
      return tl::unexpected(ec);
    }
    return request;
  }

private:
  asio::io_context& io_;
  const dispatcher dispatcher_;
  const std::size_t max_queue_size_;
  std::shared_ptr<retry_strategy> default_retry_strategy_;
  std::map<std::string, std::shared_ptr<collection_id_cache_entry_impl>, std::less<>> cache_{};
  mutable std::mutex cache_mutex_{};
};

[[nodiscard]] auto
collection_id_cache_entry_impl::dispatch(std::shared_ptr<mcbp::queue_request> req)
  -> std::error_code
{
  /*
   * if the collection id is unknown then mark the request pending and refresh collection id first
   * if it is pending then queue request
   * otherwise send the request
   */
  switch (const std::scoped_lock lock(mutex_); id_) {
    case unknown_collection_id:
      CB_LOG_DEBUG(
        "collection {}.{} unknown. refreshing id", req->scope_name_, req->collection_id_);
      id_ = pending_collection_id;

      if (auto ec = refresh_collection_id(req); ec) {
        id_ = unknown_collection_id;
        return ec;
      }
      return {};

    case pending_collection_id:
      CB_LOG_DEBUG("collection {}.{} pending. queueing request OP={}",
                   req->scope_name_,
                   req->collection_id_,
                   req->command_);
      return queue_->push(req, max_queue_size_);

    default:
      break;
  }

  if (auto ec = assign_collection_id(req); ec) {
    CB_LOG_DEBUG("failed to set collection ID \"{}.{}\" on request (OP={}): {}",
                 req->scope_name_,
                 req->collection_name_,
                 req->command_,
                 ec.message());
    return ec;
  }

  return manager_.lock()->direct_dispatch(std::move(req));
}

auto
collection_id_cache_entry_impl::refresh_collection_id(
  const std::shared_ptr<mcbp::queue_request>& req) -> std::error_code
{
  if (auto ec = queue_->push(req, max_queue_size_); ec) {
    return ec;
  }

  CB_LOG_DEBUG("refreshing collection ID for \"{}.{}\"", req->scope_name_, req->collection_name_);
  auto op = manager_.lock()->get_collection_id(
    req->scope_name_,
    req->collection_name_,
    get_collection_id_options{},
    [self = shared_from_this(), req](get_collection_id_result res, std::error_code ec) {
      if (ec) {
        if (ec == errc::common::collection_not_found) {
          // The collection is unknown, so we need to mark the cid unknown and attempt to retry the
          // request. Retrying the request will requeue it in the cid manager so either it will pick
          // up the unknown cid and cause a refresh or another request will and this one will get
          // queued within the cache. Either the collection will eventually come online or this
          // request will time out.
          CB_LOG_DEBUG("collection \"{}.{}\" not found, attempting retry",
                       req->scope_name_,
                       req->collection_name_);
          self->set_id(unknown_collection_id);
          if (self->queue_->remove(req)) {
            if (self->manager_.lock()->handle_collection_unknown(req)) {
              return;
            }
          } else {
            CB_LOG_DEBUG("request no longer existed in op queue, possibly cancelled?, opaque={}, "
                         "collection_name=\"{}\"",
                         req->opaque_,
                         req->collection_name_);
          }
        } else {
          CB_LOG_DEBUG("collection id refresh failed: {}, opaque={}, collection_name=\"{}\"",
                       ec.message(),
                       req->opaque_,
                       req->collection_name_);
        }
        // There was an error getting this collection ID so lets remove the cache from the manager
        // and try to callback on all the queued requests.
        self->manager_.lock()->remove(req->scope_name_, req->collection_name_);
        auto queue = self->swap_queue();
        queue->close();
        return queue->drain([ec](const auto& r) {
          r->try_callback({}, ec);
        });
      }

      // We successfully got the cid, the GetCollectionID itself will have handled setting the ID on
      // this cache, so lets reset the op queue and requeue all of our requests.
      CB_LOG_DEBUG("collection \"{}.{}\" refresh succeeded cid={}, re-queuing requests",
                   req->scope_name_,
                   req->collection_name_,
                   res.collection_id);
      auto queue = self->swap_queue();
      queue->close();
      return queue->drain([self](const auto& r) {
        if (auto ec = self->assign_collection_id(r); ec) {
          CB_LOG_DEBUG("failed to set collection ID \"{}.{}\" on request (OP={}): {}",
                       r->scope_name_,
                       r->collection_name_,
                       r->command_,
                       ec.message());
          return;
        }
        self->manager_.lock()->direct_re_queue(r, false);
      });
    });
#if defined(__clang__) && defined(__clang_analyzer__)
  // TODO(CXXCBC-549)
  [[clang::suppress]]
#endif
  if (op) {
    return {};
  }
  return op.error();
}

collections_component::collections_component(asio::io_context& io,
                                             dispatcher dispatcher,
                                             const collections_component_options& options)
  : impl_{ std::make_shared<collections_component_impl>(io, std::move(dispatcher), options) }
{
}

auto
collections_component::get_collection_id(std::string scope_name,
                                         std::string collection_name,
                                         const get_collection_id_options& options,
                                         get_collection_id_callback callback)
  -> tl::expected<std::shared_ptr<pending_operation>, std::error_code>
{
  return impl_->get_collection_id(
    std::move(scope_name), std::move(collection_name), options, std::move(callback));
}

auto
collections_component::dispatch(std::shared_ptr<mcbp::queue_request> request)
  -> tl::expected<std::shared_ptr<pending_operation>, std::error_code>
{
  return impl_->dispatch(std::move(request));
}

collections_component_unit_test_api::collections_component_unit_test_api(
  std::shared_ptr<collections_component_impl> impl)
  : impl_{ std::move(impl) }
{
}

void
collections_component_unit_test_api::remove_collection_from_cache(std::string_view scope_name,
                                                                  std::string_view collection_name)
{
  impl_->remove(scope_name, collection_name);
}

auto
collections_component::unit_test_api() -> collections_component_unit_test_api
{
  return collections_component_unit_test_api(impl_);
}
} // namespace couchbase::core
