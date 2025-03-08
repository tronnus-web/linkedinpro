// LinkedIn Connection Pro - Enhanced Background Script
console.log("LinkedIn Connection Pro background script loaded");

// Improved state management
const AppState = {
  isRunning: false,
  currentIndex: 0,
  profileLinks: [],
  note: '',
  templateId: 'default',
  delay: 60000,
  automationTabId: null,
  lastActiveTime: Date.now(),
  
  // Analytics tracking
  analytics: {
    startTime: null,
    endTime: null,
    totalSent: 0,
    successful: 0,
    failed: 0,
    alreadyConnected: 0,
    connectionsByDate: {},
    connectionsByTemplate: {},
    errorTypes: {}
  },
  
  // Profile data storage
  profiles: {},
  
  // Templates
  templates: {
    default: 'Hi [Name], I noticed your profile and would like to connect. I work in [Industry] at [Company] and thought we might benefit from networking.',
    recruiter: 'Hi [Name], I\'m a recruiter at [Company] specializing in [Industry] roles. I\'d love to connect and keep you updated on opportunities that match your expertise.',
    sales: 'Hi [Name], I noticed your work in [Industry] at [Company]. I help professionals like you with [Value Proposition]. Would you be open to connecting?',
    networking: 'Hi [Name], I\'m expanding my professional network in the [Industry] space and your profile caught my attention. I\'d be happy to connect and share insights.'
  },
  
  // Settings
  settings: {
    autoResume: true,
    autoExtract: true,
    notifications: true,
    darkMode: false,
    detectionMethod: 'auto',
    dataStorage: '90'
  },
  
  // Resumable state
  resumeFromIndex: 0
};

// Reference to timers and intervals
let heartbeatInterval = null;
let recoveryInterval = null;
let analyticsUpdateInterval = null;

// Load state from storage when extension starts
chrome.storage.local.get(['connectionProState', 'connectionAnalytics', 'connectionProfiles', 'connectionTemplates', 'settings'], function(result) {
  // Load state
  if (result.connectionProState) {
    console.log("Restoring state from storage");
    Object.assign(AppState, result.connectionProState);
    
    // Update last active time
    AppState.lastActiveTime = Date.now();
    
    // If was running when extension restarted and settings allow auto-resume
    if (AppState.isRunning && AppState.settings.autoResume) {
      console.log("Auto-resuming connection process");
      
      // Check if the tab still exists
      if (AppState.automationTabId) {
        chrome.tabs.get(AppState.automationTabId, function(tab) {
          if (chrome.runtime.lastError) {
            // Tab doesn't exist anymore, reset automation tab state
            AppState.automationTabId = null;
            saveState();
            
            // Restart from current index
            startSingleTabAutomation();
          } else {
            // Tab exists, continue where we left off
            updatePopup();
            startHeartbeat();
            startRecoveryChecker();
            startAnalyticsUpdater();
          }
        });
      } else {
        // No tab, create a new one
        startSingleTabAutomation();
      }
    }
  }
  
  // Load analytics
  if (result.connectionAnalytics) {
    console.log("Restoring analytics from storage");
    AppState.analytics = {...AppState.analytics, ...result.connectionAnalytics};
  }
  
  // Load profiles
  if (result.connectionProfiles) {
    console.log("Restoring profiles from storage");
    AppState.profiles = result.connectionProfiles;
  }
  
  // Load templates
  if (result.connectionTemplates) {
    console.log("Restoring templates from storage");
    AppState.templates = {...AppState.templates, ...result.connectionTemplates};
  }
  
  // Load settings
  if (result.settings) {
    console.log("Restoring settings from storage");
    AppState.settings = {...AppState.settings, ...result.settings};
  }
});

// Save state to storage
function saveState() {
  // Update the last active time
  AppState.lastActiveTime = Date.now();
  
  // Save core state
  chrome.storage.local.set({ 
    'connectionProState': {
      isRunning: AppState.isRunning,
      currentIndex: AppState.currentIndex,
      profileLinks: AppState.profileLinks,
      note: AppState.note,
      templateId: AppState.templateId,
      delay: AppState.delay,
      automationTabId: AppState.automationTabId,
      lastActiveTime: AppState.lastActiveTime,
      resumeFromIndex: AppState.resumeFromIndex,
      settings: AppState.settings
    }
  });
}

