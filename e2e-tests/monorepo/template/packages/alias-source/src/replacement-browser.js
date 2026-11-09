globalThis.MASTRA_BROWSER_ALIAS_SHIM = true;

export class Ajv {
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

export default Ajv;
