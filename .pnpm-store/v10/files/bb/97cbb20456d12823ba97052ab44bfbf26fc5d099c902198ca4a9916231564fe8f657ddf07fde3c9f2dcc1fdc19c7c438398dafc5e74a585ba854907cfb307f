/*

LCS implementation that supports arrays or strings

reference: http://en.wikipedia.org/wiki/Longest_common_subsequence_problem

*/
const defaultMatch = (array1, array2, index1, index2) => array1[index1] === array2[index2];
const lengthMatrix = (array1, array2, match, context) => {
    var _a, _b, _c;
    const len1 = array1.length;
    const len2 = array2.length;
    let x;
    let y;
    // initialize empty matrix of len1+1 x len2+1
    const matrix = new Array(len1 + 1);
    for (x = 0; x < len1 + 1; x++) {
        const matrixNewRow = new Array(len2 + 1);
        for (y = 0; y < len2 + 1; y++) {
            matrixNewRow[y] = 0;
        }
        matrix[x] = matrixNewRow;
    }
    matrix.match = match;
    // save sequence lengths for each coordinate
    for (x = 1; x < len1 + 1; x++) {
        const matrixRowX = matrix[x];
        if (matrixRowX === undefined) {
            throw new Error("LCS matrix row is undefined");
        }
        const matrixRowBeforeX = matrix[x - 1];
        if (matrixRowBeforeX === undefined) {
            throw new Error("LCS matrix row is undefined");
        }
        for (y = 1; y < len2 + 1; y++) {
            if (match(array1, array2, x - 1, y - 1, context)) {
                matrixRowX[y] = ((_a = matrixRowBeforeX[y - 1]) !== null && _a !== void 0 ? _a : 0) + 1;
            }
            else {
                matrixRowX[y] = Math.max((_b = matrixRowBeforeX[y]) !== null && _b !== void 0 ? _b : 0, (_c = matrixRowX[y - 1]) !== null && _c !== void 0 ? _c : 0);
            }
        }
    }
    return matrix;
};
const backtrack = (matrix, array1, array2, context) => {
    let index1 = array1.length;
    let index2 = array2.length;
    const subsequence = {
        sequence: [],
        indices1: [],
        indices2: [],
    };
    while (index1 !== 0 && index2 !== 0) {
        if (matrix.match === undefined) {
            throw new Error("LCS matrix match function is undefined");
        }
        const sameLetter = matrix.match(array1, array2, index1 - 1, index2 - 1, context);
        if (sameLetter) {
            subsequence.sequence.unshift(array1[index1 - 1]);
            subsequence.indices1.unshift(index1 - 1);
            subsequence.indices2.unshift(index2 - 1);
            --index1;
            --index2;
        }
        else {
            const matrixRowIndex1 = matrix[index1];
            if (matrixRowIndex1 === undefined) {
                throw new Error("LCS matrix row is undefined");
            }
            const valueAtMatrixAbove = matrixRowIndex1[index2 - 1];
            if (valueAtMatrixAbove === undefined) {
                throw new Error("LCS matrix value is undefined");
            }
            const matrixRowBeforeIndex1 = matrix[index1 - 1];
            if (matrixRowBeforeIndex1 === undefined) {
                throw new Error("LCS matrix row is undefined");
            }
            const valueAtMatrixLeft = matrixRowBeforeIndex1[index2];
            if (valueAtMatrixLeft === undefined) {
                throw new Error("LCS matrix value is undefined");
            }
            if (valueAtMatrixAbove > valueAtMatrixLeft) {
                --index2;
            }
            else {
                --index1;
            }
        }
    }
    return subsequence;
};
const get = (array1, array2, match, context) => {
    const innerContext = context || {};
    const matrix = lengthMatrix(array1, array2, match || defaultMatch, innerContext);
    return backtrack(matrix, array1, array2, innerContext);
};
export default {
    get,
};
