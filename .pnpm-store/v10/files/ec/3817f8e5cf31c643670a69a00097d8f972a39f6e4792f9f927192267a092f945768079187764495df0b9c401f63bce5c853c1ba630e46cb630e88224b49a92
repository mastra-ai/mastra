/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *   Copyright 2024. Couchbase, Inc.
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

#include "management_component.hxx"

#include "core/http_component.hxx"
#include "core/logger/logger.hxx"
#include "core/platform/uuid.h"
#include "core/utils/json.hxx"
#include "core/utils/movable_function.hxx"
#include "error.hxx"
#include "error_codes.hxx"

#include <chrono>
#include <optional>
#include <string>

#include <gsl/narrow>
#include <tao/json/value.hpp>
#include <tl/expected.hpp>

namespace couchbase::core::columnar
{
struct query_based_management_request {
  std::string statement;
  std::optional<std::chrono::milliseconds> timeout{};
  std::string client_context_id{ uuid::to_string(uuid::random()) };
};

class pending_management_operation
  : public std::enable_shared_from_this<pending_management_operation>
  , public pending_operation
{
public:
  pending_management_operation(http_request req, http_component& http)
    : req_{ std::move(req) }
    , http_{ http }
  {
  }

  auto parse_management_error(const std::uint32_t& http_status,
                              const tao::json::value& body) -> error
  {
    const auto* errors_json = body.find("errors");
    if (errors_json == nullptr) {
      return {};
    }
    if (!errors_json->is_array()) {
      return { errc::generic, "Could not parse errors from server response - expected JSON array" };
    }
    if (errors_json->get_array().empty()) {
      return {};
    }

    CB_LOG_DEBUG("MANAGEMENT OPERATION ERROR (client_context_id={}, http_status={}): {}.",
                 req_.client_context_id,
                 http_status,
                 utils::json::generate(errors_json));

    error err{ errc::generic };
    err.ctx["http_status"] = std::to_string(http_status);
    err.ctx["errors"] = std::vector<tao::json::value>{};

    if (http_status == 401) {
      err.ec = errc::invalid_credential;
    }

    for (auto error_json : errors_json->get_array()) {
      auto* msg = error_json.find("msg");
      if (msg == nullptr) {
        return { errc::generic,
                 "Could not parse error from server response - could not find 'msg' field" };
      }
      if (!msg->is_string()) {
        return { errc::generic,
                 "Could not parse error from server response - 'msg' field was not string" };
      }

      auto* c = error_json.find("code");
      if (c == nullptr) {
        return { errc::generic,
                 "Could not parse error from server response - could not find 'code' field" };
      }
      if (!(c->is_unsigned() || c->is_signed())) {
        return { errc::generic,
                 "Could not parse error from server response - 'code' field was not an integer" };
      }

      std::int32_t code = c->is_signed() ? gsl::narrow_cast<std::int32_t>(c->get_signed())
                                         : gsl::narrow_cast<std::int32_t>(c->get_unsigned());

      tao::json::value error = {
        { "code", code },
        { "msg", msg->get_string() },
      };
      err.ctx["errors"].get_array().emplace_back(std::move(error));

      switch (code) {
        case 20000:
          err.ec = errc::invalid_credential;
          break;
        case 21002:
          err.ec = errc::timeout;
          break;
        default:
          break;
      }
    }

    return err;
  }

  auto execute(core::utils::movable_function<void(std::vector<tao::json::value>, error)>&& callback)
    -> error
  {
    auto op = http_.do_http_request_buffered(
      req_,
      [self = shared_from_this(), cb = std::move(callback)](buffered_http_response resp, auto ec) {
        if (ec) {
          return cb(
            {}, { maybe_convert_error_code(ec), "Failed to execute management HTTP operation" });
        }
        auto body_json = utils::json::parse(std::string_view{ resp.body() });
        auto err = self->parse_management_error(resp.status_code(), body_json);
        if (err) {
          return cb({}, err);
        }
        const auto* results_json = body_json.find("results");
        if (results_json == nullptr) {
          return cb({}, {});
        }
        if (!results_json->is_array()) {
          return cb({},
                    { errc::generic,
                      "Could not parse results from server response - expected JSON array" });
        }
        cb(results_json->get_array(), {});
      });

    if (op.has_value()) {
      http_op_ = std::move(op.value());
      return {};
    }
    return error{ maybe_convert_error_code(op.error()),
                  "Failed do dispatch management HTTP operation" };
  }

  void cancel() override
  {
    if (http_op_) {
      http_op_->cancel();
    }
  }

private:
  http_request req_;
  http_component& http_;
  std::shared_ptr<pending_operation> http_op_{};
};

class management_component_impl
{
public:
  management_component_impl(http_component http, std::chrono::milliseconds default_timeout)
    : http_{ std::move(http) }
    , default_timeout_{ default_timeout }
  {
  }

