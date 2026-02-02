const path = require('node:path');
const fs = require('fs-extra');
const chalk = require('chalk');

/**
 * Generates Kiro steering files from BMAD artifacts
 * Transforms BMAD planning artifacts into Kiro-compatible steering files
 */
class KiroSteeringGenerator {
  constructor(config = {}) {
    this.config = config;
    this.sourceDir = config.sourceDir || '_bmad-output/planning-artifacts';
    this.targetDir = config.targetDir || '.kiro/steering';
    this.projectDir = config.projectDir || process.cwd();
  }

  /**
   * Generate all steering files
   * @returns {Promise<{generated: number, errors: Array}>}
   */
  async generateAll() {
    const results = { generated: 0, errors: [] };

    try {
      await fs.ensureDir(path.join(this.projectDir, this.targetDir));

      const generators = [
        this.generateProductSteering.bind(this),
        this.generateTechSteering.bind(this),
        this.generateStructureSteering.bind(this),
        this.generateBmadIndex.bind(this),
        this.generateWorkflowIndex.bind(this),
      ];

      for (const generator of generators) {
        try {
          await generator();
          results.generated++;
        } catch (error) {
          results.errors.push(error.message);
        }
      }
    } catch (error) {
      results.errors.push(`Failed to create target directory: ${error.message}`);
    }

    return results;
  }

  /**
   * Generate product steering file from product-brief.md or PRD.md
   */
  async generateProductSteering() {
    // File discovery priority: product-brief.md first, then PRD.md
    const sourceFiles = ['product-brief-kiro-cli-enhancement-2026-01-31.md', 'product-brief.md', 'prd.md', 'PRD.md'];
    const sourceFile = await this._findSourceFile(sourceFiles);

    if (!sourceFile) {
      console.log(chalk.yellow('⚠ No product files found. Skipping product steering.'));
      return;
    }

    // Read source content for extraction
    const sourceContent = await this._readSourceFile(sourceFile);
    const extractedContent = this._extractProductContent(sourceContent);

    const content = `---
inclusion: conditional
fileMatch: ["**/prd.md", "**/product-*.md", "**/user-*.md", "**/epic-*.md"]
---

# Product Context

## Vision
${extractedContent.vision}

## Key Goals
${extractedContent.goals.map((goal) => `- ${goal}`).join('\n')}

## Success Metrics
${extractedContent.metrics}

## User Stories Overview
${extractedContent.userStories}

## Detailed Documentation
- Product Brief: #[[file:${sourceFile}]]
${this._getAdditionalProductRefs()}

## Quick Reference
${extractedContent.quickRef}
`;

    await this._writeSteeringFile('product.md', content);
  }

  /**
   * Generate tech steering file from architecture.md
   */
  async generateTechSteering() {
    const sourceFile = await this._findSourceFile(['architecture.md']);

    if (!sourceFile) {
      console.log(chalk.yellow('⚠ No architecture file found. Skipping tech steering.'));
      return;
    }

    // Read and extract content from architecture.md
    const sourceContent = await this._readSourceFile(sourceFile);
    const extractedContent = this._extractTechnicalContent(sourceContent);

    const content = `---
inclusion: conditional
fileMatch: ["src/**/*.{js,ts,jsx,tsx,py,java,go,rb,php}", "**/test/**/*", "**/spec/**/*"]
---

# Technical Architecture

## System Overview
${extractedContent.systemOverview}

## Key Design Patterns
${extractedContent.designPatterns.map((pattern) => `- ${pattern}`).join('\n')}

## Technology Stack
${extractedContent.technologyStack}

## Coding Standards
${extractedContent.codingStandards}

## Recent Architectural Decisions
${extractedContent.architecturalDecisions}

## Detailed Documentation
- Architecture: #[[file:${sourceFile}]]
${this._getAdditionalTechRefs()}

## Quick Reference
${extractedContent.quickReference}
`;

    await this._writeSteeringFile('tech.md', content);
  }

  /**
   * Generate structure steering file from project-context.md
   */
  async generateStructureSteering() {
    const sourceFiles = ['../project-context.md', 'project-context.md'];
    const sourceFile = await this._findSourceFile(sourceFiles);

    if (!sourceFile) {
      console.log(chalk.yellow('⚠ No project context file found. Skipping structure steering.'));
      return;
    }

    // Read source content for extraction
    const sourceContent = await this._readSourceFile(sourceFile);
    const extractedContent = this._extractStructureContent(sourceContent);

    const content = `---
inclusion: conditional
fileMatch: ["**/package.json", "**/README.md", "**/config/**/*", "**/.env*", "**/docker*"]
---

# Project Structure

## Directory Overview
\`\`\`
${extractedContent.directoryStructure}
\`\`\`

## Key Directories
${extractedContent.keyDirectories}

## File Naming Conventions
${extractedContent.namingConventions}

## Module Organization
${extractedContent.moduleOrganization}

## Configuration Files
${extractedContent.configurationFiles}

## BMAD Method Structure
${extractedContent.bmadStructure}

## Detailed Documentation
- Project Context: #[[file:${sourceFile}]]
${this._getAdditionalStructureRefs()}

## Navigation Tips
${extractedContent.navigationTips}
`;

    await this._writeSteeringFile('structure.md', content);
  }

  /**
   * Generate BMAD index for lazy loading
   */
  async generateBmadIndex() {
    // Discover available BMAD artifacts dynamically
    const discoveredContent = await this._discoverBmadContent();

    const content = `---
inclusion: always
---

# BMAD Method Index

## Quick Reference
${discoveredContent.quickReference}

## Workflows by Phase

### Phase 1: Analysis
- **/bmad-research** - Market, technical, domain research
- **/bmad-product-brief** - Create product brief

### Phase 2: Planning  
- **/bmad-prd** - Create PRD
- **/bmad-ux-design** - Design UX

### Phase 3: Solutioning
- **/bmad-architecture** - Technical decisions
- **/bmad-epics** - Break down requirements

### Phase 4: Implementation
- **/bmad-sprint-planning** - Initialize tracking
- **/bmad-create-story** - Prepare next story
- **/bmad-dev-story** - Implement story
- **/bmad-code-review** - Review implementation

## Planning Artifacts
${discoveredContent.planningArtifacts}

## Agents Quick Access
- Mary (Analyst): \`/bmad-analyst\`
- Peter (PM): \`/bmad-pm\`
- Alex (Architect): \`/bmad-architect\`
- Dev (Developer): \`/bmad-dev\`

## Help & Reference
${discoveredContent.helpReferences}
`;

    await this._writeSteeringFile('bmad-index.md', content);
  }

  /**
   * Discover available BMAD content dynamically
   * @returns {Promise<Object>} Discovered content sections
   */
  async _discoverBmadContent() {
    const quickReference = await this._buildQuickReference();
    const planningArtifacts = await this._buildPlanningArtifacts();
    const helpReferences = await this._buildHelpReferences();

    return {
      quickReference,
      planningArtifacts,
      helpReferences,
    };
  }