// Save analytics separately to avoid storage size issues
function saveAnalytics() {
  chrome.storage.local.set({ 'connectionAnalytics': AppState.analytics });
}

// Save profiles data separately 
function saveProfiles() {
  // Apply data retention policy based on settings
  const profiles = pruneProfilesByRetentionPolicy(AppState.profiles);
  chrome.storage.local.set({ 'connectionProfiles': profiles });
}

// Save templates
function saveTemplates() {
  chrome.storage.local.set({ 'connectionTemplates': AppState.templates });
}

// Save settings
function saveSettings() {
  chrome.storage.local.set({ 'settings': AppState.settings });
}

// Prune old profile data based on retention policy
function pruneProfilesByRetentionPolicy(profiles) {
  const retentionDays = parseInt(AppState.settings.dataStorage);
  if (isNaN(retentionDays) || retentionDays === 0) return profiles; // Unlimited retention
  
  const now = Date.now();
  const maxAge = retentionDays * 24 * 60 * 60 * 1000; // days to milliseconds
  
  // Create a new profiles object with only the data within retention period
  const prunedProfiles = {};
  Object.keys(profiles).forEach(profileId => {
    const profile = profiles[profileId];
    if (profile.timestamp) {
      const profileDate = new Date(profile.timestamp).getTime();
      if (now - profileDate < maxAge) {
        prunedProfiles[profileId] = profile;
      }
    } else {
      // If no timestamp, keep it to be safe
      prunedProfiles[profileId] = profile;
    }
  });
  
  return prunedProfiles;
}

// Start the heartbeat system to keep scripts alive
function startHeartbeat() {
  // Clear any existing heartbeat
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
  }
  
  // Send heartbeat signal every 25 seconds
  heartbeatInterval = setInterval(() => {
    if (AppState.automationTabId && AppState.isRunning) {
      console.log("Sending heartbeat to tab");
      chrome.tabs.sendMessage(AppState.automationTabId, { action: 'heartbeat' }, function(response) {
        if (chrome.runtime.lastError) {
          console.log("Heartbeat failed - tab may be inactive");
        } else if (response) {
          console.log("Heartbeat response received");
          AppState.lastActiveTime = Date.now();
          saveState();
        }
      });
    } else {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
  }, 25000);
}

// Start the recovery checker
function startRecoveryChecker() {
  // Clear any existing recovery interval
  if (recoveryInterval) {
    clearInterval(recoveryInterval);
  }
  
  // Check automation status every minute
  recoveryInterval = setInterval(() => {
    if (AppState.isRunning) {
      checkAndRecoverAutomation();
    } else {
      clearInterval(recoveryInterval);
      recoveryInterval = null;
    }
  }, 60000);
}

// Start analytics update interval
function startAnalyticsUpdater() {
  // Clear any existing interval
  if (analyticsUpdateInterval) {
    clearInterval(analyticsUpdateInterval);
  }
  
  // Save analytics every 5 minutes during operation
  analyticsUpdateInterval = setInterval(() => {
    if (AppState.isRunning) {
      saveAnalytics();
    } else {
      clearInterval(analyticsUpdateInterval);
      analyticsUpdateInterval = null;
    }
  }, 300000); // 5 minutes
}

// Check if automation needs recovery
function checkAndRecoverAutomation() {
  console.log("Running recovery check");
  
  // Check if it's been more than 5 minutes since last activity
  const fiveMinutes = 5 * 60 * 1000;
  const timeSinceActive = Date.now() - AppState.lastActiveTime;
  
  if (timeSinceActive > fiveMinutes) {
    console.log("Automation appears stalled - attempting recovery");
    
    // Check if tab exists
    if (AppState.automationTabId) {
      chrome.tabs.get(AppState.automationTabId, function(tab) {
        if (chrome.runtime.lastError || !tab) {
          // Tab was closed - attempt to recover
          console.log("Automation tab was lost - creating new tab");
          AppState.automationTabId = null;
          // Restart from current index
          startSingleTabAutomation();
        } else {
          // Tab exists but may be inactive - try to refresh it
          console.log("Refreshing automation tab");
          chrome.tabs.reload(AppState.automationTabId, {}, function() {
            // After reload, wait and try again
            setTimeout(function() {
              if (AppState.isRunning) {
                console.log("Re-sending connection request after refresh");
                chrome.tabs.sendMessage(AppState.automationTabId, {
                  action: 'sendConnection',
                  note: AppState.note,
                  templateId: AppState.templateId
                });
                AppState.lastActiveTime = Date.now();
                saveState();
              }
            }, 10000);
          });
        }
      });
    } else {
      // No tab, create a new one
      startSingleTabAutomation();
    }
  }
}

