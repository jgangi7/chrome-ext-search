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
    this.persistentHighlights = new Map();
    this.currentHighlightIndex = -1;
    this.currentTheme = 'default'; // default, purple, blue, or gold
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
        case 'setTheme':
          this.currentTheme = request.theme || 'default';
          sendResponse({ status: 'theme_updated' });
          break;
      }

      return true;
    });
  }

  getThemeClasses(persist = false) {
    const themeMap = {
      default: {
        highlight: 'chrome-ext-search-highlight',
        current: 'chrome-ext-search-highlight-current',
        persistent: 'chrome-ext-search-persistent'
      },
      purple: {
        highlight: 'chrome-ext-search-highlight-purple',
        current: 'chrome-ext-search-highlight-purple-current',
        persistent: 'chrome-ext-search-persistent-purple'
      },
      blue: {
        highlight: 'chrome-ext-search-highlight-blue',
        current: 'chrome-ext-search-highlight-blue-current',
        persistent: 'chrome-ext-search-persistent-blue'
      },
      gold: {
        highlight: 'chrome-ext-search-highlight-gold',
        current: 'chrome-ext-search-highlight-gold-current',
        persistent: 'chrome-ext-search-persistent-gold'
      }
    };

    const theme = themeMap[this.currentTheme] || themeMap.default;
    const classes = [theme.highlight];
    
    if (persist) {
      classes.push(theme.persistent);
    }

    return classes.join(' ');
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

  async handleSearch(query, persist = false, theme = null) {
    if (theme) {
      this.currentTheme = theme;
    }
    
    this.clearTemporaryHighlights();
    
    if (!query) {
      return { matchCount: 0, currentMatch: 0 };
    }

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
              parent.matches('[class*="chrome-ext-search-highlight"]')) {
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
            highlight.className = this.getThemeClasses(persist);
            highlight.textContent = matches[i];
            highlight.dataset.query = query;
            highlight.dataset.theme = this.currentTheme;
            fragment.appendChild(highlight);
            newHighlights.push(highlight);
          }
        });
        
        textNode.parentNode?.replaceChild(fragment, textNode);
      }
    });

    if (persist) {
      this.persistentHighlights.set(query, newHighlights);
    }
    this.highlights = newHighlights;

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
    const theme = this.currentTheme;
    const currentClass = `chrome-ext-search-highlight-${theme === 'default' ? '' : theme + '-'}current`;
    
    this.highlights.forEach((highlight, index) => {
      if (index === this.currentHighlightIndex) {
        highlight.classList.add(currentClass);
      } else {
        highlight.classList.remove(currentClass);
      }
    });
  }

  clearTemporaryHighlights() {
    const highlightsToRemove = document.querySelectorAll('[class*="chrome-ext-search-highlight"]:not([class*="persistent"])');
    highlightsToRemove.forEach(highlight => {
      const parent = highlight.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(highlight.textContent || ''), highlight);
        parent.normalize();
      }
    });
    
    this.highlights = Array.from(document.querySelectorAll('[class*="chrome-ext-search-highlight"]'));
    this.currentHighlightIndex = -1;
  }
}

// Initialize the search manager when the content script loads
const searchManager = new SearchManager();

// Notify that content script is loaded
chrome.runtime.sendMessage({ action: 'contentScriptLoaded' }); 