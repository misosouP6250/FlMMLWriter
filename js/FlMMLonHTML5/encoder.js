importScripts('../libmp3lame.js/libmp3lame.min.js');

var mp3codec;

self.onmessage = function(e) {
	switch (e.data.cmd) {
	case 'init':
		if (!e.data.config) {
			e.data.config = { };
		}
		mp3codec = Lame.init();
		Lame.set_mode(mp3codec, e.data.config.mode || Lame.JOINT_STEREO);
		Lame.set_num_channels(mp3codec, e.data.config.channels || 2);
		Lame.set_in_samplerate(mp3codec, e.data.config.insamplerate || 44100);
		Lame.set_out_samplerate(mp3codec, e.data.config.samplerate || 44100);
		if(e.data.config.vbr)		Lame.set_VBR(mp3codec, e.data.config.vbr);
		if(e.data.config.vbr_q)		Lame.set_VBR_q(mp3codec, e.data.config.vbr_q || 2);
		if(e.data.config.vbr_mean)	Lame.set_VBR_mean_bitrate_kbps(mp3codec, e.data.config.vbr_min || 32);
		if(e.data.config.vbr_min)	Lame.set_VBR_min_bitrate_kbps(mp3codec, e.data.config.vbr_min || 32);
		if(e.data.config.vbr_max)	Lame.set_VBR_max_bitrate_kbps(mp3codec, e.data.config.vbr_max || 320);
		if(e.data.config.bitrate)	Lame.set_bitrate(mp3codec, e.data.config.bitrate || 128);
		Lame.init_params(mp3codec);
		break;
	case 'encode':
		var mp3data = Lame.encode_buffer_ieee_float(mp3codec, e.data.bufL, e.data.bufR);
		self.postMessage({cmd: 'data', buf: mp3data.data});
		break;
	case 'finish':
		var mp3data = Lame.encode_flush(mp3codec);
		self.postMessage({cmd: 'end', buf: mp3data.data});
		Lame.close(mp3codec);
		mp3codec = null;
		break;
	}
};
