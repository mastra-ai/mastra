/* Copyright (C) 1995-1998 Eric Young (eay@cryptsoft.com)
 * All rights reserved.
 *
 * This package is an SSL implementation written
 * by Eric Young (eay@cryptsoft.com).
 * The implementation was written so as to conform with Netscapes SSL.
 *
 * This library is free for commercial and non-commercial use as long as
 * the following conditions are aheared to.  The following conditions
 * apply to all code found in this distribution, be it the RC4, RSA,
 * lhash, DES, etc., code; not just the SSL code.  The SSL documentation
 * included with this distribution is covered by the same copyright terms
 * except that the holder is Tim Hudson (tjh@cryptsoft.com).
 *
 * Copyright remains Eric Young's, and as such any Copyright notices in
 * the code are not to be removed.
 * If this package is used in a product, Eric Young should be given attribution
 * as the author of the parts of the library used.
 * This can be in the form of a textual message at program startup or
 * in documentation (online or textual) provided with the package.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 * 1. Redistributions of source code must retain the copyright
 *    notice, this list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright
 *    notice, this list of conditions and the following disclaimer in the
 *    documentation and/or other materials provided with the distribution.
 * 3. All advertising materials mentioning features or use of this software
 *    must display the following acknowledgement:
 *    "This product includes cryptographic software written by
 *     Eric Young (eay@cryptsoft.com)"
 *    The word 'cryptographic' can be left out if the rouines from the library
 *    being used are not cryptographic related :-).
 * 4. If you include any Windows specific code (or a derivative thereof) from
 *    the apps directory (application code) you must include an acknowledgement:
 *    "This product includes software written by Tim Hudson (tjh@cryptsoft.com)"
 *
 * THIS SOFTWARE IS PROVIDED BY ERIC YOUNG ``AS IS'' AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
 * ARE DISCLAIMED.  IN NO EVENT SHALL THE AUTHOR OR CONTRIBUTORS BE LIABLE
 * FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
 * DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS
 * OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION)
 * HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT
 * LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY
 * OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF
 * SUCH DAMAGE.
 *
 * The licence and distribution terms for any publically available version or
 * derivative of this code cannot be changed.  i.e. this code cannot simply be
 * copied and put under another distribution licence
 * [including the GNU Public Licence.] */

#include <openssl/des.h>

#include <stdlib.h>

#include "internal.h"


