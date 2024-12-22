var debug       = require('debug')('ylt:fileMinifier');
var UglifyJS        = require('uglify-js');
var CleanCSS        = require('clean-css');
var htmlMinifier    = require('html-minifier');

var FileMinifier = function() {

    function minifyFile(entry) {
        return new Promise((resolve, reject) => {
            if (!entry.weightCheck || !entry.weightCheck.bodyBuffer) {
                // No valid file available
                resolve(entry);
                return;
            }

            var fileSize = entry.weightCheck.uncompressedSize;
            var bodyString = entry.weightCheck.bodyBuffer.toString();

            debug('Let\'s try to optimize %s', entry.url);
            debug('Current file size is %d', fileSize);
            var startTime = Date.now();

            if (entry.isJS && !isKnownAsMinified(entry.url) && !looksAlreadyMinified(bodyString)) {

                debug('File is a JS');

                minifyJs(bodyString)
                    .then(newFile => {
                        if (!newFile) {
                            debug('Optimization didn\'t work');
                            resolve(entry);
                            return;
                        }

                        var endTime = Date.now();
                        var newFileSize = newFile.length;

                        debug('JS minification complete for %s', entry.url);
                        
                        if (gainIsEnough(fileSize, newFileSize)) {
                            entry.weightCheck.bodyAfterOptimization = newFile;
                            entry.weightCheck.optimized = newFileSize;
                            entry.weightCheck.isOptimized = false;
                            debug('Filesize is %d bytes smaller (-%d%)', fileSize - newFileSize, Math.round((fileSize - newFileSize) * 100 / fileSize));
                        }

                        resolve(entry);
                    })
                    .catch(err => {
                        resolve(entry);
                    });

            } else if (entry.isCSS) {

                debug('File is a CSS');

                minifyCss(entry.weightCheck.bodyBuffer.toString())
                    .then(newFile => {
                        if (!newFile) {
                            debug('Optimization didn\'t work');
                            resolve(entry);
                            return;
                        }

                        var endTime = Date.now();
                        debug('CSS minification took %dms', endTime - startTime);

                        var newFileSize = newFile.length;

                        debug('CSS minification complete for %s', entry.url);
                        
                        if (gainIsEnough(fileSize, newFileSize)) {
                            entry.weightCheck.bodyAfterOptimization = newFile;
                            entry.weightCheck.optimized = newFileSize;
                            entry.weightCheck.isOptimized = false;
                            debug('Filesize is %d bytes smaller (-%d%)', fileSize - newFileSize, Math.round((fileSize - newFileSize) * 100 / fileSize));
                        }

                        resolve(entry);
                    })
                    .catch(err => {
                        resolve(entry);
                    });

            } else if (entry.isHTML) {

                debug('File is an HTML');

                minifyHtml(entry.weightCheck.bodyBuffer.toString())
                    .then(newFile => {
                        if (!newFile) {
                            debug('Optimization didn\'t work');
                            resolve(entry);
                            return;
                        }

                        var endTime = Date.now();
                        debug('HTML minification took %dms', endTime - startTime);

                        var newFileSize = newFile.length;

                        debug('HTML minification complete for %s', entry.url);
                        
                        if (gainIsEnough(fileSize, newFileSize)) {
                            entry.weightCheck.bodyAfterOptimization = newFile;
                            entry.weightCheck.optimized = newFileSize;
                            entry.weightCheck.isOptimized = false;
                            debug('Filesize is %d bytes smaller (-%d%)', fileSize - newFileSize, Math.round((fileSize - newFileSize) * 100 / fileSize));
                        }

                        resolve(entry);
                    })
                    .catch(err => {
                        resolve(entry);
                    });

            } else {
                debug('Not minifiable type or already minified');
                resolve(entry);
            }
        });
    }

    // The gain is estimated of enough value if it's over 2KB or over 20%,
    // but it's ignored if is below 400 bytes
    function gainIsEnough(oldWeight, newWeight) {
        var gain = oldWeight - newWeight;
        var ratio = gain / oldWeight;
        return (gain > 2096 || (ratio > 0.2 && gain > 400));
    }

    // Uglify
    function minifyJs(body) {
        return new Promise((resolve, reject) => {
            var startTime = Date.now();

            var result = UglifyJS.minify(body, {
                // Only do the compression step for smaller files
                // otherwise it can take a very long time compared to the gain
                compress: (body.length < 200*1024)
            });

            var endTime = Date.now();
            debug('Uglify took %dms', endTime - startTime);
            resolve(result.code);
        });
    }

    // Clear-css
    function minifyCss(body) {
        return new Promise((resolve, reject) => {
            try {
                var result = new CleanCSS().minify(body);
                resolve(result.styles);
            } catch(err) {
                reject(err);
            }
        });
    }

    // HTMLMinifier
    function minifyHtml(body) {
        return new Promise((resolve, reject) => {
            try {
                var result = htmlMinifier.minify(body, {
                    collapseWhitespace: true,
                    conservativeCollapse: true,
                    continueOnParseError: true,
                    decodeEntities: true,
                    minifyCSS: true,
                    minifyJS: true,
                    preserveLineBreaks: true,
                    removeAttributeQuotes: true,
                    removeComments: true,
                    removeScriptTypeAttributes: true,
                    removeStyleLinkTypeAttributes: true
                });
                resolve(result);
            } catch(err) {
                reject(err);
            }
        });
    }

    // Avoid losing time trying to compress some JS libraries known as already compressed
    function isKnownAsMinified(url) {
        var result = false;

        // Twitter
        result = result || /^https?:\/\/platform\.twitter\.com\/widgets\.js/.test(url);

        // Facebook
        result = result || /^https:\/\/connect\.facebook\.net\/[^\/]*\/(sdk|all)\.js/.test(url);

        // Google +1
        result = result || /^https:\/\/apis\.google\.com\/js\/plusone\.js/.test(url);

        // jQuery CDN
        result = result || /^https?:\/\/code\.jquery\.com\/.*\.min.js/.test(url);

        // Google Analytics
        result = result || /^https?:\/\/(www|ssl)\.google-analytics\.com\/(.*)\.js/.test(url);

        if (result === true) {
            debug('This file is known as already minified. Skipping minification: %s', url);
        }

        return result;
    }

    // Avoid losing time trying to compress JS files if they already look minified
    // by counting the number of lines compared to the total size.
    // Less than 2KB per line is suspicious
    function looksAlreadyMinified(code) {
        var linesCount = code.split(/\r\n|\r|\n/).length;
        var linesRatio = code.length / linesCount;
        var looksMinified = linesRatio > 2 * 1024;
        
        debug('Lines ratio is %d bytes per line', Math.round(linesRatio));
        debug(looksMinified ? 'It looks already minified' : 'It doesn\'t look minified');

        return looksMinified;
    }

    function entryTypeCanBeMinified(entry) {
        return entry.isJS || entry.isCSS || entry.isHTML;
    }

    return {
        minifyFile: minifyFile,
        minifyJs: minifyJs,
        minifyCss: minifyCss,
        minifyHtml: minifyHtml,
        gainIsEnough: gainIsEnough,
        entryTypeCanBeMinified: entryTypeCanBeMinified,
        isKnownAsMinified: isKnownAsMinified
    };
};

module.exports = new FileMinifier();
