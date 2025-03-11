// Background script
console.log('Background script starting...');

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
  console.log('Received message:', request);
  if (request.action === 'contentScriptLoaded') {
    console.log('Content script loaded successfully');
  }
  sendResponse({ status: 'received' });
  return true; // Keep the message channel open for async response
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