import { Section, Text, Link } from '@react-email/components';
import * as React from 'react';
import { EmailLayout } from '../components/EmailLayout';
import { Header } from '../components/Header';
import { Button } from '../components/Button';
import { Footer } from '../components/Footer';

interface WelcomeProps {
  name?: string;
  dashboardUrl: string;
}

export const Welcome = ({
  name,
  dashboardUrl = 'https://screencapture-saas.vercel.app',
}: WelcomeProps) => {
  return (
    <EmailLayout preview="ScreenCapture SaaSへようこそ！">
      <Header title="ようこそ！" />

      <Section style={content}>
        <Text style={paragraph}>
          {name ? `${name}さん、` : 'こんにちは！'}
        </Text>

        <Text style={paragraph}>
          ScreenCapture SaaSへようこそ！アカウントの作成が完了しました。
        </Text>

        <Text style={paragraph}>
          当サービスでは、最大300ページのWebサイトスクリーンショットを
          デスクトップ・タブレット・モバイルの3つのデバイスで取得できます。
        </Text>

        <Section style={featureBox}>
          <Text style={featureTitle}>✨ 主な機能</Text>
          <Text style={featureItem}>
            📸 最大300ページのスクリーンショット取得
          </Text>
          <Text style={featureItem}>
            📱 マルチデバイス対応（デスクトップ/タブレット/モバイル）
          </Text>
          <Text style={featureItem}>
            📦 最大48時間限定でZIPダウンロード可能
          </Text>
          <Text style={featureItem}>
            ⭐ お気に入りサイトからワンクリック再実行
          </Text>
          <Text style={featureItem}>
            📊 取得履歴の永久保存
          </Text>
        </Section>

        <Section style={buttonContainer}>
          <Button href={dashboardUrl}>
            ダッシュボードを開く
          </Button>
        </Section>

        <Text style={note}>
          💡 ヒント: 取得した画像は最大48時間でサーバーから自動削除されますが、
          履歴は永久に保存されるため、いつでも再実行できます。
        </Text>

        <Text style={paragraph}>
          ご質問やフィードバックがございましたら、お気軽に
          <Link href="mailto:support@screencapture-saas.com" style={link}>
            サポート
          </Link>
          までご連絡ください。
        </Text>
      </Section>

      <Footer />
    </EmailLayout>
  );
};

export default Welcome;

const content = {
  padding: '0 40px',
};

const paragraph = {
  fontSize: '16px',
  lineHeight: '26px',
  color: '#334155',
  margin: '16px 0',
};

const buttonContainer = {
  textAlign: 'center' as const,
  margin: '32px 0',
};

const note = {
  fontSize: '14px',
  lineHeight: '22px',
  color: '#64748b',
  backgroundColor: '#f1f5f9',
  padding: '16px',
  borderRadius: '8px',
  margin: '24px 0',
  borderLeft: '4px solid #00AAFF',
};

const featureBox = {
  backgroundColor: '#f8fafc',
  padding: '24px',
  borderRadius: '12px',
  margin: '24px 0',
  border: '1px solid #e2e8f0',
};

const featureTitle = {
  fontSize: '18px',
  fontWeight: '600',
  color: '#1e293b',
  margin: '0 0 16px 0',
};

const featureItem = {
  fontSize: '15px',
  lineHeight: '28px',
  color: '#475569',
  margin: '8px 0',
};

const link = {
  color: '#00AAFF',
  textDecoration: 'underline',
};