// Show desktop notification
function showNotification(title, message) {
  if (AppState.settings.notifications) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'images/icon128.png',
      title: title,
      message: message
    });
  }
}

// Store profile data
function storeProfileData(profileData) {
  if (!profileData || !profileData.profileId) return;
  
  // Add or update profile data
  AppState.profiles[profileData.profileId] = {
    ...profileData,
    lastUpdate: new Date().toISOString()
  };
  
  // Save profiles to storage
  saveProfiles();
}

// Simplified track connection in analytics
function trackConnection(status, profileData = null) {
  // Only track successful connections
  if (status === 'success') {
    AppState.analytics.successful++;
    AppState.analytics.totalSent++; // Only increment for successful attempts
    
    // Track by date
    const today = new Date().toISOString().split('T')[0];
    if (!AppState.analytics.connectionsByDate[today]) {
      AppState.analytics.connectionsByDate[today] = {
        sent: 0,
        successful: 0
      };
    }
    
    AppState.analytics.connectionsByDate[today].sent++; // Only increment for successful
    AppState.analytics.connectionsByDate[today].successful++;
    
    // Track by template
    if (AppState.templateId) {
      if (!AppState.analytics.connectionsByTemplate[AppState.templateId]) {
        AppState.analytics.connectionsByTemplate[AppState.templateId] = {
          sent: 0,
          accepted: 0
        };
      }
      
      AppState.analytics.connectionsByTemplate[AppState.templateId].sent++; // Only increment for successful
    }
    
    // Store profile data if available
    if (profileData) {
      storeProfileData(profileData);
    }
    
    // Save analytics to storage
    saveAnalytics();
  }
}

// Simplified analytics - just track sent connections
function checkPendingConnections() {
  console.log("Skipping pending connections check - simplified analytics");
  // We're no longer checking pending connections to simplify the process
  return;
}

// Initialize simplified connection tracking
function initializeConnectionTracking() {
  console.log("Initializing simplified connection tracking");
  // We no longer schedule periodic checks to simplify
}

// Initialize tracking
initializeConnectionTracking();

