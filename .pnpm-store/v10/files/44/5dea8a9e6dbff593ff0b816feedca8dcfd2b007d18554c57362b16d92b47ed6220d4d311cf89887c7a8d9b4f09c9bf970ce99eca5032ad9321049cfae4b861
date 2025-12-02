/**
 * hdr_histogram_log.c
 * Written by Michael Barker and released to the public domain,
 * as explained at http://creativecommons.org/publicdomain/zero/1.0/
 */

#include <stdint.h>
#include <stdlib.h>
#include <stdbool.h>
#include <inttypes.h>
#include <stdio.h>
#include <string.h>
#if defined(_MSC_VER)
#undef HAVE_UNISTD_H
#endif
#include <zlib.h>
#include <errno.h>
#include <time.h>

#include <hdr/hdr_histogram.h>
#include <hdr/hdr_histogram_log.h>
#include "hdr_encoding.h"
#include "hdr_tests.h"

#if defined(_MSC_VER)
#include <intsafe.h>
typedef SSIZE_T ssize_t;
#pragma comment(lib, "ws2_32.lib")
#pragma warning(push)
#pragma warning(disable: 4996)
#endif

#include "hdr_endian.h"

#ifndef HDR_MALLOC_INCLUDE
#define HDR_MALLOC_INCLUDE "hdr_malloc.h"
#endif

#include HDR_MALLOC_INCLUDE

/* Private prototypes useful for the logger */
int32_t counts_index_for(const struct hdr_histogram* h, int64_t value);


#define FAIL_AND_CLEANUP(label, error_name, error) \
    do                      \
    {                       \
        error_name = error; \
        goto label;         \
    }                       \
    while (0)

/* ######## ##    ##  ######   #######  ########  #### ##    ##  ######   */
/* ##       ###   ## ##    ## ##     ## ##     ##  ##  ###   ## ##    ##  */
/* ##       ####  ## ##       ##     ## ##     ##  ##  ####  ## ##        */
/* ######   ## ## ## ##       ##     ## ##     ##  ##  ## ## ## ##   #### */
/* ##       ##  #### ##       ##     ## ##     ##  ##  ##  #### ##    ##  */
/* ##       ##   ### ##    ## ##     ## ##     ##  ##  ##   ### ##    ##  */
/* ######## ##    ##  ######   #######  ########  #### ##    ##  ######   */

static const uint32_t V0_ENCODING_COOKIE    = 0x1c849308;
static const uint32_t V0_COMPRESSION_COOKIE = 0x1c849309;

static const uint32_t V1_ENCODING_COOKIE    = 0x1c849301;
static const uint32_t V1_COMPRESSION_COOKIE = 0x1c849302;

static const uint32_t V2_ENCODING_COOKIE = 0x1c849303;
static const uint32_t V2_COMPRESSION_COOKIE = 0x1c849304;

static uint32_t get_cookie_base(uint32_t cookie)
{
    return (cookie & ~0xf0U);
}

static uint32_t word_size_from_cookie(uint32_t cookie)
{
    return (cookie & 0xf0U) >> 4U;
}

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

static void strm_init(z_stream* strm)
{
    memset(strm, 0, sizeof(z_stream));
}

union uint64_dbl_cvt
{
    uint64_t l;
    double d;
};

static double int64_bits_to_double(int64_t i)
{
    union uint64_dbl_cvt x;

    x.l = (uint64_t) i;
    return x.d;
}

static uint64_t double_to_int64_bits(double d)
{
    union uint64_dbl_cvt x;

    x.d = d;
    return x.l;
}

#pragma pack(push, 1)
typedef struct /*__attribute__((__packed__))*/
{
    uint32_t cookie;
    int32_t significant_figures;
    int64_t lowest_discernible_value;
    int64_t highest_trackable_value;
    int64_t total_count;
    int64_t counts[1];
} encoding_flyweight_v0_t;

typedef struct /*__attribute__((__packed__))*/
{
    uint32_t cookie;
    int32_t payload_len;
    int32_t normalizing_index_offset;
    int32_t significant_figures;
    int64_t lowest_discernible_value;
    int64_t highest_trackable_value;
    uint64_t conversion_ratio_bits;
    uint8_t counts[1];
} encoding_flyweight_v1_t;

typedef struct /*__attribute__((__packed__))*/
{
    uint32_t cookie;
    int32_t length;
    uint8_t data[1];
} compression_flyweight_t;
#pragma pack(pop)

#define SIZEOF_ENCODING_FLYWEIGHT_V0 (sizeof(encoding_flyweight_v0_t) - sizeof(int64_t))
#define SIZEOF_ENCODING_FLYWEIGHT_V1 (sizeof(encoding_flyweight_v1_t) - sizeof(uint8_t))
#define SIZEOF_COMPRESSION_FLYWEIGHT (sizeof(compression_flyweight_t) - sizeof(uint8_t))

