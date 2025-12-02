// src/workers/workflows/wrapped-binding.worker.ts
var WorkflowImpl = class {
  constructor(binding) {
    this.binding = binding;
    this.binding = binding;
  }
  async get(id) {
    let instanceHandle = new InstanceImpl(id, this.binding);
    return await instanceHandle.status(), instanceHandle;
  }
  async create(options) {
    using result = await this.binding.create(options);
    return new InstanceImpl(result.id, this.binding);
  }
  async createBatch(options) {
    return (await this.binding.createBatch(options)).map((res) => new InstanceImpl(res.id, this.binding));
  }
  async unsafeGetBindingName() {
    return this.binding.unsafeGetBindingName();
  }
  async unsafeAbort(instanceId, reason) {
    return this.binding.unsafeAbort(instanceId, reason);
  }
  async unsafeGetInstanceModifier(instanceId) {
    return this.binding.unsafeGetInstanceModifier(instanceId);
  }
  async unsafeWaitForStepResult(instanceId, name, index) {
    return this.binding.unsafeWaitForStepResult(instanceId, name, index);
  }
  async unsafeWaitForStatus(instanceId, status) {
    return await this.binding.unsafeWaitForStatus(instanceId, status);
  }
}, InstanceImpl = class {
  constructor(id, binding) {
    this.id = id;
    this.binding = binding;
  }
  async pause() {
    throw new Error("Not implemented yet");
  }
  async resume() {
    throw new Error("Not implemented yet");
  }
  async terminate() {
    throw new Error("Not implemented yet");
  }
  async restart() {
    throw new Error("Not implemented yet");
  }
  async status() {
    let instance = await this.binding.get(this.id);
    using res = await instance.status();
    return instance[Symbol.dispose](), structuredClone(res);
  }
  async sendEvent(args) {
    let instance = await this.binding.get(this.id);
    await instance.sendEvent(args), instance[Symbol.dispose]();
  }
};
function makeBinding(env) {
  return new WorkflowImpl(env.binding);
}
var wrapped_binding_worker_default = makeBinding;
export {
  wrapped_binding_worker_default as default,
  makeBinding
};
//# sourceMappingURL=wrapped-binding.worker.js.map
