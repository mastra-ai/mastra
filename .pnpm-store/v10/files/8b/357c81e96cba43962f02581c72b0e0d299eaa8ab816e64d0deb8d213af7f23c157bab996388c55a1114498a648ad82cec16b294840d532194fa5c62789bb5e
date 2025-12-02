// ../../node_modules/.pnpm/kleur@4.1.5/node_modules/kleur/colors.mjs
var FORCE_COLOR, NODE_DISABLE_COLORS, NO_COLOR, TERM, isTTY = !0;
typeof process < "u" && ({ FORCE_COLOR, NODE_DISABLE_COLORS, NO_COLOR, TERM } = process.env || {}, isTTY = process.stdout && process.stdout.isTTY);
var $ = {
  enabled: !NODE_DISABLE_COLORS && NO_COLOR == null && TERM !== "dumb" && (FORCE_COLOR != null && FORCE_COLOR !== "0" || isTTY)
};
function init(x, y) {
  let rgx = new RegExp(`\\x1b\\[${y}m`, "g"), open = `\x1B[${x}m`, close = `\x1B[${y}m`;
  return function(txt) {
    return !$.enabled || txt == null ? txt : open + (~("" + txt).indexOf(close) ? txt.replace(rgx, close + open) : txt) + close;
  };
}
var reset = init(0, 0), bold = init(1, 22), dim = init(2, 22), italic = init(3, 23), underline = init(4, 24), inverse = init(7, 27), hidden = init(8, 28), strikethrough = init(9, 29), black = init(30, 39), red = init(31, 39), green = init(32, 39), yellow = init(33, 39), blue = init(34, 39), magenta = init(35, 39), cyan = init(36, 39), white = init(37, 39), gray = init(90, 39), grey = init(90, 39), bgBlack = init(40, 49), bgRed = init(41, 49), bgGreen = init(42, 49), bgYellow = init(43, 49), bgBlue = init(44, 49), bgMagenta = init(45, 49), bgCyan = init(46, 49), bgWhite = init(47, 49);

// src/workers/core/entry.worker.ts
import { HttpError, LogLevel as LogLevel2, SharedHeaders as SharedHeaders2 } from "miniflare:shared";

// src/shared/mime-types.ts
var compressedByCloudflareFL = /* @__PURE__ */ new Set([
  // list copied from https://developers.cloudflare.com/speed/optimization/content/brotli/content-compression/#:~:text=If%20supported%20by%20visitors%E2%80%99%20web%20browsers%2C%20Cloudflare%20will%20return%20Gzip%20or%20Brotli%2Dencoded%20responses%20for%20the%20following%20content%20types%3A
  "text/html",
  "text/richtext",
  "text/plain",
  "text/css",
  "text/x-script",
  "text/x-component",
  "text/x-java-source",
  "text/x-markdown",
  "application/javascript",
  "application/x-javascript",
  "text/javascript",
  "text/js",
  "image/x-icon",
  "image/vnd.microsoft.icon",
  "application/x-perl",
  "application/x-httpd-cgi",
  "text/xml",
  "application/xml",
  "application/rss+xml",
  "application/vnd.api+json",
  "application/x-protobuf",
  "application/json",
  "multipart/bag",
  "multipart/mixed",
  "application/xhtml+xml",
  "font/ttf",
  "font/otf",
  "font/x-woff",
  "image/svg+xml",
  "application/vnd.ms-fontobject",
  "application/ttf",
  "application/x-ttf",
  "application/otf",
  "application/x-otf",
  "application/truetype",
  "application/opentype",
  "application/x-opentype",
  "application/font-woff",
  "application/eot",
  "application/font",
  "application/font-sfnt",
  "application/wasm",
  "application/javascript-binast",
  "application/manifest+json",
  "application/ld+json",
  "application/graphql+json",
  "application/geo+json"
]);
function isCompressedByCloudflareFL(contentTypeHeader) {
  if (!contentTypeHeader) return !0;
  let [contentType] = contentTypeHeader.split(";");
  return compressedByCloudflareFL.has(contentType);
}

// src/workers/core/constants.ts
var CoreHeaders = {
  CUSTOM_FETCH_SERVICE: "MF-Custom-Fetch-Service",
  CUSTOM_NODE_SERVICE: "MF-Custom-Node-Service",
  ORIGINAL_URL: "MF-Original-URL",
  PROXY_SHARED_SECRET: "MF-Proxy-Shared-Secret",
  DISABLE_PRETTY_ERROR: "MF-Disable-Pretty-Error",
  ERROR_STACK: "MF-Experimental-Error-Stack",
  ROUTE_OVERRIDE: "MF-Route-Override",
  CF_BLOB: "MF-CF-Blob",
  /** Used by the Vite plugin to pass through the original `sec-fetch-mode` header */
  SEC_FETCH_MODE: "MF-Sec-Fetch-Mode",
  // API Proxy
  OP_SECRET: "MF-Op-Secret",
  OP: "MF-Op",
  OP_TARGET: "MF-Op-Target",
  OP_KEY: "MF-Op-Key",
  OP_SYNC: "MF-Op-Sync",
  OP_STRINGIFIED_SIZE: "MF-Op-Stringified-Size",
  OP_RESULT_TYPE: "MF-Op-Result-Type"
}, CoreBindings = {
  SERVICE_LOOPBACK: "MINIFLARE_LOOPBACK",
  SERVICE_USER_ROUTE_PREFIX: "MINIFLARE_USER_ROUTE_",
  SERVICE_USER_FALLBACK: "MINIFLARE_USER_FALLBACK",
  TEXT_CUSTOM_SERVICE: "MINIFLARE_CUSTOM_SERVICE",
  IMAGES_SERVICE: "MINIFLARE_IMAGES_SERVICE",
  TEXT_UPSTREAM_URL: "MINIFLARE_UPSTREAM_URL",
  JSON_CF_BLOB: "CF_BLOB",
  JSON_ROUTES: "MINIFLARE_ROUTES",
  JSON_LOG_LEVEL: "MINIFLARE_LOG_LEVEL",
  DATA_LIVE_RELOAD_SCRIPT: "MINIFLARE_LIVE_RELOAD_SCRIPT",
  DURABLE_OBJECT_NAMESPACE_PROXY: "MINIFLARE_PROXY",
  DATA_PROXY_SECRET: "MINIFLARE_PROXY_SECRET",
  DATA_PROXY_SHARED_SECRET: "MINIFLARE_PROXY_SHARED_SECRET",
  TRIGGER_HANDLERS: "TRIGGER_HANDLERS",
  LOG_REQUESTS: "LOG_REQUESTS",
  STRIP_DISABLE_PRETTY_ERROR: "STRIP_DISABLE_PRETTY_ERROR"
}, ProxyOps = {
  // Get the target or a property of the target
  GET: "GET",
  // Get the descriptor for a property of the target
  GET_OWN_DESCRIPTOR: "GET_OWN_DESCRIPTOR",
  // Get the target's own property names
  GET_OWN_KEYS: "GET_OWN_KEYS",
  // Call a method on the target
  CALL: "CALL",
  // Remove the strong reference to the target on the "heap", allowing it to be
  // garbage collected
  FREE: "FREE"
}, ProxyAddresses = {
  GLOBAL: 0,
  // globalThis
  ENV: 1,
  // env
  USER_START: 2
};
function isFetcherFetch(targetName, key) {
  return (targetName === "Fetcher" || targetName === "DurableObject" || targetName === "WorkerRpc") && key === "fetch";
}
function isR2ObjectWriteHttpMetadata(targetName, key) {
  return (targetName === "HeadResult" || targetName === "GetResult") && key === "writeHttpMetadata";
}
function isImagesInput(targetName, key) {
  return targetName === "ImagesBindingImpl" && key === "input";
}

// src/workers/core/email.ts
import assert from "node:assert";
import { LogLevel, SharedHeaders } from "miniflare:shared";

// ../../node_modules/.pnpm/postal-mime@2.4.3_patch_hash=ngwql2fj2dlex3jjynq4iizhk4/node_modules/postal-mime/src/decode-strings.js
var textEncoder = new TextEncoder(), base64Chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/", base64Lookup = new Uint8Array(256);
for (i = 0; i < base64Chars.length; i++)
  base64Lookup[base64Chars.charCodeAt(i)] = i;
