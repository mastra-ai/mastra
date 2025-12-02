// Copyright (c) 2021-2022 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/PEGTL/

#ifndef TAO_PEGTL_CONTRIB_PROTO3_HPP
#define TAO_PEGTL_CONTRIB_PROTO3_HPP

#include "../ascii.hpp"
#include "../config.hpp"
#include "../rules.hpp"

namespace TAO_PEGTL_NAMESPACE::proto3
{
   // protocol buffer v3
   // https://developers.google.com/protocol-buffers/docs/reference/proto3-spec

   // clang-format off
   struct comment_sl : seq< two< '/' >, until< eolf > > {};
   struct comment_ml : if_must< string< '/', '*' >, until< string< '*', '/' > > > {};
   struct sp : sor< space, comment_sl, comment_ml > {};
   struct sps : star< sp > {};

   struct comma : one< ',' > {};
   struct dot : one< '.' > {};
   struct equ : one< '=' > {};
   struct semi : one< ';' > {};

   struct option;
   struct message;
   struct extend;

   struct ident_first : ranges< 'a', 'z', 'A', 'Z' > {};  // NOTE: Yes, no '_'.
   struct ident_other : ranges< 'a', 'z', 'A', 'Z', '0', '9', '_' > {};
   struct ident : seq< ident_first, star< ident_other > > {};
   struct full_ident : list_must< ident, dot > {};

   struct hex_lit : seq< one< '0' >, one< 'x', 'X' >, plus< xdigit > > {};
   struct oct_lit : seq< one< '0' >, plus< odigit > > {};
   struct dec_lit : seq< range< '1', '9' >, star< digit > >  {};
   struct int_lit : sor< hex_lit, oct_lit, dec_lit > {};

   struct sign : one< '+', '-' > {};
   struct exp : seq< one< 'E', 'e' >, opt< sign >, plus< digit > > {};
   struct float_lit : sor<
      seq< plus< digit >, dot, exp >,
      seq< plus< digit >, dot, star< digit >, opt< exp > >,
      seq< dot, plus< digit >, opt< exp > >,
      keyword< 'i', 'n', 'f' >,
      keyword< 'n', 'a', 'n' > > {};

   struct bool_lit : sor< keyword< 't', 'r', 'u', 'e' >,
                          keyword< 'f', 'a', 'l', 's', 'e' > > {};

   struct hex_escape : if_must< one< 'x', 'X' >, xdigit, xdigit > {};
   struct oct_escape : if_must< odigit, odigit, odigit > {};
   struct char_escape : one< 'a', 'b', 'f', 'n', 'r', 't', 'v', '\\', '\'', '"' > {};
   struct escape : if_must< one< '\\' >, hex_escape, oct_escape, char_escape > {};
   struct char_value : sor< escape, not_one< '\n', '\0' > > {};  // NOTE: No need to exclude '\' from not_one<>, see escape rule.
   template< char Q >
   struct str_impl : if_must< one< Q >, until< one< Q >, char_value > > {};
   struct str_lit : sor< str_impl< '\'' >, str_impl< '"' > > {};

   struct constant : sor< bool_lit, seq< opt< sign >, float_lit >, seq< opt< sign >, int_lit >, str_lit, full_ident > {};

   struct option_name : seq< sor< ident, if_must< one< '(' >, full_ident, one< ')' > > >, star_must< dot, ident > > {};
   struct option : if_must< keyword< 'o', 'p', 't', 'i', 'o', 'n' >, sps, option_name, sps, equ, sps, constant, sps, semi > {};

   struct bool_type : keyword< 'b', 'o', 'o', 'l' > {};
   struct bytes_type : keyword< 'b', 'y', 't', 'e', 's' > {};
   struct double_type : keyword< 'd', 'o', 'u', 'b', 'l', 'e' > {};
   struct float_type : keyword< 'f', 'l', 'o', 'a', 't' > {};
   struct string_type : keyword< 's', 't', 'r', 'i', 'n', 'g' > {};

   struct int32_type : keyword< 'i', 'n', 't', '3', '2' > {};
   struct int64_type : keyword< 'i', 'n', 't', '6', '4' > {};
   struct sint32_type : keyword< 's', 'i', 'n', 't', '3', '2' > {};
   struct sint64_type : keyword< 's', 'i', 'n', 't', '6', '4' > {};
   struct uint32_type : keyword< 'u', 'i', 'n', 't', '3', '2' > {};
   struct uint64_type : keyword< 'u', 'i', 'n', 't', '6', '4' > {};
   struct fixed32_type : keyword< 'f', 'i', 'x', 'e', 'd', '3', '2' > {};
   struct fixed64_type : keyword< 'f', 'i', 'x', 'e', 'd', '6', '4' > {};
   struct sfixed32_type : keyword< 's', 'f', 'i', 'x', 'e', 'd', '3', '2' > {};
   struct sfixed64_type : keyword< 's', 'f', 'i', 'x', 'e', 'd', '6', '4' > {};

   struct builtin_type : sor< bool_type, bytes_type, double_type, float_type, string_type, int32_type, int64_type, sint32_type, sint64_type, uint32_type, uint64_type, fixed32_type, fixed64_type, sfixed32_type, sfixed64_type > {};

