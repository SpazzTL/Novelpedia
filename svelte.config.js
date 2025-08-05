import adapter from '@sveltejs/adapter-static';

<<<<<<< HEAD
/** @type {import('@sveltejs/kit').Config} */
const config = {
    kit: {
        adapter: adapter({
            // default options are shown. On some platforms
            // these options are set automatically — see below for detail
            pages: 'build',
            assets: 'build',
            fallback: '404.html',
            precompress: false,
            strict: true
        }),
    }
};

export default config;
=======
export default {
	kit: {
		adapter: adapter({
			// default options are shown. On some platforms
			// these options are set automatically — see below
			pages: 'build',
			assets: 'build',
			fallback: undefined,
			precompress: false,
			strict: true
		})
	}
};
>>>>>>> db8d87f02306025ff7199476f630f4243e3ff1ba
