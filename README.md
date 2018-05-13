# FlMMLWriter
FlMMLWriterはWEBブラウザ上でFlMML(ピコカキコ) MMLを書くためのエディタです。
[ここから](https://misosouP6250.github.io/FlMMLWriter)使用できます。  

## 動作確認済みブラウザ
・Chrome v66  
・Firefox v52  
・Edge  
その他、古いIE、Opera以外なら動くかと思います(未検証)。

## 使い方
・真ん中の黒いテキストボックス  
　FlMMLの演奏データを入力するエディタ画面です。文法は[こちら(暫定)](https://gist.github.com/anonymous/975e4cf634c2b156621e662b5fd12e4a)を参照してください。\(大百科ピコカキコのスレ>>1491さんThanks\!\)  
　例:T120 L8 o5 cdefgab&lt;c  
　　テンポ120 八分音符でドレミファソラシド  
　スマートフォンなどのタッチパネルでスクロールしたい場合は二本指で行ってください。  
  
・右下の黒いテキストボックス  
　コンパイル時などの警告が表示されます。  
  
・open file... ボタン  
　ローカルの演奏データ\(text\)を参照してエディタに開きます。  
  
・Reloadボタン <img src="https://raw.githubusercontent.com/misosouP6250/FlMMLWriter/master/img/reload.png" alt="Reloadボタン" title="Reload" width=16 height=16 style="background-color:#111">  
　ローカルデータを開きなおします。  
  
・Play/Pause/Stopボタン <img src="https://raw.githubusercontent.com/misosouP6250/FlMMLWriter/master/img/play.png" alt="Playボタン" title="Play" width=16 height=16 style="background-color:#111"><img src="https://raw.githubusercontent.com/misosouP6250/FlMMLWriter/master/img/pause.png" alt="Pauseボタン" title="Pause" width=16 height=16 style="background-color:#111"><img src="https://raw.githubusercontent.com/misosouP6250/FlMMLWriter/master/img/stop.png" alt="Stopボタン" title="Stop" width=16 height=16 style="background-color:#111">  
　順に再生/一時停止/停止ボタンです。  
  
・スライドバー  
　音量を調節できます。  
  
・スライドバー隣の領域  
　情報(音量、バッファ中、レンダリング中、再生時間など)が表示されます。  
  
・URL/No\.テキストフィールド  
　URLまたはピコカキコ番号を指定、ダウンロードボタン <img src="https://raw.githubusercontent.com/misosouP6250/FlMMLWriter/master/img/open-cloud.png" alt="Stopボタン" title="Stop" width=16 height=16 style="background-color:#111"> をクリックしてテキストとしてエディタに開きます。  
　ここで開いたファイルの先頭にはコメントが挿入されます。  
  
・Filenameテキストフィールド  
　保存する際のファイル名を入力します。拡張子は自動で付与するので必要ありません。省略した場合は「flmml」となります。  
  
・Save\(MML/WAV/MP3\)ボタン <img src="https://raw.githubusercontent.com/misosouP6250/FlMMLWriter/master/img/save-mml.png" alt="mmlボタン" title="save-mml" width=28 height=16 style="background-color:#111"><img src="https://raw.githubusercontent.com/misosouP6250/FlMMLWriter/master/img/save-wav.png" alt="wavボタン" title="save-wav" width=28 height=16 style="background-color:#111"><img src="https://raw.githubusercontent.com/misosouP6250/FlMMLWriter/master/img/save-mp3.png" alt="mp3ボタン" title="save-mp3" width=28 height=16 style="background-color:#111">  
　順にテキスト、wavファイル、mp3ファイルとしてローカルに保存\(ダウンロード\)します。  
　mp3としてダウンロードする場合、ブラウザ側のマシンで変換するのでスマートフォンなどではかなり時間がかかります。  
　wavは44.1kHz ステレオ、mp3は44.1kHz ステレオ 192kb/sです。  
  
・Modeセレクトボックス  
　エディタのハイライト　モード選択です。  
　・off: ハイライトしません  
　・delayed: 編集中は一時的にハイライトを切り、編集が終わると一定時間後にハイライトします。推奨  
　・realtime: 編集中、常にハイライトを更新します。マシンパワーが必要です。非推奨  

## Thanks
・[FlMML](https://flmml.codeplex.com/)  
・[FlMML on HTML5](https://github.com/carborane3/FlMMLonHTML5)  
・[lamejs](https://github.com/zhuker/lamejs)  
