const memberTypeToSetType = {
  String: "String",
  Number: "Number",
  NumberValue: "Number",
  Binary: "Binary",
  string: "String",
  number: "Number",
};

class DynamoDBSet {
  constructor(list, type) {
    this.wrapperName = "Set";
    this.type = memberTypeToSetType[type];
    if (this.type === undefined) {
      new Error(`Invalid Set type: ${type}`);
    }
    this.values = Array.from(new Set([].concat(list)));
  }

  initialize(list, validate) {}

  detectType() {
    return memberTypeToSetType[typeof this.values[0]];
  }

  validate() {}

  toJSON() {
    return this.values;
  }
}

module.exports = { DynamoDBSet };