int hdr_encode_compressed(
    struct hdr_histogram* h,
    uint8_t** compressed_histogram,
    size_t* compressed_len)
{
    encoding_flyweight_v1_t* encoded = NULL;
    compression_flyweight_t* compressed = NULL;
    int i;
    int result = 0;
    int data_index = 0;
    int32_t payload_len;
    uLong encoded_size;
    uLongf dest_len;
    size_t compressed_size;

    int32_t len_to_max = counts_index_for(h, h->max_value) + 1;
    int32_t counts_limit = len_to_max < h->counts_len ? len_to_max : h->counts_len;

    const size_t encoded_len = SIZEOF_ENCODING_FLYWEIGHT_V1 + MAX_BYTES_LEB128 * (size_t) counts_limit;
    if ((encoded = (encoding_flyweight_v1_t*) hdr_calloc(encoded_len, sizeof(uint8_t))) == NULL)
    {
        FAIL_AND_CLEANUP(cleanup, result, ENOMEM);
    }

    for (i = 0; i < counts_limit;)
    {
        int64_t value = h->counts[i];
        i++;

        if (value == 0)
        {
            int32_t zeros = 1;

            while (i < counts_limit && 0 == h->counts[i])
            {
                zeros++;
                i++;
            }

            data_index += zig_zag_encode_i64(&encoded->counts[data_index], -zeros);
        }
        else
        {
            data_index += zig_zag_encode_i64(&encoded->counts[data_index], value);
        }
    }

    payload_len = data_index;
    encoded_size = SIZEOF_ENCODING_FLYWEIGHT_V1 + data_index;

    encoded->cookie                   = htobe32(V2_ENCODING_COOKIE | 0x10U);
    encoded->payload_len              = htobe32(payload_len);
    encoded->normalizing_index_offset = htobe32(h->normalizing_index_offset);
    encoded->significant_figures      = htobe32(h->significant_figures);
    encoded->lowest_discernible_value   = htobe64(h->lowest_discernible_value);
    encoded->highest_trackable_value  = htobe64(h->highest_trackable_value);
    encoded->conversion_ratio_bits    = htobe64(double_to_int64_bits(h->conversion_ratio));


    /* Estimate the size of the compressed histogram. */
    dest_len = compressBound(encoded_size);
    compressed_size = SIZEOF_COMPRESSION_FLYWEIGHT + dest_len;

    if ((compressed = (compression_flyweight_t*) hdr_malloc(compressed_size)) == NULL)
    {
        FAIL_AND_CLEANUP(cleanup, result, ENOMEM);
    }

    if (Z_OK != compress(compressed->data, &dest_len, (Bytef*) encoded, encoded_size))
    {
        FAIL_AND_CLEANUP(cleanup, result, HDR_DEFLATE_FAIL);
    }

    compressed->cookie = htobe32(V2_COMPRESSION_COOKIE | 0x10U);
    compressed->length = htobe32((int32_t)dest_len);

    *compressed_histogram = (uint8_t*) compressed;
    *compressed_len = SIZEOF_COMPRESSION_FLYWEIGHT + dest_len;

    cleanup:
    hdr_free(encoded);
    if (result == HDR_DEFLATE_FAIL)
    {
        hdr_free(compressed);
    }

    return result;
}

/* ########  ########  ######   #######  ########  #### ##    ##  ######   */
/* ##     ## ##       ##    ## ##     ## ##     ##  ##  ###   ## ##    ##  */
/* ##     ## ##       ##       ##     ## ##     ##  ##  ####  ## ##        */
/* ##     ## ######   ##       ##     ## ##     ##  ##  ## ## ## ##   #### */
/* ##     ## ##       ##       ##     ## ##     ##  ##  ##  #### ##    ##  */
/* ##     ## ##       ##    ## ##     ## ##     ##  ##  ##   ### ##    ##  */
/* ########  ########  ######   #######  ########  #### ##    ##  ######   */

static void apply_to_counts_16(struct hdr_histogram* h, const int16_t* counts_data, const int32_t counts_limit)
{
    int i;
    for (i = 0; i < counts_limit; i++)
    {
        h->counts[i] = be16toh(counts_data[i]);
    }
}

static void apply_to_counts_32(struct hdr_histogram* h, const int32_t* counts_data, const int32_t counts_limit)
{
    int i;
    for (i = 0; i < counts_limit; i++)
    {
        h->counts[i] = be32toh(counts_data[i]);
    }
}

static void apply_to_counts_64(struct hdr_histogram* h, const int64_t* counts_data, const int32_t counts_limit)
{
    int i;
    for (i = 0; i < counts_limit; i++)
    {
        h->counts[i] = be64toh(counts_data[i]);
    }
}

