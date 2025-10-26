import { Section, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout } from '../components/EmailLayout';
import { Header } from '../components/Header';
import { Button } from '../components/Button';
import { Footer } from '../components/Footer';

interface ConfirmEmailProps {
  confirmationUrl: string;
  email: string;
}

export const ConfirmEmail = ({
  confirmationUrl = 'https://screencapture-saas.vercel.app/auth/callback?token=sample-token',
  email = 'user@example.com',
}: ConfirmEmailProps) => {
  return (
    <EmailLayout preview="メールアドレスを確認してアカウントを有効化してください">
      <Header title="メールアドレスの確認" />

      <Section style={content}>
        <Text style={paragraph}>
          こんにちは！
        </Text>

        <Text style={paragraph}>
          <strong>{email}</strong> でScreenCapture SaaSに登録いただき、ありがとうございます。
        </Text>

        <Text style={paragraph}>
          以下のボタンをクリックして、メールアドレスを確認してください。
        </Text>

        <Section style={buttonContainer}>
          <Button href={confirmationUrl}>
            メールアドレスを確認
          </Button>
        </Section>

        <Text style={note}>
          このリンクは24時間有効です。期限切れの場合は、再度サインアップしてください。
        </Text>

        <Text style={paragraph}>
          このメールに心当たりがない場合は、このメールを無視してください。
        </Text>
      </Section>

      <Footer />
    </EmailLayout>
  );
};

export default ConfirmEmail;

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