var i;
function decodeBase64(base64) {
  let bufferLength = Math.ceil(base64.length / 4) * 3, len = base64.length, p = 0;
  base64.length % 4 === 3 ? bufferLength-- : base64.length % 4 === 2 ? bufferLength -= 2 : base64[base64.length - 1] === "=" && (bufferLength--, base64[base64.length - 2] === "=" && bufferLength--);
  let arrayBuffer = new ArrayBuffer(bufferLength), bytes = new Uint8Array(arrayBuffer);
  for (let i = 0; i < len; i += 4) {
    let encoded1 = base64Lookup[base64.charCodeAt(i)], encoded2 = base64Lookup[base64.charCodeAt(i + 1)], encoded3 = base64Lookup[base64.charCodeAt(i + 2)], encoded4 = base64Lookup[base64.charCodeAt(i + 3)];
    bytes[p++] = encoded1 << 2 | encoded2 >> 4, bytes[p++] = (encoded2 & 15) << 4 | encoded3 >> 2, bytes[p++] = (encoded3 & 3) << 6 | encoded4 & 63;
  }
  return arrayBuffer;
}
function getDecoder(charset) {
  return charset = charset || "utf8", new TextDecoder(charset);
}
async function blobToArrayBuffer(blob) {
  if ("arrayBuffer" in blob)
    return await blob.arrayBuffer();
  let fr = new FileReader();
  return new Promise((resolve, reject) => {
    fr.onload = function(e) {
      resolve(e.target.result);
    }, fr.onerror = function(e) {
      reject(fr.error);
    }, fr.readAsArrayBuffer(blob);
  });
}
function getHex(c) {
  return c >= 48 && c <= 57 || c >= 97 && c <= 102 || c >= 65 && c <= 70 ? String.fromCharCode(c) : !1;
}
function decodeWord(charset, encoding, str) {
  let splitPos = charset.indexOf("*");
  splitPos >= 0 && (charset = charset.substr(0, splitPos)), encoding = encoding.toUpperCase();
  let byteStr;
  if (encoding === "Q") {
    str = str.replace(/=\s+([0-9a-fA-F])/g, "=$1").replace(/[_\s]/g, " ");
    let buf = textEncoder.encode(str), encodedBytes = [];
    for (let i = 0, len = buf.length; i < len; i++) {
      let c = buf[i];
      if (i <= len - 2 && c === 61) {
        let c1 = getHex(buf[i + 1]), c2 = getHex(buf[i + 2]);
        if (c1 && c2) {
          let c3 = parseInt(c1 + c2, 16);
          encodedBytes.push(c3), i += 2;
          continue;
        }
      }
      encodedBytes.push(c);
    }
    byteStr = new ArrayBuffer(encodedBytes.length);
    let dataView = new DataView(byteStr);
    for (let i = 0, len = encodedBytes.length; i < len; i++)
      dataView.setUint8(i, encodedBytes[i]);
  } else encoding === "B" ? byteStr = decodeBase64(str.replace(/[^a-zA-Z0-9\+\/=]+/g, "")) : byteStr = textEncoder.encode(str);
  return getDecoder(charset).decode(byteStr);
}
function decodeWords(str) {
  let joinString = !0, done = !1;
  for (; !done; ) {
    let result = (str || "").toString().replace(/(=\?([^?]+)\?[Bb]\?([^?]*)\?=)\s*(?==\?([^?]+)\?[Bb]\?[^?]*\?=)/g, (match, left, chLeft, encodedLeftStr, chRight) => joinString && chLeft === chRight && encodedLeftStr.length % 4 === 0 && !/=$/.test(encodedLeftStr) ? left + "__\0JOIN\0__" : match).replace(/(=\?([^?]+)\?[Qq]\?[^?]*\?=)\s*(?==\?([^?]+)\?[Qq]\?[^?]*\?=)/g, (match, left, chLeft, chRight) => joinString && chLeft === chRight ? left + "__\0JOIN\0__" : match).replace(/(\?=)?__\x00JOIN\x00__(=\?([^?]+)\?[QqBb]\?)?/g, "").replace(/(=\?[^?]+\?[QqBb]\?[^?]*\?=)\s+(?==\?[^?]+\?[QqBb]\?[^?]*\?=)/g, "$1").replace(/=\?([\w_\-*]+)\?([QqBb])\?([^?]*)\?=/g, (m, charset, encoding, text) => decodeWord(charset, encoding, text));
    if (joinString && result.indexOf("\uFFFD") >= 0)
      joinString = !1;
    else
      return result;
  }
}
function decodeURIComponentWithCharset(encodedStr, charset) {
  charset = charset || "utf-8";
  let encodedBytes = [];
  for (let i = 0; i < encodedStr.length; i++) {
    let c = encodedStr.charAt(i);
    if (c === "%" && /^[a-f0-9]{2}/i.test(encodedStr.substr(i + 1, 2))) {
      let byte = encodedStr.substr(i + 1, 2);
      i += 2, encodedBytes.push(parseInt(byte, 16));
    } else if (c.charCodeAt(0) > 126) {
      c = textEncoder.encode(c);
      for (let j = 0; j < c.length; j++)
        encodedBytes.push(c[j]);
    } else
      encodedBytes.push(c.charCodeAt(0));
  }
  let byteStr = new ArrayBuffer(encodedBytes.length), dataView = new DataView(byteStr);
  for (let i = 0, len = encodedBytes.length; i < len; i++)
    dataView.setUint8(i, encodedBytes[i]);
  return getDecoder(charset).decode(byteStr);
}
function decodeParameterValueContinuations(header) {
  let paramKeys = /* @__PURE__ */ new Map();
  Object.keys(header.params).forEach((key) => {
    let match = key.match(/\*((\d+)\*?)?$/);
    if (!match)
      return;
    let actualKey = key.substr(0, match.index).toLowerCase(), nr = Number(match[2]) || 0, paramVal;
    paramKeys.has(actualKey) ? paramVal = paramKeys.get(actualKey) : (paramVal = {
      charset: !1,
      values: []
    }, paramKeys.set(actualKey, paramVal));
    let value = header.params[key];
    nr === 0 && match[0].charAt(match[0].length - 1) === "*" && (match = value.match(/^([^']*)'[^']*'(.*)$/)) && (paramVal.charset = match[1] || "utf-8", value = match[2]), paramVal.values.push({ nr, value }), delete header.params[key];
  }), paramKeys.forEach((paramVal, key) => {
    header.params[key] = decodeURIComponentWithCharset(
      paramVal.values.sort((a, b) => a.nr - b.nr).map((a) => a.value).join(""),
      paramVal.charset
    );
  });
}

// ../../node_modules/.pnpm/postal-mime@2.4.3_patch_hash=ngwql2fj2dlex3jjynq4iizhk4/node_modules/postal-mime/src/pass-through-decoder.js
var PassThroughDecoder = class {
  constructor() {
    this.chunks = [];
  }
  update(line) {
    this.chunks.push(line), this.chunks.push(`
`);
  }
  finalize() {
    return blobToArrayBuffer(new Blob(this.chunks, { type: "application/octet-stream" }));
  }
};

// ../../node_modules/.pnpm/postal-mime@2.4.3_patch_hash=ngwql2fj2dlex3jjynq4iizhk4/node_modules/postal-mime/src/base64-decoder.js
var Base64Decoder = class {
  constructor(opts) {
    opts = opts || {}, this.decoder = opts.decoder || new TextDecoder(), this.maxChunkSize = 100 * 1024, this.chunks = [], this.remainder = "";
  }
  update(buffer) {
    let str = this.decoder.decode(buffer);
    if (/[^a-zA-Z0-9+\/]/.test(str) && (str = str.replace(/[^a-zA-Z0-9+\/]+/g, "")), this.remainder += str, this.remainder.length >= this.maxChunkSize) {
      let allowedBytes = Math.floor(this.remainder.length / 4) * 4, base64Str;
      allowedBytes === this.remainder.length ? (base64Str = this.remainder, this.remainder = "") : (base64Str = this.remainder.substr(0, allowedBytes), this.remainder = this.remainder.substr(allowedBytes)), base64Str.length && this.chunks.push(decodeBase64(base64Str));
    }
  }
  finalize() {
    return this.remainder && !/^=+$/.test(this.remainder) && this.chunks.push(decodeBase64(this.remainder)), blobToArrayBuffer(new Blob(this.chunks, { type: "application/octet-stream" }));
  }
};

// ../../node_modules/.pnpm/postal-mime@2.4.3_patch_hash=ngwql2fj2dlex3jjynq4iizhk4/node_modules/postal-mime/src/qp-decoder.js
var QPDecoder = class {
  constructor(opts) {
    opts = opts || {}, this.decoder = opts.decoder || new TextDecoder(), this.maxChunkSize = 100 * 1024, this.remainder = "", this.chunks = [];
  }
  decodeQPBytes(encodedBytes) {
    let buf = new ArrayBuffer(encodedBytes.length), dataView = new DataView(buf);
    for (let i = 0, len = encodedBytes.length; i < len; i++)
      dataView.setUint8(i, parseInt(encodedBytes[i], 16));
    return buf;
  }
  decodeChunks(str) {
    str = str.replace(/=\r?\n/g, "");
    let list = str.split(/(?==)/), encodedBytes = [];
    for (let part of list) {
      if (part.charAt(0) !== "=") {
        encodedBytes.length && (this.chunks.push(this.decodeQPBytes(encodedBytes)), encodedBytes = []), this.chunks.push(part);
        continue;
      }
      if (part.length === 3) {
        encodedBytes.push(part.substr(1));
        continue;
      }
      part.length > 3 && (encodedBytes.push(part.substr(1, 2)), this.chunks.push(this.decodeQPBytes(encodedBytes)), encodedBytes = [], part = part.substr(3), this.chunks.push(part));
    }
    encodedBytes.length && (this.chunks.push(this.decodeQPBytes(encodedBytes)), encodedBytes = []);
  }
  update(buffer) {
    let str = this.decoder.decode(buffer) + `
`;
    if (str = this.remainder + str, str.length < this.maxChunkSize) {
      this.remainder = str;
      return;
    }
    this.remainder = "";
    let partialEnding = str.match(/=[a-fA-F0-9]?$/);
    if (partialEnding) {
      if (partialEnding.index === 0) {
        this.remainder = str;
        return;
      }
      this.remainder = str.substr(partialEnding.index), str = str.substr(0, partialEnding.index);
    }
    this.decodeChunks(str);
  }
  finalize() {
    return this.remainder.length && (this.decodeChunks(this.remainder), this.remainder = ""), blobToArrayBuffer(new Blob(this.chunks, { type: "application/octet-stream" }));
  }
};

// ../../node_modules/.pnpm/postal-mime@2.4.3_patch_hash=ngwql2fj2dlex3jjynq4iizhk4/node_modules/postal-mime/src/mime-node.js
var MimeNode = class {
  constructor(opts) {
    opts = opts || {}, this.postalMime = opts.postalMime, this.root = !!opts.parentNode, this.childNodes = [], opts.parentNode && opts.parentNode.childNodes.push(this), this.state = "header", this.headerLines = [], this.contentType = {
      value: "text/plain",
      default: !0
    }, this.contentTransferEncoding = {
      value: "8bit"
    }, this.contentDisposition = {
      value: ""
    }, this.headers = [], this.contentDecoder = !1;
  }
  setupContentDecoder(transferEncoding) {
    /base64/i.test(transferEncoding) ? this.contentDecoder = new Base64Decoder() : /quoted-printable/i.test(transferEncoding) ? this.contentDecoder = new QPDecoder({ decoder: getDecoder(this.contentType.parsed.params.charset) }) : this.contentDecoder = new PassThroughDecoder();
  }
  async finalize() {
    if (this.state === "finished")
      return;
    this.state === "header" && this.processHeaders();
    let boundaries = this.postalMime.boundaries;
    for (let i = boundaries.length - 1; i >= 0; i--)
      if (boundaries[i].node === this) {
        boundaries.splice(i, 1);
        break;
      }
    await this.finalizeChildNodes(), this.content = this.contentDecoder ? await this.contentDecoder.finalize() : null, this.state = "finished";
  }
  async finalizeChildNodes() {
    for (let childNode of this.childNodes)
      await childNode.finalize();
  }
  parseStructuredHeader(str) {
    let response = {
      value: !1,
      params: {}
    }, key = !1, value = "", stage = "value", quote = !1, escaped = !1, chr;
    for (let i = 0, len = str.length; i < len; i++)
      switch (chr = str.charAt(i), stage) {
        case "key":
          if (chr === "=") {
            key = value.trim().toLowerCase(), stage = "value", value = "";
            break;
          }
          value += chr;
          break;
        case "value":
          if (escaped)
            value += chr;
          else if (chr === "\\") {
            escaped = !0;
            continue;
          } else quote && chr === quote ? quote = !1 : !quote && chr === '"' ? quote = chr : !quote && chr === ";" ? (key === !1 ? response.value = value.trim() : response.params[key] = value.trim(), stage = "key", value = "") : value += chr;
          escaped = !1;
          break;
      }
    return value = value.trim(), stage === "value" ? key === !1 ? response.value = value : response.params[key] = value : value && (response.params[value.toLowerCase()] = ""), response.value && (response.value = response.value.toLowerCase()), decodeParameterValueContinuations(response), response;
  }
  decodeFlowedText(str, delSp) {
    return str.split(/\r?\n/).reduce((previousValue, currentValue) => / $/.test(previousValue) && !/(^|\n)-- $/.test(previousValue) ? delSp ? previousValue.slice(0, -1) + currentValue : previousValue + currentValue : previousValue + `
` + currentValue).replace(/^ /gm, "");
  }
  getTextContent() {
    if (!this.content)
      return "";
    let str = getDecoder(this.contentType.parsed.params.charset).decode(this.content);
    return /^flowed$/i.test(this.contentType.parsed.params.format) && (str = this.decodeFlowedText(str, /^yes$/i.test(this.contentType.parsed.params.delsp))), str;
  }
  processHeaders() {
    for (let i = this.headerLines.length - 1; i >= 0; i--) {
      let line = this.headerLines[i];
      if (i && /^\s/.test(line))
        this.headerLines[i - 1] += `
` + line, this.headerLines.splice(i, 1);
      else {
        line = line.replace(/\s+/g, " ");
        let sep = line.indexOf(":"), key = sep < 0 ? line.trim() : line.substr(0, sep).trim(), value = sep < 0 ? "" : line.substr(sep + 1).trim();
        switch (this.headers.push({ key: key.toLowerCase(), originalKey: key, value }), key.toLowerCase()) {
          case "content-type":
            this.contentType.default && (this.contentType = { value, parsed: {} });
            break;
          case "content-transfer-encoding":
            this.contentTransferEncoding = { value, parsed: {} };
            break;
          case "content-disposition":
            this.contentDisposition = { value, parsed: {} };
            break;
          case "content-id":
            this.contentId = value;
            break;
          case "content-description":
            this.contentDescription = value;
            break;
        }
      }
    }
    this.contentType.parsed = this.parseStructuredHeader(this.contentType.value), this.contentType.multipart = /^multipart\//i.test(this.contentType.parsed.value) ? this.contentType.parsed.value.substr(this.contentType.parsed.value.indexOf("/") + 1) : !1, this.contentType.multipart && this.contentType.parsed.params.boundary && this.postalMime.boundaries.push({
      value: textEncoder.encode(this.contentType.parsed.params.boundary),
      node: this
    }), this.contentDisposition.parsed = this.parseStructuredHeader(this.contentDisposition.value), this.contentTransferEncoding.encoding = this.contentTransferEncoding.value.toLowerCase().split(/[^\w-]/).shift(), this.setupContentDecoder(this.contentTransferEncoding.encoding);
  }
  feed(line) {
    switch (this.state) {
      case "header":
        if (!line.length)
          return this.state = "body", this.processHeaders();
        this.headerLines.push(getDecoder().decode(line));
        break;
      case "body":
        this.contentDecoder.update(line);
    }
  }
};

// ../../node_modules/.pnpm/postal-mime@2.4.3_patch_hash=ngwql2fj2dlex3jjynq4iizhk4/node_modules/postal-mime/src/html-entities.js
var htmlEntities = {
  "&AElig": "\xC6",
  "&AElig;": "\xC6",
  "&AMP": "&",
  "&AMP;": "&",
  "&Aacute": "\xC1",
  "&Aacute;": "\xC1",
  "&Abreve;": "\u0102",
  "&Acirc": "\xC2",
  "&Acirc;": "\xC2",
  "&Acy;": "\u0410",
  "&Afr;": "\u{1D504}",
  "&Agrave": "\xC0",
  "&Agrave;": "\xC0",
  "&Alpha;": "\u0391",
  "&Amacr;": "\u0100",
  "&And;": "\u2A53",
  "&Aogon;": "\u0104",
  "&Aopf;": "\u{1D538}",
  "&ApplyFunction;": "\u2061",
  "&Aring": "\xC5",
  "&Aring;": "\xC5",
  "&Ascr;": "\u{1D49C}",
  "&Assign;": "\u2254",
  "&Atilde": "\xC3",
  "&Atilde;": "\xC3",
  "&Auml": "\xC4",
  "&Auml;": "\xC4",
  "&Backslash;": "\u2216",
  "&Barv;": "\u2AE7",
  "&Barwed;": "\u2306",
  "&Bcy;": "\u0411",
  "&Because;": "\u2235",
  "&Bernoullis;": "\u212C",
  "&Beta;": "\u0392",
  "&Bfr;": "\u{1D505}",
  "&Bopf;": "\u{1D539}",
  "&Breve;": "\u02D8",
  "&Bscr;": "\u212C",
  "&Bumpeq;": "\u224E",
  "&CHcy;": "\u0427",
  "&COPY": "\xA9",
  "&COPY;": "\xA9",
  "&Cacute;": "\u0106",
  "&Cap;": "\u22D2",
  "&CapitalDifferentialD;": "\u2145",
  "&Cayleys;": "\u212D",
  "&Ccaron;": "\u010C",
  "&Ccedil": "\xC7",
  "&Ccedil;": "\xC7",
  "&Ccirc;": "\u0108",
  "&Cconint;": "\u2230",
  "&Cdot;": "\u010A",
  "&Cedilla;": "\xB8",
  "&CenterDot;": "\xB7",
  "&Cfr;": "\u212D",
  "&Chi;": "\u03A7",
  "&CircleDot;": "\u2299",
  "&CircleMinus;": "\u2296",
  "&CirclePlus;": "\u2295",
  "&CircleTimes;": "\u2297",
  "&ClockwiseContourIntegral;": "\u2232",
  "&CloseCurlyDoubleQuote;": "\u201D",
  "&CloseCurlyQuote;": "\u2019",
  "&Colon;": "\u2237",
  "&Colone;": "\u2A74",
  "&Congruent;": "\u2261",
  "&Conint;": "\u222F",
  "&ContourIntegral;": "\u222E",
  "&Copf;": "\u2102",
  "&Coproduct;": "\u2210",
  "&CounterClockwiseContourIntegral;": "\u2233",
  "&Cross;": "\u2A2F",
  "&Cscr;": "\u{1D49E}",
  "&Cup;": "\u22D3",
  "&CupCap;": "\u224D",
  "&DD;": "\u2145",
  "&DDotrahd;": "\u2911",
  "&DJcy;": "\u0402",
  "&DScy;": "\u0405",
  "&DZcy;": "\u040F",
  "&Dagger;": "\u2021",
  "&Darr;": "\u21A1",
  "&Dashv;": "\u2AE4",
  "&Dcaron;": "\u010E",
  "&Dcy;": "\u0414",
  "&Del;": "\u2207",
  "&Delta;": "\u0394",
  "&Dfr;": "\u{1D507}",
  "&DiacriticalAcute;": "\xB4",
  "&DiacriticalDot;": "\u02D9",
  "&DiacriticalDoubleAcute;": "\u02DD",
  "&DiacriticalGrave;": "`",
  "&DiacriticalTilde;": "\u02DC",
  "&Diamond;": "\u22C4",
  "&DifferentialD;": "\u2146",
  "&Dopf;": "\u{1D53B}",
  "&Dot;": "\xA8",
  "&DotDot;": "\u20DC",
  "&DotEqual;": "\u2250",
  "&DoubleContourIntegral;": "\u222F",
  "&DoubleDot;": "\xA8",
  "&DoubleDownArrow;": "\u21D3",
  "&DoubleLeftArrow;": "\u21D0",
  "&DoubleLeftRightArrow;": "\u21D4",
  "&DoubleLeftTee;": "\u2AE4",
  "&DoubleLongLeftArrow;": "\u27F8",
  "&DoubleLongLeftRightArrow;": "\u27FA",
  "&DoubleLongRightArrow;": "\u27F9",
  "&DoubleRightArrow;": "\u21D2",
  "&DoubleRightTee;": "\u22A8",
  "&DoubleUpArrow;": "\u21D1",
  "&DoubleUpDownArrow;": "\u21D5",
  "&DoubleVerticalBar;": "\u2225",
  "&DownArrow;": "\u2193",
  "&DownArrowBar;": "\u2913",
  "&DownArrowUpArrow;": "\u21F5",
  "&DownBreve;": "\u0311",
  "&DownLeftRightVector;": "\u2950",
  "&DownLeftTeeVector;": "\u295E",
  "&DownLeftVector;": "\u21BD",
  "&DownLeftVectorBar;": "\u2956",
  "&DownRightTeeVector;": "\u295F",
  "&DownRightVector;": "\u21C1",
  "&DownRightVectorBar;": "\u2957",
  "&DownTee;": "\u22A4",
  "&DownTeeArrow;": "\u21A7",
  "&Downarrow;": "\u21D3",
  "&Dscr;": "\u{1D49F}",
  "&Dstrok;": "\u0110",
  "&ENG;": "\u014A",
  "&ETH": "\xD0",
  "&ETH;": "\xD0",
  "&Eacute": "\xC9",
  "&Eacute;": "\xC9",
  "&Ecaron;": "\u011A",
  "&Ecirc": "\xCA",
  "&Ecirc;": "\xCA",
  "&Ecy;": "\u042D",
  "&Edot;": "\u0116",
  "&Efr;": "\u{1D508}",
  "&Egrave": "\xC8",
  "&Egrave;": "\xC8",
  "&Element;": "\u2208",
  "&Emacr;": "\u0112",
  "&EmptySmallSquare;": "\u25FB",
  "&EmptyVerySmallSquare;": "\u25AB",
  "&Eogon;": "\u0118",
  "&Eopf;": "\u{1D53C}",
  "&Epsilon;": "\u0395",
  "&Equal;": "\u2A75",
  "&EqualTilde;": "\u2242",
  "&Equilibrium;": "\u21CC",
  "&Escr;": "\u2130",
  "&Esim;": "\u2A73",
  "&Eta;": "\u0397",
  "&Euml": "\xCB",
  "&Euml;": "\xCB",
  "&Exists;": "\u2203",
  "&ExponentialE;": "\u2147",
  "&Fcy;": "\u0424",
  "&Ffr;": "\u{1D509}",
  "&FilledSmallSquare;": "\u25FC",
  "&FilledVerySmallSquare;": "\u25AA",
  "&Fopf;": "\u{1D53D}",
  "&ForAll;": "\u2200",
  "&Fouriertrf;": "\u2131",
  "&Fscr;": "\u2131",
  "&GJcy;": "\u0403",
  "&GT": ">",
  "&GT;": ">",
  "&Gamma;": "\u0393",
  "&Gammad;": "\u03DC",
  "&Gbreve;": "\u011E",
  "&Gcedil;": "\u0122",
  "&Gcirc;": "\u011C",
  "&Gcy;": "\u0413",
  "&Gdot;": "\u0120",
  "&Gfr;": "\u{1D50A}",
  "&Gg;": "\u22D9",
  "&Gopf;": "\u{1D53E}",
  "&GreaterEqual;": "\u2265",
  "&GreaterEqualLess;": "\u22DB",
  "&GreaterFullEqual;": "\u2267",
  "&GreaterGreater;": "\u2AA2",
  "&GreaterLess;": "\u2277",
  "&GreaterSlantEqual;": "\u2A7E",
  "&GreaterTilde;": "\u2273",
  "&Gscr;": "\u{1D4A2}",
  "&Gt;": "\u226B",
  "&HARDcy;": "\u042A",
  "&Hacek;": "\u02C7",
  "&Hat;": "^",
  "&Hcirc;": "\u0124",
  "&Hfr;": "\u210C",
  "&HilbertSpace;": "\u210B",
  "&Hopf;": "\u210D",
  "&HorizontalLine;": "\u2500",
  "&Hscr;": "\u210B",
  "&Hstrok;": "\u0126",
  "&HumpDownHump;": "\u224E",
  "&HumpEqual;": "\u224F",
  "&IEcy;": "\u0415",
  "&IJlig;": "\u0132",
  "&IOcy;": "\u0401",
  "&Iacute": "\xCD",
  "&Iacute;": "\xCD",
  "&Icirc": "\xCE",
  "&Icirc;": "\xCE",
  "&Icy;": "\u0418",
  "&Idot;": "\u0130",
  "&Ifr;": "\u2111",
  "&Igrave": "\xCC",
  "&Igrave;": "\xCC",
  "&Im;": "\u2111",
  "&Imacr;": "\u012A",
  "&ImaginaryI;": "\u2148",
  "&Implies;": "\u21D2",
  "&Int;": "\u222C",
  "&Integral;": "\u222B",
  "&Intersection;": "\u22C2",
  "&InvisibleComma;": "\u2063",
  "&InvisibleTimes;": "\u2062",
  "&Iogon;": "\u012E",
  "&Iopf;": "\u{1D540}",
  "&Iota;": "\u0399",
  "&Iscr;": "\u2110",
  "&Itilde;": "\u0128",
  "&Iukcy;": "\u0406",
  "&Iuml": "\xCF",
  "&Iuml;": "\xCF",
  "&Jcirc;": "\u0134",
  "&Jcy;": "\u0419",
  "&Jfr;": "\u{1D50D}",
  "&Jopf;": "\u{1D541}",
  "&Jscr;": "\u{1D4A5}",
  "&Jsercy;": "\u0408",
  "&Jukcy;": "\u0404",
  "&KHcy;": "\u0425",
  "&KJcy;": "\u040C",
  "&Kappa;": "\u039A",
  "&Kcedil;": "\u0136",
  "&Kcy;": "\u041A",
  "&Kfr;": "\u{1D50E}",
  "&Kopf;": "\u{1D542}",
  "&Kscr;": "\u{1D4A6}",
  "&LJcy;": "\u0409",
  "&LT": "<",
  "&LT;": "<",
  "&Lacute;": "\u0139",
  "&Lambda;": "\u039B",
  "&Lang;": "\u27EA",
  "&Laplacetrf;": "\u2112",
  "&Larr;": "\u219E",
  "&Lcaron;": "\u013D",
  "&Lcedil;": "\u013B",
  "&Lcy;": "\u041B",
  "&LeftAngleBracket;": "\u27E8",
  "&LeftArrow;": "\u2190",
  "&LeftArrowBar;": "\u21E4",
  "&LeftArrowRightArrow;": "\u21C6",
  "&LeftCeiling;": "\u2308",
  "&LeftDoubleBracket;": "\u27E6",
  "&LeftDownTeeVector;": "\u2961",
  "&LeftDownVector;": "\u21C3",
  "&LeftDownVectorBar;": "\u2959",
  "&LeftFloor;": "\u230A",
  "&LeftRightArrow;": "\u2194",
  "&LeftRightVector;": "\u294E",
  "&LeftTee;": "\u22A3",
  "&LeftTeeArrow;": "\u21A4",
  "&LeftTeeVector;": "\u295A",
  "&LeftTriangle;": "\u22B2",
  "&LeftTriangleBar;": "\u29CF",
  "&LeftTriangleEqual;": "\u22B4",
  "&LeftUpDownVector;": "\u2951",
  "&LeftUpTeeVector;": "\u2960",
  "&LeftUpVector;": "\u21BF",
  "&LeftUpVectorBar;": "\u2958",
  "&LeftVector;": "\u21BC",
  "&LeftVectorBar;": "\u2952",
  "&Leftarrow;": "\u21D0",
  "&Leftrightarrow;": "\u21D4",
  "&LessEqualGreater;": "\u22DA",
  "&LessFullEqual;": "\u2266",
  "&LessGreater;": "\u2276",
  "&LessLess;": "\u2AA1",
  "&LessSlantEqual;": "\u2A7D",
  "&LessTilde;": "\u2272",
  "&Lfr;": "\u{1D50F}",
  "&Ll;": "\u22D8",
  "&Lleftarrow;": "\u21DA",
  "&Lmidot;": "\u013F",
  "&LongLeftArrow;": "\u27F5",
  "&LongLeftRightArrow;": "\u27F7",
  "&LongRightArrow;": "\u27F6",
  "&Longleftarrow;": "\u27F8",
  "&Longleftrightarrow;": "\u27FA",
  "&Longrightarrow;": "\u27F9",
  "&Lopf;": "\u{1D543}",
  "&LowerLeftArrow;": "\u2199",
  "&LowerRightArrow;": "\u2198",
  "&Lscr;": "\u2112",
  "&Lsh;": "\u21B0",
  "&Lstrok;": "\u0141",
  "&Lt;": "\u226A",
  "&Map;": "\u2905",
  "&Mcy;": "\u041C",
  "&MediumSpace;": "\u205F",
  "&Mellintrf;": "\u2133",
  "&Mfr;": "\u{1D510}",
  "&MinusPlus;": "\u2213",
  "&Mopf;": "\u{1D544}",
  "&Mscr;": "\u2133",
  "&Mu;": "\u039C",
  "&NJcy;": "\u040A",
  "&Nacute;": "\u0143",
  "&Ncaron;": "\u0147",
  "&Ncedil;": "\u0145",
  "&Ncy;": "\u041D",
  "&NegativeMediumSpace;": "\u200B",
  "&NegativeThickSpace;": "\u200B",
  "&NegativeThinSpace;": "\u200B",
  "&NegativeVeryThinSpace;": "\u200B",
  "&NestedGreaterGreater;": "\u226B",
  "&NestedLessLess;": "\u226A",
  "&NewLine;": `
`,
  "&Nfr;": "\u{1D511}",
  "&NoBreak;": "\u2060",
  "&NonBreakingSpace;": "\xA0",
  "&Nopf;": "\u2115",
  "&Not;": "\u2AEC",
  "&NotCongruent;": "\u2262",
  "&NotCupCap;": "\u226D",
  "&NotDoubleVerticalBar;": "\u2226",
  "&NotElement;": "\u2209",
  "&NotEqual;": "\u2260",
  "&NotEqualTilde;": "\u2242\u0338",
  "&NotExists;": "\u2204",
  "&NotGreater;": "\u226F",
  "&NotGreaterEqual;": "\u2271",
  "&NotGreaterFullEqual;": "\u2267\u0338",
  "&NotGreaterGreater;": "\u226B\u0338",
  "&NotGreaterLess;": "\u2279",
  "&NotGreaterSlantEqual;": "\u2A7E\u0338",
  "&NotGreaterTilde;": "\u2275",
  "&NotHumpDownHump;": "\u224E\u0338",
  "&NotHumpEqual;": "\u224F\u0338",
  "&NotLeftTriangle;": "\u22EA",
  "&NotLeftTriangleBar;": "\u29CF\u0338",
  "&NotLeftTriangleEqual;": "\u22EC",
  "&NotLess;": "\u226E",
  "&NotLessEqual;": "\u2270",
  "&NotLessGreater;": "\u2278",
  "&NotLessLess;": "\u226A\u0338",
  "&NotLessSlantEqual;": "\u2A7D\u0338",
  "&NotLessTilde;": "\u2274",
  "&NotNestedGreaterGreater;": "\u2AA2\u0338",
  "&NotNestedLessLess;": "\u2AA1\u0338",
  "&NotPrecedes;": "\u2280",
  "&NotPrecedesEqual;": "\u2AAF\u0338",
  "&NotPrecedesSlantEqual;": "\u22E0",
  "&NotReverseElement;": "\u220C",
  "&NotRightTriangle;": "\u22EB",
  "&NotRightTriangleBar;": "\u29D0\u0338",
  "&NotRightTriangleEqual;": "\u22ED",
  "&NotSquareSubset;": "\u228F\u0338",
  "&NotSquareSubsetEqual;": "\u22E2",
  "&NotSquareSuperset;": "\u2290\u0338",
  "&NotSquareSupersetEqual;": "\u22E3",
  "&NotSubset;": "\u2282\u20D2",
  "&NotSubsetEqual;": "\u2288",
  "&NotSucceeds;": "\u2281",
  "&NotSucceedsEqual;": "\u2AB0\u0338",
  "&NotSucceedsSlantEqual;": "\u22E1",
  "&NotSucceedsTilde;": "\u227F\u0338",
  "&NotSuperset;": "\u2283\u20D2",
  "&NotSupersetEqual;": "\u2289",
  "&NotTilde;": "\u2241",
  "&NotTildeEqual;": "\u2244",
  "&NotTildeFullEqual;": "\u2247",
  "&NotTildeTilde;": "\u2249",
  "&NotVerticalBar;": "\u2224",
  "&Nscr;": "\u{1D4A9}",
  "&Ntilde": "\xD1",
  "&Ntilde;": "\xD1",
  "&Nu;": "\u039D",
  "&OElig;": "\u0152",
  "&Oacute": "\xD3",
  "&Oacute;": "\xD3",
  "&Ocirc": "\xD4",
  "&Ocirc;": "\xD4",
  "&Ocy;": "\u041E",
  "&Odblac;": "\u0150",
  "&Ofr;": "\u{1D512}",
  "&Ograve": "\xD2",
  "&Ograve;": "\xD2",
  "&Omacr;": "\u014C",
  "&Omega;": "\u03A9",
  "&Omicron;": "\u039F",
  "&Oopf;": "\u{1D546}",
  "&OpenCurlyDoubleQuote;": "\u201C",
  "&OpenCurlyQuote;": "\u2018",
  "&Or;": "\u2A54",
  "&Oscr;": "\u{1D4AA}",
  "&Oslash": "\xD8",
  "&Oslash;": "\xD8",
  "&Otilde": "\xD5",
  "&Otilde;": "\xD5",
  "&Otimes;": "\u2A37",
  "&Ouml": "\xD6",
  "&Ouml;": "\xD6",
  "&OverBar;": "\u203E",
  "&OverBrace;": "\u23DE",
  "&OverBracket;": "\u23B4",
  "&OverParenthesis;": "\u23DC",
  "&PartialD;": "\u2202",
  "&Pcy;": "\u041F",
  "&Pfr;": "\u{1D513}",
  "&Phi;": "\u03A6",
  "&Pi;": "\u03A0",
  "&PlusMinus;": "\xB1",
  "&Poincareplane;": "\u210C",
  "&Popf;": "\u2119",
  "&Pr;": "\u2ABB",
  "&Precedes;": "\u227A",
  "&PrecedesEqual;": "\u2AAF",
  "&PrecedesSlantEqual;": "\u227C",
  "&PrecedesTilde;": "\u227E",
  "&Prime;": "\u2033",
  "&Product;": "\u220F",
  "&Proportion;": "\u2237",
  "&Proportional;": "\u221D",
  "&Pscr;": "\u{1D4AB}",
  "&Psi;": "\u03A8",
  "&QUOT": '"',
  "&QUOT;": '"',
  "&Qfr;": "\u{1D514}",
  "&Qopf;": "\u211A",
  "&Qscr;": "\u{1D4AC}",
  "&RBarr;": "\u2910",
  "&REG": "\xAE",
  "&REG;": "\xAE",
  "&Racute;": "\u0154",
  "&Rang;": "\u27EB",
  "&Rarr;": "\u21A0",
  "&Rarrtl;": "\u2916",
  "&Rcaron;": "\u0158",
  "&Rcedil;": "\u0156",
  "&Rcy;": "\u0420",
  "&Re;": "\u211C",
  "&ReverseElement;": "\u220B",
  "&ReverseEquilibrium;": "\u21CB",
  "&ReverseUpEquilibrium;": "\u296F",
  "&Rfr;": "\u211C",
  "&Rho;": "\u03A1",
  "&RightAngleBracket;": "\u27E9",
  "&RightArrow;": "\u2192",
  "&RightArrowBar;": "\u21E5",
  "&RightArrowLeftArrow;": "\u21C4",
  "&RightCeiling;": "\u2309",
  "&RightDoubleBracket;": "\u27E7",
  "&RightDownTeeVector;": "\u295D",
  "&RightDownVector;": "\u21C2",
  "&RightDownVectorBar;": "\u2955",
  "&RightFloor;": "\u230B",
  "&RightTee;": "\u22A2",
  "&RightTeeArrow;": "\u21A6",
  "&RightTeeVector;": "\u295B",
  "&RightTriangle;": "\u22B3",
  "&RightTriangleBar;": "\u29D0",
  "&RightTriangleEqual;": "\u22B5",
  "&RightUpDownVector;": "\u294F",
  "&RightUpTeeVector;": "\u295C",
  "&RightUpVector;": "\u21BE",
  "&RightUpVectorBar;": "\u2954",
  "&RightVector;": "\u21C0",
  "&RightVectorBar;": "\u2953",
  "&Rightarrow;": "\u21D2",
  "&Ropf;": "\u211D",
  "&RoundImplies;": "\u2970",
  "&Rrightarrow;": "\u21DB",
  "&Rscr;": "\u211B",
  "&Rsh;": "\u21B1",
  "&RuleDelayed;": "\u29F4",
  "&SHCHcy;": "\u0429",
  "&SHcy;": "\u0428",
  "&SOFTcy;": "\u042C",
  "&Sacute;": "\u015A",
  "&Sc;": "\u2ABC",
  "&Scaron;": "\u0160",
  "&Scedil;": "\u015E",
  "&Scirc;": "\u015C",
  "&Scy;": "\u0421",
  "&Sfr;": "\u{1D516}",
  "&ShortDownArrow;": "\u2193",
  "&ShortLeftArrow;": "\u2190",
  "&ShortRightArrow;": "\u2192",
  "&ShortUpArrow;": "\u2191",
  "&Sigma;": "\u03A3",
  "&SmallCircle;": "\u2218",
  "&Sopf;": "\u{1D54A}",
  "&Sqrt;": "\u221A",
  "&Square;": "\u25A1",
  "&SquareIntersection;": "\u2293",
  "&SquareSubset;": "\u228F",
  "&SquareSubsetEqual;": "\u2291",
  "&SquareSuperset;": "\u2290",
  "&SquareSupersetEqual;": "\u2292",
  "&SquareUnion;": "\u2294",
  "&Sscr;": "\u{1D4AE}",
  "&Star;": "\u22C6",
  "&Sub;": "\u22D0",
  "&Subset;": "\u22D0",
  "&SubsetEqual;": "\u2286",
  "&Succeeds;": "\u227B",
  "&SucceedsEqual;": "\u2AB0",
  "&SucceedsSlantEqual;": "\u227D",
  "&SucceedsTilde;": "\u227F",
  "&SuchThat;": "\u220B",
  "&Sum;": "\u2211",
  "&Sup;": "\u22D1",
  "&Superset;": "\u2283",
  "&SupersetEqual;": "\u2287",
  "&Supset;": "\u22D1",
  "&THORN": "\xDE",
  "&THORN;": "\xDE",
  "&TRADE;": "\u2122",
  "&TSHcy;": "\u040B",
  "&TScy;": "\u0426",
  "&Tab;": "	",
  "&Tau;": "\u03A4",
  "&Tcaron;": "\u0164",
  "&Tcedil;": "\u0162",
  "&Tcy;": "\u0422",
  "&Tfr;": "\u{1D517}",
  "&Therefore;": "\u2234",
  "&Theta;": "\u0398",
  "&ThickSpace;": "\u205F\u200A",
  "&ThinSpace;": "\u2009",
  "&Tilde;": "\u223C",
  "&TildeEqual;": "\u2243",
  "&TildeFullEqual;": "\u2245",
  "&TildeTilde;": "\u2248",
  "&Topf;": "\u{1D54B}",
  "&TripleDot;": "\u20DB",
  "&Tscr;": "\u{1D4AF}",
  "&Tstrok;": "\u0166",
  "&Uacute": "\xDA",
  "&Uacute;": "\xDA",
  "&Uarr;": "\u219F",
  "&Uarrocir;": "\u2949",
  "&Ubrcy;": "\u040E",
  "&Ubreve;": "\u016C",
  "&Ucirc": "\xDB",
  "&Ucirc;": "\xDB",
  "&Ucy;": "\u0423",
  "&Udblac;": "\u0170",
  "&Ufr;": "\u{1D518}",
  "&Ugrave": "\xD9",
  "&Ugrave;": "\xD9",
  "&Umacr;": "\u016A",
  "&UnderBar;": "_",
  "&UnderBrace;": "\u23DF",
  "&UnderBracket;": "\u23B5",
  "&UnderParenthesis;": "\u23DD",
  "&Union;": "\u22C3",
  "&UnionPlus;": "\u228E",
  "&Uogon;": "\u0172",
  "&Uopf;": "\u{1D54C}",
  "&UpArrow;": "\u2191",
  "&UpArrowBar;": "\u2912",
  "&UpArrowDownArrow;": "\u21C5",
  "&UpDownArrow;": "\u2195",
  "&UpEquilibrium;": "\u296E",
  "&UpTee;": "\u22A5",
  "&UpTeeArrow;": "\u21A5",
  "&Uparrow;": "\u21D1",
  "&Updownarrow;": "\u21D5",
  "&UpperLeftArrow;": "\u2196",
  "&UpperRightArrow;": "\u2197",
  "&Upsi;": "\u03D2",
  "&Upsilon;": "\u03A5",
  "&Uring;": "\u016E",
  "&Uscr;": "\u{1D4B0}",
  "&Utilde;": "\u0168",
  "&Uuml": "\xDC",
  "&Uuml;": "\xDC",
  "&VDash;": "\u22AB",
  "&Vbar;": "\u2AEB",
  "&Vcy;": "\u0412",
  "&Vdash;": "\u22A9",
  "&Vdashl;": "\u2AE6",
  "&Vee;": "\u22C1",
  "&Verbar;": "\u2016",
  "&Vert;": "\u2016",
  "&VerticalBar;": "\u2223",
  "&VerticalLine;": "|",
  "&VerticalSeparator;": "\u2758",
  "&VerticalTilde;": "\u2240",
  "&VeryThinSpace;": "\u200A",
  "&Vfr;": "\u{1D519}",
  "&Vopf;": "\u{1D54D}",
  "&Vscr;": "\u{1D4B1}",
  "&Vvdash;": "\u22AA",
  "&Wcirc;": "\u0174",
  "&Wedge;": "\u22C0",
  "&Wfr;": "\u{1D51A}",
  "&Wopf;": "\u{1D54E}",
  "&Wscr;": "\u{1D4B2}",
  "&Xfr;": "\u{1D51B}",
  "&Xi;": "\u039E",
  "&Xopf;": "\u{1D54F}",
  "&Xscr;": "\u{1D4B3}",
  "&YAcy;": "\u042F",
  "&YIcy;": "\u0407",
  "&YUcy;": "\u042E",
  "&Yacute": "\xDD",
  "&Yacute;": "\xDD",
  "&Ycirc;": "\u0176",
  "&Ycy;": "\u042B",
  "&Yfr;": "\u{1D51C}",
  "&Yopf;": "\u{1D550}",
  "&Yscr;": "\u{1D4B4}",
  "&Yuml;": "\u0178",
  "&ZHcy;": "\u0416",
  "&Zacute;": "\u0179",
  "&Zcaron;": "\u017D",
  "&Zcy;": "\u0417",
  "&Zdot;": "\u017B",
  "&ZeroWidthSpace;": "\u200B",
  "&Zeta;": "\u0396",
  "&Zfr;": "\u2128",
  "&Zopf;": "\u2124",
  "&Zscr;": "\u{1D4B5}",
  "&aacute": "\xE1",
  "&aacute;": "\xE1",
  "&abreve;": "\u0103",
  "&ac;": "\u223E",
  "&acE;": "\u223E\u0333",
  "&acd;": "\u223F",
  "&acirc": "\xE2",
  "&acirc;": "\xE2",
  "&acute": "\xB4",
  "&acute;": "\xB4",
  "&acy;": "\u0430",
  "&aelig": "\xE6",
  "&aelig;": "\xE6",
  "&af;": "\u2061",
  "&afr;": "\u{1D51E}",
  "&agrave": "\xE0",
  "&agrave;": "\xE0",
  "&alefsym;": "\u2135",
  "&aleph;": "\u2135",
  "&alpha;": "\u03B1",
  "&amacr;": "\u0101",
  "&amalg;": "\u2A3F",
  "&amp": "&",
  "&amp;": "&",
  "&and;": "\u2227",
  "&andand;": "\u2A55",
  "&andd;": "\u2A5C",
  "&andslope;": "\u2A58",
  "&andv;": "\u2A5A",
  "&ang;": "\u2220",
  "&ange;": "\u29A4",
  "&angle;": "\u2220",
  "&angmsd;": "\u2221",
  "&angmsdaa;": "\u29A8",
  "&angmsdab;": "\u29A9",
  "&angmsdac;": "\u29AA",
  "&angmsdad;": "\u29AB",
  "&angmsdae;": "\u29AC",
  "&angmsdaf;": "\u29AD",
  "&angmsdag;": "\u29AE",
  "&angmsdah;": "\u29AF",
  "&angrt;": "\u221F",
  "&angrtvb;": "\u22BE",
  "&angrtvbd;": "\u299D",
  "&angsph;": "\u2222",
  "&angst;": "\xC5",
  "&angzarr;": "\u237C",
  "&aogon;": "\u0105",
  "&aopf;": "\u{1D552}",
  "&ap;": "\u2248",
  "&apE;": "\u2A70",
  "&apacir;": "\u2A6F",
  "&ape;": "\u224A",
  "&apid;": "\u224B",
  "&apos;": "'",
  "&approx;": "\u2248",
  "&approxeq;": "\u224A",
  "&aring": "\xE5",
  "&aring;": "\xE5",
  "&ascr;": "\u{1D4B6}",
  "&ast;": "*",
  "&asymp;": "\u2248",
  "&asympeq;": "\u224D",
  "&atilde": "\xE3",
  "&atilde;": "\xE3",
  "&auml": "\xE4",
  "&auml;": "\xE4",
  "&awconint;": "\u2233",
  "&awint;": "\u2A11",
  "&bNot;": "\u2AED",
  "&backcong;": "\u224C",
  "&backepsilon;": "\u03F6",
  "&backprime;": "\u2035",
  "&backsim;": "\u223D",
  "&backsimeq;": "\u22CD",
  "&barvee;": "\u22BD",
  "&barwed;": "\u2305",
  "&barwedge;": "\u2305",
  "&bbrk;": "\u23B5",
  "&bbrktbrk;": "\u23B6",
  "&bcong;": "\u224C",
  "&bcy;": "\u0431",
  "&bdquo;": "\u201E",
  "&becaus;": "\u2235",
  "&because;": "\u2235",
  "&bemptyv;": "\u29B0",
  "&bepsi;": "\u03F6",
  "&bernou;": "\u212C",
  "&beta;": "\u03B2",
  "&beth;": "\u2136",
  "&between;": "\u226C",
  "&bfr;": "\u{1D51F}",
  "&bigcap;": "\u22C2",
  "&bigcirc;": "\u25EF",
  "&bigcup;": "\u22C3",
  "&bigodot;": "\u2A00",
  "&bigoplus;": "\u2A01",
  "&bigotimes;": "\u2A02",
  "&bigsqcup;": "\u2A06",
  "&bigstar;": "\u2605",
  "&bigtriangledown;": "\u25BD",
  "&bigtriangleup;": "\u25B3",
  "&biguplus;": "\u2A04",
  "&bigvee;": "\u22C1",
  "&bigwedge;": "\u22C0",
  "&bkarow;": "\u290D",
  "&blacklozenge;": "\u29EB",
  "&blacksquare;": "\u25AA",
  "&blacktriangle;": "\u25B4",
  "&blacktriangledown;": "\u25BE",
  "&blacktriangleleft;": "\u25C2",
  "&blacktriangleright;": "\u25B8",
  "&blank;": "\u2423",
  "&blk12;": "\u2592",
  "&blk14;": "\u2591",
  "&blk34;": "\u2593",
  "&block;": "\u2588",
  "&bne;": "=\u20E5",
  "&bnequiv;": "\u2261\u20E5",
  "&bnot;": "\u2310",
  "&bopf;": "\u{1D553}",
  "&bot;": "\u22A5",
  "&bottom;": "\u22A5",
  "&bowtie;": "\u22C8",
  "&boxDL;": "\u2557",
  "&boxDR;": "\u2554",
  "&boxDl;": "\u2556",
  "&boxDr;": "\u2553",
  "&boxH;": "\u2550",
  "&boxHD;": "\u2566",
  "&boxHU;": "\u2569",
  "&boxHd;": "\u2564",
  "&boxHu;": "\u2567",
  "&boxUL;": "\u255D",
  "&boxUR;": "\u255A",
  "&boxUl;": "\u255C",
  "&boxUr;": "\u2559",
  "&boxV;": "\u2551",
  "&boxVH;": "\u256C",
  "&boxVL;": "\u2563",
  "&boxVR;": "\u2560",
  "&boxVh;": "\u256B",
  "&boxVl;": "\u2562",
  "&boxVr;": "\u255F",
  "&boxbox;": "\u29C9",
  "&boxdL;": "\u2555",
  "&boxdR;": "\u2552",
  "&boxdl;": "\u2510",
  "&boxdr;": "\u250C",
  "&boxh;": "\u2500",
  "&boxhD;": "\u2565",
  "&boxhU;": "\u2568",
  "&boxhd;": "\u252C",
  "&boxhu;": "\u2534",
  "&boxminus;": "\u229F",
  "&boxplus;": "\u229E",
  "&boxtimes;": "\u22A0",
  "&boxuL;": "\u255B",
  "&boxuR;": "\u2558",
  "&boxul;": "\u2518",
  "&boxur;": "\u2514",
  "&boxv;": "\u2502",
  "&boxvH;": "\u256A",
  "&boxvL;": "\u2561",
  "&boxvR;": "\u255E",
  "&boxvh;": "\u253C",
  "&boxvl;": "\u2524",
  "&boxvr;": "\u251C",
  "&bprime;": "\u2035",
  "&breve;": "\u02D8",
  "&brvbar": "\xA6",
  "&brvbar;": "\xA6",
  "&bscr;": "\u{1D4B7}",
  "&bsemi;": "\u204F",
  "&bsim;": "\u223D",
  "&bsime;": "\u22CD",
  "&bsol;": "\\",
  "&bsolb;": "\u29C5",
  "&bsolhsub;": "\u27C8",
  "&bull;": "\u2022",
  "&bullet;": "\u2022",
  "&bump;": "\u224E",
  "&bumpE;": "\u2AAE",
  "&bumpe;": "\u224F",
  "&bumpeq;": "\u224F",
  "&cacute;": "\u0107",
  "&cap;": "\u2229",
  "&capand;": "\u2A44",
  "&capbrcup;": "\u2A49",
  "&capcap;": "\u2A4B",
  "&capcup;": "\u2A47",
  "&capdot;": "\u2A40",
  "&caps;": "\u2229\uFE00",
  "&caret;": "\u2041",
  "&caron;": "\u02C7",
  "&ccaps;": "\u2A4D",
  "&ccaron;": "\u010D",
  "&ccedil": "\xE7",
  "&ccedil;": "\xE7",
  "&ccirc;": "\u0109",
  "&ccups;": "\u2A4C",
  "&ccupssm;": "\u2A50",
  "&cdot;": "\u010B",
  "&cedil": "\xB8",
  "&cedil;": "\xB8",
  "&cemptyv;": "\u29B2",
  "&cent": "\xA2",
  "&cent;": "\xA2",
  "&centerdot;": "\xB7",
  "&cfr;": "\u{1D520}",
  "&chcy;": "\u0447",
  "&check;": "\u2713",
  "&checkmark;": "\u2713",
  "&chi;": "\u03C7",
  "&cir;": "\u25CB",
  "&cirE;": "\u29C3",
  "&circ;": "\u02C6",
  "&circeq;": "\u2257",
  "&circlearrowleft;": "\u21BA",
  "&circlearrowright;": "\u21BB",
  "&circledR;": "\xAE",
  "&circledS;": "\u24C8",
  "&circledast;": "\u229B",
  "&circledcirc;": "\u229A",
  "&circleddash;": "\u229D",
  "&cire;": "\u2257",
  "&cirfnint;": "\u2A10",
  "&cirmid;": "\u2AEF",
  "&cirscir;": "\u29C2",
  "&clubs;": "\u2663",
  "&clubsuit;": "\u2663",
  "&colon;": ":",
  "&colone;": "\u2254",
  "&coloneq;": "\u2254",
  "&comma;": ",",
  "&commat;": "@",
  "&comp;": "\u2201",
  "&compfn;": "\u2218",
  "&complement;": "\u2201",
  "&complexes;": "\u2102",
  "&cong;": "\u2245",
  "&congdot;": "\u2A6D",
  "&conint;": "\u222E",
  "&copf;": "\u{1D554}",
  "&coprod;": "\u2210",
  "&copy": "\xA9",
  "&copy;": "\xA9",
  "&copysr;": "\u2117",
  "&crarr;": "\u21B5",
  "&cross;": "\u2717",
  "&cscr;": "\u{1D4B8}",
  "&csub;": "\u2ACF",
  "&csube;": "\u2AD1",
  "&csup;": "\u2AD0",
  "&csupe;": "\u2AD2",
  "&ctdot;": "\u22EF",
  "&cudarrl;": "\u2938",
  "&cudarrr;": "\u2935",
  "&cuepr;": "\u22DE",
  "&cuesc;": "\u22DF",
  "&cularr;": "\u21B6",
  "&cularrp;": "\u293D",
  "&cup;": "\u222A",
  "&cupbrcap;": "\u2A48",
  "&cupcap;": "\u2A46",
  "&cupcup;": "\u2A4A",
  "&cupdot;": "\u228D",
  "&cupor;": "\u2A45",
  "&cups;": "\u222A\uFE00",
  "&curarr;": "\u21B7",
  "&curarrm;": "\u293C",
  "&curlyeqprec;": "\u22DE",
  "&curlyeqsucc;": "\u22DF",
  "&curlyvee;": "\u22CE",
  "&curlywedge;": "\u22CF",
  "&curren": "\xA4",
  "&curren;": "\xA4",
  "&curvearrowleft;": "\u21B6",
  "&curvearrowright;": "\u21B7",
  "&cuvee;": "\u22CE",
  "&cuwed;": "\u22CF",
  "&cwconint;": "\u2232",
  "&cwint;": "\u2231",
  "&cylcty;": "\u232D",
  "&dArr;": "\u21D3",
  "&dHar;": "\u2965",
  "&dagger;": "\u2020",
  "&daleth;": "\u2138",
  "&darr;": "\u2193",
  "&dash;": "\u2010",
  "&dashv;": "\u22A3",
  "&dbkarow;": "\u290F",
  "&dblac;": "\u02DD",
  "&dcaron;": "\u010F",
  "&dcy;": "\u0434",
  "&dd;": "\u2146",
  "&ddagger;": "\u2021",
  "&ddarr;": "\u21CA",
  "&ddotseq;": "\u2A77",
  "&deg": "\xB0",
  "&deg;": "\xB0",
  "&delta;": "\u03B4",
  "&demptyv;": "\u29B1",
  "&dfisht;": "\u297F",
  "&dfr;": "\u{1D521}",
  "&dharl;": "\u21C3",
  "&dharr;": "\u21C2",
  "&diam;": "\u22C4",
  "&diamond;": "\u22C4",
  "&diamondsuit;": "\u2666",
  "&diams;": "\u2666",
  "&die;": "\xA8",
  "&digamma;": "\u03DD",
  "&disin;": "\u22F2",
  "&div;": "\xF7",
  "&divide": "\xF7",
  "&divide;": "\xF7",
  "&divideontimes;": "\u22C7",
  "&divonx;": "\u22C7",
  "&djcy;": "\u0452",
  "&dlcorn;": "\u231E",
  "&dlcrop;": "\u230D",
  "&dollar;": "$",
  "&dopf;": "\u{1D555}",
  "&dot;": "\u02D9",
  "&doteq;": "\u2250",
  "&doteqdot;": "\u2251",
  "&dotminus;": "\u2238",
  "&dotplus;": "\u2214",
  "&dotsquare;": "\u22A1",
  "&doublebarwedge;": "\u2306",
  "&downarrow;": "\u2193",
  "&downdownarrows;": "\u21CA",
  "&downharpoonleft;": "\u21C3",
  "&downharpoonright;": "\u21C2",
  "&drbkarow;": "\u2910",
  "&drcorn;": "\u231F",
  "&drcrop;": "\u230C",
  "&dscr;": "\u{1D4B9}",
  "&dscy;": "\u0455",
  "&dsol;": "\u29F6",
  "&dstrok;": "\u0111",
  "&dtdot;": "\u22F1",
  "&dtri;": "\u25BF",
  "&dtrif;": "\u25BE",
  "&duarr;": "\u21F5",
  "&duhar;": "\u296F",
  "&dwangle;": "\u29A6",
  "&dzcy;": "\u045F",
  "&dzigrarr;": "\u27FF",
  "&eDDot;": "\u2A77",
  "&eDot;": "\u2251",
  "&eacute": "\xE9",
  "&eacute;": "\xE9",
  "&easter;": "\u2A6E",
  "&ecaron;": "\u011B",
  "&ecir;": "\u2256",
  "&ecirc": "\xEA",
  "&ecirc;": "\xEA",
  "&ecolon;": "\u2255",
  "&ecy;": "\u044D",
  "&edot;": "\u0117",
  "&ee;": "\u2147",
  "&efDot;": "\u2252",
  "&efr;": "\u{1D522}",
  "&eg;": "\u2A9A",
  "&egrave": "\xE8",
  "&egrave;": "\xE8",
  "&egs;": "\u2A96",
  "&egsdot;": "\u2A98",
  "&el;": "\u2A99",
  "&elinters;": "\u23E7",
  "&ell;": "\u2113",
  "&els;": "\u2A95",
  "&elsdot;": "\u2A97",
  "&emacr;": "\u0113",
  "&empty;": "\u2205",
  "&emptyset;": "\u2205",
  "&emptyv;": "\u2205",
  "&emsp13;": "\u2004",
  "&emsp14;": "\u2005",
  "&emsp;": "\u2003",
  "&eng;": "\u014B",
  "&ensp;": "\u2002",
  "&eogon;": "\u0119",
  "&eopf;": "\u{1D556}",
  "&epar;": "\u22D5",
  "&eparsl;": "\u29E3",
  "&eplus;": "\u2A71",
  "&epsi;": "\u03B5",
  "&epsilon;": "\u03B5",
  "&epsiv;": "\u03F5",
  "&eqcirc;": "\u2256",
  "&eqcolon;": "\u2255",
  "&eqsim;": "\u2242",
  "&eqslantgtr;": "\u2A96",
  "&eqslantless;": "\u2A95",
  "&equals;": "=",
  "&equest;": "\u225F",
  "&equiv;": "\u2261",
  "&equivDD;": "\u2A78",
  "&eqvparsl;": "\u29E5",
  "&erDot;": "\u2253",
  "&erarr;": "\u2971",
  "&escr;": "\u212F",
  "&esdot;": "\u2250",
  "&esim;": "\u2242",
  "&eta;": "\u03B7",
  "&eth": "\xF0",
  "&eth;": "\xF0",
  "&euml": "\xEB",
  "&euml;": "\xEB",
  "&euro;": "\u20AC",
  "&excl;": "!",
  "&exist;": "\u2203",
  "&expectation;": "\u2130",
  "&exponentiale;": "\u2147",
  "&fallingdotseq;": "\u2252",
  "&fcy;": "\u0444",
  "&female;": "\u2640",
  "&ffilig;": "\uFB03",
  "&fflig;": "\uFB00",
  "&ffllig;": "\uFB04",
  "&ffr;": "\u{1D523}",
  "&filig;": "\uFB01",
  "&fjlig;": "fj",
  "&flat;": "\u266D",
  "&fllig;": "\uFB02",
  "&fltns;": "\u25B1",
  "&fnof;": "\u0192",
  "&fopf;": "\u{1D557}",
  "&forall;": "\u2200",
  "&fork;": "\u22D4",
  "&forkv;": "\u2AD9",
  "&fpartint;": "\u2A0D",
  "&frac12": "\xBD",
  "&frac12;": "\xBD",
  "&frac13;": "\u2153",
  "&frac14": "\xBC",
  "&frac14;": "\xBC",
  "&frac15;": "\u2155",
  "&frac16;": "\u2159",
  "&frac18;": "\u215B",
  "&frac23;": "\u2154",
  "&frac25;": "\u2156",
  "&frac34": "\xBE",
  "&frac34;": "\xBE",
  "&frac35;": "\u2157",
  "&frac38;": "\u215C",
  "&frac45;": "\u2158",
  "&frac56;": "\u215A",
  "&frac58;": "\u215D",
  "&frac78;": "\u215E",
  "&frasl;": "\u2044",
  "&frown;": "\u2322",
  "&fscr;": "\u{1D4BB}",
  "&gE;": "\u2267",
  "&gEl;": "\u2A8C",
  "&gacute;": "\u01F5",
  "&gamma;": "\u03B3",
  "&gammad;": "\u03DD",
  "&gap;": "\u2A86",
  "&gbreve;": "\u011F",
  "&gcirc;": "\u011D",
  "&gcy;": "\u0433",
  "&gdot;": "\u0121",
  "&ge;": "\u2265",
  "&gel;": "\u22DB",
  "&geq;": "\u2265",
  "&geqq;": "\u2267",
  "&geqslant;": "\u2A7E",
  "&ges;": "\u2A7E",
  "&gescc;": "\u2AA9",
  "&gesdot;": "\u2A80",
  "&gesdoto;": "\u2A82",
  "&gesdotol;": "\u2A84",
  "&gesl;": "\u22DB\uFE00",
  "&gesles;": "\u2A94",
  "&gfr;": "\u{1D524}",
  "&gg;": "\u226B",
  "&ggg;": "\u22D9",
  "&gimel;": "\u2137",
  "&gjcy;": "\u0453",
  "&gl;": "\u2277",
  "&glE;": "\u2A92",
  "&gla;": "\u2AA5",
  "&glj;": "\u2AA4",
  "&gnE;": "\u2269",
  "&gnap;": "\u2A8A",
  "&gnapprox;": "\u2A8A",
  "&gne;": "\u2A88",
  "&gneq;": "\u2A88",
  "&gneqq;": "\u2269",
  "&gnsim;": "\u22E7",
  "&gopf;": "\u{1D558}",
  "&grave;": "`",
  "&gscr;": "\u210A",
  "&gsim;": "\u2273",
  "&gsime;": "\u2A8E",
  "&gsiml;": "\u2A90",
  "&gt": ">",
  "&gt;": ">",
  "&gtcc;": "\u2AA7",
  "&gtcir;": "\u2A7A",
  "&gtdot;": "\u22D7",
  "&gtlPar;": "\u2995",
  "&gtquest;": "\u2A7C",
  "&gtrapprox;": "\u2A86",
  "&gtrarr;": "\u2978",
  "&gtrdot;": "\u22D7",
  "&gtreqless;": "\u22DB",
  "&gtreqqless;": "\u2A8C",
  "&gtrless;": "\u2277",
  "&gtrsim;": "\u2273",
  "&gvertneqq;": "\u2269\uFE00",
  "&gvnE;": "\u2269\uFE00",
  "&hArr;": "\u21D4",
  "&hairsp;": "\u200A",
  "&half;": "\xBD",
  "&hamilt;": "\u210B",
  "&hardcy;": "\u044A",
  "&harr;": "\u2194",
  "&harrcir;": "\u2948",
  "&harrw;": "\u21AD",
  "&hbar;": "\u210F",
  "&hcirc;": "\u0125",
  "&hearts;": "\u2665",
  "&heartsuit;": "\u2665",
  "&hellip;": "\u2026",
  "&hercon;": "\u22B9",
  "&hfr;": "\u{1D525}",
  "&hksearow;": "\u2925",
  "&hkswarow;": "\u2926",
  "&hoarr;": "\u21FF",
  "&homtht;": "\u223B",
  "&hookleftarrow;": "\u21A9",
  "&hookrightarrow;": "\u21AA",
  "&hopf;": "\u{1D559}",
  "&horbar;": "\u2015",
  "&hscr;": "\u{1D4BD}",
  "&hslash;": "\u210F",
  "&hstrok;": "\u0127",
  "&hybull;": "\u2043",
  "&hyphen;": "\u2010",
  "&iacute": "\xED",
  "&iacute;": "\xED",
  "&ic;": "\u2063",
  "&icirc": "\xEE",
  "&icirc;": "\xEE",
  "&icy;": "\u0438",
  "&iecy;": "\u0435",
  "&iexcl": "\xA1",
  "&iexcl;": "\xA1",
  "&iff;": "\u21D4",
  "&ifr;": "\u{1D526}",
  "&igrave": "\xEC",
  "&igrave;": "\xEC",
  "&ii;": "\u2148",
  "&iiiint;": "\u2A0C",
  "&iiint;": "\u222D",
  "&iinfin;": "\u29DC",
  "&iiota;": "\u2129",
  "&ijlig;": "\u0133",
  "&imacr;": "\u012B",
  "&image;": "\u2111",
  "&imagline;": "\u2110",
  "&imagpart;": "\u2111",
  "&imath;": "\u0131",
  "&imof;": "\u22B7",
  "&imped;": "\u01B5",
  "&in;": "\u2208",
  "&incare;": "\u2105",
  "&infin;": "\u221E",
  "&infintie;": "\u29DD",
  "&inodot;": "\u0131",
  "&int;": "\u222B",
  "&intcal;": "\u22BA",
  "&integers;": "\u2124",
  "&intercal;": "\u22BA",
  "&intlarhk;": "\u2A17",
  "&intprod;": "\u2A3C",
  "&iocy;": "\u0451",
  "&iogon;": "\u012F",
  "&iopf;": "\u{1D55A}",
  "&iota;": "\u03B9",
  "&iprod;": "\u2A3C",
  "&iquest": "\xBF",
  "&iquest;": "\xBF",
  "&iscr;": "\u{1D4BE}",
  "&isin;": "\u2208",
  "&isinE;": "\u22F9",
  "&isindot;": "\u22F5",
  "&isins;": "\u22F4",
  "&isinsv;": "\u22F3",
  "&isinv;": "\u2208",
  "&it;": "\u2062",
  "&itilde;": "\u0129",
  "&iukcy;": "\u0456",
  "&iuml": "\xEF",
  "&iuml;": "\xEF",
  "&jcirc;": "\u0135",
  "&jcy;": "\u0439",
  "&jfr;": "\u{1D527}",
  "&jmath;": "\u0237",
  "&jopf;": "\u{1D55B}",
  "&jscr;": "\u{1D4BF}",
  "&jsercy;": "\u0458",
  "&jukcy;": "\u0454",
  "&kappa;": "\u03BA",
  "&kappav;": "\u03F0",
  "&kcedil;": "\u0137",
  "&kcy;": "\u043A",
  "&kfr;": "\u{1D528}",
  "&kgreen;": "\u0138",
  "&khcy;": "\u0445",
  "&kjcy;": "\u045C",
  "&kopf;": "\u{1D55C}",
  "&kscr;": "\u{1D4C0}",
  "&lAarr;": "\u21DA",
  "&lArr;": "\u21D0",
  "&lAtail;": "\u291B",
  "&lBarr;": "\u290E",
  "&lE;": "\u2266",
  "&lEg;": "\u2A8B",
  "&lHar;": "\u2962",
  "&lacute;": "\u013A",
  "&laemptyv;": "\u29B4",
  "&lagran;": "\u2112",
  "&lambda;": "\u03BB",
  "&lang;": "\u27E8",
  "&langd;": "\u2991",
  "&langle;": "\u27E8",
  "&lap;": "\u2A85",
  "&laquo": "\xAB",
  "&laquo;": "\xAB",
  "&larr;": "\u2190",
  "&larrb;": "\u21E4",
  "&larrbfs;": "\u291F",
  "&larrfs;": "\u291D",
  "&larrhk;": "\u21A9",
  "&larrlp;": "\u21AB",
  "&larrpl;": "\u2939",
  "&larrsim;": "\u2973",
  "&larrtl;": "\u21A2",
  "&lat;": "\u2AAB",
  "&latail;": "\u2919",
  "&late;": "\u2AAD",
  "&lates;": "\u2AAD\uFE00",
  "&lbarr;": "\u290C",
  "&lbbrk;": "\u2772",
  "&lbrace;": "{",
  "&lbrack;": "[",
  "&lbrke;": "\u298B",
  "&lbrksld;": "\u298F",
  "&lbrkslu;": "\u298D",
  "&lcaron;": "\u013E",
  "&lcedil;": "\u013C",
  "&lceil;": "\u2308",
  "&lcub;": "{",
  "&lcy;": "\u043B",
  "&ldca;": "\u2936",
  "&ldquo;": "\u201C",
  "&ldquor;": "\u201E",
  "&ldrdhar;": "\u2967",
  "&ldrushar;": "\u294B",
  "&ldsh;": "\u21B2",
  "&le;": "\u2264",
  "&leftarrow;": "\u2190",
  "&leftarrowtail;": "\u21A2",
  "&leftharpoondown;": "\u21BD",
  "&leftharpoonup;": "\u21BC",
  "&leftleftarrows;": "\u21C7",
  "&leftrightarrow;": "\u2194",
  "&leftrightarrows;": "\u21C6",
  "&leftrightharpoons;": "\u21CB",
  "&leftrightsquigarrow;": "\u21AD",
  "&leftthreetimes;": "\u22CB",
  "&leg;": "\u22DA",
  "&leq;": "\u2264",
  "&leqq;": "\u2266",
  "&leqslant;": "\u2A7D",
  "&les;": "\u2A7D",
  "&lescc;": "\u2AA8",
  "&lesdot;": "\u2A7F",
  "&lesdoto;": "\u2A81",
  "&lesdotor;": "\u2A83",
  "&lesg;": "\u22DA\uFE00",
  "&lesges;": "\u2A93",
  "&lessapprox;": "\u2A85",
  "&lessdot;": "\u22D6",
  "&lesseqgtr;": "\u22DA",
  "&lesseqqgtr;": "\u2A8B",
  "&lessgtr;": "\u2276",
  "&lesssim;": "\u2272",
  "&lfisht;": "\u297C",
  "&lfloor;": "\u230A",
  "&lfr;": "\u{1D529}",
  "&lg;": "\u2276",
  "&lgE;": "\u2A91",
  "&lhard;": "\u21BD",
  "&lharu;": "\u21BC",
  "&lharul;": "\u296A",
  "&lhblk;": "\u2584",
  "&ljcy;": "\u0459",
  "&ll;": "\u226A",
  "&llarr;": "\u21C7",
  "&llcorner;": "\u231E",
  "&llhard;": "\u296B",
  "&lltri;": "\u25FA",
  "&lmidot;": "\u0140",
  "&lmoust;": "\u23B0",
  "&lmoustache;": "\u23B0",
  "&lnE;": "\u2268",
  "&lnap;": "\u2A89",
  "&lnapprox;": "\u2A89",
  "&lne;": "\u2A87",
  "&lneq;": "\u2A87",
  "&lneqq;": "\u2268",
  "&lnsim;": "\u22E6",
  "&loang;": "\u27EC",
  "&loarr;": "\u21FD",
  "&lobrk;": "\u27E6",
  "&longleftarrow;": "\u27F5",
  "&longleftrightarrow;": "\u27F7",
  "&longmapsto;": "\u27FC",
  "&longrightarrow;": "\u27F6",
  "&looparrowleft;": "\u21AB",
  "&looparrowright;": "\u21AC",
  "&lopar;": "\u2985",
  "&lopf;": "\u{1D55D}",
  "&loplus;": "\u2A2D",
  "&lotimes;": "\u2A34",
  "&lowast;": "\u2217",
  "&lowbar;": "_",
  "&loz;": "\u25CA",
  "&lozenge;": "\u25CA",
  "&lozf;": "\u29EB",
  "&lpar;": "(",
  "&lparlt;": "\u2993",
  "&lrarr;": "\u21C6",
  "&lrcorner;": "\u231F",
  "&lrhar;": "\u21CB",
  "&lrhard;": "\u296D",
  "&lrm;": "\u200E",
  "&lrtri;": "\u22BF",
  "&lsaquo;": "\u2039",
  "&lscr;": "\u{1D4C1}",
  "&lsh;": "\u21B0",
  "&lsim;": "\u2272",
  "&lsime;": "\u2A8D",
  "&lsimg;": "\u2A8F",
  "&lsqb;": "[",
  "&lsquo;": "\u2018",
  "&lsquor;": "\u201A",
  "&lstrok;": "\u0142",
  "&lt": "<",
  "&lt;": "<",
  "&ltcc;": "\u2AA6",
  "&ltcir;": "\u2A79",
  "&ltdot;": "\u22D6",
  "&lthree;": "\u22CB",
  "&ltimes;": "\u22C9",
  "&ltlarr;": "\u2976",
  "&ltquest;": "\u2A7B",
  "&ltrPar;": "\u2996",
  "&ltri;": "\u25C3",
  "&ltrie;": "\u22B4",
  "&ltrif;": "\u25C2",
  "&lurdshar;": "\u294A",
  "&luruhar;": "\u2966",
  "&lvertneqq;": "\u2268\uFE00",
  "&lvnE;": "\u2268\uFE00",
  "&mDDot;": "\u223A",
  "&macr": "\xAF",
  "&macr;": "\xAF",
  "&male;": "\u2642",
  "&malt;": "\u2720",
  "&maltese;": "\u2720",
  "&map;": "\u21A6",
  "&mapsto;": "\u21A6",
  "&mapstodown;": "\u21A7",
  "&mapstoleft;": "\u21A4",
  "&mapstoup;": "\u21A5",
  "&marker;": "\u25AE",
  "&mcomma;": "\u2A29",
  "&mcy;": "\u043C",
  "&mdash;": "\u2014",
  "&measuredangle;": "\u2221",
  "&mfr;": "\u{1D52A}",
  "&mho;": "\u2127",
  "&micro": "\xB5",
  "&micro;": "\xB5",
  "&mid;": "\u2223",
  "&midast;": "*",
  "&midcir;": "\u2AF0",
  "&middot": "\xB7",
  "&middot;": "\xB7",
  "&minus;": "\u2212",
  "&minusb;": "\u229F",
  "&minusd;": "\u2238",
  "&minusdu;": "\u2A2A",
  "&mlcp;": "\u2ADB",
  "&mldr;": "\u2026",
  "&mnplus;": "\u2213",
  "&models;": "\u22A7",
  "&mopf;": "\u{1D55E}",
  "&mp;": "\u2213",
  "&mscr;": "\u{1D4C2}",
  "&mstpos;": "\u223E",
  "&mu;": "\u03BC",
  "&multimap;": "\u22B8",
  "&mumap;": "\u22B8",
  "&nGg;": "\u22D9\u0338",
  "&nGt;": "\u226B\u20D2",
  "&nGtv;": "\u226B\u0338",
  "&nLeftarrow;": "\u21CD",
  "&nLeftrightarrow;": "\u21CE",
  "&nLl;": "\u22D8\u0338",
  "&nLt;": "\u226A\u20D2",
  "&nLtv;": "\u226A\u0338",
  "&nRightarrow;": "\u21CF",
  "&nVDash;": "\u22AF",
  "&nVdash;": "\u22AE",
  "&nabla;": "\u2207",
  "&nacute;": "\u0144",
  "&nang;": "\u2220\u20D2",
  "&nap;": "\u2249",
  "&napE;": "\u2A70\u0338",
  "&napid;": "\u224B\u0338",
  "&napos;": "\u0149",
  "&napprox;": "\u2249",
  "&natur;": "\u266E",
  "&natural;": "\u266E",
  "&naturals;": "\u2115",
  "&nbsp": "\xA0",
  "&nbsp;": "\xA0",
  "&nbump;": "\u224E\u0338",
  "&nbumpe;": "\u224F\u0338",
  "&ncap;": "\u2A43",
  "&ncaron;": "\u0148",
  "&ncedil;": "\u0146",
  "&ncong;": "\u2247",
  "&ncongdot;": "\u2A6D\u0338",
  "&ncup;": "\u2A42",
  "&ncy;": "\u043D",
  "&ndash;": "\u2013",
  "&ne;": "\u2260",
  "&neArr;": "\u21D7",
  "&nearhk;": "\u2924",
  "&nearr;": "\u2197",
  "&nearrow;": "\u2197",
  "&nedot;": "\u2250\u0338",
  "&nequiv;": "\u2262",
  "&nesear;": "\u2928",
  "&nesim;": "\u2242\u0338",
  "&nexist;": "\u2204",
  "&nexists;": "\u2204",
  "&nfr;": "\u{1D52B}",
  "&ngE;": "\u2267\u0338",
  "&nge;": "\u2271",
  "&ngeq;": "\u2271",
  "&ngeqq;": "\u2267\u0338",
  "&ngeqslant;": "\u2A7E\u0338",
  "&nges;": "\u2A7E\u0338",
  "&ngsim;": "\u2275",
  "&ngt;": "\u226F",
  "&ngtr;": "\u226F",
  "&nhArr;": "\u21CE",
  "&nharr;": "\u21AE",
  "&nhpar;": "\u2AF2",
  "&ni;": "\u220B",
  "&nis;": "\u22FC",
  "&nisd;": "\u22FA",
  "&niv;": "\u220B",
  "&njcy;": "\u045A",
  "&nlArr;": "\u21CD",
  "&nlE;": "\u2266\u0338",
  "&nlarr;": "\u219A",
  "&nldr;": "\u2025",
  "&nle;": "\u2270",
  "&nleftarrow;": "\u219A",
  "&nleftrightarrow;": "\u21AE",
  "&nleq;": "\u2270",
  "&nleqq;": "\u2266\u0338",
  "&nleqslant;": "\u2A7D\u0338",
  "&nles;": "\u2A7D\u0338",
  "&nless;": "\u226E",
  "&nlsim;": "\u2274",
  "&nlt;": "\u226E",
  "&nltri;": "\u22EA",
  "&nltrie;": "\u22EC",
  "&nmid;": "\u2224",
  "&nopf;": "\u{1D55F}",
  "&not": "\xAC",
  "&not;": "\xAC",
  "&notin;": "\u2209",
  "&notinE;": "\u22F9\u0338",
  "&notindot;": "\u22F5\u0338",
  "&notinva;": "\u2209",
  "&notinvb;": "\u22F7",
  "&notinvc;": "\u22F6",
  "&notni;": "\u220C",
  "&notniva;": "\u220C",
  "&notnivb;": "\u22FE",
  "&notnivc;": "\u22FD",
  "&npar;": "\u2226",
  "&nparallel;": "\u2226",
  "&nparsl;": "\u2AFD\u20E5",
  "&npart;": "\u2202\u0338",
  "&npolint;": "\u2A14",
  "&npr;": "\u2280",
  "&nprcue;": "\u22E0",
  "&npre;": "\u2AAF\u0338",
  "&nprec;": "\u2280",
  "&npreceq;": "\u2AAF\u0338",
  "&nrArr;": "\u21CF",
  "&nrarr;": "\u219B",
  "&nrarrc;": "\u2933\u0338",
  "&nrarrw;": "\u219D\u0338",
  "&nrightarrow;": "\u219B",
  "&nrtri;": "\u22EB",
  "&nrtrie;": "\u22ED",
  "&nsc;": "\u2281",
  "&nsccue;": "\u22E1",
  "&nsce;": "\u2AB0\u0338",
  "&nscr;": "\u{1D4C3}",
  "&nshortmid;": "\u2224",
  "&nshortparallel;": "\u2226",
  "&nsim;": "\u2241",
  "&nsime;": "\u2244",
  "&nsimeq;": "\u2244",
  "&nsmid;": "\u2224",
  "&nspar;": "\u2226",
  "&nsqsube;": "\u22E2",
  "&nsqsupe;": "\u22E3",
  "&nsub;": "\u2284",
  "&nsubE;": "\u2AC5\u0338",
  "&nsube;": "\u2288",
  "&nsubset;": "\u2282\u20D2",
  "&nsubseteq;": "\u2288",
  "&nsubseteqq;": "\u2AC5\u0338",
  "&nsucc;": "\u2281",
  "&nsucceq;": "\u2AB0\u0338",
  "&nsup;": "\u2285",
  "&nsupE;": "\u2AC6\u0338",
  "&nsupe;": "\u2289",
  "&nsupset;": "\u2283\u20D2",
  "&nsupseteq;": "\u2289",
  "&nsupseteqq;": "\u2AC6\u0338",
  "&ntgl;": "\u2279",
  "&ntilde": "\xF1",
  "&ntilde;": "\xF1",
  "&ntlg;": "\u2278",
  "&ntriangleleft;": "\u22EA",
  "&ntrianglelefteq;": "\u22EC",
  "&ntriangleright;": "\u22EB",
  "&ntrianglerighteq;": "\u22ED",
  "&nu;": "\u03BD",
  "&num;": "#",
  "&numero;": "\u2116",
  "&numsp;": "\u2007",
  "&nvDash;": "\u22AD",
  "&nvHarr;": "\u2904",
  "&nvap;": "\u224D\u20D2",
  "&nvdash;": "\u22AC",
  "&nvge;": "\u2265\u20D2",
  "&nvgt;": ">\u20D2",
  "&nvinfin;": "\u29DE",
  "&nvlArr;": "\u2902",
  "&nvle;": "\u2264\u20D2",
  "&nvlt;": "<\u20D2",
  "&nvltrie;": "\u22B4\u20D2",
  "&nvrArr;": "\u2903",
  "&nvrtrie;": "\u22B5\u20D2",
  "&nvsim;": "\u223C\u20D2",
  "&nwArr;": "\u21D6",
  "&nwarhk;": "\u2923",
  "&nwarr;": "\u2196",
  "&nwarrow;": "\u2196",
  "&nwnear;": "\u2927",
  "&oS;": "\u24C8",
  "&oacute": "\xF3",
  "&oacute;": "\xF3",
  "&oast;": "\u229B",
  "&ocir;": "\u229A",
  "&ocirc": "\xF4",
  "&ocirc;": "\xF4",
  "&ocy;": "\u043E",
  "&odash;": "\u229D",
  "&odblac;": "\u0151",
  "&odiv;": "\u2A38",
  "&odot;": "\u2299",
  "&odsold;": "\u29BC",
  "&oelig;": "\u0153",
  "&ofcir;": "\u29BF",
  "&ofr;": "\u{1D52C}",
  "&ogon;": "\u02DB",
  "&ograve": "\xF2",
  "&ograve;": "\xF2",
  "&ogt;": "\u29C1",
  "&ohbar;": "\u29B5",
  "&ohm;": "\u03A9",
  "&oint;": "\u222E",
  "&olarr;": "\u21BA",
  "&olcir;": "\u29BE",
  "&olcross;": "\u29BB",
  "&oline;": "\u203E",
  "&olt;": "\u29C0",
  "&omacr;": "\u014D",
  "&omega;": "\u03C9",
  "&omicron;": "\u03BF",
  "&omid;": "\u29B6",
  "&ominus;": "\u2296",
  "&oopf;": "\u{1D560}",
  "&opar;": "\u29B7",
  "&operp;": "\u29B9",
  "&oplus;": "\u2295",
  "&or;": "\u2228",
  "&orarr;": "\u21BB",
  "&ord;": "\u2A5D",
  "&order;": "\u2134",
  "&orderof;": "\u2134",
  "&ordf": "\xAA",
  "&ordf;": "\xAA",
  "&ordm": "\xBA",
  "&ordm;": "\xBA",
  "&origof;": "\u22B6",
  "&oror;": "\u2A56",
  "&orslope;": "\u2A57",
  "&orv;": "\u2A5B",
  "&oscr;": "\u2134",
  "&oslash": "\xF8",
  "&oslash;": "\xF8",
  "&osol;": "\u2298",
  "&otilde": "\xF5",
  "&otilde;": "\xF5",
  "&otimes;": "\u2297",
  "&otimesas;": "\u2A36",
  "&ouml": "\xF6",
  "&ouml;": "\xF6",
  "&ovbar;": "\u233D",
  "&par;": "\u2225",
  "&para": "\xB6",
  "&para;": "\xB6",
  "&parallel;": "\u2225",
  "&parsim;": "\u2AF3",
  "&parsl;": "\u2AFD",
  "&part;": "\u2202",
  "&pcy;": "\u043F",
  "&percnt;": "%",
  "&period;": ".",
  "&permil;": "\u2030",
  "&perp;": "\u22A5",
  "&pertenk;": "\u2031",
  "&pfr;": "\u{1D52D}",
  "&phi;": "\u03C6",
  "&phiv;": "\u03D5",
  "&phmmat;": "\u2133",
  "&phone;": "\u260E",
  "&pi;": "\u03C0",
  "&pitchfork;": "\u22D4",
  "&piv;": "\u03D6",
  "&planck;": "\u210F",
  "&planckh;": "\u210E",
  "&plankv;": "\u210F",
  "&plus;": "+",
  "&plusacir;": "\u2A23",
  "&plusb;": "\u229E",
  "&pluscir;": "\u2A22",
  "&plusdo;": "\u2214",
  "&plusdu;": "\u2A25",
  "&pluse;": "\u2A72",
  "&plusmn": "\xB1",
  "&plusmn;": "\xB1",
  "&plussim;": "\u2A26",
  "&plustwo;": "\u2A27",
  "&pm;": "\xB1",
  "&pointint;": "\u2A15",
  "&popf;": "\u{1D561}",
  "&pound": "\xA3",
  "&pound;": "\xA3",
  "&pr;": "\u227A",
  "&prE;": "\u2AB3",
  "&prap;": "\u2AB7",
  "&prcue;": "\u227C",
  "&pre;": "\u2AAF",
  "&prec;": "\u227A",
  "&precapprox;": "\u2AB7",
  "&preccurlyeq;": "\u227C",
  "&preceq;": "\u2AAF",
  "&precnapprox;": "\u2AB9",
  "&precneqq;": "\u2AB5",
  "&precnsim;": "\u22E8",
  "&precsim;": "\u227E",
  "&prime;": "\u2032",
  "&primes;": "\u2119",
  "&prnE;": "\u2AB5",
  "&prnap;": "\u2AB9",
  "&prnsim;": "\u22E8",
  "&prod;": "\u220F",
  "&profalar;": "\u232E",
  "&profline;": "\u2312",
  "&profsurf;": "\u2313",
  "&prop;": "\u221D",
  "&propto;": "\u221D",
  "&prsim;": "\u227E",
  "&prurel;": "\u22B0",
  "&pscr;": "\u{1D4C5}",
  "&psi;": "\u03C8",
  "&puncsp;": "\u2008",
  "&qfr;": "\u{1D52E}",
  "&qint;": "\u2A0C",
  "&qopf;": "\u{1D562}",
  "&qprime;": "\u2057",
  "&qscr;": "\u{1D4C6}",
  "&quaternions;": "\u210D",
  "&quatint;": "\u2A16",
  "&quest;": "?",
  "&questeq;": "\u225F",
  "&quot": '"',
  "&quot;": '"',
  "&rAarr;": "\u21DB",
  "&rArr;": "\u21D2",
  "&rAtail;": "\u291C",
  "&rBarr;": "\u290F",
  "&rHar;": "\u2964",
  "&race;": "\u223D\u0331",
  "&racute;": "\u0155",
  "&radic;": "\u221A",
  "&raemptyv;": "\u29B3",
  "&rang;": "\u27E9",
  "&rangd;": "\u2992",
  "&range;": "\u29A5",
  "&rangle;": "\u27E9",
  "&raquo": "\xBB",
  "&raquo;": "\xBB",
  "&rarr;": "\u2192",
  "&rarrap;": "\u2975",
  "&rarrb;": "\u21E5",
  "&rarrbfs;": "\u2920",
  "&rarrc;": "\u2933",
  "&rarrfs;": "\u291E",
  "&rarrhk;": "\u21AA",
  "&rarrlp;": "\u21AC",
  "&rarrpl;": "\u2945",
  "&rarrsim;": "\u2974",
  "&rarrtl;": "\u21A3",
  "&rarrw;": "\u219D",
  "&ratail;": "\u291A",
  "&ratio;": "\u2236",
  "&rationals;": "\u211A",
  "&rbarr;": "\u290D",
  "&rbbrk;": "\u2773",
  "&rbrace;": "}",
  "&rbrack;": "]",
  "&rbrke;": "\u298C",
  "&rbrksld;": "\u298E",
  "&rbrkslu;": "\u2990",
  "&rcaron;": "\u0159",
  "&rcedil;": "\u0157",
  "&rceil;": "\u2309",
  "&rcub;": "}",
  "&rcy;": "\u0440",
  "&rdca;": "\u2937",
  "&rdldhar;": "\u2969",
  "&rdquo;": "\u201D",
  "&rdquor;": "\u201D",
  "&rdsh;": "\u21B3",
  "&real;": "\u211C",
  "&realine;": "\u211B",
  "&realpart;": "\u211C",
  "&reals;": "\u211D",
  "&rect;": "\u25AD",
  "&reg": "\xAE",
  "&reg;": "\xAE",
  "&rfisht;": "\u297D",
  "&rfloor;": "\u230B",
  "&rfr;": "\u{1D52F}",
  "&rhard;": "\u21C1",
  "&rharu;": "\u21C0",
  "&rharul;": "\u296C",
  "&rho;": "\u03C1",
  "&rhov;": "\u03F1",
  "&rightarrow;": "\u2192",
  "&rightarrowtail;": "\u21A3",
  "&rightharpoondown;": "\u21C1",
  "&rightharpoonup;": "\u21C0",
  "&rightleftarrows;": "\u21C4",
  "&rightleftharpoons;": "\u21CC",
  "&rightrightarrows;": "\u21C9",
  "&rightsquigarrow;": "\u219D",
  "&rightthreetimes;": "\u22CC",
  "&ring;": "\u02DA",
  "&risingdotseq;": "\u2253",
  "&rlarr;": "\u21C4",
  "&rlhar;": "\u21CC",
  "&rlm;": "\u200F",
  "&rmoust;": "\u23B1",
  "&rmoustache;": "\u23B1",
  "&rnmid;": "\u2AEE",
  "&roang;": "\u27ED",
  "&roarr;": "\u21FE",
  "&robrk;": "\u27E7",
  "&ropar;": "\u2986",
  "&ropf;": "\u{1D563}",
  "&roplus;": "\u2A2E",
  "&rotimes;": "\u2A35",
  "&rpar;": ")",
  "&rpargt;": "\u2994",
  "&rppolint;": "\u2A12",
  "&rrarr;": "\u21C9",
  "&rsaquo;": "\u203A",
  "&rscr;": "\u{1D4C7}",
  "&rsh;": "\u21B1",
  "&rsqb;": "]",
  "&rsquo;": "\u2019",
  "&rsquor;": "\u2019",
  "&rthree;": "\u22CC",
  "&rtimes;": "\u22CA",
  "&rtri;": "\u25B9",
  "&rtrie;": "\u22B5",
  "&rtrif;": "\u25B8",
  "&rtriltri;": "\u29CE",
  "&ruluhar;": "\u2968",
  "&rx;": "\u211E",
  "&sacute;": "\u015B",
  "&sbquo;": "\u201A",
  "&sc;": "\u227B",
  "&scE;": "\u2AB4",
  "&scap;": "\u2AB8",
  "&scaron;": "\u0161",
  "&sccue;": "\u227D",
  "&sce;": "\u2AB0",
  "&scedil;": "\u015F",
  "&scirc;": "\u015D",
  "&scnE;": "\u2AB6",
  "&scnap;": "\u2ABA",
  "&scnsim;": "\u22E9",
  "&scpolint;": "\u2A13",
  "&scsim;": "\u227F",
  "&scy;": "\u0441",
  "&sdot;": "\u22C5",
  "&sdotb;": "\u22A1",
  "&sdote;": "\u2A66",
  "&seArr;": "\u21D8",
  "&searhk;": "\u2925",
  "&searr;": "\u2198",
  "&searrow;": "\u2198",
  "&sect": "\xA7",
  "&sect;": "\xA7",
  "&semi;": ";",
  "&seswar;": "\u2929",
  "&setminus;": "\u2216",
  "&setmn;": "\u2216",
  "&sext;": "\u2736",
  "&sfr;": "\u{1D530}",
  "&sfrown;": "\u2322",
  "&sharp;": "\u266F",
  "&shchcy;": "\u0449",
  "&shcy;": "\u0448",
  "&shortmid;": "\u2223",
  "&shortparallel;": "\u2225",
  "&shy": "\xAD",
  "&shy;": "\xAD",
  "&sigma;": "\u03C3",
  "&sigmaf;": "\u03C2",
  "&sigmav;": "\u03C2",
  "&sim;": "\u223C",
  "&simdot;": "\u2A6A",
  "&sime;": "\u2243",
  "&simeq;": "\u2243",
  "&simg;": "\u2A9E",
  "&simgE;": "\u2AA0",
  "&siml;": "\u2A9D",
  "&simlE;": "\u2A9F",
  "&simne;": "\u2246",
  "&simplus;": "\u2A24",
  "&simrarr;": "\u2972",
  "&slarr;": "\u2190",
  "&smallsetminus;": "\u2216",
  "&smashp;": "\u2A33",
  "&smeparsl;": "\u29E4",
  "&smid;": "\u2223",
  "&smile;": "\u2323",
  "&smt;": "\u2AAA",
  "&smte;": "\u2AAC",
  "&smtes;": "\u2AAC\uFE00",
  "&softcy;": "\u044C",
  "&sol;": "/",
  "&solb;": "\u29C4",
  "&solbar;": "\u233F",
  "&sopf;": "\u{1D564}",
  "&spades;": "\u2660",
  "&spadesuit;": "\u2660",
  "&spar;": "\u2225",
  "&sqcap;": "\u2293",
  "&sqcaps;": "\u2293\uFE00",
  "&sqcup;": "\u2294",
  "&sqcups;": "\u2294\uFE00",
  "&sqsub;": "\u228F",
  "&sqsube;": "\u2291",
  "&sqsubset;": "\u228F",
  "&sqsubseteq;": "\u2291",
  "&sqsup;": "\u2290",
  "&sqsupe;": "\u2292",
  "&sqsupset;": "\u2290",
  "&sqsupseteq;": "\u2292",
  "&squ;": "\u25A1",
  "&square;": "\u25A1",
  "&squarf;": "\u25AA",
  "&squf;": "\u25AA",
  "&srarr;": "\u2192",
  "&sscr;": "\u{1D4C8}",
  "&ssetmn;": "\u2216",
  "&ssmile;": "\u2323",
  "&sstarf;": "\u22C6",
  "&star;": "\u2606",
  "&starf;": "\u2605",
  "&straightepsilon;": "\u03F5",
  "&straightphi;": "\u03D5",
  "&strns;": "\xAF",
  "&sub;": "\u2282",
  "&subE;": "\u2AC5",
  "&subdot;": "\u2ABD",
  "&sube;": "\u2286",
  "&subedot;": "\u2AC3",
  "&submult;": "\u2AC1",
  "&subnE;": "\u2ACB",
  "&subne;": "\u228A",
  "&subplus;": "\u2ABF",
  "&subrarr;": "\u2979",
  "&subset;": "\u2282",
  "&subseteq;": "\u2286",
  "&subseteqq;": "\u2AC5",
  "&subsetneq;": "\u228A",
  "&subsetneqq;": "\u2ACB",
  "&subsim;": "\u2AC7",
  "&subsub;": "\u2AD5",
  "&subsup;": "\u2AD3",
  "&succ;": "\u227B",
  "&succapprox;": "\u2AB8",
  "&succcurlyeq;": "\u227D",
  "&succeq;": "\u2AB0",
  "&succnapprox;": "\u2ABA",
  "&succneqq;": "\u2AB6",
  "&succnsim;": "\u22E9",
  "&succsim;": "\u227F",
  "&sum;": "\u2211",
  "&sung;": "\u266A",
  "&sup1": "\xB9",
  "&sup1;": "\xB9",
  "&sup2": "\xB2",
  "&sup2;": "\xB2",
  "&sup3": "\xB3",
  "&sup3;": "\xB3",
  "&sup;": "\u2283",
  "&supE;": "\u2AC6",
  "&supdot;": "\u2ABE",
  "&supdsub;": "\u2AD8",
  "&supe;": "\u2287",
  "&supedot;": "\u2AC4",
  "&suphsol;": "\u27C9",
  "&suphsub;": "\u2AD7",
  "&suplarr;": "\u297B",
  "&supmult;": "\u2AC2",
  "&supnE;": "\u2ACC",
  "&supne;": "\u228B",
  "&supplus;": "\u2AC0",
  "&supset;": "\u2283",
  "&supseteq;": "\u2287",
  "&supseteqq;": "\u2AC6",
  "&supsetneq;": "\u228B",
  "&supsetneqq;": "\u2ACC",
  "&supsim;": "\u2AC8",
  "&supsub;": "\u2AD4",
  "&supsup;": "\u2AD6",
  "&swArr;": "\u21D9",
  "&swarhk;": "\u2926",
  "&swarr;": "\u2199",
  "&swarrow;": "\u2199",
  "&swnwar;": "\u292A",
  "&szlig": "\xDF",
  "&szlig;": "\xDF",
  "&target;": "\u2316",
  "&tau;": "\u03C4",
  "&tbrk;": "\u23B4",
  "&tcaron;": "\u0165",
  "&tcedil;": "\u0163",
  "&tcy;": "\u0442",
  "&tdot;": "\u20DB",
  "&telrec;": "\u2315",
  "&tfr;": "\u{1D531}",
  "&there4;": "\u2234",
  "&therefore;": "\u2234",
  "&theta;": "\u03B8",
  "&thetasym;": "\u03D1",
  "&thetav;": "\u03D1",
  "&thickapprox;": "\u2248",
  "&thicksim;": "\u223C",
  "&thinsp;": "\u2009",
  "&thkap;": "\u2248",
  "&thksim;": "\u223C",
  "&thorn": "\xFE",
  "&thorn;": "\xFE",
  "&tilde;": "\u02DC",
  "&times": "\xD7",
  "&times;": "\xD7",
  "&timesb;": "\u22A0",
  "&timesbar;": "\u2A31",
  "&timesd;": "\u2A30",
  "&tint;": "\u222D",
  "&toea;": "\u2928",
  "&top;": "\u22A4",
  "&topbot;": "\u2336",
  "&topcir;": "\u2AF1",
  "&topf;": "\u{1D565}",
  "&topfork;": "\u2ADA",
  "&tosa;": "\u2929",
  "&tprime;": "\u2034",
  "&trade;": "\u2122",
  "&triangle;": "\u25B5",
  "&triangledown;": "\u25BF",
  "&triangleleft;": "\u25C3",
  "&trianglelefteq;": "\u22B4",
  "&triangleq;": "\u225C",
  "&triangleright;": "\u25B9",
  "&trianglerighteq;": "\u22B5",
  "&tridot;": "\u25EC",
  "&trie;": "\u225C",
  "&triminus;": "\u2A3A",
  "&triplus;": "\u2A39",
  "&trisb;": "\u29CD",
  "&tritime;": "\u2A3B",
  "&trpezium;": "\u23E2",
  "&tscr;": "\u{1D4C9}",
  "&tscy;": "\u0446",
  "&tshcy;": "\u045B",
  "&tstrok;": "\u0167",
  "&twixt;": "\u226C",
  "&twoheadleftarrow;": "\u219E",
  "&twoheadrightarrow;": "\u21A0",
  "&uArr;": "\u21D1",
  "&uHar;": "\u2963",
  "&uacute": "\xFA",
  "&uacute;": "\xFA",
  "&uarr;": "\u2191",
  "&ubrcy;": "\u045E",
  "&ubreve;": "\u016D",
  "&ucirc": "\xFB",
  "&ucirc;": "\xFB",
  "&ucy;": "\u0443",
  "&udarr;": "\u21C5",
  "&udblac;": "\u0171",
  "&udhar;": "\u296E",
  "&ufisht;": "\u297E",
  "&ufr;": "\u{1D532}",
  "&ugrave": "\xF9",
  "&ugrave;": "\xF9",
  "&uharl;": "\u21BF",
  "&uharr;": "\u21BE",
  "&uhblk;": "\u2580",
  "&ulcorn;": "\u231C",
  "&ulcorner;": "\u231C",
  "&ulcrop;": "\u230F",
  "&ultri;": "\u25F8",
  "&umacr;": "\u016B",
  "&uml": "\xA8",
  "&uml;": "\xA8",
  "&uogon;": "\u0173",
  "&uopf;": "\u{1D566}",
  "&uparrow;": "\u2191",
  "&updownarrow;": "\u2195",
  "&upharpoonleft;": "\u21BF",
  "&upharpoonright;": "\u21BE",
  "&uplus;": "\u228E",
  "&upsi;": "\u03C5",
  "&upsih;": "\u03D2",
  "&upsilon;": "\u03C5",
  "&upuparrows;": "\u21C8",
  "&urcorn;": "\u231D",
  "&urcorner;": "\u231D",
  "&urcrop;": "\u230E",
  "&uring;": "\u016F",
  "&urtri;": "\u25F9",
  "&uscr;": "\u{1D4CA}",
  "&utdot;": "\u22F0",
  "&utilde;": "\u0169",
  "&utri;": "\u25B5",
  "&utrif;": "\u25B4",
  "&uuarr;": "\u21C8",
  "&uuml": "\xFC",
  "&uuml;": "\xFC",
  "&uwangle;": "\u29A7",
  "&vArr;": "\u21D5",
  "&vBar;": "\u2AE8",
  "&vBarv;": "\u2AE9",
  "&vDash;": "\u22A8",
  "&vangrt;": "\u299C",
  "&varepsilon;": "\u03F5",
  "&varkappa;": "\u03F0",
  "&varnothing;": "\u2205",
  "&varphi;": "\u03D5",
  "&varpi;": "\u03D6",
  "&varpropto;": "\u221D",
  "&varr;": "\u2195",
  "&varrho;": "\u03F1",
  "&varsigma;": "\u03C2",
  "&varsubsetneq;": "\u228A\uFE00",
  "&varsubsetneqq;": "\u2ACB\uFE00",
  "&varsupsetneq;": "\u228B\uFE00",
  "&varsupsetneqq;": "\u2ACC\uFE00",
  "&vartheta;": "\u03D1",
  "&vartriangleleft;": "\u22B2",
  "&vartriangleright;": "\u22B3",
  "&vcy;": "\u0432",
  "&vdash;": "\u22A2",
  "&vee;": "\u2228",
  "&veebar;": "\u22BB",
  "&veeeq;": "\u225A",
  "&vellip;": "\u22EE",
  "&verbar;": "|",
  "&vert;": "|",
  "&vfr;": "\u{1D533}",
  "&vltri;": "\u22B2",
  "&vnsub;": "\u2282\u20D2",
  "&vnsup;": "\u2283\u20D2",
  "&vopf;": "\u{1D567}",
  "&vprop;": "\u221D",
  "&vrtri;": "\u22B3",
  "&vscr;": "\u{1D4CB}",
  "&vsubnE;": "\u2ACB\uFE00",
  "&vsubne;": "\u228A\uFE00",
  "&vsupnE;": "\u2ACC\uFE00",
  "&vsupne;": "\u228B\uFE00",
  "&vzigzag;": "\u299A",
  "&wcirc;": "\u0175",
  "&wedbar;": "\u2A5F",
  "&wedge;": "\u2227",
  "&wedgeq;": "\u2259",
  "&weierp;": "\u2118",
  "&wfr;": "\u{1D534}",
  "&wopf;": "\u{1D568}",
  "&wp;": "\u2118",
  "&wr;": "\u2240",
  "&wreath;": "\u2240",
  "&wscr;": "\u{1D4CC}",
  "&xcap;": "\u22C2",
  "&xcirc;": "\u25EF",
  "&xcup;": "\u22C3",
  "&xdtri;": "\u25BD",
  "&xfr;": "\u{1D535}",
  "&xhArr;": "\u27FA",
  "&xharr;": "\u27F7",
  "&xi;": "\u03BE",
  "&xlArr;": "\u27F8",
  "&xlarr;": "\u27F5",
  "&xmap;": "\u27FC",
  "&xnis;": "\u22FB",
  "&xodot;": "\u2A00",
  "&xopf;": "\u{1D569}",
  "&xoplus;": "\u2A01",
  "&xotime;": "\u2A02",
  "&xrArr;": "\u27F9",
  "&xrarr;": "\u27F6",
  "&xscr;": "\u{1D4CD}",
  "&xsqcup;": "\u2A06",
  "&xuplus;": "\u2A04",
  "&xutri;": "\u25B3",
  "&xvee;": "\u22C1",
  "&xwedge;": "\u22C0",
  "&yacute": "\xFD",
  "&yacute;": "\xFD",
  "&yacy;": "\u044F",
  "&ycirc;": "\u0177",
  "&ycy;": "\u044B",
  "&yen": "\xA5",
  "&yen;": "\xA5",
  "&yfr;": "\u{1D536}",
  "&yicy;": "\u0457",
  "&yopf;": "\u{1D56A}",
  "&yscr;": "\u{1D4CE}",
  "&yucy;": "\u044E",
  "&yuml": "\xFF",
  "&yuml;": "\xFF",
  "&zacute;": "\u017A",
  "&zcaron;": "\u017E",
  "&zcy;": "\u0437",
  "&zdot;": "\u017C",
  "&zeetrf;": "\u2128",
  "&zeta;": "\u03B6",
  "&zfr;": "\u{1D537}",
  "&zhcy;": "\u0436",
  "&zigrarr;": "\u21DD",
  "&zopf;": "\u{1D56B}",
  "&zscr;": "\u{1D4CF}",
  "&zwj;": "\u200D",
  "&zwnj;": "\u200C"
}, html_entities_default = htmlEntities;

// ../../node_modules/.pnpm/postal-mime@2.4.3_patch_hash=ngwql2fj2dlex3jjynq4iizhk4/node_modules/postal-mime/src/text-format.js
function decodeHTMLEntities(str) {
  return str.replace(/&(#\d+|#x[a-f0-9]+|[a-z]+\d*);?/gi, (match, entity) => {
    if (typeof html_entities_default[match] == "string")
      return html_entities_default[match];
    if (entity.charAt(0) !== "#" || match.charAt(match.length - 1) !== ";")
      return match;
    let codePoint;
    entity.charAt(1) === "x" ? codePoint = parseInt(entity.substr(2), 16) : codePoint = parseInt(entity.substr(1), 10);
    var output = "";
    return codePoint >= 55296 && codePoint <= 57343 || codePoint > 1114111 ? "\uFFFD" : (codePoint > 65535 && (codePoint -= 65536, output += String.fromCharCode(codePoint >>> 10 & 1023 | 55296), codePoint = 56320 | codePoint & 1023), output += String.fromCharCode(codePoint), output);
  });
}
function escapeHtml(str) {
  return str.trim().replace(/[<>"'?&]/g, (c) => {
    let hex = c.charCodeAt(0).toString(16);
    return hex.length < 2 && (hex = "0" + hex), "&#x" + hex.toUpperCase() + ";";
  });
}
function textToHtml(str) {
  return "<div>" + escapeHtml(str).replace(/\n/g, "<br />") + "</div>";
}
function htmlToText(str) {
  return str = str.replace(/\r?\n/g, "").replace(/<\!\-\-.*?\-\->/gi, " ").replace(/<br\b[^>]*>/gi, `
`).replace(/<\/?(p|div|table|tr|td|th)\b[^>]*>/gi, `

`).replace(/<script\b[^>]*>.*?<\/script\b[^>]*>/gi, " ").replace(/^.*<body\b[^>]*>/i, "").replace(/^.*<\/head\b[^>]*>/i, "").replace(/^.*<\!doctype\b[^>]*>/i, "").replace(/<\/body\b[^>]*>.*$/i, "").replace(/<\/html\b[^>]*>.*$/i, "").replace(/<a\b[^>]*href\s*=\s*["']?([^\s"']+)[^>]*>/gi, " ($1) ").replace(/<\/?(span|em|i|strong|b|u|a)\b[^>]*>/gi, "").replace(/<li\b[^>]*>[\n\u0001\s]*/gi, "* ").replace(/<hr\b[^>]*>/g, `
-------------
`).replace(/<[^>]*>/g, " ").replace(/\u0001/g, `
`).replace(/[ \t]+/g, " ").replace(/^\s+$/gm, "").replace(/\n\n+/g, `

`).replace(/^\n+/, `
`).replace(/\n+$/, `
`), str = decodeHTMLEntities(str), str;
}
function formatTextAddress(address) {
  return [].concat(address.name || []).concat(address.name ? `<${address.address}>` : address.address).join(" ");
}
function formatTextAddresses(addresses) {
  let parts = [], processAddress = (address, partCounter) => {
    if (partCounter && parts.push(", "), address.group) {
      let groupStart = `${address.name}:`, groupEnd = ";";
      parts.push(groupStart), address.group.forEach(processAddress), parts.push(groupEnd);
    } else
      parts.push(formatTextAddress(address));
  };
  return addresses.forEach(processAddress), parts.join("");
}
function formatHtmlAddress(address) {
  return `<a href="mailto:${escapeHtml(address.address)}" class="postal-email-address">${escapeHtml(address.name || `<${address.address}>`)}</a>`;
}
function formatHtmlAddresses(addresses) {
  let parts = [], processAddress = (address, partCounter) => {
    if (partCounter && parts.push('<span class="postal-email-address-separator">, </span>'), address.group) {
      let groupStart = `<span class="postal-email-address-group">${escapeHtml(address.name)}:</span>`, groupEnd = '<span class="postal-email-address-group">;</span>';
      parts.push(groupStart), address.group.forEach(processAddress), parts.push(groupEnd);
    } else
      parts.push(formatHtmlAddress(address));
  };
  return addresses.forEach(processAddress), parts.join(" ");
}
function foldLines(str, lineLength, afterSpace) {
  str = (str || "").toString(), lineLength = lineLength || 76;
  let pos = 0, len = str.length, result = "", line, match;
  for (; pos < len; ) {
    if (line = str.substr(pos, lineLength), line.length < lineLength) {
      result += line;
      break;
    }
    if (match = line.match(/^[^\n\r]*(\r?\n|\r)/)) {
      line = match[0], result += line, pos += line.length;
      continue;
    } else (match = line.match(/(\s+)[^\s]*$/)) && match[0].length - (afterSpace ? (match[1] || "").length : 0) < line.length ? line = line.substr(0, line.length - (match[0].length - (afterSpace ? (match[1] || "").length : 0))) : (match = str.substr(pos + line.length).match(/^[^\s]+(\s*)/)) && (line = line + match[0].substr(0, match[0].length - (afterSpace ? 0 : (match[1] || "").length)));
    result += line, pos += line.length, pos < len && (result += `\r
`);
  }
  return result;
}
function formatTextHeader(message) {
  let rows = [];
  if (message.from && rows.push({ key: "From", val: formatTextAddress(message.from) }), message.subject && rows.push({ key: "Subject", val: message.subject }), message.date) {
    let dateOptions = {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      hour12: !1
    }, dateStr = typeof Intl > "u" ? message.date : new Intl.DateTimeFormat("default", dateOptions).format(new Date(message.date));
    rows.push({ key: "Date", val: dateStr });
  }
  message.to && message.to.length && rows.push({ key: "To", val: formatTextAddresses(message.to) }), message.cc && message.cc.length && rows.push({ key: "Cc", val: formatTextAddresses(message.cc) }), message.bcc && message.bcc.length && rows.push({ key: "Bcc", val: formatTextAddresses(message.bcc) });
  let maxKeyLength = rows.map((r) => r.key.length).reduce((acc, cur) => cur > acc ? cur : acc, 0);
  rows = rows.flatMap((row) => {
    let sepLen = maxKeyLength - row.key.length, prefix = `${row.key}: ${" ".repeat(sepLen)}`, emptyPrefix = `${" ".repeat(row.key.length + 1)} ${" ".repeat(sepLen)}`;
    return foldLines(row.val, 80, !0).split(/\r?\n/).map((line) => line.trim()).map((line, i) => `${i ? emptyPrefix : prefix}${line}`);
  });
  let maxLineLength = rows.map((r) => r.length).reduce((acc, cur) => cur > acc ? cur : acc, 0), lineMarker = "-".repeat(maxLineLength);
  return `
${lineMarker}
${rows.join(`
`)}
${lineMarker}
`;
}
function formatHtmlHeader(message) {
  let rows = [];
  if (message.from && rows.push(`<div class="postal-email-header-key">From</div><div class="postal-email-header-value">${formatHtmlAddress(message.from)}</div>`), message.subject && rows.push(
    `<div class="postal-email-header-key">Subject</div><div class="postal-email-header-value postal-email-header-subject">${escapeHtml(
      message.subject
    )}</div>`
  ), message.date) {
    let dateOptions = {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      hour12: !1
    }, dateStr = typeof Intl > "u" ? message.date : new Intl.DateTimeFormat("default", dateOptions).format(new Date(message.date));
    rows.push(
      `<div class="postal-email-header-key">Date</div><div class="postal-email-header-value postal-email-header-date" data-date="${escapeHtml(
        message.date
      )}">${escapeHtml(dateStr)}</div>`
    );
  }
  return message.to && message.to.length && rows.push(`<div class="postal-email-header-key">To</div><div class="postal-email-header-value">${formatHtmlAddresses(message.to)}</div>`), message.cc && message.cc.length && rows.push(`<div class="postal-email-header-key">Cc</div><div class="postal-email-header-value">${formatHtmlAddresses(message.cc)}</div>`), message.bcc && message.bcc.length && rows.push(`<div class="postal-email-header-key">Bcc</div><div class="postal-email-header-value">${formatHtmlAddresses(message.bcc)}</div>`), `<div class="postal-email-header">${rows.length ? '<div class="postal-email-header-row">' : ""}${rows.join(
    `</div>
