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

#include <couchbase/codec/encoded_value.hxx>
#include <couchbase/common_durability_options.hxx>
#include <couchbase/error.hxx>
#include <couchbase/expiry.hxx>
#include <couchbase/mutation_result.hxx>

#include <chrono>
#include <functional>
#include <memory>
#include <optional>
#include <vector>

namespace couchbase
{

/**
 * Options for @ref collection#replace().
 *
 * @since 1.0.0
 * @committed
 */
struct replace_options : public common_durability_options<replace_options> {
  /**
   * Immutable value object representing consistent options.
   *
   * @since 1.0.0
   * @internal
   */
  struct built : public common_durability_options<replace_options>::built {
    const std::uint32_t expiry;
    const bool preserve_expiry;
    const couchbase::cas cas;
  };

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
    auto base = build_common_durability_options();
    return { base, expiry_, preserve_expiry_, cas_ };
  }

  /**
   * Specifies whether an existing document's expiry should be preserved. Defaults to false.
   *
   * If true, and the document exists, its expiry will not be modified. Otherwise the document's
   * expiry is determined by
   * {@link #expiry(std::chrono::seconds)} or {@link
   * #expiry(std::chrono::system_clock::time_point)}.
   *
   * Requires Couchbase Server 7.0 or later.
   *
   * @param preserve `true` to preserve expiry, `false` to set new expiry
   * @return this options class for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  auto preserve_expiry(bool preserve) -> replace_options&
  {
    preserve_expiry_ = preserve;
    return self();
  }

  /**
   * Sets the expiry for the document. By default the document will never expire.
   *
   * The duration must be less than 50 years. For expiry further in the future, use
   * {@link #expiry(std::chrono::system_clock::time_point)}.
   *
   * @param duration the duration after which the document will expire (zero duration means never
   * expire).
   * @return this options class for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  auto expiry(std::chrono::seconds duration) -> replace_options&
  {
    expiry_ = core::impl::expiry_relative(duration);
    return self();
  }

  /**
   * Sets the expiry for the document. By default the document will never expire.
   *
   * @param time_point the point in time when the document will expire (epoch second zero means
   * never expire).
   * @return this options class for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  auto expiry(std::chrono::system_clock::time_point time_point) -> replace_options&
  {
    expiry_ = core::impl::expiry_absolute(time_point);
    return self();
  }

  /**
   * Specifies a CAS value that will be taken into account on the server side for optimistic
   * concurrency.
   *
   * The CAS value is an opaque identifier which is associated with a specific state of the document
   * on the server. The CAS value is received on read operations (or after mutations) and can be
   * used during a subsequent mutation to make sure that the document has not been modified in the
   * meantime.
   *
   * If document on the server has been modified in the meantime the SDK will raise a {@link
   * errc::common::cas_mismatch}. In this case the caller is expected to re-do the whole
   * "fetch-modify-update" cycle again. Please refer to the SDK documentation for more information
   * on CAS mismatches and subsequent retries.
   *
   * @param cas the opaque CAS identifier to use for this operation.
   * @return the {@link replace_options} for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  auto cas(couchbase::cas cas) -> replace_options&
  {

    cas_ = cas;
    return self();
  }

private:
  std::uint32_t expiry_{ 0 };
  bool preserve_expiry_{ false };
  couchbase::cas cas_{};
};

/**
 * The signature for the handler of the @ref collection#replace() operation
 *
 * @since 1.0.0
 * @uncommitted
 */
using replace_handler = std::function<void(error, mutation_result)>;
} // namespace couchbase
