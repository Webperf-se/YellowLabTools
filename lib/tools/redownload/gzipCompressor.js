var debug = require('debug')('ylt:gzipCompressor');
var zlib    = require('zlib');

var GzipCompressor = function() {

    function compressFile(entry) {
        debug('Entering gzip compressor');
        return gzipUncompressedFile(entry)
            .then(gzipOptimizedFile);
    }

    // Gzip a file if it was not already gziped
    function gzipUncompressedFile(entry) {
        return new Promise((resolve, reject) => {
            if (entryTypeCanBeCompressed(entry) && entry.weightCheck && !entry.weightCheck.isCompressed && entry.weightCheck.bodyBuffer) {
                debug('Compression missing, trying to gzip file %s', entry.url);

                var uncompressedSize = entry.weightCheck.uncompressedSize;

                zlib.gzip(entry.weightCheck.bodyBuffer, function(err, buffer) {
                    if (err) {
                        debug('Could not compress uncompressed file with gzip');
                        debug(err);
                        reject(err);
                    } else {
                        var compressedSize = buffer.length;

                        if (gainIsEnough(uncompressedSize, compressedSize)) {
                            debug('File correctly gziped, was %d and is now %d bytes', uncompressedSize, compressedSize);
                            entry.weightCheck.afterGzipCompression = compressedSize;
                        } else {
                            debug('Gzip gain is not enough, was %d and is now %d bytes', uncompressedSize, compressedSize);
                        }

                        resolve(entry);
                    }
                });
            } else {
                debug('Compression not needed');
                resolve(entry);
            }
        });
    }

    // Gzip a file after minification or optimization if this step was successful
    function gzipOptimizedFile(entry) {
        return new Promise((resolve, reject) => {
            if (entryTypeCanBeCompressed(entry) && entry.weightCheck && entry.weightCheck.isOptimized === false) {
                debug('Trying to gzip file after minification: %s', entry.url);

                var uncompressedSize = entry.weightCheck.optimized;

                zlib.gzip(Buffer.from(entry.weightCheck.bodyAfterOptimization, 'utf8'), function(err, buffer) {
                    if (err) {
                        debug('Could not compress minified file with gzip');
                        debug(err);
                        reject(err);
                    } else {
                        var compressedSize = buffer.length;

                        debug('Correctly gziped the minified file, was %d and is now %d bytes', uncompressedSize, compressedSize);
                        entry.weightCheck.afterOptimizationAndGzipCompression = compressedSize;

                        resolve(entry);
                    }
                });
            } else {
                debug('Compressing optimized file not needed');
                resolve(entry);
            }
        });
    }

    // The gain is estimated of enough value if it's over 1KB or over 20%,
    // but it's ignored if is below 100 bytes
    function gainIsEnough(oldWeight, newWeight) {
        var gain = oldWeight - newWeight;
        var ratio = gain / oldWeight;
        return (gain > 2048 || (ratio > 0.2 && gain > 100));
    }

    function entryTypeCanBeCompressed(entry) {
        return entry.isJS || entry.isCSS || entry.isHTML || entry.isJSON || entry.isSVG || entry.isTTF || entry.isXML || entry.isFavicon;
    }

    return {
        compressFile: compressFile,
        gainIsEnough: gainIsEnough,
        entryTypeCanBeCompressed: entryTypeCanBeCompressed
    };
};

module.exports = new GzipCompressor();
