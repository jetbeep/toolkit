#!/usr/bin/env node

const axios = require('axios');
const fs = require('fs');

/**
 * Utility function to omit properties from an object
 */
function omit(obj, keysToOmit) {
  if (!obj) return {};
  return Object.keys(obj)
    .filter(key => !keysToOmit.includes(key))
    .reduce((acc, key) => {
      acc[key] = obj[key];
      return acc;
    }, {});
}

/**
 * Utility function to merge configurations
 */
function mergeConfigurations(currentConfig, userChanges) {
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

/**
 * Schedule and activate firmware update for a controller
 */
async function scheduleUpdate(api, controllerId, options) {
  console.log(`\n=== Scheduling Update for Controller ${controllerId} ===`);
  
  try {
    // 1. Create update plan
    console.log(`\n1. Creating update plan...`);
    const updateUrl = `/f-updates`;
    
    const updatePayload = {
      controllerId: controllerId,
      customField1: options.customField1 || '',
      comment: options.comment || 'Publisher Update',
      config: {
        type: options.updateType || 'sleep'
      }
    };
    
    // Only include firmware updates if version is specified
    if (options.firmwareVersion) {
      updatePayload.fwUpdates = { mainFw: options.firmwareVersion };
    }
    
    console.log(`POST ${options.baseUrl}${updateUrl}`);
    console.log(`Request payload:`);
    console.log(JSON.stringify(updatePayload, null, 2));
    
    // Generate curl command for debugging
    const createCurlCmd = `curl -X POST "${options.baseUrl}${updateUrl}" \\
  -H "api-key: ${options.apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(updatePayload)}'`;
    
    console.log(`\nEquivalent curl command:`);
    console.log(createCurlCmd);
    
    const createResponse = await api.post(updateUrl, updatePayload);
    console.log(`Response status: ${createResponse.status}`);
    console.log(`Response data:`);
    console.log(JSON.stringify(createResponse.data, null, 2));
    
    // 2. Activate the update plan
    const updateId = createResponse.data.id;
    if (!updateId) {
      throw new Error('No update ID received from server');
    }
    
    console.log(`\n2. Activating update plan ${updateId}...`);
    const activateUrl = `/f-updates/${updateId}/activate`;
    
    // Generate curl command for debugging
    const activateCurlCmd = `curl -X POST "${options.baseUrl}${activateUrl}" \\
  -H "api-key: ${options.apiKey}" \\
  -H "Content-Type: application/json"`;
    
    console.log(`\nEquivalent curl command:`);
    console.log(activateCurlCmd);
    
    const activateResponse = await api.post(activateUrl);
    
    console.log(`Response status: ${activateResponse.status}`);
    console.log(`Response data:`);
    console.log(JSON.stringify(activateResponse.data, null, 2));
    
    console.log(`\n✅ Successfully scheduled and activated update for controller ${controllerId}`);
    return true;
    
  } catch (error) {
    console.error(`\n❌ Error scheduling update for controller ${controllerId}:`);
    
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Error details:`);
      console.error(JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(error.message);
    }
    
    return false;
  }
}

/**
 * Update a single controller's device settings
 */
async function updateControllerSettings(baseUrl, apiKey, controllerId, userSettings) {
  console.log(`\n=== Updating Controller ${controllerId} ===`);
  
  try {
    // Create axios instance with authorization
    const api = axios.create({
      baseURL: baseUrl,
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json'
      }
    });
    
    // Step 1: Get current configuration
    console.log(`\n1. Fetching current configuration...`);
    const getUrl = `/f-controllers/${controllerId}/for-configuration`;
    console.log(`GET ${baseUrl}${getUrl}`);
    
    const getResponse = await api.get(getUrl);
    console.log(`Response status: ${getResponse.status}`);
    
    // Step 2: Extract and process configuration data
    console.log(`\n2. Processing configuration data...`);
    const currentData = getResponse.data;
    
    if (!currentData || !currentData.fData) {
      throw new Error('Invalid response format from configuration endpoint');
    }
    
    const fullConfigNoFilesets = omit(currentData.fData.deviceSettings || {}, ['meta']);
    const fileSetsData = currentData.fData.fileSetsData || {};
    
    console.log(`Current config (without meta):`);
    console.log(JSON.stringify(fullConfigNoFilesets, null, 2));
    console.log(`\nCurrent fileSets data:`);
    console.log(JSON.stringify(fileSetsData, null, 2));
    
    // Step 3: Merge current configuration with user changes
    console.log(`\n3. Merging with user changes...`);
    console.log(`User settings to apply:`);
    console.log(JSON.stringify(userSettings, null, 2));
    
    const mergedConfig = mergeConfigurations(fullConfigNoFilesets, userSettings);
    
    console.log(`\nMerged configuration:`);
    console.log(JSON.stringify(mergedConfig, null, 2));
    
    // Step 4: Post updated configuration
    console.log(`\n4. Updating settings...`);
    const postUrl = `/f-controllers/${controllerId}/settings-form`;
    console.log(`POST ${baseUrl}${postUrl}`);
    console.log(`Request payload:`);
    console.log(JSON.stringify(mergedConfig, null, 2));
    
    // Generate curl command for debugging
    const curlCmd = `curl -X POST "${baseUrl}${postUrl}" \\
  -H "api-key: ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(mergedConfig)}'`;
    
    console.log(`\nEquivalent curl command:`);
    console.log(curlCmd);
    
    const postResponse = await api.post(postUrl, mergedConfig);
    
    console.log(`\nResponse status: ${postResponse.status}`);
    console.log(`Response data:`);
    console.log(JSON.stringify(postResponse.data, null, 2));
    
    console.log(`\n✅ Successfully updated controller ${controllerId}`);
    
    // Return response object for potential firmware update
    return {
      success: true,
      data: {
        fullConfigNoFilesets,
        fileSetsData
      }
    };
    
  } catch (error) {
    console.error(`\n❌ Error updating controller ${controllerId}:`);
    
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Error details:`);
      console.error(JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(error.message);
    }
    
    return { success: false };
  }
}

/**
 * Update multiple controllers
 */
async function updateControllers(baseUrl, apiKey, controllerIds, userSettings, firmwareOptions = null) {
  console.log('Fleet Asset Updater CLI');
  console.log('======================');
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Controllers to update: ${controllerIds.join(', ')}`);
  
  // Create axios instance with authorization
  const api = axios.create({
    baseURL: baseUrl,
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json'
    }
  });
  
  let successCount = 0;
  let failCount = 0;
  let fwSuccessCount = 0;
  let fwFailCount = 0;
  
  for (const controllerId of controllerIds) {
    // Step 1: Update device settings
    const updateResult = await updateControllerSettings(baseUrl, apiKey, controllerId, userSettings);
    
    if (updateResult.success) {
      successCount++;
      
      // Step 2: Schedule update if requested
      if (firmwareOptions && firmwareOptions.enabled) {
        console.log(`\nController ${controllerId} updated successfully. Proceeding with update...`);
        
        const fwOptions = {
          baseUrl,
          apiKey,
          firmwareVersion: firmwareOptions.firmwareVersion, // This can be undefined now
          updateType: firmwareOptions.updateType || 'sleep',
          customField1: firmwareOptions.customField1 || '',
          comment: firmwareOptions.comment || 'Publisher Update'
        };
        
        const fwResult = await scheduleUpdate(api, controllerId, fwOptions);
        
        if (fwResult) {
          fwSuccessCount++;
        } else {
          fwFailCount++;
        }
      }
    } else {
      failCount++;
    }
  }
  
  console.log('\n=== Summary ===');
  console.log(`Total controllers: ${controllerIds.length}`);
  console.log(`Settings update success: ${successCount}`);
  console.log(`Settings update failed: ${failCount}`);
  
  if (firmwareOptions && firmwareOptions.enabled) {
    console.log(`Update success: ${fwSuccessCount}`);
    console.log(`Update failed: ${fwFailCount}`);
  }
  
  return { 
    settingsUpdate: { successCount, failCount },
    firmwareUpdate: { successCount: fwSuccessCount, failCount: fwFailCount }
  };
}

