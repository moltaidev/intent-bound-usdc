#!/usr/bin/env bash
# Run Clawd (OpenClaw) gateway on AWS EC2 and connect from your terminal.
# Prereqs: AWS CLI installed and configured (aws configure).
# Usage: ./aws-clawd-setup.sh

set -e
REGION="${AWS_REGION:-us-east-1}"
INSTANCE_TYPE="${INSTANCE_TYPE:-t3.small}"
KEY_NAME="${KEY_NAME:-clawd-key}"
SG_NAME="clawd-gateway-sg"
AMI_ID=$(aws ec2 describe-images --region "$REGION" --owners 099720109477 \
  --filters "Name=name,Values=ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*" "Name=state,Values=available" \
  --query "sort_by(Images, &CreationDate)[-1].ImageId" --output text)

echo "=== 1. Create key pair (if not exists) ==="
if ! aws ec2 describe-key-pairs --region "$REGION" --key-names "$KEY_NAME" 2>/dev/null; then
  aws ec2 create-key-pair --region "$REGION" --key-name "$KEY_NAME" --query 'KeyMaterial' --output text > "$KEY_NAME.pem"
  chmod 400 "$KEY_NAME.pem"
  echo "Saved $KEY_NAME.pem - keep it safe."
else
  echo "Key $KEY_NAME exists. Ensure you have the .pem file."
fi

echo "=== 2. Create security group (if not exists) ==="
SG_ID=$(aws ec2 describe-security-groups --region "$REGION" --filters "Name=group-name,Values=$SG_NAME" --query 'SecurityGroups[0].GroupId' --output text 2>/dev/null || true)
if [ "$SG_ID" = "None" ] || [ -z "$SG_ID" ]; then
  SG_ID=$(aws ec2 create-security-group --region "$REGION" --group-name "$SG_NAME" --description "Clawd gateway SSH + 18789" --query 'GroupId' --output text)
  aws ec2 authorize-security-group-ingress --region "$REGION" --group-id "$SG_ID" --protocol tcp --port 22 --cidr 0.0.0.0/0
  aws ec2 authorize-security-group-ingress --region "$REGION" --group-id "$SG_ID" --protocol tcp --port 18789 --cidr 0.0.0.0/0
  echo "Created security group $SG_ID"
fi

echo "=== 3. Launch EC2 instance ==="
INSTANCE_ID=$(aws ec2 run-instances --region "$REGION" \
  --image-id "$AMI_ID" \
  --instance-type "$INSTANCE_TYPE" \
  --key-name "$KEY_NAME" \
  --security-group-ids "$SG_ID" \
  --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=clawd-gateway}]" \
  --query 'Instances[0].InstanceId' --output text)
echo "Launched instance $INSTANCE_ID. Waiting for running..."
aws ec2 wait instance-running --region "$REGION" --instance-ids "$INSTANCE_ID"
PUBLIC_IP=$(aws ec2 describe-instances --region "$REGION" --instance-ids "$INSTANCE_ID" --query 'Reservations[0].Instances[0].PublicIpAddress' --output text)
echo "Public IP: $PUBLIC_IP"

echo "=== 4. Wait for SSH (60s) then install OpenClaw ==="
sleep 60
ssh -o StrictHostKeyChecking=no -i "$KEY_NAME.pem" "ubuntu@$PUBLIC_IP" bash -s << 'REMOTE'
set -e
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm install -g openclaw@latest
echo "OpenClaw installed. Start gateway with: openclaw gateway --allow-unconfigured"
REMOTE

echo ""
echo "=== Done ==="
echo "SSH:  ssh -i $KEY_NAME.pem ubuntu@$PUBLIC_IP"
echo "On EC2 run:  openclaw gateway --allow-unconfigured"
echo "From your Mac:  openclaw gateway status --url ws://$PUBLIC_IP:18789"
echo "Save this:  export OPENCLAW_GATEWAY_URL=ws://$PUBLIC_IP:18789"
