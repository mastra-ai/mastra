/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *   Copyright 2021 Couchbase, Inc.
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

#include "threshold_logging_options.hxx"

#include <couchbase/tracing/request_tracer.hxx>

#include <asio/io_context.hpp>

#include <memory>
#include <string>

namespace couchbase::core::tracing
{
class threshold_logging_span;
class threshold_logging_tracer_impl;

class threshold_logging_tracer
  : public couchbase::tracing::request_tracer
  , public std::enable_shared_from_this<threshold_logging_tracer>
{
public:
  threshold_logging_tracer(asio::io_context& ctx, threshold_logging_options options);

  auto start_span(std::string name, std::shared_ptr<couchbase::tracing::request_span> parent)
    -> std::shared_ptr<couchbase::tracing::request_span> override;
  void report(const std::shared_ptr<threshold_logging_span>& span);
  void start() override;
  void stop() override;

private:
  threshold_logging_options options_;
  std::shared_ptr<threshold_logging_tracer_impl> impl_{};
};

} // namespace couchbase::core::tracing
