/**
 * A tiny, secure, URL-friendly, unique string ID generator for JavaScript
 * with hardware random generator.
 *
 * ```js
 * import { nanoid } from 'nanoid'
 * model.id = nanoid() //=> "V1StGXR8_Z5jdHi6B-myT"
 * ```
 *
 * @module
 */

/**
 * Generate secure URL-friendly unique ID.
 *
 * By default, the ID will have 21 symbols to have a collision probability
 * similar to UUID v4.
 *
 * ```js
 * import { nanoid } from 'nanoid'
 * model.id = nanoid() //=> "Uakgb_J5m9g-0JDMbcJqL"
 * ```
 *
 * @param size Size of the ID. The default size is 21.
 * @typeparam Type The ID type to replace `string` with some opaque type.
 * @returns A random string.
 */
export function nanoid<Type extends string>(size?: number): Type

/**
 * Generate secure unique ID with custom alphabet.
 *
 * Alphabet must contain 256 symbols or less. Otherwise, the generator
 * will not be secure.
 *
 * @param alphabet Alphabet used to generate the ID.
 * @param defaultSize Size of the ID. The default size is 21.
 * @typeparam Type The ID type to replace `string` with some opaque type.
 * @returns A random string generator.
 *
 * ```js
 * const { customAlphabet } = require('nanoid')
 * const nanoid = customAlphabet('0123456789абвгдеё', 5)
 * nanoid() //=> "8ё56а"
 * ```
 */
export function customAlphabet<Type extends string>(
  alphabet: string,
  defaultSize?: number
): (size?: number) => Type

/**
 * Generate unique ID with custom random generator and alphabet.
 *
 * Alphabet must contain 256 symbols or less. Otherwise, the generator
 * will not be secure.
 *
 * ```js
 * import { customRandom } from 'nanoid/format'
 *
 * const nanoid = customRandom('abcdef', 5, size => {
 *   const random = []
 *   for (let i = 0; i < size; i++) {
 *     random.push(randomByte())
 *   }
 *   return random
 * })
 *
 * nanoid() //=> "fbaef"
 * ```
 *
 * @param alphabet Alphabet used to generate a random string.
 * @param size Size of the random string.
 * @param random A random bytes generator.
 * @typeparam Type The ID type to replace `string` with some opaque type.
 * @returns A random string generator.
 */
export function customRandom<Type extends string>(
  alphabet: string,
  size: number,
  random: (bytes: number) => Uint8Array
): () => Type

/**
 * URL safe symbols.
 *
 * ```js
 * import { urlAlphabet } from 'nanoid'
 * const nanoid = customAlphabet(urlAlphabet, 10)
 * nanoid() //=> "Uakgb_J5m9"
 * ```
 */
export const urlAlphabet: string

/**
 * Generate an array of random bytes collected from hardware noise.
 *
 * ```js
 * import { customRandom, random } from 'nanoid'
 * const nanoid = customRandom("abcdef", 5, random)
 * ```
 *
 * @param bytes Size of the array.
 * @returns An array of random bytes.
 */
export function random(bytes: number): Uint8Array
