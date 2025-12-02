// src/isomorphicAtob.ts
var isomorphicAtob = (data) => {
  if (typeof atob !== "undefined" && typeof atob === "function") {
    return atob(data);
  } else if (typeof global !== "undefined" && global.Buffer) {
    return new global.Buffer(data, "base64").toString();
  }
  return data;
};

export {
  isomorphicAtob
};
//# sourceMappingURL=chunk-TETGTEI2.mjs.map