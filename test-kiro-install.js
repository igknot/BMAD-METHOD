/* eslint-disable unicorn/prefer-module */
/* eslint-disable unicorn/prefer-top-level-await */

/**
 * Non-interactive Kiro installation test
 * Tests the KiroCliSetup directly without prompts
 */

const path = require('node:path');
const fs = require('fs-extra');
const { KiroCliSetup } = require('./tools/cli/installers/lib/ide/kiro-cli');

async function testKiroInstall() {
  const testDir = path.join(process.env.HOME, 'work/test-install');
  const bmadDir = path.join(__dirname, '_bmad');

  console.log('🧪 Testing Kiro Installation');
  console.log('============================');
  console.log(`Test directory: ${testDir}`);
  console.log(`BMAD source: ${bmadDir}`);
  console.log('');

  // Ensure test directory exists
  await fs.ensureDir(testDir);

  // Create KiroCliSetup instance
  const kiroSetup = new KiroCliSetup({ bmadFolderName: '_bmad' });

  try {
    // Run setup directly (bypasses interactive prompts)
    await kiroSetup.setup(testDir, bmadDir, {});

    console.log('');
    console.log('✅ Installation test completed');
    console.log('');

    // Verify results
    const kiroDir = path.join(testDir, '.kiro');
    const agentsDir = path.join(kiroDir, 'agents');
    const commandsDir = path.join(kiroDir, 'commands');

    const agentFiles = await fs.readdir(agentsDir);
    const commandFiles = await fs.readdir(commandsDir);

    console.log(`📊 Results:`);
    console.log(`   Agents: ${agentFiles.length} files`);
    console.log(`   Commands: ${commandFiles.length} files`);
    console.log('');
    console.log(`📁 Output location: ${kiroDir}`);
  } catch (error) {
    console.error('❌ Installation failed:', error.message);
    console.error(error.stack);
    throw error;
  }
}

testKiroInstall();