<div class="postal-email-header-row">`
  )}${rows.length ? "</div>" : ""}</div>`;
}

// ../../node_modules/.pnpm/postal-mime@2.4.3_patch_hash=ngwql2fj2dlex3jjynq4iizhk4/node_modules/postal-mime/src/address-parser.js
function _handleAddress(tokens) {
  let token, isGroup = !1, state = "text", address, addresses = [], data = {
    address: [],
    comment: [],
    group: [],
    text: []
  }, i, len;
  for (i = 0, len = tokens.length; i < len; i++)
    if (token = tokens[i], token.type === "operator")
      switch (token.value) {
        case "<":
          state = "address";
          break;
        case "(":
          state = "comment";
          break;
        case ":":
          state = "group", isGroup = !0;
          break;
        default:
          state = "text";
      }
    else token.value && (state === "address" && (token.value = token.value.replace(/^[^<]*<\s*/, "")), data[state].push(token.value));
  if (!data.text.length && data.comment.length && (data.text = data.comment, data.comment = []), isGroup)
    data.text = data.text.join(" "), addresses.push({
      name: decodeWords(data.text || address && address.name),
      group: data.group.length ? addressParser(data.group.join(",")) : []
    });
  else {
    if (!data.address.length && data.text.length) {
      for (i = data.text.length - 1; i >= 0; i--)
        if (data.text[i].match(/^[^@\s]+@[^@\s]+$/)) {
          data.address = data.text.splice(i, 1);
          break;
        }
      let _regexHandler = function(address2) {
        return data.address.length ? address2 : (data.address = [address2.trim()], " ");
      };
      if (!data.address.length)
        for (i = data.text.length - 1; i >= 0 && (data.text[i] = data.text[i].replace(/\s*\b[^@\s]+@[^\s]+\b\s*/, _regexHandler).trim(), !data.address.length); i--)
          ;
    }
    if (!data.text.length && data.comment.length && (data.text = data.comment, data.comment = []), data.address.length > 1 && (data.text = data.text.concat(data.address.splice(1))), data.text = data.text.join(" "), data.address = data.address.join(" "), !data.address && /^=\?[^=]+?=$/.test(data.text.trim())) {
      let parsedSubAddresses = addressParser(decodeWords(data.text));
      if (parsedSubAddresses && parsedSubAddresses.length)
        return parsedSubAddresses;
    }
    if (!data.address && isGroup)
      return [];
    address = {
      address: data.address || data.text || "",
      name: decodeWords(data.text || data.address || "")
    }, address.address === address.name && ((address.address || "").match(/@/) ? address.name = "" : address.address = ""), addresses.push(address);
  }
  return addresses;
}
var Tokenizer = class {
  constructor(str) {
    this.str = (str || "").toString(), this.operatorCurrent = "", this.operatorExpecting = "", this.node = null, this.escaped = !1, this.list = [], this.operators = {
      '"': '"',
      "(": ")",
      "<": ">",
      ",": "",
      ":": ";",
      // Semicolons are not a legal delimiter per the RFC2822 grammar other
      // than for terminating a group, but they are also not valid for any
      // other use in this context.  Given that some mail clients have
      // historically allowed the semicolon as a delimiter equivalent to the
      // comma in their UI, it makes sense to treat them the same as a comma
      // when used outside of a group.
      ";": ""
    };
  }
  /**
   * Tokenizes the original input string
   *
   * @return {Array} An array of operator|text tokens
   */
  tokenize() {
    let chr, list = [];
    for (let i = 0, len = this.str.length; i < len; i++)
      chr = this.str.charAt(i), this.checkChar(chr);
    return this.list.forEach((node) => {
      node.value = (node.value || "").toString().trim(), node.value && list.push(node);
    }), list;
  }
  /**
   * Checks if a character is an operator or text and acts accordingly
   *
   * @param {String} chr Character from the address field
   */
  checkChar(chr) {
    if (!this.escaped) {
      if (chr === this.operatorExpecting) {
        this.node = {
          type: "operator",
          value: chr
        }, this.list.push(this.node), this.node = null, this.operatorExpecting = "", this.escaped = !1;
        return;
      } else if (!this.operatorExpecting && chr in this.operators) {
        this.node = {
          type: "operator",
          value: chr
        }, this.list.push(this.node), this.node = null, this.operatorExpecting = this.operators[chr], this.escaped = !1;
        return;
      } else if (['"', "'"].includes(this.operatorExpecting) && chr === "\\") {
        this.escaped = !0;
        return;
      }
    }
    this.node || (this.node = {
      type: "text",
      value: ""
    }, this.list.push(this.node)), chr === `
` && (chr = " "), (chr.charCodeAt(0) >= 33 || [" ", "	"].includes(chr)) && (this.node.value += chr), this.escaped = !1;
  }
};
function addressParser(str, options) {
  options = options || {};
  let tokens = new Tokenizer(str).tokenize(), addresses = [], address = [], parsedAddresses = [];
  if (tokens.forEach((token) => {
    token.type === "operator" && (token.value === "," || token.value === ";") ? (address.length && addresses.push(address), address = []) : address.push(token);
  }), address.length && addresses.push(address), addresses.forEach((address2) => {
    address2 = _handleAddress(address2), address2.length && (parsedAddresses = parsedAddresses.concat(address2));
  }), options.flatten) {
    let addresses2 = [], walkAddressList = (list) => {
      list.forEach((address2) => {
        if (address2.group)
          return walkAddressList(address2.group);
        addresses2.push(address2);
      });
    };
    return walkAddressList(parsedAddresses), addresses2;
  }
  return parsedAddresses;
}
var address_parser_default = addressParser;

