var debug                   = require('debug')('ylt:runner');
var phantomasWrapper        = require('./tools/phantomas/phantomasWrapper');
var colorDiff               = require('./tools/colorDiff');
var domAccessAgregator      = require('./tools/domAccessAgregator');
var mediaQueriesChecker     = require('./tools/mediaQueriesChecker');
var redownload              = require('./tools/redownload/redownload');
var rulesChecker            = require('./rulesChecker');
var scoreCalculator         = require('./scoreCalculator');

var Runner = function(params) {
    'use strict';

    return new Promise((resolve, reject) => {
        // The pivot format
        var data = {
            params: params,
            toolsResults: {}
        };

        // Execute Phantomas first
        phantomasWrapper.execute(data)

        // For the progress bar
        .progress(function(event) {
            if (event === 'domReady') {
                // Handle progress if needed
            }
            if (event === 'domComplete') {
                // Handle progress if needed
            }
        })

        .then(function(phantomasResults) {
            // For the progress bar
            // Handle progress if needed

            data.toolsResults.phantomas = phantomasResults;

            // Mix all DOM Access metrics together
            data = domAccessAgregator.agregate(data);

            // Compare colors
            data = colorDiff.compareAllColors(data);

            // Check media queries
            data = mediaQueriesChecker.analyzeMediaQueries(data);

            // Redownload every file
            return redownload.recheckAllFiles(data)

            .progress(function(redownloadedProgress) {
                // Handle progress if needed
            });

        })

        .then(function(data) {

            // For the progress bar
            // Handle progress if needed

            // Fix: don't display Unicode ranges if the module is not present in Phantomas
            if (!data.toolsResults.phantomas.metrics.differentCharacters) {
                delete data.toolsResults.redownload.metrics.unusedUnicodeRanges;
                delete data.toolsResults.redownload.offenders.unusedUnicodeRanges;
            }

            // Rules checker
            var policies = require('./metadata/policies');
            data.rules = rulesChecker.check(data, policies);

            // Scores calculator
            var scoreProfileGeneric = require('./metadata/scoreProfileGeneric.json');
            data.scoreProfiles = {
                generic : scoreCalculator.calculate(data, scoreProfileGeneric, true)
            };

            // Calculate "If you fix this issue, your new score is..." on each rule
            debug('Calculate "If you fix this issue..." scores');
            Object.keys(data.rules).forEach(function(ruleName) {
                // Save current values
                var oldScore = data.rules[ruleName].score;
                var oldAbnormalityScore = data.rules[ruleName].abnormalityScore;
                // Simulate a 100/100 score on a specific rule
                data.rules[ruleName].score = 100;
                data.rules[ruleName].abnormalityScore = 0;
                // Calculate new score
                data.rules[ruleName].globalScoreIfFixed = scoreCalculator.calculate(data, scoreProfileGeneric, false).globalScore;
                // Revert values
                data.rules[ruleName].score = oldScore;
                data.rules[ruleName].abnormalityScore = oldAbnormalityScore;
            });
            debug('Calculating is finished');

            if (data.toolsResults.phantomas.offenders.blockedRequests) {
                data.blockedRequests = data.toolsResults.phantomas.offenders.blockedRequests;
            }

            // Report WordPress detection
            if (data.toolsResults.redownload.metrics.isWordPress === true) {
                data.frameworks = {isWordPress: true};
            }

            // Finished!
            resolve(data);
        })

        .catch(function(err) {
            debug('Run failed');
            debug(err);

            reject(err);
        });
    });
};

module.exports = Runner;
