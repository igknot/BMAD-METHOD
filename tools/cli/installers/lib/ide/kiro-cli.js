const path = require('node:path');
const { BaseIdeSetup } = require('./_base-ide');
const chalk = require('chalk');
const fs = require('fs-extra');
const { AgentCommandGenerator } = require('./shared/agent-command-generator');
const { WorkflowCommandGenerator } = require('./shared/workflow-command-generator');
const { TaskToolCommandGenerator } = require('./shared/task-tool-command-generator');
const Ajv = require('ajv');

// Load and compile schema once
const schemaRaw = require(path.join(__dirname, '../../../../..', 'kiro-agent-schema.json'));
// Remove $schema field to avoid meta-schema validation issues
const schema = { ...schemaRaw };
delete schema.$schema;
const ajv = new Ajv({
  strict: false,
  logger: false, // Suppress format warnings
});
const validate = ajv.compile(schema);

/**
 * Kiro CLI setup handler for BMad Method
 *
 * ARCHITECTURE NOTE: Kiro uses shared generators to collect agent artifacts from the
 * installed bmadDir (compiled .md files with <agent> XML tags). The generators provide
 * artifact metadata which Kiro then transforms to Kiro-specific JSON format with
 * separate prompt files.
 *
 * Flow: bmadDir (compiled agents) -> AgentCommandGenerator -> Kiro JSON transformation
 */
class KiroCliSetup extends BaseIdeSetup {
  constructor(options = {}) {
    super('kiro-cli', 'Kiro CLI', false);
    this.configDir = '.kiro';
    this.agentsDir = 'agents';

    // Synchronize bmadFolderName with base class if provided
    if (options.bmadFolderName) {
      this.bmadFolderName = options.bmadFolderName;
    }

    // Compose with shared generators for artifact collection from installed bmadDir
    // Generators read from compiled agents in _bmad/ directory (not source YAML)
    this.agentGenerator = new AgentCommandGenerator(this.bmadFolderName);
    this.workflowGenerator = new WorkflowCommandGenerator(this.bmadFolderName);
    this.taskToolGenerator = new TaskToolCommandGenerator();
  }

  /**
   * Validate agent JSON configuration against schema
   * @param {Object} agentConfig - Agent configuration to validate
   * @throws {Error} If validation fails
   */
  validateAgentJson(agentConfig) {
    if (!validate(agentConfig)) {
      throw new Error(`Invalid agent schema: ${JSON.stringify(validate.errors)}`);
    }
  }

  /**
   * Detect existing BMAD and Kiro installations
   * Determines installation state: no-bmad, new, or upgrade
   *
   * @param {string} projectDir - Project directory to check
   * @returns {Promise<{state: string, canProceed: boolean}>} Detection result
   */
  async detectInstallation(projectDir) {
    console.log(chalk.cyan('Detecting BMAD installation...'));

    const bmadPath = path.join(projectDir, this.bmadFolderName);
    const kiroPath = path.join(projectDir, this.configDir);
    const agentsPath = path.join(kiroPath, this.agentsDir);
    const commandsPath = path.join(kiroPath, 'commands');

    const bmadExists = await fs.pathExists(bmadPath);
    const kiroExists = await fs.pathExists(kiroPath);
    const agentsExists = await fs.pathExists(agentsPath);
    const commandsExists = await fs.pathExists(commandsPath);

    if (!bmadExists) {
      console.log(chalk.yellow(`⚠ No ${this.bmadFolderName}/ folder found. BMAD may not be installed.`));
      return { state: 'no-bmad', canProceed: false };
    }

    console.log(chalk.green(`✓ Found ${this.bmadFolderName}/ folder`));

    if (kiroExists) {
      console.log(chalk.green(`✓ Found existing ${this.configDir}/ installation`));
      if (agentsExists) {
        console.log(chalk.dim(`  └─ ${this.configDir}/${this.agentsDir}/ exists`));
      }
      if (commandsExists) {
        console.log(chalk.dim(`  └─ ${this.configDir}/commands/ exists`));
      }
      console.log(chalk.cyan('→ Upgrade mode: Will clean and reinstall'));
      return { state: 'upgrade', canProceed: true };
    }

    console.log(chalk.cyan('→ New Kiro installation'));
    return { state: 'new', canProceed: true };
  }

  /**
   * Cleanup old BMAD installation before reinstalling
   * @param {string} projectDir - Project directory
   */
  async cleanup(projectDir) {
    const bmadAgentsDir = path.join(projectDir, this.configDir, this.agentsDir);

    if (await fs.pathExists(bmadAgentsDir)) {
      // Remove existing BMad agents
      const files = await fs.readdir(bmadAgentsDir);
      for (const file of files) {
        if (file.startsWith('bmad')) {
          await fs.remove(path.join(bmadAgentsDir, file));
        }
      }
      console.log(chalk.dim(`  Cleaned old BMAD agents from ${this.name}`));
    }
  }

