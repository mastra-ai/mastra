// This header include/tao/json/external/double.hpp contains
// modified portions of the double-conversion library from
//   https://www.github.com/google/double-conversion
// which is licensed as follows:

// Copyright 2006-2011 the V8 project authors. All rights reserved.
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are
// met:
//
//     * Redistributions of source code must retain the above copyright
//       notice, this list of conditions and the following disclaimer.
//     * Redistributions in binary form must reproduce the above
//       copyright notice, this list of conditions and the following
//       disclaimer in the documentation and/or other materials provided
//       with the distribution.
//     * Neither the name of Google Inc. nor the names of its
//       contributors may be used to endorse or promote products derived
//       from this software without specific prior written permission.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
// "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
// LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
// A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
// OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
// SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
// LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
// DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
// THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
// (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
// OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

#ifndef TAO_JSON_EXTERNAL_DOUBLE_HPP
#define TAO_JSON_EXTERNAL_DOUBLE_HPP

// clang-format off

#include <limits.h>

#include <algorithm>
#include <cassert>
#include <cmath>
#include <cstdlib>
#include <cstring>

// Double operations detection based on target architecture.
// Linux uses a 80bit wide floating point stack on x86. This induces double
// rounding, which in turn leads to wrong results.
// An easy way to test if the floating-point operations are correct is to
// evaluate: 89255.0/1e22. If the floating-point stack is 64 bits wide then
// the result is equal to 89255e-22.
// The best way to test this, is to create a division-function and to compare
// the output of the division with the expected result. (Inlining must be
// disabled.)
// On Linux,x86 89255e-22 != Div_double(89255.0/1e22)
#if defined(_M_X64) || defined(__x86_64__) ||                           \
   defined(__ARMEL__) || defined(__avr32__) || defined(_M_ARM) || defined(_M_ARM64) || \
   defined(__hppa__) || defined(__ia64__) ||                            \
   defined(__mips__) ||                                                 \
   defined(__powerpc__) || defined(__ppc__) || defined(__ppc64__) ||    \
   defined(_POWER) || defined(_ARCH_PPC) || defined(_ARCH_PPC64) ||     \
   defined(__sparc__) || defined(__sparc) || defined(__s390__) ||       \
   defined(__SH4__) || defined(__alpha__) ||                            \
   defined(_MIPS_ARCH_MIPS32R2) ||                                      \
   defined(__AARCH64EL__) || defined(__aarch64__) ||                    \
   defined(__EMSCRIPTEN__)
#define TAO_JSON_DOUBLE_CONVERSION_CORRECT_DOUBLE_OPERATIONS 1
#elif defined(__mc68000__)
#undef TAO_JSON_DOUBLE_CONVERSION_CORRECT_DOUBLE_OPERATIONS
#elif defined(_M_IX86) || defined(__i386__) || defined(__i386)
#if defined(_WIN32)
// Windows uses a 64bit wide floating point stack.
#define TAO_JSON_DOUBLE_CONVERSION_CORRECT_DOUBLE_OPERATIONS 1
#else
#undef TAO_JSON_DOUBLE_CONVERSION_CORRECT_DOUBLE_OPERATIONS
#endif  // _WIN32
#else
#error Target architecture was not detected as supported by Double-Conversion.
#endif

#if defined(_WIN32) && !defined(__MINGW32__)

typedef signed char int8_t;
typedef unsigned char uint8_t;
typedef short int16_t;
typedef unsigned short uint16_t;
typedef int int32_t;
typedef unsigned int uint32_t;
typedef __int64 int64_t;
typedef unsigned __int64 uint64_t;

// intptr_t and friends are defined in crtdefs.h through stdio.h.

#else

#include <stdint.h>

#endif

typedef uint16_t uc16;

#define TAO_JSON_UINT64_2PART_C(a, b) (((static_cast<uint64_t>(a) << 32) + 0x##b##u))

#ifndef TAO_JSON_GDCV8_ARRAY_SIZE
#define TAO_JSON_GDCV8_ARRAY_SIZE(a)                             \
   ((sizeof(a) / sizeof(*(a))) /                        \
    static_cast<size_t>(!(sizeof(a) % sizeof(*(a)))))
#endif

namespace tao::json::double_conversion
{
   static const int kCharSize = sizeof( char );

   template <typename T>
   class Vector {
   public:
      Vector() : start_(nullptr), length_(0) {}
      Vector(T* data, int len) : start_(data), length_(len) {
         assert(len == 0 || (len > 0 && data != nullptr));
      }

      int length() const { return length_; }

      T& operator[](int index) const {
         assert(0 <= index && index < length_);
         return start_[index];
      }

   private:
      T* start_;
      int length_;
   };

   template <class Dest, class Source>
   inline Dest BitCast(const Source& source) {
      static_assert(sizeof(Dest) == sizeof(Source));

      Dest dest;
      std::memmove(&dest, &source, sizeof(dest));
      return dest;
   }

   template <class Dest, class Source>
   inline Dest BitCast(Source* source) {
      return BitCast<Dest>(reinterpret_cast<uintptr_t>(source));
   }

   class Bignum
   {
   public:
      static const int kMaxSignificantBits = 3584;

      Bignum();

      void AssignUInt16(uint16_t value);
      void AssignUInt64(uint64_t value);

      void AssignDecimalString(Vector<const char> value);

      void AssignPowerUInt16(uint16_t base, int exponent);

      void AddUInt64(uint64_t operand);
      void AddBignum(const Bignum& other);
      void SubtractBignum(const Bignum& other);

      void Square();
      void ShiftLeft(int shift_amount);
      void MultiplyByUInt32(uint32_t factor);
      void MultiplyByUInt64(uint64_t factor);
      void MultiplyByPowerOfTen(int exponent);

      static int Compare(const Bignum& a, const Bignum& b);
      static bool LessEqual(const Bignum& a, const Bignum& b) {
         return Compare(a, b) <= 0;
      }

   private:
      typedef uint32_t Chunk;
      typedef uint64_t DoubleChunk;

      static const int kChunkSize = sizeof(Chunk) * 8;
      static const int kDoubleChunkSize = sizeof(DoubleChunk) * 8;
      static const int kBigitSize = 28;
      static const Chunk kBigitMask = (1 << kBigitSize) - 1;
      static const int kBigitCapacity = kMaxSignificantBits / kBigitSize;

      void EnsureCapacity(int size) {
         assert(size <= kBigitCapacity);
         (void)size;
      }
      void Align(const Bignum& other);
      void Clamp();
      bool IsClamped() const;
      void Zero();

