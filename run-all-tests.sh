#!/bin/bash

echo "🚀 AI Call Center - Comprehensive Test Suite"
echo "=============================================="
echo ""

# Check if services are running
echo "📋 Checking service status..."
pm2 status

echo ""
echo "🧪 Running System Tests..."
echo "=========================="
node test-system.js

echo ""
echo "🎨 Running UI Functionality Tests..."
echo "===================================="
node test-ui-functionality.js

echo ""
echo "🔌 Running API Endpoint Tests..."
echo "================================"
node test-api-endpoints.js

echo ""
echo "🏭 Running Production Readiness Check..."
echo "========================================"
node production-readiness-check.js

echo ""
echo "✅ All tests completed!"
echo "======================="
echo ""
echo "📞 SYSTEM READY FOR TESTING:"
echo "Call: +1 (818) 600-6909"
echo "Frontend: https://work-1-okavkedynbgvzfwe.prod-runtime.all-hands.dev"
echo "Backend: https://work-2-okavkedynbgvzfwe.prod-runtime.all-hands.dev"
echo ""
echo "🔍 Monitor calls with: pm2 logs ai-call-backend --lines 0"