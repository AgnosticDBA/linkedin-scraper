
document.addEventListener('DOMContentLoaded', async () => {
    const scrapeButton = document.getElementById('scrape-button');
    const settingsToggle = document.getElementById('settings-toggle');
    const settingsDiv = document.getElementById('settings');
    const saveSettingsButton = document.getElementById('save-settings');
    
    const scrapingStatus = document.getElementById('scraping-status');
    const postsCount = document.getElementById('posts-count');
    const currentPage = document.getElementById('current-page');
    
    const webhookUrlInput = document.getElementById('webhook-url');
    const maxPostsInput = document.getElementById('max-posts');
    const autoScrapeInput = document.getElementById('auto-scrape');
    const settingsMessage = document.getElementById('settings-message');

    await loadSettings();
    
    await updateStatus();
    
    scrapeButton.addEventListener('click', startScraping);
    settingsToggle.addEventListener('click', toggleSettings);
    saveSettingsButton.addEventListener('click', saveSettings);

    async function loadSettings() {
        const result = await chrome.storage.sync.get([
            'webhookUrl', 
            'maxPosts', 
            'autoScrape'
        ]);
        
        webhookUrlInput.value = result.webhookUrl || 'http://localhost:3000/webhook/linkedin-feed';
        maxPostsInput.value = result.maxPosts || 25;
        autoScrapeInput.checked = result.autoScrape || false;
    }

    async function updateStatus() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (!tab.url.includes('linkedin.com')) {
                currentPage.textContent = 'Not LinkedIn';
                scrapeButton.disabled = true;
                scrapeButton.textContent = '❌ Not on LinkedIn';
                return;
            }
            
            if (!tab.url.includes('/feed')) {
                currentPage.textContent = 'LinkedIn (not feed)';
                scrapeButton.disabled = true;
                scrapeButton.textContent = '❌ Not on LinkedIn Feed';
                return;
            }
            
            currentPage.textContent = 'LinkedIn Feed';
            scrapeButton.disabled = false;
            scrapeButton.textContent = '🚀 Start Scraping';
            
            chrome.tabs.sendMessage(tab.id, { action: 'getStatus' }, (response) => {
                if (response) {
                    scrapingStatus.textContent = response.isActive ? 'Scraping...' : 'Ready';
                    postsCount.textContent = response.postsFound || 0;
                    
                    if (response.isActive) {
                        scrapeButton.disabled = true;
                        scrapeButton.textContent = '⏳ Scraping...';
                    }
                }
            });
            
        } catch (error) {
            console.error('Error updating status:', error);
            currentPage.textContent = 'Error';
        }
    }

    async function startScraping() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            scrapeButton.disabled = true;
            scrapeButton.textContent = '⏳ Starting...';
            scrapingStatus.textContent = 'Starting...';
            
            chrome.tabs.sendMessage(tab.id, { action: 'startScraping' }, (response) => {
                if (response && response.success) {
                    scrapingStatus.textContent = 'Scraping...';
                    
                    const pollInterval = setInterval(() => {
                        chrome.tabs.sendMessage(tab.id, { action: 'getStatus' }, (statusResponse) => {
                            if (statusResponse) {
                                scrapingStatus.textContent = statusResponse.isActive ? 'Scraping...' : 'Complete';
                                postsCount.textContent = statusResponse.postsFound || 0;
                                
                                if (!statusResponse.isActive) {
                                    clearInterval(pollInterval);
                                    scrapeButton.disabled = false;
                                    scrapeButton.textContent = '🚀 Start Scraping';
                                }
                            }
                        });
                    }, 1000);
                    
                    setTimeout(() => {
                        clearInterval(pollInterval);
                        scrapeButton.disabled = false;
                        scrapeButton.textContent = '🚀 Start Scraping';
                    }, 60000);
                    
                } else {
                    scrapeButton.disabled = false;
                    scrapeButton.textContent = '🚀 Start Scraping';
                    scrapingStatus.textContent = 'Error';
                }
            });
            
        } catch (error) {
            console.error('Error starting scraping:', error);
            scrapeButton.disabled = false;
            scrapeButton.textContent = '🚀 Start Scraping';
            scrapingStatus.textContent = 'Error';
        }
    }

    function toggleSettings() {
        const isVisible = settingsDiv.style.display !== 'none';
        settingsDiv.style.display = isVisible ? 'none' : 'block';
        settingsToggle.textContent = isVisible ? '⚙️ Settings' : '❌ Close Settings';
    }

    async function saveSettings() {
        try {
            const settings = {
                webhookUrl: webhookUrlInput.value.trim(),
                maxPosts: parseInt(maxPostsInput.value) || 25,
                autoScrape: autoScrapeInput.checked
            };
            
            if (settings.webhookUrl && !isValidUrl(settings.webhookUrl)) {
                showSettingsMessage('Invalid webhook URL', 'error');
                return;
            }
            
            if (settings.maxPosts < 1 || settings.maxPosts > 100) {
                showSettingsMessage('Max posts must be between 1 and 100', 'error');
                return;
            }
            
            await chrome.storage.sync.set(settings);
            showSettingsMessage('Settings saved successfully!', 'success');
            
        } catch (error) {
            console.error('Error saving settings:', error);
            showSettingsMessage('Error saving settings', 'error');
        }
    }

    function showSettingsMessage(message, type) {
        settingsMessage.textContent = message;
        settingsMessage.className = type;
        
        setTimeout(() => {
            settingsMessage.textContent = '';
            settingsMessage.className = '';
        }, 3000);
    }

    function isValidUrl(string) {
        try {
            new URL(string);
            return true;
        } catch (_) {
            return false;
        }
    }

    setInterval(updateStatus, 5000);
});
