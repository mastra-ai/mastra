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

#include <couchbase/codec/default_json_transcoder.hxx>
#include <couchbase/subdoc/array_add_unique.hxx>
#include <couchbase/subdoc/array_append.hxx>
#include <couchbase/subdoc/array_insert.hxx>
#include <couchbase/subdoc/array_prepend.hxx>
#include <couchbase/subdoc/counter.hxx>
#include <couchbase/subdoc/insert.hxx>
#include <couchbase/subdoc/mutate_in_macro.hxx>
#include <couchbase/subdoc/remove.hxx>
#include <couchbase/subdoc/replace.hxx>
#include <couchbase/subdoc/upsert.hxx>

#include <memory>
#include <vector>

namespace couchbase
{
#ifndef COUCHBASE_CXX_CLIENT_DOXYGEN
namespace
{
template<typename Value>
auto
encode_array(const Value& value) -> std::vector<std::vector<std::byte>>
{
  return { std::move(codec::default_json_transcoder::encode(value).data) };
}

template<typename Value>
auto
encode_array(std::vector<std::vector<std::byte>>&& output,
             const Value& value) -> std::vector<std::vector<std::byte>>
{
  output.emplace_back(std::move(codec::default_json_transcoder::encode(value).data));
  return std::move(output);
}

template<typename Value, typename... Rest>
auto
encode_array(std::vector<std::vector<std::byte>>&& output,
             const Value& value,
             Rest... args) -> std::vector<std::vector<std::byte>>
{
  output.emplace_back(std::move(codec::default_json_transcoder::encode(value).data));
  return encode_array(std::move(output), args...);
}

template<typename Value, typename... Rest>
auto
encode_array(const Value& value, Rest... args) -> std::vector<std::vector<std::byte>>
{
  return encode_array(encode_array(value), args...);
}

} // namespace
#endif

class mutate_in_specs
{
public:
  mutate_in_specs() = default;

  template<typename... Operation>
  explicit mutate_in_specs(Operation... args)
  {
    push_back(args...);
  }

  /**
   * Creates a spec with the intention of replacing an existing value in a JSON document.
   *
   * If the path is empty (""), then the value will be used for the document's full body. Will
   * error if the last element of the path does not exist.
   *
   * @param path the path identifying where to replace the value.
   * @param value the value to replace with.
   * @return the created spec
   *
   * @since 1.0.0
   * @committed
   */
  template<typename Value>
  static auto replace(std::string path, const Value& value) -> subdoc::replace
  {
    return { std::move(path), std::move(codec::default_json_transcoder::encode(value).data) };
  }

  /**
   * Creates a spec with the intention of replacing an existing value in a JSON document.
   *
   * The macro will be expanded on the server side.
   *
   * @param path the path identifying where to replace the value.
   * @param value the value to replace with.
   * @return the created spec
   *
   * @since 1.0.0
   * @committed
   */
  static auto replace(std::string path, subdoc::mutate_in_macro value) -> subdoc::replace
  {
    return { std::move(path), value };
  }

  /**
   * Creates a spec with the intention of replacing an existing value in a JSON document.
   *
   * If the path is empty (""), then the value will be used for the document's full body. Will
   * error if the last element of the path does not exist.
   *
   * @note this is low-level method that expect pre-formatted value.
   *
   * @param path the path identifying where to insert the value.
   * @param value the value to insert
   * @param expand_macro true if the value encodes macro
   * @return the created spec
   *
   * @since 1.0.0
   * @internal
   */
  static auto replace_raw(std::string path,
                          std::vector<std::byte> value,
                          bool expand_macro = false) -> subdoc::replace
  {
    return { std::move(path), std::move(value), expand_macro };
  }

  /**
   * Creates a command with the intention of inserting a new value in a JSON object.
   *
   * Will error if the last element of the path already exists.
   *
   * @param path the path identifying where to insert the value.
   * @param value the value to insert
   * @return the created spec
   *
   * @since 1.0.0
   * @committed
   */
  template<typename Value>
  static auto insert(std::string path, const Value& value) -> subdoc::insert
  {
    return { std::move(path), std::move(codec::default_json_transcoder::encode(value).data) };
  }

  /**
   * Creates a command with the intention of inserting a new value in a JSON object.
   *
   * The macro will be expanded on the server side.
   * Will error if the last element of the path already exists.
   *
   * @param path the path identifying where to insert the value.
   * @param value the value to insert
   * @return the created spec
   *
   * @since 1.0.0
   * @committed
   */
  static auto insert(std::string path, subdoc::mutate_in_macro value) -> subdoc::insert
  {
    return { std::move(path), value };
  }

