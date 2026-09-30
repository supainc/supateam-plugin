# supateam plugin

supateam の Claude Code プラグインマーケットプレイスと、ローカルセッション履歴インポート CLI です。

- 使い方 (エンドユーザー向け): https://app.supateam.com/docs/local-history-import-guide
- 設計: supateam モノレポの `docs/adr/0022-local-session-history-import.md`

## インストール (Claude Code)

```
/plugin marketplace add supainc/supateam-plugin
/plugin install supateam@supateam
/supateam-import
```

## CLI を直接使う (Codex / ヘッドレス)

```bash
npx github:supainc/supateam-plugin login
npx github:supainc/supateam-plugin whoami
npx github:supainc/supateam-plugin link-member --member-id <id>   # または --create "名前"
npx github:supainc/supateam-plugin import --source all --dry-run
npx github:supainc/supateam-plugin import --source all
```

## 構成

```
.claude-plugin/marketplace.json          # マーケットプレイス定義
plugins/supateam/
  .claude-plugin/plugin.json             # プラグイン定義
  .mcp.json                              # supateam MCP (headersHelper で認証)
  skills/supateam-import/SKILL.md        # /supateam-import スキル
  scripts/supateam-cli.mjs               # 単一ファイルにバンドルした CLI (生成物)
```

`scripts/supateam-cli.mjs` はモノレポ `packages/cli` からビルドした生成物です。手で編集せず、
モノレポ側で `pnpm --filter @supateam/cli run build` → `sync:plugin` で更新してください。

## License

Apache-2.0. See `LICENSE`.
