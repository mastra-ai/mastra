/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *   Copyright 2023-Present Couchbase, Inc.
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

#include <couchbase/binary_collection.hxx>

#include "core/cluster.hxx"
#include "core/impl/error.hxx"
#include "core/operations/document_append.hxx"
#include "core/operations/document_decrement.hxx"
#include "core/operations/document_increment.hxx"
#include "core/operations/document_insert.hxx"
#include "core/operations/document_mutate_in.hxx"
#include "core/operations/document_prepend.hxx"
#include "core/operations/document_remove.hxx"
#include "core/operations/document_replace.hxx"
#include "core/operations/document_upsert.hxx"
#include "observe_poll.hxx"

#include <couchbase/append_options.hxx>
#include <couchbase/decrement_options.hxx>
#include <couchbase/durability_level.hxx>
#include <couchbase/error.hxx>
#include <couchbase/increment_options.hxx>
#include <couchbase/persist_to.hxx>
#include <couchbase/prepend_options.hxx>
#include <couchbase/replicate_to.hxx>

#include <cstddef>
#include <future>
#include <memory>
#include <string_view>
#include <system_error>
#include <utility>
#include <vector>

namespace couchbase
{
class binary_collection_impl : public std::enable_shared_from_this<binary_collection_impl>
{
public:
  binary_collection_impl(core::cluster core,
                         std::string_view bucket_name,
                         std::string_view scope_name,
                         std::string_view name)
    : core_{ std::move(core) }
    , bucket_name_{ bucket_name }
    , scope_name_{ scope_name }
    , name_{ name }
  {
  }

  [[nodiscard]] auto bucket_name() const -> const std::string&
  {
    return bucket_name_;
  }

  [[nodiscard]] auto scope_name() const -> const std::string&
  {
    return scope_name_;
  }

  [[nodiscard]] auto name() const -> const std::string&
  {
    return name_;
  }

  void append(std::string document_key,
              std::vector<std::byte> data,
              append_options::built options,
              append_handler&& handler) const
  {
    auto id = core::document_id{
      bucket_name_,
      scope_name_,
      name_,
      std::move(document_key),
    };
    if (options.persist_to == persist_to::none && options.replicate_to == replicate_to::none) {
      return core_.execute(
        core::operations::append_request{
          std::move(id),
          std::move(data),
          {},
          {},
          options.cas,
          options.durability_level,
          options.timeout,
          { options.retry_strategy },
        },
        [handler = std::move(handler)](auto&& resp) mutable {
          if (resp.ctx.ec()) {
            return handler(core::impl::make_error(std::move(resp.ctx)), mutation_result{});
          }
          return handler(core::impl::make_error(std::move(resp.ctx)),
                         mutation_result{ resp.cas, std::move(resp.token) });
        });
    }

    core::operations::append_request request{
      id,
      std::move(data),
      {},
      {},
      options.cas,
      durability_level::none,
      options.timeout,
      { options.retry_strategy },
    };
    return core_.execute(std::move(request),
                         [core = core_, id = std::move(id), options, handler = std::move(handler)](
                           auto&& resp) mutable {
                           if (resp.ctx.ec()) {
                             return handler(core::impl::make_error(std::move(resp.ctx)),
                                            mutation_result{ resp.cas, std::move(resp.token) });
                           }

                           auto token = resp.token;
                           core::impl::initiate_observe_poll(
                             core,
                             std::move(id),
                             token,
                             options.timeout,
                             options.persist_to,
                             options.replicate_to,
                             [resp = std::forward<decltype(resp)>(resp),
                              handler = std::move(handler)](std::error_code ec) mutable {
                               if (ec) {
                                 resp.ctx.override_ec(ec);
                                 return handler(core::impl::make_error(std::move(resp.ctx)),
                                                mutation_result{});
                               }
                               return handler(core::impl::make_error(std::move(resp.ctx)),
                                              mutation_result{ resp.cas, std::move(resp.token) });
                             });
                         });
  }

