# Chrome Extension Multi-Color Search

A Chrome extension that allows you to search and highlight text on web pages with cycling color themes. Each search term is highlighted in a different color, making it easy to distinguish between multiple search terms.

## Features

- Search and highlight text on any web page
- Automatic color cycling through four themes:
  - Green (#9CB380)
  - Purple (#C45AB3)
  - Blue (#5762D5)
  - Gold (#DDA448)
- Maintain up to 4 persistent search terms simultaneously
- Search history with color-coded indicators
- Real-time search highlighting as you type
- Persistent highlights remain until removed

## Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/yourusername/chrome-ext-search.git
   ```

2. Open Chrome and navigate to `chrome://extensions/`

3. Enable "Developer mode" in the top right corner

4. Click "Load unpacked" and select the directory containing the extension

## Usage

1. Click the extension icon in your Chrome toolbar to open the search popup

2. Type your search term and:
   - Press Enter to create a persistent highlight (up to 4 terms)
   - Type normally for temporary real-time highlighting

3. Each time you press Enter:
   - The current term is highlighted in the current color
   - The search bar color changes to the next theme
   - The term is added to the search history

4. Click the clock icon to view your search history
   - Each term shows a colored dot matching its highlight color
   - Click the × button to remove a term and its highlights

5. The search input will be disabled when you reach 4 persistent terms
   - Remove terms to enable searching again
   - The background turns white to indicate the limit is reached

## File Structure

```
chrome-ext-search/
├── src/
│   ├── content.js     # Content script for page manipulation
│   ├── content.css    # Styles for highlights
│   └── popup.js       # Popup UI logic
├── popup.html         # Popup UI structure
└── manifest.json      # Extension configuration
```

## Potential Improvements

1. Search Enhancement:
   - Case-sensitive search option
   - Regular expression support
   - Word boundary matching
   - Fuzzy search capabilities

2. User Interface:
   - Customizable color themes
   - Adjustable maximum search terms
   - Keyboard shortcuts for navigation
   - Search term statistics (count, position)
   - Dark mode support

3. Functionality:
   - Navigate between highlights
   - Export/import search configurations
   - Save searches per domain
   - Search across multiple tabs
   - Bookmark highlighted terms

4. Performance:
   - Optimize highlight rendering for large documents
   - Cache search results
   - Batch DOM updates
   - Lazy loading for long pages

5. Integration:
   - Share highlights with other users
   - Sync settings across devices
   - Integration with note-taking apps
   - Browser bookmark integration

## License

This project is licensed under the MIT License - see the LICENSE file for details. 