#!/bin/bash

STORIES=("3-1" "3-2" "3-3" "3-4" "3-5")
STORY_NAMES=(
  "generate-workflow-command-files"
  "workflow-commands-reference-correct-source-paths"
  "generate-commands-for-all-20-workflows"
  "generate-task-command-files"
  "generate-tool-command-files"
)

echo "🏃 Epic 3 Orchestration Starting"
echo "================================="
echo ""

for i in "${!STORIES[@]}"; do
  STORY_ID="${STORIES[$i]}"
  STORY_NAME="${STORY_NAMES[$i]}"
  STORY_FILE="_bmad-output/implementation-artifacts/${STORY_ID}-${STORY_NAME}.md"
  
  echo "📋 Story ${STORY_ID}: ${STORY_NAME}"
  echo "---"
  
  # Launch dev agent
  echo "🚀 Launching dev agent..."
  kiro-cli chat --agent bmad-bmm-dev --message "Implement Story ${STORY_ID}: ${STORY_NAME}

Story file: ${STORY_FILE}

Requirements:
- Read the story file completely
- Implement all acceptance criteria
- Complete all tasks/subtasks
- Test installation to ~/work/test-install
- Update story file with completion notes
- Mark story as 'review' when complete"
  
  echo "✅ Story ${STORY_ID} delegated"
  echo ""
done

echo "🎉 All Epic 3 stories delegated!"
