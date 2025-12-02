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
#include "cleanup_testing_hooks.hxx"

#include "couchbase/transactions/transactions_config.hxx"

#include <memory>

namespace couchbase::transactions
{

transactions_config::transactions_config()
  : attempt_context_hooks_(new core::transactions::attempt_context_testing_hooks())
  , cleanup_hooks_(new core::transactions::cleanup_testing_hooks())
{
}

transactions_config::~transactions_config() = default;

transactions_config::transactions_config(transactions_config&& c) noexcept
  : level_(c.level_)
  , timeout_(c.timeout_)
  , attempt_context_hooks_(c.attempt_context_hooks_)
  , cleanup_hooks_(c.cleanup_hooks_)
  , metadata_collection_(std::move(c.metadata_collection_))
  , query_config_(c.query_config_)
  , cleanup_config_(std::move(c.cleanup_config_))
{
}

transactions_config::transactions_config(const transactions_config& config)
  : level_(config.durability_level())
  , timeout_(config.timeout())
  , attempt_context_hooks_(std::make_shared<core::transactions::attempt_context_testing_hooks>(
      config.attempt_context_hooks()))
  , cleanup_hooks_(
      std::make_shared<core::transactions::cleanup_testing_hooks>(config.cleanup_hooks()))
  , metadata_collection_(config.metadata_collection())
  , query_config_(config.query_config())
  , cleanup_config_(config.cleanup_config())
{
}

auto
transactions_config::operator=(const transactions_config& c) -> transactions_config&
{
  if (this != &c) {
    level_ = c.level_;
    timeout_ = c.timeout_;
    attempt_context_hooks_ = c.attempt_context_hooks_;
    cleanup_hooks_ = c.cleanup_hooks_;
    query_config_ = c.query_config_;
    metadata_collection_ = c.metadata_collection_;
    cleanup_config_ = c.cleanup_config_;
  }
  return *this;
}

auto
transactions_config::build() const -> transactions_config::built
{
  return { level_,
           timeout_,
           attempt_context_hooks_,
           cleanup_hooks_,
           metadata_collection_,
           query_config_.build(),
           cleanup_config_.build() };
}

} // namespace couchbase::transactions
