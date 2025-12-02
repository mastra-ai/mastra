#pragma once

#include <cinttypes>
#include <map>
#include <sstream>
#include <string>

namespace couchbase::core::utils::string_codec
{
auto
url_decode(const std::string& src) -> std::string;

auto
url_encode(const std::string& src) -> std::string;

auto
form_encode(const std::string& src) -> std::string;

namespace v2
{
enum class encoding {
  encode_path,
  encode_path_segment,
  encode_host,
  encode_zone,
  encode_user_password,
  encode_query_component,
  encode_fragment,
};

auto
escape(const std::string& s, encoding mode) -> std::string;

/**
 * Escapes the string so it can be safely placed inside a URL query.
 *
 * @param s
 * @return
 */
inline auto
query_escape(const std::string& s) -> std::string
{
  return escape(s, encoding::encode_query_component);
}

/**
 * Escapes the string so it can be safely placed inside a URL path segment, replacing special
 * characters (including /) with %XX sequences as needed.
 */
inline auto
path_escape(const std::string& s) -> std::string
{
  return escape(s, encoding::encode_path_segment);
}

inline auto
form_encode(const std::map<std::string, std::string>& values) -> std::string
{
  std::stringstream ss;
  bool first{ true };
  for (const auto& [key, value] : values) {
    if (first) {
      first = false;
    } else {
      ss << '&';
    }
    ss << query_escape(key) << '=' << query_escape(value);
  }
  return ss.str();
}
} // namespace v2

struct url {
  std::string scheme;
  std::string host;
  std::uint16_t port;
  std::string path;
};

auto
url_parse(const std::string& src) -> url;

} // namespace couchbase::core::utils::string_codec