/**
 * Main entry point
 */
async function main() {
  // Check command line arguments
  const args = process.argv.slice(2);
  
  if (args.length < 3) {
    console.log(`
Usage: node update-controller.js <base_url> <api_key> <controller_id> [settings_file] [--fw <version>] [--type <type>] [--custom <value>] [--comment <text>]

Examples:
  node update-controller.js https://api.example.com 12345:abcdef 123 ./settings.json
  node update-controller.js https://api.example.com 12345:abcdef 123,456,789 ./settings.json --fw 1.2.3+0 --type sleep --custom tracking123 --comment "Test update"
    `);
    process.exit(1);
  }
  
  const baseUrl = args[0];
  const apiKey = args[1];
  const controllerIdsArg = args[2];
  let settingsFile = './update-settings.json';
  
  // Parse controller IDs
  const controllerIds = controllerIdsArg.split(',').map(id => id.trim());
  
  // Check for firmware update options
  let firmwareOptions = null;
  let i = 3;
  
  if (args.length > i && !args[i].startsWith('--')) {
    settingsFile = args[i];
    i++;
  }
  
  // Look for firmware update flags
  while (i < args.length) {
    if (args[i] === '--fw' && i + 1 < args.length) {
      if (!firmwareOptions) firmwareOptions = { enabled: true };
      firmwareOptions.firmwareVersion = args[i+1];
      i += 2;
    } else if (args[i] === '--type' && i + 1 < args.length) {
      if (!firmwareOptions) firmwareOptions = { enabled: true };
      firmwareOptions.updateType = args[i+1];
      i += 2;
    } else if (args[i] === '--custom' && i + 1 < args.length) {
      if (!firmwareOptions) firmwareOptions = { enabled: true };
      firmwareOptions.customField1 = args[i+1];
      i += 2;
    } else if (args[i] === '--comment' && i + 1 < args.length) {
      if (!firmwareOptions) firmwareOptions = { enabled: true };
      firmwareOptions.comment = args[i+1];
      i += 2;
    } else if (args[i] === '--update') {
      // Allow enabling updates without specifying firmware version
      firmwareOptions = { enabled: true };
      i++;
    } else {
      i++;
    }
  }
  
  // Load settings
  let userSettings;
  try {
    if (fs.existsSync(settingsFile)) {
      userSettings = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
    } else {
      console.error(`Settings file not found: ${settingsFile}`);
      console.log('Using default example settings instead...');
      userSettings = {
        "aspScripts_rebootOnAspCrash": false,
        "aspScripts_useTcpBridge": true,
        "fileSetIds": {
          "images": 34,
          "scripts": 35
        }
      };
    }
  } catch (error) {
    console.error(`Error loading settings: ${error.message}`);
    process.exit(1);
  }
  
  if (firmwareOptions) {
    console.log('Update will be scheduled with:');
    console.log(JSON.stringify(firmwareOptions, null, 2));
  }
  
  try {
    await updateControllers(baseUrl, apiKey, controllerIds, userSettings, firmwareOptions);
  } catch (error) {
    console.error('Unhandled error:', error);
    process.exit(1);
  }
}

// Run the script
main().catch(console.error); 