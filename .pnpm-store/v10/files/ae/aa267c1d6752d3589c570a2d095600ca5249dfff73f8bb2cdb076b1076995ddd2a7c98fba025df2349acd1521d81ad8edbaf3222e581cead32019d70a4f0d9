// src/isomorphicBtoa.ts
var isomorphicBtoa = (data) => {
  if (typeof btoa !== "undefined" && typeof btoa === "function") {
    return btoa(data);
  } else if (typeof global !== "undefined" && global.Buffer) {
    return new global.Buffer(data).toString("base64");
  }
  return data;
};

export {
  isomorphicBtoa
};
//# sourceMappingURL=chunk-KOH7GTJO.mjs.map