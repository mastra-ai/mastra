module.exports = {
  IncomingForm: class {
    parse(_req, callback) {
      if (typeof callback === 'function') {
        callback(null, {}, {});
      }
    },
    on() {
      return this;
    },
  },
};
