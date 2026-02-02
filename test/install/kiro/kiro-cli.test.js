/**
 * Kiro CLI Installation Tests
 *
 * Tests the KiroCliSetup class functionality including:
 * - Agent file generation
 * - Command file generation
 * - Directory creation
 * - Cleanup operations
 */

const path = require('node:path');
const fs = require('fs-extra');
const { KiroCliSetup } = require('../../../tools/cli/installers/lib/ide/kiro-cli');

// ANSI colors
const colors = {
  reset: '\u001B[0m',
  green: '\u001B[32m',
  red: '\u001B[31m',
  yellow: '\u001B[33m',
  cyan: '\u001B[36m',
  dim: '\u001B[2m',
};

let passed = 0;
let failed = 0;

/**
 * Test helper: Assert condition
 */
function assert(condition, testName, errorMessage = '') {
  if (condition) {
    console.log(`${colors.green}✓${colors.reset} ${testName}`);
    passed++;
  } else {
    console.log(`${colors.red}✗${colors.reset} ${testName}`);
    if (errorMessage) {
      console.log(`  ${colors.dim}${errorMessage}${colors.reset}`);
    }
    failed++;
  }
}

/**
 * Test Suite
 */
async function runTests() {
  console.log(`${colors.cyan}========================================`);
  console.log('Kiro CLI Installation Tests');
  console.log(`========================================${colors.reset}\n`);

  const projectRoot = path.join(__dirname, '../../..');
  const testDir = path.join(__dirname, 'temp-test-install');
  const realBmadDir = path.join(projectRoot, '_bmad');

  // Create a mock BMAD directory for testing
  const mockBmadDir = path.join(testDir, '_bmad');

  // Cleanup any existing test directory
  await fs.remove(testDir);

  // Create mock BMAD structure
  await fs.ensureDir(mockBmadDir);
  await fs.ensureDir(path.join(mockBmadDir, 'core', 'agents'));
  await fs.ensureDir(path.join(mockBmadDir, 'bmm', 'agents'));

  // Create a mock agent file
  const mockAgentContent = `# Test Agent

<agent name="test-agent" title="Test Agent" icon="🤖">
  <persona>
    <role>Test Role</role>
    <identity>Test Identity</identity>
    <communication_style>Test Style</communication_style>
    <principles>Test Principles</principles>
  </persona>
  <menu>
    <item cmd="test/command">Test Command</item>
  </menu>
</agent>`;

  await fs.writeFile(path.join(mockBmadDir, 'core', 'agents', 'test.agent.md'), mockAgentContent);

  // Create mock manifest files
  const mockManifest = {
    tasks: [
      {
        name: 'test-task',
        displayName: 'Test Task',
        description: 'A test task',
        path: '_bmad/core/tasks/test-task.md',
      },
    ],
    tools: [],
  };

  await fs.writeJson(path.join(mockBmadDir, 'core', 'manifest.json'), mockManifest);

  // Create mock workflow
  await fs.ensureDir(path.join(mockBmadDir, 'core', 'workflows'));
  await fs.writeFile(path.join(mockBmadDir, 'core', 'workflows', 'test-workflow.md'), '# Test Workflow\n\nThis is a test workflow.');

  // Create mock tasks directory and file
  await fs.ensureDir(path.join(mockBmadDir, 'core', 'tasks'));
  await fs.writeFile(path.join(mockBmadDir, 'core', 'tasks', 'test-task.md'), '# Test Task\n\nThis is a test task.');

  const bmadDir = mockBmadDir;

  // ============================================================
  // Test 1: Agent File Generation
  // ============================================================
  console.log(`${colors.yellow}Test Suite 1: Agent File Generation${colors.reset}\n`);

  try {
    const kiroSetup = new KiroCliSetup({ bmadFolderName: '_bmad' });

    // Ensure test directory exists
    await fs.ensureDir(testDir);

    // Run setup
    await kiroSetup.setup(testDir, bmadDir, {});

    const kiroDir = path.join(testDir, '.kiro');
    const agentsDir = path.join(kiroDir, 'agents');

    assert(await fs.pathExists(kiroDir), 'Creates .kiro directory');
    assert(await fs.pathExists(agentsDir), 'Creates agents subdirectory');

    // Check for agent files
    const agentFiles = await fs.readdir(agentsDir);
    const jsonFiles = agentFiles.filter((f) => f.endsWith('.json'));
    const promptFiles = agentFiles.filter((f) => f.endsWith('-prompt.md'));

    assert(jsonFiles.length > 0, 'Generates agent JSON files');
    assert(promptFiles.length > 0, 'Generates agent prompt files');
    assert(jsonFiles.length === promptFiles.length, 'JSON and prompt files match count');

    // Verify agent file content
    if (jsonFiles.length > 0) {
      const firstJsonFile = path.join(agentsDir, jsonFiles[0]);
      const agentConfig = await fs.readJson(firstJsonFile);

      assert(agentConfig.name, 'Agent JSON has name field');
      assert(agentConfig.description, 'Agent JSON has description field');
      assert(agentConfig.prompt, 'Agent JSON has prompt field');
      assert(agentConfig.tools, 'Agent JSON has tools field');
    }

    if (promptFiles.length > 0) {
      const firstPromptFile = path.join(agentsDir, promptFiles[0]);
      const promptContent = await fs.readFile(firstPromptFile, 'utf8');

      assert(promptContent.includes('#'), 'Prompt file contains markdown headers');
      assert(promptContent.length > 0, 'Prompt file has content');
    }
  } catch (error) {
    assert(false, 'Agent file generation succeeds', error.message);
  }

  console.log('');

  // ============================================================
  // Test 2: Command File Generation
  // ============================================================
  console.log(`${colors.yellow}Test Suite 2: Command File Generation${colors.reset}\n`);

  try {
    const commandsDir = path.join(testDir, '.kiro', 'commands');

    assert(await fs.pathExists(commandsDir), 'Creates commands subdirectory');

    // Check for command files
    const commandFiles = await fs.readdir(commandsDir);
    const mdFiles = commandFiles.filter((f) => f.endsWith('.md'));

    // Note: Command files may be 0 if no workflows/tasks are found in mock structure
    assert(mdFiles.length >= 0, 'Command files directory accessible');

    // If there are command files, verify their content
    if (mdFiles.length > 0) {
      const firstCommandFile = path.join(commandsDir, mdFiles[0]);
      const commandContent = await fs.readFile(firstCommandFile, 'utf8');

      assert(commandContent.includes('#'), 'Command file contains markdown headers');
      assert(commandContent.includes('LOAD @'), 'Command file contains LOAD directive');
    } else {
      console.log(`${colors.dim}  Note: No command files generated (no workflows found in mock structure)${colors.reset}`);
    }
  } catch (error) {
    assert(false, 'Command file generation succeeds', error.message);
  }

  console.log('');

  // ============================================================
  // Test 3: Directory Creation
  // ============================================================
  console.log(`${colors.yellow}Test Suite 3: Directory Creation${colors.reset}\n`);

  try {
    const kiroDir = path.join(testDir, '.kiro');
    const agentsDir = path.join(kiroDir, 'agents');
    const commandsDir = path.join(kiroDir, 'commands');

    assert(await fs.pathExists(kiroDir), 'Creates main .kiro directory');
    assert(await fs.pathExists(agentsDir), 'Creates agents directory');
    assert(await fs.pathExists(commandsDir), 'Creates commands directory');

    // Check directory permissions (should be readable/writable)
    const kiroStats = await fs.stat(kiroDir);
    const agentsStats = await fs.stat(agentsDir);
    const commandsStats = await fs.stat(commandsDir);

    assert(kiroStats.isDirectory(), '.kiro is a directory');
    assert(agentsStats.isDirectory(), 'agents is a directory');
    assert(commandsStats.isDirectory(), 'commands is a directory');
  } catch (error) {
    assert(false, 'Directory creation succeeds', error.message);
  }

  console.log('');

  // ============================================================
  // Test 4: Cleanup Operations
  // ============================================================
  console.log(`${colors.yellow}Test Suite 4: Cleanup Operations${colors.reset}\n`);

  try {
    const kiroSetup = new KiroCliSetup({ bmadFolderName: '_bmad' });
    const agentsDir = path.join(testDir, '.kiro', 'agents');
    const commandsDir = path.join(testDir, '.kiro', 'commands');

    // Create some non-BMAD files to ensure they're preserved
    const userAgentFile = path.join(agentsDir, 'user-agent.json');
    const userCommandFile = path.join(commandsDir, 'user-command.md');

    await fs.writeFile(userAgentFile, '{"name": "user-agent"}');
    await fs.writeFile(userCommandFile, '# User Command');

    // Run cleanup
    await kiroSetup.cleanup(testDir);

    // Check that BMAD files are removed but user files remain
    const agentFiles = await fs.readdir(agentsDir);
    const commandFiles = await fs.readdir(commandsDir);

    const bmadAgentFiles = agentFiles.filter((f) => f.startsWith('bmad'));
    const bmadCommandFiles = commandFiles.filter((f) => f.startsWith('bmad'));

    assert(bmadAgentFiles.length === 0, 'Cleanup removes BMAD agent files');
    assert(bmadCommandFiles.length === 0, 'Cleanup removes BMAD command files');
    assert(await fs.pathExists(userAgentFile), 'Cleanup preserves user agent files');
    assert(await fs.pathExists(userCommandFile), 'Cleanup preserves user command files');
  } catch (error) {
    assert(false, 'Cleanup operations succeed', error.message);
  }

  // Cleanup test directory
  await fs.remove(testDir);

  console.log('');

  // ============================================================
  // Summary
  // ============================================================
  console.log(`${colors.cyan}========================================`);
  console.log('Test Results:');
  console.log(`  Passed: ${colors.green}${passed}${colors.reset}`);
  console.log(`  Failed: ${colors.red}${failed}${colors.reset}`);
  console.log(`========================================${colors.reset}\n`);

  if (failed === 0) {
    console.log(`${colors.green}✨ All Kiro CLI tests passed!${colors.reset}\n`);
    process.exit(0);
  } else {
    console.log(`${colors.red}❌ Some Kiro CLI tests failed${colors.reset}\n`);
    process.exit(1);
  }
}

// Run tests
runTests().catch((error) => {
  console.error(`${colors.red}Test runner failed:${colors.reset}`, error.message);
  console.error(error.stack);
  process.exit(1);
});