      void BigitsShiftLeft(int shift_amount);
      int BigitLength() const { return used_digits_ + exponent_; }
      Chunk BigitAt(int index) const;
      void SubtractTimes(const Bignum& other, int factor);

      Chunk bigits_buffer_[kBigitCapacity];
      Vector<Chunk> bigits_;
      int used_digits_;
      int exponent_;

      Bignum( const Bignum & ) = delete;
      void operator= ( const Bignum & ) = delete;
   };

   inline Bignum::Bignum()
         : bigits_(bigits_buffer_, kBigitCapacity), used_digits_(0), exponent_(0) {
      for (int i = 0; i < kBigitCapacity; ++i) {
         bigits_[i] = 0;
      }
   }

   template<typename S>
   inline int BitSize(S value) {
      (void) value;  // Mark variable as used.
      return 8 * sizeof(value);
   }

   inline void Bignum::AssignUInt16(uint16_t value) {
      assert(kBigitSize >= BitSize(value));
      Zero();
      if (value == 0) return;

      EnsureCapacity(1);
      bigits_[0] = value;
      used_digits_ = 1;
   }

   inline void Bignum::AssignUInt64(uint64_t value) {
      const int kUInt64Size = 64;

      Zero();
      if (value == 0) return;

      int needed_bigits = kUInt64Size / kBigitSize + 1;
      EnsureCapacity(needed_bigits);
      for (int i = 0; i < needed_bigits; ++i) {
         bigits_[i] = value & kBigitMask;
         value = value >> kBigitSize;
      }
      used_digits_ = needed_bigits;
      Clamp();
   }

   inline uint64_t ReadUInt64(Vector<const char> buffer,
                              int from,
                              int digits_to_read) {
      uint64_t result = 0;
      for (int i = from; i < from + digits_to_read; ++i) {
         int digit = buffer[i] - '0';
         assert(0 <= digit && digit <= 9);
         result = result * 10 + digit;
      }
      return result;
   }

   inline void Bignum::AssignDecimalString(Vector<const char> value) {
      const int kMaxUint64DecimalDigits = 19;
      Zero();
      int length = value.length();
      unsigned int pos = 0;
      while (length >= kMaxUint64DecimalDigits) {
         uint64_t digits = ReadUInt64(value, pos, kMaxUint64DecimalDigits);
         pos += kMaxUint64DecimalDigits;
         length -= kMaxUint64DecimalDigits;
         MultiplyByPowerOfTen(kMaxUint64DecimalDigits);
         AddUInt64(digits);
      }
      uint64_t digits = ReadUInt64(value, pos, length);
      MultiplyByPowerOfTen(length);
      AddUInt64(digits);
      Clamp();
   }

   inline void Bignum::AddUInt64(uint64_t operand) {
      if (operand == 0) return;
      Bignum other;
      other.AssignUInt64(operand);
      AddBignum(other);
   }

   inline void Bignum::AddBignum(const Bignum& other) {
      assert(IsClamped());
      assert(other.IsClamped());
      Align(other);
      EnsureCapacity(1 + (std::max)(BigitLength(), other.BigitLength()) - exponent_);
      Chunk carry = 0;
      int bigit_pos = other.exponent_ - exponent_;
      assert(bigit_pos >= 0);
      for (int i = 0; i < other.used_digits_; ++i) {
         Chunk sum = bigits_[bigit_pos] + other.bigits_[i] + carry;
         bigits_[bigit_pos] = sum & kBigitMask;
         carry = sum >> kBigitSize;
         bigit_pos++;
      }
      while (carry != 0) {
         Chunk sum = bigits_[bigit_pos] + carry;
         bigits_[bigit_pos] = sum & kBigitMask;
         carry = sum >> kBigitSize;
         bigit_pos++;
      }
      used_digits_ = (std::max)(bigit_pos, used_digits_);
      assert(IsClamped());
   }

   inline void Bignum::SubtractBignum(const Bignum& other) {
      assert(IsClamped());
      assert(other.IsClamped());
      assert(LessEqual(other, *this));
      Align(other);

      int offset = other.exponent_ - exponent_;
      Chunk borrow = 0;
      int i;
      for (i = 0; i < other.used_digits_; ++i) {
         assert((borrow == 0) || (borrow == 1));
         Chunk difference = bigits_[i + offset] - other.bigits_[i] - borrow;
         bigits_[i + offset] = difference & kBigitMask;
         borrow = difference >> (kChunkSize - 1);
      }
      while (borrow != 0) {
         Chunk difference = bigits_[i + offset] - borrow;
         bigits_[i + offset] = difference & kBigitMask;
         borrow = difference >> (kChunkSize - 1);
         ++i;
      }
      Clamp();
   }

   inline void Bignum::ShiftLeft(int shift_amount) {
      if (used_digits_ == 0) return;
      exponent_ += shift_amount / kBigitSize;
      int local_shift = shift_amount % kBigitSize;
      EnsureCapacity(used_digits_ + 1);
      BigitsShiftLeft(local_shift);
   }

   inline void Bignum::MultiplyByUInt32(uint32_t factor) {
      if (factor == 1) return;
      if (factor == 0) {
         Zero();
         return;
      }
      if (used_digits_ == 0) return;
      assert(kDoubleChunkSize >= kBigitSize + 32 + 1);
      DoubleChunk carry = 0;
      for (int i = 0; i < used_digits_; ++i) {
         DoubleChunk product = static_cast<DoubleChunk>(factor) * bigits_[i] + carry;
         bigits_[i] = static_cast<Chunk>(product & kBigitMask);
         carry = (product >> kBigitSize);
      }
      while (carry != 0) {
         EnsureCapacity(used_digits_ + 1);
         bigits_[used_digits_] = carry & kBigitMask;
         used_digits_++;
         carry >>= kBigitSize;
      }
   }

   inline void Bignum::MultiplyByUInt64(uint64_t factor) {
      if (factor == 1) return;
      if (factor == 0) {
         Zero();
         return;
      }
      assert(kBigitSize < 32);
      uint64_t carry = 0;
      uint64_t low = factor & 0xFFFFFFFF;
      uint64_t high = factor >> 32;
      for (int i = 0; i < used_digits_; ++i) {
         uint64_t product_low = low * bigits_[i];
         uint64_t product_high = high * bigits_[i];
         uint64_t tmp = (carry & kBigitMask) + product_low;
         bigits_[i] = tmp & kBigitMask;
         carry = (carry >> kBigitSize) + (tmp >> kBigitSize) +
            (product_high << (32 - kBigitSize));
      }
      while (carry != 0) {
         EnsureCapacity(used_digits_ + 1);
         bigits_[used_digits_] = carry & kBigitMask;
         used_digits_++;
         carry >>= kBigitSize;
      }
   }

