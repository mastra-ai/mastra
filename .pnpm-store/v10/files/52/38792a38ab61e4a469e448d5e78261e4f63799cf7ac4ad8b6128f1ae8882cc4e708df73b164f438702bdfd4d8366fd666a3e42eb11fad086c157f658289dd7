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

#include <couchbase/bucket.hxx>

#include "core/cluster.hxx"
#include "diagnostics.hxx"

#include <couchbase/collection.hxx>
#include <couchbase/collection_manager.hxx>
#include <couchbase/error.hxx>
#include <couchbase/ping_options.hxx>
#include <couchbase/ping_result.hxx>
#include <couchbase/scope.hxx>

#include <future>
#include <memory>
#include <string_view>
#include <utility>

namespace couchbase
{
class bucket_impl : public std::enable_shared_from_this<bucket_impl>
{
public:
  bucket_impl(core::cluster core,
              std::string_view name,
              std::shared_ptr<crypto::manager> crypto_mgr)
    : core_{ std::move(core) }
    , name_{ name }
    , crypto_manager_{ std::move(crypto_mgr) }
  {
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

  void ping(const ping_options::built& options, ping_handler&& handler) const
  {
    return core_.ping(options.report_id,
                      name_,
                      core::impl::to_core_service_types(options.service_types),
                      options.timeout,
                      [handler = std::move(handler)](const auto& resp) mutable {
                        return handler({}, core::impl::build_result(resp));
                      });
  }

private:
  core::cluster core_;
  std::string name_;
  std::shared_ptr<crypto::manager> crypto_manager_;
};

bucket::bucket(core::cluster core,
               std::string_view name,
               std::shared_ptr<crypto::manager> crypto_mgr)
  : impl_(std::make_shared<bucket_impl>(std::move(core), name, std::move(crypto_mgr)))
{
}

auto
bucket::default_scope() const -> couchbase::scope
{
  return { impl_->core(), impl_->name(), scope::default_name, impl_->crypto_manager() };
}

auto
bucket::default_collection() const -> couchbase::collection
{
  return { impl_->core(),
           impl_->name(),
           scope::default_name,
           collection::default_name,
           impl_->crypto_manager() };
}

auto
bucket::scope(std::string_view scope_name) const -> couchbase::scope
{
  return { impl_->core(), impl_->name(), scope_name, impl_->crypto_manager() };
}

void
bucket::ping(const couchbase::ping_options& options, couchbase::ping_handler&& handler) const
{
  return impl_->ping(options.build(), std::move(handler));
}

auto
bucket::ping(const couchbase::ping_options& options) const
  -> std::future<std::pair<error, ping_result>>
{
  auto barrier = std::make_shared<std::promise<std::pair<error, ping_result>>>();
  ping(options, [barrier](auto err, auto result) mutable {
    barrier->set_value({ std::move(err), std::move(result) });
  });
  return barrier->get_future();
}

auto
bucket::collections() const -> collection_manager
{
  return { impl_->core(), impl_->name() };
}
} // namespace couchbase
