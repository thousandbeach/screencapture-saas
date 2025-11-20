#!/bin/bash
set -e

# 設定値
PROJECT_ID="spc-kakegawa"
REPO_OWNER="thousandbeach"
REPO_NAME="screencapture-saas"
POOL_NAME="github-pool"
PROVIDER_NAME="github-provider"
SERVICE_ACCOUNT_NAME="github-actions-runner"

echo "🔧 Workload Identity Federationのセットアップを開始します..."
echo ""
echo "プロジェクトID: $PROJECT_ID"
echo "GitHubリポジトリ: $REPO_OWNER/$REPO_NAME"
echo ""

# 1. Workload Identity Poolの作成
echo "📦 Step 1: Workload Identity Poolを作成..."
gcloud iam workload-identity-pools create $POOL_NAME \
  --project=$PROJECT_ID \
  --location=global \
  --display-name="GitHub Actions Pool" \
  --description="Pool for GitHub Actions authentication" \
  2>/dev/null || echo "  ✓ Pool already exists"

# 2. GitHub Providerの作成
echo "🔐 Step 2: GitHub Providerを作成..."
gcloud iam workload-identity-pools providers create-oidc $PROVIDER_NAME \
  --project=$PROJECT_ID \
  --location=global \
  --workload-identity-pool=$POOL_NAME \
  --display-name="GitHub Provider" \
  --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository,attribute.repository_owner=assertion.repository_owner" \
  --attribute-condition="assertion.repository_owner=='$REPO_OWNER'" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  2>/dev/null || echo "  ✓ Provider already exists"

# 3. サービスアカウントの作成
echo "👤 Step 3: サービスアカウントを作成..."
gcloud iam service-accounts create $SERVICE_ACCOUNT_NAME \
  --project=$PROJECT_ID \
  --display-name="GitHub Actions Runner" \
  --description="Service account for GitHub Actions deployments" \
  2>/dev/null || echo "  ✓ Service account already exists"

# 4. サービスアカウントに権限を付与
echo "🔑 Step 4: サービスアカウントに権限を付与..."
SERVICE_ACCOUNT_EMAIL="${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
  --role="roles/run.admin" \
  --condition=None \
  > /dev/null

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
  --role="roles/artifactregistry.writer" \
  --condition=None \
  > /dev/null

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
  --role="roles/iam.serviceAccountUser" \
  --condition=None \
  > /dev/null

echo "  ✓ 権限付与完了"

# 5. Workload Identity PoolとService Accountを紐付け
echo "🔗 Step 5: Workload Identity PoolとService Accountを紐付け..."
WORKLOAD_IDENTITY_POOL_ID="projects/${PROJECT_ID}/locations/global/workloadIdentityPools/${POOL_NAME}"

gcloud iam service-accounts add-iam-policy-binding $SERVICE_ACCOUNT_EMAIL \
  --project=$PROJECT_ID \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/${WORKLOAD_IDENTITY_POOL_ID}/attribute.repository/${REPO_OWNER}/${REPO_NAME}" \
  > /dev/null

echo "  ✓ 紐付け完了"

# 6. GitHub Secretsに設定する値を出力
echo ""
echo "✅ セットアップ完了！"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 GitHub Secretsに以下の値を設定してください:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "GCP_PROJECT_ID:"
echo "$PROJECT_ID"
echo ""
echo "GCP_WORKLOAD_IDENTITY_PROVIDER:"
gcloud iam workload-identity-pools providers describe $PROVIDER_NAME \
  --project=$PROJECT_ID \
  --location=global \
  --workload-identity-pool=$POOL_NAME \
  --format="value(name)"
echo ""
echo "GCP_SERVICE_ACCOUNT:"
echo "$SERVICE_ACCOUNT_EMAIL"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"