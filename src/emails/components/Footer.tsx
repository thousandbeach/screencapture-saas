import { Hr, Link, Section, Text } from '@react-email/components';
import * as React from 'react';

export const Footer = () => {
  return (
    <>
      <Hr style={hr} />
      <Section style={footer}>
        <Text style={footerText}>
          このメールは ScreenCapture SaaS から自動送信されています。
        </Text>
        <Text style={footerText}>
          ご質問がある場合は、
          <Link href="mailto:support@screencapture-saas.com" style={link}>
            サポート
          </Link>
          までお問い合わせください。
        </Text>
        <Text style={copyright}>
          © {new Date().getFullYear()} ScreenCapture SaaS. All rights reserved.
        </Text>
      </Section>
    </>
  );
};

const hr = {
  borderColor: '#e2e8f0',
  margin: '32px 0',
};

const footer = {
  padding: '0 40px 32px',
  textAlign: 'center' as const,
};

const footerText = {
  color: '#64748b',
  fontSize: '14px',
  lineHeight: '24px',
  margin: '8px 0',
};

const link = {
  color: '#00AAFF',
  textDecoration: 'underline',
};

const copyright = {
  color: '#94a3b8',
  fontSize: '12px',
  margin: '16px 0 0 0',
};