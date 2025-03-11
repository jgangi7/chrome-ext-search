let currentTab = null;
let searchTimeout = null;
let contentScriptLoaded = false;
let currentTheme = 'default';
const MAX_RETRIES = 3;

// Theme sequence
const THEMES = ['default', 'purple', 'blue', 'gold'];
let themeIndex = 0;

// Get DOM elements
const searchInput = document.getElementById('searchInput');
const prevButton = document.getElementById('prevButton');
const nextButton = document.getElementById('nextButton');
const searchStats = document.getElementById('searchStats');

// Initialize popup
async function initializePopup() {
  try {
    // Get the current active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url) return;

    currentTab = tab;

    // Check if we can search in this page
    if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      searchInput.disabled = true;
      searchInput.placeholder = 'Cannot search in Chrome system pages';
      return;
    }

    // Try to inject content script first
    await ensureContentScriptLoaded();

    // Setup event listeners
    searchInput.addEventListener('input', handleSearch);
    searchInput.addEventListener('keydown', handleKeyDown);
    prevButton.addEventListener('click', () => navigateSearch('prev'));
    nextButton.addEventListener('click', () => navigateSearch('next'));

    // Focus the search input
    searchInput.focus();
  } catch (error) {
    console.error('Error initializing popup:', error);
    searchInput.disabled = true;
    searchInput.placeholder = 'Error initializing search';
  }
}

function cycleToNextTheme() {
  // Remove current theme class
  document.body.classList.remove(`theme-${currentTheme}`);
  
  // Update theme index
  themeIndex = (themeIndex + 1) % THEMES.length;
  currentTheme = THEMES[themeIndex];
  
  // Add new theme class if not default
  if (currentTheme !== 'default') {
    document.body.classList.add(`theme-${currentTheme}`);
  }
}

// Handle keydown events
async function handleKeyDown(event) {
  if (event.key === 'Enter' && searchInput.value.trim()) {
    event.preventDefault();
    
    try {
      if (!contentScriptLoaded) {
        await ensureContentScriptLoaded();
      }

      const searchValue = searchInput.value.trim();
      
      // Send search request with current theme
      await chrome.tabs.sendMessage(currentTab.id, {
        action: 'search',
        query: searchValue,
        theme: currentTheme,
        persist: true
      });

      // Clear input and cycle theme
      searchInput.value = '';
      cycleToNextTheme();
      searchInput.focus();
    } catch (error) {
      console.error('Error on Enter search:', error);
    }
  }
}

// Handle search input
function handleSearch() {
  if (searchTimeout) {
    window.clearTimeout(searchTimeout);
  }

  searchTimeout = window.setTimeout(async () => {
    const query = searchInput.value;
    if (!currentTab?.id || !query) return;

    try {
      if (!contentScriptLoaded) {
        await ensureContentScriptLoaded();
      }

      // Send search request with current theme
      await chrome.tabs.sendMessage(currentTab.id, {
        action: 'search',
        query: query,
        theme: currentTheme,
        persist: false
      });

    } catch (error) {
      console.error('Error searching:', error);
      contentScriptLoaded = false;
      try {
        await ensureContentScriptLoaded();
        // Retry search
        handleSearch();
      } catch (retryError) {
        console.error('Failed to recover from search error:', retryError);
      }
    }
  }, 150);
}

// Navigate between search results
async function navigateSearch(direction) {
  if (!currentTab?.id) return;

  try {
    if (!contentScriptLoaded) {
      await ensureContentScriptLoaded();
    }

    const response = await chrome.tabs.sendMessage(currentTab.id, {
      action: 'navigate',
      direction: direction
    });

    if (response && typeof response.currentMatch === 'number') {
      searchStats.textContent = `${response.currentMatch} of ${response.matchCount}`;
    }
  } catch (error) {
    console.error('Error navigating:', error);
    contentScriptLoaded = false;
    searchStats.textContent = 'Navigation error';
  }
}

// Ensure content script is loaded with retries
async function ensureContentScriptLoaded(retryCount = 0) {
  if (!currentTab?.id) return;

  try {
    // Try to send a test message to check if content script is loaded
    await chrome.tabs.sendMessage(currentTab.id, { action: 'ping' });
    contentScriptLoaded = true;
  } catch (error) {
    if (retryCount >= MAX_RETRIES) {
      console.error('Failed to load content script after retries');
      throw error;
    }

    // If content script is not loaded, inject it
    console.log(`Content script not loaded, injecting... (attempt ${retryCount + 1})`);
    await injectContentScript();
    
    // Wait a bit longer before retrying
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Retry the check
    return ensureContentScriptLoaded(retryCount + 1);
  }
}

// Inject content script if not already loaded
async function injectContentScript() {
  if (!currentTab?.id) return;

  try {
    await chrome.scripting.insertCSS({
      target: { tabId: currentTab.id },
      files: ['content.css']
    });

    await chrome.scripting.executeScript({
      target: { tabId: currentTab.id },
      files: ['content.js']
    });

    // Wait for script to initialize
    await new Promise(resolve => setTimeout(resolve, 200));
  } catch (error) {
    console.error('Error injecting content script:', error);
    throw error;
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', initializePopup); 