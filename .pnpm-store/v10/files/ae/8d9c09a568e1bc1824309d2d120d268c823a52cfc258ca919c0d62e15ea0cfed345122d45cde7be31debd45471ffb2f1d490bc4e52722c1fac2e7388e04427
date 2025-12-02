// src/color.ts
var IS_HEX_COLOR_REGEX = /^#?([A-F0-9]{6}|[A-F0-9]{3})$/i;
var IS_RGB_COLOR_REGEX = /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/i;
var IS_RGBA_COLOR_REGEX = /^rgba\((\d+),\s*(\d+),\s*(\d+)(,\s*\d+(\.\d+)?)\)$/i;
var IS_HSL_COLOR_REGEX = /^hsl\((\d+),\s*([\d.]+)%,\s*([\d.]+)%\)$/i;
var IS_HSLA_COLOR_REGEX = /^hsla\((\d+),\s*([\d.]+)%,\s*([\d.]+)%(,\s*\d+(\.\d+)?)*\)$/i;
var isValidHexString = (s) => {
  return !!s.match(IS_HEX_COLOR_REGEX);
};
var isValidRgbaString = (s) => {
  return !!(s.match(IS_RGB_COLOR_REGEX) || s.match(IS_RGBA_COLOR_REGEX));
};
var isValidHslaString = (s) => {
  return !!s.match(IS_HSL_COLOR_REGEX) || !!s.match(IS_HSLA_COLOR_REGEX);
};
var isRGBColor = (c) => {
  return typeof c !== "string" && "r" in c;
};
var isHSLColor = (c) => {
  return typeof c !== "string" && "h" in c;
};
var isTransparent = (c) => {
  return c === "transparent";
};
var hasAlpha = (color) => {
  return typeof color !== "string" && color.a != void 0 && color.a < 1;
};
var CLEAN_HSLA_REGEX = /[hsla()]/g;
var CLEAN_RGBA_REGEX = /[rgba()]/g;
var stringToHslaColor = (value) => {
  if (value === "transparent") {
    return { h: 0, s: 0, l: 0, a: 0 };
  }
  if (isValidHexString(value)) {
    return hexStringToHslaColor(value);
  }
  if (isValidHslaString(value)) {
    return parseHslaString(value);
  }
  if (isValidRgbaString(value)) {
    return rgbaStringToHslaColor(value);
  }
  return null;
};
var stringToSameTypeColor = (value) => {
  value = value.trim();
  if (isValidHexString(value)) {
    return value.startsWith("#") ? value : `#${value}`;
  }
  if (isValidRgbaString(value)) {
    return parseRgbaString(value);
  }
  if (isValidHslaString(value)) {
    return parseHslaString(value);
  }
  if (isTransparent(value)) {
    return value;
  }
  return "";
};
var colorToSameTypeString = (color) => {
  if (typeof color === "string" && (isValidHexString(color) || isTransparent(color))) {
    return color;
  }
  if (isRGBColor(color)) {
    return rgbaColorToRgbaString(color);
  }
  if (isHSLColor(color)) {
    return hslaColorToHslaString(color);
  }
  return "";
};
var hexStringToRgbaColor = (hex) => {
  hex = hex.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return { r, g, b };
};
var rgbaColorToRgbaString = (color) => {
  const { a, b, g, r } = color;
  return color.a === 0 ? "transparent" : color.a != void 0 ? `rgba(${r},${g},${b},${a})` : `rgb(${r},${g},${b})`;
};
var hslaColorToHslaString = (color) => {
  const { h, s, l, a } = color;
  const sPerc = Math.round(s * 100);
  const lPerc = Math.round(l * 100);
  return color.a === 0 ? "transparent" : color.a != void 0 ? `hsla(${h},${sPerc}%,${lPerc}%,${a})` : `hsl(${h},${sPerc}%,${lPerc}%)`;
};
var hexStringToHslaColor = (hex) => {
  const rgbaString = colorToSameTypeString(hexStringToRgbaColor(hex));
  return rgbaStringToHslaColor(rgbaString);
};
var rgbaStringToHslaColor = (rgba) => {
  const rgbaColor = parseRgbaString(rgba);
  const r = rgbaColor.r / 255;
  const g = rgbaColor.g / 255;
  const b = rgbaColor.b / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s;
  const l = (max + min) / 2;
  if (max == min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l >= 0.5 ? d / (2 - (max + min)) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d * 60;
        break;
      case g:
        h = ((b - r) / d + 2) * 60;
        break;
      default:
        h = ((r - g) / d + 4) * 60;
        break;
    }
  }
  const res = { h: Math.round(h), s, l };
  const a = rgbaColor.a;
  if (a != void 0) {
    res.a = a;
  }
  return res;
};
var parseRgbaString = (str) => {
  const [r, g, b, a] = str.replace(CLEAN_RGBA_REGEX, "").split(",").map((c) => Number.parseFloat(c));
  return { r, g, b, a };
};
var parseHslaString = (str) => {
  const [h, s, l, a] = str.replace(CLEAN_HSLA_REGEX, "").split(",").map((c) => Number.parseFloat(c));
  return { h, s: s / 100, l: l / 100, a };
};

export {
  isValidHexString,
  isValidRgbaString,
  isValidHslaString,
  isRGBColor,
  isHSLColor,
  isTransparent,
  hasAlpha,
  stringToHslaColor,
  stringToSameTypeColor,
  colorToSameTypeString,
  hexStringToRgbaColor
};
//# sourceMappingURL=chunk-X6NLIF7Y.mjs.map