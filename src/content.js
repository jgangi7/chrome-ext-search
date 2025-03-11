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
    this.highlights = [];
    this.persistentHighlights = new Map(); // Map to store persistent highlights by query
    this.currentHighlightIndex = -1;
    this.currentTheme = 'default';
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
            sendResponse(response);
          });
          break;
        case 'navigate':
          this.navigateSearch(request.direction).then(response => {
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
    // Clear temporary highlights but keep persistent ones
    this.clearTemporaryHighlights();
    
    if (!query) {
      return { matchCount: 0, currentMatch: 0 };
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
    
    while (node = walker.nextNode()) {
      nodes.push(node);
    }

    const newHighlights = [];
    nodes.forEach(textNode => {
      const text = textNode.textContent || '';
      const matches = text.match(regex);
      
      if (matches) {
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
            newHighlights.push(highlight);
          }
        });
        
        textNode.parentNode?.replaceChild(fragment, textNode);
      }
    });

    // Store highlights based on persistence
    if (persist) {
      this.persistentHighlights.set(query, newHighlights);
    }
    this.highlights = newHighlights;

    // Set initial highlight
    if (this.highlights.length > 0) {
      this.currentHighlightIndex = 0;
      this.scrollToHighlight(this.highlights[0]);
      this.updateHighlightStyles();
    }

    return {
      matchCount: this.highlights.length,
      currentMatch: this.highlights.length > 0 ? 1 : 0
    };
  }

  async navigateSearch(direction) {
    if (this.highlights.length === 0) {
      return { matchCount: 0, currentMatch: 0 };
    }

    // Update current index
    if (direction === 'next') {
      this.currentHighlightIndex = (this.currentHighlightIndex + 1) % this.highlights.length;
    } else {
      this.currentHighlightIndex = (this.currentHighlightIndex - 1 + this.highlights.length) % this.highlights.length;
    }

    // Scroll to the current highlight
    this.scrollToHighlight(this.highlights[this.currentHighlightIndex]);
    this.updateHighlightStyles();

    return {
      matchCount: this.highlights.length,
      currentMatch: this.currentHighlightIndex + 1
    };
  }

  scrollToHighlight(element) {
    element.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    });
  }

  updateHighlightStyles() {
    this.highlights.forEach((highlight, index) => {
      // Remove all theme classes first
      highlight.classList.remove('theme-purple', 'theme-blue', 'theme-gold');
      
      // Remove current highlight class
      highlight.classList.remove('chrome-ext-search-highlight-current');
      
      // Get the stored theme for this highlight
      const storedTheme = highlight.dataset.theme;
      
      // Add theme class if not default
      if (storedTheme && storedTheme !== 'default') {
        highlight.classList.add(`theme-${storedTheme}`);
      }
      
      // Add current highlight class if this is the current index
      if (index === this.currentHighlightIndex) {
        highlight.classList.add('chrome-ext-search-highlight-current');
      }
    });
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
    
    // Update highlights array to include all current search highlights
    this.highlights = [];
    
    // Add persistent highlights to the array and ensure they have correct theme classes
    this.persistentHighlights.forEach((highlights, query) => {
      highlights.forEach(highlight => {
        // Remove all theme classes first
        highlight.classList.remove('theme-purple', 'theme-blue', 'theme-gold');
        
        // Add the stored theme class back if it exists
        const storedTheme = highlight.dataset.theme;
        if (storedTheme && storedTheme !== 'default') {
          highlight.classList.add(`theme-${storedTheme}`);
        }
        
        this.highlights.push(highlight);
      });
    });
    
    this.currentHighlightIndex = -1;
  }
}

// Initialize the search manager when the content script loads
const searchManager = new SearchManager();

// Notify that content script is loaded
chrome.runtime.sendMessage({ action: 'contentScriptLoaded' }); 