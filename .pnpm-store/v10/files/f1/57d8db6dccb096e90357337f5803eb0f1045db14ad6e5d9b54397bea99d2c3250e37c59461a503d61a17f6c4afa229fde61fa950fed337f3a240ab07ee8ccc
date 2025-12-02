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

#include "url_codec.hxx"

#include <spdlog/fmt/bundled/core.h>

#include <cctype>
#include <climits>
#include <cstdint>
#include <regex>

namespace couchbase::core::utils::string_codec
{

namespace priv
{
inline auto
is_legal_uri_char(char c) -> bool
{
  auto uc = static_cast<unsigned char>(c);
  if ((isalpha(uc) != 0) || (isdigit(uc) != 0)) {
    return true;
  }
  switch (uc) {
    case '-':
    case '_':
    case '.':
    case '~':
    case '!':
    case '*':
    case '\'':
    case '(':
    case ')':
    case ';':
    case ':':
    case '@':
    case '&':
    case '=':
    case '+':
    case '$':
    case ',':
    case '/':
    case '?':
    case '#':
    case '[':
    case ']':
      return true;
    default:
      break;
  }
  return false;
}

template<typename T>
inline auto
is_already_escape(T first, T last) -> bool
{
  ++first; // ignore '%'
  std::size_t jj = 0;
  for (; first != last && jj < 2; ++jj, ++first) {
    if (!isxdigit(*first)) {
      return false;
    }
  }
  return jj == 2;
}
} // namespace priv

template<typename Ti, typename To>
auto
url_encode(Ti first, Ti last, To& o, bool check_encoded = true) -> bool
{
  // If re-encoding detection is enabled, this flag indicates not to
  // re-encode
  bool skip_encoding = false;

  for (; first != last; ++first) {
    if (!skip_encoding && check_encoded) {
      if (*first == '%') {
        skip_encoding = priv::is_already_escape(first, last);
      } else if (*first == '+') {
        skip_encoding = true;
      }
    }
    if (skip_encoding || priv::is_legal_uri_char(*first)) {
      if (skip_encoding && *first != '%' && !priv::is_legal_uri_char(*first)) {
        return false;
      }

      o.insert(o.end(), first, first + 1);
    } else {
      const unsigned int c = static_cast<unsigned char>(*first);
      std::size_t numbytes = 0;

      if ((c & 0x80) == 0) { /* ASCII character */
        numbytes = 1;
      } else if ((c & 0xE0) == 0xC0) { /* 110x xxxx */
        numbytes = 2;
      } else if ((c & 0xF0) == 0xE0) { /* 1110 xxxx */
        numbytes = 3;
      } else if ((c & 0xF8) == 0xF0) { /* 1111 0xxx */
        numbytes = 4;
      } else {
        return false;
      }

      do {
        o.append(fmt::format("%{:x}", static_cast<std::uint8_t>(*first)));
      } while (--numbytes && ++first != last);
    }
  }
  return true;
}

template<typename Tin, typename Tout>
auto
url_encode(const Tin& in, Tout& out) -> bool
{
  return url_encode(in.begin(), in.end(), out);
}

auto
url_encode(const std::string& src) -> std::string
{
  std::string dst{};
  url_encode(src.begin(), src.end(), dst);
  return dst;
}

template<typename Ti, typename To>
auto
url_decode(Ti first, Ti last, To out, std::size_t& nout) -> bool
{
  for (; first != last && *first != '\0'; ++first) {
    if (*first == '%') {
      // TODO(CXXCBC-549)
      // NOLINTNEXTLINE(cppcoreguidelines-avoid-c-arrays,hicpp-avoid-c-arrays,modernize-avoid-c-arrays)
      char nextbuf[3] = { 0 };
      std::size_t jj = 0;
      ++first;
      nextbuf[0] = *first;
      for (; first != last && jj < 2; ++jj) {
        // TODO(CXXCBC-549)
        nextbuf[jj] = *first; // NOLINT(cppcoreguidelines-pro-bounds-constant-array-index)
        if (jj != 1) {
          ++first;
        }
      }
      if (jj != 2) {
        return false;
      }

      char* end = nullptr;
      const unsigned long octet = std::strtoul(nextbuf, &end, 16);
      if (octet == ULONG_MAX || (octet == 0 && end == nextbuf)) {
        return false;
      }

      *out = static_cast<char>(octet);
    } else {
      *out = *first;
    }

    ++out;
    nout++;
  }
  return true;
}

auto
url_decode(const std::string& src) -> std::string
{
  std::string dst(src.size(), '\0');
  std::size_t n = 0;
  if (url_decode(src.begin(), src.end(), dst.begin(), n)) {
    dst.resize(n);
  }
  return dst;
}

/* See: https://url.spec.whatwg.org/#urlencoded-serializing: */
/*
 * 0x2A
 * 0x2D
 * 0x2E
 * 0x30 to 0x39
 * 0x41 to 0x5A
 * 0x5F
 * 0x61 to 0x7A
 *  Append a code point whose value is byte to output.
 * Otherwise
 *  Append byte, percent encoded, to output.
 */
template<typename Ti, typename To>
void
form_encode(Ti first, Ti last, To& out)
{
  for (; first != last; ++first) {
    auto c = static_cast<unsigned char>(*first);
    if (isalnum(c)) {
      out.insert(out.end(), first, first + 1);
      continue;
    }
    if (c == ' ') {
      char tmp = '+';
      out.insert(out.end(), &tmp, &tmp + 1);
    } else if ((c == 0x2A || c == 0x2D || c == 0x2E) || (c >= 0x30 && c <= 0x39) ||
               (c >= 0x41 && c <= 0x5A) || (c == 0x5F) || (c >= 0x60 && c <= 0x7A)) {
      out.insert(out.end(), static_cast<char>(c));
    } else {
      out.append(fmt::format("%{:x}", static_cast<std::uint8_t>(*first)));
    }
  }
}

auto
form_encode(const std::string& src) -> std::string
{
  std::string dst;
  form_encode(src.begin(), src.end(), dst);
  return dst;
}

namespace v2
{
auto
should_escape(char c, encoding mode) -> bool
{
  // §2.3 Unreserved characters (alphanum)
  if (('a' <= c && c <= 'z') || ('A' <= c && c <= 'Z') || ('0' <= c && c <= '9')) {
    return false;
  }

  if (mode == encoding::encode_host || mode == encoding::encode_zone) {
    // §3.2.2 Host allows
    //	sub-delims = "!" / "$" / "&" / "'" / "(" / ")" / "*" / "+" / "," / ";" / "="
    // as part of reg-name.
    // We add : because we include :port as part of host.
    // We add [ ] because we include [ipv6]:port as part of host.
    // We add < > because they're the only characters left that we could possibly allow, and Parse
    // will reject them if we escape them (because hosts can't use %-encoding for ASCII bytes).
    switch (c) {
      case '!':
      case '$':
      case '&':
      case '\'':
      case '(':
      case ')':
      case '*':
      case '+':
      case ',':
      case ';':
      case '=':
      case ':':
      case '[':
      case ']':
      case '<':
      case '>':
      case '"':
        return false;

      default:
        break;
    }
  }

  switch (c) {
    case '-':
    case '_':
    case '.':
    case '~':
      // §2.3 Unreserved characters (mark)
      return false;

    case '$':
    case '&':
    case '+':
    case ',':
    case '/':
    case ':':
    case ';':
    case '=':
    case '?':
    case '@':
      // §2.2 Reserved characters (reserved)
      // Different sections of the URL allow a few of
      // the reserved characters to appear unescaped.
      switch (mode) {
        case encoding::encode_path: // §3.3
          // The RFC allows : @ & = + $ but saves / ; , for assigning meaning to individual path
          // segments. This package only manipulates the path as a whole, so we allow those last
          // three as well. That leaves only ? to escape.
          return c == '?';

        case encoding::encode_path_segment: // §3.3
          // The RFC allows : @ & = + $ but saves / ; , for assigning meaning to individual path
          // segments.
          return c == '/' || c == ';' || c == ',' || c == '?';

        case encoding::encode_user_password: // §3.2.1
          // The RFC allows ';', ':', '&', '=', '+', '$', and ',' in userinfo, so we must escape
          // only '@', '/', and '?'. The parsing of userinfo treats ':' as special so we must escape
          // that too.
          return c == '@' || c == '/' || c == '?' || c == ':';

        case encoding::encode_query_component: // §3.4
          // The RFC reserves (so we must escape) everything.
          return true;

        case encoding::encode_fragment: // §4.1
          // The RFC text is silent but the grammar allows everything, so escape nothing.
          return false;

        default:
          break;
      }

    default:
      break;
  }

  if (mode == encoding::encode_fragment) {
    // RFC 3986 §2.2 allows not escaping sub-delims. A subset of sub-delims are included in reserved
    // from RFC 2396 §2.2. The remaining sub-delims do not need to be escaped. To minimize potential
    // breakage, we apply two restrictions: (1) we always escape sub-delims outside of the fragment,
    // and (2) we always escape single quote to avoid breaking callers that had previously assumed
    // that single quotes would be escaped. See issue #19917.
    switch (c) {
      case '!':
      case '(':
      case ')':
      case '*':
        return false;

      default:
        break;
    }
  }

  // Everything else must be escaped.
  return true;
}

constexpr auto upper_hex = "0123456789ABCDEF";

auto
escape(const std::string& s, encoding mode) -> std::string
{
  std::size_t space_count{ 0 };
  std::size_t hex_count{ 0 };

  for (const auto& c : s) {
    if (should_escape(c, mode)) {
      if (c == ' ' && mode == encoding::encode_query_component) {
        ++space_count;
      } else {
        ++hex_count;
      }
    }
  }

  if (space_count == 0 && hex_count == 0) {
    return s;
  }

  const std::size_t required = s.size() + (2 * hex_count);
  std::string t;
  t.resize(required);

  if (hex_count == 0) {
    for (std::size_t i = 0; i < s.size(); ++i) {
      if (s[i] == ' ') {
        t[i] = '+';
      } else {
        t[i] = s[i];
      }
    }
    return t;
  }

  std::size_t j{ 0 };
  for (const auto& c : s) {
    if (c == ' ' && mode == encoding::encode_query_component) {
      t[j++] = '+';
    } else if (should_escape(c, mode)) {
      t[j++] = '%';
      t[j++] = upper_hex[(c >> 4U) & 0x0f];
      t[j++] = upper_hex[c & 0x0f];
    } else {
      t[j++] = c;
    }
  }
  return t;
}

} // namespace v2

auto
url_parse(const std::string& src) -> url
{
  // very basic URL parser, only cares about scheme://host[:port][/path]
  static const std::regex url_regexp{
    R"(^([a-zA-Z][a-zA-Z\d+\-.]+):\/\/([^\/:]+)(?::(\d+))?(\/[^?#]*)?$)"
  };

  url u{};

  std::smatch matches;
  if (std::regex_match(src, matches, url_regexp)) {
    u.scheme = matches[1].str();
    u.host = matches[2].str();
    if (matches[3].length() > 0) {
      u.port = static_cast<std::uint16_t>(std::stoul(matches[3].str()));
    } else {
      u.port = (u.scheme == "https" || u.scheme == "wss") ? 443 : 80;
    }
    u.path = matches[4].str();
  }

  return u;
}

} // namespace couchbase::core::utils::string_codec
