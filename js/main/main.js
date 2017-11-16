"use strict";

function getCookie(name) {
	if(!name || !document.cookie) return;
	
	var cookies = document.split("; ");
	for(var i=0; i<cookies.length; i++) {
		var str = cookies[i].split("=");
		if(str[0] != name) continue;
		return unescape(str[1]);
	}
	return;
}

function setCookie(name, val, expires) {
	if(name) return;
	
	var str = name + "=" + escape(val);
	var nowtime = new Date().getTime();
	expires = new Date(nowtime + (60 * 60 * 24 * 1000 * expires));
	expires = expires.toGMTString();
	str += "; expires=" + expires;
	
	document.cookie = str;
}

var FlMMLWriter = function () {
	var flmml, flmmlSave;
	var isFirst = true;
	var isSave = false;
	var isPlay = true;
	var editorHltOn = false;
	var editorHltDelayed = false;
	var editorColor = "";
	var delayTimeoutID;
	var delayTimeMSec = 1100;
	var mmlDLUrl, myxhr;
	var imprtComment = "";
	var barMousedown = false;
	var barOfsTop;
	var touchOfs;
	var nowVol = 100;
	var processCount = -1;
	var procSamples = 0;
	var recData = [];
	var renderProgress = 0;
	var renderingComplete = false;
	var saveSampleRate = 44100;
	var saveBufferSize = 65536;
	var saveFilename = "flmml";
	var isEncodeMP3 = false;
	var oldBufferReady = false;
	var mp3worker = new Worker("js/FlMMLonHTML5/encoder.js");
	var encodedArray;

	// function flmmlDefaultPlaySound(){};
	var flmmlDefaultPlaySound;
	var flmmlDefaultAudioProcess;

	// 致し方なく
	var COM_BOOT      =  1, // Main->Worker
		COM_PLAY      =  2, // Main->Worker
		COM_STOP      =  3, // Main->Worker
		COM_PAUSE     =  4, // Main->Worker
		COM_BUFFER    =  5, // Main->Worker->Main
		COM_COMPCOMP  =  6, // Worker->Main
		COM_BUFRING   =  7, // Worker->Main
		COM_COMPLETE  =  8, // Worker->Main
		COM_SYNCINFO  =  9, // Main->Worker->Main
		COM_PLAYSOUND = 10, // Worker->Main
		COM_STOPSOUND = 11, // Worker->Main->Worker
		COM_DEBUG     = 12; // Worker->Main

	function FlMMLWriter() {
	}

	function extend (target, object) {
        for (var name in object) {
            target[name] = object[name];
        }
        return target;
    }

	function saveWav(procSmpl) {
		var encodeWAV = function(samples, sampleRate, ch) {
			var buffer = new ArrayBuffer(44 + samples.length * 2);
			var view = new DataView(buffer);

			var writeString = function(view, offset, string) {
				for (var i = 0; i < string.length; i++){
					view.setUint8(offset + i, string.charCodeAt(i));
				}
			};

			var floatTo16BitPCM = function(output, offset, input) {
				for (var i = 0; i < input.length; i++, offset += 2){
					var s = Math.max(-1, Math.min(1, input[i]));
					output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
				}
			};

			writeString(view, 0, 'RIFF');  // RIFFヘッダ
			view.setUint32(4, 32 + samples.length * 2, true); // これ以降のファイルサイズ
			writeString(view, 8, 'WAVE'); // WAVEヘッダ
			writeString(view, 12, 'fmt '); // fmtチャンク
			view.setUint32(16, 16, true); // fmtチャンクのバイト数
			view.setUint16(20, 1, true); // フォーマットID
			view.setUint16(22, ch, true); // チャンネル数
			view.setUint32(24, sampleRate, true); // サンプリングレート
			view.setUint32(28, sampleRate * 2 * ch, true); // データ速度
			view.setUint16(32, 2 * ch, true); // ブロックサイズ
			view.setUint16(34, 16, true); // サンプルあたりのビット数
			writeString(view, 36, 'data'); // dataチャンク
			view.setUint32(40, samples.length * 2, true); // 波形データのバイト数
			floatTo16BitPCM(view, 44, samples); // 波形データ

			return view;
		};
		var mergeBuffers = function(audioData, numSample) {
			var samples = new Float32Array(numSample);
			var sampleIdx = 0;
			for (var i = 0; i < audioData.length; i++) {
				for (var j = 0; j < audioData[i].length; j++) {
					samples[sampleIdx] = audioData[i][j];
					if(++sampleIdx > numSample)
						return samples;
				}
			}
			return samples;
		};

		console.log(recData);
		var dataview = encodeWAV(mergeBuffers(recData, procSmpl * 2), saveSampleRate, 2);
		var audioBlob = new Blob([dataview], { type: 'audio/wav' });

		return audioBlob;
	}

	function saveMP3 (procSmpl) {
		/*
		var encodeMP3 = function(samples, sampleRate, ch) {
			mp3worker.postMessage({ cmd: 'init', config:{
				channels: ch,
				insamplerate: sampleRate,
				samplerate: sampleRate,
				bitrate: 192
			}});
			mp3worker.postMessage({ cmd: 'encode', bufL: new Float32Array(samples[0]), bufR: new Float32Array(samples[1]) });
			
			mp3worker.postMessage({ cmd: 'finish' });
			mp3worker.onmessage = (function(e) {
				if(e.data.cmd == 'data') {
						encodedArray = e.data.buf;
						onEncodeComplete && onEncodeComplete();
						//  this.trigger("mp3encodecompleted");
				}
			}).bind(this);
			onEncodeStart && onEncodeStart();
			// this.trigger("mp3encodestart");
		};

		var mergeBuffers = function(audioData, numSample) {
			var redgain = 1.0;
			for (var i = 0; i < audioData.length; i++) {
				for (var j = 0; j < audioData[i].length; j++) {
					if(audioData[i][j] > redgain)
						redgain = audioData[i][j];
				}
			}

			var samplesL = new Float32Array(numSample);
			var samplesR = new Float32Array(numSample);
			var sampleIdx = 0;
			for (var i = 0; i < audioData.length; i++) {
				for (var j = 0; j < audioData[i].length; j+=2) {
					samplesL[sampleIdx] = audioData[i][j] / redgain;
					samplesR[sampleIdx] = audioData[i][j+1] / redgain;
					if(++sampleIdx > numSample)
						return [samplesL, samplesR];
				}
			}
			return [samplesL, samplesR];
		};
		// this.addEventListener("encodecompleted", encodedMP3Binded);
		encodeMP3(mergeBuffers(recData, procSmpl), saveSampleRate, 2);
		
		return false;
		*/
		/*
		var mp3Data = [];
		
		var mp3encoder = new lamejs.Mp3Encoder(2, saveSampleRate, 192);

			var redgain = 1.0;
			for (var i = 0; i < recData.length; i++) {
				for (var j = 0; j < recData[i].length; j++) {
					if(recData[i][j] > redgain)
						redgain = recData[i][j];
				}
			}

			if(redgain != 1.0)
				redgain *= 1.77;
			
			console.log(redgain);

			var samplesL = new Int16Array(procSmpl);
			var samplesR = new Int16Array(procSmpl);
			var sampleIdx = 0;
			for (var i = 0; i < recData.length; i++) {
				for (var j = 0; j < recData[i].length; j+=2) {
					if(sampleIdx > procSmpl)
						break;
					samplesL[sampleIdx] = recData[i][j] < 0 ? (recData[i][j] / redgain * 0x8000 - 0.5) : (recData[i][j] / redgain * 0x7FFF + 0.5);
					samplesR[sampleIdx] = recData[i][j+1] < 0 ? (recData[i][j+1] / redgain * 0x8000 - 0.5) : (recData[i][j+1] / redgain * 0x7FFF + 0.5);
					sampleIdx++;
				}
			}
			var sampleBlockSize = 4608;
			for (var i = 0; i < procSmpl; i+=sampleBlockSize) {
				var leftChunk = samplesL.subarray(i, i+sampleBlockSize);
				var rightChunk = samplesR.subarray(i, i+sampleBlockSize);
				var mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk);
				if(mp3buf.length > 0)
					mp3Data.push(mp3buf);
			}
		
		var mp3buf = mp3encoder.flush();
		if(mp3buf.length > 0) {
			mp3Data.push(mp3buf);
		}
		console.log(mp3Data);
		var audioBlob = new Blob(mp3Data, { type: 'audio/x-mpeg-3' });
		dlBlob(audioBlob, ".mp3");
		*/
		var encodeMP3 = function(samples, sampleRate, ch) {
			mp3worker.postMessage({ cmd: 'init', config:{
				blockSize: 4608,
				bitRate: 192
			}});
			mp3worker.postMessage({ cmd: 'encode',
				channels: ch,
				samples: procSmpl,
				sampleRate: sampleRate,
				buf: samples
			});
			
			mp3worker.postMessage({ cmd: 'finish' });
			mp3worker.onmessage = (function(e) {
				if(e.data.cmd == 'end') {
						var encodedMp3 = e.data.buf;
						var audioBlob = new Blob(encodedMp3, { type: 'audio/x-mpeg-3' });
						dlBlob(audioBlob, ".mp3");
						encodedMp3 = [];
						onEncodeComplete && onEncodeComplete();
						//  this.trigger("mp3encodecompleted");
				}else if(e.data.cmd == 'progress') {
					onEncoding && onEncoding(Math.floor(e.data.progress * 100));
				}
			}).bind(this);
			onEncodeStart && onEncodeStart();
			// this.trigger("mp3encodestart");
		};

		var mergeBuffers = function(audioData, numSample) {
			var redgain = 1.0;
			for (var i = 0; i < audioData.length; i++) {
				for (var j = 0; j < audioData[i].length; j++) {
					if(audioData[i][j] > redgain)
						redgain = audioData[i][j];
				}
			}

			if(redgain !== 1.0) {
				redgain *= 1.92;
			}

			var samples = new Float32Array(numSample*2);
			// var samplesR = new Float32Array(numSample);
			var sampleIdx = 0;
			for (var i = 0; i < audioData.length; i++) {
				for (var j = 0; j < audioData[i].length; j+=2) {
					samples[sampleIdx*2] = audioData[i][j] / redgain;
					samples[sampleIdx*2+1] = audioData[i][j+1] / redgain;
					if(++sampleIdx > numSample)
						return samples;
				}
			}
			return samples;
		};

		console.log(recData);
		
		encodeMP3(mergeBuffers(recData, procSmpl), saveSampleRate, 2);

		return false;
	}

	function dlBlob(blob, ext) {
		if (window.navigator.msSaveBlob) { 
			window.navigator.msSaveOrOpenBlob(blob, saveFilename + ext);
		}else{
			var myURL = window.URL || window.mozURL || window.webkitURL;
			var url = myURL.createObjectURL(blob);
			var dlLink = document.createElement("a");
			document.body.appendChild(dlLink);
			dlLink.href = url;
			dlLink.download = saveFilename + ext;
			dlLink.click();
			document.body.removeChild(dlLink);
		}
	}
	
	function onMMLSelected(file) {
		// var item = document.getElementById("mmlfile").files[0];
		// var item = file.files[0];
		// console.log(typeof file);
		if(typeof file === 'object') {
			var item = file.files[0];
			// console.log(typeof item);
			if(typeof item !== 'object')	return;
			var reader = new FileReader();
			reader.onload = onMMLLoaded;
			reader.readAsText(item);
		}
	}
	
	function onMMLLoaded(e) {
		var elm = document.getElementById("mmltxt");
		var elmHlt = document.getElementById("mmlhighlight");
		console.log(e);

		elm.value = e.target.result;
		elmHlt.innerHTML = highlightFlMML(e.target.result);
		updateScrBar();
	}

	function setMMLText(txt) {
		var elm = document.getElementById("mmltxt");
		var elmHlt = document.getElementById("mmlhighlight");

		elm.value = txt;
		elmHlt.innerHTML = highlightFlMML(txt);
		updateScrBar();
	}
	
	function onVolumeChange(vol) {
		// var vol = document.getElementById("mmlvolume").value;
		// var volVal = vol.value;
		if(isNaN(vol))
			vol = nowVol;
		nowVol = vol;
		if(flmml)
			flmml.setMasterVolume(parseInt(vol));
		var elm = document.getElementById("mmlstatus");
		elm.innerHTML = "Volume: " + vol;
	}
	
	function onCompileComplete() {
		console.log(flmml.getTotalMSec());
		procSamples = Math.ceil(flmml.getTotalMSec() / 1000.0 * saveSampleRate);
		var elm = document.getElementById("mmlwarn");
		elm.value = flmml.getWarnings();
		// elm.value = flmml.getWarnings();
	}
	
	function onSyncInfo() {
		var elm = document.getElementById("mmltime");
		elm.innerHTML = flmml.getNowTimeStr() + "/" + flmml.getTotalTimeStr();
	}
	
	function onBuffering(e) {
		if(e.progress === 100){
			onVolumeChange();
		}else{
			var elm = document.getElementById("mmlstatus");
			elm.innerHTML = "buffering [" + e.progress + "%]";
		}
	}

	function onRendering(e) {
		if(e === 100){
			onVolumeChange();
		}else{
			var elm = document.getElementById("mmlstatus");
			elm.innerHTML = "rendering [" + e + "%]";
		}
	}
	
	function onEncodeStart() {
		var elm = document.getElementById("mmlstatus");
		elm.innerHTML = "encoding to MP3 ...";
	}

	function onEncoding(e) {
		if(e === 100){
			onVolumeChange();
		}else{
			var elm = document.getElementById("mmlstatus");
			elm.innerHTML = "encoding [" + e + "%]";
		}
	}

	function onEncodeComplete() {
		onVolumeChange();
		// var encodedBlob = new Blob([encodedArray], { type: 'audio/x-mpeg-3' });
		// dlBlob(encodedBlob, ".mp3");
	}

	function onComplete() {
		if(!isPlay) {
			console.log("complete! smpls: "+ processCount);
			var audioBlob = isEncodeMP3 ? saveMP3.call(this, Math.min(procSamples, processCount)) : saveWav.call(this, Math.min(procSamples, processCount));
			if(audioBlob) {
				dlBlob.call(this, audioBlob, ".wav");
				recData = [];
			}
			// isRendering(false);
			// flmml.setBufferSize(8192);
		}
	}

	function completeRendering() {
		renderingComplete = true;
	}
	
	function createFlMMLonHTML5() {
		if(isPlay){
			flmml = new FlMMLonHTML5(false,false,"flmmlworker.js");
			flmml.oncompilecomplete = onCompileComplete;
			flmml.onsyncinfo = onSyncInfo;
			flmml.onbuffering = onBuffering;
			flmml.oncomplete = onComplete;
			isFirst = false;
			// console.log(flmml);
			// flmmlDefaultAudioProcess = flmml.onAudioProcessBinded;
		}else{
			flmml = new FlMMLonHTML5(saveSampleRate,saveBufferSize,"flmmlworker.js");
			flmml.oncompilecomplete = onCompileComplete;
			flmml.onsyncinfo = onSyncInfo;
			flmml.onbuffering = onBuffering;
			flmml.oncomplete = onComplete;
			isFirst = false;
			/*
			flmml.worker.postMessage({
				type: COM_BOOT,
				sampleRate: saveSampleRate,
				bufferSize: saveBufferSize
			});
			*/
			flmml.onAudioProcessBinded = onSaveProcess;
		}
	}
/*
	function saveSound() {
		if (flmml.gain || flmml.scrProc || flmml.oscDmy) return;
		
		processCount = -1;
		console.log(processCount);
		console.log(flmml.getTotalMSecBinded());
		procSamples = Math.ceil(flmml.getTotalMSecBinded() / 1000.0 * saveSampleRate);
		recData = [];
		var ret = window.setInterval( (function(){
		if(processCount == -1) {
			console.log("pcnt:-1");
			console.log(processCount);
			onSaveProcess();
			processCount = 0;
		}else{
			console.log(processCount);
			if(flmml.bufferReady)
				onSaveProcess();
			if(processCount < procSamples){
				var oldRP = renderProgress;
				renderProgress = parseInt(processCount / procSamples * 1000)/10.0;
				if(oldRP < renderProgress){
					onrendering && onrendering(renderProgress);
					   // flmml.trigger("rendering", flmml.renderProgress);
				}
			}else if(renderingComplete){
				window.clearInterval(ret);
				renderProgress = 100.0;
				onrendering && onrendering(renderProgress);
					   // flmml.trigger("rendering", flmml.renderProgress);
					// var audioBlob = flmml.isEncodeMP3 ? saveMP3.call(this, Math.min(procSamples, processCount)) : saveWAV.call(this, Math.min(procSamples, processCount));
				console.log("complete! smpls: "+ processCount);
					var audioBlob = isEncodeMP3 ? saveMP3.call(this, Math.min(procSamples, processCount)) : saveWAV.call(this, Math.min(procSamples, processCount));
					if(audioBlob)
						dlBlob.call(this, audioBlob, ".wav");
				flmml.removeEventListener("complete", completeRendering);
				renderingComplete = false;
				flmml.bufferReady = false;
			}
		}
		// })(), 0 );
		}).bind(this), 0 );
						
		flmml.addEventListener("complete", completeRendering);
	}
*/
/*
	function resetBuffer_Rate() {
		var AudioCtx = window.AudioContext || window.webkitAudioContext;
		var actx = new AudioCtx();
		console.log(actx.sampleRate);
		flmml.worker.postMessage({
			type: COM_BOOT,
			sampleRate: actx.sampleRate,
			bufferSize: 8192
		});
	}

	function isRendering(b) {
		isSave = b;
		if(b) {
			flmml.worker.postMessage({
				type: COM_BOOT,
				sampleRate: saveSampleRate,
				bufferSize: saveBufferSize
			});
			flmml.onAudioProcessBinded = onSaveProcess;
			// console.log(onSaveProcess);
		} else {
			// console.log(String(FlMMLonHTML5.audioCtx.sampleRate) +" "+ saveBufferSize);
			// resetBuffer_Rate();
			flmml.onAudioProcessBinded = flmmlDefaultAudioProcess;
			// console.log(flmmlDefaultAudioProcess);
		}
	}
*/

	function onSaveProcess() {
		var cback = function() {
				var in0 = flmml.buffer[0];
				var in1 = flmml.buffer[1];
				var bufferData = new Float32Array(in0.length * 2);
				for(var i=0; i<in0.length; i++){
					bufferData[i*2] = in0[i];
					bufferData[i*2+1] = in1[i];
				}
				recData.push(bufferData);
				processCount += in0.length;
				
				flmml.bufferReady = false;
				flmml.worker.postMessage({ type: COM_BUFFER, retBuf: flmml.buffer }, [flmml.buffer[0].buffer, flmml.buffer[1].buffer]);
				// return true;
		};
		if (processCount < 0) {
			flmml.worker.postMessage({ type: COM_BUFFER, retBuf: null });
			console.log("buffer requested,processCount: "+processCount);
			processCount = 0;
		} else if (flmml.bufferReady) {
			cback();
		} else {
			var tid = setInterval((function() {
				if(flmml.bufferReady) {
					clearInterval(tid);
					cback();
				}
			})(), 150);
		}
		/*
		if (flmml.bufferReady) {
			var in0 = flmml.buffer[0];
			var in1 = flmml.buffer[1];
			var bufferData = new Float32Array(in0.length * 2);
			for(var i=0; i<in0.length; i++){
				bufferData[i*2] = in0[i];
				bufferData[i*2+1] = in1[i];
			}
			recData.push(bufferData);
			processCount += in0.length;
			
			flmml.bufferReady = false;
			flmml.worker.postMessage({ type: COM_BUFFER, retBuf: flmml.buffer }, [flmml.buffer[0].buffer, flmml.buffer[1].buffer]);
			// return true;
		 }else{
			   flmml.worker.postMessage({ type: COM_BUFFER, retBuf: null });
			   console.log("buffer requested,processCount: "+processCount);
			   // return false;
		 } */
		 /*
		 console.log(procSamples + "/" + processCount);
		 if(procSamples <= processCount){
			 console.log("complete! smpls: "+ processCount);
			 var audioBlob = isEncodeMP3 ? saveMP3.call(this, Math.min(procSamples, processCount)) : saveWAV.call(this, Math.min(procSamples, processCount));
			 if(audioBlob)
				 dlBlob.call(this, audioBlob, ".wav");
		 } */
	}
	
	function play() {
		var oldisPlay = isPlay;
		isPlay = true;
		if(isFirst || oldisPlay != true)
			createFlMMLonHTML5();
		// isRendering(false);
		flmml.play(document.getElementById('mmltxt').value);
	}
	
	function stop() {
		if(!isFirst){
			flmml.stop();
			// flmml.setBufferSize(8192);
			// isRendering(false)
		}
	}
	
	function pause() {
		if(!isFirst)	flmml.pause();
	}
	
	function save(isMP3) {
		var oldisPlay = isPlay;
		isPlay = false;
		if(isFirst || oldisPlay != false)
			createFlMMLonHTML5();
		// isRendering(true);
		var elm = document.getElementById("mmlstatus");
		elm.innerHTML = "compiling ...";
		// flmml.play(document.getElementById('mmltxt').value, document.getElementById('mmlsavefilename').value, isMP3);
		processCount = -1;
		var filename = document.getElementById('mmlsavefilename').value;
		saveFilename = filename == "" ? "flmml" : filename;
		isEncodeMP3 = isMP3;
		recData = [];
	 	// flmml.setBufferSize(saveBufferSize, saveSampleRate);
		flmml.play(document.getElementById('mmltxt').value);
		// isRendering(false);
		// var ext = isMP3 ? ".mp3" : ".wav";
		// dlBlob(saveWav(recData),ext);
		// isRendering(false);
	}
	
	function saveStop() {
		if(!isFirstSave)	flmmlSave.stop();
	}
	
	var openUrl = function(url) {
		imprtComment = "";
		if(!isNaN(url) && url != ""){	// PIKOKAKIKO ID.
			mmlDLUrl = "http://dic.nicovideo.jp/mml/" + url;
			imprtComment = "/* " + "imported from PIKOKAKIKO ID " + url + "\n"+
							"   " + "http://dic.nicovideo.jp/mml_id/" + url + " */\n";
		}else if(String(url).search(/http(s)?:\/\/([\w-]+\.)+[\w-]+(\/[\w- ./?%&=]*)?/) != -1){	// URL
			mmlDLUrl = url;
			imprtComment = "/* " + "imported from " + url + " */\n";
		}else{
			var elm = document.getElementById("mmlwarn");
			elm.value = "Invalid URL/No. :'" + url + "'";
			return;
		}
		if(true){
		// var yqlQuery = encodeURIComponent('env "store://datatables.org/alltableswithkeys";select * from xClient where url="' + mmlDLUrl + '"');
		var yqlQuery = encodeURIComponent('use "http://www.datatables.org/xClient/xClient.xml" as xClient;select * from xClient where url="' + mmlDLUrl + '"');
		var yqlUrl = 'http' + (/^https/.test(location.protocol)?'s':'') + '://query.yahooapis.com/v1/public/yql?q='
						+ yqlQuery + '&format=json';
		myxhr = new XMLHttpRequest();
		myxhr.onload = function (e) {
						// console.log(myxhr.response);
						var rcont = myxhr.response.query.results.resources.content;
						if(rcont)
							onMMLLoaded({target: {result: imprtComment + rcont}});
		};
		// console.log(yqlUrl);
		myxhr.open("GET", yqlUrl);
		myxhr.responseType = "json";
		myxhr.send(null);
		}
	};
	
	function saveText(ext) {
		var mmlTxt = document.getElementById("mmltxt").value;
		var mmlName = document.getElementById('mmlsavefilename').value;
		var mmlBlob = new Blob([mmlTxt], {"type": "text/plain"});
		
		if(mmlName == ""){
			mmlName = "flmml";
		}
		
		if(window.navigator.msSaveBlob) {
			window.navigator.msSaveBlob(mmlBlob, mmlName + ext);
		}else{
			var myURL = window.URL || window.mozURL || window.webkitURL;
			var url = myURL.createObjectURL(mmlBlob);
			var dlLink = document.createElement("a");
			document.body.appendChild(dlLink);
			dlLink.href = url;
			dlLink.download = mmlName + ext;
			dlLink.click();
			document.body.removeChild(dlLink);
		}
	}
	
	function highlightFlMML(text) {
		var buf = text;
		var result = "";
		var escapeRE = function(str) {
			return str.replace(/([.*+?^=!:${}()|[\]\/\\])/g, "\\$1");
		};
		var macroName = [];
		var macroArgName = [];
		while(buf.length != 0){
			var chr = buf.charAt(0);
			var preTag = "";
			var postTag = "";
			var preChr = "";
			var postChr = "";
			var strCnt = 1;
			
			switch(chr){
				case '/':
					// strCnt++;
					var chr2 = buf.charAt(1);
					if(chr2 == "*"){	// コメント
						var ret = buf.indexOf("*/");
						if(ret != -1){
							strCnt = ret + 2;
							chr = buf.slice(0, strCnt);
						}else{	// コメント終わり見つからず
							strCnt = buf.length;
							chr = buf;
						}
						preTag = "<span class='comment'>";
						postTag = "</span>";
					}else if(chr2 == ":"){	// ループ始まり
						strCnt = 2;
						chr = buf.slice(0, strCnt);
						if(!isNaN(buf.charAt(2))){
							for(var i=3; i<buf.length; i++){
								if(isNaN(buf.charAt(i))){
									postChr = "<span class='loopNum'>" + buf.slice(2, i) + "</span>";
									strCnt += i-2;
									break;
								}
							}
						}
						preTag = "<span class='loop'>";
						postTag = "</span>";
					}
					break;
				case '%':
					if(macroArgName.length){	// マクロ内引数
						for(var i=0; i<macroArgName.length; i++){
								if(buf.slice(1, macroArgName[i].length+1) == macroArgName[i]){	// 宣言済みマクロなら
									strCnt = macroArgName[i].length + 1;
									chr = buf.slice(0, strCnt);
									break;
								}
						}
						preTag = "<span class='macroDecl'>";
						postTag = "</span>";
					}
					break;
				case ':':
					if(buf.charAt(1) == "/"){	// ループ終わり
						strCnt = 2;
						chr = buf.slice(0, strCnt);
					}else{
						strCnt = buf.length;
						chr = buf;
					}
					preTag = "<span class='loop'>";
					postTag = "</span>";
					break;
				case '&':	// タイ,スラー
				switch(buf.charAt(1)){
					case 'c': case 'd': case 'e': case 'f': case 'g': case 'a': case 'b':
					case 'C': case 'D': case 'E': case 'F': case 'G': case 'A': case 'B':	// 音程
						var ret = buf.slice(2).search(/[^0-9\+\-\.\s]/);	// 音符系以外の文字
						if(ret != -1){
							strCnt = ret + 2;
							chr = "&";
							postChr = "<span class='aftTie'>" + buf.slice(1, strCnt) + "</span>";
						}else{
							strCnt = buf.length;
							chr = buf;
						}
						preTag = "<span class='tie'>";
						postTag = "</span>";
						break;
					case '0': case '1': case '2': case '3': case '4':
					case '5': case '6': case '7': case '8': case '9':	// 音長
						var ret = buf.slice(2).search(/[^0-9\.\s]/);	// 音符系以外の文字
						if(ret != -1){
							strCnt = ret + 2;
							chr = "&";
							postChr = "<span class='aftTie'>" + buf.slice(1, strCnt) + "</span>";
						}else{
							strCnt = buf.length;
							chr = buf;
						}
						preTag = "<span class='tie'>";
						postTag = "</span>";
						break;
					default:
						strCnt = 1;
						chr = '&';
						break;
				}
					/*
					var ret = buf.slice(1).search(/[^a-gA-G0-9\+\-\.\s]/);	// 音符系以外の文字
					if(ret != -1){
						strCnt = ret + 1;
						chr = "&";
						postChr = "<span class='aftTie'>" + buf.slice(1, strCnt) + "</span>";
					}else{
						strCnt = buf.length;
						chr = buf;
					}
					preTag = "<span class='tie'>";
					postTag = "</span>";
					break;
					*/
				case '<':	// オクターブシフト アップ(default)
					preTag = "<span class='octShftUp'>";
					postTag = "</span>";
					break;
				case '>':	// オクターブシフト ダウン(default)
					preTag = "<span class='octShftDown'>";
					postTag = "</span>";
					break;
				case '(':	// 音量アップ(default)
					preTag = "<span class='velUp'>";
					postTag = "</span>";
					break;
				case ')':	// 音量ダウン(default)
					preTag = "<span class='velDown'>";
					postTag = "</span>";
					break;
				case '*':	// ポルタメント
					preTag = "<span class='porta'>";
					postTag = "</span>";
					break;
				case ';':	// トラック終了
					macroArgName = [];
					preTag = "<span class='endTrack'>";
					postTag = "</span>";
					break;
				case '@':	// アットマーク系
					var ret = buf.charAt(1);
					switch(ret){
						case '0':	case '1':	case '2':	case '3':	case '4':
						case '5':	case '6':	case '7':	case '8':	case '9':	// 音源設定
							var ret2 = buf.slice(1).search(/[^0-9\-\s]/);
							if(ret2 != -1){
								strCnt = ret2 + 1;
								chr = buf.slice(0, strCnt);
							}else{
								strCnt = 2;
								chr = buf.slice(0, 2);
							}
							preTag = "<span class='tone'>";
							postTag = "</span>";
							break;
						case 'n':	case 'N':
							var ret2 = buf.charAt(2);
							if(ret2 == 's' || ret2 == 'S'){	// 相対ノートシフト
								var ret3 = buf.slice(3).search(/[^0-9\+\-\s]/);
								if(ret3 != -1){
									strCnt = ret3 + 3;
									chr = buf.slice(0, strCnt);
								}else{
									strCnt = 3;
									chr = buf.slice(0, 3);
								}
								preTag = "<span class='noteShiftR'>";
								postTag = "</span>";
							}
							break;
						case 'd':	case 'D':	// デチューン
							var ret2 = buf.slice(2).search(/[^0-9\+\-\s]/);
							if(ret2 != -1){
								strCnt = ret2 + 2;
								chr = buf.slice(0, strCnt);
							}else{
								strCnt = buf.length;
								chr = buf;
							}
							preTag = "<span class='detune'>";
							postTag = "</span>";
							break;
						case 'l':	case 'L':	// LFO
							var ret2 = buf.slice(2).search(/[^0-9\-,\s]/);
							if(ret2 != -1){
								strCnt = ret2 + 2;
								chr = buf.slice(0, strCnt);
							}else{
								strCnt = buf.length;
								chr = buf;
							}
							preTag = "<span class='LFO'>";
							postTag = "</span>";
							break;
						case 'q':	case 'Q':	// 絶対ゲートタイム
							var ret2 = buf.slice(2).search(/[^0-9\s]/);	// 数値以外の文字
							if(ret2 != -1){
								strCnt = ret2 + 2;
								chr = buf.slice(0, strCnt);
							}else{
								strCnt = 2;
								chr = buf.slice(0, 2);
							}
							preTag = "<span class='abQuant'>";
							postTag = "</span>";
							break;
						case 'v':	case 'V':	// 詳細音量
							var ret2 = buf.slice(2).search(/[^0-9\s]/);
							if(ret2 != -1){
								strCnt = ret2 + 2;
								chr = buf.slice(0, strCnt);
							}else{
								strCnt = 2;
								chr = buf.slice(0, 2);
							}
							preTag = "<span class='fVel'>";
							postTag = "</span>";
							break;
						case 'x':	case 'X':	// エクスプレッション
							var ret2 = buf.slice(2).search(/[^0-9\s]/);
							if(ret2 != -1){
								strCnt = ret2 + 2;
								chr = buf.slice(0, strCnt);
							}else{
								strCnt = 2;
								chr = buf.slice(0, 2);
							}
							preTag = "<span class='expr'>";
							postTag = "</span>";
							break;
						case 'p':	case 'P':	// パン
							var ret2 = buf.charAt(2);
							if(ret2 != 'l' && ret2 != 'L'){	// パン
								var ret3 = buf.slice(2).search(/[^0-9\s]/);
								if(ret3 != -1){
									strCnt = ret3 + 2;
									chr = buf.slice(0, strCnt);
								}else{
									strCnt = 2;
									chr = buf.slice(0, 2);
								}
								preTag = "<span class='panpod'>";
								postTag = "</span>";
							}else{	// ポリフォニック有効 発音数指定
								var ret3 = buf.slice(3).search(/[^0-9\s]/);
								if(ret3 != -1){
									strCnt = ret3 + 3;
									chr = buf.slice(0, strCnt);
								}else{
									strCnt = buf.length;
									chr = buf;
								}
								preTag = "<span class='polyNum'>";
								postTag = "</span>";
							}
							break;
						case 'u':	case 'U':	// MIDIポルタメント
							var ret2 = buf.charAt(2);
							if(ret2 == '0'){
								strCnt = 3;
								chr = buf.slice(0, 3);
								preTag = "<span class='midiPortaOff'>";
								postTag = "</span>";
							}else if(ret2 == '1'){
								strCnt = 3;
								chr = buf.slice(0, 3);
								preTag = "<span class='midiPortaOn'>";
								postTag = "</span>";
							}else if(ret2 == '2'){
								var ret3 = buf.slice(3).search(/[^\,0-9\s]/);
								if(ret3 != -1){
									strCnt = ret3 + 3;
									chr = buf.slice(0, strCnt);
								}else{
									strCnt = buf.length;
									chr = buf;
								}
								preTag = "<span class='midiPortaVel'>";
								postTag = "</span>";
							}else if(ret2 == '3'){
								var ret3 = buf.slice(3).search(/[^\,0-9oO\+\-#\s]/);
								if(ret3 != -1){
									strCnt = ret3 + 3;
									chr = buf.slice(0, strCnt);
								}else{
									strCnt = buf.length;
									chr = buf;
								}
								preTag = "<span class='midiPortaStart'>";
								postTag = "</span>";
							}
							break;
						case 'm':	case 'M':
							var ret2 = buf.charAt(3);
							if(ret2 == 'h' || ret2 == 'H'){	// FM音源用LFO
								var ret3 = buf.slice(3).search(/[^\,0-9\s]/);
								if(ret3 != -1){
									strCnt = ret3 + 3;
									chr = buf.slice(0, strCnt);
								}else{
									strCnt = buf.length;
									chr = buf;
								}
								preTag = "<span class='fmLFO'>";
								postTag = "</span>";
							}
							break;
						case 'w':	case 'W':	// パルス幅
							var ret2 = buf.slice(2).search(/[^0-9\-\s]/);
							if(ret2 != -1){
								strCnt = ret2 + 2;
								chr = buf.slice(0, strCnt);
							}else{
								strCnt = 2;
								chr = buf.slice(0, 2);
							}
							preTag = "<span class='pDuty'>";
							postTag = "</span>";
							break;
						case 'n':	case 'N':	// ホワイトノイズ周波数
							var ret2 = buf.slice(2).search(/[^0-9\s]/);
							if(ret2 != -1){
								strCnt = ret2 + 2;
								chr = buf.slice(0, strCnt);
							}else{
								strCnt = 2;
								chr = buf.slice(0, 2);
							}
							preTag = "<span class='noiseFreq'>";
							postTag = "</span>";
							break;
						case 'f':	case 'F':	// フィルタ
							var ret2 = buf.slice(2).search(/[^\,0-9\-\s]/);
							if(ret2 != -1){
								strCnt = ret2 + 2;
								chr = buf.slice(0, strCnt);
							}else{
								strCnt = buf.length;
								chr = buf;
							}
							preTag = "<span class='filter'>";
							postTag = "</span>";
							break;
						case 'e':	case 'E':	// エンベロープ
							var ret2 = buf.charAt(2);
							if(ret2 == '1'){
								if(buf.charAt(3) == ','){	// VCAエンベロープ
									var ret3 = buf.slice(4).search(/[^\,0-9\s]/);
									if(ret3 != -1){
										strCnt = ret3 + 4;
										chr = buf.slice(0, strCnt);
									}else{
										strCnt = buf.length;
										chr = buf;
									}
									preTag = "<span class='vcaEnv'>";
									postTag = "</span>";
								}
							}else if(ret2 == '2'){
								if(buf.charAt(3) == ','){	// VCFエンベロープ
									var ret3 = buf.slice(4).search(/[^\,0-9\s]/);
									if(ret3 != -1){
										strCnt = ret3 + 4;
										chr = buf.slice(0, strCnt);
									}else{
										strCnt = buf.length;
										chr = buf;
									}
									preTag = "<span class='vcfEnv'>";
									postTag = "</span>";
								}
							}
							break;
						case "'":	// フォルマントフィルタ
							var ret2 = buf.slice(2).indexOf("'");
							if(ret2 != -1){
								strCnt = ret2 + 2;
								chr = buf.slice(0, strCnt);
							}else{
								strCnt = buf.length;
								chr = buf;
							}
							preTag = "<span class='formant'>";
							postTag = "</span>";
							break;
						default:	// 上記以外
							strCnt = 2;
							chr = buf.slice(0, 2);
							preTag = "<span class='atmark'>";
							postTag = "</span>";
							break;
					}
					break;
				case '{':	// 連符開始
					preTag = "<span class='nplet'>";
					postTag = "</span>";
					break;
				case '}':	// 連符終了
					preTag = "<span class='nplet'>";
					postTag = "</span>";
					break;
				case '[':	// 和音開始
					preTag = "<span class='poly'>";
					postTag = "</span>";
					break;
				case ']':	// 和音終了
					preTag = "<span class='poly'>";
					postTag = "</span>";
					break;
				case 'a':	case 'b':	case 'c':	case 'd':
				case 'e':	case 'f':	case 'g':
				case 'A':	case 'B':	case 'C':	case 'D':
				case 'E':	case 'F':	case 'G':				// 音符
					var ret = buf.search(/[^a-gA-G0-9\+#\-\.\s]/);	// 音符系以外の文字
					if(ret != -1){
						strCnt = ret;
						chr = buf.slice(0, strCnt);
					}else{
						strCnt = buf.length;
						chr = buf;
					}
					preTag = "<span class='note'>";
					postTag = "</span>";
					break;
				case 'r':	case 'R':	// 休符
					var ret = buf.search(/[^rR0-9\.]/);	// 休符系以外の文字
					if(ret != -1){
						strCnt = ret;
						chr = buf.slice(0, strCnt);
					}else{
						strCnt = buf.length;
						chr = buf;
					}
					preTag = "<span class='rest'>";
					postTag = "</span>";
					break;
				case 'v':	case 'V':	// 音量
					var ret = buf.slice(1).search(/[^0-9\s]/);	// 数値以外の文字
					if(ret != -1){
						strCnt = ret + 1;
						chr = buf.slice(0, strCnt);
					}else{
						strCnt = buf.length;
						chr = buf;
					}
					preTag = "<span class='vel'>";
					postTag = "</span>";
					break;
				case 'o':	case 'O':	// オクターブ指定
					var ret = buf.slice(1, 2);	// 次の文字は数字一文字
					if(!isNaN(ret)){
						strCnt = 2;
						chr = buf.slice(0, 2);
						preTag = "<span class='oct'>";
						postTag = "</span>";
					}
					break;
				case 'l':	case 'L':	// デフォルト音長
					var ret = buf.slice(1).search(/[^0-9\s]/);	// 数値以外の文字
					if(ret != -1){
						strCnt = ret + 1;
						chr = buf.slice(0, strCnt);
						preTag = "<span class='defLength'>";
						postTag = "</span>";
					}
					break;
				case 'q':	case 'Q':	// デフォルトゲートタイム
					var ret = buf.slice(1).search(/[^0-9\s]/);	// 数値以外の文字
					if(ret != -1){
						strCnt = ret + 1;
						chr = buf.slice(0, strCnt);
						preTag = "<span class='defQuant'>";
						postTag = "</span>";
					}
					break;
				case 't':	case 'T':	// テンポ
					var ret = buf.slice(1).search(/[^0-9\s]/);	// 数値以外の文字
					if(ret != -1){
						strCnt = ret + 1;
						chr = buf.slice(0, strCnt);
					}else{
						strCnt = buf.length;
						chr = buf;
					}
					preTag = "<span class='tempo'>";
					postTag = "</span>";
					break;
				case 'x':	case 'X':	// 音量モード
					var ret = buf.slice(1, 2);	// 次の文字は数字一文字
					if(!isNaN(ret)){
						strCnt = 2;
						chr = buf.slice(0, 2);
						preTag = "<span class='velMode'>";
						postTag = "</span>";
					}
					break;
				case 'n':	case 'N':
					if(buf.slice(0,2).search(/[nN][sS]/) == 0){	// 絶対ノートシフト
						var ret = buf.slice(2).search(/[^0-9\s\+\-]/);	// 数値以外の文字
						if(ret != -1){
							strCnt = ret + 2;
							// console.log("meta cnt: "+strCnt);
							chr = buf.slice(0, strCnt);
						}else{
							strCnt = buf.length;
							chr = buf;
						}
						preTag = "<span class='noteShift'>";
						postTag = "</span>";
					}
					break;
				case '$':	// マクロ
					var ret = buf.indexOf(";");
					var ret2 = buf.slice(0, ret).indexOf("=");
					if(ret != -1 && ret2 != -1){		// マクロ宣言
							var ret3 = buf.slice(0, ret2).indexOf("\{");
							var tmpStr;
							if(ret3 != -1){
								tmpStr = buf.slice(1, ret3).trimRight()+"{";
							}else{
								tmpStr = buf.slice(1, ret2).trimRight();
							}
							if(macroName.length){
								for(var i=0; i<macroName.length; i++){
									if(macroName[i].length <= tmpStr.length){
										macroName.splice(i, 0, tmpStr);
										break;
									}else if(i+1 >= macroName.length){
										macroName.push(tmpStr);
									}
								}
							}else{
								macroName.push(tmpStr);
							}
							if(ret3 != -1){	// 引数付きマクロ
								tmpStr = buf.slice(ret3 + 1, buf.slice(0, ret2).indexOf("\}")).replace(/\s/g, "").split(",");
								macroArgName = tmpStr;
							}
							strCnt = ret2; // + 1 - 1;
							chr = buf.slice(0, strCnt);
							preTag = "<span class='macroDecl'>";
							postTag = "</span>";
					}else{
						var matching = false;
							for(var i=0; i<macroName.length; i++){
								if(buf.slice(1, macroName[i].length+1) == macroName[i]){	// 宣言済みマクロなら
									var ret3 = macroName[i].lastIndexOf("\{");
									if(ret3 != -1){	// 引数付きマクロ
										var ret4 = buf.indexOf("\}");
										if(ret4 != -1){
											strCnt = ret4 + 1;
											chr = buf.slice(0, strCnt);
										}else{
											strCnt = buf.length;
											chr = buf;
										}
									}else{
										strCnt = macroName[i].length + 1;
										chr = buf.slice(0, strCnt);
									}
									matching = true;
									break;
								}
							}
						// if(!matching){
						//	strCnt = buf.length;
						//	chr = buf;
						// }
						preTag = "<span class='macroUse'>";
						postTag = "</span>";
					}
					break;
				default:
					var chrReg = new RegExp(escapeRE(chr));
					if(chrReg.test("^#")){	// メタデータ
						var ret = buf.indexOf("\n");
						if(ret != -1){
							strCnt = ret + 1;
							chr = buf.slice(0, strCnt);
						}else{
							strCnt = buf.length;
							chr = buf;
						}
						preTag = "<span class='metaData'>";
						postTag = "</span>";
					}
			}	// switch
			result += preTag + preChr + chr.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") + postChr + postTag;
			buf = buf.slice(strCnt);
		}	// while
		
		return result;
	}
	
	function changeHltMode (mode) {
		if(mode === "delay") {
			editorHltOn = editorHltDelayed = true;
		} else if(mode === "rt") {
			editorHltOn = true;
			editorHltDelayed = false;
		} else if(mode === "off") {
			editorHltOn = editorHltDelayed = false;
		}
		// editorHltOn = document.getElementById("hlt-off").checked ? false : true;
		// editorHltDelayed = document.getElementById("hlt-rt").checked ? false : true;
		var elmHlt = document.getElementById("mmlhighlight");
		var elmTxt = document.getElementById("mmltxt");
		if(editorHltOn){
			elmHlt.innerHTML = highlightFlMML(elmTxt.value);
			
			elmHlt.style.visibility = "visible";
			if(editorColor === "")
				editorColor = (elmTxt.currentStyle || document.defaultView.getComputedStyle(elmTxt, '')).color;
			elmTxt.style.color = "rgba(200, 200, 160, 0.5)";
		}else{
			if(typeof delayTimeoutID == "number") {
				window.clearTimeout(delayTimeoutID);
				delayTimeoutID = "";
			}
			if(editorColor !== "")
				elmTxt.style.color = editorColor;
			elmHlt.style.visibility = "hidden";
		}
	};
	
	var updateHlt = function () {
			var elmHlt = document.getElementById("mmlhighlight");
			var elmTxt = document.getElementById("mmltxt");
			changeHltMode ()
			elmHlt.style.top = -elmTxt.scrollTop + "px";
			elmHlt.style.width = elmTxt.innerWidth + "px";
	};
	
	var updateScrBar = function () {
		var elmTxt = document.getElementById("mmltxt");
		var elmScrBar = document.getElementById("scrollBar");
		elmScrBar.style.height = Math.max((elmTxt.offsetHeight - 6) / elmTxt.scrollHeight * (elmTxt.offsetHeight - 6), 32) + "px";
		elmScrBar.style.top = elmTxt.scrollTop / (elmTxt.scrollHeight - elmTxt.offsetHeight)
									* (elmTxt.offsetHeight - elmScrBar.style.height.split("px")[0] - 12) + "px";
	};
	
	var onBarMove = function (ev) {
		var elmTxt = document.getElementById("mmltxt");
		elmTxt.scrollTop += (ev.pageY - this.barOfsTop) * (elmTxt.scrollHeight / elmTxt.offsetHeight);
		this.barOfsTop = ev.pageY;
		updateScrBar();
		return false;
	};
	
	var setHighlight = function () {
		var elmHlt = document.getElementById("mmlhighlight");
		var elmTxt = document.getElementById("mmltxt");
		var elmHltWrap = document.getElementById("mmlhighlightwrap");
		
		
		var lineHeight = 17;
		
		changeHltMode();
		
		// elmTxt.style.WebkitAppearance = "none";
		// elmTxt.style.top = "10px";
		// elmTxt.style.left = "10px";
		elmTxt.style.width = "100%";
		elmTxt.style.height = "100%";
		// elmTxt.style.padding = "4px";
		

		/*
		elmHlt.style.WebkitAppearance = "none";
		elmHlt.style.pointerEvents = "none";
		elmHlt.style.MosUserSelect = "none";
		elmHlt.style.MsUserSelect = "none";
		elmHlt.style.WebkitUserSelect = "none";
		elmHlt.style.top = "0";
		elmHlt.style.left = "0";
		*/
		elmHlt.style.width = elmTxt.style.width;
		// elmHlt.style.height = elmTxt.style.height;
		// elmHlt.style.padding = "4px";
		
		elmHltWrap.style.width = elmTxt.style.width;
		elmHltWrap.style.height = elmTxt.style.height;
		// elmHltWrap.style.padding = "4px";
		// elmHltWrap.style.color = "#EEE";
		
		elmTxt.addEventListener("input", function(e) {
			var cancelUpdt = function () {
				if(typeof delayTimeoutID == "number") {
					window.clearTimeout(delayTimeoutID);
					delayTimeoutID = "";
				}
			};
			if(editorHltOn){
				var elmHlt = document.getElementById("mmlhighlight");
				var elmTxt = document.getElementById("mmltxt");
				if(editorHltDelayed){
					elmHlt.style.visibility = "hidden";
					elmTxt.style.color = editorColor;
					cancelUpdt();
					delayTimeoutID = window.setTimeout(function() {
						updateHlt();
					}, delayTimeMSec);
				}else{
					updateHlt();
				}
				elmHlt.style.top = -elmTxt.scrollTop + "px";
				elmHlt.style.width = elmTxt.innerWidth + "px";
			}
		});
		
		elmTxt.addEventListener("scroll", function(e) {
			var elmHlt = document.getElementById("mmlhighlight");
			elmHlt.style.top = -e.target.scrollTop + "px";
			elmHlt.style.width = e.target.innerWidth + "px";
			updateScrBar();
		});
	};
	
	var setManualScroll = function () {
		var elmTxt = document.getElementById("mmltxt");
		var wheelEvent = "onwheel" in elmTxt ? "wheel" : document.onmousewheel !== undefined ? "mousewheel" : "DOMMouseScroll";
		var onWheel = function (e) {
			var delta = e.deltaY ? e.deltaY : e.wheelDelta ? -e.wheelDelta : e.detail;
			if(delta < 0 || delta > 0){
				e.preventDefault();
				var elmTxt = document.getElementById("mmltxt");
				var cnstDelta = delta < 0 ? -128 : 128; 
				elmTxt.scrollTop += cnstDelta;
			}
		};
		var onTouchstart = function (e) {
			if(e.targetTouches.length == 2){
				var touch = e.targetTouches[0];
				touchOfs = touch.pageY;
			}
		};
		var onTouchmove = function (e) {
			if(e.targetTouches.length == 2){
				e.preventDefault();
				var touch = e.targetTouches[0];
				var delta = touchOfs - touch.pageY;
				elmTxt.scrollTop += delta * 2;
				touchOfs = touch.pageY;
			}
		};

		
		if("ontouchstart" in window){
			elmTxt.addEventListener("touchstart", onTouchstart);
			elmTxt.addEventListener("touchmove", onTouchmove);
		}
		
		elmTxt.addEventListener(wheelEvent, onWheel);
		
		var txtCurStyle = elmTxt.currentStyle || document.defaultView.getComputedStyle(elmTxt, '');
		var elmScrBar = document.getElementById("scrollBar");
		elmScrBar.style.pointerEvents = "auto";
		elmScrBar.style.display = "inline-block";
		elmScrBar.style.position = "absolute";
		elmScrBar.style.top = "0px";
		elmScrBar.style.right = "0px";
		elmScrBar.style.height = Math.max((elmTxt.offsetHeight - 8) / elmTxt.scrollHeight * (elmTxt.offsetHeight - 8), 32) + "px";
		var onBarMousedown = function (e) {
			e.preventDefault();
			barMousedown = true;
			barOfsTop = e.pageY;
			window.addEventListener("mousemove", onBarMove);
		};
		elmScrBar.addEventListener("mousedown", onBarMousedown);
		window.addEventListener("mouseup", function () {
			if(barMousedown){
				barMousedown = false;
				window.removeEventListener("mousemove", onBarMove);
			}
		});
	};

	extend(FlMMLWriter.prototype, {
		openUrl: function(url) {
			openUrl(url);
		},
		onMMLSelected: function(file) {
			onMMLSelected(file);
		},
		setMMLText: function(file) {
			setMMLText(file);
		},
		saveText: function(ext) {
			saveText(ext);
		},
		play: function() {
			play();
		},
		stop: function() {
			stop();
		},
		pause: function() {
			pause();
		},
		onVolumeChange: function(vol) {
			onVolumeChange(vol);
		},
		changeHltMode: function(mode) {
			changeHltMode(mode);
		},
		save: function(isMP3) {
			save(isMP3);
		}
	});
	
	window.addEventListener("load", setHighlight);
	window.addEventListener("load", setManualScroll);

	return FlMMLWriter;
}();