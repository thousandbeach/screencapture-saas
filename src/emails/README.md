# メールテンプレート設定ガイド

## HTMLの生成

```bash
pnpm run email:export
```

`.email-output/` ディレクトリにHTMLファイルが生成されます。

## Supabaseでの設定手順

### 1. Supabase Dashboardにアクセス

1. https://supabase.com/dashboard にアクセス
2. プロジェクトを選択
3. **Authentication** → **Email Templates** をクリック

### 2. メールアドレス確認テンプレート設定

**テンプレート:** `Confirm signup`

**手動で置き換える箇所:**

`.email-output/ConfirmEmail.html` を開き、以下を置き換えてからSupabaseに貼り付け：

| 置き換え前 | 置き換え後 |
|-----------|-----------|
| `user@example.com` | `{{ .Email }}` |
| `https://screencapture-saas.vercel.app/auth/callback?token=sample-token` | `{{ .ConfirmationURL }}` |

**設定箇所:**
1. Email templatesページで「Confirm signup」を選択
2. 上記を置き換えたHTMLを「Message (HTML)」欄に貼り付け
3. 「Save」をクリック

### 3. パスワードリセットテンプレート設定

**テンプレート:** `Reset Password`

**手動で置き換える箇所:**

`.email-output/ResetPassword.html` を開き、以下を置き換えてからSupabaseに貼り付け：

| 置き換え前 | 置き換え後 |
|-----------|-----------|
| `user@example.com` | `{{ .Email }}` |
| `https://screencapture-saas.vercel.app/auth/reset-password?token=sample-token` | `{{ .ConfirmationURL }}` |

**設定箇所:**
1. Email templatesページで「Reset Password」を選択
2. 上記を置き換えたHTMLを「Message (HTML)」欄に貼り付け
3. 「Save」をクリック

### 4. ウェルカムメールは現時点で未使用

Welcome.html は将来的に使用予定です。現時点ではSupabaseに設定不要です。

## 利用可能なSupabase変数

Supabaseのメールテンプレートで使用できる変数：

- `{{ .Email }}` - ユーザーのメールアドレス
- `{{ .ConfirmationURL }}` - 確認URL（トークン付き）
- `{{ .Token }}` - トークン
- `{{ .TokenHash }}` - トークンハッシュ
- `{{ .SiteURL }}` - サイトURL

## テスト方法

1. アプリケーションで新規登録を実行
2. 受信したメールのデザインを確認
3. 必要に応じてReact EmailテンプレートMを修正
4. `pnpm run email:export` で再ビルド
5. Supabaseに再設定

## プレビュー

ローカルでプレビューを確認：

```bash
pnpm run email
```

http://localhost:3000 (または自動選択されたポート) でプレビュー表示されます。