  auto database_fetch_all(const fetch_all_databases_options& options,
                          fetch_all_databases_callback&& callback)
    -> tl::expected<std::shared_ptr<pending_operation>, error>
  {
    query_based_management_request req{
      "SELECT d.* FROM `System`.`Metadata`.`Database` AS d",
      options.timeout,
    };
    return execute(std::move(req), [cb = std::move(callback)](const auto& raw_res, auto err) {
      if (err) {
        cb({}, std::move(err));
        return;
      }
      std::vector<database_metadata> res{};
      res.reserve(raw_res.size());
      for (tao::json::value raw_metadata : raw_res) {
        res.emplace_back(database_metadata{
          raw_metadata["DatabaseName"].get_string(),
          raw_metadata["SystemDatabase"].get_boolean(),
        });
      }
      cb(std::move(res), {});
    });
  }

  auto database_create(const create_database_options& options, create_database_callback&& callback)
    -> tl::expected<std::shared_ptr<pending_operation>, error>
  {
    query_based_management_request req{
      fmt::format("CREATE DATABASE `{}`", options.name),
      options.timeout,
    };
    if (options.ignore_if_exists) {
      req.statement += " IF NOT EXISTS";
    }
    return execute(std::move(req), [cb = std::move(callback)](const auto& /*raw_res*/, auto err) {
      cb(std::move(err));
    });
  }

  auto database_drop(const drop_database_options& options, drop_database_callback&& callback)
    -> tl::expected<std::shared_ptr<pending_operation>, error>
  {
    query_based_management_request req{
      fmt::format("DROP DATABASE `{}`", options.name),
      options.timeout,
    };
    if (options.ignore_if_not_exists) {
      req.statement += " IF EXISTS";
    }
    return execute(std::move(req), [cb = std::move(callback)](const auto& /*raw_res*/, auto err) {
      cb(std::move(err));
    });
  }

private:
  auto execute(query_based_management_request req,
               core::utils::movable_function<void(std::vector<tao::json::value>, error)>&& callback)
    -> tl::expected<std::shared_ptr<pending_management_operation>, error>
  {
    const std::chrono::milliseconds timeout = req.timeout.value_or(default_timeout_);
    const std::chrono::milliseconds server_timeout = timeout + std::chrono::seconds(5);

    const tao::json::value body{
      { "statement", std::move(req.statement) },
      { "client_context_id", req.client_context_id },
      { "timeout", fmt::format("{}ms", server_timeout.count()) },
    };

    http_request http_req{ service_type::analytics, "POST", {}, "/api/v1/request" };
    http_req.body = utils::json::generate(body);
    http_req.headers["content-type"] = "application/json";
    http_req.client_context_id = std::move(req.client_context_id);
    http_req.timeout = timeout;

    auto op = std::make_shared<pending_management_operation>(std::move(http_req), http_);
    auto err = op->execute(std::move(callback));
    if (err) {
      return tl::unexpected{ err };
    }
    return op;
  }

  http_component http_;
  std::chrono::milliseconds default_timeout_;
};

management_component::management_component(http_component http,
                                           std::chrono::milliseconds default_timeout)
  : impl_{ std::make_shared<management_component_impl>(std::move(http), default_timeout) }
{
}

auto
management_component::database_fetch_all(const fetch_all_databases_options& options,
                                         fetch_all_databases_callback&& callback)
  -> tl::expected<std::shared_ptr<pending_operation>, error>
{
  return impl_->database_fetch_all(options, std::move(callback));
}

auto
management_component::database_create(const create_database_options& options,
                                      create_database_callback&& callback)
  -> tl::expected<std::shared_ptr<pending_operation>, error>
{
  return impl_->database_create(options, std::move(callback));
}

auto
management_component::database_drop(const drop_database_options& options,
                                    drop_database_callback&& callback)
  -> tl::expected<std::shared_ptr<pending_operation>, error>
{
  return impl_->database_drop(options, std::move(callback));
}
} // namespace couchbase::core::columnar
