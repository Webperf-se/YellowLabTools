var debug               = require('debug')('ylt:imageOptimizer');
var imagemin            = require('imagemin');
var imageminJpegtran    = require('imagemin-jpegtran');
var imageminJpegoptim   = require('imagemin-jpegoptim');
var imageminOptipng     = require('imagemin-optipng');
var imageminSvgo        = require('imagemin-svgo');

var ImageOptimizer = function() {

    var MAX_JPEG_QUALITY = 85;
    var OPTIPNG_COMPRESSION_LEVEL = 1;

    function optimizeImage(entry) {
        return new Promise((resolve, reject) => {
            if (!entry.weightCheck || !entry.weightCheck.bodyBuffer) {
                // No valid file available
                resolve(entry);
                return;
            }

            var fileSize = entry.weightCheck.uncompressedSize;
            debug('Let\'s try to optimize %s', entry.url);
            debug('Current file size is %d', fileSize);

            if (isJPEG(entry)) {
                debug('File is a JPEG');

                // Starting softly with a lossless compression
                compressJpegLosslessly(entry.weightCheck.bodyBuffer)
                    .then(newFile => {
                        if (!newFile) {
                            debug('Optimization didn\'t work');
                            resolve(entry);
                            return;
                        }

                        var newFileSize = newFile.length;

                        debug('JPEG lossless compression complete for %s', entry.url);
                        
                        if (gainIsEnough(fileSize, newFileSize)) {
                            entry.weightCheck.lossless = entry.weightCheck.optimized = newFileSize;
                            entry.weightCheck.isOptimized = false;
                            debug('Filesize is %d bytes smaller (-%d%)', fileSize - newFileSize, Math.round((fileSize - newFileSize) * 100 / fileSize));
                        }

                        // Now let's compress lossy to MAX_JPEG_QUALITY
                        return compressJpegLossly(entry.weightCheck.bodyBuffer);
                    })
                    .then(newFile => {
                        if (!newFile) {
                            debug('Optimization didn\'t work');
                            resolve(entry);
                            return;
                        }

                        var newFileSize = newFile.length;

                        debug('JPEG lossy compression complete for %s', entry.url);

                        if (entry.weightCheck.lossless && entry.weightCheck.lossless < newFileSize) {
                            debug('Lossy compression is not as good as lossless compression. Skipping the lossy.');
                        } else if (gainIsEnough(fileSize, newFileSize)) {
                            if (entry.weightCheck.isOptimized !== false || newFileSize < entry.weightCheck.lossless) {
                                entry.weightCheck.optimized = newFileSize;
                            }

                            entry.weightCheck.lossy = newFileSize;
                            entry.weightCheck.isOptimized = false;
                            debug('Filesize is %d bytes smaller (-%d%)', fileSize - newFileSize, Math.round((fileSize - newFileSize) * 100 / fileSize));
                        }

                        resolve(entry);
                    })
                    .catch(() => {
                        resolve(entry);
                    });

            } else if (isPNG(entry)) {
                debug('File is a PNG');

                // Starting softly with a lossless compression
                compressPngLosslessly(entry.weightCheck.bodyBuffer)
                    .then(newFile => {
                        if (!newFile) {
                            debug('Optimization didn\'t work');
                            resolve(entry);
                            return;
                        }
                        
                        var newFileSize = newFile.length;

                        debug('PNG lossless compression complete for %s', entry.url);
                        
                        debug('Old file size: %d', fileSize);
                        debug('New file size: %d', newFileSize);
                        debug('newgainIsEnough: %s', gainIsEnough(fileSize, newFileSize) ? 'true':'false');

                        if (gainIsEnough(fileSize, newFileSize)) {
                            entry.weightCheck.lossless = entry.weightCheck.optimized = newFileSize;
                            entry.weightCheck.isOptimized = false;
                            debug('Filesize is %d bytes smaller (-%d%)', fileSize - newFileSize, Math.round((fileSize - newFileSize) * 100 / fileSize));
                        }

                        resolve(entry);
                    })
                    .catch(() => {
                        resolve(entry);
                    });

            } else if (isSVG(entry)) {
                debug('File is an SVG');

                // Starting softly with a lossless compression
                compressSvgLosslessly(entry.weightCheck.bodyBuffer)
                    .then(newFile => {
                        if (!newFile) {
                            debug('Optimization didn\'t work');
                            resolve(entry);
                            return;
                        }

                        var newFileSize = newFile.length;

                        debug('SVG lossless compression complete for %s', entry.url);
                        
                        if (gainIsEnough(fileSize, newFileSize)) {
                            entry.weightCheck.bodyAfterOptimization = newFile.toString();
                            entry.weightCheck.lossless = entry.weightCheck.optimized = newFileSize;
                            entry.weightCheck.isOptimized = false;
                            debug('Filesize is %d bytes smaller (-%d%)', fileSize - newFileSize, Math.round((fileSize - newFileSize) * 100 / fileSize));
                        }

                        resolve(entry);
                    })
                    .catch(() => {
                        resolve(entry);
                    });

            } else {
                debug('File type %s is not an optimizable image', entry.contentType);
                resolve(entry);
            }
        });
    }

    // The gain is estimated of enough value if it's over 2KB or over 20%,
    // but it's ignored if is below 100 bytes
    function gainIsEnough(oldWeight, newWeight) {
        var gain = oldWeight - newWeight;
        var ratio = gain / oldWeight;
        return (gain > 2048 || (ratio > 0.2 && gain > 100));
    }

    function isJPEG(entry) {
        return entry.isImage && entry.contentType === 'image/jpeg';
    }

    function isPNG(entry) {
        return entry.isImage && entry.contentType === 'image/png';
    }

    function isSVG(entry) {
        return entry.isImage && entry.isSVG;
    }

    function compressJpegLosslessly(imageBody) {
        return imageminLauncher(imageBody, 'jpeg', false);
    }

    function compressJpegLossly(imageBody) {
        return imageminLauncher(imageBody, 'jpeg', true);
    }

    function compressPngLosslessly(imageBody) {
        return imageminLauncher(imageBody, 'png', false);
    }

    function compressSvgLosslessly(imageBody) {
        return imageminLauncher(imageBody, 'svg', false);
    }

    function imageminLauncher(imageBody, type, lossy) {
        return new Promise((resolve, reject) => {
            var startTime = Date.now();

            debug('Starting %s %s optimization', type, lossy ? 'lossy' : 'lossless');

            var engine;
            if (type === 'jpeg' && !lossy) {
                engine = imageminJpegtran({progressive: true});
            } else if (type === 'jpeg' && lossy) {
                engine = imageminJpegoptim({progressive: true, max: MAX_JPEG_QUALITY});
            } else if (type === 'png' && !lossy) {
                engine = imageminOptipng({optimizationLevel: OPTIPNG_COMPRESSION_LEVEL});
            } else if (type === 'svg' && !lossy) {
                engine = imageminSvgo({plugins: [{
                    name: 'preset-default',
                    params: {overrides: {removeUselessDefs: false}}
                }]});
            } else {
                reject('No optimization engine found for imagemin');
                return;
            }

            imagemin.buffer(imageBody, {plugins: [engine]})
                .then(file => {
                    var endTime = Date.now();
                    debug('Optimization for %s took %d ms', type, endTime - startTime);
                    resolve(file);
                })
                .catch(err => {
                    debug('Optimisation failed:');
                    debug(err);
                    resolve();
                });
        });
    }

    function entryTypeCanBeOptimized(entry) {
        return isJPEG(entry) || isPNG(entry) || isSVG(entry);
    }

    return {
        optimizeImage: optimizeImage,
        compressJpegLosslessly: compressJpegLosslessly,
        compressJpegLossly: compressJpegLossly,
        compressPngLosslessly: compressPngLosslessly,
        compressSvgLosslessly: compressSvgLosslessly,
        gainIsEnough: gainIsEnough,
        entryTypeCanBeOptimized: entryTypeCanBeOptimized
    };
};

module.exports = new ImageOptimizer();