  /**
   * Build quick reference section with lazy-loaded links
   * @returns {Promise<string>} Quick reference content
   */
  async _buildQuickReference() {
    const references = [];

    // Core planning documents with lazy loading
    const coreFiles = [
      { file: 'product-brief.md', label: 'Product Brief' },
      { file: 'PRD.md', label: 'PRD' },
      { file: 'architecture.md', label: 'Architecture' },
    ];

    for (const { file, label } of coreFiles) {
      const foundFile = await this._findSourceFile([file]);
      if (foundFile) {
        references.push(`- ${label}: #[[file:${foundFile}]]`);
      }
    }

    return references.length > 0 ? references.join('\n') : '- Planning documents will appear here as they are created';
  }

  /**
   * Build planning artifacts section with dynamic discovery
   * @returns {Promise<string>} Planning artifacts content
   */
  async _buildPlanningArtifacts() {
    const artifacts = [];

    // Discover epics
    const epicsFile = await this._findSourceFile(['epics.md']);
    if (epicsFile) {
      artifacts.push(`- Epics: #[[file:${epicsFile}]]`);
    }

    // Discover story files dynamically
    const storyFiles = await this._discoverStoryFiles();
    if (storyFiles.length > 0) {
      artifacts.push('- Stories:');
      for (const story of storyFiles.slice(0, 10)) {
        // Limit to 10 stories
        const storyName = story
          .replace(/^\d+-\d+-/, '')
          .replace('.md', '')
          .replaceAll('-', ' ');
        artifacts.push(`  - ${storyName}: #[[file:_bmad-output/implementation-artifacts/${story}]]`);
      }
    }

    // Discover ADR files
    const adrFiles = await this._discoverADRFiles();
    if (adrFiles.length > 0) {
      artifacts.push('- Architecture Decisions:');
      for (const adr of adrFiles.slice(0, 5)) {
        // Limit to 5 ADRs
        artifacts.push(`  - ${adr.title}: #[[file:${adr.path}]]`);
      }
    }

    return artifacts.length > 0 ? artifacts.join('\n') : '- Planning artifacts will appear here as they are created';
  }

  /**
   * Build help references section
   * @returns {Promise<string>} Help references content
   */
  async _buildHelpReferences() {
    const references = [];

    // Check for workflow map
    const workflowMap = await this._findSourceFile(['../docs/reference/workflow-map.md', 'workflow-map.md']);
    if (workflowMap) {
      references.push(`- Workflow Map: #[[file:${workflowMap}]]`);
    }

    // Check for getting started guide
    const gettingStarted = await this._findSourceFile(['../docs/tutorials/getting-started.md', 'getting-started.md']);
    if (gettingStarted) {
      references.push(`- Getting Started: #[[file:${gettingStarted}]]`);
    }

    // Fallback references
    if (references.length === 0) {
      references.push('- Documentation will appear here as it becomes available');
    }

    return references.join('\n');
  }

  /**
   * Discover story files in implementation artifacts
   * @returns {Promise<Array<string>>} List of story files
   */
  async _discoverStoryFiles() {
    const storyFiles = [];
    const implementationDir = path.join(this.projectDir, '_bmad-output/implementation-artifacts');

    try {
      if (await fs.pathExists(implementationDir)) {
        const files = await fs.readdir(implementationDir);
        for (const file of files) {
          if (/^\d+-\d+-.*\.md$/.test(file)) {
            storyFiles.push(file);
          }
        }
        // Sort by story number
        storyFiles.sort((a, b) => {
          const aMatch = a.match(/^(\d+)-(\d+)/);
          const bMatch = b.match(/^(\d+)-(\d+)/);
          if (aMatch && bMatch) {
            const aEpic = parseInt(aMatch[1]);
            const bEpic = parseInt(bMatch[1]);
            if (aEpic !== bEpic) return aEpic - bEpic;
            return parseInt(aMatch[2]) - parseInt(bMatch[2]);
          }
          return a.localeCompare(b);
        });
      }
    } catch {
      // Gracefully handle directory read errors
      console.log(chalk.yellow('⚠ Could not read implementation artifacts directory'));
    }

    return storyFiles;
  }

  /**
   * Discover ADR files in planning artifacts
   * @returns {Promise<Array<Object>>} List of ADR files with titles and paths
   */
  async _discoverADRFiles() {
    const adrFiles = [];
    const possibleDirs = ['adrs', 'adr', 'decisions'];

    for (const dir of possibleDirs) {
      const adrDir = path.join(this.projectDir, this.sourceDir, dir);
      try {
        if (await fs.pathExists(adrDir)) {
          const files = await fs.readdir(adrDir);
          for (const file of files) {
            if (file.endsWith('.md')) {
              const title = file.replace('.md', '').replaceAll(/^\d+-/, '').replaceAll('-', ' ');
              const capitalizedTitle = title.replaceAll(/\b\w/g, (l) => l.toUpperCase());
              adrFiles.push({
                title: capitalizedTitle,
                path: `${this.sourceDir}/${dir}/${file}`,
              });
            }
          }
        }
      } catch {
        // Gracefully handle directory read errors
        continue;
      }
    }

    return adrFiles;
  }

  /**
   * Generate workflow index with conditional loading
   */
  async generateWorkflowIndex() {
    const content = `---
inclusion: conditional
fileMatch: ["**/epic-*.md", "**/story-*.md", "**/prd.md", "src/**/*"]
---

# BMAD Workflows

## Current Context Workflows

### Planning Phase
*Loaded when working on planning documents*
- **Create PRD**: #[[file:.kiro/commands/bmad-prd.md]]
- **Create Product Brief**: #[[file:.kiro/commands/bmad-create-product-brief.md]]
- **Create Architecture**: #[[file:.kiro/commands/bmad-create-architecture.md]]
- **Create Epics and Stories**: #[[file:.kiro/commands/bmad-create-epics-and-stories.md]]
- **Create UX Design**: #[[file:.kiro/commands/bmad-create-ux-design.md]]

### Implementation Phase
*Loaded when working on code or stories*
- **Create Story**: #[[file:.kiro/commands/bmad-create-story.md]]
- **Develop Story**: #[[file:.kiro/commands/bmad-dev-story.md]]
- **Quick Development**: #[[file:.kiro/commands/bmad-quick-dev.md]]
- **Code Review**: #[[file:.kiro/commands/bmad-code-review.md]]
- **Quick Spec**: #[[file:.kiro/commands/bmad-quick-spec.md]]

### Analysis Phase
*Loaded when working on research or requirements*
- **Research**: #[[file:.kiro/commands/bmad-research.md]]
- **Brainstorming**: #[[file:.kiro/commands/bmad-brainstorming.md]]
- **Check Implementation Readiness**: #[[file:.kiro/commands/bmad-check-implementation-readiness.md]]

### Project Management Phase
*Loaded for project tracking and coordination*
- **Sprint Planning**: #[[file:.kiro/commands/bmad-sprint-planning.md]]
- **Sprint Status**: #[[file:.kiro/commands/bmad-sprint-status.md]]
- **Retrospective**: #[[file:.kiro/commands/bmad-retrospective.md]]
- **Workflow Status**: #[[file:.kiro/commands/bmad-workflow-status.md]]

## Quick Workflow Access
- Type \`/bmad-\` in Kiro to see all available workflows
- Use workflow commands directly from any context

## Workflow Help
- Workflow Map: #[[file:docs/reference/workflow-map.md]]
- Getting Started: #[[file:docs/tutorials/getting-started.md]]
`;

    await this._writeSteeringFile('bmad-workflows.md', content);
  }

