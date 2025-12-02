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

#include "json.hxx"

#include <tao/json.hpp>
#include <tao/json/contrib/traits.hpp>

#include <gsl/span>

namespace couchbase::core::utils::json
{
/**
 *
 * This transformer is necessary to handle invalid JSON sent by the server.
 *
 * 1) For some reason "projector" field gets duplicated in the configuration
 * JSON
 *
 * 2) CXXCBC-13, ns_server sends response to list buckets request with
 * duplicated keys.
 */
template<typename Consumer>
struct last_key_wins : Consumer {
  using Consumer::Consumer;

  using Consumer::keys_;
  using Consumer::stack_;
  using Consumer::value;

  void member()
  {
    Consumer::stack_.back().prepare_object()[Consumer::keys_.back()] = std::move(Consumer::value);
    Consumer::keys_.pop_back();
  }
};

auto
parse(std::string_view input) -> tao::json::value
{
  return tao::json::from_string<utils::json::last_key_wins>(input);
}

auto
parse(const json_string& input) -> tao::json::value
{
  if (input.is_string()) {
    return parse(input.str());
  }
  if (input.is_binary()) {
    return parse_binary(input.bytes());
  }
  return {};
}

auto
parse(const char* input, std::size_t size) -> tao::json::value
{
  return tao::json::from_string<utils::json::last_key_wins>(input, size);
}

auto
parse_binary(const std::vector<std::byte>& input) -> tao::json::value
{
  return tao::json::from_string<utils::json::last_key_wins>(
    reinterpret_cast<const char*>(input.data()), input.size());
}

auto
generate(const tao::json::value& object) -> std::string
{
  return tao::json::to_string(object);
}

class to_byte_vector
{
private:
  std::vector<std::byte>& buffer_;
  bool first_{ true };

  void next()
  {
    if (!first_) {
      buffer_.emplace_back(std::byte{ ',' });
    }
  }

  void write(tao::binary_view data)
  {
    buffer_.reserve(buffer_.size() + data.size());
    buffer_.insert(buffer_.end(), data.begin(), data.end());
  }

  void write(std::string_view data)
  {
    buffer_.reserve(buffer_.size() + data.size());
    const auto* begin = reinterpret_cast<const std::byte*>(data.data());
    buffer_.insert(buffer_.end(), begin, begin + data.size());
  }

  void escape(const std::string_view s)
  {
    static std::array h{
      std::byte{ '0' }, std::byte{ '1' }, std::byte{ '2' }, std::byte{ '3' },
      std::byte{ '4' }, std::byte{ '5' }, std::byte{ '6' }, std::byte{ '7' },
      std::byte{ '8' }, std::byte{ '9' }, std::byte{ 'a' }, std::byte{ 'b' },
      std::byte{ 'c' }, std::byte{ 'd' }, std::byte{ 'e' }, std::byte{ 'f' },
    };

    const char* p = s.data();
    const char* l = p;
    const char* const e = p + s.size();
    while (p != e) {
      const char c = *p;
      if (c == '\\' || c == '"') {
        write({ l, static_cast<std::size_t>(p - l) });
        l = ++p;
        buffer_.emplace_back(std::byte{ '\\' });
        buffer_.emplace_back(static_cast<std::byte>(c));
      } else if (static_cast<std::uint8_t>(c) < 32 || c == 127) {
        write({ l, static_cast<std::size_t>(p - l) });
        l = ++p;
        switch (c) {
          case '\b':
            write("\\b");
            break;
          case '\f':
            write("\\f");
            break;
          case '\n':
            write("\\n");
            break;
          case '\r':
            write("\\r");
            break;
          case '\t':
            write("\\t");
            break;
          default:
            write(std::array{
              std::byte{ '\\' },
              std::byte{ 'u' },
              std::byte{ '0' },
              std::byte{ '0' },
              // TODO(CXXCBC-549)
              // NOLINTBEGIN(cppcoreguidelines-pro-bounds-constant-array-index)
              std::byte{ h[(c & 0xf0) >> 4] },
              std::byte{ h[c & 0x0f] },
              // NOLINTEND(cppcoreguidelines-pro-bounds-constant-array-index)
            });
        }
      } else {
        ++p;
      }
    }
    write({ l, static_cast<std::size_t>(p - l) });
  }

public:
  explicit to_byte_vector(std::vector<std::byte>& output) noexcept
    : buffer_(output)
  {
  }