  /**
   * Creates a command with the intention of inserting a new value in a JSON object.
   *
   * Will error if the last element of the path already exists.
   *
   * @note this is low-level method that expect pre-formatted value.
   *
   * @param path the path identifying where to insert the value.
   * @param value the value to insert
   * @param expand_macro true if the value encodes macro
   * @return the created spec
   *
   * @since 1.0.0
   * @internal
   */
  static auto insert_raw(std::string path,
                         std::vector<std::byte> value,
                         bool expand_macro = false) -> subdoc::insert
  {
    return { std::move(path), std::move(value), expand_macro };
  }

  /**
   * Creates a command with the intention of removing an existing value in a JSON object.
   *
   * Will error if the path does not exist.
   *
   * @param path the path identifying what to remove.
   * @return the created spec
   *
   * @since 1.0.0
   * @committed
   */
  static auto remove(std::string path) -> subdoc::remove
  {
    return subdoc::remove{ std::move(path) };
  }

  /**
   * Creates a command with the intention of upserting a value in a JSON object.
   *
   * That is, the value will be replaced if the path already exists, or inserted if not.
   *
   * @param path the path identifying where to upsert the value.
   * @param value the value to upsert.
   * @return the created spec
   *
   * @since 1.0.0
   * @committed
   */
  template<typename Value, typename Transcoder = codec::default_json_transcoder>
  static auto upsert(std::string path, const Value& value) -> subdoc::upsert
  {
    return { std::move(path), std::move(Transcoder::template encode<const Value&>(value).data) };
  }

  /**
   * Creates a command with the intention of upserting a value in a JSON object.
   *
   * That is, the value will be replaced if the path already exists, or inserted if not.
   * The macro will be expanded on the server side.
   *
   * @param path the path identifying where to upsert the value.
   * @param value the macro value to upsert.
   * @return the created spec
   *
   * @since 1.0.0
   * @committed
   */
  static auto upsert(std::string path, subdoc::mutate_in_macro value) -> subdoc::upsert
  {
    return { std::move(path), value };
  }

  /**
   * Creates a command with the intention of upserting a value in a JSON object.
   *
   * That is, the value will be replaced if the path already exists, or inserted if not.
   *
   * @note this is low-level method that expect pre-formatted value.
   *
   * @param path the path identifying where to upsert the value.
   * @param value the value to upsert.
   * @param expand_macro true if the value encodes macro
   * @return the created spec
   *
   * @since 1.0.0
   * @internal
   */
  static auto upsert_raw(std::string path,
                         std::vector<std::byte> value,
                         bool expand_macro = false) -> subdoc::upsert
  {
    return { std::move(path), std::move(value), expand_macro };
  }

  /**
   * Creates a command with the intent of incrementing a numerical field in a JSON object.
   *
   * If the field does not exist then it is created and takes the value of `delta`.
   *
   * @param path the path identifying a numerical field to adjust or create.
   * @param delta the positive value to increment the field by.
   * @return the created spec
   *
   * @since 1.0.0
   * @committed
   */
  static auto increment(std::string path, std::int64_t delta) -> subdoc::counter
  {
    if (delta < 0) {
      throw std::system_error(errc::common::invalid_argument,
                              "only positive delta allowed in subdoc increment, given: " +
                                std::to_string(delta));
    }
    return { std::move(path), delta };
  }

  /**
   * Creates a command with the intent of decrementing a numerical field in a JSON object.
   *
   * @param path the path identifying a numerical field to adjust or create.
   * @param delta the positive value to decrement the field by.
   * @return the created spec
   *
   * @since 1.0.0
   * @committed
   */
  static auto decrement(std::string path, std::int64_t delta) -> subdoc::counter
  {
    if (delta < 0) {
      throw std::system_error(errc::common::invalid_argument,
                              "only positive delta allowed in subdoc decrement, given: " +
                                std::to_string(delta));
    }
    return { std::move(path), -1 * delta };
  }

  /**
   * Creates a command with the intention of appending a value to an existing JSON array.
   *
   * Will error if the last element of the path does not exist or is not an array.
   *
   * @param path the path identifying an array to which to append the value.
   * @param values the value(s) to append.
   * @return the created spec
   *
   * @since 1.0.0
   * @committed
   */
  template<typename... Values>
  static auto array_append(std::string path, Values... values) -> subdoc::array_append
  {
    return { std::move(path), encode_array(values...) };
  }

