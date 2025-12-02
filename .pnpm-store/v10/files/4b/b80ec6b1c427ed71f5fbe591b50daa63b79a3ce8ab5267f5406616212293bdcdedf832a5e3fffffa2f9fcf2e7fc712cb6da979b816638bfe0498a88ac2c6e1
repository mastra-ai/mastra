const webCrypto = globalThis.crypto;
const subtle = webCrypto.subtle;
const randomUUID = () => {
  return webCrypto.randomUUID();
};
const getRandomValues = (array) => {
  return webCrypto.getRandomValues(array);
};
const _crypto = {
  randomUUID,
  getRandomValues,
  subtle
};

export { _crypto as default, getRandomValues, randomUUID, subtle };