// ../../node_modules/.pnpm/postal-mime@2.4.3_patch_hash=ngwql2fj2dlex3jjynq4iizhk4/node_modules/postal-mime/src/base64-encoder.js
function base64ArrayBuffer(arrayBuffer) {
  for (var base64 = "", encodings = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/", bytes = new Uint8Array(arrayBuffer), byteLength = bytes.byteLength, byteRemainder = byteLength % 3, mainLength = byteLength - byteRemainder, a, b, c, d, chunk, i = 0; i < mainLength; i = i + 3)
    chunk = bytes[i] << 16 | bytes[i + 1] << 8 | bytes[i + 2], a = (chunk & 16515072) >> 18, b = (chunk & 258048) >> 12, c = (chunk & 4032) >> 6, d = chunk & 63, base64 += encodings[a] + encodings[b] + encodings[c] + encodings[d];
  return byteRemainder == 1 ? (chunk = bytes[mainLength], a = (chunk & 252) >> 2, b = (chunk & 3) << 4, base64 += encodings[a] + encodings[b] + "==") : byteRemainder == 2 && (chunk = bytes[mainLength] << 8 | bytes[mainLength + 1], a = (chunk & 64512) >> 10, b = (chunk & 1008) >> 4, c = (chunk & 15) << 2, base64 += encodings[a] + encodings[b] + encodings[c] + "="), base64;
}

// ../../node_modules/.pnpm/postal-mime@2.4.3_patch_hash=ngwql2fj2dlex3jjynq4iizhk4/node_modules/postal-mime/src/postal-mime.js
var PostalMime = class _PostalMime {
  static parse(buf, options) {
    return new _PostalMime(options).parse(buf);
  }
  constructor(options) {
    this.options = options || {}, this.root = this.currentNode = new MimeNode({
      postalMime: this
    }), this.boundaries = [], this.textContent = {}, this.attachments = [], this.attachmentEncoding = (this.options.attachmentEncoding || "").toString().replace(/[-_\s]/g, "").trim().toLowerCase() || "arraybuffer", this.started = !1;
  }
  async finalize() {
    await this.root.finalize();
  }
  async processLine(line, isFinal) {
    let boundaries = this.boundaries;
    if (boundaries.length && line.length > 2 && line[0] === 45 && line[1] === 45)
      for (let i = boundaries.length - 1; i >= 0; i--) {
        let boundary = boundaries[i];
        if (line.length !== boundary.value.length + 2 && line.length !== boundary.value.length + 4)
          continue;
        let isTerminator = line.length === boundary.value.length + 4;
        if (isTerminator && (line[line.length - 2] !== 45 || line[line.length - 1] !== 45))
          continue;
        let boudaryMatches = !0;
        for (let i2 = 0; i2 < boundary.value.length; i2++)
          if (line[i2 + 2] !== boundary.value[i2]) {
            boudaryMatches = !1;
            break;
          }
        if (boudaryMatches)
          return isTerminator ? (await boundary.node.finalize(), this.currentNode = boundary.node.parentNode || this.root) : (await boundary.node.finalizeChildNodes(), this.currentNode = new MimeNode({
            postalMime: this,
            parentNode: boundary.node
          })), isFinal ? this.finalize() : void 0;
      }
    if (this.currentNode.feed(line), isFinal)
      return this.finalize();
  }
  readLine() {
    let startPos = this.readPos, endPos = this.readPos, res = () => ({
      bytes: new Uint8Array(this.buf, startPos, endPos - startPos),
      done: this.readPos >= this.av.length
    });
    for (; this.readPos < this.av.length; ) {
      let c = this.av[this.readPos++];
      if (c !== 13 && c !== 10 && (endPos = this.readPos), c === 10)
        return res();
    }
    return res();
  }
  async processNodeTree() {
    let textContent = {}, textTypes = /* @__PURE__ */ new Set(), textMap = this.textMap = /* @__PURE__ */ new Map(), forceRfc822Attachments = this.forceRfc822Attachments(), walk = async (node, alternative, related) => {
      if (alternative = alternative || !1, related = related || !1, node.contentType.multipart)
        node.contentType.multipart === "alternative" ? alternative = node : node.contentType.multipart === "related" && (related = node);
      else if (this.isInlineMessageRfc822(node) && !forceRfc822Attachments) {
        let subParser = new _PostalMime();
        node.subMessage = await subParser.parse(node.content), textMap.has(node) || textMap.set(node, {});
        let textEntry = textMap.get(node);
        (node.subMessage.text || !node.subMessage.html) && (textEntry.plain = textEntry.plain || [], textEntry.plain.push({ type: "subMessage", value: node.subMessage }), textTypes.add("plain")), node.subMessage.html && (textEntry.html = textEntry.html || [], textEntry.html.push({ type: "subMessage", value: node.subMessage }), textTypes.add("html")), subParser.textMap && subParser.textMap.forEach((subTextEntry, subTextNode) => {
          textMap.set(subTextNode, subTextEntry);
        });
        for (let attachment of node.subMessage.attachments || [])
          this.attachments.push(attachment);
      } else if (this.isInlineTextNode(node)) {
        let textType = node.contentType.parsed.value.substr(node.contentType.parsed.value.indexOf("/") + 1), selectorNode = alternative || node;
        textMap.has(selectorNode) || textMap.set(selectorNode, {});
        let textEntry = textMap.get(selectorNode);
        textEntry[textType] = textEntry[textType] || [], textEntry[textType].push({ type: "text", value: node.getTextContent() }), textTypes.add(textType);
      } else if (node.content) {
        let filename = node.contentDisposition.parsed.params.filename || node.contentType.parsed.params.name || null, attachment = {
          filename: filename ? decodeWords(filename) : null,
          mimeType: node.contentType.parsed.value,
          disposition: node.contentDisposition.parsed.value || null
        };
        switch (related && node.contentId && (attachment.related = !0), node.contentDescription && (attachment.description = node.contentDescription), node.contentId && (attachment.contentId = node.contentId), node.contentType.parsed.value) {
          // Special handling for calendar events
          case "text/calendar":
          case "application/ics": {
            node.contentType.parsed.params.method && (attachment.method = node.contentType.parsed.params.method.toString().toUpperCase().trim());
            let decodedText = node.getTextContent().replace(/\r?\n/g, `
`).replace(/\n*$/, `
`);
            attachment.content = textEncoder.encode(decodedText);
            break;
          }
          // Regular attachments
          default:
            attachment.content = node.content;
        }
        this.attachments.push(attachment);
      }
      for (let childNode of node.childNodes)
        await walk(childNode, alternative, related);
    };
    await walk(this.root, !1, []), textMap.forEach((mapEntry) => {
      textTypes.forEach((textType) => {
        if (textContent[textType] || (textContent[textType] = []), mapEntry[textType])
          mapEntry[textType].forEach((textEntry) => {
            switch (textEntry.type) {
              case "text":
                textContent[textType].push(textEntry.value);
                break;
              case "subMessage":
                switch (textType) {
                  case "html":
                    textContent[textType].push(formatHtmlHeader(textEntry.value));
                    break;
                  case "plain":
                    textContent[textType].push(formatTextHeader(textEntry.value));
                    break;
                }
                break;
            }
          });
        else {
          let alternativeType;
          switch (textType) {
            case "html":
              alternativeType = "plain";
              break;
            case "plain":
              alternativeType = "html";
              break;
          }
          (mapEntry[alternativeType] || []).forEach((textEntry) => {
            switch (textEntry.type) {
              case "text":
                switch (textType) {
                  case "html":
                    textContent[textType].push(textToHtml(textEntry.value));
                    break;
                  case "plain":
                    textContent[textType].push(htmlToText(textEntry.value));
                    break;
                }
                break;
              case "subMessage":
                switch (textType) {
                  case "html":
                    textContent[textType].push(formatHtmlHeader(textEntry.value));
                    break;
                  case "plain":
                    textContent[textType].push(formatTextHeader(textEntry.value));
                    break;
                }
                break;
            }
          });
        }
      });
    }), Object.keys(textContent).forEach((textType) => {
      textContent[textType] = textContent[textType].join(`
`);
    }), this.textContent = textContent;
  }
  isInlineTextNode(node) {
    if (node.contentDisposition.parsed.value === "attachment")
      return !1;
    switch (node.contentType.parsed.value) {
      case "text/html":
      case "text/plain":
        return !0;
      case "text/calendar":
      case "text/csv":
      default:
        return !1;
    }
  }
  isInlineMessageRfc822(node) {
    return node.contentType.parsed.value !== "message/rfc822" ? !1 : (node.contentDisposition.parsed.value || (this.options.rfc822Attachments ? "attachment" : "inline")) === "inline";
  }
  // Check if this is a specially crafted report email where message/rfc822 content should not be inlined
  forceRfc822Attachments() {
    if (this.options.forceRfc822Attachments)
      return !0;
    let forceRfc822Attachments = !1, walk = (node) => {
      node.contentType.multipart || ["message/delivery-status", "message/feedback-report"].includes(node.contentType.parsed.value) && (forceRfc822Attachments = !0);
      for (let childNode of node.childNodes)
        walk(childNode);
    };
    return walk(this.root), forceRfc822Attachments;
  }
  async resolveStream(stream) {
    let chunkLen = 0, chunks = [], reader = stream.getReader();
    for (; ; ) {
      let { done, value } = await reader.read();
      if (done)
        break;
      chunks.push(value), chunkLen += value.length;
    }
    let result = new Uint8Array(chunkLen), chunkPointer = 0;
    for (let chunk of chunks)
      result.set(chunk, chunkPointer), chunkPointer += chunk.length;
    return result;
  }
  async parse(buf) {
    if (this.started)
      throw new Error("Can not reuse parser, create a new PostalMime object");
    for (this.started = !0, buf && typeof buf.getReader == "function" && (buf = await this.resolveStream(buf)), buf = buf || new ArrayBuffer(0), typeof buf == "string" && (buf = textEncoder.encode(buf)), (buf instanceof Blob || Object.prototype.toString.call(buf) === "[object Blob]") && (buf = await blobToArrayBuffer(buf)), buf.buffer instanceof ArrayBuffer && (buf = new Uint8Array(buf).buffer), this.buf = buf, this.av = new Uint8Array(buf), this.readPos = 0; this.readPos < this.av.length; ) {
      let line = this.readLine();
      await this.processLine(line.bytes, line.done);
    }
    await this.processNodeTree();
    let message = {
      headers: this.root.headers.map((entry) => ({ key: entry.key, value: entry.value })).reverse()
    };
    for (let key of ["from", "sender"]) {
      let addressHeader = this.root.headers.find((line) => line.key === key);
      if (addressHeader && addressHeader.value) {
        let addresses = address_parser_default(addressHeader.value);
        addresses && addresses.length && (message[key] = addresses[0]);
      }
    }
    for (let key of ["delivered-to", "return-path"]) {
      let addressHeader = this.root.headers.find((line) => line.key === key);
      if (addressHeader && addressHeader.value) {
        let addresses = address_parser_default(addressHeader.value);
        if (addresses && addresses.length && addresses[0].address) {
          let camelKey = key.replace(/\-(.)/g, (o, c) => c.toUpperCase());
          message[camelKey] = addresses[0].address;
        }
      }
    }
    for (let key of ["to", "cc", "bcc", "reply-to"]) {
      let addressHeaders = this.root.headers.filter((line) => line.key === key), addresses = [];
      if (addressHeaders.filter((entry) => entry && entry.value).map((entry) => address_parser_default(entry.value)).forEach((parsed) => addresses = addresses.concat(parsed || [])), addresses && addresses.length) {
        let camelKey = key.replace(/\-(.)/g, (o, c) => c.toUpperCase());
        message[camelKey] = addresses;
      }
    }
    for (let key of ["subject", "message-id", "in-reply-to", "references"]) {
      let header = this.root.headers.find((line) => line.key === key);
      if (header && header.value) {
        let camelKey = key.replace(/\-(.)/g, (o, c) => c.toUpperCase());
        message[camelKey] = decodeWords(header.value);
      }
    }
    let dateHeader = this.root.headers.find((line) => line.key === "date");
    if (dateHeader) {
      let date = new Date(dateHeader.value);
      !date || date.toString() === "Invalid Date" ? date = dateHeader.value : date = date.toISOString(), message.date = date;
    }
    switch (this.textContent?.html && (message.html = this.textContent.html), this.textContent?.plain && (message.text = this.textContent.plain), message.attachments = this.attachments, this.attachmentEncoding) {
      case "arraybuffer":
        break;
      case "base64":
        for (let attachment of message.attachments || [])
          attachment?.content && (attachment.content = base64ArrayBuffer(attachment.content), attachment.encoding = "base64");
        break;
      case "utf8":
        let attachmentDecoder = new TextDecoder("utf8");
        for (let attachment of message.attachments || [])
          attachment?.content && (attachment.content = attachmentDecoder.decode(attachment.content), attachment.encoding = "utf8");
        break;
      default:
        throw new Error("Unknwon attachment encoding");
    }
    return message;
  }
};

// src/workers/email/constants.ts
var RAW_EMAIL = "EmailMessage::raw";

// src/workers/email/validate.ts
async function isEmailReplyable(email, incomingEmailHeaders, log) {
  let autoResponseSuppress = incomingEmailHeaders.get("x-auto-response-suppress")?.toLowerCase();
  if (autoResponseSuppress !== void 0 && autoResponseSuppress !== "none")
    return !1;
  let autoSubmittedValue = incomingEmailHeaders.get("auto-submitted")?.toLowerCase();
  return autoSubmittedValue !== void 0 && autoSubmittedValue !== "no" ? !1 : email.inReplyTo === void 0 && email.references === void 0 ? !0 : email.inReplyTo !== void 0 && email.references !== void 0 ? (email.references.match(/@/g)?.length ?? 0) >= 100 ? (await log(
    red(
      `The incoming email's "References" header has more than 100 entries. As such, your Worker cannot respond to this email. Refer to https://developers.cloudflare.com/email-routing/email-workers/reply-email-workers/.`
    )
  ), !1) : !0 : !1;
}
async function validateReply(incomingMessage, replyMessage) {
  let rawEmail = replyMessage[RAW_EMAIL], rawEmailBuffer = new Uint8Array(
    await new Response(rawEmail).arrayBuffer()
  ), parsedReply;
  try {
    parsedReply = await PostalMime.parse(rawEmailBuffer);
  } catch (e) {
    let error = e;
    throw new Error(`could not parse email: ${error.message}`);
  }
  if (parsedReply.from?.address !== replyMessage.from)
    throw new Error("From: header does not match mail from");
  if (parsedReply.messageId === void 0)
    throw new Error("invalid message-id");
  if (new Headers(
    parsedReply.headers.map((header) => [header.key, header.value])
  ).get("received") !== null)
    throw new Error("invalid headers set");
  if (parsedReply.inReplyTo === void 0)
    throw new Error("no In-Reply-To header found in reply message");
  if (parsedReply.inReplyTo !== incomingMessage.messageId)
    throw new Error("In-Reply-To does not match original Message-ID");
  let incomingReferences = incomingMessage.references ?? "";
  if (parsedReply.references !== void 0) {
    if (!(parsedReply.references.includes(incomingMessage.messageId) && parsedReply.references.includes(incomingReferences)))
      throw new Error("provided References header is invalid");
  } else {
    let replyReferences = `References: ${incomingMessage.messageId}${incomingReferences.length > 0 ? " " : ""}${incomingReferences}\r
`, encodedReferences = new TextEncoder().encode(replyReferences), finalReplyEmail = new Uint8Array(
      encodedReferences.byteLength + rawEmailBuffer.byteLength
    );
    return finalReplyEmail.set(encodedReferences, 0), finalReplyEmail.set(rawEmailBuffer, encodedReferences.byteLength), finalReplyEmail;
  }
  return rawEmailBuffer;
}

// src/workers/core/email.ts
$.enabled = !0;
function renderEmailHeaders(headers) {
  return headers ? `
  headers:
${[...headers.entries()].map(([k, v]) => `    ${k}: ${v}`).join(`
`)}` : "";
}
async function handleEmail(params, request, service, env, ctx) {
  let from = params.get("from"), to = params.get("to");
  if (!request.body || !from || !to)
    return new Response(
      "Invalid email. Your request must include URL parameters specifying the `from` and `to` addresses, as well as an email in the body",
      {
        status: 400
      }
    );
  let clonedRequest = request.clone();
  assert(clonedRequest.body !== null, "Cloned request body is null");
  let incomingEmailRaw = new Uint8Array(await request.arrayBuffer());
  if (incomingEmailRaw.byteLength > 25 * 1024 * 1024)
    return new Response(
      "Email message size is bigger than the production size limit of 25MiB. Local development has a lower limit of 1Mib.",
      {
        status: 400
      }
    );
  if (incomingEmailRaw.byteLength > 1024 * 1024)
    return new Response(
      "Email message size is within the production size limit of 25MiB, but exceeds the lower 1Mib limit for testing locally.",
      {
        status: 400
      }
    );
  let parsedIncomingEmail;
  try {
    parsedIncomingEmail = await PostalMime.parse(incomingEmailRaw);
  } catch (e) {
    let error = e;
    return new Response(
      `Email could not be parsed: ${error.name}: ${error.message}`,
      { status: 400 }
    );
  }
  if (parsedIncomingEmail.messageId === void 0)
    return new Response(
      "Email could not be parsed: invalid or no message id provided",
      { status: 400 }
    );
  from !== parsedIncomingEmail.from.address && await env[CoreBindings.SERVICE_LOOPBACK].fetch(
    "http://localhost/core/log",
    {
      method: "POST",
      headers: { [SharedHeaders.LOG_LEVEL]: LogLevel.WARN.toString() },
      body: `${yellow(`Provided MAIL FROM address doesn't match the email message's "From" header`)}:
  MAIL FROM: ${from}
  "From" header: ${parsedIncomingEmail.from.address}`
    }
  ), parsedIncomingEmail.to?.map((addr) => addr.address).includes(to) || await env[CoreBindings.SERVICE_LOOPBACK].fetch(
    "http://localhost/core/log",
    {
      method: "POST",
      headers: { [SharedHeaders.LOG_LEVEL]: LogLevel.WARN.toString() },
      body: `${yellow(`Provided RCPT TO address doesn't match any "To" header in the email message`)}:
  RCPT TO: ${to}
  "To" header: ${parsedIncomingEmail.to?.map((addr) => addr.address).join(", ")}`
    }
  );
  let incomingEmailHeaders = new Headers(
    parsedIncomingEmail.headers.map((header) => [header.key, header.value])
  ), maybeClientError;
  return await service.email(
    // Construct a ForwardableEmailMessage-like object. We need
    // - ForwardableEmailMessage to be able to be passed across JSRPC (to support e.g. userWorker.email(ForwardableEmailMessage))
    // - ForwardableEmailMessage properties to be synchronously available (to match production). This rules out a class extending `RpcStub`
    // However, unlike EmailMessage (see email.worker.ts) it doesn't need to be user-constructable, and so we can just use an object with `satisfies`
    {
      from,
      to,
      raw: clonedRequest.body,
      rawSize: incomingEmailRaw.byteLength,
      headers: incomingEmailHeaders,
      setReject: (reason) => {
        ctx.waitUntil(
          env[CoreBindings.SERVICE_LOOPBACK].fetch(
            "http://localhost/core/log",
            {
              method: "POST",
              headers: { [SharedHeaders.LOG_LEVEL]: LogLevel.ERROR.toString() },
              body: `${red("Email handler rejected message")}${reset(` with the following reason: "${reason}"`)}`
            }
          )
        ), maybeClientError = reason;
      },
      forward: async (rcptTo, headers) => {
        await env[CoreBindings.SERVICE_LOOPBACK].fetch(
          "http://localhost/core/log",
          {
            method: "POST",
            headers: { [SharedHeaders.LOG_LEVEL]: LogLevel.INFO.toString() },
            body: `${blue("Email handler forwarded message")}${reset(` with
  rcptTo: ${rcptTo}${renderEmailHeaders(headers)}`)}`
          }
        );
      },
      reply: async (replyMessage) => {
        if (!await isEmailReplyable(
          parsedIncomingEmail,
          incomingEmailHeaders,
          async (msg) => void await env[CoreBindings.SERVICE_LOOPBACK].fetch(
            "http://localhost/core/log",
            {
              method: "POST",
              headers: {
                [SharedHeaders.LOG_LEVEL]: LogLevel.ERROR.toString()
              },
              body: msg
            }
          )
        ))
          throw new Error("Original email is not replyable");
        let finalReply = await validateReply(
          parsedIncomingEmail,
          replyMessage
        ), file = await (await env[CoreBindings.SERVICE_LOOPBACK].fetch(
          "http://localhost/core/store-temp-file?extension=eml&prefix=email",
          {
            method: "POST",
            body: finalReply
          }
        )).text();
        await env[CoreBindings.SERVICE_LOOPBACK].fetch(
          "http://localhost/core/log",
          {
            method: "POST",
            headers: { [SharedHeaders.LOG_LEVEL]: LogLevel.INFO.toString() },
            body: `${blue("Email handler replied to sender")}${reset(` with the following message:
  ${file}`)}`
          }
        );
      }
    }
  ), maybeClientError !== void 0 ? new Response(
    `Worker rejected email with the following reason: ${maybeClientError}`,
    { status: 400 }
  ) : new Response("Worker successfully processed email", {
    status: 200
  });
}

// src/workers/core/http.ts
var STATUS_CODES = {
  100: "Continue",
  101: "Switching Protocols",
  102: "Processing",
  103: "Early Hints",
  200: "OK",
  201: "Created",
  202: "Accepted",
  203: "Non-Authoritative Information",
  204: "No Content",
  205: "Reset Content",
  206: "Partial Content",
  207: "Multi-Status",
  208: "Already Reported",
  226: "IM Used",
  300: "Multiple Choices",
  301: "Moved Permanently",
  302: "Found",
  303: "See Other",
  304: "Not Modified",
  305: "Use Proxy",
  307: "Temporary Redirect",
  308: "Permanent Redirect",
  400: "Bad Request",
  401: "Unauthorized",
  402: "Payment Required",
  403: "Forbidden",
  404: "Not Found",
  405: "Method Not Allowed",
  406: "Not Acceptable",
  407: "Proxy Authentication Required",
  408: "Request Timeout",
  409: "Conflict",
  410: "Gone",
  411: "Length Required",
  412: "Precondition Failed",
  413: "Payload Too Large",
  414: "URI Too Long",
  415: "Unsupported Media Type",
  416: "Range Not Satisfiable",
  417: "Expectation Failed",
  418: "I'm a Teapot",
  421: "Misdirected Request",
  422: "Unprocessable Entity",
  423: "Locked",
  424: "Failed Dependency",
  425: "Too Early",
  426: "Upgrade Required",
  428: "Precondition Required",
  429: "Too Many Requests",
  431: "Request Header Fields Too Large",
  451: "Unavailable For Legal Reasons",
  500: "Internal Server Error",
  501: "Not Implemented",
  502: "Bad Gateway",
  503: "Service Unavailable",
  504: "Gateway Timeout",
  505: "HTTP Version Not Supported",
  506: "Variant Also Negotiates",
  507: "Insufficient Storage",
  508: "Loop Detected",
  509: "Bandwidth Limit Exceeded",
  510: "Not Extended",
  511: "Network Authentication Required"
};

// src/workers/core/routing.ts
function matchRoutes(routes, url) {
  for (let route of routes) {
    if (route.protocol && route.protocol !== url.protocol) continue;
    if (route.allowHostnamePrefix) {
      if (!url.hostname.endsWith(route.hostname)) continue;
    } else if (url.hostname !== route.hostname) continue;
    let path = url.pathname + url.search;
    if (route.allowPathSuffix) {
      if (!path.startsWith(route.path)) continue;
    } else if (path !== route.path) continue;
    return route.target;
  }
  return null;
}

// src/workers/core/scheduled.ts
async function handleScheduled(params, service) {
  let time = params.get("time"), scheduledTime = time ? new Date(parseInt(time)) : void 0, cron = params.get("cron") ?? void 0, result = await service.scheduled({
    scheduledTime,
    cron
  });
  return new Response(result.outcome, {
    status: result.outcome === "ok" ? 200 : 500
  });
}

// src/workers/core/proxy.worker.ts
import assert3 from "node:assert";
import { Buffer as Buffer2 } from "node:buffer";

// ../../node_modules/.pnpm/devalue@5.3.2/node_modules/devalue/src/utils.js
var DevalueError = class extends Error {
  /**
   * @param {string} message
   * @param {string[]} keys
   */
  constructor(message, keys) {
    super(message), this.name = "DevalueError", this.path = keys.join("");
  }
};
function is_primitive(thing) {
  return Object(thing) !== thing;
}
var object_proto_names = /* @__PURE__ */ Object.getOwnPropertyNames(
  Object.prototype
).sort().join("\0");
function is_plain_object(thing) {
  let proto = Object.getPrototypeOf(thing);
  return proto === Object.prototype || proto === null || Object.getPrototypeOf(proto) === null || Object.getOwnPropertyNames(proto).sort().join("\0") === object_proto_names;
}
function get_type(thing) {
  return Object.prototype.toString.call(thing).slice(8, -1);
}
function get_escaped_char(char) {
  switch (char) {
    case '"':
      return '\\"';
    case "<":
      return "\\u003C";
    case "\\":
      return "\\\\";
    case `
`:
      return "\\n";
    case "\r":
      return "\\r";
    case "	":
      return "\\t";
    case "\b":
      return "\\b";
    case "\f":
      return "\\f";
    case "\u2028":
      return "\\u2028";
    case "\u2029":
      return "\\u2029";
    default:
      return char < " " ? `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}` : "";
  }
}
function stringify_string(str) {
  let result = "", last_pos = 0, len = str.length;
  for (let i = 0; i < len; i += 1) {
    let char = str[i], replacement = get_escaped_char(char);
    replacement && (result += str.slice(last_pos, i) + replacement, last_pos = i + 1);
  }
  return `"${last_pos === 0 ? str : result + str.slice(last_pos)}"`;
}
function enumerable_symbols(object) {
  return Object.getOwnPropertySymbols(object).filter(
    (symbol) => Object.getOwnPropertyDescriptor(object, symbol).enumerable
  );
}
var is_identifier = /^[a-zA-Z_$][a-zA-Z_$0-9]*$/;
function stringify_key(key) {
  return is_identifier.test(key) ? "." + key : "[" + JSON.stringify(key) + "]";
}

// ../../node_modules/.pnpm/devalue@5.3.2/node_modules/devalue/src/base64.js
function encode64(arraybuffer) {
  let dv = new DataView(arraybuffer), binaryString = "";
  for (let i = 0; i < arraybuffer.byteLength; i++)
    binaryString += String.fromCharCode(dv.getUint8(i));
  return binaryToAscii(binaryString);
}
function decode64(string) {
  let binaryString = asciiToBinary(string), arraybuffer = new ArrayBuffer(binaryString.length), dv = new DataView(arraybuffer);
  for (let i = 0; i < arraybuffer.byteLength; i++)
    dv.setUint8(i, binaryString.charCodeAt(i));
  return arraybuffer;
}
var KEY_STRING = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function asciiToBinary(data) {
  data.length % 4 === 0 && (data = data.replace(/==?$/, ""));
  let output = "", buffer = 0, accumulatedBits = 0;
  for (let i = 0; i < data.length; i++)
    buffer <<= 6, buffer |= KEY_STRING.indexOf(data[i]), accumulatedBits += 6, accumulatedBits === 24 && (output += String.fromCharCode((buffer & 16711680) >> 16), output += String.fromCharCode((buffer & 65280) >> 8), output += String.fromCharCode(buffer & 255), buffer = accumulatedBits = 0);
  return accumulatedBits === 12 ? (buffer >>= 4, output += String.fromCharCode(buffer)) : accumulatedBits === 18 && (buffer >>= 2, output += String.fromCharCode((buffer & 65280) >> 8), output += String.fromCharCode(buffer & 255)), output;
}
function binaryToAscii(str) {
  let out = "";
  for (let i = 0; i < str.length; i += 3) {
    let groupsOfSix = [void 0, void 0, void 0, void 0];
    groupsOfSix[0] = str.charCodeAt(i) >> 2, groupsOfSix[1] = (str.charCodeAt(i) & 3) << 4, str.length > i + 1 && (groupsOfSix[1] |= str.charCodeAt(i + 1) >> 4, groupsOfSix[2] = (str.charCodeAt(i + 1) & 15) << 2), str.length > i + 2 && (groupsOfSix[2] |= str.charCodeAt(i + 2) >> 6, groupsOfSix[3] = str.charCodeAt(i + 2) & 63);
    for (let j = 0; j < groupsOfSix.length; j++)
      typeof groupsOfSix[j] > "u" ? out += "=" : out += KEY_STRING[groupsOfSix[j]];
  }
  return out;
}

// ../../node_modules/.pnpm/devalue@5.3.2/node_modules/devalue/src/parse.js
function parse(serialized, revivers) {
  return unflatten(JSON.parse(serialized), revivers);
}
function unflatten(parsed, revivers) {
  if (typeof parsed == "number") return hydrate(parsed, !0);
  if (!Array.isArray(parsed) || parsed.length === 0)
    throw new Error("Invalid input");
  let values = (
    /** @type {any[]} */
    parsed
  ), hydrated = Array(values.length);
  function hydrate(index, standalone = !1) {
    if (index === -1) return;
    if (index === -3) return NaN;
    if (index === -4) return 1 / 0;
    if (index === -5) return -1 / 0;
    if (index === -6) return -0;
    if (standalone || typeof index != "number")
      throw new Error("Invalid input");
    if (index in hydrated) return hydrated[index];
    let value = values[index];
    if (!value || typeof value != "object")
      hydrated[index] = value;
    else if (Array.isArray(value))
      if (typeof value[0] == "string") {
        let type = value[0], reviver = revivers?.[type];
        if (reviver)
          return hydrated[index] = reviver(hydrate(value[1]));
        switch (type) {
          case "Date":
            hydrated[index] = new Date(value[1]);
            break;
          case "Set":
            let set = /* @__PURE__ */ new Set();
            hydrated[index] = set;
            for (let i = 1; i < value.length; i += 1)
              set.add(hydrate(value[i]));
            break;
          case "Map":
            let map = /* @__PURE__ */ new Map();
            hydrated[index] = map;
            for (let i = 1; i < value.length; i += 2)
              map.set(hydrate(value[i]), hydrate(value[i + 1]));
            break;
          case "RegExp":
            hydrated[index] = new RegExp(value[1], value[2]);
            break;
          case "Object":
            hydrated[index] = Object(value[1]);
            break;
          case "BigInt":
            hydrated[index] = BigInt(value[1]);
            break;
          case "null":
            let obj = /* @__PURE__ */ Object.create(null);
            hydrated[index] = obj;
            for (let i = 1; i < value.length; i += 2)
              obj[value[i]] = hydrate(value[i + 1]);
            break;
          case "Int8Array":
          case "Uint8Array":
          case "Uint8ClampedArray":
          case "Int16Array":
          case "Uint16Array":
          case "Int32Array":
          case "Uint32Array":
          case "Float32Array":
          case "Float64Array":
          case "BigInt64Array":
          case "BigUint64Array": {
            let TypedArrayConstructor = globalThis[type], typedArray = new TypedArrayConstructor(hydrate(value[1]));
            hydrated[index] = value[2] !== void 0 ? typedArray.subarray(value[2], value[3]) : typedArray;
            break;
          }
          case "ArrayBuffer": {
            let base64 = value[1], arraybuffer = decode64(base64);
            hydrated[index] = arraybuffer;
            break;
          }
          case "Temporal.Duration":
          case "Temporal.Instant":
          case "Temporal.PlainDate":
          case "Temporal.PlainTime":
          case "Temporal.PlainDateTime":
          case "Temporal.PlainMonthDay":
          case "Temporal.PlainYearMonth":
          case "Temporal.ZonedDateTime": {
            let temporalName = type.slice(9);
            hydrated[index] = Temporal[temporalName].from(value[1]);
            break;
          }
          case "URL": {
            let url = new URL(value[1]);
            hydrated[index] = url;
            break;
          }
          case "URLSearchParams": {
            let url = new URLSearchParams(value[1]);
            hydrated[index] = url;
            break;
          }
          default:
            throw new Error(`Unknown type ${type}`);
        }
      } else {
        let array = new Array(value.length);
        hydrated[index] = array;
        for (let i = 0; i < value.length; i += 1) {
          let n = value[i];
          n !== -2 && (array[i] = hydrate(n));
        }
      }
    else {
      let object = {};
      hydrated[index] = object;
      for (let key in value) {
        if (key === "__proto__")
          throw new Error("Cannot parse an object with a `__proto__` property");
        let n = value[key];
        object[key] = hydrate(n);
      }
    }
    return hydrated[index];
  }
  return hydrate(0);
}

// ../../node_modules/.pnpm/devalue@5.3.2/node_modules/devalue/src/stringify.js
function stringify(value, reducers) {
  let stringified = [], indexes = /* @__PURE__ */ new Map(), custom = [];
  if (reducers)
    for (let key of Object.getOwnPropertyNames(reducers))
      custom.push({ key, fn: reducers[key] });
  let keys = [], p = 0;
  function flatten(thing) {
    if (typeof thing == "function")
      throw new DevalueError("Cannot stringify a function", keys);
    if (thing === void 0) return -1;
    if (Number.isNaN(thing)) return -3;
    if (thing === 1 / 0) return -4;
    if (thing === -1 / 0) return -5;
    if (thing === 0 && 1 / thing < 0) return -6;
    if (indexes.has(thing)) return indexes.get(thing);
    let index2 = p++;
    indexes.set(thing, index2);
    for (let { key, fn } of custom) {
      let value2 = fn(thing);
      if (value2)
        return stringified[index2] = `["${key}",${flatten(value2)}]`, index2;
    }
    let str = "";
    if (is_primitive(thing))
      str = stringify_primitive(thing);
    else {
      let type = get_type(thing);
      switch (type) {
        case "Number":
        case "String":
        case "Boolean":
          str = `["Object",${stringify_primitive(thing)}]`;
          break;
        case "BigInt":
          str = `["BigInt",${thing}]`;
          break;
        case "Date":
          str = `["Date","${!isNaN(thing.getDate()) ? thing.toISOString() : ""}"]`;
          break;
        case "URL":
          str = `["URL",${stringify_string(thing.toString())}]`;
          break;
        case "URLSearchParams":
          str = `["URLSearchParams",${stringify_string(thing.toString())}]`;
          break;
        case "RegExp":
          let { source, flags } = thing;
          str = flags ? `["RegExp",${stringify_string(source)},"${flags}"]` : `["RegExp",${stringify_string(source)}]`;
          break;
        case "Array":
          str = "[";
          for (let i = 0; i < thing.length; i += 1)
            i > 0 && (str += ","), i in thing ? (keys.push(`[${i}]`), str += flatten(thing[i]), keys.pop()) : str += -2;
          str += "]";
          break;
        case "Set":
          str = '["Set"';
          for (let value2 of thing)
            str += `,${flatten(value2)}`;
          str += "]";
          break;
        case "Map":
          str = '["Map"';
          for (let [key, value2] of thing)
            keys.push(
              `.get(${is_primitive(key) ? stringify_primitive(key) : "..."})`
            ), str += `,${flatten(key)},${flatten(value2)}`, keys.pop();
          str += "]";
          break;
        case "Int8Array":
        case "Uint8Array":
        case "Uint8ClampedArray":
        case "Int16Array":
        case "Uint16Array":
        case "Int32Array":
        case "Uint32Array":
        case "Float32Array":
        case "Float64Array":
        case "BigInt64Array":
        case "BigUint64Array": {
          let typedArray = thing;
          str = '["' + type + '",' + flatten(typedArray.buffer);
          let a = thing.byteOffset, b = a + thing.byteLength;
          if (a > 0 || b !== typedArray.buffer.byteLength) {
            let m = +/(\d+)/.exec(type)[1] / 8;
            str += `,${a / m},${b / m}`;
          }
          str += "]";
          break;
        }
        case "ArrayBuffer": {
          str = `["ArrayBuffer","${encode64(thing)}"]`;
          break;
        }
        case "Temporal.Duration":
        case "Temporal.Instant":
        case "Temporal.PlainDate":
        case "Temporal.PlainTime":
        case "Temporal.PlainDateTime":
        case "Temporal.PlainMonthDay":
        case "Temporal.PlainYearMonth":
        case "Temporal.ZonedDateTime":
          str = `["${type}",${stringify_string(thing.toString())}]`;
          break;
        default:
          if (!is_plain_object(thing))
            throw new DevalueError(
              "Cannot stringify arbitrary non-POJOs",
              keys
            );
          if (enumerable_symbols(thing).length > 0)
            throw new DevalueError(
              "Cannot stringify POJOs with symbolic keys",
              keys
            );
          if (Object.getPrototypeOf(thing) === null) {
            str = '["null"';
            for (let key in thing)
              keys.push(stringify_key(key)), str += `,${stringify_string(key)},${flatten(thing[key])}`, keys.pop();
            str += "]";
          } else {
            str = "{";
            let started = !1;
            for (let key in thing)
              started && (str += ","), started = !0, keys.push(stringify_key(key)), str += `${stringify_string(key)}:${flatten(thing[key])}`, keys.pop();
            str += "}";
          }
      }
    }
    return stringified[index2] = str, index2;
  }
  let index = flatten(value);
  return index < 0 ? `${index}` : `[${stringified.join(",")}]`;
}
function stringify_primitive(thing) {
  let type = typeof thing;
  return type === "string" ? stringify_string(thing) : thing instanceof String ? stringify_string(thing.toString()) : thing === void 0 ? (-1).toString() : thing === 0 && 1 / thing < 0 ? (-6).toString() : type === "bigint" ? `["BigInt","${thing}"]` : String(thing);
}

// src/workers/core/proxy.worker.ts
import { readPrefix, reduceError } from "miniflare:shared";

// src/workers/core/devalue.ts
import assert2 from "node:assert";
import { Buffer } from "node:buffer";
var ALLOWED_ARRAY_BUFFER_VIEW_CONSTRUCTORS = [
  DataView,
  Int8Array,
  Uint8Array,
  Uint8ClampedArray,
  Int16Array,
  Uint16Array,
  Int32Array,
  Uint32Array,
  Float32Array,
  Float64Array,
  BigInt64Array,
  BigUint64Array
], ALLOWED_ERROR_CONSTRUCTORS = [
  EvalError,
  RangeError,
  ReferenceError,
  SyntaxError,
  TypeError,
  URIError,
  Error
  // `Error` last so more specific error subclasses preferred
], structuredSerializableReducers = {
  ArrayBuffer(value) {
    if (value instanceof ArrayBuffer)
      return [Buffer.from(value).toString("base64")];
  },
  ArrayBufferView(value) {
    if (ArrayBuffer.isView(value))
      return [
        value.constructor.name,
        value.buffer,
        value.byteOffset,
        value.byteLength
      ];
  },
  RegExp(value) {
    if (value instanceof RegExp) {
      let { source, flags } = value, encoded = Buffer.from(source).toString("base64");
      return flags ? ["RegExp", encoded, flags] : ["RegExp", encoded];
    }
  },
  Error(value) {
    for (let ctor of ALLOWED_ERROR_CONSTRUCTORS)
      if (value instanceof ctor && value.name === ctor.name)
        return [value.name, value.message, value.stack, value.cause];
    if (value instanceof Error)
      return ["Error", value.message, value.stack, value.cause];
  }
}, structuredSerializableRevivers = {
  ArrayBuffer(value) {
    assert2(Array.isArray(value));
    let [encoded] = value;
    assert2(typeof encoded == "string");
    let view = Buffer.from(encoded, "base64");
    return view.buffer.slice(
      view.byteOffset,
      view.byteOffset + view.byteLength
    );
  },
  ArrayBufferView(value) {
    assert2(Array.isArray(value));
    let [name, buffer, byteOffset, byteLength] = value;
    assert2(typeof name == "string"), assert2(buffer instanceof ArrayBuffer), assert2(typeof byteOffset == "number"), assert2(typeof byteLength == "number");
    let ctor = globalThis[name];
    assert2(ALLOWED_ARRAY_BUFFER_VIEW_CONSTRUCTORS.includes(ctor));
    let length = byteLength;
    return "BYTES_PER_ELEMENT" in ctor && (length /= ctor.BYTES_PER_ELEMENT), new ctor(buffer, byteOffset, length);
  },
  RegExp(value) {
    assert2(Array.isArray(value));
    let [name, encoded, flags] = value;
    assert2(typeof name == "string"), assert2(typeof encoded == "string");
    let source = Buffer.from(encoded, "base64").toString("utf-8");
    return new RegExp(source, flags);
  },
  Error(value) {
    assert2(Array.isArray(value));
    let [name, message, stack, cause] = value;
    assert2(typeof name == "string"), assert2(typeof message == "string"), assert2(stack === void 0 || typeof stack == "string");
    let ctor = globalThis[name];
    assert2(ALLOWED_ERROR_CONSTRUCTORS.includes(ctor));
    let error = new ctor(message, { cause });
    return error.stack = stack, error;
  }
};
function createHTTPReducers(impl) {
  return {
    Headers(val) {
      if (val instanceof impl.Headers) return [...val.entries()];
    },
    Request(val) {
      if (val instanceof impl.Request)
        return [val.method, val.url, val.headers, val.cf, val.body];
    },
    Response(val) {
      if (val instanceof impl.Response)
        return [val.status, val.statusText, val.headers, val.cf, val.body];
    }
  };
}
function createHTTPRevivers(impl) {
  return {
    Headers(value) {
      return assert2(typeof value == "object" && value !== null), new impl.Headers(value);
    },
    Request(value) {
      assert2(Array.isArray(value));
      let [method, url, headers, cf, body] = value;
      return assert2(typeof method == "string"), assert2(typeof url == "string"), assert2(headers instanceof impl.Headers), assert2(body === null || impl.isReadableStream(body)), new impl.Request(url, {
        method,
        headers,
        cf,
        // @ts-expect-error `duplex` is not required by `workerd` yet
        duplex: body === null ? void 0 : "half",
        body
      });
    },
    Response(value) {
      assert2(Array.isArray(value));
      let [status, statusText, headers, cf, body] = value;
      return assert2(typeof status == "number"), assert2(typeof statusText == "string"), assert2(headers instanceof impl.Headers), assert2(body === null || impl.isReadableStream(body)), new impl.Response(body, {
        status,
        statusText,
        headers,
        cf
      });
    }
  };
}
function stringifyWithStreams(impl, value, reducers, allowUnbufferedStream) {
  let unbufferedStream, bufferPromises = [], streamReducers = {
    ReadableStream(value2) {
      if (impl.isReadableStream(value2))
        return allowUnbufferedStream && unbufferedStream === void 0 ? unbufferedStream = value2 : bufferPromises.push(impl.bufferReadableStream(value2)), !0;
    },
    Blob(value2) {
      if (value2 instanceof impl.Blob)
        return bufferPromises.push(value2.arrayBuffer()), !0;
    },
    ...reducers
  };
  typeof value == "function" && (value = new __MiniflareFunctionWrapper(
    value
  ));
  let stringifiedValue = stringify(value, streamReducers);
  return bufferPromises.length === 0 ? { value: stringifiedValue, unbufferedStream } : Promise.all(bufferPromises).then((streamBuffers) => (streamReducers.ReadableStream = function(value2) {
    if (impl.isReadableStream(value2))
      return value2 === unbufferedStream ? !0 : streamBuffers.shift();
  }, streamReducers.Blob = function(value2) {
    if (value2 instanceof impl.Blob) {
      let array = [streamBuffers.shift(), value2.type];
      return value2 instanceof impl.File && array.push(value2.name, value2.lastModified), array;
    }
  }, { value: stringify(value, streamReducers), unbufferedStream }));
}
var __MiniflareFunctionWrapper = class {
  constructor(fnWithProps) {
    return new Proxy(this, {
      get: (_, key) => key === "__miniflareWrappedFunction" ? fnWithProps : fnWithProps[key]
    });
  }
};
function parseWithReadableStreams(impl, stringified, revivers) {
  let streamRevivers = {
    ReadableStream(value) {
      return value === !0 ? (assert2(stringified.unbufferedStream !== void 0), stringified.unbufferedStream) : (assert2(value instanceof ArrayBuffer), impl.unbufferReadableStream(value));
    },
    Blob(value) {
      if (assert2(Array.isArray(value)), value.length === 2) {
        let [buffer, type] = value;
        assert2(buffer instanceof ArrayBuffer), assert2(typeof type == "string");
        let opts = {};
        return type !== "" && (opts.type = type), new impl.Blob([buffer], opts);
      } else {
        assert2(value.length === 4);
        let [buffer, type, name, lastModified] = value;
        assert2(buffer instanceof ArrayBuffer), assert2(typeof type == "string"), assert2(typeof name == "string"), assert2(typeof lastModified == "number");
        let opts = { lastModified };
        return type !== "" && (opts.type = type), new impl.File([buffer], name, opts);
      }
    },
    ...revivers
  };
  return parse(stringified.value, streamRevivers);
}

// src/workers/core/proxy.worker.ts
var ENCODER = new TextEncoder(), DECODER = new TextDecoder(), ALLOWED_HOSTNAMES = ["127.0.0.1", "[::1]", "localhost"], WORKERS_PLATFORM_IMPL = {
  Blob,
  File,
  Headers,
  Request,
  Response,
  isReadableStream(value) {
    return value instanceof ReadableStream;
  },
  bufferReadableStream(stream) {
    return new Response(stream).arrayBuffer();
  },
  unbufferReadableStream(buffer) {
    let body = new Response(buffer).body;
    return assert3(body !== null), body;
  }
}, objectProtoNames = Object.getOwnPropertyNames(Object.prototype).sort().join("\0");
function isPlainObject(value) {
  let proto = Object.getPrototypeOf(value);
  return value?.constructor?.name === "RpcStub" || isObject(value) && objectContainsFunctions(value) ? !1 : proto === Object.prototype || proto === null || Object.getOwnPropertyNames(proto).sort().join("\0") === objectProtoNames;
}
function objectContainsFunctions(obj) {
  let propertyNames = Object.getOwnPropertyNames(obj), propertySymbols = Object.getOwnPropertySymbols(obj), properties = [...propertyNames, ...propertySymbols];
  for (let property of properties) {
    let entry = obj[property];
    if (typeof entry == "function" || isObject(entry) && objectContainsFunctions(entry))
      return !0;
  }
  return !1;
}
function isObject(value) {
  return !!value && typeof value == "object";
}
function getType(value) {
  return Object.prototype.toString.call(value).slice(8, -1);
}
function isInternal(value) {
  return isObject(value) && value[Symbol.for("cloudflare:internal-class")];
}
var ProxyServer = class {
  constructor(_state, env) {
    this.env = env;
    this.heap.set(ProxyAddresses.GLOBAL, globalThis), this.heap.set(ProxyAddresses.ENV, env);
  }
  nextHeapAddress = ProxyAddresses.USER_START;
  heap = /* @__PURE__ */ new Map();
  reducers = {
    ...structuredSerializableReducers,
    ...createHTTPReducers(WORKERS_PLATFORM_IMPL),
    // Corresponding revivers in `ProxyClient`
    // `Native` reducer *MUST* be applied last
    Native: (value) => {
      let type = getType(value);
      if ((type === "Object" || isInternal(value)) && !isPlainObject(value) || type === "Promise") {
        let address = this.nextHeapAddress++;
        this.heap.set(address, value), assert3(value !== null);
        let name = value?.constructor.name, isFunction = value instanceof __MiniflareFunctionWrapper;
        return [address, name, isFunction];
      }
    }
  };
  revivers = {
    ...structuredSerializableRevivers,
    ...createHTTPRevivers(WORKERS_PLATFORM_IMPL),
    // Corresponding reducers in `ProxyClient`
    Native: (value) => {
      assert3(Array.isArray(value));
      let [address] = value;
      assert3(typeof address == "number");
      let heapValue = this.heap.get(address);
      return assert3(heapValue !== void 0), heapValue instanceof Promise && this.heap.delete(address), heapValue;
    }
  };
  nativeReviver = { Native: this.revivers.Native };
  async fetch(request) {
    try {
      return await this.#fetch(request);
    } catch (e) {
      let error = reduceError(e);
      return Response.json(error, {
        status: 500,
        headers: { [CoreHeaders.ERROR_STACK]: "true" }
      });
    }
  }
  async #fetch(request) {
    let hostHeader = request.headers.get("Host");
    if (hostHeader == null) return new Response(null, { status: 400 });
    try {
      let host = new URL(`http://${hostHeader}`);
      if (!ALLOWED_HOSTNAMES.includes(host.hostname))
        return new Response(null, { status: 401 });
    } catch {
      return new Response(null, { status: 400 });
    }
    let secretHex = request.headers.get(CoreHeaders.OP_SECRET);
    if (secretHex == null) return new Response(null, { status: 401 });
    let expectedSecret = this.env[CoreBindings.DATA_PROXY_SECRET], secretBuffer = Buffer2.from(secretHex, "hex");
    if (secretBuffer.byteLength !== expectedSecret.byteLength || !crypto.subtle.timingSafeEqual(secretBuffer, expectedSecret))
      return new Response(null, { status: 401 });
    let opHeader = request.headers.get(CoreHeaders.OP), targetHeader = request.headers.get(CoreHeaders.OP_TARGET), keyHeader = request.headers.get(CoreHeaders.OP_KEY), allowAsync = request.headers.get(CoreHeaders.OP_SYNC) === null, argsSizeHeader = request.headers.get(CoreHeaders.OP_STRINGIFIED_SIZE), contentLengthHeader = request.headers.get("Content-Length");
    if (targetHeader === null) return new Response(null, { status: 400 });
    if (opHeader === ProxyOps.FREE) {
      for (let targetValue of targetHeader.split(",")) {
        let targetAddress = parseInt(targetValue);
        assert3(!Number.isNaN(targetAddress)), this.heap.delete(targetAddress);
      }
      return new Response(null, { status: 204 });
    }
    let target = parse(
      targetHeader,
      this.nativeReviver
    ), targetName = target.constructor.name, status = 200, result, unbufferedRest;
    if (opHeader === ProxyOps.GET) {
      if (result = keyHeader === null ? target : target[keyHeader], result?.constructor.name === "RpcProperty" && (result = await result), typeof result == "function")
        return new Response(null, {
          status: 204,
          headers: { [CoreHeaders.OP_RESULT_TYPE]: "Function" }
        });
    } else if (opHeader === ProxyOps.GET_OWN_DESCRIPTOR) {
      if (keyHeader === null) return new Response(null, { status: 400 });
      let descriptor = Object.getOwnPropertyDescriptor(target, keyHeader);
      descriptor !== void 0 && (result = {
        configurable: descriptor.configurable,
        enumerable: descriptor.enumerable,
        writable: descriptor.writable
      });
    } else if (opHeader === ProxyOps.GET_OWN_KEYS)
      result = Object.getOwnPropertyNames(target);
    else if (opHeader === ProxyOps.CALL) {
      assert3(keyHeader !== null);
      let func = target[keyHeader];
      if (assert3(typeof func == "function"), isFetcherFetch(targetName, keyHeader)) {
        let originalUrl = request.headers.get(CoreHeaders.ORIGINAL_URL), url = new URL(originalUrl ?? request.url);
        return request = new Request(url, request), request.headers.delete(CoreHeaders.OP_SECRET), request.headers.delete(CoreHeaders.OP), request.headers.delete(CoreHeaders.OP_TARGET), request.headers.delete(CoreHeaders.OP_KEY), request.headers.delete(CoreHeaders.ORIGINAL_URL), request.headers.delete(CoreHeaders.DISABLE_PRETTY_ERROR), func.call(target, request);
      }
      let args;
      if (argsSizeHeader === null || argsSizeHeader === contentLengthHeader)
        args = parseWithReadableStreams(
          WORKERS_PLATFORM_IMPL,
          { value: await request.text() },
          this.revivers
        );
      else {
        let argsSize = parseInt(argsSizeHeader);
        assert3(!Number.isNaN(argsSize)), assert3(request.body !== null);
        let [encodedArgs, rest] = await readPrefix(request.body, argsSize);
        unbufferedRest = rest;
        let stringifiedArgs = DECODER.decode(encodedArgs);
        args = parseWithReadableStreams(
          WORKERS_PLATFORM_IMPL,
          { value: stringifiedArgs, unbufferedStream: rest },
          this.revivers
        );
      }
      assert3(Array.isArray(args));
      try {
        if (isImagesInput(targetName, keyHeader)) {
          let transform = func.apply(target, [args[0]]);
          for (let operation of args[1])
            transform = transform[operation.type](...operation.arguments);
          result = transform.output(args[2]);
        } else ["RpcProperty", "RpcStub"].includes(func.constructor.name) ? result = await func(...args) : result = func.apply(target, args);
        isR2ObjectWriteHttpMetadata(targetName, keyHeader) && (result = args[0]);
      } catch (e) {
        status = 500, result = e;
      }
    } else
      return new Response(null, { status: 404 });
    let headers = new Headers();
    if (allowAsync && result instanceof Promise) {
      try {
        result = await result;
      } catch (e) {
        status = 500, result = e;
      }
      headers.append(CoreHeaders.OP_RESULT_TYPE, "Promise");
    }
    if (unbufferedRest !== void 0 && !unbufferedRest.locked)
      try {
        await unbufferedRest.pipeTo(new WritableStream());
      } catch {
      }
    if (result instanceof ReadableStream)
      return headers.append(CoreHeaders.OP_RESULT_TYPE, "ReadableStream"), new Response(result, { status, headers });
    {
      let stringified = await stringifyWithStreams(
        WORKERS_PLATFORM_IMPL,
        result,
        this.reducers,
        /* allowUnbufferedStream */
        allowAsync
      );
      if (stringified.unbufferedStream === void 0)
        return new Response(stringified.value, { status, headers });
      {
        let body = new IdentityTransformStream(), encodedValue = ENCODER.encode(stringified.value), encodedSize = encodedValue.byteLength.toString();
        return headers.set(CoreHeaders.OP_STRINGIFIED_SIZE, encodedSize), this.#writeWithUnbufferedStream(
          body.writable,
          encodedValue,
          stringified.unbufferedStream
        ), new Response(body.readable, { status, headers });
      }
    }
  }
  async #writeWithUnbufferedStream(writable, encodedValue, unbufferedStream) {
    let writer = writable.getWriter();
    await writer.write(encodedValue), writer.releaseLock(), await unbufferedStream.pipeTo(writable);
  }
};

