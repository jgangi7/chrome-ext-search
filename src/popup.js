let currentTab = null;
let searchTimeout = null;
let contentScriptLoaded = false;
let currentTheme = 'default';
const MAX_RETRIES = 3;
const MAX_HISTORY = 4;

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
const searchButton = document.getElementById('searchButton');
const historyIcon = document.getElementById('historyIcon');
const historyList = document.getElementById('historyList');

function checkHistoryLimit() {
  if (searchHistory.length >= MAX_HISTORY) {
    document.body.classList.add('limit-reached');
    searchInput.disabled = true;
    searchInput.placeholder = 'Maximum of 4 search terms reached';
    return true;
  }
  document.body.classList.remove('limit-reached');
  searchInput.disabled = false;
  searchInput.placeholder = 'Search in page...';
  return false;
}

// Initialize popup
async function initializePopup() {
  try {
    // Get the current active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url) {
      console.error('No active tab found');
      searchInput.disabled = true;
      searchButton.disabled = true;
      searchInput.placeholder = 'No active tab found';
      return;
    }

    currentTab = tab;
    console.log('Current tab:', tab.url);

    // Set initial theme colors
    searchInput.style.backgroundColor = THEME_COLORS[currentTheme];
    document.body.style.backgroundColor = THEME_COLORS[currentTheme];

    // Check if we can search in this page
    if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      console.log('Cannot search in Chrome system page');
      searchInput.disabled = true;
      searchButton.disabled = true;
      searchInput.placeholder = 'Cannot search in Chrome system pages';
      return;
    }

    // Try to inject content script first
    try {
      await ensureContentScriptLoaded();
      console.log('Content script loaded successfully');
    } catch (error) {
      console.error('Failed to load content script:', error);
      searchInput.disabled = true;
      searchButton.disabled = true;
      searchInput.placeholder = 'Failed to load search functionality';
      return;
    }

    // Setup event listeners
    searchInput.addEventListener('input', handleSearch);
    searchInput.addEventListener('keydown', handleKeyDown);
    searchButton.addEventListener('click', handleSearchButtonClick);
    if (historyIcon) {
      historyIcon.addEventListener('click', toggleHistoryList);
      document.addEventListener('click', handleClickOutside);
    }

    // Get current search terms
    try {
      const response = await chrome.tabs.sendMessage(currentTab.id, {
        action: 'getSearchTerms'
      });
      
      if (response && response.terms) {
        searchHistory = response.terms;
        updateHistoryList();
        // Show history list if there are terms
        if (searchHistory.length > 0 && historyList) {
          historyList.classList.add('visible');
        }
        checkHistoryLimit();
      }
    } catch (error) {
      console.error('Failed to get search terms:', error);
      // Don't disable search if this fails, just start with empty history
    }

    // Focus the search input if not disabled
    if (!searchInput.disabled) {
      searchInput.focus();
    }
  } catch (error) {
    console.error('Error initializing popup:', error);
    searchInput.disabled = true;
    searchButton.disabled = true;
    searchInput.placeholder = 'Error initializing search';
  }
}

function toggleHistoryList() {
  if (searchHistory.length > 0) {
    historyList.classList.toggle('visible');
  }
}

function handleClickOutside(event) {
  if (!historyList.contains(event.target) && event.target !== historyIcon) {
    historyList.classList.remove('visible');
  }
}

function updateHistoryList() {
  if (!historyList) {
    console.error('History list element not found');
    return;
  }

  historyList.innerHTML = '';
  searchHistory.forEach((item, index) => {
    const div = document.createElement('div');
    div.className = 'history-item';
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'history-item-content';
    
    const colorDot = document.createElement('span');
    colorDot.className = 'history-item-color';
    colorDot.style.backgroundColor = THEME_COLORS[item.theme];
    
    const text = document.createElement('span');
    text.textContent = item.query;
    
    const deleteButton = document.createElement('span');
    deleteButton.className = 'history-item-delete';
    deleteButton.textContent = '×';
    deleteButton.onclick = (e) => {
      e.stopPropagation();
      removeSearchTerm(index);
    };
    
    contentDiv.appendChild(colorDot);
    contentDiv.appendChild(text);
    div.appendChild(contentDiv);
    div.appendChild(deleteButton);
    historyList.appendChild(div);
  });
}

