# File Set Manager

A browser-based tool for managing JetBeep Fleet API file sets. This tool allows you to view, upload, edit, and delete files within file sets through a user-friendly web interface.

## Features

- **Browse File Sets**: View all available file sets with search and filter capabilities
- **File Management**:
  - Upload new files to file sets
  - Delete existing files
  - Edit/replace files
- **File Type Support**: Handles all JetBeep file types:
  - `screenImage` - Screen image files
  - `uiScriptBin` - UI script binaries
  - `uiScriptData` - UI script data files
  - `screenFont` - Screen font files
- **Configuration Management**:
  - Save API credentials to browser localStorage
  - Import/export configuration as JSON
  - Privacy-focused: processes everything client-side
- **Real-time Updates**: Automatic refresh of file lists after operations
- **User-Friendly Interface**: Modern Bootstrap 5 design with responsive layout

## Getting Started

### Prerequisites

- Modern web browser (Chrome, Firefox, Edge, Safari)
- Access to JetBeep Fleet API
- Valid API Key (same as used in Publisher tool)

### Setup

1. **Open the Tool**: Navigate to `file-set-manager/index.html` in your browser or access via the toolkit home page.

2. **Configure API Connection**:
   - **Base URL**: Enter your Fleet API base URL (default: `https://dev.jetbeep.com/fleet/api`)
   - **API Key**: Enter your API key (same token used in the Publisher tool)

3. **Connect**: Click "Connect & Load File Sets" to authenticate and load available file sets.

## Usage

### Browsing File Sets

1. After connecting, the left panel shows all available file sets
2. Use the search box to filter by name, group, or creator
3. Click on any file set to view its details

### Viewing File Set Details

When you select a file set, you'll see:
- **Metadata**: ID, group, creator, creation date, CRC32, readonly status
- **Files List**: All files in the set with type, path, creator, and creation date
- **File Count**: Total number of files in the set

### Adding Files

1. Select a file set from the list
2. In the "Add New File" section:
   - Choose the file type from the dropdown
   - Click "Select File" and choose a file from your computer
3. Click "Upload File"
4. The file list will automatically refresh

### Editing Files

1. Click the "Edit" button next to any file
2. In the modal dialog:
   - Optionally change the file type
   - Select a new file to replace the existing one
3. Click "Save Changes"

### Deleting Files

1. Click the "Delete" button next to any file
2. Confirm the deletion in the dialog
3. The file will be removed and the list will refresh

### Configuration Management

#### Save to Browser
Click "Save Config to Browser" to store your API credentials in localStorage for future sessions.

#### Export Configuration
Click "Export Config" to download your configuration as a JSON file. Note: API key is not exported for security reasons.

#### Import Configuration
Click "Import Config" to load a previously exported configuration file. You'll need to manually enter the API key.

#### Clear Configuration
Click "Clear Saved Config" to remove stored credentials from your browser.

## API Endpoints Used

The tool interacts with the following Fleet API endpoints:

- `GET /f-file-sets/?extensions=creator,filesStats&perPage=50` - List all file sets
- `GET /f-file-sets/{id}` - Get file set details with files
- `POST /f-file-sets/files` - Upload a new file
- `PATCH /f-file-sets/files/{id}` - Update an existing file
- `DELETE /f-file-sets/files/{id}` - Delete a file

## Security & Privacy

- **Client-Side Only**: All processing happens in your browser
- **No Data Storage**: Files are sent directly to the API, not stored locally
- **Secure Authentication**: Uses cookie-based authentication via the Fleet API
- **Local Config Storage**: Configuration is stored only in your browser's localStorage

## Technical Details

### File Upload Format

Files are uploaded as base64-encoded data with the following structure:

```json
{
  "setId": 539,
  "type": "screenImage",
  "path": "filename.jpg",
  "data": "base64_encoded_file_data"
}
```

### File Types

- **screenImage**: Image files for screen display (JPG, PNG, etc.)
- **uiScriptBin**: Compiled UI script binaries (.aspe files)
- **uiScriptData**: UI script configuration/data files (.jkv files)
- **screenFont**: Font files for screen rendering (.fnt files)

## Troubleshooting

### Connection Issues

**Problem**: "Connection failed" error
- **Solution**: Verify your API key is correct and not expired
- Check that the base URL is correct
- Ensure you have network access to the Fleet API

### API Key

**Problem**: Where to find the API key
- **Solution**: The API key is the same as used in the Publisher tool. It should be provided by your JetBeep administrator or available in your Fleet account settings.

### Upload Failures

**Problem**: File upload fails
- **Solution**:
  - Check file size (very large files may fail)
  - Verify you have permission to modify the file set
  - Ensure the file set is not marked as readonly
  - Check browser console for detailed error messages

## Browser Compatibility

- Chrome/Edge: ✅ Fully supported
- Firefox: ✅ Fully supported
- Safari: ✅ Fully supported
- Opera: ✅ Fully supported

Requires modern browser with support for:
- FileReader API
- Fetch API
- LocalStorage API
- ES6+ JavaScript

## Version History

### v1.0.0 (2025-11-19)
- Initial release
- File set browsing and search
- File upload, edit, and delete operations
- Configuration management
- Import/export functionality

## Related Tools

- **Publisher**: Fleet management utility for updating device settings
- **Logs Viewer**: Web-based log file analysis tool
- **Image Renamer**: Batch image renaming with perceptual hashing

## Support

For issues or feature requests, please contact the JetBeep development team.
