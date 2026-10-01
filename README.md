# GitHub Diff Wide

GitHub の PR を Split 表示したとき、新規追加ファイルの左側の空白をなくす Chrome 拡張です。
新しい表示モードや設定画面は追加せず、対象ファイルのコード欄を自動で広げます。

```text
Before: [       空白       | 行番号 + 新規コード ]
After:  [ 行番号 + 新規コード                    ]
```

現在は ZIP を展開して読み込む試作版です。
Chrome Web Store には公開していません。
0.1.1 で新 PR 画面の行番号セル判定を修正しました。
ログイン後の `rename-ja` PR #1 で、新規ファイル4件の全幅化と変更ファイルの Split 維持を確認しました。
表示切替、行番号リンク、空のコメントフォームの開閉、Viewed、ファイルの折りたたみも確認しています。
検証結果と残る確認項目は [docs/verification.md](docs/verification.md) に記録しています。

## Chrome に読み込む

1. [最新の Release](https://github.com/tomatoaiu/github-diff-wide/releases/latest) から `github-diff-wide-<version>-chrome.zip` をダウンロードします。GitHub が自動生成する「Source code」ではありません。
2. ZIP を任意のフォルダに展開します。Node.js や pnpm のインストールは不要です。
3. Chrome で `chrome://extensions` を開きます。
4. 「デベロッパーモード」を有効にします。
5. 「パッケージ化されていない拡張機能を読み込む」で、展開先の `manifest.json` があるフォルダを選びます。
6. GitHub の PR ページを再読み込みし、「Files changed」で Split 表示を選びます。
7. ファイルツリーを表示し、新規ファイルがあるフォルダを展開します。

新規ファイル判定には、ファイルツリーの追加アイコンと diff へのリンクを使います。
ツリーの項目が DOM にない場合は、ファイルの状態を推測せず通常の表示を維持します。
幅が変わらない場合は、まずツリーの表示とフォルダの展開を確認してください。

更新時は新しい ZIP の内容で同じ展開先を上書きし、`chrome://extensions` で「GitHub Diff Wide」の再読み込みボタン（↻）を押してから GitHub のページを再読み込みします。
ZIP から読み込んだ拡張機能は自動更新されません。
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

ソースからビルドする場合は Node.js 24.13.0 と pnpm 11.20.0 を使用します。

```bash
git clone https://github.com/tomatoaiu/github-diff-wide.git
cd github-diff-wide
pnpm install --frozen-lockfile
pnpm build
```

Chrome には `.output/chrome-mv3` を読み込みます。
コード変更後は再ビルドし、拡張機能と GitHub のページを再読み込みします。

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

## ZIP の作成とリリース

ローカルで配布用 ZIP を作成するには `pnpm zip` を実行します。
生成先は `.output/github-diff-wide-<version>-chrome.zip` です。

[github-actions-explorer](https://github.com/tomatoaiu/github-actions-explorer) と同じリリース構成を使用しています。
Release Please が Conventional Commits をもとに次のバージョンを決め、リリース PR を作成します。
`fix` は patch、`feat` は minor、`!` または `BREAKING CHANGE` は major の変更として扱います。

リポジトリ所有者がリリース PR をマージすると、Release workflow が検証、ZIP 作成、署名付きビルド provenance の生成を行います。
単体テストと拡張機能を読み込むブラウザテストも、公開前に実行します。
公開するファイルは Chrome 用 ZIP と `SHA256SUMS` です。
公開後には Release と ZIP の署名検証も行います。

初回の `v0.1.1` は、所有者が **Actions → Release → Run workflow** から `main` を選び、`release_sha` を空欄にして作成します。
初回以降の手動実行では、マージ済みの Release Please PR のコミット SHA を `release_sha` に指定します。
既存のタグや Release は上書きしません。

リポジトリ設定の **Immutable Releases** と **Allow GitHub Actions to create and approve pull requests** を有効にして運用します。
workflow の既定権限は read のままにし、各 job が必要な権限だけを要求します。

GitHub CLI で初回の配布物を検証する例です。

```bash
gh release download v0.1.1 --repo tomatoaiu/github-diff-wide
sha256sum --check SHA256SUMS
gh release verify v0.1.1 --repo tomatoaiu/github-diff-wide
gh release verify-asset v0.1.1 github-diff-wide-0.1.1-chrome.zip \
  --repo tomatoaiu/github-diff-wide
gh attestation verify github-diff-wide-0.1.1-chrome.zip \
  --repo tomatoaiu/github-diff-wide
```
