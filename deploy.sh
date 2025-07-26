#!/bin/bash
# Simple deployment script

echo "Building production app..."
npm run build

echo "Starting production server..."
NODE_ENV=production nohup node dist/index.js > production.log 2>&1 &

echo "Production server started. Check production.log for status."
echo "Your widget is now available at:"
echo "https://c2762976-c4c0-459f-bf11-35e38350e63f-00-1jnaf32yrsc1f.spock.replit.dev/widget"