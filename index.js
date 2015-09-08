
var Milieu = require('./lib/milieu');


exports = module.exports = function(applicationName, defaults, opts) {
  return (new Milieu(applicationName, defaults, opts)).toObject();
};

exports.explain = function(applicationName, defaults, opts) {
  return (new Milieu(applicationName, defaults, opts)).explain();
};

exports.printExplainTable = function(applicationName, defaults, opts) {
  (new Milieu(applicationName, defaults, opts)).printExplainTable();
};

exports.Milieu = Milieu;
