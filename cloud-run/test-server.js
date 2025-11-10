/**
 * ローカルテスト用サーバー起動スクリプト
 *
 * 使い方:
 * 1. .env.testに実際の値を設定
 * 2. node test-server.js
 * 3. ブラウザで http://localhost:8080/health にアクセス
 */

require('dotenv').config({ path: '.env.test' });

// 環境変数チェック
const requiredEnvVars = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY'
];

const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error('❌ 必要な環境変数が設定されていません:');
  missingEnvVars.forEach(varName => {
    console.error(`   - ${varName}`);
  });
  console.error('\n.env.testファイルを確認してください。');
  process.exit(1);
}

console.log('✅ 環境変数チェック完了');
console.log('📋 設定:');
console.log(`   SUPABASE_URL: ${process.env.SUPABASE_URL}`);
console.log(`   VERCEL_URL: ${process.env.VERCEL_URL || 'http://localhost:3001'}`);
console.log(`   PORT: ${process.env.PORT || 8080}`);
console.log('');

// index.jsを読み込んで実行
require('./index.js');