static const uint32_t des_skb[8][64] = {
    {  // for C bits (numbered as per FIPS 46) 1 2 3 4 5 6
     0x00000000, 0x00000010, 0x20000000, 0x20000010, 0x00010000,
     0x00010010, 0x20010000, 0x20010010, 0x00000800, 0x00000810,
     0x20000800, 0x20000810, 0x00010800, 0x00010810, 0x20010800,
     0x20010810, 0x00000020, 0x00000030, 0x20000020, 0x20000030,
     0x00010020, 0x00010030, 0x20010020, 0x20010030, 0x00000820,
     0x00000830, 0x20000820, 0x20000830, 0x00010820, 0x00010830,
     0x20010820, 0x20010830, 0x00080000, 0x00080010, 0x20080000,
     0x20080010, 0x00090000, 0x00090010, 0x20090000, 0x20090010,
     0x00080800, 0x00080810, 0x20080800, 0x20080810, 0x00090800,
     0x00090810, 0x20090800, 0x20090810, 0x00080020, 0x00080030,
     0x20080020, 0x20080030, 0x00090020, 0x00090030, 0x20090020,
     0x20090030, 0x00080820, 0x00080830, 0x20080820, 0x20080830,
     0x00090820, 0x00090830, 0x20090820, 0x20090830, },
    {  // for C bits (numbered as per FIPS 46) 7 8 10 11 12 13
     0x00000000, 0x02000000, 0x00002000, 0x02002000, 0x00200000,
     0x02200000, 0x00202000, 0x02202000, 0x00000004, 0x02000004,
     0x00002004, 0x02002004, 0x00200004, 0x02200004, 0x00202004,
     0x02202004, 0x00000400, 0x02000400, 0x00002400, 0x02002400,
     0x00200400, 0x02200400, 0x00202400, 0x02202400, 0x00000404,
     0x02000404, 0x00002404, 0x02002404, 0x00200404, 0x02200404,
     0x00202404, 0x02202404, 0x10000000, 0x12000000, 0x10002000,
     0x12002000, 0x10200000, 0x12200000, 0x10202000, 0x12202000,
     0x10000004, 0x12000004, 0x10002004, 0x12002004, 0x10200004,
     0x12200004, 0x10202004, 0x12202004, 0x10000400, 0x12000400,
     0x10002400, 0x12002400, 0x10200400, 0x12200400, 0x10202400,
     0x12202400, 0x10000404, 0x12000404, 0x10002404, 0x12002404,
     0x10200404, 0x12200404, 0x10202404, 0x12202404, },
    {  // for C bits (numbered as per FIPS 46) 14 15 16 17 19 20
     0x00000000, 0x00000001, 0x00040000, 0x00040001, 0x01000000,
     0x01000001, 0x01040000, 0x01040001, 0x00000002, 0x00000003,
     0x00040002, 0x00040003, 0x01000002, 0x01000003, 0x01040002,
     0x01040003, 0x00000200, 0x00000201, 0x00040200, 0x00040201,
     0x01000200, 0x01000201, 0x01040200, 0x01040201, 0x00000202,
     0x00000203, 0x00040202, 0x00040203, 0x01000202, 0x01000203,
     0x01040202, 0x01040203, 0x08000000, 0x08000001, 0x08040000,
     0x08040001, 0x09000000, 0x09000001, 0x09040000, 0x09040001,
     0x08000002, 0x08000003, 0x08040002, 0x08040003, 0x09000002,
     0x09000003, 0x09040002, 0x09040003, 0x08000200, 0x08000201,
     0x08040200, 0x08040201, 0x09000200, 0x09000201, 0x09040200,
     0x09040201, 0x08000202, 0x08000203, 0x08040202, 0x08040203,
     0x09000202, 0x09000203, 0x09040202, 0x09040203, },
    {  // for C bits (numbered as per FIPS 46) 21 23 24 26 27 28
     0x00000000, 0x00100000, 0x00000100, 0x00100100, 0x00000008,
     0x00100008, 0x00000108, 0x00100108, 0x00001000, 0x00101000,
     0x00001100, 0x00101100, 0x00001008, 0x00101008, 0x00001108,
     0x00101108, 0x04000000, 0x04100000, 0x04000100, 0x04100100,
     0x04000008, 0x04100008, 0x04000108, 0x04100108, 0x04001000,
     0x04101000, 0x04001100, 0x04101100, 0x04001008, 0x04101008,
     0x04001108, 0x04101108, 0x00020000, 0x00120000, 0x00020100,
     0x00120100, 0x00020008, 0x00120008, 0x00020108, 0x00120108,
     0x00021000, 0x00121000, 0x00021100, 0x00121100, 0x00021008,
     0x00121008, 0x00021108, 0x00121108, 0x04020000, 0x04120000,
     0x04020100, 0x04120100, 0x04020008, 0x04120008, 0x04020108,
     0x04120108, 0x04021000, 0x04121000, 0x04021100, 0x04121100,
     0x04021008, 0x04121008, 0x04021108, 0x04121108, },
    {  // for D bits (numbered as per FIPS 46) 1 2 3 4 5 6
     0x00000000, 0x10000000, 0x00010000, 0x10010000, 0x00000004,
     0x10000004, 0x00010004, 0x10010004, 0x20000000, 0x30000000,
     0x20010000, 0x30010000, 0x20000004, 0x30000004, 0x20010004,
     0x30010004, 0x00100000, 0x10100000, 0x00110000, 0x10110000,
     0x00100004, 0x10100004, 0x00110004, 0x10110004, 0x20100000,
     0x30100000, 0x20110000, 0x30110000, 0x20100004, 0x30100004,
     0x20110004, 0x30110004, 0x00001000, 0x10001000, 0x00011000,
     0x10011000, 0x00001004, 0x10001004, 0x00011004, 0x10011004,
     0x20001000, 0x30001000, 0x20011000, 0x30011000, 0x20001004,
     0x30001004, 0x20011004, 0x30011004, 0x00101000, 0x10101000,
     0x00111000, 0x10111000, 0x00101004, 0x10101004, 0x00111004,
     0x10111004, 0x20101000, 0x30101000, 0x20111000, 0x30111000,
     0x20101004, 0x30101004, 0x20111004, 0x30111004, },
    {  // for D bits (numbered as per FIPS 46) 8 9 11 12 13 14
     0x00000000, 0x08000000, 0x00000008, 0x08000008, 0x00000400,
     0x08000400, 0x00000408, 0x08000408, 0x00020000, 0x08020000,
     0x00020008, 0x08020008, 0x00020400, 0x08020400, 0x00020408,
     0x08020408, 0x00000001, 0x08000001, 0x00000009, 0x08000009,
     0x00000401, 0x08000401, 0x00000409, 0x08000409, 0x00020001,
     0x08020001, 0x00020009, 0x08020009, 0x00020401, 0x08020401,
     0x00020409, 0x08020409, 0x02000000, 0x0A000000, 0x02000008,
     0x0A000008, 0x02000400, 0x0A000400, 0x02000408, 0x0A000408,
     0x02020000, 0x0A020000, 0x02020008, 0x0A020008, 0x02020400,
     0x0A020400, 0x02020408, 0x0A020408, 0x02000001, 0x0A000001,
     0x02000009, 0x0A000009, 0x02000401, 0x0A000401, 0x02000409,
     0x0A000409, 0x02020001, 0x0A020001, 0x02020009, 0x0A020009,
     0x02020401, 0x0A020401, 0x02020409, 0x0A020409, },
    {  // for D bits (numbered as per FIPS 46) 16 17 18 19 20 21
     0x00000000, 0x00000100, 0x00080000, 0x00080100, 0x01000000,
     0x01000100, 0x01080000, 0x01080100, 0x00000010, 0x00000110,
     0x00080010, 0x00080110, 0x01000010, 0x01000110, 0x01080010,
     0x01080110, 0x00200000, 0x00200100, 0x00280000, 0x00280100,
     0x01200000, 0x01200100, 0x01280000, 0x01280100, 0x00200010,
     0x00200110, 0x00280010, 0x00280110, 0x01200010, 0x01200110,
     0x01280010, 0x01280110, 0x00000200, 0x00000300, 0x00080200,
     0x00080300, 0x01000200, 0x01000300, 0x01080200, 0x01080300,
     0x00000210, 0x00000310, 0x00080210, 0x00080310, 0x01000210,
     0x01000310, 0x01080210, 0x01080310, 0x00200200, 0x00200300,
     0x00280200, 0x00280300, 0x01200200, 0x01200300, 0x01280200,
     0x01280300, 0x00200210, 0x00200310, 0x00280210, 0x00280310,
     0x01200210, 0x01200310, 0x01280210, 0x01280310, },
    {  // for D bits (numbered as per FIPS 46) 22 23 24 25 27 28
     0x00000000, 0x04000000, 0x00040000, 0x04040000, 0x00000002,
     0x04000002, 0x00040002, 0x04040002, 0x00002000, 0x04002000,
     0x00042000, 0x04042000, 0x00002002, 0x04002002, 0x00042002,
     0x04042002, 0x00000020, 0x04000020, 0x00040020, 0x04040020,
     0x00000022, 0x04000022, 0x00040022, 0x04040022, 0x00002020,
     0x04002020, 0x00042020, 0x04042020, 0x00002022, 0x04002022,
     0x00042022, 0x04042022, 0x00000800, 0x04000800, 0x00040800,
     0x04040800, 0x00000802, 0x04000802, 0x00040802, 0x04040802,
     0x00002800, 0x04002800, 0x00042800, 0x04042800, 0x00002802,
     0x04002802, 0x00042802, 0x04042802, 0x00000820, 0x04000820,
     0x00040820, 0x04040820, 0x00000822, 0x04000822, 0x00040822,
     0x04040822, 0x00002820, 0x04002820, 0x00042820, 0x04042820,
     0x00002822, 0x04002822, 0x00042822, 0x04042822, }};