  void null()
  {
    next();
    static std::array literal_null{
      std::byte{ 'n' },
      std::byte{ 'u' },
      std::byte{ 'l' },
      std::byte{ 'l' },
    };
    write(literal_null);
  }

  void boolean(const bool v)
  {
    next();
    if (v) {
      static std::array literal_true{
        std::byte{ 't' },
        std::byte{ 'r' },
        std::byte{ 'u' },
        std::byte{ 'e' },
      };
      write(literal_true);
    } else {
      static std::array literal_false{
        std::byte{ 'f' }, std::byte{ 'a' }, std::byte{ 'l' }, std::byte{ 's' }, std::byte{ 'e' },
      };
      write(literal_false);
    }
  }

  void number(const std::int64_t v)
  {
    next();
    // TODO(CXXCBC-549)
    // NOLINTNEXTLINE(cppcoreguidelines-avoid-c-arrays,hicpp-avoid-c-arrays,modernize-avoid-c-arrays)
    char b[24]{};
    const char* s = tao::json::itoa::i64toa(v, b);
    write({ b, static_cast<std::size_t>(s - b) });
  }

  void number(const std::uint64_t v)
  {
    next();
    // TODO(CXXCBC-549)
    // NOLINTNEXTLINE(cppcoreguidelines-avoid-c-arrays,hicpp-avoid-c-arrays,modernize-avoid-c-arrays)
    char b[24]{};
    const char* s = tao::json::itoa::u64toa(v, b);
    write({ b, static_cast<std::size_t>(s - b) });
  }

  void number(const double v)
  {
    next();
    if (!std::isfinite(v)) {
      // if this throws, consider using non_finite_to_* transformers
      throw std::runtime_error("non-finite double value invalid for JSON string representation");
    }
    // TODO(CXXCBC-549)
    // NOLINTNEXTLINE(cppcoreguidelines-avoid-c-arrays,hicpp-avoid-c-arrays,modernize-avoid-c-arrays)
    char b[28]{};
    const auto s = tao::json::ryu::d2s_finite(v, b);
    write({ b, s });
  }

  void string(const std::string_view v)
  {
    next();
    buffer_.emplace_back(std::byte{ '"' });
    escape(v);
    buffer_.emplace_back(std::byte{ '"' });
  }

  // TODO(CXXCBC-549)
  // NOLINTNEXTLINE(readability-convert-member-functions-to-static)
  void binary(const tao::binary_view /*unused*/)
  {
    // if this throws, consider using binary_to_* transformers
    throw std::runtime_error("binary data invalid for JSON string representation");
  }

  void begin_array(const std::size_t /*unused*/ = 0)
  {
    next();
    buffer_.emplace_back(std::byte{ '[' });
    first_ = true;
  }

  void element() noexcept
  {
    first_ = false;
  }

  void end_array(const std::size_t /*unused*/ = 0)
  {
    buffer_.emplace_back(std::byte{ ']' });
  }

  void begin_object(const std::size_t /*unused*/ = 0)
  {
    next();
    buffer_.emplace_back(std::byte{ '{' });
    first_ = true;
  }

  void key(const std::string_view v)
  {
    string(v);
    buffer_.emplace_back(std::byte{ ':' });
    first_ = true;
  }

  void member() noexcept
  {
    first_ = false;
  }

  void end_object(const std::size_t /*unused*/ = 0)
  {
    buffer_.emplace_back(std::byte{ '}' });
  }
};

auto
generate_binary(const tao::json::value& object) -> std::vector<std::byte>
{
  std::vector<std::byte> out;
  tao::json::events::transformer<to_byte_vector> consumer(out);
  tao::json::events::from_value(consumer, object);
  return out;
}
} // namespace couchbase::core::utils::json
