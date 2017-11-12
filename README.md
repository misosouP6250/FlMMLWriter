# FlMMLWriter
FlMMLWriterはWEBブラウザ上でFlMML(ピコカキコ) MMLを書くためのエディタです。
[ここから](https://misosouP6250.github.io/FlMMLWriter)使用できます。  

## 動作確認済みブラウザ
・Chrome v51  
・Firefox v47  
・Edge  
その他、古いIE、Opera以外なら動くかと思います(未検証)。

## 使い方
・上の黒いテキストボックス  
　FlMMLの演奏データを入力するエディタ画面です。文法は[こちら](http://flmml.codeplex.com/wikipage?title=Reference)を参照してください。  
　例:T120 L8 o5 cdefgab&lt;c  
　　テンポ120 八分音符でドレミファソラシド  
　スマートフォンなどのタッチパネルでスクロールしたい場合は二本指で行ってください。  
  
・下の黒いテキストボックス  
　コンパイル時などの警告が表示されます。  
  
・ファイルを選択/参照/choose file等\(ブラウザによる\)  
　ローカルの演奏データ\(text\)を参照してエディタに開きます。
  
・Reloadボタン  
　ローカルデータを開きなおします。  
  
・Play/Pause/Stopボタン  
　順に再生/一時停止/停止ボタンです。  
  
・スライドバー  
　音量を調節できます。  
  
・スライドバー隣の領域  
　情報(音量、バッファ中、レンダリング中、再生時間など)が表示されます。  
  
・URL/No\.テキストフィールド  
　URLまたはピコカキコ番号を指定してテキストとしてエディタに開きます。  
　ここで開いたファイルの先頭にはコメントが挿入されます。  
  
・Filenameテキストフィールド  
　保存する際のファイル名を入力します。拡張子は自動で付与するので必要ありません。省略した場合は「flmml」となります。  
  
・Save\(\.mml/\.wav/\.mp3)ボタン  
　順にテキスト、wavファイル、mp3ファイルとしてローカルに保存\(ダウンロード\)します。  
　mp3としてダウンロードする場合、ブラウザ側のマシンで変換するのでスマートフォンなどではかなり時間がかかります。  
　wavは44.1kHz ステレオ、mp3は44.1kHz ステレオ 192kb/sです。  
  
・Editor - Highlightラジオボタン  
　エディタのハイライト　モード選択です。  
　・off: ハイライトしません  
　・delayed: 編集中は一時的にハイライトを切り、編集が終わると一定時間後にハイライトします。推奨  
　・realtime: 常にハイライトを更新します。マシンパワーが必要です。非推奨  

## Thanks
・[FlMML](https://flmml.codeplex.com/)  
・[FlMML on HTML5](https://github.com/carborane3/FlMMLonHTML5)  
・[lamejs](https://github.com/zhuker/lamejs)  