  /**
   * Setup Kiro CLI configuration with BMad agents
   * Uses shared AgentCommandGenerator to collect artifacts from installed bmadDir,
   * then transforms them to Kiro-specific JSON format.
   *
   * @param {string} projectDir - Project directory
   * @param {string} bmadDir - BMAD installation directory (compiled agents)
   * @param {Object} options - Setup options
   */
  async setup(projectDir, bmadDir, options = {}) {
    console.log(chalk.cyan(`Setting up ${this.name}...`));

    // Detect existing installation state
    const detection = await this.detectInstallation(projectDir);
    if (!detection.canProceed) {
      console.log(chalk.red(`Cannot proceed: ${this.bmadFolderName}/ folder is required.`));
      console.log(chalk.yellow('Please install BMAD first before running Kiro setup.'));
      return;
    }

    await this.cleanup(projectDir);

    const kiroDir = path.join(projectDir, this.configDir);
    const agentsDir = path.join(kiroDir, this.agentsDir);

    await this.ensureDir(agentsDir);

    // Discover all available modules from the installed bmadDir
    const allModules = await this.discoverAllModules(bmadDir);
    console.log(chalk.dim(`  Discovered modules: ${allModules.join(', ')}`));

    // Use shared generator to collect agent artifacts from all discovered modules
    const { artifacts: agentArtifacts } = await this.agentGenerator.collectAgentArtifacts(bmadDir, allModules);

    let agentCount = 0;
    for (const artifact of agentArtifacts) {
      try {
        await this.processAgentArtifact(artifact, agentsDir, projectDir);
        agentCount++;
      } catch (error) {
        console.warn(chalk.yellow(`  Warning: Failed to process agent ${artifact.name}: ${error.message}`));
      }
    }

    console.log(chalk.green(`✓ ${this.name} configured with ${agentCount} BMad agents from ${allModules.length} modules`));
  }

  /**
   * Discover all available modules in the bmadDir
   * Looks for directories that contain agents/ subdirectories
   * @param {string} bmadDir - BMAD installation directory
   * @returns {Promise<string[]>} Array of module names
   */
  async discoverAllModules(bmadDir) {
    const modules = [];

    try {
      // Always include core if it exists
      const coreAgentsPath = path.join(bmadDir, 'core', 'agents');
      if (await fs.pathExists(coreAgentsPath)) {
        modules.push('core');
      }

      // Scan for other modules by looking for directories with agents/ subdirectories
      const entries = await fs.readdir(bmadDir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory() || entry.name === 'core' || entry.name.startsWith('_')) {
          continue; // Skip non-directories, core (already added), and internal directories
        }

        const moduleAgentsPath = path.join(bmadDir, entry.name, 'agents');
        if (await fs.pathExists(moduleAgentsPath)) {
          modules.push(entry.name);
        }
      }
    } catch (error) {
      console.warn(chalk.yellow(`  Warning: Failed to discover modules: ${error.message}`));
    }