// Listen for messages
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  if (message.action === 'start') {
    console.log("Starting automation");
    
    // Initialize with user settings
    AppState.isRunning = true;
    AppState.profileLinks = message.links;
    AppState.note = message.note;
    AppState.delay = message.delay * 1000;
    AppState.lastActiveTime = Date.now();
    
    // Set template ID if provided
    if (message.templateId) {
      AppState.templateId = message.templateId;
    }
    
    // Start from a specific index if requested
    if (message.startIndex !== undefined && message.startIndex > 0 && message.startIndex < message.links.length) {
      AppState.currentIndex = message.startIndex;
      console.log(`Starting from saved position: ${message.startIndex}`);
    } else {
      AppState.currentIndex = 0;
    }
    
    // Reset resume point
    AppState.resumeFromIndex = AppState.currentIndex;
    
    // Initialize analytics for this run
    if (!AppState.analytics.startTime) {
      AppState.analytics.startTime = new Date().toISOString();
    }
    
    saveState();
    
    // Show notification
    showNotification(
      'LinkedIn Connection Pro', 
      `Starting to send connections to ${AppState.profileLinks.length} profiles`
    );
    
    // Start processing with the single tab approach
    startSingleTabAutomation();
    
    // Start monitors
    startHeartbeat();
    startRecoveryChecker();
    startAnalyticsUpdater();
    
    // Update popup
    updatePopup();
  }
  else if (message.action === 'stop') {
    console.log("Stopping automation");
    AppState.isRunning = false;
    
    // Update analytics end time
    AppState.analytics.endTime = new Date().toISOString();
    saveAnalytics();
    
    // Store resume point for later
    AppState.resumeFromIndex = AppState.currentIndex;
    saveState();
    
    // Stop intervals
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
    if (recoveryInterval) {
      clearInterval(recoveryInterval);
      recoveryInterval = null;
    }
    if (analyticsUpdateInterval) {
      clearInterval(analyticsUpdateInterval);
      analyticsUpdateInterval = null;
    }
    
    // Close current tab if open
    if (AppState.automationTabId) {
      chrome.tabs.remove(AppState.automationTabId, function() {
        AppState.automationTabId = null;
        saveState();
      });
    }
    
    // Show notification
    showNotification(
      'LinkedIn Connection Pro', 
      `Automation stopped at profile ${AppState.currentIndex}/${AppState.profileLinks.length}`
    );
    
    // Update popup
    updatePopup();
  }
  else if (message.action === 'reset') {
    console.log("Resetting automation state");
    
    // Reset connection state
    AppState.currentIndex = 0;
    AppState.resumeFromIndex = 0;
    saveState();
    
    // Update popup
    updatePopup();
    
    // Send response if a callback was provided
    if (sendResponse) {
      sendResponse({status: "reset_complete"});
    }
  }
  else if (message.action === 'connectionSent') {
    console.log("Connection sent successfully");
    AppState.lastActiveTime = Date.now();
    
    // Track in analytics
    trackConnection('success', message.profileData);
    
    // Move to next profile
    moveToNextProfile();
  }
  else if (message.action === 'connectionFailed') {
    console.log("Connection failed");
    AppState.lastActiveTime = Date.now();
    
    // Track error types
    if (message.failureReason) {
      if (!AppState.analytics.errorTypes[message.failureReason]) {
        AppState.analytics.errorTypes[message.failureReason] = 0;
      }
      AppState.analytics.errorTypes[message.failureReason]++;
    }
    
    // Store profile data if available
    if (message.profileData) {
      storeProfileData(message.profileData);
    }
    
    // Move to next profile
    moveToNextProfile();
  }
  else if (message.action === 'saveTemplate') {
    console.log("Saving template:", message.templateId);
    
    if (message.templateId && message.templateContent) {
      // If all templates were provided, use them
      if (message.allTemplates) {
        AppState.templates = message.allTemplates;
      } else {
        // Otherwise just update this one template
        AppState.templates[message.templateId] = message.templateContent;
      }
      
      saveTemplates();
      
      // Send response if a callback was provided
      if (sendResponse) {
        sendResponse({status: "template_saved", success: true});
      }
    }
  }
  else if (message.action === 'getTemplates') {
    console.log("Getting templates");
    // Return all templates
    if (sendResponse) {
      sendResponse({templates: AppState.templates});
    }
  }
  else if (message.action === 'deleteTemplate') {
    console.log("Deleting template:", message.templateId);
    
    if (message.templateId && AppState.templates[message.templateId]) {
      delete AppState.templates[message.templateId];
      saveTemplates();
      
      // Send response if a callback was provided
      if (sendResponse) {
        sendResponse({status: "template_deleted", success: true});
      }
    }
  }
  else if (message.action === 'getAnalytics') {
    // Return analytics data
    if (sendResponse) {
      sendResponse({analytics: AppState.analytics});
    }
  }
  else if (message.action === 'saveSettings') {
    console.log("Saving settings");
    
    if (message.settings) {
      AppState.settings = {...AppState.settings, ...message.settings};
      saveSettings();
      
      // Send response if a callback was provided
      if (sendResponse) {
        sendResponse({status: "settings_saved"});
      }
    }
  }
  else if (message.action === 'heartbeatResponse') {
    console.log("Received heartbeat response");
    AppState.lastActiveTime = Date.now();
    saveState();
    // Send response if a callback was provided
    if (sendResponse) {
      sendResponse({status: "alive"});
    }
  }
  else if (message.action === 'contentUnloading') {
    console.log("Content script unloading - saving state");
    saveState();
  }
  else if (message.action === 'getStatus') {
    // Return current status to popup
    sendResponse({
      status: getStatusText(),
      progress: getProgressPercentage(),
      isRunning: AppState.isRunning,
      current: AppState.currentIndex,
      total: AppState.profileLinks.length,
      resumePoint: AppState.resumeFromIndex
    });
  }
  
  return true; // Required for async responses
});

