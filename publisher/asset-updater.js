// Fleet Asset Updater - Business Logic

// Add styles for curl commands
const style = document.createElement('style');
style.textContent = `
  .curl-command {
    background: #f5f5f5;
    padding: 10px;
    border-radius: 4px;
    font-family: monospace;
    overflow-x: auto;
    margin: 0;
    white-space: pre-wrap;
    word-break: break-all;
  }
  
  .curl-container {
    position: relative;
    margin-bottom: 10px;
    border: 1px solid #ddd;
    border-radius: 4px;
  }
  
  .copy-curl-btn {
    position: absolute;
    top: 5px;
    right: 5px;
    background: #007bff;
    color: white;
    border: none;
    border-radius: 4px;
    padding: 3px 8px;
    font-size: 12px;
    cursor: pointer;
  }
  
  .copy-curl-btn:hover {
    background: #0069d9;
  }
`;
document.head.appendChild(style);

class FleetAssetUpdater {
  constructor() {
    // DOM Elements
    this.form = document.getElementById('assetUpdateForm');
    this.baseUrlInput = document.getElementById('baseUrl');
    this.apiKeyInput = document.getElementById('apiKey');
    this.controllerIdsInput = document.getElementById('controllerIds');
    this.jsonEditorInput = document.getElementById('jsonEditor');
    this.formatJsonBtn = document.getElementById('formatJsonBtn');
    this.loadExampleBtn = document.getElementById('loadExampleBtn');
    this.mainFirmwareVersionInput = document.getElementById('mainFirmwareVersion');
    this.enableFirmwareUpdateCheckbox = document.getElementById('enableFirmwareUpdate');
    this.firmwareOptionsDiv = document.getElementById('firmwareOptions');
    this.updateTypeSelect = document.getElementById('updateType');
    this.customField1Input = document.getElementById('customField1');
    this.commentInput = document.getElementById('comment');
    this.resetFormBtn = document.getElementById('resetFormBtn');
    this.updateFilesetsBtn = document.getElementById('updateFilesetsBtn');
    this.scheduleUpdateBtn = document.getElementById('scheduleUpdateBtn');
    this.progressCard = document.getElementById('progressCard');
    this.progressBar = document.getElementById('progressBar');
    this.progressText = document.getElementById('progressText');
    this.progressStatus = document.getElementById('progressStatus');
    this.logContainer = document.getElementById('logContainer');
    this.exportConfigBtn = document.getElementById('exportConfig');
    this.importConfigInput = document.getElementById('importConfig');
    this.importConfigBtn = document.getElementById('importConfigBtn');

    // Variables to track state
    this.isUpdating = false;
    this.updatedControllers = [];
    this.failedControllers = [];
    this.currentProgress = 0;
    this.axiosInstance = null;

    // Initialize event listeners
    this.initEventListeners();
  }