  /**
   * Find the first existing source file from a list of candidates
   * @param {Array<string>} candidates - List of potential source files
   * @returns {Promise<string|null>} Path to found file or null
   */
  async _findSourceFile(candidates) {
    for (const candidate of candidates) {
      const fullPath = path.join(this.projectDir, this.sourceDir, candidate);
      if (await fs.pathExists(fullPath)) {
        return path.join(this.sourceDir, candidate);
      }
    }
    return null;
  }

  /**
   * Read source file content
   * @param {string} filePath - Relative path to source file
   * @returns {Promise<string>} File content
   */
  async _readSourceFile(filePath) {
    const fullPath = path.join(this.projectDir, filePath);
    return await fs.readFile(fullPath, 'utf8');
  }

  /**
   * Extract key product content from source file
   * @param {string} content - Source file content
   * @returns {Object} Extracted content sections
   */
  _extractProductContent(content) {
    const lines = content.split('\n');

    // Extract vision (look for Executive Summary or Problem Statement)
    const vision =
      this._extractSection(lines, ['Executive Summary', 'Vision', 'Problem Statement']) ||
      'Product vision and goals from source documentation.';

    // Extract goals (look for bullet points under goals/objectives sections)
    const goals = this._extractGoals(lines);

    // Extract success metrics
    const metrics =
      this._extractSection(lines, ['Success Criteria', 'Success Metrics', 'KPIs', 'Metrics']) ||
      'Key performance indicators and success metrics from product documentation.';

    // Extract user stories overview
    const userStories =
      this._extractSection(lines, ['User Stories', 'User Journey', 'Use Cases']) ||
      'High-level user story summary from product requirements.';

    // Create quick reference
    const quickRef = this._createQuickReference(content);

    return { vision, goals, metrics, userStories, quickRef };
  }

  /**
   * Extract technical content from architecture.md
   * @param {string} content - Architecture file content
   * @returns {Object} Extracted technical content sections
   */
  _extractTechnicalContent(content) {
    const lines = content.split('\n');

    // Extract system overview - look for project context or requirements overview
    const systemOverview =
      this._extractArchitectureSection(lines, ['Project Context Analysis', 'Requirements Overview', 'System Overview']) ||
      'CLI/Developer Tooling enhancement for BMAD-METHOD installer system. Brownfield project extending existing Kiro CLI capabilities with BMAD agent and workflow generation.';

    // Extract design patterns from implementation patterns section
    const designPatterns = this._extractArchitecturePatterns(lines);

    // Extract technology stack from architectural decisions
    const technologyStack = this._extractArchitectureTechStack(lines);

    // Extract coding standards from implementation patterns
    const codingStandards = this._extractArchitectureStandards(lines);

    // Extract architectural decisions
    const architecturalDecisions = this._extractArchitectureDecisions(lines);

    // Create technical quick reference
    const quickReference = this._createArchitectureQuickReference(content);

    return {
      systemOverview,
      designPatterns,
      technologyStack,
      codingStandards,
      architecturalDecisions,
      quickReference,
    };
  }

  /**
   * Extract a section from content lines
   * @param {Array<string>} lines - Content lines
   * @param {Array<string>} headers - Possible section headers
   * @returns {string|null} Extracted section content
   */
  _extractSection(lines, headers) {
    for (const header of headers) {
      const headerIndex = lines.findIndex(
        (line) => line.toLowerCase().includes(header.toLowerCase()) && (line.startsWith('#') || line.startsWith('**')),
      );

      if (headerIndex !== -1) {
        // Find next header or end of content
        let endIndex = lines.length;
        for (let i = headerIndex + 1; i < lines.length; i++) {
          if (lines[i].startsWith('#') || (lines[i].startsWith('**') && lines[i].endsWith('**'))) {
            endIndex = i;
            break;
          }
        }

        // Extract and clean content
        const sectionLines = lines
          .slice(headerIndex + 1, endIndex)
          .filter((line) => line.trim() !== '')
          .slice(0, 3); // Limit to first 3 meaningful lines

        return sectionLines.join(' ').trim() || null;
      }
    }
    return null;
  }

  /**
   * Extract goals from content
   * @param {Array<string>} lines - Content lines
   * @returns {Array<string>} List of goals
   */
  _extractGoals(lines) {
    const goals = [];
    let inGoalsSection = false;

    for (const line of lines) {
      // Check if we're entering a goals section
      if (
        (line.toLowerCase().includes('goal') || line.toLowerCase().includes('objective')) &&
        (line.startsWith('#') || line.startsWith('**'))
      ) {
        inGoalsSection = true;
        continue;
      }

      // Check if we're leaving the section
      if (inGoalsSection && (line.startsWith('#') || (line.startsWith('**') && line.endsWith('**')))) {
        break;
      }

      // Extract bullet points or numbered items
      if (inGoalsSection && (line.trim().startsWith('-') || line.trim().startsWith('*') || /^\d+\./.test(line.trim()))) {
        const goal = line.replace(/^[\s\-*\d.]+/, '').trim();
        if (goal && goals.length < 5) {
          // Limit to 5 goals
          goals.push(goal);
        }
      }
    }

    // Fallback: generic goals if none found
    if (goals.length === 0) {
      goals.push(
        'Enhance Kiro CLI functionality and user experience',
        'Achieve feature parity with other BMAD IDE installers',
        'Implement efficient context management and lazy loading',
      );
    }

    return goals;
  }

  /**
   * Create quick reference section
   * @param {string} content - Full content
   * @returns {string} Quick reference content
   */
  _createQuickReference(content) {
    const constraints = [];
    const decisions = [];

    // Look for constraints and key decisions
    const lines = content.split('\n');
    for (const line of lines) {
      if (line.toLowerCase().includes('constraint') || line.toLowerCase().includes('limitation')) {
        constraints.push(line.replace(/^[\s\-*\d.]+/, '').trim());
      }
      if (line.toLowerCase().includes('decision') || line.toLowerCase().includes('requirement')) {
        decisions.push(line.replace(/^[\s\-*\d.]+/, '').trim());
      }
    }

    let quickRef = 'Essential product decisions and constraints:\n\n';

    if (constraints.length > 0) {
      quickRef += '**Key Constraints:**\n';
      for (const constraint of constraints.slice(0, 3)) {
        quickRef += `- ${constraint}\n`;
      }
      quickRef += '\n';
    }

    if (decisions.length > 0) {
      quickRef += '**Key Decisions:**\n';
      for (const decision of decisions.slice(0, 3)) {
        quickRef += `- ${decision}\n`;
      }
    }

    if (constraints.length === 0 && decisions.length === 0) {
      quickRef += [
        '- Focus on Kiro CLI enhancement and BMAD integration',
        '- Maintain compatibility with existing Kiro features',
        '- Implement efficient context loading patterns',
      ].join('\n');
    }

    return quickRef;
  }

