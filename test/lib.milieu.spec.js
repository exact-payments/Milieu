/* globals describe it beforeEach afterEach */
/* eslint-disable no-new */

const fs       = require('fs');
const assert   = require('assert');
const sinon    = require('sinon');
const Milieu   = require('../lib/milieu');

const explainTable = require('./fixture/explain-table');

/* eslint-disable node/no-unpublished-require */
global.__testYaml__ = require('js-yaml');
global.__testIni__  = require('ini');
/* eslint-enable node/no-unpublished-require */


describe('Milieu', () => {

  beforeEach(() => {
    process.env = {
      APPLICATION__E0: 'e0',
      HOME           : '/home/user',
    };
    process.argv = [
      'node',
      '/path/to/script',
      '--a0',
      'a0',
    ];
    process.platform = 'darwin';

    sinon.stub(fs, 'existsSync')

      .withArgs('/home/user/.applicationrc')
      .returns(true)

      .withArgs('/home/user/.application/config')
      .returns(true)

      .withArgs('/home/user/.config/application')
      .returns(true)

      .withArgs('/home/user/.config/application/config.json')
      .returns(true)

      .withArgs('/etc/applicationrc.yaml')
      .returns(true)

      .withArgs('/etc/application/config.ini')
      .returns(true)

      .withArgs('/home/user/developer/project/dist/.applicationrc')
      .returns(true)

      .withArgs('/home/user/developer/project/.applicationrc')
      .returns(true)

      .withArgs('/home/user/developer/.applicationrc')
      .returns(true);

    sinon.stub(fs, 'statSync')
      .returns({ isFile() { return true; } });

    sinon.stub(fs, 'readFileSync')

      .withArgs('/home/user/.applicationrc')
      .returns('{ "c1": "c1" }')

      .withArgs('/home/user/.application/config')
      .returns('c2: c2')

      .withArgs('/home/user/.config/application')
      .returns('c3 = c3')

      .withArgs('/home/user/.config/application/config.json')
      .returns('{ "c4": "c4" }')

      .withArgs('/etc/applicationrc.yaml')
      .returns('c5: c5')

      .withArgs('/etc/application/config.ini')
      .returns('c6 = c6')

      .withArgs('/home/user/developer/project/dist/.applicationrc')
      .returns('{ "c7": "c7" }')

      .withArgs('/home/user/developer/project/.applicationrc')
      .returns('{ "c8": "c8" }')

      .withArgs('/home/user/developer/.applicationrc')
      .returns('{ "c9": "c9" }');
  });

  afterEach(() => {
    fs.existsSync.restore();
    fs.statSync.restore();
    fs.readFileSync.restore();
  });

  it('throws if you don\'t provide an application name', () => {
    assert.throws(() => {
      new Milieu();
    });
  });

  it('throws if you don\'t provide a default config object', () => {
    assert.throws(() => {
      new Milieu('testapp');
    });
  });

  it('does not throw if you omit the opts object', () => {
    new Milieu('testApp', {});
  });


  describe('#explain', () => {

    it('correctly compiles the explanation and returns it', () => {
      const explanation = (new Milieu('application', {
        c0: 'c0',
      }, {
        cwd: '/home/user/developer/project/dist',
      })).explain();

      assert.deepEqual(explanation, {
        e0: { val: 'e0', src: 'environment' },
        a0: { val: 'a0', src: 'flag' },
        c0: { val: 'c0', src: 'defaults' },
        c1: { val: 'c1', src: '../../../.applicationrc' },
        c2: { val: 'c2', src: '../../../.application/config' },
        c3: { val: 'c3', src: '../../../.config/application' },
        c4: { val: 'c4', src: '../../../.config/application/config.json' },
        c5: { val: 'c5', src: '/etc/applicationrc.yaml' },
        c6: { val: 'c6', src: '/etc/application/config.ini' },
        c7: { val: 'c7', src: '.applicationrc' },
        c8: { val: 'c8', src: '../.applicationrc' },
        c9: { val: 'c9', src: '../../.applicationrc' },
      });
    });
  });


  describe('#printExplainTable', () => {

    it('correctly compiles the and prints the explanation table to stdout (via console)', () => {
      sinon.spy(console, 'log');

      (new Milieu('application', {
        c0: 'c0',
      }, {
        cwd: '/home/user/developer/project/dist',
      })).printExplainTable();

      /* eslint-disable no-console */
      const explainTableSrc = console.log.getCalls().map(call => call.args[0]).join('\n');
      console.log.restore();
      /* eslint-enable no-console */

      assert.equal(explainTableSrc, explainTable());
    });
  });


  describe('#toObject', () => {

    it('correctly compiles the config and returns it', () => {
      const config = (new Milieu(
        'application',
        { c0: 'c0' },
        { cwd: '/home/user/developer/project/dist' }
      )).toObject();

      assert.deepEqual(config, {
        e0: 'e0',
        a0: 'a0',
        c0: 'c0',
        c1: 'c1',
        c2: 'c2',
        c3: 'c3',
        c4: 'c4',
        c5: 'c5',
        c6: 'c6',
        c7: 'c7',
        c8: 'c8',
        c9: 'c9',
      });
    });
  });
});