  initEventListeners() {
    // Toggle firmware options
    this.enableFirmwareUpdateCheckbox.addEventListener('change', () => {
      this.firmwareOptionsDiv.classList.toggle('hidden', !this.enableFirmwareUpdateCheckbox.checked);
    });

    // Format JSON
    this.formatJsonBtn.addEventListener('click', () => {
      this.formatJson();
    });

    // Load example JSON
    this.loadExampleBtn.addEventListener('click', () => {
      this.loadExampleJson();
    });

    // Validate JSON input
    this.jsonEditorInput.addEventListener('input', () => {
      this.validateJsonInput();
    });

    // Form submission
    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (this.isUpdating) return;
      
      if (!this.validateForm()) return;
      this.startUpdateProcess();
    });

    // Schedule firmware update button
    this.scheduleUpdateBtn.addEventListener('click', () => {
      if (!this.validateFirmwareForm()) return;
      this.scheduleUpdate();
    });

    // Reset form button
    this.resetFormBtn.addEventListener('click', () => {
      this.resetForm();
    });

    // Export configuration
    this.exportConfigBtn.addEventListener('click', () => {
      this.exportConfig();
    });

    // Import configuration
    this.importConfigBtn.addEventListener('click', () => {
      const file = this.importConfigInput.files[0];
      if (file) {
        this.importConfig(file);
      } else {
        this.addLog('Please select a file to import', 'error');
      }
    });
  }

  // Format JSON
  formatJson() {
    try {
      const json = JSON.parse(this.jsonEditorInput.value.trim() || '{}');
      this.jsonEditorInput.value = JSON.stringify(json, null, 2);
      this.validateJsonInput();
    } catch (e) {
      this.addLog('Invalid JSON format', 'error');
    }
  }

  // Load example JSON
  loadExampleJson() {
    const exampleJson = {
      "aspScripts_uiScript": "/lfs1/asp/ui/scripts/app.aspe",
      "aspScripts_serviceScript": "/lfs1/asp/ui/scripts/service_menu.aspe",
      "aspScripts_rebootOnAspCrash": true,
      "aspScripts_useTcpBridge": false,
      "fileSetIds": {
        "scripts": 388,
        "assets": 389,
        "service_menu": 390
      }
    };
    this.jsonEditorInput.value = JSON.stringify(exampleJson, null, 2);
    this.validateJsonInput();
  }

  // Validate JSON input
  validateJsonInput() {
    try {
      const value = this.jsonEditorInput.value.trim();
      if (!value) {
        this.jsonEditorInput.classList.add('json-error');
        return false;
      }
      
      const json = JSON.parse(value);
      
      // Check if it's an object and not an array
      if (typeof json !== 'object' || Array.isArray(json) || json === null) {
        this.jsonEditorInput.classList.add('json-error');
        return false;
      }
      
      // More relaxed validation - just ensure it's a valid JSON object
      // Allow nested objects, arrays, booleans, numbers, and strings
      
      // Valid JSON object
      this.jsonEditorInput.classList.remove('json-error');
      return true;
    } catch (e) {
      this.jsonEditorInput.classList.add('json-error');
      return false;
    }
  }

  // Validate form
  validateForm() {
    // Basic validation is handled by HTML5 form validation
    // Additional validation for controller IDs
    const controllerIds = this.parseControllerIds();
    if (controllerIds.length === 0) {
      this.addLog('Please enter at least one valid controller ID', 'error');
      return false;
    }

    // Validate JSON
    if (!this.validateJsonInput()) {
      this.addLog('Please enter valid JSON for device settings', 'error');
      return false;
    }

    const settings = this.getDeviceSettings();
    if (Object.keys(settings).length === 0) {
      this.addLog('Please add at least one device setting', 'error');
      return false;
    }

    return true;
  }

  // Validate firmware form
  validateFirmwareForm() {
    if (!this.enableFirmwareUpdateCheckbox.checked) {
      this.addLog('Please enable update first', 'error');
      return false;
    }

    // Firmware version is now optional
    return true;
  }

  // Get firmware version
  getFirmwareVersion() {
    return this.mainFirmwareVersionInput.value.trim();
  }

  // Method renamed for clarity
  getDeviceSettings() {
    try {
      return JSON.parse(this.jsonEditorInput.value.trim() || '{}');
    } catch (e) {
      return {};
    }
  }

  // Utility function to omit properties from an object
  omit(obj, keysToOmit) {
    if (!obj) return {};
    return Object.keys(obj)
      .filter(key => !keysToOmit.includes(key))
      .reduce((acc, key) => {
        acc[key] = obj[key];
        return acc;
      }, {});
  }

  // Utility function to merge configurations
  mergeConfigurations(currentConfig, userChanges) {
    // Create a deep copy of current config
    const result = JSON.parse(JSON.stringify(currentConfig));
    
    // For each key in user changes
    for (const key in userChanges) {
      // Special handling for fileSetIds
      if (key === 'fileSetIds' && typeof userChanges[key] === 'object') {
        // Replace the entire fileSetIds object
        result[key] = { ...userChanges[key] };
      } else {
        // For other properties, simply update the value
        result[key] = userChanges[key];
      }
    }
    
    return result;
  }

  // Start update process
  async startUpdateProcess() {
    console.log('Starting update process');
    // Reset progress tracking
    this.isUpdating = true;
    this.updatedControllers = [];
    this.failedControllers = [];
    this.currentProgress = 0;
    
    // Show progress card
    this.progressCard.classList.remove('hidden');
    
    // Disable form controls
    this.toggleFormControls(true);
    
    // Update UI
    this.updateProgress(0, 'Starting update process...');
    
    // Clear logs
    this.logContainer.innerHTML = '';
    
    // Get form data
    const baseUrl = this.baseUrlInput.value.trim();
    const apiKey = this.apiKeyInput.value.trim();
    const controllerIds = this.parseControllerIds();
    const deviceSettings = this.getDeviceSettings();
    const firmwareVersion = this.getFirmwareVersion();
    
    console.log('Form data:', { 
      baseUrl, 
      apiKey: '***', // Mask API key for security
      controllerIds,
      deviceSettings,
      firmwareVersion
    });
    
    // Create axios instance
    this.createAxiosInstance(baseUrl, apiKey);
    
    // Log start
    this.addLog(`Starting update for ${controllerIds.length} controllers`, 'info');
    this.addLog(`Device settings to update: ${JSON.stringify(deviceSettings, null, 2)}`, 'info');
    if (firmwareVersion) {
      this.addLog(`Firmware version: ${firmwareVersion}`, 'info');
    }
    
    // Update device settings for each controller
    await this.updateDeviceSettings(controllerIds, deviceSettings);
  }

  // Update device settings
  async updateDeviceSettings(controllerIds, userSettings) {
    console.log('Starting device settings update for controllers:', controllerIds);
    console.log('User specified settings:', userSettings);
    
    const totalControllers = controllerIds.length;
    let completedCount = 0;
    
    for (const controllerId of controllerIds) {
      try {
        this.addLog(`Processing controller ${controllerId}...`, 'info');
        console.log(`Processing controller ${controllerId}...`);
        
        // Step 1: Get current configuration
        this.addLog(`Fetching current configuration for controller ${controllerId}...`, 'info');
        console.log(`GET request to fetch current config for controller ${controllerId}`);
        
        const getResponse = await this.axiosInstance.get(`/f-controllers/${controllerId}/for-configuration`);
        console.log(`Current configuration received for controller ${controllerId}:`, getResponse.data);
        
        // Step 2: Extract and process configuration data
        const currentData = getResponse.data;
        
        if (!currentData || !currentData.fData) {
          throw new Error('Invalid response format from configuration endpoint');
        }
        
        const fullConfigNoFilesets = this.omit(currentData.fData.deviceSettings || {}, ['meta']);
        const fileSetsData = currentData.fData.fileSetsData || {};
        
        this.addLog(`Current configuration extracted (excluding meta):`, 'info');
        this.addLog(`Full config: ${JSON.stringify(fullConfigNoFilesets, null, 2)}`, 'info');
        this.addLog(`Current fileSets data: ${JSON.stringify(fileSetsData, null, 2)}`, 'info');
        
        console.log('Full config (no filesets):', fullConfigNoFilesets);
        console.log('FileSets data:', fileSetsData);
        
        // Step 3: Merge current configuration with user changes
        const mergedConfig = this.mergeConfigurations(fullConfigNoFilesets, userSettings);
        
        this.addLog(`Merged configuration: ${JSON.stringify(mergedConfig, null, 2)}`, 'info');
        console.log('Merged configuration:', mergedConfig);
        
        // Step 4: Post updated configuration
        this.addLog(`Updating settings for controller ${controllerId}...`, 'info');
        console.log(`POST request to update settings for controller ${controllerId}`);
        
        const postResponse = await this.axiosInstance.post(`/f-controllers/${controllerId}/settings-form`, mergedConfig);
        
        console.log(`Settings update response for controller ${controllerId}:`, postResponse.data);
        this.addLog(`Device settings updated successfully for controller ${controllerId}`, 'success');
        this.updatedControllers.push(controllerId);
        
      } catch (error) {
        console.error(`Error processing controller ${controllerId}:`, error);
        this.addLog(`Error processing controller ${controllerId}: ${error.message}`, 'error');
        if (error.response) {
          console.error(`Status: ${error.response.status}`, error.response.data);
          this.addLog(`Status: ${error.response.status}`, 'error');
          this.addLog(`Error details: ${JSON.stringify(error.response.data, null, 2)}`, 'error');
        }
        this.failedControllers.push(controllerId);
      }
      
      // Update progress
      completedCount++;
      const progress = Math.round((completedCount / totalControllers) * 100);
      this.updateProgress(progress, `Completed ${completedCount} of ${totalControllers} controllers`);
    }
    
    // Update final status
    if (this.failedControllers.length === 0) {
      console.log('All device settings updated successfully!');
      this.addLog('All device settings updated successfully!', 'success');
      // Enable update button if all controllers were updated successfully
      this.scheduleUpdateBtn.disabled = !this.enableFirmwareUpdateCheckbox.checked;
    } else {
      console.warn(`Completed with errors. Failed controllers:`, this.failedControllers);
      this.addLog(`Completed with errors. Failed controllers: ${this.failedControllers.join(', ')}`, 'error');
      // Enable update button for partial success
      this.scheduleUpdateBtn.disabled = !(this.updatedControllers.length > 0 && this.enableFirmwareUpdateCheckbox.checked);
    }
    
    // Mark update as completed
    this.isUpdating = false;
    this.toggleFormControls(false);
  }

  // Schedule firmware update
  async scheduleUpdate() {
    if (this.updatedControllers.length === 0) {
      console.warn('No controllers available for update');
      this.addLog('No controllers available for update', 'error');
      return;
    }
    
    const firmwareVersion = this.getFirmwareVersion();
    const updateType = this.updateTypeSelect.value;
    const customField1 = this.customField1Input.value.trim();
    const comment = this.commentInput.value.trim() || 'Publisher Update';
    
    console.log('Scheduling update:', { 
      controllers: this.updatedControllers, 
      firmwareVersion: firmwareVersion || 'none',
      updateType,
      customField1,
      comment
    });
    
    // Disable buttons
    this.scheduleUpdateBtn.disabled = true;
    this.updateFilesetsBtn.disabled = true;
    
    if (firmwareVersion) {
      this.addLog(`Starting update to version ${firmwareVersion}`, 'info');
    } else {
      this.addLog(`Starting update (no firmware version specified)`, 'info');
    }
    this.addLog(`Update type: ${updateType}`, 'info');
    if (customField1) {
      this.addLog(`Custom Field: ${customField1}`, 'info');
    }
    this.addLog(`Comment: ${comment}`, 'info');
    
    const totalControllers = this.updatedControllers.length;
    let completedCount = 0;
    const firmwareUpdatedControllers = [];
    const firmwareFailedControllers = [];
    
    for (const controllerId of this.updatedControllers) {
      try {
        console.log(`Creating update plan for controller ${controllerId}...`);
        this.addLog(`Creating update plan for controller ${controllerId}...`, 'info');
        
        // 1. Create firmware update
        const updatePayload = {
          controllerId: controllerId,
          customField1: customField1,
          comment: comment,
          config: {
            type: updateType
          }
        };
        
        // Only include firmware updates if version is specified
        if (firmwareVersion) {
          updatePayload.fwUpdates = { mainFw: firmwareVersion };
        }
        
        const response = await this.axiosInstance.post('/f-updates', updatePayload);
        
        console.log(`Update plan created for controller ${controllerId}:`, response.data);
        this.addLog(`Update plan created for controller ${controllerId}:`, 'success');
        this.addLog(JSON.stringify(response.data, null, 2), 'info');
        
        // 2. Activate the update plan
        const updateId = response.data.id;
        if (!updateId) {
          throw new Error('No update ID received from server');
        }
        
        this.addLog(`Activating update plan ${updateId}...`, 'info');
        const activateResponse = await this.axiosInstance.post(`/f-updates/${updateId}/activate`);
        
        console.log(`Update plan ${updateId} activated:`, activateResponse.data);
        this.addLog(`Update plan activated successfully`, 'success');
        
        firmwareUpdatedControllers.push(controllerId);
        
      } catch (error) {
        console.error(`Error scheduling update for controller ${controllerId}:`, error);
        this.addLog(`Error scheduling update for controller ${controllerId}: ${error.message}`, 'error');
        if (error.response) {
          this.addLog(`Status: ${error.response.status}`, 'error');
          this.addLog(`Data: ${JSON.stringify(error.response.data, null, 2)}`, 'error');
        }
        firmwareFailedControllers.push(controllerId);
      }
      
      // Update progress
      completedCount++;
      const progress = Math.round((completedCount / totalControllers) * 100);
      this.updateProgress(progress, `Scheduled ${completedCount} of ${totalControllers} controllers`);
    }
    
    // Final status
    if (firmwareFailedControllers.length === 0) {
      console.log('All updates scheduled and activated successfully!');
      this.addLog('All updates scheduled and activated successfully!', 'success');
    } else {
      console.warn('Completed with errors. Failed to schedule updates for controllers:', firmwareFailedControllers);
      this.addLog(`Completed with errors. Failed to schedule updates for controllers: ${firmwareFailedControllers.join(', ')}`, 'error');
    }
    
    // Re-enable buttons
    this.scheduleUpdateBtn.disabled = false;
    this.updateFilesetsBtn.disabled = false;
  }

  // Create axios instance
  createAxiosInstance(baseUrl, apiKey) {
    // Use the real axios from the loaded library
    this.axiosInstance = axios.create({
      baseURL: baseUrl,
      headers: { 'api-key': apiKey }
    });
    
    // Add interceptors for logging
    this.axiosInstance.interceptors.request.use(config => {
      console.log(`API Request: ${config.method.toUpperCase()} ${config.baseURL}${config.url}`, config.data);
      
      // Generate curl command for this request
      let curlCmd = `curl -X ${config.method.toUpperCase()} "${config.baseURL}${config.url}" \\
  -H "api-key: ${apiKey}" \\
  -H "Content-Type: application/json"`;
      
      if (config.data) {
        curlCmd += ` \\
  -d '${JSON.stringify(config.data)}'`;
      }
      
      console.log('Equivalent curl command:');
      console.log(curlCmd);
      
      this.addLog(`${config.method.toUpperCase()} ${config.baseURL}${config.url}`, 'info');
      this.addLog(`Request: ${JSON.stringify(config.data, null, 2)}`, 'info');
      this.addLog(`Curl: ${curlCmd}`, 'info');
      
      return config;
    }, error => {
      console.error('Request error:', error);
      return Promise.reject(error);
    });
    
    this.axiosInstance.interceptors.response.use(response => {
      console.log(`API Response from ${response.config.url}:`, response.data);
      return response;
    }, error => {
      console.error('Response error:', error);
      if (error.response) {
        console.error(`Status: ${error.response.status}`, error.response.data);
      }
      return Promise.reject(error);
    });
    
    console.log('Axios instance created with baseURL:', baseUrl);
  }

  // Parse controller IDs from input
  parseControllerIds() {
    return this.controllerIdsInput.value
      .split(',')
      .map(id => id.trim())
      .filter(id => id && !isNaN(Number(id)))
      .map(Number);
  }

  // Add a log entry
  addLog(message, type = 'info') {
    const logEntry = document.createElement('div');
    logEntry.className = type;
    
    // Special handling for curl commands
    if (message.startsWith('Curl: ')) {
      // Create a header
      const header = document.createElement('div');
      header.textContent = 'Equivalent curl command:';
      header.style.fontWeight = 'bold';
      this.logContainer.appendChild(header);
      
      // Format the curl command
      const curlCommand = message.substring(6); // Remove 'Curl: ' prefix
      const pre = document.createElement('pre');
      pre.className = 'curl-command';
      pre.textContent = curlCommand;
      
      // Add copy button
      const copyBtn = document.createElement('button');
      copyBtn.className = 'copy-curl-btn';
      copyBtn.textContent = 'Copy';
      copyBtn.onclick = () => {
        navigator.clipboard.writeText(curlCommand)
          .then(() => {
            copyBtn.textContent = 'Copied!';
            setTimeout(() => { copyBtn.textContent = 'Copy'; }, 2000);
          })
          .catch(err => {
            console.error('Failed to copy: ', err);
          });
      };
      
      const curlContainer = document.createElement('div');
      curlContainer.className = 'curl-container';
      curlContainer.appendChild(pre);
      curlContainer.appendChild(copyBtn);
      
      this.logContainer.appendChild(curlContainer);
    } else {
      // Regular log message
      logEntry.textContent = message;
      this.logContainer.appendChild(logEntry);
    }
    
    this.logContainer.scrollTop = this.logContainer.scrollHeight;
  }

  // Update progress bar and text
  updateProgress(progress, status) {
    this.progressBar.style.width = `${progress}%`;
    this.progressText.textContent = `${progress}%`;
    this.progressStatus.textContent = status;
    this.currentProgress = progress;
  }

  // Toggle form controls
  toggleFormControls(disabled) {
    const inputs = this.form.querySelectorAll('input, textarea, select, button');
    inputs.forEach(input => {
      if (input !== this.scheduleUpdateBtn) {
        input.disabled = disabled;
      }
    });
  }

  // Reset form
  resetForm() {
    this.form.reset();
    this.firmwareOptionsDiv.classList.add('hidden');
    this.jsonEditorInput.value = '';
    this.jsonEditorInput.classList.remove('json-error');
    
    // Reset progress
    this.progressCard.classList.add('hidden');
    this.updateProgress(0, 'Initializing...');
    
    // Reset logs
    this.logContainer.innerHTML = '';
    
    // Reset buttons
    this.scheduleUpdateBtn.disabled = true;
    
    // Reset tracking variables
    this.isUpdating = false;
    this.updatedControllers = [];
    this.failedControllers = [];
    this.currentProgress = 0;
  }

  // Export config
  exportConfig() {
    try {
      const deviceSettings = this.getDeviceSettings();
      
      const config = {
        baseUrl: this.baseUrlInput.value.trim(),
        apiKey: this.apiKeyInput.value.trim(),
        controllerIds: this.parseControllerIds(),
        deviceSettings: deviceSettings,
        firmwareVersion: this.getFirmwareVersion(),
        customField1: this.customField1Input.value.trim(),
        comment: this.commentInput.value.trim(),
        firmwareUpdate: {
          enabled: this.enableFirmwareUpdateCheckbox.checked,
          updateType: this.updateTypeSelect.value
        }
      };
      
      const dataStr = JSON.stringify(config, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
      
      const exportFileDefaultName = 'fleet-config.json';
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
    } catch (error) {
      this.addLog(`Error exporting configuration: ${error.message}`, 'error');
    }
  }

  // Import config
  importConfig(file) {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const config = JSON.parse(e.target.result);
        
        // Apply config to form
        this.baseUrlInput.value = config.baseUrl || '';
        this.apiKeyInput.value = config.apiKey || '';
        
        // Controller IDs
        this.controllerIdsInput.value = (config.controllerIds || []).join(', ');
        
        // Device Settings JSON
        if (config.deviceSettings && typeof config.deviceSettings === 'object') {
          this.jsonEditorInput.value = JSON.stringify(config.deviceSettings, null, 2);
          this.validateJsonInput();
        }
        
        // Firmware version
        this.mainFirmwareVersionInput.value = config.firmwareVersion || '';
        
        // Custom field and comment
        this.customField1Input.value = config.customField1 || '';
        this.commentInput.value = config.comment || 'Publisher Update';
        
        // Firmware update
        if (config.firmwareUpdate) {
          this.enableFirmwareUpdateCheckbox.checked = config.firmwareUpdate.enabled || false;
          this.updateTypeSelect.value = config.firmwareUpdate.updateType || 'urgent';
          this.firmwareOptionsDiv.classList.toggle('hidden', !this.enableFirmwareUpdateCheckbox.checked);
        }
        
        this.addLog('Configuration imported successfully', 'success');
        
      } catch (error) {
        this.addLog(`Error importing configuration: ${error.message}`, 'error');
      }
    };
    
    reader.readAsText(file);
  }
}

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  const app = new FleetAssetUpdater();
}); 