static int apply_to_counts_zz(struct hdr_histogram* h, const uint8_t* counts_data, const int32_t data_limit)
{
    int64_t data_index = 0;
    int32_t counts_index = 0;
    int64_t value;

    while (data_index < data_limit && counts_index < h->counts_len)
    {
        data_index += zig_zag_decode_i64(&counts_data[data_index], &value);

        if (value < 0)
        {
            int64_t zeros = -value;

            if (value <= INT32_MIN || counts_index + zeros > h->counts_len)
            {
                return HDR_TRAILING_ZEROS_INVALID;
            }

            counts_index += (int32_t) zeros;
        }
        else
        {
            h->counts[counts_index] = value;
            counts_index++;
        }
    }

    if (data_index > data_limit)
    {
        return HDR_VALUE_TRUNCATED;
    }
    else if (data_index < data_limit)
    {
        return HDR_ENCODED_INPUT_TOO_LONG;
    }

    return 0;
}

static int apply_to_counts(
    struct hdr_histogram* h, const int32_t word_size, const uint8_t* counts_data, const int32_t counts_limit)
{
    switch (word_size)
    {
        case 2:
            apply_to_counts_16(h, (const int16_t*) counts_data, counts_limit);
            return 0;

        case 4:
            apply_to_counts_32(h, (const int32_t*) counts_data, counts_limit);
            return 0;

        case 8:
            apply_to_counts_64(h, (const int64_t*) counts_data, counts_limit);
            return 0;

        case 1:
            return apply_to_counts_zz(h, counts_data, counts_limit);

        default:
            return -1;
    }
}

static int hdr_decode_compressed_v0(
    compression_flyweight_t* compression_flyweight,
    size_t length,
    struct hdr_histogram** histogram)
{
    struct hdr_histogram* h = NULL;
    int result = 0;
    uint8_t* counts_array = NULL;
    encoding_flyweight_v0_t encoding_flyweight;
    z_stream strm;
    uint32_t encoding_cookie;
    int32_t compressed_len, word_size, significant_figures, counts_array_len;
    int64_t lowest_discernible_value, highest_trackable_value;

    strm_init(&strm);
    if (inflateInit(&strm) != Z_OK)
    {
        FAIL_AND_CLEANUP(cleanup, result, HDR_INFLATE_FAIL);
    }

    compressed_len = be32toh(compression_flyweight->length);

    if (compressed_len < 0 || (length - SIZEOF_COMPRESSION_FLYWEIGHT) < (size_t)compressed_len)
    {
        FAIL_AND_CLEANUP(cleanup, result, EINVAL);
    }

    strm.next_in = compression_flyweight->data;
    strm.avail_in = (uInt) compressed_len;
    strm.next_out = (uint8_t *) &encoding_flyweight;
    strm.avail_out = SIZEOF_ENCODING_FLYWEIGHT_V0;

    if (inflate(&strm, Z_SYNC_FLUSH) != Z_OK)
    {
        FAIL_AND_CLEANUP(cleanup, result, HDR_INFLATE_FAIL);
    }

    encoding_cookie = get_cookie_base(be32toh(encoding_flyweight.cookie));
    if (V0_ENCODING_COOKIE != encoding_cookie)
    {
        FAIL_AND_CLEANUP(cleanup, result, HDR_ENCODING_COOKIE_MISMATCH);
    }

    word_size = word_size_from_cookie(be32toh(encoding_flyweight.cookie));
    lowest_discernible_value = be64toh(encoding_flyweight.lowest_discernible_value);
    highest_trackable_value = be64toh(encoding_flyweight.highest_trackable_value);
    significant_figures = be32toh(encoding_flyweight.significant_figures);

    if (hdr_init(
        lowest_discernible_value,
        highest_trackable_value,
        significant_figures,
        &h) != 0)
    {
        FAIL_AND_CLEANUP(cleanup, result, ENOMEM);
    }

    counts_array_len = h->counts_len * word_size;
    if ((counts_array = (uint8_t*) hdr_calloc(1, (size_t) counts_array_len)) == NULL)
    {
        FAIL_AND_CLEANUP(cleanup, result, ENOMEM);
    }

    strm.next_out = counts_array;
    strm.avail_out = (uInt) counts_array_len;

    if (inflate(&strm, Z_FINISH) != Z_STREAM_END)
    {
        FAIL_AND_CLEANUP(cleanup, result, HDR_INFLATE_FAIL);
    }

    apply_to_counts(h, word_size, counts_array, h->counts_len);

    hdr_reset_internal_counters(h);
    h->normalizing_index_offset = 0;
    h->conversion_ratio = 1.0;

cleanup:
    (void)inflateEnd(&strm);
    hdr_free(counts_array);

    if (result != 0)
    {
        hdr_free(h);
    }
    else if (NULL == *histogram)
    {
        *histogram = h;
    }
    else
    {
        hdr_add(*histogram, h);
        hdr_free(h);
    }

    return result;
}

static int hdr_decode_compressed_v1(
    compression_flyweight_t* compression_flyweight,
    size_t length,
    struct hdr_histogram** histogram)
{
    struct hdr_histogram* h = NULL;
    int result = 0;
    uint8_t* counts_array = NULL;
    encoding_flyweight_v1_t encoding_flyweight;
    z_stream strm;
    uint32_t encoding_cookie;
    int32_t compressed_length, word_size, significant_figures, counts_limit, counts_array_len;
    int64_t lowest_discernible_value, highest_trackable_value;

