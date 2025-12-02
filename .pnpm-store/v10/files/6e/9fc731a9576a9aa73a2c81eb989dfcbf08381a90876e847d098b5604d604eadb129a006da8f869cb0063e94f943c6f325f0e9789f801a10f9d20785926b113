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

#pragma once

#include "core/utils/json.hxx"

#include "core/utils/binary.hxx"

#include "couchbase/codec/tao_json_serializer.hxx"

#include <optional>
#include <string>
#include <vector>

/**
 * @file
 * Provides an object encapsulating the results of a kv operation in Couchbase Transactions Client.
 */
namespace couchbase::core
{
namespace operations
{
struct lookup_in_response;
struct mutate_in_response;
} // namespace operations

namespace transactions
{
struct result_base {
  std::vector<std::byte> raw_value;
  std::error_code ec;

  result_base() = default;

  result_base(const std::vector<std::byte>& res)
    : raw_value(res)
  {
  }

  auto has_value() const -> bool
  {
    return !raw_value.empty();
  }
};

/**
 * @brief Result of a subdoc operation.
 *
 * See @ref collection.lookup_in and @ref collection.mutate_in
 */
struct subdoc_result : result_base {
  enum class status_type : uint16_t {
    success = 0x00,
    subdoc_path_not_found = 0xc0,
    subdoc_path_mismatch = 0xc1,
    subdoc_path_invalid = 0xc2,
    subdoc_path_too_big = 0xc3,
    subdoc_doc_too_deep = 0xc4,
    subdoc_value_cannot_insert = 0xc5,
    subdoc_doc_not_json = 0xc6,
    subdoc_num_range_error = 0xc7,
    subdoc_delta_invalid = 0xc8,
    subdoc_path_exists = 0xc9,
    subdoc_value_too_deep = 0xca,
    subdoc_invalid_combo = 0xcb,
    subdoc_multi_path_failure = 0xcc,
    subdoc_success_deleted = 0xcd,
    subdoc_xattr_invalid_flag_combo = 0xce,
    subdoc_xattr_invalid_key_combo = 0xcf,
    subdoc_xattr_unknown_macro = 0xd0,
    subdoc_xattr_unknown_vattr = 0xd1,
    subdoc_xattr_cannot_modify_vattr = 0xd2,
    subdoc_multi_path_failure_deleted = 0xd3,
    subdoc_invalid_xattr_order = 0xd4,
  };

  status_type status;

  subdoc_result()
    : result_base()
    , status(status_type::success)
  {
  }

  subdoc_result(std::uint32_t s)
    : status(static_cast<status_type>(s))
  {
  }

  subdoc_result(const std::vector<std::byte>& v, std::uint32_t s)
    : result_base(v)
    , status(static_cast<status_type>(s))
  {
  }

  template<typename T>
  auto content_as() const -> T
  {
    // this will always be a json string.  To not have extraneous
    // "" when asked to return as a string, we parse it first.
    // NOTE: lets do better.
    return codec::tao_json_serializer::deserialize<T>(raw_value);
  }

