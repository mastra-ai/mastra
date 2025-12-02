'use strict';

const expect = require('chai').expect

function expectToBehaveLikeAnUpdate(self, status) {
  const currentStatus = status === 'update' ? 'succeed' : status;

  describe(`#${status}`, () => {
    it(`changes the status to ${currentStatus}`, () => {
      const spinner = self.spinnies[currentStatus]('spinner');
      const anotherSpinner = self.spinnies.pick('another-spinner');
      expect(spinner.status).to.eq(currentStatus);
      expect(anotherSpinner.status).to.eq('spinning');
    });

    context('when not specifying a spinner name', () => {
      it('throws an error', () => {
          expect(() => self.spinnies[status]({})).to.throw('A spinner reference name must be specified');
      });
    });

    context('when specifying a non-existent spinner name', () => {
      it('throws an error', () => {
        expect(() => self.spinnies[status]('i-dont-exist')).to.throw('No spinner initialized with name i-dont-exist')
      });
    });

    context('when specifying options', () => {
      context('when options are correct', () => {
        it('overrides the default options', () => {
          const options = { text: 'updated text', color: 'black', spinnerColor: 'black' };
          const spinner = self.spinnies[status]('spinner', options);
          expect(spinner).to.include(options);
        });
      });

      context('when options have no valid values', () => {
        it('mantains the previous options', () => {
          const options = { text: 42, color: 'foo', spinnerColor: 'bar' };
          const spinner = self.spinnies[currentStatus]('spinner', options);
          expect(spinner).to.include({ text: 'spinner', spinnerColor: 'greenBright' });
        });
      });

      context('when specifying invalid attributes', () => {
        it('ignores those attributes', () => {
          const options = { text: 'updated text', color: 'black', spinnerColor: 'black' };
          const invalidOptions = { foo: 42, bar: 'bar'}
          const spinner = self.spinnies[status]('spinner', options);
          expect(spinner).to.include(options);
          expect(spinner).to.not.have.any.keys('foo', 'bar');
        });
      });
    });
  });
}

module.exports = {
  expectToBehaveLikeAnUpdate,
}