    strm_init(&strm);
    if (inflateInit(&strm) != Z_OK)
    {
        FAIL_AND_CLEANUP(cleanup, result, HDR_INFLATE_FAIL);
    }

    compressed_length = be32toh(compression_flyweight->length);

    if (compressed_length < 0 || length - SIZEOF_COMPRESSION_FLYWEIGHT < (size_t)compressed_length)
    {
        FAIL_AND_CLEANUP(cleanup, result, EINVAL);
    }

    strm.next_in = compression_flyweight->data;
    strm.avail_in = (uInt) compressed_length;
    strm.next_out = (uint8_t *) &encoding_flyweight;
    strm.avail_out = SIZEOF_ENCODING_FLYWEIGHT_V1;

    if (inflate(&strm, Z_SYNC_FLUSH) != Z_OK)
    {
        FAIL_AND_CLEANUP(cleanup, result, HDR_INFLATE_FAIL);
    }

    encoding_cookie = get_cookie_base(be32toh(encoding_flyweight.cookie));
    if (V1_ENCODING_COOKIE != encoding_cookie)
    {
        FAIL_AND_CLEANUP(cleanup, result, HDR_ENCODING_COOKIE_MISMATCH);
    }

    word_size = word_size_from_cookie(be32toh(encoding_flyweight.cookie));
    counts_limit = be32toh(encoding_flyweight.payload_len) / word_size;
    lowest_discernible_value = be64toh(encoding_flyweight.lowest_discernible_value);
    highest_trackable_value = be64toh(encoding_flyweight.highest_trackable_value);
    significant_figures = be32toh(encoding_flyweight.significant_figures);

    if (hdr_init(
        lowest_discernible_value,
        highest_trackable_value,
        significant_figures,
        &h) != 0)
    {
        FAIL_AND_CLEANUP(cleanup, result, ENOMEM);
    }

    /* Give the temp uncompressed array a little bif of extra */
    counts_array_len = counts_limit * word_size;

    if ((counts_array = (uint8_t*) hdr_calloc(1, (size_t) counts_array_len)) == NULL)
    {
        FAIL_AND_CLEANUP(cleanup, result, ENOMEM);
    }

    strm.next_out = counts_array;
    strm.avail_out = (uInt) counts_array_len;

    if (inflate(&strm, Z_FINISH) != Z_STREAM_END)
    {
        FAIL_AND_CLEANUP(cleanup, result, HDR_INFLATE_FAIL);
    }

    apply_to_counts(h, word_size, counts_array, counts_limit);

    h->normalizing_index_offset = be32toh(encoding_flyweight.normalizing_index_offset);
    h->conversion_ratio = int64_bits_to_double(be64toh(encoding_flyweight.conversion_ratio_bits));
    hdr_reset_internal_counters(h);

cleanup:
    (void)inflateEnd(&strm);
    hdr_free(counts_array);

    if (result != 0)
    {
        hdr_free(h);
    }
    else if (NULL == *histogram)
    {
        *histogram = h;
    }
    else
    {
        hdr_add(*histogram, h);
        hdr_free(h);
    }

    return result;
}

static int hdr_decode_compressed_v2(
    compression_flyweight_t* compression_flyweight,
    size_t length,
    struct hdr_histogram** histogram)
{
    struct hdr_histogram* h = NULL;
    int result = 0;
    int rc = 0;
    uint8_t* counts_array = NULL;
    encoding_flyweight_v1_t encoding_flyweight;
    z_stream strm;
    uint32_t encoding_cookie;
    int32_t compressed_length, counts_limit, significant_figures;
    int64_t lowest_discernible_value, highest_trackable_value;

    strm_init(&strm);
    if (inflateInit(&strm) != Z_OK)
    {
        FAIL_AND_CLEANUP(cleanup, result, HDR_INFLATE_FAIL);
    }

    compressed_length = be32toh(compression_flyweight->length);

    if (compressed_length < 0 || length - SIZEOF_COMPRESSION_FLYWEIGHT < (size_t)compressed_length)
    {
        FAIL_AND_CLEANUP(cleanup, result, EINVAL);
    }

    strm.next_in = compression_flyweight->data;
    strm.avail_in = (uInt) compressed_length;
    strm.next_out = (uint8_t *) &encoding_flyweight;
    strm.avail_out = SIZEOF_ENCODING_FLYWEIGHT_V1;

    if (inflate(&strm, Z_SYNC_FLUSH) != Z_OK)
    {
        FAIL_AND_CLEANUP(cleanup, result, HDR_INFLATE_FAIL);
    }

    encoding_cookie = get_cookie_base(be32toh(encoding_flyweight.cookie));
    if (V2_ENCODING_COOKIE != encoding_cookie)
    {
        FAIL_AND_CLEANUP(cleanup, result, HDR_ENCODING_COOKIE_MISMATCH);
    }