  [[nodiscard]] auto content_as() const -> tao::json::value
  {
    return core::utils::json::parse_binary(raw_value);
  }
};

/**
 * @brief The result of an operation on a cluster.
 *
 * This encapsulates the server response to an operation.  For example:
 *
 * @code{.cpp}
 * std::string key = "somekey";
 * result res = collection->get(key);
 * if (res.is_success()) {
 *     auto doc = res.value.get<nlohmann::json>();
 * } else {
 *     cerr << "error getting " << key << ":" << res.strerror();
 * }
 * @endcode
 *
 * If the operation returns multiple results, like a lookup_in, then
 * @ref result::values is used instead:
 *
 * @code{.cpp}
 * std::string key = "somekey";
 * result res = collection->lookup_in(key, {lookup_in_spec::get("name"),
 * lookup_in_spec::get("address")}); if (res.is_success()) { auto name =
 * res.values[0].value->get<std::string>(); auto address = res.values[1].value->get<std::string>();
 * } else {
 *     cerr << "error getting " << key << ":" << res.strerror();
 * }
 * @endcode
 *
 * If you define a to_json and from_json on an object, you can serialize/deserialize into it
 * directly:
 *
 * @code{.cpp}
 * struct Person {
 *     std::string name;
 *     std::string address
 * };
 *
 * void
 * to_json(nlohmann::json& j, const Person& p) {
 *    j = nlohmann::json({ {"name", p.name} , {"address", p.address}};
 * }
 *
 * void
 * from_json(const nlohmann::json& j, Person& p) {
 *    j.at("name").get_to(p.name);
 *    j.at("address").get_to(p.address);
 * }
 *
 * auto res = collection.get(key);
 * if (res.is_success()) {
 *     Person p = res.value->get<Person>();
 *     cout << "name=" << p.name << ",address=" << p.address;
 * } else {
 *     cerr << "error getting " << key << ":" << res.strerror();
 * }
 * @endcode
 */

struct result : result_base {
  /** @brief return code for operation */
  std::uint32_t rc{ 0 };
  /** @brief CAS for document, if any */
  std::uint64_t cas{ 0 };
  /** @brief datatype flag for content */
  std::uint8_t datatype{ 0 };
  std::uint32_t flags{ 0 };
  /** @brief document key */
  std::string key;
  /** @brief results of subdoc spec operations */
  std::vector<subdoc_result> values{};
  bool is_deleted{ false };
  bool ignore_subdoc_errors{ false };

  template<typename Resp>
  static auto create_from_mutation_response(const Resp& resp) -> result
  {
    result res{};
    res.ec = resp.ctx.ec();
    res.cas = resp.cas.value();
    res.key = resp.ctx.id();
    return res;
  }

  template<typename Resp>
  static auto create_from_response(const Resp& resp) -> result
  {
    result res{};
    res.ec = resp.ctx.ec();
    res.cas = resp.cas.value();
    res.key = resp.ctx.id();
    res.flags = resp.flags;
    res.raw_value = resp.value;
    return res;
  }

  static auto create_from_subdoc_response(const core::operations::lookup_in_response& resp)
    -> result;

  static auto create_from_subdoc_response(const core::operations::mutate_in_response& resp)
    -> result;

  result() = default;

  /**
   * Get description of error
   *
   * @return String describing the error code.
   */
  [[nodiscard]] auto strerror() const -> std::string;

  [[nodiscard]] auto is_success() const -> bool;
  /**
   *  Get error code.  This is either the rc_, or if that is LCB_SUCCESS,
   *  then the first error in the values (if any) see @ref subdoc_results
   */
  // [[nodiscard]]std::uint32_t error() const;
  template<typename OStream>
  friend auto operator<<(OStream& os, const result& res) -> OStream&
  {
    os << "result{";
    os << "rc:" << res.rc << ",";
    os << "strerror:" << res.strerror() << ",";
    os << "cas:" << res.cas << ",";
    os << "is_deleted:" << std::boolalpha << res.is_deleted << ",";
    os << "datatype:" << res.datatype << ",";
    os << "flags:" << res.flags << ",";
    os << "raw_value" << utils::to_string(res.raw_value);
    if (!res.values.empty()) {
      os << ",values:[";
      for (const auto& v : res.values) {
        os << "{" << utils::to_string(v.raw_value) << "," << static_cast<std::uint32_t>(v.status)
           << "},";
      }
      os << "]";
    }
    os << "}";
    return os;
  }

  template<typename T>
  auto content_as() const -> T
  {
    return codec::tao_json_serializer::deserialize<T>(raw_value);
  }

  [[nodiscard]] auto subdoc_status() const -> subdoc_result::status_type;
};
} // namespace transactions
} // namespace couchbase::core
