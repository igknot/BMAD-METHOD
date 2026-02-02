# Epic 4 Orchestration Prompt

I want you to orchestrate the development of **Epic 4 (Installation Lifecycle & Cross-Platform Quality)**.

## Context

**Previous Work:**
- Epic 1: ✅ Kiro Installer Architecture Foundation (4 stories)
- Epic 2: ✅ Agent Generation with Schema Validation (5 stories)
- Epic 3: ✅ Workflow & Task Command Generation (5 stories)

**Current Status:**
- Epic 4 has 8 stories ready for development
- All story files exist in `_bmad-output/implementation-artifacts/`
- Sprint status tracked in `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Epic 4 Stories

1. **4-1:** Detect Kiro as Available IDE Target
2. **4-2:** Generate All Artifacts to Kiro Directories
3. **4-3:** Display Installation Summary
4. **4-4:** Implement Cleanup for Kiro Agents Directory
5. **4-5:** Implement Cleanup for Kiro Commands Directory
6. **4-6:** Ensure Cross-Platform Path Handling
7. **4-7:** Prevent Partial Installations
8. **4-8:** Add Installation and Schema Validation Tests

## Workflow to Follow

For each story (4-1 through 4-8):

1. **Delegate to Dev Agent** (`bmad-bmm-dev`)
   - Use `use_subagent` tool (synchronous, blocking)
   - Provide story file path: `_bmad-output/implementation-artifacts/{story-id}-{story-name}.md`
   - Include testing instruction: "Test using: node test-kiro-install.js"
   - Request story marked as 'review' when complete

2. **Update Sprint Status**
   - Mark completed story as `done` in `sprint-status.yaml`

3. **Continue to Next Story**
   - Repeat process for next story in sequence

4. **Mark Epic Complete**
   - When all 8 stories done, mark `epic-4: done` in sprint status

## Non-Interactive Testing

**Test Script:** `test-kiro-install.js`

This script bypasses interactive prompts and tests the Kiro installation directly:

```bash
node test-kiro-install.js
```

**What it does:**
- Creates test installation in `~/work/test-install`
- Calls KiroCliSetup.setup() directly (no prompts)
- Reports: agent count, workflow count, task count, tool count
- Shows output location and file counts

**Include this in all dev agent instructions** so they can test without manual intervention.

## Key Files

**Sprint Status:**
```
_bmad-output/implementation-artifacts/sprint-status.yaml
```

**Story Files:**
```
_bmad-output/implementation-artifacts/4-1-detect-kiro-as-available-ide-target.md
_bmad-output/implementation-artifacts/4-2-generate-all-artifacts-to-kiro-directories.md
_bmad-output/implementation-artifacts/4-3-display-installation-summary.md
_bmad-output/implementation-artifacts/4-4-implement-cleanup-for-kiro-agents-directory.md
_bmad-output/implementation-artifacts/4-5-implement-cleanup-for-kiro-commands-directory.md
_bmad-output/implementation-artifacts/4-6-ensure-cross-platform-path-handling.md
_bmad-output/implementation-artifacts/4-7-prevent-partial-installations.md
_bmad-output/implementation-artifacts/4-8-add-installation-and-schema-validation-tests.md
```

**Test Script:**
```
test-kiro-install.js
```

**Main Implementation File:**
```
tools/cli/installers/lib/ide/kiro-cli.js
```

## Example Dev Agent Invocation

```javascript
use_subagent({
  command: "InvokeSubagents",
  content: {
    subagents: [{
      agent_name: "bmad-bmm-dev",
      query: `Implement Story 4-1: Detect Kiro as Available IDE Target

Story file: /Users/philip.louw/work/BMAD-METHOD/_bmad-output/implementation-artifacts/4-1-detect-kiro-as-available-ide-target.md

Requirements:
- Read the story file completely
- Implement all acceptance criteria
- Complete all tasks/subtasks
- Test using: node test-kiro-install.js
- Update story file with completion notes
- Mark story as 'review' when complete

Context:
- Epic 3 completed: workflow/task command generation working
- This is the first story in Epic 4
- Focus on IDE detection and availability
- Test script: node test-kiro-install.js`,
      relevant_context: "Epic 4 Story 4-1. Test: node test-kiro-install.js"
    }]
  }
})
```

## Instructions

Continue as far as possible through all 8 stories of Epic 4, following the same sequential process used in Epic 3:
- Delegate → Update sprint status → Next story
- Use the non-interactive test script for all testing
- Mark Epic 4 complete when all stories are done

Begin with Story 4-1.
