exports.config = {
  framework: 'mocha',
  seleniumAddress: 'http://localhost:4444/wd/hub',
  suites: {
    one: 'spec.js' // all tests in single file
  },
  suite: 'one', // default suite to run
  mochaOpts: {
    ui: 'bdd',
    reporter: 'spec',
    slow: 5000
  },
  capabilities: {
    browserName: 'firefox', // chrome
    shardTestFiles: true,
    maxInstances: 2
  }
}
