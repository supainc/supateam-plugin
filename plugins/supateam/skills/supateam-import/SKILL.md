---
name: supateam-import
description: Claude Code / Codex のローカルセッション履歴を supateam に取り込み、初日から AI 利用分析を見られるようにする。ユーザーが /supateam-import を呼ぶか、「supateam に履歴を取り込みたい」「OTel 設定前の分を分析したい」と言ったときに使う。送信前に必ず要約を見せ、プロンプト本文やツール出力は送らない。
---

# supateam 履歴インポート

同梱の CLI (`${CLAUDE_PLUGIN_ROOT}/scripts/supateam-cli.mjs`) を Bash で実行し、対話はあなた (Claude) が担当する。処理は CLI、判断はユーザーに委ねる。

コマンドは常に次の形で呼ぶ (Node.js 20 以上が必要):

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/supateam-cli.mjs" <command> [options]
```

## 手順

### 1. ログイン状態を確認する

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/supateam-cli.mjs" whoami --json
```

- 「not logged in」「expired」で失敗したら `login` を実行する。ブラウザが開くので、supateam にログインした状態で「許可する」を押すようユーザーに伝える。完了まで待つ (最大 10 分)。
- ローカル開発や別環境に接続する場合だけ `--api-url` / `--app-url` を付ける。

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/supateam-cli.mjs" login
```

### 2. 自分のメンバーを確定する

`whoami --json` の結果を見て分岐する。

- `linkedMemberId` がある: 紐づけ済み。手順 3 へ。
- `match` がある (`via: "email"`): 「あなたは **{memberName}** として登録されています。このメンバーで進めてよいですか？」と確認し、OK なら `link-member --member-id <memberId>` を実行する。
- `match` が無い: `members` 一覧 (名前と workEmails) を見せ、**自分に該当するメンバーを選ぶ**か、**新規メンバーを作成する**かを AskUserQuestion で選ばせる。
  - 既存を選んだ: `link-member --member-id <id>`
  - 新規作成: 表示名を確認し `link-member --create "<名前>"` (既定はユーザーの表示名 `user.name`)
- `link-member` が 403 `member_owned_by_other` で失敗したら、「そのメンバーには既に別のメールアドレスが登録されているため、紐づけは管理者に依頼してください」と伝えて終了する。409 `token_already_linked` も同様に管理者へ。

### 3. 送信内容を確認して取り込む

まず、この組織で OTel 連携が既に動いているかを確認する。`whoami --json` の `otelKeyCreatedAt` が null でなければ OTel 用キーが発行済みなので、「Claude Code / Codex の OTel 送信を既に設定していますか？ 設定しているなら、いつからですか？」と尋ねる。設定済みなら、その設定日の**前日**を `--until YYYY-MM-DD` に指定して重なる期間を二重計上しないようにする (OTel が届いている期間は OTel を正とする)。未設定なら `--until` は不要。

次に dry-run で要約だけ出す。

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/supateam-cli.mjs" import --source all --dry-run
```

要約 (ツール別のセッション数・イベント数・期間・サイズ・送る属性キー・単価不明モデルの警告) をそのままユーザーに見せ、次を明示する:

- 送るもの: セッション ID、日時、モデル、トークン数、推定コスト、指示の回数と文字数、Bash コマンド、編集ファイルパス、ブランチ / PR 番号
- 送らないもの: プロンプト本文、ツール出力、reasoning、ファイル内容

ユーザーが承認したら送信する。

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/supateam-cli.mjs" import --source all --yes
```

期間を絞りたい場合は `--since YYYY-MM-DD` / `--until YYYY-MM-DD`、Claude Code だけなら `--source claude-code`、Codex だけなら `--source codex`。

### 4. 結果を伝える

完了メッセージ (送信したセッション数と期間、再集計ワークフローの ID) を要約し、「数分〜十数分で supateam のチーム詳細画面 (AI活用分析 / PR・セッション分析) に反映されます」と伝える。再実行しても送信済みの記録は二重送信されないことも添える。

## 注意

- ユーザーの承認なしに `import --yes` を実行しない。
- CLI の出力に含まれるメールアドレス以外の個人情報を勝手に要約に足さない。
- 失敗時は CLI の stderr をそのまま示し、`login` のやり直しか管理者への依頼のどちらかを案内する。
- 詳細ガイド: https://app.supateam.com/docs/local-history-import-guide
