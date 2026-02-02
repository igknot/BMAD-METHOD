/**
 * Kiro Agent Schema Validation Tests
 *
 * Tests schema validation for Kiro agent configurations including:
 * - Valid agent configurations
 * - Invalid agent configurations
 * - Error message validation
 * - Schema compliance
 */

const path = require('node:path');
const fs = require('fs-extra');
const { KiroCliSetup } = require('../../tools/cli/installers/lib/ide/kiro-cli');

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
  console.log('Kiro Agent Schema Validation Tests');
  console.log(`========================================${colors.reset}\n`);

  // ============================================================
  // Test 1: Valid Agent Configurations
  // ============================================================
  console.log(`${colors.yellow}Test Suite 1: Valid Agent Configurations${colors.reset}\n`);

  try {
    const kiroSetup = new KiroCliSetup();

    // Test minimal valid configuration
    const minimalConfig = {
      name: 'test-agent',
      description: 'Test agent description',
      prompt: 'file://./test-agent-prompt.md',
      tools: ['*'],
      mcpServers: {},
      useLegacyMcpJson: true,
      resources: [],
    };

    let validationPassed = true;
    try {
      kiroSetup.validateAgentJson(minimalConfig);
    } catch {
      validationPassed = false;
    }

    assert(validationPassed, 'Validates minimal valid configuration');

    // Test full valid configuration
    const fullConfig = {
      name: 'bmad-bmm-pm',
      description: 'Product Manager - Strategic planning and coordination',
      prompt: 'file://./bmad-bmm-pm-prompt.md',
      tools: ['*'],
      mcpServers: {
        filesystem: {
          command: 'npx',
          args: ['@modelcontextprotocol/server-filesystem', '/path/to/project'],
        },
      },
      useLegacyMcpJson: true,
      resources: ['file:///path/to/resource.md'],
    };

    validationPassed = true;
    try {
      kiroSetup.validateAgentJson(fullConfig);
    } catch {
      validationPassed = false;
    }

    assert(validationPassed, 'Validates full valid configuration');
  } catch (error) {
    assert(false, 'Valid configuration tests setup', error.message);
  }

  console.log('');

  // ============================================================
  // Test 2: Invalid Agent Configurations
  // ============================================================
  console.log(`${colors.yellow}Test Suite 2: Invalid Agent Configurations${colors.reset}\n`);

  try {
    const kiroSetup = new KiroCliSetup();

    // Test missing required fields
    const missingNameConfig = {
      description: 'Test agent description',
      prompt: 'file://./test-agent-prompt.md',
      tools: ['*'],
      mcpServers: {},
      useLegacyMcpJson: true,
      resources: [],
    };

    let errorCaught = false;
    try {
      kiroSetup.validateAgentJson(missingNameConfig);
    } catch (error) {
      errorCaught = true;
      assert(error.message.includes('name'), 'Error mentions missing name field');
    }

    assert(errorCaught, 'Rejects configuration missing name');

    // Test invalid field types
    const invalidTypeConfig = {
      name: 123, // Should be string
      description: 'Test agent description',
      prompt: 'file://./test-agent-prompt.md',
      tools: ['*'],
      mcpServers: {},
      useLegacyMcpJson: true,
      resources: [],
    };

    errorCaught = false;
    try {
      kiroSetup.validateAgentJson(invalidTypeConfig);
    } catch (error) {
      errorCaught = true;
      assert(error.message.includes('string'), 'Error mentions expected string type');
    }

    assert(errorCaught, 'Rejects configuration with invalid field types');

    // Test invalid tools array
    const invalidToolsConfig = {
      name: 'test-agent',
      description: 'Test agent description',
      prompt: 'file://./test-agent-prompt.md',
      tools: 'not-an-array', // Should be array
      mcpServers: {},
      useLegacyMcpJson: true,
      resources: [],
    };

    errorCaught = false;
    try {
      kiroSetup.validateAgentJson(invalidToolsConfig);
    } catch (error) {
      errorCaught = true;
      assert(error.message.includes('array'), 'Error mentions expected array type');
    }

    assert(errorCaught, 'Rejects configuration with invalid tools field');
  } catch (error) {
    assert(false, 'Invalid configuration tests setup', error.message);
  }

  console.log('');

  // ============================================================
  // Test 3: Schema Compliance
  // ============================================================
  console.log(`${colors.yellow}Test Suite 3: Schema Compliance${colors.reset}\n`);

  try {
    const kiroSetup = new KiroCliSetup();

    // Test that createAgentConfig produces valid schema
    const mockAgentData = {
      name: 'Test Agent',
      title: 'Test Title',
      icon: '🤖',
      role: 'Test Role',
      identity: 'Test Identity',
      communicationStyle: 'Test Style',
      principles: 'Test Principles',
      menuItems: [],
    };

    const generatedConfig = kiroSetup.createAgentConfig('test-agent', mockAgentData);

    let configValid = true;
    try {
      kiroSetup.validateAgentJson(generatedConfig);
    } catch {
      configValid = false;
    }

    assert(configValid, 'Generated agent config passes schema validation');
    assert(generatedConfig.name === 'test-agent', 'Generated config has correct name');
    assert(generatedConfig.description.includes('Test Agent'), 'Generated config has correct description');
    assert(generatedConfig.prompt.includes('test-agent-prompt.md'), 'Generated config has correct prompt path');

    // Test sanitizeAgentName function
    const sanitizedName = kiroSetup.sanitizeAgentName('Test Agent Name!@#');
    assert(sanitizedName === 'test-agent-name', 'Sanitizes agent names correctly');

    const sanitizedComplex = kiroSetup.sanitizeAgentName('BMad-BMM Product Manager');
    assert(sanitizedComplex === 'bmad-bmm-product-manager', 'Sanitizes complex names correctly');
  } catch (error) {
    assert(false, 'Schema compliance tests setup', error.message);
  }

  console.log('');

  // ============================================================
  // Test 4: Error Message Validation
  // ============================================================
  console.log(`${colors.yellow}Test Suite 4: Error Message Validation${colors.reset}\n`);

  try {
    const kiroSetup = new KiroCliSetup();

    // Test specific error messages for different validation failures
    const testCases = [
      {
        config: {},
        expectedError: 'name',
        description: 'Empty config mentions missing name',
      },
    ];

    for (const testCase of testCases) {
      let errorMessage = '';
      try {
        kiroSetup.validateAgentJson(testCase.config);
      } catch (error) {
        errorMessage = error.message.toLowerCase();
      }

      assert(
        errorMessage.includes(testCase.expectedError.toLowerCase()),
        testCase.description,
        `Expected error to mention "${testCase.expectedError}", got: ${errorMessage}`,
      );
    }

    // Note: Since description and prompt are optional in the schema,
    // we don't test for their specific error messages
    console.log(`${colors.dim}  Note: Description and prompt are optional fields in Kiro schema${colors.reset}`);
  } catch (error) {
    assert(false, 'Error message validation tests setup', error.message);
  }

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
    console.log(`${colors.green}✨ All Kiro agent schema tests passed!${colors.reset}\n`);
    process.exit(0);
  } else {
    console.log(`${colors.red}❌ Some Kiro agent schema tests failed${colors.reset}\n`);
    process.exit(1);
  }
}

// Run tests
runTests().catch((error) => {
  console.error(`${colors.red}Test runner failed:${colors.reset}`, error.message);
  console.error(error.stack);
  process.exit(1);
});
