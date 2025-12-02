import { createPrivateKey, createPublicKey } from 'node:crypto';
const parse = (jwk) => {
    return (jwk.d ? createPrivateKey : createPublicKey)({ format: 'jwk', key: jwk });
};
export default parse;
