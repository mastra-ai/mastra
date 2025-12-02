"use strict";
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
var embeddingsList_1 = require("../embeddingsList");
describe('EmbeddingsList', function () {
    var mockEmbeddings;
    var mockUsage;
    var mockModel;
    var embeddingsList;
    beforeAll(function () {
        mockEmbeddings = [{ values: [1, 2, 3] }, { values: [4, 5, 6] }];
        mockUsage = { totalTokens: 3 };
        mockModel = 'someEmbeddingModel';
        embeddingsList = new embeddingsList_1.EmbeddingsList(mockModel, mockEmbeddings, mockUsage);
    });
    it('Should initialize embeddingsList class correctly', function () {
        var _a;
        expect(embeddingsList).toBeInstanceOf(embeddingsList_1.EmbeddingsList);
        expect(embeddingsList.model).toEqual(mockModel);
        expect(embeddingsList.data).toEqual(mockEmbeddings);
        expect(embeddingsList.usage).toEqual(mockUsage);
        expect((_a = embeddingsList.data) === null || _a === void 0 ? void 0 : _a.values).toEqual(mockEmbeddings.values);
    });
    it('Should return correct Embedding by index and by element', function () {
        expect(embeddingsList.get(0)).toEqual(mockEmbeddings[0]);
        var elementToFindIndexOf = mockEmbeddings[0];
        expect(embeddingsList.indexOf(elementToFindIndexOf)).toEqual(0);
    });
    it('Should truncate output of values when necessary', function () {
        var manyValues = [1, 2, 3, 4, 5, 6, 7, 8];
        var truncatedManyValues = embeddingsList.truncateValuesForDisplay(manyValues);
        expect(truncatedManyValues).toEqual([1, 2, '...', 7, 8]);
        var fewValues = [1, 2];
        var truncatedFewValues = embeddingsList.truncateValuesForDisplay(fewValues);
        expect(truncatedFewValues).toEqual(fewValues);
    });
});
describe('truncateData', function () {
    var mockEmbeddings;
    var mockUsage;
    var embeddingsList;
    var mockModel;
    beforeAll(function () {
        mockEmbeddings = [{ values: [1, 2, 3] }, { values: [4, 5, 6] }];
        mockUsage = { totalTokens: 3 };
        mockModel = 'someEmbeddingModel';
        embeddingsList = new embeddingsList_1.EmbeddingsList(mockModel, mockEmbeddings, mockUsage);
    });
    // Mock the truncateValues method to avoid side effects
    beforeEach(function () {
        jest
            .spyOn(embeddingsList_1.EmbeddingsList.prototype, 'truncateValuesForDisplay')
            .mockImplementation(function (values) {
            if (!values || values.length <= 4) {
                return values ? values : [];
            }
            return __spreadArray(__spreadArray(__spreadArray([], values.slice(0, 2), true), ['...'], false), values.slice(-2), true);
        });
    });
    it('Should truncate output of data object when appropriate', function () {
        var mockEmbeddingsWithoutTruncationExpected = [
            { values: [1, 2, 3] },
            { values: [4, 5, 6] },
            { values: [7, 8, 9] },
        ];
        embeddingsList = new embeddingsList_1.EmbeddingsList(mockModel, mockEmbeddingsWithoutTruncationExpected, mockUsage);
        var expectedTruncatedData = [
            { values: [1, 2, 3] },
            { values: [4, 5, 6] },
            { values: [7, 8, 9] },
        ];
        expect(embeddingsList['truncateDataForDisplay']()).toEqual(expectedTruncatedData);
    });
    it('should truncate data correctly when there are more than 5 embeddings', function () {
        var mockEmbeddingsWithTruncationExpected = [
            { values: [1, 2, 3, 4, 5] },
            { values: [6, 7, 8, 9, 10] },
            { values: [11, 12, 13, 14, 15] },
            { values: [16, 17, 18, 19, 20] },
            { values: [21, 22, 23, 24, 25] },
            { values: [26, 27, 28, 29, 30] },
        ];
        embeddingsList = new embeddingsList_1.EmbeddingsList(mockModel, mockEmbeddingsWithTruncationExpected, mockUsage);
        var expectedTruncatedData = [
            { values: [1, 2, '...', 4, 5] },
            { values: [6, 7, '...', 9, 10] },
            "   ... (2 more embeddings) ...",
            { values: [21, 22, '...', 24, 25] },
            { values: [26, 27, '...', 29, 30] },
        ];
        expect(embeddingsList['truncateDataForDisplay']()).toEqual(expectedTruncatedData);
    });
});
//# sourceMappingURL=embeddingsList.test.js.map