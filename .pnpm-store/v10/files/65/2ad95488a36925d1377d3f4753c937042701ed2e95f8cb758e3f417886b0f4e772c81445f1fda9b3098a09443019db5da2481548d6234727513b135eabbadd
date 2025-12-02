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

#include <couchbase/cas.hxx>

#include "client_opcode.hxx"
#include "client_response.hxx"
#include "core/utils/binary.hxx"
#include "core/utils/byteswap.hxx"
#include "magic.hxx"

#include <algorithm>
#include <cstring>
#include <gsl/util>

namespace couchbase::core::protocol
{
auto
compress_value(const std::vector<std::byte>& value,
               std::vector<std::byte>::iterator& output) -> std::pair<bool, std::uint32_t>;

template<typename Body>
class client_request
{
public:
  using body_type = Body;
  using response_body_type = typename Body::response_body_type;
  using response_type = client_response<response_body_type>;

private:
  magic magic_{ magic::client_request };

  client_opcode opcode_{ Body::opcode };
  std::uint16_t partition_{ 0 };
  std::uint32_t opaque_{ 0 };
  std::uint64_t cas_{ 0 };
  protocol::datatype datatype_{ protocol::datatype::raw };

  Body body_;

public:
  [[nodiscard]] auto opcode() const -> client_opcode
  {
    return opcode_;
  }

  void opaque(std::uint32_t val)
  {
    opaque_ = utils::byte_swap(val);
  }

  void datatype(protocol::datatype val)
  {
    datatype_ = val;
  }

  void cas(couchbase::cas val)
  {
    cas_ = utils::byte_swap(val.value());
  }

  [[nodiscard]] auto opaque() const -> std::uint32_t
  {
    return utils::byte_swap(opaque_);
  }

  void opcode(client_opcode val)
  {
    opcode_ = val;
  }

  void partition(std::uint16_t val)
  {
    partition_ = val;
  }

  [[nodiscard]] auto partition() const -> std::uint16_t
  {
    return partition_;
  }

  auto body() -> Body&
  {
    return body_;
  }

  [[nodiscard]] auto data(bool try_to_compress = false) -> std::vector<std::byte>
  {
    switch (opcode_) {
      case protocol::client_opcode::insert:
      case protocol::client_opcode::upsert:
      case protocol::client_opcode::replace:
        return generate_payload(try_to_compress);
      default:
        break;
    }
    return generate_payload(false);
  }

private:
  [[nodiscard]] auto generate_payload(bool try_to_compress) -> std::vector<std::byte>
  {
    // SA: for some reason GCC 8.5.0 on CentOS 8 sees here null-pointer dereference
    // JC: BoringSSL changes, noticed the same when building w/ GCC 11.3.0; TODO:  is 12 okay?
#if defined(__GNUC__) && __GNUC__ >= 8 && __GNUC__ < 12
#pragma GCC diagnostic push
#pragma GCC diagnostic ignored "-Wnull-dereference"
#endif
    std::vector<std::byte> payload(header_size + body_.size(), std::byte{});
    payload[0] = static_cast<std::byte>(magic_);
    payload[1] = static_cast<std::byte>(opcode_);
#if defined(__GNUC__) && __GNUC__ >= 8 && __GNUC__ < 12
#pragma GCC diagnostic pop
#endif
    const auto& framing_extras = body_.framing_extras();

    std::uint16_t key_size = gsl::narrow_cast<std::uint16_t>(body_.key().size());
    if (framing_extras.size() == 0) {
      key_size = utils::byte_swap(key_size);
      memcpy(payload.data() + 2, &key_size, sizeof(key_size));
    } else {
      magic_ = protocol::magic::alt_client_request;
      payload[0] = static_cast<std::byte>(magic_);
      payload[2] = gsl::narrow_cast<std::byte>(framing_extras.size());
      payload[3] = gsl::narrow_cast<std::byte>(key_size);
    }

    std::uint8_t ext_size = gsl::narrow_cast<std::uint8_t>(body_.extras().size());
    memcpy(payload.data() + 4, &ext_size, sizeof(ext_size));

    payload[5] = static_cast<std::byte>(datatype_);

    std::uint16_t vbucket = utils::byte_swap(gsl::narrow_cast<std::uint16_t>(partition_));
    memcpy(payload.data() + 6, &vbucket, sizeof(vbucket));

    std::uint32_t body_size = utils::byte_swap(gsl::narrow_cast<std::uint32_t>(body_.size()));
    memcpy(payload.data() + 8, &body_size, sizeof(body_size));

    memcpy(payload.data() + 12, &opaque_, sizeof(opaque_));
    memcpy(payload.data() + 16, &cas_, sizeof(cas_));

    auto body_itr = payload.begin() + header_size;
    if (framing_extras.size() > 0) {
      body_itr = std::copy(framing_extras.begin(), framing_extras.end(), body_itr);
    }
    body_itr = std::copy(body_.extras().begin(), body_.extras().end(), body_itr);
    body_itr = utils::to_binary(body_.key(), body_itr);

    if (static const std::size_t min_size_to_compress = 32;
        try_to_compress && body_.value().size() > min_size_to_compress) {
      if (auto [compressed, new_value_size] = compress_value(body_.value(), body_itr); compressed) {
        /* the compressed value meets requirements and was copied to the payload */
        payload[5] |= static_cast<std::byte>(protocol::datatype::snappy);
        std::uint32_t new_body_size = utils::byte_swap(body_size) -
                                      gsl::narrow_cast<std::uint32_t>(body_.value().size()) +
                                      new_value_size;
        payload.resize(header_size + new_body_size);
        new_body_size = utils::byte_swap(new_body_size);
        memcpy(payload.data() + 8, &new_body_size, sizeof(new_body_size));
        return payload;
      }
    }
    std::copy(body_.value().begin(), body_.value().end(), body_itr);
    return payload;
  }
};
} // namespace couchbase::core::protocol