  /**
   * Creates a command with the intention of appending a value to an existing JSON array.
   *
   * Will error if the last element of the path does not exist or is not an array.
   *
   * @note this is low-level method that expect pre-formatted value.
   *
   * @param path the path identifying an array to which to append the value.
   * @param values the value(s) to append.
   * @return the created spec
   *
   * @since 1.0.0
   * @internal
   */
  static auto array_append_raw(std::string path,
                               std::vector<std::byte> values) -> subdoc::array_append
  {
    return { std::move(path), { std::move(values) } };
  }

  /**
   * Creates a command with the intention of prepending a value to an existing JSON array.
   *
   * Will error if the last element of the path does not exist or is not an array.
   *
   * @param path the path identifying an array to which to append the value.
   * @param values the value(s) to prepend.
   * @return the created spec
   *
   * @since 1.0.0
   * @committed
   */
  template<typename... Values>
  static auto array_prepend(std::string path, Values... values) -> subdoc::array_prepend
  {
    return { std::move(path), encode_array(values...) };
  }

  /**
   * Creates a command with the intention of prepending a value to an existing JSON array.
   *
   * Will error if the last element of the path does not exist or is not an array.
   *
   * @note this is low-level method that expect pre-formatted value.
   *
   * @param path the path identifying an array to which to append the value.
   * @param values the value(s) to prepend.
   * @return the created spec
   *
   * @since 1.0.0
   * @internal
   */
  static auto array_prepend_raw(std::string path,
                                std::vector<std::byte> values) -> subdoc::array_prepend
  {
    return { std::move(path), { std::move(values) } };
  }

  /**
   * Creates a command with the intention of inserting a value into an existing JSON array.
   *
   * Will error if the last element of the path does not exist or is not an array.
   *
   * @param path the path identifying an array to which to append the value, and an index.  E.g.
   * "foo.bar[3]"
   * @param values the value(s) to insert.
   * @return the created spec
   *
   * @since 1.0.0
   * @committed
   */
  template<typename... Values>
  static auto array_insert(std::string path, Values... values) -> subdoc::array_insert
  {
    return { std::move(path), encode_array(values...) };
  }

  /**
   * Creates a command with the intention of inserting a value into an existing JSON array.
   *
   * Will error if the last element of the path does not exist or is not an array.
   *
   * @note this is low-level method that expect pre-formatted value.
   *
   * @param path the path identifying an array to which to append the value, and an index.  E.g.
   * "foo.bar[3]"
   * @param values the value(s) to insert.
   * @return the created spec
   *
   * @since 1.0.0
   * @internal
   */
  static auto array_insert_raw(std::string path,
                               std::vector<std::byte> values) -> subdoc::array_insert
  {
    return { std::move(path), { std::move(values) } };
  }

  /**
   * Creates a command with the intent of inserting a value into an existing JSON array, but only if
   * the value is not already contained in the array (by way of string comparison).
   *
   * Will error if the last element of the path does not exist or is not an array.
   *
   * @param path the path identifying an array to which to append the value, and an index.  E.g.
   * "foo.bar[3]"
   * @param value the value to insert.
   * @return the created spec
   *
   * @since 1.0.0
   * @committed
   */
  template<typename Value, typename Transcoder = codec::default_json_transcoder>
  static auto array_add_unique(std::string path, const Value& value) -> subdoc::array_add_unique
  {
    return { std::move(path), std::move(Transcoder::template encode<Value>(value).data) };
  }

  /**
   * Creates a command with the intent of inserting a value into an existing JSON array, but only if
   * the value is not already contained in the array (by way of string comparison).
   *
   * Will error if the last element of the path does not exist or is not an array.
   * The macro will be expanded on the server side.
   *
   * @param path the path identifying an array to which to append the value, and an index.  E.g.
   * "foo.bar[3]"
   * @param value the macro value to insert.
   * @return the created spec
   *
   * @since 1.0.0
   * @committed
   */
  static auto array_add_unique(std::string path,
                               subdoc::mutate_in_macro value) -> subdoc::array_add_unique
  {
    return { std::move(path), value };
  }

  /**
   * Creates a command with the intent of inserting a value into an existing JSON array, but only if
   * the value is not already contained in the array (by way of string comparison).
   *
   * Will error if the last element of the path does not exist or is not an array.
   *
   * @note this is low-level method that expect pre-formatted value.
   *
   * @param path the path identifying an array to which to append the value, and an index.  E.g.
   * "foo.bar[3]"
   * @param value the value to insert.
   * @param expand_macro true if the value encodes macro
   * @return the created spec
   *
   * @since 1.0.0
   * @committed
   */
  static auto array_add_unique_raw(std::string path,
                                   std::vector<std::byte> value,
                                   bool expand_macro = false) -> subdoc::array_add_unique
  {
    return { std::move(path), std::move(value), expand_macro };
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
