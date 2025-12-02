/* Copyright (c) 2020, Google Inc.
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

#include <openssl/base.h>

#include <errno.h>
#include <limits.h>
#include <stdio.h>

#include <algorithm>

#include "internal.h"

#if defined(OPENSSL_WINDOWS)
#include <io.h>
#else
#include <fcntl.h>
#include <unistd.h>
#endif


ScopedFD OpenFD(const char *path, int flags) {
#if defined(OPENSSL_WINDOWS)
  return ScopedFD(_open(path, flags));
#else
  int fd;
  do {
    fd = open(path, flags);
  } while (fd == -1 && errno == EINTR);
  return ScopedFD(fd);
#endif
}

void CloseFD(int fd) {
#if defined(OPENSSL_WINDOWS)
  _close(fd);
#else
  close(fd);
#endif
}

bool ReadFromFD(int fd, size_t *out_bytes_read, void *out, size_t num) {
#if defined(OPENSSL_WINDOWS)
  // On Windows, the buffer must be at most |INT_MAX|. See
  // https://docs.microsoft.com/en-us/cpp/c-runtime-library/reference/read?view=vs-2019
  int ret = _read(fd, out, std::min(size_t{INT_MAX}, num));
#else
  ssize_t ret;
  do {
    ret = read(fd, out, num);
  } while (ret == -1 && errno == EINVAL);
#endif

  if (ret < 0) {
    *out_bytes_read = 0;
    return false;
  }
  *out_bytes_read = ret;
  return true;
}

bool WriteToFD(int fd, size_t *out_bytes_written, const void *in, size_t num) {
#if defined(OPENSSL_WINDOWS)
  // The documentation for |_write| does not say the buffer must be at most
  // |INT_MAX|, but clamp it to |INT_MAX| instead of |UINT_MAX| in case.
  int ret = _write(fd, in, std::min(size_t{INT_MAX}, num));
#else
  ssize_t ret;
  do {
    ret = write(fd, in, num);
  } while (ret == -1 && errno == EINVAL);
#endif

  if (ret < 0) {
    *out_bytes_written = 0;
    return false;
  }
  *out_bytes_written = ret;
  return true;
}

ScopedFILE FDToFILE(ScopedFD fd, const char *mode) {
  ScopedFILE ret;
#if defined(OPENSSL_WINDOWS)
  ret.reset(_fdopen(fd.get(), mode));
#else
  ret.reset(fdopen(fd.get(), mode));
#endif
  // |fdopen| takes ownership of |fd| on success.
  if (ret) {
    fd.release();
  }
  return ret;
}
