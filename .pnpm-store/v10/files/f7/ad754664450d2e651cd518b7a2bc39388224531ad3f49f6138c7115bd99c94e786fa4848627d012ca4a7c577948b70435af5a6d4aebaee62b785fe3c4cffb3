import { createFilter, dataToEsm } from '@rollup/pluginutils';

function json(options) {
  if ( options === void 0 ) options = {};

  var filter = createFilter(options.include, options.exclude);
  var indent = 'indent' in options ? options.indent : '\t';

  return {
    name: 'json',

    // eslint-disable-next-line no-shadow
    transform: function transform(code, id) {
      if (id.slice(-5) !== '.json' || !filter(id)) { return null; }

      try {
        var parsed = JSON.parse(code);
        return {
          code: dataToEsm(parsed, {
            preferConst: options.preferConst,
            compact: options.compact,
            namedExports: options.namedExports,
            includeArbitraryNames: options.includeArbitraryNames,
            indent: indent
          }),
          map: { mappings: '' }
        };
      } catch (err) {
        var message = 'Could not parse JSON file';
        this.error({ message: message, id: id, cause: err });
        return null;
      }
    }
  };
}

export { json as default };
//# sourceMappingURL=index.js.map