  /**
   * Get additional product reference files
   * @returns {string} Additional file references
   */
  _getAdditionalProductRefs() {
    const additionalRefs = [];

    // Check for common product files
    const possibleFiles = ['prd.md', 'user-research.md', 'feature-request-kiro-cli-enhancement.md', 'requirements.md'];

    for (const file of possibleFiles) {
      const fullPath = path.join(this.projectDir, this.sourceDir, file);
      if (fs.existsSync(fullPath)) {
        additionalRefs.push(
          `- ${file
            .replace('.md', '')
            .replaceAll('-', ' ')
            .replaceAll(/\b\w/g, (l) => l.toUpperCase())}: #[[file:${this.sourceDir}/${file}]]`,
        );
      }
    }

    return additionalRefs.join('\n');
  }

  /**
   * Extract structure content from project-context.md
   * @param {string} content - Project context file content
   * @returns {Object} Extracted structure content sections
   */
  _extractStructureContent(content) {
    const lines = content.split('\n');

    // Extract directory structure from File Structure Reference section
    const directoryStructure = this._extractDirectoryStructure(lines);

    // Extract key directories and their purposes
    const keyDirectories = this._extractKeyDirectories(lines, content);

    // Extract naming conventions from language rules
    const namingConventions = this._extractNamingConventions(lines, content);

    // Extract module organization patterns
    const moduleOrganization = this._extractModuleOrganization(lines, content);

    // Extract configuration files information
    const configurationFiles = this._extractConfigurationFiles(lines, content);

    // Extract BMAD-specific structure information
    const bmadStructure = this._extractBmadStructure(lines, content);

    // Generate navigation tips
    const navigationTips = this._generateNavigationTips(content);

    return {
      directoryStructure,
      keyDirectories,
      namingConventions,
      moduleOrganization,
      configurationFiles,
      bmadStructure,
      navigationTips,
    };
  }

  /**
   * Extract directory structure from File Structure Reference section
   * @param {Array<string>} lines - Content lines
   * @returns {string} Directory structure
   */
  _extractDirectoryStructure(lines) {
    let inStructureSection = false;
    const structureLines = [];

    for (const line of lines) {
      // Look for File Structure Reference section
      if (line.includes('File Structure Reference') || line.includes('```')) {
        if (line.includes('File Structure Reference')) {
          inStructureSection = true;
          continue;
        }
        if (inStructureSection && line.includes('```')) {
          if (structureLines.length > 0) {
            break; // End of structure block
          } else {
            continue; // Start of structure block
          }
        }
      }

      // Collect structure lines
      if (inStructureSection && line.trim()) {
        structureLines.push(line);
      }
    }

    // Fallback structure if none found
    if (structureLines.length === 0) {
      return `project/
├── src/                 # Source code and core modules
├── _bmad/              # BMAD Method artifacts
├── _bmad-output/       # Generated planning documents
├── .kiro/              # Kiro IDE configuration
├── tools/              # CLI tools and installers
├── test/               # Test files and fixtures
├── docs/               # Documentation
└── node_modules/       # Dependencies`;
    }

    return structureLines.join('\n');
  }

