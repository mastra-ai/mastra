"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDisplayName = getDisplayName;
/**
 * Utilities for working with BaseMetadata objects.
 */
/**
 * Gets the display name for an object with BaseMetadata.
 * For tools, the precedence is: title → annotations.title → name
 * For other objects: title → name
 * This implements the spec requirement: "if no title is provided, name should be used for display purposes"
 */
function getDisplayName(metadata) {
    var _a;
    // First check for title (not undefined and not empty string)
    if (metadata.title !== undefined && metadata.title !== '') {
        return metadata.title;
    }
    // Then check for annotations.title (only present in Tool objects)
    if ('annotations' in metadata) {
        const metadataWithAnnotations = metadata;
        if ((_a = metadataWithAnnotations.annotations) === null || _a === void 0 ? void 0 : _a.title) {
            return metadataWithAnnotations.annotations.title;
        }
    }
    // Finally fall back to name
    return metadata.name;
}
//# sourceMappingURL=metadataUtils.js.map