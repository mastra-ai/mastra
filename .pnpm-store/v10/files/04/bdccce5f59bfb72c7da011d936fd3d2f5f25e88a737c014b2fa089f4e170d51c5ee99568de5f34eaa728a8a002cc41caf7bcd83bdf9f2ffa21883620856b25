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
#include <couchbase/common_durability_options.hxx>
#include <couchbase/error.hxx>
#include <couchbase/expiry.hxx>
#include <couchbase/mutate_in_result.hxx>
#include <couchbase/store_semantics.hxx>

#include <chrono>
#include <functional>
#include <memory>
#include <optional>
#include <vector>

namespace couchbase
{

/**
 * Options for @ref collection#mutate_in().
 *
 * @since 1.0.0
 * @committed
 */
struct mutate_in_options : public common_durability_options<mutate_in_options> {
  /**
   * Immutable value object representing consistent options.
   *
   * @since 1.0.0
   * @internal
   */
  struct built : public common_durability_options<mutate_in_options>::built {
    const std::uint32_t expiry;
    const bool preserve_expiry;
    const couchbase::store_semantics store_semantics;
    const couchbase::cas cas;
    const bool access_deleted;
    const bool create_as_deleted;
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
    return { base, expiry_,         preserve_expiry_,  store_semantics_,
             cas_, access_deleted_, create_as_deleted_ };
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
  auto preserve_expiry(bool preserve) -> mutate_in_options&
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
  auto expiry(std::chrono::seconds duration) -> mutate_in_options&
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
  auto expiry(std::chrono::system_clock::time_point time_point) -> mutate_in_options&
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
   * @return the {@link mutate_in_options} for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  auto cas(couchbase::cas cas) -> mutate_in_options&
  {
    cas_ = cas;
    return self();
  }
  /**
   * Changes the storing semantics of the outer/enclosing document.
   *
   * While each individual {@link mutate_in_specs} describes the semantics of the respective
   * sub-document section, the
   * {@link store_semantics} are applied to the outer enclosing document as a whole. You can think
   * of using the same verb for a {@link couchbase::store_semantics store_semantics} aligns with the
   * corresponding full document. So for example a
   * {@link store_semantics::insert} works semantically similar to a {@link collection#insert()} and
   * will fail if the document as a whole already exists.
   *
   * @param semantics the store semantics to apply to the document.
   * @return this {@link mutate_in_options} for chaining purposes.
   */
  auto store_semantics(couchbase::store_semantics semantics) -> mutate_in_options&
  {
    store_semantics_ = semantics;
    return self();
  }

  /**
   * For internal use only: allows access to deleted documents that are in 'tombstone' form.
   *
   * @since 1.0.0
   * @internal
   */
  auto access_deleted(bool value) -> mutate_in_options&
  {
    access_deleted_ = value;
    return self();
  }

  /**
   * For internal use only: allows creating documents in 'tombstone' form.
   *
   * @since 1.0.0
   * @internal
   */
  auto create_as_deleted(bool value) -> mutate_in_options&
  {
    create_as_deleted_ = value;
    return self();
  }

private:
  couchbase::store_semantics store_semantics_{ couchbase::store_semantics::replace };
  couchbase::cas cas_{};
  std::uint32_t expiry_{ 0 };
  bool preserve_expiry_{ false };
  bool access_deleted_{ false };
  bool create_as_deleted_{ false };
};

/**
 * The signature for the handler of the @ref collection#mutate_in() operation
 *
 * @since 1.0.0
 * @uncommitted
 */
using mutate_in_handler = std::function<void(error, mutate_in_result)>;
} // namespace couchbase
