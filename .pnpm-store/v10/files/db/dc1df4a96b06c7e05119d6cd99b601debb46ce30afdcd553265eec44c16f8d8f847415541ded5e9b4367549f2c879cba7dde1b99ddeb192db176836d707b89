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

#include "internal/utils.hxx"

#include "core/operations.hxx"
#include "core/operations/document_lookup_in.hxx"
#include "core/operations/management/bucket_get_all.hxx"
#include "core/transactions/error_class.hxx"

#include <couchbase/collection.hxx>
#include <couchbase/scope.hxx>

namespace couchbase::core::transactions
{
auto
collection_spec_from_id(const core::document_id& id) -> std::string
{
  std::string retval = id.scope();
  return retval.append(".").append(id.collection());
}

auto
document_ids_equal(const core::document_id& id1, const core::document_id& id2) -> bool
{
  return id1.key() == id2.key() && id1.bucket() == id2.bucket() && id1.scope() == id2.scope() &&
         id1.collection() == id2.collection();
}

auto
jsonify(const tao::json::value& obj) -> std::string
{
  return core::utils::json::generate(obj);
}

auto
now_ns_from_vbucket(const tao::json::value& vbucket) -> std::uint64_t
{
  const std::string now_str = vbucket.at("HLC").at("now").get_string();
  return stoull(now_str, nullptr, 10) * 1000000000;
}

void
wrap_collection_call(result& res, const std::function<void(result&)>& call)
{
  call(res);
  if (!res.is_success()) {
    throw client_error(res);
  }
  if (!res.values.empty() && !res.ignore_subdoc_errors) {
    for (const auto& v : res.values) {
      if (v.status != subdoc_result::status_type::success) {
        throw client_error(res);
      }
    }
  }
}

void
validate_operation_result(result& res, bool ignore_subdoc_errors)
{
  if (!res.is_success()) {
    throw client_error(res);
  }
  // we should raise here, as we are doing a non-subdoc request and can't specify
  // access_deleted.  TODO: consider changing client to return document_not_found
  if (res.is_deleted && res.values.empty()) {
    res.ec = couchbase::errc::key_value::document_not_found;
    throw client_error(res);
  }
  if (!res.values.empty() && !ignore_subdoc_errors) {
    for (const auto& v : res.values) {
      if (v.status != subdoc_result::status_type::success) {
        throw client_error(res);
      }
    }
  }
}

auto
wrap_operation_future(std::future<result>& fut, bool ignore_subdoc_errors) -> result
{
  auto res = fut.get();
  validate_operation_result(res, ignore_subdoc_errors);
  return res;
}

auto
wait_for_hook(const std::function<void(utils::movable_function<void(std::optional<error_class>)>)>&
                hook) -> std::optional<error_class>
{
  auto hook_barrier = std::make_shared<std::promise<std::optional<error_class>>>();
  auto hook_future = hook_barrier->get_future();
  hook([hook_barrier](std::optional<error_class> ec) mutable {
    return hook_barrier->set_value(ec);
  });
  return hook_future.get();
}

template<>
auto
is_error(const core::operations::mutate_in_response& resp) -> bool
{
  return resp.ctx.ec() || resp.ctx.first_error_index();
}

template<>
auto
error_class_from_response_extras(const core::operations::mutate_in_response& resp)
  -> std::optional<error_class>
{
  if (const auto& first_error_index = resp.ctx.first_error_index(); first_error_index.has_value()) {
    auto status = resp.fields.at(first_error_index.value()).status;
    if (status == key_value_status_code::subdoc_path_not_found) {
      return FAIL_PATH_NOT_FOUND;
    }
    if (status == key_value_status_code::subdoc_path_exists) {
      return FAIL_PATH_ALREADY_EXISTS;
    }
    return FAIL_OTHER;
  }
  return {};
}

auto
atr_id_from_bucket_and_key(const couchbase::transactions::transactions_config::built& cfg,
                           const std::string& bucket,
                           const std::string& key) -> core::document_id
{
  if (cfg.metadata_collection) {
    return { cfg.metadata_collection->bucket,
             cfg.metadata_collection->scope,
             cfg.metadata_collection->collection,
             key };
  }
  return { bucket, couchbase::scope::default_name, couchbase::collection::default_name, key };
}
} // namespace couchbase::core::transactions