    counts_limit = be32toh(encoding_flyweight.payload_len);
    lowest_discernible_value = be64toh(encoding_flyweight.lowest_discernible_value);
    highest_trackable_value = be64toh(encoding_flyweight.highest_trackable_value);
    significant_figures = be32toh(encoding_flyweight.significant_figures);

    rc = hdr_init(lowest_discernible_value, highest_trackable_value, significant_figures, &h);
    if (rc)
    {
        FAIL_AND_CLEANUP(cleanup, result, rc);
    }

    /* Make sure there at least 9 bytes to read */
    /* if there is a corrupt value at the end */
    /* of the array we won't read corrupt data or crash. */
    if ((counts_array = (uint8_t*) hdr_calloc(1, (size_t) counts_limit + 9)) == NULL)
    {
        FAIL_AND_CLEANUP(cleanup, result, ENOMEM);
    }

    strm.next_out = counts_array;
    strm.avail_out = (uInt) counts_limit;

    if (inflate(&strm, Z_FINISH) != Z_STREAM_END)
    {
        FAIL_AND_CLEANUP(cleanup, result, HDR_INFLATE_FAIL);
    }

    rc = apply_to_counts_zz(h, counts_array, counts_limit);
    if (rc)
    {
        FAIL_AND_CLEANUP(cleanup, result, rc);
    }

    h->normalizing_index_offset = be32toh(encoding_flyweight.normalizing_index_offset);
    h->conversion_ratio = int64_bits_to_double(be64toh(encoding_flyweight.conversion_ratio_bits));
    hdr_reset_internal_counters(h);

cleanup:
    (void)inflateEnd(&strm);
    hdr_free(counts_array);

    if (result != 0)
    {
        hdr_free(h);
    }
    else if (NULL == *histogram)
    {
        *histogram = h;
    }
    else
    {
        hdr_add(*histogram, h);
        hdr_free(h);
    }

    return result;
}

int hdr_decode_compressed(
    uint8_t* buffer, size_t length, struct hdr_histogram** histogram)
{
    uint32_t compression_cookie;
    compression_flyweight_t* compression_flyweight;

    if (length < SIZEOF_COMPRESSION_FLYWEIGHT)
    {
        return EINVAL;
    }

    compression_flyweight = (compression_flyweight_t*) buffer;

    compression_cookie = get_cookie_base(be32toh(compression_flyweight->cookie));
    if (V0_COMPRESSION_COOKIE == compression_cookie)
    {
        return hdr_decode_compressed_v0(compression_flyweight, length, histogram);
    }
    else if (V1_COMPRESSION_COOKIE == compression_cookie)
    {
        return hdr_decode_compressed_v1(compression_flyweight, length, histogram);
    }
    else if (V2_COMPRESSION_COOKIE == compression_cookie)
    {
        return hdr_decode_compressed_v2(compression_flyweight, length, histogram);
    }

    return HDR_COMPRESSION_COOKIE_MISMATCH;
}

/* ##      ## ########  #### ######## ######## ########  */
/* ##  ##  ## ##     ##  ##     ##    ##       ##     ## */
/* ##  ##  ## ##     ##  ##     ##    ##       ##     ## */
/* ##  ##  ## ########   ##     ##    ######   ########  */
/* ##  ##  ## ##   ##    ##     ##    ##       ##   ##   */
/* ##  ##  ## ##    ##   ##     ##    ##       ##    ##  */
/*  ###  ###  ##     ## ####    ##    ######## ##     ## */

int hdr_log_writer_init(struct hdr_log_writer* writer)
{
    (void)writer;
    return 0;
}

#define LOG_VERSION "1.2"
#define LOG_MAJOR_VERSION 1

static int print_user_prefix(FILE* f, const char* prefix)
{
    if (!prefix)
    {
        return 0;
    }

    return fprintf(f, "#[%s]\n", prefix);
}

static int print_version(FILE* f, const char* version)
{
    return fprintf(f, "#[Histogram log format version %s]\n", version);
}

static int print_time(FILE* f, hdr_timespec* timestamp)
{
    char time_str[128];
    struct tm date_time;

    if (!timestamp)
    {
        return 0;
    }

#if defined(__WINDOWS__)
    _gmtime32_s(&date_time, &timestamp->tv_sec);
#else
    gmtime_r(&timestamp->tv_sec, &date_time);
#endif

    strftime(time_str, 128, "%a %b %X %Z %Y", &date_time);

    return fprintf(
        f, "#[StartTime: %.3f (seconds since epoch), %s]\n",
        hdr_timespec_as_double(timestamp), time_str);
}

static int print_header(FILE* f)
{
    return fprintf(f, "\"StartTimestamp\",\"EndTimestamp\",\"Interval_Max\",\"Interval_Compressed_Histogram\"\n");
}

