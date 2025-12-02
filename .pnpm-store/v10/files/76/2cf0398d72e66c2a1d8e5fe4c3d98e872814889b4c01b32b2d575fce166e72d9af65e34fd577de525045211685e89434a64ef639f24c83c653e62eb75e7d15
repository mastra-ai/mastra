/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *   Copyright 2020-2021 Couchbase, Inc.
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

#include "bucket_create.hxx"

#include "core/utils/join_strings.hxx"
#include "core/utils/json.hxx"
#include "core/utils/url_codec.hxx"
#include "error_utils.hxx"

#include <couchbase/durability_level.hxx>

#include <tao/json/value.hpp>

namespace couchbase::core::operations::management
{

auto
bucket_create_request::encode_to(encoded_request_type& encoded,
                                 http_context& /* context */) const -> std::error_code
{
  encoded.method = "POST";
  encoded.path = "/pools/default/buckets";

  encoded.headers["content-type"] = "application/x-www-form-urlencoded";
  encoded.body.append(fmt::format("name={}", utils::string_codec::form_encode(bucket.name)));
  switch (bucket.bucket_type) {
    case couchbase::core::management::cluster::bucket_type::couchbase:
      encoded.body.append("&bucketType=couchbase");
      break;
    case couchbase::core::management::cluster::bucket_type::memcached:
      encoded.body.append("&bucketType=memcached");
      break;
    case couchbase::core::management::cluster::bucket_type::ephemeral:
      encoded.body.append("&bucketType=ephemeral");
      break;
    case couchbase::core::management::cluster::bucket_type::unknown:
      break;
  }
  if (bucket.ram_quota_mb == 0) {
    encoded.body.append(fmt::format(
      "&ramQuotaMB={}", 100)); // If not explicitly set, set to prior default value of 100
  } else {
    encoded.body.append(fmt::format("&ramQuotaMB={}", bucket.ram_quota_mb));
  }

  if (bucket.bucket_type != couchbase::core::management::cluster::bucket_type::memcached &&
      bucket.num_replicas.has_value()) {
    encoded.body.append(fmt::format("&replicaNumber={}", bucket.num_replicas.value()));
  }
  if (bucket.max_expiry.has_value()) {
    encoded.body.append(fmt::format("&maxTTL={}", bucket.max_expiry.value()));
  }
  if (bucket.bucket_type != couchbase::core::management::cluster::bucket_type::ephemeral &&
      bucket.replica_indexes.has_value()) {
    encoded.body.append(
      fmt::format("&replicaIndex={}", bucket.replica_indexes.value() ? "1" : "0"));
  }
  if (bucket.history_retention_collection_default.has_value()) {
    encoded.body.append(
      fmt::format("&historyRetentionCollectionDefault={}",
                  bucket.history_retention_collection_default.value() ? "true" : "false"));
  }
  if (bucket.history_retention_bytes.has_value()) {
    encoded.body.append(
      fmt::format("&historyRetentionBytes={}", bucket.history_retention_bytes.value()));
  }
  if (bucket.history_retention_duration.has_value()) {
    encoded.body.append(
      fmt::format("&historyRetentionSeconds={}", bucket.history_retention_duration.value()));
  }
  if (bucket.flush_enabled.has_value()) {
    encoded.body.append(fmt::format("&flushEnabled={}", bucket.flush_enabled.value() ? "1" : "0"));
  }
  if (bucket.num_vbuckets.has_value()) {
    encoded.body.append(fmt::format("&numVBuckets={}", bucket.num_vbuckets.value()));
  }

  switch (bucket.eviction_policy) {
    case couchbase::core::management::cluster::bucket_eviction_policy::full:
      encoded.body.append("&evictionPolicy=fullEviction");
      break;
    case couchbase::core::management::cluster::bucket_eviction_policy::value_only:
      encoded.body.append("&evictionPolicy=valueOnly");
      break;
    case couchbase::core::management::cluster::bucket_eviction_policy::no_eviction:
      encoded.body.append("&evictionPolicy=noEviction");
      break;
    case couchbase::core::management::cluster::bucket_eviction_policy::not_recently_used:
      encoded.body.append("&evictionPolicy=nruEviction");
      break;
    case couchbase::core::management::cluster::bucket_eviction_policy::unknown:
      break;
  }
  switch (bucket.compression_mode) {
    case couchbase::core::management::cluster::bucket_compression::off:
      encoded.body.append("&compressionMode=off");
      break;
    case couchbase::core::management::cluster::bucket_compression::active:
      encoded.body.append("&compressionMode=active");
      break;
    case couchbase::core::management::cluster::bucket_compression::passive:
      encoded.body.append("&compressionMode=passive");
      break;
    case couchbase::core::management::cluster::bucket_compression::unknown:
      break;
  }
  switch (bucket.conflict_resolution_type) {
    case couchbase::core::management::cluster::bucket_conflict_resolution::timestamp:
      encoded.body.append("&conflictResolutionType=lww");
      break;
    case couchbase::core::management::cluster::bucket_conflict_resolution::sequence_number:
      encoded.body.append("&conflictResolutionType=seqno");
      break;
    case couchbase::core::management::cluster::bucket_conflict_resolution::custom:
      encoded.body.append("&conflictResolutionType=custom");
      break;
    case couchbase::core::management::cluster::bucket_conflict_resolution::unknown:
      break;
  }
  if (bucket.minimum_durability_level.has_value()) {
    switch (bucket.minimum_durability_level.value()) {
      case durability_level::none:
        encoded.body.append("&durabilityMinLevel=none");
        break;
      case durability_level::majority:
        encoded.body.append("&durabilityMinLevel=majority");
        break;
      case durability_level::majority_and_persist_to_active:
        encoded.body.append("&durabilityMinLevel=majorityAndPersistActive");
        break;
      case durability_level::persist_to_majority:
        encoded.body.append("&durabilityMinLevel=persistToMajority");
        break;
    }
  }
  switch (bucket.storage_backend) {
    case couchbase::core::management::cluster::bucket_storage_backend::unknown:
      break;
    case couchbase::core::management::cluster::bucket_storage_backend::couchstore:
      encoded.body.append("&storageBackend=couchstore");
      break;
    case couchbase::core::management::cluster::bucket_storage_backend::magma:
      encoded.body.append("&storageBackend=magma");
      break;
  }
  return {};
}
auto
bucket_create_request::make_response(error_context::http&& ctx,
                                     const encoded_response_type& encoded) const
  -> bucket_create_response
{
  bucket_create_response response{ std::move(ctx) };
  if (!response.ctx.ec) {
    switch (encoded.status_code) {
      case 404:
        response.ctx.ec = errc::common::bucket_not_found;
        break;
      case 400: {
        tao::json::value payload{};
        try {
          payload = utils::json::parse(encoded.body.data());
        } catch (const tao::pegtl::parse_error&) {
          response.ctx.ec = errc::common::parsing_failure;
          return response;
        }
        response.ctx.ec = errc::common::invalid_argument;
        auto* errors = payload.find("errors");
        if (errors != nullptr) {
          std::vector<std::string> error_list{};
          for (const auto& [code, message] : errors->get_object()) {
            if (message.get_string().find("Bucket with given name already exists") !=
                std::string::npos) {
              response.ctx.ec = errc::management::bucket_exists;
            }
            error_list.emplace_back(message.get_string());
          }
          if (!error_list.empty()) {
            response.error_message = utils::join_strings(error_list, ". ");
          }
        }
      } break;
      case 200:
      case 202:
        break;
      default:
        response.ctx.ec = extract_common_error_code(encoded.status_code, encoded.body.data());
        break;
    }
  }
  return response;
}
} // namespace couchbase::core::operations::management