   inline void Bignum::MultiplyByPowerOfTen(int exponent) {
      const uint64_t kFive27 = TAO_JSON_UINT64_2PART_C(0x6765c793, fa10079d);
      const uint16_t kFive1 = 5;
      const uint16_t kFive2 = kFive1 * 5;
      const uint16_t kFive3 = kFive2 * 5;
      const uint16_t kFive4 = kFive3 * 5;
      const uint16_t kFive5 = kFive4 * 5;
      const uint16_t kFive6 = kFive5 * 5;
      const uint32_t kFive7 = kFive6 * 5;
      const uint32_t kFive8 = kFive7 * 5;
      const uint32_t kFive9 = kFive8 * 5;
      const uint32_t kFive10 = kFive9 * 5;
      const uint32_t kFive11 = kFive10 * 5;
      const uint32_t kFive12 = kFive11 * 5;
      const uint32_t kFive13 = kFive12 * 5;
      const uint32_t kFive1_to_12[] =
         { kFive1, kFive2, kFive3, kFive4, kFive5, kFive6,
           kFive7, kFive8, kFive9, kFive10, kFive11, kFive12 };

      assert(exponent >= 0);
      if (exponent == 0) return;
      if (used_digits_ == 0) return;
      int remaining_exponent = exponent;
      while (remaining_exponent >= 27) {
         MultiplyByUInt64(kFive27);
         remaining_exponent -= 27;
      }
      while (remaining_exponent >= 13) {
         MultiplyByUInt32(kFive13);
         remaining_exponent -= 13;
      }
      if (remaining_exponent > 0) {
         MultiplyByUInt32(kFive1_to_12[remaining_exponent - 1]);
      }
      ShiftLeft(exponent);
   }

   inline void Bignum::Square() {
      assert(IsClamped());
      int product_length = 2 * used_digits_;
      EnsureCapacity(product_length);

      if ((1 << (2 * (kChunkSize - kBigitSize))) <= used_digits_) {
         std::abort();  // Unimplemented.
      }
      DoubleChunk accumulator = 0;
      int copy_offset = used_digits_;
      for (int i = 0; i < used_digits_; ++i) {
         bigits_[copy_offset + i] = bigits_[i];
      }
      for (int i = 0; i < used_digits_; ++i) {
         int bigit_index1 = i;
         int bigit_index2 = 0;
         while (bigit_index1 >= 0) {
            Chunk chunk1 = bigits_[copy_offset + bigit_index1];
            Chunk chunk2 = bigits_[copy_offset + bigit_index2];
            accumulator += static_cast<DoubleChunk>(chunk1) * chunk2;
            bigit_index1--;
            bigit_index2++;
         }
         bigits_[i] = static_cast<Chunk>(accumulator) & kBigitMask;
         accumulator >>= kBigitSize;
      }
      for (int i = used_digits_; i < product_length; ++i) {
         int bigit_index1 = used_digits_ - 1;
         int bigit_index2 = i - bigit_index1;
         while (bigit_index2 < used_digits_) {
            Chunk chunk1 = bigits_[copy_offset + bigit_index1];
            Chunk chunk2 = bigits_[copy_offset + bigit_index2];
            accumulator += static_cast<DoubleChunk>(chunk1) * chunk2;
            bigit_index1--;
            bigit_index2++;
         }
         bigits_[i] = static_cast<Chunk>(accumulator) & kBigitMask;
         accumulator >>= kBigitSize;
      }
      assert(accumulator == 0);
      used_digits_ = product_length;
      exponent_ *= 2;
      Clamp();
   }

   inline void Bignum::AssignPowerUInt16(uint16_t base, int power_exponent) {
      assert(base != 0);
      assert(power_exponent >= 0);
      if (power_exponent == 0) {
         AssignUInt16(1);
         return;
      }
      Zero();
      int shifts = 0;
      while ((base & 1) == 0) {
         base >>= 1;
         shifts++;
      }
      int bit_size = 0;
      int tmp_base = base;
      while (tmp_base != 0) {
         tmp_base >>= 1;
         bit_size++;
      }
      int final_size = bit_size * power_exponent;
      EnsureCapacity(final_size / kBigitSize + 2);
      int mask = 1;
      while (power_exponent >= mask) mask <<= 1;
      mask >>= 2;
      uint64_t this_value = base;
      bool delayed_multipliciation = false;
      const uint64_t max_32bits = 0xFFFFFFFF;
      while (mask != 0 && this_value <= max_32bits) {
         this_value = this_value * this_value;
         if ((power_exponent & mask) != 0) {
            uint64_t base_bits_mask =
               ~((static_cast<uint64_t>(1) << (64 - bit_size)) - 1);
            bool high_bits_zero = (this_value & base_bits_mask) == 0;
            if (high_bits_zero) {
               this_value *= base;
            } else {
               delayed_multipliciation = true;
            }
         }
         mask >>= 1;
      }
      AssignUInt64(this_value);
      if (delayed_multipliciation) {
         MultiplyByUInt32(base);
      }
      while (mask != 0) {
         Square();
         if ((power_exponent & mask) != 0) {
            MultiplyByUInt32(base);
         }
         mask >>= 1;
      }
      ShiftLeft(shifts * power_exponent);
   }

   inline Bignum::Chunk Bignum::BigitAt(int index) const {
      if (index >= BigitLength()) return 0;
      if (index < exponent_) return 0;
      return bigits_[index - exponent_];
   }

   inline int Bignum::Compare(const Bignum& a, const Bignum& b) {
      assert(a.IsClamped());
      assert(b.IsClamped());
      int bigit_length_a = a.BigitLength();
      int bigit_length_b = b.BigitLength();
      if (bigit_length_a < bigit_length_b) return -1;
      if (bigit_length_a > bigit_length_b) return +1;
      for (int i = bigit_length_a - 1; i >= (std::min)(a.exponent_, b.exponent_); --i) {
         const Chunk bigit_a = a.BigitAt(i);
         const Chunk bigit_b = b.BigitAt(i);
         if (bigit_a < bigit_b) return -1;
         if (bigit_a > bigit_b) return +1;
      }
      return 0;
   }

   inline void Bignum::Clamp() {
      while (used_digits_ > 0 && bigits_[used_digits_ - 1] == 0) {
         used_digits_--;
      }
      if (used_digits_ == 0) {
         exponent_ = 0;
      }
   }

   inline bool Bignum::IsClamped() const {
      return used_digits_ == 0 || bigits_[used_digits_ - 1] != 0;
   }

   inline void Bignum::Zero() {
      for (int i = 0; i < used_digits_; ++i) {
         bigits_[i] = 0;
      }
      used_digits_ = 0;
      exponent_ = 0;
   }

