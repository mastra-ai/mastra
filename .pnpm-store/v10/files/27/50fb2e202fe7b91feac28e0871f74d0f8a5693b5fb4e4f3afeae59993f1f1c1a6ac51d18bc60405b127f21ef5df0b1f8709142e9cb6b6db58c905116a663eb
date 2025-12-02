// Copyright (c) 2021 Kelvin Hammond
// Copyright (c) 2021-2022 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/PEGTL/

#ifndef TAO_PEGTL_CONTRIB_IRI_HPP
#define TAO_PEGTL_CONTRIB_IRI_HPP

#if !defined( __cpp_exceptions )
#error "Exception support required for tao/pegtl/contrib/iri.hpp"
#else

#include "../config.hpp"
#include "../rules.hpp"
#include "../utf8.hpp"

#include "abnf.hpp"
#include "uri.hpp"

namespace TAO_PEGTL_NAMESPACE::iri
{
   // IRI grammar according to RFC 3987.

   // This grammar is a direct PEG translation of the original URI grammar.
   // It should be considered experimental -- in case of any issues, in particular
   // missing rules for attached actions, please contact the developers.

   // Note that this grammar has multiple top-level rules.

   using uri::scheme;
   using uri::port;
   using uri::dslash;
   using uri::IP_literal;
   using uri::IPv4address;
   using uri::pct_encoded;
   using uri::sub_delims;
   using uri::colon;

   // clang-format off
   struct ucschar : utf8::ranges<
      0xA0, 0xD7FF,
      0xF900, 0xFDCF,
      0xFDF0, 0xFFEF,
      0x10000, 0x1FFFD,
      0x20000, 0x2FFFD,
      0x30000, 0x3FFFD,
      0x40000, 0x4FFFD,
      0x50000, 0x5FFFD,
      0x60000, 0x6FFFD,
      0x70000, 0x7FFFD,
      0x80000, 0x8FFFD,
      0x90000, 0x9FFFD,
      0xA0000, 0xAFFFD,
      0xB0000, 0xBFFFD,
      0xC0000, 0xCFFFD,
      0xD0000, 0xDFFFD,
      0xE1000, 0xEFFFD > {};

   struct iprivate : utf8::ranges< 0xE000, 0xF8FF, 0xF0000, 0xFFFFD, 0x100000, 0x10FFFD > {};

   struct iunreserved : sor< abnf::ALPHA, abnf::DIGIT, one< '-', '.', '_', '~' >, ucschar > {};

   struct ipchar : sor< iunreserved, pct_encoded, sub_delims, one< ':', '@' > > {};

   struct isegment : star< ipchar > {};
   struct isegment_nz : plus< ipchar > {};
   // non-zero-length segment without any colon ":"
   struct isegment_nz_nc : plus< sor< iunreserved, pct_encoded, sub_delims, one< '@' > > > {};

   struct ipath_abempty : star< one< '/' >, isegment > {};
   struct ipath_absolute : seq< one< '/' >, opt< isegment_nz, star< one< '/' >, isegment > > > {};
   struct ipath_noscheme : seq< isegment_nz_nc, star< one< '/' >, isegment > > {};
   struct ipath_rootless : seq< isegment_nz, star< one< '/' >, isegment > > {};
   struct ipath_empty : success {};

   struct ipath : sor< ipath_noscheme,  // begins with a non-colon segment
                       ipath_rootless,  // begins with a segment
                       ipath_absolute,  // begins with "/" but not "//"
                       ipath_abempty >  // begins with "/" or is empty
   {};

   struct ireg_name : star< sor< iunreserved, pct_encoded, sub_delims > > {};

   struct ihost : sor< IP_literal, IPv4address, ireg_name > {};
   struct iuserinfo : star< sor< iunreserved, pct_encoded, sub_delims, colon > > {};
   struct opt_iuserinfo : opt< iuserinfo, one< '@' > > {};
   struct iauthority : seq< opt_iuserinfo, ihost, opt< colon, port > > {};

   struct iquery : star< sor< ipchar, iprivate, one< '/', '?' > > > {};
   struct ifragment : star< sor< ipchar, one< '/', '?' > > > {};

   struct opt_iquery : opt_must< one< '?' >, iquery > {};
   struct opt_ifragment : opt_must< one< '#' >, ifragment > {};

   struct ihier_part : sor< if_must< dslash, iauthority, ipath_abempty >, ipath_rootless, ipath_absolute, ipath_empty > {};
   struct irelative_part : sor< if_must< dslash, iauthority, ipath_abempty >, ipath_noscheme, ipath_absolute, ipath_empty > {};
   struct irelative_ref : seq< irelative_part, opt_iquery, opt_ifragment > {};

   struct IRI : seq< scheme, one< ':' >, ihier_part, opt_iquery, opt_ifragment > {};
   struct IRI_reference : sor< IRI, irelative_ref > {};
   struct absolute_IRI : seq< scheme, one< ':' >, ihier_part, opt_iquery > {};
   // clang-format off

}  // namespace TAO_PEGTL_NAMESPACE::iri

#endif
#endif
