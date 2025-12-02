// src/jwt/legacyReturn.ts
function withLegacyReturn(cb) {
  return async (...args) => {
    const { data, errors } = await cb(...args);
    if (errors) {
      throw errors[0];
    }
    return data;
  };
}
function withLegacySyncReturn(cb) {
  return (...args) => {
    const { data, errors } = cb(...args);
    if (errors) {
      throw errors[0];
    }
    return data;
  };
}

export {
  withLegacyReturn,
  withLegacySyncReturn
};
//# sourceMappingURL=chunk-P263NW7Z.mjs.map