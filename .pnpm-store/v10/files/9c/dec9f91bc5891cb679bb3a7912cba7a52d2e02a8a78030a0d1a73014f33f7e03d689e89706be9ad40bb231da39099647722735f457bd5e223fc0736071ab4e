'use strict';

const expect = require('chai').expect

const { purgeSpinnersOptions, purgeSpinnerOptions, colorOptions, breakText } = require('../utils');
const { dots } = require('../spinners');

describe('utils', () => {
  beforeEach('set options', () => {
    this.colors = { color: 'blue', spinnerColor: 'blue', succeedColor: 'blue', failColor: 'blue' };
  });

  describe('functions', () => {
    describe('#colorOptions', () => {
      context('when specifying other attributes rather than valid colors', () => {
        it('removes the invalid keys', () => {
          const colors = colorOptions({ ...this.colors, foo: 'foo', bar: 'bar' });
          expect(colors).to.include(this.colors);
          expect(colors).to.not.include({ foo: 'foo', bar: 'bar' });
          expect(colors).to.not.have.any.keys('foo', 'bar');
        });

        it('removes invalid colors', () => {
          const colors = colorOptions({ ...this.colors, spinnerColor: 'foo', succeedColor: 'bar' });
          expect(colors).to.include({ color: 'blue', failColor: 'blue' });
          expect(colors).to.not.have.any.keys('spinnerColor', 'succeedColor');
        });
      });
    });

    describe('#purgeSpinnersOptions', () => {
      describe('spinner object', () => {
        context('when providing invalid interval and frames', () => {
          it('picks the default spinner', () => {
            const spinner = { interval: 'foo', frames: 'bar' };
            const options = purgeSpinnersOptions({ ...this.colors, spinner });
            expect(options).to.deep.include({ ...this.colors, spinner: dots });
          });
        });

        context('when providing invalid interval', () => {
          it('picks the interval from the default spinner', () => {
            const spinner = { interval: 'foo', frames: ['-', '+'] };
            const options = purgeSpinnersOptions({ ...this.colors, spinner });
            expect(options).to.deep.include({ ...this.colors, spinner: { interval: dots.interval, frames: ['-', '+'] } });
          });
        });

        context('when providing invalid frames', () => {
          it('picks frames from the default spinner', () => {
            const spinner = { interval: 100, frames: 'foo' };
            const options = purgeSpinnersOptions({ ...this.colors, spinner });
            expect(options).to.deep.include({ ...this.colors, spinner: { interval: 100, frames: dots.frames } });
          });
        });

        context('when providing valid spinner', () => {
          it('persists the spinner', () => {
            const spinner = { interval: 100, frames: ['-', '+'] };
            const options = purgeSpinnersOptions({ ...this.colors, spinner });
            expect(options).to.deep.include({ ...this.colors, spinner });
          });
        })
      });
    });

    describe('#purgeSpinnerOptions', () => {
      context('when providing valid status and name', () => {
        it('persist them', () => {
          const options = purgeSpinnerOptions({ ...this.colors, text: 'text', status: 'succeed' });
          expect(options).to.include({ ...this.colors, text: 'text', status: 'succeed' });
        });
      });

      context('when providing invalid status and name', () => {
        it('does not persist them', () => {
          const options = purgeSpinnerOptions({ ...this.colors, text: 3, status: 'foo' });
          expect(options).to.include(this.colors);
          expect(options).to.not.have.any.keys('text', 'status');
        });
      });

      context('when providing valid indent value', () => {
        it('persist it', () => {
          const options = purgeSpinnerOptions({ indent: 2 });
          expect(options).to.include({ indent: 2 });
        });
      });

      context('when providing invalid indent value', () => {
        it('does not persist it', () => {
          const options = purgeSpinnerOptions({ indent: 'bar' });
          expect(options).to.not.have.key('indent');
        });
      });
      
    });

    describe('#breakText', () => {
      beforeEach(() => {
        this.columns = process.stderr.columns;
        process.stderr.columns = 10;
      });

      afterEach(() => {
        process.stderr.columns = this.columns;
      });

      context('when number of lines in text is greater than the columns length', () => {
        it('adds line-breaks to the given text', () => {
          const text = breakText(new Array(51).join('a'), 3);
          const splitted = text.split('\n');
          expect(splitted).to.have.lengthOf(6);
          expect(splitted[0]).to.have.lengthOf(6); // 10 - 3 - 1
          expect(splitted[1]).to.have.lengthOf(9); // 10 - 0 - 1
        });
      });

      context('when number of lines in text is less than the columns length', () => {
        it('does not add line-breaks to the given text', () => {
          const text = '12345';
          expect(text.split('\n')).to.have.lengthOf(1);
        });
      });
    });
  });
});