// Start automation with a single tab
function startSingleTabAutomation() {
  if (AppState.profileLinks.length === 0) {
    console.log("No profiles to process");
    AppState.isRunning = false;
    saveState();
    updatePopup();
    return;
  }

  
  
  if (AppState.currentIndex >= AppState.profileLinks.length) {
    console.log("All profiles already processed");
    AppState.isRunning = false;
    saveState();
    updatePopup();
    return;
  }
  // Clear any existing recovery timeout
  if (AppState.currentRecoveryTimeout) {
    clearTimeout(AppState.currentRecoveryTimeout);
    AppState.currentRecoveryTimeout = null;
  }
  
  // Set recovery timeout to move to next profile if this one gets stuck
  const recoveryTimeout = setTimeout(() => {
    console.log("Profile processing timeout - moving to next profile");
    if (AppState.isRunning) {
      console.log("Recovery timeout triggered for profile:", AppState.profileLinks[AppState.currentIndex]);
      // Log error in analytics
      if (!AppState.analytics.errorTypes['page_timeout']) {
        AppState.analytics.errorTypes['page_timeout'] = 0;
      }
      AppState.analytics.errorTypes['page_timeout']++;
      
      // Move to next profile
      moveToNextProfile();
    }
  }, 15000); // timeout
  
  // Store the timeout ID
  AppState.currentRecoveryTimeout = recoveryTimeout;
  
  // Create a new tab for automation if we don't have one
  if (!AppState.automationTabId) {
    chrome.tabs.create({ 
      url: AppState.profileLinks[AppState.currentIndex],
      active: false // Keep in background
    }, function(tab) {
      AppState.automationTabId = tab.id;
      AppState.lastActiveTime = Date.now();
      saveState();
      console.log("Created automation tab:", tab.id);
      
      // Wait for page to load before sending message
      setTimeout(function() {
        console.log(`Sending connection request to tab ${tab.id}`);
        chrome.tabs.sendMessage(tab.id, {
          action: 'sendConnection',
          note: AppState.note,
          templateId: AppState.templateId
        });
      }, 10000); // 10 seconds for reliable loading
    });
  } else {
    // We already have a tab, navigate it to the current profile
    const profileUrl = AppState.profileLinks[AppState.currentIndex];
    console.log(`Navigating existing tab to profile ${AppState.currentIndex + 1}/${AppState.profileLinks.length}: ${profileUrl}`);
    
    chrome.tabs.update(AppState.automationTabId, { 
      url: profileUrl,
      active: false // Keep in background
    });
    
    // Wait for page to load
    setTimeout(function() {
      console.log(`Sending connection request to tab ${AppState.automationTabId}`);
      chrome.tabs.sendMessage(AppState.automationTabId, {
        action: 'sendConnection',
        note: AppState.note,
        templateId: AppState.templateId
      });
    }, 10000);
  }
}

