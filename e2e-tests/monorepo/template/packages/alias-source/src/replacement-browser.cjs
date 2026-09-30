globalThis.MASTRA_BROWSER_CJS_ALIAS_SHIM = true;

class Ajv {
  compile() {
    const validate = () => true;
    validate.errors = null;
    return validate;
  }

  addFormat() {
    return this;
  }

  addKeyword() {
    return this;
  }
}

module.exports = Ajv;
module.exports.default = Ajv;
module.exports.Ajv = Ajv;
