# Capsule Shelf

## 概要

ガチャガチャの発売予定、発売中のシリーズ、ラインナップ、所持数を写真つきで管理する静的Webアプリです。データはブラウザ内に保存されます。

## 主な機能

- 発売中と発売予定の2タブでガチャを管理
- ガチャ名、ラインナップ写真、発売月、発売週だけで登録
- 発売予定のガチャは、予定の週になったら自動で発売中へ移動
- ガチャごとに開閉できる詳細タブ
- ガチャごとのラインナップ登録
- ラインナップごとの写真登録
- サイト内でメイン写真からラインナップ画像を切り取り
- ラインナップの並べ替え
- ラインナップごとの所持数カウント
- 統計表示
- JSON形式でのデータ書き出し・読み込み
- スマホ、タブレット、PCに対応したレスポンシブ表示
- favicon、アプリアイコン、OGP画像、PWA用manifest、サービスワーカーを同梱

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

GitHub Pagesでは、`main` ブランチにpushするとGitHub Actionsで自動公開されます。静的公開用に `gh-pages` ブランチへ配置する運用にも対応しています。

Vercelでは、このリポジトリをインポートすると静的サイトとして配信できます。CLIを使う場合は `vercel --prod` を実行します。

Firebase Hostingでは、Firebaseプロジェクトを選択したあと `firebase use --add` を実行し、続けて `firebase deploy --only hosting` を実行します。

## ディレクトリ構成

```text
.
├── .github/
│   └── workflows/
│       └── pages.yml
├── assets/
│   ├── favicon.svg
│   ├── icon.svg
│   ├── icon-192.png
│   ├── icon-512.png
│   └── ogp.png
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

- 切り取り画像をあとから再編集できるようにする
- ガチャごとの価格やメーカーを登録できるようにする
- タグや店舗メモで絞り込めるようにする
- CSV書き出しに対応する
- クラウド同期やログイン機能を追加する
