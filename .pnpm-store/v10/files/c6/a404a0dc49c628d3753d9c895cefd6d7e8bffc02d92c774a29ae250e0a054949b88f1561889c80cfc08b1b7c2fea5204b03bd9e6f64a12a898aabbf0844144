function createConversions(entity) {
  const conversions = {
    fromComposite: {
      toKeys: (composite, options = {}) =>
        entity._fromCompositeToKeys({ provided: composite }, options),
      toCursor: (composite) =>
        entity._fromCompositeToCursor(
          { provided: composite },
          { strict: "all" },
        ),
    },
    fromKeys: {
      toCursor: (keys) => entity._fromKeysToCursor({ provided: keys }, {}),
      toComposite: (keys) => entity._fromKeysToComposite({ provided: keys }),
    },
    fromCursor: {
      toKeys: (cursor) => entity._fromCursorToKeys({ provided: cursor }),
      toComposite: (cursor) =>
        entity._fromCursorToComposite({ provided: cursor }),
    },
    byAccessPattern: {},
  };

  for (let accessPattern in entity.model.indexes) {
    let index = entity.model.indexes[accessPattern].index;
    conversions.byAccessPattern[accessPattern] = {
      fromKeys: {
        toCursor: (keys) =>
          entity._fromKeysToCursorByIndex({ indexName: index, provided: keys }),
        toComposite: (keys) =>
          entity._fromKeysToCompositeByIndex({
            indexName: index,
            provided: keys,
          }),
      },
      fromCursor: {
        toKeys: (cursor) =>
          entity._fromCursorToKeysByIndex({
            indexName: index,
            provided: cursor,
          }),
        toComposite: (cursor) =>
          entity._fromCursorToCompositeByIndex({
            indexName: index,
            provided: cursor,
          }),
      },
      fromComposite: {
        toCursor: (composite) =>
          entity._fromCompositeToCursorByIndex(
            { indexName: index, provided: composite },
            { strict: "all" },
          ),
        toKeys: (composite, options = {}) =>
          entity._fromCompositeToKeysByIndex(
            { indexName: index, provided: composite },
            options,
          ),
      },
    };
  }

  return conversions;
}

module.exports = {
  createConversions,
};
