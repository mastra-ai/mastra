'use strict';

const expect = require('chai').expect

const Spinnies = require('..');
const { expectToBehaveLikeAnUpdate } = require('./behaviours.test');

setInterval = (fn) => fn();
setTimeout = (fn) => fn();
process.stderr.write = () => {};

describe('Spinnies', () => {
  beforeEach('constructor', () => {
    this.spinnies = new Spinnies();
    this.spinnersOptions = {
      succeedColor: 'green',
      failColor: 'red',
      spinnerColor: 'greenBright',
      status: 'spinning',
    };
  });

  describe('methods', () => {
    describe('#add', () => {
      describe('validations', () => {
        context('when no spinner name specified', () => {
          it('throws an error', () => {
            expect(() => this.spinnies.add()).to.throw('A spinner reference name must be specified');
          });
        });
      });

      describe('adding new spinners', () => {
        it('has initial variables defined', () => {
          const spinner = this.spinnies.add('spinner');
          expect(spinner).to.include(this.spinnersOptions);
        });

        context('when no initial text is specified', () => {
          it('takes the spinner name as text', () => {
            const spinner = this.spinnies.add('spinner-name');
            expect(spinner.text).to.eq('spinner-name');
          });
        });

        context('when initial text is specified', () => {
          it('uses the specified spinner text', () => {
            const spinner = this.spinnies.add('spinner-name', { text: 'Hello spinner-name' });
            expect(spinner.text).to.eq('Hello spinner-name');
          });
        });

        context('when specifying options', () => {
          context('when options are correct', () => {
            it('overrides the default options', () => {
              const options = { color: 'black', spinnerColor: 'black', succeedColor: 'black', failColor: 'black', status: 'non-spinnable', indent: 2 };
              const spinner = this.spinnies.add('spinner-name', options);
              expect(spinner).to.include({ ...this.spinnersOptions, ...options });
            });
          });

          context('when options are not valid', () => {
            it('mantains the default options', () => {
              const options = { color: 'foo', spinnerColor: 'bar', status: 'buz', indent: 'baz' };
              const spinner = this.spinnies.add('spinner-name', options);
              expect(spinner).to.include(this.spinnersOptions);
            });
          });
        });
      });
    });

    describe('#remove', () => {
      describe('validations', () => {
        context('when no spinner name specified', () => {
          it('throws an error', () => {
            expect(() => this.spinnies.remove()).to.throw('A spinner reference name must be specified');
          });
        });
      });

      it('removes the spinner from the spinners object', () => {
        this.spinnies.add('spinner-name', this.spinnerOptions);
        expect(this.spinnies.spinners).to.have.keys('spinner-name');

        const spinner = this.spinnies.remove('spinner-name');
        expect(spinner).to.include(this.spinnersOptions);
        expect(this.spinnies.spinners).to.not.have.keys('spinner-name');
      });
    });

    describe('methods that modify the status of a spinner', () => {
      beforeEach('initialize some spinners', () => {
        this.spinnies.add('spinner');
        this.spinnies.add('another-spinner');
        this.spinnies.add('third-spinner');
        this.spinnies.add('non-spinnable', { status: 'non-spinnable' });
      });

      expectToBehaveLikeAnUpdate(this, 'succeed');
      expectToBehaveLikeAnUpdate(this, 'fail');
      expectToBehaveLikeAnUpdate(this, 'update');

      describe('#stopAll', () => {
        beforeEach(() => {
          this.spinner = this.spinnies.succeed('spinner');
          this.anotherSpinner = this.spinnies.fail('another-spinner');
          this.nonSpinnable = this.spinnies.pick('non-spinnable');
          this.thirdSpinner = this.spinnies.pick('third-spinner');
        });

        const expectToKeepFinishedSpinners = () => {
          expect(this.spinner.status).to.eq('succeed');
          expect(this.anotherSpinner.status).to.eq('fail');
          expect(this.nonSpinnable.status).to.eq('non-spinnable');
        };

        context('when providing a new status', () => {
          it('sets non-finished spinners as succeed', () => {
            this.spinnies.stopAll('succeed');

            expectToKeepFinishedSpinners();
            expect(this.thirdSpinner.status).to.eq('succeed');
            expect(this.thirdSpinner.color).to.eq('green');
          });

          it('sets non-finished spinners as fail', () => {
            this.spinnies.stopAll('fail');

            expectToKeepFinishedSpinners();
            expect(this.thirdSpinner.status).to.eq('fail');
            expect(this.thirdSpinner.color).to.eq('red');
          });

          it('sets non-finished spinners as stopped', () => {
            this.spinnies.stopAll('foobar');

            expectToKeepFinishedSpinners();
            expect(this.thirdSpinner.status).to.eq('stopped');
            expect(this.thirdSpinner.color).to.eq('grey');
          });
        });

        context('when not providing a new status', () => {
          it('sets non-finished spinners as stopped', () => {
            this.spinnies.stopAll();

            expectToKeepFinishedSpinners();
            expect(this.thirdSpinner.status).to.eq('stopped');
            expect(this.thirdSpinner.color).to.eq('grey');
          });
        });
      });
    });
  });
});