static const uint32_t DES_SPtrans[8][64] = {
    {  // nibble 0
     0x02080800, 0x00080000, 0x02000002, 0x02080802, 0x02000000,
     0x00080802, 0x00080002, 0x02000002, 0x00080802, 0x02080800,
     0x02080000, 0x00000802, 0x02000802, 0x02000000, 0x00000000,
     0x00080002, 0x00080000, 0x00000002, 0x02000800, 0x00080800,
     0x02080802, 0x02080000, 0x00000802, 0x02000800, 0x00000002,
     0x00000800, 0x00080800, 0x02080002, 0x00000800, 0x02000802,
     0x02080002, 0x00000000, 0x00000000, 0x02080802, 0x02000800,
     0x00080002, 0x02080800, 0x00080000, 0x00000802, 0x02000800,
     0x02080002, 0x00000800, 0x00080800, 0x02000002, 0x00080802,
     0x00000002, 0x02000002, 0x02080000, 0x02080802, 0x00080800,
     0x02080000, 0x02000802, 0x02000000, 0x00000802, 0x00080002,
     0x00000000, 0x00080000, 0x02000000, 0x02000802, 0x02080800,
     0x00000002, 0x02080002, 0x00000800, 0x00080802, },
    {  // nibble 1
     0x40108010, 0x00000000, 0x00108000, 0x40100000, 0x40000010,
     0x00008010, 0x40008000, 0x00108000, 0x00008000, 0x40100010,
     0x00000010, 0x40008000, 0x00100010, 0x40108000, 0x40100000,
     0x00000010, 0x00100000, 0x40008010, 0x40100010, 0x00008000,
     0x00108010, 0x40000000, 0x00000000, 0x00100010, 0x40008010,
     0x00108010, 0x40108000, 0x40000010, 0x40000000, 0x00100000,
     0x00008010, 0x40108010, 0x00100010, 0x40108000, 0x40008000,
     0x00108010, 0x40108010, 0x00100010, 0x40000010, 0x00000000,
     0x40000000, 0x00008010, 0x00100000, 0x40100010, 0x00008000,
     0x40000000, 0x00108010, 0x40008010, 0x40108000, 0x00008000,
     0x00000000, 0x40000010, 0x00000010, 0x40108010, 0x00108000,
     0x40100000, 0x40100010, 0x00100000, 0x00008010, 0x40008000,
     0x40008010, 0x00000010, 0x40100000, 0x00108000, },
    {  // nibble 2
     0x04000001, 0x04040100, 0x00000100, 0x04000101, 0x00040001,
     0x04000000, 0x04000101, 0x00040100, 0x04000100, 0x00040000,
     0x04040000, 0x00000001, 0x04040101, 0x00000101, 0x00000001,
     0x04040001, 0x00000000, 0x00040001, 0x04040100, 0x00000100,
     0x00000101, 0x04040101, 0x00040000, 0x04000001, 0x04040001,
     0x04000100, 0x00040101, 0x04040000, 0x00040100, 0x00000000,
     0x04000000, 0x00040101, 0x04040100, 0x00000100, 0x00000001,
     0x00040000, 0x00000101, 0x00040001, 0x04040000, 0x04000101,
     0x00000000, 0x04040100, 0x00040100, 0x04040001, 0x00040001,
     0x04000000, 0x04040101, 0x00000001, 0x00040101, 0x04000001,
     0x04000000, 0x04040101, 0x00040000, 0x04000100, 0x04000101,
     0x00040100, 0x04000100, 0x00000000, 0x04040001, 0x00000101,
     0x04000001, 0x00040101, 0x00000100, 0x04040000, },
    {  // nibble 3
     0x00401008, 0x10001000, 0x00000008, 0x10401008, 0x00000000,
     0x10400000, 0x10001008, 0x00400008, 0x10401000, 0x10000008,
     0x10000000, 0x00001008, 0x10000008, 0x00401008, 0x00400000,
     0x10000000, 0x10400008, 0x00401000, 0x00001000, 0x00000008,
     0x00401000, 0x10001008, 0x10400000, 0x00001000, 0x00001008,
     0x00000000, 0x00400008, 0x10401000, 0x10001000, 0x10400008,
     0x10401008, 0x00400000, 0x10400008, 0x00001008, 0x00400000,
     0x10000008, 0x00401000, 0x10001000, 0x00000008, 0x10400000,
     0x10001008, 0x00000000, 0x00001000, 0x00400008, 0x00000000,
     0x10400008, 0x10401000, 0x00001000, 0x10000000, 0x10401008,
     0x00401008, 0x00400000, 0x10401008, 0x00000008, 0x10001000,
     0x00401008, 0x00400008, 0x00401000, 0x10400000, 0x10001008,
     0x00001008, 0x10000000, 0x10000008, 0x10401000, },
    {  // nibble 4
     0x08000000, 0x00010000, 0x00000400, 0x08010420, 0x08010020,
     0x08000400, 0x00010420, 0x08010000, 0x00010000, 0x00000020,
     0x08000020, 0x00010400, 0x08000420, 0x08010020, 0x08010400,
     0x00000000, 0x00010400, 0x08000000, 0x00010020, 0x00000420,
     0x08000400, 0x00010420, 0x00000000, 0x08000020, 0x00000020,
     0x08000420, 0x08010420, 0x00010020, 0x08010000, 0x00000400,
     0x00000420, 0x08010400, 0x08010400, 0x08000420, 0x00010020,
     0x08010000, 0x00010000, 0x00000020, 0x08000020, 0x08000400,
     0x08000000, 0x00010400, 0x08010420, 0x00000000, 0x00010420,
     0x08000000, 0x00000400, 0x00010020, 0x08000420, 0x00000400,
     0x00000000, 0x08010420, 0x08010020, 0x08010400, 0x00000420,
     0x00010000, 0x00010400, 0x08010020, 0x08000400, 0x00000420,
     0x00000020, 0x00010420, 0x08010000, 0x08000020, },
    {  // nibble 5
     0x80000040, 0x00200040, 0x00000000, 0x80202000, 0x00200040,
     0x00002000, 0x80002040, 0x00200000, 0x00002040, 0x80202040,
     0x00202000, 0x80000000, 0x80002000, 0x80000040, 0x80200000,
     0x00202040, 0x00200000, 0x80002040, 0x80200040, 0x00000000,
     0x00002000, 0x00000040, 0x80202000, 0x80200040, 0x80202040,
     0x80200000, 0x80000000, 0x00002040, 0x00000040, 0x00202000,
     0x00202040, 0x80002000, 0x00002040, 0x80000000, 0x80002000,
     0x00202040, 0x80202000, 0x00200040, 0x00000000, 0x80002000,
     0x80000000, 0x00002000, 0x80200040, 0x00200000, 0x00200040,
     0x80202040, 0x00202000, 0x00000040, 0x80202040, 0x00202000,
     0x00200000, 0x80002040, 0x80000040, 0x80200000, 0x00202040,
     0x00000000, 0x00002000, 0x80000040, 0x80002040, 0x80202000,
     0x80200000, 0x00002040, 0x00000040, 0x80200040, },
    {  // nibble 6
     0x00004000, 0x00000200, 0x01000200, 0x01000004, 0x01004204,
     0x00004004, 0x00004200, 0x00000000, 0x01000000, 0x01000204,
     0x00000204, 0x01004000, 0x00000004, 0x01004200, 0x01004000,
     0x00000204, 0x01000204, 0x00004000, 0x00004004, 0x01004204,
     0x00000000, 0x01000200, 0x01000004, 0x00004200, 0x01004004,
     0x00004204, 0x01004200, 0x00000004, 0x00004204, 0x01004004,
     0x00000200, 0x01000000, 0x00004204, 0x01004000, 0x01004004,
     0x00000204, 0x00004000, 0x00000200, 0x01000000, 0x01004004,
     0x01000204, 0x00004204, 0x00004200, 0x00000000, 0x00000200,
     0x01000004, 0x00000004, 0x01000200, 0x00000000, 0x01000204,
     0x01000200, 0x00004200, 0x00000204, 0x00004000, 0x01004204,
     0x01000000, 0x01004200, 0x00000004, 0x00004004, 0x01004204,
     0x01000004, 0x01004200, 0x01004000, 0x00004004, },
    {  // nibble 7
     0x20800080, 0x20820000, 0x00020080, 0x00000000, 0x20020000,
     0x00800080, 0x20800000, 0x20820080, 0x00000080, 0x20000000,
     0x00820000, 0x00020080, 0x00820080, 0x20020080, 0x20000080,
     0x20800000, 0x00020000, 0x00820080, 0x00800080, 0x20020000,
     0x20820080, 0x20000080, 0x00000000, 0x00820000, 0x20000000,
     0x00800000, 0x20020080, 0x20800080, 0x00800000, 0x00020000,
     0x20820000, 0x00000080, 0x00800000, 0x00020000, 0x20000080,
     0x20820080, 0x00020080, 0x20000000, 0x00000000, 0x00820000,
     0x20800080, 0x20020080, 0x20020000, 0x00800080, 0x20820000,
     0x00000080, 0x00800080, 0x20020000, 0x20820080, 0x00800000,
     0x20800000, 0x20000080, 0x00820000, 0x00020080, 0x20020080,
     0x20800000, 0x00000080, 0x20820000, 0x00820080, 0x00000000,
     0x20000000, 0x20800080, 0x00020000, 0x00820080, }};

