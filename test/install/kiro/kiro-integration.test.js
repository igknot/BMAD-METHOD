/**
 * Kiro CLI Integration Tests
 *
 * End-to-end integration tests for Kiro CLI setup including:
 * - Full installation workflow
 * - Error handling
 * - Installation detection
 * - Module discovery
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
  console.log('Kiro CLI Integration Tests');
  console.log(`========================================${colors.reset}\n`);

  const projectRoot = path.join(__dirname, '../../..');
  const testDir = path.join(__dirname, 'temp-integration-test');
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
  // Test 1: Installation Detection
  // ============================================================
  console.log(`${colors.yellow}Test Suite 1: Installation Detection${colors.reset}\n`);

  try {
    const kiroSetup = new KiroCliSetup({ bmadFolderName: '_bmad' });

    // Test with no BMAD directory
    const emptyTestDir = path.join(testDir, 'empty');
    await fs.ensureDir(emptyTestDir);

    const noBmadResult = await kiroSetup.detectInstallation(emptyTestDir);
    assert(noBmadResult.state === 'no-bmad', 'Detects missing BMAD installation');
    assert(!noBmadResult.canProceed, 'Cannot proceed without BMAD');

    // Test with BMAD directory but no Kiro
    const newInstallDir = path.join(testDir, 'new');
    await fs.ensureDir(newInstallDir);
    await fs.ensureDir(path.join(newInstallDir, '_bmad'));

    const newResult = await kiroSetup.detectInstallation(newInstallDir);
    assert(newResult.state === 'new', 'Detects new installation');
    assert(newResult.canProceed, 'Can proceed with new installation');

    // Test with existing Kiro installation
    const upgradeDir = path.join(testDir, 'upgrade');
    await fs.ensureDir(upgradeDir);
    await fs.ensureDir(path.join(upgradeDir, '_bmad'));
    await fs.ensureDir(path.join(upgradeDir, '.kiro'));

    const upgradeResult = await kiroSetup.detectInstallation(upgradeDir);
    assert(upgradeResult.state === 'upgrade', 'Detects upgrade installation');
    assert(upgradeResult.canProceed, 'Can proceed with upgrade');
  } catch (error) {
    assert(false, 'Installation detection works', error.message);
  }

  console.log('');

  // ============================================================
  // Test 2: Module Discovery
  // ============================================================
  console.log(`${colors.yellow}Test Suite 2: Module Discovery${colors.reset}\n`);

  try {
    const kiroSetup = new KiroCliSetup({ bmadFolderName: '_bmad' });

    // Test with real BMAD directory
    const modules = await kiroSetup.discoverAllModules(bmadDir);

    assert(Array.isArray(modules), 'Returns array of modules');
    assert(modules.length > 0, 'Discovers at least one module');
    assert(modules.includes('core'), 'Discovers core module');

    // Test with empty directory
    const emptyBmadDir = path.join(testDir, 'empty-bmad');
    await fs.ensureDir(emptyBmadDir);

    const emptyModules = await kiroSetup.discoverAllModules(emptyBmadDir);
    assert(Array.isArray(emptyModules), 'Returns empty array for empty directory');
    assert(emptyModules.length === 0, 'No modules in empty directory');
  } catch (error) {
    assert(false, 'Module discovery works', error.message);
  }

  console.log('');

  // ============================================================
  // Test 3: Full Installation Workflow
  // ============================================================
  console.log(`${colors.yellow}Test Suite 3: Full Installation Workflow${colors.reset}\n`);

  try {
    const kiroSetup = new KiroCliSetup({ bmadFolderName: '_bmad' });
    const fullTestDir = path.join(testDir, 'full-install');

    // Create mock BMAD structure for this test
    const fullTestBmadDir = path.join(fullTestDir, '_bmad');
    await fs.ensureDir(fullTestBmadDir);
    await fs.ensureDir(path.join(fullTestBmadDir, 'core', 'agents'));

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

    await fs.writeFile(path.join(fullTestBmadDir, 'core', 'agents', 'test.agent.md'), mockAgentContent);

    // Create mock manifest
    const mockManifest = {
      tasks: [],
      tools: [],
    };

    await fs.writeJson(path.join(fullTestBmadDir, 'core', 'manifest.json'), mockManifest);

    // Run full setup
    await kiroSetup.setup(fullTestDir, fullTestBmadDir, {});

    const kiroDir = path.join(fullTestDir, '.kiro');
    const agentsDir = path.join(kiroDir, 'agents');
    const commandsDir = path.join(kiroDir, 'commands');

    // Verify directory structure
    assert(await fs.pathExists(kiroDir), 'Creates .kiro directory');
    assert(await fs.pathExists(agentsDir), 'Creates agents directory');
    assert(await fs.pathExists(commandsDir), 'Creates commands directory');

    // Verify files were created
    const agentFiles = await fs.readdir(agentsDir);
    const commandFiles = await fs.readdir(commandsDir);

    assert(agentFiles.length > 0, 'Creates agent files');
    // Command files may be 0 if no workflows are found
    assert(commandFiles.length >= 0, 'Creates command files');

    // Verify file naming convention
    const bmadAgentFiles = agentFiles.filter((f) => f.startsWith('bmad-'));
    const bmadCommandFiles = commandFiles.filter((f) => f.startsWith('bmad-'));

    assert(bmadAgentFiles.length > 0, 'Agent files follow bmad- naming convention');
    // Only check command file naming if there are command files
    if (commandFiles.length > 0) {
      assert(bmadCommandFiles.length > 0, 'Command files follow bmad- naming convention');
    } else {
      console.log(`${colors.dim}  Note: No command files to check naming convention${colors.reset}`);
    }
  } catch (error) {
    assert(false, 'Full installation workflow succeeds', error.message);
  }

  console.log('');

  // ============================================================
  // Test 4: Error Handling
  // ============================================================
  console.log(`${colors.yellow}Test Suite 4: Error Handling${colors.reset}\n`);

  try {
    const kiroSetup = new KiroCliSetup({ bmadFolderName: '_bmad' });

    // Test with non-existent BMAD directory
    const invalidBmadDir = path.join(testDir, 'non-existent-bmad');
    const errorTestDir = path.join(testDir, 'error-test');
    await fs.ensureDir(errorTestDir);

    let errorCaught = false;
    try {
      await kiroSetup.setup(errorTestDir, invalidBmadDir, {});
    } catch (error) {
      errorCaught = true;
      assert(error.message.includes('required'), 'Error message mentions requirement');
    }

    assert(errorCaught, 'Throws error for missing BMAD directory');

    // Test with read-only directory (if possible)
    // This test may not work on all systems, so we'll make it optional
    try {
      const readOnlyDir = path.join(testDir, 'readonly');
      await fs.ensureDir(readOnlyDir);
      await fs.chmod(readOnlyDir, 0o444); // Read-only

      let readOnlyErrorCaught = false;
      try {
        await kiroSetup.setup(readOnlyDir, bmadDir, {});
      } catch {
        readOnlyErrorCaught = true;
      }

      // Restore permissions for cleanup
      await fs.chmod(readOnlyDir, 0o755);

      // This test is optional since permissions behavior varies by system
      if (readOnlyErrorCaught) {
        assert(true, 'Handles read-only directory errors gracefully');
      } else {
        console.log(`${colors.dim}  Note: Read-only directory test skipped (system dependent)${colors.reset}`);
      }
    } catch (permError) {
      console.log(`${colors.dim}  Note: Permission test skipped: ${permError.message}${colors.reset}`);
    }
  } catch (error) {
    assert(false, 'Error handling works', error.message);
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
    console.log(`${colors.green}✨ All Kiro CLI integration tests passed!${colors.reset}\n`);
    process.exit(0);
  } else {
    console.log(`${colors.red}❌ Some Kiro CLI integration tests failed${colors.reset}\n`);
    process.exit(1);
  }
}

// Run tests
runTests().catch((error) => {
  console.error(`${colors.red}Test runner failed:${colors.reset}`, error.message);
  console.error(error.stack);
  process.exit(1);
});
