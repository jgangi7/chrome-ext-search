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
    this.searchTerms = []; // Array to store search terms and their themes
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
          // Handle search synchronously to ensure response is sent
          const response = this.handleSearch(request.query, request.persist, request.theme);
          
          // Only log search when persist flag is true (Enter key pressed)
          if (request.persist) {
            this.logSearch(request.query, response.matchCount);
            // Add to search terms if persistent
            if (!response.searchLimitReached) {
              this.searchTerms.push({ query: request.query, theme: request.theme });
            }
          }
          
          // Add search limit info to response
          response.searchLimitReached = this.persistentHighlights.size >= this.MAX_PERSISTENT_SEARCHES;
          sendResponse(response);
          break;
        case 'getSearchTerms':
          sendResponse({ terms: this.searchTerms });
          break;
        case 'removeSearchTerm':
          const result = this.removeSearchTerm(request.index);
          sendResponse(result);
          break;
      }

      return false; // Don't keep the message channel open
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

  handleSearch(query, persist = false, theme = 'default') {
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

    // At the end of the method, return the result with searchLimitReached flag
    return {
      matchCount: matchCount,
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

  removeSearchTerm(index) {
    // Implementation of removeSearchTerm method
  }
}

// Initialize the search manager when the content script loads
const searchManager = new SearchManager();

// Notify that content script is loaded
chrome.runtime.sendMessage({ action: 'contentScriptLoaded' }); 