#define HPERM_OP(a, t, n, m)                  \
  ((t) = ((((a) << (16 - (n))) ^ (a)) & (m)), \
   (a) = (a) ^ (t) ^ ((t) >> (16 - (n))))

void DES_set_key(const DES_cblock *key, DES_key_schedule *schedule) {
  static const int shifts2[16] = {0, 0, 1, 1, 1, 1, 1, 1,
                                  0, 1, 1, 1, 1, 1, 1, 0};
  uint32_t c, d, t, s, t2;
  const uint8_t *in;
  int i;

  in = key->bytes;

  c2l(in, c);
  c2l(in, d);

  // do PC1 in 47 simple operations :-)
  // Thanks to John Fletcher (john_fletcher@lccmail.ocf.llnl.gov)
  // for the inspiration. :-)
  PERM_OP(d, c, t, 4, 0x0f0f0f0f);
  HPERM_OP(c, t, -2, 0xcccc0000);
  HPERM_OP(d, t, -2, 0xcccc0000);
  PERM_OP(d, c, t, 1, 0x55555555);
  PERM_OP(c, d, t, 8, 0x00ff00ff);
  PERM_OP(d, c, t, 1, 0x55555555);
  d = (((d & 0x000000ff) << 16) | (d & 0x0000ff00) |
       ((d & 0x00ff0000) >> 16) | ((c & 0xf0000000) >> 4));
  c &= 0x0fffffff;

  for (i = 0; i < ITERATIONS; i++) {
    if (shifts2[i]) {
      c = ((c >> 2) | (c << 26));
      d = ((d >> 2) | (d << 26));
    } else {
      c = ((c >> 1) | (c << 27));
      d = ((d >> 1) | (d << 27));
    }
    c &= 0x0fffffff;
    d &= 0x0fffffff;
    // could be a few less shifts but I am to lazy at this
    // point in time to investigate
    s = des_skb[0][(c) & 0x3f] |
        des_skb[1][((c >> 6) & 0x03) | ((c >> 7) & 0x3c)] |
        des_skb[2][((c >> 13) & 0x0f) | ((c >> 14) & 0x30)] |
        des_skb[3][((c >> 20) & 0x01) | ((c >> 21) & 0x06) |
                   ((c >> 22) & 0x38)];
    t = des_skb[4][(d) & 0x3f] |
        des_skb[5][((d >> 7) & 0x03) | ((d >> 8) & 0x3c)] |
        des_skb[6][(d >> 15) & 0x3f] |
        des_skb[7][((d >> 21) & 0x0f) | ((d >> 22) & 0x30)];

    // table contained 0213 4657
    t2 = ((t << 16) | (s & 0x0000ffff)) & 0xffffffff;
    schedule->subkeys[i][0] = CRYPTO_rotr_u32(t2, 30);

    t2 = ((s >> 16) | (t & 0xffff0000));
    schedule->subkeys[i][1] = CRYPTO_rotr_u32(t2, 26);
  }
}

