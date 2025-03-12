// Content script
console.log('Content script loaded');

// Example: Send a message to the background script
chrome.runtime.sendMessage({ action: 'contentScriptLoaded' }, (response) => {
  console.log('Response from background:', response);
});

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Message received in content script:', request);
  sendResponse({ status: 'received' });
});

class SearchManager {
  constructor() {
    this.persistentHighlights = new Map(); // Map to store persistent highlights by query
    this.currentTheme = 'default';
    this.MAX_PERSISTENT_SEARCHES = 4;
    this.setupMessageListener();
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      console.log('Message received in content script:', request);

      switch (request.action) {
        case 'ping':
          sendResponse({ status: 'ok' });
          break;
        case 'search':
          this.handleSearch(request.query, request.persist, request.theme).then(response => {
            // Only log search when persist flag is true (Enter key pressed)
            if (request.persist) {
              this.logSearch(request.query, response.matchCount);
            }
            // Add search limit info to response
            response.searchLimitReached = this.persistentHighlights.size >= this.MAX_PERSISTENT_SEARCHES;
            sendResponse(response);
          });
          break;
      }

      // Keep the message channel open for async response
      return true;
    });
  }

  async logSearch(query, matchCount) {
    const searchLog = {
      timestamp: new Date().toISOString(),
      query: query,
      matchCount: matchCount,
      url: window.location.href,
      title: document.title
    };

    try {
      // Send search log to background script for storage
      await chrome.runtime.sendMessage({
        action: 'logSearch',
        searchLog: searchLog
      });
    } catch (error) {
      console.error('Error logging search:', error);
    }
  }

  async handleSearch(query, persist = false, theme = 'default') {
    // Check if we've reached the limit for persistent searches
    if (persist && this.persistentHighlights.size >= this.MAX_PERSISTENT_SEARCHES) {
      return {
        matchCount: 0,
        searchLimitReached: true
      };
    }

    // Clear temporary highlights but keep persistent ones
    this.clearTemporaryHighlights();
    
    if (!query) {
      return { 
        matchCount: 0,
        searchLimitReached: this.persistentHighlights.size >= this.MAX_PERSISTENT_SEARCHES
      };
    }

    // Update current theme
    this.currentTheme = theme;

    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          const parent = node.parentNode;
          if (parent.tagName === 'SCRIPT' || 
              parent.tagName === 'STYLE' || 
              parent.tagName === 'INPUT' || 
              parent.tagName === 'TEXTAREA' ||
              parent.matches('.chrome-ext-search-highlight')) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const nodes = [];
    let node;
    let matchCount = 0;
    
    while (node = walker.nextNode()) {
      nodes.push(node);
    }

    nodes.forEach(textNode => {
      const text = textNode.textContent || '';
      const matches = text.match(regex);
      
      if (matches) {
        matchCount += matches.length;
        const parts = text.split(regex);
        const fragment = document.createDocumentFragment();
        
        parts.forEach((part, i) => {
          fragment.appendChild(document.createTextNode(part));
          
          if (i < parts.length - 1) {
            const highlight = document.createElement('span');
            const themeClass = theme !== 'default' ? ` theme-${theme}` : '';
            highlight.className = persist ? 
              `chrome-ext-search-highlight chrome-ext-search-persistent${themeClass}` : 
              `chrome-ext-search-highlight${themeClass}`;
            highlight.textContent = matches[i];
            highlight.dataset.query = query; // Store query for reference
            highlight.dataset.theme = theme; // Store theme for reference
            fragment.appendChild(highlight);
          }
        });
        
        textNode.parentNode?.replaceChild(fragment, textNode);
      }
    });

    // Store highlights based on persistence
    if (persist) {
      const highlights = document.querySelectorAll(`.chrome-ext-search-highlight[data-query="${query}"]`);
      this.persistentHighlights.set(query, Array.from(highlights));
    }

    return {
      matchCount,
      searchLimitReached: this.persistentHighlights.size >= this.MAX_PERSISTENT_SEARCHES
    };
  }

  clearTemporaryHighlights() {
    // Only clear highlights that aren't persistent
    const highlightsToRemove = document.querySelectorAll('.chrome-ext-search-highlight:not(.chrome-ext-search-persistent)');
    highlightsToRemove.forEach(highlight => {
      const parent = highlight.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(highlight.textContent || ''), highlight);
        parent.normalize();
      }
    });
  }
}

// Initialize the search manager when the content script loads
const searchManager = new SearchManager();

// Notify that content script is loaded
chrome.runtime.sendMessage({ action: 'contentScriptLoaded' }); 