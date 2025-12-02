'use strict';

const array = require('./array.cjs');

const random = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1) + min);
};
const draw = (array) => {
  const max = array.length;
  if (max === 0) {
    return null;
  }
  const index = random(0, max - 1);
  return array[index];
};
const shuffle = (array) => {
  return array.map((a) => ({ rand: Math.random(), value: a })).sort((a, b) => a.rand - b.rand).map((a) => a.value);
};
const uid = (length, specials = "") => {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789" + specials;
  return array.iterate(
    length,
    (acc) => {
      return acc + characters.charAt(random(0, characters.length - 1));
    },
    ""
  );
};

exports.draw = draw;
exports.random = random;
exports.shuffle = shuffle;
exports.uid = uid;
//# sourceMappingURL=random.cjs.map