static const uint8_t kOddParity[256] = {
    1,   1,   2,   2,   4,   4,   7,   7,   8,   8,   11,  11,  13,  13,  14,
    14,  16,  16,  19,  19,  21,  21,  22,  22,  25,  25,  26,  26,  28,  28,
    31,  31,  32,  32,  35,  35,  37,  37,  38,  38,  41,  41,  42,  42,  44,
    44,  47,  47,  49,  49,  50,  50,  52,  52,  55,  55,  56,  56,  59,  59,
    61,  61,  62,  62,  64,  64,  67,  67,  69,  69,  70,  70,  73,  73,  74,
    74,  76,  76,  79,  79,  81,  81,  82,  82,  84,  84,  87,  87,  88,  88,
    91,  91,  93,  93,  94,  94,  97,  97,  98,  98,  100, 100, 103, 103, 104,
    104, 107, 107, 109, 109, 110, 110, 112, 112, 115, 115, 117, 117, 118, 118,
    121, 121, 122, 122, 124, 124, 127, 127, 128, 128, 131, 131, 133, 133, 134,
    134, 137, 137, 138, 138, 140, 140, 143, 143, 145, 145, 146, 146, 148, 148,
    151, 151, 152, 152, 155, 155, 157, 157, 158, 158, 161, 161, 162, 162, 164,
    164, 167, 167, 168, 168, 171, 171, 173, 173, 174, 174, 176, 176, 179, 179,
    181, 181, 182, 182, 185, 185, 186, 186, 188, 188, 191, 191, 193, 193, 194,
    194, 196, 196, 199, 199, 200, 200, 203, 203, 205, 205, 206, 206, 208, 208,
    211, 211, 213, 213, 214, 214, 217, 217, 218, 218, 220, 220, 223, 223, 224,
    224, 227, 227, 229, 229, 230, 230, 233, 233, 234, 234, 236, 236, 239, 239,
    241, 241, 242, 242, 244, 244, 247, 247, 248, 248, 251, 251, 253, 253, 254,
    254
};

