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

#include <couchbase/subdoc/fwd/command_bundle.hxx>

#include <couchbase/codec/encoded_value.hxx>
#include <couchbase/common_options.hxx>
#include <couchbase/error.hxx>
#include <couchbase/expiry.hxx>
#include <couchbase/lookup_in_replica_result.hxx>
#include <couchbase/read_preference.hxx>
#include <couchbase/store_semantics.hxx>

#include <functional>
#include <vector>

namespace couchbase
{
/**
 * Options for @ref collection#lookup_in_all_replicas().
 *
 * @since 1.0.0
 * @committed
 */
struct lookup_in_all_replicas_options : common_options<lookup_in_all_replicas_options> {
  /**
   * Immutable value object representing consistent options.
   *
   * @since 1.0.0
   * @internal
   */
  struct built : public common_options<lookup_in_all_replicas_options>::built {
    couchbase::read_preference read_preference;
  };

  /**
   * Choose how the replica nodes will be selected. By default it has no
   * preference and will select any available replica, but it is possible to
   * prioritize or restrict to only nodes in local server group.
   *
   * @param preference
   * @return this options builder for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  auto read_preference(read_preference preference) -> lookup_in_all_replicas_options&
  {
    read_preference_ = preference;
    return self();
  }

  /**
   * Validates options and returns them as an immutable value.
   *
   * @return consistent options as an immutable value
   *
   * @exception std::system_error with code errc::common::invalid_argument if the options are not
   * valid
   *
   * @since 1.0.0
   * @internal
   */
  [[nodiscard]] auto build() const -> built
  {
    return {
      build_common_options(),
      read_preference_,
    };
  }

private:
  couchbase::read_preference read_preference_{ read_preference::no_preference };
};

/**
 * The result for the @ref collection#lookup_in_all_replicas() operation
 *
 * @since 1.0.0
 * @uncommitted
 */
using lookup_in_all_replicas_result = std::vector<lookup_in_replica_result>;

/**
 * The signature for the handler of the @ref collection#lookup_in_all_replicas() operation
 *
 * @since 1.0.0
 * @uncommitted
 */
using lookup_in_all_replicas_handler = std::function<void(error, lookup_in_all_replicas_result)>;

#ifndef COUCHBASE_CXX_CLIENT_DOXYGEN
namespace core
{
class cluster;

namespace impl::subdoc
{
struct command;
} // namespace impl::subdoc
#endif

} // namespace core
} // namespace couchbase
