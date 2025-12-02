// src/api/subscribable/EventSubscriptionSubject.ts
import { BaseSubject } from "./BaseSubject.js";
var EventSubscriptionSubject = class extends BaseSubject {
  constructor(config) {
    super();
    this.config = config;
  }
  getState() {
    return this.config.binding.getState();
  }
  outerSubscribe(callback) {
    return this.config.binding.subscribe(callback);
  }
  _connect() {
    const callback = () => {
      this.notifySubscribers();
    };
    let lastState = this.config.binding.getState();
    let innerUnsubscribe = lastState?.unstable_on(this.config.event, callback);
    const onRuntimeUpdate = () => {
      const newState = this.config.binding.getState();
      if (newState === lastState) return;
      lastState = newState;
      innerUnsubscribe?.();
      innerUnsubscribe = this.config.binding.getState()?.unstable_on(this.config.event, callback);
    };
    const outerUnsubscribe = this.outerSubscribe(onRuntimeUpdate);
    return () => {
      outerUnsubscribe?.();
      innerUnsubscribe?.();
    };
  }
};
export {
  EventSubscriptionSubject
};
//# sourceMappingURL=EventSubscriptionSubject.js.map