  /**
   * Extract key directories and their purposes
   * @param {Array<string>} lines - Content lines
   * @param {string} content - Full content for fallback
   * @returns {string} Key directories description
   */
  _extractKeyDirectories(lines, content) {
    const directories = [];
    let inStructureSection = false;

    // Look for directory descriptions in the structure section
    for (const line of lines) {
      if (line.includes('File Structure Reference')) {
        inStructureSection = true;
        continue;
      }

      if (inStructureSection && line.startsWith('##') && !line.includes('File Structure')) {
        break;
      }

      // Extract directory descriptions from comments
      if (inStructureSection && line.includes('#') && line.includes('/')) {
        const match = line.match(/├──\s*([^/]+\/)\s*#\s*(.+)/);
        if (match) {
          directories.push(`- **${match[1].trim()}**: ${match[2].trim()}`);
        }
      }
    }

    // Fallback directory descriptions
    if (directories.length === 0) {
      return `- **src/**: Source code and core modules
- **_bmad/**: BMAD Method source files and workflows  
- **_bmad-output/**: Generated planning artifacts and documentation
- **.kiro/**: Kiro IDE agents, commands, and steering files
- **tools/**: CLI tools, installers, and build utilities
- **test/**: Test files, fixtures, and test utilities
- **docs/**: Project documentation and guides`;
    }

    return directories.join('\n');
  }

  /**
   * Extract naming conventions from language rules
   * @param {Array<string>} lines - Content lines
   * @param {string} content - Full content for pattern matching
   * @returns {string} Naming conventions
   */
  _extractNamingConventions(lines, content) {
    const conventions = [];
    let inNamingSection = false;

    // Look for naming patterns in various sections
    for (const line of lines) {
      // Check for naming-related sections
      if (
        line.toLowerCase().includes('naming') ||
        line.toLowerCase().includes('convention') ||
        line.toLowerCase().includes('language-specific')
      ) {
        inNamingSection = true;
        continue;
      }

      if (inNamingSection && line.startsWith('##') && !line.toLowerCase().includes('naming')) {
        inNamingSection = false;
      }

      // Extract naming patterns
      if (line.includes('PascalCase') || line.includes('camelCase') || line.includes('kebab-case') || line.includes('UPPER_SNAKE_CASE')) {
        const convention = line.replace(/^[\s\-*]+/, '').trim();
        if (convention && conventions.length < 8) {
          conventions.push(`- ${convention}`);
        }
      }
    }

    // Also look for file extension rules
    if (content.includes('.yaml') && content.includes('not .yml')) {
      conventions.push('- **YAML files**: Use `.yaml` extension (not `.yml`) - enforced by ESLint');
    }

    // Fallback naming conventions
    if (conventions.length === 0) {
      return `- **Classes**: PascalCase (e.g., KiroCliSetup, BaseIdeSetup)
- **Functions**: camelCase (e.g., generateStructureSteering, validateAgentJson)
- **Variables**: camelCase (e.g., agentConfig, projectDir)
- **Constants**: UPPER_SNAKE_CASE (e.g., DEFAULT_OUTPUT_DIR)
- **Files**: kebab-case (e.g., kiro-cli.js, agent-validator.js)
- **YAML files**: Use \`.yaml\` extension (not \`.yml\`) - enforced by ESLint
- **Directories**: kebab-case or camelCase depending on context`;
    }

    return conventions.slice(0, 8).join('\n');
  }

  /**
   * Extract module organization patterns
   * @param {Array<string>} lines - Content lines
   * @param {string} content - Full content for pattern matching
   * @returns {string} Module organization description
   */
  _extractModuleOrganization(lines, content) {
    const patterns = [];

    // Look for module organization patterns
    if (content.includes('src/core/agents/') && content.includes('src/modules/{module}/agents/')) {
      patterns.push(
        '- **Core modules**: Located in `src/core/` directory',
        '- **Feature modules**: Located in `src/modules/{module}/` directories',
        '- **Agent organization**: Each module has its own `agents/` subdirectory',
      );
    }

    if (content.includes('tools/cli/installers/')) {
      patterns.push(
        '- **CLI tools**: Organized under `tools/cli/` with installer-specific subdirectories',
        '- **Shared components**: Common functionality in `shared/` directories',
      );
    }

    if (content.includes('_bmad/') && content.includes('_bmad-output/')) {
      patterns.push('- **BMAD artifacts**: Source files in `_bmad/`, generated files in `_bmad-output/`');
    }

    // Fallback module organization
    if (patterns.length === 0) {
      return `- **Core modules**: Located in \`src/core/\` directory
- **Feature modules**: Located in \`src/modules/{module}/\` directories  
- **Agent organization**: Each module has its own \`agents/\` subdirectory
- **CLI tools**: Organized under \`tools/cli/\` with installer-specific subdirectories
- **Shared components**: Common functionality in \`shared/\` directories
- **BMAD artifacts**: Source files in \`_bmad/\`, generated files in \`_bmad-output/\``;
    }

    return patterns.join('\n');
  }

  /**
   * Extract configuration files information
   * @param {Array<string>} lines - Content lines
   * @param {string} content - Full content for pattern matching
   * @returns {string} Configuration files description
   */
  _extractConfigurationFiles(lines, content) {
    const configFiles = [];

    // Extract configuration files mentioned in the content
    const configPatterns = [
      { pattern: 'package.json', description: 'Node.js project configuration and dependencies' },
      { pattern: 'eslint.config.mjs', description: 'ESLint flat configuration format' },
      { pattern: 'prettier.config.mjs', description: 'Prettier code formatting configuration' },
      { pattern: 'jest.config.js', description: 'Jest testing framework configuration' },
      { pattern: 'kiro-agent-schema.json', description: 'JSON schema for Kiro agent validation' },
      { pattern: 'platform-codes.yaml', description: 'IDE configuration mapping' },
      { pattern: '.gitignore', description: 'Git ignore patterns' },
      { pattern: '.nvmrc', description: 'Node.js version specification' },
    ];

    for (const { pattern, description } of configPatterns) {
      if (content.includes(pattern)) {
        configFiles.push(`- **${pattern}**: ${description}`);
      }
    }

    // Fallback configuration files
    if (configFiles.length === 0) {
      return `- **package.json**: Node.js project configuration and dependencies
- **eslint.config.mjs**: ESLint flat configuration format
- **prettier.config.mjs**: Prettier code formatting configuration  
- **kiro-agent-schema.json**: JSON schema for Kiro agent validation
- **.gitignore**: Git ignore patterns and exclusions`;
    }

    return configFiles.slice(0, 8).join('\n');
  }

  /**
   * Extract BMAD-specific structure information
   * @param {Array<string>} lines - Content lines
   * @param {string} content - Full content for pattern matching
   * @returns {string} BMAD structure description
   */
  _extractBmadStructure(lines, content) {
    const bmadInfo = [];

    // Look for BMAD-specific directory information
    if (content.includes('_bmad/')) {
      bmadInfo.push('- **_bmad/**: BMAD Method source files and workflows');
    }
    if (content.includes('_bmad-output/')) {
      bmadInfo.push('- **_bmad-output/**: Generated planning artifacts and documentation');
    }
    if (content.includes('.kiro/')) {
      bmadInfo.push('- **.kiro/**: Kiro IDE configuration, agents, and steering files');
    }

    // Look for specific BMAD subdirectories
    if (content.includes('bmm/workflows/')) {
      bmadInfo.push('- **Workflows**: `_bmad/bmm/workflows/` - BMAD workflow definitions');
    }
    if (content.includes('bmm/agents/')) {
      bmadInfo.push('- **Agents**: `_bmad/bmm/agents/` - BMAD agent configurations');
    }
    if (content.includes('planning-artifacts/')) {
      bmadInfo.push('- **Planning**: `_bmad-output/planning-artifacts/` - Generated planning documents');
    }
    if (content.includes('implementation-artifacts/')) {
      bmadInfo.push('- **Implementation**: `_bmad-output/implementation-artifacts/` - Implementation tracking');
    }

    // Fallback BMAD structure
    if (bmadInfo.length === 0) {
      return `- **_bmad/**: BMAD Method source files and workflows
- **_bmad-output/**: Generated planning artifacts and documentation
- **.kiro/**: Kiro IDE configuration, agents, and steering files
- **Workflows**: \`_bmad/bmm/workflows/\` - BMAD workflow definitions
- **Agents**: \`_bmad/bmm/agents/\` - BMAD agent configurations  
- **Planning**: \`_bmad-output/planning-artifacts/\` - Generated planning documents`;
    }

    return bmadInfo.join('\n');
  }

  /**
   * Generate navigation tips based on project structure
   * @param {string} content - Full project context content
   * @returns {string} Navigation tips
   */
  _generateNavigationTips(content) {
    const tips = [];

    // Generate tips based on project characteristics
    if (content.includes('CLI tools')) {
      tips.push('- **CLI Development**: Start in `tools/cli/` for installer and command-line functionality');
    }
    if (content.includes('agents/')) {
      tips.push('- **Agent Development**: Find agent definitions in `src/core/agents/` or `src/modules/{module}/agents/`');
    }
    if (content.includes('test/')) {
      tips.push('- **Testing**: Test files mirror source structure in `test/` directory');
    }
    if (content.includes('_bmad-output/')) {
      tips.push('- **Planning Context**: Check `_bmad-output/planning-artifacts/` for project requirements and architecture');
    }
    if (content.includes('shared/')) {
      tips.push('- **Shared Code**: Look for reusable components in `shared/` directories');
    }

    // Add general navigation tips
    tips.push(
      '- **Configuration**: Root-level config files control project behavior and tooling',
      '- **Documentation**: Check `docs/` for detailed guides and `README.md` files in subdirectories',
    );

    // Fallback navigation tips
    if (tips.length <= 2) {
      return `- **CLI Development**: Start in \`tools/cli/\` for installer and command-line functionality
- **Agent Development**: Find agent definitions in \`src/core/agents/\` or \`src/modules/{module}/agents/\`
- **Testing**: Test files mirror source structure in \`test/\` directory
- **Planning Context**: Check \`_bmad-output/planning-artifacts/\` for project requirements
- **Configuration**: Root-level config files control project behavior and tooling`;
    }

    return tips.slice(0, 6).join('\n');
  }

  /**
   * Get additional structure reference files
   * @returns {string} Additional file references
   */
  _getAdditionalStructureRefs() {
    const additionalRefs = [];

    // Check for common structure-related files
    const possibleFiles = ['architecture.md', 'README.md', 'CONTRIBUTING.md', 'package.json'];

    for (const file of possibleFiles) {
      let fullPath;
      if (file === 'package.json' || file === 'README.md' || file === 'CONTRIBUTING.md') {
        fullPath = path.join(this.projectDir, file);
      } else {
        fullPath = path.join(this.projectDir, this.sourceDir, file);
      }

      if (fs.existsSync(fullPath)) {
        const displayName = file
          .replace('.md', '')
          .replace('.json', '')
          .replaceAll(/\b\w/g, (l) => l.toUpperCase());
        const refPath = file === 'package.json' || file === 'README.md' || file === 'CONTRIBUTING.md' ? file : `${this.sourceDir}/${file}`;
        additionalRefs.push(`- ${displayName}: #[[file:${refPath}]]`);
      }
    }

    return additionalRefs.join('\n');
  }

  /**
   * Get additional technical reference files
   * @returns {string} Additional technical file references
   */
  _getAdditionalTechRefs() {
    const additionalRefs = [];

    // Check for common technical files
    const possibleFiles = ['technical-specs.md', 'implementation-readiness-report.md', 'adrs/', 'design-decisions.md'];

    for (const file of possibleFiles) {
      const fullPath = path.join(this.projectDir, this.sourceDir, file);
      if (fs.existsSync(fullPath)) {
        const displayName = file
          .replaceAll('.md', '')
          .replaceAll('-', ' ')
          .replaceAll(/\b\w/g, (l) => l.toUpperCase());
        additionalRefs.push(`- ${displayName}: #[[file:${this.sourceDir}/${file}]]`);
      }
    }

    return additionalRefs.join('\n');
  }

  /**
   * Extract design patterns from architecture content
   * @param {Array<string>} lines - Content lines
   * @returns {Array<string>} List of design patterns
   */
  _extractDesignPatterns(lines) {
    const patterns = [];
    let inPatternsSection = false;

    for (const line of lines) {
      // Check if we're entering a patterns section
      if (
        (line.toLowerCase().includes('pattern') || line.toLowerCase().includes('implementation patterns')) &&
        (line.startsWith('#') || line.startsWith('**'))
      ) {
        inPatternsSection = true;
        continue;
      }

      // Check if we're leaving the section
      if (inPatternsSection && (line.startsWith('#') || (line.startsWith('**') && line.endsWith('**')))) {
        break;
      }

      // Extract patterns
      if (inPatternsSection && (line.trim().startsWith('-') || line.trim().startsWith('*'))) {
        const pattern = line.replace(/^[\s\-*]+/, '').trim();
        if (pattern && patterns.length < 5) {
          patterns.push(pattern);
        }
      }
    }

    // Fallback patterns if none found
    if (patterns.length === 0) {
      patterns.push(
        'Composition pattern: Use shared generators rather than inheritance',
        'Fail-fast validation: Validate schemas before file writes',
        'Cross-platform paths: Use path.join() for all file operations',
      );
    }

    return patterns;
  }

  /**
   * Extract technology stack from architecture content
   * @param {Array<string>} lines - Content lines
   * @returns {string} Technology stack information
   */
  _extractTechnologyStack(lines) {
    const techSections = [];
    let inTechSection = false;

    for (const line of lines) {
      // Check for technology sections
      if (
        (line.toLowerCase().includes('technology') ||
          line.toLowerCase().includes('tech stack') ||
          line.toLowerCase().includes('dependencies') ||
          line.toLowerCase().includes('language')) &&
        (line.startsWith('#') || line.startsWith('**'))
      ) {
        inTechSection = true;
        continue;
      }

      // Check if we're leaving the section
      if (inTechSection && (line.startsWith('#') || (line.startsWith('**') && line.endsWith('**')))) {
        break;
      }

      // Extract technology information
      if (inTechSection && line.trim() && !line.startsWith('|') && techSections.length < 10) {
        const tech = line.replace(/^[\s\-*\d.]+/, '').trim();
        if (tech) {
          techSections.push(tech);
        }
      }
    }

    // Fallback technology stack
    if (techSections.length === 0) {
      return `- **Runtime**: Node.js >=20.0.0
- **Language**: JavaScript with CommonJS modules
- **File Operations**: fs-extra for cross-platform file handling
- **Path Handling**: path.join() for cross-platform compatibility
- **Validation**: Ajv for JSON Schema validation
- **Testing**: Jest 30.x for unit and integration tests`;
    }

    return techSections
      .slice(0, 10)
      .map((tech) => `- ${tech}`)
      .join('\n');
  }

  /**
   * Extract coding standards from architecture content
   * @param {Array<string>} lines - Content lines
   * @returns {string} Coding standards information
   */
  _extractCodingStandards(lines) {
    const standards = [];
    let inStandardsSection = false;

    for (const line of lines) {
      // Check for standards sections
      if (
        (line.toLowerCase().includes('naming') ||
          line.toLowerCase().includes('convention') ||
          line.toLowerCase().includes('standard') ||
          line.toLowerCase().includes('pattern')) &&
        (line.startsWith('#') || line.startsWith('**'))
      ) {
        inStandardsSection = true;
        continue;
      }

      // Check if we're leaving the section
      if (inStandardsSection && (line.startsWith('#') || (line.startsWith('**') && line.endsWith('**')))) {
        break;
      }

      // Extract standards
      if (inStandardsSection && (line.trim().startsWith('-') || line.trim().startsWith('*'))) {
        const standard = line.replace(/^[\s\-*]+/, '').trim();
        if (standard && standards.length < 8) {
          standards.push(standard);
        }
      }
    }

    // Fallback coding standards
    if (standards.length === 0) {
      return `- **Classes**: PascalCase (e.g., KiroCliSetup, AgentValidator)
- **Functions**: camelCase (e.g., validateAgentJson, getOutputPath)
- **Variables**: camelCase (e.g., agentConfig, outputDir)
- **Constants**: UPPER_SNAKE_CASE (e.g., DEFAULT_OUTPUT_DIR)
- **Files**: kebab-case (e.g., kiro-cli.js, agent-validator.js)
- **Paths**: Always use path.join() for cross-platform compatibility
- **Validation**: Validate schemas before file writes (fail-fast)
- **Cleanup**: Only delete files with bmad* prefix`;
    }

    return standards
      .slice(0, 8)
      .map((std) => `- ${std}`)
      .join('\n');
  }

  /**
   * Extract architectural decisions from content
   * @param {Array<string>} lines - Content lines
   * @returns {string} Architectural decisions summary
   */
  _extractArchitecturalDecisions(lines) {
    const decisions = [];
    let inDecisionSection = false;

    for (const line of lines) {
      // Check for decision sections
      if (
        (line.toLowerCase().includes('decision') ||
          line.toLowerCase().includes('architectural') ||
          line.toLowerCase().includes('choice')) &&
        (line.startsWith('#') || line.startsWith('**'))
      ) {
        inDecisionSection = true;
        continue;
      }

      // Check if we're leaving the section
      if (inDecisionSection && (line.startsWith('#') || (line.startsWith('**') && line.endsWith('**')))) {
        break;
      }

      // Extract decisions
      if (inDecisionSection && (line.trim().startsWith('-') || line.trim().startsWith('*') || line.includes('|'))) {
        const decision = line.replace(/^[\s\-*|]+/, '').trim();
        if (decision && decisions.length < 5) {
          decisions.push(decision);
        }
      }
    }

    // Check for ADR files
    const adrRefs = this._findADRFiles();

    // Fallback decisions if none found
    if (decisions.length === 0 && adrRefs.length === 0) {
      return `- **Schema Validation**: Use Ajv for JSON Schema validation before file writes
- **Generator Pattern**: Composition over inheritance for shared generators
- **Error Handling**: Fail-fast approach - halt on validation errors
- **Path Handling**: Cross-platform compatibility via path.join()
- **Cleanup Strategy**: Only remove bmad* prefixed files to preserve user data`;
    }

    let result = '';
    if (decisions.length > 0) {
      result += decisions
        .slice(0, 5)
        .map((decision) => `- ${decision}`)
        .join('\n');
    }

    if (adrRefs.length > 0) {
      if (result) result += '\n\n';
      result += '**Architecture Decision Records:**\n';
      result += adrRefs.map((adr) => `- ${adr}`).join('\n');
    }

    return result || 'No specific architectural decisions documented yet.';
  }

  /**
   * Find ADR files in the project
   * @returns {Array<string>} List of ADR file references
   */
  _findADRFiles() {
    const adrRefs = [];
    const possibleAdrDirs = ['adrs', 'adr', 'decisions'];

    for (const dir of possibleAdrDirs) {
      const adrPath = path.join(this.projectDir, this.sourceDir, dir);
      if (fs.existsSync(adrPath)) {
        try {
          const files = fs.readdirSync(adrPath).filter((f) => f.endsWith('.md'));
          for (const file of files.slice(0, 5)) {
            const title = file.replace('.md', '').replace(/^\d+-/, '').replaceAll('-', ' ');
            adrRefs.push(`[${title}]: #[[file:${this.sourceDir}/${dir}/${file}]]`);
          }
        } catch {
          // Ignore read errors
        }
      }
    }

    return adrRefs;
  }

  /**
   * Create technical quick reference
   * @param {string} content - Full architecture content
   * @returns {string} Technical quick reference
   */
  _createTechnicalQuickReference(content) {
    const constraints = [];
    const gotchas = [];

    // Look for constraints and gotchas
    const lines = content.split('\n');
    for (const line of lines) {
      if (line.toLowerCase().includes('constraint') || line.toLowerCase().includes('must') || line.toLowerCase().includes('required')) {
        const constraint = line.replace(/^[\s\-*\d.]+/, '').trim();
        if (constraint && constraints.length < 3) {
          constraints.push(constraint);
        }
      }
      if (line.toLowerCase().includes('gotcha') || line.toLowerCase().includes('warning') || line.toLowerCase().includes('anti-pattern')) {
        const gotcha = line.replace(/^[\s\-*\d.]+/, '').trim();
        if (gotcha && gotchas.length < 3) {
          gotchas.push(gotcha);
        }
      }
    }

    let quickRef = 'Essential technical guidelines and constraints:\n\n';

    if (constraints.length > 0) {
      quickRef += '**Key Constraints:**\n';
      for (const constraint of constraints) {
        quickRef += `- ${constraint}\n`;
      }
      quickRef += '\n';
    }

    if (gotchas.length > 0) {
      quickRef += '**Common Gotchas:**\n';
      for (const gotcha of gotchas) {
        quickRef += `- ${gotcha}\n`;
      }
    }

    if (constraints.length === 0 && gotchas.length === 0) {
      quickRef += '- Always use path.join() for file paths (cross-platform compatibility)\n';
      quickRef += '- Validate JSON schemas before writing files (prevent silent failures)\n';
      quickRef += '- Only delete bmad* prefixed files during cleanup (preserve user data)';
    }

    return quickRef;
  }

  /**
   * Extract architecture section content
   * @param {Array<string>} lines - Content lines
   * @param {Array<string>} headers - Section headers to look for
   * @returns {string} Extracted section content
   */
  _extractArchitectureSection(lines, headers) {
    for (const header of headers) {
      const headerIndex = lines.findIndex((line) => line.toLowerCase().includes(header.toLowerCase()) && line.startsWith('#'));

      if (headerIndex !== -1) {
        // Find next header or end of content
        let endIndex = lines.length;
        for (let i = headerIndex + 1; i < lines.length; i++) {
          if (lines[i].startsWith('#') && lines[i].length > lines[headerIndex].length) {
            endIndex = i;
            break;
          }
        }

        // Extract meaningful content, skip empty lines and headers
        const sectionLines = lines
          .slice(headerIndex + 1, endIndex)
          .filter((line) => line.trim() !== '' && !line.startsWith('#'))
          .slice(0, 5); // Limit to first 5 meaningful lines

        if (sectionLines.length > 0) {
          return sectionLines.join(' ').trim();
        }
      }
    }
    return null;
  }

  /**
   * Extract architecture patterns from implementation patterns section
   * @param {Array<string>} lines - Content lines
   * @returns {Array<string>} List of design patterns
   */
  _extractArchitecturePatterns(lines) {
    const patterns = [];
    let inPatternsSection = false;

    for (const line of lines) {
      // Look for implementation patterns section
      if (line.includes('Implementation Patterns') || line.includes('Pattern Categories')) {
        inPatternsSection = true;
        continue;
      }

      // Stop at next major section
      if (inPatternsSection && line.startsWith('##') && !line.toLowerCase().includes('pattern')) {
        break;
      }

      // Extract patterns from various formats
      if (inPatternsSection) {
        // Look for bullet points
        if (line.trim().startsWith('-') || line.trim().startsWith('*')) {
          const pattern = line.replace(/^[\s\-*]+/, '').trim();
          if (pattern && !pattern.startsWith('**') && patterns.length < 6) {
            patterns.push(pattern);
          }
        }
        // Look for code examples or specific patterns
        if (
          line.includes('extends BaseIdeSetup') ||
          line.includes('composition') ||
          line.includes('path.join()') ||
          line.includes('validation')
        ) {
          const pattern = line.trim();
          if (pattern && patterns.length < 6) {
            patterns.push(pattern);
          }
        }
      }
    }

    // Fallback patterns from architecture document
    if (patterns.length === 0) {
      patterns.push(
        'Extend BaseIdeSetup for IDE installer integration',
        'Composition over inheritance for shared generators',
        'Fail-fast validation before file operations',
        'Cross-platform path handling with path.join()',
      );
    }

    return patterns.slice(0, 6);
  }

  /**
   * Extract technology stack from architecture decisions
   * @param {Array<string>} lines - Content lines
   * @returns {string} Technology stack information
   */
  _extractArchitectureTechStack(lines) {
    const techItems = [];
    let inTechSection = false;

    for (const line of lines) {
      // Look for technology-related sections
      if (
        line.includes('Technology Domain') ||
        line.includes('Language & Runtime') ||
        line.includes('Dependencies') ||
        line.includes('Architectural Decisions')
      ) {
        inTechSection = true;
        continue;
      }

      // Stop at next major section
      if (inTechSection && line.startsWith('##') && !line.toLowerCase().includes('tech') && !line.toLowerCase().includes('decision')) {
        break;
      }

      // Extract technology information
      if (
        inTechSection && // Look for specific technologies mentioned
        (line.includes('Node.js') ||
          line.includes('JavaScript') ||
          line.includes('CommonJS') ||
          line.includes('fs-extra') ||
          line.includes('Ajv') ||
          line.includes('Jest'))
      ) {
        const tech = line.trim().replace(/^[\s\-*]+/, '');
        if (tech && techItems.length < 8) {
          techItems.push(tech);
        }
      }
    }

    // Fallback technology stack
    if (techItems.length === 0) {
      return `**Runtime**: Node.js >=20.0.0
**Language**: JavaScript with CommonJS modules  
**File Operations**: fs-extra for cross-platform file handling
**Path Handling**: path.join() for cross-platform compatibility
**Validation**: Ajv for JSON Schema validation
**Testing**: Jest 30.x for unit and integration tests`;
    }

    return techItems.slice(0, 8).join('\n');
  }

  /**
   * Extract coding standards from architecture patterns
   * @param {Array<string>} lines - Content lines
   * @returns {string} Coding standards information
   */
  _extractArchitectureStandards(lines) {
    const standards = [];
    let inStandardsSection = false;

    for (const line of lines) {
      // Look for naming or format patterns sections
      if (line.includes('Naming Patterns') || line.includes('Format Patterns') || line.includes('Consistency Rules')) {
        inStandardsSection = true;
        continue;
      }

      // Stop at next major section
      if (
        inStandardsSection &&
        line.startsWith('##') &&
        !line.toLowerCase().includes('pattern') &&
        !line.toLowerCase().includes('format')
      ) {
        break;
      }

      // Extract standards
      if (
        inStandardsSection &&
        (line.includes('PascalCase') ||
          line.includes('camelCase') ||
          line.includes('kebab-case') ||
          line.includes('path.join') ||
          line.includes('validation') ||
          line.includes('cleanup'))
      ) {
        const standard = line.trim().replace(/^[\s\-*|]+/, '');
        if (standard && standards.length < 8) {
          standards.push(standard);
        }
      }
    }

    // Fallback coding standards
    if (standards.length === 0) {
      return `**Classes**: PascalCase (e.g., KiroCliSetup, AgentValidator)
**Functions**: camelCase (e.g., validateAgentJson, getOutputPath)  
**Files**: kebab-case (e.g., kiro-cli.js, agent-validator.js)
**Paths**: Always use path.join() for cross-platform compatibility
**Validation**: Validate schemas before file writes (fail-fast)
**Cleanup**: Only delete files with bmad* prefix`;
    }

    return standards.slice(0, 8).join('\n');
  }

  /**
   * Extract architectural decisions
   * @param {Array<string>} lines - Content lines
   * @returns {string} Architectural decisions summary
   */
  _extractArchitectureDecisions(lines) {
    const decisions = [];
    let inDecisionSection = false;

    for (const line of lines) {
      // Look for architectural decisions section
      if (
        line.includes('Core Architectural Decisions') ||
        line.includes('Decision Priority') ||
        line.includes('Schema Validation') ||
        line.includes('Generator Integration')
      ) {
        inDecisionSection = true;
        continue;
      }

      // Stop at next major section
      if (
        inDecisionSection &&
        line.startsWith('##') &&
        !line.toLowerCase().includes('decision') &&
        !line.toLowerCase().includes('architecture')
      ) {
        break;
      }

      // Extract decisions from tables or bullet points
      if (inDecisionSection) {
        if (line.includes('|') && (line.includes('Choice') || line.includes('Rationale'))) {
          // Skip table headers
          continue;
        }
        if (line.includes('|') && line.includes('**')) {
          const parts = line.split('|').map((p) => p.trim());
          if (parts.length >= 3) {
            const decision = `${parts[1]}: ${parts[2]}`;
            if (decisions.length < 5) {
              decisions.push(decision);
            }
          }
        }
      }
    }

    // Check for ADR files
    const adrRefs = this._findADRFiles();

    // Fallback decisions
    if (decisions.length === 0 && adrRefs.length === 0) {
      return `**Schema Validation**: Use Ajv for JSON Schema validation before file writes
**Generator Pattern**: Composition over inheritance for shared generators  
**Error Handling**: Fail-fast approach - halt on validation errors
**Path Handling**: Cross-platform compatibility via path.join()
**Cleanup Strategy**: Only remove bmad* prefixed files to preserve user data`;
    }

    let result = '';
    if (decisions.length > 0) {
      result += decisions.slice(0, 5).join('\n');
    }

    if (adrRefs.length > 0) {
      if (result) result += '\n\n';
      result += '**Architecture Decision Records:**\n';
      result += adrRefs.join('\n');
    }

    return result || 'No specific architectural decisions documented yet.';
  }

  /**
   * Create architecture-specific quick reference
   * @param {string} content - Full architecture content
   * @returns {string} Technical quick reference
   */
  _createArchitectureQuickReference(content) {
    const constraints = [];
    const patterns = [];

    // Look for key constraints and patterns
    const lines = content.split('\n');
    for (const line of lines) {
      if (line.toLowerCase().includes('must') || line.toLowerCase().includes('required') || line.toLowerCase().includes('constraint')) {
        const constraint = line.replace(/^[\s\-*\d.]+/, '').trim();
        if (constraint && constraint.length < 100 && constraints.length < 3) {
          constraints.push(constraint);
        }
      }
      if (line.includes('path.join()') || line.includes('validation') || line.includes('bmad*') || line.includes('schema')) {
        const pattern = line.replace(/^[\s\-*\d.]+/, '').trim();
        if (pattern && pattern.length < 100 && patterns.length < 3) {
          patterns.push(pattern);
        }
      }
    }

    let quickRef = 'Essential development guidelines:\n\n';

    if (patterns.length > 0) {
      quickRef += '**Key Patterns:**\n';
      for (const pattern of patterns) {
        quickRef += `- ${pattern}\n`;
      }
      quickRef += '\n';
    }

    if (constraints.length > 0) {
      quickRef += '**Critical Constraints:**\n';
      for (const constraint of constraints) {
        quickRef += `- ${constraint}\n`;
      }
    }

    if (constraints.length === 0 && patterns.length === 0) {
      quickRef += '- Always use path.join() for file paths (cross-platform compatibility)\n';
      quickRef += '- Validate JSON schemas before writing files (prevent silent failures)\n';
      quickRef += '- Only delete bmad* prefixed files during cleanup (preserve user data)\n';
      quickRef += '- Extend BaseIdeSetup class for IDE installer integration';
    }

    return quickRef;
  }

  /**
   * Write steering file content to target directory
   * @param {string} filename - Target filename
   * @param {string} content - File content
   */
  async _writeSteeringFile(filename, content) {
    const targetDir = path.join(this.projectDir, this.targetDir);
    await fs.ensureDir(targetDir);
    const targetPath = path.join(targetDir, filename);
    await fs.writeFile(targetPath, content);
    console.log(chalk.green(`✓ Generated ${path.join(this.targetDir, filename)}`));
  }
}

module.exports = { KiroSteeringGenerator };