  void prepend(std::string document_key,
               std::vector<std::byte> data,
               prepend_options::built options,
               prepend_handler&& handler) const
  {
    auto id = core::document_id{
      bucket_name_,
      scope_name_,
      name_,
      std::move(document_key),
    };
    if (options.persist_to == persist_to::none && options.replicate_to == replicate_to::none) {
      return core_.execute(
        core::operations::prepend_request{
          std::move(id),
          std::move(data),
          {},
          {},
          options.cas,
          options.durability_level,
          options.timeout,
          { options.retry_strategy },
        },
        [handler = std::move(handler)](auto&& resp) mutable {
          if (resp.ctx.ec()) {
            return handler(core::impl::make_error(std::move(resp.ctx)), mutation_result{});
          }
          return handler(core::impl::make_error(std::move(resp.ctx)),
                         mutation_result{ resp.cas, std::move(resp.token) });
        });
    }

    core::operations::prepend_request request{
      id,
      std::move(data),
      {},
      {},
      options.cas,
      durability_level::none,
      options.timeout,
      { options.retry_strategy },
    };
    return core_.execute(std::move(request),
                         [core = core_, id = std::move(id), options, handler = std::move(handler)](
                           auto&& resp) mutable {
                           if (resp.ctx.ec()) {
                             return handler(core::impl::make_error(std::move(resp.ctx)),
                                            mutation_result{ resp.cas, std::move(resp.token) });
                           }

                           auto token = resp.token;
                           core::impl::initiate_observe_poll(
                             core,
                             std::move(id),
                             token,
                             options.timeout,
                             options.persist_to,
                             options.replicate_to,
                             [resp = std::forward<decltype(resp)>(resp),
                              handler = std::move(handler)](std::error_code ec) mutable {
                               if (ec) {
                                 resp.ctx.override_ec(ec);
                                 return handler(core::impl::make_error(std::move(resp.ctx)),
                                                mutation_result{});
                               }
                               return handler(core::impl::make_error(std::move(resp.ctx)),
                                              mutation_result{ resp.cas, std::move(resp.token) });
                             });
                         });
  }

  void decrement(std::string document_key,
                 decrement_options::built options,
                 decrement_handler&& handler) const
  {
    auto id = core::document_id{
      bucket_name_,
      scope_name_,
      name_,
      std::move(document_key),
    };
    if (options.persist_to == persist_to::none && options.replicate_to == replicate_to::none) {
      return core_.execute(
        core::operations::decrement_request{
          std::move(id),
          {},
          {},
          options.expiry,
          options.delta,
          options.initial_value,
          options.durability_level,
          options.timeout,
          { options.retry_strategy },
        },
        [handler = std::move(handler)](auto&& resp) mutable {
          if (resp.ctx.ec()) {
            return handler(core::impl::make_error(std::move(resp.ctx)), counter_result{});
          }
          return handler(core::impl::make_error(std::move(resp.ctx)),
                         counter_result{ resp.cas, std::move(resp.token), resp.content });
        });
    }

    core::operations::decrement_request request{
      id,
      {},
      {},
      options.expiry,
      options.delta,
      options.initial_value,
      durability_level::none,
      options.timeout,
      { options.retry_strategy },
    };
    return core_.execute(
      std::move(request),
      [core = core_, id = std::move(id), options, handler = std::move(handler)](
        auto&& resp) mutable {
        if (resp.ctx.ec()) {
          return handler(core::impl::make_error(std::move(resp.ctx)),
                         counter_result{ resp.cas, std::move(resp.token), resp.content });
        }

        auto token = resp.token;
        core::impl::initiate_observe_poll(
          core,
          std::move(id),
          token,
          options.timeout,
          options.persist_to,
          options.replicate_to,
          [resp = std::forward<decltype(resp)>(resp),
           handler = std::move(handler)](std::error_code ec) mutable {
            if (ec) {
              resp.ctx.override_ec(ec);
              return handler(core::impl::make_error(std::move(resp.ctx)), counter_result{});
            }
            return handler(core::impl::make_error(std::move(resp.ctx)),
                           counter_result{ resp.cas, std::move(resp.token), resp.content });
          });
      });
  }