/* Example log                                                                       */
/* #[Logged with jHiccup version 2.0.3-SNAPSHOT]                                     */
/* #[Histogram log format version 1.01]                                              */
/* #[StartTime: 1403476110.183 (seconds since epoch), Mon Jun 23 10:28:30 NZST 2014] */
/* "StartTimestamp","EndTimestamp","Interval_Max","Interval_Compressed_Histogram"    */
int hdr_log_write_header(
    struct hdr_log_writer* writer, FILE* file,
    const char* user_prefix, hdr_timespec* timestamp)
{
    (void)writer;

    if (print_user_prefix(file, user_prefix) < 0)
    {
        return EIO;
    }
    if (print_version(file, LOG_VERSION) < 0)
    {
        return EIO;
    }
    if (print_time(file, timestamp) < 0)
    {
        return EIO;
    }
    if (print_header(file) < 0)
    {
        return EIO;
    }

    return 0;
}

int hdr_log_write(
    struct hdr_log_writer* writer,
    FILE* file,
    const hdr_timespec* start_timestamp,
    const hdr_timespec* end_timestamp,
    struct hdr_histogram* histogram)
{
    uint8_t* compressed_histogram = NULL;
    size_t compressed_len = 0;
    char* encoded_histogram = NULL;
    int rc = 0;
    int result = 0;
    size_t encoded_len;

    (void)writer;

    rc = hdr_encode_compressed(histogram, &compressed_histogram, &compressed_len);
    if (rc != 0)
    {
        FAIL_AND_CLEANUP(cleanup, result, rc);
    }

    encoded_len = hdr_base64_encoded_len(compressed_len);
    encoded_histogram = (char*) hdr_calloc(encoded_len + 1, sizeof(char));

    rc = hdr_base64_encode(
        compressed_histogram, compressed_len, encoded_histogram, encoded_len);
    if (rc != 0)
    {
        FAIL_AND_CLEANUP(cleanup, result, rc);
    }

    if (fprintf(
        file, "%.3f,%.3f,%" PRIu64 ".0,%s\n",
        hdr_timespec_as_double(start_timestamp),
        hdr_timespec_as_double(end_timestamp),
        hdr_max(histogram),
        encoded_histogram) < 0)
    {
        result = EIO;
    }

cleanup:
    hdr_free(compressed_histogram);
    hdr_free(encoded_histogram);

    return result;
}

int hdr_log_write_entry(
    struct hdr_log_writer* writer,
    FILE* file,
    struct hdr_log_entry* entry,
    struct hdr_histogram* histogram)
{
    uint8_t* compressed_histogram = NULL;
    size_t compressed_len = 0;
    char* encoded_histogram = NULL;
    int rc = 0;
    int result = 0;
    size_t encoded_len;
    int has_tag = 0;
    const char* tag_prefix;
    const char* tag_value;
    const char* tag_separator;

    (void)writer;

    rc = hdr_encode_compressed(histogram, &compressed_histogram, &compressed_len);
    if (rc != 0)
    {
        FAIL_AND_CLEANUP(cleanup, result, rc);
    }

    encoded_len = hdr_base64_encoded_len(compressed_len);
    encoded_histogram = (char*) hdr_calloc(encoded_len + 1, sizeof(char));

    rc = hdr_base64_encode(
        compressed_histogram, compressed_len, encoded_histogram, encoded_len);
    if (rc != 0)
    {
        FAIL_AND_CLEANUP(cleanup, result, rc);
    }

    has_tag = NULL != entry->tag && 0 < entry->tag_len;
    tag_prefix = has_tag ? "Tag=" : "";
    tag_value = has_tag ? entry->tag : "";
    tag_separator = has_tag ? "," : "";

    if (fprintf(
        file, "%s%.*s%s%.3f,%.3f,%" PRIu64 ".0,%s\n",
        tag_prefix, (int) entry->tag_len, tag_value, tag_separator,
        hdr_timespec_as_double(&entry->start_timestamp),
        hdr_timespec_as_double(&entry->interval),
        hdr_max(histogram),
        encoded_histogram) < 0)
    {
        result = EIO;
    }

    cleanup:
    hdr_free(compressed_histogram);
    hdr_free(encoded_histogram);

    return result;
}

/* ########  ########    ###    ########  ######## ########  */
/* ##     ## ##         ## ##   ##     ## ##       ##     ## */
/* ##     ## ##        ##   ##  ##     ## ##       ##     ## */
/* ########  ######   ##     ## ##     ## ######   ########  */
/* ##   ##   ##       ######### ##     ## ##       ##   ##   */
/* ##    ##  ##       ##     ## ##     ## ##       ##    ##  */
/* ##     ## ######## ##     ## ########  ######## ##     ## */

int hdr_log_reader_init(struct hdr_log_reader* reader)
{
    reader->major_version = 0;
    reader->minor_version = 0;
    reader->start_timestamp.tv_sec = 0;
    reader->start_timestamp.tv_nsec = 0;

    return 0;
}

