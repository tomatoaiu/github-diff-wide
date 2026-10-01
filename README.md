# GitHub Diff Wide

GitHub の PR を Split 表示したとき、新規追加ファイルの左側の空白をなくす Chrome 拡張です。
新しい表示モードや設定画面は追加せず、対象ファイルのコード欄を自動で広げます。

```text
Before: [       空白       | 行番号 + 新規コード ]
After:  [ 行番号 + 新規コード                    ]
```

現在はローカル読み込み用の試作版です。
0.1.1 で新 PR 画面の行番号セル判定を修正しました。
ログイン後の `rename-ja` PR #1 で、新規ファイル4件の全幅化と変更ファイルの Split 維持を確認しました。
表示切替、行番号リンク、空のコメントフォームの開閉、Viewed、ファイルの折りたたみも確認しています。
検証結果と残る確認項目は [docs/verification.md](docs/verification.md) に記録しています。

## Chrome に読み込む

Node.js 24.13.0 と pnpm 11.20.0 を使用します。

```bash
pnpm install --frozen-lockfile
pnpm exec wxt prepare
pnpm build
```

1. Chrome で `chrome://extensions` を開きます。
2. 「デベロッパーモード」を有効にします。
3. 「パッケージ化されていない拡張機能を読み込む」で `.output/chrome-mv3` を選びます。
4. GitHub の PR ページを再読み込みし、「Files changed」で Split 表示を選びます。
5. ファイルツリーを表示し、新規ファイルがあるフォルダを展開します。

新規ファイル判定には、ファイルツリーの追加アイコンと diff へのリンクを使います。
ツリーの項目が DOM にない場合は、ファイルの状態を推測せず通常の表示を維持します。
幅が変わらない場合は、まずツリーの表示とフォルダの展開を確認してください。

コード変更後は `pnpm build` を実行し、`chrome://extensions` で「GitHub Diff Wide」の再読み込みボタン（↻）を押してから GitHub のページを再読み込みします。
拡張機能を無効にしてページを再読み込みすれば、元の表示に戻ります。

## 対象と対象外

- 対象は `https://github.com/<owner>/<repo>/pull/<number>/files` と `/changes` の Split 表示です。
- GitHub が新規追加と示すテキストファイルだけを広げます。
- 既存ファイルへの追加行だけの変更、削除、リネーム、Unified 表示は変更しません。
- コミット詳細、Compare、GitHub Enterprise、画像、バイナリは対象外です。
- 未知の表構造や左側に内容がある diff は変更しません。

## 実装と権限

`github-review-kaomoji` と同じ WXT、TypeScript、Vitest の構成を使用しています。
本番ビルドにバックグラウンド処理、設定用ストレージ、外部通信はありません。
追加の Chrome API 権限も要求しません。

コンテンツスクリプトは github.com 全体に読み込まれます。
GitHub はページ全体を読み直さず PR へ移動できるためです。
実際の監視と表示変更は、対象の PR diff URL に限定しています。

拡張機能は diff 表に専用属性を付け、CSS で空の左2列をゼロ幅にします。
コード、行番号、コメントのノードや `colspan` は変更しません。

## 開発とテスト

```bash
pnpm dev
pnpm test
pnpm exec playwright install chromium
pnpm check
```

`pnpm check` は整形、lint、型検査、単体テスト、ビルド、ブラウザテストを実行します。
ブラウザテストはビルド済み拡張を Chromium に読み込み、ローカルの fixture で検証します。
GitHub へのログインやコメント投稿は行いません。
既存の Chromium を使う場合は `CHROMIUM_PATH=/absolute/path/to/chrome pnpm check` と指定できます。

ブラウザ調査には `agent-browser` 0.38.1 を使用しています。
対話的な検証では、取得済みの CLI 本体を直接起動します。
この環境の `pnpm dlx` は一時プロキシをブラウザへ引き継がせるため、コマンド終了後にブラウザの通信が切れました。
拡張機能を利用するために `agent-browser` をインストールする必要はありません。
