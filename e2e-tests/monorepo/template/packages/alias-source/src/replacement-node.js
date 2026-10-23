globalThis.MASTRA_NODE_ALIAS_SHIM = true;

export default class Ajv {
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
