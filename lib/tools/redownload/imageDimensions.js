var debug               = require('debug')('ylt:imageDimensions');
var sizeOf              = require('image-size');

var ImageDimensions = function() {

    function getDimensions(entry) {
        return new Promise((resolve, reject) => {
            if (!entry.weightCheck || !entry.weightCheck.bodyBuffer) {
                // No valid file available
                resolve(entry);
                return;
            }

            var fileSize = entry.weightCheck.uncompressedSize;

            if (isJPEG(entry) || isPNG(entry)) {
                try {
                    var dimensions = sizeOf(entry.weightCheck.bodyBuffer);
                    debug('Image dimensions of %s: %sx%s', entry.url, dimensions.width, dimensions.height);

                    entry.imageDimensions = {
                        width: dimensions.width,
                        height: dimensions.height
                    };
                } catch(err) {
                    debug('Error while checking image dimensions:');
                    debug(err);
                }
            }
            
            resolve(entry);
        });
    }

    function isJPEG(entry) {
        return entry.isImage && entry.contentType === 'image/jpeg';
    }

    function isPNG(entry) {
        return entry.isImage && entry.contentType === 'image/png';
    }

    function isWebP(entry) {
        return entry.isImage && entry.contentType === 'image/webp';
    }

    return {
        getDimensions: getDimensions
    };
};

module.exports = new ImageDimensions();
