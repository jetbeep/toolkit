# Fleet Asset Updater

A utility for updating device settings and firmware on controllers through the Fleet API.

## Features

- Update device settings for multiple controllers at once
- Schedule updates for controllers
- Import/export configurations
- Command-line interface for scripting and automation
- Detailed logging with curl command generation for debugging

## Web Interface

The web interface allows you to:

1. Configure API settings (base URL and API key)
2. Update device settings for multiple controllers
3. Schedule updates for controllers (optional)
4. Monitor update progress with detailed logs
5. Import/export your configurations

### Usage

1. Open `index.html` in a web browser
2. Enter your API base URL and API key
3. Enter controller IDs (comma-separated)
4. Enter device settings in JSON format
5. Click "Update Device Settings" to start the process
6. If needed, enable firmware update and click "Schedule Firmware Update"

### JSON Format

The device settings JSON should match the format expected by the API. Example:

```json
{
  "aspScripts_rebootOnAspCrash": false,
  "aspScripts_useTcpBridge": true,
  "fileSetIds": {
    "images": 388,
    "scripts": 389,
    "service_menu": 390
  }
}
```

## Command Line Interface

For automation and scripting, you can use the `update-controller.js` script.

### Requirements

- Node.js 14 or higher
- npm packages: axios

### Installation

```bash
npm install
```

### Usage

```bash
node update-controller.js <base_url> <api_key> <controller_id> [settings_file]
# OR
node update-controller.js <base_url> <api_key> <controller_ids_comma_separated> [settings_file]
```

Examples:

```bash
# Update a single controller
node update-controller.js https://api.example.com 12345:abcdef 123 ./update-settings.json

# Update multiple controllers
node update-controller.js https://api.example.com 12345:abcdef 123,456,789 ./update-settings.json
```

If no settings file is specified, it will look for `update-settings.json` in the current directory.

### Settings File Format

Create a JSON file with the settings you want to update. Example `update-settings.json`:

```json
{
  "aspScripts_rebootOnAspCrash": false,
  "aspScripts_useTcpBridge": true,
  "fileSetIds": {
    "images": 388,
    "scripts": 389,
    "service_menu": 390
  }
}
```

## Updates

Updates are created and then activated in a two-step process:

1. An update plan is created with controller ID, optional firmware version, and additional options
2. The plan is activated to trigger the update

### Update Types

- **Sleep**: Update during inactive hours (default)
- **Urgent**: Immediate update

### Firmware

- Firmware version is optional
- If specified, the controller will update to the specified version
- If omitted, other settings can still be updated without changing the firmware

### Tracking Options

- **Custom Field**: Optional identifier for tracking/filtering updates
- **Comment**: Description of the update (defaults to "Publisher Update")

### Using the CLI for Updates

```bash
# Update settings only
node update-controller.js https://api.example.com 12345:abcdef 123 ./settings.json --update

# Update settings and schedule firmware update 
node update-controller.js https://api.example.com 12345:abcdef 123 ./settings.json --fw 1.2.3+0 --type sleep --custom tracking123 --comment "Test update"
```

CLI options:

- `--update`: Enable scheduling update without firmware
- `--fw <version>`: Optional firmware version to install
- `--type <type>`: Update type (sleep or urgent)
- `--custom <value>`: Custom field for tracking
- `--comment <text>`: Comment/description

## How It Works

The tool uses the new Fleet API to update device settings directly:

1. Sends only the settings you want to change to `/f-controllers/{controllerId}/device-settings`

The new API handles partial updates automatically, so you only need to specify the settings you want to change. The API will merge your changes with the existing configuration on the server side.

## Development

### File Structure

- `asset-updater.js` - Main application logic for the web interface
- `update-controller.js` - Command-line script for updating controllers
- `update-settings.json` - Example settings file
- `index.html` - Web interface

## Troubleshooting

If you encounter issues:

1. Check the logs in the web interface or console output
2. Use the generated curl commands to test the API directly
3. Verify your API key and base URL
4. Ensure your controller IDs are valid 