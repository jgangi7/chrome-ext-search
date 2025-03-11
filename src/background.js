// Background script
console.log('Background script starting...');

// Initialize search logs in storage
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ searchLogs: [] });
});

// Listen for extension installation or update
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Extension installed/updated:', details.reason);
  
  // Log registered commands
  chrome.commands.getAll((commands) => {
    console.log('Registered commands:', commands);
  });
});

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Message received in background:', request);

  switch (request.action) {
    case 'contentScriptLoaded':
      console.log('Content script loaded in tab:', sender.tab?.id);
      sendResponse({ status: 'acknowledged' });
      break;

    case 'logSearch':
      handleSearchLog(request.searchLog);
      sendResponse({ status: 'logged' });
      break;
  }

  return true;
});

// Check if URL is restricted
function isRestrictedUrl(url) {
  return url.startsWith('chrome://') || 
         url.startsWith('chrome-extension://') ||
         url.startsWith('chrome-search://') ||
         url.startsWith('chrome-devtools://') ||
         url.startsWith('about:') ||
         url.startsWith('edge://') ||
         url.startsWith('https://chrome.google.com/webstore');
}

// Listen for keyboard command
chrome.commands.onCommand.addListener((command) => {
  console.log('Command received:', command);
  
  if (command === 'activate-search') {
    console.log('Activate search command received');
    handleActivateSearch();
  }

  if (command === 'toggle-search') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      if (activeTab?.id) {
        chrome.action.openPopup();
      }
    });
  }
});

// Handle the activate search command
async function handleActivateSearch() {
  try {
    // Get the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    console.log('Active tab:', tab);
    
    if (!tab?.id || !tab.url) {
      console.log('No active tab found');
      return;
    }

    // Check if we can inject into this URL
    if (isRestrictedUrl(tab.url)) {
      console.log('Cannot inject into restricted URL:', tab.url);
      return;
    }

    try {
      // Try sending a message first to check if content script is loaded
      console.log('Attempting to send message to content script...');
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'activateSearch' });
      console.log('Content script response:', response);
    } catch (error) {
      console.log('Content script not loaded, injecting scripts...', error);
      // If sending message fails, inject the content script and CSS
      await chrome.scripting.insertCSS({
        target: { tabId: tab.id },
        files: ['content.css']
      });
      console.log('CSS injected');

      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
      console.log('Script injected');

      // Wait a moment for the script to initialize
      await new Promise(resolve => setTimeout(resolve, 100));

      // Now send the message again
      console.log('Scripts injected, sending activation message...');
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'activateSearch' });
      console.log('Activation response:', response);
    }
  } catch (error) {
    console.error('Error in activate-search command:', error);
  }
}

// Handle storing search logs
async function handleSearchLog(searchLog) {
  try {
    // Get existing logs
    const result = await chrome.storage.local.get('searchLogs');
    const searchLogs = result.searchLogs || [];

    // Add new log
    searchLogs.push(searchLog);

    // Keep only the last 1000 searches
    if (searchLogs.length > 1000) {
      searchLogs.shift();
    }

    // Store updated logs
    await chrome.storage.local.set({ searchLogs });
    console.log('Search logged:', searchLog);
  } catch (error) {
    console.error('Error storing search log:', error);
  }
} 