// src/workers/core/entry.worker.ts
var encoder = new TextEncoder();
function getUserRequest(request, env, clientIp) {
  let originalUrl = request.headers.get(CoreHeaders.ORIGINAL_URL), url = new URL(originalUrl ?? request.url), rewriteHeadersFromOriginalUrl = !1, proxySharedSecret = request.headers.get(
    CoreHeaders.PROXY_SHARED_SECRET
  );
  if (proxySharedSecret) {
    let secretFromHeader = encoder.encode(proxySharedSecret), configuredSecret = env[CoreBindings.DATA_PROXY_SHARED_SECRET];
    if (secretFromHeader.byteLength === configuredSecret?.byteLength && crypto.subtle.timingSafeEqual(secretFromHeader, configuredSecret))
      rewriteHeadersFromOriginalUrl = !0;
    else
      throw new HttpError(
        400,
        `Disallowed header in request: ${CoreHeaders.PROXY_SHARED_SECRET}=${proxySharedSecret}`
      );
  }
  let upstreamUrl = env[CoreBindings.TEXT_UPSTREAM_URL];
  if (upstreamUrl !== void 0) {
    let path = url.pathname + url.search;
    path.startsWith("/") && (path = `./${path.substring(1)}`), url = new URL(path, upstreamUrl), rewriteHeadersFromOriginalUrl = !0;
  }
  request = new Request(url, request), request.headers.set("Accept-Encoding", "br, gzip");
  let secFetchMode = request.headers.get(CoreHeaders.SEC_FETCH_MODE);
  if (secFetchMode && request.headers.set("Sec-Fetch-Mode", secFetchMode), request.headers.delete(CoreHeaders.SEC_FETCH_MODE), rewriteHeadersFromOriginalUrl && request.headers.set("Host", url.host), clientIp && !request.headers.get("CF-Connecting-IP")) {
    let ipv4Regex = /(?<ip>.*?):\d+/, ipv6Regex = /\[(?<ip>.*?)\]:\d+/, ip = clientIp.match(ipv6Regex)?.groups?.ip ?? clientIp.match(ipv4Regex)?.groups?.ip;
    ip && request.headers.set("CF-Connecting-IP", ip);
  }
  return request.headers.delete(CoreHeaders.PROXY_SHARED_SECRET), request.headers.delete(CoreHeaders.ORIGINAL_URL), env[CoreBindings.STRIP_DISABLE_PRETTY_ERROR] && request.headers.delete(CoreHeaders.DISABLE_PRETTY_ERROR), request;
}
function getTargetService(request, url, env) {
  let service = env[CoreBindings.SERVICE_USER_FALLBACK], override = request.headers.get(CoreHeaders.ROUTE_OVERRIDE);
  request.headers.delete(CoreHeaders.ROUTE_OVERRIDE);
  let route = override ?? matchRoutes(env[CoreBindings.JSON_ROUTES], url);
  return route !== null && (service = env[`${CoreBindings.SERVICE_USER_ROUTE_PREFIX}${route}`]), service;
}
function maybePrettifyError(request, response, env) {
  return response.status !== 500 || response.headers.get(CoreHeaders.ERROR_STACK) === null ? response : env[CoreBindings.SERVICE_LOOPBACK].fetch(
    "http://localhost/core/error",
    {
      method: "POST",
      headers: request.headers,
      body: response.body,
      cf: { prettyErrorOriginalUrl: request.url }
    }
  );
}
function maybeInjectLiveReload(response, env, ctx) {
  let liveReloadScript = env[CoreBindings.DATA_LIVE_RELOAD_SCRIPT];
  if (liveReloadScript === void 0 || !response.headers.get("Content-Type")?.toLowerCase().includes("text/html"))
    return response;
  let headers = new Headers(response.headers), contentLength = parseInt(headers.get("content-length"));
  isNaN(contentLength) || headers.set(
    "content-length",
    String(contentLength + liveReloadScript.byteLength)
  );
  let { readable, writable } = new IdentityTransformStream();
  return ctx.waitUntil(
    (async () => {
      await response.body?.pipeTo(writable, { preventClose: !0 });
      let writer = writable.getWriter();
      await writer.write(liveReloadScript), await writer.close();
    })()
  ), new Response(readable, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
var acceptEncodingElement = /^(?<coding>[a-z]+|\*)(?:\s*;\s*q=(?<weight>\d+(?:.\d+)?))?$/;
function maybeParseAcceptEncodingElement(element) {
  let match = acceptEncodingElement.exec(element);
  if (match?.groups != null)
    return {
      coding: match.groups.coding,
      weight: match.groups.weight === void 0 ? 1 : parseFloat(match.groups.weight)
    };
}
function parseAcceptEncoding(header) {
  let encodings = [];
  for (let element of header.split(",")) {
    let maybeEncoding = maybeParseAcceptEncodingElement(element.trim());
    maybeEncoding !== void 0 && encodings.push(maybeEncoding);
  }
  return encodings.sort((a, b) => b.weight - a.weight);
}
function ensureAcceptableEncoding(clientAcceptEncoding, response) {
  if (clientAcceptEncoding === null) return response;
  let encodings = parseAcceptEncoding(clientAcceptEncoding);
  if (encodings.length === 0) return response;
  let contentEncoding = response.headers.get("Content-Encoding"), contentType = response.headers.get("Content-Type");
  if (!isCompressedByCloudflareFL(contentType) || contentEncoding !== null && contentEncoding !== "gzip" && contentEncoding !== "br")
    return response;
  let desiredEncoding, identityDisallowed = !1;
  for (let encoding of encodings)
    if (encoding.weight === 0)
      (encoding.coding === "identity" || encoding.coding === "*") && (identityDisallowed = !0);
    else if (encoding.coding === "gzip" || encoding.coding === "br") {
      desiredEncoding = encoding.coding;
      break;
    } else if (encoding.coding === "identity")
      break;
  return desiredEncoding === void 0 ? identityDisallowed ? new Response("Unsupported Media Type", {
    status: 415,
    headers: { "Accept-Encoding": "br, gzip" }
  }) : (contentEncoding === null || (response = new Response(response.body, response), response.headers.delete("Content-Encoding")), response) : (contentEncoding === desiredEncoding || (response = new Response(response.body, response), response.headers.set("Content-Encoding", desiredEncoding)), response);
}
function colourFromHTTPStatus(status) {
  return 200 <= status && status < 300 ? green : 400 <= status && status < 500 ? yellow : 500 <= status ? red : blue;
}
var ADDITIONAL_RESPONSE_LOG_HEADER_NAME = "X-Mf-Additional-Response-Log";
function maybeLogRequest(req, res, env, ctx, startTime) {
  res = new Response(res.body, res);
  let additionalResponseLog = res.headers.get(
    ADDITIONAL_RESPONSE_LOG_HEADER_NAME
  );
  if (res.headers.delete(ADDITIONAL_RESPONSE_LOG_HEADER_NAME), env[CoreBindings.JSON_LOG_LEVEL] < LogLevel2.INFO) return res;
  let url = new URL(req.url), statusText = (res.statusText.trim() || STATUS_CODES[res.status]) ?? "", lines = [
    `${bold(req.method)} ${url.pathname} `,
    colourFromHTTPStatus(res.status)(`${bold(res.status)} ${statusText} `),
    grey(`(${Date.now() - startTime}ms)`)
  ];
  additionalResponseLog && lines.push(` ${grey(additionalResponseLog)}`);
  let message = reset(lines.join(""));
  return ctx.waitUntil(
    env[CoreBindings.SERVICE_LOOPBACK].fetch("http://localhost/core/log", {
      method: "POST",
      headers: { [SharedHeaders2.LOG_LEVEL]: LogLevel2.INFO.toString() },
      body: message
    })
  ), res;
}
function handleProxy(request, env) {
  let ns = env[CoreBindings.DURABLE_OBJECT_NAMESPACE_PROXY], id = ns.idFromName("");
  return ns.get(id).fetch(request);
}
var entry_worker_default = {
  async fetch(request, env, ctx) {
    let startTime = Date.now(), clientIp = request.cf?.clientIp, clientCfBlobHeader = request.headers.get(CoreHeaders.CF_BLOB), cf = clientCfBlobHeader ? JSON.parse(clientCfBlobHeader) : {
      ...env[CoreBindings.JSON_CF_BLOB],
      // Defaulting to empty string to preserve undefined `Accept-Encoding`
      // through Wrangler's proxy worker.
      clientAcceptEncoding: request.headers.get("Accept-Encoding") ?? ""
    };
    if (request = new Request(request, { cf }), request.headers.get(CoreHeaders.OP) !== null) return handleProxy(request, env);
    let disablePrettyErrorPage = request.headers.get(CoreHeaders.DISABLE_PRETTY_ERROR) !== null, clientAcceptEncoding = request.headers.get("Accept-Encoding");
    try {
      request = getUserRequest(request, env, clientIp);
    } catch (e) {
      if (e instanceof HttpError)
        return e.toResponse();
      throw e;
    }
    let url = new URL(request.url), service = getTargetService(request, url, env);
    if (service === void 0)
      return new Response("No entrypoint worker found", { status: 404 });
    try {
      if (env[CoreBindings.TRIGGER_HANDLERS]) {
        if (url.pathname === "/cdn-cgi/handler/scheduled" || /* legacy URL path */
        url.pathname === "/cdn-cgi/mf/scheduled")
          return url.pathname === "/cdn-cgi/mf/scheduled" && ctx.waitUntil(
            env[CoreBindings.SERVICE_LOOPBACK].fetch(
              "http://localhost/core/log",
              {
                method: "POST",
                headers: {
                  [SharedHeaders2.LOG_LEVEL]: LogLevel2.WARN.toString()
                },
                body: "Triggering scheduled handlers via a request to `/cdn-cgi/mf/scheduled` is deprecated, and will be removed in a future version of Miniflare. Instead, send a request to `/cdn-cgi/handler/scheduled`"
              }
            )
          ), await handleScheduled(url.searchParams, service);
        if (url.pathname === "/cdn-cgi/handler/email")
          return await handleEmail(
            url.searchParams,
            request,
            service,
            env,
            ctx
          );
        if (url.pathname.startsWith("/cdn-cgi/handler/"))
          return new Response(
            `"${url.pathname}" is not a valid handler. Did you mean to use "/cdn-cgi/handler/scheduled" or "/cdn-cgi/handler/email"?`,
            { status: 404 }
          );
      }
      let response = await service.fetch(request);
      return disablePrettyErrorPage || (response = await maybePrettifyError(request, response, env)), response = maybeInjectLiveReload(response, env, ctx), response = ensureAcceptableEncoding(clientAcceptEncoding, response), env[CoreBindings.LOG_REQUESTS] && (response = maybeLogRequest(request, response, env, ctx, startTime)), response;
    } catch (e) {
      return new Response(e?.stack ?? String(e), { status: 500 });
    }
  }
};
export {
  ProxyServer,
  entry_worker_default as default
};
//# sourceMappingURL=entry.worker.js.map
