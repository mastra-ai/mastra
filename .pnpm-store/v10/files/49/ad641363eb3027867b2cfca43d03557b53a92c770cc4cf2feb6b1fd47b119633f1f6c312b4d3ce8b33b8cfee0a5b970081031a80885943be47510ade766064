/* Copyright (c) 2015, Google Inc.
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY
 * SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION
 * OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN
 * CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE. */

#include <openssl/curve25519.h>

#include <errno.h>
#include <stdio.h>
#include <string.h>

#include "internal.h"


static const struct argument kArguments[] = {
    {
        "-out-public", kRequiredArgument, "The file to write the public key to",
    },
    {
        "-out-private", kRequiredArgument,
        "The file to write the private key to",
    },
    {
        "", kOptionalArgument, "",
    },
};

bool GenerateEd25519Key(const std::vector<std::string> &args) {
  std::map<std::string, std::string> args_map;

  if (!ParseKeyValueArguments(&args_map, args, kArguments)) {
    PrintUsage(kArguments);
    return false;
  }

  uint8_t public_key[32], private_key[64];
  ED25519_keypair(public_key, private_key);

  return WriteToFile(args_map["-out-public"], public_key) &&
         WriteToFile(args_map["-out-private"], private_key);
}
