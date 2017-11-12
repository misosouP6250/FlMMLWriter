"use strict";
importScripts('../lamejs/lame.min.js');

var mp3Encoder,
	config, dataBuffer, samplesL, samplesR;

self.onmessage = function(e) {
	switch (e.data.cmd) {
	case 'init':
		config = e.data.config || {};
		if(!config.blockSize)	config.blockSize = 1152;
		dataBuffer = [];
		break;
	case 'encode':
		samplesL = e.data.channels === 1 ? e.data.buf : new Int16Array(e.data.samples);
		samplesR = e.data.channels === 2 ? new Int16Array(e.data.samples) : undefined;
		// var sampleIdx = 0;
		var buf = e.data.buf;
		if(e.data.channels > 1) {
			for (var i = 0; i < buf.length; i+=2) {
					samplesL[i/2] = buf[i] < 0 ? (buf[i] * 0x8000 - 0.5) : (buf[i] * 0x7FFF + 0.5);
					samplesR[i/2] = buf[i+1] < 0 ? (buf[i+1] * 0x8000 - 0.5) : (buf[i+1] * 0x7FFF + 0.5);
					// sampleIdx++;
			}
		}
		
		mp3Encoder = new lamejs.Mp3Encoder(e.data.channels, e.data.sampleRate, config.bitRate || 128);
		
		var remain = samplesL.length;
		var blockSize = config.blockSize;
		for (var i = 0; remain >= blockSize; i+=blockSize) {
			var leftChunk = samplesL.subarray(i, i+blockSize);
			var rightChunk;
			if(samplesR)
				rightChunk = samplesR.subarray(i, i+blockSize);
			var mp3buf = mp3Encoder.encodeBuffer(leftChunk, rightChunk);
			if(mp3buf.length > 0)
				dataBuffer.push(mp3buf);
			remain -= blockSize;
			self.postMessage({
				cmd: "progress",
				progress: (1 - remain / samplesL.length)
			});
		}

		break;
	case 'finish':
		var mp3buf = mp3Encoder.flush();
		if(mp3buf.length > 0)
			dataBuffer.push(mp3buf);
		self.postMessage({cmd: 'end', buf: dataBuffer});
		dataBuffer = [];
		break;
	}
};