void DES_set_odd_parity(DES_cblock *key) {
  unsigned i;

  for (i = 0; i < DES_KEY_SZ; i++) {
    key->bytes[i] = kOddParity[key->bytes[i]];
  }
}

static void DES_encrypt1(uint32_t *data, const DES_key_schedule *ks, int enc) {
  uint32_t l, r, t, u;

  r = data[0];
  l = data[1];

  IP(r, l);
  // Things have been modified so that the initial rotate is done outside
  // the loop.  This required the DES_SPtrans values in sp.h to be
  // rotated 1 bit to the right. One perl script later and things have a
  // 5% speed up on a sparc2. Thanks to Richard Outerbridge
  // <71755.204@CompuServe.COM> for pointing this out.
  // clear the top bits on machines with 8byte longs
  // shift left by 2
  r = CRYPTO_rotr_u32(r, 29);
  l = CRYPTO_rotr_u32(l, 29);

  // I don't know if it is worth the effort of loop unrolling the
  // inner loop
  if (enc) {
    D_ENCRYPT(ks, l, r, 0);
    D_ENCRYPT(ks, r, l, 1);
    D_ENCRYPT(ks, l, r, 2);
    D_ENCRYPT(ks, r, l, 3);
    D_ENCRYPT(ks, l, r, 4);
    D_ENCRYPT(ks, r, l, 5);
    D_ENCRYPT(ks, l, r, 6);
    D_ENCRYPT(ks, r, l, 7);
    D_ENCRYPT(ks, l, r, 8);
    D_ENCRYPT(ks, r, l, 9);
    D_ENCRYPT(ks, l, r, 10);
    D_ENCRYPT(ks, r, l, 11);
    D_ENCRYPT(ks, l, r, 12);
    D_ENCRYPT(ks, r, l, 13);
    D_ENCRYPT(ks, l, r, 14);
    D_ENCRYPT(ks, r, l, 15);
  } else {
    D_ENCRYPT(ks, l, r, 15);
    D_ENCRYPT(ks, r, l, 14);
    D_ENCRYPT(ks, l, r, 13);
    D_ENCRYPT(ks, r, l, 12);
    D_ENCRYPT(ks, l, r, 11);
    D_ENCRYPT(ks, r, l, 10);
    D_ENCRYPT(ks, l, r, 9);
    D_ENCRYPT(ks, r, l, 8);
    D_ENCRYPT(ks, l, r, 7);
    D_ENCRYPT(ks, r, l, 6);
    D_ENCRYPT(ks, l, r, 5);
    D_ENCRYPT(ks, r, l, 4);
    D_ENCRYPT(ks, l, r, 3);
    D_ENCRYPT(ks, r, l, 2);
    D_ENCRYPT(ks, l, r, 1);
    D_ENCRYPT(ks, r, l, 0);
  }

  // rotate and clear the top bits on machines with 8byte longs
  l = CRYPTO_rotr_u32(l, 3);
  r = CRYPTO_rotr_u32(r, 3);

  FP(r, l);
  data[0] = l;
  data[1] = r;
}

