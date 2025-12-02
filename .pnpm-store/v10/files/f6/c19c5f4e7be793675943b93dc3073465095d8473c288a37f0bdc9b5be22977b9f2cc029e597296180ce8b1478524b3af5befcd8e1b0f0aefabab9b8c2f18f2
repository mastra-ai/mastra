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

#include <couchbase/codec/json_transcoder.hxx>
#include <couchbase/subdoc/count.hxx>
#include <couchbase/subdoc/exists.hxx>
#include <couchbase/subdoc/get.hxx>

#include <memory>
#include <vector>

namespace couchbase
{
class lookup_in_specs
{
public:
  lookup_in_specs() = default;

  template<typename... Operation>
  explicit lookup_in_specs(Operation... args)
  {
    push_back(args...);
  }

  /**
   * Fetches the content from a field (if present) at the given path.
   *
   * @param path the path identifying where to get the value.
   * @return the created spec
   *
   * @since 1.0.0
   * @committed
   */
  static auto get(std::string path) -> subdoc::get
  {
    return subdoc::get{ std::move(path) };
  }

  /**
   * Fetches the content from a field represented by given virtual attribute (macro).
   *
   * @param macro the path identifying where to get the value.
   * @return the created spec
   *
   * @since 1.0.0
   * @committed
   */
  static auto get(subdoc::lookup_in_macro macro) -> subdoc::get
  {
    return subdoc::get{ macro };
  }

  /**
   * Checks if a value at the given path exists in the document.
   *
   * @param path the path to check if the field exists.
   * @return the created spec
   *
   * @since 1.0.0
   * @committed
   */
  static auto exists(std::string path) -> subdoc::exists
  {
    return subdoc::exists{ std::move(path) };
  }

  /**
   * Counts the number of values at a given path in the document.
   *
   * @param path the path identifying where to count the values.
   * @return the created spec
   *
   * @since 1.0.0
   * @committed
   */
  static auto count(std::string path) -> subdoc::count
  {
    return subdoc::count{ std::move(path) };
  }

  /**
   * Add subdocument operation to list of specs
   *
   * @tparam Operation type of the subdocument operation
   * @param operation operation to execute
   *
   * @since 1.0.0
   * @committed
   */
  template<typename Operation>
  void push_back(const Operation& operation)
  {
    operation.encode(bundle());
  }

  /**
   * Add subdocument operations to list of specs
   *
   * @tparam Operation type of the subdocument operation
   * @tparam Rest types of the rest of the operations
   * @param operation operation to execute
   * @param args the rest of the arguments
   *
   * @since 1.0.0
   * @committed
   */
  template<typename Operation, typename... Rest>
  void push_back(const Operation& operation, Rest... args)
  {
    push_back(operation);
    push_back(args...);
  }

  /**
   * Returns internal representation of the specs.
   * @return specs
   *
   * @since 1.0.0
   * @internal
   */
  [[nodiscard]] auto specs() const -> const std::vector<core::impl::subdoc::command>&;

private:
  [[nodiscard]] auto bundle() -> core::impl::subdoc::command_bundle&;

  std::shared_ptr<core::impl::subdoc::command_bundle> specs_{};
};
} // namespace couchbase
