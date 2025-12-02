/**
 * hdr_encoding.h
 * Written by Michael Barker and released to the public domain,
 * as explained at http://creativecommons.org/publicdomain/zero/1.0/
 */

#ifndef HDR_ENCODING_H
#define HDR_ENCODING_H

#include <stdint.h>

#define MAX_BYTES_LEB128 9

#ifdef __cplusplus
extern "C" {
#endif

/**
 * Writes a int64_t value to the given buffer in LEB128 ZigZag encoded format
 *
 * @param buffer the buffer to write to
 * @param signed_value  the value to write to the buffer
 * @return the number of bytes written to the buffer
 */
int zig_zag_encode_i64(uint8_t* buffer, int64_t signed_value);

/**
 * Read an LEB128 ZigZag encoded long value from the given buffer
 *
 * @param buffer the buffer to read from
 * @param retVal out value to capture the read value
 * @return the number of bytes read from the buffer
 */
int zig_zag_decode_i64(const uint8_t* buffer, int64_t* signed_value);

/**
 * Gets the length in bytes of base64 data, given the input size.
 *
 * @param decoded_size the size of the unencoded values.
 * @return the encoded size
 */
size_t hdr_base64_encoded_len(size_t decoded_size);

/**
 * Encode into base64.
 *
 * @param input the data to encode
 * @param input_len the length of the data to encode
 * @param output the buffer to write the output to
 * @param output_len the number of bytes to write to the output
 */
int hdr_base64_encode(
    const uint8_t* input, size_t input_len, char* output, size_t output_len);

/**
 * Gets the length in bytes of decoded base64 data, given the size of the base64 encoded
 * data.
 *
 * @param encoded_size the size of the encoded value.
 * @return the decoded size
 */
size_t hdr_base64_decoded_len(size_t encoded_size);

/**
 * Decode from base64.
 *
 * @param input the base64 encoded data
 * @param input_len the size in bytes of the endcoded data
 * @param output the buffer to write the decoded data to
 * @param output_len the number of bytes to write to the output data
 */
int hdr_base64_decode(
    const char* input, size_t input_len, uint8_t* output, size_t output_len);

#ifdef __cplusplus
}
#endif

#endif /* HDR_HISTOGRAM_HDR_ENCODING_H */
