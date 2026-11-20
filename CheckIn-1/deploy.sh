#!/usr/bin/env bash
set -e

echo "=================================================="
echo "    Deploying CheckIn to Google Cloud Run        "
echo "=================================================="

# Check for gcloud CLI
if ! command -v gcloud &> /dev/null; then
  echo ""
  echo "❌ Error: gcloud command not found."
  echo "Please install Google Cloud SDK: https://cloud.google.com/sdk/docs/install"
  echo "Then run: gcloud auth login"
  exit 1
fi

# Load .env if present
if [ -f .env ]; then
  # Export vars without breaking on comments
  export $(grep -E '^[A-Za-z0-9_]+=' .env | xargs)
fi

PROJECT_ID=$(gcloud config get-value project 2>/dev/null || echo "")
if [ -z "$PROJECT_ID" ]; then
  read -p "Enter your Google Cloud Project ID: " PROJECT_ID
  gcloud config set project "$PROJECT_ID"
fi

REGION=${CLOUD_RUN_REGION:-"us-central1"}
SERVICE_NAME="checkin-call"

echo "Project: $PROJECT_ID"
echo "Region:  $REGION"
echo "Service: $SERVICE_NAME"
echo ""

# Deploy directly from source via Google Cloud Build + Cloud Run
gcloud run deploy "$SERVICE_NAME" \
  --source . \
  --platform managed \
  --region "$REGION" \
  --allow-unauthenticated \
  --set-env-vars "LIVEKIT_URL=${LIVEKIT_URL},LIVEKIT_API_KEY=${LIVEKIT_API_KEY},LIVEKIT_API_SECRET=${LIVEKIT_API_SECRET}"

echo ""
echo "=================================================="
echo "  ✅ CheckIn successfully deployed to Cloud Run!  "
echo "=================================================="