static void scan_log_format(struct hdr_log_reader* reader, const char* line)
{
    const char* format = "#[Histogram log format version %d.%d]";
    sscanf(line, format, &reader->major_version, &reader->minor_version);
}

static void scan_start_time(struct hdr_log_reader* reader, const char* line)
{
    const char* format = "#[StartTime: %lf [^\n]";
    double timestamp = 0.0;

    if (sscanf(line, format, &timestamp) == 1)
    {
        hdr_timespec_from_double(&reader->start_timestamp, timestamp);
    }
}

static void scan_header_line(struct hdr_log_reader* reader, const char* line)
{
    scan_log_format(reader, line);
    scan_start_time(reader, line);
}

static bool validate_log_version(struct hdr_log_reader* reader)
{
    return reader->major_version == LOG_MAJOR_VERSION &&
        (reader->minor_version == 0 || reader->minor_version == 1 ||
            reader->minor_version == 2 || reader->minor_version == 3);
}

#define HEADER_LINE_LENGTH 128

int hdr_log_read_header(struct hdr_log_reader* reader, FILE* file)
{
    char line[HEADER_LINE_LENGTH]; /* TODO: check for overflow. */

    bool parsing_header = true;

    do
    {
        int c = fgetc(file);
        ungetc(c, file);

        switch (c)
        {

        case '#':
            if (fgets(line, HEADER_LINE_LENGTH, file) == NULL)
            {
                return EIO;
            }

            scan_header_line(reader, line);
            break;

        case '"':
            if (fgets(line, HEADER_LINE_LENGTH, file) == NULL)
            {
                return EIO;
            }

            parsing_header = false;
            break;

        default:
            parsing_header = false;
        }
    }
    while (parsing_header);

    if (!validate_log_version(reader))
    {
        return HDR_LOG_INVALID_VERSION;
    }

    return 0;
}

int hdr_log_read(
    struct hdr_log_reader* reader, FILE* file, struct hdr_histogram** histogram,
    hdr_timespec* timestamp, hdr_timespec* interval)
{
    int result;
    struct hdr_log_entry log_entry;
    memset(&log_entry, 0, sizeof(log_entry));

    result = hdr_log_read_entry(reader, file, &log_entry, histogram);

    if (0 == result)
    {
        if (NULL != timestamp)
        {
            memcpy(timestamp, &log_entry.start_timestamp, sizeof(*timestamp));
        }
        if (NULL != interval)
        {
            memcpy(interval, &log_entry.interval, sizeof(*interval));
        }
    }

    return result;
}

static int read_ahead(FILE* f, const char* prefix, size_t prefix_len)
{
    size_t i;
    for (i = 0; i < prefix_len; i++)
    {
        if (prefix[i] != fgetc(f))
        {
            return 0;
        }
    }

    return 1;
}

static int read_ahead_timestamp(FILE* f, hdr_timespec* timestamp, char expected_terminator)
{
    int c;
    int is_seconds = 1;
    long sec = 0;
    long nsec = 0;
    long nsec_multipler = 1000000000;

    while (EOF != (c = fgetc(f)))
    {
        if (expected_terminator == c)
        {
            timestamp->tv_sec = sec;
            timestamp->tv_nsec = (nsec * nsec_multipler);
            return 1;
        }
        else if ('.' == c)
        {
            is_seconds = 0;
        }
        else if ('0' <= c && c <= '9')
        {
            if (is_seconds)
            {
                sec = (sec * 10) + (c - '0');
            }
            else
            {
                nsec = (nsec * 10) + (c - '0');
                nsec_multipler /= 10;
            }
        }
        else
        {
            return 0;
        }
    }

    return 0;
}

enum parse_log_state {
    INIT, TAG, BEGIN_TIMESTAMP, INTERVAL, MAX, HISTOGRAM, DONE
};

int hdr_log_read_entry(
    struct hdr_log_reader* reader, FILE* file, struct hdr_log_entry *entry, struct hdr_histogram** histogram)
{
    enum parse_log_state state = INIT;
    size_t capacity = 1024;
    size_t base64_len = 0;
    size_t tag_offset = 0;
    char* base64_histogram = hdr_calloc(capacity, sizeof(char));
    size_t compressed_len = 0;
    uint8_t* compressed_histogram = NULL;
    int result = -EINVAL;

    (void)reader;

    if (NULL == entry)
    {
        return -EINVAL;
    }

