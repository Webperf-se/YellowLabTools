var chai                = require('chai');
var sinon               = require('sinon');
var sinonChai           = require('sinon-chai');
var should              = chai.should();
var YellowLabTools      = require('../../lib/yellowlabtools.js');

chai.use(sinonChai);


describe('yellowlabtools', function() {

    it('should return a promise', function() {
        var ylt = new YellowLabTools();

        ylt.should.have.property('then').that.is.a('function');
        ylt.should.have.property('fail').that.is.a('function');
    });

    it('should fail an undefined url', function(done) {
        var ylt = new YellowLabTools().fail(function(err) {
            err.should.be.a('string').that.equals('URL missing');
            done();
        });
    });

    it('should fail with an empty url string', function(done) {
        var ylt = new YellowLabTools('').fail(function(err) {
            err.should.be.a('string').that.equals('URL missing');
            done();
        });
    });

    it('should succeeds on simple-page.html', function(done) {
        this.timeout(15000);

        // Check if console.log is called
        sinon.spy(console, 'log');

        var url = 'http://localhost:8388/simple-page.html';

        var ylt = new YellowLabTools(url)
            .then(function(data) {

                data.should.be.an('object');
                data.toolsResults.should.be.an('object');
                
                // Test Phantomas
                data.toolsResults.phantomas.should.be.an('object');
                data.toolsResults.phantomas.should.have.a.property('url').that.equals(url);
                data.toolsResults.phantomas.should.have.a.property('metrics').that.is.an('object');
                data.toolsResults.phantomas.metrics.should.have.a.property('requests').that.equals(1);
                data.toolsResults.phantomas.should.have.a.property('offenders').that.is.an('object');
                data.toolsResults.phantomas.offenders.should.have.a.property('DOMelementMaxDepth');
                data.toolsResults.phantomas.offenders.DOMelementMaxDepth.should.have.length(1);
                data.toolsResults.phantomas.offenders.DOMelementMaxDepth[0].should.equal('body > h1[1]');

                // Test rules
                data.should.have.a.property('rules').that.is.an('object');

                data.rules.should.have.a.property('DOMelementMaxDepth').that.is.an('object');
                data.rules.DOMelementMaxDepth.should.deep.equal({
                    policy: {
                        "tool": "phantomas",
                        "label": "DOM max depth",
                        "message": "<p>A deep DOM makes the CSS matching with DOM elements difficult.</p><p>It also slows down Javascript modifications to the DOM because changing the dimensions of an element makes the browser re-calculate the dimensions of it's parents. Same thing for Javascript events, that bubble up to the document root.</p>",
                        "isOkThreshold": 10,
                        "isBadThreshold": 20,
                        "isAbnormalThreshold": 30
                    },
                    "value": 1,
                    "bad": false,
                    "abnormal": false,
                    "score": 100,
                    "abnormalityScore": 0,
                    "offenders": ["body > h1[1]"]
                });

                // Test javascriptExecutionTree
                data.toolsResults.phantomas.metrics.should.not.have.a.property('javascriptExecutionTree');
                data.toolsResults.phantomas.offenders.should.not.have.a.property('javascriptExecutionTree');
                data.should.have.a.property('javascriptExecutionTree').that.is.an('object');
                data.javascriptExecutionTree.should.have.a.property('data');
                data.javascriptExecutionTree.data.should.have.a.property('type').that.equals('main');

                /*jshint expr: true*/
                console.log.should.not.have.been.called;

                done();
            }).fail(function(err) {
                done(err);
            });
    });

});