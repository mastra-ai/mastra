/**
 * hdr_histogram_log.h
 * Written by Michael Barker and released to the public domain,
 * as explained at http://creativecommons.org/publicdomain/zero/1.0/
 *
 * The implementation makes use of zlib to provide compression.  You will need
 * to link against -lz in order to link applications that include this header.
 */

#ifndef HDR_HISTOGRAM_H_LOG
#define HDR_HISTOGRAM_H_LOG 1

#define HDR_COMPRESSION_COOKIE_MISMATCH -29999
#define HDR_ENCODING_COOKIE_MISMATCH -29998
#define HDR_DEFLATE_INIT_FAIL -29997
#define HDR_DEFLATE_FAIL -29996
#define HDR_INFLATE_INIT_FAIL -29995
#define HDR_INFLATE_FAIL -29994
#define HDR_LOG_INVALID_VERSION -29993
#define HDR_TRAILING_ZEROS_INVALID -29992
#define HDR_VALUE_TRUNCATED -29991
#define HDR_ENCODED_INPUT_TOO_LONG -29990

#define HDR_LOG_TAG_MAX_BUFFER_LEN (1024)

#include <stdint.h>
#include <stdbool.h>
#include <stdio.h>

#include <hdr/hdr_time.h>
#include <hdr/hdr_histogram.h>

