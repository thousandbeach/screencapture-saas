# Cloud Run用 Puppeteer API Dockerfile (Multi-stage build)

# ========================================
# Stage 1: Dependencies
# ========================================
FROM node:20-slim AS deps

WORKDIR /app

# package.jsonとpackage-lock.jsonをコピー
COPY package*.json ./

# 依存関係をインストール（本番用のみ）
RUN npm ci --only=production && \
    npm cache clean --force

# ========================================
# Stage 2: Runtime
# ========================================
FROM node:20-slim AS runtime

# Puppeteer用の依存関係をインストール
RUN apt-get update && apt-get install -y \
    wget \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

WORKDIR /app

# 依存関係を前のステージからコピー
COPY --from=deps /app/node_modules ./node_modules

# アプリケーションコードをコピー
COPY index.js ./

# 非rootユーザーで実行（セキュリティ強化）
RUN groupadd -r nodejs && useradd -r -g nodejs nodejs && \
    chown -R nodejs:nodejs /app
USER nodejs

# ポート設定
ENV PORT=8080
EXPOSE 8080

# アプリケーション起動
CMD ["node", "index.js"]