   inline void Bignum::Align(const Bignum& other) {
      if (exponent_ > other.exponent_) {
         int zero_digits = exponent_ - other.exponent_;
         EnsureCapacity(used_digits_ + zero_digits);
         for (int i = used_digits_ - 1; i >= 0; --i) {
            bigits_[i + zero_digits] = bigits_[i];
         }
         for (int i = 0; i < zero_digits; ++i) {
            bigits_[i] = 0;
         }
         used_digits_ += zero_digits;
         exponent_ -= zero_digits;
         assert(used_digits_ >= 0);
         assert(exponent_ >= 0);
      }
   }

   inline void Bignum::BigitsShiftLeft(int shift_amount) {
      assert(shift_amount < kBigitSize);
      assert(shift_amount >= 0);
      Chunk carry = 0;
      for (int i = 0; i < used_digits_; ++i) {
         Chunk new_carry = bigits_[i] >> (kBigitSize - shift_amount);
         bigits_[i] = ((bigits_[i] << shift_amount) + carry) & kBigitMask;
         carry = new_carry;
      }
      if (carry != 0) {
         bigits_[used_digits_] = carry;
         used_digits_++;
      }
   }

   inline void Bignum::SubtractTimes(const Bignum& other, int factor) {
      assert(exponent_ <= other.exponent_);
      if (factor < 3) {
         for (int i = 0; i < factor; ++i) {
            SubtractBignum(other);
         }
         return;
      }
      Chunk borrow = 0;
      int exponent_diff = other.exponent_ - exponent_;
      for (int i = 0; i < other.used_digits_; ++i) {
         DoubleChunk product = static_cast<DoubleChunk>(factor) * other.bigits_[i];
         DoubleChunk remove = borrow + product;
         Chunk difference = bigits_[i + exponent_diff] - (remove & kBigitMask);
         bigits_[i + exponent_diff] = difference & kBigitMask;
         borrow = static_cast<Chunk>((difference >> (kChunkSize - 1)) +
                                     (remove >> kBigitSize));
      }
      for (int i = other.used_digits_ + exponent_diff; i < used_digits_; ++i) {
         if (borrow == 0) return;
         Chunk difference = bigits_[i] - borrow;
         bigits_[i] = difference & kBigitMask;
         borrow = difference >> (kChunkSize - 1);
      }
      Clamp();
   }

   class DiyFp
   {
   public:
      static const int kSignificandSize = 64;

      DiyFp() : f_(0), e_(0) {}
      DiyFp(uint64_t significand, int exponent) : f_(significand), e_(exponent) {}

      void Subtract(const DiyFp& other) {
         assert(e_ == other.e_);
         assert(f_ >= other.f_);
         f_ -= other.f_;
      }

      static DiyFp Minus(const DiyFp& a, const DiyFp& b) {
         DiyFp result = a;
         result.Subtract(b);
         return result;
      }

      void Multiply(const DiyFp& other)
      {
         const uint64_t kM32 = 0xFFFFFFFFU;
         uint64_t a = f_ >> 32;
         uint64_t b = f_ & kM32;
         uint64_t c = other.f_ >> 32;
         uint64_t d = other.f_ & kM32;
         uint64_t ac = a * c;
         uint64_t bc = b * c;
         uint64_t ad = a * d;
         uint64_t bd = b * d;
         uint64_t tmp = (bd >> 32) + (ad & kM32) + (bc & kM32);
         tmp += 1U << 31;
         uint64_t result_f = ac + (ad >> 32) + (bc >> 32) + (tmp >> 32);
         e_ += other.e_ + 64;
         f_ = result_f;
      }

      static DiyFp Times(const DiyFp& a, const DiyFp& b)
      {
         DiyFp result = a;
         result.Multiply(b);
         return result;
      }

      void Normalize() {
         assert(f_ != 0);
         uint64_t significand = f_;
         int exponent = e_;

         const uint64_t k10MSBits = TAO_JSON_UINT64_2PART_C(0xFFC00000, 00000000);
         while ((significand & k10MSBits) == 0) {
            significand <<= 10;
            exponent -= 10;
         }
         while ((significand & kUint64MSB) == 0) {
            significand <<= 1;
            exponent--;
         }
         f_ = significand;
         e_ = exponent;
      }

      static DiyFp Normalize(const DiyFp& a) {
         DiyFp result = a;
         result.Normalize();
         return result;
      }

      uint64_t f() const { return f_; }
      int e() const { return e_; }

      void set_f(uint64_t new_value) { f_ = new_value; }
      void set_e(int new_value) { e_ = new_value; }

   private:
      static const uint64_t kUint64MSB = TAO_JSON_UINT64_2PART_C(0x80000000, 00000000);

      uint64_t f_;
      int e_;
   };

   static uint64_t double_to_uint64(double d) { return BitCast<uint64_t>(d); }
   static double uint64_to_double(uint64_t d64) { return BitCast<double>(d64); }

   class Double {
   public:
      static const uint64_t kSignMask = TAO_JSON_UINT64_2PART_C(0x80000000, 00000000);
      static const uint64_t kExponentMask = TAO_JSON_UINT64_2PART_C(0x7FF00000, 00000000);
      static const uint64_t kSignificandMask = TAO_JSON_UINT64_2PART_C(0x000FFFFF, FFFFFFFF);
      static const uint64_t kHiddenBit = TAO_JSON_UINT64_2PART_C(0x00100000, 00000000);
      static const int kPhysicalSignificandSize = 52;
      static const int kSignificandSize = 53;

      Double() : d64_(0) {}
      explicit Double(double d) : d64_(double_to_uint64(d)) {}
      explicit Double(uint64_t d64) : d64_(d64) {}
      explicit Double(DiyFp diy_fp)
            : d64_(DiyFpToUint64(diy_fp)) {}

      DiyFp AsDiyFp() const {
         assert(Sign() > 0);
         assert(!IsSpecial());
         return DiyFp(Significand(), Exponent());
      }

      DiyFp AsNormalizedDiyFp() const {
         assert(value() > 0.0);
         uint64_t f = Significand();
         int e = Exponent();

         while ((f & kHiddenBit) == 0) {
            f <<= 1;
            e--;
         }
         f <<= DiyFp::kSignificandSize - kSignificandSize;
         e -= DiyFp::kSignificandSize - kSignificandSize;
         return DiyFp(f, e);
      }

      uint64_t AsUint64() const {
         return d64_;
      }

      double NextDouble() const {
         if (d64_ == kInfinity) return Double(kInfinity).value();
         if (Sign() < 0 && Significand() == 0) {
            return 0.0;
         }
         if (Sign() < 0) {
            return Double(d64_ - 1).value();
         } else {
            return Double(d64_ + 1).value();
         }
      }

