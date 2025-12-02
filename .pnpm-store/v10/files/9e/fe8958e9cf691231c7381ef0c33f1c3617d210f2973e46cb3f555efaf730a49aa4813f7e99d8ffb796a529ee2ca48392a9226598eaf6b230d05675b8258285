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

#include <map>
#include <memory>
#include <string>

namespace couchbase::metrics
{
class value_recorder
{
public:
  value_recorder() = default;
  value_recorder(const value_recorder& other) = default;
  value_recorder(value_recorder&& other) = default;
  auto operator=(const value_recorder& other) -> value_recorder& = default;
  auto operator=(value_recorder&& other) -> value_recorder& = default;
  virtual ~value_recorder() = default;

  virtual void record_value(int64_t value) = 0;
};

class meter
{
public:
  meter() = default;
  meter(const meter& other) = default;
  meter(meter&& other) = default;
  auto operator=(const meter& other) -> meter& = default;
  auto operator=(meter&& other) -> meter& = default;
  virtual ~meter() = default;

  /**
   * SDK invokes this method when cluster is ready to emit metrics. Override it as NO-OP if no
   * action is necessary.
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

  virtual auto get_value_recorder(const std::string& name,
                                  const std::map<std::string, std::string>& tags)
    -> std::shared_ptr<value_recorder> = 0;
};

} // namespace couchbase::metrics
