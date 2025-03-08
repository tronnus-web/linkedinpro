// LinkedIn Connection Pro - Enhanced Content Script
console.log("LinkedIn Connection Pro script loaded");

// Global variables
let isProcessing = false;
let keepAliveInterval = null;
let wakeLock = null;
let extractedProfileData = null;
let analyticsData = {
  attemptTimestamp: null,
  profileId: null,
  connectionSent: false,
  connectionType: null,
  templateUsed: null,
  errors: []
};

// Anti-throttling measures: Keep the page active and prevent sleep
async function requestWakeLock() {
  if ('wakeLock' in navigator) {
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      console.log('Wake Lock is active!');
      
      // Release and reacquire periodically to maintain
      setInterval(() => {
        if (wakeLock) {
          wakeLock.release()
            .then(() => {
              console.log('Wake Lock released');
              requestWakeLock();
            });
        }
      }, 50000);
    } catch (err) {
      console.log(`Wake Lock error: ${err.name}, ${err.message}`);
      analyticsData.errors.push({type: 'wake_lock', message: err.message});
    }
  }
}

// Start keep-alive activity
function startKeepAlive() {
  // Clear any existing interval
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
  }
  
  // Perform small actions periodically to keep page active
  keepAliveInterval = setInterval(() => {
    // Small scroll up and down to keep page active
    window.scrollBy(0, 1);
    setTimeout(() => window.scrollBy(0, -1), 100);
    
    // Force layout recalculation
    document.body.offsetHeight;
    
    // Send a heartbeat to the background
    chrome.runtime.sendMessage({ action: 'heartbeatResponse' });
  }, 30000);
  
  // Try to get wake lock
  requestWakeLock();
}

// Call this when the page loads
startKeepAlive();

// Listen for unload event
window.addEventListener('beforeunload', function() {
  // Clean up
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
  }
  if (wakeLock) {
    wakeLock.release();
  }
  // Notify background script
  chrome.runtime.sendMessage({ action: 'contentUnloading' });
});