      double PreviousDouble() const {
         if (d64_ == (kInfinity | kSignMask)) return -Double::Infinity();
         if (Sign() < 0) {
            return Double(d64_ + 1).value();
         } else {
            if (Significand() == 0) return -0.0;
            return Double(d64_ - 1).value();
         }
      }

      int Exponent() const {
         if (IsDenormal()) return kDenormalExponent;

         uint64_t d64 = AsUint64();
         int biased_e =
            static_cast<int>((d64 & kExponentMask) >> kPhysicalSignificandSize);
         return biased_e - kExponentBias;
      }

      uint64_t Significand() const {
         uint64_t d64 = AsUint64();
         uint64_t significand = d64 & kSignificandMask;
         if (!IsDenormal()) {
            return significand + kHiddenBit;
         } else {
            return significand;
         }
      }

      bool IsDenormal() const {
         uint64_t d64 = AsUint64();
         return (d64 & kExponentMask) == 0;
      }

      bool IsSpecial() const {
         uint64_t d64 = AsUint64();
         return (d64 & kExponentMask) == kExponentMask;
      }

      bool IsNan() const {
         uint64_t d64 = AsUint64();
         return ((d64 & kExponentMask) == kExponentMask) &&
            ((d64 & kSignificandMask) != 0);
      }

      bool IsInfinite() const {
         uint64_t d64 = AsUint64();
         return ((d64 & kExponentMask) == kExponentMask) &&
            ((d64 & kSignificandMask) == 0);
      }

      int Sign() const {
         uint64_t d64 = AsUint64();
         return (d64 & kSignMask) == 0? 1: -1;
      }

      DiyFp UpperBoundary() const {
         assert(Sign() > 0);
         return DiyFp(Significand() * 2 + 1, Exponent() - 1);
      }

      void NormalizedBoundaries(DiyFp* out_m_minus, DiyFp* out_m_plus) const {
         assert(value() > 0.0);
         DiyFp v = this->AsDiyFp();
         DiyFp m_plus = DiyFp::Normalize(DiyFp((v.f() << 1) + 1, v.e() - 1));
         DiyFp m_minus;
         if (LowerBoundaryIsCloser()) {
            m_minus = DiyFp((v.f() << 2) - 1, v.e() - 2);
         } else {
            m_minus = DiyFp((v.f() << 1) - 1, v.e() - 1);
         }
         m_minus.set_f(m_minus.f() << (m_minus.e() - m_plus.e()));
         m_minus.set_e(m_plus.e());
         *out_m_plus = m_plus;
         *out_m_minus = m_minus;
      }

      bool LowerBoundaryIsCloser() const {
         bool physical_significand_is_zero = ((AsUint64() & kSignificandMask) == 0);
         return physical_significand_is_zero && (Exponent() != kDenormalExponent);
      }

      double value() const { return uint64_to_double(d64_); }

      static int SignificandSizeForOrderOfMagnitude(int order) {
         if (order >= (kDenormalExponent + kSignificandSize)) {
            return kSignificandSize;
         }
         if (order <= kDenormalExponent) return 0;
         return order - kDenormalExponent;
      }

      static double Infinity() {
         return Double(kInfinity).value();
      }

      static double NaN() {
         return Double(kNaN).value();
      }

   private:
      static const int kExponentBias = 0x3FF + kPhysicalSignificandSize;
      static const int kDenormalExponent = -kExponentBias + 1;
      static const int kMaxExponent = 0x7FF - kExponentBias;
      static const uint64_t kInfinity = TAO_JSON_UINT64_2PART_C(0x7FF00000, 00000000);
      static const uint64_t kNaN = TAO_JSON_UINT64_2PART_C(0x7FF80000, 00000000);

      const uint64_t d64_;

      static uint64_t DiyFpToUint64(DiyFp diy_fp) {
         uint64_t significand = diy_fp.f();
         int exponent = diy_fp.e();
         while (significand > kHiddenBit + kSignificandMask) {
            significand >>= 1;
            exponent++;
         }
         if (exponent >= kMaxExponent) {
            return kInfinity;
         }
         if (exponent < kDenormalExponent) {
            return 0;
         }
         while (exponent > kDenormalExponent && (significand & kHiddenBit) == 0) {
            significand <<= 1;
            exponent--;
         }
         uint64_t biased_exponent;
         if (exponent == kDenormalExponent && (significand & kHiddenBit) == 0) {
            biased_exponent = 0;
         } else {
            biased_exponent = static_cast<uint64_t>(exponent + kExponentBias);
         }
         return (significand & kSignificandMask) |
            (biased_exponent << kPhysicalSignificandSize);
      }

      Double( const Double& ) = delete;
      void operator=( const Double& ) = delete;
   };

   struct PowersOfTenCache
   {
      static const int kDecimalExponentDistance = 8;

      static const int kMinDecimalExponent = -348;
      static const int kMaxDecimalExponent = 340;

      static void GetCachedPowerForDecimalExponent(int requested_exponent,
                                                   DiyFp* power,
                                                   int* found_exponent);
   };

   struct CachedPower {
      uint64_t significand;
      int16_t binary_exponent;
      int16_t decimal_exponent;
   };