static void DES_encrypt2(uint32_t *data, const DES_key_schedule *ks, int enc) {
  uint32_t l, r, t, u;

  r = data[0];
  l = data[1];

  // Things have been modified so that the initial rotate is done outside the
  // loop.  This required the DES_SPtrans values in sp.h to be rotated 1 bit to
  // the right. One perl script later and things have a 5% speed up on a
  // sparc2. Thanks to Richard Outerbridge <71755.204@CompuServe.COM> for
  // pointing this out.
  // clear the top bits on machines with 8byte longs
  r = CRYPTO_rotr_u32(r, 29);
  l = CRYPTO_rotr_u32(l, 29);

  // I don't know if it is worth the effort of loop unrolling the
  // inner loop
  if (enc) {
    D_ENCRYPT(ks, l, r, 0);
    D_ENCRYPT(ks, r, l, 1);
    D_ENCRYPT(ks, l, r, 2);
    D_ENCRYPT(ks, r, l, 3);
    D_ENCRYPT(ks, l, r, 4);
    D_ENCRYPT(ks, r, l, 5);
    D_ENCRYPT(ks, l, r, 6);
    D_ENCRYPT(ks, r, l, 7);
    D_ENCRYPT(ks, l, r, 8);
    D_ENCRYPT(ks, r, l, 9);
    D_ENCRYPT(ks, l, r, 10);
    D_ENCRYPT(ks, r, l, 11);
    D_ENCRYPT(ks, l, r, 12);
    D_ENCRYPT(ks, r, l, 13);
    D_ENCRYPT(ks, l, r, 14);
    D_ENCRYPT(ks, r, l, 15);
  } else {
    D_ENCRYPT(ks, l, r, 15);
    D_ENCRYPT(ks, r, l, 14);
    D_ENCRYPT(ks, l, r, 13);
    D_ENCRYPT(ks, r, l, 12);
    D_ENCRYPT(ks, l, r, 11);
    D_ENCRYPT(ks, r, l, 10);
    D_ENCRYPT(ks, l, r, 9);
    D_ENCRYPT(ks, r, l, 8);
    D_ENCRYPT(ks, l, r, 7);
    D_ENCRYPT(ks, r, l, 6);
    D_ENCRYPT(ks, l, r, 5);
    D_ENCRYPT(ks, r, l, 4);
    D_ENCRYPT(ks, l, r, 3);
    D_ENCRYPT(ks, r, l, 2);
    D_ENCRYPT(ks, l, r, 1);
    D_ENCRYPT(ks, r, l, 0);
  }
  // rotate and clear the top bits on machines with 8byte longs
  data[0] = CRYPTO_rotr_u32(l, 3);
  data[1] = CRYPTO_rotr_u32(r, 3);
}

void DES_encrypt3(uint32_t *data, const DES_key_schedule *ks1,
                  const DES_key_schedule *ks2, const DES_key_schedule *ks3) {
  uint32_t l, r;

  l = data[0];
  r = data[1];
  IP(l, r);
  data[0] = l;
  data[1] = r;
  DES_encrypt2((uint32_t *)data, ks1, DES_ENCRYPT);
  DES_encrypt2((uint32_t *)data, ks2, DES_DECRYPT);
  DES_encrypt2((uint32_t *)data, ks3, DES_ENCRYPT);
  l = data[0];
  r = data[1];
  FP(r, l);
  data[0] = l;
  data[1] = r;
}

void DES_decrypt3(uint32_t *data, const DES_key_schedule *ks1,
                  const DES_key_schedule *ks2, const DES_key_schedule *ks3) {
  uint32_t l, r;

  l = data[0];
  r = data[1];
  IP(l, r);
  data[0] = l;
  data[1] = r;
  DES_encrypt2((uint32_t *)data, ks3, DES_DECRYPT);
  DES_encrypt2((uint32_t *)data, ks2, DES_ENCRYPT);
  DES_encrypt2((uint32_t *)data, ks1, DES_DECRYPT);
  l = data[0];
  r = data[1];
  FP(r, l);
  data[0] = l;
  data[1] = r;
}

void DES_ecb_encrypt(const DES_cblock *in_block, DES_cblock *out_block,
                     const DES_key_schedule *schedule, int is_encrypt) {
  uint32_t l;
  uint32_t ll[2];
  const uint8_t *in = in_block->bytes;
  uint8_t *out = out_block->bytes;

  c2l(in, l);
  ll[0] = l;
  c2l(in, l);
  ll[1] = l;
  DES_encrypt1(ll, schedule, is_encrypt);
  l = ll[0];
  l2c(l, out);
  l = ll[1];
  l2c(l, out);
  ll[0] = ll[1] = 0;
}

void DES_ncbc_encrypt(const uint8_t *in, uint8_t *out, size_t len,
                      const DES_key_schedule *schedule, DES_cblock *ivec,
                      int enc) {
  uint32_t tin0, tin1;
  uint32_t tout0, tout1, xor0, xor1;
  uint32_t tin[2];
  unsigned char *iv;

  iv = ivec->bytes;

  if (enc) {
    c2l(iv, tout0);
    c2l(iv, tout1);
    for (; len >= 8; len -= 8) {
      c2l(in, tin0);
      c2l(in, tin1);
      tin0 ^= tout0;
      tin[0] = tin0;
      tin1 ^= tout1;
      tin[1] = tin1;
      DES_encrypt1((uint32_t *)tin, schedule, DES_ENCRYPT);
      tout0 = tin[0];
      l2c(tout0, out);
      tout1 = tin[1];
      l2c(tout1, out);
    }
    if (len != 0) {
      c2ln(in, tin0, tin1, len);
      tin0 ^= tout0;
      tin[0] = tin0;
      tin1 ^= tout1;
      tin[1] = tin1;
      DES_encrypt1((uint32_t *)tin, schedule, DES_ENCRYPT);
      tout0 = tin[0];
      l2c(tout0, out);
      tout1 = tin[1];
      l2c(tout1, out);
    }
    iv = ivec->bytes;
    l2c(tout0, iv);
    l2c(tout1, iv);
  } else {
    c2l(iv, xor0);
    c2l(iv, xor1);
    for (; len >= 8; len -= 8) {
      c2l(in, tin0);
      tin[0] = tin0;
      c2l(in, tin1);
      tin[1] = tin1;
      DES_encrypt1((uint32_t *)tin, schedule, DES_DECRYPT);
      tout0 = tin[0] ^ xor0;
      tout1 = tin[1] ^ xor1;
      l2c(tout0, out);
      l2c(tout1, out);
      xor0 = tin0;
      xor1 = tin1;
    }
    if (len != 0) {
      c2l(in, tin0);
      tin[0] = tin0;
      c2l(in, tin1);
      tin[1] = tin1;
      DES_encrypt1((uint32_t *)tin, schedule, DES_DECRYPT);
      tout0 = tin[0] ^ xor0;
      tout1 = tin[1] ^ xor1;
      l2cn(tout0, tout1, out, len);
      xor0 = tin0;
      xor1 = tin1;
    }
    iv = ivec->bytes;
    l2c(xor0, iv);
    l2c(xor1, iv);
  }
  tin[0] = tin[1] = 0;
}

