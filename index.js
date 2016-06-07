
const Milieu = require('./lib/milieu');


exports = module.exports = function(applicationName, defaults, opts) {
  return new Milieu(applicationName, defaults, opts);
};

exports.Milieu = Milieu;
