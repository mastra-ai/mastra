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

#include "document_get_projected.hxx"

#include "core/impl/subdoc/command_bundle.hxx"
#include "core/utils/json.hxx"

#include <couchbase/error_codes.hxx>
#include <couchbase/lookup_in_specs.hxx>

#include <tao/json/value.hpp>

namespace couchbase::core::operations
{

namespace
{
auto
subdoc_lookup(tao::json::value& root, const std::string& path) -> std::optional<tao::json::value>
{
  std::string::size_type offset = 0;
  tao::json::value* cur = &root;

  while (offset < path.size()) {
    std::string::size_type idx = path.find_first_of(".[]", offset);

    if (idx == std::string::npos) {
      const std::string key = path.substr(offset);
      if (auto* val = cur->find(key); val != nullptr) {
        return *val;
      }
      break;
    }

    if (path[idx] == '.' || path[idx] == '[') {
      const std::string key = path.substr(offset, idx - offset);
      auto* val = cur->find(key);
      if (val == nullptr) {
        break;
      }
      cur = val;
    } else if (path[idx] == ']') {
      if (!cur->is_array()) {
        break;
      }
      const std::string key = path.substr(offset, idx - offset);
      if (const int array_index = std::stoi(key);
          array_index == -1 || static_cast<std::size_t>(array_index) < cur->get_array().size()) {
        cur = &cur->get_array().back();
      } else {
        break;
      }
      if (idx < path.size() - 1) {
        return *cur;
      }
      idx += 1;
    }
    offset = idx + 1;
  }

  return {};
}

void
subdoc_apply_projection(tao::json::value& root,
                        const std::string& path,
                        tao::json::value& value,
                        bool preserve_array_indexes)
{
  std::string::size_type offset = 0;
  tao::json::value* cur = &root;

  while (offset < path.size()) {
    std::string::size_type idx = path.find_first_of(".[]", offset);

    if (idx == std::string::npos) {
      cur->operator[](path.substr(offset)) = value;
      break;
    }

    if (path[idx] == '.') {
      const std::string key = path.substr(offset, idx - offset);
      tao::json::value* child = cur->find(key);
      if (child == nullptr) {
        cur->operator[](key) = tao::json::empty_object;
        child = cur->find(key);
      }
      cur = child;
    } else if (path[idx] == '[') {
      const std::string key = path.substr(offset, idx - offset);
      tao::json::value* child = cur->find(key);
      if (child == nullptr) {
        cur->operator[](key) = tao::json::empty_array;
        child = cur->find(key);
      }
      cur = child;
    } else if (path[idx] == ']') {
      tao::json::value child;
      if (idx == path.size() - 1) {
        child = value;
      } else if (path[idx + 1] == '.') {
        child = tao::json::empty_object;
      } else if (path[idx + 1] == '[') {
        child = tao::json::empty_array;
      } else {
        Expects(false);
      }
      if (preserve_array_indexes) {
        const int array_index = std::stoi(path.substr(offset, idx - offset));
        if (array_index >= 0) {
          if (static_cast<std::size_t>(array_index) >= cur->get_array().size()) {
            cur->get_array().resize(static_cast<std::size_t>(array_index) + 1, tao::json::null);
          }
          cur->at(static_cast<std::size_t>(array_index)) = child;
          cur = &cur->at(static_cast<std::size_t>(array_index));
        } else {
          // index is negative, just append and let user decide what it means
          cur->get_array().push_back(child);
          cur = &cur->get_array().back();
        }
      } else {
        cur->get_array().push_back(child);
        cur = &cur->get_array().back();
      }
      ++idx;
    }
    offset = idx + 1;
  }
}
} // namespace

auto
get_projected_request::encode_to(get_projected_request::encoded_request_type& encoded,
                                 mcbp_context&& /* context */) -> std::error_code
{
  encoded.opaque(opaque);
  encoded.partition(partition);
  encoded.body().id(id);

  effective_projections = projections;
  std::size_t num_projections = effective_projections.size();
  num_projections++; // flags
  if (with_expiry) {
    num_projections++;
  }
  if (num_projections > 16) {
    // too many subdoc operations, better fetch full document
    effective_projections.clear();
  }

  couchbase::lookup_in_specs specs{
    couchbase::lookup_in_specs::get(subdoc::lookup_in_macro::flags).xattr(),
  };
  if (with_expiry) {
    specs.push_back(couchbase::lookup_in_specs::get(subdoc::lookup_in_macro::expiry_time).xattr());
  }
  if (effective_projections.empty()) {
    specs.push_back(couchbase::lookup_in_specs::get(""));
  } else {
    for (const auto& path : effective_projections) {
      specs.push_back(couchbase::lookup_in_specs::get(path));
    }
  }
  encoded.body().specs(specs.specs());
  return {};
}

auto
get_projected_request::make_response(key_value_error_context&& ctx,
                                     const encoded_response_type& encoded) const
  -> get_projected_response
{
  get_projected_response response{ std::move(ctx) };
  if (!response.ctx.ec()) {
    response.cas = encoded.cas();
    response.flags = gsl::narrow_cast<std::uint32_t>(std::stoul(encoded.body().fields()[0].value));
    if (with_expiry && !encoded.body().fields()[1].value.empty()) {
      response.expiry =
        gsl::narrow_cast<std::uint32_t>(std::stoul(encoded.body().fields()[1].value));
    }
    if (effective_projections.empty()) {
      // from full document
      if (projections.empty() && with_expiry) {
        // special case when user only wanted full+expiration
        const auto& full_body = encoded.body().fields()[2].value;
        response.value.resize(full_body.size());
        std::transform(full_body.begin(), full_body.end(), response.value.begin(), [](auto ch) {
          return static_cast<std::byte>(ch);
        });
      } else {
        tao::json::value full_doc{};
        try {
          full_doc = utils::json::parse(encoded.body().fields()[with_expiry ? 2 : 1].value);
        } catch (const tao::pegtl::parse_error&) {
          response.ctx.override_ec(errc::common::parsing_failure);
          return response;
        }
        tao::json::value new_doc;
        for (const auto& projection : projections) {
          if (auto value_to_apply = subdoc_lookup(full_doc, projection)) {
            subdoc_apply_projection(new_doc, projection, *value_to_apply, preserve_array_indexes);
          } else {
            response.ctx.override_ec(errc::key_value::path_not_found);
            return response;
          }
        }
        response.value = utils::json::generate_binary(new_doc);
      }
    } else {
      tao::json::value new_doc = tao::json::empty_object;
      std::size_t offset = with_expiry ? 2 : 1;
      for (const auto& projection : projections) {
        const auto& field = encoded.body().fields()[offset];
        ++offset;
        if (field.status == key_value_status_code::success && !field.value.empty()) {
          tao::json::value value_to_apply{};
          try {
            value_to_apply = utils::json::parse(field.value);
          } catch (const tao::pegtl::parse_error&) {
            response.ctx.override_ec(errc::common::parsing_failure);
            return response;
          }
          subdoc_apply_projection(new_doc, projection, value_to_apply, preserve_array_indexes);
        } else if (field.status != key_value_status_code::subdoc_path_not_found) {
          response.ctx.override_ec(
            protocol::map_status_code(protocol::client_opcode::subdoc_multi_lookup,
                                      static_cast<std::uint16_t>(field.status)));
          return response;
        }
      }
      response.value = utils::json::generate_binary(new_doc);
    }
  }
  return response;
}
} // namespace couchbase::core::operations