void DES_ecb3_encrypt(const DES_cblock *input, DES_cblock *output,
                      const DES_key_schedule *ks1, const DES_key_schedule *ks2,
                      const DES_key_schedule *ks3, int enc) {
  uint32_t l0, l1;
  uint32_t ll[2];
  const uint8_t *in = input->bytes;
  uint8_t *out = output->bytes;

  c2l(in, l0);
  c2l(in, l1);
  ll[0] = l0;
  ll[1] = l1;
  if (enc) {
    DES_encrypt3(ll, ks1, ks2, ks3);
  } else {
    DES_decrypt3(ll, ks1, ks2, ks3);
  }
  l0 = ll[0];
  l1 = ll[1];
  l2c(l0, out);
  l2c(l1, out);
}

void DES_ede3_cbc_encrypt(const uint8_t *in, uint8_t *out, size_t len,
                          const DES_key_schedule *ks1,
                          const DES_key_schedule *ks2,
                          const DES_key_schedule *ks3, DES_cblock *ivec,
                          int enc) {
  uint32_t tin0, tin1;
  uint32_t tout0, tout1, xor0, xor1;
  uint32_t tin[2];
  uint8_t *iv;

  iv = ivec->bytes;

  if (enc) {
    c2l(iv, tout0);
    c2l(iv, tout1);
    for (; len >= 8; len -= 8) {
      c2l(in, tin0);
      c2l(in, tin1);
      tin0 ^= tout0;
      tin1 ^= tout1;

      tin[0] = tin0;
      tin[1] = tin1;
      DES_encrypt3((uint32_t *)tin, ks1, ks2, ks3);
      tout0 = tin[0];
      tout1 = tin[1];

      l2c(tout0, out);
      l2c(tout1, out);
    }
    if (len != 0) {
      c2ln(in, tin0, tin1, len);
      tin0 ^= tout0;
      tin1 ^= tout1;

      tin[0] = tin0;
      tin[1] = tin1;
      DES_encrypt3((uint32_t *)tin, ks1, ks2, ks3);
      tout0 = tin[0];
      tout1 = tin[1];

      l2c(tout0, out);
      l2c(tout1, out);
    }
    iv = ivec->bytes;
    l2c(tout0, iv);
    l2c(tout1, iv);
  } else {
    uint32_t t0, t1;

    c2l(iv, xor0);
    c2l(iv, xor1);
    for (; len >= 8; len -= 8) {
      c2l(in, tin0);
      c2l(in, tin1);

      t0 = tin0;
      t1 = tin1;

      tin[0] = tin0;
      tin[1] = tin1;
      DES_decrypt3((uint32_t *)tin, ks1, ks2, ks3);
      tout0 = tin[0];
      tout1 = tin[1];

      tout0 ^= xor0;
      tout1 ^= xor1;
      l2c(tout0, out);
      l2c(tout1, out);
      xor0 = t0;
      xor1 = t1;
    }
    if (len != 0) {
      c2l(in, tin0);
      c2l(in, tin1);

      t0 = tin0;
      t1 = tin1;

      tin[0] = tin0;
      tin[1] = tin1;
      DES_decrypt3((uint32_t *)tin, ks1, ks2, ks3);
      tout0 = tin[0];
      tout1 = tin[1];

      tout0 ^= xor0;
      tout1 ^= xor1;
      l2cn(tout0, tout1, out, len);
      xor0 = t0;
      xor1 = t1;
    }

    iv = ivec->bytes;
    l2c(xor0, iv);
    l2c(xor1, iv);
  }

  tin[0] = tin[1] = 0;
}

void DES_ede2_cbc_encrypt(const uint8_t *in, uint8_t *out, size_t len,
                          const DES_key_schedule *ks1,
                          const DES_key_schedule *ks2,
                          DES_cblock *ivec,
                          int enc) {
  DES_ede3_cbc_encrypt(in, out, len, ks1, ks2, ks1, ivec, enc);
}


// Deprecated functions.

void DES_set_key_unchecked(const DES_cblock *key, DES_key_schedule *schedule) {
  DES_set_key(key, schedule);
}

#undef HPERM_OP
#undef c2l
#undef l2c
#undef c2ln
#undef l2cn
#undef PERM_OP
#undef IP
#undef FP
#undef LOAD_DATA
#undef D_ENCRYPT
#undef ITERATIONS
#undef HALF_ITERATIONS
