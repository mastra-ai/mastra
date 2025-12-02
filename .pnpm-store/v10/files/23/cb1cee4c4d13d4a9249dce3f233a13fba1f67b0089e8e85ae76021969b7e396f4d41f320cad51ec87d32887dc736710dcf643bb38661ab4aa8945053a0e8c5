import type { MessageShape } from "./types.js";
import type { DescField, DescMessage } from "./descriptors.js";
/**
 * Returns true if the field is set.
 *
 * - Scalar and enum fields with implicit presence (proto3):
 *   Set if not a zero value.
 *
 * - Scalar and enum fields with explicit presence (proto2, oneof):
 *   Set if a value was set when creating or parsing the message, or when a
 *   value was assigned to the field's property.
 *
 * - Message fields:
 *   Set if the property is not undefined.
 *
 * - List and map fields:
 *   Set if not empty.
 */
export declare function isFieldSet<Desc extends DescMessage>(message: MessageShape<Desc>, field: DescField): boolean;
/**
 * Resets the field, so that isFieldSet() will return false.
 */
export declare function clearField<Desc extends DescMessage>(message: MessageShape<Desc>, field: DescField): void;
