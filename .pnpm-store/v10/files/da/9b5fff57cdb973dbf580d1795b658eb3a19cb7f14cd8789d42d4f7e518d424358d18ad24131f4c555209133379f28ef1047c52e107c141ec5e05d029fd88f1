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

#include <couchbase/subdoc/fwd/command.hxx>
#include <couchbase/subdoc/fwd/command_bundle.hxx>

#include <string>
#include <vector>

namespace couchbase
{
class mutate_in_specs;

namespace subdoc
{
/**
 * An intention to perform a SubDocument counter operation.
 *
 * @since 1.0.0
 * @committed
 */
class counter
{
public:
  /**
   * Sets that this is an extended attribute (xattr) field.
   *
   * @param value new value for the option
   * @return this, for chaining
   *
   * @since 1.0.0
   * @committed
   */
  auto xattr(bool value = true) -> counter&
  {
    xattr_ = value;
    return *this;
  }

  /**
   * Sets that this parent fields should be created automatically.
   *
   * @param value new value for the option
   * @return this, for chaining
   *
   * @since 1.0.0
   * @committed
   */
  auto create_path(bool value = true) -> counter&
  {
    create_path_ = value;
    return *this;
  }

private:
#ifndef COUCHBASE_CXX_CLIENT_DOXYGEN
  friend couchbase::mutate_in_specs;
#endif

  counter(std::string path, int64_t value)
    : path_(std::move(path))
    , delta_{ value }
  {
  }

  void encode(core::impl::subdoc::command_bundle& bundle) const;

  std::string path_;
  int64_t delta_;
  bool xattr_{ false };
  bool create_path_{ false };
};
} // namespace subdoc
} // namespace couchbase