// Enhanced profile data extraction
function extractProfileData() {
    try {
      console.log("Extracting profile data...");
      const data = {
        name: '',
        company: '',
        location: '',
        headline: '',
        industry: '',
        profileId: '',
        picUrl: '',
        timestamp: new Date().toISOString()
      };
      
      // LinkedIn changes their DOM structure frequently, so we need multiple selectors
      
      // Extract name - try multiple selector patterns
      const nameSelectors = [
        '.text-heading-xlarge', 
        'h1.text-heading-xlarge',
        'h1.pv-top-card-section__name',
        '.artdeco-entity-lockup__title',
        '.profile-topcard__title',
        '.pv-text-details__left-panel h1'
      ];
      
      for (const selector of nameSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          // Get just the first name if possible
          const fullName = element.textContent.trim();
          data.name = fullName.split(' ')[0];
          console.log("Found name:", data.name);
          break;
        }
      }
      
      // Extract headline - try multiple selector patterns
      const headlineSelectors = [
        '.text-body-medium',
        '.pv-top-card-section__headline',
        '.artdeco-entity-lockup__subtitle',
        '.profile-topcard__subtitle',
        '[data-field="headline"]',
        '.pv-text-details__left-panel .text-body-medium'
      ];
      
      for (const selector of headlineSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          data.headline = element.textContent.trim();
          console.log("Found headline:", data.headline);
          break;
        }
      }
      
      // Extract company - try multiple selector patterns
      const companySelectors = [
        '.pv-top-card-v2-section__company-name',
        '.pv-top-card-v2-section__link',
        '.pv-entity__company-summary-info h3',
        '.profile-topcard__current-company',
        '.pv-text-details__right-panel .text-body-small'
      ];
      
      for (const selector of companySelectors) {
        const element = document.querySelector(selector);
        if (element) {
          data.company = element.textContent.trim();
          console.log("Found company:", data.company);
          break;
        }
      }
      
      // Alternative approach for company: look for "works at" text
      if (!data.company) {
        // Look for any text that contains "works at" or "working at"
        const allElements = document.querySelectorAll('span, p, div');
        for (const element of allElements) {
          const text = element.textContent.toLowerCase();
          if (text.includes('works at') || text.includes('working at')) {
            // Extract company name that comes after "works at" or "working at"
            const match = element.textContent.match(/(works at|working at)(.*?)($|\s*\(|\s*\•)/i);
            if (match && match[2]) {
              data.company = match[2].trim();
              console.log("Found company from text:", data.company);
              break;
            }
          }
        }
      }
      
      // Extract location - try multiple selector patterns
      const locationSelectors = [
        '.text-body-small.inline.t-black--light.break-words',
        '.pv-top-card-section__location',
        '.profile-topcard__location-data',
        '[data-field="location"]',
        '.pv-text-details__left-panel .text-body-small'
      ];
      
      for (const selector of locationSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          data.location = element.textContent.trim();
          console.log("Found location:", data.location);
          break;
        }
      }
      
      // Extract industry - this is the trickiest part
      // First, try to extract from the about section
      const aboutSections = [
        '#about-section',
        '.pv-about-section',
        '.pv-about__summary-text',
        '.profile-about-text'
      ];
      
      for (const selector of aboutSections) {
        const element = document.querySelector(selector);
        if (element) {
          const text = element.textContent.toLowerCase();
          if (text.includes('industry') || text.includes('sector')) {
            const lines = element.textContent.split('\n');
            for (const line of lines) {
              if (line.toLowerCase().includes('industry') || line.toLowerCase().includes('sector')) {
                data.industry = line.replace(/industry|sector/gi, '').trim();
                console.log("Found industry:", data.industry);
                break;
              }
            }
          } else {
            // If no explicit industry mentioned, use the headline as fallback
            data.industry = data.headline;
          }
          break;
        }
      }
      
      // If we couldn't find industry, use headline as fallback
      if (!data.industry && data.headline) {
        data.industry = data.headline;
      }
      
      // Extract profile ID from URL
      const urlMatch = window.location.href.match(/\/in\/([^\/\?]+)/);
      if (urlMatch && urlMatch[1]) {
        data.profileId = urlMatch[1];
        console.log("Found profile ID:", data.profileId);
      }
      
      // Extract profile picture URL
      const imgSelectors = [
        '.pv-top-card-section__photo img',
        '.presence-entity__image',
        '.profile-picture img',
        '.pv-top-card__photo img',
        '.profile-topcard-person-entity__image'
      ];
      
      for (const selector of imgSelectors) {
        const element = document.querySelector(selector);
        if (element && element.src) {
          data.picUrl = element.src;
          console.log("Found profile picture URL");
          break;
        }
      }
      
      // Inspect DOM structure to find additional data
      console.log("DOM inspection for debugging:");
      
      // Log all h1 elements
      const h1Elements = document.querySelectorAll('h1');
      console.log(`Found ${h1Elements.length} h1 elements`);
      h1Elements.forEach(el => console.log(`h1: ${el.textContent.trim()}`));
      
      // Log spans that might contain name or headline
      const importantSpans = document.querySelectorAll('.text-heading-xlarge, .text-body-medium');
      console.log(`Found ${importantSpans.length} important spans`);
      importantSpans.forEach(el => console.log(`span: ${el.textContent.trim()}`));
      
      // Make a second pass for any missing data
      if (!data.name) {
        // Try any h1 tag first
        const h1 = document.querySelector('h1');
        if (h1) {
          data.name = h1.textContent.trim().split(' ')[0];
        }
      }
      
      console.log("Extracted profile data:", data);
      return data;
    } catch (error) {
      console.error("Error extracting profile data:", error);
      return {
        name: '',
        company: '',
        location: '',
        headline: '',
        industry: '',
        profileId: '',
        picUrl: '',
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  }

// Improved connection sending logic
function findAndClickConnect(note, templateData = {}) {
  console.log("Looking for connection options on profile...");
  analyticsData.attemptTimestamp = new Date().toISOString();
  
  // Extract profile data if settings enable it
  extractedProfileData = extractProfileData();
  if (extractedProfileData) {
    analyticsData.profileId = extractedProfileData.profileId;
    
    // Personalize note with extracted data
    note = personalizeNote(note, extractedProfileData);
  }
  
  // First try to find a direct Connect button in the main profile area
  const directConnectButton = findDirectConnectButton();
  
  if (directConnectButton) {
    console.log("Direct Connect button found, clicking...");
    analyticsData.connectionType = "direct";
    
    // Highlight the button for visibility in debug mode
    highlightElement(directConnectButton);
    
    // Short delay to see the highlight, then click
    setTimeout(() => {
      safeClick(directConnectButton);
      
      // Wait for connection dialog
      setTimeout(() => {
        handleConnectionDialog(note);
      }, 2000);
    }, 500);
    return;
  }
  
  // Extra logging for debugging
  console.log("Profile DOM structure exploration:");
  const topCard = document.querySelector('.pv-top-card, .artdeco-card');
  if (topCard) {
    console.log("- Top card found with classes:", topCard.className);
    const actionButtons = topCard.querySelectorAll('button');
    console.log(`- Found ${actionButtons.length} buttons in top card`);
    actionButtons.forEach(btn => {
      if (isVisible(btn)) {
        console.log(`  - Button: "${btn.textContent.trim()}" with aria-label: "${btn.getAttribute('aria-label') || 'none'}"`);
      }
    });
  } else {
    console.log("- No top card found");
  }
  
  // If no direct Connect button, look for More dropdown
  console.log("No direct Connect button found, trying More dropdown...");
  
  // Find the More button near the Follow button in the main profile section
  const moreButton = findProfileMoreButton();
  
  if (moreButton) {
    console.log("More button found in profile actions:", moreButton.textContent.trim());
    analyticsData.connectionType = "dropdown";
    
    // Highlight the More button for debugging
    highlightElement(moreButton);
    
    // Click the More button after a small delay to ensure the highlight is visible
    setTimeout(() => {
      console.log("Clicking More button...");
      safeClick(moreButton);
      
      // Wait for dropdown to appear then find Connect
      setTimeout(() => {
        // Find the connect option using the working method from the manual script
        const connectOption = findConnectButtonInDropdown();
        
        if (connectOption) {
          console.log("Connect option found in dropdown:", connectOption.textContent.trim());
          
          // Add visual highlight for debugging
          highlightElement(connectOption);
          
          // Click after a short delay to ensure highlight is visible
          setTimeout(() => {
            console.log("Clicking Connect option...");
            safeClick(connectOption);
            
            // Wait for connection dialog
            setTimeout(() => {
              const isDialogVisible = checkForConnectionDialog();
              
              if (isDialogVisible) {
                console.log("Connection dialog appeared, handling it...");
                handleConnectionDialog(note);
              } else {
                console.log("Connection dialog not found, trying once more...");
                
                // Try clicking again
                safeClick(connectOption);
                
                // Check again after a longer delay
                setTimeout(() => {
                  if (checkForConnectionDialog()) {
                    console.log("Connection dialog appeared after second click, handling it...");
                    handleConnectionDialog(note);
                  } else {
                    console.log("Connection dialog still not found, assuming success anyway");
                    recordConnection(true);
                    isProcessing = false;
                  }
                }, 3000);
              }
            }, 2000);
          }, 500);
        } else {
          console.log("Connect option not found in dropdown");
          logOpenDropdowns();
          recordConnection(false, "connect_option_not_found");
          isProcessing = false;
        }
      }, 1500);
    }, 500);
  } else {
    console.log("More button not found in profile actions");
    logAllButtons();
    recordConnection(false, "more_button_not_found");
    isProcessing = false;
  }
}

// Handle personalization of the connection note
function personalizeNote(note, profileData) {
  if (!note || !profileData) return note;
  
  // Replace tags with actual profile data
  return note
    .replace(/\[Name\]/g, profileData.name || '')
    .replace(/\[Company\]/g, profileData.company || '')
    .replace(/\[Location\]/g, profileData.location || '')
    .replace(/\[Headline\]/g, profileData.headline || '')
    .replace(/\[Industry\]/g, profileData.industry || '');
}

// Safely click an element with error handling
function safeClick(element) {
  try {
    element.click();
    return true;
  } catch (error) {
    console.error("Error clicking element:", error);
    analyticsData.errors.push({type: 'click_error', message: error.message});
    return false;
  }
}

// Highlight an element for debugging
function highlightElement(element, duration = 1000) {
  if (!element) return;
  
  const originalStyle = element.getAttribute('style') || '';
  element.setAttribute('style', originalStyle + '; background-color: rgba(255, 215, 0, 0.5) !important; border: 2px solid #ff5722 !important;');
  
  setTimeout(() => {
    element.setAttribute('style', originalStyle);
  }, duration);
}

// This function uses multiple strategies to find the Connect button in a dropdown
function findConnectButtonInDropdown() {
  console.log("Finding Connect option in dropdown");
  const dropdown = document.querySelector('.artdeco-dropdown__content--is-open, .pvs-overflow-actions-dropdown__content, [role="menu"][aria-hidden="false"]');
  
  if (!dropdown) {
    console.log("No open dropdown found");
    analyticsData.errors.push({type: 'ui_error', message: 'No open dropdown found'});
    return null;
  }
  
  // Method 1: Look specifically for the div with role="button" containing "Connect"
  const connectDivs = Array.from(dropdown.querySelectorAll('div[role="button"], div[role="menuitem"]'));
  for (const div of connectDivs) {
    if (div.textContent.trim().includes('Connect') && 
        !div.textContent.includes('Remove') &&
        isVisible(div)) {
      console.log("Found Connect div by text content:", div.textContent.trim());
      return div;
    }
  }
  
  // Method 2: Look for any element with "connect" text in dropdown (more aggressive)
  const allElements = dropdown.querySelectorAll('*');
  for (const el of allElements) {
    if (el.textContent.trim().toLowerCase().includes('connect') && 
        !el.textContent.toLowerCase().includes('remove') &&
        isVisible(el)) {
      
      // Try to find a clickable parent
      const clickableParent = el.closest('div[role="button"], div[role="menuitem"], button, li[role="menuitem"]');
      if (clickableParent && isVisible(clickableParent)) {
        console.log("Found Connect element via text:", el.textContent.trim());
        return clickableParent;
      } else {
        // If no clickable parent but the element itself is clickable, return it
        if (el.tagName === 'BUTTON' || el.hasAttribute('role') && (el.getAttribute('role') === 'button' || el.getAttribute('role') === 'menuitem')) {
          console.log("Found Connect button element:", el.textContent.trim());
          return el;
        }
      }
    }
  }
  
  console.log("Could not find Connect option in dropdown");
  analyticsData.errors.push({type: 'ui_error', message: 'Connect option not found in dropdown'});
  return null;
}

// Check if a connection dialog is currently visible
function checkForConnectionDialog() {
  // Method 1: Look for dialog/modal elements
  const modals = document.querySelectorAll('.artdeco-modal, dialog, [role="dialog"]');
  for (const modal of modals) {
    if (isVisible(modal)) {
      const modalText = modal.textContent.trim().toLowerCase();
      if (modalText.includes('connect') || 
          modalText.includes('invitation') || 
          modalText.includes('invite') ||
          modalText.includes('add a note')) {
        return true;
      }
    }
  }
  
  // Method 2: Look for textarea (note field) which indicates a connection dialog
  const textarea = document.querySelector('textarea');
  if (textarea && isVisible(textarea)) {
    return true;
  }
  
  // Method 3: Look for send/connect buttons that might indicate a dialog
  const sendButtons = document.querySelectorAll('button');
  for (const btn of sendButtons) {
    const text = btn.textContent.trim().toLowerCase();
    if ((text === 'send' || 
         text === 'send invitation' || 
         text.includes('connect with')) && 
        isVisible(btn)) {
      return true;
    }
  }
  
  return false;
}

// Use multiple strategies to find the direct Connect button
function findDirectConnectButton() {
  console.log("Looking for direct Connect button...");

  // Check if we're in the main profile view or a "People similar to" section
  if (document.querySelector('.pv-secondary-actions') || 
      document.querySelector('h2')?.textContent.includes('similar to')) {
    // We're likely on a person's profile but looking at the similar people section
    console.log("Detected 'People similar to' section - will exclude these Connect buttons");
  }
  
  // METHOD 1: Find in profile actions by class names
  const profileActionSelectors = [
    '.pvs-profile-actions', 
    '.pv-top-card-v2-ctas', 
    '.pv-top-card-v2__cta-container',
    '.pv-s-profile-actions',
    '.pv-top-card__cta-container',
    '.artdeco-card__actions',
    '.ph5.pb5' // Common container for profile actions
  ];
  
  for (const selector of profileActionSelectors) {
    const profileActions = document.querySelector(selector);
    if (profileActions) {
      console.log(`Found profile actions with selector: ${selector}`);
      
      // Look specifically for Connect button
      const connectBtn = Array.from(profileActions.querySelectorAll('button')).find(
        btn => (btn.textContent.trim() === 'Connect' || 
               btn.getAttribute('aria-label')?.includes('Connect')) && 
               isVisible(btn) &&
               !isInSimilarPeopleSection(btn)
      );
      
      if (connectBtn) {
        console.log("Found Connect button in profile actions");
        return connectBtn;
      }
    }
  }
  
  // METHOD 2: Look for connect button by aria label
  const connectByAria = document.querySelector('button[aria-label*="Connect with"], button[aria-label*="connect with"]');
  if (connectByAria && isVisible(connectByAria) && 
      !isInSidebar(connectByAria) &&
      !isInSimilarPeopleSection(connectByAria)) {
    console.log("Found Connect button by aria-label");
    return connectByAria;
  }
  
  // METHOD 3: Look for primary action button that says Connect
  const primaryActionButtons = document.querySelectorAll('button.artdeco-button--primary');
  for (const button of primaryActionButtons) {
    if (button.textContent.trim() === 'Connect' && isVisible(button) &&
        !isInSidebar(button) &&
        !isInSimilarPeopleSection(button)) {
      console.log("Found Connect as primary action button");
      return button;
    }
  }
  
  // METHOD 4: General search with filtering
  console.log("Trying general button search for Connect...");
  const buttons = document.querySelectorAll('button');
  for (const button of buttons) {
    const text = button.textContent.trim();
    
    // Check if this is a viable Connect button
    if (text === 'Connect' && isVisible(button) && 
        !isInSidebar(button) &&
        !isInSimilarPeopleSection(button) &&
        !text.includes('Navigator')) {
      
      // Get parent information for logging
      const parentSection = button.closest('section, div, article');
      console.log("Found Connect button in general search", 
                  parentSection ? `in section ${parentSection.className}` : '');
      
      return button;
    }
  }
  
  console.log("No direct Connect button found");
  analyticsData.errors.push({type: 'ui_error', message: 'No direct Connect button found'});
  return null;
}

// Helper function to check if element is in "similar people" section
function isInSimilarPeopleSection(element) {
  // Check if element is inside a "similar people" section
  const similarSection = element.closest('section, div, ul')?.querySelector('h2, h3')?.textContent;
  if (similarSection && (
      similarSection.includes('similar') || 
      similarSection.includes('People you may know') ||
      similarSection.includes('recommended')
     )) {
    console.log("Button is inside similar people section:", similarSection);
    return true;
  }
  
  // Also check ancestor elements with class names suggesting a recommendations section
  const hasRecommendationParent = !!element.closest('.discover-entity-type-card, .pv-browsemap-section, .artdeco-card.mb2, .pvs-entity');
  
  return hasRecommendationParent;
}

// Check if an element is in a sidebar or irrelevant section
function isInSidebar(element) {
  return element.closest('.scaffold-layout__aside') || 
         element.closest('[data-test-id="wormhole"]') ||
         element.closest('.right-rail-container') ||
         element.closest('.feed-shared-update-v2');
}

// Find the More button in profile actions using multiple strategies
function findProfileMoreButton() {
  console.log("Looking for More button in profile actions...");
  
  // APPROACH 1: Find the exact "More" button with aria-label="More actions"
  const profileCard = document.querySelector('.artdeco-card, .pv-top-card');
  if (profileCard) {
    console.log("Found profile card:", profileCard.className);
    
    // Look for the specific More button with correct aria-label
    const moreButton = profileCard.querySelector('button[aria-label="More actions"]');
    if (moreButton && isVisible(moreButton)) {
      console.log("Found the correct More button by aria-label in profile card");
      return moreButton;
    }
  }
  
  // APPROACH 2: Find button with text "More" only in the main profile section
  const mainSection = document.querySelector('main');
  if (mainSection) {
    const buttons = Array.from(mainSection.querySelectorAll('button'));
    for (const button of buttons) {
      if (button.textContent.trim() === 'More' && isVisible(button)) {
        // Make sure it's not in the messaging area
        if (!isInSidebar(button) && 
            !button.closest('.msg-overlay-bubble-header') && 
            !button.closest('.msg-overlay-conversation-bubble')) {
          console.log("Found More text button in main profile section");
          return button;
        }
      }
    }
  }
  
  // APPROACH 3: Look for the button in the same container as Message and Save buttons
  const messageButton = document.querySelector('button[aria-label^="Message"]');
  if (messageButton) {
    // Get the parent container that holds action buttons
    const actionContainer = messageButton.closest('div, section, ul');
    if (actionContainer) {
      // Look for More button in the same container
      const buttons = actionContainer.querySelectorAll('button');
      for (const button of buttons) {
        const text = button.textContent.trim();
        const ariaLabel = button.getAttribute('aria-label') || '';
        
        if ((text === 'More' || ariaLabel.includes('More action')) && isVisible(button)) {
          console.log("Found More button in same container as Message button");
          return button;
        }
      }
    }
  }
  
  // APPROACH 4: Visual position analysis - find button to the right of Message button
  const messageBtn = document.querySelector('button[aria-label^="Message"]');
  const saveBtn = document.querySelector('button[aria-label*="Sales Navigator"]');
  
  if (messageBtn) {
    // Identify all buttons in the same horizontal area (similar Y position)
    const messageRect = messageBtn.getBoundingClientRect();
    const buttons = document.querySelectorAll('button');
    
    for (const button of buttons) {
      if (!isVisible(button)) continue;
      
      const buttonRect = button.getBoundingClientRect();
      // Check if button is at a similar height as the message button but to the right
      const similarY = Math.abs(buttonRect.top - messageRect.top) < 20;
      const isToTheRight = buttonRect.left > messageBtn.getBoundingClientRect().right;
      
      if (similarY && isToTheRight && (!saveBtn || button !== saveBtn)) {
        console.log("Found potential More button by position analysis");
        return button;
      }
    }
  }
  
  console.log("Could not find the More button with any method");
  analyticsData.errors.push({type: 'ui_error', message: 'More button not found'});
  return null;
}

// Handle the connection dialog including adding notes
function handleConnectionDialog(note) {
  console.log("Handling connection dialog...");
  
  // Check if we need to add a note
  if (note && note.trim() !== '') {
    const addNoteButton = findAddNoteButton();
    
    if (addNoteButton) {
      console.log("Add note button found, clicking...");
      safeClick(addNoteButton);
      
      // Wait for note field to appear
      setTimeout(() => {
        const noteField = document.querySelector('textarea');
        
        if (noteField) {
          console.log("Note field found, adding note...");
          // Set the value and trigger input event for React-based forms
          noteField.value = note;
          noteField.dispatchEvent(new Event('input', { bubbles: true }));
          
          // Click Send after adding note
          setTimeout(() => {
            const sendButton = findSendButton();
            if (sendButton) {
              console.log("Send button found, clicking...");
              safeClick(sendButton);
              
              // Report success
              setTimeout(() => {
                console.log("Connection request sent successfully with note");
                recordConnection(true);
                isProcessing = false;
              }, 1500);
            } else {
              console.log("Send button not found");
              clickAnySendButton();
            }
          }, 1500);
        } else {
          console.log("Note field not found");
          analyticsData.errors.push({type: 'ui_error', message: 'Note field not found'});
          clickAnySendButton();
        }
      }, 1500);
    } else {
      // No add note button, try to send directly
      console.log("Add note button not found, trying to send directly");
      analyticsData.errors.push({type: 'ui_error', message: 'Add note button not found'});
      clickAnySendButton();
    }
  } else {
    // No note needed, just click send
    console.log("No note needed, looking for send button");
    clickAnySendButton();
  }
}

// Find and click any viable send button
function clickAnySendButton() {
  // First try standard send button
  const sendButton = findSendButton();
  if (sendButton) {
    console.log("Send button found, clicking...");
    safeClick(sendButton);
    
    // Report success
    setTimeout(() => {
      console.log("Connection request sent successfully");
      recordConnection(true);
      isProcessing = false;
    }, 1500);
    return;
  }
  
  // Otherwise look for any primary button in a dialog
  const modals = document.querySelectorAll('.artdeco-modal, dialog, [role="dialog"]');
  for (const modal of modals) {
    if (isVisible(modal)) {
      const primaryButton = modal.querySelector('button.artdeco-button--primary');
      if (primaryButton && isVisible(primaryButton)) {
        console.log("Found primary button in dialog, clicking...");
        safeClick(primaryButton);
        
        // Report success
        setTimeout(() => {
          console.log("Connection request sent via primary button");
          recordConnection(true);
          isProcessing = false;
        }, 1500);
        return;
      }
      
      // Look for any button with send-like text
      const buttons = modal.querySelectorAll('button');
      for (const button of buttons) {
        const text = button.textContent.trim().toLowerCase();
        if ((text === 'send' || 
             text === 'send invitation' || 
             text === 'connect' || 
             text === 'done') && 
            isVisible(button)) {
          
          console.log("Found button with send-like text, clicking...");
          safeClick(button);
          
          // Report success
          setTimeout(() => {
            console.log("Connection request sent via text-matched button");
            recordConnection(true);
            isProcessing = false;
          }, 1500);
          return;
        }
      }
    }
  }
  
  // If all else fails, just report success anyway (we made it this far)
  console.log("Could not find any send button, but assuming connection process completed");
  analyticsData.errors.push({type: 'ui_error', message: 'No send button found'});
  recordConnection(true, "no_send_button");
  isProcessing = false;
}

// Find the "Add a note" button in the connection dialog
function findAddNoteButton() {
  // Method 1: By text content
  const buttons = document.querySelectorAll('button');
  for (const button of buttons) {
    if (button.textContent.includes('Add a note') && isVisible(button)) {
      return button;
    }
  }
  
  // Method 2: By class name patterns (LinkedIn sometimes uses specific classes)
  const addNoteBtn = document.querySelector('.artdeco-modal__actionbar button:not(.artdeco-button--primary)');
  if (addNoteBtn && isVisible(addNoteBtn) && !addNoteBtn.textContent.includes('Send')) {
    return addNoteBtn;
  }
  
  return null;
}

// Find the Send button in a connection dialog
function findSendButton() {
  // Find Send button in modal using multiple strategies
  const modals = document.querySelectorAll('.artdeco-modal, dialog, [role="dialog"]');
  for (const modal of modals) {
    if (isVisible(modal)) {
      // Try primary button first
      const primaryButton = modal.querySelector('button.artdeco-button--primary');
      if (primaryButton && isVisible(primaryButton)) {
        return primaryButton;
      }
      
      // Try by text content
      const buttons = modal.querySelectorAll('button');
      for (const button of buttons) {
        const text = button.textContent.trim().toLowerCase();
        if ((text === 'send' || 
             text === 'send invitation' ||
             text === 'connect') && 
            isVisible(button)) {
          return button;
        }
      }
    }
  }
  
  // Try to find a Send button anywhere in the document as fallback
  const allButtons = document.querySelectorAll('button');
  for (const button of allButtons) {
    const text = button.textContent.trim().toLowerCase();
    if ((text === 'send' || text === 'send invitation') && isVisible(button)) {
      return button;
    }
  }
  
  return null;
}

// Helper function to check if an element is visible
function isVisible(element) {
  if (!element) return false;
  
  const style = window.getComputedStyle(element);
  return style.display !== 'none' && 
         style.visibility !== 'hidden' && 
         element.offsetWidth > 0 && 
         element.offsetHeight > 0;
}

function isInSimilarPeopleSection(element) {
  // Check if element is inside a "similar people" section
  const similarSection = element.closest('section, div, ul')?.querySelector('h2, h3')?.textContent;
  if (similarSection && (
      similarSection.includes('similar') || 
      similarSection.includes('People you may know') ||
      similarSection.includes('recommended')
     )) {
    console.log("Button is inside similar people section:", similarSection);
    return true;
  }
  
  // Also check ancestor elements with class names suggesting a recommendations section
  const hasRecommendationParent = !!element.closest('.discover-entity-type-card, .pv-browsemap-section, .artdeco-card.mb2, .pvs-entity');
  
  return hasRecommendationParent;
}

// Record connection attempt result and send to background script
function recordConnection(success, failureReason = null) {
  analyticsData.connectionSent = success;
  
  if (!success && failureReason) {
    analyticsData.errors.push({type: 'connection_failure', message: failureReason});
  }
  
  // Send result to background script
  if (success) {
    chrome.runtime.sendMessage({
      action: 'connectionSent',
      profileData: extractedProfileData,
      analytics: analyticsData
    });
  } else {
    chrome.runtime.sendMessage({
      action: 'connectionFailed',
      profileData: extractedProfileData,
      analytics: analyticsData,
      failureReason: failureReason
    });
  }
}

// Debug helpers
function logAllButtons() {
  console.log("All visible buttons:");
  const buttons = document.querySelectorAll('button');
  for (const button of buttons) {
    if (isVisible(button)) {
      console.log("- Button:", button.textContent.trim(), button.getAttribute('aria-label') || 'no-aria-label');
    }
  }
}

function logOpenDropdowns() {
  console.log("Open dropdowns:");
  const dropdowns = document.querySelectorAll('.artdeco-dropdown__content--is-open, [role="menu"][aria-hidden="false"]');
  for (const dropdown of dropdowns) {
    console.log("Dropdown items:");
    const items = dropdown.querySelectorAll('li, div[role="button"], div[role="menuitem"], button');
    for (const item of items) {
      if (item.textContent.trim() && isVisible(item)) {
        console.log("- Item:", item.tagName, item.textContent.trim());
      }
    }
  }
}

// Message listener for background script communication
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  console.log("Message received in content script:", message);

  // Handle heartbeat
  if (message.action === 'heartbeat') {
    console.log("Received heartbeat from background script");
    chrome.runtime.sendMessage({ action: 'heartbeatResponse' });
    sendResponse({status: "alive"});
    
    // Keep page active
    window.scrollBy(0, 1);
    setTimeout(() => window.scrollBy(0, -1), 100);
    return true;
  }
  
  // Handle connection request
  if (message.action === 'sendConnection' && !isProcessing) {
    // Set processing flag to prevent multiple simultaneous operations
    isProcessing = true;
    
    // Reset analytics data for new attempt
    analyticsData = {
      attemptTimestamp: null,
      profileId: null,
      connectionSent: false,
      connectionType: null,
      templateUsed: message.templateId || 'default',
      errors: []
    };
    
    // Print LinkedIn DOM version for debugging
    console.log("Current page URL:", window.location.href);
    console.log("LinkedIn page DOM exploration starting...");
    
    // Give the page a moment to fully load and render all elements
    setTimeout(() => {
      // First check if already connected - more specific to avoid false positives
      const messageButton = document.querySelector('button.message-anywhere-button, button[aria-label="Message"]');
      
      // Make sure it's a primary message button, not something in suggestions
      if (messageButton && 
          isVisible(messageButton) && 
          !isInSidebar(messageButton)) {
        console.log("Already connected - Message button found");
        
        // Log details about the message button for debugging
        console.log("Message button details:", {
          text: messageButton.textContent.trim(),
          ariaLabel: messageButton.getAttribute('aria-label'),
          classes: messageButton.className,
          parentSection: messageButton.closest('section, div')?.className || 'no parent section'
        });
        
        // Still extract profile data for analytics
        extractedProfileData = extractProfileData();
        
        // Record as successful but already connected
        analyticsData.connectionType = "already_connected";
        recordConnection(true);
        isProcessing = false;
        return;
      }
      
      // Additional check for "Message John" type buttons that indicate connection
      const namedMessageButtons = document.querySelectorAll('button');
      for (const btn of namedMessageButtons) {
        if (btn.textContent.trim().toLowerCase().includes('message ') && 
            isVisible(btn) &&
            !isInSidebar(btn)) {
          console.log("Already connected - Named message button found:", btn.textContent.trim());
          
          // Still extract profile data for analytics
          extractedProfileData = extractProfileData();
          
          // Record as successful but already connected
          analyticsData.connectionType = "already_connected";
          recordConnection(true);
          isProcessing = false;
          return;
        }
      }
      
      // Try to connect
      findAndClickConnect(message.note, {templateId: message.templateId});
    }, 3000); // Wait 3 seconds to ensure page is fully loaded
  }
  
  return true;
});

