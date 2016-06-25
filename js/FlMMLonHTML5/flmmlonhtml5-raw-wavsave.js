// "use strict";

var FlMMLonHTML5 = function () {
    var BUFFER_SIZE = 8192;
    var BUFFER_SIZE_SAVE = 16384;
    var WAV_SAMPLERATE = 44100;
    
    var COM_BOOT      =  1, // Main->Worker
        COM_PLAY      =  2, // Main->Worker
        COM_STOP      =  3, // Main->Worker
        COM_PAUSE     =  4, // Main->Worker
        COM_BUFFER    =  5, // Main->Worker->Main
        COM_COMPCOMP  =  6, // Worker->Main
        COM_BUFRING   =  7, // Worker->Main
        COM_COMPLETE  =  8, // Worker->Mainf
        COM_SYNCINFO  =  9, // Main->Worker->Main
        COM_PLAYSOUND = 10, // Worker->Main
        COM_STOPSOUND = 11, // Worker->Main->Worker
        COM_DEBUG     = 12; // Worker->Main

    var emptyBuffer = new Float32Array(BUFFER_SIZE);
    
    var recData = [];
    var encodedArray;
    var recBuffer;

    var divDebug;

    function debug(str) {
        if (!divDebug) {
            divDebug = document.createElement("div");
            document.body.appendChild(divDebug);
        }
        var div = document.createElement("div");
        div.appendChild(document.createTextNode(str));
        divDebug.appendChild(div);
        
        var divs = divDebug.getElementsByTagName("div");
        if (divs.length > 10) divDebug.removeChild(divDebug.firstChild);
    }

    function extend (target, object) {
        for (var name in object) {
            target[name] = object[name];
        }
        return target;
    }
    
    var saveWAV = function  (procSmpl) {
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
						var dataview = encodeWAV(mergeBuffers(recData, procSmpl * 2), WAV_SAMPLERATE, 2);
						var audioBlob = new Blob([dataview], { type: 'audio/wav' });

						return audioBlob;
	};
	
	var saveMP3 = function  (procSmpl) {
        			    var encodeMP3 = (function(samples, sampleRate, ch) {
        			    	this.mp3worker.postMessage({ cmd: 'init', config:{
        			    		channels: ch,
        			    		insamplerate: sampleRate,
        			    		samplerate: sampleRate,
        			    		bitrate: 192
        			    	}});
        			    	this.mp3worker.postMessage({ cmd: 'encode', bufL: new Float32Array(samples[0]), bufR: new Float32Array(samples[1]) });
        			    	
        			    	this.mp3worker.postMessage({ cmd: 'finish' });
        			    	this.mp3worker.onmessage = (function(e) {
        			    		if(e.data.cmd == 'data') {
        			    				encodedArray = e.data.buf;
                    					this.onmp3encodecompleted && this.onmp3encodecompleted();
                   						this.trigger("mp3encodecompleted");
        			    		}
        			    	}).bind(this);
           					this.onmp3encodestart && this.onmp3encodestart();
      						this.trigger("mp3encodestart");
        			    }).bind(this);

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
						this.addEventListener("mp3encodecompleted", this.encodedMP3Binded);
						encodeMP3(mergeBuffers(recData, procSmpl), WAV_SAMPLERATE, 2);
						
						return false;
	};
	
	var dlBlob = function (blob, ext) {
		    if (window.navigator.msSaveBlob) { 
    	    	window.navigator.msSaveOrOpenBlob(blob, this.saveFilename + ext);
    	    }else{
				var myURL = window.URL || window.mozURL || window.webkitURL;
				var url = myURL.createObjectURL(blob);
				var dlLink = document.createElement("a");
				document.body.appendChild(dlLink);
				dlLink.href = url;
				dlLink.download = this.saveFilename + ext;
				dlLink.click();
				document.body.removeChild(dlLink);
			}
	};
    
    function FlMMLonHTML5(isSaving, workerURL) {
        // 難読化されればFlMMLonHTML5の名前が変わる
        // (IEにFunction.nameはないけどどうせWeb Audioもない)
        if (!workerURL) {
            // workerURL = FlMMLonHTML5.name === "FlMMLonHTML5" ? "flmmlworker-raw.js" : "flmmlworker.js"
            workerURL = FlMMLonHTML5.name === "FlMMLonHTML5" ? "js/FlMMLonHTML5/flmmlworker.js" : "js/FlMMLonHTML5/flmmlworker.js"
        }
        var worker = this.worker = new Worker(workerURL);
        worker.addEventListener("message", this.onMessage.bind(this));
        var mp3worker = this.mp3worker = new Worker("js/FlMMLonHTML5/encoder.js");
        
        this.isSaveWav = false;
        if(isSaving){
        	this.isSaveWav = true;
        }

        this.onAudioProcessBinded = this.onAudioProcess.bind(this);
        this.onAudioProcessSaveBinded = this.onAudioProcessSave.bind(this);
        this.getTotalMSecBinded = this.getTotalMSec.bind(this);
        this.completeRenderingBinded = this.completeRendering.bind(this);
        this.warnings = "";
        this.totalTimeStr = "00:00";
        this.bufferReady = false;
        this.volume = 100.0;
        this.wavSmplRate = WAV_SAMPLERATE;
        this.isComplete = false;
        this.processCount = 0;
        this.procSamples = 0;
        this.renderProgres = 0;
        this.renderingComplete = false;
        this.saveFilename = "flmml";
        this.isEncodeMP3 = false;
        this.mp3Encoded = false;
        this.encodedMP3Binded = this.encodedMP3.bind(this);

        this.events = {};
        
        worker.postMessage({
            type: COM_BOOT,
            sampleRate: isSaving ? WAV_SAMPLERATE : FlMMLonHTML5.audioCtx.sampleRate,
            bufferSize: isSaving ? BUFFER_SIZE_SAVE : BUFFER_SIZE
        });
        this.setInfoInterval(125);
    }

    extend(FlMMLonHTML5.prototype, {
        onMessage: function (e) {
            var data = e.data,
                type = data.type;

            switch (type) {
                case COM_BUFFER:
                    this.buffer = data.buffer;
                    this.bufferReady = true;
                    break;
                case COM_COMPCOMP:
                    extend(this, data.info);
                    this.oncompilecomplete && this.oncompilecomplete();
                    this.trigger("compilecomplete");
                    break;
                case COM_BUFRING:
                    this.onbuffering && this.onbuffering(data);
                    this.trigger("buffering", data);
                    break;
                case COM_COMPLETE:
                    this.oncomplete && this.oncomplete();
                    this.trigger("complete");
                    break;
                case COM_SYNCINFO:
                    extend(this, data.info);
                    this.onsyncinfo && this.onsyncinfo();
                    this.trigger("syncinfo");
                    break;
                case COM_PLAYSOUND:
                    this.playSound();
                    break;
                case COM_STOPSOUND:
                    this.stopSound(data.isFlushBuf);
                    this.worker.postMessage({ type: COM_STOPSOUND });
                    break;
                case COM_DEBUG:
                    debug(data.str);
            }
        },

        playSound: function () {
            if (this.gain || this.scrProc || this.scrProcRec || this.oscDmy) return;
            
            if(!this.isSaveWav){
            	var audioCtx = FlMMLonHTML5.audioCtx;

	            var gain = this.gain = audioCtx.createGain();
    	        gain.gain.value = this.volume / 127.0;
        	    gain.connect(audioCtx.destination);
        	    
				if(!this.isSaveWav){
	            	this.scrProc = audioCtx.createScriptProcessor(BUFFER_SIZE, 1, 2);
    	        	this.scrProc.addEventListener("audioprocess", this.onAudioProcessBinded);
	        	    this.scrProc.connect(this.gain);
	        	}else{
					this.scrProcRec = audioCtx.createScriptProcessor(BUFFER_SIZE, 2, 2);
    	        	this.scrProcRec.addEventListener("audioprocess", this.onAudioProcessRecBinded);
	        	    this.scrProcRec.connect(this.gain);
	        	    
	            	this.scrProc = audioCtx.createScriptProcessor(BUFFER_SIZE, 1, 2);
    	        	this.scrProc.addEventListener("audioprocess", this.onAudioProcessBinded);
	        	    this.scrProc.connect(this.scrProcRec);
	        	}

	            // iOS Safari対策
    	        this.oscDmy = audioCtx.createOscillator();
        	    this.oscDmy.connect(this.scrProc);
            	this.oscDmy.start(0);
            	
            }else{
        	    this.processCount = -1;
        	    this.procSamples = Math.ceil(this.getTotalMSecBinded() / 1000.0 * WAV_SAMPLERATE);
        	    recData = [];
        	    var ret = window.setInterval( (function(){
        	    	if(this.processCount == -1) {
        	    		this.onAudioProcessSaveBinded();
        	    		this.processCount = 0;
        	    	}else{
        	    		if(this.bufferReady)
        	    			this.onAudioProcessSaveBinded();
       	    			if(this.processCount < this.procSamples){
        	    			var oldRP = this.renderProgress;
        	    			this.renderProgress = parseInt(this.processCount / this.procSamples * 100);
        	    			if(oldRP < this.renderProgress){
								this.onrendering && this.onrendering(this.renderProgress);
       	    					this.trigger("rendering", this.renderProgress);
       	    				}
        	    		}else if(this.renderingComplete){
        	    			window.clearInterval(ret);
        	    			this.renderProgress = 100;
							this.onrendering && this.onrendering(this.renderProgress);
    	   	   	 			this.trigger("rendering", this.renderProgress);
    	    		   	 	var audioBlob = this.isEncodeMP3 ? saveMP3.call(this, Math.min(this.procSamples, this.processCount)) : saveWAV.call(this, Math.min(this.procSamples, this.processCount));
    	    		   	 	if(audioBlob)
    	    		   	 		dlBlob.call(this, audioBlob, ".wav");
        	    			this.removeEventListener("complete", this.completeRenderingBinded);
        	    			this.renderingComplete = false;
        	    			this.bufferReady = false;
        	    		}
        	    	}
        	    }).bind(this), 0 );
        	    
        	    this.addEventListener("complete", this.completeRenderingBinded);
            }
        },

        stopSound: function (isFlushBuf) {
            if (isFlushBuf) this.bufferReady = false;
            if (this.gain || this.scrProc || this.oscDmy) {
                this.scrProc.removeEventListener("audioprocess", this.onAudioProcessBinded);
                if (this.gain) { this.gain.disconnect(); this.gain = null; }
                if (this.scrProc) { this.scrProc.disconnect(); this.scrProc = null; }
                if (this.oscDmy) { this.oscDmy.disconnect(); this.oscDmy = null; }
            }
        },

        onAudioProcess: function (e) {
            var outBuf = e.outputBuffer;
            if (this.bufferReady) {
				outBuf.getChannelData(0).set(this.buffer[0]);
                outBuf.getChannelData(1).set(this.buffer[1]);
                this.bufferReady = false;
                this.worker.postMessage({ type: COM_BUFFER, retBuf: this.buffer }, [this.buffer[0].buffer, this.buffer[1].buffer]);
            } else {
	                outBuf.getChannelData(0).set(emptyBuffer);
    	            outBuf.getChannelData(1).set(emptyBuffer);
                this.worker.postMessage({ type: COM_BUFFER, retBuf: null });
            }
        },
        
        onAudioProcessSave: function () {
        	 if (this.bufferReady) {
            	var in0 = this.buffer[0];
                var in1 = this.buffer[1];
                var bufferData = new Float32Array(in0.length * 2);
                for(var i=0; i<in0.length; i++){
                	bufferData[i*2] = in0[i];
                	bufferData[i*2+1] = in1[i];
                }
                recData.push(bufferData);
                this.processCount += in0.length;
                
                this.bufferReady = false;
                this.worker.postMessage({ type: COM_BUFFER, retBuf: this.buffer }, [this.buffer[0].buffer, this.buffer[1].buffer]);
                return true;
             }else{
               	this.worker.postMessage({ type: COM_BUFFER, retBuf: null });
               	console.log("buffer requested,processCount: "+this.processCount);
               	return false;
             }
        },
        	
        completeRendering: function () {
        	this.renderingComplete = true;
   	 	},
   	 	
   	 	encodedMP3: function () {
   	 		var encodedBlob = new Blob([encodedArray], { type: 'audio/x-mpeg-3' });
   	 		dlBlob.call(this, encodedBlob, ".mp3");
   	 		this.removeEventListener("mp3encodecompleted", this.encodedMP3Binded);
   	 	},
        	
        trigger: function (type, args) {
            var handlers = this.events[type];
            if (!handlers) return;
            var e = {};
            extend(e, args);
            for (var i = 0, len = handlers.length; i < len; i++) {
                handlers[i] && handlers[i].call(this, e);
            }
        },

        play: function (mml) {
            this.worker.postMessage({ type: COM_PLAY, mml: mml });
        },

        save: function (mml, filename, isMP3) {
        	this.saveFilename = filename != "" ? filename : "flmml";
        	this.isEncodeMP3 = isMP3 ? true : false;
            this.worker.postMessage({ type: COM_PLAY, mml: mml });
        },

        stop: function () {
            this.worker.postMessage({ type: COM_STOP });
        },

        pause: function () {
            this.worker.postMessage({ type: COM_PAUSE });
        },

        setMasterVolume: function (volume) {
            this.volume = volume;
            if (this.gain) this.gain.gain.value = this.volume / 127.0;
        },

        isPlaying: function () {
            return this._isPlaying;
        },

        isPaused: function () {
            return this._isPaused;
        },

        getWarnings: function () {
            return this.warnings;
        },

        getTotalMSec: function () {
            return this.totalMSec | 0;
        },

        getTotalTimeStr: function () {
            return this.totalTimeStr;
        },

        getNowMSec: function () {
            return this.nowMSec | 0;
        },

        getNowTimeStr: function () {
            return this.nowTimeStr;
        },

        getVoiceCount: function () {
            return this.voiceCount;
        },

        getMetaTitle: function () {
            return this.metaTitle;
        },

        getMetaComment: function () {
            return this.metaComment;
        },

        getMetaArtist: function () {
            return this.metaArtist;
        },

        getMetaCoding: function () {
            return this.metaCoding;
        },

        setInfoInterval: function (interval) {
            this.worker.postMessage({ type: COM_SYNCINFO, interval: interval });
        },

        syncInfo: function () {
            this.worker.postMessage({ type: COM_SYNCINFO, interval: null });
        },

        addEventListener: function (type, listener) {
            var handlers = this.events[type];

            if (!handlers) handlers = this.events[type] = [];
            for (var i = handlers.length; i--;) {
                if (handlers[i] === listener) return false;
            }
            handlers.push(listener);
            return true;
        },

        removeEventListener: function (type, listener) {
            var handlers = this.events[type];

            if (!handlers) return false;
            for (var i = handlers.length; i--;) {
                if (handlers[i] === listener) {
                    handlers.splice(i, 1);
                    return true;
                }
            }
            return false;
        },

        release: function () {
            this.stopSound();
            this.worker.terminate();
        }
    });

    // Web Audioコンテキスト作成
    var AudioCtx = window.AudioContext || window.webkitAudioContext;
    FlMMLonHTML5.audioCtx = new AudioCtx();
    // FlMMLonHTML5.offlineCtx = new OfflineAudioContext(2, WAV_SAMPLERATE*16, WAV_SAMPLERATE);

    // iOS Safari対策
    document.addEventListener("DOMContentLoaded", function () {
        document.addEventListener("click", function onClick(e) {
            var audioCtx = FlMMLonHTML5.audioCtx;
            var bufSrcDmy = audioCtx.createBufferSource();
            bufSrcDmy.connect(audioCtx.destination);
            bufSrcDmy.start(0);
            document.removeEventListener("click", onClick);
        });
    });
    
    return FlMMLonHTML5;
}();

