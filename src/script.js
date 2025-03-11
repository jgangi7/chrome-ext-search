document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('searchButton').addEventListener('click', highlightText);
  });
  
  function highlightText() {
    // Remove previous highlights
    const elements = document.querySelectorAll('.highlight');
    elements.forEach(el => {
      el.outerHTML = el.innerHTML;
    });
  
    // Get search term
    const searchTerm = document.getElementById('searchInput').value;
    if (!searchTerm) return;
  
    const bodyText = document.body.innerHTML;
    const regex = new RegExp(`(${searchTerm})`, 'gi');
    const highlightedText = bodyText.replace(regex, '<span class="highlight">$1</span>');
    document.body.innerHTML = highlightedText;
  }
  