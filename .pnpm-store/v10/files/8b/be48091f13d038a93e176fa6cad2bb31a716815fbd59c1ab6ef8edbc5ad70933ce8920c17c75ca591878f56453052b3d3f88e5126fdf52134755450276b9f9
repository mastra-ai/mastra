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

#include "observe_poll.hxx"

#include <couchbase/persist_to.hxx>
#include <couchbase/replicate_to.hxx>

#include <memory>

namespace couchbase::core::impl
{
template<typename mutation_request>
struct with_legacy_durability : public mutation_request {
  couchbase::persist_to persist_to{ couchbase::persist_to::none };
  couchbase::replicate_to replicate_to{ couchbase::replicate_to::none };

  template<typename Core, typename Handler>
  void execute(Core core, Handler handler)
  {
    core.execute(*static_cast<mutation_request*>(this),
                 [core,
                  id = mutation_request::id,
                  timeout = mutation_request::timeout,
                  persist_to_ = persist_to,
                  replicate_to_ = replicate_to,
                  handler = std::forward<Handler>(handler)](auto&& resp) mutable {
                   if (resp.ctx.ec()) {
                     return handler(std::move(resp));
                   }

                   initiate_observe_poll(core,
                                         id,
                                         resp.token,
                                         timeout,
                                         persist_to_,
                                         replicate_to_,
                                         [resp = std::move(resp), handler = std::move(handler)](
                                           std::error_code ec) mutable {
                                           if (ec) {
                                             resp.ctx.override_ec(ec);
                                           }
                                           return handler(std::move(resp));
                                         });
                 });
  }
};
} // namespace couchbase::core::impl