   constexpr inline CachedPower kCachedPowers[] = {
      {TAO_JSON_UINT64_2PART_C(0xfa8fd5a0, 081c0288), -1220, -348},
      {TAO_JSON_UINT64_2PART_C(0xbaaee17f, a23ebf76), -1193, -340},
      {TAO_JSON_UINT64_2PART_C(0x8b16fb20, 3055ac76), -1166, -332},
      {TAO_JSON_UINT64_2PART_C(0xcf42894a, 5dce35ea), -1140, -324},
      {TAO_JSON_UINT64_2PART_C(0x9a6bb0aa, 55653b2d), -1113, -316},
      {TAO_JSON_UINT64_2PART_C(0xe61acf03, 3d1a45df), -1087, -308},
      {TAO_JSON_UINT64_2PART_C(0xab70fe17, c79ac6ca), -1060, -300},
      {TAO_JSON_UINT64_2PART_C(0xff77b1fc, bebcdc4f), -1034, -292},
      {TAO_JSON_UINT64_2PART_C(0xbe5691ef, 416bd60c), -1007, -284},
      {TAO_JSON_UINT64_2PART_C(0x8dd01fad, 907ffc3c), -980, -276},
      {TAO_JSON_UINT64_2PART_C(0xd3515c28, 31559a83), -954, -268},
      {TAO_JSON_UINT64_2PART_C(0x9d71ac8f, ada6c9b5), -927, -260},
      {TAO_JSON_UINT64_2PART_C(0xea9c2277, 23ee8bcb), -901, -252},
      {TAO_JSON_UINT64_2PART_C(0xaecc4991, 4078536d), -874, -244},
      {TAO_JSON_UINT64_2PART_C(0x823c1279, 5db6ce57), -847, -236},
      {TAO_JSON_UINT64_2PART_C(0xc2109436, 4dfb5637), -821, -228},
      {TAO_JSON_UINT64_2PART_C(0x9096ea6f, 3848984f), -794, -220},
      {TAO_JSON_UINT64_2PART_C(0xd77485cb, 25823ac7), -768, -212},
      {TAO_JSON_UINT64_2PART_C(0xa086cfcd, 97bf97f4), -741, -204},
      {TAO_JSON_UINT64_2PART_C(0xef340a98, 172aace5), -715, -196},
      {TAO_JSON_UINT64_2PART_C(0xb23867fb, 2a35b28e), -688, -188},
      {TAO_JSON_UINT64_2PART_C(0x84c8d4df, d2c63f3b), -661, -180},
      {TAO_JSON_UINT64_2PART_C(0xc5dd4427, 1ad3cdba), -635, -172},
      {TAO_JSON_UINT64_2PART_C(0x936b9fce, bb25c996), -608, -164},
      {TAO_JSON_UINT64_2PART_C(0xdbac6c24, 7d62a584), -582, -156},
      {TAO_JSON_UINT64_2PART_C(0xa3ab6658, 0d5fdaf6), -555, -148},
      {TAO_JSON_UINT64_2PART_C(0xf3e2f893, dec3f126), -529, -140},
      {TAO_JSON_UINT64_2PART_C(0xb5b5ada8, aaff80b8), -502, -132},
      {TAO_JSON_UINT64_2PART_C(0x87625f05, 6c7c4a8b), -475, -124},
      {TAO_JSON_UINT64_2PART_C(0xc9bcff60, 34c13053), -449, -116},
      {TAO_JSON_UINT64_2PART_C(0x964e858c, 91ba2655), -422, -108},
      {TAO_JSON_UINT64_2PART_C(0xdff97724, 70297ebd), -396, -100},
      {TAO_JSON_UINT64_2PART_C(0xa6dfbd9f, b8e5b88f), -369, -92},
      {TAO_JSON_UINT64_2PART_C(0xf8a95fcf, 88747d94), -343, -84},
      {TAO_JSON_UINT64_2PART_C(0xb9447093, 8fa89bcf), -316, -76},
      {TAO_JSON_UINT64_2PART_C(0x8a08f0f8, bf0f156b), -289, -68},
      {TAO_JSON_UINT64_2PART_C(0xcdb02555, 653131b6), -263, -60},
      {TAO_JSON_UINT64_2PART_C(0x993fe2c6, d07b7fac), -236, -52},
      {TAO_JSON_UINT64_2PART_C(0xe45c10c4, 2a2b3b06), -210, -44},
      {TAO_JSON_UINT64_2PART_C(0xaa242499, 697392d3), -183, -36},
      {TAO_JSON_UINT64_2PART_C(0xfd87b5f2, 8300ca0e), -157, -28},
      {TAO_JSON_UINT64_2PART_C(0xbce50864, 92111aeb), -130, -20},
      {TAO_JSON_UINT64_2PART_C(0x8cbccc09, 6f5088cc), -103, -12},
      {TAO_JSON_UINT64_2PART_C(0xd1b71758, e219652c), -77, -4},
      {TAO_JSON_UINT64_2PART_C(0x9c400000, 00000000), -50, 4},
      {TAO_JSON_UINT64_2PART_C(0xe8d4a510, 00000000), -24, 12},
      {TAO_JSON_UINT64_2PART_C(0xad78ebc5, ac620000), 3, 20},
      {TAO_JSON_UINT64_2PART_C(0x813f3978, f8940984), 30, 28},
      {TAO_JSON_UINT64_2PART_C(0xc097ce7b, c90715b3), 56, 36},
      {TAO_JSON_UINT64_2PART_C(0x8f7e32ce, 7bea5c70), 83, 44},
      {TAO_JSON_UINT64_2PART_C(0xd5d238a4, abe98068), 109, 52},
      {TAO_JSON_UINT64_2PART_C(0x9f4f2726, 179a2245), 136, 60},
      {TAO_JSON_UINT64_2PART_C(0xed63a231, d4c4fb27), 162, 68},
      {TAO_JSON_UINT64_2PART_C(0xb0de6538, 8cc8ada8), 189, 76},
      {TAO_JSON_UINT64_2PART_C(0x83c7088e, 1aab65db), 216, 84},
      {TAO_JSON_UINT64_2PART_C(0xc45d1df9, 42711d9a), 242, 92},
      {TAO_JSON_UINT64_2PART_C(0x924d692c, a61be758), 269, 100},
      {TAO_JSON_UINT64_2PART_C(0xda01ee64, 1a708dea), 295, 108},
      {TAO_JSON_UINT64_2PART_C(0xa26da399, 9aef774a), 322, 116},
      {TAO_JSON_UINT64_2PART_C(0xf209787b, b47d6b85), 348, 124},
      {TAO_JSON_UINT64_2PART_C(0xb454e4a1, 79dd1877), 375, 132},
      {TAO_JSON_UINT64_2PART_C(0x865b8692, 5b9bc5c2), 402, 140},
      {TAO_JSON_UINT64_2PART_C(0xc83553c5, c8965d3d), 428, 148},
      {TAO_JSON_UINT64_2PART_C(0x952ab45c, fa97a0b3), 455, 156},
      {TAO_JSON_UINT64_2PART_C(0xde469fbd, 99a05fe3), 481, 164},
      {TAO_JSON_UINT64_2PART_C(0xa59bc234, db398c25), 508, 172},
      {TAO_JSON_UINT64_2PART_C(0xf6c69a72, a3989f5c), 534, 180},
      {TAO_JSON_UINT64_2PART_C(0xb7dcbf53, 54e9bece), 561, 188},
      {TAO_JSON_UINT64_2PART_C(0x88fcf317, f22241e2), 588, 196},
      {TAO_JSON_UINT64_2PART_C(0xcc20ce9b, d35c78a5), 614, 204},
      {TAO_JSON_UINT64_2PART_C(0x98165af3, 7b2153df), 641, 212},
      {TAO_JSON_UINT64_2PART_C(0xe2a0b5dc, 971f303a), 667, 220},
      {TAO_JSON_UINT64_2PART_C(0xa8d9d153, 5ce3b396), 694, 228},
      {TAO_JSON_UINT64_2PART_C(0xfb9b7cd9, a4a7443c), 720, 236},
      {TAO_JSON_UINT64_2PART_C(0xbb764c4c, a7a44410), 747, 244},
      {TAO_JSON_UINT64_2PART_C(0x8bab8eef, b6409c1a), 774, 252},
      {TAO_JSON_UINT64_2PART_C(0xd01fef10, a657842c), 800, 260},
      {TAO_JSON_UINT64_2PART_C(0x9b10a4e5, e9913129), 827, 268},
      {TAO_JSON_UINT64_2PART_C(0xe7109bfb, a19c0c9d), 853, 276},
      {TAO_JSON_UINT64_2PART_C(0xac2820d9, 623bf429), 880, 284},
      {TAO_JSON_UINT64_2PART_C(0x80444b5e, 7aa7cf85), 907, 292},
      {TAO_JSON_UINT64_2PART_C(0xbf21e440, 03acdd2d), 933, 300},
      {TAO_JSON_UINT64_2PART_C(0x8e679c2f, 5e44ff8f), 960, 308},
      {TAO_JSON_UINT64_2PART_C(0xd433179d, 9c8cb841), 986, 316},
      {TAO_JSON_UINT64_2PART_C(0x9e19db92, b4e31ba9), 1013, 324},
      {TAO_JSON_UINT64_2PART_C(0xeb96bf6e, badf77d9), 1039, 332},
      {TAO_JSON_UINT64_2PART_C(0xaf87023b, 9bf0ee6b), 1066, 340},
   };