   struct defined_type : seq< opt< dot >, full_ident > {};  // NOTE: This replaces both message_type and enum_type -- they have the same syntax.

   struct type : sor< builtin_type, defined_type > {};

   struct field_option : if_must< option_name, sps, equ, sps, constant > {};
   struct field_options : if_must< one< '[' >, sps, list< field_option, comma, sp >, sps, one< ']' > > {};
   struct field_name : ident {};
   struct field_number : int_lit {};
   struct field : seq< opt< sor< keyword< 'o', 'p', 't', 'i', 'o', 'n', 'a', 'l' >, keyword< 'r', 'e', 'p', 'e', 'a', 't', 'e', 'd' > >, sps >, type, sps, field_name, sps, equ, sps, field_number, sps, opt< field_options, sps >, semi > {};

   struct oneof_name : ident {};
   struct oneof_field : if_must< type, sps, field_name, sps, equ, sps, field_number, sps, opt< field_options, sps >, semi > {};
   struct oneof_body : sor< oneof_field, semi > {};
   struct oneof : if_must< keyword< 'o', 'n', 'e', 'o', 'f' >, sps, oneof_name, sps, one< '{' >, sps, until< one< '}' >, oneof_body, sps >, sps > {};

   struct key_type : seq< sor< bool_type, string_type, int32_type, int64_type, sint32_type, sint64_type, uint32_type, uint64_type, fixed32_type, fixed64_type, sfixed32_type, sfixed64_type >, not_at< ident_other > > {};
   struct map_name : ident {};
   struct map_field : if_must< keyword< 'm', 'a', 'p' >, sps, one< '<' >, sps, key_type, sps, comma, sps, type, sps, one< '>' >, sps, map_name, sps, equ, sps, field_number, sps, opt< field_options, sps >, semi > {};

   struct range : if_must< int_lit, sps, keyword< 't', 'o' >, sps, sor< int_lit, keyword< 'm', 'a', 'x' > > > {};
   struct ranges : list_must< range, comma, sp > {};
   struct field_names : list_must< field_name, comma, sp > {};
   struct reserved : if_must< keyword< 'r', 'e', 's', 'e', 'r', 'v', 'e', 'd' >, sps, sor< ranges, field_names >, sps, semi > {};

   struct enum_name : ident {};
   struct enum_value_option : seq< option_name, sps, equ, sps, constant > {};
   struct enum_field : seq< ident, sps, equ, sps, int_lit, sps, opt_must< one< '[' >, sps, list_must< enum_value_option, comma, sp >, sps, one< ']' >, sps >, semi > {};
   struct enum_body : if_must< one< '{' >, sps, star< sor< option, enum_field, semi >, sps >, one< '}' > > {};
   struct enum_def : if_must< keyword< 'e', 'n', 'u', 'm' >, sps, enum_name, sps, enum_body > {};

   struct message_thing : sor< field, enum_def, message, option, oneof, map_field, reserved, extend, semi > {};
   struct message_body : seq< one<'{'>, sps, star< message_thing, sps >, one<'}'> > {};
   struct message : if_must< keyword< 'm', 'e', 's', 's', 'a', 'g', 'e' >, sps, defined_type, sps, message_body > {};
   struct extend : if_must< keyword< 'e', 'x', 't', 'e', 'n', 'd' >, sps, defined_type, sps, message_body > {};

   struct package : if_must< keyword< 'p', 'a', 'c', 'k', 'a', 'g', 'e' >, sps, full_ident, sps, semi > {};

   struct import_option : opt< sor< keyword< 'w', 'e', 'a', 'k' >, keyword< 'p', 'u', 'b', 'l', 'i', 'c' > > > {};
   struct import : if_must< keyword< 'i', 'm', 'p', 'o', 'r', 't' >, sps, import_option, sps, str_lit, sps, semi > {};

   struct rpc_name : ident {};
   struct rpc_type : if_must< one< '(' >, sps, opt< keyword< 's', 't', 'r', 'e', 'a', 'm' >, sps >, defined_type, sps, one< ')' > > {};
   struct rpc_options : if_must< one< '{' >, sps, star< sor< option, semi >, sps >, one< '}' > > {};
   struct rpc : if_must< keyword< 'r', 'p', 'c' >, sps, rpc_name, sps, rpc_type, sps, keyword< 'r', 'e', 't', 'u', 'r', 'n', 's' >, sps, rpc_type, sps, sor< semi, rpc_options > > {};
   struct service_name : ident {};
   struct service : if_must< keyword< 's', 'e', 'r', 'v', 'i', 'c', 'e' >, sps, service_name, sps, one< '{' >, sps, star< sor< option, rpc, semi >, sps >, one< '}' > > {};

   struct body : sor< import, package, option, message, enum_def, service, extend, semi > {};

   struct quote : one< '\'', '"' > {};
   struct head : if_must< keyword< 's', 'y', 'n', 't', 'a', 'x' >, sps, equ, sps, quote, string< 'p', 'r', 'o', 't', 'o', '3' >, quote, sps, semi > {};
   struct proto : must< sps, head, sps, star< body, sps >, eof > {};
   // clang-format on

}  // namespace TAO_PEGTL_NAMESPACE::proto3

#endif
