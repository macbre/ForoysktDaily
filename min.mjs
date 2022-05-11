import fs from 'fs/promises';

import imagemin from 'imagemin';
import imageminPngquant from 'imagemin-pngquant';
import log from 'npmlog';


(async () => {
    log.info('imagemin', 'Optimizing tweet.png ...');

    await imagemin(['tweet.png'], {
        destination: 'build/',
        plugins: [
            imageminPngquant({
                quality: [0.6, 0.8]
            })
        ]
    });

    await fs.rm('tweet.png');
    await fs.rename('build/tweet.png', 'tweet.png');

    log.info('imagemin', 'Done');
})();
