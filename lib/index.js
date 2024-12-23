var debug               = require('debug')('ylt:index');
var Runner              = require('./runner');
var ScreenshotHandler   = require('./screenshotHandler');

var packageJson = require('../package.json');

var yellowLabTools = function(url, options) {
    return new Promise((resolve, reject) => {
        if (!url) {
            reject('URL missing');
        } else {
            if (url.toLowerCase().indexOf('http://') !== 0 && url.toLowerCase().indexOf('https://') !== 0) {
                url = 'http://' + url;
            }

            var params = {
                url: url,
                options: options || {}
            };

            var runner = new Runner(params)
            
            // .progress((progress) => {
            //     // Handle progress if needed
            // })

            .then(function(data) {
                // If a screenshot saveFunction was provided in the options
                if (options && typeof options.saveScreenshotFn === 'function') {
                    const screenshotTmpPath = data.params.options.screenshot;
                    debug('Now optimizing screenshot...');

                    // TODO: temporarily set all screenshot sizes to 600px, until we find a solution
                    ScreenshotHandler.findAndOptimizeScreenshot(screenshotTmpPath, 600)

                    .then(function(screenshotBuffer) {
                        debug('Screenshot optimized, now saving...');
                        
                        return options.saveScreenshotFn('screenshot.jpg', screenshotBuffer);
                    })

                    .then(function(response) {
                        debug('Screenshot saved');
                        debug(response);

                        // Remove uneeded temp screenshot path
                        delete data.params.options.screenshot;
                    })

                    .catch(function(err) {
                        // It's ok if we can't save the screenshot
                        debug('Screenshot could not be saved');
                        debug(err);
                    })

                    .finally(function() {
                        resolve(data);
                    });

                } else {
                    resolve(data);
                }
            })

            .catch(function(err) {
                reject(err);
            });
        }
    });
};

module.exports = yellowLabTools;
module.exports.version = packageJson.version;
