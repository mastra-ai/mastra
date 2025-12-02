/* Copyright (c) 2014, Google Inc.
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

#ifndef OPENSSL_HEADER_TOOL_INTERNAL_H
#define OPENSSL_HEADER_TOOL_INTERNAL_H

#include <openssl/base.h>
#include <openssl/span.h>

#include <string>
#include <utility>
#include <vector>

// MSVC issues warning C4702 for unreachable code in its xtree header when
// compiling with -D_HAS_EXCEPTIONS=0. See
// https://connect.microsoft.com/VisualStudio/feedback/details/809962
OPENSSL_MSVC_PRAGMA(warning(push))
OPENSSL_MSVC_PRAGMA(warning(disable: 4702))
#include <map>
OPENSSL_MSVC_PRAGMA(warning(pop))

struct FileCloser {
  void operator()(FILE *file) {
    fclose(file);
  }
};

using ScopedFILE = std::unique_ptr<FILE, FileCloser>;

// The following functions abstract between POSIX and Windows differences in
// file descriptor I/O functions.

// CloseFD behaves like |close|.
void CloseFD(int fd);

class ScopedFD {
 public:
  ScopedFD() {}
  explicit ScopedFD(int fd) : fd_(fd) {}
  ScopedFD(ScopedFD &&other) { *this = std::move(other); }
  ScopedFD(const ScopedFD &) = delete;
  ~ScopedFD() { reset(); }

  ScopedFD &operator=(const ScopedFD &) = delete;
  ScopedFD &operator=(ScopedFD &&other) {
    reset();
    fd_ = other.fd_;
    other.fd_ = -1;
    return *this;
  }

  explicit operator bool() const { return fd_ >= 0; }

  int get() const { return fd_; }

  void reset() {
    if (fd_ >= 0) {
      CloseFD(fd_);
    }
    fd_ = -1;
  }

  int release() {
    int fd = fd_;
    fd_ = -1;
    return fd;
  }

 private:
  int fd_ = -1;
};

// OpenFD behaves like |open| but handles |EINTR| and works on Windows.
ScopedFD OpenFD(const char *path, int flags);

// ReadFromFD reads up to |num| bytes from |fd| and writes the result to |out|.
// On success, it returns true and sets |*out_bytes_read| to the number of bytes
// read. Otherwise, it returns false and leaves an error in |errno|. On POSIX,
// it handles |EINTR| internally.
bool ReadFromFD(int fd, size_t *out_bytes_read, void *out, size_t num);

// WriteToFD writes up to |num| bytes from |in| to |fd|. On success, it returns
// true and sets |*out_bytes_written| to the number of bytes written. Otherwise,
// it returns false and leaves an error in |errno|. On POSIX, it handles |EINTR|
// internally.
bool WriteToFD(int fd, size_t *out_bytes_written, const void *in, size_t num);

// FDToFILE behaves like |fdopen|.
ScopedFILE FDToFILE(ScopedFD fd, const char *mode);

enum ArgumentType {
  kRequiredArgument,
  kOptionalArgument,
  kBooleanArgument,
};

struct argument {
  const char *name;
  ArgumentType type;
  const char *description;
};

bool ParseKeyValueArguments(std::map<std::string, std::string> *out_args, const
    std::vector<std::string> &args, const struct argument *templates);

void PrintUsage(const struct argument *templates);

bool GetUnsigned(unsigned *out, const std::string &arg_name,
                 unsigned default_value,
                 const std::map<std::string, std::string> &args);

bool ReadAll(std::vector<uint8_t> *out, FILE *in);
bool WriteToFile(const std::string &path, bssl::Span<const uint8_t> in);

bool Ciphers(const std::vector<std::string> &args);
bool Client(const std::vector<std::string> &args);
bool DoPKCS12(const std::vector<std::string> &args);
bool GenerateECH(const std::vector<std::string> &args);
bool GenerateEd25519Key(const std::vector<std::string> &args);
bool GenerateRSAKey(const std::vector<std::string> &args);
bool MD5Sum(const std::vector<std::string> &args);
bool Rand(const std::vector<std::string> &args);
bool SHA1Sum(const std::vector<std::string> &args);
bool SHA224Sum(const std::vector<std::string> &args);
bool SHA256Sum(const std::vector<std::string> &args);
bool SHA384Sum(const std::vector<std::string> &args);
bool SHA512Sum(const std::vector<std::string> &args);
bool SHA512256Sum(const std::vector<std::string> &args);
bool Server(const std::vector<std::string> &args);
bool Sign(const std::vector<std::string> &args);
bool Speed(const std::vector<std::string> &args);

// These values are DER encoded, RSA private keys.
extern const uint8_t kDERRSAPrivate2048[];
extern const size_t kDERRSAPrivate2048Len;
extern const uint8_t kDERRSAPrivate4096[];
extern const size_t kDERRSAPrivate4096Len;


#endif  // !OPENSSL_HEADER_TOOL_INTERNAL_H
