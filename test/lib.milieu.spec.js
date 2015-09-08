
var fs       = require('fs');
var path     = require('path');
var assert   = require('assert');
var sinon    = require('sinon');
var cliTable = require('cli-table2');
var Milieu   = require('../lib/milieu');

var explainTable = require('./fixture/explain-table');

global.__testYaml__ = require('js-yaml');
global.__testIni__  = require('ini');


describe('Milieu', function() {

  beforeEach(function() {
    process.env = {
      APPLICATION__E0: 'e0',
      HOME           : 'HOME'
    };
    process.argv = [
      'node',
      '/path/to/script',
      '--a0=a0'
    ];
    process.platform = 'darwin';

    sinon.stub(fs, 'existsSync')

      .withArgs('HOME/.applicationrc')
        .returns(true)

      .withArgs('HOME/.application/config')
        .returns(true)

      .withArgs('HOME/.config/application')
        .returns(true)

      .withArgs('HOME/.config/application/config.json')
        .returns(true)

      .withArgs('/etc/applicationrc.yaml')
        .returns(true)

      .withArgs('/etc/application/config.ini')
        .returns(true)

      .withArgs(path.join(process.cwd(), '..', '.applicationrc'))
        .returns(true)

      .withArgs(path.join(process.cwd(), '..', '..', '.applicationrc'))
        .returns(true)

      .withArgs(path.join(process.cwd(), '..', '..', '..', '.applicationrc'))
        .returns(true);

    sinon.stub(fs, 'statSync')
      .returns({ isFile: function() { return true; } });

    sinon.stub(fs, 'readFileSync')

      .withArgs('HOME/.applicationrc')
        .returns('{ "c1": "c1" }')

      .withArgs('HOME/.application/config')
        .returns('c2: c2')

      .withArgs('HOME/.config/application')
        .returns('c3 = c3')

      .withArgs('HOME/.config/application/config.json')
        .returns('{ "c4": "c4" }')

      .withArgs('/etc/applicationrc.yaml')
        .returns('c5: c5')

      .withArgs('/etc/application/config.ini')
        .returns('c6 = c6')

      .withArgs(path.join(process.cwd(), '..', '.applicationrc'))
        .returns('{ "c7": "c7" }')

      .withArgs(path.join(process.cwd(), '..', '..', '.applicationrc'))
        .returns('{ "c8": "c8" }')

      .withArgs(path.join(process.cwd(), '..', '..', '..', '.applicationrc'))
        .returns('{ "c9": "c9" }');
  });

  afterEach(function() {
    fs.existsSync.restore();
    fs.statSync.restore();
    fs.readFileSync.restore();
  });

  it('throws if you don\'t provide an application name', function() {
    assert.throws(function() {
      new Milieu();
    });
  });

  it('throws if you don\'t provide a default config object', function() {
    assert.throws(function() {
      new Milieu('testapp');
    });
  });

  it('does not throw if you omit the opts object', function() {
    new Milieu('testApp', {});
  });


  describe('#explain', function() {

    it('correctly compiles the explanation and returns it', function() {
      var explanation = (new Milieu('application', {
        c0: 'c0'
      })).explain();

      assert.deepEqual(explanation, {
        e0: { val: 'e0', src: 'environment' },
        a0: { val: 'a0', src: 'flag' },
        c0: { val: 'c0', src: 'defaults' },
        c1: { val: 'c1', src: 'HOME/.applicationrc' },
        c2: { val: 'c2', src: 'HOME/.application/config' },
        c3: { val: 'c3', src: 'HOME/.config/application' },
        c4: { val: 'c4', src: 'HOME/.config/application/config.json' },
        c5: { val: 'c5', src: '/etc/applicationrc.yaml' },
        c6: { val: 'c6', src: '/etc/application/config.ini' },
        c7: { val: 'c7', src: path.join(process.cwd(), '..', '.applicationrc') },
        c8: { val: 'c8', src: path.join(process.cwd(), '..', '..', '.applicationrc') },
        c9: { val: 'c9', src: path.join(process.cwd(), '..', '..', '..', '.applicationrc') }
      });
    });
  });


  describe('#printExplainTable', function() {

    it('correctly compiles the and prints the explanation table to stdout (via console)', function() {
      sinon.spy(console, 'log');

      (new Milieu('application', {
        c0: 'c0'
      })).printExplainTable();

      var explainTableSrc = console.log.getCalls().map(function(call) {
        return call.args[0]
      }).join('\n');
      console.log.restore();

      assert.equal(explainTableSrc, explainTable());
    });
  });


  describe('#toObject', function() {

    it('correctly compiles the config and returns it', function() {
      var config = (new Milieu('application', {
        c0: 'c0'
      })).toObject();

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
        c9: 'c9'
      });
    });
  });
});
