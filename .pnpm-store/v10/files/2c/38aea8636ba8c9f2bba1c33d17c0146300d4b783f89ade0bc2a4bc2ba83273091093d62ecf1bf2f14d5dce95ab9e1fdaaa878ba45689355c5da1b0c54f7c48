const hexadecimal = "0123456789abcdef";
const hex = {
  encode: (data) => {
    if (typeof data === "string") {
      data = new TextEncoder().encode(data);
    }
    if (data.byteLength === 0) {
      return "";
    }
    const buffer = new Uint8Array(data);
    let result = "";
    for (const byte of buffer) {
      result += byte.toString(16).padStart(2, "0");
    }
    return result;
  },
  decode: (data) => {
    if (!data) {
      return "";
    }
    if (typeof data === "string") {
      if (data.length % 2 !== 0) {
        throw new Error("Invalid hexadecimal string");
      }
      if (!new RegExp(`^[${hexadecimal}]+$`).test(data)) {
        throw new Error("Invalid hexadecimal string");
      }
      const result = new Uint8Array(data.length / 2);
      for (let i = 0; i < data.length; i += 2) {
        result[i / 2] = parseInt(data.slice(i, i + 2), 16);
      }
      return new TextDecoder().decode(result);
    }
    return new TextDecoder().decode(data);
  }
};

export { hex };
