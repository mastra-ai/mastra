/**
 * hdr_histogram_log.c
 * Written by Michael Barker and released to the public domain,
 * as explained at http://creativecommons.org/publicdomain/zero/1.0/
 */

#include <stdint.h>
#include <stdio.h>
#include <string.h>

#include <hdr/hdr_histogram.h>
#include <hdr/hdr_histogram_log.h>
#include "hdr_tests.h"

#define UNUSED(x) (void)(x)

const char* hdr_strerror(int errnum)
{
    switch (errnum)
    {
        case HDR_COMPRESSION_COOKIE_MISMATCH:
            return "Compression cookie mismatch";
        case HDR_ENCODING_COOKIE_MISMATCH:
            return "Encoding cookie mismatch";
        case HDR_DEFLATE_INIT_FAIL:
            return "Deflate initialisation failed";
        case HDR_DEFLATE_FAIL:
            return "Deflate failed";
        case HDR_INFLATE_INIT_FAIL:
            return "Inflate initialisation failed";
        case HDR_INFLATE_FAIL:
            return "Inflate failed";
        case HDR_LOG_INVALID_VERSION:
            return "Log - invalid version in log header";
        case HDR_TRAILING_ZEROS_INVALID:
            return "Invalid number of trailing zeros";
        case HDR_VALUE_TRUNCATED:
            return "Truncated value found when decoding";
        case HDR_ENCODED_INPUT_TOO_LONG:
            return "The encoded input exceeds the size of the histogram";
        default:
            return strerror(errnum);
    }
}

int hdr_encode_compressed(
    struct hdr_histogram* h,
    uint8_t** compressed_histogram,
    size_t* compressed_len)
{
    UNUSED(h);
    UNUSED(compressed_histogram);
    UNUSED(compressed_len);

    return -1;
}

int hdr_decode_compressed(
    uint8_t* buffer, size_t length, struct hdr_histogram** histogram)
{
    UNUSED(buffer);
    UNUSED(length);
    UNUSED(histogram);

    return -1;
}

int hdr_log_writer_init(struct hdr_log_writer* writer)
{
    UNUSED(writer);

    return -1;
}

int hdr_log_write_header(
    struct hdr_log_writer* writer, FILE* file,
    const char* user_prefix, hdr_timespec* timestamp)
{
    UNUSED(writer);
    UNUSED(file);
    UNUSED(user_prefix);
    UNUSED(timestamp);

    return -1;
}

int hdr_log_write(
    struct hdr_log_writer* writer,
    FILE* file,
    const hdr_timespec* start_timestamp,
    const hdr_timespec* end_timestamp,
    struct hdr_histogram* histogram)
{
    UNUSED(writer);
    UNUSED(file);
    UNUSED(start_timestamp);
    UNUSED(end_timestamp);
    UNUSED(histogram);

    return -1;
}

int hdr_log_write_entry(
    struct hdr_log_writer* writer,
    FILE* file,
    struct hdr_log_entry* entry,
    struct hdr_histogram* histogram)
{
    UNUSED(writer);
    UNUSED(file);
    UNUSED(entry);
    UNUSED(histogram);

    return -1;
}

int hdr_log_reader_init(struct hdr_log_reader* reader)
{
    UNUSED(reader);

    return -1;
}

int hdr_log_read_header(struct hdr_log_reader* reader, FILE* file)
{
    UNUSED(reader);
    UNUSED(file);

    return -1;
}

int hdr_log_read(
    struct hdr_log_reader* reader, FILE* file, struct hdr_histogram** histogram,
    hdr_timespec* timestamp, hdr_timespec* interval)
{
    UNUSED(reader);
    UNUSED(file);
    UNUSED(histogram);
    UNUSED(timestamp);
    UNUSED(interval);

    return -1;
}

int hdr_log_read_entry(
    struct hdr_log_reader* reader, FILE* file, struct hdr_log_entry *entry, struct hdr_histogram** histogram)
{
    UNUSED(reader);
    UNUSED(file);
    UNUSED(entry);
    UNUSED(histogram);

    return -1;
}

int hdr_log_encode(struct hdr_histogram* histogram, char** encoded_histogram)
{
    UNUSED(histogram);
    UNUSED(encoded_histogram);

    return -1;
}

int hdr_log_decode(struct hdr_histogram** histogram, char* base64_histogram, size_t base64_len)
{
    UNUSED(histogram);
    UNUSED(base64_histogram);
    UNUSED(base64_len);

    return -1;
}
