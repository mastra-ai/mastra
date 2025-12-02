"use strict";
/*!
 * Portions Copyright (c) 2019 MagicStack Inc. and the Gel authors.
 * Portions Copyright (c) 2001-2019 Python Software Foundation.
 * All rights reserved.
 * Licence: PSFL https://docs.python.org/3/license.html
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isLeapYear = isLeapYear;
exports.daysInMonth = daysInMonth;
exports.daysBeforeMonth = daysBeforeMonth;
exports.ymd2ord = ymd2ord;
exports.ord2ymd = ord2ymd;
function isLeapYear(year) {
    return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}
function daysInMonth(year, month) {
    if (month === 2 && isLeapYear(year)) {
        return 29;
    }
    return _DAYS_IN_MONTH[month];
}
function daysBeforeYear(year) {
    const y = year - 1;
    return (y * 365 + Math.trunc(y / 4) - Math.trunc(y / 100) + Math.trunc(y / 400));
}
function daysBeforeMonth(year, month) {
    return _DAYS_BEFORE_MONTH[month] + (month > 2 && isLeapYear(year) ? 1 : 0);
}
const _DI400Y = daysBeforeYear(401);
const _DI100Y = daysBeforeYear(101);
const _DI4Y = daysBeforeYear(5);
const _DAYS_IN_MONTH = [-1, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const _DAYS_BEFORE_MONTH = (() => {
    const dbf = [-1];
    let dbm = 0;
    for (let i = 1; i < _DAYS_IN_MONTH.length; i++) {
        const dim = _DAYS_IN_MONTH[i];
        dbf.push(dbm);
        dbm += dim;
    }
    return dbf;
})();
function ymd2ord(year, month, day) {
    return daysBeforeYear(year) + daysBeforeMonth(year, month) + day;
}
function divmod(dividend, divisor) {
    const quotient = Math.floor(dividend / divisor);
    return [quotient, dividend - divisor * quotient];
}
function ord2ymd(n) {
    n--;
    let n400;
    [n400, n] = divmod(n, _DI400Y);
    let year = n400 * 400 + 1;
    let n100;
    [n100, n] = divmod(n, _DI100Y);
    let n4;
    [n4, n] = divmod(n, _DI4Y);
    let n1;
    [n1, n] = divmod(n, 365);
    year += n100 * 100 + n4 * 4 + n1;
    if (n1 === 4 || n100 === 4) {
        return [year - 1, 12, 31];
    }
    const leapyear = n1 === 3 && (n4 !== 24 || n100 === 3);
    let month = (n + 50) >> 5;
    let preceding = _DAYS_BEFORE_MONTH[month] + (month > 2 && leapyear ? 1 : 0);
    if (preceding > n) {
        month -= 1;
        preceding -= _DAYS_IN_MONTH[month] + (month === 2 && leapyear ? 1 : 0);
    }
    n -= preceding;
    return [year, month, n + 1];
}
