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
	var macroDelayTimeoutID;
	var mmlDLUrl, myxhr;
	var imprtComment = "";
	var barMousedown = false;
	var barOfsTop;
	var touchOfs;
	var mmlTxtBlock = [];
	var mmlEmptyIdxList = [];
	var mmlTxtPrevLength = 0;
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
	var mp3worker = new Worker("js/main/encoder.js");
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

		// console.log(recData);
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

		// console.log(recData);
		
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
		// console.log(e);

		elm.value = e.target.result;
		// elmHlt.innerHTML = highlightFlMML2(e.target.result, true);
		var editorHltDelayed_tmp = editorHltDelayed;
		editorHltDelayed = true;
		changeHltMode(false, {target: elm});
		editorHltDelayed = editorHltDelayed_tmp;
		updateScrBar();
	}

	function setMMLText(txt) {
		var elm = document.getElementById("mmltxt");
		var elmHlt = document.getElementById("mmlhighlight");

		elm.value = txt;
		var editorHltDelayed_tmp = editorHltDelayed;
		editorHltDelayed = true;
		changeHltMode(false, {target: elm});
		editorHltDelayed = editorHltDelayed_tmp;
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
			// console.log("complete! smpls: "+ processCount);
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
			flmml = new FlMMLonHTML5("flmmlworker.js");
			flmml.oncompilecomplete = onCompileComplete;
			flmml.onsyncinfo = onSyncInfo;
			flmml.onbuffering = onBuffering;
			flmml.oncomplete = onComplete;
			isFirst = false;
			// console.log(flmml);
			// flmmlDefaultAudioProcess = flmml.onAudioProcessBinded;
		}else{
			flmml = new FlMMLonHTML5("flmmlworker.js",saveSampleRate,saveBufferSize);
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

	function highlightFlMML3(text) {
		mmlTxtBlock.push({

		});
	}

	function txtBlock_shiftStart(txtBlock, offset) {
		var ret = txtBlock;
		do {
			// console.log(txtBlock);
			ret.start += offset;
			ret = ret.next;
			// console.log(txtBlock);
		} while(ret);
	}

	function highlightFlMML3_pre2(evt_input, elm_hlt) {
		if(evt_input) {
			var newLength = evt_input.target.value.length;
			var diffLength = newLength - mmlTxtPrevLength;
			var pos_start = evt_input.target.selectionStart;
			var input_txt = evt_input.target.value;
			if(newLength <= 0) {
				elm_hlt.innerHTML = "";
				mmlTxtBlock.length = 0;
				return;
			}
			if(mmlTxtBlock.length > 0) {
				var new_txt = input_txt.substr(pos_start - diffLength, diffLength);
				console.log(new_txt + " pos_start:" + pos_start);
				if(diffLength > 0 && pos_start == 1) {
					pos_start++;
				}
				for(var i=mmlTxtBlock.length-1; i>=0; i--) {
					if(!mmlTxtBlock[i].isPerform) {
						continue;
					}
					if(pos_start - diffLength > mmlTxtBlock[i].start &&
					pos_start <= mmlTxtBlock[i].start + mmlTxtBlock[i].len + diffLength) {
						var txtBlock_parent = mmlTxtBlock[i].elm.parentNode;
						var new_len = mmlTxtBlock[i].len + diffLength;
						console.log(mmlTxtBlock[i].elm.innerText);
						if(mmlTxtBlock[i].isPerform &&
						new_len > 0 && mmlTxtBlock[i].searchStr instanceof RegExp) {
							// var txtBlock_parent = mmlTxtBlock[i].elm.parentNode;
							var ret = new_txt.search(mmlTxtBlock[i].searchStr);
							if(ret == -1) {		// グループに含まれる -> グループに新規文字を追加
								console.log("here0-1! st:" + mmlTxtBlock[i].start);
								// console.log(mmlTxtBlock[i].len);
								mmlTxtBlock[i].len += diffLength;
								var str1 = input_txt.substr(mmlTxtBlock[i].start, mmlTxtBlock[i].len);
								console.log(str1);
								mmlTxtBlock[i].elm.innerText = str1;
								console.log(mmlTxtBlock[i].next);
								if(typeof mmlTxtBlock[i].nextIdx == "number") {
									var next_idx = mmlTxtBlock[i].nextIdx;
									console.log(next_idx);
									while(typeof next_idx == "number") {
										mmlTxtBlock[next_idx].start += diffLength;
										next_idx = mmlTxtBlock[next_idx].nextIdx;
									}
									// txtBlock_shiftStart(mmlTxtBlock[i].next, diffLength);
									console.log(mmlTxtBlock[i].next);
								}
								break;
							}
						}
						if(new_len <= 0) {
							console.log("here-del");
							console.log("remove: ");
							console.log(mmlTxtBlock[i]);
							txtBlock_parent.removeChild(mmlTxtBlock[i].elm);
							mmlTxtBlock[i].len = 0;
							mmlTxtBlock[i].isPerform = false;
							/* var next_idx = mmlTxtBlock[i].nextIdx;
							mmlTxtBlock.splice(i, 1);
							while(typeof next_idx == "number") {
								// mmlTxtBlock[next_idx].start += diffLength;
								mmlTxtBlock[next_idx].start += diffLength;
								if(mmlTxtBlock[next_idx].nextIdx >= del_idx) {
									next_idx = --mmlTxtBlock[next_idx].nextIdx;
								} else {
									next_idx = mmlTxtBlock[next_idx].nextIdx;
								}
							} */
							var next_idx = mmlTxtBlock[i].nextIdx;
							while(typeof next_idx == "number") {
								// mmlTxtBlock[next_idx].start += diffLength;
								mmlTxtBlock[next_idx].start += diffLength;
								next_idx = mmlTxtBlock[next_idx].nextIdx;
							}
							break;
						}
						console.log("here0-!prev " + mmlTxtBlock[i].next);
						if(typeof mmlTxtBlock[i].nextIdx != "number") {	// 次グループなし -> 末尾に追加
							var str1 = input_txt.substr(mmlTxtBlock[i].start, mmlTxtBlock[i].len + diffLength);
							var ret_hlt = highlightFlMML2(str1, false);
							console.log(str1);
							ret_hlt[0].start += mmlTxtBlock[i].start;
							ret_hlt[0].prev = mmlTxtBlock[i].prev;
							ret_hlt[0].isPerform = true;
							// mmlTxtBlock.push(ret_hlt[0]);
							txtBlock_parent.replaceChild(ret_hlt[0].elm, mmlTxtBlock[i].elm);
							// mmlTxtBlock[i] = ret_hlt[0];
							// mmlTxtBlock[i].next = ret_hlt[0];
							for(var j=1; j<ret_hlt.length; j++) {
								ret_hlt[j].start += mmlTxtBlock[i].start;
								ret_hlt[j].isPerform = true;
								console.log(ret_hlt[j]);
								mmlTxtBlock.push(ret_hlt[j]);
								ret_hlt[j-1].nextIdx = mmlTxtBlock.length-1;
								txtBlock_parent.appendChild(ret_hlt[j].elm);
							}
							mmlTxtBlock[mmlTxtBlock.length-1].nextIdx = null;
							mmlTxtBlock[i] = ret_hlt[0];
						}/* else if(typeof mmlTxtBlock[i].nextIdx == "number" && !mmlTxtBlock[mmlTxtBlock[i].nextIdx].isPerform) { // 次グループあり、動いてない -> 進めてcontinue
							var blk_next = mmlTxtBlock[mmlTxtBlock[i].nextIdx];
							var tmp_idx = mmlTxtBlock[i].nextIdx;
							while(blk_next && !blk_next.isPerform) {
								mmlEmptyIdxList.push(tmp_idx);
								tmp_idx = blk_next.nextIdx;
								blk_next = mmlTxtBlock[blk_next.nextIdx];
							}
							console.log(mmlEmptyIdxList);
							console.log(mmlTxtBlock);
							// var blk_next_idx = blk_next.nextIdx || null;
							if(blk_next && typeof blk_next.nextIdx == "number") {
								mmlTxtBlock[i].nextIdx = tmp_idx;
							} else {
								mmlTxtBlock[i].nextIdx = null;
							}
							i++;
							continue;
						} */ else {					// 次グループあり -> 再評価
							// var blk_next_cp = JSON.parse(JSON.stringify(mmlTxtBlock[i]));
							var blk_next = mmlTxtBlock[mmlTxtBlock[i].nextIdx];
							var tmp_idx = mmlTxtBlock[i].nextIdx;
							while(blk_next && !blk_next.isPerform) {
								mmlEmptyIdxList.push(tmp_idx);
								tmp_idx = blk_next.nextIdx;
								blk_next = mmlTxtBlock[tmp_idx];
								mmlTxtBlock[i].nextIdx = tmp_idx;
							}
							console.log(mmlEmptyIdxList);
							console.log(tmp_idx);
							// var blk_next = mmlTxtBlock[mmlTxtBlock[i].nextIdx];
							if(typeof tmp_idx != "number") {
								var str1 = input_txt.substr(mmlTxtBlock[i].start, mmlTxtBlock[i].len + diffLength);
								var ret_hlt = highlightFlMML2(str1, false);
								console.log(str1);
								ret_hlt[0].start += mmlTxtBlock[i].start;
								ret_hlt[0].prev = mmlTxtBlock[i].prev;
								ret_hlt[0].isPerform = true;
								// mmlTxtBlock.push(ret_hlt[0]);
								txtBlock_parent.replaceChild(ret_hlt[0].elm, mmlTxtBlock[i].elm);
								// mmlTxtBlock[i] = ret_hlt[0];
								// mmlTxtBlock[i].next = ret_hlt[0];
								for(var j=1; j<ret_hlt.length; j++) {
									ret_hlt[j].start += mmlTxtBlock[i].start;
									ret_hlt[j].isPerform = true;
									console.log(ret_hlt[j]);
									mmlTxtBlock.push(ret_hlt[j]);
									ret_hlt[j-1].nextIdx = mmlTxtBlock.length-1;
									txtBlock_parent.appendChild(ret_hlt[j].elm);
								}
								mmlTxtBlock[mmlTxtBlock.length-1].nextIdx = null;
								mmlTxtBlock[i] = ret_hlt[0];
								break;
							}
							var blk_next_idx = blk_next.nextIdx;
							var blk_next_next = mmlTxtBlock[blk_next.nextIdx];
							while(blk_next_next && !blk_next_next.isPerform) {
								mmlEmptyIdxList.push(blk_next_idx);
								blk_next_idx = blk_next_next.nextIdx;
								blk_next_next = mmlTxtBlock[blk_next_idx];
								mmlTxtBlock[mmlTxtBlock[i].nextIdx].nextIdx = blk_next_next.nextIdx;
							}
							var blk_next_next_idx;
							console.log(blk_next_idx);
							if(typeof blk_next_idx == "number") {
								// mmlTxtBlock[i].nextIdx = blk_next.nextIdx;
								// mmlTxtBlock[i].nextIdx = tmp_idx;
								blk_next_next_idx = mmlTxtBlock[blk_next_idx].nextIdx;
							} else {
								mmlTxtBlock[mmlTxtBlock[i].nextIdx].nextIdx = null;
								blk_next_next_idx = null;
							}
							console.log("next_next: " + blk_next_next_idx);
							// var str1 = mmlTxtBlock[i].elm.innerText;
							var str1 = input_txt.substr(mmlTxtBlock[i].start, mmlTxtBlock[i].len + diffLength);
							// var str2 = new_txt;
							var str2 = blk_next.elm.innerText;
							console.log("next! " + mmlTxtBlock[i].len + ":" + str1 + "," + diffLength + ":" + str2);
							console.log(blk_next);
							var ret_hlt = highlightFlMML2(str1 + str2, false);
							ret_hlt[0].start += mmlTxtBlock[i].start;
							ret_hlt[0].prev = mmlTxtBlock[i].prev;
							ret_hlt[0].isPerform = true;
							if(mmlTxtBlock[i].prev) {
								mmlTxtBlock[i].prev.next = ret_hlt[0];
							}
							// mmlTxtBlock[i] = ret_hlt[0];
							// mmlTxtBlock.push(ret_hlt[0]);
							txtBlock_parent.replaceChild(ret_hlt[0].elm, mmlTxtBlock[i].elm);
							/* var blk_next_idx = mmlTxtBlock.indexOf(blk_next);
							console.log("blk_next_idx :" + blk_next_idx);
							mmlTxtBlock[blk_next_idx] = mmlTxtBlock[i];
							mmlTxtBlock[blk_next_idx].prev = blk_next; */
							// txtBlock_parent.appendChild(ret_hlt[0].elm);
							// mmlTxtBlock[i].next = ret_hlt[0];
							//var next_elm = mmlTxtBlock[i].next.elm;
							// mmlTxtBlock[i] = ret_hlt[0];
							// mmlTxtBlock[i].next = ret_hlt[0];
							for(var j=1; j<ret_hlt.length; j++) {
								// ret_hlt[j].start += (mmlTxtBlock[i].start + mmlTxtBlock[i].len);
								// ret_hlt[j-1].nextIdx = mmlTxtBlock.length-1;
								ret_hlt[j].start += mmlTxtBlock[i].start;
								ret_hlt[j].isPerform = true;
								mmlTxtBlock.push(ret_hlt[j]);
								ret_hlt[j-1].nextIdx = mmlTxtBlock.length-1;
								// mmlTxtBlock[i].elm.parentNode.insertBefore(ret_hlt[j].elm, next_elm.nextSibling);
								if(typeof blk_next_idx == "number") {
									console.log(mmlTxtBlock[blk_next_idx]);
									txtBlock_parent.insertBefore(ret_hlt[j].elm, mmlTxtBlock[blk_next_idx].elm);
								} else {
									txtBlock_parent.appendChild(ret_hlt[j].elm);
								}
								console.log(ret_hlt[j].elm.innerText);
							}
							// mmlTxtBlock[mmlTxtBlock.length-1].nextIdx = blk_next_idx;
							var next_idx = null;
							if(typeof mmlTxtBlock[i].nextIdx == "number") {
								console.log("remove: " + mmlTxtBlock[i].nextIdx);
								txtBlock_parent.removeChild(mmlTxtBlock[mmlTxtBlock[i].nextIdx].elm);
								// var del_idx = mmlTxtBlock.indexOf(mmlTxtBlock[i].next);
								var del_idx = mmlTxtBlock[i].nextIdx;
								mmlTxtBlock[i] = ret_hlt[0];
								/*
								if(blk_next_next_idx && mmlTxtBlock[blk_next_next_idx].nextIdx >= del_idx) {
									mmlTxtBlock[blk_next_next_idx].nextIdx--;
								}
								mmlTxtBlock[mmlTxtBlock.length-1].nextIdx = blk_next_idx;
								*/
								// mmlTxtBlock[mmlTxtBlock.length-1].nextIdx = blk_next_idx;
								//mmlTxtBlock[mmlTxtBlock.length-1].nextIdx = mmlTxtBlock[del_idx].nextIdx;
								/*
								if(mmlTxtBlock[i].nextIdx >= del_idx) {
									console.log("decl: " + mmlTxtBlock[i].nextIdx);
									mmlTxtBlock[i].nextIdx--;
								}
								*/
								// mmlTxtBlock[i].nextIdx = mmlTxtBlock.length-1;
								mmlTxtBlock[mmlTxtBlock.length-1].nextIdx = blk_next_idx;
								// next_idx = mmlTxtBlock[mmlTxtBlock.length-1].nextIdx;
								next_idx = mmlTxtBlock[i].nextIdx;
								mmlTxtBlock[i].nextIdx = mmlTxtBlock.length-1;
								console.log("nextIdx:" + mmlTxtBlock[i].nextIdx);
								mmlTxtBlock[del_idx].isPerform = false;
								if(next_idx >= del_idx) {
									console.log("decl: " + next_idx);
									// mmlTxtBlock[mmlTxtBlock.length-1].nextIdx--;
									// mmlTxtBlock[i].nextIdx--;
									// next_idx--;
								}
								
								// mmlTxtBlock.splice(del_idx, 1);
							}
							console.log(next_idx);
							console.log(mmlTxtBlock);
							/* while(typeof next_idx == "number") {
								// mmlTxtBlock[next_idx].start += diffLength;
								console.log(next_idx);
								console.log("del: " + del_idx);
								mmlTxtBlock[next_idx].start += diffLength;
								if(typeof mmlTxtBlock[i].nextIdx == "number"){
									if(mmlTxtBlock[next_idx].nextIdx >= del_idx) {
										next_idx = --mmlTxtBlock[next_idx].nextIdx;
									} else {
										next_idx = mmlTxtBlock[next_idx].nextIdx;
									}
								}
							} */
							// mmlTxtBlock[mmlTxtBlock.length-1].next = blk_next_next;
							// if(typeof blk_next_next_idx == "number") {
							//	mmlTxtBlock[mmlTxtBlock.length-1].nextIdx = blk_next_next_idx;
								// txtBlock_shiftStart(mmlTxtBlock[blk_next_next_idx], diffLength);
							// }
						}
						break;
					}
				}
			} else {
				var ret_hlt = highlightFlMML2(input_txt, true);
				ret_hlt[0].isPerform = true;
				mmlTxtBlock.push(ret_hlt[0]);
				for(var j=1; j<ret_hlt.length; j++) {
					ret_hlt[j].isPerform = true;
					ret_hlt[j-1].nextIdx = j;
					mmlTxtBlock.push(ret_hlt[j]);
				}
				mmlTxtBlock[mmlTxtBlock.length-1].nextIdx = null;
				for(var j=0; j<mmlTxtBlock.length; j++) {
					elm_hlt.appendChild(mmlTxtBlock[j].elm);
				}
			}
			console.log(mmlTxtBlock);
			mmlTxtPrevLength = newLength;
		}
	}

	function highlightFlMML3_pre(evt_input, elm_hlt) {
		if(evt_input) {
			console.log(evt_input);
			var pos_start = evt_input.target.selectionStart;
			var newLength = evt_input.target.value.length;
			var diffLength = newLength - mmlTxtPrevLength;
			var input_txt = evt_input.target.value;
			console.log("pos_start: " + pos_start + ", newLength: " + newLength + ", diffLength: " + diffLength);
			if(mmlTxtBlock.length > 0) {
				var isMatch = false;
				var new_txt = input_txt.substr(pos_start - diffLength, diffLength);
				if(pos_start != 0) {	// 先頭以外へ追記 -> 前のグループに含まれるか
					console.log("normal!");
					for(var i=mmlTxtBlock.length-1; i>=0; i--) {
						if(pos_start > mmlTxtBlock[i].start + 1 &&
						pos_start <= mmlTxtBlock[i].start + mmlTxtBlock[i].len + diffLength) {
						// if(!mmlTxtBlock[i].next) {
							var txtBlock_parent = mmlTxtBlock[i].elm.parentNode;
							if(typeof mmlTxtBlock[i].searchStr != "number") {
								var ret = new_txt.search(mmlTxtBlock[i].searchStr);
								if(ret == -1) {		// グループに含まれる -> グループに新規文字を追加
									console.log("here0-1! st:" + mmlTxtBlock[i].start);
									// console.log(mmlTxtBlock[i].len);
									mmlTxtBlock[i].len += diffLength;
									var str1 = input_txt.substr(mmlTxtBlock[i].start, mmlTxtBlock[i].len);
									console.log(str1);
									mmlTxtBlock[i].elm.innerText = str1;
									console.log(mmlTxtBlock[i].next);
									if(mmlTxtBlock[i].next) {
										console.log(mmlTxtBlock[i].next);
										txtBlock_shiftStart(mmlTxtBlock[i].next, diffLength);
									}
								} else {			// グループに含まれない -> 次グループを再評価
									console.log("here0-!prev");
									// var str1 = input_txt.substr(mmlTxtBlock[i].start, mmlTxtBlock[i].len + diffLength);
									// var str1 = new_txt
									// var ret_hlt = highlightFlMML2(str1, true);
									// console.log(str1);
									// if(ret_hlt.length) {
										if(!mmlTxtBlock[i].next) {	// 次グループなし -> 末尾に追加
											var str1 = input_txt.substr(mmlTxtBlock[i].start, mmlTxtBlock[i].len + diffLength);
											var ret_hlt = highlightFlMML2(str1, true);
											console.log(str1);
											ret_hlt[0].start += mmlTxtBlock[i].start;
											ret_hlt[0].prev = mmlTxtBlock[i].prev;
											// mmlTxtBlock.push(ret_hlt[0]);
											txtBlock_parent.replaceChild(ret_hlt[0].elm, mmlTxtBlock[i].elm);
											// mmlTxtBlock[i] = ret_hlt[0];
											// mmlTxtBlock[i].next = ret_hlt[0];
											for(var j=1; j<ret_hlt.length; j++) {
												ret_hlt[j].start += mmlTxtBlock[i].start;
												console.log(ret_hlt[j]);
												mmlTxtBlock.push(ret_hlt[j]);
												txtBlock_parent.appendChild(ret_hlt[j].elm);
											}
											mmlTxtBlock[i] = ret_hlt[0];
										} else {					// 次グループあり -> 再評価
											var blk_next = mmlTxtBlock[i].next;
											var blk_next_next = mmlTxtBlock[i].next.next;
											var str1 = mmlTxtBlock[i].elm.innerText;
											var str2 = new_txt;
											var str3 = blk_next.elm.innerText;
											console.log("next! " + str1 + str2 + str3);
											console.log(blk_next);
											var ret_hlt = highlightFlMML2(str1 + str2 + str3, true);
											ret_hlt[0].start += mmlTxtBlock[i].start;
											ret_hlt[0].prev = mmlTxtBlock[i].prev;
											mmlTxtBlock[i].prev.next = ret_hlt[0].start;
											// mmlTxtBlock[i] = ret_hlt[0];
											// mmlTxtBlock.push(ret_hlt[0]);
											txtBlock_parent.replaceChild(ret_hlt[0].elm, mmlTxtBlock[i].elm);
											/* var blk_next_idx = mmlTxtBlock.indexOf(blk_next);
											console.log("blk_next_idx :" + blk_next_idx);
											mmlTxtBlock[blk_next_idx] = mmlTxtBlock[i];
											mmlTxtBlock[blk_next_idx].prev = blk_next; */
											// txtBlock_parent.appendChild(ret_hlt[0].elm);
											// mmlTxtBlock[i].next = ret_hlt[0];
											var next_elm = mmlTxtBlock[i].next.elm;
											// mmlTxtBlock[i] = ret_hlt[0];
											// mmlTxtBlock[i].next = ret_hlt[0];
											for(var j=1; j<ret_hlt.length; j++) {
												ret_hlt[j].start += (mmlTxtBlock[i].start + mmlTxtBlock[i].len);
												mmlTxtBlock.push(ret_hlt[j]);
												// mmlTxtBlock[i].elm.parentNode.insertBefore(ret_hlt[j].elm, next_elm.nextSibling);
												txtBlock_parent.insertBefore(ret_hlt[j].elm, next_elm);
											}
											txtBlock_parent.removeChild(mmlTxtBlock[i].next.elm);
											var del_idx = mmlTxtBlock.indexOf(mmlTxtBlock[i].next);
											mmlTxtBlock[i] = ret_hlt[0];
											mmlTxtBlock.splice(del_idx, 1);
											mmlTxtBlock[mmlTxtBlock.length-1].next = blk_next_next;
											txtBlock_shiftStart(blk_next_next, diffLength);
										}
									// }
								}
							} else {	// 正規表現なし -> 新規グループを末尾に追加
								console.log("here0n new_txt: " + new_txt);
								// var ret_hlt = highlightFlMML2(new_txt, true);
								// if(ret_hlt.length) {
									var new_txt_len = new_txt.length;
									if(!mmlTxtBlock[i].next) {	// 次グループなし -> 末尾に追加
										console.log("no-next")
										var ret_hlt = highlightFlMML2(new_txt, true);
										//ret_hlt[0].start += (mmlTxtBlock[i].start + mmlTxtBlock[i].len);
										ret_hlt[0].start += (mmlTxtBlock[i].start + new_txt_len);
										ret_hlt[0].prev = mmlTxtBlock[i];
										mmlTxtBlock.push(ret_hlt[0]);
										txtBlock_parent.appendChild(ret_hlt[0].elm);
										mmlTxtBlock[i].next = ret_hlt[0];
										for(var j=1; j<ret_hlt.length; j++) {
											// ret_hlt[j].start += (mmlTxtBlock[i].start + mmlTxtBlock[i].len);
											ret_hlt[j].start += (mmlTxtBlock[i].start + new_txt_len);
											mmlTxtBlock.push(ret_hlt[j]);
											mmlTxtBlock[i].elm.parentNode.appendChild(ret_hlt[j].elm);
										}
									} else {					// 次グループあり -> 再評価
										console.log("next");
										var start_offset = mmlTxtBlock[i].start;
										var blk_next = mmlTxtBlock[i].next;
										var blk_next_next = mmlTxtBlock[i].next.next;
										console.log(mmlTxtBlock[i].elm);
										var str1 = mmlTxtBlock[i].elm.innerText;
										var str2 = mmlTxtBlock[i].next.elm.innerText;
										console.log(str1 + new_txt + str2);
										var new_txt_len = new_txt.length;
										var ret_hlt = highlightFlMML2(str1 + new_txt + str2, true);
										// ret_hlt[0].start += (mmlTxtBlock[i].next.start + mmlTxtBlock[i].len);
										ret_hlt[0].start += start_offset;
										ret_hlt[0].prev = mmlTxtBlock[i].prev;
										// mmlTxtBlock[i] = ret_hlt[0];
										console.log(ret_hlt[0]);
										// blk_next.elm.parentNode.insertBefore(ret_hlt[0].elm, blk_next.elm);
										// console.log(mmlTxtBlock[i].elm);
										// console.log(blk_next);
										console.log();
										txtBlock_parent.replaceChild(ret_hlt[0].elm, mmlTxtBlock[i].elm);
										// txtBlock_parent.removeChild(mmlTxtBlock[i].next.elm);
										
										// mmlTxtBlock[mmlTxtBlock.indexOf(blk_next)] = ret_hlt[0];
										// mmlTxtBlock[i] = ret_hlt[0];
										// mmlTxtBlock[i] = ret_hlt[0];
										// console.log(blk_next);
										// mmlTxtBlock[i].next = ret_hlt[0];
										for(var j=1; j<ret_hlt.length; j++) {
											ret_hlt[j].start += (start_offset);
											// ret_hlt[j].start += (mmlTxtBlock[i].start + mmlTxtBlock[i].len);
											mmlTxtBlock.push(ret_hlt[j]);
											// blk_next.elm.parentNode.insertBefore(ret_hlt[j].elm, blk_next.elm);
											txtBlock_parent.insertBefore(ret_hlt[j].elm, ret_hlt[j-1].elm.nextSibling);
											// txtBlock_parent.insertBefore(ret_hlt[j].elm, mmlTxtBlock[i].next.elm);
											// txtBlock_parent.insertBefore(ret_hlt[j].elm, ret_hlt[0].elm);
										}
										txtBlock_parent.removeChild(mmlTxtBlock[i].next.elm);
										var del_idx = mmlTxtBlock.indexOf(mmlTxtBlock[i].next);
										mmlTxtBlock.splice(del_idx, 1);
										mmlTxtBlock[i] = ret_hlt[0];
										if(blk_next_next) {
											ret_hlt[ret_hlt.length-1].next = blk_next_next;
											blk_next_next.prev = ret_hlt[ret_hlt.length-1];
										}
										// mmlTxtBlock[i].next = ret_hlt[0];
										// mmlTxtBlock[mmlTxtBlock.length-1].next = blk_next;
										// txtBlock_shiftStart(mmlTxtBlock[i].next, diffLength);
									}
									/*
									for(var j=0; j<ret_hlt.length; j++) {
										// ret_hlt[j].start += (mmlTxtBlock[i].start + mmlTxtBlock[i].len);
										ret_hlt[j].start += mmlTxtBlock[i].start;
										mmlTxtBlock.push(ret_hlt[j]);
										mmlTxtBlock[i].elm.parentNode.appendChild(ret_hlt[j].elm);
									}
									mmlTxtBlock[i].next = ret_hlt[0];
									*/
								// }
							}
							break;
						}
					}
				} else {						// 先頭へ追記 -> 次グループに含まれるか
					console.log("head!");
					for(var i=mmlTxtBlock.length-1; i>=0; i--) {
						if(pos_start > mmlTxtBlock[i].start &&
						pos_start <= mmlTxtBlock[i].start + mmlTxtBlock[i].len + diffLength) {
							if(typeof mmlTxtBlock[i].searchStr != "number") {
								var ret = new_txt.search(mmlTxtBlock[i].searchStr);
								if(ret == -1) {		// 次グループに含まれる -> 次グループに新規文字を追加
									console.log("here1-1!");
									// console.log(mmlTxtBlock[i].len);
									mmlTxtBlock[i].len += diffLength;
									var str1 = input_txt.substr(mmlTxtBlock[i].start, mmlTxtBlock[i].len);
									console.log(str1);
									mmlTxtBlock[i].elm.innerText = str1;
									if(mmlTxtBlock[i].next) {
										console.log(mmlTxtBlock[i].next);
										txtBlock_shiftStart(mmlTxtBlock[i].next, diffLength);
									}
								} else {			// 次グループに含まれない -> 新規グループを追加
									console.log("here1-else");
									// var str1 = input_txt.substr(mmlTxtBlock[i].start, mmlTxtBlock[i].len + diffLength);
									var str1_start = mmlTxtBlock[i].start;
									var str1_len = mmlTxtBlock[i].len;
									var txtBlock_next = mmlTxtBlock[i].next;
									var txtBlock_parent = mmlTxtBlock[i].elm.parentNode;
									if(txtBlock_next) {	// 次グループがある -> 次グループを含めて再評価
										console.log("here1-else-next");
										console.log(mmlTxtBlock[i]);
										var str1 = input_txt.substr(mmlTxtBlock[i].start, mmlTxtBlock[i].len + diffLength);
										var new_txt_next = str1 + txtBlock_next.elm.innerText;
										console.log("new_txt_next: " + new_txt_next);
										var del_idx = mmlTxtBlock.indexOf(mmlTxtBlock[i].next);
										// txtBlock_next = mmlTxtBlock[i].next;
										console.log(txtBlock_next);
										txtBlock_next.elm.parentNode.removeChild(txtBlock_next.elm);
										var ret_hlt = highlightFlMML2(new_txt_next, true);
										if(ret_hlt.length) {
											var elm_txtBlock_next = mmlTxtBlock[i].elm.nextSibling;
											mmlTxtBlock[i].elm.parentNode.removeChild(mmlTxtBlock[i].elm);
											// ret_hlt[0].start += (str1_start + str1_len);
											ret_hlt[0].start = str1_start;
											mmlTxtBlock[i] = ret_hlt[0];
											str1_len = ret_hlt[0].elm.innerText.length;
											elm_txtBlock_next.parentNode.insertBefore(ret_hlt[0].elm, elm_txtBlock_next);
											for(var j=1; j<ret_hlt.length; j++) {
												// ret_hlt[j].start += (str1_start + str1_len);
												ret_hlt[j].start += str1_start;
												mmlTxtBlock.push(ret_hlt[j]);
												mmlTxtBlock[i].elm.parentNode.insertBefore(ret_hlt[j].elm, elm_txtBlock_next);
											}
											// txtBlock_shiftStart(mmlTxtBlock[i].next, diffLength);
											//txtBlock_shiftStart(txtBlock_next, diffLength);
											// mmlTxtBlock[i].next.elm.parentNode.removeChild(mmlTxtBlock[i].next.elm);
											// mmlTxtBlock[i].next = ret_hlt[0];
											// var del_idx = mmlTxtBlock.indexOf(mmlTxtBlock[i].next);
											// mmlTxtBlock[mmlTxtBlock.length-1].next = mmlTxtBlock[i].next;
											mmlTxtBlock[mmlTxtBlock.length-1].next = txtBlock_next.next;
											txtBlock_shiftStart(txtBlock_next, diffLength);
											// mmlTxtBlock[i].next = ret_hlt[0];
											console.log(mmlTxtBlock[mmlTxtBlock.length-1]);
											mmlTxtBlock.splice(del_idx, 1);
											//var del_idx = mmlTxtBlock.indexOf(mmlTxtBlock[i].next);
											//mmlTxtBlock.splice(del_idx, 1);
											// mmlTxtBlock[i].elm.parentNode.removeChild(mmlTxtBlock[i].elm);
											// del_idx = 
										}
									} else {		// 次グループがない -> グループを再評価
										console.log("here1-else-!next");
										var str1 = input_txt.substr(mmlTxtBlock[i].start, mmlTxtBlock[i].len + diffLength);
										console.log("str1: " + str1);
										// var del_idx = mmlTxtBlock.indexOf(mmlTxtBlock[i].next);
										// txtBlock_next = mmlTxtBlock[i].next;
										// mmlTxtBlock[i].next.elm.parentNode.removeChild(mmlTxtBlock[i].next.elm);
										var ret_hlt = highlightFlMML2(str1, true);
										if(ret_hlt.length) {
											var elm_txtBlock_pn = mmlTxtBlock[i].elm.parentNode;
											mmlTxtBlock[i].elm.parentNode.removeChild(mmlTxtBlock[i].elm);
											// ret_hlt[0].start += (str1_start + str1_len);
											ret_hlt[0].start = str1_start;
											mmlTxtBlock[i] = ret_hlt[0];
											str1_len = ret_hlt[0].elm.innerText.length;
											// elm_txtBlock_next.parentNode.insertBefore(ret_hlt[0].elm, elm_txtBlock_next);
											elm_txtBlock_pn.appendChild(ret_hlt[0].elm);
											for(var j=1; j<ret_hlt.length; j++) {
												// ret_hlt[j].start += (str1_start + str1_len);
												ret_hlt[j].start += str1_start;
												mmlTxtBlock.push(ret_hlt[j]);
												// mmlTxtBlock[i].elm.parentNode.insertBefore(ret_hlt[j].elm, elm_txtBlock_next);
												elm_txtBlock_pn.appendChild(ret_hlt[j].elm);
											}
											// mmlTxtBlock[mmlTxtBlock.length-1].next = txtBlock_next;
											// txtBlock_shiftStart(txtBlock_next, diffLength);
											
											console.log(mmlTxtBlock[mmlTxtBlock.length-1]);
											// mmlTxtBlock.splice(del_idx, 1);
										}
									}
								}
							} else {
								console.log("what!");
								console.log("here1-else");
								// var str1 = input_txt.substr(mmlTxtBlock[i].start, mmlTxtBlock[i].len + diffLength);
								var str1_start = mmlTxtBlock[i].start;
								var str1_len = mmlTxtBlock[i].len;
								var txtBlock_next = mmlTxtBlock[i].next;
								var txtBlock_parent = mmlTxtBlock[i].elm.parentNode;
								if(txtBlock_next) {	// 次グループがある -> 次グループを含めて再評価
									console.log("here1-else-next");
									console.log(mmlTxtBlock[i]);
									var str1 = input_txt.substr(mmlTxtBlock[i].start, mmlTxtBlock[i].len + diffLength);
									var new_txt_next = str1 + txtBlock_next.elm.innerText;
									console.log("new_txt_next: " + new_txt_next);
									var del_idx = mmlTxtBlock.indexOf(mmlTxtBlock[i].next);
									// txtBlock_next = mmlTxtBlock[i].next;
									console.log(mmlTxtBlock[i].next.elm);
									// mmlTxtBlock[i].next.elm.parentNode.removeChild(mmlTxtBlock[i].next.elm);
									txtBlock_parent.removeChild(mmlTxtBlock[i].next.elm);
									var ret_hlt = highlightFlMML2(new_txt_next, true);
									if(ret_hlt.length) {
										var elm_txtBlock_next = mmlTxtBlock[i].elm.nextSibling;
										// console.log(elm_txtBlock_next.nextSibling);
										mmlTxtBlock[i].elm.parentNode.removeChild(mmlTxtBlock[i].elm);
										console.log(elm_txtBlock_next);
										// ret_hlt[0].start += (str1_start + str1_len);
										ret_hlt[0].start = str1_start;
										mmlTxtBlock[i] = ret_hlt[0];
										str1_len = ret_hlt[0].elm.innerText.length;
										if(elm_txtBlock_next) {
											elm_txtBlock_next.parentNode.insertBefore(ret_hlt[0].elm, elm_txtBlock_next);
											for(var j=1; j<ret_hlt.length; j++) {
												// ret_hlt[j].start += (str1_start + str1_len);
												ret_hlt[j].start += str1_start;
												mmlTxtBlock.push(ret_hlt[j]);
												mmlTxtBlock[i].elm.parentNode.insertBefore(ret_hlt[j].elm, elm_txtBlock_next);
											}
											// txtBlock_shiftStart(mmlTxtBlock[i].next, diffLength);
											//txtBlock_shiftStart(txtBlock_next, diffLength);
											// mmlTxtBlock[i].next.elm.parentNode.removeChild(mmlTxtBlock[i].next.elm);
											// mmlTxtBlock[i].next = ret_hlt[0];
											// var del_idx = mmlTxtBlock.indexOf(mmlTxtBlock[i].next);
											// mmlTxtBlock[mmlTxtBlock.length-1].next = mmlTxtBlock[i].next;
											mmlTxtBlock[mmlTxtBlock.length-1].next = txtBlock_next.next;
											txtBlock_shiftStart(txtBlock_next, diffLength);
										} else {
											console.log(mmlTxtBlock[i]);
											console.log(txtBlock_parent);
											txtBlock_parent.appendChild(ret_hlt[0].elm);
											for(var j=1; j<ret_hlt.length; j++) {
												// ret_hlt[j].start += (str1_start + str1_len);
												ret_hlt[j].start += str1_start;
												mmlTxtBlock.push(ret_hlt[j]);
												txtBlock_parent.appendChild(ret_hlt[j].elm);
											}
											// mmlTxtBlock[mmlTxtBlock.length-1].next = null;
											txtBlock_shiftStart(txtBlock_next, diffLength);
										}
										// mmlTxtBlock[i].next = ret_hlt[0];
										console.log(mmlTxtBlock[mmlTxtBlock.length-1]);
										mmlTxtBlock.splice(del_idx, 1);
										//var del_idx = mmlTxtBlock.indexOf(mmlTxtBlock[i].next);
										//mmlTxtBlock.splice(del_idx, 1);
										// mmlTxtBlock[i].elm.parentNode.removeChild(mmlTxtBlock[i].elm);
										// del_idx = 
									}
								} else {		// 次グループがない -> グループを再評価
									console.log("here1-else-!next");
									var str1 = input_txt.substr(mmlTxtBlock[i].start, mmlTxtBlock[i].len + diffLength);
									console.log("str1: " + str1);
									// var del_idx = mmlTxtBlock.indexOf(mmlTxtBlock[i].next);
									// txtBlock_next = mmlTxtBlock[i].next;
									// mmlTxtBlock[i].next.elm.parentNode.removeChild(mmlTxtBlock[i].next.elm);
									var ret_hlt = highlightFlMML2(str1, true);
									if(ret_hlt.length) {
										var elm_txtBlock_pn = mmlTxtBlock[i].elm.parentNode;
										mmlTxtBlock[i].elm.parentNode.removeChild(mmlTxtBlock[i].elm);
										// ret_hlt[0].start += (str1_start + str1_len);
										ret_hlt[0].start = str1_start;
										mmlTxtBlock[i] = ret_hlt[0];
										str1_len = ret_hlt[0].elm.innerText.length;
										// elm_txtBlock_next.parentNode.insertBefore(ret_hlt[0].elm, elm_txtBlock_next);
										elm_txtBlock_pn.appendChild(ret_hlt[0].elm);
										for(var j=1; j<ret_hlt.length; j++) {
											// ret_hlt[j].start += (str1_start + str1_len);
											ret_hlt[j].start += str1_start;
											mmlTxtBlock.push(ret_hlt[j]);
											// mmlTxtBlock[i].elm.parentNode.insertBefore(ret_hlt[j].elm, elm_txtBlock_next);
											elm_txtBlock_pn.appendChild(ret_hlt[j].elm);
										}
										// mmlTxtBlock[mmlTxtBlock.length-1].next = txtBlock_next;
										// txtBlock_shiftStart(txtBlock_next, diffLength);
										
										console.log(mmlTxtBlock[mmlTxtBlock.length-1]);
										// mmlTxtBlock.splice(del_idx, 1);
									}
								}
							}
							break;
						}
					}
				}
			} else {
				// var ret_hlt = highlightFlMML3(new_txt);
				var ret_hlt = highlightFlMML2(input_txt, true);
				// ret_hlt.start = pos_start;
				// console.log(ret_hlt);
				for(var j=0; j<ret_hlt.length; j++) {
					// ret_hlt[j].start += pos_start;
					mmlTxtBlock.push(ret_hlt[j]);
				}
				for(var j=0; j<mmlTxtBlock.length; j++) {
					elm_hlt.appendChild(mmlTxtBlock[j].elm);
				}
			}
		}
		console.log(mmlTxtBlock);
		mmlTxtPrevLength = newLength;
	}

	function highlightFlMML2(text, procMacro) {
		var buf = text;
		var res = "";
		var escapeRE = function(str) {
			return str.replace(/([.*+?^=!:${}()|[\]\/\\])/g, "\\$1");
		};
		var macroName = [];
		var macroArgName = [];
		var macros = {};
		var nowMacroArgs = {};
		var macroNameLens = [];
		var macroArgNameLens = [];
		
		// 一文字だけハイライト [ ["1文字", "クラス"],... ]
		var oneChar = [
			["<", "octShftUp"],
			[">", "octShftDown"],
			["(", "velUp"],
			[")", "velDown"],
			["*", "porta"],
			["{", "nplet"],
			["}", "nplet"],
			["[", "poly"],
			["]", "poly"],
			["@", "atmark"]
		];
		// 複数文字ハイライト [ [["n文字",...], /対象範囲サーチ正規表現/or文字数n, クラス(, 処理関数)],... ]
		var multiChars = [
			[["r","R"], /[^rR0-9\.\s]/, "rest"],
			[["/:"], /[^0-9\s]/, "loop"],
			[[":/"], 2, "loop"],
			// [[":/"], /[^\:][^\/]/, "loop"],
			[["v","V"], /[^0-9\s]/, "vel"],
			[["o","O"], /[^0-9\s]/, "oct"],
			[["l","L"], /[^0-9\s]/, "defLength"],
			[["q","Q"], /[^0-9\s]/, "defQuant"],
			[["t","T"], /[^0-9\s]/, "tempo"],
			[["ns","NS","Ns","nS"], /[^0-9\s\+\-]/, "noteShift"],
			[["x","X"], /[^0-9\s]/, "velMode"],
			[["c","d","e","f","g","a","b","C","D","E","F","G","A","B"], /[^a-gA-G0-9\+#\-\.\s]/, "note"],

			[["&c","&d","&e","&f","&g","&a","&b","&C","&D","&E","&F","&G","&A","&B"], /[^0-9\+\-\.\s]/, "tie"],
			[["&0","&1","&2","&3","&4","&5","&6","&7","&8","&9"], /[^0-9\.\s]/, "tie"],
			[["@0","@1","@2","@3","@4","@5","@6","@7","@8","@9"], /[^0-9\-\s]/, "tone"],
			[["@ns","@Ns","@nS","@NS"], /[^0-9\+\-\s]/, "noteShiftR"],
			[["@d","@D"], /[^0-9,\+\-\s]/, "detune"],
			[["@l","@L"], /[^0-9,\-\s]/, "LFO"],
			[["@q","@Q"], /[^0-9\s]/, "abQuant"],
			[["@v","@V"], /[^0-9\s]/, "fVel"],
			[["@x","@X"], /[^0-9\s]/, "expr"],
			[["@pl","@Pl","@pL","@PL"], /[^0-9\s]/, "polyNum"],
			[["@p","@P"], /[^0-9\s]/, "panpod"],
			[["@u0","@U0"], 3, "midiPortaOff"],
			[["@u1","@U1"], 3, "midiPortaOn"],
			[["@u2","@U2"], /[^,0-9\s]/, "midiPortaVel"],
			[["@u3","@U3"], /[^,0-9oO\+\-#\s]/, "midiPortaStart"],
			[["@mh","@Mh","@mH","@MH"], /[^\,0-9\s]/, "fmLFO"],
			[["@w","@W"], /[^0-9-\s]/, "pDuty"],
			[["@n","@N"], /[^,0-9\s]/, "noiseFreq"],
			[["@f","@F"], /[^,0-9-\s]/, "filter"],
			[["@e1,","@E1,"], /[^,0-9\s]/, "vcaEnv"],
			[["@e2,","@E2,"], /[^,0-9\s]/, "vcfEnv"],
			[["@o","@O"], /[^0-3,\s]/, "pipeOut"],
			[["@i","@I"], /[^0-8,\s]/, "pipeInFM"],
			[["@r","@R"], /[^0-8,\s]/, "pipeInRing"],
			[["@s","@S"], /[^0-3,\s]/, "pipeIOSync"]
		];
		// 先頭指定複数文字ハイライト [ [["先頭1文字",...], [ ["続くn文字",...], /対象範囲サーチ正規表現/or文字数n, "クラス"(, 処理関数)],... ],... ]
		var hmultiChars = [
			[["&"],[
				[["c","d","e","f","g","a","b","C","D","E","F","G","A","B"], /[^0-9\+\-\.\s]/, "tie"],
				[["0","1","2","3","4","5","6","7","8","9"], /[^0-9\.\s]/, "tie"]
			]],
			[["@"],[
				[["0","1","2","3","4","5","6","7","8","9"], /[^0-9\-\s]/, "tone"],
				[["ns","Ns","nS","NS"], /[^0-9\+\-\s]/, "noteShiftR"],
				[["d","D"], /[^0-9,\+\-\s]/, "detune"],
				[["l","L"], /[^0-9,\-\s]/, "LFO"],
				[["q","Q"], /[^0-9\s]/, "abQuant"],
				[["v","V"], /[^0-9\s]/, "fVel"],
				[["x","X"], /[^0-9\s]/, "expr"],
				[["pl","Pl","pL","PL"], /[^0-9\s]/, "polyNum"],
				[["p","P"], /[^0-9\s]/, "panpod"],
				[["u0","U0"], 3, "midiPortaOff"],
				[["u1","U1"], 3, "midiPortaOn"],
				[["u2","U2"], /[^,0-9\s]/, "midiPortaVel"],
				[["u3","U3"], /[^,0-9oO\+\-#\s]/, "midiPortaStart"],
				[["mh","Mh","mH","MH"], /[^\,0-9\s]/, "fmLFO"],
				[["w","W"], /[^0-9-\s]/, "pDuty"],
				[["n","N"], /[^,0-9\s]/, "noiseFreq"],
				[["f","F"], /[^,0-9-\s]/, "filter"],
				[["e1,","E1,"], /[^,0-9\s]/, "vcaEnv"],
				[["e2,","E2,"], /[^,0-9\s]/, "vcfEnv"],
				[["o","O"], /[^0-3,\s]/, "pipeOut"],
				[["i","I"], /[^0-8,\s]/, "pipeInFM"],
				[["r","R"], /[^0-8,\s]/, "pipeInRing"],
				[["s","S"], /[^0-3,\s]/, "pipeIOSync"]
			]],
		];
		// 区間指定ハイライト [ ["開始文字列", "終了文字列", "クラス名"(,処理関数)] ]
		var blocks = [
			["/*", "*/", "comment"]
		]
		var highlighting = function() {
			if(buf.length <= 0) return "";
			// var buf = txt;
			var chr = buf.charAt(0);
			var preTag = "";
			var postTag = "";
			var preChr = "";
			var postChr = "";
			var result = "";
			var strCnt = 1;
			var output = function(chr, preTag, preChr, postChr, postTag) {
				var rtn = preTag + preChr + chr.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") + postChr + postTag;
				return rtn;
			};
			var output_char = function(chr, preChr, postChr) {
				var rtn = preChr + chr.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") + postChr;
				return rtn;
			};
			if(chr == ";") {	// マクロ/トラック終了
				nowMacroArgs = {};
				macroArgNameLens = [];
				// strCnt = 1;
				// chr = buf.slice(0, strCnt);
				preTag = "<span class='endTrack'>";
				postTag = "</span>";
				// result += output(chr, preTag, preChr, postChr, postTag);
				var elm = document.createElement("span");
				elm.setAttribute("class", "endTrack");
				elm.innerHTML = output_char(chr, preChr, postChr);
				buf = buf.slice(strCnt);
				// return result;
				return {
					len: strCnt,
					searchStr: 1,
					// htmlStr: result,
					elm: elm
				};
			}
			if(procMacro && chr == "$") {	// マクロ
				var ret = buf.indexOf(";");
				var ret2 = buf.slice(0, ret).indexOf("=");
				if(ret != -1 && ret2 != -1){		// マクロ宣言
					var ret3 = buf.slice(0, ret2).indexOf("\{");
					var tmpStr;
					if(ret3 != -1){
						tmpStr = buf.slice(1, ret3).trimRight()+"{";
						// tmpStr = buf.slice(1, ret3).trimRight();
					}else{
						tmpStr = buf.slice(1, ret2).trimRight();
					}
					if(macros[tmpStr] != null) {
						macroName.push(tmpStr);
					}
					macros[tmpStr] = [];
					// if(!macroNameLens[tmpStr.length]) {
					macroNameLens.push(tmpStr.length);
					// }
					/*
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
					*/
					if(ret3 != -1){	// 引数付きマクロ
						var macroArgs = buf.slice(ret3 + 1, buf.slice(0, ret2).indexOf("\}")).replace(/\s/g, "").split(",");
						for(var i=0; i<macroArgs.length; i++) {
							nowMacroArgs[macroArgs[i]] = true;
							// if(!macroArgNameLens[macroArgs[i].length]) {
							macroArgNameLens.push(macroArgs[i].length);
							// }
						}
						// macroArgName = tmpStr;
						macros[tmpStr] = nowMacroArgs;
						// macroArgs
					}
					strCnt = ret2; // + 1 - 1;
					chr = buf.slice(0, strCnt);
					preTag = "<span class='macroDecl'>";
					postTag = "</span>";
					var elm = document.createElement("span");
					elm.setAttribute("class", "macroDecl");
					elm.innerHTML = output_char(chr, preChr, postChr);
					result += output(chr, preTag, preChr, postChr, postTag);
					buf = buf.slice(strCnt);
					// return result;
					return {
						len: strCnt,
						searchStr: /[^=]/,
						elm: elm
					};
				} else if(procMacro) {
					// var matching = false;
					macroNameLens.filter(function(x, i, self){
						return self.indexOf(x) === i;
					}).sort(function(a,b){
						return b - a;
					});
					for(var i=0; i<macroNameLens.length; i++) {
						// var mName = buf.slice(1, macroNameLenMax+1-i); 
						var mName = buf.slice(1, macroNameLens[i]+1); 
						if(macros[mName] != null){	// 宣言済みマクロなら
							if(Object.keys(macros[mName]).length > 0) {
								var ret3 = buf.indexOf("\}");
								if(ret3 != -1) {
									strCnt = ret3 + 1;
									chr = buf.slice(0, strCnt);
								}else{
									strCnt = buf.length;
									chr = buf;
								}
							}else{
								strCnt = mName.length + 1;
								chr = buf.slice(0, strCnt);
							}
							preTag = "<span class='macroUse'>";
							postTag = "</span>";
							var elm = document.createElement("span");
							elm.setAttribute("class", "macroUse");
							elm.innerHTML = output_char(chr, preChr, postChr);
							result += output(chr, preTag, preChr, postChr, postTag);
							buf = buf.slice(strCnt);
							// return result;
							return {
								len: strCnt,
								searchStr: strCnt,
								elm: elm
							};
						}
					}
					/*
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
								// matching = true;
								break;
							}
						}
					
					// if(!matching){
					//	strCnt = buf.length;
					//	chr = buf;
					// }
					preTag = "<span class='macroUse'>";
					postTag = "</span>";
					*/
				}
			}
			if(procMacro && chr == "%") {	// マクロ内引数
				// var macroArg = buf.slice(1, macroArgNameLenMax+1);
				macroArgNameLens.filter(function(x, i, self){
					return self.indexOf(x) === i;
				}).sort(function(a,b){
					return b - a;
				});
				// console.log(macroArgNameLens);
				for(var i=0; i<macroArgNameLens.length; i++) {
					var macroArg = buf.slice(1, macroArgNameLens[i]+1);
					if(nowMacroArgs[macroArg]){	// 宣言済みマクロなら
						strCnt = macroArg.length + 1;
						chr = buf.slice(0, strCnt);
						preTag = "<span class='macroDecl'>";
						postTag = "</span>";
						var elm = document.createElement("span");
						elm.setAttribute("class", "macroDecl");
						elm.innerHTML = output_char(chr, preChr, postChr);
						result += output(chr, preTag, preChr, postChr, postTag);
						buf = buf.slice(strCnt);
						// return result;
						return {
							len: strCnt,
							searchStr: strCnt,
							elm: elm
						};
					}
				}
				/*
				if(nowMacroArgs[]){
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
				*/
			}

			for(var i=0; i<blocks.length; i++) {
				var search1_len = blocks[i][0].length;
				var ret = buf.slice(0, search1_len);
				if(ret != blocks[i][0]) {
					continue;
				}
				if(blocks[i][3] != null) {

				} else {
					var ret2 = buf.indexOf(blocks[i][1]);
					if(ret2 != -1){
						strCnt = ret2 + 2;
						chr = buf.slice(0, strCnt);
					}else{	// 終わり見つからず
						strCnt = buf.length;
						chr = buf;
					}
					preTag = '<span class="' + blocks[i][2] + '">';
					postTag = '</span>';
					var elm = document.createElement("span");
					elm.setAttribute("class", blocks[i][2]);
					elm.innerHTML = output_char(chr, preChr, postChr);
					result += output(chr, preTag, preChr, postChr, postTag);
					buf = buf.slice(strCnt);
					// return result;
					return {
						len: strCnt,
						searchStr: strCnt,
						elm: elm
					};
				}
			}

			var chrReg = new RegExp(escapeRE(chr));
			if(chrReg.test("^#")){	// メタデータ
				var ret = buf.indexOf("\n");
				var ret2 = buf.slice(0, ret).indexOf("{");
				if(ret != -1){
					strCnt = ret + 1;
					chr = buf.slice(0, strCnt);
				}else{
					strCnt = buf.length;
					chr = buf;
				}
				preTag = "<span class='metaData'>";
				postTag = "</span>";
				var elm = document.createElement("span");
				elm.setAttribute("class", "metaData");
				elm.innerHTML = output_char(chr, preChr, postChr);
				result += output(chr, preTag, preChr, postChr, postTag);
				buf = buf.slice(strCnt);
				// return result;
				return {
					len: strCnt,
					searchStr: /\n/,
					elm: elm
				};
			}

			for(var i=0; i<hmultiChars.length; i++) {
				// for(var j=0; j<hmultiChars[i][0].length; j++)
				// if(chr == hmultiChars[i][0][j])
				if(chr == hmultiChars[i][0][0]) {
					for(var j=0; j<hmultiChars[i][1].length; j++) {
						var search1_len = hmultiChars[i][1][j][0][0].length;
						var ret = buf.slice(1, 1+search1_len);
						for(var k=0; k<hmultiChars[i][1][j][0].length; k++) {
							if(ret != hmultiChars[i][1][j][0][k]) {
								continue;
							}
							var head_len = hmultiChars[i][0][0].length;
							if(typeof hmultiChars[i][1][j][1] != "number") {
								var ret2 = buf.slice(head_len+search1_len).search(hmultiChars[i][1][j][1]);
								// console.log(ret2);
								if(ret2 != -1) {
									strCnt = ret2 + head_len+search1_len;
									chr = buf.slice(0, strCnt);
								} else {
									// strCnt = 1 + head_len+search1_len;
									strCnt = buf.length;
									chr = buf.slice(0, strCnt);
								}
							} else {
								strCnt = hmultiChars[i][1][j][1];
								chr = buf.slice(0, hmultiChars[i][1][j][1]);
							}
							preTag = '<span class="' + hmultiChars[i][1][j][2] + '">';
							postTag = '</span>';
							var elm = document.createElement("span");
							elm.setAttribute("class", hmultiChars[i][1][j][2]);
							elm.innerHTML = output_char(chr, preChr, postChr);
							result += output(chr, preTag, preChr, postChr, postTag);
							// result += highlighting(buf.slice(strCnt));
							buf = buf.slice(strCnt);
							// return result;
							return {
								len: strCnt,
								searchStr: hmultiChars[i][1][j][1],
								elm: elm
							};
						}
					}
				}
			}
			for(var i=0; i<multiChars.length; i++) {
				var search1_len = multiChars[i][0][0].length;
				var ret = buf.slice(0, search1_len);
				for(var j=0; j<multiChars[i][0].length; j++) {
					// for(var k=0; k<multiChars[i][0][j].length; k++){
						if(ret != multiChars[i][0][j]) {
							continue;
						}
						if(typeof multiChars[i][1] != "number") {
							var ret2 = buf.slice(search1_len).search(multiChars[i][1]);
							if(ret2 != -1) {
								strCnt = ret2 + search1_len;
								chr = buf.slice(0, strCnt);
							} else {
								strCnt = buf.length;
								// strCnt = 1 + search1_len;
								chr = buf.slice(0, strCnt);
							}
						} else {
							strCnt = multiChars[i][1];
							chr = buf.slice(0, multiChars[i][1]);
						}
						preTag = '<span class="' + multiChars[i][2] + '">';
						postTag = '</span>';
						var elm = document.createElement("span");
						elm.setAttribute("class", multiChars[i][2]);
						elm.innerHTML = output_char(chr, preChr, postChr);
						result += output(chr, preTag, preChr, postChr, postTag);
						// result += highlighting(buf.slice(strCnt));
						buf = buf.slice(strCnt);
						// return result;
						return {
							len: strCnt,
							searchStr: multiChars[i][1],
							elm: elm
						};
					// }
				}
			}

			for(var i=0; i<oneChar.length; i++) {
				if(chr != oneChar[i][0]) {
					continue;
				}
				preTag = '<span class="' + oneChar[i][1] + '">';
				postTag = '</span>';
				var elm = document.createElement("span");
				elm.setAttribute("class", oneChar[i][1]);
				elm.innerHTML = output_char(chr, preChr, postChr);
				result += output(chr, preTag, preChr, postChr, postTag);
				// result += highlighting(buf.slice(1));
				buf = buf.slice(1);
				// return result;
				return {
					len: 1,
					searchStr: 1,
					elm: elm
				}
			}
			
			result += output(chr, preTag, preChr, postChr, postTag);
			var elm = document.createElement("span");
			// elm.setAttribute("class", hmultiChars[i][1][j][2]);
			elm.innerHTML = output_char(chr, preChr, postChr);
			// result += highlighting(buf.slice(strCnt));
			buf = buf.slice(strCnt);
			// return result;
			return {
				len: strCnt,
				searchStr: strCnt,
				elm: elm
			}
		};
		res = [];
		while(buf.length > 0) {
			// res += highlighting();
			var res_tmp = highlighting();
			res.push(res_tmp);
		}
		var res_start = 0;
		for(var i=0; i<res.length; i++) {
			res[i].start = res_start;
			res_start += res[i].len;
		}
		for(var i=1; i<res.length; i++) {
			res[i].prev = res[i-1];
		}
		for(var i=res.length-2; i>=0; i--) {
			res[i].next = res[i+1];
		}
		// console.log(res[res.length-1]);
		if(res.length) {
			res[0].prev = null;
			res[res.length-1].next = null;
		}

		return res;
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
	
	function changeHltMode (mode, evt_input) {
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
			if(editorHltDelayed) {
				// elmHlt.innerHTML = highlightFlMML3_pre(evt_input, elmHlt);
				// highlightFlMML3_pre2(evt_input, elmHlt);
				var tmp_obj = highlightFlMML2(elmTxt.value, true);
				elmHlt.innerHTML = "";
				for(var i=0; i<tmp_obj.length; i++) {
					elmHlt.appendChild(tmp_obj[i].elm);
				}
				// elmHlt.innerHTML = highlightFlMML2(elmTxt.value, true);
			} else {
				var cancelUpdt = function () {
					if(typeof delayTimeoutID == "number") {
						window.clearTimeout(delayTimeoutID);
						delayTimeoutID = "";
					}
				};
				// highlightFlMML3_pre2(evt_input, elmHlt);
				// elmHlt.innerHTML = highlightFlMML3_pre(evt_input);
				// elmHlt.innerHTML = highlightFlMML2(elmTxt.value, false);
				var tmp_obj = highlightFlMML2(elmTxt.value, false);
				elmHlt.innerHTML = "";
				for(var i=0; i<tmp_obj.length; i++) {
					elmHlt.appendChild(tmp_obj[i].elm);
				}
				// cancelUpdt();
				// macroDelayTimeoutID = window.setTimeout(function() {
				//	highlightFlMML3_pre(evt_input, elmHlt);
					// elmHlt.innerHTML = highlightFlMML3_pre(evt_input);
					// elmHlt.innerHTML = highlightFlMML2(elmTxt.value, true);
				// }, delayTimeMSec);
			}
			
			elmHlt.style.visibility = "visible";
			if(editorColor === "")
				editorColor = (elmTxt.currentStyle || document.defaultView.getComputedStyle(elmTxt, '')).color;
			elmTxt.style.color = "rgba(200, 200, 160, 0.1)";
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
	
	var updateHlt = function (evt_input) {
			var elmHlt = document.getElementById("mmlhighlight");
			var elmTxt = document.getElementById("mmltxt");
			changeHltMode (false, evt_input)
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

		elmTxt.addEventListener("keypress", function(e) {
			var key = e.key;
			// console.log(e);
			// if(key == "ArrowLeft" || key == "ArrowRight" ||
			// key == "ArrowUp" || key == "ArrowDown") {
			var offset = 0;
			// console.log(key);
			var textVal = e.target.value;
			var pos = e.target.selectionEnd;
			var prevChar = textVal.charAt(pos-1) || "";
			var nextChar = textVal.charAt(pos) || "";
			// console.log("prev: " + prevChar + ",next: " + nextChar);
			// }
		});

		elmTxt.addEventListener("input", function(e) {
			// console.log(e);
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
						updateHlt(e);
					}, delayTimeMSec);
				}else{
					updateHlt(e);
					cancelUpdt();
					delayTimeoutID = window.setTimeout(function() {
						editorHltDelayed = true;
						updateHlt(e);
						editorHltDelayed = false;
					}, delayTimeMSec);
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