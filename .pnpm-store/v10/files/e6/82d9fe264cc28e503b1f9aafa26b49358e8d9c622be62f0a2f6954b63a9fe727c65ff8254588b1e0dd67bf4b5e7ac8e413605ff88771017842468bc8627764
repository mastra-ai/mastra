/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *   Copyright 2020-Present Couchbase, Inc.
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

#pragma once

#include <couchbase/common_options.hxx>
#include <couchbase/durability_level.hxx>
#include <couchbase/persist_to.hxx>
#include <couchbase/replicate_to.hxx>

#include <chrono>
#include <optional>
#include <type_traits>

namespace couchbase
{
/**
 * Common options that used by most operations.
 *
 * @since 1.0.0
 * @committed
 */
template<typename derived_class>
class common_durability_options : public common_options<derived_class>
{
public:
  /**
   * Immutable value object representing consistent options.
   *
   * @since 1.0.0
   * @internal
   */
  struct built : public common_options<derived_class>::built {
    const couchbase::durability_level durability_level;
    const couchbase::persist_to persist_to;
    const couchbase::replicate_to replicate_to;
  };

  /**
   * Allows to customize the enhanced durability requirements for this operation.
   *
   * @note if a {@link #durability(persist_to, replicate_to)} has been set beforehand it will be set
   * back to {@link persist_to::none} and
   * {@link replicate_to::none}, since it is not allowed to use both mechanisms at the same
   * time.</p>
   *
   * @param level the enhanced durability requirement.
   * @return this options builder for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  auto durability(durability_level level) -> derived_class&
  {
    replicate_to_ = replicate_to::none;
    persist_to_ = persist_to::none;
    durability_level_ = level;
    return common_options<derived_class>::self();
  }

  /**
   * Allows to customize the poll-based durability requirements for this operation.
   *
   * @note if a {@link #durability(durability_level)} has been set beforehand it will be set back to
   * {@link durability_level::none}, since it is not allowed to use both mechanisms at the same
   * time.
   *
   * @param persist_to_nodes the durability persistence requirement.
   * @param replicate_to_nodes the durability replication requirement.
   * @return this options builder for chaining purposes.
   */
  auto durability(persist_to persist_to_nodes, replicate_to replicate_to_nodes) -> derived_class&
  {
    durability_level_ = durability_level::none;
    replicate_to_ = replicate_to_nodes;
    persist_to_ = persist_to_nodes;
    return common_options<derived_class>::self();
  }

protected:
  /**
   * @return immutable representation of the common options
   * @since 1.0.0
   * @internal
   */
  [[nodiscard]] auto build_common_durability_options() const -> built
  {
    return { common_options<derived_class>::build_common_options(),
             durability_level_,
             persist_to_,
             replicate_to_ };
  }

private:
  durability_level durability_level_{ durability_level::none };
  persist_to persist_to_{ persist_to::none };
  replicate_to replicate_to_{ replicate_to::none };
};

} // namespace couchbase
