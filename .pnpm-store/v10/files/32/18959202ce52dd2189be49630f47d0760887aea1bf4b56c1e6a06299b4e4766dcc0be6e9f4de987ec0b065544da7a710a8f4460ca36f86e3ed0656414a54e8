/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *   Copyright 2022-Present Couchbase, Inc.
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

#include "operation_consumer.hxx"

#include "operation_queue.hxx"
#include "queue_request.hxx"

namespace couchbase::core::mcbp
{
operation_consumer::operation_consumer(std::shared_ptr<operation_queue> parent)
  : parent_{ std::move(parent) }
{
}

auto
operation_consumer::queue() -> std::shared_ptr<operation_queue>
{
  return parent_;
}

void
operation_consumer::close()
{
  parent_->close_consumer(shared_from_this());
}

auto
operation_consumer::pop() -> std::shared_ptr<queue_request>
{
  return parent_->pop(shared_from_this());
}
} // namespace couchbase::core::mcbp
