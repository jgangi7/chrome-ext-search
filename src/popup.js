let currentTab = null;
let searchTimeout = null;
let contentScriptLoaded = false;
let currentTheme = 'default';
const MAX_RETRIES = 3;

// Theme sequence and colors
const THEMES = ['default', 'purple', 'blue', 'gold'];
const THEME_COLORS = {
  default: '#9CB380',
  purple: '#C45AB3',
  blue: '#5762D5',
  gold: '#DDA448'
};
let themeIndex = 0;

// Search history
let searchHistory = [];

// Get DOM elements
const searchInput = document.getElementById('searchInput');
const historyIcon = document.getElementById('historyIcon');
const historyList = document.getElementById('historyList');

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
    historyIcon.addEventListener('click', toggleHistoryList);
    document.addEventListener('click', handleClickOutside);

    // Get current search terms
    const response = await chrome.tabs.sendMessage(currentTab.id, {
      action: 'getSearchTerms'
    });
    
    if (response && response.terms) {
      searchHistory = response.terms;
      updateHistoryList();
    }

    // Focus the search input
    searchInput.focus();
  } catch (error) {
    console.error('Error initializing popup:', error);
    searchInput.disabled = true;
    searchInput.placeholder = 'Error initializing search';
  }
}

function toggleHistoryList() {
  historyList.classList.toggle('visible');
}

function handleClickOutside(event) {
  if (!historyList.contains(event.target) && event.target !== historyIcon) {
    historyList.classList.remove('visible');
  }
}

function updateHistoryList() {
  historyList.innerHTML = '';
  searchHistory.forEach((item, index) => {
    const div = document.createElement('div');
    div.className = 'history-item';
    
    const colorDot = document.createElement('span');
    colorDot.className = 'history-item-color';
    colorDot.style.backgroundColor = THEME_COLORS[item.theme];
    
    const text = document.createElement('span');
    text.textContent = item.query;
    
    div.appendChild(colorDot);
    div.appendChild(text);
    historyList.appendChild(div);
  });
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
      const response = await chrome.tabs.sendMessage(currentTab.id, {
        action: 'search',
        query: searchValue,
        theme: currentTheme,
        persist: true
      });

      if (!response.searchLimitReached) {
        // Add to search history
        searchHistory.push({ query: searchValue, theme: currentTheme });
        updateHistoryList();
      }

      // Clear input and cycle theme
      searchInput.value = '';
      cycleToNextTheme();
      
      // If search limit is reached, disable the input
      if (response.searchLimitReached) {
        searchInput.disabled = true;
        searchInput.placeholder = 'Maximum of 4 search terms reached';
      } else {
        searchInput.focus();
      }
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
      const response = await chrome.tabs.sendMessage(currentTab.id, {
        action: 'search',
        query: query,
        theme: currentTheme,
        persist: false
      });

      // If search limit is reached, disable the input
      if (response.searchLimitReached) {
        searchInput.disabled = true;
        searchInput.placeholder = 'Maximum of 4 search terms reached';
      }
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