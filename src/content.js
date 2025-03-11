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
    this.currentHighlightIndex = -1;
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
          this.handleSearch(request.query).then(response => {
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

  async handleSearch(query) {
    this.clearHighlights();
    
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
            highlight.className = 'chrome-ext-search-highlight';
            highlight.textContent = matches[i];
            fragment.appendChild(highlight);
            this.highlights.push(highlight);
          }
        });
        
        textNode.parentNode?.replaceChild(fragment, textNode);
      }
    });

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
      if (index === this.currentHighlightIndex) {
        highlight.classList.add('chrome-ext-search-highlight-current');
      } else {
        highlight.classList.remove('chrome-ext-search-highlight-current');
      }
    });
  }

  clearHighlights() {
    this.highlights.forEach(highlight => {
      const parent = highlight.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(highlight.textContent || ''), highlight);
        parent.normalize();
      }
    });
    this.highlights = [];
    this.currentHighlightIndex = -1;
  }
}

// Initialize the search manager when the content script loads
const searchManager = new SearchManager();

// Notify that content script is loaded
chrome.runtime.sendMessage({ action: 'contentScriptLoaded' }); 