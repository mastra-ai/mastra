const decoders = /* @__PURE__ */ new Map();
const encoder = new TextEncoder();
const binary = {
  decode: (data, encoding = "utf-8") => {
    if (!decoders.has(encoding)) {
      decoders.set(encoding, new TextDecoder(encoding));
    }
    const decoder = decoders.get(encoding);
    return decoder.decode(data);
  },
  encode: encoder.encode
};

export { binary };
