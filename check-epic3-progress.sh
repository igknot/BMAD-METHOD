#!/bin/bash

echo "🏃 Epic 3 Progress Monitor"
echo "=========================="
echo ""

while true; do
  clear
  echo "🏃 Epic 3 Progress Monitor - $(date '+%H:%M:%S')"
  echo "=========================="
  echo ""
  
  # Check dev agent status
  echo "📊 Dev Agent Status:"
  kiro-cli chat --agent bmad-bmm-dev --message "status" 2>/dev/null || echo "  Agent not responding or task complete"
  echo ""
  
  # Check current story status from sprint-status.yaml
  echo "📋 Sprint Status (Epic 3):"
  grep -A 6 "# Epic 3:" _bmad-output/implementation-artifacts/sprint-status.yaml | tail -6
  echo ""
  
  echo "Press Ctrl+C to stop monitoring"
  echo "Next check in 30 seconds..."
  sleep 30
done
