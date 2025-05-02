export const toSigFigs = (num: number, sigFigs: number) => {
  // toPrecision  returns significant digits formatted with potentially exponential notation
  // Number() converts the exponential notation to a regular number
  return Number(num.toPrecision(sigFigs));
};
