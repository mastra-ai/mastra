export default (key, alg) => {
    const { modulusLength } = key.asymmetricKeyDetails;
    if (typeof modulusLength !== 'number' || modulusLength < 2048) {
        throw new TypeError(`${alg} requires key modulusLength to be 2048 bits or larger`);
    }
};
