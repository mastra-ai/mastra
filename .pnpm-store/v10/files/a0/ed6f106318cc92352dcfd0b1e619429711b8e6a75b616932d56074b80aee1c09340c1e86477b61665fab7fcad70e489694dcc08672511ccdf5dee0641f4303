// Copyright (c) 2021 Daniel Deptford
// Copyright (c) 2021-2022 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/PEGTL/

#ifndef TAO_PEGTL_CONTRIB_PEG_HPP
#define TAO_PEGTL_CONTRIB_PEG_HPP

#include <tao/pegtl.hpp>

namespace TAO_PEGTL_NAMESPACE::peg
{
   // PEG grammar from https://pdos.csail.mit.edu/~baford/packrat/popl04/peg-popl04.pdf
   namespace grammar
   {
      // clang-format off
      struct AND;
      struct Char;
      struct Class;
      struct CLOSE;
      struct Comment;
      struct Definition;
      struct DOT;
      struct EndOfFile;
      struct EndOfLine;
      struct Expression;
      struct QUESTION;
      struct IdentCont;
      struct Identifier;
      struct IdentStart;
      struct LEFTARROW;
      struct Literal;
      struct NOT;
      struct OPEN;
      struct PLUS;
      struct Prefix;
      struct Primary;
      struct Range;
      struct Sequence;
      struct SLASH;
      struct Space;
      struct Spacing;
      struct STAR;
      struct Suffix;

      struct Grammar : seq< Spacing, plus< Definition >, EndOfFile > {};

      struct Definition : seq< Identifier, LEFTARROW, Expression > {};
      struct Expression : list< Sequence, SLASH > {};
      struct Sequence : star< Prefix > {};

      struct Prefix : seq< opt< sor< AND, NOT > >, Suffix > {};
      struct Suffix : seq< Primary, opt< sor< QUESTION, STAR, PLUS > > > {};

      struct Primary : sor<
         seq< Identifier, not_at< LEFTARROW > >,
         seq< OPEN, Expression, CLOSE >,
         Literal,
         Class,
         DOT
         > {};

      struct Identifier : seq< IdentStart, star< IdentCont >, Spacing > {};

      struct IdentStart : identifier_first {};

      struct IdentCont : identifier_other {};

      struct Literal : sor<
         seq< one< '\'' >, until< one< '\'' >, Char >, Spacing >,
         seq< one< '"' >, until< one< '"' >, Char >, Spacing >
         > {};

      struct Class : seq< one< '[' >, until< one< ']' >, Range >, Spacing > {};

      struct Range : sor<
         seq< Char, one< '-' >, Char >,
         Char
         > {};

      struct Char : sor<
         seq<
            one< '\\' >,
            one< 'n', 'r', 't', '\'', '"', '[', ']', '\\' > >,
         seq<
            one< '\\' >,
            range< '0', '2' >,
            range< '0', '7' >,
            range< '0', '7' > >,
         seq<
            one< '\\' >,
            range< '0','7' >,
            opt< range< '0','7' > > >,
         seq<
            not_at< one< '\\' > >,
            any >
         > {};

      struct LEFTARROW : seq< string< '<','-' >, Spacing > {};
      struct SLASH : seq< one< '/' >, Spacing > {};
      struct AND : seq< one< '&' >, Spacing > {};
      struct NOT : seq< one< '!' >, Spacing > {};
      struct QUESTION : seq< one< '?' >, Spacing > {};
      struct STAR : seq< one< '*' >, Spacing > {};
      struct PLUS : seq< one< '+' >, Spacing > {};
      struct OPEN : seq< one< '(' >, Spacing > {};
      struct CLOSE : seq< one< ')' >, Spacing > {};
      struct DOT : seq< one< '.' >, Spacing > {};

      struct Spacing : star< sor< Space, Comment > > {};
      struct Comment : seq< one< '#' >, until< EndOfLine > > {};

      struct Space : sor< one< ' ', '\t' >, EndOfLine > {};
      struct EndOfLine : sor< string< '\r', '\n' >, one< '\n' >, one< '\r' > > {};
      struct EndOfFile : eof {};
      // clang-format on

   }  // namespace grammar

}  // namespace TAO_PEGTL_NAMESPACE::peg

#endif  // TAO_PEGTL_CONTRIB_PEG_HPP
