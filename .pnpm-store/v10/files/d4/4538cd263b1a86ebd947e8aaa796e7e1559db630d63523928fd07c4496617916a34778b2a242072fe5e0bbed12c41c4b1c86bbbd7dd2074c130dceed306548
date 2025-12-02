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

#include <couchbase/tracing/request_span.hxx>

#include <memory>
#include <string>

namespace couchbase::tracing
{
class request_tracer
{
public:
  request_tracer() = default;
  request_tracer(const request_tracer& other) = default;
  request_tracer(request_tracer&& other) = default;
  auto operator=(const request_tracer& other) -> request_tracer& = default;
  auto operator=(request_tracer&& other) -> request_tracer& = default;
  virtual ~request_tracer() = default;

  /**
   * SDK invokes this method when cluster is ready to trace. Override it as NO-OP if no action is
   * necessary.
   */
  virtual void start()
  {
    /* do nothing */
  }

  /**
   * SDK invokes this method when cluster is closed. Override it as NO-OP if no action is necessary.
   */
  virtual void stop()
  {
    /* do nothing */
  }

  virtual auto start_span(std::string name, std::shared_ptr<request_span> parent = {})
    -> std::shared_ptr<request_span> = 0;
};

} // namespace couchbase::tracing