    return modules;
  }

  /**
   * Process an agent artifact from the shared generator and create Kiro files
   * Reads the compiled agent .md file to extract persona information from XML tags
   *
   * @param {Object} artifact - Agent artifact from AgentCommandGenerator
   * @param {string} agentsDir - Target agents directory
   * @param {string} projectDir - Project directory
   */
  async processAgentArtifact(artifact, agentsDir, projectDir) {
    // Read the actual compiled agent file to extract persona info
    const agentContent = await fs.readFile(artifact.sourcePath, 'utf8');

    // Parse agent metadata from the compiled markdown/XML content
    const agentData = this.parseCompiledAgent(agentContent, artifact);

    if (!agentData) {
      return;
    }

    // Create Kiro agent name: bmad-{module}-{name}
    const agentName = `bmad-${artifact.module}-${artifact.name}`;
    const sanitizedAgentName = this.sanitizeAgentName(agentName);

    // Atomic generation: both files or neither
    const jsonPath = path.join(agentsDir, `${sanitizedAgentName}.json`);
    const promptPath = path.join(agentsDir, `${sanitizedAgentName}-prompt.md`);

    try {
      // Generate content first
      const agentConfig = this.createAgentConfig(sanitizedAgentName, agentData);
      const promptContent = this.generatePrompt(agentData);

      // Write both files atomically
      await fs.writeFile(promptPath, promptContent);
      await fs.writeJson(jsonPath, agentConfig, { spaces: 2 });
    } catch (error) {
      // Cleanup on failure - ensure both files are removed
      await fs.remove(promptPath).catch(() => {});
      await fs.remove(jsonPath).catch(() => {});
      throw error;
    }
  }

  /**
   * Parse compiled agent markdown to extract persona information
   * Compiled agents have XML <agent> tags with persona, menu, etc.
   *
   * @param {string} content - Compiled agent markdown content
   * @param {Object} artifact - Agent artifact metadata
   * @returns {Object|null} Parsed agent data or null if invalid
   */
  parseCompiledAgent(content, artifact) {
    // Extract agent XML tag attributes
    const agentTagMatch = content.match(/<agent\s+([^>]+)>/);
    if (!agentTagMatch) {
      return null;
    }

    // Parse attributes from the agent tag
    const attrs = agentTagMatch[1];
    const nameMatch = attrs.match(/name="([^"]+)"/);
    const titleMatch = attrs.match(/title="([^"]+)"/);
    const iconMatch = attrs.match(/icon="([^"]+)"/);

    // Extract persona section
    const personaMatch = content.match(/<persona>([\s\S]*?)<\/persona>/);
    let role = '';
    let identity = '';
    let communicationStyle = '';
    let principles = '';

    if (personaMatch) {
      const personaContent = personaMatch[1];
      const roleMatch = personaContent.match(/<role>([^<]+)<\/role>/);
      const identityMatch = personaContent.match(/<identity>([^<]+)<\/identity>/);
      const styleMatch = personaContent.match(/<communication_style>([^<]+)<\/communication_style>/);
      const principlesMatch = personaContent.match(/<principles>([^<]+)<\/principles>/);

      role = roleMatch ? roleMatch[1].trim() : '';
      identity = identityMatch ? identityMatch[1].trim() : '';
      communicationStyle = styleMatch ? styleMatch[1].trim() : '';
      principles = principlesMatch ? principlesMatch[1].trim() : '';
    }

    // Extract menu items
    const menuItems = [];
    const menuMatch = content.match(/<menu>([\s\S]*?)<\/menu>/);
    if (menuMatch) {
      const itemRegex = /<item\s+cmd="([^"]+)"[^>]*>([^<]+)<\/item>/g;
      let itemMatch;
      while ((itemMatch = itemRegex.exec(menuMatch[1])) !== null) {
        menuItems.push({
          trigger: itemMatch[1],
          description: itemMatch[2].trim(),
        });
      }
    }

    return {
      name: nameMatch ? nameMatch[1] : artifact.name,
      title: titleMatch ? titleMatch[1] : artifact.description,
      icon: iconMatch ? iconMatch[1] : '🤖',
      role,
      identity,
      communicationStyle,
      principles,
      menuItems,
    };
  }

  /**
   * Sanitize agent name for file naming
   * @param {string} name - Agent name
   * @returns {string} Sanitized name
   */
  sanitizeAgentName(name) {
    return name
      .toLowerCase()
      .replaceAll(/\s+/g, '-')
      .replaceAll(/[^a-z0-9-]/g, '');
  }

  /**
   * Create Kiro agent JSON configuration from parsed agent data
   * @param {string} agentName - Sanitized agent name (e.g., bmad-bmm-pm)
   * @param {Object} agentData - Parsed agent data from compiled markdown
   * @returns {Object} Agent configuration object
   */
  createAgentConfig(agentName, agentData) {
    const agentConfig = {
      name: agentName,
      description: `${agentData.name} - ${agentData.role || agentData.title}`,
      prompt: `file://./${agentName}-prompt.md`,
      tools: ['*'],
      mcpServers: {},
      useLegacyMcpJson: true,
      resources: [],
    };

    // Validate agent configuration before returning
    this.validateAgentJson(agentConfig);

    return agentConfig;
  }

  /**
   * Generate Kiro prompt content from parsed agent data
   * @param {Object} agentData - Parsed agent data
   * @returns {string} Generated prompt markdown
   */
  generatePrompt(agentData) {
    const { name, icon, role, identity, communicationStyle, principles, menuItems } = agentData;

    let prompt = `# ${name} ${icon}\n\n`;

    if (role) {
      prompt += `## Role\n${role}\n\n`;
    }

    if (identity) {
      prompt += `## Identity\n${identity}\n\n`;
    }

    if (communicationStyle) {
      prompt += `## Communication Style\n${communicationStyle}\n\n`;
    }

    if (principles) {
      prompt += `## Principles\n`;
      if (typeof principles === 'string') {
        prompt += principles + '\n\n';
      } else if (Array.isArray(principles)) {
        for (const principle of principles) {
          prompt += `- ${principle}\n`;
        }
        prompt += '\n';
      }
    }

    if (menuItems && menuItems.length > 0) {
      prompt += `## Available Workflows\n`;
      for (const [i, item] of menuItems.entries()) {
        prompt += `${i + 1}. **${item.trigger}**: ${item.description}\n`;
      }
      prompt += '\n';
    }

    prompt += `## Instructions\nYou are ${name}, part of the BMad Method. Follow your role and principles while assisting users with their development needs.\n`;

    return prompt;
  }

  /**
   * Check if Kiro CLI is available
   * @returns {Promise<boolean>} True if available
   */
  async isAvailable() {
    try {
      const { execSync } = require('node:child_process');
      execSync('kiro-cli --version', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get installation instructions
   * @returns {string} Installation instructions
   */
  getInstallInstructions() {
    return `Install Kiro CLI:
  curl -fsSL https://github.com/aws/kiro-cli/releases/latest/download/install.sh | bash
  
  Or visit: https://github.com/aws/kiro-cli`;
  }
}

module.exports = { KiroCliSetup };
