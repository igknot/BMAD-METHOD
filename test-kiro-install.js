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
  const testDir = __dirname; // Use current directory instead of separate test directory
  const bmadDir = path.join(__dirname, '_bmad');

  console.log('🧪 Testing Kiro Installation');
  console.log('============================');
  console.log(`Test directory: ${testDir}`);
  console.log(`BMAD source: ${bmadDir}`);
  console.log('');

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
    const steeringDir = path.join(kiroDir, 'steering');

    const agentFiles = await fs.readdir(agentsDir);
    const commandFiles = await fs.readdir(commandsDir);
    const steeringFiles = await fs.readdir(steeringDir);

    console.log(`📊 Results:`);
    console.log(`   Agents: ${agentFiles.length} files`);
    console.log(`   Commands: ${commandFiles.length} files`);
    console.log(`   Steering: ${steeringFiles.length} files`);
    console.log('');
    console.log(`📁 Output location: ${kiroDir}`);

    // Check if structure.md was generated
    const structureFile = path.join(steeringDir, 'structure.md');
    if (await fs.pathExists(structureFile)) {
      console.log('✅ Enhanced structure.md generated successfully');
      const content = await fs.readFile(structureFile, 'utf8');
      console.log('📄 Structure file preview:');
      console.log(content.slice(0, 500) + '...');
    } else {
      console.log('❌ structure.md not found');
    }
  } catch (error) {
    console.error('❌ Installation failed:', error.message);
    console.error(error.stack);
    throw error;
  }
}

testKiroInstall();
