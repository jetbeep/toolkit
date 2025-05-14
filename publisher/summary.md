# Fleet Asset Updater - Project Summary

## Project Overview
The Fleet Asset Updater is a utility tool designed to update device settings and firmware on controllers through the Fleet API. It provides both a web interface and a command-line interface (CLI) for flexible usage in different scenarios.

## Key Features
- Update device settings for multiple controllers simultaneously
- Schedule firmware updates with customizable options
- Import/export configurations for easier reuse
- Detailed logging with curl command generation for debugging
- Support for both GUI and CLI operation modes

## Architecture and Components

### Core Files
- `index.html`: Web interface with responsive Bootstrap styling
- `asset-updater.js`: Main business logic for the web interface
- `update-controller.js`: Node.js CLI script for updating controllers
- `update-settings.json`: Example settings configuration file
- API documentation: PDF files containing Fleet UpdatePlans and FileSets API documentation

### Web Interface (Frontend)
The web interface provides a user-friendly way to:
- Configure API settings (base URL and API key)
- Specify controllers to update (via comma-separated IDs)
- Edit device settings in JSON format (with validation)
- Schedule updates with options for firmware version, update type, tracking, etc.
- Monitor progress with detailed logs and curl command display
- Export/import configurations for reuse

### CLI Interface
The command-line tool enables automation and scripting with:
- Node.js based implementation using axios for API requests
- Support for updating single or multiple controllers
- JSON file-based configuration
- Optional parameters for firmware updates and scheduling
- Detailed console output with curl commands for debugging

## Technical Implementation

### Main Workflow
1. Authentication with Fleet API using base URL and API key
2. Fetching current controller configuration
3. Merging user-specified changes with current configuration
4. Sending updated configuration to the API
5. Optionally scheduling and activating firmware updates

### Key Functions
- Configuration merging with special handling for fileSetIds
- JSON validation and formatting
- Progress tracking and status updates
- Curl command generation for debugging
- Configuration export/import

### Update Process
Updates follow a two-step process:
1. Creating an update plan with controller ID and options
2. Activating the plan to trigger the update

## Design Patterns
- Class-based organization in the web interface (FleetAssetUpdater class)
- Functional approach in the CLI tool
- Configuration as JSON for flexibility
- Detailed logging and error handling
- Progressive disclosure UI (showing firmware options only when enabled)

## Dependencies
- Web interface: Bootstrap 5.3 for styling
- CLI: Node.js with axios library for HTTP requests

## Usage Scenarios
- Single controller updates via web interface
- Batch updates of multiple controllers
- Automated updates via CLI scripting
- Settings-only updates without firmware changes
- Full updates with firmware version changes
- Scheduled updates during inactive hours

This project provides a comprehensive tool for managing Fleet controller assets with a focus on flexibility, robustness, and user experience. 