export class NumberValue {
    value;
    constructor(value) {
        if (typeof value === "object" && "N" in value) {
            this.value = String(value.N);
        }
        else {
            this.value = String(value);
        }
        const valueOf = typeof value.valueOf() === "number" ? value.valueOf() : 0;
        const imprecise = valueOf > Number.MAX_SAFE_INTEGER ||
            valueOf < Number.MIN_SAFE_INTEGER ||
            Math.abs(valueOf) === Infinity ||
            Number.isNaN(valueOf);
        if (imprecise) {
            throw new Error(`NumberValue should not be initialized with an imprecise number=${valueOf}. Use a string instead.`);
        }
    }
    static from(value) {
        return new NumberValue(value);
    }
    toAttributeValue() {
        return {
            N: this.toString(),
        };
    }
    toBigInt() {
        const stringValue = this.toString();
        return BigInt(stringValue);
    }
    toString() {
        return String(this.value);
    }
    valueOf() {
        return this.toString();
    }
}
