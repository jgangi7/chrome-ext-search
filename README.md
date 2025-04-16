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

## Getting Started

### Prerequisites
- Google Chrome browser
- Basic knowledge of using Chrome extensions

### Installation Steps

1. Download the extension:
   ```bash
   git clone https://github.com/yourusername/chrome-ext-search.git
   ```
   Or download the ZIP file and extract it to a folder

2. Open Chrome and go to the Extensions page:
   - Type `chrome://extensions` in the address bar, or
   - Click the three dots menu → More Tools → Extensions

3. Enable Developer Mode:
   - Look for the "Developer mode" toggle in the top right corner
   - Click it to turn it ON

4. Load the extension:
   - Click the "Load unpacked" button that appears
   - Navigate to and select the folder containing the extension files
   - Make sure you select the folder that contains `manifest.json`

5. Verify Installation:
   - You should see the extension card appear in your extensions list
   - Look for the extension icon in your Chrome toolbar
   - If you don't see the icon, click the puzzle piece icon in the toolbar and pin the extension 

### First Run

1. Click the extension icon in your Chrome toolbar
2. The search popup will appear
3. Try searching for text on any webpage:
   - Type a word and press Enter to create a persistent highlight
   - The search bar will change color to indicate the next theme
   - Click the clock icon to see your search history

### Troubleshooting

If the extension isn't working:
1. Make sure Developer Mode is enabled
2. Try reloading the extension (click the refresh icon on the extension card)
3. Check the Chrome console for any error messages
4. Verify that all files are present in the extension folder:
   - manifest.json
   - popup.html
   - src/content.js
   - src/content.css
   - src/popup.js

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

2. User Interface:
   - Customizable color themes
   - Adjustable maximum search terms
   - Search term statistics (count, position)
   - Dark mode support

3. Functionality:
   - Navigate between highlights
   - Bookmark highlighted terms
   - Integration with note-taking apps

4. Performance:
   - Optimize highlight rendering for large documents
   - Cache search results
   - Batch DOM updates
   - Lazy loading for long pages

## License

This project is licensed under the MIT License - see the LICENSE file for details. 