// Move to next profile using a single tab
function moveToNextProfile() {
  // Increment counter
  AppState.currentIndex++;
  AppState.resumeFromIndex = AppState.currentIndex; // Store resume point
  AppState.lastActiveTime = Date.now();
  saveState();
  
  // Update popup
  updatePopup();
  
  // If still running and profiles left, navigate to next profile after delay
  if (AppState.isRunning && AppState.currentIndex < AppState.profileLinks.length) {
    console.log(`Waiting ${AppState.delay/1000}s before next profile`);
    
    // Show notification of progress
    if (AppState.currentIndex % 5 === 0) { // Show every 5 profiles
      showNotification(
        'LinkedIn Connection Pro', 
        `Processed ${AppState.currentIndex}/${AppState.profileLinks.length} profiles`
      );
    }
    
    setTimeout(function() {
      // Navigate the existing tab to the next profile
      const profileUrl = AppState.profileLinks[AppState.currentIndex];
      console.log(`Navigating to profile ${AppState.currentIndex + 1}/${AppState.profileLinks.length}: ${profileUrl}`);
      
      // Make sure we still have our tab
      if (AppState.automationTabId) {
        chrome.tabs.get(AppState.automationTabId, function(tab) {
          if (chrome.runtime.lastError || !tab) {
            // Tab doesn't exist anymore, create a new one
            console.log("Automation tab was lost, creating new one");
            chrome.tabs.create({ 
              url: profileUrl,
              active: false
            }, function(newTab) {
              AppState.automationTabId = newTab.id;
              AppState.lastActiveTime = Date.now();
              saveState();
              
              // Wait for page to load
              setTimeout(function() {
                chrome.tabs.sendMessage(AppState.automationTabId, {
                  action: 'sendConnection',
                  note: AppState.note,
                  templateId: AppState.templateId
                });
              }, 10000);
            });
          } else {
            // Tab exists, update its URL
            chrome.tabs.update(AppState.automationTabId, { 
              url: profileUrl,
              active: false
            });
            
            // Wait for page to load
            setTimeout(function() {
              chrome.tabs.sendMessage(AppState.automationTabId, {
                action: 'sendConnection',
                note: AppState.note,
                templateId: AppState.templateId
              });
            }, 10000);
          }
        });
      } else {
        // No tab, create a new one
        chrome.tabs.create({ 
          url: profileUrl,
          active: false
        }, function(newTab) {
          AppState.automationTabId = newTab.id;
          AppState.lastActiveTime = Date.now();
          saveState();
          
          // Wait for page to load
          setTimeout(function() {
            chrome.tabs.sendMessage(AppState.automationTabId, {
              action: 'sendConnection',
              note: AppState.note,
              templateId: AppState.templateId
            });
          }, 10000);
        });
      }
    }, AppState.delay);
  } else if (AppState.currentIndex >= AppState.profileLinks.length) {
    // All profiles processed
    console.log("All profiles processed");
    AppState.isRunning = false;
    
    // Update analytics end time
    AppState.analytics.endTime = new Date().toISOString();
    saveAnalytics();
    
    saveState();
    updatePopup();
    
    // Show completion notification
    showNotification(
      'LinkedIn Connection Pro', 
      `Completed sending connections to ${AppState.profileLinks.length} profiles!`
    );
    
    // Stop intervals
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
    if (recoveryInterval) {
      clearInterval(recoveryInterval);
      recoveryInterval = null;
    }
    if (analyticsUpdateInterval) {
      clearInterval(analyticsUpdateInterval);
      analyticsUpdateInterval = null;
    }
    
    // Close automation tab
    if (AppState.automationTabId) {
      chrome.tabs.remove(AppState.automationTabId, function() {
        AppState.automationTabId = null;
        saveState();
      });
    }
  }
}

// Listen for tab removal
chrome.tabs.onRemoved.addListener(function(tabId, removeInfo) {
  // If our automation tab was closed
  if (tabId === AppState.automationTabId) {
    console.log("Automation tab was closed");
    AppState.automationTabId = null;
    saveState();
    
    // If we're still running, try to recover
    if (AppState.isRunning) {
      console.log("Tab was closed while automation was running - will attempt recovery");
      setTimeout(function() {
        startSingleTabAutomation();
      }, 5000);
    }
  }
});

// Handle browser shutdown/restart
window.addEventListener('beforeunload', function() {
  console.log("Browser closing - saving state");
  saveState();
  saveAnalytics();
});

// Broadcast status to any open popup
function updatePopup() {
  chrome.runtime.sendMessage({
    status: getStatusText(),
    progress: getProgressPercentage(),
    isRunning: AppState.isRunning,
    current: AppState.currentIndex,
    total: AppState.profileLinks.length,
    resumePoint: AppState.resumeFromIndex
  });
}

function getStatusText() {
  if (!AppState.isRunning && AppState.currentIndex === 0) {
    return 'Ready';
  } else if (AppState.isRunning) {
    return `Processing ${AppState.currentIndex + 1}/${AppState.profileLinks.length} profiles`;
  } else {
    return `Completed ${AppState.currentIndex}/${AppState.profileLinks.length} profiles`;
  }
}

function getProgressPercentage() {
  if (AppState.profileLinks.length === 0) {
    return 0;
  }
  return Math.round((AppState.currentIndex / AppState.profileLinks.length) * 100);
}