import { Section, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout } from '../components/EmailLayout';
import { Header } from '../components/Header';
import { Button } from '../components/Button';
import { Footer } from '../components/Footer';

interface ResetPasswordProps {
  resetUrl: string;
  email: string;
}

export const ResetPassword = ({
  resetUrl = 'https://screencapture-saas.vercel.app/auth/reset-password?token=sample-token',
  email = 'user@example.com',
}: ResetPasswordProps) => {
  return (
    <EmailLayout preview="パスワードをリセットしてください">
      <Header title="パスワードのリセット" />

      <Section style={content}>
        <Text style={paragraph}>
          こんにちは！
        </Text>

        <Text style={paragraph}>
          <strong>{email}</strong> のパスワードリセットリクエストを受け付けました。
        </Text>

        <Text style={paragraph}>
          以下のボタンをクリックして、新しいパスワードを設定してください。
        </Text>

        <Section style={buttonContainer}>
          <Button href={resetUrl}>
            パスワードをリセット
          </Button>
        </Section>

        <Text style={note}>
          このリンクは1時間有効です。期限切れの場合は、再度パスワードリセットをリクエストしてください。
        </Text>

        <Text style={warning}>
          <strong>⚠️ セキュリティ上の注意</strong>
          <br />
          このリクエストに心当たりがない場合は、このメールを無視してください。
          パスワードは変更されません。
        </Text>

        <Text style={paragraph}>
          アカウントのセキュリティが心配な場合は、すぐにサポートにお問い合わせください。
        </Text>
      </Section>

      <Footer />
    </EmailLayout>
  );
};

export default ResetPassword;

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

const warning = {
  fontSize: '14px',
  lineHeight: '22px',
  color: '#dc2626',
  backgroundColor: '#fef2f2',
  padding: '16px',
  borderRadius: '8px',
  margin: '24px 0',
  borderLeft: '4px solid #dc2626',
};