    do
    {
        int c;

        switch (state)
        {
            case INIT:
                c = fgetc(file);
                if ('T' == c)
                {
                    if (read_ahead(file, "ag=", 3))
                    {
                        state = TAG;
                    }
                    else
                    {
                        FAIL_AND_CLEANUP(cleanup, result, -EINVAL);
                    }
                }
                else if ('0' <= c && c <= '9')
                {
                    ungetc(c, file);
                    state = BEGIN_TIMESTAMP;
                }
                else if ('\r' == c || '\n' == c)
                {
                    /* Skip over trailing/preceding new lines. */
                }
                else if (EOF == c)
                {
                    FAIL_AND_CLEANUP(cleanup, result, EOF);
                }
                else
                {
                    FAIL_AND_CLEANUP(cleanup, result, -EINVAL);
                }
                break;
            case TAG:
                c = fgetc(file);
                if (',' == c)
                {
                    if (NULL != entry->tag && tag_offset < entry->tag_len)
                    {
                        entry->tag[tag_offset] = '\0';
                    }
                    state = BEGIN_TIMESTAMP;
                }
                else if ('\r' == c || '\n' == c || EOF == c)
                {
                    FAIL_AND_CLEANUP(cleanup, result, -EINVAL);
                }
                else
                {
                    if (NULL != entry->tag && tag_offset < entry->tag_len)
                    {
                        entry->tag[tag_offset] = (char) c;
                        tag_offset++;
                    }
                }
                break;
            case BEGIN_TIMESTAMP:
                if (read_ahead_timestamp(file, &entry->start_timestamp, ','))
                {
                    state = INTERVAL;
                }
                else
                {
                    FAIL_AND_CLEANUP(cleanup, result, -EINVAL);
                }
                break;
            case INTERVAL:
                if (read_ahead_timestamp(file, &entry->interval, ','))
                {
                    state = MAX;
                }
                else
                {
                    FAIL_AND_CLEANUP(cleanup, result, -EINVAL);
                }
                break;
            case MAX:
                if (read_ahead_timestamp(file, &entry->max, ','))
                {
                    state = HISTOGRAM;
                }
                else
                {
                    FAIL_AND_CLEANUP(cleanup, result, -EINVAL);
                }
                break;
            case HISTOGRAM:
                c = fgetc(file);
                if (c != '\r' && c != '\n' && c != EOF)
                {
                    if (base64_len == capacity)
                    {
                        capacity *= 2;
                        base64_histogram = hdr_realloc(base64_histogram, capacity * sizeof(char));
                        if (NULL == base64_histogram)
                        {
                            FAIL_AND_CLEANUP(cleanup, result, -ENOMEM);
                        }
                    }
                    base64_histogram[base64_len++] = (char) c;
                }
                else
                {
                    state = DONE;
                }
                break;

            default:
                FAIL_AND_CLEANUP(cleanup, result, -EINVAL);
        }
    }
    while (DONE != state);

    compressed_histogram = hdr_calloc(base64_len, sizeof(uint8_t));
    compressed_len = hdr_base64_decoded_len(base64_len);

    result = hdr_base64_decode(
        base64_histogram, base64_len, compressed_histogram, compressed_len);
    if (result != 0)
    {
        goto cleanup;
    }

    result = hdr_decode_compressed(compressed_histogram, compressed_len, histogram);

cleanup:
    hdr_free(base64_histogram);
    hdr_free(compressed_histogram);
    return result;
}


int hdr_log_encode(struct hdr_histogram* histogram, char** encoded_histogram)
{
    char *encoded_histogram_tmp = NULL;
    uint8_t* compressed_histogram = NULL;
    size_t compressed_len = 0;
    int rc = 0;
    int result = 0;
    size_t encoded_len;

    rc = hdr_encode_compressed(histogram, &compressed_histogram, &compressed_len);
    if (rc != 0)
    {
        FAIL_AND_CLEANUP(cleanup, result, rc);
    }

    encoded_len = hdr_base64_encoded_len(compressed_len);
    encoded_histogram_tmp = (char*) hdr_calloc(encoded_len + 1, sizeof(char));

    rc = hdr_base64_encode(
        compressed_histogram, compressed_len, encoded_histogram_tmp, encoded_len);
    if (rc != 0)
    {
        hdr_free(encoded_histogram_tmp);
        FAIL_AND_CLEANUP(cleanup, result, rc);
    }

    *encoded_histogram = encoded_histogram_tmp;

cleanup:
    hdr_free(compressed_histogram);

    return result;
}

int hdr_log_decode(struct hdr_histogram** histogram, char* base64_histogram, size_t base64_len)
{
    int r;
    uint8_t* compressed_histogram = NULL;
    int result = 0;

    size_t compressed_len = hdr_base64_decoded_len(base64_len);
    compressed_histogram = (uint8_t*) hdr_malloc(sizeof(uint8_t)*compressed_len);
    memset(compressed_histogram, 0, compressed_len);

    r = hdr_base64_decode(
        base64_histogram, base64_len, compressed_histogram, compressed_len);

    if (r != 0)
    {
        FAIL_AND_CLEANUP(cleanup, result, r);
    }

    r = hdr_decode_compressed(compressed_histogram, compressed_len, histogram);
    if (r != 0)
    {
        FAIL_AND_CLEANUP(cleanup, result, r);
    }

cleanup:
    hdr_free(compressed_histogram);

    return result;
}

#if defined(_MSC_VER)
#pragma warning(pop)
#endif