   static const int kCachedPowersLength = TAO_JSON_GDCV8_ARRAY_SIZE(kCachedPowers);
   static const int kCachedPowersOffset = 348;
   static const double kD_1_LOG2_10 = 0.30102999566398114;

   inline void PowersOfTenCache::GetCachedPowerForDecimalExponent(int requested_exponent,
                                                                  DiyFp* power,
                                                                  int* found_exponent) {
      assert(kMinDecimalExponent <= requested_exponent);
      assert(requested_exponent < kMaxDecimalExponent + kDecimalExponentDistance);
      int index =
         (requested_exponent + kCachedPowersOffset) / kDecimalExponentDistance;
      CachedPower cached_power = kCachedPowers[index];
      *power = DiyFp(cached_power.significand, cached_power.binary_exponent);
      *found_exponent = cached_power.decimal_exponent;
      assert(*found_exponent <= requested_exponent);
      assert(requested_exponent < *found_exponent + kDecimalExponentDistance);
   }

   static const int kMaxExactDoubleIntegerDecimalDigits = 15;
   static const int kMaxUint64DecimalDigits = 19;

   static const int kMaxDecimalPower = 309;
   static const int kMinDecimalPower = -324;

   static const uint64_t kMaxUint64 = TAO_JSON_UINT64_2PART_C(0xFFFFFFFF, FFFFFFFF);

   constexpr inline double exact_powers_of_ten[] = {
      1.0,  // 10^0
      10.0,
      100.0,
      1000.0,
      10000.0,
      100000.0,
      1000000.0,
      10000000.0,
      100000000.0,
      1000000000.0,
      10000000000.0,  // 10^10
      100000000000.0,
      1000000000000.0,
      10000000000000.0,
      100000000000000.0,
      1000000000000000.0,
      10000000000000000.0,
      100000000000000000.0,
      1000000000000000000.0,
      10000000000000000000.0,
      100000000000000000000.0,  // 10^20
      1000000000000000000000.0,
      10000000000000000000000.0
   };

   static const int kExactPowersOfTenSize = TAO_JSON_GDCV8_ARRAY_SIZE(exact_powers_of_ten);
   static const int kMaxSignificantDecimalDigits = 780;

   inline uint64_t ReadUint64(Vector<const char> buffer,
                              int* number_of_read_digits) {
      uint64_t result = 0;
      int i = 0;
      while (i < buffer.length() && result <= (kMaxUint64 / 10 - 1)) {
         int digit = buffer[i++] - '0';
         assert(0 <= digit && digit <= 9);
         result = 10 * result + digit;
      }
      *number_of_read_digits = i;
      return result;
   }

   inline void ReadDiyFp(Vector<const char> buffer,
                         DiyFp* result,
                         int* remaining_decimals) {
      int read_digits;
      uint64_t significand = ReadUint64(buffer, &read_digits);
      if (buffer.length() == read_digits) {
         *result = DiyFp(significand, 0);
         *remaining_decimals = 0;
      } else {
         if (buffer[read_digits] >= '5') {
            significand++;
         }
         int exponent = 0;
         *result = DiyFp(significand, exponent);
         *remaining_decimals = buffer.length() - read_digits;
      }
   }

   inline bool DoubleStrtod(Vector<const char> trimmed,
                            int exponent,
                            double* result) {
#if !defined(TAO_JSON_DOUBLE_CONVERSION_CORRECT_DOUBLE_OPERATIONS)
      // On x86 the floating-point stack can be 64 or 80 bits wide. If it is
      // 80 bits wide (as is the case on Linux) then double-rounding occurs and the
      // result is not accurate.
      // We know that Windows32 uses 64 bits and is therefore accurate.
      // Note that the ARM simulator is compiled for 32bits. It therefore exhibits
      // the same problem.
      return false;
#endif
      if (trimmed.length() <= kMaxExactDoubleIntegerDecimalDigits) {
         int read_digits;
         if (exponent < 0 && -exponent < kExactPowersOfTenSize) {
            *result = static_cast<double>(ReadUint64(trimmed, &read_digits));
            assert(read_digits == trimmed.length());
            *result /= exact_powers_of_ten[-exponent];
            return true;
         }
         if (0 <= exponent && exponent < kExactPowersOfTenSize) {
            *result = static_cast<double>(ReadUint64(trimmed, &read_digits));
            assert(read_digits == trimmed.length());
            *result *= exact_powers_of_ten[exponent];
            return true;
         }
         int remaining_digits =
            kMaxExactDoubleIntegerDecimalDigits - trimmed.length();
         if ((0 <= exponent) &&
             (exponent - remaining_digits < kExactPowersOfTenSize)) {
            *result = static_cast<double>(ReadUint64(trimmed, &read_digits));
            assert(read_digits == trimmed.length());
            *result *= exact_powers_of_ten[remaining_digits];
            *result *= exact_powers_of_ten[exponent - remaining_digits];
            return true;
         }
      }
      return false;
   }

