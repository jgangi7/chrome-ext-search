/// <reference types="chrome"/>

let currentTab: chrome.tabs.Tab | null = null;
let searchTimeout: number | null = null;

// Get DOM elements
const searchInput = document.getElementById('searchInput') as HTMLInputElement;
const prevButton = document.getElementById('prevButton') as HTMLButtonElement;
const nextButton = document.getElementById('nextButton') as HTMLButtonElement;
const searchStats = document.getElementById('searchStats') as HTMLDivElement;

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

    // Setup event listeners
    searchInput.addEventListener('input', handleSearch);
    prevButton.addEventListener('click', () => navigateSearch('prev'));
    nextButton.addEventListener('click', () => navigateSearch('next'));

    // Focus the search input
    searchInput.focus();
  } catch (error) {
    console.error('Error initializing popup:', error);
  }
}

// Handle search input
function handleSearch() {
  if (searchTimeout) {
    window.clearTimeout(searchTimeout);
  }

  searchTimeout = window.setTimeout(async () => {
    const query = searchInput.value;
    if (!currentTab?.id || !query) {
      updateButtons(0);
      return;
    }

    try {
      // Send search request to content script
      const response = await chrome.tabs.sendMessage(currentTab.id, {
        action: 'search',
        query: query
      });

      // Update UI with search results
      if (response && typeof response.matchCount === 'number') {
        updateButtons(response.matchCount);
        if (response.matchCount > 0) {
          searchStats.textContent = `${response.currentMatch} of ${response.matchCount}`;
        } else {
          searchStats.textContent = 'No matches';
        }
      }
    } catch (error) {
      console.error('Error searching:', error);
      // Inject content script if it's not loaded
      await injectContentScript();
      // Retry search
      handleSearch();
    }
  }, 300);
}

// Navigate between search results
async function navigateSearch(direction: 'prev' | 'next') {
  if (!currentTab?.id) return;

  try {
    const response = await chrome.tabs.sendMessage(currentTab.id, {
      action: 'navigate',
      direction: direction
    });

    if (response && typeof response.currentMatch === 'number') {
      searchStats.textContent = `${response.currentMatch} of ${response.matchCount}`;
    }
  } catch (error) {
    console.error('Error navigating:', error);
  }
}

// Update button states
function updateButtons(matchCount: number) {
  const hasMatches = matchCount > 0;
  prevButton.disabled = !hasMatches;
  nextButton.disabled = !hasMatches;
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
    await new Promise(resolve => setTimeout(resolve, 100));
  } catch (error) {
    console.error('Error injecting content script:', error);
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', initializePopup); 