  void increment(std::string document_key,
                 increment_options::built options,
                 increment_handler&& handler) const
  {
    auto id = core::document_id{
      bucket_name_,
      scope_name_,
      name_,
      std::move(document_key),
    };
    if (options.persist_to == persist_to::none && options.replicate_to == replicate_to::none) {
      return core_.execute(
        core::operations::increment_request{
          std::move(id),
          {},
          {},
          options.expiry,
          options.delta,
          options.initial_value,
          options.durability_level,
          options.timeout,
          { options.retry_strategy },
        },
        [handler = std::move(handler)](auto&& resp) mutable {
          if (resp.ctx.ec()) {
            return handler(core::impl::make_error(std::move(resp.ctx)), counter_result{});
          }
          return handler(core::impl::make_error(std::move(resp.ctx)),
                         counter_result{ resp.cas, std::move(resp.token), resp.content });
        });
    }

    core::operations::increment_request request{
      id,
      {},
      {},
      options.expiry,
      options.delta,
      options.initial_value,
      durability_level::none,
      options.timeout,
      { options.retry_strategy },
    };
    return core_.execute(
      std::move(request),
      [core = core_, id = std::move(id), options, handler = std::move(handler)](
        auto&& resp) mutable {
        if (resp.ctx.ec()) {
          return handler(core::impl::make_error(std::move(resp.ctx)),
                         counter_result{ resp.cas, std::move(resp.token), resp.content });
        }

        auto token = resp.token;
        core::impl::initiate_observe_poll(
          core,
          std::move(id),
          token,
          options.timeout,
          options.persist_to,
          options.replicate_to,
          [resp = std::forward<decltype(resp)>(resp),
           handler = std::move(handler)](std::error_code ec) mutable {
            if (ec) {
              resp.ctx.override_ec(ec);
              return handler(core::impl::make_error(std::move(resp.ctx)), counter_result{});
            }
            return handler(core::impl::make_error(std::move(resp.ctx)),
                           counter_result{ resp.cas, std::move(resp.token), resp.content });
          });
      });
  }

private:
  core::cluster core_;
  std::string bucket_name_;
  std::string scope_name_;
  std::string name_;
};

binary_collection::binary_collection(core::cluster core,
                                     std::string_view bucket_name,
                                     std::string_view scope_name,
                                     std::string_view name)
  : impl_(std::make_shared<binary_collection_impl>(std::move(core), bucket_name, scope_name, name))
{
}

auto
binary_collection::bucket_name() const -> const std::string&
{
  return impl_->bucket_name();
}

auto
binary_collection::scope_name() const -> const std::string&
{
  return impl_->scope_name();
}

auto
binary_collection::name() const -> const std::string&
{
  return impl_->name();
}

void
binary_collection::append(std::string document_id,
                          std::vector<std::byte> data,
                          const append_options& options,
                          append_handler&& handler) const
{
  return impl_->append(
    std::move(document_id), std::move(data), options.build(), std::move(handler));
}

auto
binary_collection::append(std::string document_id,
                          std::vector<std::byte> data,
                          const append_options& options) const
  -> std::future<std::pair<error, mutation_result>>
{
  auto barrier = std::make_shared<std::promise<std::pair<error, mutation_result>>>();
  auto future = barrier->get_future();
  append(std::move(document_id), std::move(data), options, [barrier](auto err, auto result) {
    barrier->set_value({ std::move(err), std::move(result) });
  });
  return future;
}

void
binary_collection::prepend(std::string document_id,
                           std::vector<std::byte> data,
                           const prepend_options& options,
                           prepend_handler&& handler) const
{
  return impl_->prepend(
    std::move(document_id), std::move(data), options.build(), std::move(handler));
}

auto
binary_collection::prepend(std::string document_id,
                           std::vector<std::byte> data,
                           const prepend_options& options) const
  -> std::future<std::pair<error, mutation_result>>
{
  auto barrier = std::make_shared<std::promise<std::pair<error, mutation_result>>>();
  auto future = barrier->get_future();
  prepend(std::move(document_id), std::move(data), options, [barrier](auto err, auto result) {
    barrier->set_value({ std::move(err), std::move(result) });
  });
  return future;
}

void
binary_collection::increment(std::string document_id,
                             const increment_options& options,
                             increment_handler&& handler) const
{
  return impl_->increment(std::move(document_id), options.build(), std::move(handler));
}

auto
binary_collection::increment(std::string document_id, const increment_options& options) const
  -> std::future<std::pair<error, counter_result>>
{
  auto barrier = std::make_shared<std::promise<std::pair<error, counter_result>>>();
  auto future = barrier->get_future();
  increment(std::move(document_id), options, [barrier](auto err, auto result) {
    barrier->set_value({ std::move(err), std::move(result) });
  });
  return future;
}

void
binary_collection::decrement(std::string document_id,
                             const decrement_options& options,
                             decrement_handler&& handler) const
{
  return impl_->decrement(std::move(document_id), options.build(), std::move(handler));
}

auto
binary_collection::decrement(std::string document_id, const decrement_options& options) const
  -> std::future<std::pair<error, counter_result>>
{
  auto barrier = std::make_shared<std::promise<std::pair<error, counter_result>>>();
  auto future = barrier->get_future();
  decrement(std::move(document_id), options, [barrier](auto err, auto result) {
    barrier->set_value({ std::move(err), std::move(result) });
  });
  return future;
}
} // namespace couchbase
