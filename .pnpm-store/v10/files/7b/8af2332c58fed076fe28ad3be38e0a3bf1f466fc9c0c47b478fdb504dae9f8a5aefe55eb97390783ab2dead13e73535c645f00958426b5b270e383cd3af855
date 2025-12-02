"use strict";

const envVarName = "___INTERNAL___IS_INSIDE_BABEL_REGISTER_WORKER___";
const envVarValue = "yes_I_am";
const markInRegisterWorker = env => Object.assign({}, env, {
  [envVarName]: envVarValue
});
const isInRegisterWorker = process.env[envVarName] === envVarValue;
module.exports = {
  markInRegisterWorker,
  isInRegisterWorker
};

//# sourceMappingURL=is-in-register-worker.cjs.map
