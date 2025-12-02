// Copyright (c) 2014-2022 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/PEGTL/

#ifndef TAO_PEGTL_CONTRIB_URI_HPP
#define TAO_PEGTL_CONTRIB_URI_HPP

#if !defined( __cpp_exceptions )
#error "Exception support required for tao/pegtl/contrib/uri.hpp"
#else

#include <cstdint>

#include "../ascii.hpp"
#include "../config.hpp"
#include "../rules.hpp"
#include "../utf8.hpp"

#include "abnf.hpp"
#include "integer.hpp"

namespace TAO_PEGTL_NAMESPACE::uri
{
   // URI grammar according to RFC 3986.

   // This grammar is a direct PEG translation of the original URI grammar.
   // It should be considered experimental -- in case of any issues, in particular
   // missing rules for attached actions, please contact the developers.

   // Note that this grammar has multiple top-level rules.

   using dot = one< '.' >;
   using colon = one< ':' >;

   // clang-format off
   struct dec_octet : maximum_rule< std::uint8_t > {};

   struct IPv4address : seq< dec_octet, dot, dec_octet, dot, dec_octet, dot, dec_octet > {};

   struct h16 : rep_min_max< 1, 4, abnf::HEXDIG > {};
   struct ls32 : sor< seq< h16, colon, h16 >, IPv4address > {};

   struct dcolon : two< ':' > {};

   struct IPv6address : sor< seq<                                               rep< 6, h16, colon >, ls32 >,
                             seq<                                       dcolon, rep< 5, h16, colon >, ls32 >,
                             seq< opt< h16                           >, dcolon, rep< 4, h16, colon >, ls32 >,
                             seq< opt< h16,     opt<    colon, h16 > >, dcolon, rep< 3, h16, colon >, ls32 >,
                             seq< opt< h16, rep_opt< 2, colon, h16 > >, dcolon, rep< 2, h16, colon >, ls32 >,
                             seq< opt< h16, rep_opt< 3, colon, h16 > >, dcolon,         h16, colon,   ls32 >,
                             seq< opt< h16, rep_opt< 4, colon, h16 > >, dcolon,                       ls32 >,
                             seq< opt< h16, rep_opt< 5, colon, h16 > >, dcolon,                       h16  >,
                             seq< opt< h16, rep_opt< 6, colon, h16 > >, dcolon                             > > {};

   struct gen_delims : one< ':', '/', '?', '#', '[', ']', '@' > {};
   struct sub_delims : one< '!', '$', '&', '\'', '(', ')', '*', '+', ',', ';', '=' > {};

   struct unreserved : sor< abnf::ALPHA, abnf::DIGIT, one< '-', '.', '_', '~' > > {};
   struct reserved : sor< gen_delims, sub_delims > {};

   struct IPvFuture : if_must< one< 'v', 'V' >, plus< abnf::HEXDIG >, dot, plus< sor< unreserved, sub_delims, colon > > > {};

   struct IP_literal : if_must< one< '[' >, sor< IPvFuture, IPv6address >, one< ']' > > {};

   struct pct_encoded : if_must< one< '%' >, abnf::HEXDIG, abnf::HEXDIG > {};
   struct pchar : sor< unreserved, pct_encoded, sub_delims, one< ':', '@' > > {};

   struct query : star< sor< pchar, one< '/', '?' > > > {};
   struct fragment : star< sor< pchar, one< '/', '?' > > > {};

   struct segment : star< pchar > {};
   struct segment_nz : plus< pchar > {};
   struct segment_nz_nc : plus< sor< unreserved, pct_encoded, sub_delims, one< '@' > > > {}; // non-zero-length segment without any colon ":"

   struct path_abempty : star< one< '/' >, segment > {};
   struct path_absolute : seq< one< '/' >, opt< segment_nz, star< one< '/' >, segment > > > {};
   struct path_noscheme : seq< segment_nz_nc, star< one< '/' >, segment > > {};
   struct path_rootless : seq< segment_nz, star< one< '/' >, segment > > {};
   struct path_empty : success {};

   struct path : sor< path_noscheme,     // begins with a non-colon segment
                      path_rootless,     // begins with a segment
                      path_absolute,     // begins with "/" but not "//"
                      path_abempty > {}; // begins with "/" or is empty

   struct reg_name : star< sor< unreserved, pct_encoded, sub_delims > > {};

   struct port : star< abnf::DIGIT > {};
   struct host : sor< IP_literal, IPv4address, reg_name > {};
   struct userinfo : star< sor< unreserved, pct_encoded, sub_delims, colon > > {};
   struct opt_userinfo : opt< userinfo, one< '@' > > {};
   struct authority : seq< opt_userinfo, host, opt< colon, port > > {};

   struct scheme : seq< abnf::ALPHA, star< sor< abnf::ALPHA, abnf::DIGIT, one< '+', '-', '.' > > > > {};

   using dslash = two< '/' >;
   using opt_query = opt_must< one< '?' >, query >;
   using opt_fragment = opt_must< one< '#' >, fragment >;

   struct hier_part : sor< if_must< dslash, authority, path_abempty >, path_rootless, path_absolute, path_empty > {};
   struct relative_part : sor< if_must< dslash, authority, path_abempty >, path_noscheme, path_absolute, path_empty > {};
   struct relative_ref : seq< relative_part, opt_query, opt_fragment > {};

   struct URI : seq< scheme, one< ':' >, hier_part, opt_query, opt_fragment > {};
   struct URI_reference : sor< URI, relative_ref > {};
   struct absolute_URI : seq< scheme, one< ':' >, hier_part, opt_query > {};
   // clang-format on

}  // namespace TAO_PEGTL_NAMESPACE::uri

#endif
#endif