#ifdef __cplusplus
extern "C" {
#endif

/**
 * Encode and compress the histogram with gzip.
 */
int hdr_log_encode(struct hdr_histogram* histogram, char** encoded_histogram);

/**
 * Decode and decompress the histogram with gzip.
 */
int hdr_log_decode(struct hdr_histogram** histogram, char* base64_histogram, size_t base64_len);

struct hdr_log_entry
{
    hdr_timespec start_timestamp;
    hdr_timespec interval;
    hdr_timespec max;
    char *tag;
    size_t tag_len;
};

struct hdr_log_writer
{
    uint32_t nonce;
};

/**
 * Initialise the log writer.
 *
 * @param writer 'This' pointer
 * @return 0 on success.
 */
int hdr_log_writer_init(struct hdr_log_writer* writer);

/**
 * Write the header to the log, this will constist of a user defined string,
 * the current timestamp, version information and the CSV header.
 *
 * @param writer 'This' pointer
 * @param file The stream to output the log header to.
 * @param user_prefix User defined string to include in the header.
 * @param timestamp The start time that the histogram started recording from.
 * @return Will return 0 if it successfully completed or an error number if there
 * was a failure.  EIO if the write failed.
 */
int hdr_log_write_header(
    struct hdr_log_writer* writer,
    FILE* file,
    const char* user_prefix,
    hdr_timespec* timestamp);

/**
 * Write an hdr_histogram entry to the log.  It will be encoded in a similar
 * fashion to the approach used by the Java version of the HdrHistogram.  It will
 * be a CSV line consisting of <start timestamp>,<end timestamp>,<max>,<histogram>
 * where <histogram> is the binary histogram gzip compressed and base64 encoded.
 *
 * Timestamp is a bit of misnomer for the start_timestamp and end_timestamp values
 * these could be offsets, e.g. start_timestamp could be offset from process start
 * time and end_timestamp could actually be the length of the recorded interval.
 *
 * @param writer 'This' pointer
 * @param file The stream to write the entry to.
 * @param start_timestamp The start timestamp to include in the logged entry.
 * @param end_timestamp The end timestamp to include in the logged entry.
 * @param histogram The histogram to encode and log.
 * @return Will return 0 if it successfully completed or an error number if there
 * was a failure.  Errors include HDR_DEFLATE_INIT_FAIL, HDR_DEFLATE_FAIL if
 * something when wrong during gzip compression.  ENOMEM if we failed to allocate
 * or reallocate the buffer used for encoding (out of memory problem).  EIO if
 * write failed.
 */
int hdr_log_write(
    struct hdr_log_writer* writer,
    FILE* file,
    const hdr_timespec* start_timestamp,
    const hdr_timespec* end_timestamp,
    struct hdr_histogram* histogram);

/**
 * Write an hdr_histogram entry to the log.  It will be encoded in a similar
 * fashion to the approach used by the Java version of the HdrHistogram.  It will
 * be a CSV line consisting of [Tag=XXX,]<start timestamp>,<end timestamp>,<max>,<histogram>
 * where <histogram> is the binary histogram gzip compressed and base64 encoded.
 *
 * The tag is option and will only be written if the tag is non-NULL and the tag_len is
 * greater than 0.
 *
 * Timestamp is a bit of misnomer for the start_timestamp and end_timestamp values
 * these could be offsets, e.g. start_timestamp could be offset from process start
 * time and end_timestamp could actually be the length of the recorded interval.
 *
 * @param writer 'This' pointer
 * @param file The stream to write the entry to.
 * @param entry Prefix information for the log line, including timestamps and tag.
 * @param histogram The histogram to encode and log.
 * @return Will return 0 if it successfully completed or an error number if there
 * was a failure.  Errors include HDR_DEFLATE_INIT_FAIL, HDR_DEFLATE_FAIL if
 * something when wrong during gzip compression.  ENOMEM if we failed to allocate
 * or reallocate the buffer used for encoding (out of memory problem).  EIO if
 * write failed.
 */
int hdr_log_write_entry(
    struct hdr_log_writer* writer,
    FILE* file,
    struct hdr_log_entry* entry,
    struct hdr_histogram* histogram);

struct hdr_log_reader
{
    int major_version;
    int minor_version;
    hdr_timespec start_timestamp;
};

/**
 * Initialise the log reader.
 *
 * @param reader 'This' pointer
 * @return 0 on success
 */
int hdr_log_reader_init(struct hdr_log_reader* reader);

/**
 * Reads the the header information from the log.  Will capure information
 * such as version number and start timestamp from the header.
 *
 * @param hdr_log_reader 'This' pointer
 * @param file The data stream to read from.
 * @return 0 on success.  An error number on failure.
 */
int hdr_log_read_header(struct hdr_log_reader* reader, FILE* file);

/**
 * Reads an entry from the log filling in the specified histogram, timestamp and
 * interval values.  If the supplied pointer to the histogram for this method is
 * NULL then a new histogram will be allocated for the caller, however it will
 * become the callers responsibility to free it later.  If the pointer is non-null
 * the histogram read from the log will be merged with the supplied histogram.
 *
 * @param reader 'This' pointer
 * @param file The stream to read the histogram from.
 * @param histogram Pointer to allocate a histogram to or merge into.
 * @param timestamp The first timestamp from the CSV entry.
 * @param interval The second timestamp from the CSV entry
 * @return Will return 0 on success or an error number if there was some wrong
 * when reading in the histogram.  EOF (-1) will indicate that there are no more
 * histograms left to be read from 'file'.
 * HDR_INFLATE_INIT_FAIL or HDR_INFLATE_FAIL if
 * there was a problem with Gzip.  HDR_COMPRESSION_COOKIE_MISMATCH or
 * HDR_ENCODING_COOKIE_MISMATCH if the cookie values are incorrect.
 * HDR_LOG_INVALID_VERSION if the log can not be parsed.  ENOMEM if buffer space
 * or the histogram can not be allocated.  EIO if there was an error during
 * the read.  EINVAL in any input values are incorrect.
 */
int hdr_log_read(
    struct hdr_log_reader* reader, FILE* file, struct hdr_histogram** histogram,
    hdr_timespec* timestamp, hdr_timespec* interval);

/**
 * Reads an entry from the log filling in the specified histogram and log entry struct.
 * If the supplied pointer to the histogram for this method is
 * NULL then a new histogram will be allocated for the caller, however it will
 * become the callers responsibility to free it later.  If the pointer is non-null
 * the histogram read from the log will be merged with the supplied histogram.
 * The entry struct contains a pointer to a buffer to load the tag into.  If this
 * is NULL or the tag_len is 0 then it won't store the tag there.  The tag value will be
 * NULL-terminated if there available space in the supplied buffer.  If the tag is larger
 * than the supplied buffer then it will be truncated.  If the caller sets the last element
 * in the buffer to '\0' before calling this function and it is not '\0' after the function
 * returns then the value has been truncated.
 *
 * @param reader 'This' pointer
 * @param file The stream to read the histogram from.
 * @param entry Contains all of the information from the log line that is not the histogram.
 * @param histogram Pointer to allocate a histogram to or merge into.
 * @return Will return 0 on success or an error number if there was some wrong
 * when reading in the histogram.  EOF (-1) will indicate that there are no more
 * histograms left to be read from 'file'.
 * HDR_INFLATE_INIT_FAIL or HDR_INFLATE_FAIL if
 * there was a problem with Gzip.  HDR_COMPRESSION_COOKIE_MISMATCH or
 * HDR_ENCODING_COOKIE_MISMATCH if the cookie values are incorrect.
 * HDR_LOG_INVALID_VERSION if the log can not be parsed.  ENOMEM if buffer space
 * or the histogram can not be allocated.  EIO if there was an error during
 * the read.  EINVAL in any input values are incorrect.
 */
int hdr_log_read_entry(
    struct hdr_log_reader* reader, FILE* file, struct hdr_log_entry *entry, struct hdr_histogram** histogram);

/**
 * Returns a string representation of the error number.
 *
 * @param errnum The error response from a previous call.
 * @return The user readable representation of the error.
 */
const char* hdr_strerror(int errnum);

#ifdef __cplusplus
}
#endif

#endif