   inline DiyFp AdjustmentPowerOfTen(int exponent) {
      assert(0 < exponent);
      assert(exponent < PowersOfTenCache::kDecimalExponentDistance);
      assert(PowersOfTenCache::kDecimalExponentDistance == 8);
      switch (exponent) {
         case 1: return DiyFp(TAO_JSON_UINT64_2PART_C(0xa0000000, 00000000), -60);
         case 2: return DiyFp(TAO_JSON_UINT64_2PART_C(0xc8000000, 00000000), -57);
         case 3: return DiyFp(TAO_JSON_UINT64_2PART_C(0xfa000000, 00000000), -54);
         case 4: return DiyFp(TAO_JSON_UINT64_2PART_C(0x9c400000, 00000000), -50);
         case 5: return DiyFp(TAO_JSON_UINT64_2PART_C(0xc3500000, 00000000), -47);
         case 6: return DiyFp(TAO_JSON_UINT64_2PART_C(0xf4240000, 00000000), -44);
         case 7: return DiyFp(TAO_JSON_UINT64_2PART_C(0x98968000, 00000000), -40);
         default:
            std::abort();
      }
   }

   inline bool DiyFpStrtod(Vector<const char> buffer,
                           int exponent,
                           double* result) {
      DiyFp input;
      int remaining_decimals;
      ReadDiyFp(buffer, &input, &remaining_decimals);
      const int kDenominatorLog = 3;
      const int kDenominator = 1 << kDenominatorLog;
      exponent += remaining_decimals;
      uint64_t error = (remaining_decimals == 0 ? 0 : kDenominator / 2);

      int old_e = input.e();
      input.Normalize();
      error <<= old_e - input.e();

      assert(exponent <= PowersOfTenCache::kMaxDecimalExponent);
      if (exponent < PowersOfTenCache::kMinDecimalExponent) {
         *result = 0.0;
         return true;
      }
      DiyFp cached_power;
      int cached_decimal_exponent;
      PowersOfTenCache::GetCachedPowerForDecimalExponent(exponent,
                                                         &cached_power,
                                                         &cached_decimal_exponent);

      if (cached_decimal_exponent != exponent) {
         int adjustment_exponent = exponent - cached_decimal_exponent;
         DiyFp adjustment_power = AdjustmentPowerOfTen(adjustment_exponent);
         input.Multiply(adjustment_power);
         if (kMaxUint64DecimalDigits - buffer.length() >= adjustment_exponent) {
            assert(DiyFp::kSignificandSize == 64);
         } else {
            error += kDenominator / 2;
         }
      }

      input.Multiply(cached_power);
      int error_b = kDenominator / 2;
      int error_ab = (error == 0 ? 0 : 1);
      int fixed_error = kDenominator / 2;
      error += error_b + error_ab + fixed_error;

      old_e = input.e();
      input.Normalize();
      error <<= old_e - input.e();

      int order_of_magnitude = DiyFp::kSignificandSize + input.e();
      int effective_significand_size =
         Double::SignificandSizeForOrderOfMagnitude(order_of_magnitude);
      int precision_digits_count =
         DiyFp::kSignificandSize - effective_significand_size;
      if (precision_digits_count + kDenominatorLog >= DiyFp::kSignificandSize) {
         int shift_amount = (precision_digits_count + kDenominatorLog) -
            DiyFp::kSignificandSize + 1;
         input.set_f(input.f() >> shift_amount);
         input.set_e(input.e() + shift_amount);
         error = (error >> shift_amount) + 1 + kDenominator;
         precision_digits_count -= shift_amount;
      }
      assert(DiyFp::kSignificandSize == 64);
      assert(precision_digits_count < 64);
      uint64_t one64 = 1;
      uint64_t precision_bits_mask = (one64 << precision_digits_count) - 1;
      uint64_t precision_bits = input.f() & precision_bits_mask;
      uint64_t half_way = one64 << (precision_digits_count - 1);
      precision_bits *= kDenominator;
      half_way *= kDenominator;
      DiyFp rounded_input(input.f() >> precision_digits_count,
                          input.e() + precision_digits_count);
      if (precision_bits >= half_way + error) {
         rounded_input.set_f(rounded_input.f() + 1);
      }
      *result = Double(rounded_input).value();
      if (half_way - error < precision_bits && precision_bits < half_way + error) {
         return false;
      } else {
         return true;
      }
   }

   inline int CompareBufferWithDiyFp(Vector<const char> buffer,
                                     int exponent,
                                     DiyFp diy_fp) {
      assert(buffer.length() + exponent <= kMaxDecimalPower + 1);
      assert(buffer.length() + exponent > kMinDecimalPower);
      assert(buffer.length() <= kMaxSignificantDecimalDigits);
      assert(((kMaxDecimalPower + 1) * 333 / 100) < Bignum::kMaxSignificantBits);
      Bignum buffer_bignum;
      Bignum diy_fp_bignum;
      buffer_bignum.AssignDecimalString(buffer);
      diy_fp_bignum.AssignUInt64(diy_fp.f());
      if (exponent >= 0) {
         buffer_bignum.MultiplyByPowerOfTen(exponent);
      } else {
         diy_fp_bignum.MultiplyByPowerOfTen(-exponent);
      }
      if (diy_fp.e() > 0) {
         diy_fp_bignum.ShiftLeft(diy_fp.e());
      } else {
         buffer_bignum.ShiftLeft(-diy_fp.e());
      }
      return Bignum::Compare(buffer_bignum, diy_fp_bignum);
   }

   inline bool ComputeGuess(Vector<const char> trimmed, int exponent,
                            double* guess) {
      if (trimmed.length() == 0) {
         *guess = 0.0;
         return true;
      }
      if (exponent + trimmed.length() - 1 >= kMaxDecimalPower) {
         *guess = Double::Infinity();
         return true;
      }
      if (exponent + trimmed.length() <= kMinDecimalPower) {
         *guess = 0.0;
         return true;
      }

      if (DoubleStrtod(trimmed, exponent, guess) ||
          DiyFpStrtod(trimmed, exponent, guess)) {
         return true;
      }
      if (*guess == Double::Infinity()) {
         return true;
      }
      return false;
   }

   inline double Strtod( Vector< const char > buffer, int exponent )
   {
      double guess;
      if (ComputeGuess(buffer, exponent, &guess)) {
         return guess;
      }
      DiyFp upper_boundary = Double(guess).UpperBoundary();
      int comparison = CompareBufferWithDiyFp(buffer, exponent, upper_boundary);
      if (comparison < 0) {
         return guess;
      } else if (comparison > 0) {
         return Double(guess).NextDouble();
      } else if ((Double(guess).Significand() & 1) == 0) {
         return guess;
      } else {
         return Double(guess).NextDouble();
      }
   }

}  // namespace tao::json::double_conversion

#endif
