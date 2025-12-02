"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.attrNumsToBitmap = exports.setBit = exports.requiresFsStats = exports.requiresLstat = exports.containsSetOnlyAttr = exports.overlaps = exports.parseBitmask = exports.FS_ATTRS = exports.STAT_ATTRS = exports.RECOMMENDED_ATTRS = exports.REQUIRED_ATTRS = exports.SET_ONLY_ATTRS = exports.GET_ONLY_ATTRS = exports.HOMOGENEOUS_ATTRS = exports.PER_FS_ATTRS = exports.PER_SERVER_ATTRS = void 0;
exports.PER_SERVER_ATTRS = new Set([10]);
exports.PER_FS_ATTRS = new Set([
    0,
    2,
    5,
    6,
    9,
    13,
    15,
    16,
    17,
    18,
    21,
    22,
    23,
    24,
    26,
    27,
    29,
    30,
    31,
    34,
    42,
    43,
    44,
    51,
]);
exports.HOMOGENEOUS_ATTRS = new Set([
    0,
    8,
    26,
    5,
    6,
]);
exports.GET_ONLY_ATTRS = new Set([
    0,
    1,
    2,
    3,
    5,
    6,
    7,
    8,
    9,
    10,
    11,
    19,
    13,
    15,
    16,
    17,
    18,
    20,
    21,
    22,
    23,
    24,
    26,
    27,
    28,
    29,
    30,
    31,
    55,
    34,
    35,
    38,
    39,
    40,
    41,
    42,
    43,
    44,
    45,
    47,
    51,
    52,
    53,
]);
exports.SET_ONLY_ATTRS = new Set([48, 54]);
exports.REQUIRED_ATTRS = new Set([
    0,
    1,
    2,
    3,
    4,
    5,
    6,
    7,
    8,
    9,
    10,
    11,
    19,
]);
exports.RECOMMENDED_ATTRS = new Set([
    12,
    13,
    14,
    15,
    16,
    17,
    18,
    20,
    21,
    22,
    23,
    24,
    25,
    26,
    27,
    28,
    29,
    30,
    31,
    32,
    33,
    55,
    34,
    35,
    36,
    37,
    38,
    39,
    40,
    41,
    42,
    43,
    44,
    45,
    46,
    47,
    48,
    49,
    50,
    51,
    52,
    53,
    54,
]);
exports.STAT_ATTRS = new Set([
    1,
    3,
    4,
    20,
    33,
    35,
    41,
    45,
    47,
    52,
    53,
]);
exports.FS_ATTRS = new Set([
    21,
    22,
    23,
    42,
    43,
    44,
]);
const parseBitmask = (mask) => {
    const attrs = new Set();
    const length = mask.length;
    for (let i = 0, word = mask[0], base = 0; i < length; i++, word = mask[i], base = i * 32)
        for (let bit = 0; word; bit++, word >>>= 1)
            if (word & 1)
                attrs.add(base + bit);
    return attrs;
};
exports.parseBitmask = parseBitmask;
const overlaps = (a, b) => {
    for (const element of b)
        if (a.has(element))
            return true;
    return false;
};
exports.overlaps = overlaps;
const containsSetOnlyAttr = (requestedAttrs) => (0, exports.overlaps)(requestedAttrs, exports.SET_ONLY_ATTRS);
exports.containsSetOnlyAttr = containsSetOnlyAttr;
const requiresLstat = (requestedAttrs) => (0, exports.overlaps)(requestedAttrs, exports.STAT_ATTRS);
exports.requiresLstat = requiresLstat;
const requiresFsStats = (requestedAttrs) => (0, exports.overlaps)(requestedAttrs, exports.FS_ATTRS);
exports.requiresFsStats = requiresFsStats;
const setBit = (mask, attrNum) => {
    const wordIndex = Math.floor(attrNum / 32);
    const bitIndex = attrNum % 32;
    while (mask.length <= wordIndex)
        mask.push(0);
    mask[wordIndex] |= 1 << bitIndex;
};
exports.setBit = setBit;
const attrNumsToBitmap = (attrNums) => {
    const mask = [];
    for (const attrNum of attrNums)
        (0, exports.setBit)(mask, attrNum);
    return mask;
};
exports.attrNumsToBitmap = attrNumsToBitmap;
//# sourceMappingURL=attributes.js.map