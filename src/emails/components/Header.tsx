import { Heading, Section } from '@react-email/components';
import * as React from 'react';

interface HeaderProps {
  title: string;
}

export const Header = ({ title }: HeaderProps) => {
  return (
    <Section style={header}>
      <div style={logoContainer}>
        <div style={logo}>
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle
              cx="12"
              cy="13"
              r="3"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <Heading style={heading}>ScreenCapture SaaS</Heading>
      </div>
      <Heading as="h2" style={subtitle}>
        {title}
      </Heading>
    </Section>
  );
};

const header = {
  padding: '32px 40px',
  textAlign: 'center' as const,
};

const logoContainer = {
  textAlign: 'center' as const,
  marginBottom: '16px',
};

const logo = {
  display: 'inline-block',
  borderRadius: '12px',
  background: 'linear-gradient(135deg, #00AAFF 0%, #5555FF 100%)',
  padding: '12px',
  lineHeight: '0',
  marginBottom: '16px',
  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
};

const heading = {
  fontSize: '24px',
  fontWeight: '700',
  color: '#1e293b',
  margin: '0',
  background: 'linear-gradient(135deg, #00AAFF 0%, #5555FF 100%)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
};

const subtitle = {
  fontSize: '20px',
  fontWeight: '600',
  color: '#334155',
  margin: '16px 0 0 0',
};