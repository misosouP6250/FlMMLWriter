"use strict";
	var flmml, flmmlSave;
	var isFirst = true;
	var isFirstSave = true;
	var isPlay;
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
	
	function onMMLSelected() {
		var item = document.getElementById("mmlfile").files[0];
		var reader = new FileReader();
		reader.onload = onMMLLoaded;
		reader.readAsText(item);
	}
	
	function onMMLLoaded(e) {
		var elm = document.getElementById("mmltxt");
		var elmHlt = document.getElementById("mmlhighlight");

		elm.value = e.target.result;
		elmHlt.innerHTML = highlightFlMML(e.target.result);
		updateScrBar();
	}
	
	function onVolumeChange() {
		var vol = document.getElementById("mmlvolume").value;
		if(isPlay)
			flmml.setMasterVolume(parseInt(vol));
		var elm = document.getElementById("mmlstatus");
		elm.innerHTML = "Volume: " + vol;
	}
	
	function onCompileComplete() {
		var elm = document.getElementById("mmlwarn");
		if(isPlay)
			elm.value = flmml.getWarnings();
		else
			elm.value = flmmlSave.getWarnings();
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

	function onEncodeComplete() {
		onVolumeChange();
	}

	
	function createFlMMLonHTML5(isSave) {
		if(!isSave){
			flmml = new FlMMLonHTML5();
			flmml.oncompilecomplete = onCompileComplete;
			flmml.onsyncinfo = onSyncInfo;
			flmml.onbuffering = onBuffering;
			isFirst = false;
		}else{
			flmmlSave = new FlMMLonHTML5(true);
			flmmlSave.oncompilecomplete = onCompileComplete;
			flmmlSave.onrendering = onRendering;
			flmmlSave.onmp3encodestart = onEncodeStart;
			flmmlSave.onmp3encodecompleted = onEncodeComplete;
			flmmlSave.setInfoInterval(250);
			isFirstSave = false;
		}
	}
	
	function play() {
		if(isFirst)
			createFlMMLonHTML5(false);
		isPlay = true;
		flmml.play(document.getElementById('mmltxt').value);
	}
	
	function stop() {
		if(!isFirst)	flmml.stop();
	}
	
	function pause() {
		if(!isFirst)	flmml.pause();
	}
	
	function save(isMP3) {
		if(isFirstSave)
			createFlMMLonHTML5(true);
		isPlay = false;
		var elm = document.getElementById("mmlstatus");
		elm.innerHTML = "compiling ...";
		flmmlSave.save(document.getElementById('mmltxt').value, document.getElementById('mmlsavefilename').value, isMP3);
	}
	
	function saveStop() {
		if(!isFirstSave)	flmmlSave.stop();
	}
	
	function openUrl(url) {
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
		var yqlQuery = encodeURIComponent('env "http://www.datatables.org/alltables.env";select * from xClient where url="' + mmlDLUrl + '"');
		var yqlUrl = 'http' + (/^https/.test(location.protocol)?'s':'') + '://query.yahooapis.com/v1/public/yql?q='
						+ yqlQuery + '&format=json';
		myxhr = new XMLHttpRequest();
		myxhr.onload = function (e) {
						var rcont = myxhr.response.query.results.resources.content;
						// console.log(myxhr.response);
						if(rcont)
							onMMLLoaded({target: {result: imprtComment + rcont}});
		};
		// console.log(yqlUrl);
		myxhr.open("GET", yqlUrl);
		myxhr.responseType = "json";
		myxhr.send(null);
		}
	}
	
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
					var ret = buf.search(/[^a-gA-G0-9\+\-\.\s]/);	// 音符系以外の文字
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
	
	function changeHltMode () {
		editorHltOn = document.getElementById("hlt-off").checked ? false : true;
		editorHltDelayed = document.getElementById("hlt-rt").checked ? false : true;
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
		elmTxt.scrollTop += (ev.pageY - barOfsTop) * (elmTxt.scrollHeight / elmTxt.offsetHeight);
		barOfsTop = ev.pageY;
		updateScrBar();
		return false;
	};
	
	var setHighlight = function () {
		var elmHlt = document.getElementById("mmlhighlight");
		var elmTxt = document.getElementById("mmltxt");
		var elmHltWrap = document.getElementById("mmlhighlightwrap");
		
		
		var lineHeight = 17;
		
		changeHltMode();
		
		elmTxt.style.WebkitAppearance = "none";
		elmTxt.style.top = "10px";
		elmTxt.style.left = "10px";
		elmTxt.style.width = "90vw";
		elmTxt.style.height = "70vh";
		elmTxt.style.padding = "4px";
		

		elmHlt.style.WebkitAppearance = "none";
		elmHlt.style.pointerEvents = "none";
		elmHlt.style.MosUserSelect = "none";
		elmHlt.style.MsUserSelect = "none";
		elmHlt.style.WebkitUserSelect = "none";
		elmHlt.style.top = "0";
		elmHlt.style.left = "0";
		elmHlt.style.width = elmTxt.style.width;
		elmHlt.style.padding = "4px";
		
		elmHltWrap.style.width = elmTxt.style.width;
		elmHltWrap.style.height = elmTxt.style.height;
		elmHltWrap.style.padding = "4px";
		elmHltWrap.style.color = "#EEE";
		
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
	
	window.addEventListener("load", setHighlight);
	window.addEventListener("load", setManualScroll);