function cycleToNextTheme() {
  // Remove current theme class
  document.body.classList.remove(`theme-${currentTheme}`);
  
  // Update theme index
  themeIndex = (themeIndex + 1) % THEMES.length;
  currentTheme = THEMES[themeIndex];
  
  // Add new theme class
  document.body.classList.add(`theme-${currentTheme}`);
  
  // Update search input and body background color
  searchInput.style.backgroundColor = THEME_COLORS[currentTheme];
  document.body.style.backgroundColor = THEME_COLORS[currentTheme];
}

// Handle search button click
async function handleSearchButtonClick() {
  const searchValue = searchInput.value.trim();
  if (!searchValue) return;
  
  try {
    // Ensure content script is loaded
    if (!contentScriptLoaded) {
      await ensureContentScriptLoaded();
    }
    
    // Perform the search
    await performSearch(searchValue);
  } catch (error) {
    console.error('Error on search button click:', error);
  }
}

// Perform search and update history
async function performSearch(searchValue) {
  try {
    // Ensure content script is loaded
    if (!contentScriptLoaded) {
      await ensureContentScriptLoaded();
    }

    // Send search request with current theme
    const response = await chrome.tabs.sendMessage(currentTab.id, {
      action: 'search',
      query: searchValue,
      theme: currentTheme,
      persist: true
    });
    
    if (response && !response.error) {
      // Add to search history
      searchHistory.push({ query: searchValue, theme: currentTheme });
      updateHistoryList();
      
      // Clear input and cycle theme
      searchInput.value = '';
      cycleToNextTheme();
      
      // Show history list after adding new term
      if (historyList) {
        historyList.classList.add('visible');
      }
      
      // Check if we've reached the limit
      checkHistoryLimit();
      
      // Focus the input if not disabled
      if (!searchInput.disabled) {
        searchInput.focus();
      }
    } else {
      console.error('Search failed:', response?.error);
    }
  } catch (error) {
    console.error('Error performing search:', error);
    // Try to recover by reloading content script
    contentScriptLoaded = false;
    try {
      await ensureContentScriptLoaded();
      // Retry search
      await performSearch(searchValue);
    } catch (retryError) {
      console.error('Failed to recover from search error:', retryError);
    }
  }
}

// Handle keydown events
async function handleKeyDown(event) {
  if (event.key === 'Enter' && searchInput.value.trim()) {
    event.preventDefault();
    await handleSearchButtonClick();
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

      // Check if we've reached the limit
      if (response.searchLimitReached) {
        checkHistoryLimit();
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
  if (!currentTab?.id) {
    throw new Error('No active tab');
  }

  try {
    // Try to send a test message to check if content script is loaded
    await chrome.tabs.sendMessage(currentTab.id, { action: 'ping' });
    contentScriptLoaded = true;
    return;
  } catch (error) {
    if (retryCount >= MAX_RETRIES) {
      console.error('Failed to load content script after retries');
      throw error;
    }

    // If content script is not loaded, inject it
    console.log(`Content script not loaded, injecting... (attempt ${retryCount + 1})`);
    try {
      await injectContentScript();
    } catch (error) {
      console.error('Failed to inject content script:', error);
      throw error;
    }
    
    // Wait a bit longer before retrying
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Retry the check
    return ensureContentScriptLoaded(retryCount + 1);
  }
}

// Inject content script if not already loaded
async function injectContentScript() {
  if (!currentTab?.id) {
    throw new Error('No active tab');
  }

  try {
    await chrome.scripting.insertCSS({
      target: { tabId: currentTab.id },
      files: ['src/content.css']
    });

    await chrome.scripting.executeScript({
      target: { tabId: currentTab.id },
      files: ['src/content.js']
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