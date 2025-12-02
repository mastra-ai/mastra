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

#include "analytics.hxx"
#include "core/cluster.hxx"
#include "error.hxx"
#include "internal_search_error_context.hxx"
#include "internal_search_meta_data.hxx"
#include "internal_search_result.hxx"
#include "internal_search_row.hxx"
#include "internal_search_row_location.hxx"
#include "internal_search_row_locations.hxx"
#include "query.hxx"
#include "search.hxx"

#include <couchbase/bucket.hxx>
#include <couchbase/collection.hxx>
#include <couchbase/scope.hxx>

#include <spdlog/fmt/bundled/core.h>

#include <memory>
#include <utility>

namespace couchbase
{
class scope_impl
{
public:
  scope_impl(core::cluster core,
             std::string_view bucket_name,
             std::string_view name,
             std::shared_ptr<crypto::manager> crypto_manager)
    : core_{ std::move(core) }
    , bucket_name_{ bucket_name }
    , name_{ name }
    , query_context_{ fmt::format("default:`{}`.`{}`", bucket_name_, name_) }
    , crypto_manager_{ std::move(crypto_manager) }
  {
  }

  [[nodiscard]] auto bucket_name() const -> const std::string&
  {
    return bucket_name_;
  }

  [[nodiscard]] auto name() const -> const std::string&
  {
    return name_;
  }

  [[nodiscard]] auto core() const -> const core::cluster&
  {
    return core_;
  }

  [[nodiscard]] auto crypto_manager() const -> const std::shared_ptr<crypto::manager>&
  {
    return crypto_manager_;
  }

  void query(std::string statement, query_options::built options, query_handler&& handler) const
  {
    return core_.execute(
      core::impl::build_query_request(std::move(statement), query_context_, std::move(options)),
      [handler = std::move(handler)](auto resp) {
        return handler(core::impl::make_error(resp.ctx), core::impl::build_result(resp));
      });
  }

  void analytics_query(std::string statement,
                       analytics_options::built options,
                       analytics_handler&& handler) const
  {
    return core_.execute(core::impl::build_analytics_request(
                           std::move(statement), std::move(options), bucket_name_, name_),
                         [handler = std::move(handler)](auto resp) mutable {
                           return handler(core::impl::make_error(resp.ctx),
                                          core::impl::build_result(resp));
                         });
  }

  void search(std::string index_name,
              couchbase::search_request request,
              search_options::built options,
              search_handler&& handler) const
  {
    return core_.execute(
      core::impl::build_search_request(
        std::move(index_name), std::move(request), std::move(options), bucket_name_, name_),
      [handler = std::move(handler)](auto&& resp) mutable {
        return handler(core::impl::make_error(resp.ctx),
                       search_result{ internal_search_result{ resp } });
      });
  }

private:
  core::cluster core_;
  std::string bucket_name_;
  std::string name_;
  std::string query_context_;
  std::shared_ptr<crypto::manager> crypto_manager_;
};

scope::scope(core::cluster core,
             std::string_view bucket_name,
             std::string_view name,
             std::shared_ptr<crypto::manager> crypto_manager)
  : impl_(
      std::make_shared<scope_impl>(std::move(core), bucket_name, name, std::move(crypto_manager)))
{
}

auto
scope::bucket_name() const -> const std::string&
{
  return impl_->bucket_name();
}

auto
scope::name() const -> const std::string&
{
  return impl_->name();
}

auto
scope::collection(std::string_view collection_name) const -> couchbase::collection
{
  return {
    impl_->core(), impl_->bucket_name(), impl_->name(), collection_name, impl_->crypto_manager()
  };
}

void
scope::query(std::string statement, const query_options& options, query_handler&& handler) const
{
  return impl_->query(std::move(statement), options.build(), std::move(handler));
}

auto
scope::query(std::string statement, const query_options& options) const
  -> std::future<std::pair<error, query_result>>
{
  auto barrier = std::make_shared<std::promise<std::pair<error, query_result>>>();
  auto future = barrier->get_future();
  query(std::move(statement), options, [barrier](auto err, auto result) {
    barrier->set_value({ std::move(err), std::move(result) });
  });
  return future;
}

void
scope::analytics_query(std::string statement,
                       const analytics_options& options,
                       analytics_handler&& handler) const
{
  return impl_->analytics_query(std::move(statement), options.build(), std::move(handler));
}

auto
scope::analytics_query(std::string statement, const analytics_options& options) const
  -> std::future<std::pair<error, analytics_result>>
{
  auto barrier = std::make_shared<std::promise<std::pair<error, analytics_result>>>();
  auto future = barrier->get_future();
  analytics_query(std::move(statement), options, [barrier](auto err, auto result) {
    barrier->set_value({ std::move(err), std::move(result) });
  });
  return future;
}

void
scope::search(std::string index_name,
              search_request request,
              const search_options& options,
              search_handler&& handler) const
{
  return impl_->search(
    std::move(index_name), std::move(request), options.build(), std::move(handler));
}

auto
scope::search(std::string index_name, search_request request, const search_options& options) const
  -> std::future<std::pair<error, search_result>>
{
  auto barrier = std::make_shared<std::promise<std::pair<error, search_result>>>();
  auto future = barrier->get_future();
  search(std::move(index_name), std::move(request), options, [barrier](auto err, auto result) {
    barrier->set_value({ std::move(err), std::move(result) });
  });
  return future;
}

auto
scope::search_indexes() const -> scope_search_index_manager
{
  return scope_search_index_manager{ impl_->core(), impl_->bucket_name(), impl_->name() };
}
} // namespace couchbase
