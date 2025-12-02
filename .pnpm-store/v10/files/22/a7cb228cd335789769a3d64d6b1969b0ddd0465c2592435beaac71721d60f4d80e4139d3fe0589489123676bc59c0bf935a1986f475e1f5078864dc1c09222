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

#pragma once

namespace couchbase::core::protocol
{
enum class request_frame_info_id : std::uint8_t {
  /**
   * No commands may be executed in parallel (received on the same connection) as this command (the
   * command before MUST be completed before execution of this command is started, and this command
   * MUST be completed before execution of the next command is started). FrameInfo encoded as:
   *
   *    Byte/     0       |
   *       /              |
   *      |0 1 2 3 4 5 6 7|
   *      +---------------+
   *     0|  ID:0 | Len:0 |
   */
  barrier = 0x00,

  /**
   * This command contains durability requirements. FrameInfo encoded as:
   *
   *    Byte/     0            |
   *       /                   |
   *      |   0 1 2 3 4 5 6 7  |
   *      +--------------------+
   *     0|  ID:1 | Len:1 or 3 |
   *
   * The size of the durability requirement is variable length. The first byte contains the
   * durability level by using the following table:
   *
   *    0x01 = majority
   *    0x02 = majority and persist on master
   *    0x03 = persist to majority
   *
   * The (optional) 2nd and 3rd byte contains the timeout specified in milliseconds (network byte
   * order). If the timeout is omitted the default timeout value configured on the server will be
   * used.
   *
   * If timeout is specified, the valid range is 1..65535. Values 0x0 and 0xffff are reserved and
   * will result in the request failing with invalid_argument (0x4) if used.
   */
  durability_requirement = 0x01,

  /**
   * This command contains a DCP stream-ID as per the stream-request which created the stream.
   *
   *     Byte/     0       |
   *        /              |
   *       |0 1 2 3 4 5 6 7|
   *       +---------------+
   *      0|  ID:2 | Len:2 |
   *
   * The 2nd and 3rd byte contain a network byte order (std::uint16) storing the stream ID value
   * which was specified in the DCP stream-request that created the stream.
   */
  dcp_stream_id = 0x02,

  /**
   * Request the server to submit trace information by using the supplied context information as the
   * parent span. The context must be present (length > 0)
   */
  open_tracing_context = 0x03,

  /**
   * Request the server to execute the command as the provided user username (must be present) to
   * identify users defined outside Couchbase (ldap) the username must be prefixed with ^ (ex:
   * ^trond). Local users do not need a prefix.
   *
   * The authenticated user must possess the impersonate privilege in order to utilize the feature
   * (otherwise an error will be returned), and the effective privilege set when executing the
   * command is an intersection of the authenticated users privilege set and the impersonated
   * persons privilege set.
   */
  impersonate_user = 0x04,

  /**
   * If the request modifies an existing document the expiry time from the existing document should
   * be used instead of the TTL provided. If document don't exist the provided TTL should be used.
   * The frame info contains no value (length = 0).
   */
  preserve_ttl = 0x05,
};

constexpr auto
is_valid_request_frame_info_id(std::uint8_t value) -> bool
{
  switch (request_frame_info_id(value)) {
    case request_frame_info_id::barrier:
    case request_frame_info_id::durability_requirement:
    case request_frame_info_id::dcp_stream_id:
    case request_frame_info_id::open_tracing_context:
    case request_frame_info_id::impersonate_user:
    case request_frame_info_id::preserve_ttl:
      return true;
  }
  return false;
}

enum class response_frame_info_id : std::uint8_t {
  /**
   * Time (in microseconds) server spent on the operation. Measured from receiving header from OS to
   * when response given to OS. Size: 2 bytes; encoded as variable-precision value (see below)
   *
   * FrameInfo encoded as:
   *
   *     Byte/     0       |       1       |       2       |
   *        /              |               |               |
   *       |0 1 2 3 4 5 6 7|0 1 2 3 4 5 6 7|0 1 2 3 4 5 6 7|
   *       +---------------+---------------+---------------+
   *      0|  ID:0 | Len:2 |  Server Recv->Send Duration   |
   *
   * The duration in micros is encoded as:
   *
   *     encoded =  (micros * 2) ^ (1.0 / 1.74)
   *     decoded =  (encoded ^ 1.74) / 2
   */
  server_duration = 0x00,
};

constexpr auto
is_valid_response_frame_info_id(std::uint8_t value) -> bool
{
  switch (response_frame_info_id(value)) {
    case response_frame_info_id::server_duration:
      return true;
  }
  return false;
}

} // namespace couchbase::core::protocol
