# Capsule Shelf

## 概要

ガチャガチャのコレクションを管理するための静的Webサイトです。持っているアイテム、個数、シリーズ、レア度、入手日、メモ、ほしいものをブラウザ内に保存できます。

## 主な機能

- 持っているガチャの登録・編集・削除
- 名前、シリーズ、メモでの検索
- 新しい順、名前順、シリーズ順、個数順の並び替え
- ほしいものリストの管理
- 総数、シリーズ数、シークレット数、シリーズ別個数の統計表示
- JSON形式でのデータ書き出し・読み込み
- スマホ、タブレット、PCに対応したレスポンシブ表示
- favicon、アプリアイコン、OGP画像、PWA用manifestを同梱

## 使用技術

- HTML
- CSS
- JavaScript
- LocalStorage

## 起動方法

`index.html` をブラウザで開くと利用できます。

ローカルサーバーで確認する場合は、プロジェクトフォルダで以下を実行してください。

```bash
python -m http.server 8000
```

その後、ブラウザで `http://localhost:8000` を開きます。

## デプロイ

GitHub Pagesでは、`main` ブランチにpushするとGitHub Actionsで自動公開されます。

Vercelでは、このリポジトリをインポートすると静的サイトとして配信できます。CLIを使う場合は `vercel --prod` を実行します。

Firebase Hostingでは、Firebaseプロジェクトを選択したあと `firebase use --add` を実行し、続けて `firebase deploy --only hosting` を実行します。

## ディレクトリ構成

```text
.
├── assets/
│   ├── favicon.svg
│   ├── icon.svg
│   ├── icon-192.png
│   ├── icon-512.png
│   └── ogp.png
├── .github/
│   └── workflows/
│       └── pages.yml
├── app.js
├── firebase.json
├── index.html
├── manifest.webmanifest
├── package.json
├── README.md
├── sw.js
├── styles.css
└── vercel.json
```

## 今後の改善案

- 画像アップロード機能を追加する
- タグや設置店舗で絞り込めるようにする
- 交換候補だけを表示するタブを追加する
- CSV書き出しに対応する
- クラウド同期やログイン機能を追加する