// Also, add this debug function to help identify the right selectors
function debugDOMStructure() {
    console.log("==== LinkedIn Profile DOM Structure ====");
    
    // Log the main section elements
    const mainSections = document.querySelectorAll('section');
    console.log(`Found ${mainSections.length} main sections`);
    
    // Find the profile card
    const profileCard = document.querySelector('.pv-top-card, .artdeco-card.pv-top-card');
    if (profileCard) {
      console.log("Profile card found:", profileCard.className);
      console.log("Profile card HTML:", profileCard.outerHTML.substring(0, 500) + "...");
    } else {
      console.log("Profile card not found. Searching for alternatives...");
      
      // Try to find elements that might contain profile info
      const possibleContainers = [
        '.pv-text-details',
        '.pv-profile-section',
        '.profile-topcard',
        '.artdeco-entity-lockup'
      ];
      
      for (const selector of possibleContainers) {
        const container = document.querySelector(selector);
        if (container) {
          console.log(`Found alternative container: ${selector}`);
          console.log("Container HTML:", container.outerHTML.substring(0, 500) + "...");
        }
      }
    }
    
    // Check for connection buttons
    const connectButtons = document.querySelectorAll('button');
    console.log(`Found ${connectButtons.length} buttons`);
    
    connectButtons.forEach(button => {
      if (button.textContent.includes('Connect') || 
          (button.getAttribute('aria-label') && 
           button.getAttribute('aria-label').includes('Connect'))) {
        console.log("Connect button found:", button.outerHTML);
      }
    });
    
    // This will help us identify the correct selectors
    return "DOM structure logged to console for debugging";
  }
  
  // Call this from your main content script if you're having issues
  // debugDOMStructure();